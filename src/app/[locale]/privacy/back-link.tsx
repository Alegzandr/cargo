'use client';

import { useRouter } from 'next/navigation';

export function BackLink(): JSX.Element {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) {
          router.back();
        } else {
          router.push('/');
        }
      }}
      className="text-[13px] text-muted hover:text-ink"
    >
      ← Cargo
    </button>
  );
}
