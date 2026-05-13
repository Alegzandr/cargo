import { eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { NextIntlClientProvider, useTranslations, type AbstractIntlMessages } from 'next-intl';
import { auth, signIn } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { transfers, users } from '@/lib/db/schema';
import { CargoMark } from '@/components/CargoMark';
import { DownloadCard } from '@/components/transfer/DownloadCard';
import { LandingLocaleSwitcher } from '@/components/transfer/LandingLocaleSwitcher';
import { isUuid } from '@/lib/utils';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocale } from '@/lib/i18n/request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The OG image at /d/[id]/opengraph-image renders the same sender-name card,
// so previews in Discord/Slack match. We only echo the sender name in the
// title — never the filename or transfer id.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!isUuid(id)) {
    return { title: 'Transfer not found' };
  }
  const rows = await db
    .select({ sender_id: transfers.sender_id, expires_at: transfers.expires_at })
    .from(transfers)
    .where(eq(transfers.id, id))
    .limit(1);
  const t = rows[0];
  if (!t?.sender_id || !t.expires_at || t.expires_at.getTime() < Date.now()) {
    return {
      title: 'Transfer gone',
      description: 'This transfer is gone. Cargo doesn’t keep a history.',
    };
  }
  const s = await db
    .select({ username: users.username, global_name: users.global_name })
    .from(users)
    .where(eq(users.id, t.sender_id))
    .limit(1);
  const senderName = s[0]?.global_name ?? s[0]?.username ?? 'Someone';
  const title = `${senderName} sent you a file`;
  const description = 'Sign in with Discord to download. The link expires within the hour.';
  return {
    title,
    description,
    openGraph: { title: `${title} — Cargo`, description, type: 'website' },
    twitter: { card: 'summary_large_image', title: `${title} — Cargo`, description },
  };
}

async function resolveLocale(): Promise<SupportedLocale> {
  const cookieLocale = (await cookies()).get('NEXT_LOCALE')?.value;
  return SUPPORTED_LOCALES.includes(cookieLocale as SupportedLocale)
    ? (cookieLocale as SupportedLocale)
    : DEFAULT_LOCALE;
}

async function loadMessages(locale: SupportedLocale): Promise<AbstractIntlMessages> {
  return (await import(`@/i18n/messages/${locale}.json`)).default;
}

export default async function TransferLandingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<JSX.Element> {
  const { id } = await params;
  const locale = await resolveLocale();
  const messages = await loadMessages(locale);
  // Reject anything that isn't a UUID before it can become a redirect target.
  // The download/transfer endpoints would 404 anyway, but this kills any
  // chance of weirdly-shaped paths reaching signIn's redirectTo handler.
  if (!isUuid(id)) {
    return (
      <NextIntlClientProvider locale={locale} messages={messages}>
        <Surface locale={locale} />
      </NextIntlClientProvider>
    );
  }
  const [session, rows] = await Promise.all([
    auth(),
    db
      .select({
        id: transfers.id,
        filename: transfers.filename,
        size_bytes: transfers.size_bytes,
        sender_id: transfers.sender_id,
        recipient_discord_id: transfers.recipient_discord_id,
        expires_at: transfers.expires_at,
      })
      .from(transfers)
      .where(eq(transfers.id, id))
      .limit(1),
  ]);
  if (!session?.user?.id) {
    async function login(): Promise<void> {
      'use server';
      await signIn('discord', { redirectTo: `/d/${id}` });
    }
    return (
      <NextIntlClientProvider locale={locale} messages={messages}>
        <LoginSurface locale={locale} login={login} />
      </NextIntlClientProvider>
    );
  }

  // Collapse missing / not-for-you / expired into one message so an
  // authenticated probe can't enumerate transfer ids by state — matches the
  // download API's same guard in /api/transfers/[id]/download/route.ts.
  const t = rows[0];
  if (
    !t ||
    !t.recipient_discord_id ||
    t.recipient_discord_id !== session.user.discord_id ||
    !t.expires_at ||
    t.expires_at.getTime() < Date.now()
  ) {
    return (
      <NextIntlClientProvider locale={locale} messages={messages}>
        <Surface locale={locale} />
      </NextIntlClientProvider>
    );
  }

  const sender = t.sender_id
    ? await db
        .select({ username: users.username })
        .from(users)
        .where(eq(users.id, t.sender_id))
        .limit(1)
    : ([] as Array<{ username: string }>);

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <div className="min-h-screen bg-bg text-ink flex items-center justify-center px-4 relative">
        <div className="absolute top-4 right-4">
          <LandingLocaleSwitcher current={locale} />
        </div>
        <DownloadCard
          transferId={t.id}
          filename={t.filename}
          sizeBytes={t.size_bytes}
          expiresAt={t.expires_at.toISOString()}
          senderUsername={sender[0]?.username ?? null}
        />
      </div>
    </NextIntlClientProvider>
  );
}

function LoginSurface({
  locale,
  login,
}: {
  locale: SupportedLocale;
  login: () => Promise<void>;
}): JSX.Element {
  const t = useTranslations('landing');
  return (
    <div className="min-h-screen bg-bg text-ink flex items-center justify-center px-4 relative">
      <div className="absolute top-4 right-4">
        <LandingLocaleSwitcher current={locale} />
      </div>
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-1">
          <CargoMark size={18} />
          <span className="text-[20px] font-semibold">Cargo</span>
        </div>
        <p className="text-[13px] text-muted mb-6">{t('signInPrompt')}</p>
        <form action={login}>
          <button
            type="submit"
            className="h-9 w-full rounded-sm bg-accent text-accent-fg text-[13px] font-medium"
          >
            {t('cta')}
          </button>
        </form>
      </div>
    </div>
  );
}

function Surface({ locale }: { locale: SupportedLocale }): JSX.Element {
  const t = useTranslations('landing');
  return (
    <div className="min-h-screen bg-bg text-ink flex items-center justify-center px-4 relative">
      <div className="absolute top-4 right-4">
        <LandingLocaleSwitcher current={locale} />
      </div>
      <div className="max-w-sm text-center">
        <CargoMark size={20} className="mb-3" />
        <p className="text-[13px] text-muted">{t('gone')}</p>
      </div>
    </div>
  );
}
