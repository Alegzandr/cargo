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
    field: 'locale',
    validate: (v): v is 'en' | 'fr' => v === 'en' || v === 'fr',
    update: (locale) => db.update(users).set({ locale }).where(eq(users.id, user.id)),
    // next-intl reads NEXT_LOCALE when localePrefix is 'never'. The DB row is
    // the canonical preference; this cookie just carries it between requests.
    cookieName: 'NEXT_LOCALE',
  }),
);
