'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Download, PackagePlus, RotateCw } from 'lucide-react';
import { CargoMark } from '@/components/CargoMark';
import { Button } from '@/components/ui/button';
import { Countdown } from './Countdown';
import { formatBytes } from '@/lib/utils';

export interface DownloadCardProps {
  transferId: string;
  filename: string;
  sizeBytes: number;
  expiresAt: string;
  senderUsername: string | null;
}

export function DownloadCard({
  transferId,
  filename,
  sizeBytes,
  expiresAt,
  senderUsername,
}: DownloadCardProps): JSX.Element {
  const [started, setStarted] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const t = useTranslations('download');
  const locale = useLocale();

  function startDownload(): void {
    // Content-Disposition: attachment on the API response means hitting the
    // URL in a hidden iframe fires the browser's download flow without
    // navigating the current page away from the thank-you screen. Cache-bust
    // so retries actually re-issue the request instead of being short-circuited.
    if (iframeRef.current) {
      iframeRef.current.src = `/api/transfers/${transferId}/download?t=${Date.now()}`;
    }
    setStarted(true);
  }

  // The iframe must live at a stable position in the tree across both
  // states. Previously each branch rendered its own <iframe>, so the
  // post-click re-render unmounted the one that just received `src` and
  // cancelled the in-flight request — the user had to hit "Réessayer" to
  // hit the iframe rendered by the second branch. Keep it as a sibling of
  // the swappable card so React reuses the same DOM node.
  return (
    <>
      <iframe ref={iframeRef} className="hidden" title="download" />
      {started ? (
        <div className="w-full max-w-md bg-elevated border border-hairline rounded-md p-6 space-y-5 text-center">
          <div className="flex items-center justify-center gap-2">
            <CargoMark size={18} />
            <span className="text-[15px] font-semibold">{t('thanks')}</span>
          </div>
          <p className="text-[13px] text-muted">{t('started')}</p>
          <Button onClick={startDownload} variant="secondary" size="md" className="w-full">
            <RotateCw className="h-3.5 w-3.5" /> {t('retry')}
          </Button>
          <div className="pt-2 border-t border-hairline space-y-3">
            <p className="text-[13px] text-ink">{t('shareToo')}</p>
            <Button asChild size="md" className="w-full">
              <Link href="/dashboard">
                <PackagePlus className="h-3.5 w-3.5" /> {t('shareCta')}
              </Link>
            </Button>
          </div>
          <p className="text-[12px] text-muted">{t('noHistory')}</p>
        </div>
      ) : (
        <div className="w-full max-w-md bg-elevated border border-hairline rounded-md p-6 space-y-4">
          <div className="flex items-center gap-2">
            <CargoMark size={16} />
            <span className="text-[15px] font-semibold">{t('ready')}</span>
          </div>
          <div className="mono text-[13px] text-ink truncate" title={filename}>
            {filename}
          </div>
          <div className="mono text-[12px] text-muted">
            {formatBytes(sizeBytes, locale)}
            {senderUsername ? ` · ${t('fromSender', { handle: senderUsername })}` : ''}
          </div>
          <Countdown expiresAt={expiresAt} />
          <Button onClick={startDownload} size="md" className="w-full">
            <Download className="h-3.5 w-3.5" /> {t('download')}
          </Button>
          <p className="text-[12px] text-muted">{t('expiryNote')}</p>
        </div>
      )}
    </>
  );
}
