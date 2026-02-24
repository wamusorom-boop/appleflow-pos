#!/bin/bash
# AppleFlow POS - Production Deployment Script
# Usage: ./deploy.sh [environment]
# Environments: production, staging

set -e

ENVIRONMENT=${1:-production}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "🚀 AppleFlow POS Deployment"
echo "Environment: $ENVIRONMENT"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ============================================
# Helper Functions
# ============================================
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# ============================================
# Pre-deployment Checks
# ============================================
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    
    # Check .env file
    if [ ! -f "$PROJECT_DIR/.env" ]; then
        log_error ".env file not found. Please create it from .env.example"
        exit 1
    fi
    
    log_info "Prerequisites check passed"
}

# ============================================
# Database Backup
# ============================================
backup_database() {
    log_info "Creating database backup..."
    
    BACKUP_DIR="$PROJECT_DIR/backups"
    mkdir -p "$BACKUP_DIR"
    
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.sql"
    
    # Source environment variables
    set -a
    source "$PROJECT_DIR/.env"
    set +a
    
    # Create backup using docker-compose
    docker-compose -f "$PROJECT_DIR/docker-compose.yml" exec -T postgres \
        pg_dump -U "$DB_USER" -d "$DB_NAME" > "$BACKUP_FILE"
    
    if [ $? -eq 0 ]; then
        gzip "$BACKUP_FILE"
        log_info "Backup created: ${BACKUP_FILE}.gz"
    else
        log_warn "Backup failed, continuing with deployment..."
    fi
}

# ============================================
# Build and Deploy
# ============================================
deploy() {
    log_info "Building and deploying..."
    
    cd "$PROJECT_DIR"
    
    # Pull latest images
    log_info "Pulling latest images..."
    docker-compose pull
    
    # Build the application
    log_info "Building application..."
    docker-compose build --no-cache
    
    # Run database migrations
    log_info "Running database migrations..."
    docker-compose run --rm api npx prisma migrate deploy
    
    # Start services
    log_info "Starting services..."
    docker-compose up -d
    
    # Wait for health check
    log_info "Waiting for health check..."
    sleep 10
    
    MAX_RETRIES=30
    RETRY_COUNT=0
    
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        if curl -sf http://localhost:3000/health > /dev/null 2>&1; then
            log_info "Health check passed!"
            break
        fi
        
        RETRY_COUNT=$((RETRY_COUNT + 1))
        log_info "Health check attempt $RETRY_COUNT/$MAX_RETRIES..."
        sleep 5
    done
    
    if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
        log_error "Health check failed after $MAX_RETRIES attempts"
        log_info "Checking logs..."
        docker-compose logs --tail=50 api
        exit 1
    fi
}

# ============================================
# Cleanup
# ============================================
cleanup() {
    log_info "Cleaning up..."
    
    # Remove old images
    docker image prune -f
    
    # Remove old backups (keep last 30 days)
    find "$PROJECT_DIR/backups" -name "backup_*.sql.gz" -mtime +30 -delete 2>/dev/null || true
    
    log_info "Cleanup completed"
}

# ============================================
# Rollback
# ============================================
rollback() {
    log_error "Deployment failed! Rolling back..."
    
    cd "$PROJECT_DIR"
    
    # Stop services
    docker-compose down
    
    # Restore from backup if available
    LATEST_BACKUP=$(ls -t "$PROJECT_DIR/backups"/*.sql.gz 2>/dev/null | head -1)
    
    if [ -n "$LATEST_BACKUP" ]; then
        log_info "Restoring from backup: $LATEST_BACKUP"
        gunzip -c "$LATEST_BACKUP" | docker-compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME"
    fi
    
    # Start previous version
    docker-compose up -d
    
    log_info "Rollback completed"
}

# ============================================
# Main
# ============================================
main() {
    trap rollback ERR
    
    check_prerequisites
    backup_database
    deploy
    cleanup
    
    log_info "✅ Deployment completed successfully!"
    log_info "API URL: http://localhost:3000"
    log_info "Health Check: http://localhost:3000/health"
}

main "$@"
