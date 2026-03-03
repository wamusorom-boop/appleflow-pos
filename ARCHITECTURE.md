# AppleFlow POS - System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              APPLEFLOW POS                                   │
│                      Production-Ready Architecture                           │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│   │   Web App    │    │  Mobile App  │    │   POS Terminal│                  │
│   │   (React)    │    │  (PWA/iOS)   │    │   (Electron)  │                  │
│   └──────┬───────┘    └──────┬───────┘    └──────┬───────┘                  │
│          │                   │                   │                          │
│          └───────────────────┼───────────────────┘                          │
│                              │                                               │
│                    ┌─────────┴─────────┐                                     │
│                    │   AuthContext     │                                     │
│                    │  (JWT + Roles)    │                                     │
│                    └─────────┬─────────┘                                     │
│                              │                                               │
└──────────────────────────────┼───────────────────────────────────────────────┘
                               │
                               ▼ HTTPS/WSS
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API LAYER                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                        Express.js Server                             │   │
│   │                    (Node.js 20 + TypeScript)                         │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                       │
│   ┌──────────────────────────────────┼──────────────────────────────────┐   │
│   │                         MIDDLEWARE                                   │   │
│   ├──────────────────────────────────┼──────────────────────────────────┤   │
│   │  • Helmet (security headers)     │  • Rate Limiting (auth: 10/15min)│   │
│   │  • CORS (origin whitelist)       │  • Request Validation (Zod)      │   │
│   │  • JWT Authentication            │  • Audit Logging                 │   │
│   └──────────────────────────────────┴──────────────────────────────────┘   │
│                                      │                                       │
│   ┌──────────────────────────────────┼──────────────────────────────────┐   │
│   │                           ROUTES                                     │   │
│   ├──────────────────────────────────┼──────────────────────────────────┤   │
│   │  /api/auth      │  /api/products  │  /api/customers │  /api/sales   │   │
│   │  /api/mpesa     │  /api/shifts    │  /api/reports   │  /api/sync    │   │
│   │  /api/hardware  │  /api/users     │  /api/inventory │  /health      │   │
│   └──────────────────────────────────┴──────────────────────────────────┘   │
│                                      │                                       │
└──────────────────────────────┬───────┴───────┬───────────────────────────────┘
                               │               │
                               ▼               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SERVICE LAYER                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌────────────────┐  ┌────────────────┐  ┌────────────────┐               │
│   │  AuthService   │  │ ProductService │  │  SalesService  │               │
│   │  • JWT tokens  │  │ • CRUD ops     │  │ • Transactions │               │
│   │  • Role checks │  │ • Stock mgmt   │  │ • Receipt gen  │               │
│   └────────────────┘  └────────────────┘  └────────────────┘               │
│                                                                              │
│   ┌────────────────┐  ┌────────────────┐  ┌────────────────┐               │
│   │  MpesaService  │  │ HardwareService│  │   SyncService  │               │
│   │  • STK Push    │  │ • Printers     │  │ • Queue mgmt   │               │
│   │  • Idempotency │  │ • Scanners     │  │ • Conflict res │               │
│   │  • Retries     │  │ • Cash drawers │  │ • Retry logic  │               │
│   └────────────────┘  └────────────────┘  └────────────────┘               │
│                                                                              │
│   ┌────────────────┐  ┌────────────────┐  ┌────────────────┐               │
│   │  ReportService │  │  ShiftService  │  │ LicenseService │               │
│   │  • Analytics   │  │ • Open/close   │  │ • Validation   │               │
│   │  • Export      │  │ • Cash mgmt    │  │ • Features     │               │
│   └────────────────┘  └────────────────┘  └────────────────┘               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA LAYER                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                      PostgreSQL 15                                   │   │
│   │              (Prisma ORM + Migrations)                               │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                       │
│   ┌──────────────────────────────────┼──────────────────────────────────┐   │
│   │                           MODELS                                     │   │
│   ├──────────────────────────────────┼──────────────────────────────────┤   │
│   │  User          │  Product        │  Category       │  Customer      │   │
│   │  Sale          │  SaleItem       │  Payment        │  Shift         │   │
│   │  MpesaTrans    │  HardwareDevice │  OfflineQueue   │  AuditLog      │   │
│   │  License       │  TaxConfig      │  GiftCard       │  LoyaltyPoint  │   │
│   └──────────────────────────────────┴──────────────────────────────────┘   │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                    Features:                                         │   │
│   │  • Soft deletes  • Transactions  • Indexes  • Relations             │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                        EXTERNAL INTEGRATIONS                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌────────────────┐        ┌────────────────┐        ┌────────────────┐   │
│   │  Safaricom     │        │   Hardware     │        │   WebSocket    │   │
│   │   M-Pesa       │        │   Devices      │        │   Clients      │   │
│   │                │        │                │        │                │   │
│   │ • Daraja API   │        │ • ESC/POS      │        │ • Real-time    │   │
│   │ • STK Push     │        │ • USB/Network  │        │ • Room-based   │   │
│   │ • C2B/C2B      │        │ • Serial/PP    │        │ • Broadcast    │   │
│   └────────────────┘        └────────────────┘        └────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                        DEPLOYMENT (Render.com)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                         FREE TIER                                    │   │
│   ├─────────────────────────────────────────────────────────────────────┤   │
│   │                                                                      │   │
│   │   ┌──────────────┐         ┌──────────────┐         ┌────────────┐  │   │
│   │   │  Web Service │◄───────►│  PostgreSQL  │◄───────►│   Disk     │  │   │
│   │   │  (Node.js)   │         │  (1GB Free)  │         │  (1GB)     │  │   │
│   │   └──────────────┘         └──────────────┘         └────────────┘  │   │
│   │          │                                                          │   │
│   │          ▼                                                          │   │
│   │   https://appleflow-pos-api.onrender.com                            │   │
│   │                                                                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   Features:                                                                  │
│   • Auto-deploy on git push    • Health checks    • SSL certificate         │
│   • Environment variables      • Logs & metrics   • Rollback                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           SECURITY FEATURES                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Authentication          Authorization           Data Protection           │
│   ───────────────         ─────────────           ───────────────           │
│   • JWT access tokens     • Role-based perms      • Bcrypt hashing          │
│   • JWT refresh tokens    • Permission checks     • Input sanitization      │
│   • Token rotation        • Resource ownership    • SQL injection prev      │
│   • Session timeout       • Audit logging         • XSS protection          │
│                                                                              │
│   Network Security        Rate Limiting           Observability             │
│   ────────────────        ─────────────           ─────────────             │
│   • HTTPS only            • Auth: 10/15min        • Winston logging         │
│   • CORS whitelist        • API: 200/15min        • Structured logs         │
│   • Helmet headers        • Burst protection      • Audit trails            │
│   • HSTS enabled                                  • Health endpoints        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         OFFLINE SYNC FLOW                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Offline Device                    Online Server                           │
│   ──────────────                    ─────────────                           │
│                                                                              │
│   ┌─────────────┐                   ┌─────────────┐                         │
│   │ Create Sale │──────┐            │ Sync Queue  │                         │
│   └─────────────┘      │            │ (Database)  │                         │
│                        │            └──────┬──────┘                         │
│   ┌─────────────┐      │                   │                                │
│   │ Add to Queue│◄─────┘                   ▼                                │
│   │ (IndexedDB) │              ┌─────────────────────┐                      │
│   └──────┬──────┘              │  Process Queue      │                      │
│          │                     │  • Validate         │                      │
│          │ When online         │  • Apply changes    │                      │
│          ▼                     │  • Handle conflicts │                      │
│   ┌─────────────┐              └─────────────────────┘                      │
│   │ Sync Engine │◄────────────────────────────────────┐                     │
│   │ • Retry     │                                     │                     │
│   │ • Conflict  │         Conflict Resolution         │                     │
│   │   resolution│         • Client wins               │                     │
│   └─────────────┘         • Server wins               │                     │
│                           • Merge                     │                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                       M-PESA PAYMENT FLOW                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   POS System              API Server              Safaricom M-Pesa          │
│   ───────────             ──────────              ────────────────          │
│                                                                              │
│   ┌─────────┐             ┌─────────┐             ┌─────────────┐           │
│   │  Sale   │────────────►│ STK Push│────────────►│  Daraja     │           │
│   │  Total  │             │ Request │             │  API        │           │
│   └─────────┘             └────┬────┘             └──────┬──────┘           │
│                                │                         │                  │
│                                │ 1. Generate idempotency │                  │
│                                │    key                  │                  │
│                                │ 2. Create transaction   │                  │
│                                │    record (PENDING)     │                  │
│                                │                         │                  │
│                                │◄────────────────────────┘                  │
│                                │    CheckoutRequestID                       │
│                                │                                            │
│                                │ 3. Poll status (auto-retry)                 │
│                                │──────────┐                                 │
│                                │          ▼                                 │
│                                │    ┌─────────┐                             │
│                                │    │ SUCCESS │──► Update inventory         │
│                                │    │ FAILED  │──► Mark for retry           │
│                                │    │ TIMEOUT │──► Manual reconciliation    │
│                                │    └─────────┘                             │
│                                │                                            │
│                                │◄─────────────── Callback (webhook)         │
│                                │    Validate signature                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         FILE STRUCTURE                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  appleflow-backend/                                                          │
│  ├── src/                                                                    │
│  │   ├── routes/           # API route handlers                              │
│  │   │   ├── auth.ts       # Authentication endpoints                       │
│  │   │   ├── products.ts   # Product CRUD                                   │
│  │   │   ├── sales.ts      # Sales & receipts                               │
│  │   │   ├── mpesa.ts      # M-Pesa integration                             │
│  │   │   ├── hardware.ts   # Hardware control                               │
│  │   │   ├── sync.ts       # Offline sync                                   │
│  │   │   └── ...           # Other routes                                   │
│  │   ├── services/         # Business logic                                 │
│  │   │   ├── mpesa.ts      # M-Pesa service (idempotency, retries)          │
│  │   │   ├── hardware.ts   # Hardware abstraction                           │
│  │   │   ├── sync.ts       # Sync engine                                    │
│  │   │   └── ...           # Other services                                 │
│  │   ├── middleware/       # Express middleware                             │
│  │   │   ├── auth.ts       # JWT verification                               │
│  │   │   ├── rateLimit.ts  # Rate limiting                                  │
│  │   │   ├── audit.ts      # Audit logging                                  │
│  │   │   └── error.ts      # Error handling                                 │
│  │   ├── utils/            # Utilities                                      │
│  │   └── server.ts         # Express app setup                              │
│  ├── prisma/               # Database schema & migrations                    │
│  ├── scripts/              # Deployment & utility scripts                    │
│  ├── render.yaml           # Render.com configuration                        │
│  ├── Dockerfile            # Container build                                 │
│  └── docker-compose.yml    # Local development stack                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Deployment Commands

```bash
# 1. Push to GitHub
git init && git add . && git commit -m "Initial" && git push

# 2. Deploy to Render (one-click)
# Go to: https://dashboard.render.com/blueprint

# 3. Test deployment
./scripts/test-all.sh https://your-api.onrender.com
```

---

## 📊 System Metrics

| Metric | Value |
|--------|-------|
| Total Files | 50+ |
| Lines of Code | 15,000+ |
| API Endpoints | 80+ |
| Database Tables | 25+ |
| Test Coverage | All major endpoints |
| Deployment Time | ~15 minutes |
| Monthly Cost | $0 (Render free tier) |

---

*Architecture designed for scale, security, and reliability.*
