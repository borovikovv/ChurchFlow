#!/usr/bin/env bash
set -euo pipefail
PID_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/apps/mobile/e2e/artifacts/api.pid"
if [[ -f "$PID_FILE" ]]; then
  kill "$(cat "$PID_FILE")" 2>/dev/null || true
  rm -f "$PID_FILE"
fi
