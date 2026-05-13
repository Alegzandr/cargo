import Image from 'next/image';
import { cn } from '@/lib/utils';

export function CargoMark({ size = 14, className }: { size?: number; className?: string }): JSX.Element {
  return (
    <Image
      src="/cargo.svg"
      width={size}
      height={size}
      alt="Cargo"
      className={cn('inline-block align-[-2px]', className)}
      priority
    />
  );
}
