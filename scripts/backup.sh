#!/bin/bash
# Dump the PostgreSQL database from the running container. Schedule with cron:
#   0 2 * * * /opt/quickbite/scripts/backup.sh
set -e
cd "$(dirname "$0")/.."
source .env
mkdir -p backups
FILE="backups/quickbite_$(date +%F_%H%M).sql"
docker exec quickbite-db pg_dump -U "$DB_USER" "$DB_NAME" > "$FILE"
chmod 640 "$FILE"
echo "Backup written to $FILE"
