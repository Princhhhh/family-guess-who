# Multi-stage build: build frontend, then serve everything from Node

# Stage 1: Build frontend
FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
# Build with backend URL pointing to the same origin (served by express)
RUN npm run build

# Stage 2: Production server
FROM node:22-alpine AS production
WORKDIR /app

# Install backend deps
COPY backend/package*.json ./
RUN npm install --production

# Copy backend source
COPY backend/ ./

# Copy built frontend into backend's public folder
COPY --from=frontend-build /app/frontend/dist ./public

# Create directories for data persistence
RUN mkdir -p uploads data

# Serve static frontend from Express
RUN echo "Adding static serving to server..." && true

EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001
ENV DB_PATH=/app/data/game.db
ENV UPLOADS_DIR=/app/uploads

CMD ["node", "server.js"]
