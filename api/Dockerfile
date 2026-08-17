# --- Stage 1: Build Stage ---
FROM node:24-slim AS builder

WORKDIR /app

# Copy package manifests
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY tsconfig.json ./
COPY src ./src
COPY convex ./convex

# Build TypeScript output
RUN npm run build

# --- Stage 2: Production Runner ---
FROM node:24-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Copy package manifests and install production dependencies only
COPY package*.json ./
RUN npm ci --only=production

# Copy compiled build output from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/convex ./convex

# Expose API port
EXPOSE 3000

# Use non-root node user for security
USER node

CMD ["node", "dist/server.js"]
