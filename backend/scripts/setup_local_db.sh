#!/usr/bin/env bash
set -euo pipefail

DB_NAME="${DB_NAME:-codex_fyp}"
PG_SERVICE="${PG_SERVICE:-postgresql@18}"
PGDATA="${PGDATA:-/opt/homebrew/var/postgresql@18}"
PG_BIN="${PG_BIN:-/opt/homebrew/opt/postgresql@18/bin}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ -d "$PG_BIN" ]; then
  export PATH="$PG_BIN:$PATH"
fi

if ! pg_isready >/dev/null 2>&1; then
  if [ -d "$PGDATA" ]; then
    pg_ctl -D "$PGDATA" -l postgres.log start >/dev/null || true
  elif command -v brew >/dev/null 2>&1; then
    brew services start "$PG_SERVICE" >/dev/null || true
  fi
fi

until pg_isready >/dev/null 2>&1; do
  sleep 1
done

createdb "$DB_NAME" 2>/dev/null || true
if ! psql "$DB_NAME" -Atc "select 1 from pg_available_extensions where name='postgis'" | grep -q 1; then
  echo "PostGIS is not installed locally. Run: brew install postgis" >&2
  exit 1
fi
psql "$DB_NAME" -c "CREATE EXTENSION IF NOT EXISTS postgis" >/dev/null
cd "$BACKEND_DIR"
alembic upgrade head
