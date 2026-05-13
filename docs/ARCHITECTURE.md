# Architecture

Single host, two containers (web + cleanup worker), one route surface (`/api/*` on the same origin as the UI).

## Process model

- **Web container** runs `next start` from a standalone build (`next.config output: 'standalone'`). Node 22 LTS. PID 1 is `node`. No nginx, no pm2.
- **Cleanup worker container** runs `node dist/worker/cleanup.js` from the same image. PID 1 is `node`. A naive loop that wakes every 5 minutes, scans `transfers WHERE expires_at < now()`, and for each one checks `download_sessions` — hard-deletes the rows and unlinks the blobs when no session is in flight (or unconditionally past the 24h hard cap).
- **Postgres** is its own container (`postgres:16-alpine`).

The web container handles tus uploads and download streaming **in the same Node process**. Tus traffic is HTTP and Next.js's request body is streamed — we use `@tus/server` mounted at `/api/tus` via a route handler that bridges Web Request/Response into Node streams.

## Request lifecycle

```
client → Traefik (TLS) → cargo-web:3000
                          ├─ /_next/static/*           Next.js static
                          ├─ /cargo.svg, /favicon.*    public/
                          ├─ /api/auth/*               Auth.js v5
                          ├─ /api/tus/*                tus resumable upload
                          ├─ /api/transfers/[id]/download  streamed decrypt
                          ├─ /api/transfers/*          REST surface
                          ├─ /api/recipients?q=…       picker autocomplete
                          ├─ /api/account/*            locale, export, delete
                          └─ /[locale]/*               App Router pages
```

`/api/*` lives at the same origin as the UI. Auth.js handles its own
session-cookie validation; everything else reads `getServerSession()` /
`auth()` once at the route entry and gates accordingly.

## Components

### Encryption pipeline (`src/lib/crypto/`)

Envelope encryption:

```
client bytes → AES-256-GCM(content_dek, content_iv) → ciphertext on disk
                                                       └─ auth tag captured at finalize
content_dek random per-file ──┐
                              └─ wrap: AES-256-GCM(master_kek, wrap_iv) → dek_wrapped + dek_wrap_tag
                              ↑
master_kek = base64decode(CARGO_MASTER_KEY)  (32 bytes; checked at boot)
```

All in Node `crypto`'s native streaming. Memory footprint per concurrent
upload is bounded by tus's chunk size (1 MiB default), not the file size.

On download, the wrap is reversed first (a small one-shot DEK unwrap),
then the file is decrypted with `createDecipheriv` and piped to the
response. The auth tag is validated at stream end — a mismatch aborts the
response and emits `transfer.decrypt_failed`.

### Tus upload (`src/lib/tus/`)

`@tus/server` mounted at `/api/tus/*`. We register a **custom FileStore**
that:

1. Allocates a `crypto.randomUUID()` blob path.
2. Creates a fresh AES-256-GCM cipher (random DEK, random content IV).
3. As chunks arrive from tus, passes them through the cipher and writes
   the ciphertext.
4. On finalize: captures the auth tag, wraps the DEK under the master KEK,
   inserts the `transfers` row. If the addressed handle already maps to a
   Cargo user, the row is `status='ready'` with `expires_at = now() + 1h`;
   otherwise it's `status='pending'` with `pending_expires_at` set instead
   (the 1h window starts on the recipient's first sign-in). Updates the
   sender's `storage_used_bytes` (denormalized counter) and returns the
   share URL.

Tus's resumability comes for free: we keep an `.upload-info` sidecar file
in the same directory tier as the encrypted blob. The sidecar is plain
JSON (tus's own metadata format) and contains **no user data** — only the
offset and total size. It is removed on finalize.

### Download endpoint (`/api/transfers/[id]/download`)

A streaming route handler:

1. Auth check (`auth()` must resolve to a user whose Discord id matches the transfer's `recipient_discord_id` — pending rows have no `recipient_discord_id` yet and are unreachable here by design).
2. Insert a `download_sessions` row with the salted ip/ua hashes.
3. Unwrap the DEK with the master KEK.
4. Open the encrypted blob as a Node `ReadStream`, pipe through
   `createDecipheriv`, then through a passthrough that:
   - Updates `bytes_sent` on the session row every 256 KiB.
   - Checks the abuse detector every 256 KiB (see `src/lib/abuse/`).
5. On stream end (success or abort): delete the session row. If the
   transfer is past `expires_at` **and** no other `download_sessions` row
   references it, hard-delete the transfer and unlink the blob **inline**.
   The worker is only the safety net for transfers never claimed at all.
6. Decryption auth-tag verification happens at the end of `createDecipheriv`;
   a tag mismatch surfaces as a stream error and the response trailer reads
   500.

The expiry rule: the link is valid for 1h. After 1h, no new downloads are
accepted, but downloads already in flight finish. The instant the last
in-flight session ends past expiry, the transfer is gone.

### In-memory abuse detector (`src/lib/abuse/`)

A `Map<transferId, DownloadSessionMemo[]>` updated as `download_sessions`
rows are written. Every 256 KiB of stream progress, the detector checks:

1. **Divergence**: more than one distinct `ip_hash` against the same
   `transfer_id` within a 30-second window → kill all but the first.
2. **Range abuse**: more than 4 `Range: bytes=…` reopens of the same
   transfer within 60s → kill subsequent ones.
3. **Bandwidth ceiling**: more than `CARGO_PER_DOWNLOAD_RATE_LIMIT`
   MB/s (default 50) sustained over a 10s window → kill.

On kill: the response stream is destroyed, the session row is deleted,
`abuse.session_killed` is emitted (no transfer id), the per-process map
entry is removed.

The Map lives only in the web process. There is no Redis dependency —
two web replicas behind a load balancer would each maintain their own
view, which is acceptable for this design (single replica per
environment).

### Cleanup worker (`src/worker/cleanup.ts`)

```ts
while (true) {
  await tick();
  await sleep(5 * 60 * 1000);
}
```

Each tick:

- Select `transfers WHERE expires_at < now()`.
- For each, check whether any `download_sessions` row still references it
  (still being downloaded by a recipient who started before expiry).
  - If yes and we're under 24h past expiry: leave it alone — the inline
    path will catch it when the session ends.
  - If no, or if it's past the 24h hard cap: `unlink(blob_path)`,
    `DELETE transfers`, decrement `users.storage_used_bytes` for the
    sender (if still present).
- Then scan the blob filesystem for any UUID with no `transfers` row →
  unlink (`cleanup.orphan_removed`).

Run as a sidecar, not as a cron container — same image, different
command. The compose file declares it as a separate service.

### Auth (`src/lib/auth/`)

Auth.js v5, **Discord-only**, **JWT session strategy** (no DB-backed
session table). The `signIn` callback upserts the `users` row with the
Discord profile (`discord_id`, `username`, `global_name`, `avatar_url`).
The `jwt` callback fetches `locale` and `id` from the DB once per login
and persists them on the token. The `session` callback maps them onto
`session.user`.

There is intentionally **no `accounts` table, no `sessions` table, no
`verification_tokens` table** — Auth.js's standard schema is for
session-table mode. We skip the adapter entirely.

## Storage

- **Database:** Postgres 16, schema in `drizzle/`. Three tables.
- **Blobs on disk:** `${CARGO_BLOB_PATH}/{uuid[0..2]}/{uuid}` — 256-way fan-out so we don't have a giant flat directory after the first few thousand transfers. Outside the webroot (`CARGO_BLOB_PATH=/var/lib/cargo/blobs` in prod).

## Why Next.js standalone, not edge

The download endpoint is a long-running stream that holds an open `Decipheriv`
and updates the session row periodically. Edge runtimes have CPU/time limits;
Node runtime does not. The whole `/api/*` surface is force-Node:

```ts
export const runtime = 'nodejs';
```

is set in every route handler that touches crypto or the DB.

## Failure modes worth knowing about

- **Auth-tag mismatch on download**: `crypto.createDecipheriv()`'s `final()`
  throws if the tag is wrong. We catch this in the pipe and destroy the
  response; the recipient sees a truncated body. The transfer row is
  *left in place* (status `'ready'`) — the same blob may be tried again,
  and if the tag keeps failing the worker eventually expires it. We do
  not auto-delete on first failure because a network blip looks the same
  as a tampered blob to the client side of the pipe.
- **Tus chunk arrives after finalize**: 410 Gone. The blob is already
  encrypted and committed; we don't roll back a partial chunk.
- **Master key rotation**: see [SECURITY.md](SECURITY.md#key-rotation).
- **Database migrations**: run in the entrypoint before `next start`. A
  failed migration aborts the boot rather than serving with a stale
  schema.

## What lives where (tl;dr)

| Concern                  | Path                                  |
|--------------------------|---------------------------------------|
| Encryption primitives    | `src/lib/crypto/`                     |
| Tus server + FileStore   | `src/lib/tus/`                        |
| Drizzle schema + queries | `src/lib/db/`                         |
| Auth.js config           | `src/lib/auth/`                       |
| Abuse detector           | `src/lib/abuse/`                      |
| Quota counter helpers    | `src/lib/quota/`                      |
| Locale + i18n            | `src/lib/i18n/`, `src/i18n/messages/` |
| Structured logger        | `src/lib/log/`                        |
| Cleanup worker           | `src/worker/cleanup.ts`               |
| App Router pages         | `src/app/[locale]/(app)/dashboard/*/` |
| Public landing (`/`)     | `src/app/[locale]/page.tsx`           |
| Authed entry (`/dashboard`) | `src/app/[locale]/(app)/dashboard/page.tsx` (redirects to `/dashboard/send`) |
| Login                    | `src/app/[locale]/(auth)/login/`      |
| Hero progress card       | `src/components/transfer/`            |
| Landing components       | `src/components/landing/`             |
| shadcn primitives        | `src/components/ui/`                  |
