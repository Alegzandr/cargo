import { bigint, customType, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

const bytea = customType<{ data: Buffer; default: false }>({
  dataType() {
    return 'bytea';
  },
});

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    discord_id: text('discord_id').notNull().unique(),
    username: text('username').notNull(),
    global_name: text('global_name'),
    avatar_url: text('avatar_url'),
    locale: text('locale').notNull().default('en'),
    theme: text('theme').$type<'dark' | 'light'>().notNull().default('dark'),
    storage_used_bytes: bigint('storage_used_bytes', { mode: 'number' }).notNull().default(0),
    // Bumped by sensitive lifecycle changes (delete). The JWT embeds this at
    // sign-in and the session callback rejects stale tokens. Keeps lingering
    // JWTs on other devices from working after the user row is gone.
    token_version: integer('token_version').notNull().default(0),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    usernameIdx: index('users_username_lower_idx').on(t.username),
    globalNameIdx: index('users_global_name_lower_idx').on(t.global_name),
  }),
);

export const TRANSFER_STATUS = {
  UPLOADING: 'uploading',
  PENDING: 'pending',
  READY: 'ready',
} as const;
export type TransferStatus = (typeof TRANSFER_STATUS)[keyof typeof TRANSFER_STATUS];

export const transfers = pgTable(
  'transfers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sender_id: uuid('sender_id').references(() => users.id, { onDelete: 'set null' }),
    // recipient_username is the routing hint the sender typed. recipient_discord_id
    // is the load-bearing authorization key — bound to Discord's immutable user id
    // at create time (if the user is known) or at the first sign-in of someone
    // holding the handle. Once set, ownership is locked: changing Discord handles
    // or recycling a freed handle to another account cannot transfer access.
    recipient_username: text('recipient_username').notNull(),
    recipient_discord_id: text('recipient_discord_id'),
    filename: text('filename').notNull(),
    size_bytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    blob_path: text('blob_path').notNull(),
    dek_wrapped: bytea('dek_wrapped').notNull(),
    dek_wrap_iv: bytea('dek_wrap_iv').notNull(),
    dek_wrap_tag: bytea('dek_wrap_tag').notNull(),
    content_iv: bytea('content_iv').notNull(),
    content_tag: bytea('content_tag'),
    status: text('status').$type<TransferStatus>().notNull().default(TRANSFER_STATUS.UPLOADING),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    // Nullable while a transfer is `pending`: the 1-hour download TTL only
    // starts when the recipient signs in and claims the row. Set at create
    // time for known recipients (status=ready) and on claim for pending ones.
    expires_at: timestamp('expires_at', { withTimezone: true }),
    // Hard ceiling for unclaimed transfers. The cleanup worker hard-deletes
    // pending rows past this timestamp — no tombstone, no notification.
    pending_expires_at: timestamp('pending_expires_at', { withTimezone: true }),
    // Set when status flips pending→ready (recipient claimed at sign-in) or
    // at create time for already-known recipients. Used by the UI to render
    // delivery state; cleared with the row at end-of-life.
    delivered_at: timestamp('delivered_at', { withTimezone: true }),
    // Set the first time a download stream finishes end-to-end. Dropped when
    // the transfer row is deleted at expiry/end, so it is not a history log —
    // just transient delivery state on the active transfer.
    first_downloaded_at: timestamp('first_downloaded_at', { withTimezone: true }),
  },
  (t) => ({
    senderIdx: index('transfers_sender_idx').on(t.sender_id),
    recipientUsernameIdx: index('transfers_recipient_username_idx').on(t.recipient_username),
    recipientDiscordIdIdx: index('transfers_recipient_discord_id_idx').on(t.recipient_discord_id),
    expiresIdx: index('transfers_expires_at_idx').on(t.expires_at),
    pendingExpiresIdx: index('transfers_pending_expires_at_idx').on(t.pending_expires_at),
    statusIdx: index('transfers_status_idx').on(t.status),
  }),
);

export const downloadSessions = pgTable(
  'download_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    transfer_id: uuid('transfer_id').notNull().references(() => transfers.id, { onDelete: 'cascade' }),
    ip_hash: bytea('ip_hash').notNull(),
    ua_hash: bytea('ua_hash').notNull(),
    bytes_sent: bigint('bytes_sent', { mode: 'number' }).notNull().default(0),
    started_at: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    transferIdx: index('download_sessions_transfer_idx').on(t.transfer_id),
  }),
);

export type User = typeof users.$inferSelect;
export type Transfer = typeof transfers.$inferSelect;
export type DownloadSession = typeof downloadSessions.$inferSelect;
