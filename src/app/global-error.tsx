'use client';

import Link from 'next/link';
import '../styles/globals.css';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }): JSX.Element {
  return (
    <html lang="en" className="dark" style={{ colorScheme: 'dark' }}>
      <body>
        <div className="min-h-screen bg-bg text-ink flex flex-col">
          <header className="px-6 md:px-10 pt-6 md:pt-8">
            <Link href="/" className="inline-flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm">
              <span className="text-[15px] font-semibold text-ink">Cargo</span>
            </Link>
          </header>
          <main className="flex-1 px-6 md:px-10 flex items-center justify-center">
            <div className="max-w-[42ch] text-center">
              <div className="mono text-[11px] uppercase tracking-wide text-subtle mb-3">Error</div>
              <h1 className="text-[36px] sm:text-[44px] md:text-[52px] font-semibold tracking-tight leading-[1.05] text-ink">
                Something broke.
              </h1>
              <p className="mt-6 text-[15px] md:text-[16px] leading-relaxed text-muted">
                Something went wrong on our end. Nothing you sent was kept. Try again — and if it keeps happening, give it a minute.
              </p>
              <div className="mt-8 flex justify-center gap-3">
                <button
                  onClick={reset}
                  className="inline-flex items-center justify-center h-9 px-4 rounded-sm bg-accent text-accent-fg text-[13px] font-medium hover:brightness-110"
                >
                  Try again
                </button>
                <Link
                  href="/"
                  className="inline-flex items-center justify-center h-9 px-4 rounded-sm bg-elevated text-ink border border-hairline text-[13px] font-medium hover:bg-elevated/80"
                >
                  Back to Cargo
                </Link>
              </div>
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
