# Deployment Commands Cheat Sheet

## Local Testing (Before Deployment)

```bash
# Build frontend
cd frontend
npm install
npm run build
cd ..

# Test backend with production frontend
cd backend
npm install
npm start
```

Visit `http://localhost:8000` - you should see the frontend!

---

## GitHub Setup

```bash
# Initialize repository
cd c:\Users\342WS\Documents\Chandan\Phoenix
git init
git add .
git commit -m "Initial commit"
git branch -M main

# Add remote (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/invoice-system.git
git push -u origin main

# Future pushes
git add .
git commit -m "Your message"
git push
```

---

## Render Deployment

### Option A: Using Render UI (Easiest)
1. Connect GitHub at render.com
2. Create Web Service for backend
3. Create Static Site for frontend
4. Done!

### Option B: Using Render CLI
```bash
npm install -g @render/cli
render login
render deploy
```

---

## Docker Deployment (Advanced)

```bash
# Build Docker image
docker build -t invoice-system .

# Run locally
docker run -p 8000:8000 \
  -e NODE_ENV=production \
  -e FRONTEND_URL=http://localhost:8000 \
  invoice-system

# Push to Docker Hub
docker tag invoice-system YOUR_USERNAME/invoice-system
docker push YOUR_USERNAME/invoice-system
```

---

## Environment Variables Checklist

### Backend (Required)
- [ ] `PORT=8000`
- [ ] `NODE_ENV=production`
- [ ] `FRONTEND_URL=<your-frontend-domain>`

### Frontend (Optional, for custom API URL)
- [ ] `VITE_API_URL=<your-backend-domain>`

---

## Post-Deployment Tests

```bash
# Check backend health
curl https://your-backend-url/api/health

# List invoices (requires auth token)
curl https://your-backend-url/api/invoices

# Test CORS
curl -H "Origin: https://your-frontend-url" \
     https://your-backend-url/api/health
```

---

## Rollback / Revert

If deployment has issues:

```bash
# View deployment history
git log --oneline

# Revert to previous version
git revert <commit-hash>
git push

# Or reset (loses changes)
git reset --hard <commit-hash>
git push --force
```

---

## Monitoring & Logs

### Render Dashboard
1. Log in to render.com
2. Select service
3. Click "Logs" tab
4. Real-time logs appear

### Local Testing
```bash
# Start with verbose logging
NODE_DEBUG=http npm start
```

---

## Common Fixes

### 500 Error
```bash
# Check directory exists
mkdir -p backend/storage/invoices

# Check permissions
chmod -R 755 backend/storage
```

### CORS Error
```bash
# Verify FRONTEND_URL in backend environment
# Example value: https://invoice-frontend.onrender.com
```

### Build Fails
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
npm run build
```

