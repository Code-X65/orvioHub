import { query, mutation } from "./_generated/server.js";
import { v } from "convex/values";

/**
 * 1. Get Migration Status & Roster Diff
 */
export const getMigrationStatus = query({
  args: {
    workspaceId: v.string(),
    applicationKey: v.string(),
  },
  handler: async (ctx, args) => {
    const wsId = ctx.db.normalizeId("workspaces", args.workspaceId) || args.workspaceId;

    const wsMembers = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_workspace", (q: any) => q.eq("workspaceId", wsId))
      .collect();

    const appMembers = await ctx.db
      .query("applicationMemberships")
      .withIndex("by_workspace_app", (q: any) =>
        q.eq("workspaceId", wsId).eq("applicationKey", args.applicationKey)
      )
      .collect();

    const migratedIds = new Set(appMembers.map((m) => String(m.userId)));
    const pendingMigration = [];

    for (const wm of wsMembers) {
      if (!migratedIds.has(String(wm.userId))) {
        let user = null;
        try {
          user = await ctx.db.get(wm.userId);
        } catch (_) {}

        pendingMigration.push({
          workspaceMembershipId: wm._id,
          userId: wm.userId,
          name: user?.name || "Member",
          email: user?.email || "",
          workspaceRole: wm.role,
          recommendedAppRole: wm.role === "owner" || wm.role === "admin" ? "admin" : "member",
          status: wm.status,
        });
      }
    }

    return {
      totalWorkspaceMembers: wsMembers.length,
      migratedCount: appMembers.length,
      pendingCount: pendingMigration.length,
      isFullyMigrated: pendingMigration.length === 0,
      pendingMembers: pendingMigration,
    };
  },
});

/**
 * 2. Execute One-Click Auto Migration
 */
export const executeAutoMigration = mutation({
  args: {
    workspaceId: v.string(),
    callerUserId: v.id("users"),
    applicationKey: v.string(),
    defaultBranchId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const wsId = ctx.db.normalizeId("workspaces", args.workspaceId) || args.workspaceId;
    const now = Date.now();

    // 1. Get primary or default branch
    let targetBranchId = args.defaultBranchId;
    if (!targetBranchId) {
      const branches = await ctx.db
        .query("branches")
        .withIndex("by_workspace", (q: any) => q.eq("workspaceId", wsId))
        .collect();
      const primary = branches.find((b) => b.isPrimary) || branches[0];
      targetBranchId = primary ? String(primary._id) : undefined;
    }

    const wsMembers = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_workspace", (q: any) => q.eq("workspaceId", wsId))
      .collect();

    let migrated = 0;

    for (const wm of wsMembers) {
      const existing = await ctx.db
        .query("applicationMemberships")
        .withIndex("by_workspace_user_app", (q: any) =>
          q.eq("workspaceId", wsId).eq("userId", wm.userId).eq("applicationKey", args.applicationKey)
        )
        .first();

      if (!existing) {
        const appRole = wm.role === "owner" || wm.role === "admin" ? "admin" : "member";
        const newAppMemId = await ctx.db.insert("applicationMemberships", {
          workspaceId: wsId,
          userId: wm.userId,
          applicationKey: args.applicationKey,
          appRole,
          role: appRole,
          status: "active",
          addedBy: args.callerUserId,
          addedAt: now,
          createdAt: now,
          updatedAt: now,
        });

        // Mark legacy membership
        await ctx.db.patch(wm._id, {
          deprecated: true,
          migratedToAppMembership: newAppMemId,
          updatedAt: now,
        });

        // If branch is known, assign to default branch
        if (targetBranchId) {
          const bId = ctx.db.normalizeId("branches", targetBranchId) || targetBranchId;
          const existingBA = await ctx.db
            .query("branchAssignments")
            .withIndex("by_workspace_user_branch", (q: any) =>
              q.eq("workspaceId", wsId).eq("userId", wm.userId).eq("branchId", bId)
            )
            .first();

          if (!existingBA) {
            await ctx.db.insert("branchAssignments", {
              workspaceId: wsId,
              userId: wm.userId,
              applicationKey: args.applicationKey,
              branchId: bId as any,
              branchRole: appRole === "admin" ? "manager" : "staff",
              role: appRole === "admin" ? "manager" : "staff",
              assignmentType: "primary",
              status: "active",
              assignedBy: args.callerUserId,
              assignedAt: now,
              createdAt: now,
              updatedAt: now,
            });
          }
        }

        migrated++;
      }
    }

    // Audit Log
    await ctx.db.insert("membershipAuditLogs", {
      workspaceId: wsId,
      actorUserId: args.callerUserId,
      targetUserId: args.callerUserId,
      actionType: "team_migration_executed",
      membershipType: "application",
      membershipId: String(wsId),
      applicationKey: args.applicationKey,
      reason: `Auto-migrated ${migrated} workspace members to ${args.applicationKey} application memberships.`,
      createdAt: now,
    });

    return { success: true, migratedCount: migrated };
  },
});
