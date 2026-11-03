#!/usr/bin/env bash
# Starts the API the mobile e2e tests talk to, against a local Postgres and Mailpit.
#
#   Mac:  docker compose up -d postgres mailpit && pnpm e2e:api
#   CI:   Postgres and Mailpit come from Homebrew (macOS runners have no Docker).
#
# Applies migrations, seeds the e2e organization, builds the API and runs it in the
# background on :4000. Stop it with `pnpm e2e:api:stop`.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STATE_DIR="$ROOT/apps/mobile/e2e/artifacts"
mkdir -p "$STATE_DIR"
cd "$ROOT"

set -a
# shellcheck source=/dev/null
source "$ROOT/scripts/mobile-e2e/api.env"
set +a

echo "› Applying migrations"
pnpm --filter @churchflow/db db:migrate:deploy

echo "› Seeding e2e data"
node apps/api/scripts/e2e-seed.mjs

echo "› Building the API"
pnpm --filter "@churchflow/api..." build

if [[ -f "$STATE_DIR/api.pid" ]] && kill -0 "$(cat "$STATE_DIR/api.pid")" 2>/dev/null; then
  kill "$(cat "$STATE_DIR/api.pid")" || true
  sleep 1
fi

echo "› Starting the API on :$PORT (log: apps/mobile/e2e/artifacts/api.log)"
nohup node apps/api/dist/main.js >"$STATE_DIR/api.log" 2>&1 &
echo $! >"$STATE_DIR/api.pid"

for _ in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:$PORT/v1/health" >/dev/null 2>&1; then
    echo "› API is up"
    exit 0
  fi
  sleep 1
done

echo "API did not become healthy in 60s; last log lines:" >&2
tail -n 50 "$STATE_DIR/api.log" >&2
exit 1
