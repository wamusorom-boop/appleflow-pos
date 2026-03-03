# AppleFlow POS - Backend API

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/yourusername/appleflow-pos)

Production-ready Point of Sale system backend API with M-Pesa integration, hardware support, and offline sync capabilities.

**🚀 Deploy FREE in 15 minutes | 💰 Zero Cost | 🔐 Production Hardened**

## Features

- **Payment Processing**: M-Pesa STK Push with idempotency, retry logic, and reconciliation
- **Hardware Integration**: Receipt printers, barcode scanners, cash drawers
- **Offline Sync**: Queue-based synchronization for unstable connectivity
- **Security**: JWT authentication, rate limiting, input validation
- **Observability**: Structured logging, health checks, metrics
- **Tax Configuration**: Generic tax system (configurable by region)

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 14+
- Docker & Docker Compose (optional)

### Local Development

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Start database (using Docker)
docker-compose -f docker-compose.dev.yml up -d

# Run migrations
npx prisma migrate dev

# Seed database
npx prisma db seed

# Start development server
npm run dev
```

### Docker Deployment

```bash
# Production deployment
./scripts/deploy.sh production

# Or manually
docker-compose up -d
```

## Environment Variables

See `.env.example` for full configuration options.

### Required

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for JWT signing |
| `JWT_REFRESH_SECRET` | Secret for refresh tokens |

### M-Pesa (Optional)

| Variable | Description |
|----------|-------------|
| `MPESA_ENVIRONMENT` | `sandbox` or `production` |
| `MPESA_SHORT_CODE` | Your M-Pesa shortcode |
| `MPESA_PASSKEY` | M-Pesa passkey |
| `MPESA_CONSUMER_KEY` | Consumer key from Daraja |
| `MPESA_CONSUMER_SECRET` | Consumer secret from Daraja |

## API Documentation

### Authentication

```bash
# Login
POST /api/auth/login
{
  "email": "user@example.com",
  "pin": "1234"
}

# Refresh token
POST /api/auth/refresh
{
  "refreshToken": "..."
}
```

### Sales

```bash
# Create sale
POST /api/sales
{
  "items": [...],
  "payments": [...],
  "customerId": "..."
}

# Get sales
GET /api/sales?page=1&limit=50

# Void sale
POST /api/sales/:id/void
{
  "reason": "Customer request"
}
```

### M-Pesa Payments

```bash
# Initiate STK Push
POST /api/mpesa/stk-push
{
  "phoneNumber": "254712345678",
  "amount": 1000,
  "reference": "INV001",
  "saleId": "..."
}

# Check status
GET /api/mpesa/status/:checkoutRequestId

# Retry failed payment
POST /api/mpesa/retry/:checkoutRequestId
```

### Hardware

```bash
# Add printer
POST /api/hardware/printers
{
  "id": "main-printer",
  "type": "network",
  "address": "192.168.1.100:9100",
  "isDefault": true
}

# Print receipt
POST /api/hardware/print/receipt
{
  "receipt": { ... }
}

# Open cash drawer
POST /api/hardware/drawer/open
```

### Sync (Offline Support)

```bash
# Get sync status
GET /api/sync/status

# Add to queue
POST /api/sync/queue
{
  "entityType": "sale",
  "entityId": "local-123",
  "operation": "CREATE",
  "payload": { ... }
}

# Process queue
POST /api/sync/process
```

## Database Management

```bash
# Create migration
npx prisma migrate dev --name migration_name

# Deploy migrations
npx prisma migrate deploy

# Generate client
npx prisma generate

# Open Prisma Studio
npx prisma studio
```

## Backup & Restore

```bash
# Create backup
./scripts/backup.sh

# Restore from backup
./scripts/restore.sh backups/backup_20240101_120000.sql.gz
```

## Monitoring

### Health Checks

- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed system status
- `GET /ready` - Kubernetes readiness probe
- `GET /live` - Kubernetes liveness probe

### Logs

```bash
# View API logs
docker-compose logs -f api

# View all logs
docker-compose logs -f
```

## Security

- All endpoints require authentication (except callbacks)
- Rate limiting on auth endpoints
- Input validation with Zod schemas
- CORS configured for specific origins
- Helmet security headers

## License

MIT
