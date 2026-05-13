import { ImageResponse } from 'next/og';
import { renderBrandOG } from '@/lib/og/brand';

export const alt = 'Cargo — ephemeral file transfer';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OG(): ImageResponse {
  return renderBrandOG({
    title: 'Ephemeral file transfer.',
    subtitle: 'Drop a file, share a 1-hour link. Cargo doesn’t keep a history.',
  });
}
