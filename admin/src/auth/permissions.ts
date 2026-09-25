/**
 * Presentation-layer mirror of the server-side administration policy.
 * This only controls discoverability; every mutation is enforced again by
 * Fastify or Convex and must never rely on this helper for authorization.
 */
const ROLE_PERMISSIONS: Record<string, readonly string[]> = {
  platform_owner: ["*"],
  superadmin: ["*"],
  super_admin: ["*"],
  platform_admin: ["*"],
  support_admin: [
    "admin.dashboard.view", "admin.organizations.view", "admin.users.view",
    "admin.members.view", "admin.applications.view", "admin.branches.view",
    "admin.onboarding.view", "admin.onboarding.manage", "admin.entitlements.view",
    "admin.overrides.view", "admin.audit.view", "admin.analytics.view",
  ],
  billing_admin: [
    "admin.dashboard.view", "admin.organizations.view", "admin.billing.view",
    "admin.billing.manage", "admin.entitlements.view", "admin.overrides.view",
    "admin.audit.view", "admin.analytics.view", "admin.revenue.view",
  ],
  read_only_admin: [
    "admin.dashboard.view", "admin.organizations.view", "admin.users.view",
    "admin.members.view", "admin.applications.view", "admin.branches.view",
    "admin.billing.view", "admin.entitlements.view", "admin.overrides.view",
    "admin.onboarding.view", "admin.audit.view", "admin.analytics.view", "admin.revenue.view",
  ],
};

export function canAdmin(role: string | undefined, permission: string): boolean {
  const grants = ROLE_PERMISSIONS[String(role || "").toLowerCase()] || [];
  return grants.includes("*") || grants.includes(permission);
}
