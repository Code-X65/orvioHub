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
    let org: any = null, orgId: any = null, workspace: any = null, workspaceId: any = null;
    try {
      const resolved = await resolveOrganization(ctx, args.organizationId);
      org = resolved.org;
      orgId = resolved.orgId;
      workspace = resolved.workspace;
      workspaceId = resolved.workspaceId;
    } catch {
      // Safe fallback for test/ephemeral workspace IDs
    }

    const targetOrgId = orgId || org?._id || args.organizationId;
    const targetWsId = workspaceId || workspace?._id || args.organizationId;

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

    const effectiveBillingPlan = activePlan || selectedPlan || "free_trial";
    let resolvedAmount = sub?.amount;
    if (resolvedAmount === undefined) {
      if (effectiveBillingPlan === "standard") {
        resolvedAmount = sub?.billingInterval === "annual" ? 75000 : 7500;
      } else if (effectiveBillingPlan === "premium") {
        resolvedAmount = sub?.billingInterval === "annual" ? 250000 : 25000;
      } else {
        resolvedAmount = 0;
      }
    }

    const orgIdentifier = targetOrgId ? String(targetOrgId) : String(targetWsId);
    const billingAccId = sub?.billingAccountId ? String(sub.billingAccountId) : null;

    const billingContextData = {
      organizationId: orgIdentifier,
      billingAccountId: billingAccId,
      planKey: (activePlan || selectedPlan || "free_trial"),
      planName,
      selectedPlan,
      activePlan,
      status: isPaidActive ? "active" : isTrialing ? "trialing" : subStatus,
      subscriptionStatus: subStatus,
      paymentStatus,
      checkoutStatus,
      entitlementStatus,
      billingInterval: sub?.billingInterval || "monthly",
      currency: sub?.currency || "NGN",
      amount: resolvedAmount,
      trialStart: isPaidActive ? null : (sub?.trialStart || (isTrialing ? now : null)),
      trialEnd: isPaidActive ? null : (sub?.trialEnd || sub?.trialEndsAt || (isTrialing ? now + 30 * 86_400_000 : null)),
      currentPeriodStart: sub?.currentPeriodStart || now,
      currentPeriodEnd: sub?.currentPeriodEnd || (now + 30 * 86_400_000),
      gracePeriodEnd: sub?.gracePeriodEnd || null,
      cancelAtPeriodEnd: sub?.cancelAtPeriodEnd || false,
      grantType: sub?.grantType || (isPaidActive ? "paystack" : null),
      lastPaymentReference: sub?.lastPaymentReference || null,
      paystackCustomerCode: sub?.paystackCustomerCode,
      paystackSubscriptionCode: sub?.paystackSubscriptionCode,
      paystackPlanCode: sub?.paystackPlanCode,
      activatedAt: sub?.activatedAt,
      cancelledAt: sub?.cancelledAt,
    };

    return {
      organization: {
        id: orgIdentifier,
        name: org?.name || workspace?.name || "Organization",
        status: org?.status || workspace?.status || "active",
      },
      organizationId: orgIdentifier,
      billingAccountId: billingAccId,
      selectedPlan,
      activePlan,
      checkoutStatus,
      paymentStatus,
      subscriptionStatus: subStatus,
      entitlementStatus,
      billingInterval: sub?.billingInterval || "monthly",
      currency: sub?.currency || "NGN",
      amount: resolvedAmount,
      trialStart: billingContextData.trialStart,
      trialEnd: billingContextData.trialEnd,
      currentPeriodStart: billingContextData.currentPeriodStart,
      currentPeriodEnd: billingContextData.currentPeriodEnd,
      gracePeriodEnd: billingContextData.gracePeriodEnd,
      cancelAtPeriodEnd: billingContextData.cancelAtPeriodEnd,
      billing: billingContextData,
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
    planKey: v.optional(v.union(v.literal("standard"), v.literal("premium"))),
    amount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new Error("ORGANIZATION_NOT_FOUND");

    const targetPlanKey = args.planKey || "standard";
    const expectedAmount = targetPlanKey === "premium"
      ? (args.billingInterval === "annual" ? 250000 : 25000)
      : (args.billingInterval === "annual" ? 75000 : 7500);

    const now = Date.now();
    const planPrefix = targetPlanKey === "premium" ? "PREM" : "STD";
    const reference = `ORV_${planPrefix}_${String(args.organizationId).slice(-6)}_${now.toString(36).toUpperCase()}`;

    let sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_organizationId", (q: any) => q.eq("organizationId", args.organizationId))
      .first();

    if (sub) {
      await ctx.db.patch(sub._id, {
        selectedPlan: targetPlanKey,
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
        planKey: targetPlanKey,
        selectedPlan: targetPlanKey,
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
      planKey: targetPlanKey,
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
        planKey: targetPlanKey,
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
      planKey: targetPlanKey,
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
        currentPeriodEnd: now + 30 * 86_400_000,
        trialStart: now,
        trialEnd: now + 30 * 86_400_000,
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
        currentPeriodEnd: now + 30 * 86_400_000,
        trialStart: now,
        trialEnd: now + 30 * 86_400_000,
        trialEndsAt: now + 30 * 86_400_000,
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
        currentPeriodEnd: now + 30 * 86_400_000,
        trialStart: now,
        trialEnd: now + 30 * 86_400_000,
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
    const trialDays = plan.trialDays || 30;
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
    planKey: v.optional(v.union(v.literal("standard"), v.literal("premium"))),
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

    const targetPlan = args.planKey ||
      (args.amount && (args.amount >= 20000 || args.amount === 200000) ? "premium" : sub?.selectedPlan === "premium" ? "premium" : "standard");

    const defaultAmount = targetPlan === "premium"
      ? (interval === "annual" ? 200000 : 20000)
      : (interval === "annual" ? 75000 : 7500);

    const amount = args.amount || defaultAmount;
    const provider = args.provider || "paystack";

    let subscriptionId: any;
    if (sub) {
      await ctx.db.patch(sub._id, {
        planKey: targetPlan,
        selectedPlan: targetPlan,
        activePlan: targetPlan,
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
        planKey: targetPlan,
        selectedPlan: targetPlan,
        activePlan: targetPlan,
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
          description: `Orviohub ${targetPlan === "premium" ? "Premium" : "Standard"} Plan (${interval === "annual" ? "Annual" : "Monthly"})`,
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
        planKey: targetPlan,
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
        planKey: targetPlan,
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
        planKey: targetPlan,
        status: "active",
      },
      timestamp: now,
      createdAt: now,
    });

    // Update all workspaces under this organization to active target plan
    const orgWorkspaces = await ctx.db
      .query("workspaces")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", args.organizationId))
      .collect();

    for (const ws of orgWorkspaces) {
      // Only patch fields that exist in the workspaces schema
      await ctx.db.patch(ws._id, {
        planId: targetPlan,
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
            planId: targetPlan,
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

/**
 * Daily Cron: Check trial expirations and send warning alerts (3 days & 1 day before)
 */
export const checkTrialExpirations = mutation({
  args: {},
  handler: async (ctx) => {
    const allSubs = await ctx.db.query("subscriptions").collect();
    const now = Date.now();
    let warnedCount = 0;

    for (const sub of allSubs) {
      const isTrial = sub.status === "trial" || sub.status === "trialing" || sub.planKey === "free_trial" || sub.planKey === "free";
      if (!isTrial) continue;

      const trialEnd = sub.trialEndsAt || sub.trialEnd || sub.currentPeriodEnd;
      if (!trialEnd || trialEnd <= now) continue;

      const msRemaining = trialEnd - now;
      const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));

      // Warn at 3 days and 1 day
      if (daysRemaining === 3 || daysRemaining === 1) {
        let org: any = sub.organizationId ? await ctx.db.get(sub.organizationId) : null;
        let ws: any = sub.workspaceId ? await ctx.db.get(sub.workspaceId) : null;
        const ownerId = org?.ownerId || ws?.ownerId || sub.userId;

        if (ownerId) {
          await ctx.db.insert("notifications", {
            userId: ownerId,
            workspaceId: sub.workspaceId,
            productKey: "inventory",
            type: "billing.trial_ending",
            title: `Your Free Trial expires in ${daysRemaining} day${daysRemaining > 1 ? "s" : ""}!`,
            body: `Upgrade to the Standard Plan to keep your inventory, branch data, and team access uninterrupted.`,
            severity: "WARNING",
            channel: "IN_APP",
            status: "UNREAD",
            createdAt: now,
          });

          const user = await ctx.db.get(ownerId);
          if (user && (user as any).email) {
            await ctx.db.insert("emailOutbox", {
              to: (user as any).email,
              template: "trial_ending" as any,
              payload: {
                firstName: (user as any).name?.split(" ")[0] || "there",
                name: (user as any).name || "Customer",
                orgName: org?.name || ws?.name || "Your Business",
                daysRemaining: String(daysRemaining),
                trialEndsAt: new Date(trialEnd).toLocaleDateString("en-NG", {
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
          warnedCount++;
        }
      }
    }

    return { success: true, warnedCount };
  },
});

/**
 * Hourly Cron: Automatically expire ended Free Trials and recalculate entitlements
 */
export const expireTrials = mutation({
  args: {},
  handler: async (ctx) => {
    const allSubs = await ctx.db.query("subscriptions").collect();
    const now = Date.now();
    let expiredCount = 0;

    for (const sub of allSubs) {
      const isTrial = sub.status === "trial" || sub.status === "trialing";
      if (!isTrial) continue;

      const trialEnd = sub.trialEndsAt || sub.trialEnd || sub.currentPeriodEnd;
      if (trialEnd && trialEnd <= now) {
        await ctx.db.patch(sub._id, {
          status: "expired",
          activePlan: null,
          entitlementStatus: "inactive",
          updatedAt: now,
        });

        // Update entitlements if workspaceId is present
        if (sub.workspaceId) {
          const ents = await ctx.db
            .query("workspaceEntitlements")
            .withIndex("by_workspace", (q: any) => q.eq("workspaceId", sub.workspaceId))
            .collect();
          for (const ent of ents) {
            await ctx.db.patch(ent._id, {
              status: "expired",
              enabled: false,
              updatedAt: now,
            });
          }
        }

        let org: any = sub.organizationId ? await ctx.db.get(sub.organizationId) : null;
        let ws: any = sub.workspaceId ? await ctx.db.get(sub.workspaceId) : null;
        const ownerId = org?.ownerId || ws?.ownerId || sub.userId;

        if (ownerId) {
          await ctx.db.insert("notifications", {
            userId: ownerId,
            workspaceId: sub.workspaceId,
            productKey: "inventory",
            type: "billing.trial_expired",
            title: "Your 30-Day Free Trial has expired",
            body: "Your trial period has concluded. Upgrade to Standard to reactivate full operations.",
            severity: "ERROR",
            channel: "IN_APP",
            status: "UNREAD",
            createdAt: now,
          });
        }

        await ctx.db.insert("auditLogs", {
          organizationId: sub.organizationId,
          workspaceId: sub.workspaceId,
          action: "billing.trial_expired",
          resource: `subscription:${sub._id}`,
          severity: "warning",
          metadata: {
            previousStatus: "trial",
            expiredAt: now,
          },
          timestamp: now,
        });

        expiredCount++;
      }
    }

    return { success: true, expiredCount };
  },
});

/**
 * Daily Cron: Send renewal reminders 3 days before period end for paid subscriptions
 */
export const checkRenewals = mutation({
  args: {},
  handler: async (ctx) => {
    const allSubs = await ctx.db.query("subscriptions").collect();
    const now = Date.now();
    let remindedCount = 0;

    for (const sub of allSubs) {
      if (sub.status !== "active" || sub.planKey === "free_trial" || sub.planKey === "free") continue;
      if (!sub.currentPeriodEnd || sub.currentPeriodEnd <= now) continue;

      const msRemaining = sub.currentPeriodEnd - now;
      const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));

      if (daysRemaining === 3 || daysRemaining === 1) {
        let org: any = sub.organizationId ? await ctx.db.get(sub.organizationId) : null;
        let ws: any = sub.workspaceId ? await ctx.db.get(sub.workspaceId) : null;
        const ownerId = org?.ownerId || ws?.ownerId || sub.userId;

        if (ownerId) {
          await ctx.db.insert("notifications", {
            userId: ownerId,
            workspaceId: sub.workspaceId,
            productKey: "inventory",
            type: "billing.renewal_reminder",
            title: `Your subscription will renew in ${daysRemaining} day${daysRemaining > 1 ? "s" : ""}`,
            body: `Your ${sub.planKey.toUpperCase()} plan will renew on ${new Date(sub.currentPeriodEnd).toLocaleDateString("en-NG")}.`,
            severity: "INFO",
            channel: "IN_APP",
            status: "UNREAD",
            createdAt: now,
          });
          remindedCount++;
        }
      }
    }

    return { success: true, remindedCount };
  },
});

/**
 * Hourly Cron: Process overdue subscriptions through 3-Stage Degradation:
 * Stage 1 (Day 1): past_due + 7-day grace period
 * Stage 2 (Day 3): grace_period + urgent reminder
 * Stage 3 (Day 7 / grace expired): suspended + entitlements revoked
 */
export const processRenewals = mutation({
  args: {},
  handler: async (ctx) => {
    const allSubs = await ctx.db.query("subscriptions").collect();
    const now = Date.now();
    let processedCount = 0;

    for (const sub of allSubs) {
      const isPaid = sub.planKey === "standard" || sub.planKey === "premium";
      if (!isPaid) continue;

      let org: any = sub.organizationId ? await ctx.db.get(sub.organizationId) : null;
      let ws: any = sub.workspaceId ? await ctx.db.get(sub.workspaceId) : null;
      const ownerId = org?.ownerId || ws?.ownerId || sub.userId;

      // Stage 1: Active subscription whose currentPeriodEnd has arrived without renewal
      if (sub.status === "active" && sub.currentPeriodEnd && sub.currentPeriodEnd <= now) {
        const graceEnd = now + 7 * 86_400_000;
        await ctx.db.patch(sub._id, {
          status: "past_due",
          gracePeriodEnd: graceEnd,
          updatedAt: now,
        });

        if (ownerId) {
          await ctx.db.insert("notifications", {
            userId: ownerId,
            workspaceId: sub.workspaceId,
            productKey: "inventory",
            type: "billing.payment_past_due",
            title: "Payment past due - 7 day grace period active",
            body: `Your subscription payment could not be renewed. You have a 7-day grace period ending on ${new Date(graceEnd).toLocaleDateString("en-NG")} to retry payment before access is restricted.`,
            severity: "WARNING",
            channel: "IN_APP",
            status: "UNREAD",
            createdAt: now,
          });
        }

        await ctx.db.insert("auditLogs", {
          organizationId: sub.organizationId,
          workspaceId: sub.workspaceId,
          action: "billing.past_due_stage1_started",
          resource: `subscription:${sub._id}`,
          severity: "warning",
          metadata: { gracePeriodEnd: graceEnd },
          timestamp: now,
        });

        processedCount++;
      }
      // Stage 2: 3 days past due (grace period <= 4 days remaining)
      else if (sub.status === "past_due" && sub.gracePeriodEnd) {
        const msRemaining = sub.gracePeriodEnd - now;
        const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));

        if (daysRemaining <= 4 && daysRemaining > 0) {
          await ctx.db.patch(sub._id, {
            status: "grace_period",
            updatedAt: now,
          });

          if (ownerId) {
            await ctx.db.insert("notifications", {
              userId: ownerId,
              workspaceId: sub.workspaceId,
              productKey: "inventory",
              type: "billing.grace_period_warning",
              title: `Urgent: ${daysRemaining} day${daysRemaining > 1 ? "s" : ""} left in grace period`,
              body: "Your organization access will be suspended unless a payment method is updated.",
              severity: "WARNING",
              channel: "IN_APP",
              status: "UNREAD",
              createdAt: now,
            });
          }

          await ctx.db.insert("auditLogs", {
            organizationId: sub.organizationId,
            workspaceId: sub.workspaceId,
            action: "billing.grace_period_stage2_warning",
            resource: `subscription:${sub._id}`,
            severity: "warning",
            metadata: { daysRemaining },
            timestamp: now,
          });

          processedCount++;
        }
      }
      // Stage 3: Grace period elapsed -> Suspend organization access
      if ((sub.status === "past_due" || sub.status === "grace_period") && sub.gracePeriodEnd && sub.gracePeriodEnd <= now) {
        await ctx.db.patch(sub._id, {
          status: "suspended",
          entitlementStatus: "inactive",
          updatedAt: now,
        });

        if (sub.workspaceId) {
          await ctx.db.patch(sub.workspaceId, {
            status: "suspended",
            updatedAt: now,
          });
        }

        if (sub.organizationId) {
          await ctx.db.patch(sub.organizationId, {
            status: "suspended",
            updatedAt: now,
          });
        }

        if (ownerId) {
          await ctx.db.insert("notifications", {
            userId: ownerId,
            workspaceId: sub.workspaceId,
            productKey: "inventory",
            type: "billing.subscription_suspended",
            title: "Organization suspended due to unpaid subscription",
            body: "Your grace period has ended. Please make a payment to restore full business access.",
            severity: "ERROR",
            channel: "IN_APP",
            status: "UNREAD",
            createdAt: now,
          });
        }

        await ctx.db.insert("auditLogs", {
          organizationId: sub.organizationId,
          workspaceId: sub.workspaceId,
          action: "billing.subscription_suspended_stage3",
          resource: `subscription:${sub._id}`,
          severity: "critical",
          metadata: { suspendedAt: now },
          timestamp: now,
        });

        processedCount++;
      }
    }

    return { success: true, processedCount };
  },
});

/**
 * Hourly Cron / Mutation: Automatically execute pending scheduled billing changes (downgrades and cancellations)
 */
export const applyScheduledBillingChanges = mutation({
  args: {
    workspaceId: v.optional(v.union(v.id("workspaces"), v.id("organizations"), v.string())),
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let subs: any[] = [];
    if (args.workspaceId) {
      const { org, orgId, workspace, workspaceId } = await resolveOrganization(ctx, String(args.workspaceId));
      const targetOrgId = orgId || org?._id;
      const targetWsId = workspaceId || workspace?._id;

      if (targetOrgId) {
        const orgSub = await ctx.db
          .query("subscriptions")
          .withIndex("by_organizationId", (q: any) => q.eq("organizationId", targetOrgId))
          .first();
        if (orgSub) subs.push(orgSub);
      }
      if (subs.length === 0 && targetWsId) {
        const wsSub = await ctx.db
          .query("subscriptions")
          .withIndex("by_workspace", (q: any) => q.eq("workspaceId", targetWsId))
          .first();
        if (wsSub) subs.push(wsSub);
      }
    } else {
      subs = await ctx.db.query("subscriptions").collect();
    }

    const now = Date.now();
    let appliedCount = 0;

    for (const sub of subs) {
      const isDowngradeDue =
        (sub.downgradeStatus === "scheduled" || Boolean(sub.pendingPlanKey || sub.pendingPlan)) &&
        (args.force || (sub.changeEffectiveAt && sub.changeEffectiveAt <= now) || (sub.currentPeriodEnd && sub.currentPeriodEnd <= now));

      const isCancellationDue =
        sub.cancelAtPeriodEnd &&
        sub.status !== "expired" &&
        sub.status !== "cancelled" &&
        sub.status !== "canceled" &&
        !isDowngradeDue &&
        (args.force || (sub.currentPeriodEnd && sub.currentPeriodEnd <= now));

      // 1. Process Scheduled Downgrade (Premium -> Standard)
      if (isDowngradeDue) {
        const targetPlan = "standard"; // strictly Standard in authoritative plan model
        const targetLimits = { maxBranches: 3, maxMembers: 10, maxProducts: 5000, maxTransactions: 5000 };
        const decisions: Array<{ resourceType: string; resourceId: string; action: string }> =
          sub.downgradeResourceDecisions || [];

        // Archive branches according to decisions or excess
        let branches: any[] = [];
        if (sub.organizationId) {
          branches = await ctx.db
            .query("branches")
            .withIndex("by_organizationId", (q: any) => q.eq("organizationId", sub.organizationId))
            .collect();
        } else if (sub.workspaceId) {
          branches = await ctx.db
            .query("branches")
            .withIndex("by_workspace", (q: any) => q.eq("workspaceId", sub.workspaceId))
            .collect();
        }

        let archivedBranchCount = 0;
        const branchDecisionsMap = new Map(
          decisions.filter((d) => d.resourceType === "branch").map((d) => [d.resourceId, d.action])
        );

        const activeBranches = branches.filter((b) => b.status !== "deleted" && b.status !== "archived" && b.status !== "ARCHIVED");
        for (const b of activeBranches) {
          const decisionAction = branchDecisionsMap.get(String(b._id));
          if (decisionAction === "archive" || (branchDecisionsMap.size === 0 && activeBranches.indexOf(b) >= targetLimits.maxBranches)) {
            await ctx.db.patch(b._id, {
              status: "archived",
              isPrimary: false,
              updatedAt: now,
            });
            archivedBranchCount++;
            await ctx.db.insert("auditLogs", {
              organizationId: sub.organizationId,
              workspaceId: sub.workspaceId,
              action: "billing.resource_archived_for_downgrade",
              resource: `branch:${b._id}`,
              severity: "info",
              metadata: { branchId: b._id, branchName: b.name },
              timestamp: now,
              createdAt: now,
            });
          }
        }

        // Suspend members according to decisions or excess
        let members: any[] = [];
        if (sub.organizationId) {
          members = await ctx.db
            .query("organizationMemberships")
            .withIndex("by_organizationId", (q: any) => q.eq("organizationId", sub.organizationId))
            .collect();
        } else if (sub.workspaceId) {
          members = await ctx.db
            .query("workspaceMemberships")
            .withIndex("by_workspace", (q: any) => q.eq("workspaceId", sub.workspaceId))
            .collect();
        }

        let suspendedMemberCount = 0;
        const memberDecisionsMap = new Map(
          decisions.filter((d) => d.resourceType === "member").map((d) => [d.resourceId, d.action])
        );

        const activeMembers = members.filter((m) => m.status === "ACTIVE" || m.status === "active");
        for (const m of activeMembers) {
          if (m.role === "OWNER") continue; // Never suspend owner
          const decisionAction = memberDecisionsMap.get(String(m._id)) || memberDecisionsMap.get(String(m.userId));
          if (decisionAction === "suspend" || (memberDecisionsMap.size === 0 && activeMembers.indexOf(m) >= targetLimits.maxMembers)) {
            await ctx.db.patch(m._id, {
              status: "INACTIVE",
              updatedAt: now,
            });
            suspendedMemberCount++;
            await ctx.db.insert("auditLogs", {
              organizationId: sub.organizationId,
              workspaceId: sub.workspaceId,
              action: "billing.resource_restricted_for_downgrade",
              resource: `membership:${m._id}`,
              severity: "info",
              metadata: { membershipId: m._id, userId: m.userId },
              timestamp: now,
              createdAt: now,
            });
          }
        }

        // Update subscription record to Standard
        const prevPlan = sub.planKey || sub.activePlan || "premium";
        await ctx.db.patch(sub._id, {
          planKey: targetPlan,
          selectedPlan: targetPlan,
          activePlan: targetPlan,
          status: "active",
          amount: 7500,
          pendingPlan: undefined,
          pendingPlanKey: undefined,
          pendingBillingInterval: undefined,
          changeEffectiveAt: undefined,
          downgradeStatus: "applied",
          downgradeResourceDecisions: undefined,
          cancelAtPeriodEnd: false,
          updatedAt: now,
        });

        // Update workspaceEntitlements to Standard limits
        const targetWsOrOrgId = sub.workspaceId || sub.organizationId;
        if (targetWsOrOrgId) {
          const ents = await ctx.db
            .query("workspaceEntitlements")
            .withIndex("by_workspace", (q: any) => q.eq("workspaceId", targetWsOrOrgId))
            .collect();

          for (const ent of ents) {
            if (ent.featureKey === "branches") {
              await ctx.db.patch(ent._id, { limitValue: targetLimits.maxBranches, planId: targetPlan, status: "active", updatedAt: now });
            } else if (ent.featureKey === "members") {
              await ctx.db.patch(ent._id, { limitValue: targetLimits.maxMembers, planId: targetPlan, status: "active", updatedAt: now });
            } else if (ent.featureKey === "products") {
              await ctx.db.patch(ent._id, { limitValue: targetLimits.maxProducts, planId: targetPlan, status: "active", updatedAt: now });
            } else if (ent.featureKey === "monthly_transactions") {
              await ctx.db.patch(ent._id, { limitValue: targetLimits.maxTransactions, planId: targetPlan, status: "active", updatedAt: now });
            }
          }
        }

        await ctx.db.insert("subscriptionHistory", {
          subscriptionId: sub._id,
          workspaceId: targetWsOrOrgId,
          fromPlanKey: prevPlan,
          toPlanKey: targetPlan,
          fromStatus: sub.status,
          toStatus: "active",
          reason: "Scheduled downgrade to Standard applied at billing period end",
          createdAt: now,
        });

        await ctx.db.insert("auditLogs", {
          organizationId: sub.organizationId,
          workspaceId: sub.workspaceId,
          action: "billing.downgrade_applied",
          resource: `subscription:${sub._id}`,
          severity: "info",
          metadata: {
            previousPlan: prevPlan,
            targetPlan,
            archivedBranches: archivedBranchCount,
            suspendedMembers: suspendedMemberCount,
          },
          timestamp: now,
          createdAt: now,
        });

        await ctx.db.insert("auditLogs", {
          organizationId: sub.organizationId,
          workspaceId: sub.workspaceId,
          action: "billing.entitlements_recalculated",
          resource: `workspace:${targetWsOrOrgId}`,
          severity: "info",
          metadata: { planKey: targetPlan, limits: targetLimits },
          timestamp: now,
          createdAt: now,
        });

        // Deduplicated notification
        const ownerUserId = sub.userId || (sub.organizationId ? (await ctx.db.get(sub.organizationId) as any)?.ownerId : null);
        if (ownerUserId) {
          const dedupKey = `billing:${targetWsOrOrgId}:downgrade_applied:${now}`;
          await ctx.db.insert("notifications", {
            userId: ownerUserId,
            workspaceId: sub.workspaceId,
            type: dedupKey,
            title: "Plan Downgraded to Standard",
            body: "Your subscription has transitioned to the Standard plan. All historical business records remain fully preserved.",
            severity: "INFO",
            channel: "IN_APP",
            status: "UNREAD",
            createdAt: now,
          });
        }

        appliedCount++;
      } else if (isCancellationDue) {
        // 2. Process Scheduled Cancellation at Period End -> Expired & Restricted
        const prevStatus = sub.status;
        await ctx.db.patch(sub._id, {
          status: "expired",
          activePlan: null,
          entitlementStatus: "restricted",
          updatedAt: now,
        });

        const targetWsOrOrgId = sub.workspaceId || sub.organizationId;
        if (targetWsOrOrgId) {
          const ents = await ctx.db
            .query("workspaceEntitlements")
            .withIndex("by_workspace", (q: any) => q.eq("workspaceId", targetWsOrOrgId))
            .collect();

          for (const ent of ents) {
            await ctx.db.patch(ent._id, {
              status: "restricted",
              updatedAt: now,
            });
          }
        }

        await ctx.db.insert("subscriptionHistory", {
          subscriptionId: sub._id,
          workspaceId: targetWsOrOrgId,
          fromStatus: prevStatus,
          toStatus: "expired",
          fromPlanKey: sub.planKey,
          toPlanKey: sub.planKey,
          reason: sub.cancelReason || "Subscription cancelled at period end expired",
          createdAt: now,
        });

        await ctx.db.insert("auditLogs", {
          organizationId: sub.organizationId,
          workspaceId: sub.workspaceId,
          action: "billing.cancellation_applied",
          resource: `subscription:${sub._id}`,
          severity: "warning",
          metadata: { previousStatus: prevStatus, newStatus: "expired" },
          timestamp: now,
          createdAt: now,
        });

        await ctx.db.insert("auditLogs", {
          organizationId: sub.organizationId,
          workspaceId: sub.workspaceId,
          action: "billing.subscription_expired",
          resource: `subscription:${sub._id}`,
          severity: "warning",
          metadata: { expiredAt: now },
          timestamp: now,
          createdAt: now,
        });

        const ownerUserId = sub.userId || (sub.organizationId ? (await ctx.db.get(sub.organizationId) as any)?.ownerId : null);
        if (ownerUserId) {
          const dedupKey = `billing:${targetWsOrOrgId}:subscription_expired:${now}`;
          await ctx.db.insert("notifications", {
            userId: ownerUserId,
            workspaceId: sub.workspaceId,
            type: dedupKey,
            title: "Subscription Expired",
            body: "Your subscription period has ended and access is now restricted. All customer and business records are preserved. You can upgrade anytime to reactivate.",
            severity: "WARNING",
            channel: "IN_APP",
            status: "UNREAD",
            createdAt: now,
          });
        }

        appliedCount++;
      }
    }

    return { success: true, processedCount: appliedCount };
  },
});

// Alias for hourly cron
export const applyPendingDowngrades = applyScheduledBillingChanges;

/**
 * Query: Calculate resource conflicts when downgrading an organization (strictly Premium -> Standard)
 */
export const calculateDowngradeConflicts = query({
  args: {
    organizationId: v.union(v.id("organizations"), v.id("workspaces"), v.string()),
    targetPlanKey: v.optional(v.string()), // must be "standard"
  },
  handler: async (ctx, args) => {
    const { org, orgId, workspace, workspaceId } = await resolveOrganization(ctx, args.organizationId);
    const targetOrgId = orgId || org?._id;
    const targetWsId = workspaceId || workspace?._id;

    // 1. Resolve current subscription
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

    const currentPlan = (sub?.activePlan || sub?.planKey || "free_trial").toLowerCase();
    const requestedTarget = (args.targetPlanKey || "standard").toLowerCase();

    // Enforce Authoritative Plan Model Rules
    if (requestedTarget === "free" || requestedTarget === "free_trial" || requestedTarget === "trial") {
      throw new Error("FREE_TRIAL_NOT_DOWNGRADE_DESTINATION: Free Trial is a one-time onboarding entitlement, not a downgrade destination. The only supported downgrade is Premium to Standard.");
    }
    if (requestedTarget !== "standard") {
      throw new Error(`INVALID_DOWNGRADE_TARGET: Cannot downgrade to "${requestedTarget}". The only supported downgrade is Premium to Standard.`);
    }
    if (currentPlan !== "premium") {
      throw new Error(`STANDARD_CANNOT_DOWNGRADE: Current plan is "${currentPlan}". Standard plan cannot be downgraded. To end a paid subscription, use cancellation instead.`);
    }

    // Standard limits
    const standardLimits = {
      maxOrganizations: 3,
      maxAppsPerOrganization: 3,
      maxBranches: 3,
      maxMembers: 10,
      maxProducts: 5000,
      maxTransactions: 5000,
    };

    // 2. Fetch branches
    let branches: any[] = [];
    if (targetOrgId) {
      branches = await ctx.db
        .query("branches")
        .withIndex("by_organizationId", (q: any) => q.eq("organizationId", targetOrgId))
        .filter((q: any) => q.neq(q.field("status"), "deleted") && q.neq(q.field("status"), "ARCHIVED") && q.neq(q.field("status"), "archived"))
        .collect();
    } else if (targetWsId) {
      branches = await ctx.db
        .query("branches")
        .withIndex("by_workspace", (q: any) => q.eq("workspaceId", targetWsId))
        .filter((q: any) => q.neq(q.field("status"), "deleted") && q.neq(q.field("status"), "ARCHIVED") && q.neq(q.field("status"), "archived"))
        .collect();
    }

    // 3. Fetch members
    let members: any[] = [];
    if (targetOrgId) {
      members = await ctx.db
        .query("organizationMemberships")
        .withIndex("by_organizationId", (q: any) => q.eq("organizationId", targetOrgId))
        .filter((q: any) => q.eq(q.field("status"), "ACTIVE"))
        .collect();
    } else if (targetWsId) {
      members = await ctx.db
        .query("workspaceMemberships")
        .withIndex("by_workspace", (q: any) => q.eq("workspaceId", targetWsId))
        .filter((q: any) => q.eq(q.field("status"), "active"))
        .collect();
    }

    const memberDetails = [];
    for (const m of members) {
      const user: any = await ctx.db.get(m.userId);
      memberDetails.push({
        id: m._id,
        userId: m.userId,
        name: user?.name || "Member",
        email: user?.email || "",
        role: m.role,
      });
    }

    // 4. Fetch products
    let productCount = 0;
    if (targetWsId) {
      const prods = await (ctx.db as any)
        .query("products")
        .withIndex("by_workspace", (q: any) => q.eq("workspaceId", targetWsId))
        .collect();
      productCount = prods.length;
    }

    // 5. Calculate conflicts
    const conflicts: any[] = [];

    const excessBranches = Math.max(0, branches.length - standardLimits.maxBranches);
    if (excessBranches > 0) {
      conflicts.push({
        type: "branches",
        current: branches.length,
        allowed: standardLimits.maxBranches,
        excess: excessBranches,
        action: "archive_or_retain_restricted",
        description: `Your organization currently has ${branches.length} active branches. Standard plan allows up to ${standardLimits.maxBranches} branches. Please choose ${excessBranches} branch(es) to archive.`,
      });
    }

    const excessMembers = Math.max(0, members.length - standardLimits.maxMembers);
    if (excessMembers > 0) {
      conflicts.push({
        type: "members",
        current: members.length,
        allowed: standardLimits.maxMembers,
        excess: excessMembers,
        action: "remove_or_suspend_access",
        description: `Your organization currently has ${members.length} team members. Standard plan allows up to ${standardLimits.maxMembers} members. Please choose ${excessMembers} member(s) to suspend.`,
      });
    }

    if (productCount > standardLimits.maxProducts) {
      conflicts.push({
        type: "products",
        current: productCount,
        allowed: standardLimits.maxProducts,
        excess: productCount - standardLimits.maxProducts,
        action: "retain_restricted",
        description: `Existing ${productCount} products will be preserved in read-only mode for items exceeding the 5,000 product limit.`,
      });
    }

    const effectiveAt = sub?.currentPeriodEnd || (Date.now() + 30 * 86_400_000);
    const hasConflicts = conflicts.length > 0;

    return {
      canSchedule: true,
      currentPlan: "premium",
      targetPlan: "standard",
      effectiveAt,
      hasConflicts,
      targetLimits: standardLimits,
      currentCounts: {
        branches: branches.length,
        members: members.length,
        products: productCount,
      },
      excess: {
        branches: excessBranches,
        members: excessMembers,
      },
      conflicts,
      branches: branches.map((b) => ({
        id: b._id,
        name: b.name,
        code: b.code || "MAIN",
        isPrimary: Boolean(b.isPrimary),
      })),
      members: memberDetails,
      dataPreservationNotice: "Data is never deleted automatically. Excess branches are safely archived and excess members are set to inactive. All sales, purchase, and stock history remain fully preserved.",
    };
  },
});

/**
 * Mutation: Schedule Downgrade (Premium -> Standard) with explicit resource decisions
 */
export const scheduleDowngrade = mutation({
  args: {
    organizationId: v.optional(v.union(v.id("organizations"), v.id("workspaces"), v.string())),
    workspaceId: v.optional(v.union(v.id("workspaces"), v.id("organizations"), v.string())),
    userId: v.union(v.id("users"), v.string()),
    targetPlan: v.optional(v.string()), // "standard"
    targetPlanKey: v.optional(v.string()), // "standard"
    effectiveAt: v.optional(v.number()),
    resourceDecisions: v.optional(
      v.array(
        v.object({
          resourceType: v.string(), // "branch" | "member"
          resourceId: v.string(),
          action: v.string(), // "archive" | "suspend" | "keep_active"
        })
      )
    ),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const targetRef = args.workspaceId || args.organizationId;
    if (!targetRef) throw new Error("WORKSPACE_OR_ORGANIZATION_REQUIRED");

    const { org, orgId, workspace, workspaceId } = await resolveOrganization(ctx, String(targetRef));
    const targetOrgId = orgId || org?._id;
    const targetWsId = workspaceId || workspace?._id;

    // 1. Verify caller billing permissions
    const callerId = String(args.userId);
    let isOwnerOrAdmin = false;

    if (targetOrgId) {
      const orgDoc: any = await ctx.db.get(targetOrgId);
      if (orgDoc && String(orgDoc.ownerId) === callerId) isOwnerOrAdmin = true;
      if (!isOwnerOrAdmin) {
        const mem = await ctx.db
          .query("organizationMemberships")
          .withIndex("by_organizationId", (q: any) => q.eq("organizationId", targetOrgId))
          .filter((q: any) => q.eq(q.field("userId"), callerId as any))
          .first();
        if (mem && (mem.role === "OWNER" || mem.role === "ADMIN")) isOwnerOrAdmin = true;
      }
    }
    if (!isOwnerOrAdmin && targetWsId) {
      const wsDoc: any = await ctx.db.get(targetWsId);
      if (wsDoc && String(wsDoc.ownerId) === callerId) isOwnerOrAdmin = true;
      if (!isOwnerOrAdmin) {
        const wsMem = await ctx.db
          .query("workspaceMemberships")
          .withIndex("by_workspace", (q: any) => q.eq("workspaceId", targetWsId))
          .filter((q: any) => q.eq(q.field("userId"), callerId as any))
          .first();
        if (wsMem && (wsMem.role === "OWNER" || wsMem.role === "ADMIN")) isOwnerOrAdmin = true;
      }
    }

    if (!isOwnerOrAdmin) {
      throw new Error("BILLING_PERMISSION_DENIED: Only organization owners and billing managers can manage subscription downgrades.");
    }

    // 2. Fetch subscription
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

    if (!sub) throw new Error("SUBSCRIPTION_NOT_FOUND");

    const currentPlan = (sub.activePlan || sub.planKey || "").toLowerCase();
    const targetPlan = (args.targetPlan || args.targetPlanKey || "standard").toLowerCase();

    if (targetPlan === "free" || targetPlan === "free_trial" || targetPlan === "trial") {
      throw new Error("FREE_TRIAL_NOT_DOWNGRADE_DESTINATION: Free Trial cannot be scheduled as a downgrade destination. The only supported downgrade is Premium to Standard.");
    }
    if (targetPlan !== "standard") {
      throw new Error(`INVALID_DOWNGRADE_TARGET: "${targetPlan}" is not a valid downgrade target. Only Premium to Standard downgrade is supported.`);
    }
    if (currentPlan !== "premium") {
      throw new Error(`STANDARD_CANNOT_DOWNGRADE: Current plan is "${currentPlan}". Only Premium plan can be scheduled for downgrade to Standard.`);
    }

    const now = Date.now();
    const effectiveDate = args.effectiveAt || sub.currentPeriodEnd || (now + 30 * 86_400_000);
    const sanitizedDecisions = args.resourceDecisions || [];

    // Schedule downgrade without immediate loss of access
    await ctx.db.patch(sub._id, {
      pendingPlan: "standard",
      pendingPlanKey: "standard",
      changeEffectiveAt: effectiveDate,
      downgradeRequestedAt: now,
      downgradeRequestedBy: args.userId as any,
      downgradeReason: args.reason,
      downgradeStatus: "scheduled",
      downgradeResourceDecisions: sanitizedDecisions,
      updatedAt: now,
    });

    await ctx.db.insert("subscriptionHistory", {
      subscriptionId: sub._id,
      workspaceId: targetWsId || targetOrgId,
      fromPlanKey: currentPlan,
      toPlanKey: "standard",
      fromStatus: sub.status,
      toStatus: sub.status,
      actorUserId: callerId,
      reason: args.reason || "Scheduled downgrade from Premium to Standard at period end",
      metadata: { effectiveDate, decisions: sanitizedDecisions },
      createdAt: now,
    });

    await ctx.db.insert("auditLogs", {
      actorId: callerId,
      actorUserId: callerId,
      organizationId: targetOrgId,
      workspaceId: targetWsId,
      action: "billing.downgrade_scheduled",
      resource: `subscription:${sub._id}`,
      severity: "warning",
      metadata: {
        currentPlan,
        targetPlan: "standard",
        effectiveAt: effectiveDate,
        resourceDecisions: sanitizedDecisions,
        reason: args.reason,
      },
      timestamp: now,
      createdAt: now,
    });

    // Deduplicated notification
    const dedupKey = `billing:${targetWsId || targetOrgId}:downgrade_scheduled:${effectiveDate}`;
    await ctx.db.insert("notifications", {
      userId: args.userId as any,
      workspaceId: targetWsId,
      type: dedupKey,
      title: "Downgrade Scheduled",
      body: `Your organization's downgrade to Standard has been scheduled for ${new Date(effectiveDate).toLocaleDateString()}. Your Premium features remain fully active until then.`,
      severity: "INFO",
      channel: "IN_APP",
      status: "UNREAD",
      createdAt: now,
    });

    return {
      success: true,
      subscriptionId: sub._id,
      currentPlan: "premium",
      targetPlan: "standard",
      effectiveAt: effectiveDate,
      downgradeStatus: "scheduled",
      resourceDecisions: sanitizedDecisions,
    };
  },
});

// Alias for legacy conflict resolution signature
export const scheduleDowngradeWithConflictResolution = scheduleDowngrade;

/**
 * Mutation: Cancel a scheduled downgrade before it becomes effective
 */
export const cancelScheduledDowngrade = mutation({
  args: {
    organizationId: v.optional(v.union(v.id("organizations"), v.id("workspaces"), v.string())),
    workspaceId: v.optional(v.union(v.id("workspaces"), v.id("organizations"), v.string())),
    userId: v.optional(v.union(v.id("users"), v.string())),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const targetRef = args.workspaceId || args.organizationId;
    if (!targetRef) throw new Error("WORKSPACE_OR_ORGANIZATION_REQUIRED");

    const { org, orgId, workspace, workspaceId } = await resolveOrganization(ctx, String(targetRef));
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

    if (!sub) throw new Error("SUBSCRIPTION_NOT_FOUND");

    if (sub.downgradeStatus !== "scheduled" && !sub.pendingPlanKey && !sub.pendingPlan) {
      throw new Error("NO_SCHEDULED_DOWNGRADE: There is no scheduled downgrade pending for this organization.");
    }

    const now = Date.now();
    const previousPending = sub.pendingPlan || sub.pendingPlanKey || "standard";

    await ctx.db.patch(sub._id, {
      pendingPlan: undefined,
      pendingPlanKey: undefined,
      pendingBillingInterval: undefined,
      changeEffectiveAt: undefined,
      downgradeStatus: "cancelled",
      downgradeResourceDecisions: undefined,
      updatedAt: now,
    });

    await ctx.db.insert("subscriptionHistory", {
      subscriptionId: sub._id,
      workspaceId: targetWsId || targetOrgId,
      fromPlanKey: previousPending,
      toPlanKey: sub.planKey,
      fromStatus: sub.status,
      toStatus: sub.status,
      actorUserId: args.userId ? String(args.userId) : undefined,
      reason: args.reason || "User cancelled scheduled downgrade",
      createdAt: now,
    });

    await ctx.db.insert("auditLogs", {
      actorId: args.userId ? String(args.userId) : undefined,
      actorUserId: args.userId ? String(args.userId) : undefined,
      organizationId: targetOrgId,
      workspaceId: targetWsId,
      action: "billing.downgrade_cancelled",
      resource: `subscription:${sub._id}`,
      severity: "info",
      metadata: {
        retainedPlan: sub.planKey,
        cancelledPendingPlan: previousPending,
        reason: args.reason,
      },
      timestamp: now,
      createdAt: now,
    });

    return {
      success: true,
      subscriptionId: sub._id,
      activePlan: sub.activePlan || sub.planKey,
      downgradeStatus: "cancelled",
    };
  },
});

/**
 * Query: Get Scheduled Downgrade Details
 */
export const getScheduledDowngrade = query({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
  },
  handler: async (ctx, args) => {
    const { org, orgId, workspace, workspaceId } = await resolveOrganization(ctx, args.workspaceId);
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

    if (!sub) return null;

    const isScheduled = sub.downgradeStatus === "scheduled" || Boolean(sub.pendingPlan || sub.pendingPlanKey);
    return {
      isScheduled,
      currentPlan: sub.activePlan || sub.planKey,
      targetPlan: sub.pendingPlan || sub.pendingPlanKey || null,
      effectiveAt: sub.changeEffectiveAt || sub.currentPeriodEnd || null,
      downgradeStatus: sub.downgradeStatus || (isScheduled ? "scheduled" : "not_requested"),
      downgradeRequestedAt: sub.downgradeRequestedAt || null,
      downgradeReason: sub.downgradeReason || null,
      resourceDecisions: sub.downgradeResourceDecisions || [],
    };
  },
});

/**
 * Query: Get Cancellation Details
 */
export const getCancellationStatus = query({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
  },
  handler: async (ctx, args) => {
    const { org, orgId, workspace, workspaceId } = await resolveOrganization(ctx, args.workspaceId);
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

    if (!sub) return null;

    return {
      cancelAtPeriodEnd: Boolean(sub.cancelAtPeriodEnd),
      status: sub.status,
      cancellationRequestedAt: sub.cancellationRequestedAt || sub.cancelledAt || null,
      cancellationRequestedBy: sub.cancellationRequestedBy || null,
      cancellationEffectiveAt: sub.cancellationEffectiveAt || sub.currentPeriodEnd || null,
      cancelReason: sub.cancelReason || null,
      currentPeriodEnd: sub.currentPeriodEnd,
    };
  },
});

/**
 * Mutation: Resume a subscription that was previously cancelled at period end
 */
export const resumeCancelledSubscription = mutation({
  args: {
    organizationId: v.optional(v.union(v.id("organizations"), v.id("workspaces"), v.string())),
    workspaceId: v.optional(v.union(v.id("workspaces"), v.id("organizations"), v.string())),
    userId: v.optional(v.union(v.id("users"), v.string())),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const targetRef = args.organizationId || args.workspaceId;
    if (!targetRef) throw new Error("WORKSPACE_OR_ORGANIZATION_REQUIRED");

    const { org, orgId, workspace, workspaceId } = await resolveOrganization(ctx, String(targetRef));
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

    if (!sub) throw new Error("SUBSCRIPTION_NOT_FOUND");

    const now = Date.now();
    await ctx.db.patch(sub._id, {
      cancelAtPeriodEnd: false,
      cancelReason: undefined,
      cancelledAt: undefined,
      cancellationRequestedAt: undefined,
      cancellationRequestedBy: undefined,
      cancellationEffectiveAt: undefined,
      status: "active",
      updatedAt: now,
    });

    await ctx.db.insert("subscriptionHistory", {
      subscriptionId: sub._id,
      workspaceId: targetWsId || targetOrgId,
      fromStatus: sub.status,
      toStatus: "active",
      fromPlanKey: sub.planKey,
      toPlanKey: sub.planKey,
      actorUserId: args.userId ? String(args.userId) : undefined,
      reason: args.reason || "User reverted subscription cancellation",
      createdAt: now,
    });

    await ctx.db.insert("auditLogs", {
      actorId: args.userId ? String(args.userId) : undefined,
      actorUserId: args.userId ? String(args.userId) : undefined,
      organizationId: targetOrgId,
      workspaceId: targetWsId,
      action: "billing.subscription_resumed",
      resource: `subscription:${sub._id}`,
      severity: "info",
      metadata: { resumedAt: now, reason: args.reason },
      timestamp: now,
      createdAt: now,
    });

    await ctx.db.insert("auditLogs", {
      actorId: args.userId ? String(args.userId) : undefined,
      actorUserId: args.userId ? String(args.userId) : undefined,
      organizationId: targetOrgId,
      workspaceId: targetWsId,
      action: "billing.cancellation_cancelled",
      resource: `subscription:${sub._id}`,
      severity: "info",
      metadata: { resumedAt: now },
      timestamp: now,
      createdAt: now,
    });

    return { success: true, subscriptionId: sub._id, status: "active", cancelAtPeriodEnd: false };
  },
});

/**
 * Mutation: Cancel subscription at current period end
 */
export const cancelSubscription = mutation({
  args: {
    workspaceId: v.optional(v.union(v.id("workspaces"), v.id("organizations"), v.string())),
    organizationId: v.optional(v.union(v.id("organizations"), v.id("workspaces"), v.string())),
    userId: v.optional(v.union(v.id("users"), v.string())),
    reason: v.optional(v.string()),
    cancelAtPeriodEnd: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const targetRef = args.workspaceId || args.organizationId;
    if (!targetRef) throw new Error("WORKSPACE_OR_ORGANIZATION_ID_REQUIRED");
    const { org, orgId, workspace, workspaceId } = await resolveOrganization(ctx, String(targetRef));
    const targetOrgId = orgId || org?._id;
    const targetWsId = workspaceId || workspace?._id;

    // Verify caller billing permissions
    const callerId = String(args.userId || "");
    let isOwnerOrAdmin = !callerId; // If internal/system call

    if (callerId && targetOrgId) {
      const orgDoc: any = await ctx.db.get(targetOrgId);
      if (orgDoc && String(orgDoc.ownerId) === callerId) isOwnerOrAdmin = true;
      if (!isOwnerOrAdmin) {
        const mem = await ctx.db
          .query("organizationMemberships")
          .withIndex("by_organizationId", (q: any) => q.eq("organizationId", targetOrgId))
          .filter((q: any) => q.eq(q.field("userId"), callerId as any))
          .first();
        if (mem && (mem.role === "OWNER" || mem.role === "ADMIN")) isOwnerOrAdmin = true;
      }
    }
    if (callerId && !isOwnerOrAdmin && targetWsId) {
      const wsDoc: any = await ctx.db.get(targetWsId);
      if (wsDoc && String(wsDoc.ownerId) === callerId) isOwnerOrAdmin = true;
      if (!isOwnerOrAdmin) {
        const wsMem = await ctx.db
          .query("workspaceMemberships")
          .withIndex("by_workspace", (q: any) => q.eq("workspaceId", targetWsId))
          .filter((q: any) => q.eq(q.field("userId"), callerId as any))
          .first();
        if (wsMem && (wsMem.role === "OWNER" || wsMem.role === "ADMIN")) isOwnerOrAdmin = true;
      }
    }

    if (callerId && !isOwnerOrAdmin) {
      throw new Error("BILLING_PERMISSION_DENIED: Only organization owners and billing managers can cancel the subscription.");
    }

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
      throw new Error("SUBSCRIPTION_NOT_FOUND");
    }

    const now = Date.now();
    await ctx.db.patch(sub._id, {
      cancelAtPeriodEnd: true,
      cancelReason: args.reason,
      cancelledAt: now,
      cancellationRequestedAt: now,
      cancellationRequestedBy: args.userId as any,
      cancellationEffectiveAt: sub.currentPeriodEnd,
      updatedAt: now,
    });

    await ctx.db.insert("subscriptionHistory", {
      subscriptionId: sub._id,
      workspaceId: targetWsId || targetOrgId,
      fromStatus: sub.status,
      toStatus: sub.status,
      fromPlanKey: sub.planKey,
      toPlanKey: sub.planKey,
      actorUserId: callerId || undefined,
      reason: args.reason || "User requested cancellation at period end",
      createdAt: now,
    });

    await ctx.db.insert("auditLogs", {
      actorId: callerId || undefined,
      actorUserId: callerId || undefined,
      organizationId: targetOrgId,
      workspaceId: targetWsId,
      action: "billing.cancellation_requested",
      resource: `subscription:${sub._id}`,
      severity: "warning",
      metadata: { reason: args.reason, periodEnd: sub.currentPeriodEnd },
      timestamp: now,
      createdAt: now,
    });

    await ctx.db.insert("auditLogs", {
      actorId: callerId || undefined,
      actorUserId: callerId || undefined,
      organizationId: targetOrgId,
      workspaceId: targetWsId,
      action: "billing.cancellation_scheduled",
      resource: `subscription:${sub._id}`,
      severity: "warning",
      metadata: { reason: args.reason, effectiveAt: sub.currentPeriodEnd },
      timestamp: now,
      createdAt: now,
    });

    const dedupKey = `billing:${targetWsId || targetOrgId}:cancellation_scheduled:${sub.currentPeriodEnd}`;
    if (callerId) {
      await ctx.db.insert("notifications", {
        userId: callerId as any,
        workspaceId: targetWsId,
        type: dedupKey,
        title: "Cancellation Scheduled",
        body: `Your subscription has been scheduled for cancellation on ${new Date(sub.currentPeriodEnd).toLocaleDateString()}. Paid access remains active until that date.`,
        severity: "WARNING",
        channel: "IN_APP",
        status: "UNREAD",
        createdAt: now,
      });
    }

    return {
      success: true,
      subscriptionId: sub._id,
      cancelAtPeriodEnd: true,
      currentPeriodEnd: sub.currentPeriodEnd,
      cancellationEffectiveAt: sub.currentPeriodEnd,
    };
  },
});

export const resumeSubscription = resumeCancelledSubscription;

/**
 * Query: Get Authoritative Workspace Trial Details
 */
export const getWorkspaceTrial = query({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
  },
  handler: async (ctx, args) => {
    const { org, orgId, workspace, workspaceId } = await resolveOrganization(ctx, args.workspaceId);
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

    if (!sub) {
      return null;
    }

    const now = Date.now();
    const trialStart = sub.trialStart || sub.createdAt || now;
    const trialEnd = sub.trialEnd || sub.trialEndsAt || (trialStart + 30 * 86_400_000);
    const isFreeTrial = sub.planKey === "free_trial" || sub.trialOrigin === "free_trial";

    const msRemaining = Math.max(trialEnd - now, 0);
    const daysRemaining = Math.ceil(msRemaining / (24 * 60 * 60 * 1000));
    const hoursRemaining = Math.ceil(msRemaining / (60 * 60 * 1000));

    let status = sub.trialStatus || (sub.status === "trialing" || sub.status === "trial" ? "active" : sub.status);
    if (sub.status === "active" && sub.planKey !== "free_trial") {
      status = "converted";
    } else if (now >= trialEnd) {
      status = "expired";
    } else if (daysRemaining <= 7) {
      status = "ending";
    }

    return {
      isFreeTrial,
      status,
      planKey: sub.planKey,
      trialStart,
      trialEnd,
      trialEndsAt: trialEnd,
      daysRemaining,
      hoursRemaining,
      trialOrigin: sub.trialOrigin || "free_trial",
      trialEligibleAtCreation: sub.trialEligibleAtCreation ?? true,
      trialConvertedAt: sub.trialConvertedAt,
      trialExpiredAt: sub.trialExpiredAt,
      extensionDays: sub.trialExtensionDays,
      extensionReason: sub.trialExtensionReason,
      extendedAt: sub.extendedAt,
      isExpired: now >= trialEnd && status !== "converted",
      isWarning: daysRemaining <= 7 && now < trialEnd,
      upgradeOptions: ["standard", "premium"],
      limits: {
        branches: 1,
        members: 2,
        products: 500,
        monthly_transactions: 300,
        inventory: true,
        basic_reports: true,
        advanced_reports: false,
        api_access: false,
        custom_roles: false,
        advanced_exports: false,
      },
    };
  },
});

/**
 * Mutation: Reconcile Workspace Trial Lifecycle & Warning Notifications
 */
export const reconcileTrialSubscription = mutation({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
    actorUserId: v.optional(v.union(v.id("users"), v.string())),
  },
  handler: async (ctx, args) => {
    const { org, orgId, workspace, workspaceId } = await resolveOrganization(ctx, args.workspaceId);
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

    if (!sub) {
      throw new Error("SUBSCRIPTION_NOT_FOUND");
    }

    const now = Date.now();
    const trialStart = sub.trialStart || sub.createdAt || now;
    const trialEnd = sub.trialEnd || sub.trialEndsAt || (trialStart + 30 * 86_400_000);
    const isFreeTrial = sub.planKey === "free_trial" || sub.trialOrigin === "free_trial";

    // If already converted to a paid plan, retain converted status
    if (sub.status === "active" && sub.planKey !== "free_trial") {
      return {
        status: "converted",
        activePlan: sub.planKey,
        trialStatus: "converted",
        trialEnd,
        isExpired: false,
      };
    }

    const msRemaining = Math.max(trialEnd - now, 0);
    const daysRemaining = Math.ceil(msRemaining / (24 * 60 * 60 * 1000));
    const hoursRemaining = Math.ceil(msRemaining / (60 * 60 * 1000));
    const ownerUserId = org?.ownerId || sub.userId;

    let newTrialStatus = "active";
    let newSubStatus = sub.status;
    let notificationEvent: string | null = null;
    let notificationTitle = "";
    let notificationBody = "";

    if (now >= trialEnd) {
      newTrialStatus = "expired";
      newSubStatus = "expired";
      notificationEvent = "trial_expired";
      notificationTitle = "Free Trial Expired";
      notificationBody = "Your 30-day Free Trial has ended. Your data is preserved. Upgrade to Standard or Premium to continue.";

      // Restrict entitlements upon expiration
      const existingEnts = await ctx.db
        .query("workspaceEntitlements")
        .withIndex("by_workspace", (q: any) => q.eq("workspaceId", targetWsId || targetOrgId))
        .collect();

      for (const ent of existingEnts) {
        if (ent.status !== "restricted") {
          await ctx.db.patch(ent._id, {
            status: "restricted",
            updatedAt: now,
          });
        }
      }

      await ctx.db.patch(sub._id, {
        trialStatus: "expired",
        status: "expired",
        trialExpiredAt: now,
        updatedAt: now,
      });

      await ctx.db.insert("subscriptionHistory", {
        subscriptionId: sub._id,
        workspaceId: targetWsId || targetOrgId,
        fromStatus: sub.status,
        toStatus: "expired",
        fromPlanKey: sub.planKey,
        toPlanKey: sub.planKey,
        actorUserId: args.actorUserId ? String(args.actorUserId) : "system",
        reason: "Trial duration of 30 days elapsed",
        createdAt: now,
      });
    } else if (daysRemaining <= 1) {
      newTrialStatus = "ending";
      notificationEvent = "trial_warning_1_day";
      notificationTitle = "1 Day Remaining on Free Trial";
      notificationBody = "Your Free Trial expires in 1 day. Upgrade to Standard or Premium to prevent service interruption.";
      await ctx.db.patch(sub._id, { trialStatus: "ending", updatedAt: now });
    } else if (daysRemaining <= 3) {
      newTrialStatus = "ending";
      notificationEvent = "trial_warning_3_days";
      notificationTitle = "3 Days Remaining on Free Trial";
      notificationBody = "Your Free Trial expires in 3 days. Upgrade your organization plan to keep full functionality.";
      await ctx.db.patch(sub._id, { trialStatus: "ending", updatedAt: now });
    } else if (daysRemaining <= 7) {
      newTrialStatus = "ending";
      notificationEvent = "trial_warning_7_days";
      notificationTitle = "7 Days Remaining on Free Trial";
      notificationBody = "Your Free Trial expires in 7 days. Plan your upgrade to Standard or Premium today.";
      await ctx.db.patch(sub._id, { trialStatus: "ending", updatedAt: now });
    }

    // Deduplicated Notification Dispatch
    if (notificationEvent && ownerUserId) {
      const dedupKey = `trial:${targetWsId || targetOrgId}:${notificationEvent}:${trialEnd}`;
      const existingNotif = await ctx.db
        .query("notifications")
        .withIndex("by_userId", (q: any) => q.eq("userId", ownerUserId))
        .filter((q: any) => q.eq(q.field("type"), dedupKey))
        .first();

      if (!existingNotif) {
        await ctx.db.insert("notifications", {
          userId: ownerUserId,
          workspaceId: targetWsId,
          type: dedupKey,
          title: notificationTitle,
          body: notificationBody,
          severity: newTrialStatus === "expired" ? "ERROR" : "WARNING",
          channel: "IN_APP",
          status: "UNREAD",
          createdAt: now,
        });

        await ctx.db.insert("auditLogs", {
          actorId: args.actorUserId || "system",
          actorUserId: args.actorUserId || "system",
          organizationId: targetOrgId,
          action: `billing.${notificationEvent}`,
          resource: `subscription:${sub._id}`,
          severity: newTrialStatus === "expired" ? "warning" : "info",
          metadata: {
            workspaceId: targetWsId || targetOrgId,
            trialEnd,
            daysRemaining,
            notificationEvent,
          },
          timestamp: now,
        });
      }
    }

    return {
      success: true,
      trialStatus: newTrialStatus,
      status: newSubStatus,
      daysRemaining,
      hoursRemaining,
      trialEnd,
      isExpired: now >= trialEnd,
    };
  },
});

/**
 * Mutation: Superadmin Extend Trial
 */
export const extendTrialSubscription = mutation({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
    extensionDays: v.number(), // 7, 14, 30
    reason: v.string(),
    adminId: v.union(v.id("users"), v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.reason || args.reason.trim().length === 0) {
      throw new Error("TRIAL_EXTENSION_REASON_REQUIRED: A valid reason is required for trial extension.");
    }

    const { org, orgId, workspace, workspaceId } = await resolveOrganization(ctx, args.workspaceId);
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

    if (!sub) {
      throw new Error("SUBSCRIPTION_NOT_FOUND");
    }

    const now = Date.now();
    const previousTrialEnd = sub.trialEnd || sub.trialEndsAt || (now + 30 * 86_400_000);
    const baseTime = Math.max(previousTrialEnd, now);
    const newTrialEnd = baseTime + args.extensionDays * 86_400_000;

    await ctx.db.patch(sub._id, {
      trialEnd: newTrialEnd,
      trialEndsAt: newTrialEnd,
      trialStatus: "extended",
      status: "trialing",
      previousTrialEnd,
      trialExtensionDays: (sub.trialExtensionDays || 0) + args.extensionDays,
      trialExtensionReason: args.reason,
      extendedByAdminId: String(args.adminId),
      extendedAt: now,
      updatedAt: now,
    });

    // Re-enable entitlements if previously restricted
    const entitlements = await ctx.db
      .query("workspaceEntitlements")
      .withIndex("by_workspace", (q: any) => q.eq("workspaceId", targetWsId || targetOrgId))
      .collect();

    for (const ent of entitlements) {
      if (ent.status === "restricted" || ent.status === "expired") {
        await ctx.db.patch(ent._id, {
          status: "active",
          effectiveUntil: newTrialEnd,
          updatedAt: now,
        });
      }
    }

    await ctx.db.insert("subscriptionHistory", {
      subscriptionId: sub._id,
      workspaceId: targetWsId || targetOrgId,
      fromStatus: sub.status,
      toStatus: "trialing",
      fromPlanKey: sub.planKey,
      toPlanKey: sub.planKey,
      actorUserId: String(args.adminId),
      reason: `Superadmin extended trial by ${args.extensionDays} days: ${args.reason}`,
      createdAt: now,
    });

    await ctx.db.insert("auditLogs", {
      actorId: String(args.adminId),
      actorUserId: String(args.adminId),
      organizationId: targetOrgId,
      action: "billing.trial_extended",
      resource: `subscription:${sub._id}`,
      severity: "warning",
      metadata: {
        workspaceId: targetWsId || targetOrgId,
        extensionDays: args.extensionDays,
        reason: args.reason,
        previousTrialEnd,
        newTrialEnd,
      },
      timestamp: now,
    });

    const ownerUserId = org?.ownerId || sub.userId;
    if (ownerUserId) {
      await ctx.db.insert("notifications", {
        userId: ownerUserId,
        workspaceId: targetWsId,
        type: `trial:${targetWsId || targetOrgId}:extended:${now}`,
        title: "Free Trial Extended",
        body: `Your Free Trial has been extended by ${args.extensionDays} days by support. New end date: ${new Date(newTrialEnd).toLocaleDateString()}.`,
        severity: "INFO",
        channel: "IN_APP",
        status: "UNREAD",
        createdAt: now,
      });
    }

    return {
      success: true,
      trialEnd: newTrialEnd,
      extensionDays: args.extensionDays,
      trialStatus: "extended",
    };
  },
});

/**
 * Query: Get Trial History & Extension Logs
 */
export const getTrialHistory = query({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
  },
  handler: async (ctx, args) => {
    const { org, orgId, workspace, workspaceId } = await resolveOrganization(ctx, args.workspaceId);
    const targetWsId = workspaceId || workspace?._id || orgId || org?._id;

    const history = await ctx.db
      .query("subscriptionHistory")
      .withIndex("by_workspace", (q: any) => q.eq("workspaceId", targetWsId))
      .collect();

    return history.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/**
 * Query: Get Checkout Status by Reference
 */
export const getCheckoutStatus = query({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
    reference: v.string(),
  },
  handler: async (ctx, args) => {
    const payment = await ctx.db
      .query("payments")
      .withIndex("by_reference", (q: any) => q.eq("reference", args.reference))
      .first();

    const idempotency = await ctx.db
      .query("billingIdempotencyRecords")
      .withIndex("by_provider_reference", (q: any) => q.eq("providerReference", args.reference))
      .first();

    return {
      reference: args.reference,
      status: payment?.status || idempotency?.status || "pending",
      amount: payment?.amount,
      currency: payment?.currency || "NGN",
      completedAt: payment?.completedAt,
      idempotencyStatus: idempotency?.status,
    };
  },
});

/**
 * Mutation: Reconcile Billing State (Admin resolution of anomalies)
 */
export const reconcileBillingState = mutation({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
    adminId: v.optional(v.union(v.id("users"), v.string())),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const { org, orgId, workspace, workspaceId } = await resolveOrganization(ctx, args.workspaceId);
    const targetOrgId = orgId || org?._id;
    const targetWsId = workspaceId || workspace?._id;

    const latestPayment = await ctx.db
      .query("payments")
      .withIndex("by_workspace", (q: any) => q.eq("workspaceId", targetWsId || targetOrgId))
      .filter((q: any) => q.eq(q.field("status"), "success"))
      .order("desc")
      .first();

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
    let reconciled = false;

    if (latestPayment && sub && sub.status !== "active") {
      await ctx.db.patch(sub._id, {
        status: "active",
        checkoutStatus: "completed",
        paymentStatus: "success",
        activePlan: sub.selectedPlan || sub.planKey,
        trialStatus: "converted",
        trialConvertedAt: sub.trialConvertedAt || now,
        updatedAt: now,
      });
      reconciled = true;
    }

    await ctx.db.insert("auditLogs", {
      actorId: String(args.adminId || "system"),
      actorUserId: String(args.adminId || "system"),
      organizationId: targetOrgId,
      action: "billing.billing_reconciled",
      resource: `workspace:${targetWsId || targetOrgId}`,
      severity: "info",
      metadata: {
        reason: args.reason,
        reconciled,
        subscriptionId: sub?._id,
      },
      timestamp: now,
    });

    return {
      success: true,
      reconciled,
      workspaceId: targetWsId || targetOrgId,
    };
  },
});

