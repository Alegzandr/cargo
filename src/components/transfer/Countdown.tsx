'use client';
import { memo, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { formatEta } from '@/lib/utils';

// One process-wide 1Hz tick shared across every Countdown on the page.
// Avoids N independent setIntervals when several rows render at once.
type Listener = (now: number) => void;
const listeners = new Set<Listener>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(l: Listener): () => void {
  listeners.add(l);
  if (timer === null) {
    timer = setInterval(() => {
      const now = Date.now();
      for (const fn of listeners) fn(now);
    }, 1000);
  }
  return () => {
    listeners.delete(l);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function CountdownInner({ expiresAt }: { expiresAt: string }): JSX.Element {
  const t = useTranslations('send');
  const locale = useLocale();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => subscribe(setNow), []);

  const remainingSec = Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000));
  if (remainingSec === 0) {
    return <span className="mono text-[13px] text-muted">{t('expired')}</span>;
  }
  return (
    <span className="mono text-[13px] text-accent">
      {t('expiresIn', { time: formatEta(remainingSec, locale) })}
    </span>
  );
}

export const Countdown = memo(CountdownInner);
