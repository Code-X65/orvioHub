import { query, mutation } from "./_generated/server.js";
import { v } from "convex/values";
import { DEFAULT_PLANS } from "./plans.js";

export const getByWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    if (!sub) {
      const now = Date.now();
      const trialPlan = DEFAULT_PLANS.find((p) => p.key === "free_trial") || DEFAULT_PLANS[0];
      return {
        workspaceId: args.workspaceId,
        planKey: "free_trial",
        status: "trialing" as const,
        billingInterval: "monthly" as const,
        currentPeriodStart: now,
        currentPeriodEnd: now + 14 * 86_400_000,
        trialStart: now,
        trialEnd: now + 14 * 86_400_000,
        paymentMethod: "bank_transfer" as const,
        amount: 0,
        currency: "NGN",
        cancelAtPeriodEnd: false,
        createdAt: now,
        updatedAt: now,
        plan: trialPlan,
      };
    }

    const normalizedPlanKey = sub.planKey === "free" ? "free_trial" : sub.planKey;
    let plan = await ctx.db
      .query("plans")
      .withIndex("by_key", (q) => q.eq("key", normalizedPlanKey))
      .first();

    if (!plan) {
      plan = (DEFAULT_PLANS.find((p) => p.key === normalizedPlanKey) as any) || DEFAULT_PLANS[0];
    }

    return {
      ...sub,
      plan,
    };
  },
});

export const getByOrganization = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    let sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", args.organizationId))
      .first();

    if (!sub) {
      // Fallback: primary workspace of the organization
      const ws = await ctx.db
        .query("workspaces")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", args.organizationId))
        .first();
      if (ws) {
        sub = await ctx.db
          .query("subscriptions")
          .withIndex("by_workspace", (q) => q.eq("workspaceId", ws._id))
          .first();
      }
    }

    const trialPlan = DEFAULT_PLANS.find((p) => p.key === "free_trial") || DEFAULT_PLANS[0];

    if (!sub) {
      const now = Date.now();
      return {
        organizationId: args.organizationId,
        planKey: "free_trial",
        status: "trialing" as const,
        billingInterval: "monthly" as const,
        currentPeriodStart: now,
        currentPeriodEnd: now + 14 * 86_400_000,
        trialStart: now,
        trialEnd: now + 14 * 86_400_000,
        trialEndsAt: now + 14 * 86_400_000,
        paymentMethod: "bank_transfer" as const,
        amount: 0,
        currency: "NGN",
        cancelAtPeriodEnd: false,
        createdAt: now,
        updatedAt: now,
        plan: trialPlan,
      };
    }

    const normalizedPlanKey = sub.planKey === "free" ? "free_trial" : sub.planKey;
    let plan = await ctx.db
      .query("plans")
      .withIndex("by_key", (q) => q.eq("key", normalizedPlanKey))
      .first();

    if (!plan) {
      plan = (DEFAULT_PLANS.find((p) => p.key === normalizedPlanKey) as any) || DEFAULT_PLANS[0];
    }

    return {
      ...sub,
      plan,
    };
  },
});

export const getByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // 1. Direct user subscription
    let sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    // 2. Fallback: workspace subscription owned by user
    if (!sub) {
      const ownedWorkspaces = await ctx.db
        .query("workspaces")
        .withIndex("by_owner", (q) => q.eq("ownerId", args.userId))
        .collect();

      for (const ws of ownedWorkspaces) {
        const wsSub = await ctx.db
          .query("subscriptions")
          .withIndex("by_workspace", (q) => q.eq("workspaceId", ws._id))
          .first();
        if (wsSub) {
          sub = wsSub;
          break;
        }
      }
    }

    const defaultPlan = DEFAULT_PLANS.find((p) => p.key === "free_trial") || DEFAULT_PLANS[0];

    if (!sub) {
      const now = Date.now();
      return {
        userId: args.userId,
        planKey: "free_trial",
        status: "trialing" as const,
        billingInterval: "monthly" as const,
        currentPeriodStart: now,
        currentPeriodEnd: now + 14 * 86_400_000,
        trialStart: now,
        trialEnd: now + 14 * 86_400_000,
        paymentMethod: "bank_transfer" as const,
        amount: 0,
        currency: "NGN",
        plan: defaultPlan,
        createdAt: now,
        updatedAt: now,
      };
    }

    const rawKey = sub.planKey === "free" ? "free_trial" : sub.planKey || "free_trial";
    const isPaidTier = rawKey === "standard" || rawKey === "premium";
    const isPaidActive = sub.status === "active" && Boolean(sub.paystackSubscriptionId || sub.lastPaymentDate);
    const normalizedPlanKey = isPaidTier && !isPaidActive ? "free_trial" : rawKey;

    let plan = await ctx.db
      .query("plans")
      .withIndex("by_key", (q) => q.eq("key", normalizedPlanKey))
      .first();

    if (!plan) {
      plan = (DEFAULT_PLANS.find((p) => p.key === normalizedPlanKey) as any) || defaultPlan;
    }

    return {
      ...sub,
      planKey: normalizedPlanKey,
      plan,
    };
  },
});


export const getPlan = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    const normalizedPlanKey = sub?.planKey === "free" ? "free_trial" : (sub?.planKey || "free_trial");
    let plan: any = await ctx.db
      .query("plans")
      .withIndex("by_key", (q) => q.eq("key", normalizedPlanKey))
      .first();

    if (!plan) {
      plan = (DEFAULT_PLANS.find((p) => p.key === normalizedPlanKey) as any) || DEFAULT_PLANS[0];
    }

    return {
      name: plan.name,
      key: plan.key,
      status: sub?.status || "trialing",
      limits: plan.limits,
      allowedApps: plan.allowedApps,
      trialEnd: sub?.trialEnd,
      currentPeriodEnd: sub?.currentPeriodEnd,
      amount: sub?.amount ?? 0,
      billingInterval: sub?.billingInterval ?? "monthly",
    };
  },
});

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    planKey: v.string(),
    billingInterval: v.union(v.literal("monthly"), v.literal("annual")),
    paymentMethod: v.union(v.literal("bank_transfer"), v.literal("paystack")),
  },
  handler: async (ctx, args) => {
    const normalizedKey = args.planKey === "free" ? "free_trial" : args.planKey;
    let plan: any = await ctx.db
      .query("plans")
      .withIndex("by_key", (q) => q.eq("key", normalizedKey))
      .first();

    if (!plan) {
      plan = (DEFAULT_PLANS.find((p) => p.key === normalizedKey) as any) || DEFAULT_PLANS[0];
    }

    const now = Date.now();
    const isTrial = normalizedKey === "free_trial";
    const trialDays = plan.trialDays || 14;
    const trialEnd = isTrial ? now + trialDays * 86_400_000 : undefined;

    const amount = isTrial
      ? 0
      : args.billingInterval === "annual"
      ? (plan.price?.annual || 75000)
      : (plan.price?.monthly || 7500);

    const periodEnd = isTrial
      ? trialEnd!
      : now + (args.billingInterval === "annual" ? 365 : 30) * 86_400_000;

    // Check existing subscription
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    let subscriptionId;
    if (existing) {
      await ctx.db.patch(existing._id, {
        planKey: normalizedKey,
        status: isTrial ? "trialing" : "active",
        billingInterval: args.billingInterval,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        trialStart: isTrial ? now : undefined,
        trialEnd,
        paymentMethod: args.paymentMethod,
        amount,
        currency: "NGN",
        updatedAt: now,
      });
      subscriptionId = existing._id;
    } else {
      subscriptionId = await ctx.db.insert("subscriptions", {
        workspaceId: args.workspaceId,
        planKey: normalizedKey,
        status: isTrial ? "trialing" : "active",
        billingInterval: args.billingInterval,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        trialStart: isTrial ? now : undefined,
        trialEnd,
        paymentMethod: args.paymentMethod,
        amount,
        currency: "NGN",
        createdAt: now,
        updatedAt: now,
      });
    }

    await ctx.db.patch(args.workspaceId, {
      planId: normalizedKey,
      updatedAt: now,
    });

    return { subscriptionId };
  },
});

export const upgradeFromTrial = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    billingInterval: v.union(v.literal("monthly"), v.literal("annual")),
    paymentMethod: v.union(v.literal("bank_transfer"), v.literal("paystack")),
    paystackSubscriptionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    let plan: any = await ctx.db
      .query("plans")
      .withIndex("by_key", (q) => q.eq("key", "standard"))
      .first();

    if (!plan) {
      plan = (DEFAULT_PLANS.find((p) => p.key === "standard") as any) || {
        name: "Standard",
        key: "standard",
        price: { monthly: 7500, annual: 75000 },
      };
    }

    const amount = args.billingInterval === "annual" ? (plan.price?.annual || 75000) : (plan.price?.monthly || 7500);
    const now = Date.now();
    const periodEnd = now + (args.billingInterval === "annual" ? 365 : 30) * 86_400_000;

    let subscriptionId;
    if (!subscription) {
      subscriptionId = await ctx.db.insert("subscriptions", {
        workspaceId: args.workspaceId,
        planKey: "standard",
        status: "active",
        billingInterval: args.billingInterval,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        paymentMethod: args.paymentMethod,
        paystackSubscriptionId: args.paystackSubscriptionId,
        amount,
        currency: "NGN",
        createdAt: now,
        updatedAt: now,
      });
    } else {
      await ctx.db.patch(subscription._id, {
        planKey: "standard",
        status: "active",
        billingInterval: args.billingInterval,
        paymentMethod: args.paymentMethod,
        paystackSubscriptionId: args.paystackSubscriptionId,
        amount,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        trialEnd: undefined,
        updatedAt: now,
      });
      subscriptionId = subscription._id;
    }

    await ctx.db.patch(args.workspaceId, {
      planId: "standard",
      updatedAt: now,
    });

    return { subscriptionId };
  },
});

export const suspendForNonPayment = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    if (!subscription) {
      throw new Error("Subscription not found");
    }

    await ctx.db.patch(subscription._id, {
      status: "suspended",
      updatedAt: Date.now(),
    });

    await ctx.db.patch(args.workspaceId, {
      status: "suspended",
      updatedAt: Date.now(),
    });

    return { success: true };
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
    const trialEnd = now + 14 * 86_400_000;

    const subId = await ctx.db.insert("subscriptions", {
      workspaceId: args.workspaceId,
      planKey: "free_trial",
      status: "trialing",
      billingInterval: "monthly",
      currentPeriodStart: now,
      currentPeriodEnd: trialEnd,
      trialStart: now,
      trialEnd,
      paymentMethod: "bank_transfer",
      amount: 0,
      currency: "NGN",
      cancelAtPeriodEnd: false,
      createdAt: now,
      updatedAt: now,
    });

    return await ctx.db.get(subId);
  },
});

export const updatePlan = mutation({
  args: {
    organizationId: v.optional(v.id("organizations")),
    workspaceId: v.optional(v.id("workspaces")),
    planKey: v.string(),
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("trialing"),
        v.literal("past_due"),
        v.literal("canceled"),
        v.literal("suspended"),
        v.literal("expired")
      )
    ),
    billingInterval: v.optional(v.union(v.literal("monthly"), v.literal("annual"))),
    paymentMethod: v.optional(v.union(v.literal("bank_transfer"), v.literal("paystack"), v.literal("flutterwave"), v.literal("manual"))),
    amount: v.optional(v.number()),
    currentPeriodEnd: v.optional(v.number()),
    trialEndsAt: v.optional(v.number()),
    cancelAtPeriodEnd: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let existing = null;
    if (args.organizationId) {
      existing = await ctx.db
        .query("subscriptions")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", args.organizationId))
        .first();
    }
    if (!existing && args.workspaceId) {
      existing = await ctx.db
        .query("subscriptions")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
        .first();
    }
    if (!existing && args.organizationId) {
      const ws = await ctx.db
        .query("workspaces")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", args.organizationId))
        .first();
      if (ws) {
        existing = await ctx.db
          .query("subscriptions")
          .withIndex("by_workspace", (q) => q.eq("workspaceId", ws._id))
          .first();
      }
    }

    const now = Date.now();
    const normalizedKey = args.planKey === "free" ? "free_trial" : args.planKey;

    if (existing) {
      await ctx.db.patch(existing._id, {
        organizationId: args.organizationId || existing.organizationId,
        planKey: normalizedKey,
        status: args.status || existing.status,
        billingInterval: args.billingInterval || existing.billingInterval,
        paymentMethod: args.paymentMethod || existing.paymentMethod,
        amount: args.amount ?? existing.amount,
        currentPeriodEnd:
          args.currentPeriodEnd || existing.currentPeriodEnd || now + 30 * 86_400_000,
        trialEndsAt: args.trialEndsAt !== undefined ? args.trialEndsAt : existing.trialEndsAt,
        trialEnd: args.trialEndsAt !== undefined ? args.trialEndsAt : existing.trialEnd,
        cancelAtPeriodEnd: args.cancelAtPeriodEnd ?? existing.cancelAtPeriodEnd ?? false,
        updatedAt: now,
      });

      if (args.workspaceId) {
        await ctx.db.patch(args.workspaceId, {
          planId: normalizedKey,
          updatedAt: now,
        });
      }

      return await ctx.db.get(existing._id);
    }

    const subId = await ctx.db.insert("subscriptions", {
      organizationId: args.organizationId,
      workspaceId: args.workspaceId,
      planKey: normalizedKey,
      status: args.status || "active",
      billingInterval: args.billingInterval || "monthly",
      currentPeriodStart: now,
      currentPeriodEnd: args.currentPeriodEnd || now + 30 * 86_400_000,
      trialEndsAt: args.trialEndsAt,
      trialEnd: args.trialEndsAt,
      paymentMethod: args.paymentMethod || "bank_transfer",
      amount: args.amount ?? 0,
      currency: "NGN",
      cancelAtPeriodEnd: args.cancelAtPeriodEnd || false,
      createdAt: now,
      updatedAt: now,
    });

    if (args.workspaceId) {
      await ctx.db.patch(args.workspaceId, {
        planId: normalizedKey,
        updatedAt: now,
      });
    }

    return await ctx.db.get(subId);
  },
});

export const extendTrial = mutation({
  args: {
    organizationId: v.optional(v.id("organizations")),
    workspaceId: v.optional(v.id("workspaces")),
    days: v.number(),
  },
  handler: async (ctx, args) => {
    let sub = null;
    if (args.organizationId) {
      sub = await ctx.db
        .query("subscriptions")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", args.organizationId))
        .first();
    }
    if (!sub && args.workspaceId) {
      sub = await ctx.db
        .query("subscriptions")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
        .first();
    }
    if (!sub && args.organizationId) {
      const ws = await ctx.db
        .query("workspaces")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", args.organizationId))
        .first();
      if (ws) {
        sub = await ctx.db
          .query("subscriptions")
          .withIndex("by_workspace", (q) => q.eq("workspaceId", ws._id))
          .first();
      }
    }
    if (!sub) {
      throw new Error("SUBSCRIPTION_NOT_FOUND");
    }

    const now = Date.now();
    const currentExpiry = sub.trialEndsAt || sub.trialEnd || sub.currentPeriodEnd || now;
    const base = currentExpiry > now ? currentExpiry : now;
    const newExpiry = base + args.days * 86_400_000;

    await ctx.db.patch(sub._id, {
      trialEndsAt: newExpiry,
      trialEnd: newExpiry,
      currentPeriodEnd: newExpiry,
      status: "trialing",
      updatedAt: now,
    });

    return await ctx.db.get(sub._id);
  },
});

/**
 * Super Admin: List all organization & workspace subscriptions with owner details
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

    const enriched = await Promise.all(
      subs.map(async (sub) => {
        let org: any = sub.organizationId ? await ctx.db.get(sub.organizationId) : null;
        let workspace: any = sub.workspaceId ? await ctx.db.get(sub.workspaceId) : null;

        if (!org && workspace?.organizationId) {
          org = await ctx.db.get(workspace.organizationId);
        }
        if (!workspace && org?._id) {
          workspace = await ctx.db
            .query("workspaces")
            .withIndex("by_organizationId", (q) => q.eq("organizationId", org._id))
            .first();
        }

        let owner: any = null;
        if (org?.ownerId) {
          owner = await ctx.db.get(org.ownerId);
        } else if (workspace?.ownerId) {
          owner = await ctx.db.get(workspace.ownerId);
        }

        return {
          ...sub,
          organizationId: org?._id || sub.organizationId,
          organizationName: org?.name || workspace?.name || "Organization",
          workspaceId: workspace?._id || sub.workspaceId,
          workspaceName: workspace?.name || org?.name || "Workspace",
          workspaceSlug: org?.slug || workspace?.slug || "",
          ownerName: owner?.name || "Unknown",
          ownerEmail: owner?.email || "",
          trialEndsAt: sub.trialEndsAt || sub.trialEnd,
        };
      })
    );

    if (args.search) {
      const q = args.search.toLowerCase();
      return enriched.filter(
        (item) =>
          item.organizationName?.toLowerCase().includes(q) ||
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
      planPriceMap[p.key] = p.price?.monthly || p.monthlyPrice || 0;
    }

    const countsByPlan: Record<string, number> = {
      free_trial: 0,
      standard: 0,
    };

    let totalMRRNaira = 0;
    const now = Date.now();
    const sevenDaysFromNow = now + 7 * 86_400_000;
    let expiringSoonCount = 0;

    for (const sub of subs) {
      const pKey = sub.planKey === "free" ? "free_trial" : sub.planKey || "free_trial";
      countsByPlan[pKey] = (countsByPlan[pKey] || 0) + 1;

      if (sub.status === "active") {
        const price = planPriceMap[pKey] ?? (pKey === "standard" ? 7500 : 0);
        totalMRRNaira += price;
      }

      if (sub.status === "trialing" || sub.status === "active") {
        const end = sub.trialEnd || sub.currentPeriodEnd;
        if (end > now && end <= sevenDaysFromNow) {
          expiringSoonCount++;
        }
      }
    }

    return {
      totalSubscriptions: subs.length,
      totalMRRNaira,
      totalMRRKobo: totalMRRNaira * 100,
      expiringSoonCount,
      countsByPlan,
    };
  },
});

/**
 * Send Trial Started Email when workspace is created
 */
export const sendTrialStartedEmail = mutation({
  args: {
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    const workspace = await ctx.db.get(args.workspaceId);
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    if (!user || !user.email) return;

    const trialEndFormatted = sub?.trialEnd
      ? new Date(sub.trialEnd).toLocaleDateString("en-NG", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "14 days from now";

    await ctx.db.insert("emailOutbox", {
      to: user.email,
      template: "trial_started" as any,
      payload: {
        firstName: user.name?.split(" ")[0] || "there",
        name: user.name || "Customer",
        orgName: workspace?.name || "Your Organization",
        trialEndsAt: trialEndFormatted,
      },
      status: "PENDING",
      attempts: 0,
      nextAttemptAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

/**
 * Cron: Daily Trial Expirations Check (Runs every day at 9:00 AM WAT)
 * Identifies trials ending in 7 days, 2 days, and today.
 */
export const checkTrialExpirations = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const sevenDaysFromNow = now + 7 * oneDay;
    const twoDaysFromNow = now + 2 * oneDay;
    const endOfToday = now + oneDay;

    const trialingSubs = await ctx.db
      .query("subscriptions")
      .withIndex("by_status", (q) => q.eq("status", "trialing"))
      .collect();

    for (const sub of trialingSubs) {
      if (!sub.trialEnd) continue;

      const workspace: any = sub.workspaceId ? await ctx.db.get(sub.workspaceId) : null;
      if (!workspace || !workspace.ownerId) continue;
      const owner: any = await ctx.db.get(workspace.ownerId);
      if (!owner || !owner.email) continue;

      const trialEndDate = new Date(sub.trialEnd).toLocaleDateString("en-NG", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

      // 7 Days reminder (between 6 and 7 days)
      if (sub.trialEnd > now + 6 * oneDay && sub.trialEnd <= sevenDaysFromNow) {
        await ctx.db.insert("emailOutbox", {
          to: owner.email,
          template: "trial_reminder_7days" as any,
          payload: {
            firstName: owner.name?.split(" ")[0] || "there",
            name: owner.name || "Customer",
            orgName: workspace.name,
            trialEndsAt: trialEndDate,
          },
          status: "PENDING",
          attempts: 0,
          nextAttemptAt: now,
          createdAt: now,
          updatedAt: now,
        });
      }

      // 2 Days reminder (between 1 and 2 days)
      if (sub.trialEnd > now + 1 * oneDay && sub.trialEnd <= twoDaysFromNow) {
        await ctx.db.insert("emailOutbox", {
          to: owner.email,
          template: "trial_reminder_2days" as any,
          payload: {
            firstName: owner.name?.split(" ")[0] || "there",
            name: owner.name || "Customer",
            orgName: workspace.name,
            trialEndsAt: trialEndDate,
          },
          status: "PENDING",
          attempts: 0,
          nextAttemptAt: now,
          createdAt: now,
          updatedAt: now,
        });
      }

      // Today reminder (< 24 hours remaining)
      if (sub.trialEnd > now && sub.trialEnd <= endOfToday) {
        await ctx.db.insert("emailOutbox", {
          to: owner.email,
          template: "trial_reminder_today" as any,
          payload: {
            firstName: owner.name?.split(" ")[0] || "there",
            name: owner.name || "Customer",
            orgName: workspace.name,
            trialEndsAt: trialEndDate,
          },
          status: "PENDING",
          attempts: 0,
          nextAttemptAt: now,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  },
});

/**
 * Cron: Expire Trials Hourly (Runs every hour)
 * Finds trialing subscriptions whose trial has expired, suspends them, and notifies owner.
 */
export const expireTrials = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    const expiredTrials = await ctx.db
      .query("subscriptions")
      .withIndex("by_status", (q) => q.eq("status", "trialing"))
      .filter((q) => q.lt(q.field("trialEnd"), now))
      .collect();

    for (const sub of expiredTrials) {
      await ctx.db.patch(sub._id, {
        status: "suspended",
        updatedAt: now,
      });

      const workspace: any = sub.workspaceId ? await ctx.db.get(sub.workspaceId) : null;
      if (workspace && workspace.ownerId) {
        const owner: any = await ctx.db.get(workspace.ownerId);
        if (owner && owner.email) {
          await ctx.db.insert("emailOutbox", {
            to: owner.email,
            template: "trial_expired" as any,
            payload: {
              firstName: owner.name?.split(" ")[0] || "there",
              name: owner.name || "Customer",
              orgName: workspace.name,
            },
            status: "PENDING",
            attempts: 0,
            nextAttemptAt: now,
            createdAt: now,
            updatedAt: now,
          });
        }
      }
    }
  },
});

/**
 * Cron: Daily Subscriptions Renewal Check (Runs every day at 9:00 AM WAT)
 * Identifies active subscriptions renewing in 7 days and sends reminder.
 */
export const checkRenewals = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const sevenDaysFromNow = now + 7 * 24 * 60 * 60 * 1000;

    const activeSubs = await ctx.db
      .query("subscriptions")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .filter((q) =>
        q.and(
          q.gte(q.field("currentPeriodEnd"), now),
          q.lte(q.field("currentPeriodEnd"), sevenDaysFromNow)
        )
      )
      .collect();

    for (const sub of activeSubs) {
      const workspace: any = sub.workspaceId ? await ctx.db.get(sub.workspaceId) : null;
      if (!workspace || !workspace.ownerId) continue;
      const owner: any = await ctx.db.get(workspace.ownerId);
      if (!owner || !owner.email) continue;

      await ctx.db.insert("emailOutbox", {
        to: owner.email,
        template: "renewal_reminder" as any,
        payload: {
          firstName: owner.name?.split(" ")[0] || "there",
          name: owner.name || "Customer",
          orgName: workspace.name,
          amount: (sub.amount ?? 0).toLocaleString(),
          renewalDate: new Date(sub.currentPeriodEnd).toLocaleDateString("en-NG", {
            year: "numeric",
            month: "short",
            day: "numeric",
          }),
        },
        status: "PENDING",
        attempts: 0,
        nextAttemptAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

/**
 * Cron: Process Subscriptions Renewal Hourly
 * Charges subscriptions or creates invoices for due subscriptions.
 */
export const processRenewals = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    const dueSubs = await ctx.db
      .query("subscriptions")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .filter((q) => q.lte(q.field("currentPeriodEnd"), now))
      .collect();

    for (const sub of dueSubs) {
      const workspace: any = sub.workspaceId ? await ctx.db.get(sub.workspaceId) : null;
      const owner: any = workspace?.ownerId ? await ctx.db.get(workspace.ownerId) : null;
      const intervalDays = sub.billingInterval === "annual" ? 365 : 30;
      const periodExtension = intervalDays * 24 * 60 * 60 * 1000;

      if (sub.paymentMethod === "bank_transfer") {
        if (sub.workspaceId) {
          // Create renewal invoice for bank transfer
          const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
          await ctx.db.insert("invoices", {
            workspaceId: sub.workspaceId,
            subscriptionId: sub._id,
            invoiceNumber,
            status: "pending",
            amount: sub.amount || 7500,
            currency: "NGN",
            dueDate: now + 3 * 24 * 60 * 60 * 1000, // 3-day grace period
            paymentMethod: "bank_transfer",
            items: [
              {
                description: `Orviohub Standard Subscription Renewal (${sub.billingInterval})`,
                quantity: 1,
                unitPrice: sub.amount || 7500,
                total: sub.amount || 7500,
              },
            ],
            createdAt: now,
          });
        }

        // Set status to past_due pending payment
        await ctx.db.patch(sub._id, {
          status: "past_due",
          updatedAt: now,
        });

        if (owner && owner.email) {
          await ctx.db.insert("emailOutbox", {
            to: owner.email,
            template: "renewal_reminder" as any,
            payload: {
              firstName: owner.name?.split(" ")[0] || "there",
              name: owner.name || "Customer",
              orgName: workspace?.name || "Your Organization",
              amount: (sub.amount || 7500).toLocaleString(),
              renewalDate: "Immediate",
            },
            status: "PENDING",
            attempts: 0,
            nextAttemptAt: now,
            createdAt: now,
            updatedAt: now,
          });
        }
      } else {
        // Renew period
        await ctx.db.patch(sub._id, {
          currentPeriodStart: now,
          currentPeriodEnd: now + periodExtension,
          lastPaymentDate: now,
          nextPaymentDate: now + periodExtension,
          updatedAt: now,
        });

        if (owner && owner.email) {
          await ctx.db.insert("emailOutbox", {
            to: owner.email,
            template: "payment_success" as any,
            payload: {
              firstName: owner.name?.split(" ")[0] || "there",
              name: owner.name || "Customer",
              orgName: workspace?.name || "Your Organization",
              amount: (sub.amount || 7500).toLocaleString(),
              plan: "Standard",
              nextPayment: new Date(now + periodExtension).toLocaleDateString("en-NG"),
            },
            status: "PENDING",
            attempts: 0,
            nextAttemptAt: now,
            createdAt: now,
            updatedAt: now,
          });
        }
      }
    }
  },
});

export const updateForUser = mutation({
  args: {
    userId: v.id("users"),
    planKey: v.string(),
    status: v.optional(v.union(v.literal("active"), v.literal("trialing"), v.literal("past_due"), v.literal("canceled"), v.literal("suspended"))),
    currentPeriodEnd: v.optional(v.number()),
    cancelAtPeriodEnd: v.optional(v.boolean()),
    billingInterval: v.optional(v.union(v.literal("monthly"), v.literal("annual"))),
    amount: v.optional(v.number()),
    paymentMethod: v.optional(v.union(v.literal("bank_transfer"), v.literal("paystack"))),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    const now = Date.now();
    const normalizedKey = args.planKey === "free" ? "free_trial" : args.planKey;

    if (existing) {
      await ctx.db.patch(existing._id, {
        planKey: normalizedKey,
        status: args.status || existing.status,
        currentPeriodEnd: args.currentPeriodEnd || existing.currentPeriodEnd,
        cancelAtPeriodEnd: args.cancelAtPeriodEnd ?? existing.cancelAtPeriodEnd,
        billingInterval: args.billingInterval || existing.billingInterval,
        amount: args.amount ?? existing.amount,
        paymentMethod: args.paymentMethod || existing.paymentMethod,
        updatedAt: now,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("subscriptions", {
        userId: args.userId,
        planKey: normalizedKey,
        status: args.status || "active",
        billingInterval: args.billingInterval || "monthly",
        currentPeriodStart: now,
        currentPeriodEnd: args.currentPeriodEnd || now + 30 * 86_400_000,
        paymentMethod: args.paymentMethod || "paystack",
        amount: args.amount ?? (normalizedKey === "premium" ? 20000 : 7500),
        currency: "NGN",
        cancelAtPeriodEnd: args.cancelAtPeriodEnd ?? false,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

export const cancelForUser = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!existing) {
      throw new Error("No subscription found for this user.");
    }

    await ctx.db.patch(existing._id, {
      cancelAtPeriodEnd: true,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Maintenance mutation: Reconciles legacy subscriptions where standard/premium
 * was marked active without any payment reference, restoring them to free_trial.
 */
export const reconcileUnpaidSubscriptions = mutation({
  args: {},
  handler: async (ctx) => {
    const allSubs = await ctx.db.query("subscriptions").collect();
    const now = Date.now();
    let reconciledCount = 0;

    for (const sub of allSubs) {
      const isPaidTier = sub.planKey === "standard" || sub.planKey === "premium";
      const hasPaymentRef = Boolean(sub.paystackSubscriptionId || sub.lastPaymentDate);

      // If marked as standard or premium without any payment reference, revert to free_trial trialing
      if (isPaidTier && !hasPaymentRef) {
        await ctx.db.patch(sub._id, {
          planKey: "free_trial",
          pendingPlanKey: sub.planKey,
          status: "trialing",
          trialStart: sub.trialStart || sub.createdAt || now,
          trialEnd: sub.trialEnd || (now + 14 * 86_400_000),
          currentPeriodEnd: sub.trialEnd || (now + 14 * 86_400_000),
          updatedAt: now,
        });
        reconciledCount++;
      }
    }

    return { success: true, reconciledCount };
  },
});



