#!/bin/bash
# Task 2 - Linux administration demo: directories, users, permissions.
set -e
APP_DIR=/opt/quickbite

sudo groupadd -f quickbite
id deploy &>/dev/null || sudo useradd -m -g quickbite -s /bin/bash deploy

sudo mkdir -p $APP_DIR/logs $APP_DIR/backups $APP_DIR/config
sudo chown -R deploy:quickbite $APP_DIR
sudo chmod 750 $APP_DIR                 # owner rwx, group r-x, others none
sudo chmod 770 $APP_DIR/backups         # group can write backups
[ -f $APP_DIR/.env ] && sudo chmod 600 $APP_DIR/.env   # secrets: owner only

echo "--- directory listing ---"; ls -ld $APP_DIR $APP_DIR/*
echo "--- system info ---"; uname -a; df -h /; free -m; uptime
echo "--- docker service ---"; systemctl is-active docker
