# Orviohub Platform

Unified multi-application SaaS platform with decoupled personal accounts and organization-based workspace multitenancy.

---

## Workspace Structure

```
orviohub/
├── shared/     Pure TypeScript shared library (@orviohub/shared)
├── backend/    Node.js + Fastify + Convex + TypeScript (http://localhost:3000)
└── frontend/   React 19 + Vite + Tailwind CSS (http://localhost:4000)
```

---

## Subdomain Architecture & Development Routing

In development, a **single Vite dev server** on port `4000` serves all six Orviohub surfaces resolved strictly from the request hostname:

| Surface | Development URL | Production URL | Description |
| :--- | :--- | :--- | :--- |
| **Marketing** | `http://orviohub.localhost:4000` | `https://orviohub.com` | Landing page, pricing, feature showcases |
| **Accounts** | `http://accounts.orviohub.localhost:4000` | `https://accounts.orviohub.com` | Central authentication & profile management |
| **Home** | `http://home.orviohub.localhost:4000` | `https://home.orviohub.com` | User dashboard & organization switcher |
| **Launcher** | `http://app.orviohub.localhost:4000` | `https://app.orviohub.com` | App Launcher, module catalog & organization onboarding |
| **Inventory** | `http://inventory.orviohub.localhost:4000` | `https://inventory.orviohub.com` | Inventory management & POS application |
| **Task Management** | `http://taskmanagement.orviohub.localhost:4000` | `https://taskmanagement.orviohub.com` | Task management application |
| **API Backend** | `http://localhost:3000` | `https://api.orviohub.com` | Central Fastify REST API |

> [!IMPORTANT]
> **Organizations NEVER use subdomains.**
> Subdomains identify application surfaces only. An unrecognized or nested subdomain is rejected with an explicit `400 Bad Request` / error screen and is never defaulted to marketing or interpreted as a workspace slug.

---

## Local Host Resolution & DNS Fallback

Modern browsers (Chrome, Firefox, Edge) resolve `*.localhost` to `127.0.0.1` automatically without configuration. If using Safari or a Linux environment without wildcard loopback resolution, add the following entries to your system `hosts` file (`/etc/hosts` on macOS/Linux or `C:\Windows\System32\drivers\etc\hosts` on Windows):

```
127.0.0.1 orviohub.localhost
127.0.0.1 accounts.orviohub.localhost
127.0.0.1 home.orviohub.localhost
127.0.0.1 app.orviohub.localhost
127.0.0.1 inventory.orviohub.localhost
127.0.0.1 taskmanagement.orviohub.localhost
127.0.0.1 api.orviohub.localhost
```

---

## Quick Start & Scripts

### Prerequisites
- Node.js 20+
- pnpm 10+ (`npm install -g pnpm`)

### Install Dependencies
```bash
pnpm install
```

### Start Development Servers
```bash
# Start both backend (:3000) and frontend (:4000) concurrently
pnpm dev

# Start backend only (:3000)
pnpm dev:backend

# Start frontend only (:4000)
pnpm dev:frontend
```

### Build & Typecheck
```bash
# Typecheck across all workspace packages
pnpm typecheck

# Build all packages
pnpm build

# Run tests
pnpm test
```
