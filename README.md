# Cargo

Self-hosted ephemeral file transfer. Sign in with Discord, send a file to another Cargo user, they get a 1-hour link, the file is hard-deleted afterwards.

Cargo doesn't keep a history — that absence is the load-bearing privacy property. Read [docs/PRIVACY.md](docs/PRIVACY.md).

## Stack

Next.js 15 (App Router, TS strict) · Auth.js v5 (Discord-only) · Postgres 16 + Drizzle · Tailwind + shadcn/ui · next-intl (EN/FR) · `@tus/server` for resumable uploads · Node `crypto` for streaming AES-256-GCM at rest.

## Quick start (local dev)

Prereqs: **Node ≥ 22** and **Docker** (for Postgres + the dev stack).

1. Create a Discord application at <https://discord.com/developers/applications>.
   - OAuth2 → add Redirect URL: `http://localhost:8080/api/auth/callback/discord`
   - Scope: `identify` only (Cargo never requests `email`).
   - Copy the **Client ID** and a fresh **Client Secret**.

2. Configure environment:

   ```bash
   cp .env.example .env.local
   # then edit .env.local:
   #   AUTH_DISCORD_ID / AUTH_DISCORD_SECRET — from your Discord app
   #   AUTH_SECRET     — long random string (e.g. `openssl rand -base64 48`)
   #   CARGO_MASTER_KEY — base64 of 32 random bytes:
   #                      head -c 32 /dev/urandom | base64
   ```

3. Bring it up:

   ```bash
   docker compose -f docker-compose.dev.yml up --build
   ```

   Open <http://localhost:8080>. First sign-in goes through Discord, then lands on the Send page.

   Postgres is exposed on `localhost:55433` (user/password/db all `cargo`) for local inspection.

## Production

The repo ships a production-shape `docker-compose.yml` that builds the image locally — no registry image is published — and is wired for [Traefik](https://traefik.io) as the reverse proxy.

```bash
export APP_HOST=cargo.example.com
export CARGO_MASTER_KEY="$(head -c 32 /dev/urandom | base64)"
export AUTH_SECRET="$(openssl rand -base64 48)"
export AUTH_DISCORD_ID=...
export AUTH_DISCORD_SECRET=...
export DB_PASSWORD='change-me'
export DATA_DIR=/var/lib/cargo-data       # blobs + postgres + logs live here
export TRAEFIK_NETWORK=traefik            # external Docker network Traefik attaches to
docker compose up -d --build
```

The Discord OAuth Redirect URL must match: `https://${APP_HOST}/api/auth/callback/discord`.

If you don't use Traefik, edit `docker-compose.yml` and replace the `traefik.*` labels with whatever your reverse proxy needs (the web service exposes port `3000` internally).

See [docs/DEPLOY.md](docs/DEPLOY.md) for the full operator guide.

## Scripts

```bash
npm run dev            # Next dev server
npm run build          # Next production build
npm run start          # Start the built server
npm run worker         # Run the cleanup worker (built)
npm run worker:dev     # Run the cleanup worker with tsx watch
npm run lint
npm run typecheck
npm run test           # Vitest watch
npm run test:run       # Vitest one-shot
npm run test:coverage
npm run test:e2e       # Playwright
npm run db:generate    # Drizzle: generate migration from schema diff
npm run db:migrate     # Drizzle: apply migrations
npm run db:studio      # Drizzle Studio
```

## Documentation

- [docs/PRIVACY.md](docs/PRIVACY.md) — **read first** — what is and is not stored
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/SECURITY.md](docs/SECURITY.md)
- [docs/DEPLOY.md](docs/DEPLOY.md)
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)
- [docs/TESTING.md](docs/TESTING.md)
- [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)
- [docs/API.md](docs/API.md)
- [DESIGN.md](DESIGN.md) — design system
- [CLAUDE.md](CLAUDE.md) — orientation for Claude Code sessions

## Security

Found a vulnerability? Please don't open a public issue — see [SECURITY.md](SECURITY.md) for the private disclosure path.

## License

[MIT](LICENSE).
