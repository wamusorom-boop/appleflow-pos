# AppleFlow POS - Deployment Guide

Step-by-step guide for deploying AppleFlow POS to production.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Server Setup](#server-setup)
3. [Application Deployment](#application-deployment)
4. [SSL Configuration](#ssl-configuration)
5. [Post-Deployment](#post-deployment)
6. [Troubleshooting](#troubleshooting)

## Prerequisites

### Server Requirements

- Ubuntu 22.04 LTS or similar
- 2+ CPU cores
- 4GB+ RAM
- 20GB+ disk space
- Static IP address

### Domain Setup

- Point your domain to the server IP
- Configure DNS A record: `api.yourdomain.com` → Server IP
- (Optional) Configure `pos.yourdomain.com` for frontend

## Server Setup

### 1. Update System

```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Install Docker

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 3. Install Additional Tools

```bash
sudo apt install -y git nginx certbot python3-certbot-nginx
```

## Application Deployment

### 1. Clone Repository

```bash
cd /opt
sudo git clone https://github.com/yourorg/appleflow-pos.git
sudo chown -R $USER:$USER appleflow-pos
cd appleflow-pos/appleflow-backend
```

### 2. Configure Environment

```bash
cp .env.example .env
nano .env
```

Fill in all required values:

```env
NODE_ENV=production
DATABASE_URL=postgresql://appleflow:secure_password@localhost:5432/appleflow
JWT_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_SECRET=$(openssl rand -base64 32)
MPESA_ENVIRONMENT=production
MPESA_SHORT_CODE=your_shortcode
MPESA_PASSKEY=your_passkey
MPESA_CONSUMER_KEY=your_consumer_key
MPESA_CONSUMER_SECRET=your_consumer_secret
MPESA_CALLBACK_URL=https://api.yourdomain.com/api/mpesa/callback
```

### 3. Deploy

```bash
# Make scripts executable
chmod +x scripts/*.sh

# Run deployment
./scripts/deploy.sh production
```

## SSL Configuration

### Using Let's Encrypt

```bash
# Obtain certificate
sudo certbot --nginx -d api.yourdomain.com

# Auto-renewal is configured automatically
# Test renewal:
sudo certbot renew --dry-run
```

### Manual SSL

Place your certificates in:
- `/opt/appleflow-pos/appleflow-backend/nginx/ssl/cert.pem`
- `/opt/appleflow-pos/appleflow-backend/nginx/ssl/key.pem`

Then restart nginx:
```bash
docker-compose restart nginx
```

## Post-Deployment

### 1. Create Admin User

```bash
docker-compose exec api npx ts-node scripts/create-admin.ts
```

### 2. Configure Printers (Optional)

```bash
# Add network printer
curl -X POST https://api.yourdomain.com/api/hardware/printers \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "main-printer",
    "type": "network",
    "address": "192.168.1.100:9100",
    "isDefault": true
  }'
```

### 3. Set Up Backups

Add to crontab:
```bash
# Edit crontab
crontab -e

# Add line for daily backup at 2 AM
0 2 * * * /opt/appleflow-pos/appleflow-backend/scripts/backup.sh >> /var/log/appleflow-backup.log 2>&1
```

### 4. Configure Monitoring (Optional)

Install monitoring agent:
```bash
# For Datadog, New Relic, etc.
# Follow their installation guides
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs api

# Check for port conflicts
sudo netstat -tlnp | grep 3000

# Restart services
docker-compose restart
```

### Database Connection Issues

```bash
# Check database container
docker-compose logs postgres

# Verify connection string in .env
cat .env | grep DATABASE_URL

# Test connection
docker-compose exec postgres psql -U appleflow -d appleflow -c "SELECT 1"
```

### M-Pesa Callbacks Not Working

1. Verify callback URL is publicly accessible
2. Check firewall rules
3. Verify SSL certificate is valid
4. Check logs: `docker-compose logs api | grep -i mpesa`

### High Memory Usage

```bash
# Check memory usage
docker stats

# Restart if needed
docker-compose restart api

# Add swap if necessary
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

## Updates

### Update Application

```bash
cd /opt/appleflow-pos/appleflow-backend
git pull origin main
./scripts/deploy.sh production
```

### Update Database Schema

```bash
docker-compose exec api npx prisma migrate deploy
```

## Security Checklist

- [ ] Change default passwords
- [ ] Enable firewall (ufw)
- [ ] Configure fail2ban
- [ ] Set up automated backups
- [ ] Enable SSL/TLS
- [ ] Configure CORS properly
- [ ] Set up log rotation
- [ ] Disable root SSH login
- [ ] Use SSH keys only

## Support

For issues and support:
- GitHub Issues: https://github.com/yourorg/appleflow-pos/issues
- Email: support@yourdomain.com
