#!/bin/bash
# Pre-deployment checklist script
# Run this before deploying to production

echo "🔍 Pre-Deployment Checklist"
echo "========================================="
echo ""

# Check Node.js
echo "✓ Checking Node.js version..."
node --version
npm --version

# Check frontend build
echo ""
echo "✓ Building frontend..."
cd frontend
npm install
npm run build
if [ $? -ne 0 ]; then
  echo "❌ Frontend build failed!"
  exit 1
fi
echo "✅ Frontend build successful!"
cd ..

# Check backend
echo ""
echo "✓ Checking backend dependencies..."
cd backend
npm install
if [ $? -ne 0 ]; then
  echo "❌ Backend dependency install failed!"
  exit 1
fi
echo "✅ Backend dependencies installed!"

# Check for required files
echo ""
echo "✓ Checking required files..."
if [ ! -f "src/index.js" ]; then
  echo "❌ backend/src/index.js not found!"
  exit 1
fi
if [ ! -f "../frontend/dist/index.html" ]; then
  echo "❌ frontend/dist/index.html not found!"
  exit 1
fi
echo "✅ All required files present!"

cd ..

echo ""
echo "========================================="
echo "✅ All checks passed! Ready for deployment."
echo ""
echo "Next steps:"
echo "1. Create GitHub repository and push code"
echo "2. Choose deployment platform (Render/Railway recommended)"
echo "3. Set environment variables:"
echo "   - FRONTEND_URL (for backend CORS)"
echo "   - NODE_ENV=production"
echo "4. Deploy!"
echo ""
