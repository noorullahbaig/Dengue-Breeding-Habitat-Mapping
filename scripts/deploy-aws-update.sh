#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "scripts/deploy-aws-update.sh is deprecated."
echo "Forwarding to scripts/deploy-production.sh."

exec "$ROOT_DIR/scripts/deploy-production.sh" "$@"
