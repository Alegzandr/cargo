'use client';
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { formatBytes } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Usage {
  used: number;
  quota: number;
}

export function StorageMeter(): JSX.Element | null {
  const t = useTranslations('settings');
  const locale = useLocale();
  const [usage, setUsage] = useState<Usage | null>(null);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [resetting, setResetting] = useState(false);
  const word = t('storageResetConfirmWord');

  async function loadUsage(): Promise<void> {
    const r = await fetch('/api/account/usage', { cache: 'no-store' });
    if (!r.ok) return;
    setUsage((await r.json()) as Usage);
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const r = await fetch('/api/account/usage', { cache: 'no-store' });
      if (!r.ok || cancelled) return;
      setUsage((await r.json()) as Usage);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function reset(): Promise<void> {
    if (confirm !== word) return;
    setResetting(true);
    try {
      await fetch('/api/transfers/outbox', { method: 'DELETE' });
      await loadUsage();
    } finally {
      setResetting(false);
      setConfirm('');
      setOpen(false);
    }
  }

  if (!usage) return null;

  const pct = usage.quota > 0 ? Math.min(100, (usage.used / usage.quota) * 100) : 0;
  const near = pct >= 90;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="mono text-[13px] text-ink">
          {formatBytes(usage.used, locale)}
          <span className="text-muted"> / {formatBytes(usage.quota, locale)}</span>
        </span>
        <span className="mono text-[12px] text-muted">{pct.toFixed(pct < 10 ? 1 : 0)}%</span>
      </div>
      <div
        className="h-1.5 rounded-full bg-elevated overflow-hidden"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t('storageHeading')}
      >
        <div
          className={`h-full transition-all duration-fast ease-cargo ${near ? 'bg-danger' : 'bg-accent'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {usage.used > 0 && (
        <div className="mt-3">
          <Button
            variant="ghost"
            className="text-danger hover:bg-danger/10"
            onClick={() => setOpen(true)}
          >
            {t('storageResetCta')}
          </Button>
        </div>
      )}

      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!o) {
            setConfirm('');
            setOpen(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-[15px] font-semibold">
              {t('storageResetTitle')}
            </DialogTitle>
          </DialogHeader>
          <p className="text-[13px] text-muted">{t('storageResetBody', { word })}</p>
          <div className="mt-4">
            <Label htmlFor="storage-reset-confirm">{word}</Label>
            <Input
              id="storage-reset-confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.currentTarget.value)}
              className="mono"
              autoComplete="off"
              spellCheck={false}
              autoCapitalize="none"
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setConfirm('');
                setOpen(false);
              }}
            >
              {t('deleteCancel')}
            </Button>
            <Button
              variant="danger"
              disabled={confirm !== word || resetting}
              onClick={() => void reset()}
            >
              {t('storageResetConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
