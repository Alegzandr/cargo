// Predicate for "can this Discord user download this transfer row right now?"
//
// Collapses four failure modes into one boolean so callers can return a single
// 404 and not leak which gate tripped:
//   - row doesn't exist
//   - row is pending (no recipient claim yet → recipient_discord_id is NULL)
//   - row is bound to a different recipient
//   - row has expired or never had its content tag written
//
// Authorization is keyed on the immutable Discord id, not the (mutable,
// recyclable) handle. See lib/auth/index.ts for the claim-on-signIn flow that
// fills in recipient_discord_id for transfers addressed to unknown handles.
export interface AccessibleTransferRow {
  recipient_discord_id: string | null;
  expires_at: Date | null;
  content_tag: Buffer | null;
}

export function isTransferAccessible(
  t: AccessibleTransferRow | undefined,
  userDiscordId: string,
): boolean {
  return (
    !!t &&
    t.recipient_discord_id === userDiscordId &&
    !!t.expires_at &&
    t.expires_at.getTime() >= Date.now() &&
    !!t.content_tag
  );
}
