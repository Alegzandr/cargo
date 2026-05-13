'use client';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

const LOCALES = ['en', 'fr'] as const;
type Locale = (typeof LOCALES)[number];

// Dropdown for /d/[id]: the viewer may be unauthenticated (pre-claim), so we
// can't rely on /api/account/locale alone. Write NEXT_LOCALE client-side (same
// attributes as the server cookie) and fire-and-forget the PATCH so authed
// viewers' DB rows stay in sync; the 401 for anon viewers is fine.
export function LandingLocaleSwitcher({ current }: { current: Locale }): JSX.Element {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const t = useTranslations('landing');

  function onChange(e: React.ChangeEvent<HTMLSelectElement>): void {
    const next = e.target.value as Locale;
    if (next === current || pending) return;
    document.cookie = `NEXT_LOCALE=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    void fetch('/api/account/locale', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: next }),
    }).catch(() => undefined);
    startTransition(() => router.refresh());
  }

  return (
    <label className="flex items-center gap-2 text-[11px] text-muted">
      <span className="sr-only">{t('languageLabel')}</span>
      <select
        value={current}
        onChange={onChange}
        disabled={pending}
        className={cn(
          'mono h-6 px-1.5 rounded-sm border border-hairline bg-bg text-ink',
          'text-[11px] font-medium uppercase tracking-wide',
        )}
      >
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
