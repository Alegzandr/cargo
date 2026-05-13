'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';

// Fires once per sign-in: reads /api/transfers/inbox/welcome (which clears
// the in-process counter set by the signIn callback) and shows a one-shot
// "N file(s) were waiting for you." card. Dismissable; auto-hidden if the
// count is zero.
export function InboxWelcome(): JSX.Element | null {
  const t = useTranslations('inbox');
  const [count, setCount] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch('/api/transfers/inbox/welcome', { cache: 'no-store' });
        if (!r.ok || cancelled) return;
        const { count: n } = (await r.json()) as { count: number };
        if (!cancelled) setCount(n);
      } catch {
        // Network blip on initial inbox load isn't worth surfacing — the card
        // is a courtesy, not load-bearing. Stay silent.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (dismissed || count === null || count <= 0) return null;
  return (
    <div className="mb-4 flex items-start justify-between gap-3 rounded-md border border-hairline bg-elevated px-4 py-3">
      <p className="text-[13px] text-ink">{t('welcomeBody', { count })}</p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="text-subtle hover:text-ink"
        aria-label={t('welcomeDismiss')}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
