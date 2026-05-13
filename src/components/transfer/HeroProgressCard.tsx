'use client';
import { useLocale, useTranslations } from 'next-intl';
import { Pause, Play, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatBytes, formatEta, formatRate, truncateMiddle } from '@/lib/utils';

export type UploadState = 'queued' | 'encrypting' | 'finalizing' | 'ready' | 'failed';

export interface HeroProgressCardProps {
  filename: string;
  loaded: number;
  total: number;
  bytesPerSec: number;
  state: UploadState;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  paused?: boolean;
}

const stateKey: Record<UploadState, string> = {
  queued: 'stateQueued',
  encrypting: 'stateEncrypting',
  finalizing: 'stateFinalizing',
  ready: 'stateReady',
  failed: 'stateFailed',
};

export function HeroProgressCard(props: HeroProgressCardProps): JSX.Element {
  const t = useTranslations('send');
  const locale = useLocale();
  const pct = props.total > 0 ? Math.min(100, (props.loaded / props.total) * 100) : 0;
  const etaSec = props.bytesPerSec > 0 ? (props.total - props.loaded) / props.bytesPerSec : Infinity;

  const failed = props.state === 'failed';
  const ready = props.state === 'ready';
  const isShimmering = props.state === 'encrypting' && !props.paused;

  return (
    <div
      className={
        'bg-elevated border border-hairline rounded-md p-4 md:p-6 ' +
        (ready ? 'animate-flash-success' : '')
      }
    >
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="mono text-[13px] text-ink truncate" title={props.filename}>
          {truncateMiddle(props.filename, 64)}
        </div>
        <span className="mono text-[11px] uppercase tracking-wide text-muted shrink-0">
          {t(stateKey[props.state])}
        </span>
      </div>

      <div
        className="cargo-progress-track h-2.5"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t(stateKey[props.state])}
      >
        <div
          className={
            'cargo-progress-fill ' +
            (failed ? 'opacity-50 bg-danger' : '') +
            (isShimmering ? '' : ' before:hidden')
          }
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-3 mono text-[13px] text-muted flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <span>
          <span className="text-ink">{formatBytes(props.loaded, locale)}</span>
          {' / '}
          <span>{formatBytes(props.total, locale)}</span>
        </span>
        <span>{formatRate(props.bytesPerSec, locale)}</span>
        <span>{t('etaPrefix')} {formatEta(etaSec, locale)}</span>
        <span className="text-ink">{pct.toFixed(0)}%</span>
      </div>

      {!ready && (
        <div className="mt-4 flex items-center gap-2">
          {props.paused ? (
            <Button variant="ghost" size="sm" onClick={props.onResume} disabled={failed}>
              <Play className="h-3.5 w-3.5" /> {t('resume')}
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={props.onPause} disabled={failed || props.state !== 'encrypting'}>
              <Pause className="h-3.5 w-3.5" /> {t('pause')}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={props.onCancel}>
            <X className="h-3.5 w-3.5" /> {t('cancel')}
          </Button>
        </div>
      )}
    </div>
  );
}
