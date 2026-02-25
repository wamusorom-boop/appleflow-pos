# AppleFlow POS v2.0

**Enterprise-Grade Point of Sale System for Modern Retail**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-%5E5.0.0-blue.svg)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/supabase-PostgreSQL-green.svg)](https://supabase.io/)

---

## 🚀 Features

### Core POS Functionality
- ✅ **Fast Product Search** - Instant search by name, SKU, or barcode
- ✅ **Shopping Cart** - Add, remove, adjust quantities with real-time totals
- ✅ **Multiple Payment Methods** - Cash, Card, M-Pesa, Bank Transfer
- ✅ **Receipt Generation** - Professional printable receipts
- ✅ **Barcode Support** - Ready for barcode scanner integration
- ✅ **Customer Management** - Track customers and loyalty points

### Inventory Management
- ✅ **Real-time Stock Tracking** - Automatic inventory updates on sales
- ✅ **Low Stock Alerts** - Get notified when products run low
- ✅ **Stock Adjustments** - Manual adjustments with audit trail
- ✅ **Multi-store Support** - Manage inventory across multiple locations
- ✅ **Stock History** - Complete movement history for every product

### Sales & Reporting
- ✅ **Sales History** - Complete transaction history with filtering
- ✅ **Void/Refund** - Process returns with inventory restoration
- ✅ **Analytics Dashboard** - Key metrics and insights
- ✅ **Export Reports** - CSV export for all reports
- ✅ **Payment Analytics** - Track payment method usage

### User Management
- ✅ **Role-Based Access Control** - Admin, Manager, Supervisor, Cashier roles
- ✅ **PIN-based Login** - Secure 4-6 digit PIN authentication
- ✅ **User Activity** - Track last login and activity
- ✅ **Store Assignment** - Assign users to specific stores

### SaaS Features
- ✅ **Multi-tenant Architecture** - Each tenant isolated with RLS
- ✅ **Subscription Management** - Trial, Starter, Professional, Enterprise tiers
- ✅ **Resource Limits** - Enforce user/product/store limits per plan
- ✅ **License Keys** - Secure license validation

---

## 📋 Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0 or **yarn** >= 1.22.0
- **Supabase Account** (free tier works)
- **Git** (optional, for deployment)

---

## 🛠️ Quick Start

### 1. Clone and Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/appleflow-pos.git
cd appleflow-pos

# Install dependencies
npm run install:all
```

### 2. Configure Supabase

1. Create a free account at [supabase.com](https://supabase.com)
2. Create a new project
3. Go to **SQL Editor** → **New Query**
4. Copy and paste the contents of `supabase/schema.sql`
5. Run the query to create all tables

### 3. Environment Variables

Create `.env` files:

**Backend** (`backend/.env`):
```env
# Server
PORT=3001
NODE_ENV=development

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

# JWT
JWT_SECRET=your-super-secret-jwt-key-min-32-characters
JWT_REFRESH_SECRET=your-refresh-secret-key-min-32-characters
JWT_EXPIRES_IN=8h
JWT_REFRESH_EXPIRES_IN=7d

# Security
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS
CORS_ORIGIN=http://localhost:5173
```

**Frontend** (`frontend/.env`):
```env
VITE_API_URL=http://localhost:3001
```

### 4. Run Development Servers

```bash
# Run both frontend and backend
npm run dev

# Or run separately
npm run dev:backend
npm run dev:frontend
```

### 5. Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001
- **API Docs**: http://localhost:3001/api/health

---

## 📁 Project Structure

```
appleflow-v2/
├── backend/                 # Express.js API
│   ├── src/
│   │   ├── config/         # Configuration files
│   │   ├── middleware/     # Express middleware
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   ├── utils/          # Utility functions
│   │   └── index.ts        # Entry point
│   ├── package.json
│   └── tsconfig.json
├── frontend/               # React + Vite SPA
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── layouts/        # Page layouts
│   │   ├── pages/          # Route pages
│   │   ├── store/          # Zustand stores
│   │   ├── lib/            # Utilities & API
│   │   └── App.tsx         # Main app
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
├── supabase/
│   └── schema.sql          # Database schema
├── docs/                   # Documentation
└── package.json            # Root package.json
```

---

## 🔐 Authentication

AppleFlow POS uses JWT-based authentication with refresh tokens:

1. **Login**: POST `/api/auth/login` with email and PIN
2. **Access Token**: Valid for 8 hours
3. **Refresh Token**: Valid for 7 days
4. **Auto-refresh**: Frontend automatically refreshes tokens

### Default Admin Account

After setting up Supabase, create your first admin user:

```sql
-- Create tenant first
INSERT INTO tenants (name, slug, subscription_status, subscription_tier)
VALUES ('Your Business', 'your-business', 'active', 'professional');

-- Create admin user (PIN will be hashed by the app)
INSERT INTO user_profiles (tenant_id, email, full_name, role, pin_hash)
VALUES (
  (SELECT id FROM tenants WHERE slug = 'your-business'),
  'admin@yourbusiness.com',
  'Admin User',
  'tenant_admin',
  '$2b$12$...' -- bcrypt hashed PIN
);
```

---

## 👥 User Roles

| Role | Permissions |
|------|-------------|
| `super_admin` | Full system access (SaaS operator) |
| `tenant_admin` | Full tenant access, can manage users |
| `manager` | Manage products, inventory, view all reports |
| `supervisor` | Manage inventory, view reports |
| `cashier` | Process sales, view basic reports |

---

## 💳 Payment Methods

### Built-in Support
- **Cash** - Physical cash handling
- **Card** - Credit/Debit card (requires payment gateway)
- **M-Pesa** - Mobile money (requires Safaricom integration)
- **Bank Transfer** - Direct bank transfers

### Integrating M-Pesa

1. Register for M-Pesa API access at [Safaricom Developer](https://developer.safaricom.co.ke/)
2. Configure credentials in backend environment
3. Implement STK push in `backend/src/services/mpesa.ts`

---

## 📊 Database Schema

The system uses PostgreSQL with 50+ tables including:

- **tenants** - Multi-tenant isolation
- **stores** - Physical store locations
- **user_profiles** - User accounts with roles
- **products** - Product catalog
- **inventory** - Stock levels per store
- **sales** - Transaction records
- **sale_items** - Individual line items
- **customers** - Customer database
- **stock_movements** - Inventory audit trail

All tables have Row Level Security (RLS) policies for tenant isolation.

---

## 🚀 Deployment

### Option 1: Render (Recommended - Free)

See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed instructions.

Quick steps:
1. Push code to GitHub
2. Create Web Service on Render
3. Add environment variables
4. Deploy!

### Option 2: Self-Hosted

```bash
# Build frontend
cd frontend
npm run build

# Start backend
cd ../backend
npm run build
npm start
```

---

## 🧪 Testing

```bash
# Run backend tests
npm run test:backend

# Run frontend tests
npm run test:frontend

# Run all tests
npm test
```

---

## 📈 Performance

- **Database**: Indexed queries, connection pooling
- **Frontend**: Code splitting, lazy loading
- **API**: Rate limiting, request caching
- **Assets**: Optimized builds, CDN-ready

---

## 🔒 Security

- ✅ JWT authentication with refresh tokens
- ✅ bcrypt password/PIN hashing
- ✅ Row Level Security (RLS) in PostgreSQL
- ✅ Rate limiting on all endpoints
- ✅ Input validation with Zod
- ✅ CORS protection
- ✅ Helmet security headers
- ✅ SQL injection protection via parameterized queries

---

## 🆘 Troubleshooting

### Common Issues

**Database connection errors**
- Verify Supabase URL and service key
- Check IP allowlist in Supabase dashboard

**CORS errors**
- Ensure `CORS_ORIGIN` matches your frontend URL
- For production, set to your domain

**Token expired errors**
- Frontend auto-refreshes tokens
- If persistent, clear localStorage and login again

**Build failures**
- Ensure Node.js >= 18
- Delete `node_modules` and reinstall

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file

---

## 🤝 Support

- **Documentation**: See `/docs` folder
- **Issues**: GitHub Issues
- **Email**: support@appleflow.pos

---

## 🙏 Credits

Built with:
- [React](https://react.dev/)
- [Express.js](https://expressjs.com/)
- [Supabase](https://supabase.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [TanStack Query](https://tanstack.com/query/)

---

**Made with ❤️ for modern retailers**
