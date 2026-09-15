import { query, mutation } from "./_generated/server.js";
import { v } from "convex/values";

export const DEFAULT_PLANS = [
  {
    key: "free",
    name: "Free Trial",
    type: "free",
    priceAmount: 0,
    price: {
      monthly: 0,
      annual: 0,
    },
    limits: {
      maxOrganizations: 1,
      maxAppsPerOrganization: 1,
      maxBranchesPerApp: 1,
      maxMembersPerOrganization: 2,
      maxProductsPerWorkspace: 500,
      maxTransactionsPerMonth: 500,
      maxWorkspaces: 1,
      maxAppsPerWorkspace: 1,
      maxMembersPerWorkspace: 2,
      orgs: 1,
      apps: 1,
      members: 2,
      branches: 1,
      products: 500,
      transactions: 500,
    },
    features: {
      maxApplications: 1,
      maxBranchesPerApplication: 1,
      appsIncluded: ["inventory"],
      advancedReports: false,
    },
    allowedApps: ["inventory"],
    allowedAppKeys: ["inventory"],
    trialDays: 30,
    trialDurationDays: 30,
    isActive: true,
  },
  {
    key: "free_trial",
    name: "Free Trial",
    type: "free",
    priceAmount: 0,
    price: {
      monthly: 0,
      annual: 0,
    },
    limits: {
      maxOrganizations: 1,
      maxAppsPerOrganization: 1,
      maxBranchesPerApp: 1,
      maxMembersPerOrganization: 2,
      maxProductsPerWorkspace: 500,
      maxTransactionsPerMonth: 500,
      maxWorkspaces: 1,
      maxAppsPerWorkspace: 1,
      maxMembersPerWorkspace: 2,
      orgs: 1,
      apps: 1,
      members: 2,
      branches: 1,
      products: 500,
      transactions: 500,
    },
    features: {
      maxApplications: 1,
      maxBranchesPerApplication: 1,
      appsIncluded: ["inventory"],
      advancedReports: false,
    },
    allowedApps: ["inventory"],
    allowedAppKeys: ["inventory"],
    trialDays: 30,
    trialDurationDays: 30,
    isActive: true,
  },
  {
    key: "standard",
    name: "Standard",
    type: "paid",
    priceAmount: 7500,
    price: {
      monthly: 7500,
      annual: 75000,
    },
    limits: {
      maxOrganizations: 3,
      maxAppsPerOrganization: 3,
      maxBranchesPerApp: 3,
      maxMembersPerOrganization: 10,
      maxProductsPerWorkspace: 5000,
      maxTransactionsPerMonth: 5000,
      maxWorkspaces: 3,
      maxAppsPerWorkspace: 3,
      maxMembersPerWorkspace: 10,
      orgs: 3,
      apps: 3,
      members: 10,
      branches: 3,
      products: 5000,
      transactions: 5000,
    },
    features: {
      maxApplications: 3,
      maxBranchesPerApplication: 3,
      appsIncluded: ["inventory", "tasks", "taskmanagement", "pos", "booking", "gym"],
      advancedReports: true,
    },
    allowedApps: ["inventory", "tasks", "taskmanagement", "pos", "booking", "gym"],
    allowedAppKeys: ["inventory", "tasks", "pos", "booking", "gym"],
    isActive: true,
  },
  {
    key: "premium",
    name: "Premium",
    type: "paid",
    priceAmount: 20000,
    price: {
      monthly: 20000,
      annual: 200000,
    },
    limits: {
      maxOrganizations: 10,
      maxAppsPerOrganization: "unlimited" as const,
      maxBranchesPerApp: 10,
      maxMembersPerOrganization: 50,
      maxProductsPerWorkspace: 25000,
      maxTransactionsPerMonth: 25000,
      maxWorkspaces: 10,
      maxAppsPerWorkspace: "unlimited" as const,
      maxMembersPerWorkspace: 50,
      orgs: 10,
      apps: "unlimited" as const,
      members: 50,
      branches: 10,
      products: 25000,
      transactions: 25000,
    },
    features: {
      maxApplications: 999999,
      maxBranchesPerApplication: 10,
      appsIncluded: ["inventory", "tasks", "taskmanagement", "pos", "booking", "gym", "crm", "analytics", "invoicing", "hr"],
      advancedReports: true,
    },
    allowedApps: ["inventory", "tasks", "taskmanagement", "pos", "booking", "gym", "crm", "analytics", "invoicing", "hr"],
    allowedAppKeys: ["inventory", "tasks", "pos", "booking", "gym", "crm", "analytics"],
    isActive: true,
  },
];

export const list = query({
  args: {},
  handler: async (ctx) => {
    const plans = await ctx.db.query("plans").collect();
    if (plans.length === 0) {
      return DEFAULT_PLANS.filter((p) => p.key !== "free_trial");
    }
    const seenKeys = new Set<string>();
    const filtered = plans.filter((p) => {
      const canonicalKey = p.key === "free_trial" ? "free" : p.key;
      if (seenKeys.has(canonicalKey)) return false;
      seenKeys.add(canonicalKey);
      return true;
    });

    return filtered.sort((a, b) => ((a.price?.monthly || a.monthlyPrice || 0) - (b.price?.monthly || b.monthlyPrice || 0)));
  },
});

export const getByKey = query({
  args: { planKey: v.string() },
  handler: async (ctx, args) => {
    const keyToFind = args.planKey;
    const alternateKey = keyToFind === "free" ? "free_trial" : keyToFind === "free_trial" ? "free" : null;

    let plan = await ctx.db
      .query("plans")
      .withIndex("by_key", (q) => q.eq("key", keyToFind))
      .first();

    if (!plan && alternateKey) {
      plan = await ctx.db
        .query("plans")
        .withIndex("by_key", (q) => q.eq("key", alternateKey))
        .first();
    }

    if (!plan) {
      const fallback = DEFAULT_PLANS.find((p) => p.key === keyToFind || p.key === alternateKey);
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
      price: v.optional(
        v.object({
          monthly: v.number(),
          annual: v.number(),
        })
      ),
      monthlyPrice: v.optional(v.number()),
      annualPrice: v.optional(v.number()),
      limits: v.optional(
        v.object({
          maxOrganizations: v.optional(v.number()),
          maxAppsPerOrganization: v.optional(v.union(v.number(), v.literal("unlimited"))),
          maxBranchesPerApp: v.optional(v.union(v.number(), v.literal("unlimited"))),
          maxMembersPerOrganization: v.optional(v.number()),
          maxProductsPerWorkspace: v.optional(v.number()),
          maxTransactionsPerMonth: v.optional(v.number()),
          maxWorkspaces: v.optional(v.number()),
          maxAppsPerWorkspace: v.optional(v.union(v.number(), v.literal("unlimited"))),
          maxMembersPerWorkspace: v.optional(v.number()),
          orgs: v.optional(v.number()),
          apps: v.optional(v.union(v.number(), v.literal("unlimited"))),
          members: v.optional(v.number()),
          branches: v.optional(v.union(v.number(), v.literal("unlimited"))),
          products: v.optional(v.number()),
          transactions: v.optional(v.number()),
        })
      ),
      allowedApps: v.optional(v.array(v.string())),
      allowedAppKeys: v.optional(v.array(v.string())),
      trialDays: v.optional(v.number()),
      isActive: v.optional(v.boolean()),
    }),
  },
  handler: async (ctx, args) => {
    const keyToFind = args.planKey;
    const alternateKey = keyToFind === "free" ? "free_trial" : keyToFind === "free_trial" ? "free" : null;

    let plan = await ctx.db
      .query("plans")
      .withIndex("by_key", (q) => q.eq("key", keyToFind))
      .first();

    if (!plan && alternateKey) {
      plan = await ctx.db
        .query("plans")
        .withIndex("by_key", (q) => q.eq("key", alternateKey))
        .first();
    }

    const now = Date.now();

    if (!plan) {
      const defaultInfo = DEFAULT_PLANS.find((p) => p.key === keyToFind || p.key === alternateKey) || {
        key: keyToFind,
        name: keyToFind.charAt(0).toUpperCase() + keyToFind.slice(1),
        price: { monthly: 0, annual: 0 },
        limits: {
          maxOrganizations: 1,
          maxAppsPerOrganization: 1,
          maxBranchesPerApp: 1,
          maxMembersPerOrganization: 2,
          maxProductsPerWorkspace: 500,
          maxTransactionsPerMonth: 500,
          maxWorkspaces: 1,
          maxAppsPerWorkspace: 1,
          maxMembersPerWorkspace: 2,
          orgs: 1,
          apps: 1,
          members: 2,
          branches: 1,
          products: 500,
          transactions: 500,
        },
        allowedApps: ["inventory"],
        allowedAppKeys: ["inventory"],
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
    const now = Date.now();
    const created = [];

    for (const dp of DEFAULT_PLANS) {
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
      } else {
        await ctx.db.patch(existing._id, {
          name: dp.name,
          price: dp.price,
          limits: dp.limits,
          allowedApps: dp.allowedApps,
          allowedAppKeys: dp.allowedAppKeys,
          trialDays: dp.trialDays,
          isActive: dp.isActive,
          updatedAt: now,
        });
      }
    }

    return { createdCount: created.length };
  },
});

export const adminListPlans = query({
  args: {},
  handler: async (ctx) => {
    const plans = await ctx.db.query("plans").collect();
    if (plans.length === 0) {
      return DEFAULT_PLANS.filter((p) => p.key !== "free_trial");
    }
    return plans.sort((a, b) => {
      const pA = a.priceAmount ?? a.price?.monthly ?? a.monthlyPrice ?? 0;
      const pB = b.priceAmount ?? b.price?.monthly ?? b.monthlyPrice ?? 0;
      return pA - pB;
    });
  },
});

export const adminGetPlan = query({
  args: {
    planId: v.optional(v.union(v.id("plans"), v.string())),
    planKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let plan = null;
    if (args.planId) {
      const normId = ctx.db.normalizeId("plans", args.planId);
      if (normId) {
        plan = await ctx.db.get(normId);
      }
    }
    if (!plan && (args.planKey || args.planId)) {
      const key = args.planKey || (args.planId as string);
      plan = await ctx.db
        .query("plans")
        .withIndex("by_key", (q) => q.eq("key", key))
        .first();
    }
    if (!plan && args.planKey) {
      const altKey = args.planKey === "free" ? "free_trial" : args.planKey === "free_trial" ? "free" : null;
      if (altKey) {
        plan = await ctx.db
          .query("plans")
          .withIndex("by_key", (q) => q.eq("key", altKey))
          .first();
      }
    }
    if (!plan) {
      const fallback = DEFAULT_PLANS.find((p) => p.key === args.planKey || p.key === args.planId);
      if (fallback) return fallback;
      throw new Error(`Plan not found`);
    }
    return plan;
  },
});

export const adminCreatePlan = mutation({
  args: {
    key: v.string(),
    name: v.string(),
    type: v.string(), // "free" | "paid"
    priceAmount: v.number(),
    currency: v.optional(v.string()),
    interval: v.optional(v.string()), // "month" | "year"
    trialDurationDays: v.optional(v.number()),
    features: v.optional(v.any()),
    limits: v.optional(v.any()),
    allowedApps: v.optional(v.array(v.string())),
    active: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
    adminSessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const key = args.key.trim().toLowerCase().replace(/\s+/g, "_");
    const existing = await ctx.db
      .query("plans")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();

    if (existing) {
      throw new Error(`A plan with key '${key}' already exists.`);
    }

    const now = Date.now();
    const isActive = args.isActive ?? args.active ?? true;
    const monthlyPrice = args.interval === "year" ? Math.round(args.priceAmount / 12) : args.priceAmount;
    const annualPrice = args.interval === "year" ? args.priceAmount : args.priceAmount * 10;

    const newPlanId = await ctx.db.insert("plans", {
      key,
      name: args.name.trim(),
      type: args.type,
      priceAmount: args.priceAmount,
      currency: args.currency || "NGN",
      trialDurationDays: args.trialDurationDays ?? (args.type === "free" ? 30 : undefined),
      trialDays: args.trialDurationDays ?? (args.type === "free" ? 30 : undefined),
      price: {
        monthly: monthlyPrice,
        annual: annualPrice,
      },
      monthlyPrice,
      annualPrice,
      features: args.features || {
        maxApplications: args.limits?.maxAppsPerOrganization ?? (args.type === "free" ? 1 : 3),
        maxBranchesPerApplication: args.limits?.maxBranchesPerApp ?? (args.type === "free" ? 1 : 3),
        appsIncluded: args.allowedApps || (args.type === "free" ? ["inventory"] : ["inventory", "tasks"]),
        advancedReports: args.type !== "free",
      },
      limits: args.limits || {
        maxOrganizations: args.type === "free" ? 1 : 3,
        maxAppsPerOrganization: args.type === "free" ? 1 : 3,
        maxBranchesPerApp: args.type === "free" ? 1 : 3,
        maxMembersPerOrganization: args.type === "free" ? 2 : 10,
        maxProductsPerWorkspace: args.type === "free" ? 500 : 5000,
        maxTransactionsPerMonth: args.type === "free" ? 500 : 5000,
      },
      allowedApps: args.allowedApps || (args.type === "free" ? ["inventory"] : ["inventory", "tasks"]),
      allowedAppKeys: args.allowedApps || (args.type === "free" ? ["inventory"] : ["inventory", "tasks"]),
      isActive,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("adminAuditLogs", {
      action: "admin.plan_created",
      resourceType: "plans",
      resourceId: newPlanId,
      details: {
        key,
        name: args.name,
        priceAmount: args.priceAmount,
        type: args.type,
      },
      createdAt: now,
    });

    return await ctx.db.get(newPlanId);
  },
});

export const adminUpdatePlan = mutation({
  args: {
    planId: v.optional(v.union(v.id("plans"), v.string())),
    planKey: v.optional(v.string()),
    updates: v.object({
      name: v.optional(v.string()),
      type: v.optional(v.string()),
      priceAmount: v.optional(v.number()),
      currency: v.optional(v.string()),
      interval: v.optional(v.string()),
      trialDurationDays: v.optional(v.number()),
      features: v.optional(v.any()),
      limits: v.optional(v.any()),
      price: v.optional(
        v.object({
          monthly: v.number(),
          annual: v.number(),
        })
      ),
      monthlyPrice: v.optional(v.number()),
      annualPrice: v.optional(v.number()),
      allowedApps: v.optional(v.array(v.string())),
      allowedAppKeys: v.optional(v.array(v.string())),
      isActive: v.optional(v.boolean()),
      active: v.optional(v.boolean()),
    }),
    adminSessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let plan: any = null;
    if (args.planId) {
      const normId = ctx.db.normalizeId("plans", args.planId);
      if (normId) {
        plan = await ctx.db.get(normId);
      }
    }
    if (!plan && (args.planKey || args.planId)) {
      const key = args.planKey || (args.planId as string);
      plan = await ctx.db
        .query("plans")
        .withIndex("by_key", (q) => q.eq("key", key))
        .first();
    }

    const now = Date.now();
    const isActive = args.updates.isActive ?? args.updates.active;

    if (!plan) {
      // Create if it doesn't exist
      const key = (args.planKey || (args.planId as string) || "standard").toLowerCase();
      const newId = await ctx.db.insert("plans", {
        key,
        name: args.updates.name || key,
        type: args.updates.type || "paid",
        priceAmount: args.updates.priceAmount ?? args.updates.price?.monthly ?? 7500,
        currency: args.updates.currency || "NGN",
        trialDurationDays: args.updates.trialDurationDays,
        trialDays: args.updates.trialDurationDays,
        price: args.updates.price || {
          monthly: args.updates.monthlyPrice ?? 7500,
          annual: args.updates.annualPrice ?? 75000,
        },
        monthlyPrice: args.updates.monthlyPrice ?? 7500,
        annualPrice: args.updates.annualPrice ?? 75000,
        features: args.updates.features,
        limits: args.updates.limits,
        allowedApps: args.updates.allowedApps,
        allowedAppKeys: args.updates.allowedAppKeys || args.updates.allowedApps,
        isActive: isActive !== false,
        createdAt: now,
        updatedAt: now,
      });

      await ctx.db.insert("adminAuditLogs", {
        action: "admin.plan_created",
        resourceType: "plans",
        resourceId: newId,
        details: { key, updates: args.updates },
        createdAt: now,
      });

      return await ctx.db.get(newId);
    }

    const patchPayload: any = {
      updatedAt: now,
    };
    if (args.updates.name !== undefined) patchPayload.name = args.updates.name;
    if (args.updates.type !== undefined) patchPayload.type = args.updates.type;
    if (args.updates.priceAmount !== undefined) patchPayload.priceAmount = args.updates.priceAmount;
    if (args.updates.currency !== undefined) patchPayload.currency = args.updates.currency;
    if (args.updates.trialDurationDays !== undefined) {
      patchPayload.trialDurationDays = args.updates.trialDurationDays;
      patchPayload.trialDays = args.updates.trialDurationDays;
    }
    if (args.updates.features !== undefined) patchPayload.features = args.updates.features;
    if (args.updates.limits !== undefined) patchPayload.limits = args.updates.limits;
    if (args.updates.price !== undefined) patchPayload.price = args.updates.price;
    if (args.updates.monthlyPrice !== undefined) patchPayload.monthlyPrice = args.updates.monthlyPrice;
    if (args.updates.annualPrice !== undefined) patchPayload.annualPrice = args.updates.annualPrice;
    if (args.updates.allowedApps !== undefined) patchPayload.allowedApps = args.updates.allowedApps;
    if (args.updates.allowedAppKeys !== undefined) patchPayload.allowedAppKeys = args.updates.allowedAppKeys;
    if (isActive !== undefined) patchPayload.isActive = isActive;

    await ctx.db.patch(plan._id, patchPayload);

    await ctx.db.insert("adminAuditLogs", {
      action: "admin.plan_updated",
      resourceType: "plans",
      resourceId: plan._id,
      details: { key: plan.key, updates: args.updates },
      createdAt: now,
    });

    return await ctx.db.get(plan._id);
  },
});
