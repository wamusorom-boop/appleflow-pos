# 🚀 AppleFlow POS - FREE Hosting on Render.com

Complete step-by-step guide to host AppleFlow POS for FREE with zero credit card required.

---

## 📋 Prerequisites

- GitHub account (free)
- Render.com account (free)
- Your AppleFlow POS code

---

## STEP 1: Push Code to GitHub (5 minutes)

### 1.1 Create GitHub Repository

1. Go to https://github.com/new
2. Name it: `appleflow-pos`
3. Make it **Public** (free)
4. Click **Create repository**

### 1.2 Push Your Code

```bash
# Navigate to your project
cd /mnt/okcomputer/output/appleflow-backend

# Initialize git (if not already)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - Production ready AppleFlow POS"

# Add remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/appleflow-pos.git

# Push to GitHub
git push -u origin main
```

✅ **Verify**: Go to `https://github.com/YOUR_USERNAME/appleflow-pos` - you should see your code!

---

## STEP 2: Sign Up on Render (2 minutes)

1. Go to https://render.com
2. Click **Get Started for Free**
3. Sign up with **GitHub** (easiest)
4. Authorize Render to access your repositories

✅ **Done**: You're now on Render dashboard

---

## STEP 3: Create PostgreSQL Database (3 minutes)

1. In Render dashboard, click **New +**
2. Select **PostgreSQL**
3. Configure:
   - **Name**: `appleflow-db`
   - **Region**: Oregon (US West)
   - **Plan**: **Free** (selected by default)
4. Click **Create Database**

5. **WAIT** for database to be created (2-3 minutes)

6. Once created, copy the **Internal Database URL** - you'll need it!

✅ **Done**: Your database is ready!

---

## STEP 4: Deploy Backend API (5 minutes)

### 4.1 Create Web Service

1. In Render dashboard, click **New +**
2. Select **Web Service**
3. Connect your GitHub repository:
   - Click **Connect** next to `appleflow-pos`
   - If not visible, click **Configure account** and grant access

4. Configure the service:
   - **Name**: `appleflow-pos-api`
   - **Region**: Oregon (US West) - same as database!
   - **Branch**: `main`
   - **Runtime**: `Node`
   - **Build Command**: 
     ```
     npm install && npx prisma generate && npm run build
     ```
   - **Start Command**:
     ```
     npx prisma migrate deploy && npm start
     ```
   - **Plan**: **Free**

5. Click **Advanced** and add Environment Variables:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | *(paste from Step 3)* |
| `JWT_SECRET` | *(generate: `openssl rand -base64 32` or use any random string)* |
| `JWT_REFRESH_SECRET` | *(generate another random string)* |
| `CORS_ORIGINS` | `*` |
| `MPESA_ENVIRONMENT` | `sandbox` |

6. Click **Create Web Service**

### 4.2 Wait for Deployment

- Build takes 3-5 minutes
- Watch the logs in real-time
- Look for: `Build successful` and `Your service is live`

✅ **Done**: Your API is live at `https://appleflow-pos-api.onrender.com`

---

## STEP 5: Test Your Deployment (10 minutes)

### 5.1 Health Check

Open in browser:
```
https://appleflow-pos-api.onrender.com/health
```

**Expected response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "1.0.0",
  "environment": "production"
}
```

✅ **If you see this, your API is working!**

### 5.2 Create Admin User

**Option A: Using Render Shell (Recommended)**

1. In Render dashboard, click your service `appleflow-pos-api`
2. Click **Shell** tab
3. Run:
   ```bash
   npx ts-node scripts/create-admin.ts
   ```
4. Enter:
   - Name: `Admin User`
   - Email: `admin@appleflow.pos`
   - PIN: `1234`

**Option B: Using API directly**

```bash
# First, we need to manually create via a temporary endpoint
# Or seed the database
```

### 5.3 Test Login

```bash
curl -X POST https://appleflow-pos-api.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@appleflow.pos",
    "pin": "1234"
  }'
```

**Expected response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "name": "Admin User",
      "email": "admin@appleflow.pos",
      "role": "ADMIN"
    },
    "tokens": {
      "accessToken": "eyJ...",
      "refreshToken": "eyJ...",
      "expiresIn": 900
    }
  }
}
```

✅ **Save the accessToken - you'll need it for all other tests!**

---

## STEP 6: Test All Functions (20 minutes)

Replace `YOUR_TOKEN` with the accessToken from login.

### 6.1 Products API

```bash
# List products
curl https://appleflow-pos-api.onrender.com/api/products \
  -H "Authorization: Bearer YOUR_TOKEN"

# Create product
curl -X POST https://appleflow-pos-api.onrender.com/api/products \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sku": "TEST001",
    "name": "Test Product",
    "barcode": "1234567890123",
    "costPrice": 50,
    "sellingPrice": 75,
    "quantity": 100,
    "minStockLevel": 10,
    "categoryId": "..."
  }'
```

### 6.2 Customers API

```bash
# List customers
curl https://appleflow-pos-api.onrender.com/api/customers \
  -H "Authorization: Bearer YOUR_TOKEN"

# Create customer
curl -X POST https://appleflow-pos-api.onrender.com/api/customers \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "phone": "254712345678",
    "email": "john@example.com"
  }'
```

### 6.3 Sales API

```bash
# Create sale
curl -X POST https://appleflow-pos-api.onrender.com/api/sales \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "productId": "PRODUCT_ID_HERE",
        "quantity": 2,
        "unitPrice": 75
      }
    ],
    "payments": [
      {
        "method": "CASH",
        "amount": 150
      }
    ]
  }'
```

### 6.4 M-Pesa Payment Test (Sandbox)

```bash
# Initiate STK Push
curl -X POST https://appleflow-pos-api.onrender.com/api/mpesa/stk-push \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "254708374149",
    "amount": 100,
    "reference": "TEST001"
  }'
```

**Note**: In sandbox mode, use Safaricom's test number: `254708374149`

### 6.5 Hardware API Test

```bash
# Add printer (simulation mode)
curl -X POST https://appleflow-pos-api.onrender.com/api/hardware/printers \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-printer",
    "type": "network",
    "address": "192.168.1.100:9100",
    "isDefault": true
  }'

# Print test page
curl -X POST https://appleflow-pos-api.onrender.com/api/hardware/print/test \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 6.6 Sync API Test

```bash
# Get sync status
curl https://appleflow-pos-api.onrender.com/api/sync/status \
  -H "Authorization: Bearer YOUR_TOKEN"

# Add to sync queue
curl -X POST https://appleflow-pos-api.onrender.com/api/sync/queue \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "entityType": "sale",
    "entityId": "local-123",
    "operation": "CREATE",
    "payload": {
      "receiptNumber": "RCP001",
      "total": 150
    }
  }'
```

### 6.7 Reports API

```bash
# Dashboard stats
curl https://appleflow-pos-api.onrender.com/api/reports/dashboard \
  -H "Authorization: Bearer YOUR_TOKEN"

# Sales report
curl "https://appleflow-pos-api.onrender.com/api/reports/sales?from=2024-01-01&to=2024-01-31" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## STEP 7: Frontend Deployment (Optional, 5 minutes)

### 7.1 Update Frontend API URL

Edit `/mnt/okcomputer/output/app/.env.production`:
```
VITE_API_URL=https://appleflow-pos-api.onrender.com/api
VITE_WS_URL=wss://appleflow-pos-api.onrender.com
```

### 7.2 Build Frontend

```bash
cd /mnt/okcomputer/output/app
npm install
npm run build
```

### 7.3 Deploy to Render Static Site

1. In Render dashboard, click **New +**
2. Select **Static Site**
3. Connect same GitHub repo
4. Configure:
   - **Name**: `appleflow-pos-web`
   - **Build Command**: `cd app && npm install && npm run build`
   - **Publish Directory**: `app/dist`
5. Click **Create Static Site**

✅ **Done**: Frontend at `https://appleflow-pos-web.onrender.com`

---

## 📊 Testing Checklist

| Feature | Endpoint | Status |
|---------|----------|--------|
| Health Check | `GET /health` | ⬜ |
| Login | `POST /api/auth/login` | ⬜ |
| List Products | `GET /api/products` | ⬜ |
| Create Product | `POST /api/products` | ⬜ |
| List Customers | `GET /api/customers` | ⬜ |
| Create Customer | `POST /api/customers` | ⬜ |
| Create Sale | `POST /api/sales` | ⬜ |
| Void Sale | `POST /api/sales/:id/void` | ⬜ |
| M-Pesa STK Push | `POST /api/mpesa/stk-push` | ⬜ |
| Check M-Pesa Status | `GET /api/mpesa/status/:id` | ⬜ |
| Add Printer | `POST /api/hardware/printers` | ⬜ |
| Print Test | `POST /api/hardware/print/test` | ⬜ |
| Sync Queue | `POST /api/sync/queue` | ⬜ |
| Dashboard Stats | `GET /api/reports/dashboard` | ⬜ |

---

## 🔧 Troubleshooting

### Build Failed

**Problem**: Build fails on Render

**Solution**:
1. Check build logs in Render dashboard
2. Common issues:
   - Missing `npx prisma generate` in build command
   - TypeScript errors - run `npm run typecheck` locally first

### Database Connection Error

**Problem**: `DATABASE_URL` not working

**Solution**:
1. In Render dashboard, go to your PostgreSQL database
2. Copy the **Internal Database URL** (not external)
3. Update environment variable in web service settings
4. Redeploy

### CORS Errors

**Problem**: Frontend can't connect to API

**Solution**:
1. Update `CORS_ORIGINS` environment variable:
   - For testing: `*` (allows all)
   - For production: `https://your-frontend-url.com`
2. Redeploy

### M-Pesa Callbacks Not Working

**Problem**: M-Pesa payments not completing

**Solution**:
1. Callback URL must be HTTPS
2. In sandbox mode, use test credentials from Safaricom Daraja
3. Check logs: `docker logs <container>` or Render logs

---

## 🎉 You're Done!

Your AppleFlow POS is now:
- ✅ Hosted FREE on Render.com
- ✅ Accessible from anywhere
- ✅ Running 24/7
- ✅ With a real PostgreSQL database
- ✅ Ready for testing!

**Your URLs:**
- API: `https://appleflow-pos-api.onrender.com`
- Health Check: `https://appleflow-pos-api.onrender.com/health`

---

## 💡 Pro Tips

1. **Free Tier Limits**:
   - Web service: Spins down after 15 min idle (wakes up on next request)
   - Database: 1GB storage, 100MB RAM
   - Perfect for testing and small shops!

2. **Keep It Alive**:
   - Use UptimeRobot (free) to ping your API every 10 minutes
   - Prevents spin-down delays

3. **Custom Domain** (Optional):
   - Render supports custom domains on free tier
   - Add your domain in service settings

4. **Environment Variables**:
   - Never commit `.env` to GitHub
   - Always use Render's environment variable UI

---

## 📞 Need Help?

If you get stuck:
1. Check Render logs (they're very detailed)
2. Review this guide step-by-step
3. Test locally first: `npm run dev`
4. Compare with working code

**You've got this!** 🚀
