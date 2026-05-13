# Privacy

> Cargo is a courier, not a witness.

This document is the load-bearing one. The product hinges on the invariants
in it being absolute, not aspirational. If anything below conflicts with code
or with another doc, the code is wrong — open an issue, don't relax this
document.

## What Cargo stores

A complete enumeration. If it's not here, it's not stored.

### `users` (one row per Cargo account)

| Column                | What it is                                                | Why it exists                                                |
|-----------------------|-----------------------------------------------------------|--------------------------------------------------------------|
| `id`                  | UUID v4, application-generated                            | Primary key, never exposed in the URL                        |
| `discord_id`          | Discord user id (snowflake, text)                         | OAuth identity. The only third-party identifier we hold.     |
| `username`            | Discord username (e.g. `acme.dev`)                        | Displayed and used by the recipient picker                   |
| `global_name`         | Discord global display name, nullable                     | Displayed when present (Discord users without one fall back to `username`) |
| `avatar_url`          | URL to Discord's CDN, nullable                            | Displayed as the 24px avatar in the recipient picker         |
| `locale`              | `'en'` or `'fr'`, default `'en'`                          | Persists the locale toggle in the sidebar                    |
| `theme`               | `'dark'` or `'light'`, default `'dark'`                   | Persists the theme toggle in the sidebar                     |
| `storage_used_bytes`  | bigint, denormalized                                      | Counter for the per-user quota. Adjusted on transfer end.    |
| `token_version`       | int, default `0`                                          | Bumped on sensitive lifecycle changes (delete). The session callback rejects JWTs whose embedded version is stale, so cookies on other devices stop working immediately. |
| `created_at`          | timestamptz                                               | Account creation (i.e., first Discord OAuth)                 |

No email. No phone. No IP at the user level. No `last_seen_at`.

### `transfers` (one row per *currently-active* transfer)

A `transfers` row exists from the moment the first tus chunk lands and is
**deleted entirely** when the transfer ends — completion + recipient finished
their download, or expiry, or revocation. There is no soft-delete column.

| Column              | What it is                                                  |
|---------------------|-------------------------------------------------------------|
| `id`                  | UUID v4                                                     |
| `sender_id`           | FK `users.id`, `ON DELETE SET NULL`                         |
| `recipient_username`  | text — the routing hint the sender typed (Discord handle, lowercased) |
| `recipient_discord_id`| text, nullable — the immutable Discord user id the row is bound to. Set at create time when the recipient is already on Cargo, or at the recipient's first sign-in (claim). **No FK** — once set, the binding survives Discord handle changes and prevents handle recycling from transferring access. |
| `filename`            | Client-supplied original filename, kept while active        |
| `size_bytes`          | bigint                                                      |
| `blob_path`           | UUID path on disk (`{prefix}/{uuid}`, no extension)         |
| `dek_wrapped`         | bytea — the per-file DEK encrypted under the master KEK     |
| `dek_wrap_iv`         | bytea — 12-byte IV used to wrap the DEK                     |
| `dek_wrap_tag`        | bytea — 16-byte GCM auth tag for the DEK wrap               |
| `content_iv`          | bytea — 12-byte IV used to encrypt the file body            |
| `content_tag`         | bytea, nullable — 16-byte GCM auth tag captured at finalize |
| `status`              | `uploading | pending | ready` (in-flight download state lives in `download_sessions`, not here) |
| `created_at`          | timestamptz                                                 |
| `expires_at`          | timestamptz, nullable while `pending` — set to `now() + CARGO_LINK_TTL_SECONDS` on claim |
| `pending_expires_at`  | timestamptz, nullable — hard cap for unclaimed transfers (sender quota refund + blob unlink past this) |
| `delivered_at`        | timestamptz, nullable — set on transition from `pending`→`ready` (or at create time for known recipients) |
| `first_downloaded_at` | timestamptz, nullable — set the first time a download stream finishes end-to-end. Dropped with the row at end-of-life — **not a history log**, just transient delivery state on the active row. |

That is the *entire* set of columns we hold on a live transfer. There is no
`recipient_ip`, no `sender_ip`, no `download_count`, no `user_agent`, no
`first_seen_at`. The `filename` exists so the recipient knows what they're
downloading — it is removed with the rest of the row when the transfer ends
(i.e. the moment the last download finishes past expiry, or at the 24h hard
cap).

### `download_sessions` (ephemeral, in-process)

A row exists **only while a download is in flight**. It's used by the
in-memory abuse detector to spot the same token being used from many places
at once. The row is deleted the instant the response body ends (success or
failure).

| Column         | What it is                                                                    |
|----------------|-------------------------------------------------------------------------------|
| `id`           | UUID                                                                          |
| `transfer_id`  | FK `transfers.id`, `ON DELETE CASCADE`                                        |
| `ip_hash`      | HMAC-SHA256(`ip`, *per-process random salt*) — 32 bytes                       |
| `ua_hash`      | HMAC-SHA256(`user-agent`, *same salt*) — 32 bytes                             |
| `bytes_sent`   | bigint                                                                        |
| `started_at`   | timestamptz                                                                   |

The salt rotates on every process restart, so the hash is **un-correlatable
across boots**. There is no row for "downloads that just finished" — the row
is gone.

## What Cargo does **not** store

This is the table that matters most:

| Category                                       | Stored? |
|------------------------------------------------|---------|
| Audit log of who sent what to whom             | **No.** No `audit_logs` table. A migration that introduces one is rejected in code review. |
| Audit log of who downloaded what               | **No.** Download sessions are in-memory only and vanish at stream end. |
| Per-user activity feed                         | **No.** There is no "Activity" page or endpoint. |
| Filenames after the transfer ends              | **No.** They are removed with the transfer row. |
| SHA-256 of the file content                    | **No.** We do not compute one. The GCM auth tag is what verifies integrity, and it goes with the transfer row. |
| Sender or recipient IP addresses               | **No.** Not at the user level, not at the transfer level. Only short-lived hashed IPs in `download_sessions`, salted with a process-local random salt. |
| User agents                                    | **No.** Only short-lived hashed UAs in `download_sessions`. |
| Geolocation, device fingerprint, anything else | **No.** |
| Auth.js sessions in the DB                     | **No.** We use JWT sessions (`session.strategy = 'jwt'`). The session lives in a signed cookie. |

## Application logs — exact field set

`LOG_LEVEL=warning` in production. Cargo's logger has a `redact()` step that
runs before any line is emitted. The only fields that ever make it to stderr:

```
{ "ts": "2026-01-12T15:04:05.000Z", "lvl": "warn|error", "evt": "<event_name>", "ctx": { ... numeric counters only ... } }
```

The whitelist of `evt` names and the `ctx` shape per event:

| `evt`                       | When                                                  | `ctx` shape                                                            |
|-----------------------------|-------------------------------------------------------|------------------------------------------------------------------------|
| `boot.ok`                   | Process boot complete                                 | `{ workers: <int> }`                                                   |
| `boot.master_key_invalid`   | `CARGO_MASTER_KEY` missing or wrong length            | `{ length: <int> }` (boot fails after this)                            |
| `db.error`                  | Postgres returned an error                            | `{ code: "<pg_sqlstate>" }`                                            |
| `tus.chunk_rejected`        | tus body validation failed                            | `{ reason: "size|state|finalized" }` (no transfer id)                  |
| `transfer.decrypt_failed`   | GCM auth tag mismatch on download                     | `{}`                                                                   |
| `quota.exceeded`            | Per-user 200 GB ceiling hit                           | `{}`                                                                   |
| `abuse.session_diverged`    | Same transfer token seen from >1 ip_hash in 30s       | `{ sessions: <int> }`                                                  |
| `abuse.session_killed`      | Detector killed an in-flight download                 | `{ reason: "diverged|range_abuse|bandwidth" }`                         |
| `ratelimit.hit`             | Anonymous rate-limit bucket overflowed                | `{ bucket: "tus|download|recipient_search" }`                          |
| `cleanup.cycle`             | Worker tick                                           | `{ purged: <int>, freed_bytes: <int> }`                                |
| `cleanup.orphan_removed`    | Worker found a blob with no transfer row              | `{}`                                                                   |

There is no `user_id`, no `transfer_id`, no `filename`, no `ip`, no `handle`
in any `ctx` shape. The redact step also runs over the framework's own error
serialization — uncaught throws are logged with `{ evt: "uncaught", ctx: { class: "<error_class>" } }`, never the message or stack.

## Retention

The link has a fixed **1-hour lifetime**. Within that window, the recipient
can download the file (once or many times). At expiry, **no new downloads
are accepted** — but any download already in flight is allowed to run to
completion. The instant the last in-flight session ends past expiry, the
transfer row and its blob are hard-deleted.

**Pending delivery.** If the sender addresses a Discord handle that has not
yet signed in to Cargo, the transfer is held in a `pending` state with the
encrypted blob on disk. The 1-hour download window does **not** start at
upload — it starts the moment that handle first signs in and the row is
claimed. Until that happens (and bounded by `CARGO_PENDING_TTL_SECONDS`,
default 7 days), Cargo has no way to authorize a download; if no matching
sign-in occurs before the cap, the row and its blob are hard-deleted on the
next worker tick with no tombstone, no notification, no record. The sender
can revoke a pending transfer at any time; pending transfers carry no
shareable link.

There is one safety net: the **24h hard cap**. If a session never ends
cleanly (half-open TCP, etc.), the cleanup worker tears the transfer down
24h after expiry regardless of in-flight state.

| Item                                          | Trigger to delete                                                                          |
|-----------------------------------------------|--------------------------------------------------------------------------------------------|
| `transfers` row (and its blob)                | Past `expires_at` AND no rows in `download_sessions` for it — checked inline on each session end, and every 5 min by the worker as a safety net |
| `transfers` row (and its blob)                | 24h past `expires_at`, regardless of in-flight state (hard cap against stalled sessions)   |
| `transfers` row (and its blob)                | Status `pending` and past `pending_expires_at` — the recipient never signed in to claim it |
| `transfers` row (and its blob)                | Sender revokes from the Outbox                                                             |
| `download_sessions` row                       | Stream end (success, abort, kill)                                                          |
| Blob with no `transfers` row referencing it   | Worker `cleanup.orphan_removed` sweep                                                      |

The cleanup worker runs every **5 minutes**. Hard delete happens **inline
on the request path** whenever the last session finishes after expiry — the
worker is a safety net for transfers that were never downloaded at all (and
the 24h cap).

## Account deletion

The user types their `@handle` to confirm. Server-side:

1. Their `transfers` rows where they are the sender are **deleted entirely**,
   the blobs hard-deleted. Recipients see those transfers disappear from
   their inbox on the next refresh — no "sender deleted their account"
   message, because the row is gone.
2. Their `transfers` rows where they are the recipient have
   `recipient_username` and `recipient_discord_id` rewritten to a UUID-suffixed
   `'deleted-…'` sentinel. The row becomes unaddressable: no future sign-in
   (including a fresh signup that recycles the same Discord handle) can match
   it, so the file cannot be inherited by a stranger. The sender sees
   "(recipient deleted their account)" in the Outbox row; the worker purges
   the row on the normal expiry schedule.
3. Their `users` row is **deleted entirely** — no soft-delete column, no
   tombstone. `storage_used_bytes`, `locale`, `theme`, and `token_version`
   go with it.
4. The Auth.js JWT cookie is cleared and the response sets `Clear-Site-Data`.

## Export my data

`GET /api/account/export` returns a single JSON file
(`cargo-export-<username>-<timestamp>.json`):

```json
{
  "exported_at": "<ISO 8601>",
  "profile": {
    "discord_id": "...",
    "username": "...",
    "global_name": "...",
    "avatar_url": "...",
    "locale": "en|fr",
    "storage_used_bytes": 0,
    "created_at": "<ISO 8601>"
  },
  "transfers": [
    {
      "id": "<uuid>",
      "filename": "...",
      "size_bytes": 0,
      "status": "uploading|pending|ready",
      "created_at": "<ISO 8601>",
      "expires_at": "<ISO 8601> | null",
      "direction": "outbound|inbound",
      "peer_username": "..." 
    }
  ]
}
```

The `transfers` array enumerates currently-active transfers only — anything
expired or completed has been hard-deleted and cannot be exported. Capped at
1000 rows. That's the entire export. Nothing else exists to give.

## Why this stance

Cargo runs on a single self-hosted box. The operator is also the user (or
their close peer). The asymmetry between "what value an audit trail adds"
(near zero — there is no compliance regime, no abuse-response team) and
"what risk it carries" (a single compromise leaks who-sent-what-to-whom
across an entire community) is so lopsided that the right answer is
**not to collect it**.

This document is the contract. The code matches it. The tests assert it.
The UI surfaces it. Don't relax it.

## Reporting

If you operate Cargo for a community and someone asks you for their data:
the user-facing export endpoint above produces it. You don't have anything
more to give — you'd have to make it up.
