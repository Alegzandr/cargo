import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PageBody, PageHeader } from '@/components/PageHeader';
import { InboxWelcome } from '@/components/transfer/InboxWelcome';
import { TransferTable } from '@/components/transfer/TransferTable';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'inbox' });
  const title = t('title');
  const description = t('subtitle');
  return {
    title,
    description,
    openGraph: { title: `${title} — Cargo`, description },
    twitter: { card: 'summary_large_image', title: `${title} — Cargo`, description },
  };
}

export default async function InboxPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<JSX.Element> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'inbox' });
  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <PageBody>
        <InboxWelcome />
        <TransferTable direction="inbox" />
      </PageBody>
    </>
  );
}
