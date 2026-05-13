import { withAuth } from '@/lib/auth/withAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Posts the NEXT_LOCALE cookie from the DB-stored preference, then bounces back
// to `next`. Used after first login to overrule next-intl's Accept-Language
// fallback when no NEXT_LOCALE cookie has ever been set.
export const GET = withAuth(async (req, _ctx, user) => {
  const url = new URL(req.url);
  const nextParam = url.searchParams.get('next') ?? '/dashboard';
  // Same-origin relative paths only — guards against open redirect.
  const safeNext =
    nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/dashboard';
  return new Response(null, {
    status: 303,
    headers: {
      Location: new URL(safeNext, url.origin).toString(),
      'Set-Cookie': `NEXT_LOCALE=${user.locale}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`,
    },
  });
});
