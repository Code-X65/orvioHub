import { mutation, query } from "./_generated/server.js";
import { v } from "convex/values";

export const getNotifications = query({
  args: {
    userId: v.id("users"),
    status: v.optional(v.union(v.literal("UNREAD"), v.literal("READ"), v.literal("ARCHIVED"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let q = ctx.db
      .query("notifications")
      .withIndex("by_userId", (query) => query.eq("userId", args.userId));

    const list = await q.order("desc").collect();
    let filtered = list;
    if (args.status) {
      filtered = filtered.filter((n) => n.status === args.status);
    }
    if (args.limit) {
      filtered = filtered.slice(0, args.limit);
    }
    return filtered;
  },
});

export const markNotificationRead = mutation({
  args: {
    notificationId: v.id("notifications"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const notif = await ctx.db.get(args.notificationId);
    if (!notif || notif.userId !== args.userId) {
      throw new Error("NOTIFICATION_NOT_FOUND");
    }
    await ctx.db.patch(args.notificationId, {
      status: "READ",
      readAt: Date.now(),
    });
    return { success: true };
  },
});

export const markAllNotificationsRead = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_and_status", (q) =>
        q.eq("userId", args.userId).eq("status", "UNREAD")
      )
      .collect();

    const now = Date.now();
    for (const notif of unread) {
      await ctx.db.patch(notif._id, {
        status: "READ",
        readAt: now,
      });
    }
    return { count: unread.length };
  },
});

export const sendNotification = mutation({
  args: {
    userId: v.id("users"),
    workspaceId: v.optional(v.id("workspaces")),
    productKey: v.optional(v.string()),
    type: v.string(),
    title: v.string(),
    body: v.string(),
    severity: v.union(v.literal("INFO"), v.literal("SUCCESS"), v.literal("WARNING"), v.literal("ERROR")),
    channel: v.optional(v.union(v.literal("IN_APP"), v.literal("EMAIL"), v.literal("SMS"), v.literal("WHATSAPP"))),
  },
  handler: async (ctx, args) => {
    const notifId = await ctx.db.insert("notifications", {
      userId: args.userId,
      workspaceId: args.workspaceId,
      productKey: args.productKey,
      type: args.type,
      title: args.title,
      body: args.body,
      severity: args.severity,
      channel: args.channel || "IN_APP",
      status: "UNREAD",
      createdAt: Date.now(),
    });
    return notifId;
  },
});
