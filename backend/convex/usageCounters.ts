import { query, mutation } from "./_generated/server.js";
import { v } from "convex/values";

export const getByWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    // 1. Live count of members
    const members = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .filter((q) => q.eq(q.field("status"), "ACTIVE"))
      .collect();

    // 2. Live count of active apps
    const apps = await ctx.db
      .query("workspaceProducts")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    // 3. Live count of inventory products
    const products = await ctx.db
      .query("inventoryProducts")
      .withIndex("by_workspaceId", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    // 4. Stored usage counters
    const counters = await ctx.db
      .query("usageCounters")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const counterMap: Record<string, any> = {};
    for (const c of counters) {
      counterMap[c.featureKey] = c;
    }

    return {
      workspaceId: args.workspaceId,
      counters: {
        membersCount: members.length,
        appsCount: apps.length,
        productsCount: products.filter((p) => !p.deletedAt).length,
        transactionsCount: counterMap["transactions.count"]?.usageValue || 0,
      },
      records: counters,
    };
  },
});

export const increment = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    featureKey: v.string(),
    amount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const amount = args.amount ?? 1;
    const now = Date.now();

    const existing = await ctx.db
      .query("usageCounters")
      .withIndex("by_workspace_feature", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("featureKey", args.featureKey)
      )
      .first();

    if (existing) {
      const newUsage = existing.usageValue + amount;
      await ctx.db.patch(existing._id, {
        usageValue: newUsage,
        updatedAt: now,
      });
      return { success: true, usageValue: newUsage };
    }

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const endOfMonth = new Date(startOfMonth);
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);

    const id = await ctx.db.insert("usageCounters", {
      workspaceId: args.workspaceId,
      featureKey: args.featureKey,
      periodStart: startOfMonth.getTime(),
      periodEnd: endOfMonth.getTime(),
      usageValue: amount,
      limitValue: 1000,
      updatedAt: now,
    });

    return { success: true, usageValue: amount, id };
  },
});

export const resetMonthly = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const counters = await ctx.db
      .query("usageCounters")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const now = Date.now();
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const endOfMonth = new Date(startOfMonth);
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);

    for (const c of counters) {
      await ctx.db.patch(c._id, {
        periodStart: startOfMonth.getTime(),
        periodEnd: endOfMonth.getTime(),
        usageValue: 0,
        updatedAt: now,
      });
    }

    return { success: true, resetCount: counters.length };
  },
});
