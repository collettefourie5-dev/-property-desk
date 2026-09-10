#!/usr/bin/env bash
# Deploys a given Git revision to the TEST Docker VM.
# Run this ON the TEST VM (or via `ssh test-vm 'cd /path/to/property-desk && ./scripts/deploy-test.sh <rev>'`),
# inside a checkout of this repository.
#
# Usage: scripts/deploy-test.sh <branch|tag|commit>
#
# Safe by construction: only ever runs `prisma migrate deploy` (never reset/push/seed),
# never touches the postgres_test_data volume, and refuses to run against a
# .env.test file that looks like production.
set -euo pipefail

REVISION="${1:?Usage: scripts/deploy-test.sh <branch|tag|commit>}"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

echo "==> Validating environment"
if [ ! -f .env.test ]; then
  echo "ERROR: .env.test not found. Copy .env.test.example to .env.test and fill in real values first." >&2
  exit 1
fi
if grep -qE '^APP_ENV=production\s*$' .env.test; then
  echo "ERROR: .env.test has APP_ENV=production. Refusing to run — this script is TEST-only." >&2
  exit 1
fi

echo "==> Fetching and validating revision: $REVISION"
git fetch --all --tags --quiet
if ! git rev-parse --verify --quiet "${REVISION}^{commit}" >/dev/null; then
  echo "ERROR: '$REVISION' is not a known branch, tag, or commit in this repository." >&2
  exit 1
fi
RESOLVED_COMMIT="$(git rev-parse "$REVISION")"

echo "==> Checking out $REVISION ($RESOLVED_COMMIT)"
git checkout --quiet "$REVISION"
git merge --ff-only --quiet "$RESOLVED_COMMIT" 2>/dev/null || git reset --hard --quiet "$RESOLVED_COMMIT"

export GIT_COMMIT="$RESOLVED_COMMIT"
export GIT_TAG="$(git describe --tags --exact-match "$RESOLVED_COMMIT" 2>/dev/null || echo "$REVISION")"
export APP_VERSION="$(node -p "require('./package.json').version")"
export BUILD_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

echo "==> Building image and starting the stack (postgres_test_data volume is preserved)"
docker compose -f docker-compose.test.yml --env-file .env.test up -d --build

echo "==> Waiting for Postgres to report healthy"
for _ in $(seq 1 30); do
  status="$(docker compose -f docker-compose.test.yml ps --format '{{.Health}}' postgres 2>/dev/null || true)"
  [ "$status" = "healthy" ] && break
  sleep 2
done

echo "==> Running database migrations (prisma migrate deploy — never destructive)"
docker compose -f docker-compose.test.yml exec -T app npx prisma migrate deploy

echo "==> Waiting for application readiness"
READY=0
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3000/api/health/ready >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 2
done
if [ "$READY" -ne 1 ]; then
  echo "ERROR: Application did not become ready in time." >&2
  docker compose -f docker-compose.test.yml logs --tail=100 app
  exit 1
fi

echo "==> Health check"
curl -fsS http://127.0.0.1:3000/api/health
echo
echo "==> Deployed version"
curl -fsS http://127.0.0.1:3000/api/version
echo
echo "TEST deployment complete: $REVISION ($RESOLVED_COMMIT)"
