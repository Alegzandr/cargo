import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { env } from '../env.js';

export type ReserveResult = 'ok' | 'no_user' | 'quota';

// Atomic quota reservation: the conditional UPDATE only succeeds if the user
// exists and the new total fits under the quota. Two parallel reservations
// race here and one of them gets rejected.
//
// The refund counterpart lives at lib/transfers/quotaRefund.ts — only
// transfer-lifecycle code releases (purge, upload-abort, account delete),
// whereas any uploader gates on reserveQuota.
export async function reserveQuota(userId: string, bytes: number): Promise<ReserveResult> {
  const reserved = await db
    .update(users)
    .set({ storage_used_bytes: sql`${users.storage_used_bytes} + ${bytes}` })
    .where(
      and(
        eq(users.id, userId),
        sql`${users.storage_used_bytes} + ${bytes} <= ${env.CARGO_USER_QUOTA}`,
      ),
    )
    .returning({ id: users.id });
  if (reserved.length > 0) return 'ok';
  const userRow = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  return userRow.length === 0 ? 'no_user' : 'quota';
}
