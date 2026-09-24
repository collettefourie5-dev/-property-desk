#!/usr/bin/env bash
# Deploys an explicit, existing Git TAG to the PRODUCTION Docker VM.
# Run this ON the PRODUCTION VM, inside a checkout of this repository.
#
# Usage: scripts/deploy-production.sh v1.2.0
#
# Refuses to run against a branch name or arbitrary commit — production only ever
# deploys a tagged release. Never runs a destructive database operation: only
# `prisma migrate deploy` is used, and the postgres_production_data volume is
# never touched. Rolling back is the same command with an older tag.
set -euo pipefail

TAG="${1:?Usage: scripts/deploy-production.sh <git-tag>  (e.g. v1.2.0)}"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

echo "==> Validating this is the production environment"
if [ ! -f .env.production ]; then
  echo "ERROR: .env.production not found. Copy .env.production.example, fill in real production values, and re-run." >&2
  exit 1
fi
if ! grep -qE '^APP_ENV=production\s*$' .env.production; then
  echo "ERROR: .env.production does not have APP_ENV=production. Refusing to run." >&2
  exit 1
fi

echo "==> Validating that tag '$TAG' exists"
git fetch --all --tags --quiet
if ! git rev-parse --verify --quiet "refs/tags/${TAG}" >/dev/null; then
  echo "ERROR: Git tag '$TAG' does not exist. Production only deploys tagged releases (e.g. v1.2.0)." >&2
  echo "Available tags:" >&2
  git tag --list | tail -20 >&2
  exit 1
fi
RESOLVED_COMMIT="$(git rev-parse "${TAG}^{commit}")"

echo
echo "=================================================================="
echo " PRODUCTION DEPLOYMENT CONFIRMATION"
echo "=================================================================="
echo " Tag:      $TAG"
echo " Commit:   $RESOLVED_COMMIT"
echo " Target:   $(hostname) ($REPO_DIR)"
echo " Database: postgres_production_data (preserved, not reset)"
echo "=================================================================="
read -r -p "Type the tag name ('$TAG') to confirm and proceed: " CONFIRM
if [ "$CONFIRM" != "$TAG" ]; then
  echo "Confirmation did not match. Aborting — nothing was deployed." >&2
  exit 1
fi

echo "==> Checking out $TAG ($RESOLVED_COMMIT)"
git checkout --quiet "refs/tags/${TAG}"

export GIT_COMMIT="$RESOLVED_COMMIT"
export GIT_TAG="$TAG"
export APP_VERSION="$(node -p "require('./package.json').version")"
export BUILD_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

echo "==> Building image and starting the stack (postgres_production_data volume is preserved)"
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

echo "==> Waiting for Postgres to report healthy"
for _ in $(seq 1 30); do
  status="$(docker compose -f docker-compose.prod.yml ps --format '{{.Health}}' postgres 2>/dev/null || true)"
  [ "$status" = "healthy" ] && break
  sleep 2
done

echo "==> Running database migrations (prisma migrate deploy — never destructive)"
docker compose -f docker-compose.prod.yml exec -T app npx prisma migrate deploy

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
  docker compose -f docker-compose.prod.yml logs --tail=100 app
  exit 1
fi

echo "==> Health check"
curl -fsS http://127.0.0.1:3000/api/health
echo

echo "==> Verifying deployed version matches the requested tag"
DEPLOYED_TAG="$(curl -fsS http://127.0.0.1:3000/api/version | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).tag))")"
if [ "$DEPLOYED_TAG" != "$TAG" ]; then
  echo "ERROR: Deployed version reports tag '$DEPLOYED_TAG', expected '$TAG'." >&2
  exit 1
fi

echo
echo "=================================================================="
echo " PRODUCTION DEPLOYMENT SUCCEEDED"
echo " Tag:      $TAG"
echo " Commit:   $RESOLVED_COMMIT"
echo " Deployed: $BUILD_TIME"
echo "=================================================================="
