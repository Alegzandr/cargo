import { and, desc, eq, gt, inArray, or, sql, type SQL } from 'drizzle-orm';
import { db } from '../db/client.js';
import { transfers, TRANSFER_STATUS, users, type TransferStatus } from '../db/schema.js';

export type Direction = 'inbox' | 'outbox';

export interface PeerCard {
  username: string;
  global_name: string | null;
  avatar_url: string | null;
}

export interface ActiveTransfer {
  id: string;
  filename: string;
  size_bytes: number;
  status: TransferStatus;
  created_at: string;
  expires_at: string | null;
  pending_expires_at: string | null;
  delivered_at: string | null;
  first_downloaded_at: string | null;
  peer: PeerCard | null;
  recipient_username: string;
}

// Inbox only ever surfaces delivered transfers. Pending rows don't have a
// recipient_discord_id yet, so they can't appear in anyone's inbox.
const INBOX_STATUSES: TransferStatus[] = [TRANSFER_STATUS.READY];
// Outbox surfaces every active state the sender owns: in-flight upload,
// awaiting-claim, and live download window.
const OUTBOX_STATUSES: TransferStatus[] = [
  TRANSFER_STATUS.UPLOADING,
  TRANSFER_STATUS.PENDING,
  TRANSFER_STATUS.READY,
];

interface ListRow {
  id: string;
  filename: string;
  size_bytes: number;
  status: TransferStatus;
  created_at: Date;
  expires_at: Date | null;
  pending_expires_at: Date | null;
  delivered_at: Date | null;
  first_downloaded_at: Date | null;
  sender_id: string | null;
  recipient_username: string;
  peer_username: string | null;
  peer_global_name: string | null;
  peer_avatar_url: string | null;
}

// Peer is the sender for Inbox (joined on users.id) and the recipient handle
// for Outbox (joined on users.username). For outbox rows addressed to a
// not-yet-on-Cargo recipient, the LEFT JOIN nulls everything — synthesize a
// handle-only card so the UI can still render an addressee column.
function buildPeerCard(r: ListRow, isInbox: boolean): PeerCard | null {
  if (r.peer_username) {
    return { username: r.peer_username, global_name: r.peer_global_name, avatar_url: r.peer_avatar_url };
  }
  if (isInbox) return null;
  return { username: r.recipient_username, global_name: null, avatar_url: null };
}

function serializeRow(r: ListRow, isInbox: boolean): ActiveTransfer {
  return {
    id: r.id,
    filename: r.filename,
    size_bytes: r.size_bytes,
    status: r.status,
    created_at: r.created_at.toISOString(),
    expires_at: r.expires_at ? r.expires_at.toISOString() : null,
    pending_expires_at: r.pending_expires_at ? r.pending_expires_at.toISOString() : null,
    delivered_at: r.delivered_at ? r.delivered_at.toISOString() : null,
    first_downloaded_at: r.first_downloaded_at ? r.first_downloaded_at.toISOString() : null,
    peer: buildPeerCard(r, isInbox),
    recipient_username: r.recipient_username,
  };
}

export async function loadActiveTransfers(
  direction: Direction,
  userId: string,
  discordId: string,
): Promise<ActiveTransfer[]> {
  const isInbox = direction === 'inbox';
  const allowedStatuses = isInbox ? INBOX_STATUSES : OUTBOX_STATUSES;

  // A row is "live" if either its download TTL hasn't expired (ready) or its
  // pending TTL hasn't expired (pending). Uploading rows have no TTL of their
  // own — they get cleaned up by the worker via the orphan path.
  const liveClause = or(
    gt(transfers.expires_at, sql`now()`),
    gt(transfers.pending_expires_at, sql`now()`),
    eq(transfers.status, TRANSFER_STATUS.UPLOADING),
  ) as SQL;

  // Inbox matches on the immutable Discord id, not the (mutable) handle.
  // Rows are bound at create time when the recipient already has an account,
  // and claimed in the signIn callback otherwise.
  const ownerClause = isInbox
    ? eq(transfers.recipient_discord_id, discordId)
    : eq(transfers.sender_id, userId);
  const joinOn = isInbox
    ? eq(users.id, transfers.sender_id)
    : eq(users.username, transfers.recipient_username);

  const rows = await db
    .select({
      id: transfers.id,
      filename: transfers.filename,
      size_bytes: transfers.size_bytes,
      status: transfers.status,
      created_at: transfers.created_at,
      expires_at: transfers.expires_at,
      pending_expires_at: transfers.pending_expires_at,
      delivered_at: transfers.delivered_at,
      first_downloaded_at: transfers.first_downloaded_at,
      sender_id: transfers.sender_id,
      recipient_username: transfers.recipient_username,
      peer_username: users.username,
      peer_global_name: users.global_name,
      peer_avatar_url: users.avatar_url,
    })
    .from(transfers)
    .leftJoin(users, joinOn)
    .where(and(ownerClause, inArray(transfers.status, allowedStatuses), liveClause))
    .orderBy(desc(transfers.created_at));

  return rows.map((r) => serializeRow(r, isInbox));
}
