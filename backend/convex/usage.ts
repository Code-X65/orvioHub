import { mutation, query } from "./_generated/server.js";
import { v } from "convex/values";

export const incrementUsage = mutation({
  args: {
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    productKey: v.optional(v.string()),
    featureKey: v.string(),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const monthStart = new Date(now);
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);

    const counter = await ctx.db
      .query("usageCounters")
      .withIndex("by_user_workspace_product_feature", (q) =>
        q
          .eq("userId", args.userId)
          .eq("workspaceId", args.workspaceId)
          .eq("productKey", args.productKey)
          .eq("featureKey", args.featureKey)
      )
      .filter((q) =>
        q.and(
          q.gte(q.field("periodStart"), monthStart.getTime()),
          q.lt(q.field("periodStart"), monthEnd.getTime())
        )
      )
      .first();

    if (counter) {
      await ctx.db.patch(counter._id, {
        usageValue: counter.usageValue + args.amount,
        updatedAt: now,
      });
      return counter._id;
    } else {
      return await ctx.db.insert("usageCounters", {
        userId: args.userId,
        workspaceId: args.workspaceId,
        productKey: args.productKey,
        featureKey: args.featureKey,
        periodStart: monthStart.getTime(),
        periodEnd: monthEnd.getTime(),
        usageValue: args.amount,
        limitValue: 0,
        updatedAt: now,
      });
    }
  },
});

export const getUsage = query({
  args: { userId: v.id("users"), workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const now = Date.now();
    const monthStart = new Date(now);
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);

    const counters = await ctx.db
      .query("usageCounters")
      .withIndex("by_user_workspace", (q) =>
        q.eq("userId", args.userId).eq("workspaceId", args.workspaceId)
      )
      .filter((q) =>
        q.and(
          q.gte(q.field("periodStart"), monthStart.getTime()),
          q.lt(q.field("periodStart"), monthEnd.getTime())
        )
      )
      .collect();

    const usage: Record<string, { current: number; limit: number }> = {};
    for (const counter of counters) {
      usage[counter.featureKey] = {
        current: counter.usageValue,
        limit: counter.limitValue,
      };
    }

    return usage;
  },
});
