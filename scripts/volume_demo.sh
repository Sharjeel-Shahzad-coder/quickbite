#!/bin/bash
# Task 4 - prove the named volume keeps data after the containers are destroyed.
set -e
cd "$(dirname "$0")/.."
source .env
Q="SELECT COUNT(*) FROM orders;"
echo "Orders before:"; docker exec quickbite-db psql -U "$DB_USER" -d "$DB_NAME" -c "$Q"
docker volume ls | grep pgdata
docker compose down            # NOTE: no -v flag, volume is kept
docker compose up -d
echo "Waiting for database..."; sleep 15
echo "Orders after re-creation (must match):"; docker exec quickbite-db psql -U "$DB_USER" -d "$DB_NAME" -c "$Q"
docker volume inspect quickbite_pgdata | head -n 12
