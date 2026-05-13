# CLAUDE.md — orientation for future Claude Code sessions

Single source of truth for **how Cargo is organized** and **what NOT to do**. Read first. Deeper docs under [docs/](docs/); the privacy stance is the load-bearing one and lives in [docs/PRIVACY.md](docs/PRIVACY.md).

## What Cargo is

A self-hosted ephemeral file transfer. Discord-only sign in. Sender picks a Cargo user, drops a file (up to 200 GB, resumable), gets a 1-hour link. Recipient downloads. The blob is hard-deleted after the transfer ends or expires. Cargo does not keep a history.

## Stack — single-host, two containers

- **Web:** Next.js 15 App Router + React 19 + TypeScript strict. Auth.js v5 (Discord-only). Drizzle ORM + Postgres 16. Tailwind + shadcn/ui. next-intl (EN/FR).
- **Transfers:** `@tus/server` mounted at `/api/tus`. Encryption-at-rest is **streaming AES-256-GCM** via `node:crypto`; per-file random DEK + IV, DEK wrapped under `CARGO_MASTER_KEY`. On-disk filenames are UUIDs with no extension.
- **Cleanup worker:** separate container (same image, different command). Runs every 5 minutes — purges expired/inactive transfers and hard-deletes orphaned blobs.
- **One host** per env. `/api/*` lives at the same origin as the UI.

## Layout (App Router, flat under `src/`)

```
src/
  app/
    [locale]/                       next-intl locale segment
      page.tsx                      public landing at `/` — the only indexed page
      (auth)/login/                 Discord OAuth entry
      (app)/layout.tsx              authed shell (Sidebar + content pane) — wraps everything under /dashboard
      (app)/dashboard/page.tsx      authed entry — redirects to /dashboard/send; the landing CTA points here
      (app)/dashboard/send/         the Send page (hero progress card)
      (app)/dashboard/outbox/       active transfers you sent
      (app)/dashboard/inbox/        active transfers sent to you
      (app)/dashboard/settings/     locale, privacy summary, delete account, export
    api/
      auth/[...nextauth]/route.ts   Auth.js v5
      tus/[[...path]]/route.ts      tus resumable upload mount
      transfers/                    REST surface for Outbox/Inbox/links
      transfers/[id]/download/      streamed decrypt download
      recipients/                   debounced lookup for the recipient picker
      account/                      locale, export, delete
  components/                       shadcn-style local components
    ui/                             button, input, dialog, toast, label, dropdown, sidebar
    transfer/                       HeroProgressCard, LinkCard, Dropzone, RecipientPicker, Countdown
    landing/                        LandingDemo, LandingCta — reused real cards driven by a scripted loop
  lib/
    crypto/                         envelope encryption (master KEK, per-file DEK, streaming GCM)
    db/                             Drizzle client + schema
    auth/                           Auth.js v5 config + Discord provider
    tus/                            tus-server adapter, encrypted FileStore
    abuse/                          in-memory download-session abuse detector
    i18n/                           next-intl request config
    quota/                          denormalized counter helpers
    log/                            structured logger that strips PII before emit
  worker/
    cleanup.ts                      cron loop (every 5 min) — purges expired transfers
  i18n/messages/{en,fr}.json
  styles/globals.css                CSS vars + Tailwind base
public/
  cargo.svg                         📦 vendored from Twemoji — never the raw glyph
  favicon.svg, favicon-{16,32,180,192,512}.png  generated at build
docker/
  Dockerfile, Dockerfile.dev
deploy/                             compose.yml + paths.env (CI writes app.env)
docker-compose.yml                  prod-shape (Traefik labels, no host ports)
docker-compose.dev.yml              dev (Next dev server, exposed Postgres on :55433)
docs/                               ARCHITECTURE, SECURITY, PRIVACY (centerpiece), DEPLOY, DEVELOPMENT, TESTING, CONTRIBUTING, API
DESIGN.md                           design system (single source of truth for visual tokens)
.gitlab-ci.yml                      reference pipeline (operators wire their own host)
```

## What NOT to do

- **No email/password auth.** Discord OAuth only. There is no fallback identifier.
- **No `audit_logs` table. No "Activity" page. No per-transfer event log.** This is the load-bearing privacy invariant. A test asserts the absence — see [docs/TESTING.md](docs/TESTING.md#no-history-test).
- **No filenames or transfer IDs in logs.** The structured logger has a `redact()` step that strips user IDs, Discord handles, filenames, and transfer IDs before emit. Operational signals (process errors, DB errors, rate-limit hits as anonymous counters) are the only thing that goes to stderr.
- **No IP addresses persisted.** The download-session abuse detector hashes `ip` and `user_agent` with a per-process random salt, holds them in memory only for the duration of the download, and drops the row the moment the connection closes.
- **No soft deletes on `transfers`.** When a transfer ends — completion or expiry — the row is removed and the blob is `unlink`'d. No anonymization step, no tombstone.
- **No `.env` with the master key checked in.** `CARGO_MASTER_KEY` (base64 32B) is set per environment via GitLab variables → `app.env` written by CI. The app fails fast at boot if the key is missing or not exactly 32 bytes after base64 decode.
- **No emoji glyphs rendered as text.** 📦 is `public/cargo.svg` (Twemoji). Use `<Image src="/cargo.svg" />` or the inline `<CargoMark />` component.
- **No history endpoint, no metrics dashboard, no operator panel.** Cargo is a courier — anything that lets it act as a witness is out of scope.
- **No comments restating what the code does.** Only "why" comments survive review.

## Privacy invariants (non-negotiable)

These are enforced by code and by tests:

1. The Postgres schema has **no `audit_logs` table**, no `activity` table, no `events` table. A migration introducing one is rejected in code review.
2. `transfers` rows are deleted on transfer end. `download_sessions` rows are deleted on download end. Neither leaves a tombstone.
3. The logger emits only event names + numeric counters. Tests grep the test-process stderr capture for forbidden substrings (user IDs as strings, common Discord-handle patterns, anything looking like a filename).
4. The Inbox and Outbox API only returns currently-active transfers. There is no `?include_completed=1` flag — completed transfers are gone.
5. The Cargo UI exposes the stance plainly (Send page privacy line, Settings privacy subsection, `docs/PRIVACY.md` link).

If you find yourself reaching for a "just-this-once" audit log, **stop and ask**. The whole product hinges on this being absolute.

## Encryption invariants

- `CARGO_MASTER_KEY` is decoded once at process boot. If missing or wrong length, the process exits non-zero before the HTTP server binds.
- Per-file: random 32-byte DEK, random 12-byte IV. AES-256-GCM streaming via `node:crypto` `createCipheriv`. The 16-byte auth tag is captured at stream end.
- DEK is wrapped under the master KEK using AES-256-GCM with a separately random per-wrap IV. The wrapped DEK + wrap IV + wrap auth tag are stored on the `transfers` row.
- On-disk filename is `crypto.randomUUID()` with no extension. The blob path is `${CARGO_BLOB_PATH}/${uuid[0..2]}/${uuid}` for fan-out.
- Decryption checks the GCM auth tag. A tag failure aborts the download stream mid-flight (the client gets a truncated response and a 500 trailer header) and emits `transfer.decrypt_failed` to logs as a counter — no transfer ID, no user.

See [docs/SECURITY.md](docs/SECURITY.md#encryption-at-rest) for the rotation procedure.

## Core data model

Three tables. That's it.

- **`users`**: `id` (UUID), `discord_id` (text, unique), `username` (text), `global_name` (text, nullable), `avatar_url` (text, nullable), `locale` (text, default `'en'`), `theme` (text, `'dark' | 'light'`, default `'dark'`), `storage_used_bytes` (bigint, denormalized counter), `token_version` (int, bumped on sensitive lifecycle changes so stale JWTs on other devices stop working), `created_at`.
- **`transfers`** *(while active)*: `id` (UUID), `sender_id` (FK users, on-delete-set-null), `recipient_username` (text — the routing hint the sender typed), `recipient_discord_id` (text, nullable until the recipient signs in — load-bearing authorization key, bound to Discord's immutable user id, **no FK** so handle recycling cannot transfer access), `filename` (text), `size_bytes` (bigint), `blob_path` (text), `dek_wrapped` (bytea), `dek_wrap_iv` (bytea), `dek_wrap_tag` (bytea), `content_iv` (bytea), `content_tag` (bytea, nullable until finalized), `status` (text: `uploading | pending | ready` — `pending` covers a transfer addressed to a Discord handle that hasn't signed in yet; in-flight downloads are tracked by the presence of a `download_sessions` row, not a status), `created_at`, `expires_at` (nullable while `pending` — set on claim to `now()+CARGO_LINK_TTL_SECONDS`), `pending_expires_at` (hard cap for unclaimed transfers), `delivered_at` (set when status flips pending→ready or at create time for known recipients), `first_downloaded_at` (set the first time a download stream finishes; dropped with the row at end-of-life — not a history log). See `src/lib/db/schema.ts` for the authoritative column list.
- **`download_sessions`** *(in-process only; row exists only during a download)*: `id` (UUID), `transfer_id` (FK), `ip_hash` (bytea), `ua_hash` (bytea), `bytes_sent` (bigint), `started_at`. Deleted on stream end (success, abort, or kill).

No `audit_logs`. No `accounts` / `sessions` tables for Auth.js — we run a **JWT session strategy** because keeping a session table is unnecessary persistence.

## How to run things

Local dev:

```bash
docker compose -f docker-compose.dev.yml up --build
open http://localhost:8080
```

First boot prompts Discord OAuth — set `AUTH_DISCORD_ID` and `AUTH_DISCORD_SECRET` from your Discord application (Redirect URL `http://localhost:8080/api/auth/callback/discord`).

Production (CI-driven; tag `v*.*.*`):

```bash
# Set in GitLab CI variables:
#   CARGO_MASTER_KEY (base64 32B), AUTH_SECRET (long random), AUTH_DISCORD_ID, AUTH_DISCORD_SECRET, DB_PASSWORD
git tag v0.1.0 && git push origin v0.1.0
```

See [docs/DEPLOY.md](docs/DEPLOY.md), [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md), [DESIGN.md](DESIGN.md).

## Conventions

- **TDD-first.** Vitest red → green → refactor for every new feature. The encryption pipeline has a fixed-key round-trip test. The Inbox/Outbox endpoints have a no-history test that asserts no rows exist outside the active set after a transfer cycle.
- **Conventional Commits.** Standard set: `feat`, `fix`, `chore`, `refactor`, `perf`, `test`, `docs`, `ci`, `build`.
- **Coverage gate.** ≥85% on changed files. Frontend held to the same bar — strict-but-not-100% to leave room for transient device-pixel-ratio shims.
- **CI / hosts:** the bundled `.gitlab-ci.yml` is a reference pipeline. Operators wire their own host and paths; see [docs/DEPLOY.md](docs/DEPLOY.md).
