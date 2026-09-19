import { mutation, query } from "./_generated/server.js";
import { v } from "convex/values";

/**
 * 1. Reactive Notifications Query with filtering, search, and resolution enrichment
 */
export const getNotifications = query({
  args: {
    userId: v.id("users"),
    status: v.optional(v.union(v.literal("UNREAD"), v.literal("READ"), v.literal("ARCHIVED"))),
    category: v.optional(
      v.union(
        v.literal("SECURITY"),
        v.literal("WORKSPACE"),
        v.literal("INVENTORY"),
        v.literal("BILLING"),
        v.literal("SYSTEM")
      )
    ),
    type: v.optional(v.string()),
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
    if (args.category) {
      filtered = filtered.filter((n) => n.category === args.category);
    }
    if (args.type) {
      filtered = filtered.filter((n) => n.type === args.type);
    }
    if (args.limit) {
      filtered = filtered.slice(0, args.limit);
    }

    const now = Date.now();

    // Enrich invite notifications with live resolution state
    const enriched = await Promise.all(
      filtered.map(async (notif) => {
        const isInvite =
          notif.type === "org_invite" ||
          notif.type === "workspace_invite" ||
          notif.type === "application_invite" ||
          notif.type === "branch_invite";

        if (!isInvite) {
          return notif;
        }

        let isResolved = Boolean(notif.data?.isResolved);
        let inviteStatus = notif.data?.inviteStatus || "PENDING";
        let isAlreadyMember = Boolean(notif.data?.isAlreadyMember);

        const orgId = notif.data?.organizationId;
        const wsId = notif.data?.workspaceId || notif.workspaceId;
        const inviteId = notif.data?.inviteId;

        // Check if user is already an active member in organizationMemberships
        if (orgId && !isAlreadyMember) {
          const orgMember = await ctx.db
            .query("organizationMemberships")
            .withIndex("by_org_and_user", (q: any) =>
              q.eq("organizationId", orgId).eq("userId", args.userId)
            )
            .first();
          if (orgMember && orgMember.status === "ACTIVE") {
            isAlreadyMember = true;
            isResolved = true;
            inviteStatus = "ACCEPTED";
          }
        }

        // Check if user is already an active member in workspaceMemberships
        if (wsId && !isAlreadyMember) {
          const wsMember = await ctx.db
            .query("workspaceMemberships")
            .withIndex("by_workspace_user", (q) =>
              q.eq("workspaceId", wsId as any).eq("userId", args.userId)
            )
            .first();
          if (wsMember && (wsMember.status === "active" || wsMember.status === "ACTIVE")) {
            isAlreadyMember = true;
            isResolved = true;
            inviteStatus = "ACCEPTED";
          }
        }

        // Check invite document directly if available
        if (inviteId && !isResolved) {
          try {
            const invDoc: any = await ctx.db.get(inviteId as any);
            if (invDoc) {
              const st = (invDoc.status || "").toLowerCase();
              if (st === "accepted") {
                isResolved = true;
                inviteStatus = "ACCEPTED";
              } else if (st === "cancelled" || st === "declined" || st === "revoked") {
                isResolved = true;
                inviteStatus = "CANCELLED";
              } else if (st === "expired" || (invDoc.expiresAt && invDoc.expiresAt < now)) {
                isResolved = true;
                inviteStatus = "EXPIRED";
              }
            }
          } catch {
            // ignore
          }
        }

        return {
          ...notif,
          data: {
            ...notif.data,
            isResolved,
            inviteStatus,
            isAlreadyMember,
          },
        };
      })
    );

    return enriched;
  },
});

/**
 * 2. Real-Time Unread Count Query for Header Badges
 */
export const getUnreadCount = query({
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

    let count = 0;
    for (const notif of unread) {
      const isInvite =
        notif.type === "org_invite" ||
        notif.type === "workspace_invite" ||
        notif.type === "application_invite" ||
        notif.type === "branch_invite";

      if (!isInvite) {
        count++;
        continue;
      }

      if (notif.data?.isResolved || notif.data?.inviteStatus === "ACCEPTED") {
        continue;
      }

      const orgId = notif.data?.organizationId;
      const wsId = notif.data?.workspaceId || notif.workspaceId;

      if (orgId) {
        const orgMember = await ctx.db
          .query("organizationMemberships")
          .withIndex("by_org_and_user", (q: any) =>
            q.eq("organizationId", orgId).eq("userId", args.userId)
          )
          .first();
        if (orgMember && orgMember.status === "ACTIVE") {
          continue;
        }
      }

      if (wsId) {
        const wsMember = await ctx.db
          .query("workspaceMemberships")
          .withIndex("by_workspace_user", (q) =>
            q.eq("workspaceId", wsId as any).eq("userId", args.userId)
          )
          .first();
        if (wsMember && (wsMember.status === "active" || wsMember.status === "ACTIVE")) {
          continue;
        }
      }

      count++;
    }

    return { count };
  },
});

/**
 * 3. Mark Single Notification as Read
 */
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

/**
 * 4. Mark All Notifications as Read for User
 */
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

/**
 * 5. Archive Notification
 */
export const archiveNotification = mutation({
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
      status: "ARCHIVED",
    });
    return { success: true };
  },
});

/**
 * 6. Send Single In-App Notification Directly
 */
export const sendNotification = mutation({
  args: {
    userId: v.id("users"),
    workspaceId: v.optional(v.id("workspaces")),
    productKey: v.optional(v.string()),
    type: v.string(),
    title: v.string(),
    body: v.string(),
    data: v.optional(v.any()),
    severity: v.union(v.literal("INFO"), v.literal("SUCCESS"), v.literal("WARNING"), v.literal("ERROR")),
    category: v.optional(
      v.union(
        v.literal("SECURITY"),
        v.literal("WORKSPACE"),
        v.literal("INVENTORY"),
        v.literal("BILLING"),
        v.literal("SYSTEM")
      )
    ),
    priority: v.optional(
      v.union(
        v.literal("LOW"),
        v.literal("NORMAL"),
        v.literal("HIGH"),
        v.literal("URGENT")
      )
    ),
    actionUrl: v.optional(v.string()),
    actionLabel: v.optional(v.string()),
    dedupeKey: v.optional(v.string()),
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
      data: args.data,
      severity: args.severity,
      category: args.category || "WORKSPACE",
      priority: args.priority || "NORMAL",
      actionUrl: args.actionUrl,
      actionLabel: args.actionLabel,
      dedupeKey: args.dedupeKey,
      channel: args.channel || "IN_APP",
      status: "UNREAD",
      createdAt: Date.now(),
    });
    return notifId;
  },
});

/**
 * 7. Broadcast Notification to All Active Members of a Workspace
 */
export const broadcastToWorkspace = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    roles: v.optional(v.array(v.string())), // e.g. ["OWNER", "ADMIN"]
    type: v.string(),
    title: v.string(),
    body: v.string(),
    data: v.optional(v.any()),
    severity: v.union(v.literal("INFO"), v.literal("SUCCESS"), v.literal("WARNING"), v.literal("ERROR")),
    category: v.union(
      v.literal("SECURITY"),
      v.literal("WORKSPACE"),
      v.literal("INVENTORY"),
      v.literal("BILLING"),
      v.literal("SYSTEM")
    ),
    priority: v.union(
      v.literal("LOW"),
      v.literal("NORMAL"),
      v.literal("HIGH"),
      v.literal("URGENT")
    ),
    actionUrl: v.optional(v.string()),
    actionLabel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const members = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    const now = Date.now();
    const notificationIds: any[] = [];

    for (const member of members) {
      if (args.roles && args.roles.length > 0 && !args.roles.includes(member.role.toUpperCase())) {
        continue;
      }

      const id = await ctx.db.insert("notifications", {
        userId: member.userId,
        workspaceId: args.workspaceId,
        type: args.type,
        title: args.title,
        body: args.body,
        data: args.data,
        severity: args.severity,
        category: args.category,
        priority: args.priority,
        actionUrl: args.actionUrl,
        actionLabel: args.actionLabel,
        channel: "IN_APP",
        status: "UNREAD",
        createdAt: now,
      });

      notificationIds.push(id);
    }

    return { sentCount: notificationIds.length };
  },
});

/**
 * 8. Cleanup Old Read Notifications (Cron Target: 30-Day Retention)
 */
export const cleanupOldNotifications = mutation({
  args: {
    olderThanDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const days = args.olderThanDays || 30;
    const threshold = Date.now() - days * 24 * 60 * 60 * 1000;

    const oldNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_status_created", (q) =>
        q.eq("status", "READ")
      )
      .filter((q) => q.lt(q.field("createdAt"), threshold))
      .take(500);

    let deletedCount = 0;
    for (const notif of oldNotifications) {
      await ctx.db.delete(notif._id);
      deletedCount++;
    }

    return { deletedCount };
  },
});
