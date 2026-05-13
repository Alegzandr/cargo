# syntax=docker/dockerfile:1.7

# ---- deps ----------------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

# ---- build ---------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app
# Placeholder env values consumed only during `next build` page-data
# collection, which evaluates route modules (db client, master key…). Real
# validation still fires at container start via the entrypoint with the
# real env. None of these placeholders ship in the runtime image.
ENV NEXT_TELEMETRY_DISABLED=1 \
    DATABASE_URL=postgres://build:build@localhost:5432/build \
    AUTH_SECRET=build-time-placeholder-secret-do-not-use \
    AUTH_DISCORD_ID=build \
    AUTH_DISCORD_SECRET=build \
    CARGO_MASTER_KEY=AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build the Next.js standalone server.
RUN npm run build
# Compile the worker entrypoint (and migrate script) to plain JS for prod.
# tsconfig.worker.json emits ESM matching package.json `type: module`.
RUN npx tsc -p tsconfig.worker.json

# ---- runtime -------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
# Pin the UID/GID so the host-side bind mounts can be chowned to a stable
# numeric owner (1001:1001) regardless of which alpine system UID adduser -S
# would have picked. su-exec is the privilege-dropper used by the entrypoint.
RUN apk add --no-cache su-exec \
    && addgroup -g 1001 -S cargo \
    && adduser -u 1001 -S cargo -G cargo \
    && mkdir -p /var/lib/cargo/blobs /app/logs \
    && chown -R cargo:cargo /var/lib/cargo /app/logs

# Next.js standalone server + static assets + public/.
COPY --from=build --chown=cargo:cargo /app/.next/standalone ./
COPY --from=build --chown=cargo:cargo /app/.next/static ./.next/static
COPY --from=build --chown=cargo:cargo /app/public ./public

# Drizzle migrations + the compiled worker + a copy of node_modules for the worker
COPY --from=build --chown=cargo:cargo /app/drizzle ./drizzle
COPY --from=build --chown=cargo:cargo /app/dist ./dist
COPY --from=deps  --chown=cargo:cargo /app/node_modules ./node_modules
COPY --chown=cargo:cargo docker/entrypoint.sh /usr/local/bin/cargo-entrypoint
RUN chmod +x /usr/local/bin/cargo-entrypoint

# Entrypoint runs as root so it can chown the bind-mounted blob/log dirs
# (their ownership comes from the host, not from this image's prepared paths).
# After chowning, it drops to `cargo` via su-exec before exec'ing the app.
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
HEALTHCHECK --interval=30s --timeout=5s --retries=5 CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null 2>&1 || exit 1

ENTRYPOINT ["cargo-entrypoint"]
CMD ["web"]
