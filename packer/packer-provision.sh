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

log "Installing runtime dependencies (nginx, Python, Git, etc.)"
sudo ${PKG_MGR} install -y nginx python3 python3-pip unzip rsync git ruby

# ❌ Don't enable nginx here – deployment pipeline will control this
# sudo systemctl enable nginx

AWS_REGION_ENV="${AWS_REGION:-us-east-1}"

log "Installing AWS CodeDeploy agent"
TMP_INSTALL_DIR=$(mktemp -d)
pushd "$TMP_INSTALL_DIR" >/dev/null
curl -fsSL "https://aws-codedeploy-${AWS_REGION_ENV}.s3.${AWS_REGION_ENV}.amazonaws.com/latest/install" -o install
chmod +x install
sudo ./install auto
popd >/dev/null
rm -rf "$TMP_INSTALL_DIR"
sudo systemctl enable codedeploy-agent || true

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

log "Installing New Relic Infrastructure agent (no license key baked)"
sudo ${PKG_MGR} install -y newrelic-infra

log "Configuring New Relic agent to read env vars from /etc/newrelic-infra.env"
sudo mkdir -p /etc/systemd/system/newrelic-infra.service.d
sudo tee /etc/systemd/system/newrelic-infra.service.d/override.conf >/dev/null <<'OVERRIDE'
[Service]
EnvironmentFile=-/etc/newrelic-infra.env
OVERRIDE

# Stub env file – to be populated at runtime via user data / SSM
sudo tee /etc/newrelic-infra.env >/dev/null <<'ENV'
# Populate NEW_RELIC_LICENSE_KEY at runtime before enabling the agent, e.g.:
# NEW_RELIC_LICENSE_KEY=nr-license-key-goes-here
ENV

# Make sure agent is not auto-started on the AMI; runtime/user-data will decide
sudo systemctl daemon-reload
sudo systemctl disable newrelic-infra || true
sudo systemctl stop newrelic-infra || true

log "Preparing directories for frontend and backend"
sudo mkdir -p /var/www/mywebsite
sudo chown ec2-user:ec2-user /var/www/mywebsite

sudo mkdir -p /home/ec2-user/companies-api
sudo chown -R ec2-user:ec2-user /home/ec2-user/companies-api

log "Creating backend virtual environment"
sudo -u ec2-user python3 -m venv /home/ec2-user/companies-api/venv
sudo -u ec2-user /home/ec2-user/companies-api/venv/bin/pip install --upgrade pip

APP_SRC="/tmp/companies-app-src"
if [ ! -d "$APP_SRC" ]; then
  log "Application source directory not found at $APP_SRC"
  exit 1
fi

log "Copying frontend assets into nginx root"
sudo rsync -av \
  --exclude ".git" \
  --exclude ".github" \
  "$APP_SRC/index.html" \
  "$APP_SRC/location.html" \
  "$APP_SRC/assets" \
  /var/www/mywebsite/
sudo chown -R ec2-user:ec2-user /var/www/mywebsite

log "Copying backend application code"
sudo rsync -av \
  --exclude ".git" \
  --exclude ".github" \
  "$APP_SRC/backend/" \
  /home/ec2-user/companies-api/
sudo chown -R ec2-user:ec2-user /home/ec2-user/companies-api

log "Installing backend dependencies"
sudo -u ec2-user /home/ec2-user/companies-api/venv/bin/pip install -r /home/ec2-user/companies-api/requirements.txt

if [ -f /home/ec2-user/companies-api/companies-api.service ]; then
  log "Installing systemd unit for companies API"
  sudo cp /home/ec2-user/companies-api/companies-api.service /etc/systemd/system/companies-api.service
  sudo systemctl daemon-reload
  sudo systemctl enable companies-api || true
fi

VERSION_FILE="$APP_SRC/VERSION"
if [ -f "$VERSION_FILE" ]; then
  VERSION_VALUE="$(cat "$VERSION_FILE")"
  echo "$VERSION_VALUE" | sudo tee /var/www/mywebsite/VERSION >/dev/null
fi

log "Cleaning up uploaded application source"
sudo rm -rf "$APP_SRC"

log "Disabling nginx auto-start (deployment pipeline decides when to enable)"
sudo systemctl disable nginx || true
sudo systemctl stop nginx || true

log "Adding default environment helper"
sudo tee /etc/profile.d/companies-env.sh >/dev/null <<'ENV'
export TABLE_NAME=${TABLE_NAME:-companies}
export AWS_REGION=${AWS_REGION:-us-east-1}
ENV

log "Provisioning complete"
