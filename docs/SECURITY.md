# Security

Threat model: a curious or hostile network can reach the public host. The
app holds in-flight encrypted blobs and the DEKs that decrypt them. The
master KEK is held in process memory, never written to disk by the app.

Single-tenant per operator (no cross-org isolation needed).

## Controls

| Control                              | Implementation                                                       |
|--------------------------------------|----------------------------------------------------------------------|
| HTTPS only                           | Reverse proxy (Traefik in the bundled compose) terminates TLS        |
| HSTS                                 | Set on Traefik labels and in `next.config.ts` headers                |
| `X-Robots-Tag: noindex, nofollow`    | Traefik middleware                                                   |
| `X-Content-Type-Options: nosniff`    | `next.config.ts` headers                                             |
| `X-Frame-Options: DENY`              | `next.config.ts` headers                                             |
| `Referrer-Policy`                    | `strict-origin-when-cross-origin`                                    |
| `Permissions-Policy`                 | camera / microphone / geolocation off                                |
| CSP                                  | strict, no inline scripts; `connect-src 'self'`; no `unsafe-eval`   |
| Auth.js session cookie               | `HttpOnly`, `SameSite=Lax`, `Secure` in prod, JWT-signed             |
| OAuth provider                       | Discord-only; redirect URL pinned per environment                    |
| Encryption at rest                   | AES-256-GCM streaming, per-file random DEK + IV, envelope-wrapped    |
| Master key handling                  | Loaded from `CARGO_MASTER_KEY` at boot; fail-fast on missing/short   |
| Per-file authenticated integrity     | 16-byte GCM auth tag captured at upload, verified at download        |
| Rate limits                          | In-memory token-bucket per anonymous-hashed identifier               |
| Abuse detection on download          | In-memory only; rows in `download_sessions` deleted on stream end    |
| Typed-handle account deletion        | Typed-name confirmation pattern (see API.md)                         |
| Quota enforcement                    | Denormalized `users.storage_used_bytes`, checked before tus PATCH    |

## Encryption at rest

Cargo encrypts every uploaded file before it touches the disk. The server
never holds plaintext blobs on disk, and the disk format is useless to
anyone who doesn't also hold the master KEK.

### Layout

```
CARGO_MASTER_KEY                  base64(32 bytes) — set via env, loaded at boot
  ↓ (kept in process memory only)
master KEK
  ↓ AES-256-GCM(wrap_iv, dek)
  → dek_wrapped + dek_wrap_tag    stored on the transfers row
    ↑
    dek  random 32 bytes per file (never written to disk in plaintext)
    ↓ AES-256-GCM(content_iv, plaintext_stream)
    → ciphertext stream on disk + content_tag (stored on the transfers row at finalize)
```

The DEK lives in process memory only while encrypting or decrypting a
specific transfer. It is wiped from memory (`Buffer.fill(0)`) on
finalize / on stream-end.

### Why envelope

- **Rotation**: rotating the master KEK only requires re-wrapping the per-file DEKs, not re-encrypting the multi-GB blobs.
- **Compromise containment**: an exfiltrated DB without `CARGO_MASTER_KEY` reveals zero plaintext.
- **Streaming**: a single random IV + DEK per file means we can use a single GCM cipher instance across the entire upload, without the awkward "split into chunks each with its own IV" pattern.

### Key rotation procedure

Master KEK rotation is rare but supported.

1. Generate the new key: `head -c 32 /dev/urandom | base64`.
2. Set `CARGO_MASTER_KEY_NEXT` to the new key in CI variables, alongside the existing `CARGO_MASTER_KEY`. **Do not unset the old key.**
3. Deploy. The web process now boots with both keys available. Encryption uses the **new** key; decryption tries the new key first, then falls back to the old key.
4. Run the rotation script: `docker compose exec web node dist/scripts/rotate-master-key.js`. This iterates every `transfers` row and re-wraps the DEK under the new master key. The blobs are not touched.
5. After it finishes, promote: set `CARGO_MASTER_KEY` to the new value and remove `CARGO_MASTER_KEY_NEXT`. Redeploy.
6. The old key is no longer reachable — destroy your copy.

The rotation script is idempotent: it skips rows whose `dek_wrap_iv` is
already from the new key (we tag wraps with the key fingerprint's first 4
bytes prepended to the wrap IV in a separate column once rotation lands —
see TODO in `src/lib/crypto/master.ts` for the migration shape).

## Rate limits

All in-memory token buckets keyed by `HMAC-SHA256(ip || user_id, salt)`.
The salt rotates per process. Counters are not persisted.

| Endpoint                                   | Limit                                |
|--------------------------------------------|--------------------------------------|
| `POST /api/auth/signin/discord`            | 10/min/ip-hash                       |
| `POST/PATCH /api/tus/*`                    | 2 concurrent per user                |
| `GET /api/transfers/[id]/download`         | 4/min per recipient + abuse detector |
| `GET /api/recipients?q=`                   | 30/min/user                          |
| `POST /api/account/delete`                 | 3/hour/user                          |

Bucket overflows return `429` with `Retry-After`. The logger emits
`ratelimit.hit { bucket: "..." }` as a counter — never the identifier.

## Abuse detection (download path)

Three signals, all evaluated on the in-memory map. See
[ARCHITECTURE.md](ARCHITECTURE.md#in-memory-abuse-detector-srclibabuse).
The detector **never writes to disk** beyond the in-progress
`download_sessions` row, which is deleted on stream end.

## What is intentionally NOT in scope

- **MFA / TOTP / WebAuthn** — out of scope. Discord OAuth carries its own MFA. The Cargo box is a single-operator tool.
- **Email-based password reset / SMTP** — there are no passwords.
- **Any third-party identity provider other than Discord** — adding one means a second user-identification surface. Out of scope.
- **Server-side antivirus scanning** — the file is encrypted in transit through the server and on disk; scanning would require decrypting back to plaintext, which negates the encryption-at-rest property. The recipient is expected to scan client-side.
- **Sharing past 1 hour** — if the recipient missed the window, the sender re-uploads. We do not have a "renew" button.

## Logging

`LOG_LEVEL=warning` in production. `LOG_CHANNEL=stderr`. The logger's
`redact()` step (see [PRIVACY.md](PRIVACY.md#application-logs--exact-field-set))
runs over every line.

A test in `tests/logging-redact.test.ts` feeds known-bad payloads
(`{ user_id: "abc" }`, `{ filename: "secret.zip" }`) and asserts the
emitted line contains neither value.

## Headers (`next.config.ts`)

```ts
async headers() {
  return [{
    source: '/(.*)',
    headers: [
      { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
      { key: 'Content-Security-Policy', value: cspString },
    ],
  }];
}
```

CSP excludes `unsafe-eval`. Inline scripts use a per-request nonce
(Next.js middleware sets the nonce and passes it via headers).
