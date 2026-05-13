import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { CargoMark } from '@/components/CargoMark';
import { Button } from '@/components/ui/button';

export default async function LocaleNotFound(): Promise<JSX.Element> {
  const t = await getTranslations('notFound');
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
          <div className="mono text-[11px] uppercase tracking-wide text-subtle mb-3">{t('eyebrow')}</div>
          <h1 className="text-[36px] sm:text-[44px] md:text-[52px] font-semibold tracking-tight leading-[1.05] text-ink">
            {t('title')}
          </h1>
          <p className="mt-6 text-[15px] md:text-[16px] leading-relaxed text-muted">{t('body')}</p>
          <div className="mt-8 flex justify-center">
            <Button asChild>
              <Link href="/">{t('cta')}</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
