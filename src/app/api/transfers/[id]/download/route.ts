import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { eq, sql } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/withAuth';
import { db } from '@/lib/db/client';
import { transfers, downloadSessions } from '@/lib/db/schema';
import { ByteCounter, newContentDecipher, unwrapDek } from '@/lib/crypto/envelope';
import { MASTER_KEK } from '@/lib/crypto/master';
import { beginSession, endSession, hashIdentifier, tick } from '@/lib/abuse/detector';
import { env } from '@/lib/env';
import { log } from '@/lib/log';
import { isTransferAccessible } from '@/lib/transfers/auth';
import { purgeTransfer } from '@/lib/transfers/purge';
import { isUuid, safeAsciiSlug } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Take the right-most XFF entry — that's the value appended by the trusted
// reverse proxy (Traefik). In dev with no proxy, XFF is absent and we hash
// an empty string, which is fine for the divergence rule.
function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for') ?? '';
  const parts = xff.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
  return parts.length > 0 ? parts[parts.length - 1]! : '';
}

interface DownloadableTransfer {
  id: string;
  size_bytes: number;
  blob_path: string;
  filename: string;
  expires_at: Date;
  dek_wrapped: Buffer;
  dek_wrap_iv: Buffer;
  dek_wrap_tag: Buffer;
  content_iv: Buffer;
  content_tag: Buffer;
}

async function finalizeDownload(
  t: DownloadableTransfer,
  sessionId: string,
  bytesSent: number,
  errored: boolean,
): Promise<void> {
  if (errored) log.error('transfer.decrypt_failed');
  try {
    endSession(t.id, sessionId);
    const deletePromise = db.delete(downloadSessions).where(eq(downloadSessions.id, sessionId));
    const updatePromise =
      !errored && bytesSent >= t.size_bytes
        ? db
            .update(transfers)
            .set({ first_downloaded_at: sql`coalesce(${transfers.first_downloaded_at}, now())` })
            .where(eq(transfers.id, t.id))
        : Promise.resolve();
    await Promise.all([deletePromise, updatePromise]);
    // Only check purge eligibility for expired transfers — fresh ones can't
    // be purged yet anyway, so skip the extra round-trip.
    if (t.expires_at.getTime() > Date.now()) return;
    const remaining = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(downloadSessions)
      .where(eq(downloadSessions.transfer_id, t.id));
    if ((remaining[0]?.n ?? 0) > 0) return;
    await purgeTransfer({
      id: t.id,
      sender_id: null,
      size_bytes: t.size_bytes,
      blob_path: t.blob_path,
    });
  } catch (err) {
    log.error('db.error', { code: (err as { code?: string }).code ?? 'finalize' });
  }
}

export const GET = withAuth(async (req: Request, ctx: { params: Promise<{ id: string }> }, user) => {
  const { id } = await ctx.params;
  // Reject malformed ids up front. Without this, drizzle hands the raw string
  // to Postgres' uuid input and a 22P02 parse error escapes as a 500.
  if (!isUuid(id)) {
    return Response.json({ error: 'transfer_not_found' }, { status: 404 });
  }

  // Range/resume isn't supported (streaming GCM can't be seeked safely).
  // Refuse the request before we touch the DB so a client doesn't think a
  // 200 means partial content was honoured.
  if (req.headers.has('range')) {
    return new Response(null, { status: 416, headers: { 'Accept-Ranges': 'none' } });
  }

  const rows = await db
    .select({
      id: transfers.id,
      sender_id: transfers.sender_id,
      recipient_discord_id: transfers.recipient_discord_id,
      filename: transfers.filename,
      size_bytes: transfers.size_bytes,
      blob_path: transfers.blob_path,
      dek_wrapped: transfers.dek_wrapped,
      dek_wrap_iv: transfers.dek_wrap_iv,
      dek_wrap_tag: transfers.dek_wrap_tag,
      content_iv: transfers.content_iv,
      content_tag: transfers.content_tag,
      expires_at: transfers.expires_at,
    })
    .from(transfers)
    .where(eq(transfers.id, id))
    .limit(1);
  const t = rows[0];
  if (!isTransferAccessible(t, user.discord_id)) {
    return Response.json({ error: 'transfer_not_found' }, { status: 404 });
  }
  // isTransferAccessible has narrowed expires_at and content_tag to non-null,
  // but TS can't follow predicates through arbitrary object shapes — assert
  // the downloadable shape so the rest of the handler can read them plainly.
  const dl = t as unknown as DownloadableTransfer;

  const ip_hash = hashIdentifier(clientIp(req));
  const ua_hash = hashIdentifier(req.headers.get('user-agent') ?? '');

  let sessionId: string;
  try {
    const inserted = await db
      .insert(downloadSessions)
      .values({ transfer_id: dl.id, ip_hash, ua_hash, bytes_sent: 0 })
      .returning({ id: downloadSessions.id });
    sessionId = inserted[0]!.id;
  } catch {
    // The cleanup worker can purge an expired transfer between the SELECT
    // above and this INSERT — the FK then trips. Collapse into the same 404
    // as a missing transfer rather than leaking a 500.
    return Response.json({ error: 'transfer_not_found' }, { status: 404 });
  }

  const begin = beginSession({ transferId: dl.id, sessionId, ipHash: ip_hash, uaHash: ua_hash, isRangeRequest: false });
  if (begin.killReason) {
    await db.delete(downloadSessions).where(eq(downloadSessions.id, sessionId));
    log.warn('abuse.session_killed', { reason: begin.killReason });
    return Response.json({ error: 'rate_limited' }, { status: 429 });
  }

  const blobAbs = join(env.CARGO_BLOB_PATH, dl.blob_path);
  try {
    await stat(blobAbs);
  } catch {
    await db.delete(downloadSessions).where(eq(downloadSessions.id, sessionId));
    return Response.json({ error: 'transfer_not_found' }, { status: 404 });
  }

  let dek: Buffer;
  try {
    dek = unwrapDek(
      { dek_wrapped: dl.dek_wrapped, dek_wrap_iv: dl.dek_wrap_iv, dek_wrap_tag: dl.dek_wrap_tag },
      MASTER_KEK,
    );
  } catch {
    await db.delete(downloadSessions).where(eq(downloadSessions.id, sessionId));
    log.error('transfer.decrypt_failed');
    return Response.json({ error: 'decrypt_failed' }, { status: 500 });
  }

  // Streaming GCM: `decipher` emits plaintext as it arrives and only verifies
  // the auth tag on `final()`. That means a client receives bytes before
  // integrity is confirmed. We accept that trade-off because the only writer
  // to the blob path is this process (no attacker-writable storage), so the
  // tag exists to catch disk bit-rot, not tampering. On tag failure, `final()`
  // throws → the pipeline emits 'error' → the response body errors → the
  // browser shows a failed download. Per-chunk tag segments would close the
  // window but require a blob-format change and migration; see docs/SECURITY.
  const fileStream = createReadStream(blobAbs);
  const decipher = newContentDecipher(dek, dl.content_iv, dl.content_tag);
  const counter = new ByteCounter();

  const tickEvery = 256 * 1024;
  let sinceLastTick = 0;
  counter.on('data', (chunk: Buffer) => {
    sinceLastTick += chunk.byteLength;
    if (sinceLastTick < tickEvery) return;
    const delta = sinceLastTick;
    sinceLastTick = 0;
    if (tick({ transferId: dl.id, sessionId, bytesDelta: delta }) === 'bandwidth') {
      log.warn('abuse.session_killed', { reason: 'bandwidth' });
      fileStream.destroy(new Error('bandwidth_kill'));
    }
  });

  const piped = fileStream.pipe(decipher).pipe(counter);

  let finalized = false;
  const onEnd = (errored: boolean): void => {
    // 'close' and 'error' can both fire on the same stream; only run once.
    if (finalized) return;
    finalized = true;
    dek.fill(0);
    void finalizeDownload(dl, sessionId, counter.bytes, errored);
  };
  piped.on('close', () => onEnd(false));
  piped.on('error', () => onEnd(true));

  // Strict charset for the legacy ASCII fallback: only alnum, dot, dash,
  // underscore — anything else becomes '_'. Keeps `"` and `\` out of the
  // Content-Disposition value so a hostile filename can't smuggle extra
  // parameters into the response header. Real filename is carried in
  // `filename*=` (RFC 5987), which encodeURIComponent handles safely.
  const filenameAscii = safeAsciiSlug(dl.filename, 255, 'download');
  const filenameStar = `UTF-8''${encodeURIComponent(dl.filename)}`;
  return new Response(Readable.toWeb(piped) as unknown as ReadableStream<Uint8Array>, {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filenameAscii}"; filename*=${filenameStar}`,
      // size_bytes is the authoritative plaintext length captured at upload
      // finalize; AES-GCM streaming preserves length, so this also matches
      // the blob on disk.
      'Content-Length': String(dl.size_bytes),
      'Accept-Ranges': 'none',
      'Cache-Control': 'no-store',
    },
  });
});
