import { eq, sql } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/withAuth';
import { db } from '@/lib/db/client';
import { transfers, users } from '@/lib/db/schema';
import { loadActiveTransfers } from '@/lib/transfers/list';
import { purgeTransfers } from '@/lib/transfers/purge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withAuth(async (_req, _ctx, user) => {
  const transfers = await loadActiveTransfers('outbox', user.id, user.discord_id);
  return Response.json({ transfers });
});

// Purges every transfer the caller has sent — same per-row semantics as the
// single-id DELETE (kill any in-flight download, unlink the blob, refund the
// sender's quota). Scoped strictly to sender_id so we can never touch someone
// else's row. Returns the count purged so the UI can confirm.
export const DELETE = withAuth(async (_req, _ctx, user) => {
  const rows = await db
    .select({
      id: transfers.id,
      sender_id: transfers.sender_id,
      size_bytes: transfers.size_bytes,
      blob_path: transfers.blob_path,
    })
    .from(transfers)
    .where(eq(transfers.sender_id, user.id));

  await purgeTransfers(rows);

  // Reconcile the denormalized counter against the ground truth. An aborted
  // tus upload reserves quota before the transfers row is inserted, so a
  // crashed/abandoned upload can leave the counter ahead of the active set
  // with nothing for releaseQuota to refund.
  await db
    .update(users)
    .set({
      storage_used_bytes: sql`(
        SELECT COALESCE(SUM(${transfers.size_bytes}), 0)
        FROM ${transfers}
        WHERE ${transfers.sender_id} = ${user.id}
      )`,
    })
    .where(eq(users.id, user.id));

  return Response.json({ ok: true, purged: rows.length });
});
