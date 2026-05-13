import type { Metadata } from 'next';
import { signIn } from '@/lib/auth';
import { getTranslations } from 'next-intl/server';
import { CargoMark } from '@/components/CargoMark';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'login' });
  const title = 'Sign in';
  const description = t('subtitle');
  return {
    title,
    description,
    openGraph: { title: `${title} — Cargo`, description },
    twitter: { card: 'summary_large_image', title: `${title} — Cargo`, description },
  };
}

export default async function LoginPage(): Promise<JSX.Element> {
  const t = await getTranslations('login');

  async function discord(): Promise<void> {
    'use server';
    await signIn('discord', { redirectTo: '/dashboard' });
  }

  return (
    <div className="min-h-screen bg-bg text-ink flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-1">
          <CargoMark size={18} />
          <span className="text-[20px] font-semibold">{t('title')}</span>
        </div>
        <p className="text-[13px] text-muted mb-6">{t('subtitle')}</p>

        <form action={discord}>
          <button
            type="submit"
            className="h-9 w-full rounded-sm bg-accent text-accent-fg text-[13px] font-medium hover:brightness-110 transition"
          >
            {t('cta')}
          </button>
        </form>

        <p className="text-[13px] text-muted mt-6">{t('privacy')}</p>
      </div>
    </div>
  );
}
