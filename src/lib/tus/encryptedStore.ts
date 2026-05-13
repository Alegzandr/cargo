import { createWriteStream, promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { Transform, type TransformCallback } from 'node:stream';
import { Upload, DataStore } from '@tus/server';
import type { KvStore } from '@tus/server';
import { eq } from 'drizzle-orm';
import { newContentCipher, wrapDek, type EncryptInit } from '../crypto/envelope.js';
import { MASTER_KEK } from '../crypto/master.js';
import { env } from '../env.js';
import { db } from '../db/client.js';
import { transfers, TRANSFER_STATUS, users } from '../db/schema.js';
import { log } from '../log/index.js';
import { isUuid } from '../utils.js';
import { HANDLE_RE, normalizeHandle } from '../validators.js';
import { reserveQuota } from '../quota/index.js';
import { releaseQuota } from '../transfers/quotaRefund.js';
import type { UploadStorage } from './server.js';

interface ActiveUpload {
  init: EncryptInit;
  blobAbsPath: string;
  recipientUsername: string;
  recipientDiscordId: string | null;
  filename: string;
  size: number;
  senderId: string;
  bytesWritten: number;
  // Cached Upload reference so write() can persist the new offset without a
  // round-trip through kvStore.get() on every PATCH.
  upload: Upload;
}

function blobPathFor(id: string): { absolute: string; relative: string } {
  const prefix = id.slice(0, 2);
  const relative = `${prefix}/${id}`;
  return { absolute: join(env.CARGO_BLOB_PATH, relative), relative };
}

function readMetadata(metadata: Record<string, string | null> | undefined): Record<string, string> {
  if (!metadata) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(metadata)) {
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

/**
 * Tus DataStore that encrypts the incoming PATCH stream to disk and finalizes
 * by wrapping the per-file DEK and writing a `transfers` row.
 *
 * State lives in two places:
 *  - `active`: in-memory cipher + offset for the current process. Lost on
 *    restart (the upload would have to restart anyway because we cannot
 *    resume a GCM stream across process boundaries).
 *  - The encrypted ciphertext on disk at `blob_path`.
 *
 * That trade-off is deliberate: tus's resumability is per-process. Real
 * resumability across restarts would require splitting the file into
 * GCM-per-chunk segments, which doubles auth-tag storage and complicates
 * the download decipher. Cargo accepts the simpler model: if the web
 * container restarts mid-upload, the client retries from the start.
 *
 * Quota is reserved atomically at `create()` time and refunded on `remove()`.
 * That prevents the TOCTOU where many parallel creates each pass an
 * independent-pre-finalize check.
 */
export class EncryptedStore extends DataStore {
  private active = new Map<string, ActiveUpload>();

  constructor(public readonly kvStore: KvStore<Upload>) {
    super();
  }

  override async create(upload: Upload): Promise<Upload> {
    const meta = readMetadata(upload.metadata);
    let filename = meta.filename;
    const recipient_username_raw = meta.recipient_username;
    const sender_id = meta.sender_id;
    if (!filename || !recipient_username_raw || !sender_id) {
      throw { status_code: 400, body: 'missing metadata: filename, recipient_username, sender_id' };
    }
    if (!isUuid(sender_id)) {
      throw { status_code: 400, body: 'bad metadata: sender_id not a uuid' };
    }
    const recipient_username = normalizeHandle(recipient_username_raw);
    if (!HANDLE_RE.test(recipient_username)) {
      throw { status_code: 400, body: 'bad metadata: invalid recipient handle' };
    }
    if (filename.length > env.CARGO_MAX_FILENAME_LEN) {
      filename = filename.slice(0, env.CARGO_MAX_FILENAME_LEN);
    }
    const size = upload.size;
    if (typeof size !== 'number' || size <= 0) {
      throw { status_code: 400, body: 'missing Upload-Length' };
    }
    if (size > env.CARGO_MAX_FILE_SIZE) {
      throw { status_code: 413, body: 'file_too_large' };
    }

    const reservation = await reserveQuota(sender_id, size);
    if (reservation === 'no_user') throw { status_code: 401, body: 'unauthenticated' };
    if (reservation === 'quota') {
      log.warn('quota.exceeded');
      throw { status_code: 413, body: 'quota_exceeded' };
    }

    const id = upload.id ?? randomUUID();
    upload.id = id;
    const { absolute, relative } = blobPathFor(id);

    // Bind to the recipient's immutable Discord id if they already have a
    // Cargo account. If not, the column stays null and the signIn callback
    // will claim it the first time someone holding this handle signs in.
    const existing = await db
      .select({ discord_id: users.discord_id })
      .from(users)
      .where(eq(users.username, recipient_username))
      .limit(1);
    const recipient_discord_id = existing[0]?.discord_id ?? null;

    // Anything after reserveQuota() must refund the reservation on failure —
    // tus's remove() is only invoked when the client knows an upload id, and
    // a failure here means the client never got one back.
    try {
      await fs.mkdir(dirname(absolute), { recursive: true });

      const init = newContentCipher();
      const storage: UploadStorage = { type: 'cargo-encrypted', path: relative, sender_id };
      upload.storage = storage as unknown as Upload['storage'];
      this.active.set(id, {
        init,
        blobAbsPath: absolute,
        recipientUsername: recipient_username,
        recipientDiscordId: recipient_discord_id,
        filename,
        size,
        senderId: sender_id,
        bytesWritten: 0,
        upload,
      });
      await this.kvStore.set(id, upload);
      return upload;
    } catch (err) {
      this.active.delete(id);
      try { await releaseQuota(sender_id, size); } catch { /* ignore */ }
      throw err;
    }
  }

  override async write(stream: NodeJS.ReadableStream, id: string, offset: number): Promise<number> {
    const a = this.active.get(id);
    if (!a) throw { status_code: 410, body: 'upload state lost — restart upload' };
    if (offset !== a.bytesWritten) {
      log.warn('tus.chunk_rejected', { reason: 'state' });
      throw { status_code: 409, body: 'offset mismatch' };
    }

    const cipher = a.init.cipher;
    const enc = new Transform({
      transform(chunk: Buffer, _enc: BufferEncoding, cb: TransformCallback) {
        try {
          cb(null, cipher.update(chunk));
        } catch (e) {
          cb(e as Error);
        }
      },
    });

    let chunkBytes = 0;
    let overflow = false;
    const remaining = a.size - a.bytesWritten;
    const counter = new Transform({
      transform(chunk: Buffer, _enc: BufferEncoding, cb: TransformCallback) {
        if (chunkBytes + chunk.byteLength > remaining) {
          overflow = true;
          cb(new Error('size_exceeded'));
          return;
        }
        chunkBytes += chunk.byteLength;
        cb(null, chunk);
      },
    });

    const out = createWriteStream(a.blobAbsPath, { flags: offset === 0 ? 'w' : 'a' });
    try {
      await pipeline(stream, counter, enc, out);
    } catch {
      // The cipher's internal state advanced unpredictably and the on-disk
      // file may be partial. We cannot resume from this point — discard
      // everything and force the client to start a fresh CREATE.
      log.warn('tus.chunk_rejected', { reason: overflow ? 'overflow' : 'pipeline' });
      try { await fs.unlink(a.blobAbsPath); } catch { /* ignore */ }
      this.active.delete(id);
      await this.kvStore.delete(id);
      await releaseQuota(a.senderId, a.size);
      throw { status_code: overflow ? 413 : 500, body: overflow ? 'size_exceeded' : 'write_failed' };
    }
    a.bytesWritten += chunkBytes;

    a.upload.offset = a.bytesWritten;
    await this.kvStore.set(id, a.upload);
    return a.bytesWritten;
  }

  override async getUpload(id: string): Promise<Upload> {
    const u = await this.kvStore.get(id);
    if (!u) throw { status_code: 404, body: 'not_found' };
    return u;
  }

  override async declareUploadLength(id: string, length: number): Promise<void> {
    const u = await this.kvStore.get(id);
    if (!u) throw { status_code: 404, body: 'not_found' };
    u.size = length;
    await this.kvStore.set(id, u);
  }

  /** Tus calls this hook on final byte. We finalize the GCM tag and insert the transfers row. */
  async onUploadFinish(id: string): Promise<{
    share_url: string;
    transfer_id: string;
    expires_at: string | null;
    pending_expires_at: string | null;
    status: 'ready' | 'pending';
  }> {
    const a = this.active.get(id);
    if (!a) throw { status_code: 410, body: 'upload state lost' };

    // Anything in here that throws must release the reservation and unlink
    // the blob — the client sees the upload as failed and never gets an id
    // to DELETE against, so tus's remove() hook will not run.
    try {
      const tail = a.init.cipher.final();
      if (tail.length > 0) {
        await fs.appendFile(a.blobAbsPath, tail);
      }
      const content_tag = a.init.cipher.getAuthTag();
      const wrap = wrapDek(a.init.dek, MASTER_KEK);
      // Best-effort wipe of the DEK we held.
      a.init.dek.fill(0);

      const { relative } = blobPathFor(id);
      const now = new Date();
      // The 1-hour download-link TTL only starts when the recipient claims the
      // transfer. For known recipients that's immediately (status=ready); for
      // unknown handles we leave expires_at NULL and gate the row on
      // pending_expires_at until the signIn callback flips it.
      const isPending = a.recipientDiscordId === null;
      const expires = isPending ? null : new Date(now.getTime() + env.CARGO_LINK_TTL_SECONDS * 1000);
      const pendingExpires = isPending
        ? new Date(now.getTime() + env.CARGO_PENDING_TTL_SECONDS * 1000)
        : null;

      // Storage reservation already taken in create(); this only writes the row.
      await db.insert(transfers).values({
        id,
        sender_id: a.senderId,
        recipient_username: a.recipientUsername,
        recipient_discord_id: a.recipientDiscordId,
        filename: a.filename,
        size_bytes: a.size,
        blob_path: relative,
        dek_wrapped: wrap.dek_wrapped,
        dek_wrap_iv: wrap.dek_wrap_iv,
        dek_wrap_tag: wrap.dek_wrap_tag,
        content_iv: a.init.iv,
        content_tag,
        status: isPending ? TRANSFER_STATUS.PENDING : TRANSFER_STATUS.READY,
        expires_at: expires,
        pending_expires_at: pendingExpires,
        delivered_at: isPending ? null : now,
      });

      this.active.delete(id);
      await this.kvStore.delete(id);

      return {
        transfer_id: id,
        share_url: `/d/${id}`,
        expires_at: expires ? expires.toISOString() : null,
        pending_expires_at: pendingExpires ? pendingExpires.toISOString() : null,
        status: isPending ? 'pending' : 'ready',
      };
    } catch (err) {
      try { a.init.dek.fill(0); } catch { /* dek may already be wiped */ }
      try { await fs.unlink(a.blobAbsPath); } catch { /* ignore */ }
      try { await releaseQuota(a.senderId, a.size); } catch { /* ignore */ }
      this.active.delete(id);
      try { await this.kvStore.delete(id); } catch { /* ignore */ }
      throw err;
    }
  }

  override async remove(id: string): Promise<void> {
    const a = this.active.get(id);
    if (a) {
      try { await fs.unlink(a.blobAbsPath); } catch { /* swallow */ }
      // Refund the quota reservation that create() took.
      try {
        await releaseQuota(a.senderId, a.size);
      } catch (err) {
        log.error('db.error', { code: (err as { code?: string }).code ?? 'remove_refund' });
      }
      this.active.delete(id);
    }
    await this.kvStore.delete(id);
  }
}
