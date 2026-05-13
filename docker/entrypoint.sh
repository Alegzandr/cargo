#!/bin/sh
set -e

# Container starts as root so we can chown the bind-mounted blob/log dirs —
# their ownership reflects the host filesystem, not the image's prepared
# paths. After that we drop to `cargo` (uid 1001) for the actual workload.
if [ "$(id -u)" = "0" ]; then
  chown cargo:cargo /var/lib/cargo /var/lib/cargo/blobs /app/logs 2>/dev/null || true
  chown -R cargo:cargo /var/lib/cargo/blobs /app/logs 2>/dev/null || true
  exec su-exec cargo:cargo "$0" "$@"
fi

# Wait briefly for Postgres so migrations don't race the DB startup.
wait_for_db() {
  i=0
  while [ $i -lt 60 ]; do
    if node -e "const p=require('postgres');p(process.env.DATABASE_URL,{max:1})\`select 1\`.then(()=>process.exit(0)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
      return 0
    fi
    i=$((i+1))
    sleep 1
  done
  echo "{\"evt\":\"db.error\",\"ctx\":{\"code\":\"timeout\"}}" >&2
  exit 1
}

case "${1:-web}" in
  web)
    wait_for_db
    # Drizzle migrations
    node dist/lib/db/migrate.js || node dist/src/lib/db/migrate.js || true
    exec node server.js
    ;;
  worker)
    wait_for_db
    exec node dist/worker/cleanup.js || exec node dist/src/worker/cleanup.js
    ;;
  *)
    exec "$@"
    ;;
esac
