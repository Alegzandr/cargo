import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PageBody, PageHeader } from '@/components/PageHeader';
import { SendForm } from '@/components/transfer/SendForm';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'send' });
  const title = t('title');
  const description = t('subtitle');
  return {
    title,
    description,
    openGraph: { title: `${title} — Cargo`, description },
    twitter: { card: 'summary_large_image', title: `${title} — Cargo`, description },
  };
}

export default async function SendPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<JSX.Element> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'send' });
  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <PageBody>
        <SendForm />
      </PageBody>
    </>
  );
}
