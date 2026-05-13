import { eq, inArray, or } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/withAuth';
import { db } from '@/lib/db/client';
import { transfers, users } from '@/lib/db/schema';
import { safeAsciiSlug } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The shape of this payload is the load-bearing contract — keep it in sync
// with docs/PRIVACY.md.
export const GET = withAuth(async (_req, _ctx, user) => {
  const me = (
    await db
      .select({
        id: users.id,
        discord_id: users.discord_id,
        username: users.username,
        global_name: users.global_name,
        avatar_url: users.avatar_url,
        locale: users.locale,
        storage_used_bytes: users.storage_used_bytes,
        created_at: users.created_at,
      })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1)
  )[0];
  if (!me) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  const ts = await db
    .select({
      id: transfers.id,
      filename: transfers.filename,
      size_bytes: transfers.size_bytes,
      status: transfers.status,
      created_at: transfers.created_at,
      expires_at: transfers.expires_at,
      sender_id: transfers.sender_id,
      recipient_username: transfers.recipient_username,
    })
    .from(transfers)
    .where(or(eq(transfers.sender_id, me.id), eq(transfers.recipient_discord_id, me.discord_id)))
    .limit(1000);

  const senderIds = Array.from(new Set(ts.map((t) => t.sender_id).filter((x): x is string => !!x && x !== me.id)));
  const peers = senderIds.length
    ? await db.select({ id: users.id, username: users.username }).from(users).where(inArray(users.id, senderIds))
    : [];
  const senderMap = new Map(peers.map((p) => [p.id, p.username]));

  const payload = {
    exported_at: new Date().toISOString(),
    profile: {
      discord_id: me.discord_id,
      username: me.username,
      global_name: me.global_name,
      avatar_url: me.avatar_url,
      locale: me.locale,
      storage_used_bytes: me.storage_used_bytes,
      created_at: me.created_at.toISOString(),
    },
    transfers: ts.map((t) => ({
      id: t.id,
      filename: t.filename,
      size_bytes: t.size_bytes,
      status: t.status,
      created_at: t.created_at.toISOString(),
      expires_at: t.expires_at ? t.expires_at.toISOString() : null,
      direction: t.sender_id === me.id ? 'outbound' : 'inbound',
      peer_username: (t.sender_id === me.id ? t.recipient_username : senderMap.get(t.sender_id ?? '')) ?? null,
    })),
  };
  const safeUsername = safeAsciiSlug(me.username, 64, 'user');
  const filename = `cargo-export-${safeUsername}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
});
