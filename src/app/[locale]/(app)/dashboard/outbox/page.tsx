import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PageBody, PageHeader } from '@/components/PageHeader';
import { TransferTable } from '@/components/transfer/TransferTable';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'outbox' });
  const title = t('title');
  const description = t('subtitle');
  return {
    title,
    description,
    openGraph: { title: `${title} — Cargo`, description },
    twitter: { card: 'summary_large_image', title: `${title} — Cargo`, description },
  };
}

export default async function OutboxPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<JSX.Element> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'outbox' });
  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <PageBody>
        <TransferTable direction="outbox" />
      </PageBody>
    </>
  );
}
