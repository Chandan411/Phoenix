# Deployment Guide - Vistar Enterprises Invoice System

## Project Overview
- **Frontend**: React (Vite) running on port 5173
- **Backend**: Node.js/Express running on port 8000
- **Database**: SQLite (local file: `billing.db`)
- **Architecture**: Full-stack application with PDF generation

---

## Deployment Options & Recommendations

### ✅ **Option 1: RENDER.COM (Recommended - Free Tier Available)**
**Pros**: Free tier, automatic deploys from Git, easy setup, supports Node.js + SQLite  
**Cons**: Free tier has limitations (spins down after inactivity)

#### Steps:
1. Push your code to GitHub (create repo if needed)
2. Sign up at [render.com](https://render.com)
3. Create two services:
   - **Backend**: Node.js service pointing to `/backend`
   - **Frontend**: Static site pointing to `/frontend/dist` (built output)

#### Backend Setup on Render:
- Build Command: `cd backend && npm install && npm run build` (if needed)
- Start Command: `npm start`
- Environment: Node 18+
- Add environment variables:
  ```
  PORT=8000
  NODE_ENV=production
  ```

#### Frontend Setup on Render:
- Build Command: `cd frontend && npm install && npm run build`
- Publish Directory: `frontend/dist`

---

### ✅ **Option 2: RAILWAY.APP**
**Pros**: Generous free credits, simple deployment, auto-scaling  
**Cons**: Requires credit card for free tier

#### Steps:
1. Push to GitHub
2. Sign up at [railway.app](https://railway.app)
3. Create two projects (Backend + Frontend)
4. Connect GitHub repo and let Railway auto-detect `package.json`

---

### ✅ **Option 3: VERCEL (Frontend Only)**
**Pros**: Optimized for React, fast CDN, free tier  
**Cons**: Backend would need separate hosting

#### Steps:
1. Push frontend to GitHub separately
2. Import at [vercel.com](https://vercel.com)
3. Set API endpoint to your backend URL (via environment variables)

---

### ✅ **Option 4: AWS/HEROKU/DIGITAL OCEAN**
For production-grade deployments with custom domain support

---

## Pre-Deployment Checklist

### ✅ Step 1: Fix Backend CORS
The backend currently hardcodes `http://localhost:5173`. Update this:

**File**: `backend/src/index.js`
```javascript
// Change from:
app.use(cors({ origin: 'http://localhost:5173' }));

// To:
app.use(cors({ 
  origin: process.env.FRONTEND_URL || 'http://localhost:5173' 
}));
```

### ✅ Step 2: Prepare Environment Variables
Create `.env` files for production:

**Backend `.env`**:
```
PORT=8000
NODE_ENV=production
FRONTEND_URL=https://your-frontend-domain.com
DATABASE_PATH=./billing.db
```

**Frontend `.env.production`**:
```
VITE_API_URL=https://your-backend-domain.com
```

### ✅ Step 3: Build & Test Locally
```bash
# Frontend build
cd frontend
npm install
npm run build

# Backend production start
cd ../backend
npm install
npm start
```

### ✅ Step 4: Handle SQLite Database Persistence
**Important**: SQLite stores data in a local file (`billing.db`).  
For production, consider:
1. **Render/Railway**: SQLite works but resets on deploy (free tier)
2. **Better Solution**: Migrate to PostgreSQL (free tier available on Render)

---

## Full Stack Setup Using Docker (Recommended for Complex Deployments)

Create `Dockerfile` in root:
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy both frontend and backend
COPY frontend /app/frontend
COPY backend /app/backend

# Install dependencies
WORKDIR /app/frontend
RUN npm install && npm run build

WORKDIR /app/backend
RUN npm install

# Expose port
EXPOSE 8000

# Start backend (frontend served via backend static)
CMD ["npm", "start"]
```

Update backend to serve frontend:
```javascript
const express = require('express');
const path = require('path');
const app = express();

// Serve frontend build
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// API routes
app.use('/api/invoices', invoicesRouter);
app.use('/api/auth', authRouter);

// Fallback to index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});
```

---

## Quick Start - Render.com Deployment

### 1. Create GitHub Repo
```bash
cd c:\Users\342WS\Documents\Chandan\Phoenix
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/yourusername/invoice-system.git
git push -u origin main
```

### 2. Create `.gitignore`
```
node_modules/
.env
.env.local
*.log
dist/
storage/invoices/
billing.db
```

### 3. Deploy Backend
- Go to [render.com](https://render.com) → New → Web Service
- Connect GitHub repo
- Root Directory: `backend`
- Build Command: `npm install`
- Start Command: `npm start`
- Environment:
  - `PORT=8000`
  - `NODE_ENV=production`
  - `FRONTEND_URL=<your-frontend-url>`

### 4. Deploy Frontend
- New → Static Site
- Root Directory: `frontend`
- Build Command: `npm install && npm run build`
- Publish Directory: `dist`

### 5. Update Backend CORS
- Backend → Environment → Add `FRONTEND_URL=<static-site-url>`

---

## Post-Deployment Checklist

- [ ] Test login functionality
- [ ] Create test invoice
- [ ] Verify PDF generation works
- [ ] Check database persistence (if applicable)
- [ ] Monitor logs for errors
- [ ] Set up email alerts (optional)

---

## Troubleshooting

### **500 Error on Invoice Creation**
- Check backend logs: `database.db` permissions
- Ensure storage directory exists: `mkdir -p backend/storage/invoices`

### **CORS Errors**
- Verify `FRONTEND_URL` in backend environment
- Check browser console for exact error

### **Database Not Persisting**
- SQLite doesn't persist on free tiers (resets on redeploy)
- **Solution**: Use PostgreSQL instead (see migration guide)

### **PDF Generation Fails**
- Ensure `pdfkit` and `number-to-words` are installed
- Check that `/storage/invoices` directory is writable

---

## Next Steps

1. **Choose deployment platform** (Render recommended)
2. **Create GitHub repository**
3. **Update CORS and environment variables**
4. **Test production build locally**
5. **Deploy backend and frontend**
6. **Configure custom domain** (optional)

---

**Questions?** Check platform-specific documentation:
- Render: https://render.com/docs
- Railway: https://docs.railway.app
- Vercel: https://vercel.com/docs
