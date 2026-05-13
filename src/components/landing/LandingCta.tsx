import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { signIn } from '@/lib/auth';

// Two states. Authed users get a plain link to /dashboard; the unauthed CTA
// is a server-action form so the OAuth handshake happens server-side (mirrors
// the login page).
export function LandingCta({
  authed,
  signInLabel,
  openLabel,
}: {
  authed: boolean;
  signInLabel: string;
  openLabel: string;
}): JSX.Element {
  if (authed) {
    return (
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 h-10 px-5 rounded-sm bg-accent text-accent-fg text-[14px] font-medium hover:brightness-110 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        {openLabel}
        <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
      </Link>
    );
  }

  async function discord(): Promise<void> {
    'use server';
    await signIn('discord', { redirectTo: '/dashboard' });
  }

  return (
    <form action={discord}>
      <button
        type="submit"
        className="inline-flex items-center gap-2 h-10 px-5 rounded-sm bg-accent text-accent-fg text-[14px] font-medium hover:brightness-110 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        {signInLabel}
      </button>
    </form>
  );
}
