# Deploy

Single host, two containers (web + cleanup), behind a reverse proxy. The bundled compose files use [Traefik](https://traefik.io); any reverse proxy that can route to the web container's port `3000` works — see "Without Traefik" below.

`/api/*` lives at the same origin as the UI. Pin one Discord application per environment so the OAuth Redirect URL is unambiguous.

## Standalone deploy (recommended for self-hosters)

The root `docker-compose.yml` builds the image locally — no registry image is published.

```bash
# Required
export APP_HOST=cargo.example.com
export CARGO_MASTER_KEY="$(head -c 32 /dev/urandom | base64)"
export AUTH_SECRET="$(openssl rand -base64 48)"
export AUTH_DISCORD_ID=...
export AUTH_DISCORD_SECRET=...
export DB_PASSWORD='change-me'
export DATA_DIR=/var/lib/cargo-data    # blobs + postgres + logs live under here

# Optional
export TRAEFIK_NETWORK=traefik         # external Docker network Traefik attaches to
export CARGO_MAX_FILE_SIZE=214748364800
export CARGO_USER_QUOTA=214748364800
export CARGO_LINK_TTL_SECONDS=3600

mkdir -p "$DATA_DIR"/{postgres,blobs,logs}
docker compose up -d --build
```

Discord OAuth Redirect URL: `https://${APP_HOST}/api/auth/callback/discord`.

### Without Traefik

The web service exposes port `3000` inside the Docker network. To run behind your own reverse proxy:

1. Open `docker-compose.yml`, remove the `labels:` block on the `web` service and the `traefik` external network.
2. Either publish `3000` on the host (`ports: ["3000:3000"]`) or join the web service to your proxy's network.
3. Configure your proxy to terminate TLS and forward to `web:3000`. Make sure to also set the `X-Robots-Tag: noindex, nofollow, noarchive` response header — Cargo is not meant to be indexed.

## Discord application setup

In the Discord Developer Portal, for each environment (dev / prod):

1. **OAuth2 → General** → add Redirect URL: `https://${APP_HOST}/api/auth/callback/discord`
2. **OAuth2 → URL generator** → scope: `identify` only. (We do not request `email`.)
3. Copy the **Client ID** to `AUTH_DISCORD_ID`.
4. Reset the client secret, copy it to `AUTH_DISCORD_SECRET`.

Cargo **never requests the `email` scope** — adding it would surface a field the schema deliberately doesn't keep.

## CI pipeline (optional)

A reference `.gitlab-ci.yml` is included for operators who want auto-deploy on push/tag. It is **not required** — the `docker compose up -d --build` workflow above is fully self-contained.

The reference pipeline expects these CI/CD variables (one set per environment, suffixed `_DEV` or `_PROD`):

| Variable                  | Purpose                                                              |
|---------------------------|----------------------------------------------------------------------|
| `CARGO_MASTER_KEY`        | base64-encoded 32 random bytes — `head -c 32 /dev/urandom \| base64` |
| `AUTH_SECRET`             | long random string for Auth.js JWT signing                           |
| `AUTH_DISCORD_ID`         | Discord application client id                                        |
| `AUTH_DISCORD_SECRET`     | Discord application client secret                                    |
| `DB_PASSWORD`             | Postgres password                                                    |

Path/host knobs live in `deploy/paths.env` — edit those to point at your own deploy directory and data mount before using the pipeline.

### Pipeline stages

1. **test** — Vitest unit + integration, ESLint, `tsc --noEmit`. Coverage ≥85% on changed files.
2. **build** — single image containing both the Next.js standalone server and the worker entrypoint.
3. **deploy_dev** — automatic on `develop`. Writes `app.env`, `docker compose up -d`.
4. **stop_dev** — manual `docker compose down`.
5. **deploy_prod** — automatic on tag `v*.*.*`.

## First-boot flow

1. Postgres comes up.
2. Web container runs Drizzle migrations in the entrypoint.
3. `next start` binds `:3000`.
4. Cleanup worker container starts in parallel; it idle-loops until the first tick.
5. The reverse proxy routes `Host(${APP_HOST})` → web container `:3000`.
6. First user hits `/` → Auth.js redirects to Discord → callback → user row upserted → land on Send.

There is no "first admin" gate — every successful Discord OAuth creates a Cargo user. Access control is whoever you share the URL with (search engines are blocked by `X-Robots-Tag`).

## Healthcheck

- Container: `wget -qO- http://127.0.0.1:3000/api/health`
- External: `GET https://${APP_HOST}/api/health` returns `200 OK`

`/api/health` returns `{ ok: true }`. It does **not** include any database health or worker status — that would be a free fingerprinting endpoint.

## Volumes

| Container path                | Host                        | Purpose                                |
|-------------------------------|-----------------------------|----------------------------------------|
| `/var/lib/cargo/blobs`        | `${DATA_DIR}/blobs`         | Encrypted file blobs (outside webroot) |
| `/var/lib/postgresql/data`    | `${DATA_DIR}/postgres`      | Postgres data                          |
| `/app/logs`                   | `${DATA_DIR}/logs`          | App logs                               |
