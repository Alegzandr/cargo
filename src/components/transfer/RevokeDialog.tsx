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
import type { TransferRow } from './transferTypes';

export function RevokeDialog({
  target,
  onClose,
  onRevoked,
}: {
  target: TransferRow | null;
  onClose: () => void;
  onRevoked: () => Promise<void> | void;
}): JSX.Element {
  const t = useTranslations('outbox');
  const tSettings = useTranslations('settings');
  const [confirm, setConfirm] = useState('');

  async function revoke(): Promise<void> {
    if (!target || confirm !== target.filename) return;
    await fetch(`/api/transfers/${target.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm_filename: target.filename }),
    });
    setConfirm('');
    onClose();
    await onRevoked();
  }

  return (
    <Dialog open={target !== null} onOpenChange={(o) => { if (!o) { setConfirm(''); onClose(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-[15px] font-semibold">{t('revokeTitle')}</DialogTitle>
        </DialogHeader>
        <p className="text-[13px] text-muted">{t('revokeBody')}</p>
        <div className="mt-4">
          <Label htmlFor="revoke-confirm">{t('revokeConfirmLabel')}</Label>
          <Input
            id="revoke-confirm"
            value={confirm}
            onChange={(e) => setConfirm(e.currentTarget.value)}
            className="mono"
            autoComplete="off"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { setConfirm(''); onClose(); }}>
            {tSettings('deleteCancel')}
          </Button>
          <Button
            variant="danger"
            disabled={!target || confirm !== target.filename}
            onClick={() => void revoke()}
          >
            {t('revokeConfirmCta')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
