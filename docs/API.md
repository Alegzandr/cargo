# `/api/*` reference

All endpoints live at the same origin as the UI (`https://cargo.<DOMAIN>/api/*`).
Authentication is the Auth.js session cookie (JWT-signed, HttpOnly,
SameSite=Lax). There is no token-based API surface for external callers —
Cargo is interactive only.

## Auth

```
GET   /api/auth/signin              Auth.js sign-in page (redirects to Discord)
GET   /api/auth/callback/discord    OAuth callback
POST  /api/auth/signout             Sign out
GET   /api/auth/session             Current session JSON
```

The `signIn` callback upserts the `users` row from the Discord profile.
We request **only** the `identify` scope. No `email`.

## Account

```
PATCH /api/account/locale           { locale: "en"|"fr" } → 200 { ok: true }
GET   /api/account/export           → 200, Content-Disposition: attachment; filename="cargo-export-…json"
                                      Body shape: see docs/PRIVACY.md#export-my-data
POST  /api/account/delete           { confirm_username: "<your-username>" } → 200 { ok: true }
                                      Server re-checks confirm_username === session.user.username.
                                      Hard-deletes the user row + owned transfers + nulls recipient refs
                                      on incoming transfers, clears the JWT cookie, sets Clear-Site-Data.
```

## Recipients (picker autocomplete)

```
GET   /api/recipients?q=<query>     → 200 { results: [{ id, username, global_name, avatar_url }] }
                                      Rate: 30/min/user
                                      Empty match returns []
```

The endpoint searches `users.username` (case-insensitive prefix) and
`users.global_name` (case-insensitive substring) and excludes the caller.
It returns at most 8 results. The endpoint **does not** indicate whether
a non-matching user exists on Discord — only Cargo users are searchable.

## Transfers — read

```
GET   /api/transfers/outbox         → 200 { transfers: [TransferRow…] }
                                      Active transfers where sender_id = me.
                                      "Active" = status IN ('uploading','pending','ready')
                                      AND (expires_at > now() OR expires_at IS NULL).
                                      Pending rows have no expires_at yet — the 1h window
                                      starts when the recipient signs in and claims the row.

GET   /api/transfers/inbox          → 200 { transfers: [TransferRow…] }
                                      Active transfers where recipient = me, status = 'ready',
                                      expires_at > now(). Pending rows are not surfaced to the
                                      recipient until they sign in (sign-in flips them to ready).
```

`TransferRow`:

```ts
{
  id: string,                       // UUID; used as the share URL token
  filename: string,
  size_bytes: number,
  status: 'uploading' | 'pending' | 'ready',
  created_at: string,               // ISO 8601
  expires_at: string | null,        // ISO 8601; null while status='pending'
  pending_expires_at: string | null,// ISO 8601; hard cap for unclaimed transfers
  delivered_at: string | null,      // ISO 8601; set on pending→ready (or at create for known recipients)
  first_downloaded_at: string | null,
  peer: { username: string, global_name: string | null, avatar_url: string | null } | null,
                                    // For outbox: the recipient (synthesized handle-only card if the
                                    //   recipient isn't on Cargo yet — pending state).
                                    // For inbox: the sender. Null if the sender deleted their account.
  recipient_username: string,       // The Discord handle the sender typed; useful in outbox UI
}
```

There is **no** `?include_completed=1` flag. Completed transfers have
been hard-deleted by the cleanup worker and do not exist.

## Transfers — upload (tus)

```
POST  /api/tus                      Tus 1.0 — see https://tus.io/protocols/resumable-upload
HEAD  /api/tus/<upload_id>
PATCH /api/tus/<upload_id>
```

The tus mount sits at `/api/tus`. The standard `Upload-Metadata` header
carries `filename` and `recipient_username` (the Discord handle the sender
typed — Cargo looks up the matching Discord id at create time, or at the
recipient's first sign-in if they're not on Cargo yet):

```
Upload-Metadata: filename <base64(filename)>,recipient_username <base64(handle)>
```

The PATCH stream is encrypted on the fly (AES-256-GCM streaming) and
written to disk as ciphertext. On `Upload-Length` reached, the server:

1. Captures the GCM auth tag.
2. Wraps the per-file DEK under the master KEK.
3. Inserts the `transfers` row. If the addressed handle already maps to a
   Cargo user, status is `ready` and `expires_at = now() + CARGO_LINK_TTL_SECONDS`.
   Otherwise status is `pending` and the row gets `pending_expires_at = now() +
   CARGO_PENDING_TTL_SECONDS` instead — the 1h download window only starts when
   the recipient signs in and claims the row.
4. Updates the sender's `storage_used_bytes`.
5. Returns the result in the response body:
   ```json
   {
     "transfer_id": "<uuid>",
     "share_url": "/d/<uuid>",
     "status": "ready" | "pending",
     "expires_at": "<ISO 8601> | null",
     "pending_expires_at": "<ISO 8601> | null"
   }
   ```
   `share_url` is a path — the client resolves it against the page origin.
   For `status: "pending"`, the link is not shareable yet (the recipient
   must sign in first); only `pending_expires_at` is set.

Quota and size enforcement runs **before** the PATCH stream opens:

- `Upload-Length` > `CARGO_MAX_FILE_SIZE` (200 GiB default) → 413
- `user.storage_used_bytes + Upload-Length` > `CARGO_USER_QUOTA` → 413
- Two existing `transfers` rows with `status='uploading'` for the user → 429

## Transfers — download

```
GET   /api/transfers/<id>/download  Streamed body, content-disposition: attachment; filename="…"
                                    The recipient's Auth.js session Discord id must match the transfer's recipient_discord_id.
                                    Rate: 4/min per recipient + abuse detector (see SECURITY.md).
```

The endpoint also supports `Range: bytes=…` for resumable downloads.
Each range reopen counts toward the abuse detector's "reopen" budget.

The transfer is deleted **inline** when the last in-flight session ends
past `expires_at`. Within the 1h window, multiple downloads (re-downloads,
range resumes) are allowed and the transfer survives them.

## Transfers — revoke

```
DELETE /api/transfers/<id>          { confirm_filename: "<filename>" } → 200 { ok: true }
                                    Sender-only. Kills any in-flight download, deletes the row, unlinks the blob,
                                    decrements storage_used_bytes.
```

The `confirm_filename` field is the typed-name destructive confirmation:
the danger button on the modal stays disabled until the input matches.

## Error shape

```json
{ "error": "<machine_code>", "message": "<human readable, locale-aware>" }
```

Machine codes:

| Code                          | HTTP | When                                                    |
|-------------------------------|------|---------------------------------------------------------|
| `unauthenticated`             | 401  | No session cookie                                       |
| `not_recipient`               | 403  | Session user is not the transfer's recipient            |
| `not_sender`                  | 403  | Session user is not the transfer's sender               |
| `transfer_not_found`          | 404  | Unknown id or already purged                            |
| `transfer_expired`            | 410  | Past `expires_at`                                       |
| `file_too_large`              | 413  | Upload-Length > `CARGO_MAX_FILE_SIZE`                   |
| `quota_exceeded`              | 413  | Would push `storage_used_bytes` past `CARGO_USER_QUOTA` |
| `confirm_mismatch`            | 422  | Typed-name confirm didn't match                         |
| `rate_limited`                | 429  | Token bucket overflow (`Retry-After` header set)        |
| `decrypt_failed`              | 500  | GCM auth tag mismatch — body is truncated mid-stream    |
| `internal`                    | 500  | Anything else                                           |

Error messages are localized via the `Accept-Language` header (the UI
sends the active locale on every request).

## Health

```
GET   /api/health                   → 200 { ok: true }
```

No DB ping, no worker status, no version — a free fingerprint endpoint
is one we deliberately don't ship.

## Versioning

No `/v1` prefix today. If the surface needs to break, we add `/api/v2`
and run both for a release.
