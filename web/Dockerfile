# --- Stage 1: Build Stage ---
FROM node:24-alpine AS builder

WORKDIR /app

# Copy manifests & install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code & configs
COPY tsconfig*.json ./
COPY vite.config.ts ./
COPY components.json ./
COPY index.html ./
COPY src ./src
COPY public ./public

# Build Vite application for production
RUN npm run build

# --- Stage 2: Serve via Nginx ---
FROM nginx:alpine AS runner

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static output from builder
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
