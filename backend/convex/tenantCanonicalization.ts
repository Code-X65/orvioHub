/** Controlled Organization → Workspace canonicalization.
 * Workspace is the operational tenant. Organization records remain readable as
 * compatibility metadata while this explicit admin-only operation backfills the
 * workspace links that authorization and branch operations require.
 */
import { mutation, query } from "./_generated/server.js";
import { v } from "convex/values";
import { requireAdminPermission } from "./adminAuth.js";

async function resolve(ctx: any, tenantId: string) {
  const workspaceId = ctx.db.normalizeId("workspaces", tenantId);
  if (workspaceId) return { workspace: await ctx.db.get(workspaceId), organization: null };
  const organizationId = ctx.db.normalizeId("organizations", tenantId);
  if (!organizationId) throw new Error("TENANT_NOT_FOUND");
  const organization = await ctx.db.get(organizationId);
  if (!organization) throw new Error("TENANT_NOT_FOUND");
  const workspaces = await ctx.db.query("workspaces").withIndex("by_organizationId", (q: any) => q.eq("organizationId", organizationId)).collect();
  if (workspaces.length > 1) throw new Error("TENANT_MIGRATION_AMBIGUOUS_WORKSPACES");
  return { workspace: workspaces[0] || null, organization };
}

export const preview = query({
  args: { sessionToken: v.string(), tenantId: v.string() },
  handler: async (ctx, args) => {
    await requireAdminPermission(ctx, args.sessionToken, "admin.organizations.restore");
    const { workspace, organization } = await resolve(ctx, args.tenantId);
    if (!organization) return { canonicalWorkspaceId: workspace?._id, alreadyCanonical: true, membershipsToCreate: 0, branchesToPatch: 0 };
    const [memberships, branches, settings] = await Promise.all([
      ctx.db.query("organizationMemberships").withIndex("by_organizationId", (q: any) => q.eq("organizationId", organization._id)).collect(),
      ctx.db.query("branches").withIndex("by_organizationId", (q: any) => q.eq("organizationId", organization._id)).collect(),
      ctx.db.query("branchSettings").withIndex("by_workspace", (q: any) => q.eq("workspaceId", organization._id)).collect(),
    ]);
    return {
      canonicalWorkspaceId: workspace?._id || null,
      willCreateWorkspace: !workspace,
      membershipsToCreate: memberships.length,
      branchesToPatch: branches.filter((branch: any) => !branch.workspaceId).length,
      branchSettingsToPatch: settings.length,
    };
  },
});

export const execute = mutation({
  args: { sessionToken: v.string(), tenantId: v.string(), confirmation: v.literal("MIGRATE_TO_WORKSPACE") },
  handler: async (ctx, args) => {
    const { admin } = await requireAdminPermission(ctx, args.sessionToken, "admin.organizations.restore");
    const { workspace: existingWorkspace, organization } = await resolve(ctx, args.tenantId);
    if (!organization) return { success: true, workspaceId: existingWorkspace?._id, alreadyCanonical: true };
    const now = Date.now();
    let workspace = existingWorkspace;
    if (!workspace) {
      const workspaceId = await ctx.db.insert("workspaces", {
        organizationId: organization._id, name: organization.name, displayName: organization.name,
        slug: organization.slug, type: organization.type || "business", ownerId: organization.ownerId,
        country: organization.country, state: organization.state, city: organization.city,
        timezone: organization.timezone, currency: organization.currency || "NGN", phone: organization.phone,
        status: organization.status || "active", provisioningState: "provisioned", createdAt: now, updatedAt: now,
      });
      workspace = await ctx.db.get(workspaceId);
    }
    if (!workspace) throw new Error("WORKSPACE_PROVISIONING_FAILED");
    const memberships = await ctx.db.query("organizationMemberships").withIndex("by_organizationId", (q: any) => q.eq("organizationId", organization._id)).collect();
    let migratedMemberships = 0;
    for (const membership of memberships) {
      const existing = await ctx.db.query("workspaceMemberships").withIndex("by_workspace_user", (q: any) => q.eq("workspaceId", workspace!._id).eq("userId", membership.userId)).first();
      if (!existing) {
        await ctx.db.insert("workspaceMemberships", { workspaceId: workspace._id, userId: membership.userId, role: membership.role.toLowerCase(), defaultRole: membership.role.toLowerCase(), status: membership.status.toLowerCase() === "active" ? "active" : "invited", acceptedAt: membership.status === "ACTIVE" ? now : undefined, createdAt: now, updatedAt: now });
        migratedMemberships++;
      }
    }
    const branches = await ctx.db.query("branches").withIndex("by_organizationId", (q: any) => q.eq("organizationId", organization._id)).collect();
    let migratedBranches = 0;
    for (const branch of branches) {
      if (!branch.workspaceId) { await ctx.db.patch(branch._id, { workspaceId: workspace._id, updatedAt: now }); migratedBranches++; }
    }
    const branchSettings = await ctx.db.query("branchSettings").withIndex("by_workspace", (q: any) => q.eq("workspaceId", organization._id)).collect();
    for (const setting of branchSettings) await ctx.db.patch(setting._id, { workspaceId: workspace._id, updatedAt: now });
    await ctx.db.insert("workspaceAuditLogs", { workspaceId: workspace._id, actorUserId: String(admin._id), eventType: "tenant.canonicalized", entityType: "organization", entityId: String(organization._id), severity: "warning", metadata: { migratedMemberships, migratedBranches, legacyOrganizationId: organization._id }, createdAt: now });
    return { success: true, workspaceId: workspace._id, migratedMemberships, migratedBranches };
  },
});
