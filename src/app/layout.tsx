import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import '../styles/globals.css';

// metadataBase resolves the relative `/opengraph-image` URLs Next generates
// from `app/**/opengraph-image.tsx` into absolute ones for crawlers. AUTH_URL
// is the canonical origin in every env (see docker-compose / CI).
export const metadata: Metadata = {
  metadataBase: new URL(process.env.AUTH_URL ?? 'http://localhost:8080'),
  title: { default: 'Cargo — ephemeral file transfer', template: '%s — Cargo' },
  description: 'Send a file with a 1-hour link. Cargo doesn’t keep a history.',
  applicationName: 'Cargo',
  robots: { index: false, follow: false, nocache: true },
  openGraph: {
    type: 'website',
    siteName: 'Cargo',
    title: 'Cargo — ephemeral file transfer',
    description: 'Send a file with a 1-hour link. Cargo doesn’t keep a history.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cargo — ephemeral file transfer',
    description: 'Send a file with a 1-hour link. Cargo doesn’t keep a history.',
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32.png', type: 'image/png', sizes: '32x32' },
      { url: '/favicon-16.png', type: 'image/png', sizes: '16x16' },
      { url: '/favicon-192.png', type: 'image/png', sizes: '192x192' },
      { url: '/favicon-512.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: [{ url: '/favicon-180.png', sizes: '180x180' }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0d1014' },
    { media: '(prefers-color-scheme: light)', color: '#fcfcfc' },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }): Promise<JSX.Element> {
  // Theme is canonical in users.theme; the cookie carries it pre-session so
  // SSR can pick the palette before auth() runs. Default to dark when neither
  // is present.
  const jar = await cookies();
  const theme = jar.get('cargo_theme')?.value === 'light' ? 'light' : 'dark';
  return (
    <html lang="en" className={theme === 'dark' ? 'dark' : ''} style={{ colorScheme: theme }}>
      <body>{children}</body>
    </html>
  );
}
