#!/usr/bin/env bash
set -euo pipefail

# Database Restore Script for Akkuea API
# Usage: ./scripts/restore-db.sh /path/to/backup.dump [--drop]
# Accepts pg_dump custom-format archives (optionally gzipped, for legacy backups).
# WARNING: This will overwrite the current database. Use with extreme caution.

BACKUP_FILE="${1:?Usage: ./scripts/restore-db.sh <backup-file> [--drop]}"
DROP="${2:-}"
DB_URL="${DATABASE_URL:-${DB_URL:-}}"

if [ -z "$DB_URL" ]; then
  echo "ERROR: DATABASE_URL is not set." >&2
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: Backup file not found: ${BACKUP_FILE}" >&2
  exit 1
fi

if [ "$DROP" = "--drop" ]; then
  BASE_URL="${DB_URL%%\?*}"
  QUERY=""
  if [[ "$DB_URL" == *\?* ]]; then QUERY="?${DB_URL#*\?}"; fi
  DB_NAME="${BASE_URL##*/}"
  ADMIN_URL="${BASE_URL%/*}/postgres${QUERY}"

  echo "WARNING: --drop flag is set. Database '${DB_NAME}' will be destroyed and recreated."
  read -rp "Are you sure? Type 'YES' to confirm: " CONFIRM
  if [ "$CONFIRM" != "YES" ]; then
    echo "Aborted."
    exit 0
  fi

  psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"${DB_NAME}\" WITH (FORCE)"
  psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"${DB_NAME}\""
fi

echo "Restoring database from ${BACKUP_FILE}..."
if [[ "$BACKUP_FILE" == *.gz ]]; then
  gunzip -c "$BACKUP_FILE" | pg_restore --dbname="$DB_URL" --clean --if-exists --no-owner --exit-on-error
else
  pg_restore --dbname="$DB_URL" --clean --if-exists --no-owner --exit-on-error "$BACKUP_FILE"
fi
echo "Restore completed successfully."

# Migrations must succeed; a failure here is a failed restore.
echo "Running migrations..."
(cd "$(dirname "$0")/../apps/api" && bun run db:migrate)
echo "Migrations complete."
