import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { transfers, users } from '@/lib/db/schema';
import { isUuid } from '@/lib/utils';
import { renderBrandOG, OG_SIZE } from '@/lib/og/brand';

export const runtime = 'nodejs';
export const alt = 'A file is waiting for you on Cargo';
export const size = OG_SIZE;
export const contentType = 'image/png';

// Loaded by Discord/Slack/etc. without a session — the URL itself is the
// secret (UUID). We only ever expose the sender username; filename, size,
// and recipient stay private. If the transfer is missing or expired we
// collapse to the generic brand card, same as the page does.
export default async function OG({ params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  let senderName: string | null = null;

  if (isUuid(id)) {
    const rows = await db
      .select({ sender_id: transfers.sender_id, expires_at: transfers.expires_at })
      .from(transfers)
      .where(eq(transfers.id, id))
      .limit(1);
    const t = rows[0];
    if (t?.sender_id && t.expires_at && t.expires_at.getTime() > Date.now()) {
      const s = await db
        .select({ username: users.username, global_name: users.global_name })
        .from(users)
        .where(eq(users.id, t.sender_id))
        .limit(1);
      senderName = s[0]?.global_name ?? s[0]?.username ?? null;
    }
  }

  if (!senderName) {
    return renderBrandOG({
      title: 'This transfer is gone.',
      subtitle: 'Cargo doesn’t keep a history. Once a transfer ends, the file is removed.',
    });
  }

  return renderBrandOG({
    eyebrow: 'A file is waiting for you',
    title: `${senderName} sent you a file.`,
    subtitle: 'Sign in with Discord to download. The link expires within the hour.',
  });
}
