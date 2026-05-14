'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Countdown } from './Countdown';
import type { TransferRow } from './transferTypes';

export function ShareLinkDialog({
  target,
  onClose,
}: {
  target: TransferRow | null;
  onClose: () => void;
}): JSX.Element {
  const t = useTranslations('outbox');
  const tSend = useTranslations('send');
  const [copied, setCopied] = useState(false);

  const shareUrl =
    target && typeof window !== 'undefined' ? `${window.location.origin}/d/${target.id}` : '';

  async function copy(): Promise<void> {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <Dialog
      open={target !== null}
      onOpenChange={(o) => {
        if (!o) {
          setCopied(false);
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-[15px] font-semibold">{t('shareLinkTitle')}</DialogTitle>
        </DialogHeader>
        {target && (
          <>
            <p className="text-[13px] text-muted">{t('shareLinkBody')}</p>
            <div className="mt-2 flex items-center gap-2">
              <input
                readOnly
                value={shareUrl}
                onFocus={(e) => e.currentTarget.select()}
                className="mono h-9 flex-1 rounded-sm border border-hairline bg-surface px-3 text-[13px] text-ink focus:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
              />
              <Button variant="secondary" size="md" onClick={() => void copy()}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? tSend('copied') : tSend('copyLink')}
              </Button>
            </div>
            {target.expires_at ? (
              <Countdown expiresAt={target.expires_at} />
            ) : target.pending_expires_at ? (
              <Countdown expiresAt={target.pending_expires_at} />
            ) : null}
          </>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t('shareLinkClose')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
