import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatBytes(n: number, locale: string): string {
  const units = locale.startsWith('fr')
    ? ['o', 'Ko', 'Mo', 'Go', 'To']
    : ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const fmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  return `${fmt.format(v)} ${units[i]}`;
}

export function formatRate(bytesPerSec: number, locale: string): string {
  if (bytesPerSec <= 0) return '—';
  const mb = bytesPerSec / (1024 * 1024);
  const fmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  return `${fmt.format(mb)} MB/s`;
}

export function formatEta(secondsRemaining: number, _locale: string): string {
  if (!Number.isFinite(secondsRemaining) || secondsRemaining < 0) return '—';
  const s = Math.floor(secondsRemaining);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (x: number) => x.toString().padStart(2, '0');
  if (h > 0) return `${h}:${pad(m)}:${pad(sec)}`;
  return `${pad(m)}:${pad(sec)}`;
}

export function truncateMiddle(s: string, max = 48): string {
  if (s.length <= max) return s;
  const half = Math.floor((max - 1) / 2);
  return `${s.slice(0, half)}…${s.slice(-half)}`;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

// Strip anything outside the Content-Disposition `filename=` token charset and
// cap the length. Keeps `"` and `\` out of header values so a hostile filename
// can't smuggle additional parameters.
export function safeAsciiSlug(s: string, maxLen: number, fallback: string): string {
  return s.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, maxLen) || fallback;
}
