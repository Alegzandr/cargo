'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Countdown } from './Countdown';

export interface LinkCardProps {
  // null while the transfer is waiting for the recipient to first sign in.
  // The 1-hour download link only exists once they claim it.
  shareUrl: string | null;
  // expiresAt: 1-hour download window. pendingExpiresAt: unclaimed-TTL. Exactly
  // one is set at any moment.
  expiresAt: string | null;
  pendingExpiresAt: string | null;
  recipientUsername: string;
}

export function LinkCard({
  shareUrl,
  expiresAt,
  pendingExpiresAt,
  recipientUsername,
}: LinkCardProps): JSX.Element {
  const t = useTranslations('send');
  const [copied, setCopied] = useState(false);

  async function copy(): Promise<void> {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  const isPending = !shareUrl || !expiresAt;
  return (
    <div className="bg-elevated border border-hairline rounded-md p-6 space-y-4">
      <div className="text-[15px] font-semibold text-ink">
        {isPending ? t('transferPending') : t('transferReady')}
      </div>
      <div className="text-[13px] text-muted">
        {isPending
          ? t('pendingWaitingFor', { handle: recipientUsername })
          : t('sentTo', { handle: recipientUsername, name: recipientUsername })}
      </div>
      {shareUrl && (
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={shareUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="mono h-9 flex-1 rounded-sm border border-hairline bg-surface px-3 text-[13px] text-ink focus:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
          />
          <Button variant="secondary" size="md" onClick={() => void copy()}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? t('copied') : t('copyLink')}
          </Button>
        </div>
      )}
      {expiresAt && <Countdown expiresAt={expiresAt} />}
      {isPending && pendingExpiresAt && (
        <p className="text-[12px] text-muted">
          {t('pendingExpiresHint', { date: new Date(pendingExpiresAt).toLocaleDateString() })}
        </p>
      )}
      <p className="text-[12px] text-muted">{t('linkPrivacy')}</p>
    </div>
  );
}
