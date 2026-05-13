import { eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/withAuth';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withAuth(async (_req, _ctx, user) => {
  const rows = await db
    .select({ used: users.storage_used_bytes })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  const used = rows[0]?.used ?? 0;
  return Response.json({ used, quota: env.CARGO_USER_QUOTA });
});
