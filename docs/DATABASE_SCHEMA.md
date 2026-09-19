# Orviohub Database Schema & Data Dictionary

Orviohub utilizes **Convex** as its authoritative reactive database layer. All persistent records are strictly scoped by tenant identifiers.

---

## 1. Table Schema Directory

| Table Name | Category | Primary Key | Canonical Tenant Key | Retention | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`users`** | Authoritative | `_id` | N/A (Global Identity) | Indefinite | User account credentials, phone, verification state |
| **`workspaces`** | Authoritative | `_id` | `_id` (Self) | Indefinite | Root Organization/Tenant container, plan, country, status |
| **`workspace_members`** | Authoritative | `_id` | `workspaceId` | Indefinite | User-to-Organization membership bindings and roles |
| **`applications`** | Authoritative | `_id` | `workspaceId` | Indefinite | Application enablement per organization (`inventory`, etc.) |
| **`branches`** | Authoritative | `_id` | `workspaceId` | Indefinite | Physical/logical operational branches for an application |
| **`branch_members`** | Authoritative | `_id` | `workspaceId` | Indefinite | Granular branch team role assignments |
| **`subscriptions`** | Authoritative | `_id` | `workspaceId` | Indefinite | Active billing plan, trial start/end, Paystack refs |
| **`audit_events`** | Authoritative | `_id` | `workspaceId` | Append-Only (7 yrs) | Immutable audit trails, sanitized event metadata |
| **`notifications`** | Authoritative | `_id` | `workspaceId` (or `userId`) | 90 Days | In-app user notifications and delivery state |
| **`admin_users`** | Authoritative | `_id` | N/A (Platform Scope) | Indefinite | Platform superadmin accounts and 5-role assignments |
| **`admin_audit_logs`** | Authoritative | `_id` | `targetId` | Append-Only (7 yrs) | Administrative action logs, reasons, and target refs |

---

## 2. Table Detail Specifications

### `workspaces` (Organizations)
```typescript
{
  _id: Id<"workspaces">,
  name: string,
  slug: string,
  ownerId: Id<"users">,
  status: "active" | "suspended" | "archived" | "creating",
  country: string,            // "NG"
  currency: string,           // "NGN"
  timezone: string,           // "Africa/Lagos"
  plan: "free_trial" | "standard" | "premium",
  trialEndsAt?: number,       // Timestamp (createdAt + 30 days)
  createdAt: number,
  updatedAt: number
}
```

### `branches`
```typescript
{
  _id: Id<"branches">,
  workspaceId: Id<"workspaces">,
  productKey: "inventory",
  name: string,
  code: string,               // Unique within workspace
  isPrimary: boolean,         // Invariant: Exactly 1 primary per org
  status: "active" | "suspended" | "archived",
  country: string,
  state?: string,
  city?: string,
  managerUserId?: Id<"users">,
  createdAt: number,
  updatedAt: number
}
```

### `audit_events`
```typescript
{
  _id: Id<"audit_events">,
  eventId: string,            // UUIDv4
  workspaceId: Id<"workspaces">,
  branchId?: Id<"branches">,
  actorUserId?: Id<"users">,
  actorType: "user" | "admin" | "system",
  eventType: string,          // e.g. "branch.created", "org.suspended"
  severity: "low" | "medium" | "high" | "critical",
  metadata?: Record<string, unknown>, // Sanitized (No secrets/PII)
  occurredAt: number
}
```

---

## 3. Sensitive Data Masking Policy

Under no circumstances may the following fields be persisted in database logs or returned to client applications:
1. Passwords / Password hashes
2. JWT session secrets / Refresh tokens
3. TOTP secrets / Step-up token signatures
4. Paystack secret keys
5. Full payment card PANs / CVVs
6. Raw SMS verification OTPs
