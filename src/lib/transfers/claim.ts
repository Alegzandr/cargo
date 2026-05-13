import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { transfers, TRANSFER_STATUS } from '../db/schema.js';
import { env } from '../env.js';
import { noteClaim } from '../auth/recentClaims.js';

// Claim any pending transfers addressed to this handle. Authorization is keyed
// on recipient_discord_id (immutable), not recipient_username (mutable,
// recyclable on Discord) — so the first sign-in of someone holding the handle
// locks ownership of in-flight transfers to that Discord account. Subsequent
// handle changes or recycle-then-claim attempts cannot override an already-
// bound row.
//
// The same statement flips status pending→ready and starts a fresh 1-hour
// download TTL from the moment of claim — the link clock only begins when the
// recipient is actually able to download.
export async function claimPendingTransfers(discordId: string, username: string): Promise<void> {
  const claimed = await db
    .update(transfers)
    .set({
      recipient_discord_id: discordId,
      status: TRANSFER_STATUS.READY,
      delivered_at: sql`now()`,
      expires_at: sql`now() + (${env.CARGO_LINK_TTL_SECONDS}::int * interval '1 second')`,
      pending_expires_at: null,
    })
    .where(
      and(
        isNull(transfers.recipient_discord_id),
        eq(transfers.recipient_username, username),
        eq(transfers.status, TRANSFER_STATUS.PENDING),
      ),
    )
    .returning({ id: transfers.id });
  // Stash the count for the inbox welcome card. Read-and-cleared on first
  // inbox visit after sign-in (TTL'd defensively, see recentClaims.ts).
  if (claimed.length > 0) noteClaim(discordId, claimed.length);
}
