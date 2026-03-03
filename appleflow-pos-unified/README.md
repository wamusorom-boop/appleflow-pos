# 🍎 AppleFlow POS - Unified Edition

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

**Production-ready Point of Sale system with unified deployment.**

- ✅ **Single codebase** - Backend and frontend in one repo
- ✅ **One deployment** - Express serves both API and static files
- ✅ **No CORS issues** - Same origin for API and frontend
- ✅ **Bulletproof auth** - No login loops, proper JWT handling
- ✅ **Free hosting** - Works on Render, Railway, etc.

---

## 🚀 Quick Start (5 minutes)

### 1. Clone and Install

```bash
git clone <your-repo>
cd appleflow-pos-unified
npm install
cd client && npm install && cd ..
```

### 2. Setup Database

```bash
# Copy environment file
cp .env.example .env

# Edit .env with your database URL
DATABASE_URL="postgresql://user:password@localhost:5432/appleflow_pos"

# Generate Prisma client and run migrations
npx prisma generate
npx prisma migrate dev --name init

# Seed database with default users
npm run db:seed
```

### 3. Run Development Server

```bash
# Terminal 1: Start backend
npm run dev

# Terminal 2: Start frontend (in another terminal)
cd client && npm run dev
```

### 4. Login

Open http://localhost:5173 and login with:
- **Admin**: `admin@appleflow.pos` / `1234`
- **Manager**: `manager@appleflow.pos` / `1234`
- **Cashier**: `cashier@appleflow.pos` / `1234`

---

## 🌐 Deploy to Render (Free)

### One-Click Deploy

1. Click the **"Deploy to Render"** button above
2. Connect your GitHub account
3. Render will automatically:
   - Create a PostgreSQL database
   - Deploy the unified server
   - Run migrations
   - Build the frontend

### Manual Deploy

1. Push code to GitHub
2. Go to [Render Dashboard](https://dashboard.render.com)
3. Click **"New +"** → **"Blueprint"**
4. Connect your repository
5. Render will use `render.yaml` for configuration

---

## 📁 Project Structure

```
appleflow-pos-unified/
├── server.js              # Main Express server (API + static files)
├── package.json           # Server dependencies
├── .env.example           # Environment template
├── render.yaml            # Render deployment config
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── seed.js            # Default data
└── client/                # React frontend
    ├── package.json       # Frontend dependencies
    ├── vite.config.ts     # Vite configuration
    └── src/
        ├── main.tsx       # Entry point
        ├── App.tsx        # Main app component
        ├── context/
        │   └── AuthContext.tsx    # Authentication logic
        ├── pages/
        │   ├── LoginPage.tsx      # Login screen
        │   ├── DashboardPage.tsx  # Dashboard
        │   ├── ProductsPage.tsx   # Products
        │   ├── SalesPage.tsx      # Sales
        │   └── CustomersPage.tsx  # Customers
        └── components/
            ├── Layout.tsx         # Main layout
            └── LoadingScreen.tsx  # Loading spinner
```

---

## 🔐 Authentication

### How It Works

1. **Login**: User submits email + PIN
2. **Validation**: Server validates credentials with bcrypt
3. **Tokens**: Server returns JWT access + refresh tokens
4. **Storage**: Tokens stored in localStorage
5. **API Calls**: Axios interceptor adds Authorization header
6. **Token Refresh**: Automatic refresh when access token expires
7. **Logout**: Clears localStorage, redirects to login

### Why No Login Loops?

- ✅ Single auth state in AuthContext
- ✅ Proper loading states prevent race conditions
- ✅ Token validation on app init
- ✅ No duplicate auth checks
- ✅ Clean separation of public/protected routes

---

## 🛠️ API Endpoints

### Authentication
- `POST /api/auth/login` - Login with email + PIN
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user
- `POST /api/auth/validate` - Validate token

### Products
- `GET /api/products` - List all products
- `POST /api/products` - Create product (Admin/Manager)

### Sales
- `GET /api/sales` - List sales
- `POST /api/sales` - Create sale

### Customers
- `GET /api/customers` - List customers
- `POST /api/customers` - Create customer

### Reports
- `GET /api/reports/dashboard` - Dashboard stats

---

## 🔧 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | ✅ |
| `JWT_SECRET` | Secret for JWT signing | ✅ |
| `JWT_REFRESH_SECRET` | Secret for refresh tokens | ✅ |
| `NODE_ENV` | Environment (development/production) | ❌ |
| `PORT` | Server port | ❌ |
| `JWT_EXPIRY` | Token expiration (e.g., 8h) | ❌ |
| `BCRYPT_ROUNDS` | Password hashing rounds | ❌ |

---

## 🧪 Testing

```bash
# Test health endpoint
curl http://localhost:3000/health

# Test login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@appleflow.pos","pin":"1234"}'
```

---

## 📝 Features

- ✅ JWT authentication with refresh tokens
- ✅ Role-based access control (Admin, Manager, Cashier)
- ✅ Product management with stock tracking
- ✅ Sales processing with receipt generation
- ✅ Customer management with loyalty points
- ✅ Dashboard with real-time stats
- ✅ Responsive design for mobile/tablet
- ✅ Offline-ready architecture

---

## 🐛 Troubleshooting

### Login Loop
- Check browser console for errors
- Verify `JWT_SECRET` is set
- Clear localStorage and try again

### Database Connection Error
- Verify `DATABASE_URL` is correct
- Ensure PostgreSQL is running
- Check database exists

### Build Errors
- Delete `node_modules` and reinstall
- Run `npx prisma generate`

---

## 📄 License

MIT License - Feel free to use for personal or commercial projects.

---

**Built with ❤️ using Node.js, Express, React, and Prisma.**
