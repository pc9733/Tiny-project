#!/usr/bin/env bash
set -euo pipefail

log() {
  echo "[codedeploy][after_install] $*"
}

APP_DIR="/home/ec2-user/companies-api"
WEB_DIR="/var/www/mywebsite"
VENV_DIR="$APP_DIR/venv"

log "Setting ownership on deployed files"
chown -R ec2-user:ec2-user "$APP_DIR"
chown -R ec2-user:ec2-user "$WEB_DIR"

log "Ensuring Python virtual environment"
if [ ! -d "$VENV_DIR" ]; then
  sudo -u ec2-user python3 -m venv "$VENV_DIR"
fi

log "Installing backend dependencies"
sudo -u ec2-user "$VENV_DIR/bin/pip" install --upgrade pip
if [ -f "$APP_DIR/requirements.txt" ]; then
  sudo -u ec2-user "$VENV_DIR/bin/pip" install -r "$APP_DIR/requirements.txt"
fi

if [ -f "$APP_DIR/companies-api.service" ]; then
  log "Installing systemd unit file"
  cp "$APP_DIR/companies-api.service" /etc/systemd/system/companies-api.service
fi
