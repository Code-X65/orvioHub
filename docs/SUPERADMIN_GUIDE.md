# Orviohub Superadmin & Platform Governance Guide

This guide describes operational workflows, role permissions, inspection tools, and safety protocols for platform administrators.

---

## 1. Superadmin Access & Role Taxonomy

All platform governance is accessed via `/admin` and authenticated through the dedicated Superadmin Portal:

| Role Key | Description | Mutation Capabilities |
| :--- | :--- | :--- |
| **`platform_owner`** | Complete platform ownership and break-glass authority. | All mutations (including root overrides & system config). |
| **`platform_admin`** | Day-to-day administrative operations and tenant management. | Tenant suspend, restore, archive, session revocation. |
| **`support_admin`** | Technical support and issue investigation. | Add support notes, trigger diagnostic runs. |
| **`billing_admin`** | Financial operations, invoice reconciliations, plan adjustments. | Plan changes, subscription overrides, refund tracking. |
| **`read_only_admin`** | Auditor and view-only inspection access. | **Zero mutations allowed (all mutations rejected with 403).** |

---

## 2. 8-Tab Organization Inspector

Selecting any customer organization in the Superadmin Directory opens the **Deep Inspection Workspace**:

1. **Overview**: Metadata, IDs, Creation Timestamp, Status (`active`, `suspended`, `archived`), Owner details.
2. **Applications**: Active applications list (`inventory` active, future apps marked `coming_soon`).
3. **Branches**: Branch list, primary branch badge, branch manager assignment, and plan quota utilization.
4. **Members**: Organization members, user statuses, and organization-level roles.
5. **Invitations**: Pending and expired invitation tokens.
6. **Onboarding**: Step-by-step progress tracking for the customer's onboarding wizard.
7. **Billing & Entitlements**: Active plan, trial countdown, Paystack customer reference, and branch limits.
8. **Audit Trail**: Real-time immutable event stream with actor, IP, event type, and sanitized payload details.

---

## 3. Safe Mutation Protocols

To prevent accidental outages or data loss, administrative actions follow strict safety protocols:

### A. Confirmation & Mandatory Reason Requirement
- Actions such as **Suspend Organization** or **Revoke Active Sessions** require entering a clear administrative rationale (`x-admin-reason` or payload `reason`).
- Omitting the reason causes the backend to reject the request with `400 Bad Request`.

### B. High-Risk Step-Up Authentication (TOTP)
- Irreversible actions (e.g. **Archive Organization**) require entering a valid Time-Based One-Time Password (`x-admin-totp`) from the administrator's authenticator app.
- If unverified, the action is rejected with `403 Forbidden` (`STEP_UP_AUTHENTICATION_REQUIRED`).
