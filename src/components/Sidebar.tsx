'use client';
import Link from 'next/link';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LogOut, Send, Inbox, Mailbox, Settings } from 'lucide-react';
import { CargoMark } from './CargoMark';
import { signOutAction } from '@/lib/auth/actions';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface SidebarProps {
  user: { username: string; global_name: string | null; avatar_url: string | null; locale: 'en' | 'fr' };
}

export function Sidebar({ user }: SidebarProps): JSX.Element {
  const path = usePathname();
  const t = useTranslations('nav');
  const tBrand = useTranslations('brand');
  const [copied, setCopied] = useState(false);

  const copyUsername = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(user.username);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // clipboard unavailable — silently ignore
    }
  };

  const items = [
    { href: '/dashboard/send',     label: t('send'),     icon: Send },
    { href: '/dashboard/outbox',   label: t('outbox'),   icon: Mailbox },
    { href: '/dashboard/inbox',    label: t('inbox'),    icon: Inbox },
    { href: '/dashboard/settings', label: t('settings'), icon: Settings },
  ];

  return (
    <aside className="w-14 md:w-60 shrink-0 bg-surface border-r border-hairline flex flex-col h-screen sticky top-0 transition-[width] duration-fast ease-cargo">
      <Link
        href="/dashboard"
        className="h-[60px] md:h-auto px-0 md:px-4 md:py-5 border-b border-hairline flex md:block items-center justify-center hover:bg-elevated transition-colors duration-fast ease-cargo"
        aria-label={tBrand('name')}
        title={tBrand('name')}
      >
        <div className="flex items-center justify-center md:justify-start gap-2">
          <CargoMark size={16} />
          <span className="hidden md:inline text-[15px] font-semibold text-ink">{tBrand('name')}</span>
        </div>
        <p className="hidden md:block text-[12px] text-muted mt-0.5">{tBrand('tagline')}</p>
      </Link>

      <nav className="flex-1 p-2 space-y-0.5">
        {items.map(({ href, label, icon: Icon }) => {
          const active = path === href || path.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              title={label}
              className={cn(
                'flex items-center justify-center md:justify-start gap-2.5 px-0 md:px-2.5 h-9 rounded-sm text-[13px] transition-colors duration-fast ease-cargo border-l-2',
                active
                  ? 'bg-elevated text-ink border-accent'
                  : 'text-muted hover:bg-elevated hover:text-ink border-transparent',
              )}
            >
              <Icon
                className={cn('h-4 w-4 shrink-0', active && 'text-accent')}
                strokeWidth={1.75}
              />
              <span className="hidden md:inline">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-hairline p-2 md:p-3">
        <div className="flex flex-col md:flex-row items-center gap-2 md:gap-2.5">
          <Avatar src={user.avatar_url} />
          <div className="hidden md:flex flex-col min-w-0">
            <span className="text-[13px] text-ink truncate">{user.global_name ?? user.username}</span>
            {user.global_name && (
              <button
                type="button"
                onClick={copyUsername}
                className="text-[11px] text-muted truncate text-left hover:text-ink transition-colors duration-fast ease-cargo"
                title={copied ? t('copied') : t('copyUsername')}
              >
                {copied ? t('copied') : user.username}
              </button>
            )}
          </div>
          <form action={signOutAction} className="md:ml-auto">
            <button
              type="submit"
              className="flex items-center justify-center h-8 w-8 md:h-auto md:w-auto rounded-sm text-muted hover:text-ink hover:bg-elevated transition-colors duration-fast ease-cargo"
              aria-label={t('signOut')}
              title={t('signOut')}
            >
              <LogOut className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
