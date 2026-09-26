import { mutation, query } from "../_generated/server.js";
import { v } from "convex/values";

/**
 * One-time ARCH-02 transition. A workspace is the canonical tenant; legacy
 * organizations are retained only for rollback/audit until a later removal.
 * This mutation is idempotent and intentionally never deletes records.
 */
export const auditPromotionReadiness = query({
  args: {},
  handler: async (ctx) => {
    const [organizations, workspaces] = await Promise.all([
      ctx.db.query("organizations").collect(),
      ctx.db.query("workspaces").collect(),
    ]);
    const workspaceOrgIds = new Set(workspaces.map((workspace) => String(workspace.organizationId)).filter(Boolean));
    return {
      organizations: organizations.length,
      workspaces: workspaces.length,
      organizationsWithoutWorkspace: organizations.filter((organization) => !workspaceOrgIds.has(String(organization._id))).map((organization) => ({ id: organization._id, name: organization.name })),
      workspacesWithoutLegacyOrganization: workspaces.filter((workspace) => !workspace.organizationId).map((workspace) => ({ id: workspace._id, name: workspace.name })),
    };
  },
});

export const promoteExistingWorkspaces = mutation({
  args: { confirm: v.literal("PROMOTE_WORKSPACES") },
  handler: async (ctx) => {
    const now = Date.now();
    const organizations = await ctx.db.query("organizations").collect();
    const workspaces = await ctx.db.query("workspaces").collect();
    let promoted = 0;
    let membershipsMigrated = 0;
    let settingsMigrated = 0;
    let unresolved = 0;

    for (const organization of organizations) {
      const linked = workspaces.filter((workspace) => workspace.organizationId === organization._id);
      const existingRecord = await ctx.db
        .query("workspaceMigrationRecords")
        .withIndex("by_legacy_organization", (q) => q.eq("legacyOrganizationId", organization._id))
        .first();

      if (linked.length !== 1) {
        unresolved += 1;
        if (existingRecord) await ctx.db.patch(existingRecord._id, { status: "needs_resolution", details: { linkedWorkspaceCount: linked.length }, migratedAt: now });
        else await ctx.db.insert("workspaceMigrationRecords", { legacyOrganizationId: organization._id, status: "needs_resolution", details: { linkedWorkspaceCount: linked.length }, migratedAt: now });
        continue;
      }

      const workspace = linked[0];
      await ctx.db.patch(workspace._id, { legacyOrganizationId: String(organization._id), updatedAt: now });
      promoted += 1;

      const legacyMemberships = await ctx.db
        .query("organizationMemberships")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", organization._id))
        .collect();
      for (const membership of legacyMemberships) {
        const existing = await ctx.db
          .query("workspaceMemberships")
          .withIndex("by_workspace_user", (q) => q.eq("workspaceId", workspace._id).eq("userId", membership.userId))
          .first();
        if (!existing) {
          await ctx.db.insert("workspaceMemberships", {
            workspaceId: workspace._id,
            userId: membership.userId,
            role: membership.role.toLowerCase(),
            status: membership.status.toLowerCase(),
            branchIds: membership.allowedBranches,
            createdAt: membership.joinedAt,
            updatedAt: now,
          });
          membershipsMigrated += 1;
        }
      }

      const legacySettings = await ctx.db
        .query("organizationSettings")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", organization._id))
        .first();
      const existingSettings = await ctx.db
        .query("workspaceSettings")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", workspace._id))
        .first();
      if (legacySettings && !existingSettings) {
        await ctx.db.insert("workspaceSettings", {
          workspaceId: workspace._id,
          business: { enabledModules: legacySettings.enabledModules, workspaceReady: legacySettings.workspaceReady, defaults: legacySettings.defaults },
          createdAt: now,
          updatedAt: now,
        });
        settingsMigrated += 1;
      }

      if (existingRecord) await ctx.db.patch(existingRecord._id, { workspaceId: workspace._id, status: "promoted", details: { membershipsMigrated, settingsMigrated }, migratedAt: now });
      else await ctx.db.insert("workspaceMigrationRecords", { legacyOrganizationId: organization._id, workspaceId: workspace._id, status: "promoted", migratedAt: now });
    }

    return { success: true, promoted, membershipsMigrated, settingsMigrated, unresolved };
  },
});
