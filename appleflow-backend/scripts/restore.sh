#!/bin/bash
# AppleFlow POS - Database Restore Script
# Usage: ./restore.sh <backup_file>

set -e

BACKUP_FILE="$1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

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

# Validate input
if [ -z "$BACKUP_FILE" ]; then
    log_error "Usage: $0 <backup_file>"
    echo ""
    echo "Available backups:"
    ls -la "$PROJECT_DIR/backups/"/*.sql.gz 2>/dev/null || echo "No backups found"
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    log_error "Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Source environment variables
if [ -f "$PROJECT_DIR/.env" ]; then
    set -a
    source "$PROJECT_DIR/.env"
    set +a
fi

log_warn "⚠️  WARNING: This will REPLACE the current database!"
log_warn "Make sure you have a backup of the current state."
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    log_info "Restore cancelled"
    exit 0
fi

log_info "Starting restore from: $BACKUP_FILE"

# Create temporary directory for extraction
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Extract if compressed
if [[ "$BACKUP_FILE" == *.gz ]]; then
    log_info "Extracting compressed backup..."
    gunzip -c "$BACKUP_FILE" > "$TEMP_DIR/restore.sql"
    SQL_FILE="$TEMP_DIR/restore.sql"
else
    SQL_FILE="$BACKUP_FILE"
fi

# Perform restore
if command -v docker-compose &> /dev/null; then
    # Docker environment
    log_info "Restoring using Docker..."
    
    # Stop the API to prevent writes during restore
    log_info "Stopping API service..."
    docker-compose -f "$PROJECT_DIR/docker-compose.yml" stop api
    
    # Restore database
    docker-compose -f "$PROJECT_DIR/docker-compose.yml" exec -T postgres \
        psql -U "${DB_USER:-appleflow}" -d "${DB_NAME:-appleflow}" < "$SQL_FILE"
    
    RESTORE_STATUS=$?
    
    # Restart API
    log_info "Restarting API service..."
    docker-compose -f "$PROJECT_DIR/docker-compose.yml" start api
else
    # Direct PostgreSQL
    log_info "Restoring using psql..."
    psql "${DATABASE_URL}" < "$SQL_FILE"
    RESTORE_STATUS=$?
fi

if [ $RESTORE_STATUS -eq 0 ]; then
    log_info "✅ Restore completed successfully"
else
    log_error "❌ Restore failed!"
    exit 1
fi
