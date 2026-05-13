import { getRequestConfig } from 'next-intl/server';

export const SUPPORTED_LOCALES = ['en', 'fr'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = 'en';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale: SupportedLocale = SUPPORTED_LOCALES.includes(requested as SupportedLocale)
    ? (requested as SupportedLocale)
    : DEFAULT_LOCALE;
  const messages = (await import(`@/i18n/messages/${locale}.json`)).default;
  return { locale, messages };
});
