import { withAuth } from '@/lib/auth/withAuth';
import { takeClaim } from '@/lib/auth/recentClaims';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// One-shot. The signIn callback stashes the count of pending transfers that
// were just claimed for this Discord id; this endpoint reads-and-clears that
// entry so the welcome card only fires once per sign-in.
export const GET = withAuth(async (_req, _ctx, user) => {
  const count = takeClaim(user.discord_id);
  return Response.json({ count });
});
