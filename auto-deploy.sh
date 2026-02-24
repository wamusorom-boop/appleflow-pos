#!/bin/bash
# AppleFlow POS - AUTOMATIC DEPLOYMENT SCRIPT
# This script automates 90% of the deployment process

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║   🍎 AppleFlow POS - AUTOMATIC DEPLOYMENT                    ║"
echo "║                                                                ║"
echo "║   This script will guide you through deployment step-by-step ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ============================================
# CHECK PREREQUISITES
# ============================================
echo -e "\n${YELLOW}📋 Checking Prerequisites...${NC}"

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ Git is not installed. Please install Git first:${NC}"
    echo "   https://git-scm.com/downloads"
    exit 1
fi
echo -e "${GREEN}✅ Git is installed${NC}"

# Check if curl is installed
if ! command -v curl &> /dev/null; then
    echo -e "${RED}❌ curl is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ curl is installed${NC}"

# Check Node.js version
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -ge 18 ]; then
        echo -e "${GREEN}✅ Node.js $(node --version) is installed${NC}"
    else
        echo -e "${YELLOW}⚠️  Node.js version is old. Recommended: 18+${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Node.js not found. Will be installed on Render.${NC}"
fi

# ============================================
# GET USER INPUT
# ============================================
echo -e "\n${YELLOW}📝 Please provide the following information:${NC}"

read -p "Your GitHub username: " GITHUB_USERNAME
if [ -z "$GITHUB_USERNAME" ]; then
    echo -e "${RED}❌ GitHub username is required${NC}"
    exit 1
fi

read -p "Repository name [appleflow-pos]: " REPO_NAME
REPO_NAME=${REPO_NAME:-appleflow-pos}

read -p "Your name (for license): " USER_NAME
USER_NAME=${USER_NAME:-"Admin User"}

read -p "Your email (for license): " USER_EMAIL
USER_EMAIL=${USER_EMAIL:-"admin@appleflow.pos"}

echo -e "\n${BLUE}Configuration:${NC}"
echo "  GitHub Username: $GITHUB_USERNAME"
echo "  Repository: $REPO_NAME"
echo "  Name: $USER_NAME"
echo "  Email: $USER_EMAIL"

read -p "Continue? (y/N): " CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo -e "${RED}Deployment cancelled${NC}"
    exit 1
fi

# ============================================
# STEP 1: PREPARE CODE
# ============================================
echo -e "\n${YELLOW}📦 Step 1: Preparing Code...${NC}"

BACKEND_DIR="/mnt/okcomputer/output/appleflow-backend"
cd "$BACKEND_DIR"

# Initialize git if not already
if [ ! -d ".git" ]; then
    git init
    echo -e "${GREEN}✅ Git repository initialized${NC}"
fi

# Create .gitignore if not exists
if [ ! -f ".gitignore" ]; then
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
package-lock.json
yarn.lock
pnpm-lock.yaml

# Build
dist/
build/
*.tsbuildinfo

# Environment
.env
.env.local
.env.*.local

# Database
*.db
*.db-journal

# Logs
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
lerna-debug.log*

# Testing
coverage/
.nyc_output/

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Temporary files
*.tmp
*.temp
.cache/

# Uploads
uploads/
EOF
    echo -e "${GREEN}✅ .gitignore created${NC}"
fi

# Add all files
git add .

# Commit
git commit -m "AppleFlow POS v2.0 ULTIMATE - Ready for deployment" || echo -e "${YELLOW}⚠️  Nothing to commit${NC}"

echo -e "${GREEN}✅ Code prepared${NC}"

# ============================================
# STEP 2: CREATE GITHUB REPO
# ============================================
echo -e "\n${YELLOW}📁 Step 2: Setting up GitHub Repository...${NC}"

# Check if remote exists
if git remote get-url origin &> /dev/null; then
    echo -e "${YELLOW}⚠️  Remote already exists. Updating...${NC}"
    git remote set-url origin "https://github.com/$GITHUB_USERNAME/$REPO_NAME.git"
else
    git remote add origin "https://github.com/$GITHUB_USERNAME/$REPO_NAME.git"
fi

# Rename branch to main
git branch -M main 2>/dev/null || true

echo -e "${BLUE}ℹ️  Please create a repository on GitHub:${NC}"
echo "   URL: https://github.com/new"
echo "   Name: $REPO_NAME"
echo "   Visibility: Public"
echo ""
read -p "Press Enter after creating the repository..."

# Push to GitHub
echo -e "${YELLOW}🚀 Pushing code to GitHub...${NC}"
if git push -u origin main; then
    echo -e "${GREEN}✅ Code pushed to GitHub${NC}"
    echo "   Repository: https://github.com/$GITHUB_USERNAME/$REPO_NAME"
else
    echo -e "${RED}❌ Failed to push to GitHub${NC}"
    echo "   Please check your credentials and try again"
    exit 1
fi

# ============================================
# STEP 3: GENERATE DEPLOYMENT CONFIG
# ============================================
echo -e "\n${YELLOW}⚙️  Step 3: Generating Deployment Configuration...${NC}"

# Generate secure secrets
JWT_SECRET=$(openssl rand -base64 32 2>/dev/null || node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
JWT_REFRESH_SECRET=$(openssl rand -base64 32 2>/dev/null || node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")

# Create deployment config file
DEPLOY_CONFIG="deploy-config.txt"
cat > "$DEPLOY_CONFIG" << EOF
APPLEFLOW POS - DEPLOYMENT CONFIGURATION
=======================================

GitHub Repository: https://github.com/$GITHUB_USERNAME/$REPO_NAME

RENDER.COM SETTINGS
-------------------
Service Name: appleflow-pos-api
Region: Oregon (US West)
Runtime: Node
Plan: Free

Build Command:
npm install && npx prisma generate && npm run build

Start Command:
npx prisma migrate deploy && npm start

ENVIRONMENT VARIABLES
---------------------
NODE_ENV=production
PORT=10000
DATABASE_URL=(will be auto-filled from PostgreSQL)
JWT_SECRET=$JWT_SECRET
JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET
JWT_ACCESS_EXPIRY=900
JWT_REFRESH_EXPIRY=604800
BCRYPT_ROUNDS=12
CORS_ORIGINS=*
LOG_LEVEL=info
MPESA_ENVIRONMENT=sandbox
ENABLE_TAX=false
DEFAULT_TAX_RATE=0
ENABLE_LOYALTY=true
ENABLE_GIFT_CARDS=true
AUTO_CREATE_LICENSES=true

NEXT STEPS
----------
1. Go to https://dashboard.render.com
2. Click "New +" → "PostgreSQL"
3. Name: appleflow-db, Plan: Free
4. Click "Create Database"
5. Wait for it to be available
6. Copy the "Internal Database URL"
7. Click "New +" → "Web Service"
8. Connect your GitHub repo: $REPO_NAME
9. Use the settings above
10. Add the DATABASE_URL from step 6
11. Click "Create Web Service"
12. Wait for deployment to complete
13. Go to Shell tab and run: npx ts-node scripts/create-admin.ts

Your API will be at: https://appleflow-pos-api.onrender.com

EOF

echo -e "${GREEN}✅ Deployment configuration saved to: $DEPLOY_CONFIG${NC}"
cat "$DEPLOY_CONFIG"

# ============================================
# STEP 4: CREATE ONE-CLICK DEPLOY BUTTON
# ============================================
echo -e "\n${YELLOW}🔗 Step 4: Creating One-Click Deploy Button...${NC}"

# Create README with deploy button
README_DEPLOY="README-DEPLOY.md"
cat > "$README_DEPLOY" << EOF
# 🍎 AppleFlow POS - One-Click Deploy

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/$GITHUB_USERNAME/$REPO_NAME)

## Quick Deploy Instructions

### Option 1: One-Click Deploy (Easiest)
Click the button above to deploy directly to Render.com

### Option 2: Manual Deploy

1. **Create Database**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New +" → "PostgreSQL"
   - Name: \\\`appleflow-db\\\`, Plan: **Free**
   - Copy the **Internal Database URL**

2. **Deploy Web Service**
   - Click "New +" → "Web Service"
   - Connect: \\\`$GITHUB_USERNAME/$REPO_NAME\\\`
   - Configure:
     - **Name**: \\\`appleflow-pos-api\\\`
     - **Build Command**: \\\`npm install && npx prisma generate && npm run build\\\`
     - **Start Command**: \\\`npx prisma migrate deploy && npm start\\\`
     - **Plan**: **Free**
   - Add Environment Variables:
     - \\\`DATABASE_URL\\\`: (paste from step 1)
     - \\\`JWT_SECRET\\\`: \\\`$JWT_SECRET\\\`
     - \\\`JWT_REFRESH_SECRET\\\`: \\\`$JWT_REFRESH_SECRET\\\`
     - \\\`CORS_ORIGINS\\\`: \\\`*\\\`

3. **Create Admin User**
   - Go to Shell tab in your service
   - Run: \\\`npx ts-node scripts/create-admin.ts\\\`
   - Follow prompts

4. **Done!** 
   Your API is live at: \\\`https://appleflow-pos-api.onrender.com\\\`

## Test Your Deployment

\\\`\\\`\\\`bash
# Health check
curl https://appleflow-pos-api.onrender.com/health

# Login
curl -X POST https://appleflow-pos-api.onrender.com/api/auth/login \\\
  -H "Content-Type: application/json" \\\
  -d '{"email":"admin@appleflow.pos","pin":"1234"}'
\\\`\\\`\\\`

## License

This software is protected by license keys. Contact the creator for activation.
EOF

echo -e "${GREEN}✅ Deploy README created: $README_DEPLOY${NC}"

# ============================================
# STEP 5: PUSH README TO GITHUB
# ============================================
echo -e "\n${YELLOW}📤 Step 5: Pushing deployment files to GitHub...${NC}"

git add "$DEPLOY_CONFIG" "$README_DEPLOY" 2>/dev/null || true
git commit -m "Add deployment configuration" 2>/dev/null || true
git push origin main

echo -e "${GREEN}✅ Deployment files pushed${NC}"

# ============================================
# SUMMARY
# ============================================
echo -e "\n${GREEN}"
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║   ✅ AUTOMATIC SETUP COMPLETE!                                 ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${BLUE}📊 Summary:${NC}"
echo "  Repository: https://github.com/$GITHUB_USERNAME/$REPO_NAME"
echo "  Config File: $DEPLOY_CONFIG"
echo "  Deploy README: $README_DEPLOY"
echo ""

echo -e "${YELLOW}🚀 NEXT STEPS:${NC}"
echo ""
echo "1. ✅ Code is pushed to GitHub"
echo ""
echo "2. 📝 Sign up on Render.com:"
echo "   https://render.com"
echo ""
echo "3. 🗄️  Create PostgreSQL Database:"
echo "   - Dashboard → New + → PostgreSQL"
echo "   - Name: appleflow-db, Plan: Free"
echo "   - Copy the Internal Database URL"
echo ""
echo "4. 🌐 Deploy Web Service:"
echo "   - Dashboard → New + → Web Service"
echo "   - Connect your GitHub repo"
echo "   - Use settings from: $DEPLOY_CONFIG"
echo ""
echo "5. 👤 Create Admin User:"
echo "   - Go to Shell tab"
echo "   - Run: npx ts-node scripts/create-admin.ts"
echo ""
echo -e "${GREEN}🎉 After these steps, your POS will be LIVE!${NC}"
echo ""
echo -e "${BLUE}📖 Full documentation:${NC}"
echo "   DEPLOY_GUIDE.md - Detailed step-by-step guide"
echo "   QUICK_DEPLOY.md - Quick reference"
echo ""
echo -e "${YELLOW}💡 Need help? Check the troubleshooting section in DEPLOY_GUIDE.md${NC}"
