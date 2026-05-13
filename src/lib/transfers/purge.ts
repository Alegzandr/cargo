import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import { transfers } from '../db/schema.js';
import { env } from '../env.js';
import { releaseQuota } from './quotaRefund.js';

// Fields purgeTransfer needs to remove a row, refund its sender, and unlink
// its blob. Callers select exactly these columns so a future schema change
// doesn't silently widen the surface area.
export interface PurgeTarget {
  id: string;
  sender_id: string | null;
  size_bytes: number;
  blob_path: string;
}

// Best-effort unlink the blob — ENOENT means another path (worker, parallel
// purge) won the race and removed it first.
async function unlinkBlob(blob_path: string): Promise<void> {
  try {
    await fs.unlink(join(env.CARGO_BLOB_PATH, blob_path));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
}

// Removes the transfers row, refunds the sender's quota in the same tx, then
// best-effort unlinks the blob. Used by the worker, manual revoke, account
// delete, and the post-expiry-last-download path.
export async function purgeTransfer(t: PurgeTarget): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(transfers).where(eq(transfers.id, t.id));
    if (t.sender_id) await releaseQuota(t.sender_id, t.size_bytes, tx);
  });
  await unlinkBlob(t.blob_path);
}

// Batched variant used by account delete and bulk revoke. Refunds are
// rolled into the same tx as the DELETE so a crash mid-loop can't leave a
// quota credit dangling. Blob unlinks happen after the tx commits.
export async function purgeTransfers(targets: PurgeTarget[]): Promise<void> {
  if (targets.length === 0) return;
  const ids = targets.map((t) => t.id);
  await db.transaction(async (tx) => {
    await tx.delete(transfers).where(inArray(transfers.id, ids));
    // Aggregate refunds per sender so we issue one UPDATE per distinct sender
    // rather than N. sender_id is nullable when the sender's account was
    // already deleted (FK on-delete-set-null) — skip those.
    const bySender = new Map<string, number>();
    for (const t of targets) {
      if (!t.sender_id) continue;
      bySender.set(t.sender_id, (bySender.get(t.sender_id) ?? 0) + t.size_bytes);
    }
    for (const [senderId, bytes] of bySender) {
      await releaseQuota(senderId, bytes, tx);
    }
  });
  await Promise.all(targets.map((t) => unlinkBlob(t.blob_path)));
}
