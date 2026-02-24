# 🚀 QUICK DEPLOY - AppleFlow POS

## ⚡ GET LIVE IN 5 MINUTES

### Step 1: Push to GitHub (1 min)
```bash
cd /mnt/okcomputer/output/appleflow-backend
git init
git add .
git commit -m "AppleFlow POS v2.0"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/appleflow-pos.git
git push -u origin main
```

### Step 2: Create Database on Render (1 min)
1. https://dashboard.render.com → **New +** → **PostgreSQL**
2. Name: `appleflow-db`, Plan: **Free**
3. Click **Create Database**
4. Copy the **Internal Database URL**

### Step 3: Deploy API (2 min)
1. https://dashboard.render.com → **New +** → **Web Service**
2. Connect your `appleflow-pos` repo
3. Configure:
   - **Name**: `appleflow-pos-api`
   - **Build**: `npm install && npx prisma generate && npm run build`
   - **Start**: `npx prisma migrate deploy && npm start`
   - **Plan**: Free
4. Add Environment Variables:
   | Key | Value |
   |-----|-------|
   | `DATABASE_URL` | *(paste from Step 2)* |
   | `JWT_SECRET` | `your-secret-key` |
   | `JWT_REFRESH_SECRET` | `another-secret` |
   | `CORS_ORIGINS` | `*` |
5. Click **Create Web Service**

### Step 4: Create Admin (1 min)
1. In Render Dashboard → your service → **Shell**
2. Run: `npx ts-node scripts/create-admin.ts`
3. Enter: Name, Email, PIN

### ✅ DONE!
Your API is live at: `https://appleflow-pos-api.onrender.com`

---

## 🧪 TEST IT

```bash
# Health check
curl https://appleflow-pos-api.onrender.com/health

# Login
curl -X POST https://appleflow-pos-api.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@appleflow.pos","pin":"1234"}'
```

---

## 🆘 TROUBLESHOOTING

| Problem | Fix |
|---------|-----|
| Build fails | Check build command includes `npx prisma generate` |
| Database error | Use **Internal** URL (not External) |
| CORS errors | Set `CORS_ORIGINS=*` |
| Port error | Use `PORT=10000` (Render default) |

---

**Full guide:** `/appleflow-backend/DEPLOY_GUIDE.md`

**🎉 YOU'RE LIVE!**
