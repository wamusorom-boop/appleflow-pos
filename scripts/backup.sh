#!/bin/bash
# AppleFlow POS - Database Backup Script
# Usage: ./backup.sh [retention_days]

set -e

RETENTION_DAYS=${1:-30}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Source environment variables
if [ -f "$PROJECT_DIR/.env" ]; then
    set -a
    source "$PROJECT_DIR/.env"
    set +a
fi

# Configuration
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.sql"
S3_BUCKET="${BACKUP_S3_BUCKET:-}"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Create backup directory
mkdir -p "$BACKUP_DIR"

log_info "Starting backup..."
log_info "Retention: $RETENTION_DAYS days"

# Create backup
if command -v docker-compose &> /dev/null; then
    # Docker environment
    log_info "Creating backup using Docker..."
    docker-compose -f "$PROJECT_DIR/docker-compose.yml" exec -T postgres \
        pg_dump -U "${DB_USER:-appleflow}" -d "${DB_NAME:-appleflow}" > "$BACKUP_FILE"
else
    # Direct PostgreSQL
    log_info "Creating backup using pg_dump..."
    pg_dump "${DATABASE_URL}" > "$BACKUP_FILE"
fi

if [ $? -ne 0 ]; then
    log_error "Backup failed!"
    rm -f "$BACKUP_FILE"
    exit 1
fi

# Compress backup
gzip "$BACKUP_FILE"
BACKUP_FILE="${BACKUP_FILE}.gz"

log_info "Backup created: $BACKUP_FILE"
log_info "Size: $(du -h "$BACKUP_FILE" | cut -f1)"

# Upload to S3 if configured
if [ -n "$S3_BUCKET" ] && command -v aws &> /dev/null; then
    log_info "Uploading to S3..."
    aws s3 cp "$BACKUP_FILE" "s3://$S3_BUCKET/backups/"
    
    if [ $? -eq 0 ]; then
        log_info "Upload successful"
    else
        log_warn "S3 upload failed"
    fi
fi

# Clean up old backups
log_info "Cleaning up old backups..."
find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete

# Clean up old S3 backups if configured
if [ -n "$S3_BUCKET" ] && command -v aws &> /dev/null; then
    log_info "Cleaning up old S3 backups..."
    aws s3 ls "s3://$S3_BUCKET/backups/" | \
        awk '{print $4}' | \
        while read -r file; do
            # Extract date from filename (backup_YYYYMMDD_HHMMSS.sql.gz)
            file_date=$(echo "$file" | grep -oP '\d{8}' || true)
            if [ -n "$file_date" ]; then
                # Convert to epoch and compare
                file_epoch=$(date -d "$file_date" +%s 2>/dev/null || echo 0)
                cutoff_epoch=$(date -d "$RETENTION_DAYS days ago" +%s)
                
                if [ "$file_epoch" -lt "$cutoff_epoch" ]; then
                    log_info "Deleting old S3 backup: $file"
                    aws s3 rm "s3://$S3_BUCKET/backups/$file"
                fi
            fi
        done
fi

log_info "✅ Backup completed successfully"
