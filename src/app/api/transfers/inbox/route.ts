import { withAuth } from '@/lib/auth/withAuth';
import { loadActiveTransfers } from '@/lib/transfers/list';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withAuth(async (_req, _ctx, user) => {
  const transfers = await loadActiveTransfers('inbox', user.id, user.discord_id);
  return Response.json({ transfers });
});
