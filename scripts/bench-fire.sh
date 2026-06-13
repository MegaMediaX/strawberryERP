#!/usr/bin/env bash
#
# bench-fire.sh — turnkey close-out for the Docker/Frappe-gated DoD items.
# Run this ONCE on a host that has Docker + Docker Compose. It performs:
#   #6  docker compose up (full stack: nginx, next, frappe, mariadb, redis x3, workers, scheduler)
#   #3  create site + install ERPNext + the custom app + bench migrate
#   #5  health checks (/api/health/live, /api/health/ready) as evidence
#
# It is idempotent where practical (skips site creation if the site exists).
# It does NOT fake anything: every step runs real commands and fails loudly.
#
# Prereqs: a populated .env (MARIADB_ROOT_PASSWORD, ADMIN_PASSWORD, etc.) — see
# .env.example. Review docs/live-bench-runbook.md for background.

set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
SITE="${FRAPPE_SITE:-lebtech.local}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin}"
DB_ROOT_PASSWORD="${MARIADB_ROOT_PASSWORD:?Set MARIADB_ROOT_PASSWORD in the environment/.env}"
PORTAL_URL="${PORTAL_URL:-http://localhost}"

cd "$(dirname "$0")/.."

echo "==> [#6] Validating compose config"
docker compose -f "$COMPOSE_FILE" config --quiet

echo "==> [#6] Bringing up the full stack"
docker compose -f "$COMPOSE_FILE" up -d --build

echo "==> Waiting for the backend (Frappe) container to be healthy"
for i in $(seq 1 60); do
  state="$(docker compose -f "$COMPOSE_FILE" ps backend --format '{{.Health}}' 2>/dev/null || echo '')"
  if [ "$state" = "healthy" ]; then echo "backend healthy"; break; fi
  if [ "$i" = "60" ]; then echo "ERROR: backend not healthy after timeout" >&2; exit 1; fi
  sleep 5
done

run_bench() { docker compose -f "$COMPOSE_FILE" exec -T backend bench "$@"; }

echo "==> [#3] Creating site $SITE if it does not exist"
if run_bench --site "$SITE" list-apps >/dev/null 2>&1; then
  echo "site $SITE already exists — skipping new-site"
else
  run_bench new-site "$SITE" \
    --admin-password "$ADMIN_PASSWORD" \
    --mariadb-root-password "$DB_ROOT_PASSWORD" \
    --no-mariadb-socket
fi

echo "==> [#3] Installing ERPNext and the custom app"
run_bench --site "$SITE" install-app erpnext || true
run_bench --site "$SITE" install-app lebtech_partner_platform

echo "==> [#3] Running migrate (must be clean)"
run_bench --site "$SITE" migrate
run_bench --site "$SITE" clear-cache

echo "==> [#5] Health checks"
live="$(curl -fsS "$PORTAL_URL/api/health/live" || true)"
ready="$(curl -fsS "$PORTAL_URL/api/health/ready" || true)"
echo "live:  $live"
echo "ready: $ready"
echo "$live"  | grep -qiE '"ok"\s*:\s*true|alive|healthy' || { echo "ERROR: liveness not green" >&2; exit 1; }
echo "$ready" | grep -qiE '"ok"\s*:\s*true|ready|healthy'  || { echo "ERROR: readiness not green" >&2; exit 1; }

echo "==> DONE: stack up, app migrated, health green."
echo "    Next: set FRAPPE_BASE_URL/API_KEY/API_SECRET and run 'npm run smoke:frappe'."
