#!/usr/bin/env bash
set -euo pipefail

log() {
  echo "[codedeploy][validate] $*"
}

HEALTH_URL="http://127.0.0.1/health"

log "Checking application health at ${HEALTH_URL}"
RESPONSE="$(curl -fsS "$HEALTH_URL")" || {
  log "Request failed"
  exit 1
}

echo "$RESPONSE" | grep -q '"ok": true' || {
  log "Unexpected health payload: $RESPONSE"
  exit 1
}
