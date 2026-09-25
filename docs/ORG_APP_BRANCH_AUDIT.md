# Organization, Application, and Branch Management Audit

**Audit date:** 24 September 2026  
**Committed baseline:** `2c43e822b1b031dfc314382e300b69dba279d543` (`Branch, application nand organization set up`)  
**Working baseline:** `cleanup-team-management` working tree  
**Primary lens:** Product growth, with security, tenant isolation, and data-loss risks treated as release blockers

## 1. Executive summary

Orviohub has the foundations of a credible multi-tenant product: separate application surfaces, an explicit tenant context, organization-level billing, product entitlements, branch lifecycle operations, audit records, onboarding flows, and a dedicated administration portal. The current working tree also adds useful account-security, phone-verification, application-registry, admin-inspection, and operational-settings capabilities.

It is **not release-ready in its current working state**. Two confirmed authorization defects allow mutations outside the intended role model:

1. The newly added public Convex `platformApplications` mutations accept no admin session or role and can create, update, seed, or delete platform application records.
2. The branch/team cleanup removed the Fastify branch permission guard and the underlying branch-access records. Current branch authorization then defaults an unrecognized caller to “member,” never evaluates the requested permission, and exposes branch update/lifecycle routes to any active workspace member.

The largest structural issue is that the documented 1:1 Organization–Workspace model is not the implemented model. Both entities, both membership systems, both invitation systems, several audit stores, and multiple application registries remain active. Compatibility fallbacks obscure which record is authoritative and make authorization, billing, onboarding, and admin reporting harder to reason about.

From a product perspective, the system offers too many competing ways to perform the same task. Organization, workspace, workplace, application, product, branch, and inventory setup are spread across multiple subdomains and many legacy route aliases. The working tree removes dedicated customer application and branch hubs and redirects them to a combined Workplace page, but leaves numerous alternate settings and onboarding paths. This increases orientation cost and makes activation state unreliable: the Inventory guard treats the existence of any selected workspace ID as evidence that Inventory is active.

### Release decision

**Recommendation: no-go until SEC-01, AUTH-01, AUTH-02, and ADM-01 are fixed and covered by negative integration tests.** After those gates, prioritize a single organization-centric customer journey, canonicalize the domain model, and add funnel instrumentation before investing in additional applications.

### Implementation follow-up — 25 September 2026

The following release-blocking code paths have now been hardened in the working tree and require integration coverage before release:

| Finding | Implementation status | Change made | Verification still required |
|---|---|---|---|
| SEC-01 | Mitigated | `platformApplications` write mutations now require a valid Convex admin session with `admin.applications.manage`; the admin client supplies its session token. | Unauthenticated and read-only/support-admin mutation attempts must fail in integration tests. |
| AUTH-01 | Mitigated | Convex branch access now rejects missing identity, tenant mismatch, inactive memberships, absent product access, out-of-scope branch IDs, and missing requested permissions. | Role × product × branch × action negative matrix. |
| AUTH-02 | Mitigated | Fastify action-level branch guard was restored; branch settings and phone actions use it; direct unscoped context/phone aliases were removed. | Route-level tests for each lifecycle and phone operation. |
| AUTH-03 | Mitigated | Fastify product authorization now rejects non-active product memberships. | Revocation tests across every application route family. |
| ADM-01 | Partially mitigated | Convex admin users, products, invitations, onboarding, phone challenges, organization writes, and platform-application writes now use the named Fastify-aligned permission policy with session expiry, inactivity, and active-account checks. The admin UI hides unavailable navigation and application-registry writes. | Consolidate the distinct Fastify and Convex identity/session stores and expand the shared policy regression matrix to every protected action. |

The Organization–Workspace source-of-truth issue, collection-scan work, and customer journey consolidation are not safe to auto-migrate as part of this security patch. They remain prioritized follow-up work in the roadmap below.

### Tenant and branch-team follow-up — 25 September 2026

- Added an explicit, Superadmin-confirmed Organization-to-Workspace canonicalization utility. It previews impact, refuses ambiguous multi-workspace mappings, creates a missing Workspace only when necessary, backfills missing workspace memberships, links legacy branches/settings, and writes an audit event. It never deletes Organization records.
- Restored branch-team management as a canonical `branchAssignments` model. The customer Branch Settings staff UI now has backed routes for list, assign, update role, remove, transfer, and invitation follow-up. Assignments are tenant- and branch-scoped, require an active workspace member, maintain compatible Inventory product access, and emit audit events.

### Catalog, scale, and journey follow-up — 25 September 2026

- Platform application activation now uses the mutable `platform_applications` registry as its availability and plan-eligibility authority. Static definitions are bootstrap fallback data only, preventing the customer activation flow from disagreeing with the Superadmin registry.
- The Superadmin organization directory and public application catalog now have bounded reads, with the directory reporting when its protected scan limit is reached. This is an operational safeguard pending cursor-based aggregation.
- The Workspace-first journey now sends the correct `planKey` to application activation. The existing canonical flow is Organization/Workspace → Workplace → activate application → application onboarding or branch setup; legacy `/apps`, `/applications`, and `/branches` aliases continue to redirect to Workplace.

### Baseline comparison at a glance

| Area | HEAD (`2c43e822`) | Current working tree | Assessment |
|---|---|---|---|
| Branch authorization | Explicit `requireBranchPermission`; branch/application membership and assignment models | Guard and models removed; authorization falls open | **New critical regression** |
| Branch team management | Dedicated branch team routes, data, tests, and screens | Deleted; partial workspace-member editor remains | **Intentional removal with unresolved capability gap** |
| Platform application registry | Shared/static and legacy registries | Additional mutable `platform_applications` registry and admin screen | **New capability with critical auth gap** |
| Superadmin | Fastify admin governance existed | Separate Convex admin identity/session stack and richer portal added | **Improved breadth; fragmented and under-enforced RBAC** |
| Account/security operations | Less complete | Phone challenges, passkeys, session and OAuth work added | **Material improvement** |
| UX organization | Separate Applications and Branches pages | Consolidated Workplace page; old URLs redirect | **Potential simplification, but incomplete information architecture** |
| Build health | Not re-executed in-place | All four packages typecheck | **Healthy static compilation** |
| Automated verification | Backend-heavy | 94 backend test files, one frontend test, no admin tests; focused and full runs timed out | **Insufficient release signal** |

## 2. Scope and method

The audit traced customer and Superadmin capabilities from UI routes through API/Convex entry points, authorization, persistence, lifecycle state, and documentation. It inspected the current working tree and the committed versions through Git objects; existing user changes were not checked out or modified.

Finding classifications:

- **Persistent:** present in HEAD and the working tree.
- **New regression:** behavior became less safe or less complete in the working tree.
- **Resolved/improved:** the working tree materially closes a baseline gap.
- **Removal gap:** old capability was deliberately removed without a complete replacement.
- **Documentation drift:** implemented and promised behavior conflict.
- **Architectural risk:** evidence shows fragility or scale risk, but not necessarily an immediately reproducible defect.

Severity definitions:

- **Critical:** exploitable cross-role/cross-tenant mutation, platform compromise, or likely material data loss.
- **High:** broken core journey, privilege inconsistency, or severe operational/release risk.
- **Medium:** material friction, maintainability, performance, or correctness risk with a workaround.
- **Low:** localized consistency or polish issue.

## 3. Capability traceability

### 3.1 Customer management surface

| Capability | Customer UI | Server/API and guard | Persistence | Documentation | Current conclusion |
|---|---|---|---|---|---|
| Create/select organization | Home/Launcher onboarding; `OrganizationWizard`; `WorkspaceSwitcher` | `/organizations`, `/workspaces`, onboarding routes; authentication and eligibility checks | `organizations`, `workspaces`, two membership models, onboarding records | Architecture, auth/onboarding, user guide | Works through compatibility layers; dual sources of truth remain |
| Organization settings | Home and Inventory settings aliases; `WorkspaceSettingsPage` | Workspace/organization settings routes; workspace role checks vary by operation | Core entity plus `workspaceSettings`, `organizationSettings`, branding/profile records | Terminology spec says Workspace is sole backend source | Broad UI, but terminology and ownership are fragmented |
| Discover/activate app | Launcher catalog, Workplace page, Inventory activation/onboarding | Platform, application settings, workspace product, inventory-status routes | Static shared registry plus `products`, `applications`, `platform_applications`, `workspaceProducts`, `orgApplications` | Product-discovery flow | Multiple registries and state vocabularies can disagree |
| Create/manage branch | Workplace/settings and Inventory branch screens | Branch settings routes; entitlement check on create | `branches`, `branchSettings`, `branchStockBalances` | User guide and architecture | Lifecycle breadth exists; role enforcement regressed |
| Switch branch | `BranchSwitcher`, branch store, Inventory layout | Branch/context endpoints | Client cookie/store plus server branch records | User guide | Context can be lost across route/subdomain transitions; operational data is only partly branch-scoped |
| Manage members/access | `WorkspaceMembers`, invitations, embedded access editor | Workspace member/invitation functions | `workspaceMemberships`, `productMemberships`, legacy organization membership/invitations | Architecture and user guide | Organization/app assignments remain; dedicated branch team lifecycle was removed |
| Billing/limits | Billing settings, plan/upgrade modals, quota indicators | Billing and entitlement services | subscriptions, plans, usage counters, overrides | User guide, architecture | Rich but identifiers and plan naming have compatibility paths |
| Audit and destructive lifecycle | Settings audit/danger areas | Workspace lifecycle/settings routes | Several audit and deletion records | Architecture, security guide | Customer actions exist; audit stores are fragmented |

### 3.2 Superadmin management surface

| Capability | Admin UI | Execution path | Guard model | Current conclusion |
|---|---|---|---|---|
| Authenticate | Standalone Admin Login | Direct Convex `adminAuth` | `platformAdmins`, bearer-like token in `localStorage` | Separate from Fastify platform-admin JWT model |
| Search organizations | `/organizations` | Direct Convex `adminOrganizations.listOrganizations` | Session validity only | Functional but performs full-table aggregation before pagination |
| Inspect organization | `/organizations/:id` | Direct Convex detail/settings queries | Session validity only | Broad inspection; duplicate org/workspace resolution adds ambiguity |
| Govern apps | `/applications`, detail actions | Direct `platformApplications` and admin product mutations | Some functions use a session; new registry mutations use none | Critical unauthorized mutation exposure |
| Govern branches | Organization detail branch controls | Direct `adminOrganizations.toggleBranchStatus` | Session validity only | No five-tier permission check or required reason in Convex path |
| Suspend/delete/transfer | Organization actions/modals | Direct Convex admin mutations | Session; only some destructive variants use step-up | Any active Convex admin role can reach many sensitive mutations |
| Billing/onboarding/audit | Dedicated portal sections | Direct Convex APIs | Inconsistent per-module checks | Useful operational breadth; policy differs from documented Fastify governance |

## 4. Technical findings

### SEC-01 — Platform application mutations are unauthenticated

**Classification:** New regression · **Severity:** Critical · **Release blocker**

**Evidence**

- [`platformApplications.ts`](../backend/convex/platformApplications.ts#L79) exposes `seedDefaults` with no arguments or identity check.
- [`platformApplications.ts`](../backend/convex/platformApplications.ts#L126), [line 175](../backend/convex/platformApplications.ts#L175), and [line 229](../backend/convex/platformApplications.ts#L229) expose create, update, and remove mutations without a session token, Convex authenticated identity, or role authorization.
- [`adminApplications.ts`](../admin/src/api/adminApplications.ts#L151) calls these public mutations directly from the browser.
- The file and its admin client are new/untracked relative to HEAD.

**Impact**

Anyone able to address the Convex deployment can alter application names, status, subdomain, plan eligibility, visibility metadata, or delete non-core applications. This can misroute customers, corrupt the product catalog, disrupt acquisition, and create a platform-wide integrity incident.

**Root cause**

The application registry was implemented as a public Convex data API while its admin placement was treated as sufficient access control.

**Remediation and acceptance**

- Make all registry mutations internal or require a canonical admin identity and `admin.applications.manage` permission server-side.
- Require reason and audit metadata for status, subdomain, plan, and deletion changes; require step-up for removal or core routing changes.
- Add negative tests for anonymous, customer, read-only, support, billing, and expired-admin sessions. Each must fail before any write.
- Confirm the public catalog remains readable without exposing mutation authority.

### AUTH-01 — Branch authorization fails open and ignores the requested permission

**Classification:** New regression · **Severity:** Critical · **Release blocker**

**Evidence**

- Current [`assertBranchAccess`](../backend/convex/branches.ts#L1340) receives `requiredPermission` but never uses it.
- It initializes permissions but never populates or evaluates them ([`branches.ts:1404`](../backend/convex/branches.ts#L1404)).
- If no workspace or organization membership is found, it explicitly changes `isMember` to true ([`branches.ts:1465`](../backend/convex/branches.ts#L1465)).
- Branch update, primary, suspend, restore, and archive mutations all depend on this helper ([`branches.ts:1632`](../backend/convex/branches.ts#L1632), [line 1715](../backend/convex/branches.ts#L1715), [line 1782](../backend/convex/branches.ts#L1782), [line 1847](../backend/convex/branches.ts#L1847), [line 1891](../backend/convex/branches.ts#L1891)).
- HEAD had `requireBranchPermission` and applied `branch.view`, `branch.update`, `branch.set_primary`, lifecycle, and staff-management permissions to each route. Those guards are removed in the working diff.

**Impact**

An authenticated caller who reaches the function can be treated as a member without membership proof. An ordinary active workspace member can change branch settings or lifecycle state despite having no branch-management permission. This violates both tenant isolation and the product’s advertised three-tier RBAC model.

**Root cause**

The cleanup deleted branch membership/assignment models and middleware before a fail-closed replacement based on `productMemberships.branchIds` was completed.

**Remediation and acceptance**

- Replace the helper with a single fail-closed resolver that requires active workspace membership, active product membership where applicable, assigned branch scope, and the exact requested permission.
- Owners/admins may have explicit documented bypasses, but an identifier mismatch must never be overridden merely because the caller owns a different workspace.
- Remove all “default allowed” fallbacks.
- Reintroduce negative tests for viewer/member/unassigned/suspended/removed/cross-tenant users across every branch read and mutation.

### AUTH-02 — Branch route guards were weakened and direct aliases omit tenant checks

**Classification:** New regression · **Severity:** Critical · **Release blocker**

**Evidence**

- The current branch route stack stops at workspace membership/application access and branch ownership ([`branchSettings.ts:627`](../backend/src/routes/branchSettings.ts#L627)); it no longer applies action permissions.
- Update, set-primary, suspend, restore, and archive routes use only the weakened branch stack ([`branchSettings.ts:672`](../backend/src/routes/branchSettings.ts#L672)).
- Top-level phone verification and demo-context aliases use only `resolveWorkspace`, omitting membership, product entitlement, branch resolution, ownership, activity, and permission checks ([`branchSettings.ts:755`](../backend/src/routes/branchSettings.ts#L755)).
- The Fastify branch-ownership resolver allows a mismatch whenever the caller owns the selected workspace, without proving the target branch belongs to it ([`authorization.ts:668`](../backend/src/plugins/authorization.ts#L668)).

**Impact**

The same operation has different security depending on the URL alias used. A caller can target branch phone state or context through a less-protected endpoint, and an owner mismatch bypass can convert a cross-tenant branch identifier into an authorized object.

**Remediation and acceptance**

- Delete the top-level aliases or route all aliases through the identical canonical guard chain.
- Bind branch lookup to the resolved tenant in the database query; return 404 on mismatch before any owner/role evaluation.
- Add an automated route inventory assertion so every branch mutation declares authentication, tenant, product, branch, and permission guards.
- Verify all aliases produce identical 401/403/404 behavior for negative cases.

### ADM-01 — Superadmin has two incompatible identity/RBAC systems

**Classification:** New architectural/security gap · **Severity:** Critical · **Release blocker**

**Evidence**

- Fastify defines five roles and granular permissions in [`adminAuth.ts`](../backend/src/middleware/adminAuth.ts#L6), with read-only mutation blocking and sensitivity checks.
- The standalone portal authenticates directly to a second Convex stack and stores its token in `localStorage` ([`AuthContext.tsx:19`](../admin/src/contexts/AuthContext.tsx#L19)).
- Convex `verifyAdminSession` checks only that an admin is active; it does not evaluate role or permission ([`adminOrganizations.ts:6`](../backend/convex/adminOrganizations.ts#L6)).
- Sensitive mutations such as suspend, activate, enable/disable product, change plan, reset onboarding, and toggle branch status call only that session check ([`adminOrganizations.ts:596`](../backend/convex/adminOrganizations.ts#L596), [line 1011](../backend/convex/adminOrganizations.ts#L1011), [line 1217](../backend/convex/adminOrganizations.ts#L1217), [line 1441](../backend/convex/adminOrganizations.ts#L1441)).
- Documentation promises five-tier RBAC, mandatory reasons, and step-up controls (`SUPERADMIN_GUIDE.md`), but those controls apply consistently only to the Fastify path.

**Impact**

A support, billing, or read-only admin with a valid Convex session can invoke sensitive mutations that the documented policy says must be denied. Token theft through XSS is more damaging because the session is script-readable and directly authorizes database functions.

**Remediation and acceptance**

- Choose one admin identity/session authority. Prefer an HttpOnly, Secure admin session terminating at a server boundary; do not keep bearer-equivalent admin tokens in `localStorage`.
- Enforce the same named permission inside every mutation, not just in navigation or Fastify wrappers.
- Require reason/ticket and bound, single-use step-up tokens for high-risk actions.
- Add a role × action contract test covering all admin queries and mutations, including direct Convex invocation.

### AUTH-03 — Inactive product membership can retain effective permissions

**Classification:** Persistent defect · **Severity:** High

**Evidence**

- `requireProductPermission` copies permissions and role from a product membership and checks only the permission array; it records but never rejects an inactive membership status ([`authorization.ts:514`](../backend/src/plugins/authorization.ts#L514) and [line 535](../backend/src/plugins/authorization.ts#L535)).
- The same pattern exists in the fallback path ([`authorization.ts:560`](../backend/src/plugins/authorization.ts#L560)).
- The behavior is also present in HEAD.

**Impact**

Removing or suspending application access may not revoke authorization when the record retains permissions. That undermines immediate offboarding and support/admin expectations.

**Remediation and acceptance**

- Require `productMembership.status === active` before role or permission evaluation for non-owner/non-admin users.
- Define whether workspace administrators inherit application access; encode that rule once.
- Test suspended/removed/inactive application members with stale permissions.

### ARCH-01 — Organization and Workspace are both active roots despite “1:1, Workspace-only” documentation

**Classification:** Persistent architecture debt and documentation drift · **Severity:** High

**Evidence**

- The terminology specification states there is no separate organizations table and that workspaces are the sole source of truth ([`ARCHITECTURE_AND_TERMINOLOGY.md:13`](ARCHITECTURE_AND_TERMINOLOGY.md#L13)).
- The schema defines both `organizations` ([`schema.ts:216`](../backend/convex/schema.ts#L216)) and `workspaces` ([`schema.ts:327`](../backend/convex/schema.ts#L327)).
- It also defines both organization and workspace memberships ([`schema.ts:280`](../backend/convex/schema.ts#L280), [line 431](../backend/convex/schema.ts#L431)), organization and workspace invitations, settings, and audit records.
- IDs are widely typed as a union of organization ID, workspace ID, or arbitrary string, and admin resolution heuristically guesses the entity ([`adminOrganizations.ts:34`](../backend/convex/adminOrganizations.ts#L34)).

**Impact**

Membership, ownership, billing, onboarding, app activation, and branch queries can disagree. Every new feature must implement compatibility resolution, increasing defect and support cost. It also blocks a clean future enterprise hierarchy because the current distinction is accidental rather than explicit.

**Remediation and acceptance**

- For MVP, make `workspaces` the canonical tenant and customer-visible Organization record as documented; retain a typed external `organizationId` alias only at API boundaries if necessary.
- Produce a migration inventory for every dual collection and field before deleting anything.
- Enforce one canonical ID type internally and reject ambiguous identifiers.
- Add integrity checks asserting exactly one owner, one active primary branch, and one billing/app state per tenant.

### ARCH-02 — Application metadata and activation state have multiple registries

**Classification:** Persistent debt, expanded in working tree · **Severity:** High

**Evidence**

- Shared code exports a static canonical `applications` registry ([`shared/applications.ts:89`](../shared/src/applications.ts#L89)).
- The schema separately defines `products`, `applications`, and new `platform_applications` tables ([`schema.ts:461`](../backend/convex/schema.ts#L461), [line 2088](../backend/convex/schema.ts#L2088), [line 2298](../backend/convex/schema.ts#L2298)).
- Tenant activation exists in `workspaceProducts` and legacy organization application records ([`schema.ts:1148`](../backend/convex/schema.ts#L1148)).
- Status values vary in case and vocabulary: active, available, trial, activating, setup_incomplete, suspended, deactivated, maintenance, beta, and coming-soon variants.

**Impact**

Catalog cards, plan checks, routes, admin controls, activation guards, and onboarding can show contradictory states. Growth experiments cannot reliably attribute an activation or determine availability.

**Remediation and acceptance**

- Establish one platform application definition registry and one tenant application installation record.
- Use a typed lifecycle such as `available → activating → setup_required → active → suspended/deactivated`, with `coming_soon` belonging to platform availability, not tenant state.
- Add a registry synchronization test covering key, route/subdomain, visibility, plan requirements, and status.

### FUNC-01 — Branch/team management was removed without a feature-complete replacement

**Classification:** Intentional removal with unresolved gap · **Severity:** High

**Evidence**

- The working tree deletes branch membership, application membership, team invitation, assignment, transfer, audit, API, tests, store, modals, and dedicated team screens.
- HEAD contained dedicated branch permission and staff-management routes and `BranchTeamManagement` workflows for active, suspended, invitation, and transfer states.
- The current `WorkspaceSettingsPage` includes a member/app/branch assignment editor, but it does not replace the deleted branch-centric staffing lifecycle, transfer history, bulk operations, or branch audit experience.

**Impact**

Owners cannot confidently manage staff across branches, and the product no longer matches its user guide or the branch-management value proposition. This directly harms multi-location activation and expansion revenue.

**Remediation and acceptance**

- Decide and document one membership model: workspace membership plus per-application role and explicit branch scope is sufficient if it supports invites, suspend/remove, bulk assignment, transfer, history, and immediate revocation.
- Restore those workflows in the Organization Team area with branch filters and a member detail drawer; do not recreate a separate competing team domain.
- Update the guide only after end-to-end owner/admin/member scenarios pass.

### DATA-01 — Branch context does not consistently scope operational data

**Classification:** Persistent functional/scalability limitation · **Severity:** High

**Evidence**

- Branch balances are branch-scoped ([`schema.ts:1682`](../backend/convex/schema.ts#L1682)), but products retain a workspace-level `stockQuantity` ([`schema.ts:1696`](../backend/convex/schema.ts#L1696)).
- Inventory sales and stock movements have no branch ID ([`schema.ts:1761`](../backend/convex/schema.ts#L1761) and [line 1811](../backend/convex/schema.ts#L1811)).
- Dashboard context currently returns fixed permissions and demo metrics ([`branchSettings.ts:527`](../backend/src/routes/branchSettings.ts#L527)).
- The user guide correctly calls Inventory an interactive demo, but settings and navigation resemble production operations.

**Impact**

Branch switching cannot produce authoritative sales, cashier, or movement reporting. Workspace and branch stock quantities can diverge. Users may infer readiness beyond the actual data model.

**Remediation and acceptance**

- Keep catalog identity workspace-wide, but make stock ledger, movement, sale, register, and operational reporting branch-required.
- Derive balances from branch ledger/balance records; deprecate the workspace-level stock quantity as authoritative.
- Label demo data consistently and prevent production claims until branch-scoped transaction tests pass.

### UX-01 — Inventory activation guard treats any workspace as an active Inventory installation

**Classification:** New regression · **Severity:** High

**Evidence**

- `isAlreadyActive` becomes true whenever `currentWorkspace.id` exists, regardless of enabled modules ([`inventory/App.tsx:65`](../frontend/src/surfaces/inventory/App.tsx#L65)).
- The two-second safety timeout can end checking before the network response ([`inventory/App.tsx:99`](../frontend/src/surfaces/inventory/App.tsx#L99)).
- API failure is converted to a nullable tuple and then to onboarding-incomplete behavior rather than a distinct error/retry state ([`inventory/App.tsx:125`](../frontend/src/surfaces/inventory/App.tsx#L125)).

**Impact**

Customers can enter Inventory without activation, be redirected to onboarding for network failures, or see inconsistent inactive/forbidden/setup states. This damages activation conversion and supportability.

**Remediation and acceptance**

- Use one server-returned installation state: unknown/loading, unavailable, not_installed, setup_required, active, suspended, forbidden, or error.
- Never infer application activation from organization selection.
- Preserve the intended return URL and provide retry/support actions for errors.

### SCALE-01 — Superadmin organization listing aggregates entire collections before pagination

**Classification:** New scalability limitation · **Severity:** Medium

**Evidence**

- The list query collects every workspace and every membership, product, branch, subscription, profile, and onboarding response ([`adminOrganizations.ts:77`](../backend/convex/adminOrganizations.ts#L77) and [lines 106–111](../backend/convex/adminOrganizations.ts#L106)).
- It builds in-memory maps and paginates only afterward.

**Impact**

Admin search latency and Convex read cost grow with the whole platform rather than page size. At scale, the primary support screen will time out exactly when it is most needed.

**Remediation and acceptance**

- Query an indexed, cursor-paginated organization projection and maintain counters/summary fields asynchronously.
- Apply search/status/plan filters before hydration.
- Load expensive detail sections only when the admin opens a tenant.
- Establish p95 budgets for directory and detail queries at representative tenant counts.

### TEST-01 — Automated verification is backend-heavy and too slow for safe refactoring

**Classification:** Persistent test debt, exposed by refactor · **Severity:** High

**Evidence**

- Current repository: 94 backend test files, one frontend test file, and no admin test files.
- `frontend` defines its test command as an echo rather than a runner.
- `pnpm -r typecheck` passed for shared, admin, backend, and frontend in 68.7 seconds.
- The full `pnpm test` and a focused six-file organization/application/branch/security/admin set each produced no final result before the 184-second command bound.
- The refactor deletes branch/team tests while changing the authorization model.

**Impact**

The highest-risk customer and admin workflows have little UI coverage, and backend feedback is not fast enough to gate iterative changes. Compilation success gives false confidence about security behavior.

**Remediation and acceptance**

- Split unit, contract, integration, and end-to-end projects with deterministic teardown and per-suite timeouts.
- Add fast mandatory security contracts for anonymous, cross-tenant, role, inactive membership, alias parity, and step-up cases.
- Add React tests for the two target journeys and admin role-aware controls; add a small browser smoke suite across subdomains.
- CI must report individual test results and complete the release-gating subset within ten minutes.

### OPS-01 — Runtime and documentation configuration are inconsistent

**Classification:** Documentation/configuration drift · **Severity:** Medium

**Evidence**

- README and `.env.shared` describe backend port 3000 and frontend port 4000.
- Backend environment defaults to port 4000 and uses port 3000 for several frontend base URLs ([`env.ts:7`](../backend/src/config/env.ts#L7), [lines 22–26](../backend/src/config/env.ts#L22)).
- Docker publishes backend port 4000 while the frontend owns host port 80 ([`docker-compose.yml:11`](../docker-compose.yml#L11)).

**Impact**

Local onboarding, callback URLs, cookies, CORS, and cross-subdomain redirects can vary by launch method. This slows development and produces environment-specific funnel failures.

**Remediation and acceptance**

- Define ports and public origins once per environment, generate consumer configuration, and validate it at startup.
- Add a smoke test that resolves every documented surface and verifies auth return URLs.

## 5. Product and UX analysis

### 5.1 Current customer journey

```text
Marketing or product page
  → Accounts signup/login and verification
  → Personal onboarding
  → Home or Launcher decision point
      → create organization / accept invitation / explore
  → organization wizard and optional billing
  → Launcher catalog or Home Workplace
  → Inventory activation
  → Inventory-specific onboarding
  → single- or multi-branch setup
  → Inventory dashboard
  → branch/application/organization settings across Home and Inventory
```

Primary friction:

- Home and Launcher can both initiate organization onboarding.
- Customer copy alternates among Organization, Workspace, Workplace, Business, Product, Module, and Application.
- Legacy routes (`/workspaces`, `/organizations`, `/applications`, `/branches`, many settings aliases) remain navigable or redirect silently, obscuring the canonical location.
- Organization, application, branch, and member management are partially duplicated between Home and Inventory.
- Activation and onboarding errors are often collapsed into redirects or “not completed,” losing recovery context.
- Role-sensitive actions are sometimes hidden in UI but not enforced identically at the server.
- The transition from demo to real operational data is not consistently signposted.

### 5.2 Target customer journey

```text
Account
  → Choose: Explore | Accept invitation | Create organization
  → Create organization (identity and locale only)
  → Organization Home
      Overview | Applications | Locations | Team | Billing | Settings
  → Applications: select Inventory
  → Activation review (plan, permissions, effects)
  → Inventory setup
      operating model → primary location → optional extra locations → starter data
  → Readiness checklist
  → Open Inventory at selected organization/location
```

Decision-complete behavior:

1. **Home owns organization management.** Inventory may deep-link to Home settings but must not duplicate organization/team/billing forms.
2. **Launcher owns public discovery; Organization Applications owns installation.** The same catalog component can render both modes, but the call to action and required context differ.
3. **Inventory owns application configuration and daily work.** Branch operational settings may remain inside Inventory; branch identity, lifecycle, quota, and staffing belong to Home.
4. **Organization and location context remain visible.** Every application header shows both selectors and preserves them in signed/server-validated context across subdomains.
5. **Setup is resumable.** A readiness checklist displays organization, billing, app, primary location, staff, and first-action status without forcing completed steps again.
6. **Role behavior is explicit.** Disabled actions explain the required role; forbidden deep links show the same explanation and an owner-contact path.
7. **Errors are states, not redirects.** Unavailable, inactive, forbidden, setup-required, quota-blocked, offline, and server-error each have distinct recovery actions.

### 5.3 Current Superadmin journey

```text
Standalone admin login
  → Dashboard
  → Organizations directory search/filter
  → Organization detail
      overview | applications | branches | members | settings | billing/onboarding
  → mutation modal
  → direct Convex mutation
  → audit/admin follow-up
```

Primary friction and risk:

- Portal roles are not consistently reflected in navigation or server authorization.
- Customer and platform app concepts are split between Products and Applications screens.
- Organization detail is deep but may silently omit failed panels because calls use `catch(() => null)`.
- High-risk actions use different confirmation, reason, and step-up conventions.
- The directory does expensive global aggregation, so filters do not scale.
- No visible incident timeline combines customer lifecycle, admin action, billing, and auth events.

### 5.4 Target Superadmin journey

```text
Hardened admin authentication + MFA
  → role-specific dashboard and queues
  → indexed organization directory
  → organization 360
      Summary | Access | Applications | Locations | Billing | Onboarding | Timeline
  → Diagnose (read-only evidence first)
  → Choose governed action
  → reason/ticket + impact preview + step-up when required
  → execute server-side
  → immutable result, notification, rollback/recovery guidance
```

Decision-complete behavior:

1. Use one admin identity, role vocabulary, permission catalog, and session mechanism.
2. Hide unauthorized navigation for clarity, but treat server enforcement as authoritative.
3. Present application installation and branch state in one organization 360; reserve global Applications for platform catalog governance.
4. Every mutation modal shows affected organization, application/location scope, customer impact, reason/ticket, and whether the action is reversible.
5. Partial panel failures render explicit error cards and correlation IDs instead of empty sections.
6. The timeline records request ID, actor, reason, before/after summary, notification, and recovery action.

### 5.5 Screen and flow recommendations

| Surface | Current issue | Recommended design | Success measure |
|---|---|---|---|
| Organization directory | Workspace/organization terminology and card-level state differ | One Organization list with role, plan, app readiness, location count, and next action | Organization selection without backtracking |
| Organization Home/Workplace | Applications, branches, metrics, and settings compete on one page | Overview plus clear tabs: Applications, Locations, Team, Billing, Settings | Higher app activation and branch setup completion |
| Application catalog | Public discovery and tenant activation are mixed | Public catalog for learning; scoped install center for activation | CTA-to-activation conversion and fewer context errors |
| Activation/setup | State inferred client-side; failures redirect | Server state machine, readiness checklist, resumable steps | Activation and onboarding completion rate |
| Location management | Dedicated page removed; settings are scattered | Organization Locations hub with quota, primary, status, staff coverage, and app readiness | Time to create/activate second location |
| Branch switcher | Context can be stale or absent | Persistent organization + location selector, recent locations, permission-aware list | Fewer wrong-context errors/support tickets |
| Team/access | Deleted branch workflows; dense permission editor | Member-first list, app/branch scopes, role templates, bulk assignment, transfer history | Invite acceptance and staff activation rate |
| Settings | Same forms exposed under many aliases | Canonical Home-owned organization settings and Inventory-owned operational settings | Lower navigation depth and duplicate edits |
| Admin directory | Full scans and dense filters | Indexed search, saved filters, operational queues, cursor pagination | p95 load time and case-resolution time |
| Admin organization 360 | Silent partial failures and inconsistent actions | Lazy panels, health summary, unified timeline, governed action drawer | First-contact resolution and audit completeness |

## 6. Product instrumentation

Use a common event envelope: `event_id`, `occurred_at`, `user_id`, `organization_id`, `workspace_id` during migration, `application_key`, `branch_id`, `role`, `surface`, `source`, `session_id`, `correlation_id`, and non-sensitive error code. Never include tokens, OTPs, secrets, raw payment data, or free-form personal data.

| Funnel | Required events | Core measures |
|---|---|---|
| Organization creation | `org_create_started`, `step_viewed`, `step_completed`, `org_create_failed`, `org_created` | Start-to-create conversion, field/error abandonment, time to create |
| Invitation | `invite_sent`, `invite_opened`, `invite_authenticated`, `invite_accepted`, `invite_failed` | Acceptance rate, time to join, failure reason |
| App discovery/activation | `catalog_viewed`, `app_viewed`, `activate_clicked`, `activation_blocked`, `app_activated` | View-to-activation, plan/permission blockers |
| App onboarding | `app_setup_started`, `setup_step_completed`, `setup_resumed`, `setup_failed`, `setup_completed` | Completion, resume rate, time per step |
| First branch readiness | `location_create_started`, `location_created`, `primary_confirmed`, `location_verified`, `location_ready` | Time to ready, quota and verification blockers |
| First value | `inventory_opened`, `first_product_created`, `first_stock_recorded`, `first_sale_completed` when real | Activation-to-value and cohort retention |
| Multi-location growth | `second_location_cta`, `location_limit_hit`, `upgrade_started`, `second_location_ready` | Expansion intent and upgrade conversion |
| Admin support | `case_opened`, `diagnostic_viewed`, `admin_action_started/completed/failed`, `case_resolved` | Resolution time, repeat actions, failure rate |

Instrumentation must be emitted server-side for authoritative lifecycle changes and deduplicated by `event_id`; client events provide journey context only.

## 7. Recommended target architecture and migration

### Canonical model

```text
User
  └─ TenantMembership → Workspace (customer-facing Organization)
                         ├─ ApplicationInstallation → PlatformApplication
                         │    └─ ApplicationMembership (role + explicit branch scope)
                         ├─ Branch
                         ├─ Subscription/Entitlements
                         └─ AuditEvent
```

Key rules:

- `workspaceId` is the only internal tenant key for MVP.
- A platform application definition is global; an installation is tenant-specific.
- Workspace membership establishes tenant entry, application membership establishes app role, and branch scope limits operational access.
- Every business record contains the canonical workspace ID; branch-operational records also require branch ID.
- Server authorization resolves identity → tenant → active membership → app installation → active app membership → branch scope → permission. Any unresolved step denies access.
- Admins operate through the same server-side policy engine with a separate platform permission namespace and immutable audit trail.

### Safe migration sequence

1. **Freeze and inventory:** document each duplicate collection, field, route, status, writer, reader, and record count; add integrity diagnostics without changing writes.
2. **Close authorization first:** restore fail-closed branch/app/admin guards and tests before any data migration.
3. **Define canonical contracts:** typed IDs, roles, permissions, application lifecycle, branch lifecycle, and error codes in the shared package.
4. **Backfill canonical records:** map organizations to workspaces; resolve memberships, invitations, application installations, branch ownership, billing, and audit references; quarantine ambiguous rows.
5. **Dual-read verification:** read canonical data and compare legacy results in telemetry; keep writes single-authority wherever possible.
6. **Cut over by domain:** identity/membership, application installations, branches/team scope, billing/entitlements, onboarding, and audits.
7. **Remove aliases and legacy data:** only after zero-drift checks, rollback snapshots, route usage telemetry, and updated documentation.
8. **Prepare enterprise hierarchy later:** add an explicit parent account/legal-entity model rather than repurposing today’s accidental Organization/Workspace duplication.

## 8. Prioritized remediation roadmap

Scores use 1–5, where 5 is highest. Effort 5 means largest effort.

| Priority | Work item | Growth | Security | Effort | Urgency | Exit criterion |
|---|---|---:|---:|---:|---:|---|
| **Release blocker** | SEC-01 secure platform registry | 4 | 5 | 2 | 5 | Anonymous and unauthorized mutations fail; audit/step-up tests pass |
| **Release blocker** | AUTH-01/02 restore fail-closed branch authorization | 5 | 5 | 3 | 5 | Complete role × branch × action negative suite passes |
| **Release blocker** | ADM-01 unify and enforce admin RBAC | 4 | 5 | 4 | 5 | One session model; direct invocation obeys five-tier matrix |
| **Now** | AUTH-03 enforce active app membership | 4 | 5 | 2 | 5 | Revocation immediately denies all app access |
| **Now** | Replace activation inference with server state machine | 5 | 3 | 3 | 5 | Every state has deterministic UI and recovery |
| **Now** | Restore team/branch assignment outcome | 5 | 4 | 4 | 5 | Owner/admin can invite, scope, transfer, suspend, remove, and audit |
| **Now** | Establish canonical routes and terminology | 5 | 2 | 3 | 4 | Product UI uses Organization, Application, Location consistently; aliases measured |
| **Next** | Consolidate platform/tenant app registries | 5 | 3 | 4 | 4 | One global definition and one installation state |
| **Next** | Canonicalize Organization/Workspace | 4 | 4 | 5 | 4 | One tenant ID and integrity dashboard; dual sources retired |
| **Next** | Branch-scope operational data | 5 | 4 | 5 | 4 | Sales/movements/reporting require and validate branch ID |
| **Next** | Add product funnel telemetry | 5 | 2 | 3 | 4 | Dashboards show creation, activation, readiness, and first-value funnels |
| **Next** | Fast release-gating tests | 4 | 5 | 3 | 5 | Security subset completes reliably under ten minutes |
| **Later** | Paginated admin read model | 3 | 2 | 3 | 3 | Directory meets p95 budget at target scale |
| **Later** | Remove legacy aliases/collections | 3 | 3 | 4 | 2 | Usage is zero, migration reconciles, rollback tested |

## 9. Validation record and recommended test scenarios

### Commands executed

| Command | Result |
|---|---|
| `pnpm -r typecheck` | Passed for shared, admin, backend, and frontend in 68.7 s |
| `pnpm test` | No final result before 184 s bounded timeout |
| Focused six-file backend security/domain set | No final result before 184 s bounded timeout |
| Git object inspection of `2c43e822` | Completed without modifying the working tree |

The timeouts are **inconclusive**, not test failures. They mean the audit cannot claim the runtime suite is green.

### Required release-gating scenarios

1. Anonymous and customer identities cannot call any platform/admin mutation, including direct Convex functions.
2. Every admin role receives exactly its documented permissions; read-only admins cannot mutate by any path.
3. Admin high-risk actions require a reason and an action/target-bound, single-use step-up token.
4. Cross-tenant workspace, organization, branch, header, route, and query identifier combinations fail without revealing existence.
5. Workspace member/viewer cannot create, update, set-primary, suspend, restore, archive, verify, or staff a branch without the exact permission.
6. Application and branch suspension/removal revokes access immediately even if stale permissions remain.
7. All route aliases either resolve to the same guard chain or return a migration redirect; no weaker alias exists.
8. Organization creation is recoverable from partial provisioning and preserves one owner and one primary active branch.
9. Application activation is idempotent and moves through a single lifecycle; plan/quota blocks have stable error codes.
10. Branch quota checks remain correct under concurrent creation attempts.
11. Ownership transfer cannot leave zero or multiple owners and revokes/updates former owner access atomically.
12. Customer navigation preserves organization/application/branch context across Home, Launcher, Accounts, and Inventory.
13. Network errors, forbidden access, inactive apps, setup-required apps, and quota blocks render distinct recovery states.
14. Admin directory pagination reads proportionally to page size and partial detail-panel failures remain visible.

## 10. Positive changes worth preserving

- Shared host/domain allowlisting and explicit subdomain surfaces provide a strong boundary to build on.
- The working tree passes TypeScript checks across all packages despite a very large refactor.
- Centralized Fastify authorization concepts, entitlement services, audit helpers, idempotency, background jobs, observability, and cache infrastructure are directionally sound.
- The working tree adds valuable account/session, passkey, OAuth, verification-challenge, phone, and admin inspection capabilities.
- Consolidating customer applications and branches into a Workplace concept can reduce navigation depth once canonical ownership and permissions are completed.
- The documentation already expresses the right customer vocabulary and a sensible MVP 1:1 target model; implementation should be brought back into alignment with it.

## 11. Final product recommendation

Do not add another application before the tenant, application-installation, branch-access, and admin-governance contracts are canonical. The fastest growth path is to make one Inventory journey trustworthy and measurable:

1. secure access;
2. create one organization;
3. activate Inventory once;
4. configure a primary location;
5. invite correctly scoped staff;
6. reach the first meaningful inventory action;
7. expand to a second location with a clear upgrade path.

That sequence reduces support load, improves activation and expansion measurement, and creates a stable platform contract for every future Orviohub application.
