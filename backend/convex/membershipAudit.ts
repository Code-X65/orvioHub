import { query, mutation } from "./_generated/server.js";
import { v } from "convex/values";

/**
 * List membership audit logs for a workspace with optional filters.
 */
export const getMembershipAuditLogs = query({
  args: {
    workspaceId: v.string(),
    callerUserId: v.id("users"),
    targetUserId: v.optional(v.string()),
    actionType: v.optional(v.string()),
    membershipType: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const wsId = ctx.db.normalizeId("workspaces", args.workspaceId);
    const targetWsId = wsId || args.workspaceId;

    // Check caller membership
    const callerMem = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_workspace_user", (q: any) =>
        q.eq("workspaceId", targetWsId).eq("userId", args.callerUserId)
      )
      .first();

    const isOwnerOrAdmin = callerMem && ["owner", "admin"].includes((callerMem.role || "").toLowerCase());
    if (!isOwnerOrAdmin) {
      // Check if owner on workspace
      let ws: any = null;
      if (wsId) ws = await ctx.db.get(wsId);
      if (!ws || ws.ownerId !== args.callerUserId) {
        throw new Error("WORKSPACE_ACCESS_DENIED");
      }
    }

    const limit = Math.min(args.limit || 50, 100);

    const logs = await ctx.db
      .query("membershipAuditLogs")
      .withIndex("by_workspace_created", (q: any) =>
        q.eq("workspaceId", targetWsId)
      )
      .order("desc")
      .take(limit);

    // Populate user names / emails
    const enrichedLogs = [];
    for (const log of logs) {
      if (args.targetUserId && log.targetUserId !== args.targetUserId) continue;
      if (args.actionType && log.actionType !== args.actionType) continue;
      if (args.membershipType && log.membershipType !== args.membershipType) continue;

      let actorUser = null;
      let targetUser = null;
      try {
        const aId = ctx.db.normalizeId("users", log.actorUserId);
        if (aId) actorUser = await ctx.db.get(aId);
      } catch (_) {}

      try {
        const tId = ctx.db.normalizeId("users", log.targetUserId);
        if (tId) targetUser = await ctx.db.get(tId);
      } catch (_) {}

      enrichedLogs.push({
        id: log._id,
        workspaceId: log.workspaceId,
        actorUserId: log.actorUserId,
        actorName: actorUser?.name || "System",
        actorEmail: actorUser?.email || "",
        targetUserId: log.targetUserId,
        targetName: targetUser?.name || "User",
        targetEmail: targetUser?.email || "",
        actionType: log.actionType,
        membershipType: log.membershipType,
        membershipId: log.membershipId,
        applicationKey: log.applicationKey,
        branchId: log.branchId,
        previousRole: log.previousRole,
        newRole: log.newRole,
        reason: log.reason,
        requestId: log.requestId,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        createdAt: log.createdAt,
      });
    }

    return enrichedLogs;
  },
});

/**
 * Record a membership audit log entry
 */
export const recordMembershipAuditLog = mutation({
  args: {
    workspaceId: v.string(),
    actorUserId: v.string(),
    targetUserId: v.string(),
    actionType: v.string(),
    membershipType: v.union(v.literal("workspace"), v.literal("application"), v.literal("branch")),
    membershipId: v.string(),
    applicationKey: v.optional(v.string()),
    branchId: v.optional(v.string()),
    previousRole: v.optional(v.string()),
    newRole: v.optional(v.string()),
    reason: v.optional(v.string()),
    requestId: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const wsId = ctx.db.normalizeId("workspaces", args.workspaceId);
    const now = Date.now();

    const logId = await ctx.db.insert("membershipAuditLogs", {
      workspaceId: wsId || args.workspaceId,
      actorUserId: args.actorUserId as any,
      targetUserId: args.targetUserId as any,
      actionType: args.actionType,
      membershipType: args.membershipType,
      membershipId: args.membershipId,
      applicationKey: args.applicationKey,
      branchId: args.branchId as any,
      previousRole: args.previousRole,
      newRole: args.newRole,
      reason: args.reason,
      requestId: args.requestId,
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
      createdAt: now,
    });

    return logId;
  },
});
