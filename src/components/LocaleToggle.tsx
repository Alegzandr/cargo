'use client';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { cn } from '@/lib/utils';

const LOCALES: Array<'en' | 'fr'> = ['en', 'fr'];

export function LocaleToggle({ current }: { current: 'en' | 'fr' }): JSX.Element {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function pick(next: 'en' | 'fr'): Promise<void> {
    if (next === current || pending) return;
    await fetch('/api/account/locale', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: next }),
    });
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex gap-1.5">
      {LOCALES.map((l) => {
        const active = l === current;
        return (
          <button
            key={l}
            type="button"
            onClick={() => void pick(l)}
            className={cn(
              'mono h-6 px-2 rounded-sm border text-[11px] font-medium uppercase tracking-wide',
              active
                ? 'border-accent text-accent'
                : 'border-hairline text-muted hover:text-ink',
            )}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}
