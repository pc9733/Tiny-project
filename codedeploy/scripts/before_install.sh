#!/usr/bin/env bash
set -euo pipefail

log() {
  echo "[codedeploy][before_install] $*"
}

log "Stopping services if running"
systemctl stop companies-api.service || true
systemctl stop nginx || true

log "Ensuring target directories exist"
mkdir -p /var/www/mywebsite
mkdir -p /home/ec2-user/companies-api

log "Cleaning previous release artifacts"
rm -rf /var/www/mywebsite/*
rm -rf /home/ec2-user/companies-api/*

chown -R ec2-user:ec2-user /var/www/mywebsite
chown -R ec2-user:ec2-user /home/ec2-user/companies-api
