import { mutation, internalMutation, internalAction, query } from "./_generated/server.js";
import { internal } from "./_generated/api.js";
import { v } from "convex/values";

/**
 * 1. Enqueue a notification with deduplication and priority rules
 */
export const enqueueNotification = mutation({
  args: {
    userId: v.id("users"),
    workspaceId: v.optional(v.id("workspaces")),
    type: v.string(),
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
    title: v.string(),
    body: v.string(),
    data: v.optional(v.any()),
    actionUrl: v.optional(v.string()),
    actionLabel: v.optional(v.string()),
    dedupeKey: v.optional(v.string()),
    channel: v.optional(v.union(v.literal("IN_APP"), v.literal("EMAIL"), v.literal("SMS"), v.literal("WHATSAPP"))),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // 1. Deduplication Check
    if (args.dedupeKey) {
      const existing = await ctx.db
        .query("notificationQueue")
        .withIndex("by_dedupeKey", (q) => q.eq("dedupeKey", args.dedupeKey))
        .filter((q) =>
          q.or(
            q.eq(q.field("status"), "pending"),
            q.eq(q.field("status"), "processing"),
            q.and(
              q.eq(q.field("status"), "delivered"),
              q.gt(q.field("createdAt"), now - 60000) // Dedupe window: 60s
            )
          )
        )
        .first();

      if (existing) {
        console.log(`[NotificationQueue] Deduplicated redundant notification: ${args.dedupeKey}`);
        return existing._id;
      }
    }

    // 2. Low-Priority Batching (e.g., repeated low-stock alerts)
    if (args.priority === "LOW") {
      const recentSimilar = await ctx.db
        .query("notifications")
        .withIndex("by_user_category", (q) =>
          q.eq("userId", args.userId).eq("category", args.category)
        )
        .filter((q) =>
          q.and(
            q.eq(q.field("priority"), "LOW"),
            q.eq(q.field("status"), "UNREAD"),
            q.gt(q.field("createdAt"), now - 300000) // 5 minutes sliding window
          )
        )
        .first();

      if (recentSimilar) {
        const currentBatch = recentSimilar.batchCount || 1;
        const newBatchCount = currentBatch + 1;
        await ctx.db.patch(recentSimilar._id, {
          title: `${recentSimilar.title} (${newBatchCount} items)`,
          body: `${recentSimilar.body} and ${newBatchCount - 1} other items.`,
          batchCount: newBatchCount,
          data: {
            ...recentSimilar.data,
            lastBatchUpdate: now,
            batchedItemsCount: newBatchCount,
          },
        });

        // Insert as delivered queue record for audit trail
        const queueId = await ctx.db.insert("notificationQueue", {
          userId: args.userId,
          workspaceId: args.workspaceId,
          type: args.type,
          category: args.category,
          priority: args.priority,
          title: args.title,
          body: args.body,
          data: args.data,
          actionUrl: args.actionUrl,
          actionLabel: args.actionLabel,
          dedupeKey: args.dedupeKey,
          channel: args.channel || "IN_APP",
          status: "delivered",
          attempts: 1,
          createdAt: now,
          processedAt: now,
        });

        return queueId;
      }
    }

    // 3. Insert into queue
    const queueId = await ctx.db.insert("notificationQueue", {
      userId: args.userId,
      workspaceId: args.workspaceId,
      type: args.type,
      category: args.category,
      priority: args.priority,
      title: args.title,
      body: args.body,
      data: args.data,
      actionUrl: args.actionUrl,
      actionLabel: args.actionLabel,
      dedupeKey: args.dedupeKey,
      channel: args.channel || "IN_APP",
      status: "pending",
      attempts: 0,
      createdAt: now,
    });

    // 4. Schedule processing immediately
    await ctx.scheduler.runAfter(0, internal.notificationQueue.processNotificationQueueItem, {
      queueId,
    });

    return queueId;
  },
});

/**
 * 2. Process an individual queued notification
 */
export const processNotificationQueueItem = internalMutation({
  args: {
    queueId: v.id("notificationQueue"),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.queueId);
    if (!item || item.status === "delivered") return;

    const now = Date.now();
    await ctx.db.patch(args.queueId, {
      status: "processing",
      attempts: (item.attempts || 0) + 1,
    });

    try {
      // 1. Check user delivery preferences
      const pref = await ctx.db
        .query("notificationPreferences")
        .withIndex("by_user_and_category", (q) =>
          q.eq("userId", item.userId).eq("category", item.category)
        )
        .first();

      const inAppEnabled = pref ? pref.enabled : true;

      // 2. Check active page suppression
      let shouldSuppressToast = false;
      if (item.actionUrl) {
        const activity = await ctx.db
          .query("userActivities")
          .withIndex("by_userId", (q) => q.eq("userId", item.userId))
          .first();

        if (activity && now - activity.lastActiveAt < 30000) {
          // If user active in last 30s on exact page
          if (activity.page && item.actionUrl.includes(activity.page)) {
            shouldSuppressToast = true;
          }
        }
      }

      // 3. Insert into active notifications table (Convex live reactive stream)
      if (inAppEnabled) {
        await ctx.db.insert("notifications", {
          userId: item.userId,
          workspaceId: item.workspaceId,
          type: item.type,
          title: item.title,
          body: item.body,
          data: {
            ...item.data,
            suppressToast: shouldSuppressToast,
          },
          severity:
            item.priority === "URGENT"
              ? "ERROR"
              : item.priority === "HIGH"
              ? "WARNING"
              : item.priority === "NORMAL"
              ? "SUCCESS"
              : "INFO",
          category: item.category,
          priority: item.priority,
          actionUrl: item.actionUrl,
          actionLabel: item.actionLabel,
          dedupeKey: item.dedupeKey,
          channel: item.channel || "IN_APP",
          status: "UNREAD",
          createdAt: now,
        });
      }

      // 4. If email channel requested, queue to emailOutbox for Brevo delivery
      if (item.channel === "EMAIL" || item.priority === "URGENT") {
        const user = await ctx.db.get(item.userId);
        if (user && user.email) {
          await ctx.db.insert("emailOutbox", {
            to: user.email,
            template: item.category === "SECURITY" ? "securityAlert" : "invitation",
            payload: {
              title: item.title,
              body: item.body,
              actionUrl: item.actionUrl || "https://orviohub.localhost:3000",
              actionLabel: item.actionLabel || "View in Orviohub",
            },
            status: "PENDING",
            attempts: 0,
            nextAttemptAt: now,
            createdAt: now,
            updatedAt: now,
          });
        }
      }

      // 5. Mark queue item as delivered
      await ctx.db.patch(args.queueId, {
        status: "delivered",
        processedAt: now,
      });
    } catch (err: any) {
      console.error(`[NotificationQueue] Error processing queue item ${args.queueId}:`, err);
      const attempts = (item.attempts || 0) + 1;

      if (attempts < 3) {
        // Exponential backoff retry: 1min, 2min
        const retryDelay = 60000 * Math.pow(2, attempts - 1);
        await ctx.db.patch(args.queueId, {
          status: "pending",
          lastError: err?.message || String(err),
        });
        await ctx.scheduler.runAfter(retryDelay, internal.notificationQueue.processNotificationQueueItem, {
          queueId: args.queueId,
        });
      } else {
        await ctx.db.patch(args.queueId, {
          status: "failed",
          lastError: err?.message || "Max retries exceeded",
          processedAt: now,
        });
      }
    }
  },
});

/**
 * 3. Record user active page (for active-screen toast suppression)
 */
export const recordUserActivity = mutation({
  args: {
    userId: v.id("users"),
    workspaceId: v.optional(v.id("workspaces")),
    page: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("userActivities")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        page: args.page,
        workspaceId: args.workspaceId,
        lastActiveAt: now,
      });
    } else {
      await ctx.db.insert("userActivities", {
        userId: args.userId,
        workspaceId: args.workspaceId,
        page: args.page,
        lastActiveAt: now,
      });
    }
  },
});

/**
 * 4. Query pending queue stats (for admin / monitoring)
 */
export const getQueueStats = query({
  args: {},
  handler: async (ctx) => {
    const pending = await ctx.db
      .query("notificationQueue")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    const failed = await ctx.db
      .query("notificationQueue")
      .withIndex("by_status", (q) => q.eq("status", "failed"))
      .collect();

    return {
      pendingCount: pending.length,
      failedCount: failed.length,
    };
  },
});
