'use client';
import { useEffect, useState } from 'react';
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
import { isValidHandle, normalizeHandle } from '@/lib/validators';
import type { TransferRow } from './transferTypes';

export function EditRecipientDialog({
  target,
  onClose,
  onSaved,
}: {
  target: TransferRow | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}): JSX.Element {
  const t = useTranslations('outbox');
  const tSettings = useTranslations('settings');
  const [value, setValue] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Re-seed the input each time a different row opens the dialog. Avoids a
  // stale value flashing when the user clicks Edit on row B after row A.
  useEffect(() => {
    if (target) {
      setValue(target.peer?.username ?? '');
      setError(null);
    }
  }, [target]);

  async function save(): Promise<void> {
    if (!target) return;
    const next = normalizeHandle(value);
    if (!isValidHandle(next)) {
      setError(t('editRecipientInvalid'));
      return;
    }
    const r = await fetch(`/api/transfers/${target.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient_username: next }),
    });
    if (!r.ok) {
      setError(t('editRecipientFailed'));
      return;
    }
    setValue('');
    setError(null);
    onClose();
    await onSaved();
  }

  return (
    <Dialog
      open={target !== null}
      onOpenChange={(o) => {
        if (!o) {
          setValue('');
          setError(null);
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-[15px] font-semibold">{t('editRecipientTitle')}</DialogTitle>
        </DialogHeader>
        <p className="text-[13px] text-muted">{t('editRecipientBody')}</p>
        <div className="mt-4">
          <Label htmlFor="edit-recipient">{t('colRecipient')}</Label>
          <Input
            id="edit-recipient"
            value={value}
            onChange={(e) => {
              setValue(e.currentTarget.value);
              setError(null);
            }}
            className="mono"
            autoComplete="off"
            spellCheck={false}
            autoCapitalize="none"
          />
          {error && <p className="mt-1 text-[12px] text-danger">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { setValue(''); setError(null); onClose(); }}>
            {tSettings('deleteCancel')}
          </Button>
          <Button onClick={() => void save()}>{t('editRecipientSave')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
