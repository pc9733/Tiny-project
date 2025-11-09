#!/usr/bin/env bash
set -euo pipefail

log() {
  echo "[packer] $*"
}

PKG_MGR="yum"
if command -v dnf >/dev/null 2>&1; then
  PKG_MGR="dnf"
fi

log "Updating base system"
sudo ${PKG_MGR} -y update

log "Installing runtime dependencies"
sudo ${PKG_MGR} install -y nginx python3 python3-pip unzip rsync git

log "Preparing directories for frontend and backend"
sudo mkdir -p /var/www/mywebsite
sudo chown ec2-user:ec2-user /var/www/mywebsite

sudo mkdir -p /home/ec2-user/companies-api
sudo chown -R ec2-user:ec2-user /home/ec2-user/companies-api

log "Creating backend virtual environment"
sudo -u ec2-user python3 -m venv /home/ec2-user/companies-api/venv
sudo -u ec2-user /home/ec2-user/companies-api/venv/bin/pip install --upgrade pip

log "Disabling nginx auto-start (deployment pipeline decides when to enable)"
sudo systemctl disable nginx || true

log "Adding default environment helper"
sudo tee /etc/profile.d/companies-env.sh >/dev/null <<'ENV'
export TABLE_NAME=${TABLE_NAME:-companies}
export AWS_REGION=${AWS_REGION:-us-east-1}
ENV

log "Provisioning complete"
