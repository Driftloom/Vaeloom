#!/usr/bin/env bash
# Vaeloom — Production-Grade Database Backup
# =============================================
# Features:
#   - pg_dump with custom format (compressible, parallelizable restore)
#   - Integrity verification via pg_restore --list
#   - Off-site upload to S3/MinIO (optional)
#   - Retention pruning with configurable days
#   - Structured logging for observability
#   - Idempotent: safe to run multiple times
#
# Usage:
#   ./backup.sh                          # defaults
#   ./backup.sh /custom/backup/dir       # custom local dir
#   S3_BUCKET=my-bucket ./backup.sh      # also upload to S3
#
# Environment variables:
#   DATABASE_URL     - PostgreSQL connection URL (required)
#   BACKUP_DIR       - Local backup directory (default: /tmp/vaeloom-backups)
#   S3_BUCKET        - S3 bucket name for off-site upload (optional)
#   S3_PREFIX        - S3 key prefix (default: backups)
#   RETENTION_DAYS   - Days to keep backups (default: 30)
#   PG_BIN           - Path to pg_dump binary (default: pg_dump)

set -euo pipefail

# ─── Configuration ───
DATABASE_URL="${DATABASE_URL:?ERROR: DATABASE_URL must be set}"
BACKUP_DIR="${1:-${BACKUP_DIR:-/tmp/vaeloom-backups}}"
S3_BUCKET="${S3_BUCKET:-}"
S3_PREFIX="${S3_PREFIX:-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
PG_DUMP="${PG_BIN:-pg_dump}"
TIMESTAMP=$(date -u +%Y%m%d_%H%M%S)
FILENAME="vaeloom_${TIMESTAMP}.dump"
FILEPATH="${BACKUP_DIR}/${FILENAME}"
LOG_PREFIX="[backup ${TIMESTAMP}]"

# ─── Helpers ───
log()   { echo "${LOG_PREFIX} $*"; }
error() { echo "${LOG_PREFIX} ERROR: $*" >&2; }
die()   { error "$@"; exit 1; }

# ─── Pre-flight checks ───
command -v "$PG_DUMP" >/dev/null 2>&1 || die "pg_dump not found at '$PG_DUMP'"
command -v pg_restore >/dev/null 2>&1 || die "pg_restore not found (required for integrity check)"
mkdir -p "$BACKUP_DIR"

# ─── Step 1: Dump ───
log "Starting backup → $FILEPATH"
log "Database: ${DATABASE_URL%%@*}@***"

BACKUP_LOG="${FILEPATH}.log"

$PG_DUMP \
  --format=custom \
  --compress=6 \
  --no-owner \
  --no-privileges \
  --verbose \
  "$DATABASE_URL" \
  > "$FILEPATH" 2>"$BACKUP_LOG"

log "pg_dump diagnostics: $BACKUP_LOG"

if [ ! -s "$FILEPATH" ]; then
  rm -f "$FILEPATH"
  die "Backup file is empty — pg_dump may have failed silently"
fi

SIZE=$(du -h "$FILEPATH" | cut -f1)
log "Dump complete: $SIZE"

# ─── Step 2: Integrity verification ───
log "Verifying backup integrity..."
if pg_restore --list "$FILEPATH" >/dev/null 2>&1; then
  log "Integrity check PASSED"
else
  error "Integrity check FAILED — backup may be corrupt"
  # Don't delete — might be partially useful for debugging
  exit 1
fi

# ─── Step 3: Off-site upload (optional) ───
if [ -n "$S3_BUCKET" ]; then
  log "Uploading to s3://${S3_BUCKET}/${S3_PREFIX}/${FILENAME}"
  if command -v aws >/dev/null 2>&1; then
    aws s3 cp "$FILEPATH" "s3://${S3_BUCKET}/${S3_PREFIX}/${FILENAME}" \
      --storage-class STANDARD_IA \
      --quiet
    log "S3 upload complete"
  elif command -v mc >/dev/null 2>&1; then
    # MinIO client fallback
    mc cp "$FILEPATH" "myminio/${S3_BUCKET}/${S3_PREFIX}/${FILENAME}"
    log "MinIO upload complete"
  else
    error "Neither aws CLI nor mc (MinIO) found — skipping off-site upload"
  fi
fi

# ─── Step 4: Retention pruning ───
log "Pruning backups older than ${RETENTION_DAYS} days..."
PRUNED=$(find "$BACKUP_DIR" -name "vaeloom_*.dump" -mtime +"$RETENTION_DAYS" -delete -print 2>/dev/null | wc -l)
if [ "$PRUNED" -gt 0 ]; then
  log "Pruned $PRUNED old backup(s)"
fi

# ─── Done ───
log "Backup complete: $FILEPATH ($SIZE)"
