'use client';
import { useRef, type DragEvent, type KeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';

export function Dropzone({
  onFile,
  disabled,
}: {
  onFile: (f: File) => void;
  disabled?: boolean;
}): JSX.Element {
  const t = useTranslations('send');
  const ref = useRef<HTMLInputElement>(null);

  function pickFirst(files: FileList | null | undefined): void {
    if (!files || files.length === 0) return;
    onFile(files[0]!);
  }

  function onDrop(e: DragEvent<HTMLDivElement>): void {
    e.preventDefault();
    if (disabled) return;
    pickFirst(e.dataTransfer?.files);
  }

  function onKey(e: KeyboardEvent<HTMLDivElement>): void {
    if (disabled) return;
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    ref.current?.click();
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      onClick={() => !disabled && ref.current?.click()}
      onKeyDown={onKey}
      className={
        'border-2 border-dashed border-hairline rounded-md py-16 px-8 text-center cursor-pointer ' +
        'hover:border-muted transition-colors duration-fast ease-cargo focus:outline-none ' +
        'focus-visible:border-accent ' +
        (disabled ? 'opacity-50 pointer-events-none' : '')
      }
    >
      <div className="text-[13px] text-ink">{t('dropzoneTitle')}</div>
      <div className="text-[12px] text-muted mt-1">{t('dropzoneHint')}</div>
      <input
        ref={ref}
        type="file"
        multiple={false}
        className="hidden"
        onChange={(e) => pickFirst(e.currentTarget.files)}
      />
    </div>
  );
}
