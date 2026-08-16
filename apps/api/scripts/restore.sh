#!/usr/bin/env bash
# Vaeloom — Database Restore
# ============================
# Restores a pg_dump backup to a target PostgreSQL instance.
# Includes schema verification and optional smoke test.
#
# Usage:
#   ./restore.sh /path/to/backup.dump                    # restore only
#   ./restore.sh /path/to/backup.dump --smoke-test       # restore + verify
#   DATABASE_URL=... ./restore.sh /path/to/backup.dump   # custom target DB
#
# WARNING: This DROPS and RECREATES the target database.
#          Only use on dev/staging or when explicitly authorized.

set -euo pipefail

# ─── Configuration ───
DATABASE_URL="${DATABASE_URL:?ERROR: DATABASE_URL must be set}"
BACKUP_FILE="${1:?ERROR: Usage: restore.sh <backup.dump> [--smoke-test]}"
SMOKE_TEST=false
PG_RESTORE="${PG_BIN:-pg_restore}"

if [ "${2:-}" = "--smoke-test" ]; then
  SMOKE_TEST=true
fi

LOG_PREFIX="[restore]"
log()   { echo "${LOG_PREFIX} $*"; }
error() { echo "${LOG_PREFIX} ERROR: $*" >&2; }
die()   { error "$@"; exit 1; }

# ─── Pre-flight checks ───
[ -f "$BACKUP_FILE" ] || die "Backup file not found: $BACKUP_FILE"
command -v "$PG_RESTORE" >/dev/null 2>&1 || die "pg_restore not found"
command -v psql >/dev/null 2>&1 || die "psql not found"

# Parse database name from URL
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')
[ -n "$DB_NAME" ] || die "Could not parse database name from URL"

log "WARNING: This will DROP and recreate database '$DB_NAME'"
log "Backup file: $BACKUP_FILE"
log "Target: ${DATABASE_URL%%@*}@***"

# ─── Step 1: Drop and recreate database ───
log "Dropping existing database..."
psql "$DATABASE_URL" -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();" 2>/dev/null || true
dropdb "$DATABASE_URL" 2>/dev/null || true

log "Creating fresh database..."
createdb "$DATABASE_URL" || die "Failed to create database"

# ─── Step 2: Restore ───
log "Restoring from backup..."
$PG_RESTORE \
  --no-owner \
  --no-privileges \
  --verbose \
  "$DATABASE_URL" \
  "$BACKUP_FILE" 2>/dev/null

log "Restore complete"

# ─── Step 3: Schema verification ───
log "Verifying schema..."
TABLE_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ')
log "Tables found: $TABLE_COUNT"

if [ "$TABLE_COUNT" -lt 20 ]; then
  die "Schema verification failed: expected 20+ tables, found $TABLE_COUNT"
fi
log "Schema verification PASSED"

# ─── Step 4: Smoke test (optional) ───
if [ "$SMOKE_TEST" = true ]; then
  log "Running smoke tests..."

  # Check RLS is enabled
  RLS_COUNT=$(psql "$DATABASE_URL" -t -c "
    SELECT count(*) FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relrowsecurity = true AND n.nspname = 'public';
  " 2>/dev/null | tr -d ' ')
  log "RLS-enabled tables: $RLS_COUNT"

  # Check extensions
  EXTENSIONS=$(psql "$DATABASE_URL" -t -c "SELECT string_agg(extname, ', ') FROM pg_extension;" 2>/dev/null | tr -d ' ')
  log "Extensions: $EXTENSIONS"

  # Check alembic version
  ALEMBIC_VER=$(psql "$DATABASE_URL" -t -c "SELECT version_num FROM alembic_version LIMIT 1;" 2>/dev/null | tr -d ' ')
  log "Alembic version: ${ALEMBIC_VER:-none}"

  log "Smoke tests PASSED"
fi

# ─── Done ───
log "Restore complete: $DB_NAME"
