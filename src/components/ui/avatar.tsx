import Image from 'next/image';
import { cn } from '@/lib/utils';

export function Avatar({
  src,
  className = 'h-5 w-5',
  size = 24,
}: {
  src: string | null | undefined;
  className?: string;
  size?: number;
}): JSX.Element {
  if (src) {
    return (
      <Image
        src={src}
        alt=""
        width={size}
        height={size}
        className={cn(className, 'rounded-sm')}
        unoptimized={false}
      />
    );
  }
  return <div className={cn(className, 'rounded-sm bg-hairline')} />;
}
