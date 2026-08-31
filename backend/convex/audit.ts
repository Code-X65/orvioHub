import { query, mutation } from "./_generated/server.js";
import { v } from "convex/values";

export const getOrganizationAuditLogs = query({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    page: v.optional(v.number()),
    limit: v.optional(v.number()),
    action: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_org_and_user", (q: any) =>
        q.eq("organizationId", args.organizationId).eq("userId", args.userId)
      )
      .first();

    if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
      throw new Error("ORGANIZATION_ACCESS_DENIED");
    }

    const page = Math.max(1, args.page || 1);
    const limit = Math.min(100, Math.max(1, args.limit || 20));

    let logs = await ctx.db
      .query("auditLogs")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .order("desc")
      .collect();

    if (args.action && args.action.trim()) {
      const filterAction = args.action.trim().toLowerCase();
      logs = logs.filter((log) => log.action.toLowerCase().includes(filterAction));
    }

    const total = logs.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedLogs = logs.slice(startIndex, startIndex + limit);

    // Enrich logs with actor information
    const enrichedLogs = await Promise.all(
      paginatedLogs.map(async (log) => {
        let actor: { id: string; name: string; email: string } | null = null;
        if (log.actorId) {
          try {
            const user = (await ctx.db.get(log.actorId as any)) as any;
            if (user && user.name) {
              actor = {
                id: user._id,
                name: user.name,
                email: user.email,
              };
            }
          } catch {
            // actorId was not a valid DB id
          }
        }
        return {
          id: log._id,
          actorId: log.actorId,
          actor,
          organizationId: log.organizationId,
          action: log.action,
          resource: log.resource,
          metadata: log.metadata,
          timestamp: log.timestamp,
        };
      })
    );

    return {
      logs: enrichedLogs,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  },
});

export const logAuditEvent = mutation({
  args: {
    actorId: v.optional(v.string()),
    actorUserId: v.optional(v.string()),
    targetUserId: v.optional(v.string()),
    workspaceId: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
    productKey: v.optional(v.string()),
    eventType: v.optional(v.string()),
    action: v.string(),
    entityType: v.optional(v.string()),
    entityId: v.optional(v.string()),
    resource: v.string(),
    severity: v.optional(
      v.union(v.literal("info"), v.literal("warning"), v.literal("critical"))
    ),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    requestId: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const actor = args.actorUserId || args.actorId;
    return await ctx.db.insert("auditLogs", {
      actorId: actor,
      actorUserId: actor,
      targetUserId: args.targetUserId,
      workspaceId: args.workspaceId,
      organizationId: args.organizationId,
      productKey: args.productKey,
      eventType: args.eventType || args.action,
      action: args.action,
      entityType: args.entityType,
      entityId: args.entityId,
      resource: args.resource,
      severity: args.severity || "info",
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
      requestId: args.requestId,
      metadata: args.metadata,
      createdAt: now,
      timestamp: now,
    });
  },
});

export const getActorAuditLogs = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(100, Math.max(1, args.limit || 20));
    return await ctx.db
      .query("auditLogs")
      .withIndex("by_actorId", (q) => q.eq("actorId", args.userId))
      .order("desc")
      .take(limit);
  },
});
