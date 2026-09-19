import { query, mutation } from "./_generated/server.js";
import { v } from "convex/values";

/**
 * List branch assignments for a workspace (optionally filtered by branchId or userId).
 */
export const getBranchAssignments = query({
  args: {
    workspaceId: v.string(),
    callerUserId: v.id("users"),
    branchId: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const wsId = ctx.db.normalizeId("workspaces", args.workspaceId);
    const targetWsId = wsId || args.workspaceId;

    let assignments: any[] = [];
    if (args.branchId && args.userId) {
      const single = await ctx.db
        .query("branchAssignments")
        .withIndex("by_workspace_user_branch", (q: any) =>
          q.eq("workspaceId", targetWsId).eq("userId", args.userId as any).eq("branchId", args.branchId as any)
        )
        .first();
      if (single) assignments = [single];
    } else if (args.branchId) {
      assignments = await ctx.db
        .query("branchAssignments")
        .withIndex("by_branch", (q: any) => q.eq("branchId", args.branchId as any))
        .collect();
      assignments = assignments.filter((a) => a.workspaceId === targetWsId);
    } else if (args.userId) {
      assignments = await ctx.db
        .query("branchAssignments")
        .withIndex("by_user_workspace", (q: any) =>
          q.eq("userId", args.userId as any).eq("workspaceId", targetWsId)
        )
        .collect();
    } else {
      assignments = await ctx.db
        .query("branchAssignments")
        .withIndex("by_workspace", (q: any) => q.eq("workspaceId", targetWsId))
        .collect();
    }

    const enriched = [];
    for (const a of assignments) {
      let user = null;
      let branch = null;
      try {
        const uId = ctx.db.normalizeId("users", a.userId);
        if (uId) user = await ctx.db.get(uId);
      } catch (_) {}

      try {
        const bId = ctx.db.normalizeId("branches", a.branchId);
        if (bId) branch = await ctx.db.get(bId);
      } catch (_) {}

      enriched.push({
        id: a._id,
        workspaceId: a.workspaceId,
        userId: a.userId,
        userName: user?.name || "Unknown User",
        userEmail: user?.email || "",
        avatar: user?.avatar || user?.avatarUrl,
        branchId: a.branchId,
        branchName: branch?.name || "Branch",
        role: a.role,
        status: a.status || "active",
        grantedBy: a.grantedBy,
        grantedAt: a.grantedAt,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      });
    }

    return enriched;
  },
});

/**
 * Assign a user to a branch with a role (manager, staff, viewer)
 */
export const assignBranchRole = mutation({
  args: {
    workspaceId: v.string(),
    callerUserId: v.id("users"),
    targetUserId: v.id("users"),
    branchId: v.string(),
    role: v.string(), // "manager" | "staff" | "viewer"
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const wsId = ctx.db.normalizeId("workspaces", args.workspaceId);
    const targetWsId = wsId || args.workspaceId;

    // Verify caller is owner or admin
    const callerMem = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_workspace_user", (q: any) =>
        q.eq("workspaceId", targetWsId).eq("userId", args.callerUserId)
      )
      .first();

    const isOwnerOrAdmin = callerMem && ["owner", "admin"].includes((callerMem.role || "").toLowerCase());
    if (!isOwnerOrAdmin) {
      let ws: any = null;
      if (wsId) ws = await ctx.db.get(wsId);
      if (!ws || ws.ownerId !== args.callerUserId) {
        throw new Error("WORKSPACE_ACCESS_DENIED");
      }
    }

    // Check target has workspace membership
    const targetMem = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_workspace_user", (q: any) =>
        q.eq("workspaceId", targetWsId).eq("userId", args.targetUserId)
      )
      .first();

    if (!targetMem || targetMem.status !== "active") {
      throw new Error("TARGET_NOT_ACTIVE_MEMBER");
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("branchAssignments")
      .withIndex("by_workspace_user_branch", (q: any) =>
        q.eq("workspaceId", targetWsId).eq("userId", args.targetUserId).eq("branchId", args.branchId as any)
      )
      .first();

    let assignmentId: any = null;
    let previousRole: string | undefined = undefined;

    if (existing) {
      previousRole = existing.role;
      await ctx.db.patch(existing._id, {
        role: args.role,
        status: "active",
        grantedBy: args.callerUserId,
        grantedAt: now,
        updatedAt: now,
      });
      assignmentId = existing._id;
    } else {
      assignmentId = await ctx.db.insert("branchAssignments", {
        workspaceId: targetWsId,
        userId: args.targetUserId,
        branchId: args.branchId as any,
        role: args.role,
        status: "active",
        grantedBy: args.callerUserId,
        grantedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Also update/sync with applicationMemberships for inventory if relevant
    const appMem = await ctx.db
      .query("applicationMemberships")
      .withIndex("by_workspace_user_app", (q: any) =>
        q.eq("workspaceId", targetWsId).eq("userId", args.targetUserId).eq("applicationKey", "inventory")
      )
      .first();

    if (appMem) {
      const currentBranches = new Set(appMem.branchIds || []);
      currentBranches.add(args.branchId);
      await ctx.db.patch(appMem._id, {
        branchIds: Array.from(currentBranches),
        updatedAt: now,
      });
    }

    // Record audit log
    await ctx.db.insert("membershipAuditLogs", {
      workspaceId: targetWsId,
      actorUserId: args.callerUserId,
      targetUserId: args.targetUserId,
      actionType: "branch_assigned",
      membershipType: "branch",
      membershipId: String(assignmentId),
      branchId: args.branchId as any,
      previousRole,
      newRole: args.role,
      reason: args.reason,
      createdAt: now,
    });

    return { id: assignmentId, success: true };
  },
});

/**
 * Remove / revoke branch assignment
 */
export const removeBranchAssignment = mutation({
  args: {
    workspaceId: v.string(),
    callerUserId: v.id("users"),
    assignmentId: v.id("branchAssignments"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const wsId = ctx.db.normalizeId("workspaces", args.workspaceId);
    const targetWsId = wsId || args.workspaceId;

    const callerMem = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_workspace_user", (q: any) =>
        q.eq("workspaceId", targetWsId).eq("userId", args.callerUserId)
      )
      .first();

    const isOwnerOrAdmin = callerMem && ["owner", "admin"].includes((callerMem.role || "").toLowerCase());
    if (!isOwnerOrAdmin) {
      let ws: any = null;
      if (wsId) ws = await ctx.db.get(wsId);
      if (!ws || ws.ownerId !== args.callerUserId) {
        throw new Error("WORKSPACE_ACCESS_DENIED");
      }
    }

    const assignment = await ctx.db.get(args.assignmentId);
    if (!assignment || assignment.workspaceId !== targetWsId) {
      throw new Error("ASSIGNMENT_NOT_FOUND");
    }

    const now = Date.now();
    await ctx.db.delete(assignment._id);

    // Remove from applicationMemberships branchIds if present
    const appMem = await ctx.db
      .query("applicationMemberships")
      .withIndex("by_workspace_user_app", (q: any) =>
        q.eq("workspaceId", targetWsId).eq("userId", assignment.userId).eq("applicationKey", "inventory")
      )
      .first();

    if (appMem && appMem.branchIds) {
      const updated = appMem.branchIds.filter((b) => b !== assignment.branchId);
      await ctx.db.patch(appMem._id, {
        branchIds: updated,
        updatedAt: now,
      });
    }

    // Record audit log
    await ctx.db.insert("membershipAuditLogs", {
      workspaceId: targetWsId,
      actorUserId: args.callerUserId,
      targetUserId: assignment.userId,
      actionType: "branch_revoked",
      membershipType: "branch",
      membershipId: String(assignment._id),
      branchId: assignment.branchId as any,
      previousRole: assignment.role,
      reason: args.reason,
      createdAt: now,
    });

    return { success: true };
  },
});
