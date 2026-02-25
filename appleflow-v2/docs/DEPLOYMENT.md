# AppleFlow POS - Deployment Guide

Complete guide for deploying AppleFlow POS to production.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Supabase Setup](#supabase-setup)
3. [Option 1: Render Deployment](#option-1-render-deployment-recommended)
4. [Option 2: Railway Deployment](#option-2-railway-deployment)
5. [Option 3: Self-Hosted](#option-3-self-hosted)
6. [Environment Variables](#environment-variables)
7. [Post-Deployment](#post-deployment)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before deploying, ensure you have:

- [ ] GitHub account
- [ ] Supabase account (free tier works)
- [ ] Node.js 18+ installed locally
- [ ] Code pushed to GitHub repository

---

## Supabase Setup

### 1. Create Project

1. Go to [supabase.com](https://supabase.com) and sign up
2. Click "New Project"
3. Choose organization, name your project
4. Select region closest to your users
5. Create project (takes ~2 minutes)

### 2. Run Database Schema

1. In your Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Open `supabase/schema.sql` from this repository
4. Copy entire contents and paste into SQL Editor
5. Click **Run**

This creates all 50+ tables with RLS policies.

### 3. Get API Credentials

1. Go to **Project Settings** → **API**
2. Copy:
   - **Project URL** (e.g., `https://abcdefgh12345678.supabase.co`)
   - **service_role key** (NOT the anon key - keep this secret!)

Save these for the next steps.

---

## Option 1: Render Deployment (Recommended)

Render offers free hosting for web services and PostgreSQL (via Supabase).

### Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/appleflow-pos.git
git push -u origin main
```

### Step 2: Create Backend Service

1. Go to [render.com](https://render.com) and sign up
2. Click **New** → **Web Service**
3. Connect your GitHub repository
4. Configure:

```
Name: appleflow-pos-api
Root Directory: backend
Environment: Node
Build Command: npm install && npm run build
Start Command: npm start
Plan: Free
```

5. Add Environment Variables:

```
NODE_ENV=production
PORT=10000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
JWT_SECRET=generate-a-64-character-random-string-here
JWT_REFRESH_SECRET=generate-another-64-character-random-string
JWT_EXPIRES_IN=8h
JWT_REFRESH_EXPIRES_IN=7d
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
CORS_ORIGIN=https://appleflow-pos.vercel.app
```

6. Click **Create Web Service**

### Step 3: Create Frontend Service

1. On Render, click **New** → **Static Site**
2. Connect same GitHub repository
3. Configure:

```
Name: appleflow-pos
Root Directory: frontend
Build Command: npm install && npm run build
Publish Directory: dist
```

4. Add Environment Variables:

```
VITE_API_URL=https://appleflow-pos-api.onrender.com
```

5. Click **Create Static Site**

### Step 4: Update CORS

After frontend deploys, copy the frontend URL and update backend's `CORS_ORIGIN`:

1. Go to backend service on Render
2. Click **Environment**
3. Update `CORS_ORIGIN` to your frontend URL
4. Save changes (auto-redeploys)

---

## Option 2: Railway Deployment

Railway offers $5 free credit monthly.

### Step 1: Setup

1. Go to [railway.app](https://railway.app)
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your repository

### Step 2: Deploy Backend

1. Click **Add Service** → **GitHub Repo**
2. Select your repo
3. Configure:
   - Root Directory: `backend`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`

4. Add environment variables (same as Render)

### Step 3: Deploy Frontend

1. Add another service from GitHub
2. Configure:
   - Root Directory: `frontend`
   - Build Command: `npm install && npm run build`
   - Start Command: `npx serve -s dist`

3. Add `VITE_API_URL` pointing to backend service

---

## Option 3: Self-Hosted

For VPS or dedicated server deployment.

### Requirements

- Ubuntu 20.04+ server
- 2GB RAM minimum
- Domain name (optional but recommended)
- SSL certificate (Let's Encrypt)

### Step 1: Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Install Nginx
sudo apt install -y nginx

# Install Git
sudo apt install -y git
```

### Step 2: Deploy Application

```bash
# Create app directory
sudo mkdir -p /var/www/appleflow
cd /var/www/appleflow

# Clone repository
sudo git clone https://github.com/YOUR_USERNAME/appleflow-pos.git .

# Setup backend
cd backend
sudo npm install
sudo npm run build

# Create environment file
sudo nano .env
# Paste environment variables

# Start with PM2
sudo pm2 start dist/index.js --name "appleflow-api"
sudo pm2 save
sudo pm2 startup

# Setup frontend
cd ../frontend
sudo npm install
sudo npm run build

# Copy build to nginx directory
sudo cp -r dist/* /var/www/html/
```

### Step 3: Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/appleflow
```

Add:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        root /var/www/html;
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable:

```bash
sudo ln -s /etc/nginx/sites-available/appleflow /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Step 4: SSL with Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## Environment Variables

### Backend Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Server port | `3001` |
| `SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Service role key (secret!) | `eyJ...` |
| `JWT_SECRET` | JWT signing secret | 64+ random chars |
| `JWT_REFRESH_SECRET` | Refresh token secret | 64+ random chars |
| `JWT_EXPIRES_IN` | Access token expiry | `8h` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token expiry | `7d` |
| `BCRYPT_ROUNDS` | Password hashing rounds | `12` |
| `CORS_ORIGIN` | Allowed frontend origin | `https://app.com` |

### Frontend Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `https://api.app.com` |

### Generating Secrets

```bash
# Generate JWT secrets
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## Post-Deployment

### 1. Create First Admin User

Use Supabase SQL Editor:

```sql
-- Create tenant
INSERT INTO tenants (
  name, 
  slug, 
  subscription_status, 
  subscription_tier,
  max_users,
  max_stores,
  max_products
) VALUES (
  'Your Business',
  'your-business',
  'active',
  'professional',
  10,
  3,
  1000
);

-- Create admin (PIN: 1234)
-- Note: In production, use the API to create users so PIN is properly hashed
INSERT INTO user_profiles (
  tenant_id,
  email,
  full_name,
  role,
  pin_hash,
  is_active
) VALUES (
  (SELECT id FROM tenants WHERE slug = 'your-business'),
  'admin@yourbusiness.com',
  'Administrator',
  'tenant_admin',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyNiAYMyzJ/I2K',
  true
);
```

### 2. Create First Store

```sql
INSERT INTO stores (
  tenant_id,
  name,
  code,
  is_active
) VALUES (
  (SELECT id FROM tenants WHERE slug = 'your-business'),
  'Main Store',
  'MAIN',
  true
);
```

### 3. Verify Deployment

- [ ] Frontend loads without errors
- [ ] Can login with admin credentials
- [ ] Can create products
- [ ] Can process test sales
- [ ] Receipts generate correctly

---

## Troubleshooting

### Backend won't start

```bash
# Check logs
pm2 logs appleflow-api

# Common fixes
npm install
npm run build
```

### Database connection errors

- Verify Supabase URL and key
- Check IP allowlist in Supabase
- Ensure service_role key (not anon key)

### CORS errors

- Verify `CORS_ORIGIN` matches frontend URL exactly
- Include protocol (`https://`)
- No trailing slash

### Frontend can't connect to API

- Check `VITE_API_URL` is set correctly
- Verify API is running: `curl https://api-url.com/api/health`

### Build failures

```bash
# Clear and reinstall
rm -rf node_modules package-lock.json
npm install
```

---

## Security Checklist

Before going live:

- [ ] Changed default JWT secrets
- [ ] Using service_role key (not anon key)
- [ ] CORS origin restricted to production domain
- [ ] Rate limiting enabled
- [ ] SSL certificate installed
- [ ] Environment variables not in code
- [ ] Database RLS policies active
- [ ] bcrypt rounds >= 12

---

## Monitoring

### Render
- Built-in metrics dashboard
- Log streams
- Auto-restart on crash

### Self-hosted
```bash
# Monitor with PM2
pm2 monit

# View logs
pm2 logs appleflow-api

# Restart
pm2 restart appleflow-api
```

---

## Updates

To update after code changes:

```bash
# Pull latest code
git pull origin main

# Backend
cd backend
npm install
npm run build
pm2 restart appleflow-api

# Frontend
cd ../frontend
npm install
npm run build
# Copy to nginx if self-hosted
```

---

**Need help?** Open an issue on GitHub or contact support.
