#!/usr/bin/env bash
set -euo pipefail

# Database Backup Script for Akkuea API
# Usage: ./scripts/backup-db.sh [--output /path/to/backup] [--compress]

BACKUP_DIR="${BACKUP_DIR:-/var/backups/akkuea}"
OUTPUT_DIR="${1:-$BACKUP_DIR}"
COMPRESS="${2:-true}"
TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")
DB_URL="${DATABASE_URL:-${DB_URL}}"

if [ -z "$DB_URL" ]; then
  echo "ERROR: DATABASE_URL is not set. Export it or set it in the environment." >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

OUTPUT_FILE="${OUTPUT_DIR}/akkuea-db-${TIMESTAMP}.sql"
if [ "$COMPRESS" = "true" ]; then
  OUTPUT_FILE="${OUTPUT_FILE}.gz"
fi

echo "Starting database backup to ${OUTPUT_FILE}..."

# Extract connection details from DATABASE_URL
# Format: postgresql://user:password@host:port/database
DB_HOST=$(echo "$DB_URL" | sed -E 's|postgresql://[^@]*@([^:]+).*|\1|')
DB_PORT=$(echo "$DB_URL" | sed -E 's|.*:([0-9]+)/.*|\1|')
DB_NAME=$(echo "$DB_URL" | sed -E 's|.*/([^/?]+).*|\1|')
DB_USER=$(echo "$DB_URL" | sed -E 's|postgresql://([^:]+):.*|\1|')
DB_PASS=$(echo "$DB_URL" | sed -E 's|postgresql://[^:]+:([^@]+)@.*|\1|')

if [ "$COMPRESS" = "true" ]; then
  PGPASSWORD="$DB_PASS" pg_dump \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --username="$DB_USER" \
    --dbname="$DB_NAME" \
    --format=custom \
    --file="${OUTPUT_FILE%.gz}" 2>&1 | gzip > "$OUTPUT_FILE"
else
  PGPASSWORD="$DB_PASS" pg_dump \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --username="$DB_USER" \
    --dbname="$DB_NAME" \
    --format=custom \
    --file="$OUTPUT_FILE" 2>&1
fi

if [ $? -eq 0 ]; then
  echo "Backup completed successfully: ${OUTPUT_FILE}"
  echo "Size: $(du -sh "$OUTPUT_FILE" | cut -f1)"
  echo "Checksum: $(sha256sum "$OUTPUT_FILE" | cut -d' ' -f1)"
else
  echo "ERROR: Backup failed" >&2
  exit 1
fi

# Clean up backups older than retention period
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
find "$OUTPUT_DIR" -name "akkuea-db-*.sql*" -mtime +"$RETENTION_DAYS" -delete 2>/dev/null || true
echo "Cleaned up backups older than ${RETENTION_DAYS} days"
