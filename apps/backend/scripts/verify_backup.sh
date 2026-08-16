#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
    echo "Usage: $0 <backup_file.sql.gz>" >&2
    exit 1
fi

BACKUP_FILE="$1"
DATABASE_URL="${DATABASE_URL:-postgresql://vaeloom:vaeloom_dev@localhost:5432/vaeloom}"
TEMP_DB="vaeloom_verify_$$"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "ERROR: File not found: $BACKUP_FILE" >&2
    exit 1
fi

cleanup() {
    echo "Dropping temporary database $TEMP_DB..."
    psql "$DATABASE_URL" -c "DROP DATABASE IF EXISTS $TEMP_DB;" -q 2>/dev/null || true
}
trap cleanup EXIT

echo "Creating temporary database $TEMP_DB..."
psql "$DATABASE_URL" -c "CREATE DATABASE $TEMP_DB;" -q

# Extract host, port, dbname from DATABASE_URL for the temp DB
TEMP_DB_URL=$(echo "$DATABASE_URL" | sed "s|/[^/]*$|/$TEMP_DB|")

echo "Restoring backup into $TEMP_DB..."
gunzip -c "$BACKUP_FILE" | psql "$TEMP_DB_URL" -q

echo ""
echo "Verifying critical tables..."
echo "================================"

FAILED=0

for TABLE in users workspaces memories documents agents; do
    COUNT=$(psql "$TEMP_DB_URL" -t -A -c "SELECT COUNT(*) FROM $TABLE;" 2>/dev/null || echo "0")
    if [ "$COUNT" -gt 0 ] 2>/dev/null; then
        echo "PASS  $TABLE ($COUNT rows)"
    else
        echo "FAIL  $TABLE (missing or empty)"
        FAILED=1
    fi
done

echo "================================"

if [ "$FAILED" -eq 1 ]; then
    echo "Verification FAILED"
    exit 1
fi

echo "Verification PASSED"
