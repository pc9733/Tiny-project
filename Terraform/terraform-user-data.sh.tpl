#!/bin/bash
set -xe

cat <<'EOF' >/etc/profile.d/companies-env.sh
export TABLE_NAME="${table_name}"
export AWS_REGION="${aws_region}"
EOF

echo "TABLE_NAME=${table_name}" >> /etc/environment
echo "AWS_REGION=${aws_region}" >> /etc/environment

# Ensure directories exist for deployments
mkdir -p /var/www/mywebsite
mkdir -p /home/ec2-user/companies-api
chown -R ec2-user:ec2-user /home/ec2-user/companies-api

# Best-effort restart (safe if unit gets deployed later)
if systemctl list-unit-files | grep -q companies-api.service; then
  systemctl daemon-reload
  systemctl enable --now companies-api || systemctl restart companies-api || true
fi
