# Orviohub Infrastructure & Multi-Subdomain Architecture Guide

This document outlines the DNS, TLS, load balancing, reverse proxy routing, container orchestration, and monitoring configuration for Orviohub's multi-subdomain architecture.

---

## 1. Domain & DNS Configuration

Orviohub operates on a **subdomain-per-product** architecture:
- **Production Root:** `orviohub.com`
- **Preproduction / Staging Root:** `preprod.orviohub.com` (and `orviohub.vercel.app`)
- **Development Root:** `orviohub.localhost`

### DNS Zone File (`orviohub.com`)

```dns
; -----------------------------------------------------------------------------
; Orviohub Production DNS Zone File
; Domain: orviohub.com
; TTL: 300
; -----------------------------------------------------------------------------
$ORIGIN orviohub.com.
$TTL 300

; SOA & NS Records
@                   IN  SOA   ns1.orviohub.com. hostmaster.orviohub.com. (
                              2026092301 ; Serial
                              7200       ; Refresh (2h)
                              3600       ; Retry (1h)
                              1209600    ; Expire (2w)
                              300        ; Minimum TTL (5m)
                              )
@                   IN  NS    ns1.orviohub.com.
@                   IN  NS    ns2.orviohub.com.

; Root Marketing & Website
@                   IN  A     76.76.21.21             ; Vercel / Cloud Load Balancer Anycast
www                 IN  CNAME orviohub.com.

; Core Application Subdomains (Single-Page App Surfaces)
account             IN  CNAME cname.vercel-dns.com.   ; Accounts & Central Authentication
accounts            IN  CNAME account.orviohub.com.   ; Canonical Alias for Accounts
home                IN  CNAME cname.vercel-dns.com.   ; Hub, Workspace Switcher, App Launcher
app                 IN  CNAME home.orviohub.com.      ; App Launcher Alias
inventory           IN  CNAME cname.vercel-dns.com.   ; Inventory & Point of Sale (POS)
billing             IN  CNAME cname.vercel-dns.com.   ; Subscriptions & Invoice Management
taskmanagement      IN  CNAME cname.vercel-dns.com.   ; Task Management (Future Expansion)

; Backend API Gateway
api                 IN  A     34.120.54.99            ; Fastify Production Cluster / Load Balancer

; Preproduction Environment Subdomain Delegation
preprod             IN  A     76.76.21.21
*.preprod           IN  CNAME preprod.orviohub.com.

; Email & Security Verification (Brevo / SPF / DKIM / DMARC)
@                   IN  TXT   "v=spf1 include:spf.sendinblue.com include:_spf.google.com ~all"
mail._domainkey     IN  TXT   "k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQ..."
_dmarc              IN  TXT   "v=DMARC1; p=reject; rua=mailto:dmarc-reports@orviohub.com; pct=100; sp=reject"
```

---

## 2. TLS & SSL Certificate Provisioning

To support wildcard and individual subdomain SSL termination without handshake latency:

1. **Production Wildcard Certificate**:
   - **Common Name (CN):** `orviohub.com`
   - **Subject Alternative Names (SANs):**
     - `orviohub.com`
     - `*.orviohub.com`
     - `preprod.orviohub.com`
     - `*.preprod.orviohub.com`
2. **ACME / Let's Encrypt Automation**:
   - Automated DNS-01 challenge via Cloudflare / Route53 API.
   - Auto-renewed at 60 days before expiration.
3. **HSTS Enforcement**:
   - `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` header is automatically emitted on all HTTP responses in production.

---

## 3. Reverse Proxy Configuration (NGINX / Caddy)

### NGINX Configuration (`/etc/nginx/conf.d/orviohub.conf`)

```nginx
# -----------------------------------------------------------------------------
# Upstream Definitions
# -----------------------------------------------------------------------------
upstream frontend_spa {
    server web:80;
    keepalive 32;
}

upstream backend_api {
    server api:4000;
    keepalive 64;
}

# -----------------------------------------------------------------------------
# HTTP -> HTTPS Redirect
# -----------------------------------------------------------------------------
server {
    listen 80;
    listen [::]:80;
    server_name orviohub.com *.orviohub.com orviohub.localhost *.orviohub.localhost;
    return 301 https://$host$request_uri;
}

# -----------------------------------------------------------------------------
# Backend API (api.orviohub.com)
# -----------------------------------------------------------------------------
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.orviohub.com api.preprod.orviohub.com api.orviohub.localhost;

    ssl_certificate /etc/ssl/certs/orviohub_wildcard.crt;
    ssl_certificate_key /etc/ssl/private/orviohub_wildcard.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://backend_api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Request-Host $host;
    }
}

# -----------------------------------------------------------------------------
# Multi-Subdomain SPA Frontend (Host-Based Client Resolution)
# -----------------------------------------------------------------------------
server {
    listen 443 ssl http2 default_server;
    listen [::]:443 ssl http2 default_server;
    server_name orviohub.com *.orviohub.com orviohub.localhost *.orviohub.localhost;

    ssl_certificate /etc/ssl/certs/orviohub_wildcard.crt;
    ssl_certificate_key /etc/ssl/private/orviohub_wildcard.key;

    # Pass all subdomains to SPA (Single Page Application handles host context)
    location / {
        proxy_pass http://frontend_spa;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Proxy /api requests to Fastify API Gateway
    location /api/ {
        proxy_pass http://backend_api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Request-Host $host;
    }
}
```

---

## 4. Multi-Subdomain Docker Orchestration

The Orviohub frontend uses **Host-Based Runtime Application Mounting**:
A single high-performance SPA bundle is served by the `web` container. When a user requests `inventory.orviohub.com` vs `accounts.orviohub.com`, the shared package resolves `window.location.hostname` and dynamically mounts the appropriate root product router without requiring multiple isolated frontend deployments.

### `docker-compose.yml`

```yaml
version: '3.8'

services:
  # Fastify API Backend Service
  api:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: orviohub-api
    restart: unless-stopped
    ports:
      - "4000:4000"
    environment:
      - PORT=4000
      - HOST=0.0.0.0
      - NODE_ENV=production
      - LOG_LEVEL=info
      - CONVEX_URL=${CONVEX_URL}
      - JWT_SECRET=${JWT_SECRET}
      - APP_URL=https://orviohub.com
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4000/health"]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 10s

  # Multi-Subdomain SPA Frontend Web Service
  web:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: orviohub-web
    restart: unless-stopped
    ports:
      - "80:80"
    depends_on:
      - api
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:80/"]
      interval: 15s
      timeout: 5s
      retries: 3
```

---

## 5. Subdomain Health Checks & Synthetic Monitoring

Each application subdomain provides a verifiable health checking mechanism:

| Application | Endpoint | Expected Status | Description |
|---|---|---|---|
| **API Gateway** | `https://api.orviohub.com/health` | `200 OK` | Backend readiness, database connectivity & Convex state |
| **Accounts** | `https://accounts.orviohub.com/api/v1/health` | `200 OK` | Accounts auth subsystem & session state |
| **Home / Hub** | `https://home.orviohub.com/api/v1/health` | `200 OK` | Workspace navigation & launcher subsystem |
| **Inventory** | `https://inventory.orviohub.com/api/v1/health` | `200 OK` | Products, stocks, registers & POS |
| **Billing** | `https://billing.orviohub.com/api/v1/health` | `200 OK` | Paystack/Flutterwave billing subsystem |

### Monitoring Strategy:
- **BetterStack / UptimeRobot Synthetic Probes:**
  - Configured to query `https://<subdomain>.orviohub.com/health` every 60 seconds from multiple geographic regions (Lagos, London, Frankfurt, Ashburn).
  - Triggers alerts on response times exceeding 2000ms or non-200 HTTP status.

---

## 6. Checklist for Adding a New Application Subdomain

When launching a new application (e.g. `crm`, `taskmanagement`, `analytics`):

- [ ] **1. Application Definition (`shared/src/applications.ts`)**:
  - Add entry to `ApplicationKey` and `applications` record with `type: 'subdomain'`, `subdomain: '<key>'`, and environment URLs.
- [ ] **2. Subdomain Host Context (`shared/src/host.ts`)**:
  - Add subdomain name to `normalizeSubdomain()` mapper.
- [ ] **3. CORS Origin Allowlist (`shared/src/allowlist.ts`)**:
  - Register `http://<subdomain>.orviohub.localhost:3000` in `developmentOrigins`.
  - Register `https://<subdomain>.orviohub.com` in `productionOrigins`.
  - Rebuild shared package: `npm run build && npm test`.
- [ ] **4. CSP `connect-src` (`backend/src/app.ts`)**:
  - Add `https://<subdomain>.orviohub.com` and `https://<subdomain>.preprod.orviohub.com` to `connectSrcDirectives`.
- [ ] **5. Vite `allowedHosts`**:
  - Verified automatically via `getAllowedHosts()`.
- [ ] **6. DNS Provisioning**:
  - Add CNAME record: `<subdomain> IN CNAME orviohub.com.` (or Vercel CNAME).
- [ ] **7. TLS Certificate Verification**:
  - Verify wildcard SAN covers `*.<domain>` (already included in `*.orviohub.com`).
- [ ] **8. Automated Test Coverage**:
  - Add integration test in `backend/test/subdomain-path-architecture.test.ts` verifying host resolution, CORS, and cookie scope.
