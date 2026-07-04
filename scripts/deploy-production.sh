#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.prod.yml"
ENV_FILE="$ROOT_DIR/.env.production"
EXAMPLE_ENV_FILE="$ROOT_DIR/.env.production.example"
STATE_DIR="$ROOT_DIR/.deploy"
LOCK_DIR="$STATE_DIR/deploy.lock"
CURRENT_RELEASE_FILE="$STATE_DIR/current-release.env"
PREVIOUS_RELEASE_FILE="$STATE_DIR/previous-release.env"
SSM_PARAMETER_NAME="${DEPLOY_PARAMETER_NAME:-/denguewatch/production/env}"
HEALTHCHECK_URL="${DEPLOY_HEALTHCHECK_URL:-http://localhost/health}"
BACKEND_HEALTHCHECK_URL="${DEPLOY_BACKEND_HEALTHCHECK_URL:-http://localhost/api/health}"
SKIP_PULL=0

usage() {
  cat <<'EOF'
Usage: ./scripts/deploy-production.sh [--skip-pull]

Behavior:
  - Verifies the EC2 worktree is clean
  - Pulls the latest code with --ff-only
  - Fetches production env from AWS SSM Parameter Store
  - Validates and atomically installs .env.production
  - Validates docker compose configuration with --env-file
  - Builds versioned images using the current git SHA
  - Runs alembic migrations in a one-off backend container
  - Rolls the stack forward with docker compose up -d --remove-orphans
  - Waits for nginx and backend health endpoints

Environment:
  DEPLOY_PARAMETER_NAME         Override the default SSM parameter path
  DEPLOY_HEALTHCHECK_URL        Override the nginx health endpoint
  DEPLOY_BACKEND_HEALTHCHECK_URL Override the backend health endpoint
EOF
}

while (($# > 0)); do
  case "$1" in
    --skip-pull)
      SKIP_PULL=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

mkdir -p "$STATE_DIR"

cleanup() {
  rm -rf "$LOCK_DIR"
  rm -f "${TMP_ENV_FILE:-}" "${TMP_PREVIOUS_RELEASE_FILE:-}" "${TMP_CURRENT_RELEASE_FILE:-}"
}
trap cleanup EXIT

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "Another deployment appears to be running. Lock path: $LOCK_DIR" >&2
  exit 1
fi

cd "$ROOT_DIR"

for required_file in "$COMPOSE_FILE" "$EXAMPLE_ENV_FILE" "$ROOT_DIR/backend/app/production_env.py"; do
  if [[ ! -f "$required_file" ]]; then
    echo "Required file is missing: $required_file" >&2
    exit 1
  fi
done

if ! command -v git >/dev/null 2>&1; then
  echo "git is required on the deployment host" >&2
  exit 1
fi

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI is required on the deployment host" >&2
  exit 1
fi

if command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python3"
elif command -v python >/dev/null 2>&1; then
  PYTHON_BIN="python"
else
  echo "Python is required on the deployment host" >&2
  exit 1
fi

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  compose() {
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
  }
elif command -v docker-compose >/dev/null 2>&1; then
  compose() {
    docker-compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
  }
else
  echo "Docker Compose is required on the deployment host" >&2
  exit 1
fi

http_probe() {
  local url="$1"
  if command -v curl >/dev/null 2>&1; then
    curl --fail --silent --show-error "$url" >/dev/null
    return
  fi

  if command -v wget >/dev/null 2>&1; then
    wget --quiet --tries=1 --spider "$url"
    return
  fi

  "$PYTHON_BIN" - "$url" <<'PY'
import sys
import urllib.request

urllib.request.urlopen(sys.argv[1], timeout=5).read()
PY
}

if ! git diff --quiet --ignore-submodules -- || ! git diff --cached --quiet --ignore-submodules --; then
  echo "Refusing to deploy from a dirty tracked worktree on the server." >&2
  echo "Commit, stash, or discard tracked changes on EC2 before deploying." >&2
  exit 1
fi

CURRENT_BRANCH="$(git branch --show-current)"
if [[ -z "$CURRENT_BRANCH" ]]; then
  echo "Deployments require a checked-out branch, not detached HEAD." >&2
  exit 1
fi

if (( SKIP_PULL == 0 )); then
  git fetch origin "$CURRENT_BRANCH"
  git pull --ff-only origin "$CURRENT_BRANCH"
fi

APP_VERSION="$(git rev-parse --short=12 HEAD)"
TMP_ENV_FILE="$(mktemp "$STATE_DIR/.env.production.tmp.XXXXXX")"

echo "Fetching production configuration from SSM parameter: $SSM_PARAMETER_NAME"
aws ssm get-parameter \
  --name "$SSM_PARAMETER_NAME" \
  --with-decryption \
  --query 'Parameter.Value' \
  --output text >"$TMP_ENV_FILE"

PYTHONPATH="$ROOT_DIR/backend" "$PYTHON_BIN" -m app.production_env "$TMP_ENV_FILE"

install -m 600 "$TMP_ENV_FILE" "$ENV_FILE"

APP_VERSION="$APP_VERSION" compose config --quiet
APP_VERSION="$APP_VERSION" compose build
APP_VERSION="$APP_VERSION" compose up -d --remove-orphans

attempt=0
until http_probe "$HEALTHCHECK_URL" && http_probe "$BACKEND_HEALTHCHECK_URL"; do
  attempt=$((attempt + 1))
  if (( attempt >= 24 )); then
    echo "Health checks did not pass after 120 seconds." >&2
    APP_VERSION="$APP_VERSION" compose ps >&2 || true
    APP_VERSION="$APP_VERSION" compose logs --tail=80 >&2 || true
    exit 1
  fi
  sleep 5
done

if [[ -f "$CURRENT_RELEASE_FILE" ]]; then
  TMP_PREVIOUS_RELEASE_FILE="$(mktemp "$STATE_DIR/.previous-release.tmp.XXXXXX")"
  cp "$CURRENT_RELEASE_FILE" "$TMP_PREVIOUS_RELEASE_FILE"
  install -m 600 "$TMP_PREVIOUS_RELEASE_FILE" "$PREVIOUS_RELEASE_FILE"
fi

TMP_CURRENT_RELEASE_FILE="$(mktemp "$STATE_DIR/.current-release.tmp.XXXXXX")"
cat >"$TMP_CURRENT_RELEASE_FILE" <<EOF
APP_VERSION=$APP_VERSION
DEPLOYED_AT_UTC=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
DEPLOYED_BRANCH=$CURRENT_BRANCH
DEPLOY_PARAMETER_NAME=$SSM_PARAMETER_NAME
EOF
install -m 600 "$TMP_CURRENT_RELEASE_FILE" "$CURRENT_RELEASE_FILE"

echo "Deployment succeeded."
echo "Branch: $CURRENT_BRANCH"
echo "Version: $APP_VERSION"
echo "Config source: SSM SecureString $SSM_PARAMETER_NAME"
echo "Health endpoints: $HEALTHCHECK_URL and $BACKEND_HEALTHCHECK_URL"
