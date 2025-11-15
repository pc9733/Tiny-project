#!/usr/bin/env bash
set -euo pipefail

log() {
  echo "[codedeploy][restart] $*"
}

log "Reloading systemd and starting services"
systemctl daemon-reload
systemctl enable --now companies-api.service

if ! systemctl is-enabled nginx >/dev/null 2>&1; then
  systemctl enable nginx || true
fi
systemctl restart nginx || true
