import { and, eq, sql } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/withAuth';
import { db } from '@/lib/db/client';
import { transfers, TRANSFER_STATUS, users } from '@/lib/db/schema';
import { env } from '@/lib/env';
import { purgeTransfer } from '@/lib/transfers/purge';
import { isUuid } from '@/lib/utils';
import { isValidHandle, normalizeHandle } from '@/lib/validators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = withAuth(async (req: Request, ctx: Ctx, user) => {
  const { id } = await ctx.params;
  if (!isUuid(id)) {
    return Response.json({ error: 'transfer_not_found' }, { status: 404 });
  }

  let confirm_filename: string;
  try {
    const body = (await req.json()) as { confirm_filename?: string };
    confirm_filename = body.confirm_filename ?? '';
  } catch {
    return Response.json({ error: 'bad_request' }, { status: 400 });
  }

  // Scope the SELECT to (id, sender_id) so a non-sender's call returns zero
  // rows and is indistinguishable from a non-existent transfer — same
  // pattern as the PATCH below and the download GET. The filename confirm
  // check then happens on a row we already know belongs to the caller.
  const rows = await db
    .select({
      id: transfers.id,
      sender_id: transfers.sender_id,
      filename: transfers.filename,
      size_bytes: transfers.size_bytes,
      blob_path: transfers.blob_path,
    })
    .from(transfers)
    .where(and(eq(transfers.id, id), eq(transfers.sender_id, user.id)))
    .limit(1);
  const t = rows[0];
  if (!t) return Response.json({ error: 'transfer_not_found' }, { status: 404 });
  if (t.filename !== confirm_filename) {
    return Response.json({ error: 'confirm_mismatch' }, { status: 422 });
  }

  await purgeTransfer(t);
  return Response.json({ ok: true });
});

export const PATCH = withAuth(async (req: Request, ctx: Ctx, user) => {
  const { id } = await ctx.params;
  if (!isUuid(id)) {
    return Response.json({ error: 'transfer_not_found' }, { status: 404 });
  }

  let raw: string;
  try {
    const body = (await req.json()) as { recipient_username?: string };
    raw = body.recipient_username ?? '';
  } catch {
    return Response.json({ error: 'bad_request' }, { status: 400 });
  }

  const next = normalizeHandle(raw);
  if (!isValidHandle(next)) {
    return Response.json({ error: 'invalid_handle' }, { status: 422 });
  }

  // Re-resolve the recipient binding from scratch. If a Cargo user already
  // holds the new handle, bind to their immutable discord_id now; otherwise
  // null it so the next sign-in of someone claiming the handle picks it up.
  // Either way we must overwrite the previous binding — leaving the prior
  // recipient_discord_id in place would let the original recipient keep
  // access to a transfer the sender has visibly reassigned.
  const existing = await db
    .select({ discord_id: users.discord_id })
    .from(users)
    .where(eq(users.username, next))
    .limit(1);
  const nextDiscordId = existing[0]?.discord_id ?? null;

  // Reassign rules:
  //   * Known new recipient → flip to ready, start 1h download window now if
  //     the row hasn't already been delivered. If it was already delivered,
  //     keep the original expires_at so the clock isn't reset by reassign.
  //   * Unknown new handle  → revert to pending with a fresh pending TTL, drop
  //     expires_at and delivered_at. The recipient handle currently shown is
  //     stale, so the prior 1h window no longer applies.
  // (id, sender_id) scope keeps non-senders' PATCHes a no-op.
  const nextStatus = nextDiscordId ? TRANSFER_STATUS.READY : TRANSFER_STATUS.PENDING;
  const setClause = nextDiscordId
    ? {
        recipient_username: next,
        recipient_discord_id: nextDiscordId,
        status: nextStatus,
        delivered_at: sql`coalesce(${transfers.delivered_at}, now())`,
        expires_at: sql`coalesce(${transfers.expires_at}, now() + (${env.CARGO_LINK_TTL_SECONDS}::int * interval '1 second'))`,
        pending_expires_at: null,
      }
    : {
        recipient_username: next,
        recipient_discord_id: null,
        status: nextStatus,
        delivered_at: null,
        expires_at: null,
        pending_expires_at: sql`now() + (${env.CARGO_PENDING_TTL_SECONDS}::int * interval '1 second')`,
      };

  const updated = await db
    .update(transfers)
    .set(setClause)
    .where(and(eq(transfers.id, id), eq(transfers.sender_id, user.id)))
    .returning({ id: transfers.id });

  if (updated.length === 0) {
    // Could be 404 (no such transfer) or 403 (not the sender). Collapse both
    // into 404 so an authenticated probe can't confirm existence.
    return Response.json({ error: 'transfer_not_found' }, { status: 404 });
  }
  return Response.json({ ok: true, recipient_username: next });
});
