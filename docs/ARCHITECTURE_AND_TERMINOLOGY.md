# Orviohub Architecture & Terminology Specification
**Distinguishing Customer-Facing "Organization" and Internal Technical "Workspace"**

---

## 1. Executive Summary & Core Decision

This document establishes the official product terminology and architectural boundary for Orviohub:

- **“Organization”** is the **customer-facing term** representing the customer’s business, store, company, team, gym, club, school, or personal operating environment.
- **“Workspace”** is the **internal technical term** representing the secure, isolated technical container and data partition that powers that organization in the Orviohub backend.

### The MVP 1-to-1 Mapping Rule
In the MVP release:
$$\text{1 Customer Organization} \longleftrightarrow \text{1 Backend Workspace}$$

- **No separate `organizations` database table** or independent database entity is created in this phase.
- The existing **`workspaces`** database entity and relational schema remain the single source of truth for membership, RBAC permissions, branch topologies, enabled products, subscriptions, billing, audit logging, onboarding states, and business data.
- Non-technical users interact exclusively with "Organization" (or business-oriented variants such as "Business", "Store", "Staff").
- Where technical context is helpful, the relationship is formally explained as:
  > *“Your organization is managed in an Orviohub workspace.”*

---

## 2. Structural Hierarchy Model

```
Orviohub Account (Mandatory Personal Identity)
├── Personal Profile (Name, photo, contact, bio)
├── Login Methods (Email/password, Google, Facebook)
├── Security & Sessions (MFA, active sessions, audit events)
├── Notifications & Preferences (Theme, language, timezone)
├── Privacy & Data Controls (Data export, consents, deletion)
├── Organization Memberships (0..many: Joined organizations)
└── Owned Organizations (0..many: Created organizations)
    └── Workspace (Internal 1:1 Technical Operating Environment)
        ├── Members & Staff (Assigned workspace roles)
        ├── Roles and permissions (RBAC + Multi-product access control)
        ├── Branches or locations (e.g., Main Store, Warehouse, Outlet)
        ├── Enabled applications (Inventory, Task Management, etc.)
        ├── Product memberships (App-level roles and branch scoping)
        ├── Subscription & entitlements (Plan tiers, quotas, feature flags)
        ├── Onboarding state (Flow status & step progression)
        ├── Audit logs (Immutable security & activity trails)
        └── Business data (Catalog, products, stock levels, orders, sales)
```

### Relational Cardinality
$$\text{users } (1) \longleftrightarrow (0..\text{many}) \text{ workspaceMemberships}$$
$$\text{workspaces } (1) \longleftrightarrow (1..\text{many}) \text{ workspaceMemberships}$$

### Clarifying Concrete Relationship Examples

```
User 1: Mary Johnson (user_202)
- Orviohub Account: Active
- Organizations Owned: None (0)
- Organizations Joined: Code X Stores (ws_987410)
  ├── Workspace Role: Member
  ├── Inventory Role: Sales Attendant
  └── Branch Access: Main Store (branch_01)

User 2: David (user_101)
- Orviohub Account: Active
- Organizations Owned: None (0)
- Organizations Joined: None (0)
- Status: Personal account only (Account Center & public exploration)

User 3: Alex Vance / Code X (user_303)
- Orviohub Account: Active
- Organization Owned: Code X Stores (ws_987410)
  ├── Workspace Role: Owner
  ├── Main Store Branch (branch_01)
  ├── Warehouse Branch (branch_02)
  ├── Enabled Apps: Inventory, Task Management
  └── Subscription: Standard Plan ($49/mo)
```

---

## 3. Product Terminology Rules & UI Copy Matrix

### Official Definition & Onboarding Copy
> **Official Onboarding Explanation:**
> *“Create your Orviohub account. Your account lets you securely sign in, manage your profile, and access Orviohub applications. You can create an organization, join one by invitation, or continue without an organization and decide later.”*

### UI Replacement Matrix

| Context | Deprecated Technical Copy | Mandatory Customer-Facing Copy |
| :--- | :--- | :--- |
| **Creation Action** | `Create a workspace` | **Create an organization** |
| **Name Input** | `Workspace name` | **Organization name** |
| **Type Selector** | `Workspace type` | **Organization type** |
| **Member List** | `Workspace members` | **Organization members** |
| **Settings Area** | `Workspace settings` | **Organization settings** |
| **Switcher / Selector**| `Switch workspace` | **Switch organization** |
| **Billing Area** | `Workspace billing` | **Organization billing** |
| **Invitation Modal** | `Invite members to your workspace`| **Invite members to your organization** |

### Inventory-Specific Contextual Language
For retail and inventory workflows, intuitive business phrasing is used:
- **Create your business** (instead of create workspace)
- **Business name**
- **Business type**
- **Add your branches or locations**
- **Invite your staff**
- **Set up your store**
- **Choose the applications your business needs**

---

## 4. Organization Types & Setup Fields

### Supported Organization Types
During organization creation, the following categorized types are supported:
1. **Business or store**: Retail shops, supermarkets, pharmacies, fashion boutiques, trade outlets.
2. **Company or team**: Corporate departments, agencies, startups, consulting squads.
3. **Gym or club**: Fitness centers, sports clubs, social associations, non-profits.
4. **School or institution**: Academies, training centers, institutes, faculties.
5. **Personal workspace**: Solo-entrepreneurs, freelance consultants, individual operators.
   - *Helper Explanation:* *"Managed as an organization record internally, tailored for individual use."*
6. **Other**: General trade or custom organizations.

### Organization Field Schema

#### Required Fields
- **Organization Name** (`name`): Minimum 2 characters.
- **Organization Type** (`type`): One of the supported types above.
- **Country** (`country`): ISO country code (e.g., `NG`, `GH`, `US`, `GB`).
- **Timezone** (`timezone`): Standard IANA timezone (e.g., `Africa/Lagos`, `America/New_York`).
- **Default Currency** (`currency`): ISO currency code (e.g., `NGN`, `USD`, `GBP`, `EUR`, `GHS`, `KES`).

#### Optional Fields
- **Logo** (`logoUrl`): Organization brand asset URL.
- **State or Region** (`state`): Geographic subdivision.
- **City** (`city`): Municipality or operational hub.
- **Business Phone** (`phone`): Direct telephone contact.
- **Business Email** (`email`): Official organization email address.
- **Physical Address** (`address`): Headquarters or primary shop address.
- **Industry / Sector** (`industry`): Specific trade category.
- **Business Description** (`description`): Overview of operations.
- **Estimated Team Size** (`size`): Projected staff count (`1-10`, `11-50`, `51-200`, `201+`).
- **Number of Locations** (`locationCount`): Number of physical or virtual branches.

### Inventory-Specific Setup Capabilities
Within the organization context, the Inventory application configures:
- **Business Profile**: Master trade details, tax rates, invoice metadata.
- **Primary Branch**: Default operating location (e.g. "Main Store").
- **Additional Branches**: Secondary stores or warehouses based on subscription quota.
- **Product Catalog**: SKUs, barcodes, categories, units of measure.
- **Opening Stock**: Initial quantities, cost prices, selling prices.
- **Staff Members**: Sales attendants, cashiers, stock keepers, branch managers.
- **Receipt & POS Settings**: Header/footer notes, thermal print defaults, tax inclusion.
- **Inventory Preferences**: Negative stock policies, auto-reorder thresholds, batch/expiry alerts.

---

## 5. End-to-End Onboarding Paths

```
1. User Account Creation / Authentication (Email/Password, Google, Facebook)
   ↓
2. Email Verification (when mandated)
   ↓
3. Personal Profile Setup (First name, Last name, Display name, Timezone)
   ↓
4. Welcome Screen: "Welcome to Orviohub" - "What would you like to do?"
   ├─► PATH 1: Explore Orviohub / Go to My Account (Personal account only)
   ├─► PATH 2: Join an Organization (Accept pending invite with product roles)
   ├─► PATH 3: Create an Organization (Enter org details, select apps & plan)
   └─► PATH 4: Explore Products (Public pages, docs, product previews)
```

For comprehensive specifications of all 4 paths, empty states, and state machines, see [AUTH_AND_ONBOARDING_ARCHITECTURE.md](file:///e:/dev/orvioHub/docs/AUTH_AND_ONBOARDING_ARCHITECTURE.md).

---

## 6. Backend Data Model (Unchanged Technical Source of Truth)

The backend relational / document schema preserves the `workspace` domain model:

| Table / Collection | Purpose |
| :--- | :--- |
| `users` | User credentials, personal profile, security settings, MFA, sessions. |
| `workspaces` | The internal operating container (represents 1 Organization). |
| `workspaceMemberships` | Relates a `User` to a `Workspace` with global workspace roles (`OWNER`, `ADMIN`, `MEMBER`). |
| `workspaceProducts` | Products/applications enabled for the workspace (e.g. `inventory`, `tasks`). |
| `productMemberships` | Granular per-product role assignments and branch scopes for a user. |
| `workspaceInvitations` | Pending/accepted invites for users to join an organization's workspace. |
| `branches` | Physical stores, warehouses, or outlets owned by the workspace. |
| `workspaceAuditLogs` | Immutable security, access, and configuration audit trail. |
| `onboardingFlows` | State machine tracking onboarding step progress per workspace. |
| `billingAccounts` | Billing customer ID, payment methods, invoice contact details. |
| `subscriptions` | Active subscription tiers, billing intervals, renewal status. |
| `workspaceEntitlements` | Calculated feature flags, quotas (branches, products, members, storage). |

---

## 7. API Route Structure

All API endpoints preserve the secure `/v1/workspaces` route structure:

```http
POST   /v1/workspaces                      # Create a new organization (provisions workspace)
GET    /v1/workspaces                      # List organizations the authenticated user belongs to
GET    /v1/workspaces/:workspaceId         # Retrieve organization/workspace details
PATCH  /v1/workspaces/:workspaceId         # Update organization settings
DELETE /v1/workspaces/:workspaceId         # Soft-delete or archive organization
GET    /v1/workspaces/:workspaceId/members # List organization members & product roles
POST   /v1/workspaces/:workspaceId/invitations # Invite members to the organization
GET    /v1/workspaces/:workspaceId/products# List enabled applications
GET    /v1/workspaces/:workspaceId/context # Retrieve active organization context & entitlements
```

---

## 8. Multi-Tenancy & Authorization Rules

1. **Multiple Organization Ownership**: A user may create and own multiple organizations, subject to subscription quotas.
2. **Multi-Organization Membership**: A user may join organizations owned by other users without consuming their own owned-organization allowance.
3. **Organization-Level Billing**: Billing attaches to the organization (workspace), never to individual employees. Invited staff members do not purchase individual subscriptions.
4. **Owner Administrative Authority**: Organization owners manage members, roles, branches, enabled products, billing, and business data according to role permissions.
5. **Privacy & Identity Isolation**: Organization admins **cannot** view or alter another user's personal profile, personal email, password, private 2FA keys, security log, or memberships in external organizations.
6. **Account Preservation on Departure**: A user leaving an organization retains their Orviohub user account and personal profile intact.
7. **Audit & Data Integrity**: Removing a member revokes access immediately but preserves historic transaction records, receipts, and audit log entries attributed to that user.
8. **Zero Trust Authorization**: Client-supplied `workspaceId`, `role`, or `permissions` are never trusted. Every request validates workspace context against the authenticated session, active membership status, and product-level RBAC.

---

## 9. Future Scalability Architecture (Enterprise Roadmap)

### MVP Architecture (Current)
$$\text{Organization (1)} \longleftrightarrow \text{Workspace (1)}$$

### Future Enterprise Multi-Workspace Architecture (Planned)
When enterprise clients require managing holding companies or multiple distinct legal entities under a single umbrella:

```
Enterprise Organization: Code X Holdings
├── Workspace 1: Code X Superstores (Retail)
│   ├── Branch: Victoria Island
│   └── Branch: Ikeja Mall
├── Workspace 2: Code X Pharmacy (Healthcare)
│   └── Branch: Central Dispensary
└── Workspace 3: Code X Wholesale (Distribution)
    └── Warehouse: Apapa Logistics Hub
```

> **Implementation Note:** Do not build the parent-organization hierarchy in MVP. The 1:1 model provides full isolation, high performance, and simple customer onboarding while preserving clean upgrade paths for future multi-workspace hierarchies.

---

## 10. Orviohub Explorer Dashboard & Personal State Model

### Core Product Policy
> *“Users who sign up and choose Explore Orviohub land on a personal Explorer Dashboard. This dashboard allows them to discover Orviohub applications, manage their account, view information, review invitations, and create or join an organization later. It does not provide access to business operations or organization data until the user has valid organization membership and permissions.”*

### Separation of Responsibilities

| Dimension | Personal Explorer Dashboard (`/explorer`) | Organization Workspace Dashboard (`/app`, `/inventory`) |
| :--- | :--- | :--- |
| **Ownership** | Belongs strictly to the individual user account | Belongs to a specific organization (`workspaceId`) |
| **Context Requirement** | Does **NOT** require any workspace or organization | Requires active workspace context and valid role |
| **Business Data** | Zero business, POS, sales, branch, or stock data | Contains live operations, inventory stock, POS, reports |
| **Available Actions** | Explore product demos, manage security/profile, review invites, view pricing/docs | Operate POS, adjust stock, manage branches, bill clients |
| **Billing Status** | 100% Free • No billing, no credit card required | Governed by organization subscription plan |
| **Empty State Interception** | Seamless discovery; selecting business apps prompts create-or-join guide | Restricts access if user lacks product entitlement |

---

## 11. Context Hierarchy & Branch Scoping Rules

### Complete Architectural Model
```text
Orviohub account
└── User (Personal Account)
    └── Organization (Workspace)
        ├── Organization profile & settings
        ├── Members and platform roles
        ├── Applications (Inventory, Task Management, CRM, etc.)
        │   └── Product-specific roles & permissions
        ├── Branches or locations (Physical / logical units)
        │   └── Staff branch assignments
        ├── Subscription and billing
        └── Business data (Stock, sales, movements, receipts)
```

### Context Resolution & Security Rules
Every protected business request resolves and verifies five trusted dimensions:
$$\text{Authenticated User} + \text{Active Workspace Membership} + \text{Product Entitlement} + \text{Product Permissions} + \text{Branch Access}$$

1. **Branch Independence within Organization**:
   - A branch is a location or operational unit inside an organization (e.g., `Main Store`, `Warehouse`).
   - A branch is **NOT** a separate organization, separate user account, or separate billing subscription.
2. **Strict Data Isolation**:
   - A user assigned to `Main Store` cannot view or adjust stock in `Warehouse` without assigned permissions.
   - Client-supplied `branchId` or `workspaceId` are never trusted without backend validation.
3. **No-Branch State**:
   - If an employee has product access but no branch assignment, the system displays:
     *“You have access to Inventory, but no branch has been assigned to you. Ask an organization administrator to assign you to a branch.”*
4. **App Launcher Role**:
   - The App Launcher is the central place where users select an organization and application.
   - Branch selection occurs inside the application context.


