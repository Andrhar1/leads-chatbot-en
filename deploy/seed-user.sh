#!/usr/bin/env bash
# Create (or add) a dashboard login user inside the running backend container.
#   ./deploy/seed-user.sh <username> "<Full Name>" <password>
set -euo pipefail

if [[ $# -lt 3 ]]; then
  echo "Usage: $0 <username> \"<Full Name>\" <password>" >&2
  exit 1
fi

cd "$(dirname "$0")/.."
COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

# The backend already has DATABASE_URL etc. in its environment, so no --env-file
# is needed for the node process; seed-user.ts reads from process.env.
$COMPOSE exec -T backend node --import tsx scripts/seed-user.ts "$1" "$2" "$3"
