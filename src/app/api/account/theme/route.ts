import { eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/withAuth';
import { patchUserAttribute } from '@/lib/account/updateAttribute';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PATCH = withAuth((req, _ctx, user) =>
  patchUserAttribute({
    req,
    field: 'theme',
    validate: (v): v is 'dark' | 'light' => v === 'dark' || v === 'light',
    update: (theme) => db.update(users).set({ theme }).where(eq(users.id, user.id)),
    // Mirrors NEXT_LOCALE: the DB row is canonical, the cookie carries the
    // current preference between requests so SSR can render the right palette
    // before the session is read.
    cookieName: 'cargo_theme',
  }),
);
