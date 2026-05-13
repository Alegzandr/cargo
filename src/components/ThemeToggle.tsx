'use client';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

const THEMES: Array<'dark' | 'light'> = ['dark', 'light'];

export function ThemeToggle({ current }: { current: 'dark' | 'light' }): JSX.Element {
  const router = useRouter();
  const t = useTranslations('settings');
  // Optimistic local state so the html class flip waits for router.refresh
  // without leaving the button in a stale "active" position.
  const [active, setActive] = useState<'dark' | 'light'>(current);
  const [pending, startTransition] = useTransition();

  async function pick(next: 'dark' | 'light'): Promise<void> {
    if (next === active || pending) return;
    setActive(next);
    // Flip immediately so the page reflects the choice before refresh lands.
    document.documentElement.classList.toggle('dark', next === 'dark');
    document.documentElement.style.colorScheme = next;
    await fetch('/api/account/theme', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: next }),
    });
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex gap-1.5">
      {THEMES.map((th) => {
        const isActive = th === active;
        return (
          <button
            key={th}
            type="button"
            onClick={() => void pick(th)}
            className={cn(
              'mono h-6 px-2 rounded-sm border text-[11px] font-medium uppercase tracking-wide',
              isActive
                ? 'border-accent text-accent'
                : 'border-hairline text-muted hover:text-ink',
            )}
          >
            {t(th === 'dark' ? 'themeDark' : 'themeLight')}
          </button>
        );
      })}
    </div>
  );
}
