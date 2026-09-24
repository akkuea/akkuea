#!/usr/bin/env bash
set -euo pipefail

# Database Restore Script for Akkuea API
# Usage: ./scripts/restore-db.sh /path/to/backup.sql [--drop]
# WARNING: This will overwrite the current database. Use with extreme caution.

BACKUP_FILE="${1:?Usage: ./scripts/restore-db.sh <backup-file> [--drop]}"
DROP="${2:-}"
DB_URL="${DATABASE_URL:-${DB_URL}}"

if [ -z "$DB_URL" ]; then
  echo "ERROR: DATABASE_URL is not set." >&2
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: Backup file not found: ${BACKUP_FILE}" >&2
  exit 1
fi

DB_HOST=$(echo "$DB_URL" | sed -E 's|postgresql://[^@]*@([^:]+).*|\1|')
DB_PORT=$(echo "$DB_URL" | sed -E 's|.*:([0-9]+)/.*|\1|')
DB_NAME=$(echo "$DB_URL" | sed -E 's|.*/([^/?]+).*|\1|')
DB_USER=$(echo "$DB_URL" | sed -E 's|postgresql://([^:]+):.*|\1|')
DB_PASS=$(echo "$DB_URL" | sed -E 's|postgresql://[^:]+:([^@]+)@.*|\1|')

if [ "$DROP" = "--drop" ]; then
  echo "WARNING: --drop flag is set. The current database will be destroyed."
  read -rp "Are you sure? Type 'YES' to confirm: " CONFIRM
  if [ "$CONFIRM" != "YES" ]; then
    echo "Aborted."
    exit 0
  fi

  PGPASSWORD="$DB_PASS" dropdb \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --username="$DB_USER" \
    "$DB_NAME" 2>&1 || true

  PGPASSWORD="$DB_PASS" createdb \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --username="$DB_USER" \
    "$DB_NAME" 2>&1
fi

echo "Restoring database from ${BACKUP_FILE}..."

if [[ "$BACKUP_FILE" == *.gz ]]; then
  PGPASSWORD="$DB_PASS" pg_restore \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --username="$DB_USER" \
    --dbname="$DB_NAME" \
    --clean \
    --if-exists \
    --no-owner \
    < <(gunzip -c "$BACKUP_FILE") 2>&1
else
  PGPASSWORD="$DB_PASS" pg_restore \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --username="$DB_USER" \
    --dbname="$DB_NAME" \
    --clean \
    --if-exists \
    --no-owner \
    --file="$BACKUP_FILE" 2>&1
fi

if [ $? -eq 0 ]; then
  echo "Restore completed successfully."

  # Run any pending migrations after restore
  echo "Running migrations..."
  cd "$(dirname "$0")/.."
  cd apps/api && bun run db:migrate 2>&1 || true
else
  echo "ERROR: Restore failed" >&2
  exit 1
fi
