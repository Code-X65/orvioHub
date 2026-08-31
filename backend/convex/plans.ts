import { query, mutation } from "./_generated/server.js";
import { v } from "convex/values";

const DEFAULT_PLANS = [
  {
    key: "free",
    name: "Free",
    monthlyPrice: 0, // ₦0
    annualPrice: 0,
    currency: "NGN",
    isActive: true,
  },
  {
    key: "standard",
    name: "Standard",
    monthlyPrice: 750000, // ₦7,500 in kobo
    annualPrice: 7500000, // ₦75,000 in kobo (2 months free)
    currency: "NGN",
    isActive: true,
  },
  {
    key: "premium",
    name: "Premium",
    monthlyPrice: 2000000, // ₦20,000 in kobo
    annualPrice: 20000000, // ₦200,000 in kobo
    currency: "NGN",
    isActive: true,
  },
];

export const list = query({
  args: {},
  handler: async (ctx) => {
    const plans = await ctx.db.query("plans").collect();
    if (plans.length === 0) {
      return DEFAULT_PLANS;
    }
    return plans.sort((a, b) => a.monthlyPrice - b.monthlyPrice);
  },
});

export const getByKey = query({
  args: { planKey: v.string() },
  handler: async (ctx, args) => {
    const plan = await ctx.db
      .query("plans")
      .withIndex("by_key", (q) => q.eq("key", args.planKey))
      .first();

    if (!plan) {
      const fallback = DEFAULT_PLANS.find((p) => p.key === args.planKey);
      if (fallback) return fallback;
      throw new Error(`Plan '${args.planKey}' not found`);
    }
    return plan;
  },
});

export const update = mutation({
  args: {
    planKey: v.string(),
    updates: v.object({
      name: v.optional(v.string()),
      monthlyPrice: v.optional(v.number()), // kobo
      annualPrice: v.optional(v.number()), // kobo
      isActive: v.optional(v.boolean()),
    }),
  },
  handler: async (ctx, args) => {
    const plan = await ctx.db
      .query("plans")
      .withIndex("by_key", (q) => q.eq("key", args.planKey))
      .first();

    const now = Date.now();

    if (!plan) {
      // Auto-upsert default plan with the updates
      const defaultInfo = DEFAULT_PLANS.find((p) => p.key === args.planKey) || {
        key: args.planKey,
        name: args.planKey.charAt(0).toUpperCase() + args.planKey.slice(1),
        monthlyPrice: 0,
        annualPrice: 0,
        currency: "NGN",
        isActive: true,
      };

      const newId = await ctx.db.insert("plans", {
        ...defaultInfo,
        ...args.updates,
        createdAt: now,
        updatedAt: now,
      });

      return await ctx.db.get(newId);
    }

    await ctx.db.patch(plan._id, {
      ...args.updates,
      updatedAt: now,
    });

    return await ctx.db.get(plan._id);
  },
});

export const seedDefaultPlans = mutation({
  args: {},
  handler: async (ctx) => {
    const defaultPlans = [
      {
        key: "free",
        name: "Free",
        monthlyPrice: 0, // ₦0
        annualPrice: 0,
        currency: "NGN",
        isActive: true,
      },
      {
        key: "standard",
        name: "Standard",
        monthlyPrice: 750000, // ₦7,500 in kobo
        annualPrice: 7500000, // ₦75,000 in kobo (2 months free)
        currency: "NGN",
        isActive: true,
      },
      {
        key: "premium",
        name: "Premium",
        monthlyPrice: 2000000, // ₦20,000 in kobo
        annualPrice: 20000000, // ₦200,000 in kobo
        currency: "NGN",
        isActive: true,
      },
    ];

    const now = Date.now();
    const created = [];
    for (const dp of defaultPlans) {
      const existing = await ctx.db
        .query("plans")
        .withIndex("by_key", (q) => q.eq("key", dp.key))
        .first();

      if (!existing) {
        const id = await ctx.db.insert("plans", {
          ...dp,
          createdAt: now,
          updatedAt: now,
        });
        created.push(id);
      }
    }

    return { createdCount: created.length };
  },
});
