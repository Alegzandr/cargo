import createMiddleware from 'next-intl/middleware';
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from '@/lib/i18n/request';

export default createMiddleware({
  locales: SUPPORTED_LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'never',
});

export const config = {
  matcher: ['/', '/((?!api/|_next/|.*\\..*|d/|docs/).*)'],
};
