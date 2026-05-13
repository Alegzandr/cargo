# Development

Local dev runs in `docker-compose.dev.yml`. Source is bind-mounted into the
web container; `node_modules` lives in a named volume so the host toolchain
never has to match.

## Bring it up

```bash
docker compose -f docker-compose.dev.yml up --build
```

Services:

| Service     | URL                    | Notes                                                          |
|-------------|------------------------|----------------------------------------------------------------|
| `web`       | http://localhost:8080  | Next.js dev server, source-mounted, HMR enabled                |
| `worker`    | (no HTTP)              | Cleanup worker, runs every 5 min                               |
| `db`        | localhost:55433        | Postgres 16 on a non-standard port (avoids host collisions)    |

First boot: visiting `/` redirects to `/api/auth/signin/discord` →
Discord OAuth → first user is created on callback. There is no admin
gate; in dev, set up a dedicated Discord application with redirect URL
`http://localhost:8080/api/auth/callback/discord`.

## Daily commands

```bash
# Tail web logs
docker compose -f docker-compose.dev.yml logs -f web

# Open a shell in the web container
docker compose -f docker-compose.dev.yml exec web sh

# Run Vitest
docker compose -f docker-compose.dev.yml exec web npm run test
docker compose -f docker-compose.dev.yml exec web npm run test:watch

# Run a single test file
docker compose -f docker-compose.dev.yml exec web npm run test -- tests/crypto-roundtrip.test.ts

# Playwright smoke
docker compose -f docker-compose.dev.yml exec web npm run test:e2e

# Drizzle: generate migration after schema change
docker compose -f docker-compose.dev.yml exec web npm run db:generate

# Drizzle: apply migrations
docker compose -f docker-compose.dev.yml exec web npm run db:migrate

# Drizzle studio (DB explorer at :4983)
docker compose -f docker-compose.dev.yml exec web npm run db:studio
```

## .env.local

Copy `.env.example` to `.env.local` and fill in your dev Discord app
credentials. The docker-compose.dev.yml reads from `.env.local` for the
Discord values and falls back to baked-in defaults for everything else.

```bash
cp .env.example .env.local
```

A throwaway dev master key is hard-coded in `docker-compose.dev.yml`
(`CARGO_MASTER_KEY=base64:ZGV2LW1hc3Rlci1rZXktbm90LWZvci1wcm9kdWN0aW9uLS0=` —
fake, not 32B after decode; the boot will warn). Set a real one in
`.env.local` if you want to test the crypto path properly:

```bash
echo "CARGO_MASTER_KEY=base64:$(head -c 32 /dev/urandom | base64)" >> .env.local
```

## Frontend HMR notes

- Next.js dev server runs on `:3000` inside the container, exposed as
  `:8080` on the host.
- Tailwind JIT picks up class changes automatically.
- shadcn primitives live locally under `src/components/ui/` — they are
  ordinary files; edit them directly.

## Hot reload for server code

Next.js's built-in fast refresh handles client components. Server
components and route handlers reload on file save. The cleanup worker
does **not** hot-reload — restart it with:

```bash
docker compose -f docker-compose.dev.yml restart worker
```

## Tear down

```bash
docker compose -f docker-compose.dev.yml down            # stop, keep volumes
docker compose -f docker-compose.dev.yml down -v         # nuke volumes too
```

## Troubleshooting

| Symptom                                          | Fix                                                                                |
|--------------------------------------------------|------------------------------------------------------------------------------------|
| `web` container restart loops on boot            | DB not ready yet; check `db` logs. The entrypoint retries for 60s.                 |
| Permission errors on `/app/logs`                 | Re-run `docker compose -f docker-compose.dev.yml up` after first boot — the entrypoint chowns it. |
| Discord OAuth returns `invalid_redirect_uri`     | Add `http://localhost:8080/api/auth/callback/discord` to your dev Discord app.    |
| Postgres won't start, port in use                | Host already has Postgres on `:55433`. Edit the port mapping in the dev compose.   |
| `node_modules` is slow on first boot             | It runs `npm ci` once and persists into a named volume.                            |
| `CARGO_MASTER_KEY` boot error                    | Set a 32-byte base64 key in `.env.local`. See above.                               |
