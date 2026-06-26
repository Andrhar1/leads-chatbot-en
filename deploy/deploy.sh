#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Build & (re)deploy the production stack. Run from the project root ON THE VPS:
#   cd /home/ubuntu/apps/leads-chatbot-en && ./deploy/deploy.sh
# Idempotent: safe to re-run for updates (git pull && ./deploy/deploy.sh).
# ---------------------------------------------------------------------------
set -euo pipefail

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

cd "$(dirname "$0")/.."

if [[ ! -f .env.production ]]; then
  echo "ERROR: .env.production not found. Copy and fill it first:" >&2
  echo "  cp .env.production.example .env.production && nano .env.production" >&2
  exit 1
fi

echo "==> Building images (backend, frontend)..."
$COMPOSE build

echo "==> Starting/refreshing containers..."
$COMPOSE up -d

echo "==> Waiting for backend to become healthy..."
for i in $(seq 1 30); do
  status=$($COMPOSE ps --format '{{.Name}} {{.Health}}' 2>/dev/null | awk '/backend/ {print $2}')
  if [[ "$status" == "healthy" ]]; then
    echo "    backend is healthy."
    break
  fi
  if [[ "$i" == "30" ]]; then
    echo "WARNING: backend not healthy after ~5 min. Check: $COMPOSE logs backend" >&2
  fi
  sleep 10
done

echo "==> Current status:"
$COMPOSE ps

echo
echo "Done. Next steps if this is the first deploy:"
echo "  1) Create a login user:   ./deploy/seed-user.sh <username> \"<Full Name>\" <password>"
echo "  2) Link WhatsApp via the WAHA dashboard over an SSH tunnel (see deploy/README.md)."
