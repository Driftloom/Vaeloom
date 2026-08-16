#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${1:-/tmp/vaeloom-backups}"
DATABASE_URL="${DATABASE_URL:-postgresql://vaeloom:vaeloom_dev@localhost:5432/vaeloom}"

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="vaeloom_${TIMESTAMP}.sql.gz"
FILEPATH="${BACKUP_DIR}/${FILENAME}"

echo "Starting backup of $DATABASE_URL"
echo "Output: $FILEPATH"

pg_dump "$DATABASE_URL" | gzip > "$FILEPATH"

if [ ! -s "$FILEPATH" ]; then
    echo "ERROR: Backup file is empty or was not created" >&2
    rm -f "$FILEPATH"
    exit 1
fi

find "$BACKUP_DIR" -name "vaeloom_*.sql.gz" -mtime +30 -delete 2>/dev/null || true

SIZE=$(du -h "$FILEPATH" | cut -f1)
echo "Backup complete: $FILEPATH ($SIZE)"
