'use client';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// Re-export the shared validators so existing imports of `RecipientPicker`
// don't have to chase the move; the canonical home is now lib/validators.
export { normalizeHandle, isValidHandle } from '@/lib/validators';

export function RecipientPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}): JSX.Element {
  const t = useTranslations('send');
  // The note is unconditional: Cargo never resolves a handle against Discord's
  // API server-side, so we can't tell the sender ahead of time whether the
  // person is on Cargo yet. Showing the same disclosure either way is honest
  // and removes the temptation to add a probing lookup later.
  return (
    <div>
      <Label htmlFor="recipient-input">{t('recipientLabel')}</Label>
      <Input
        id="recipient-input"
        value={value}
        placeholder={t('recipientPlaceholder')}
        onChange={(e) => onChange(e.currentTarget.value)}
        autoComplete="off"
        spellCheck={false}
        autoCapitalize="none"
      />
      <p className="mt-1.5 text-[11px] leading-snug text-muted">{t('recipientPendingNote')}</p>
    </div>
  );
}
