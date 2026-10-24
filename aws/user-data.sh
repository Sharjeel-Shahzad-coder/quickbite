#!/bin/bash
# EC2 Launch Template user-data (Ubuntu 24.04). Runs once on first boot of every ASG instance.
set -euxo pipefail
REPO_URL="https://github.com/Sharjeel-Shahzad-coder/quickbite.git"

apt-get update -y
apt-get install -y docker.io docker-compose-v2 git
systemctl enable --now docker
usermod -aG docker ubuntu

git clone "$REPO_URL" /opt/quickbite
cd /opt/quickbite
cp .env.example .env
chmod 600 .env
docker compose up -d --build
