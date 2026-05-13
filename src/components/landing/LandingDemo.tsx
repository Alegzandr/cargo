'use client';
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import { HeroProgressCard, type UploadState } from '@/components/transfer/HeroProgressCard';
import { LinkCard } from '@/components/transfer/LinkCard';

// The demo replays the real Send-page sequence: a recipient is typed, a file
// "drops", the actual HeroProgressCard fills to 100%, and LinkCard takes its
// place. We feed scripted progress to the same components used in /send — no
// fork, no mocks of internals. The recipient-picker visual is a styled stub
// because the real component is debounced + queries /api/recipients; rendering
// it here would fire network requests on a public page.

type Phase = 'typing' | 'matched' | 'queued' | 'encrypting' | 'finalizing' | 'ready' | 'link' | 'rest';

const TOTAL_BYTES = 1.4 * 1024 * 1024 * 1024; // 1.4 GB — readable in EN and FR
const RATE_BYTES_PER_SEC = 360 * 1024 * 1024; // ~360 MB/s — keeps the demo brisk

// Phase durations (ms). The whole loop runs ~13.5s with a generous rest so the
// page doesn't feel busy when left open in a background tab.
const TIMINGS: Record<Phase, number> = {
  typing: 1200,
  matched: 700,
  queued: 400,
  encrypting: 4200,
  finalizing: 700,
  ready: 1100,
  link: 3500,
  rest: 1800,
};

const PHASE_ORDER: Phase[] = ['typing', 'matched', 'queued', 'encrypting', 'finalizing', 'ready', 'link', 'rest'];

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (): void => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

export function LandingDemo({ recipient, filename }: { recipient: string; filename: string }): JSX.Element {
  const t = useTranslations('home');
  const reduced = usePrefersReducedMotion();

  // Static end-state for reduced motion: link card with a frozen countdown.
  // We deliberately render a non-ticking countdown by passing expiresAt 1h in
  // the future on first mount and not re-keying.
  const staticExpiresAt = useRef<string>(new Date(Date.now() + 60 * 60 * 1000).toISOString()).current;

  if (reduced) {
    return (
      <div className="space-y-3" aria-label={t('demoCaption')}>
        <RecipientStub recipient={recipient} typedChars={recipient.length} matched />
        <LinkCard
          shareUrl={`https://cargo.example/d/${'0'.repeat(8)}-demo`}
          expiresAt={staticExpiresAt}
          pendingExpiresAt={null}
          recipientUsername={recipient}
        />
      </div>
    );
  }

  return <AnimatedDemo recipient={recipient} filename={filename} caption={t('demoCaption')} />;
}

function AnimatedDemo({
  recipient,
  filename,
  caption,
}: {
  recipient: string;
  filename: string;
  caption: string;
}): JSX.Element {
  const [phase, setPhase] = useState<Phase>('typing');
  const [typedChars, setTypedChars] = useState(0);
  const [loaded, setLoaded] = useState(0);
  const [cycle, setCycle] = useState(0); // re-keys the LinkCard's countdown each loop
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(performance.now());

  // Drive everything off a single rAF loop so the progress fill stays in lockstep
  // with phase transitions. setInterval would drift; rAF respects the tab's
  // visibility throttling automatically.
  useEffect(() => {
    let mounted = true;

    function tick(now: number): void {
      if (!mounted) return;
      const elapsed = now - startRef.current;

      // Resolve current phase from elapsed.
      let acc = 0;
      let p: Phase = 'rest';
      for (const candidate of PHASE_ORDER) {
        if (elapsed < acc + TIMINGS[candidate]) {
          p = candidate;
          break;
        }
        acc += TIMINGS[candidate];
      }
      const localElapsed = elapsed - acc;

      setPhase(p);

      if (p === 'typing') {
        const pct = Math.min(1, localElapsed / TIMINGS.typing);
        setTypedChars(Math.round(pct * recipient.length));
      } else if (p === 'matched') {
        setTypedChars(recipient.length);
      } else if (p === 'encrypting') {
        const pct = Math.min(1, localElapsed / TIMINGS.encrypting);
        setLoaded(pct * TOTAL_BYTES);
      } else if (p === 'finalizing' || p === 'ready' || p === 'link' || p === 'rest') {
        setLoaded(TOTAL_BYTES);
      } else {
        setLoaded(0);
      }

      // End of loop — restart and bump cycle to re-seed LinkCard's expiresAt.
      const total = PHASE_ORDER.reduce((s, k) => s + TIMINGS[k], 0);
      if (elapsed >= total) {
        startRef.current = now;
        setCycle((c) => c + 1);
        setLoaded(0);
        setTypedChars(0);
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      mounted = false;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [recipient.length]);

  // Hold a fresh "expires in 1h" the moment we enter `link`; key by cycle so
  // the Countdown resets each loop iteration.
  const linkExpiresAt = useRef<{ cycle: number; iso: string }>({
    cycle: 0,
    iso: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });
  if (linkExpiresAt.current.cycle !== cycle) {
    linkExpiresAt.current = { cycle, iso: new Date(Date.now() + 60 * 60 * 1000).toISOString() };
  }

  const showLink = phase === 'link' || phase === 'rest';
  const cardState: UploadState =
    phase === 'queued' ? 'queued'
    : phase === 'encrypting' ? 'encrypting'
    : phase === 'finalizing' ? 'finalizing'
    : phase === 'ready' ? 'ready'
    : 'queued';

  const bytesPerSec = phase === 'encrypting' ? RATE_BYTES_PER_SEC : 0;

  return (
    <div className="space-y-3" aria-label={caption}>
      <RecipientStub recipient={recipient} typedChars={typedChars} matched={phase !== 'typing'} />

      {/* Stack both cards in the same grid cell so the container always sizes
          to the taller of the two — prevents the page from jumping on mobile
          when the demo swaps HeroProgressCard ↔ LinkCard each loop. */}
      <div className="grid">
        <div
          className={'[grid-area:1/1] transition-opacity duration-200 ' + (showLink ? 'opacity-0 pointer-events-none' : 'opacity-100')}
          aria-hidden={showLink}
        >
          <HeroProgressCard
            filename={filename}
            loaded={loaded}
            total={TOTAL_BYTES}
            bytesPerSec={bytesPerSec}
            state={cardState}
          />
        </div>
        <div
          className={'[grid-area:1/1] transition-opacity duration-200 ' + (showLink ? 'opacity-100' : 'opacity-0 pointer-events-none')}
          aria-hidden={!showLink}
        >
          <LinkCard
            key={cycle}
            shareUrl={`https://cargo.example/d/${'0'.repeat(8)}-demo`}
            expiresAt={linkExpiresAt.current.iso}
            pendingExpiresAt={null}
            recipientUsername={recipient}
          />
        </div>
      </div>
    </div>
  );
}

function RecipientStub({
  recipient,
  typedChars,
  matched,
}: {
  recipient: string;
  typedChars: number;
  matched: boolean;
}): JSX.Element {
  const visible = recipient.slice(0, typedChars);
  return (
    <div className="bg-surface border border-hairline rounded-md p-3 flex items-center gap-3">
      <span className="mono text-[12px] uppercase tracking-wide text-muted">to</span>
      {matched ? (
        <span className="inline-flex items-center gap-1.5 h-7 px-2 rounded-sm bg-elevated border border-hairline">
          <span className="h-4 w-4 rounded-sm bg-accent/20 text-accent text-[10px] font-medium flex items-center justify-center">
            {recipient.slice(0, 1).toUpperCase()}
          </span>
          <span className="mono text-[12px] text-ink">@{recipient}</span>
          <Check className="h-3 w-3 text-accent" strokeWidth={2.5} />
        </span>
      ) : (
        <span className="mono text-[13px] text-ink">
          @{visible}
          <span className="inline-block w-[1px] h-3.5 bg-ink align-middle ml-0.5 animate-pulse" aria-hidden />
        </span>
      )}
    </div>
  );
}
