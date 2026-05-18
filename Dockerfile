FROM node:18-alpine

# Install build tools for better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install backend dependencies
WORKDIR /app/backend
RUN npm ci --omit=dev

# Install frontend dependencies and build
WORKDIR /app/frontend
RUN npm ci
RUN npm run build

# Copy source code
COPY backend/src ./src
COPY backend/storage ./storage

WORKDIR /app/backend

# Expose port
EXPOSE 8000

# Start server
CMD ["npm", "start"]
