# Orviohub Production Deployment Guide

This guide details configuration, environment variables, hosting architecture, and operational procedures for deploying Orviohub.

---

## 1. Environment Variable Manifest

Placeholders must be populated with production secrets prior to boot:

```ini
# Fastify Backend Service
PORT=3000
HOST=0.0.0.0
NODE_ENV=production
JWT_SECRET=<strong-random-secret>
COOKIE_SECRET=<strong-random-secret>
CORS_ORIGIN=https://app.orviohub.com,https://admin.orviohub.com

# Convex Database Backend
CONVEX_DEPLOYMENT=<convex-deployment-id>
CONVEX_URL=https://<your-deployment>.convex.cloud

# Payment Gateway (Paystack)
PAYSTACK_PUBLIC_KEY=pk_live_<key>
PAYSTACK_SECRET_KEY=<secret>
PAYSTACK_WEBHOOK_SECRET=<secret>

# Communications & SMS
BREVO_API_KEY=<secret>
TERMII_API_KEY=<secret>
TERMII_SENDER_ID=Orviohub
```

---

## 2. Infrastructure Architecture

```text
       ┌────────────────────────┐
       │   Cloudflare / CDN     │
       └───────────┬────────────┘
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
┌──────────────────┐  ┌──────────────────┐
│   Frontend SPA   │  │ Fastify API Node │
│ (Vercel / Cloud) │  │  (Docker Engine) │
└──────────────────┘  └──────────┬───────┘
                                 │
                                 ▼
                      ┌──────────────────┐
                      │  Convex Cloud DB │
                      │   (Serverless)   │
                      └──────────────────┘
```

---

## 3. Deployment Steps

### Backend (Node.js / Fastify)
```bash
cd backend
npm install --production
npm run build
npm start
```

### Frontend (React / Vite)
```bash
cd frontend
npm install
npm run build
# Deploy 'dist/' directory to static host / Vercel
```

---

## 4. Health Checks & Monitoring
- **Health Check Endpoint**: `GET /api/v1/health`
- **Uptime Monitoring**: Monitor API response times, 5xx error rates, and Convex database function latencies.
