#!/usr/bin/env bash
set -euo pipefail

# Database Backup Script for Akkuea API
# Usage: ./scripts/backup-db.sh [output-dir]
# Writes a pg_dump custom-format archive (already compressed internally).
# Restore with ./scripts/restore-db.sh.

BACKUP_DIR="${BACKUP_DIR:-/var/backups/akkuea}"
OUTPUT_DIR="${1:-$BACKUP_DIR}"
TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")
DB_URL="${DATABASE_URL:-${DB_URL:-}}"

if [ -z "$DB_URL" ]; then
  echo "ERROR: DATABASE_URL is not set. Export it or set it in the environment." >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"
OUTPUT_FILE="${OUTPUT_DIR}/akkuea-db-${TIMESTAMP}.dump"

echo "Starting database backup to ${OUTPUT_FILE}..."
pg_dump --format=custom --file="$OUTPUT_FILE" "$DB_URL"

# Fail loudly if the archive is not readable.
pg_restore --list "$OUTPUT_FILE" > /dev/null

echo "Backup completed successfully: ${OUTPUT_FILE}"
echo "Size: $(du -sh "$OUTPUT_FILE" | cut -f1)"
echo "Checksum: $(sha256sum "$OUTPUT_FILE" | cut -d' ' -f1)"

# Clean up backups older than the retention period (matches legacy .sql* names too)
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
find "$OUTPUT_DIR" -name "akkuea-db-*" -mtime +"$RETENTION_DAYS" -delete 2>/dev/null || true
echo "Cleaned up backups older than ${RETENTION_DAYS} days"
