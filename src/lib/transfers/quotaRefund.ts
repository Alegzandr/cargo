import { eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Refund a sender's storage reservation. Kept under lib/transfers/ rather than
// lib/quota/ because it is only ever invoked from transfer-lifecycle code
// (purge, upload-abort, account delete). `reserveQuota` stays in lib/quota/
// because the act of reserving is the gate on the upload starting at all.
export async function releaseQuota(
  userId: string,
  bytes: number,
  tx: Tx | typeof db = db,
): Promise<void> {
  await tx
    .update(users)
    .set({ storage_used_bytes: sql`greatest(0, ${users.storage_used_bytes} - ${bytes})` })
    .where(eq(users.id, userId));
}
