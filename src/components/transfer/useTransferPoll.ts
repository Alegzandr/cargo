'use client';
import { useCallback, useEffect, useState } from 'react';
import type { Direction, TransferRow } from './transferTypes';

// Encapsulates the visibility-gated 10s polling for an inbox/outbox listing.
// Returns `null` until the first fetch resolves so callers can render a stable
// placeholder, then the latest row set on every subsequent reload.
export function useTransferPoll(direction: Direction): {
  rows: TransferRow[] | null;
  reload: () => Promise<void>;
} {
  const [rows, setRows] = useState<TransferRow[] | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    const r = await fetch(`/api/transfers/${direction}`, { cache: 'no-store' });
    if (!r.ok) return;
    const j = (await r.json()) as { transfers: TransferRow[] };
    setRows(j.transfers);
  }, [direction]);

  useEffect(() => {
    void reload();
    let i: ReturnType<typeof setInterval> | null = null;
    const start = (): void => {
      if (i === null) i = setInterval(reload, 10_000);
    };
    const stop = (): void => {
      if (i !== null) {
        clearInterval(i);
        i = null;
      }
    };
    // Don't poll while the tab is backgrounded — wakes nothing useful and
    // chews bandwidth on mobile. Refresh once on becoming visible again.
    const onVisibility = (): void => {
      if (document.visibilityState === 'visible') {
        void reload();
        start();
      } else {
        stop();
      }
    };
    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      stop();
    };
  }, [reload]);

  return { rows, reload };
}
