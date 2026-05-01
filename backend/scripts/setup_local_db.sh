#!/usr/bin/env bash
set -euo pipefail

DB_NAME="${DB_NAME:-codex_fyp}"
PG_SERVICE="${PG_SERVICE:-postgresql@14}"
PGDATA="${PGDATA:-/opt/homebrew/var/postgresql@14}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

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
cd "$BACKEND_DIR"
alembic upgrade head
