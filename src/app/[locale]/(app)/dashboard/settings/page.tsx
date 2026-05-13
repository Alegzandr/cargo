import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { PageBody, PageHeader } from '@/components/PageHeader';
import { SettingsView } from '@/components/SettingsView';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'settings' });
  const title = t('title');
  const description = t('subtitle');
  return {
    title,
    description,
    openGraph: { title: `${title} — Cargo`, description },
    twitter: { card: 'summary_large_image', title: `${title} — Cargo`, description },
  };
}

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<JSX.Element> {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  const t = await getTranslations({ locale, namespace: 'settings' });
  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <PageBody>
        <SettingsView
          username={session.user.username}
          locale={session.user.locale}
          theme={session.user.theme}
        />
      </PageBody>
    </>
  );
}
