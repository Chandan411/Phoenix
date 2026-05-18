FROM node:18-alpine

# Install build tools for better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files and lock files
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install backend dependencies (use npm install, not npm ci, for flexibility)
WORKDIR /app/backend
RUN npm install --omit=dev

# Install frontend dependencies and build
WORKDIR /app/frontend
RUN npm install
RUN npm run build

# Copy source code
COPY backend/src ./src
COPY backend/storage ./storage

WORKDIR /app/backend

# Expose port
EXPOSE 8000

# Start server
CMD ["npm", "start"]
CMD ["npm", "start"]
