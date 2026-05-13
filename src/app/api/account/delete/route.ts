import { eq, sql } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/withAuth';
import { signOut } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { transfers, users } from '@/lib/db/schema';
import { purgeTransfers } from '@/lib/transfers/purge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withAuth(async (req, _ctx, user) => {
  let body: { confirm_username?: string };
  try {
    body = (await req.json()) as { confirm_username?: string };
  } catch {
    return Response.json({ error: 'confirm_mismatch' }, { status: 422 });
  }
  if (body.confirm_username !== user.username) {
    return Response.json({ error: 'confirm_mismatch' }, { status: 422 });
  }

  const sent = await db
    .select({
      id: transfers.id,
      sender_id: transfers.sender_id,
      size_bytes: transfers.size_bytes,
      blob_path: transfers.blob_path,
    })
    .from(transfers)
    .where(eq(transfers.sender_id, user.id));
  await purgeTransfers(sent);

  await db.transaction(async (tx) => {
    // Detach our identity from inbound transfers. Using a UUID-suffixed sentinel
    // keeps the row unaddressable so that, within the residual TTL window, a
    // new signup of the same Discord handle cannot inherit a stranger's file.
    // Scoped by recipient_discord_id (immutable) — a handle change before
    // delete cannot orphan a row addressed to our old handle out of reach
    // of this cleanup. The worker purges these on expiry.
    await tx.update(transfers)
      .set({
        recipient_username: sql`'deleted-' || gen_random_uuid()`,
        recipient_discord_id: sql`'deleted-' || gen_random_uuid()`,
      })
      .where(eq(transfers.recipient_discord_id, user.discord_id));
    await tx.delete(users).where(eq(users.id, user.id));
  });

  await signOut({ redirect: false });
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Clear-Site-Data': '"cookies", "storage"',
    },
  });
});
