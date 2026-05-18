# Quick Deployment Guide - Render.com

## Why Render?
- ✅ Free tier available
- ✅ Automatic deploys from GitHub
- ✅ Supports Node.js + SQLite
- ✅ Simple UI
- ✅ Custom domain support

---

## Step 1: Prepare GitHub Repository

```bash
# Initialize git (if not already done)
cd c:\Users\342WS\Documents\Chandan\Phoenix
git init
git add .
git commit -m "Initial commit - ready for deployment"
git branch -M main

# Add your GitHub remote
git remote add origin https://github.com/YOUR_USERNAME/invoice-system.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual GitHub username.

---

## Step 2: Create Render Account

1. Go to [render.com](https://render.com)
2. Sign up with GitHub account
3. Authorize Render to access your repositories

---

## Step 3: Deploy Backend Service

### 3a. Create Backend Service
- Click "New+" → "Web Service"
- Select your repository
- Choose the repository and connect

### 3b. Configure Backend
Fill in these settings:

| Setting | Value |
|---------|-------|
| Name | `invoice-backend` |
| Root Directory | `backend` |
| Environment | `Node` |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Plan | `Free` |

### 3c. Add Environment Variables
Click "Environment" and add:

```
FRONTEND_URL=https://invoice-frontend.onrender.com
NODE_ENV=production
PORT=8000
```

(Replace `invoice-frontend.onrender.com` with your actual frontend URL from Step 4)

---

## Step 4: Deploy Frontend Service

### 4a. Create Static Site
- Click "New+" → "Static Site"
- Select the same repository
- Choose the repository and connect

### 4b. Configure Frontend
Fill in these settings:

| Setting | Value |
|---------|-------|
| Name | `invoice-frontend` |
| Root Directory | `frontend` |
| Build Command | `npm install && npm run build` |
| Publish Directory | `dist` |

---

## Step 5: Update Backend CORS (IMPORTANT!)

After frontend is deployed:

1. Get your frontend URL from Render dashboard
   - Format: `https://invoice-frontend.onrender.com`

2. Go to Backend Service → Environment
3. Update `FRONTEND_URL` to your actual frontend URL
4. Render will auto-redeploy

---

## Step 6: Test Your Deployment

1. Visit your frontend URL: `https://invoice-frontend.onrender.com`
2. Try logging in
3. Create a test invoice
4. Generate PDF

---

## Troubleshooting

### Backend returns 500 error
- Check backend logs in Render dashboard
- Verify `FRONTEND_URL` is set correctly

### CORS errors
- Ensure `FRONTEND_URL` matches your frontend domain exactly
- Clear browser cache and try again

### PDF generation fails
- Check storage directory exists: `mkdir -p backend/storage/invoices`
- Verify `pdfkit` is in dependencies

### Database not persisting
- SQLite on free tier resets after 30 days of inactivity
- For production: migrate to PostgreSQL (Render offers free tier)

---

## Important Notes

⚠️ **Free Tier Limitations:**
- Services spin down after 15 minutes of inactivity
- Data may reset periodically
- Limited to 2 free services per month

✅ **To Upgrade:**
- Add payment method in Render account settings
- Paid plans prevent auto spin-down
- Better for production use

---

## Custom Domain (Optional)

1. In Render dashboard, go to Frontend service
2. Click "Settings"
3. Scroll to "Custom Domain"
4. Enter your domain and follow DNS instructions

---

## Next Deployments

After initial setup, deployments are automatic:
1. Make changes locally
2. Commit and push to GitHub
   ```bash
   git add .
   git commit -m "Update: your changes"
   git push
   ```
3. Render automatically builds and deploys

---

## Support Links
- Render Docs: https://render.com/docs
- Create Issue: Add issue tracking to GitHub repo
- Email Support: Available on Render dashboard

