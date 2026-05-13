import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { auth } from '@/lib/auth';
import { Sidebar } from '@/components/Sidebar';

export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }
  // First-login fix: next-intl middleware falls back to Accept-Language when no
  // NEXT_LOCALE cookie exists, which can disagree with the DB-stored
  // preference. Bounce through the sync route to plant the cookie.
  const currentLocale = await getLocale();
  if (currentLocale !== session.user.locale) {
    redirect('/api/account/locale/sync?next=/dashboard');
  }
  return (
    <div className="flex min-h-screen bg-bg text-ink">
      <Sidebar user={session.user} />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
