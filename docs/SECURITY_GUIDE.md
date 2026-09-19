# Orviohub Security & Tenant Isolation Guide

This document outlines the defense-in-depth security model, authentication and authorization boundaries, multi-tenant isolation, and incident mitigation policies of the **Orviohub Platform**.

---

## 1. Multi-Tenant Defense-in-Depth Principles

1. **Zero Trust in Client-Supplied Identifiers**:
   - `workspaceId`, `branchId`, and `role` sent in request headers or bodies are **never** trusted unconditionally.
   - The Fastify authorization middleware (`requireWorkspaceRole`) queries the authoritative database membership table on every request.
2. **Strict Tenant Separation**:
   - Every database query in Convex is scoped by the authenticated user's verified `workspaceId`.
   - Any query attempting to access resources belonging to another tenant returns `403 FORBIDDEN` or `404 NOT_FOUND`.
3. **No Cross-Tenant Cache Bleeding**:
   - In-memory cache keys always include the canonical `workspaceId`.
   - Switching organizations flushes cached branch, application, and permission states in both frontend and backend.

---

## 2. Superadmin Governance & Step-Up Authentication

Platform superadmins access systems through `/api/v1/admin/*` guarded by [adminAuth.ts](file:///e:/dev/orvioHub/backend/src/middleware/adminAuth.ts):

| Action Risk Level | Role Requirement | Mandatory Reason | Re-Auth / Step-Up TOTP |
| :--- | :--- | :--- | :--- |
| **Read-Only Inspection** | `read_only_admin` or higher | No | No |
| **Sensitive Mutation** (`suspend`, `revoke-sessions`) | `platform_admin`, `platform_owner` | **Yes (`x-admin-reason`)** | Session Re-Auth |
| **High-Risk Destructive** (`archive`) | `platform_admin`, `platform_owner` | **Yes (`x-admin-reason`)** | **Yes (`x-admin-totp`)** |

If a mutation is attempted without the required reason, the server rejects it with `400 Bad Request`.
If high-risk actions lack valid TOTP verification, the server rejects with `403 Forbidden` (`STEP_UP_AUTHENTICATION_REQUIRED`).

---

## 3. Secret Scrubbing & Data Protection

- `AuditService.sanitizeMetadata()` dynamically redacts sensitive keys matching:
  `/password|secret|token|authorization|api[-_]?key|paystack|card[-_]?number|cvv|totp|otp/i`.
- Audit logs are append-only. Mutation of existing audit rows is prohibited at the database schema level.
- Passwords are encrypted using salted bcrypt (`rounds: 12`).
- JWT tokens are signed using `JWT_SECRET` with strict expiration and refresh-token rotation.
