import Link from 'next/link';
import { CargoMark } from '@/components/CargoMark';
import { Button } from '@/components/ui/button';

export default function RootNotFound(): JSX.Element {
  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col">
      <header className="px-6 md:px-10 pt-6 md:pt-8">
        <Link href="/" className="inline-flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm">
          <CargoMark size={18} />
          <span className="text-[15px] font-semibold text-ink">Cargo</span>
        </Link>
      </header>
      <main className="flex-1 px-6 md:px-10 flex items-center justify-center">
        <div className="max-w-[42ch] text-center">
          <div className="mono text-[11px] uppercase tracking-wide text-subtle mb-3">404</div>
          <h1 className="text-[36px] sm:text-[44px] md:text-[52px] font-semibold tracking-tight leading-[1.05] text-ink">
            Nothing here.
          </h1>
          <p className="mt-6 text-[15px] md:text-[16px] leading-relaxed text-muted">
            This page doesn&apos;t exist — or the transfer it pointed to is already gone. Cargo keeps no history, so once a link expires there&apos;s nothing left to find.
          </p>
          <div className="mt-8 flex justify-center">
            <Button asChild>
              <Link href="/">Back to Cargo</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
