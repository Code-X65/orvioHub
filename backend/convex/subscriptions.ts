import { query, mutation } from "./_generated/server.js";
import { v } from "convex/values";

export const getByWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    if (!sub) {
      // Auto fallback structure
      const now = Date.now();
      return {
        workspaceId: args.workspaceId,
        planKey: "free",
        status: "active" as const,
        currentPeriodStart: now,
        currentPeriodEnd: now + 365 * 86_400_000,
        cancelAtPeriodEnd: false,
      };
    }

    return sub;
  },
});

export const updatePlan = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    planKey: v.string(),
    status: v.optional(v.union(v.literal("active"), v.literal("cancelled"), v.literal("past_due"))),
    currentPeriodEnd: v.optional(v.number()),
    cancelAtPeriodEnd: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        planKey: args.planKey,
        status: args.status || existing.status || "active",
        currentPeriodEnd: args.currentPeriodEnd || existing.currentPeriodEnd || now + 30 * 86_400_000,
        cancelAtPeriodEnd: args.cancelAtPeriodEnd ?? existing.cancelAtPeriodEnd ?? false,
        updatedAt: now,
      });

      // Also update plan on workspace record
      await ctx.db.patch(args.workspaceId, {
        planId: args.planKey,
        updatedAt: now,
      });

      return await ctx.db.get(existing._id);
    }

    const subId = await ctx.db.insert("subscriptions", {
      workspaceId: args.workspaceId,
      planKey: args.planKey,
      status: args.status || "active",
      currentPeriodStart: now,
      currentPeriodEnd: args.currentPeriodEnd || now + 30 * 86_400_000,
      cancelAtPeriodEnd: args.cancelAtPeriodEnd || false,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(args.workspaceId, {
      planId: args.planKey,
      updatedAt: now,
    });

    return await ctx.db.get(subId);
  },
});

export const createDefault = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    if (existing) {
      return existing;
    }

    const now = Date.now();
    const subId = await ctx.db.insert("subscriptions", {
      workspaceId: args.workspaceId,
      planKey: "free",
      status: "active",
      currentPeriodStart: now,
      currentPeriodEnd: now + 365 * 86_400_000,
      cancelAtPeriodEnd: false,
      createdAt: now,
      updatedAt: now,
    });

    return await ctx.db.get(subId);
  },
});

/**
 * Super Admin: List all workspace subscriptions with workspace & owner details
 */
export const listAll = query({
  args: {
    planKey: v.optional(v.string()),
    status: v.optional(v.string()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let subs = await ctx.db.query("subscriptions").collect();

    if (args.planKey && args.planKey !== "all") {
      subs = subs.filter((s) => s.planKey === args.planKey);
    }

    if (args.status && args.status !== "all") {
      subs = subs.filter((s) => s.status === args.status);
    }

    // Enrich with workspace & owner information
    const enriched = await Promise.all(
      subs.map(async (sub) => {
        const workspace = await ctx.db.get(sub.workspaceId);
        let owner: any = null;
        if (workspace?.ownerId) {
          owner = await ctx.db.get(workspace.ownerId);
        }

        return {
          ...sub,
          workspaceName: workspace?.name || "Workspace",
          workspaceSlug: workspace?.slug || "",
          ownerName: owner?.name || "Unknown",
          ownerEmail: owner?.email || "",
        };
      })
    );

    if (args.search) {
      const q = args.search.toLowerCase();
      return enriched.filter(
        (item) =>
          item.workspaceName.toLowerCase().includes(q) ||
          item.workspaceSlug.toLowerCase().includes(q) ||
          item.ownerEmail.toLowerCase().includes(q) ||
          item.ownerName.toLowerCase().includes(q)
      );
    }

    return enriched;
  },
});

/**
 * Super Admin: Platform Revenue & Subscriptions Overview Stats
 */
export const getOverviewStats = query({
  args: {},
  handler: async (ctx) => {
    const subs = await ctx.db.query("subscriptions").collect();
    const plans = await ctx.db.query("plans").collect();

    const planPriceMap: Record<string, number> = {};
    for (const p of plans) {
      planPriceMap[p.key] = p.monthlyPrice;
    }

    const countsByPlan: Record<string, number> = {
      free: 0,
      standard: 0,
      premium: 0,
    };

    let totalMRRKobo = 0;
    const now = Date.now();
    const sevenDaysFromNow = now + 7 * 86_400_000;
    let expiringSoonCount = 0;

    for (const sub of subs) {
      const pKey = sub.planKey || "free";
      countsByPlan[pKey] = (countsByPlan[pKey] || 0) + 1;

      if (sub.status === "active") {
        const price = planPriceMap[pKey] || (pKey === "standard" ? 750_000 : pKey === "premium" ? 2_000_000 : 0);
        totalMRRKobo += price;

        if (pKey !== "free" && sub.currentPeriodEnd > now && sub.currentPeriodEnd <= sevenDaysFromNow) {
          expiringSoonCount++;
        }
      }
    }

    return {
      totalSubscriptions: subs.length,
      totalMRRKobo,
      totalMRRNaira: totalMRRKobo / 100,
      expiringSoonCount,
      countsByPlan,
    };
  },
});
