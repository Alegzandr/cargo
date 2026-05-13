import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { CargoMark } from '@/components/CargoMark';
import { LandingDemo } from '@/components/landing/LandingDemo';
import { LandingCta } from '@/components/landing/LandingCta';
import { LandingLocaleSwitcher } from '@/components/transfer/LandingLocaleSwitcher';
import { SUPPORTED_LOCALES, type SupportedLocale } from '@/lib/i18n/request';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'home' });
  const title = t('metaTitle');
  const description = t('metaDescription');
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      images: [{ url: '/cargo.svg', width: 512, height: 512, alt: t('ogAlt') }],
    },
    twitter: { card: 'summary', title, description, images: ['/cargo.svg'] },
  };
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<JSX.Element> {
  const { locale } = await params;
  if (!SUPPORTED_LOCALES.includes(locale as SupportedLocale)) notFound();
  setRequestLocale(locale);

  const [t, session] = await Promise.all([
    getTranslations({ locale, namespace: 'home' }),
    auth(),
  ]);
  const authed = Boolean(session?.user?.id);

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col">
      <header className="px-6 md:px-10 pt-6 md:pt-8">
        <div className="flex items-center gap-2">
          <CargoMark size={18} />
          <span className="text-[15px] font-semibold text-ink">Cargo</span>
        </div>
      </header>

      {/* Hero — asymmetric two-column on md+, stacked on small screens. The
          headline column is intentionally narrower so the demo gets visual
          weight on the right; on small screens the demo comes first because
          showing the product matters more than the headline. */}
      <main className="flex-1 px-6 md:px-10 pt-12 md:pt-24 pb-16 md:pb-24">
        <section className="max-w-[1180px] mx-auto grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-16 items-start">
          <div className="md:col-span-5 md:pt-6">
            <h1 className="font-semibold text-ink tracking-tight text-[36px] leading-[1.05] sm:text-[44px] md:text-[52px] md:leading-[1.02]">
              <span className="block">{t('headlineLine1')}</span>
              <span className="block">{t('headlineLine2')}</span>
              <span className="block text-muted">{t('headlineLine3')}</span>
            </h1>
            <p className="mt-6 text-[15px] md:text-[16px] leading-relaxed text-muted max-w-[36ch]">
              {t('subhead')}
            </p>
            <div className="mt-8">
              <LandingCta authed={authed} signInLabel={t('ctaSignIn')} openLabel={t('ctaOpen')} />
            </div>
          </div>

          <div className="md:col-span-7 md:pl-4">
            <div className="mono text-[11px] uppercase tracking-wide text-subtle mb-3">{t('demoEyebrow')}</div>
            <LandingDemo recipient={t('demoRecipient')} filename={t('demoFilename')} />
          </div>
        </section>

        {/* Privacy first — trust is the blocker before mechanics. The four
            facts are the load-bearing scan target; the emphasis line and link
            sit below for follow-through. */}
        <section className="max-w-[1180px] mx-auto mt-24 md:mt-32">
          <div className="rounded-2xl border border-hairline bg-surface/40 px-6 py-10 md:px-12 md:py-14">
            <div className="max-w-[42ch]">
              <div className="mono text-[11px] uppercase tracking-wide text-subtle mb-3">{t('privacyEyebrow')}</div>
              <h2 className="text-[24px] md:text-[30px] font-semibold text-ink leading-tight">{t('privacyHeading')}</h2>
              <p className="mt-4 text-[15px] md:text-[16px] leading-relaxed text-muted">{t('privacyIntro')}</p>
            </div>

            <dl className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-7">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="border-l-2 border-accent/60 pl-4">
                  <dt className="text-[14px] md:text-[15px] font-semibold text-ink">{t(`privacyFact${n}Title` as 'privacyFact1Title')}</dt>
                  <dd className="mt-1 text-[14px] leading-relaxed text-muted">{t(`privacyFact${n}Body` as 'privacyFact1Body')}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-10 pt-6 border-t border-hairline flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <p className="text-[15px] md:text-[16px] font-medium text-ink">{t('privacyEmphasis')}</p>
              <Link
                href="/privacy"
                className="inline-flex items-center gap-1 text-[14px] text-accent hover:brightness-110 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
              >
                {t('privacyLink')} <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
        </section>

        {/* How it works — three numbered steps. After trust, mechanics. */}
        <section className="max-w-[1180px] mx-auto mt-24 md:mt-32">
          <div className="mono text-[11px] uppercase tracking-wide text-subtle mb-3">{t('howEyebrow')}</div>
          <h2 className="text-[22px] md:text-[28px] font-semibold text-ink leading-tight max-w-[28ch]">{t('howHeading')}</h2>
          <ol className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-5">
            {[1, 2, 3].map((n) => (
              <li
                key={n}
                className="relative rounded-xl border border-hairline bg-surface/40 p-5 md:p-6"
              >
                <div className="mono text-[11px] tracking-wide text-accent mb-3">{t(`step${n}Label` as 'step1Label')}</div>
                <h3 className="text-[16px] md:text-[17px] font-semibold text-ink mb-2">{t(`step${n}Title` as 'step1Title')}</h3>
                <p className="text-[14px] md:text-[15px] leading-relaxed text-muted">{t(`step${n}Body` as 'step1Body')}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="px-6 md:px-10 py-6 border-t border-hairline">
        <div className="max-w-[1180px] mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-[12px] text-muted">
          <div className="flex items-center gap-2">
            <CargoMark size={14} />
            <span>Cargo — {t('footerTagline')}</span>
          </div>
          <LandingLocaleSwitcher current={locale as SupportedLocale} />
        </div>
      </footer>
    </div>
  );
}
