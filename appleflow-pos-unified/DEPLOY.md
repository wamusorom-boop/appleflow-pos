# 🚀 AppleFlow POS - Deployment Guide

**Complete step-by-step guide to deploy AppleFlow POS for FREE.**

---

## 📋 Prerequisites

- GitHub account (free)
- Render.com account (free)
- PostgreSQL database (Render provides free tier)

---

## 🎯 Option 1: One-Click Deploy (Easiest - 5 minutes)

### Step 1: Push to GitHub

```bash
cd /mnt/okcomputer/output/appleflow-pos-unified

# Initialize git
git init

# Add all files
git add .

# Commit
git commit -m "AppleFlow POS v3.0 - Unified Edition"

# Add remote (replace with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/appleflow-pos.git

# Push
git push -u origin main
```

### Step 2: Deploy to Render

1. Go to: https://render.com
2. Sign up with GitHub
3. Click **"New +"** → **"Blueprint"**
4. Connect your GitHub repository
5. Render will automatically:
   - Create PostgreSQL database
   - Deploy the server
   - Run migrations
   - Build frontend

### Step 3: Access Your App

- **Live URL**: `https://appleflow-pos.onrender.com`
- **Health Check**: `https://appleflow-pos.onrender.com/health`

### Step 4: Login

Use default credentials:
- **Admin**: `admin@appleflow.pos` / `1234`
- **Manager**: `manager@appleflow.pos` / `1234`
- **Cashier**: `cashier@appleflow.pos` / `1234`

---

## 🛠️ Option 2: Manual Deploy (More Control)

### Step 1: Create Database

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"PostgreSQL"**
3. Name: `appleflow-db`
4. Plan: **Free**
5. Click **Create**
6. Copy the **Internal Database URL**

### Step 2: Create Web Service

1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repo
3. Configure:
   - **Name**: `appleflow-pos`
   - **Runtime**: Node
   - **Build Command**:
     ```
     npm install && cd client && npm install && npm run build && cd .. && npx prisma generate
     ```
   - **Start Command**:
     ```
     npx prisma migrate deploy && npm start
     ```
   - **Plan**: Free

4. Add Environment Variables:
   | Key | Value |
   |-----|-------|
   | `DATABASE_URL` | *(paste from Step 1)* |
   | `JWT_SECRET` | `openssl rand -base64 32` |
   | `JWT_REFRESH_SECRET` | `openssl rand -base64 32` |
   | `NODE_ENV` | `production` |

5. Click **Create Web Service**

### Step 3: Wait for Deploy

Build takes 3-5 minutes. Watch logs in Render dashboard.

---

## 🧪 Testing Your Deployment

### Test Health Endpoint

```bash
curl https://your-app.onrender.com/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "3.0.0",
  "environment": "production"
}
```

### Test Login API

```bash
curl -X POST https://your-app.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@appleflow.pos","pin":"1234"}'
```

Expected response:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "email": "admin@appleflow.pos",
      "name": "Admin User",
      "role": "ADMIN"
    },
    "tokens": {
      "accessToken": "eyJ...",
      "refreshToken": "eyJ...",
      "expiresIn": 28800
    }
  }
}
```

---

## 🔧 Local Development

### Setup

```bash
# Install dependencies
npm install
cd client && npm install && cd ..

# Setup database
npx prisma generate
npx prisma migrate dev --name init
npm run db:seed

# Run development servers
npm run dev          # Starts backend on :3000
cd client && npm run dev   # Starts frontend on :5173 (in another terminal)
```

### Access

- Frontend: http://localhost:5173
- API: http://localhost:3000/api
- Health: http://localhost:3000/health

---

## 📊 Free Tier Limits (Render)

| Resource | Limit |
|----------|-------|
| Web Service | 750 hours/month |
| Database | 1GB storage |
| Bandwidth | 100GB/month |
| **Cost** | **$0** |

**Note**: Free web services spin down after 15 minutes of inactivity. First request after spin-down takes ~30 seconds.

---

## 🐛 Troubleshooting

### Build Failed

**Problem**: Build fails on Render

**Solution**:
1. Check build logs in Render dashboard
2. Ensure `render.yaml` is in root directory
3. Verify all files are committed to GitHub

### Database Connection Error

**Problem**: `DATABASE_URL` not working

**Solution**:
1. Use **Internal Database URL** (not external)
2. Format: `postgres://user:pass@host:5432/dbname`
3. Redeploy after updating env var

### Login Loop

**Problem**: Keeps redirecting to login

**Solution**:
1. Clear browser localStorage
2. Check browser console for errors
3. Verify `JWT_SECRET` is set correctly

### CORS Errors

**Problem**: Frontend can't connect to API

**Solution**:
- Already fixed! Unified deployment serves both from same origin.

---

## ✅ Post-Deploy Checklist

- [ ] Health endpoint returns 200
- [ ] Login works with default credentials
- [ ] Dashboard loads correctly
- [ ] Products page shows data
- [ ] Sales page works
- [ ] Logout redirects to login
- [ ] Refresh token works

---

## 🎉 You're Done!

Your AppleFlow POS is now:
- ✅ Live on the internet
- ✅ Running on free hosting
- ✅ Secure with JWT authentication
- ✅ Ready for production use

**Next Steps**:
- Add real products
- Configure tax rates
- Set up receipt printer
- Add more users

---

**Need Help?**
- Check Render logs (very detailed)
- Review this guide step-by-step
- Test locally first

**Built with 💚 by Kimi - The AI that delivers complete solutions.**
