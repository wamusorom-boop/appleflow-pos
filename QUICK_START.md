# 🚀 AppleFlow POS - QUICK START (5 Minutes to Live!)

**Deploy your POS system for FREE in 5 minutes with ZERO coding!**

---

## ⚡ ONE-CLICK DEPLOY (Fastest Method)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/YOUR_USERNAME/appleflow-pos)

**Replace `YOUR_USERNAME` with your GitHub username after pushing code!**

---

## 📋 Step-by-Step (Copy-Paste Commands)

### Step 1: Push to GitHub (2 min)

```bash
cd /mnt/okcomputer/output/appleflow-backend
git init
git add .
git commit -m "AppleFlow POS - Production Ready"
git branch -M main
# Replace YOUR_USERNAME with your actual GitHub username:
git remote add origin https://github.com/YOUR_USERNAME/appleflow-pos.git
git push -u origin main
```

### Step 2: Deploy to Render (3 min)

1. Go to: https://dashboard.render.com
2. Click **New +** → **Web Service**
3. Connect your `appleflow-pos` repo
4. Fill in:
   - **Name**: `appleflow-pos-api`
   - **Build Command**: `npm install && npx prisma generate && npm run build`
   - **Start Command**: `npx prisma migrate deploy && npm start`
   - **Plan**: Free
5. Add these Environment Variables:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | *(Create PostgreSQL first, copy URL)* |
| `JWT_SECRET` | `super-secret-jwt-key-change-this` |
| `JWT_REFRESH_SECRET` | `another-secret-key-change-this` |
| `CORS_ORIGINS` | `*` |

6. Click **Create Web Service**

✅ **DONE!** Your API will be live at `https://appleflow-pos-api.onrender.com`

---

## 🧪 Test Everything (Automated)

### Option A: Run Automated Test Script

```bash
# After deployment, run this locally:
cd /mnt/okcomputer/output/appleflow-backend
./scripts/test-all.sh https://appleflow-pos-api.onrender.com
```

### Option B: Manual Quick Test

```bash
# 1. Health Check
curl https://appleflow-pos-api.onrender.com/health

# 2. Create Admin (via Render Shell)
# Go to Render Dashboard → Shell → Run: npx ts-node scripts/create-admin.ts

# 3. Login
curl -X POST https://appleflow-pos-api.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@appleflow.pos","pin":"1234"}'

# 4. Test Products (replace TOKEN with your accessToken)
curl https://appleflow-pos-api.onrender.com/api/products \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📊 What's Included (FREE Forever)

| Feature | Status |
|---------|--------|
| ✅ PostgreSQL Database | 1GB FREE |
| ✅ Node.js API | 512MB RAM FREE |
| ✅ SSL/HTTPS | Auto FREE |
| ✅ Automatic Deploys | From GitHub FREE |
| ✅ Health Monitoring | Built-in FREE |

---

## 🎯 Your URLs After Deploy

| Service | URL |
|---------|-----|
| API Base | `https://appleflow-pos-api.onrender.com` |
| Health Check | `https://appleflow-pos-api.onrender.com/health` |
| API Docs | `https://appleflow-pos-api.onrender.com/api-docs` |

---

## 💰 Cost: $0.00 FOREVER

**Render Free Tier Includes:**
- 1 Web Service (always free)
- 1 PostgreSQL Database (1GB, always free)
- Unlimited SSL certificates
- 100GB bandwidth/month

---

## 🎉 You're Live!

Your AppleFlow POS is now:
- ✅ Running on the cloud
- ✅ Accessible from any device
- ✅ Ready for real transactions
- ✅ FREE forever!

**Next Steps:**
1. Test all features using the checklist in RENDER_DEPLOY.md
2. Configure M-Pesa (see M-PESA_SETUP.md)
3. Connect hardware (see HARDWARE.md)

---

## 🆘 Need Help?

**Common Issues:**

| Problem | Fix |
|---------|-----|
| Build fails | Add `npx prisma generate` to build command |
| Database error | Use Internal Database URL (not external) |
| CORS errors | Set `CORS_ORIGINS=*` |

**Support:** Check `RENDER_DEPLOY.md` for full troubleshooting guide.

---

**🚀 DEPLOYED IN 5 MINUTES - KIMI POWER! 💪**
