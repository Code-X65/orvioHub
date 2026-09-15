import { query, mutation, action } from "./_generated/server.js";
import { v } from "convex/values";
import { DEFAULT_PLANS } from "./plans.js";
import { ensureUserHasNoOtherFreeTrial } from "./organizations.js";
import { generateNextInvoiceNumber } from "./invoices.js";
import { resolveOrganization } from "./applications.js";

/**
 * Authoritative Organization Billing Context Query
 * Used by User Dashboard, Superadmin, and Entitlements Engine
 */
export const getBillingContext = query({
  args: {
    organizationId: v.union(v.id("organizations"), v.id("workspaces"), v.string()),
  },
  handler: async (ctx, args) => {
    const { org, orgId, workspace, workspaceId } = await resolveOrganization(ctx, args.organizationId);
    if (!org && !workspace) {
      throw new Error("ORGANIZATION_OR_WORKSPACE_NOT_FOUND");
    }

    const targetOrgId = orgId || org?._id;
    const targetWsId = workspaceId || workspace?._id;

    let sub: any = null;
    if (targetOrgId) {
      sub = await ctx.db
        .query("subscriptions")
        .withIndex("by_organizationId", (q: any) => q.eq("organizationId", targetOrgId))
        .first();
    }

    if (!sub && targetWsId) {
      sub = await ctx.db
        .query("subscriptions")
        .withIndex("by_workspace", (q: any) => q.eq("workspaceId", targetWsId))
        .first();
    }

    const now = Date.now();
    const rawPlanKey = sub?.planKey === "free" ? "free_trial" : sub?.planKey;
    const selectedPlan = sub?.selectedPlan || rawPlanKey || "free_trial";
    const subStatus = sub?.status || "pending";
    const isPaidActive = subStatus === "active" && (rawPlanKey === "standard" || rawPlanKey === "premium");
    const isTrialing = subStatus === "trial" || subStatus === "trialing";

    const activePlan = isPaidActive ? rawPlanKey : isTrialing ? "free_trial" : null;
    const checkoutStatus = sub?.checkoutStatus || (isPaidActive ? "completed" : isTrialing ? "not_required" : "pending");
    const paymentStatus = sub?.paymentStatus || (isPaidActive ? "success" : isTrialing ? "not_required" : "pending");
    const entitlementStatus = sub?.entitlementStatus || (isPaidActive || isTrialing ? "active" : "inactive");

    // Standardized Entitlements Map
    const planLimitsMap: Record<string, any> = {
      free_trial: {
        maxApplications: 1,
        maxBranchesPerApplication: 1,
        maxMembers: 2,
        maxProducts: 500,
        maxMonthlyTransactions: 300,
      },
      standard: {
        maxApplications: 3,
        maxBranchesPerApplication: 3,
        maxMembers: 10,
        maxProducts: 5000,
        maxMonthlyTransactions: 5000,
      },
      premium: {
        maxApplications: 999999,
        maxBranchesPerApplication: 10,
        maxMembers: 50,
        maxProducts: 25000,
        maxMonthlyTransactions: 25000,
      },
    };

    const effectivePlanForLimits = activePlan || (isTrialing ? "free_trial" : "free_trial");
    const entitlements = planLimitsMap[effectivePlanForLimits] || planLimitsMap.free_trial;

    // Live usage metrics
    let activeAppCount = 0;
    let activeBranchCount = 0;
    let activeMemberCount = 0;
    let activeProductCount = 0;

    if (targetOrgId) {
      const orgApps = await ctx.db
        .query("orgApplications")
        .withIndex("by_organizationId", (q: any) => q.eq("organizationId", targetOrgId))
        .filter((q: any) => q.eq(q.field("enabled"), true))
        .collect();
      activeAppCount = orgApps.length;

      const branches = await ctx.db
        .query("branches")
        .withIndex("by_organizationId", (q: any) => q.eq("organizationId", targetOrgId))
        .filter((q: any) => q.neq(q.field("status"), "deleted") && q.neq(q.field("status"), "ARCHIVED"))
        .collect();
      activeBranchCount = branches.length;

      const members = await ctx.db
        .query("organizationMemberships")
        .withIndex("by_organizationId", (q: any) => q.eq("organizationId", targetOrgId))
        .filter((q: any) => q.eq(q.field("status"), "ACTIVE"))
        .collect();
      activeMemberCount = members.length;
    } else if (targetWsId) {
      const wsApps = await ctx.db
        .query("workspaceProducts")
        .withIndex("by_workspace", (q: any) => q.eq("workspaceId", targetWsId))
        .filter((q: any) => q.eq(q.field("status"), "active"))
        .collect();
      activeAppCount = wsApps.length;

      const branches = await ctx.db
        .query("branches")
        .withIndex("by_workspace", (q: any) => q.eq("workspaceId", targetWsId))
        .filter((q: any) => q.neq(q.field("status"), "deleted") && q.neq(q.field("status"), "ARCHIVED"))
        .collect();
      activeBranchCount = branches.length;

      const members = await ctx.db
        .query("workspaceMemberships")
        .withIndex("by_workspace", (q: any) => q.eq("workspaceId", targetWsId))
        .filter((q: any) => q.eq(q.field("status"), "active"))
        .collect();
      activeMemberCount = members.length;
    }

    const planName = (activePlan === "standard" || selectedPlan === "standard")
      ? "Standard"
      : (activePlan === "premium" || selectedPlan === "premium")
      ? "Premium"
      : "Free Trial";

    return {
      organization: {
        id: targetOrgId ? String(targetOrgId) : String(targetWsId),
        name: org?.name || workspace?.name || "Organization",
        status: org?.status || workspace?.status || "active",
      },
      billing: {
        planKey: (activePlan || selectedPlan || "free_trial"),
        planName,
        selectedPlan,
        activePlan,
        status: isPaidActive ? "active" : isTrialing ? "trialing" : subStatus,
        subscriptionStatus: subStatus,
        paymentStatus,
        checkoutStatus,
        entitlementStatus,
        currentPeriodStart: sub?.currentPeriodStart || now,
        currentPeriodEnd: sub?.currentPeriodEnd || (now + 30 * 86_400_000),
        trialStart: isPaidActive ? null : (sub?.trialStart || (isTrialing ? now : null)),
        trialEnd: isPaidActive ? null : (sub?.trialEnd || sub?.trialEndsAt || (isTrialing ? now + 30 * 86_400_000 : null)),
        amount: sub?.amount ?? (selectedPlan === "standard" ? (sub?.billingInterval === "annual" ? 75000 : 7500) : 0),
        currency: sub?.currency || "NGN",
        billingInterval: sub?.billingInterval || "monthly",
        lastPaymentReference: sub?.lastPaymentReference || null,
        paystackCustomerCode: sub?.paystackCustomerCode,
        paystackSubscriptionCode: sub?.paystackSubscriptionCode,
        paystackPlanCode: sub?.paystackPlanCode,
        activatedAt: sub?.activatedAt,
        cancelledAt: sub?.cancelledAt,
      },
      entitlements,
      usage: {
        applications: activeAppCount,
        branches: activeBranchCount,
        members: activeMemberCount,
        products: activeProductCount,
      },
    };
  },
});

/**
 * Consistency Checker for Organization Billing State
 */
export const checkOrganizationBillingConsistency = query({
  args: {
    organizationId: v.union(v.id("organizations"), v.id("workspaces"), v.string()),
  },
  handler: async (ctx, args) => {
    const { org, orgId, workspace, workspaceId } = await resolveOrganization(ctx, args.organizationId);
    const targetOrgId = orgId || org?._id;
    const targetWsId = workspaceId || workspace?._id;

    const issues: string[] = [];

    let sub: any = null;
    if (targetOrgId) {
      sub = await ctx.db
        .query("subscriptions")
        .withIndex("by_organizationId", (q: any) => q.eq("organizationId", targetOrgId))
        .first();
    }
    if (!sub && targetWsId) {
      sub = await ctx.db
        .query("subscriptions")
        .withIndex("by_workspace", (q: any) => q.eq("workspaceId", targetWsId))
        .first();
    }

    if (!sub) {
      issues.push("missing_subscription");
      return { consistent: false, issues };
    }

    const planKey = (sub.planKey === "free" ? "free_trial" : sub.planKey || "").toLowerCase();
    const status = (sub.status || "").toLowerCase();

    if (status === "active" && planKey !== "standard" && planKey !== "premium") {
      issues.push("active_paid_subscription_has_invalid_plan");
    }

    if (planKey === "standard" && status === "active" && (sub.trialEnd || sub.trialEndsAt)) {
      issues.push("standard_subscription_has_trial_end");
    }

    const payments = targetOrgId
      ? await ctx.db
          .query("payments")
          .withIndex("by_organizationId", (q: any) => q.eq("organizationId", targetOrgId))
          .collect()
      : [];

    const hasSuccessPayment = payments.some(
      (p: any) => p.status === "success" || p.status === "completed"
    );

    if (hasSuccessPayment && status !== "active") {
      issues.push("successful_payment_subscription_not_active");
    }

    if (sub.activePlan && sub.activePlan !== planKey && status === "active") {
      issues.push("active_plan_mismatch");
    }

    return {
      consistent: issues.length === 0,
      issues,
    };
  },
});

/**
 * Initialize Checkout for an Organization (Paystack Standard)
 */
export const initializeBillingCheckout = mutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    billingInterval: v.union(v.literal("monthly"), v.literal("annual")),
    amount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new Error("ORGANIZATION_NOT_FOUND");

    const expectedAmount = args.billingInterval === "annual" ? 75000 : 7500;
    const now = Date.now();
    const reference = `ORV_STD_${String(args.organizationId).slice(-6)}_${now.toString(36).toUpperCase()}`;

    let sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_organizationId", (q: any) => q.eq("organizationId", args.organizationId))
      .first();

    if (sub) {
      await ctx.db.patch(sub._id, {
        selectedPlan: "standard",
        checkoutStatus: "pending",
        paymentStatus: "pending",
        billingInterval: args.billingInterval,
        amount: expectedAmount,
        lastPaymentReference: reference,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("subscriptions", {
        organizationId: args.organizationId,
        planKey: "standard",
        selectedPlan: "standard",
        activePlan: null,
        status: "pending",
        checkoutStatus: "pending",
        paymentStatus: "pending",
        entitlementStatus: "inactive",
        billingInterval: args.billingInterval,
        currentPeriodStart: now,
        currentPeriodEnd: now + (args.billingInterval === "annual" ? 365 : 30) * 86_400_000,
        amount: expectedAmount,
        currency: "NGN",
        lastPaymentReference: reference,
        cancelAtPeriodEnd: false,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Insert pending payment transaction
    await ctx.db.insert("paymentTransactions", {
      organizationId: args.organizationId,
      planKey: "standard",
      amount: expectedAmount * 100, // in kobo
      currency: "NGN",
      billingCycle: args.billingInterval,
      gateway: "paystack",
      gatewayReference: reference,
      status: "pending",
      customerEmail: org.phone || "customer@orviohub.com",
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("auditLogs", {
      actorId: args.userId,
      actorUserId: args.userId,
      organizationId: args.organizationId,
      action: "billing.checkout_started",
      resource: `checkout:${reference}`,
      severity: "info",
      metadata: {
        planKey: "standard",
        amount: expectedAmount,
        reference,
      },
      timestamp: now,
      createdAt: now,
    });

    return {
      reference,
      amount: expectedAmount,
      currency: "NGN",
      planKey: "standard",
      billingInterval: args.billingInterval,
    };
  },
});


export const getByWorkspace = query({
  args: { workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()) },
  handler: async (ctx, args) => {
    let wsId = ctx.db.normalizeId("workspaces", args.workspaceId);
    let orgId = ctx.db.normalizeId("organizations", args.workspaceId);

    let sub: any = null;
    if (wsId) {
      sub = await ctx.db
        .query("subscriptions")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", wsId!))
        .first();

      if (!sub) {
        const ws = await ctx.db.get(wsId);
        if (ws?.organizationId) {
          sub = await ctx.db
            .query("subscriptions")
            .withIndex("by_organizationId", (q) => q.eq("organizationId", ws.organizationId))
            .first();
        }
      }
    } else if (orgId) {
      sub = await ctx.db
        .query("subscriptions")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", orgId!))
        .first();
    }

    const trialPlan = DEFAULT_PLANS.find((p) => p.key === "free_trial") || DEFAULT_PLANS[0];

    if (!sub) {
      const now = Date.now();
      return {
        workspaceId: wsId || args.workspaceId,
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

    const resolvedKey = (
      (sub.status === "active" ? (sub.activePlan || sub.selectedPlan || sub.planKey) : null) ||
      sub.activePlan ||
      sub.planKey ||
      "free_trial"
    );
    const normalizedPlanKey = resolvedKey === "free" ? "free_trial" : resolvedKey;
    let plan = await ctx.db
      .query("plans")
      .withIndex("by_key", (q) => q.eq("key", normalizedPlanKey))
      .first();

    if (!plan) {
      plan = (DEFAULT_PLANS.find((p) => p.key === normalizedPlanKey) as any) || DEFAULT_PLANS[0];
    }

    return {
      ...sub,
      activePlan: sub.activePlan || (sub.status === "active" ? normalizedPlanKey : undefined),
      planKey: normalizedPlanKey,
      plan,
    };
  },
});

export const getByOrganization = query({
  args: { organizationId: v.union(v.id("organizations"), v.id("workspaces"), v.string()) },
  handler: async (ctx, args) => {
    let orgId = ctx.db.normalizeId("organizations", args.organizationId);
    let wsId = ctx.db.normalizeId("workspaces", args.organizationId);

    let sub: any = null;
    if (orgId) {
      sub = await ctx.db
        .query("subscriptions")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", orgId!))
        .first();

      if (!sub) {
        // Fallback: primary workspace of the organization
        const ws = await ctx.db
          .query("workspaces")
          .withIndex("by_organizationId", (q) => q.eq("organizationId", orgId!))
          .first();
        if (ws) {
          sub = await ctx.db
            .query("subscriptions")
            .withIndex("by_workspace", (q) => q.eq("workspaceId", ws._id))
            .first();
        }
      }
    } else if (wsId) {
      sub = await ctx.db
        .query("subscriptions")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", wsId!))
        .first();

      if (!sub) {
        const ws = await ctx.db.get(wsId);
        if (ws?.organizationId) {
          sub = await ctx.db
            .query("subscriptions")
            .withIndex("by_organizationId", (q) => q.eq("organizationId", ws.organizationId))
            .first();
        }
      }
    }

    const trialPlan = DEFAULT_PLANS.find((p) => p.key === "free_trial") || DEFAULT_PLANS[0];

    if (!sub) {
      const now = Date.now();
      return {
        organizationId: orgId || args.organizationId,
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

    const resolvedKey = (
      (sub.status === "active" ? (sub.activePlan || sub.selectedPlan || sub.planKey) : null) ||
      sub.activePlan ||
      sub.planKey ||
      "free_trial"
    );
    const normalizedPlanKey = resolvedKey === "free" ? "free_trial" : resolvedKey;
    let plan = await ctx.db
      .query("plans")
      .withIndex("by_key", (q) => q.eq("key", normalizedPlanKey))
      .first();

    if (!plan) {
      plan = (DEFAULT_PLANS.find((p) => p.key === normalizedPlanKey) as any) || DEFAULT_PLANS[0];
    }

    return {
      ...sub,
      activePlan: sub.activePlan || (sub.status === "active" ? normalizedPlanKey : undefined),
      planKey: normalizedPlanKey,
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
    const normalizedPlanKey = rawKey;

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

export const confirmPaymentAndActivateOrg = mutation({
  args: {
    organizationId: v.id("organizations"),
    paymentReference: v.string(),
    provider: v.optional(v.string()),
    amount: v.optional(v.number()),
    billingInterval: v.optional(v.union(v.literal("monthly"), v.literal("annual"))),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new Error("ORGANIZATION_NOT_FOUND");

    let sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", args.organizationId))
      .first();

    const now = Date.now();
    const interval = args.billingInterval || sub?.billingInterval || "monthly";
    const periodDays = interval === "annual" ? 365 : 30;
    const periodEnd = now + periodDays * 86_400_000;
    const amount = args.amount || (interval === "annual" ? 75000 : 7500);
    const provider = args.provider || "paystack";

    let subscriptionId: any;
    if (sub) {
      await ctx.db.patch(sub._id, {
        planKey: "standard",
        selectedPlan: "standard",
        activePlan: "standard",
        status: "active",
        checkoutStatus: "completed",
        paymentStatus: "success",
        entitlementStatus: "active",
        billingInterval: interval,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        lastPaymentDate: now,
        nextPaymentDate: periodEnd,
        paymentMethod: (provider as any),
        amount,
        trialStart: undefined,
        trialEnd: undefined,
        trialEndsAt: undefined,
        lastPaymentReference: args.paymentReference,
        activatedAt: now,
        updatedAt: now,
      });
      subscriptionId = sub._id;
    } else {
      subscriptionId = await ctx.db.insert("subscriptions", {
        organizationId: args.organizationId,
        planKey: "standard",
        selectedPlan: "standard",
        activePlan: "standard",
        status: "active",
        checkoutStatus: "completed",
        paymentStatus: "success",
        entitlementStatus: "active",
        billingInterval: interval,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        lastPaymentDate: now,
        nextPaymentDate: periodEnd,
        paymentMethod: (provider as any),
        amount,
        currency: org.currency || "NGN",
        lastPaymentReference: args.paymentReference,
        cancelAtPeriodEnd: false,
        activatedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Insert or update payments record
    let payment = await ctx.db
      .query("payments")
      .withIndex("by_reference", (q) => q.eq("reference", args.paymentReference))
      .first();

    let paymentId;
    if (payment) {
      await ctx.db.patch(payment._id, {
        organizationId: args.organizationId,
        subscriptionId,
        status: "completed",
        completedAt: now,
      });
      paymentId = payment._id;
    } else {
      paymentId = await ctx.db.insert("payments", {
        organizationId: args.organizationId,
        userId: args.userId || org.ownerId,
        subscriptionId,
        amount,
        currency: org.currency || "NGN",
        provider,
        providerReference: args.paymentReference,
        reference: args.paymentReference,
        paymentMethod: (provider as any),
        status: "completed",
        createdAt: now,
        completedAt: now,
      });
    }

    // Generate Invoice
    const invoiceNumber = await generateNextInvoiceNumber(ctx);
    const invoiceId = await ctx.db.insert("invoices", {
      organizationId: args.organizationId,
      subscriptionId,
      paymentId,
      invoiceNumber,
      status: "paid",
      amount,
      currency: org.currency || "NGN",
      periodStart: now,
      periodEnd,
      issuedAt: now,
      paidAt: now,
      dueDate: now,
      paymentReference: args.paymentReference,
      paymentMethod: (provider as any) || "paystack",
      items: [
        {
          description: `Orviohub Standard Plan (${interval === "annual" ? "Annual" : "Monthly"})`,
          quantity: 1,
          unitPrice: amount,
          total: amount,
        },
      ],
      createdAt: now,
      updatedAt: now,
    });

    // Update paymentTransactions if any
    const tx = await ctx.db
      .query("paymentTransactions")
      .withIndex("by_gateway_ref", (q) => q.eq("gatewayReference", args.paymentReference))
      .first();
    if (tx) {
      await ctx.db.patch(tx._id, {
        status: "success",
        paidAt: now,
        updatedAt: now,
      });
    }

    // Record audit logs
    await ctx.db.insert("auditLogs", {
      actorId: args.userId || org.ownerId,
      actorUserId: args.userId || org.ownerId,
      organizationId: args.organizationId,
      action: "billing.payment_verified",
      resource: `payment:${args.paymentReference}`,
      severity: "info",
      metadata: {
        planKey: "standard",
        amount,
        reference: args.paymentReference,
      },
      timestamp: now,
      createdAt: now,
    });

    await ctx.db.insert("auditLogs", {
      actorId: args.userId || org.ownerId,
      actorUserId: args.userId || org.ownerId,
      organizationId: args.organizationId,
      action: "billing.subscription_activated",
      resource: `subscription:${subscriptionId}`,
      severity: "info",
      metadata: {
        planKey: "standard",
        status: "active",
      },
      timestamp: now,
      createdAt: now,
    });

    // Update all workspaces under this organization to active standard plan
    const orgWorkspaces = await ctx.db
      .query("workspaces")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", args.organizationId))
      .collect();

    for (const ws of orgWorkspaces) {
      // Only patch fields that exist in the workspaces schema
      await ctx.db.patch(ws._id, {
        planId: "standard",
        status: "active",
        updatedAt: now,
      });

      const prods = await ctx.db
        .query("workspaceProducts")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", ws._id))
        .collect();

      for (const prod of prods) {
        if (prod.productKey === "inventory") {
          // Only patch fields that exist in the workspaceProducts schema
          await ctx.db.patch(prod._id, {
            planId: "standard",
            status: "active",
          });
        }
      }
    }

    // Audit Log for payment & invoice
    await ctx.db.insert("auditLogs", {
      actorId: args.userId || org.ownerId,
      actorUserId: args.userId || org.ownerId,
      organizationId: args.organizationId,
      action: "billing.payment_success",
      resource: `subscription:${subscriptionId}`,
      severity: "info",
      metadata: {
        paymentReference: args.paymentReference,
        provider,
        amount,
        billingInterval: interval,
        invoiceId,
        invoiceNumber,
      },
      timestamp: now,
    });

    await ctx.db.insert("auditLogs", {
      actorId: args.userId || org.ownerId,
      actorUserId: args.userId || org.ownerId,
      organizationId: args.organizationId,
      action: "billing.invoice_created",
      resource: `invoice:${invoiceId}`,
      severity: "info",
      metadata: {
        invoiceNumber,
        amount,
        paymentReference: args.paymentReference,
      },
      timestamp: now,
    });

    // Enqueue confirmation email with invoice link
    const ownerUser = args.userId ? await ctx.db.get(args.userId) : (org.ownerId ? await ctx.db.get(org.ownerId) : null);
    if (ownerUser && (ownerUser as any).email) {
      await ctx.db.insert("emailOutbox", {
        to: (ownerUser as any).email,
        template: "invoice_generated" as any,
        payload: {
          firstName: (ownerUser as any).name?.split(" ")[0] || "there",
          name: (ownerUser as any).name || "Customer",
          orgName: org.name,
          planName: "Standard Plan",
          billingInterval: interval === "annual" ? "Annual" : "Monthly",
          amount: String(amount),
          invoiceNumber,
          invoiceId,
          paymentReference: args.paymentReference || "",
          date: new Date(now).toLocaleDateString("en-NG", {
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

    return {
      success: true,
      organizationId: args.organizationId,
      subscriptionId,
      invoiceId,
      invoiceNumber,
      status: "active",
      planKey: "standard",
    };
  },
});

export const switchOrgPlan = mutation({
  args: {
    organizationId: v.id("organizations"),
    newPlanKey: v.union(v.literal("free_trial"), v.literal("standard")),
    billingInterval: v.optional(v.union(v.literal("monthly"), v.literal("annual"))),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new Error("ORGANIZATION_NOT_FOUND");

    const actorId = args.userId || org.ownerId;
    const now = Date.now();

    // If switching to free_trial, enforce 1 free trial org rule
    if (args.newPlanKey === "free_trial" && actorId) {
      await ensureUserHasNoOtherFreeTrial(ctx, actorId, args.organizationId);
    }

    let sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", args.organizationId))
      .first();

    const interval = args.billingInterval || sub?.billingInterval || "monthly";
    const isFree = args.newPlanKey === "free_trial";
    const trialDays = 30;
    const trialEnd = isFree ? now + trialDays * 86_400_000 : undefined;
    const periodDays = interval === "annual" ? 365 : 30;
    const periodEnd = isFree ? trialEnd! : now + periodDays * 86_400_000;
    const amount = isFree ? 0 : (interval === "annual" ? 75000 : 7500);
    const newStatus = isFree ? "trial" : "pending";

    if (sub) {
      await ctx.db.patch(sub._id, {
        planKey: args.newPlanKey,
        status: newStatus,
        billingInterval: interval,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        trialStart: isFree ? now : undefined,
        trialEnd,
        trialEndsAt: trialEnd,
        amount,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("subscriptions", {
        organizationId: args.organizationId,
        planKey: args.newPlanKey,
        status: newStatus,
        billingInterval: interval,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        trialStart: isFree ? now : undefined,
        trialEnd,
        trialEndsAt: trialEnd,
        paymentMethod: isFree ? "bank_transfer" : "paystack",
        amount,
        currency: org.currency || "NGN",
        cancelAtPeriodEnd: false,
        createdAt: now,
        updatedAt: now,
      });
    }

    const ws = await ctx.db
      .query("workspaces")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", args.organizationId))
      .first();

    if (ws) {
      await ctx.db.patch(ws._id, {
        planId: args.newPlanKey,
        updatedAt: now,
      });
    }

    await ctx.db.insert("auditLogs", {
      actorId,
      actorUserId: actorId,
      organizationId: args.organizationId,
      action: "billing.plan_changed",
      resource: `organization:${args.organizationId}`,
      severity: "info",
      metadata: {
        newPlanKey: args.newPlanKey,
        status: newStatus,
      },
      timestamp: now,
    });

    return {
      success: true,
      organizationId: args.organizationId,
      planKey: args.newPlanKey,
      status: newStatus,
    };
  },
});

export const getSubscriptionForOrg = getByOrganization;

export const upgradeSubscription = mutation({
  args: {
    organizationId: v.id("organizations"),
    newPlanKey: v.string(), // "standard"
    billingInterval: v.optional(v.union(v.literal("monthly"), v.literal("annual"))),
    paymentReference: v.optional(v.string()),
    provider: v.optional(v.string()),
    amount: v.optional(v.number()),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new Error("ORGANIZATION_NOT_FOUND");

    const actorId = args.userId || org.ownerId;
    const now = Date.now();
    const interval = args.billingInterval || "monthly";
    const periodDays = interval === "annual" ? 365 : 30;
    const periodEnd = now + periodDays * 86_400_000;
    const targetPlanKey = args.newPlanKey === "free" ? "free_trial" : args.newPlanKey;

    // Get pricing from plan table if available
    const plan = await ctx.db
      .query("plans")
      .withIndex("by_key", (q) => q.eq("key", targetPlanKey))
      .first();

    const planMonthly = plan?.price?.monthly || plan?.monthlyPrice || (targetPlanKey === "standard" ? 7500 : 20000);
    const planAnnual = plan?.price?.annual || plan?.annualPrice || (targetPlanKey === "standard" ? 75000 : 200000);
    const expectedAmount = args.amount || (interval === "annual" ? planAnnual : planMonthly);
    const provider = args.provider || "paystack";

    let sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", args.organizationId))
      .first();

    const isImmediatePaid = Boolean(args.paymentReference);
    const status = isImmediatePaid ? "active" : "pending";

    let subscriptionId: any;
    if (sub) {
      await ctx.db.patch(sub._id, {
        planKey: targetPlanKey,
        status,
        billingInterval: interval,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        lastPaymentDate: isImmediatePaid ? now : sub.lastPaymentDate,
        nextPaymentDate: isImmediatePaid ? periodEnd : sub.nextPaymentDate,
        paymentMethod: (provider as any),
        amount: expectedAmount,
        trialEnd: undefined,
        trialEndsAt: undefined,
        updatedAt: now,
      });
      subscriptionId = sub._id;
    } else {
      subscriptionId = await ctx.db.insert("subscriptions", {
        organizationId: args.organizationId,
        planKey: targetPlanKey,
        status,
        billingInterval: interval,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        lastPaymentDate: isImmediatePaid ? now : undefined,
        nextPaymentDate: isImmediatePaid ? periodEnd : undefined,
        paymentMethod: (provider as any),
        amount: expectedAmount,
        currency: org.currency || "NGN",
        cancelAtPeriodEnd: false,
        createdAt: now,
        updatedAt: now,
      });
    }

    let invoiceId = undefined;
    let invoiceNumber = undefined;

    if (isImmediatePaid) {
      // Record payment
      const paymentId = await ctx.db.insert("payments", {
        organizationId: args.organizationId,
        userId: actorId,
        subscriptionId,
        amount: expectedAmount,
        currency: org.currency || "NGN",
        provider,
        providerReference: args.paymentReference,
        reference: args.paymentReference,
        paymentMethod: (provider as any),
        status: "success",
        createdAt: now,
        completedAt: now,
      });

      // Generate invoice
      invoiceNumber = await generateNextInvoiceNumber(ctx);
      invoiceId = await ctx.db.insert("invoices", {
        organizationId: args.organizationId,
        subscriptionId,
        paymentId,
        invoiceNumber,
        status: "paid",
        amount: expectedAmount,
        currency: org.currency || "NGN",
        periodStart: now,
        periodEnd,
        issuedAt: now,
        paidAt: now,
        dueDate: now,
        paymentReference: args.paymentReference,
        paymentMethod: (provider as any) || "paystack",
        items: [
          {
            description: `Orviohub ${targetPlanKey === "standard" ? "Standard" : "Premium"} Plan (${interval === "annual" ? "Annual" : "Monthly"})`,
            quantity: 1,
            unitPrice: expectedAmount,
            total: expectedAmount,
          },
        ],
        createdAt: now,
        updatedAt: now,
      });

      await ctx.db.insert("auditLogs", {
        actorId,
        actorUserId: actorId,
        organizationId: args.organizationId,
        action: "billing.payment_success",
        resource: `subscription:${subscriptionId}`,
        severity: "info",
        metadata: {
          paymentReference: args.paymentReference,
          provider,
          amount: expectedAmount,
          billingInterval: interval,
          invoiceId,
          invoiceNumber,
        },
        timestamp: now,
      });

      await ctx.db.insert("auditLogs", {
        actorId,
        actorUserId: actorId,
        organizationId: args.organizationId,
        action: "billing.invoice_created",
        resource: `invoice:${invoiceId}`,
        severity: "info",
        metadata: {
          invoiceNumber,
          amount: expectedAmount,
          paymentReference: args.paymentReference,
        },
        timestamp: now,
      });
    }

    // Update primary workspace plan
    const ws = await ctx.db
      .query("workspaces")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", args.organizationId))
      .first();

    if (ws) {
      await ctx.db.patch(ws._id, {
        planId: targetPlanKey,
        updatedAt: now,
      });
    }

    await ctx.db.insert("auditLogs", {
      actorId,
      actorUserId: actorId,
      organizationId: args.organizationId,
      action: "billing.plan_upgraded",
      resource: `organization:${args.organizationId}`,
      severity: "info",
      metadata: {
        newPlanKey: targetPlanKey,
        status,
        billingInterval: interval,
        amount: expectedAmount,
      },
      timestamp: now,
    });

    return {
      success: true,
      organizationId: args.organizationId,
      subscriptionId,
      invoiceId,
      invoiceNumber,
      status,
      planKey: targetPlanKey,
    };
  },
});

export const cancelSubscription = mutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.optional(v.id("users")),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", args.organizationId))
      .first();

    if (!sub) {
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

    if (!sub) throw new Error("SUBSCRIPTION_NOT_FOUND");

    const now = Date.now();
    await ctx.db.patch(sub._id, {
      cancelAtPeriodEnd: true,
      updatedAt: now,
    });

    await ctx.db.insert("auditLogs", {
      actorId: args.userId,
      actorUserId: args.userId,
      organizationId: args.organizationId,
      action: "billing.subscription_cancelled",
      resource: `subscription:${sub._id}`,
      severity: "warning",
      metadata: {
        reason: args.reason || "User requested cancellation at period end",
      },
      timestamp: now,
    });

    return { success: true };
  },
});

export const adminListSubscriptions = listAll;

export const adminGetSubscription = query({
  args: {
    subscriptionId: v.optional(v.union(v.id("subscriptions"), v.string())),
    organizationId: v.optional(v.union(v.id("organizations"), v.string())),
    workspaceId: v.optional(v.union(v.id("workspaces"), v.string())),
  },
  handler: async (ctx, args) => {
    let sub: any = null;

    if (args.subscriptionId) {
      const normId = ctx.db.normalizeId("subscriptions", args.subscriptionId);
      if (normId) {
        sub = await ctx.db.get(normId);
      }
    }

    if (!sub && args.organizationId) {
      const normOrgId = ctx.db.normalizeId("organizations", args.organizationId);
      if (normOrgId) {
        sub = await ctx.db
          .query("subscriptions")
          .withIndex("by_organizationId", (q) => q.eq("organizationId", normOrgId))
          .first();
      }
    }

    if (!sub && args.workspaceId) {
      const normWsId = ctx.db.normalizeId("workspaces", args.workspaceId);
      if (normWsId) {
        sub = await ctx.db
          .query("subscriptions")
          .withIndex("by_workspace", (q) => q.eq("workspaceId", normWsId))
          .first();
      }
    }

    if (!sub && args.subscriptionId) {
      // Try searching organizationId or workspaceId matching string
      const org = await ctx.db
        .query("organizations")
        .withIndex("by_slug", (q) => q.eq("slug", args.subscriptionId as string))
        .first();
      if (org) {
        sub = await ctx.db
          .query("subscriptions")
          .withIndex("by_organizationId", (q) => q.eq("organizationId", org._id))
          .first();
      }
    }

    if (!sub) return null;

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

    const normPlanKey = sub.planKey === "free" ? "free_trial" : sub.planKey;
    let plan = await ctx.db
      .query("plans")
      .withIndex("by_key", (q) => q.eq("key", normPlanKey))
      .first();

    if (!plan) {
      plan = (DEFAULT_PLANS.find((p) => p.key === normPlanKey) as any) || DEFAULT_PLANS[0];
    }

    // Invoices
    let invoices: any[] = [];
    if (org?._id) {
      invoices = await ctx.db
        .query("invoices")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", org._id))
        .collect();
    }
    if (invoices.length === 0 && workspace?._id) {
      invoices = await ctx.db
        .query("invoices")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", workspace._id))
        .collect();
    }

    // Payments
    let payments: any[] = [];
    if (org?._id) {
      payments = await ctx.db
        .query("payments")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", org._id))
        .collect();
    }
    if (payments.length === 0 && workspace?._id) {
      payments = await ctx.db
        .query("payments")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", workspace._id))
        .collect();
    }

    return {
      ...sub,
      id: sub._id,
      organization: org
        ? {
            id: org._id,
            name: org.name,
            slug: org.slug,
            phone: org.phone,
            currency: org.currency || "NGN",
            category: org.category || org.industry,
            address: org.address || `${org.street || ""}, ${org.city || ""}, ${org.state || ""}`.trim(),
            createdAt: org.createdAt,
          }
        : null,
      workspace: workspace
        ? {
            id: workspace._id,
            name: workspace.name,
            slug: workspace.slug,
          }
        : null,
      owner: owner
        ? {
            id: owner._id,
            name: owner.name,
            email: owner.email,
            phone: owner.phone,
          }
        : null,
      plan,
      invoices: invoices.sort((a, b) => (b.issuedAt || b.createdAt) - (a.issuedAt || a.createdAt)),
      payments: payments.sort((a, b) => (b.completedAt || b.createdAt) - (a.completedAt || a.createdAt)),
    };
  },
});

export const adminAdjustSubscription = mutation({
  args: {
    subscriptionId: v.union(v.id("subscriptions"), v.string()),
    planKey: v.optional(v.string()),
    planId: v.optional(v.union(v.id("plans"), v.string())),
    status: v.optional(v.string()),
    trialEndsAt: v.optional(v.number()),
    currentPeriodStart: v.optional(v.number()),
    currentPeriodEnd: v.optional(v.number()),
    billingInterval: v.optional(v.union(v.literal("monthly"), v.literal("annual"))),
    cancelAtPeriodEnd: v.optional(v.boolean()),
    adminSessionToken: v.optional(v.string()),
    adminUserId: v.optional(v.union(v.id("users"), v.string())),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let sub: any = null;
    const normId = ctx.db.normalizeId("subscriptions", args.subscriptionId);
    if (normId) {
      sub = await ctx.db.get(normId);
    }
    if (!sub) {
      // Try searching by organizationId or workspaceId
      const orgIdNorm = ctx.db.normalizeId("organizations", args.subscriptionId);
      if (orgIdNorm) {
        sub = await ctx.db
          .query("subscriptions")
          .withIndex("by_organizationId", (q) => q.eq("organizationId", orgIdNorm))
          .first();
      }
      if (!sub) {
        const wsIdNorm = ctx.db.normalizeId("workspaces", args.subscriptionId);
        if (wsIdNorm) {
          sub = await ctx.db
            .query("subscriptions")
            .withIndex("by_workspace", (q) => q.eq("workspaceId", wsIdNorm))
            .first();
        }
      }
    }

    if (!sub) throw new Error("SUBSCRIPTION_NOT_FOUND");

    const now = Date.now();
    const patchData: any = { updatedAt: now };

    if (args.planKey !== undefined) {
      patchData.planKey = args.planKey === "free" ? "free_trial" : args.planKey;
    }
    if (args.planId !== undefined) {
      patchData.planId = args.planId;
    }
    if (args.status !== undefined) {
      patchData.status = args.status;
    }
    if (args.trialEndsAt !== undefined) {
      patchData.trialEndsAt = args.trialEndsAt;
      patchData.trialEnd = args.trialEndsAt;
    }
    if (args.currentPeriodStart !== undefined) {
      patchData.currentPeriodStart = args.currentPeriodStart;
    }
    if (args.currentPeriodEnd !== undefined) {
      patchData.currentPeriodEnd = args.currentPeriodEnd;
    }
    if (args.billingInterval !== undefined) {
      patchData.billingInterval = args.billingInterval;
    }
    if (args.cancelAtPeriodEnd !== undefined) {
      patchData.cancelAtPeriodEnd = args.cancelAtPeriodEnd;
    }

    await ctx.db.patch(sub._id, patchData);

    // Update associated workspace plan if plan changed
    const targetPlanKey = patchData.planKey || sub.planKey;
    if (sub.workspaceId) {
      await ctx.db.patch(sub.workspaceId, {
        planId: targetPlanKey,
        status: patchData.status || sub.status,
        updatedAt: now,
      });
    } else if (sub.organizationId) {
      const ws = await ctx.db
        .query("workspaces")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", sub.organizationId))
        .first();
      if (ws) {
        await ctx.db.patch(ws._id, {
          planId: targetPlanKey,
          status: patchData.status || sub.status,
          updatedAt: now,
        });
      }
    }

    // Admin audit log
    await ctx.db.insert("adminAuditLogs", {
      action: "admin.subscription_adjusted",
      resourceType: "subscriptions",
      resourceId: sub._id,
      details: {
        subscriptionId: sub._id,
        organizationId: sub.organizationId,
        workspaceId: sub.workspaceId,
        updates: args,
        notes: args.notes,
      },
      createdAt: now,
    });

    if (sub.organizationId) {
      await ctx.db.insert("auditLogs", {
        organizationId: sub.organizationId,
        action: "billing.subscription_adjusted_by_admin",
        resource: `subscription:${sub._id}`,
        severity: "info",
        metadata: {
          updates: args,
          notes: args.notes,
        },
        timestamp: now,
      });
    }

    return await ctx.db.get(sub._id);
  },
});

export const adminRecordManualPayment = mutation({
  args: {
    subscriptionId: v.optional(v.union(v.id("subscriptions"), v.string())),
    organizationId: v.optional(v.union(v.id("organizations"), v.string())),
    workspaceId: v.optional(v.union(v.id("workspaces"), v.string())),
    amount: v.number(),
    currency: v.optional(v.string()),
    paymentDate: v.optional(v.number()),
    reference: v.string(),
    planKey: v.optional(v.string()),
    billingCycle: v.optional(v.string()),
    notes: v.optional(v.string()),
    adminUserId: v.optional(v.union(v.id("users"), v.string())),
    adminSessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const paidAt = args.paymentDate || now;
    const currency = args.currency || "NGN";
    const cycle = (args.billingCycle === "annual" ? "annual" : "monthly") as "monthly" | "annual";
    const periodDays = cycle === "annual" ? 365 : 30;

    let sub: any = null;
    let orgId: any = null;
    let wsId: any = null;

    if (args.subscriptionId) {
      const normId = ctx.db.normalizeId("subscriptions", args.subscriptionId);
      if (normId) sub = await ctx.db.get(normId);
    }

    if (!sub && args.organizationId) {
      const normOrgId = ctx.db.normalizeId("organizations", args.organizationId);
      if (normOrgId) {
        orgId = normOrgId;
        sub = await ctx.db
          .query("subscriptions")
          .withIndex("by_organizationId", (q) => q.eq("organizationId", normOrgId))
          .first();
      }
    }

    if (!sub && args.workspaceId) {
      const normWsId = ctx.db.normalizeId("workspaces", args.workspaceId);
      if (normWsId) {
        wsId = normWsId;
        sub = await ctx.db
          .query("subscriptions")
          .withIndex("by_workspace", (q) => q.eq("workspaceId", normWsId))
          .first();
      }
    }

    if (sub) {
      if (!orgId && sub.organizationId) orgId = sub.organizationId;
      if (!wsId && sub.workspaceId) wsId = sub.workspaceId;
    }

    if (!orgId && wsId) {
      const ws: any = await ctx.db.get(wsId);
      if (ws?.organizationId) orgId = ws.organizationId;
    }

    const targetPlanKey = args.planKey || sub?.planKey || "standard";
    const newPeriodEnd = paidAt + periodDays * 86_400_000;

    let subscriptionId: any = sub?._id;

    if (sub) {
      await ctx.db.patch(sub._id, {
        planKey: targetPlanKey,
        status: "active",
        billingInterval: cycle,
        currentPeriodStart: paidAt,
        currentPeriodEnd: newPeriodEnd,
        lastPaymentDate: paidAt,
        nextPaymentDate: newPeriodEnd,
        paymentMethod: "manual",
        amount: args.amount,
        trialEnd: undefined,
        trialEndsAt: undefined,
        cancelAtPeriodEnd: false,
        updatedAt: now,
      });
    } else {
      subscriptionId = await ctx.db.insert("subscriptions", {
        organizationId: orgId,
        workspaceId: wsId,
        planKey: targetPlanKey,
        status: "active",
        billingInterval: cycle,
        currentPeriodStart: paidAt,
        currentPeriodEnd: newPeriodEnd,
        lastPaymentDate: paidAt,
        nextPaymentDate: newPeriodEnd,
        paymentMethod: "manual",
        amount: args.amount,
        currency,
        cancelAtPeriodEnd: false,
        createdAt: now,
        updatedAt: now,
      });
    }

    // 1. Insert payments record
    const paymentId = await ctx.db.insert("payments", {
      organizationId: orgId,
      workspaceId: wsId,
      subscriptionId,
      amount: args.amount,
      currency,
      provider: "manual",
      providerReference: args.reference,
      reference: args.reference,
      paymentMethod: "manual",
      status: "success",
      createdAt: paidAt,
      completedAt: paidAt,
    });

    // 2. Generate and insert Invoice
    const invoiceNumber = await generateNextInvoiceNumber(ctx);
    const invoiceId = await ctx.db.insert("invoices", {
      organizationId: orgId,
      workspaceId: wsId,
      subscriptionId,
      paymentId,
      invoiceNumber,
      status: "paid",
      amount: args.amount,
      currency,
      periodStart: paidAt,
      periodEnd: newPeriodEnd,
      issuedAt: paidAt,
      paidAt,
      dueDate: paidAt,
      paymentReference: args.reference,
      paymentMethod: "manual",
      items: [
        {
          description: `Manual Offline Payment - ${targetPlanKey.toUpperCase()} Plan (${cycle === "annual" ? "Annual" : "Monthly"})`,
          quantity: 1,
          unitPrice: args.amount,
          total: args.amount,
        },
      ],
      createdAt: now,
      updatedAt: now,
    });

    // 3. Update Workspace
    if (wsId) {
      await ctx.db.patch(wsId, {
        planId: targetPlanKey,
        status: "active",
        updatedAt: now,
      });
    } else if (orgId) {
      const ws = await ctx.db
        .query("workspaces")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", orgId))
        .first();
      if (ws) {
        await ctx.db.patch(ws._id, {
          planId: targetPlanKey,
          status: "active",
          updatedAt: now,
        });
      }
    }

    // 4. Admin audit log
    await ctx.db.insert("adminAuditLogs", {
      action: "admin.manual_payment_recorded",
      resourceType: "payments",
      resourceId: paymentId,
      details: {
        subscriptionId,
        organizationId: orgId,
        amount: args.amount,
        currency,
        reference: args.reference,
        notes: args.notes,
        invoiceNumber,
      },
      createdAt: now,
    });

    if (orgId) {
      await ctx.db.insert("auditLogs", {
        organizationId: orgId,
        action: "billing.manual_payment_recorded",
        resource: `payment:${paymentId}`,
        severity: "info",
        metadata: {
          reference: args.reference,
          amount: args.amount,
          invoiceNumber,
        },
        timestamp: now,
      });
    }

    return {
      success: true,
      paymentId,
      invoiceId,
      invoiceNumber,
      subscriptionId,
      status: "active",
    };
  },
});
