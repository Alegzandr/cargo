# Testing

Cargo is TDD-first: red → green → refactor for every new feature.

## Stack

| Layer    | Tool                                | Where                              |
|----------|-------------------------------------|------------------------------------|
| Unit + integration | **Vitest**                | `tests/**/*.test.ts`               |
| E2E       | **Playwright** (Chromium)          | `tests-e2e/`                        |
| Static    | `eslint`, `tsc --noEmit`           | run in CI                           |

## Running

```bash
npm ci
npm run test            # Vitest, watch mode
npm run test:run        # Vitest, single run
npm run test:coverage   # Vitest with coverage report
npm run test:e2e        # Playwright (requires running app at $PLAYWRIGHT_BASE_URL)
npm run lint            # ESLint
npm run typecheck       # tsc --noEmit
```

## Conventions

- **Unit tests** live next to the module they exercise: `tests/crypto/envelope.test.ts` tests `src/lib/crypto/envelope.ts`.
- **Integration tests** that hit Postgres use a real Postgres on `localhost:55433` (the docker-compose.dev.yml service). Vitest's `globalSetup` provisions a temporary schema per test run and tears it down after.
- **Do not mock the database.** Mock/prod divergence has masked broken migrations before. Integration tests must hit a real DB.
- **Crypto round-trip tests use fixed keys + IVs.** This makes the ciphertext output deterministic and lets us assert: ciphertext ≠ plaintext, decrypt(encrypt(x)) === x, and auth-tag tampering causes a thrown error.
- **Playwright smoke**: the happy path (sign in → drop file → wait for ready → copy link → recipient downloads), the abuse path (two clients on the same link → second is killed), the quota path (try to upload past 200 GB → 413).

## Coverage gates

CI enforces:

- **≥85% lines** on changed files (Vitest v8 thresholds).
- **`typecheck` clean.**
- **No `eslint` errors** (warnings allowed; errors block).

## No-history test (load-bearing)

`tests/no-history.test.ts` is one of the two most important tests in the
repo (alongside `tests/crypto/roundtrip.test.ts`). It exercises a complete
transfer cycle in a real Postgres and then asserts:

1. The `transfers` row is gone.
2. The `download_sessions` row is gone.
3. The on-disk blob is unlinked.
4. **No `audit_logs`-shaped table exists in the schema.** The test runs
   `SELECT table_name FROM information_schema.tables` and asserts the
   set is exactly `{ users, transfers, download_sessions, __drizzle_migrations }`.
5. The `users` row's `storage_used_bytes` has been decremented by the
   transferred size.

If a future migration adds a fourth table for legitimate reasons (say,
a `rate_limit_buckets` table), this test will fail loudly. The fix is to
add the table to the expected set in the test **and** discuss it in
`docs/PRIVACY.md` — never silently widen the expected set.

## No-PII-in-logs test

`tests/logging-redact.test.ts`:

1. Spawns a child process with the app's logger configured.
2. Calls the logger with payloads that include known-bad fields
   (`{ user_id, filename, transfer_id, discord_handle }`).
3. Captures stderr.
4. Asserts the stderr stream contains the `evt` name but contains
   **none** of the bad values.

If you add a new event type to `src/lib/log/`, add it to the whitelist
in `docs/PRIVACY.md` *and* extend this test.

## Crypto round-trip test

`tests/crypto/roundtrip.test.ts`:

1. Fixed 32B master key, fixed 12B IVs.
2. Plaintext = `"hello world"` and a 50 MB random buffer.
3. Encrypt streaming → assert the ciphertext is not the plaintext (and
   not zero).
4. Decrypt streaming → assert the result === the original.
5. Tamper with a single byte of ciphertext → assert decrypt throws.
6. Tamper with the auth tag → assert decrypt throws.
7. Encrypt with key A, decrypt with key B → assert throws.

## TDD checklist for every new feature

1. Write the failing Vitest test that describes the route's / module's contract.
2. Add or modify the file until the test goes green.
3. If the feature touches the privacy stance: add a privacy assertion in `tests/no-history.test.ts` and a sentence in `docs/PRIVACY.md`.
4. If the feature has a UI surface: add one Playwright happy-path step.
5. Run `npm run lint && npm run typecheck` locally. CI re-runs them.

## What NOT to do

- **Do not mock the master key.** Use real 32-byte keys in tests; the boot path you want to assert lives in real crypto.
- **Do not add a "test mode" that writes plaintext to disk.** Crypto must run in tests exactly as it runs in prod. If you need to peek at content, decrypt it via the same code path the download endpoint uses.
- **Do not silence ESLint with `// eslint-disable`** — fix the code or the rule.
