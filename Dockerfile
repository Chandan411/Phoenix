FROM node:18-alpine

# Install build tools for better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy everything needed
COPY backend ./backend
COPY frontend ./frontend

# Install backend dependencies
WORKDIR /app/backend
RUN npm install --omit=dev

# Install frontend dependencies and build
WORKDIR /app/frontend
RUN npm install
RUN npm run build

# Copy built frontend to backend public folder
RUN mkdir -p ../backend/public && cp -r dist/* ../backend/public/

WORKDIR /app/backend

# Expose port
EXPOSE 8000

# Start server
CMD ["npm", "start"]
CMD ["npm", "start"]
