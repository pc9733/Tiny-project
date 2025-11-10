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
sudo systemctl enable nginx

log "Adding New Relic Infrastructure agent repository"
sudo rpm --import https://download.newrelic.com/infrastructure_agent/gpg/newrelic-infra.gpg
sudo tee /etc/yum.repos.d/newrelic-infra.repo >/dev/null <<'REPO'
[newrelic-infra]
name=New Relic Infrastructure
baseurl=https://download.newrelic.com/infrastructure_agent/linux/yum/el/8/$basearch
gpgcheck=1
repo_gpgcheck=1
gpgkey=https://download.newrelic.com/infrastructure_agent/gpg/newrelic-infra.gpg
enabled=1
REPO

log "Installing New Relic Infrastructure agent"
sudo ${PKG_MGR} install -y newrelic-infra

log "Configuring New Relic agent for deployment-time license injection"
sudo mkdir -p /etc/systemd/system/newrelic-infra.service.d
sudo tee /etc/systemd/system/newrelic-infra.service.d/override.conf >/dev/null <<'OVERRIDE'
[Service]
EnvironmentFile=-/etc/newrelic-infra.env
OVERRIDE

sudo tee /etc/newrelic-infra.env >/dev/null <<'ENV'
# Populate NEW_RELIC_LICENSE_KEY before enabling the agent
# e.g. NEW_RELIC_LICENSE_KEY=nr-license-key-goes-here
ENV

sudo systemctl disable newrelic-infra || true

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
