import { mutation, query } from "./_generated/server.js";
import { v } from "convex/values";

export const logAuthEvent = mutation({
  args: {
    eventType: v.string(),
    userId: v.optional(v.union(v.id("users"), v.string())),
    sessionId: v.optional(v.union(v.id("sessions"), v.string())),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    let resolvedUserId: any = undefined;
    if (args.userId) {
      try {
        const u = await ctx.db.get(args.userId as any);
        if (u) resolvedUserId = u._id;
      } catch {
        const u = await ctx.db.query("users").filter((q) => q.eq(q.field("_id"), args.userId as any)).first();
        if (u) resolvedUserId = u._id;
      }
    }
    let resolvedSessionId: any = undefined;
    if (args.sessionId) {
      try {
        const s = await ctx.db.get(args.sessionId as any);
        if (s) resolvedSessionId = s._id;
      } catch {}
    }
    const now = Date.now();
    const eventId = await ctx.db.insert("authEvents", {
      eventType: args.eventType,
      userId: resolvedUserId,
      sessionId: resolvedSessionId,
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
      metadata: args.metadata,
      createdAt: now,
    });
    return eventId;
  },
});

export const getUserAuthEvents = query({
  args: {
    userId: v.union(v.id("users"), v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let resolvedUserId = args.userId as any;
    try {
      const u = await ctx.db.get(args.userId as any);
      if (u) resolvedUserId = u._id;
    } catch {
      const u = await ctx.db.query("users").filter((q) => q.eq(q.field("_id"), args.userId as any)).first();
      if (u) resolvedUserId = u._id;
    }
    const limit = args.limit || 50;
    const events = await ctx.db
      .query("authEvents")
      .withIndex("by_userId", (q) => q.eq("userId", resolvedUserId))
      .order("desc")
      .take(limit);
    return events;
  },
});

export const getAuthEventsByEventType = query({
  args: {
    eventType: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    const events = await ctx.db
      .query("authEvents")
      .withIndex("by_eventType", (q) => q.eq("eventType", args.eventType))
      .order("desc")
      .take(limit);
    return events;
  },
});
