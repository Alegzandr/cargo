'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { LocaleToggle } from '@/components/LocaleToggle';
import { ThemeToggle } from '@/components/ThemeToggle';
import { StorageMeter } from '@/components/StorageMeter';

export function SettingsView({
  username,
  locale,
  theme,
}: {
  username: string;
  locale: 'en' | 'fr';
  theme: 'dark' | 'light';
}): JSX.Element {
  const t = useTranslations('settings');
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');

  async function deleteNow(): Promise<void> {
    if (confirm !== username) return;
    const r = await fetch('/api/account/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm_username: username }),
    });
    if (r.ok) {
      window.location.href = '/login';
      return;
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      <section>
        <h2 className="text-[15px] font-semibold text-ink mb-2">{t('storageHeading')}</h2>
        <p className="text-[13px] text-muted mb-3">{t('storageBody')}</p>
        <StorageMeter />
      </section>

      <section>
        <h2 className="text-[15px] font-semibold text-ink mb-2">{t('locale')}</h2>
        <LocaleToggle current={locale} />
      </section>

      <section>
        <h2 className="text-[15px] font-semibold text-ink mb-2">{t('theme')}</h2>
        <ThemeToggle current={theme} />
      </section>

      <section>
        <h2 className="text-[15px] font-semibold text-ink mb-2">{t('privacyHeading')}</h2>
        <p className="text-[13px] text-muted">
          {t('privacyBody')}{' '}
          <Link
            href="/privacy"
            className="text-accent underline underline-offset-2 decoration-accent/30 hover:decoration-accent"
          >
            {t('privacyLink')}
          </Link>
        </p>
      </section>

      <section>
        <h2 className="text-[15px] font-semibold text-ink mb-2">{t('exportHeading')}</h2>
        <p className="text-[13px] text-muted mb-3">{t('exportBody')}</p>
        <Button asChild variant="secondary">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- /api route, not a page */}
          <a href="/api/account/export">{t('exportCta')}</a>
        </Button>
      </section>

      <section>
        <h2 className="text-[15px] font-semibold text-ink mb-2">{t('deleteHeading')}</h2>
        <p className="text-[13px] text-muted mb-3">{t('deleteBody')}</p>
        <Button variant="ghost" className="text-danger hover:bg-danger/10" onClick={() => setOpen(true)}>
          {t('deleteCta')}
        </Button>
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-[15px] font-semibold">{t('deleteModalTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-[13px] text-muted mb-4">{t('deleteModalBody')}</p>
          <div>
            <Label htmlFor="delete-confirm">{t('deleteModalLabel')}</Label>
            <Input
              id="delete-confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.currentTarget.value)}
              className="mono"
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setOpen(false); setConfirm(''); }}>
              {t('deleteCancel')}
            </Button>
            <Button variant="danger" disabled={confirm !== username} onClick={() => void deleteNow()}>
              {t('deleteModalCta')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
