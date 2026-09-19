# Orviohub REST API Reference

All Orviohub API endpoints are versioned under `/api/v1`. Authentication requires a Bearer JWT passed in the `Authorization` header (`Authorization: Bearer <token>`).

---

## 1. Organizations & Workspaces

### `GET /api/v1/workspaces`
- **Purpose**: List all organizations the authenticated user belongs to.
- **Auth**: User Session / Bearer Token.
- **Permissions**: Any active user.
- **Response**: `200 OK`
```json
{
  "success": true,
  "workspaces": [
    {
      "id": "ws_12345",
      "name": "Lagos Ventures",
      "plan": "free_trial",
      "role": "owner",
      "status": "active"
    }
  ]
}
```

### `POST /api/v1/workspaces`
- **Purpose**: Create a new organization with 30-day Free Trial defaults, initial Inventory application state, and primary demo branch.
- **Auth**: User Session / Bearer Token.
- **Body**:
```json
{
  "name": "Lagos Ventures",
  "slug": "lagos-ventures",
  "country": "NG",
  "currency": "NGN",
  "timezone": "Africa/Lagos",
  "phone": "+2348012345678"
}
```
- **Responses**:
  - `201 Created`: Returns newly provisioned workspace and primary branch.
  - `400 Bad Request`: Nigerian phone/country invalid or user already has an active Free Trial organization.
  - `403 Forbidden`: User already owns 3 organizations (maximum limit reached).

### `GET /api/v1/workspaces/:workspaceId/audit`
- **Purpose**: Retrieve immutable, tenant-scoped audit trail.
- **Auth**: User Bearer Token.
- **Permissions**: Workspace `owner` or `admin`.
- **Response**: `200 OK` containing sanitized audit records.

---

## 2. Applications

### `GET /api/v1/organizations/:id/applications`
- **Purpose**: Retrieve application registry status for the organization.
- **Response**:
```json
{
  "success": true,
  "applications": [
    { "key": "inventory", "name": "Inventory Management", "status": "active", "isAvailable": true },
    { "key": "pos", "name": "Point of Sale", "status": "coming_soon", "isAvailable": false },
    { "key": "booking", "name": "Bookings", "status": "coming_soon", "isAvailable": false }
  ]
}
```

### `POST /api/v1/organizations/:id/applications/:key/activate`
- **Purpose**: Activate an application (only `inventory` permitted in MVP).
- **Responses**:
  - `200 OK`: Inventory activated.
  - `400 Bad Request`: If activating future apps (`pos`, `booking`, `gym`), returns `{ error: "APPLICATION_NOT_AVAILABLE" }`.

---

## 3. Branches

### `GET /api/v1/workspaces/:workspaceId/inventory/branches`
- **Purpose**: List active branches for the Inventory application.
- **Permissions**: Workspace member with Inventory access.
- **Response**: `200 OK`

### `POST /api/v1/workspaces/:workspaceId/inventory/branches`
- **Purpose**: Create a new branch under the active organization.
- **Permissions**: Workspace `owner` or `admin`.
- **Body**:
```json
{
  "name": "Victoria Island Annex",
  "code": "BR-VI-02",
  "city": "Lagos",
  "state": "Lagos",
  "country": "NG"
}
```
- **Responses**:
  - `201 Created`: Branch created.
  - `403 Forbidden`: Branch limit exceeded (Free Trial: 1, Standard: 3, Premium: 10).
  - `400 Bad Request`: Duplicate branch code.

### `POST /api/v1/workspaces/:workspaceId/inventory/branches/:branchId/set-primary`
- **Purpose**: Atomically designate a branch as the organization's primary branch.
- **Permissions**: Workspace `owner` or `admin`.
- **Response**: `200 OK`

### `POST /api/v1/workspaces/:workspaceId/inventory/branches/:branchId/archive`
- **Purpose**: Archive a branch.
- **Responses**:
  - `200 OK`: Archived successfully.
  - `400 Bad Request`: Cannot archive the active primary branch.

---

## 4. Notifications

### `GET /api/v1/notifications`
- **Purpose**: Fetch paginated notifications for current user.
- **Query Params**: `unreadOnly=true`, `page=1`, `limit=20`.

### `PATCH /api/v1/notifications/:id/read`
- **Purpose**: Mark a specific notification as read.

### `POST /api/v1/notifications/read-all`
- **Purpose**: Mark all notifications as read for current user.

### `GET /api/v1/notifications/preferences` & `PATCH /preferences`
- **Purpose**: Read/update notification channel preferences.
- **Guardrail**: `securityAlertsAlwaysOn` cannot be set to `false`.

---

## 5. Superadmin Portal (`/api/v1/admin/*`)

### `GET /api/v1/admin/organizations`
- **Purpose**: Directory of all customer organizations with search & filters.
- **Auth**: Superadmin session (`platform_owner`, `platform_admin`, `support_admin`, `billing_admin`, `read_only_admin`).

### `GET /api/v1/admin/organizations/:id`
- **Purpose**: Retrieve full 8-tab inspection details (Overview, Applications, Branches, Members, Invitations, Onboarding, Billing, Audit).

### `POST /api/v1/admin/organizations/:id/suspend`
- **Purpose**: Suspend customer organization.
- **Headers/Body**: Mandatory `reason` required.
- **Permissions**: `platform_owner`, `platform_admin`.

### `POST /api/v1/admin/organizations/:id/archive`
- **Purpose**: High-risk archival of organization.
- **Headers**: Mandatory `x-admin-totp: <otp>` step-up verification token.
- **Permissions**: `platform_owner`, `platform_admin`.
