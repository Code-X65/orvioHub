# Branch-scoped access

`workspaceMemberships.branchIds` and `productMemberships.branchIds` use an
explicit list for restricted access. A missing list is all branches only for a
workspace owner or admin; for other roles it grants no implicit branch access.
Product scope takes precedence over workspace scope.

All HTTP branch checks use `fastify.requireBranchAccess`. It verifies that the
branch belongs to the current workspace, resolves the scope above, writes a
`branch.access_denied` audit event when needed, and returns
`branch_access_denied` for an out-of-scope branch.

Inventory endpoints with no `branchId` aggregate only the caller's explicit
branch list. Historical unscoped movements and sales are excluded from a
restricted response. Product catalog entries remain workspace-global, but a
member with no branch access cannot list them.

Invitation creation enforces active-member seats in the Convex mutation. Pending
invitations do not reserve seats; resends/duplicate pending invitations are
rejected before a new invitation is created. Acceptance copies the invitation
scope to both workspace and product memberships and records it in the audit log.

## Team management endpoints

`GET /workspaces/:workspaceId/applications/inventory/members?branchId=...`
filters on the server and rejects an out-of-scope branch. Without `branchId`,
the response is limited to the caller's resolved scope. Per-branch transfer
history is available at `GET /workspaces/:workspaceId/branches/:branchId/transfers`
with an optional `userId` filter.

`branchStaff:updateBranchMemberRole` and
`branchStaff:setBranchMemberStatus` update explicit branch memberships only.
They require an active workspace manager or an inventory role with member
management permission, validate the caller's branch scope, and create an audit
event. Branch operational settings use the same branch guard; reads require
branch access and updates require `manage_settings`.

All workspace Inventory team routes share a mandatory pre-handler: active
workspace membership and Inventory entitlement are required; mutations also
require a workspace or Inventory team-manager role. Any branch ID supplied in
the path, query, or invitation body is evaluated by the canonical
`fastify.requireBranchAccess` guard. Organization aliases are intentionally not
registered for branch-team operations.
