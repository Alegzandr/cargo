# Contributing

## Outside contributors

Fork the repo, branch from `main`, open a PR against `main`. The CI workflow runs lint, typecheck, and the test suite on every PR. No deploy is triggered by contributor PRs.

If you're proposing a non-trivial change, open an issue first so we can agree on direction before you write the code.

## Maintainer git flow

> Only relevant if you operate your own deployed Cargo instance using the bundled `.gitlab-ci.yml`. Outside contributors can skip this section.

```
              ┌─────────────────┐
              │  feature/xxx    │  branched from develop, merged back via PR
              └────────┬────────┘
                       ▼
develop ───────────────┴───────────────────────►   auto-deploys to your dev host
   │                                                (push triggers deploy_dev)
   │   merge --no-ff on release
   ▼
main  ─────────────────────────────────────────►   no deploy
   │   tag v1.2.3
   ▼
v1.2.3 ─────────────────────────────────────────►  deploys to your prod host

hotfix/xxx ─►  branched from main, PR'd into main + cherry-picked into develop
```

Rules:

- **Feature work**: branch from `develop`, open PR back into `develop`. CI tests run; merging auto-deploys to your dev host (whichever you wired in CI).
- **Release**: merge `develop` into `main`, then tag `v*.*.*`. The tag push deploys to prod. `main` itself never auto-deploys.
- **Hotfixes**: branch from `main`, PR into `main`, tag a patch release, then cherry-pick or merge back into `develop` so the fix isn't lost.
- Never force-push `main` or `develop`. Rebase your own feature branches only.

## Conventional Commits

Required for every commit:

```
<type>(<optional scope>): <short summary>

<optional body>

<optional footer(s)>
```

Allowed types:

| Type      | When to use                                           |
|-----------|-------------------------------------------------------|
| `feat`    | A new user-visible feature                            |
| `fix`     | A bug fix                                             |
| `chore`   | Tooling, deps, build config — no runtime change       |
| `refactor`| Code change that neither fixes a bug nor adds a feature |
| `perf`    | Performance improvement                               |
| `test`    | Tests only                                            |
| `docs`    | Docs only                                             |
| `ci`      | CI config                                             |
| `build`   | Dockerfile, compose, build pipeline                   |

One logical change per commit. PR = one feature or one fix.

## TDD-first

Every new feature: failing Vitest test → implementation → green → refactor.

See [TESTING.md](TESTING.md). Two tests are load-bearing for the
product's stance:

- `tests/crypto/roundtrip.test.ts` — encryption correctness
- `tests/no-history.test.ts` — the privacy invariant: no leftover rows
  after a transfer, no `audit_logs`-shaped table in the schema

If you change something that touches either, also update the relevant
section of `docs/PRIVACY.md` so the docs match the code.

## Static analysis

| Tool          | What it covers          | Run                  |
|---------------|-------------------------|----------------------|
| **ESLint**    | TypeScript / React lint | `npm run lint`       |
| **Prettier**  | Formatting (JS/TS/JSON) | `npm run format`     |
| **tsc**       | TypeScript strict       | `npm run typecheck`  |

`tsconfig.json` has `strict: true`. Do not relax it.

## What NOT to do

- **Do not add an audit log, activity feed, or any per-transfer event sink.** This is the load-bearing privacy invariant. See [docs/PRIVACY.md](docs/PRIVACY.md).
- **Do not request the Discord `email` scope.** We do not store email and that scope would surface a field we deliberately don't keep.
- **Do not add a "history" or "recent transfers" page.** The Outbox and Inbox only ever show currently-active transfers.
- **Do not log user IDs, Discord handles, filenames, transfer IDs, or IPs.** The structured logger has a redact step; do not bypass it.
- **Do not introduce a soft-delete column on `transfers`.** Hard delete is the contract.
- **Do not mock the database in integration tests.** See [TESTING.md](TESTING.md).
- **Do not use the raw 📦 glyph in any user-facing text.** Use the vendored SVG at `public/cargo.svg`.
- **No `--no-verify` on commits.** If a hook fails, fix the root cause.
- **No force-push** to `develop` or `main`.
