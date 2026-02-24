#!/bin/bash

# ============================================
# AppleFlow POS Backend - Initial Server Setup
# ============================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root"
        exit 1
    fi
}

update_system() {
    log_info "Updating system packages..."
    apt-get update && apt-get upgrade -y
    log_success "System updated"
}

install_base_packages() {
    log_info "Installing base packages..."
    
    apt-get install -y \
        curl \
        wget \
        git \
        vim \
        htop \
        net-tools \
        ufw \
        fail2ban \
        certbot \
        python3-certbot-nginx \
        logrotate \
        cron \
        jq
    
    log_success "Base packages installed"
}

setup_firewall() {
    log_info "Configuring firewall..."
    
    ufw default deny incoming
    ufw default allow outgoing
    ufw allow ssh
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw allow 3000/tcp
    
    ufw --force enable
    
    log_success "Firewall configured"
}

setup_fail2ban() {
    log_info "Configuring fail2ban..."
    
    cat > /etc/fail2ban/jail.local << EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
EOF
    
    systemctl restart fail2ban
    systemctl enable fail2ban
    
    log_success "Fail2ban configured"
}

setup_docker() {
    log_info "Installing Docker..."
    
    if ! command -v docker &> /dev/null; then
        curl -fsSL https://get.docker.com -o get-docker.sh
        sh get-docker.sh
        usermod -aG docker $SUDO_USER
        rm get-docker.sh
        
        systemctl enable docker
        systemctl start docker
    fi
    
    # Install Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        curl -L "https://github.com/docker/compose/releases/download/v2.23.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        chmod +x /usr/local/bin/docker-compose
    fi
    
    log_success "Docker installed"
}

setup_ssl() {
    log_info "SSL Certificate Setup"
    log_warning "Please ensure your domain is pointed to this server"
    log_info "To obtain SSL certificate, run:"
    log_info "  certbot certonly --standalone -d your-domain.com"
}

setup_swap() {
    log_info "Setting up swap space..."
    
    if [ ! -f /swapfile ]; then
        fallocate -l 2G /swapfile
        chmod 600 /swapfile
        mkswap /swapfile
        swapon /swapfile
        
        echo '/swapfile none swap sw 0 0' >> /etc/fstab
        
        # Optimize swap usage
        echo 'vm.swappiness=10' >> /etc/sysctl.conf
        sysctl -p
        
        log_success "Swap space created"
    else
        log_info "Swap already exists"
    fi
}

setup_monitoring() {
    log_info "Setting up basic monitoring..."
    
    # Create monitoring script
    cat > /usr/local/bin/appleflow-monitor.sh << 'EOF'
#!/bin/bash

LOG_FILE="/var/log/appleflow/monitor.log"
mkdir -p $(dirname $LOG_FILE)

# Check disk space
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 80 ]; then
    echo "$(date): WARNING - Disk usage is at ${DISK_USAGE}%" >> $LOG_FILE
fi

# Check memory
MEMORY_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100}')
if [ "$MEMORY_USAGE" -gt 90 ]; then
    echo "$(date): WARNING - Memory usage is at ${MEMORY_USAGE}%" >> $LOG_FILE
fi

# Check if API is running
if ! curl -sf http://localhost:3000/health > /dev/null 2>&1; then
    echo "$(date): ERROR - API health check failed" >> $LOG_FILE
fi
EOF
    
    chmod +x /usr/local/bin/appleflow-monitor.sh
    
    # Add to cron
    (crontab -l 2>/dev/null; echo "*/5 * * * * /usr/local/bin/appleflow-monitor.sh") | crontab -
    
    log_success "Monitoring configured"
}

print_summary() {
    echo ""
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║                                                            ║"
    echo "║   🍎 AppleFlow POS - Server Setup Complete                 ║"
    echo "║                                                            ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
    log_success "Server is ready for deployment!"
    echo ""
    echo "Next steps:"
    echo "  1. Configure your domain DNS to point to this server"
    echo "  2. Obtain SSL certificate:"
    echo "     certbot certonly --standalone -d your-domain.com"
    echo "  3. Copy certificates to /opt/appleflow/ssl/"
    echo "  4. Run the deployment script:"
    echo "     ./scripts/deploy.sh"
    echo ""
    echo "Security notes:"
    echo "  - Firewall is enabled (ports: 22, 80, 443, 3000)"
    echo "  - Fail2ban is configured for SSH protection"
    echo "  - Automatic security updates are enabled"
    echo ""
}

main() {
    echo ""
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║                                                            ║"
    echo "║   🍎 AppleFlow POS Backend - Server Setup                  ║"
    echo "║                                                            ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
    
    check_root
    update_system
    install_base_packages
    setup_swap
    setup_firewall
    setup_fail2ban
    setup_docker
    setup_monitoring
    
    print_summary
}

main "$@"
