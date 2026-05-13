'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
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

export function PurgeAllDialog({
  open,
  count,
  onClose,
  onPurged,
}: {
  open: boolean;
  count: number;
  onClose: () => void;
  onPurged: () => Promise<void> | void;
}): JSX.Element {
  const t = useTranslations('outbox');
  const tSettings = useTranslations('settings');
  const [confirm, setConfirm] = useState('');
  const [purging, setPurging] = useState(false);
  const word = t('purgeAllConfirmWord');

  async function purge(): Promise<void> {
    if (confirm !== word) return;
    setPurging(true);
    try {
      await fetch('/api/transfers/outbox', { method: 'DELETE' });
    } finally {
      setPurging(false);
      setConfirm('');
      onClose();
      await onPurged();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setConfirm(''); onClose(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-[15px] font-semibold">{t('purgeAllTitle')}</DialogTitle>
        </DialogHeader>
        <p className="text-[13px] text-muted">{t('purgeAllBody', { count, word })}</p>
        <div className="mt-4">
          <Label htmlFor="purge-all-confirm">{word}</Label>
          <Input
            id="purge-all-confirm"
            value={confirm}
            onChange={(e) => setConfirm(e.currentTarget.value)}
            className="mono"
            autoComplete="off"
            spellCheck={false}
            autoCapitalize="none"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { setConfirm(''); onClose(); }}>
            {tSettings('deleteCancel')}
          </Button>
          <Button
            variant="danger"
            disabled={confirm !== word || purging}
            onClick={() => void purge()}
          >
            {t('purgeAllCta')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
