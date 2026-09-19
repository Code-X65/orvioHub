import { query, mutation } from "./_generated/server.js";
import { v } from "convex/values";
import { DEFAULT_PLANS } from "./plans.js";
import { resolveOrganization } from "./applications.js";

/**
 * Normalizes limits and feature flags from a plan definition
 */
export function getEntitlementsFromPlan(plan: any, isTrial: boolean) {
  const limits = plan?.limits || {};
  const maxApps = limits.maxAppsPerOrganization ?? limits.maxAppsPerWorkspace ?? limits.apps ?? 1;
  const maxBranches = limits.maxBranchesPerApp ?? limits.branches ?? 1;
  const maxOrgs = limits.maxOrganizations ?? limits.maxWorkspaces ?? limits.orgs ?? 1;
  const maxMembers = limits.maxMembersPerOrganization ?? limits.maxMembersPerWorkspace ?? limits.members ?? 2;
  const maxProducts = limits.maxProductsPerWorkspace ?? limits.products ?? 500;
  const maxTransactions = limits.maxTransactionsPerMonth ?? limits.transactions ?? 300;

  const rawKey = (plan?.key || (isTrial ? "free_trial" : "standard")).toLowerCase();
  const planKey = rawKey === "free" ? "free_trial" : rawKey;

  return {
    planKey,
    planName: plan?.name || (planKey === "premium" ? "Premium" : planKey === "standard" ? "Standard" : "Free Trial"),
    maxOrganizations: maxOrgs,
    maxWorkspaces: maxOrgs,
    maxApplications: maxApps,
    maxApplicationsPerWorkspace: maxApps,
    maxAppsPerOrganization: maxApps,
    maxAppsPerWorkspace: maxApps,
    maxBranchesPerApp: maxBranches,
    maxBranchesPerApplication: maxBranches,
    maxMembers: maxMembers,
    maxMembersPerOrganization: maxMembers,
    maxMembersPerWorkspace: maxMembers,
    maxProducts: maxProducts,
    maxProductsPerWorkspace: maxProducts,
    maxTransactions: maxTransactions,
    maxMonthlyTransactions: maxTransactions,
    allowedApps: plan?.allowedAppKeys || plan?.allowedApps || ["inventory"],
    basicReports: true,
    advancedReports: planKey === "premium" || planKey === "standard",
    apiAccess: planKey === "premium",
    customRoles: planKey === "premium",
    advancedExports: planKey === "premium" || planKey === "standard",
    isTrial,
  };
}

/**
 * Authoritative helper to fetch organization subscription and plan
 */
export async function getSubscriptionForWorkspaceOrOrg(ctx: any, rawId: string) {
  const { org, orgId, workspace, workspaceId } = await resolveOrganization(ctx, rawId);
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

  const defaultPlan = DEFAULT_PLANS.find((p) => p.key === "free_trial") || DEFAULT_PLANS[0];

  if (!sub) {
    return {
      plan: defaultPlan,
      subscription: null,
      activePlan: "free_trial",
      isTrial: true,
      org,
      workspace,
      targetOrgId,
      targetWsId,
    };
  }

  const rawKey = (sub.planKey === "free" ? "free_trial" : sub.planKey || "free_trial").toLowerCase();
  const isPaidActive = (sub.status === "active" || sub.status === "grace_period" || sub.status === "cancellation_requested") &&
    (rawKey === "standard" || rawKey === "premium");
  const isTrialing = sub.status === "trial" || sub.status === "trialing";
  const activePlanKey = isPaidActive ? rawKey : "free_trial";

  let plan = await ctx.db
    .query("plans")
    .withIndex("by_key", (q: any) => q.eq("key", activePlanKey))
    .first();

  if (!plan) {
    plan = (DEFAULT_PLANS.find((p) => p.key === activePlanKey) as any) || defaultPlan;
  }

  return {
    plan,
    subscription: sub,
    activePlan: activePlanKey,
    isTrial: !isPaidActive,
    org,
    workspace,
    targetOrgId,
    targetWsId,
  };
}

/**
 * 16-Step Centralized Entitlement Context Resolution
 */
async function computeEntitlementContext(ctx: any, args: { workspaceId: string | any; userId?: any }): Promise<any> {
    const { org, orgId, workspace, workspaceId } = await resolveOrganization(ctx, args.workspaceId);
    const targetOrgId = orgId || org?._id;
    const targetWsId = workspaceId || workspace?._id;
    const effectiveWsId = String(targetWsId || targetOrgId || args.workspaceId);

    // 1 & 2 & 3: Membership check if user provided
    let membership: any = null;
    if (args.userId) {
      if (targetOrgId) {
        membership = await ctx.db
          .query("organizationMemberships")
          .withIndex("by_org_and_user", (q: any) =>
            q.eq("organizationId", targetOrgId).eq("userId", args.userId!)
          )
          .first();
      }
      if (!membership && targetWsId) {
        membership = await ctx.db
          .query("workspaceMemberships")
          .withIndex("by_workspace_user", (q: any) =>
            q.eq("workspaceId", targetWsId).eq("userId", args.userId!)
          )
          .first();
      }
    }

    // 5 & 6: Load billing account and subscription
    let billingAccount: any = null;
    if (targetOrgId) {
      billingAccount = await ctx.db
        .query("billingAccounts")
        .withIndex("by_organizationId", (q: any) => q.eq("organizationId", targetOrgId))
        .first();
    }
    if (!billingAccount && targetWsId) {
      billingAccount = await ctx.db
        .query("billingAccounts")
        .withIndex("by_workspaceId", (q: any) => q.eq("workspaceId", targetWsId))
        .first();
    }

    const { plan, subscription, isTrial, activePlan } = await getSubscriptionForWorkspaceOrOrg(ctx, effectiveWsId);

    // 7 & 8: Reconcile trial / subscription state with server time
    const now = Date.now();
    let subscriptionStatus = subscription?.status || (isTrial ? "trialing" : "active");
    let entitlementStatus: "pending" | "active" | "restricted" | "expired" | "revoked" = "active";

    const trialEnd = subscription?.trialEnd || subscription?.trialEndsAt || subscription?.currentPeriodEnd;
    if (isTrial && trialEnd && now > trialEnd) {
      subscriptionStatus = "expired";
      entitlementStatus = "restricted";
    } else if (subscription?.status === "past_due") {
      subscriptionStatus = "past_due";
      const graceEnd = subscription.gracePeriodEnd || (subscription.currentPeriodEnd + 3 * 24 * 60 * 60 * 1000);
      if (now > graceEnd) {
        entitlementStatus = "restricted";
      } else {
        entitlementStatus = "active";
      }
    } else if (subscription?.status === "canceled" || subscription?.status === "cancelled" || subscription?.status === "expired") {
      if (subscription.currentPeriodEnd && now > subscription.currentPeriodEnd) {
        subscriptionStatus = "expired";
        entitlementStatus = "restricted";
      }
    } else if (subscription?.status === "suspended") {
      subscriptionStatus = "suspended";
      entitlementStatus = "restricted";
    }

    // 11 & 12: Load plan entitlements
    let planEntitlements = getEntitlementsFromPlan(plan, isTrial);

    // 13: Load active administrative overrides (Active Approved Override > Workspace Entitlement > Plan Entitlement)
    const activeOverrides = await ctx.db
      .query("entitlementOverrides")
      .withIndex("by_workspace", (q: any) => q.eq("workspaceId", effectiveWsId as any))
      .filter((q: any) => q.eq(q.field("status"), "active"))
      .collect();

    const validOverrides = activeOverrides.filter((o: any) => !o.expiresAt || o.expiresAt > now);

    // Check for active manual plan grant
    const activePlanGrant = validOverrides.find(
      (o: any) =>
        o.overrideType === "manual_plan_grant" ||
        (o.metadata && o.metadata.type === "manual_plan_grant")
    );
    let effectivePlanKey = activePlan;
    let isManualPlanGrant = false;
    let planGrantDetails: any = null;

    if (activePlanGrant) {
      effectivePlanKey = (
        activePlanGrant.grantedPlanKey ||
        activePlanGrant.metadata?.planKey ||
        "standard"
      ).toLowerCase();
      isManualPlanGrant = true;
      planGrantDetails = {
        overrideId: activePlanGrant._id,
        grantedPlanKey: effectivePlanKey,
        reason: activePlanGrant.reason,
        customerVisibleReason: activePlanGrant.customerVisibleReason,
        grantType: activePlanGrant.grantType || "administrative_override",
        expiresAt: activePlanGrant.expiresAt || null,
        reviewAt: activePlanGrant.reviewAt || null,
      };
    }

    // Check for active trial extension
    const activeTrialExtension = validOverrides.find(
      (o: any) => o.overrideType === "trial_extension"
    );
    let effectiveTrialEnd = isTrial ? trialEnd : null;
    if (activeTrialExtension && activeTrialExtension.expiresAt) {
      effectiveTrialEnd = Math.max(effectiveTrialEnd || 0, activeTrialExtension.expiresAt);
    }

    // Resolve plan definition based on effective plan key
    let effectivePlan = plan;
    if (isManualPlanGrant && effectivePlanKey !== activePlan) {
      effectivePlan =
        (DEFAULT_PLANS.find((p) => p.key === effectivePlanKey) as any) || plan;
    }
    planEntitlements = getEntitlementsFromPlan(
      effectivePlan,
      isTrial && !isManualPlanGrant
    );

    // 14: Read current usage
    let branchCount = 0;
    let memberCount = 0;

    if (targetOrgId) {
      const branches = await ctx.db
        .query("branches")
        .withIndex("by_organizationId", (q: any) => q.eq("organizationId", targetOrgId))
        .filter((q: any) => q.neq(q.field("status"), "deleted") && q.neq(q.field("status"), "ARCHIVED"))
        .collect();
      branchCount = branches.length;

      const members = await ctx.db
        .query("organizationMemberships")
        .withIndex("by_organizationId", (q: any) => q.eq("organizationId", targetOrgId))
        .filter((q: any) => q.eq(q.field("status"), "ACTIVE"))
        .collect();
      memberCount = members.length;
    } else if (targetWsId) {
      const branches = await ctx.db
        .query("branches")
        .withIndex("by_workspace", (q: any) => q.eq("workspaceId", targetWsId))
        .filter((q: any) => q.neq(q.field("status"), "deleted") && q.neq(q.field("status"), "ARCHIVED"))
        .collect();
      branchCount = branches.length;

      const members = await ctx.db
        .query("workspaceMemberships")
        .withIndex("by_workspace", (q: any) => q.eq("workspaceId", targetWsId))
        .filter((q: any) => q.eq(q.field("status"), "active"))
        .collect();
      memberCount = members.length;
    }

    // Resolve effective feature limits considering overrides
    const resolveFeature = (featureKey: string, baseLimit: number | 'unlimited', isBool = false) => {
      const override = validOverrides.find(
        (o: any) =>
          o.featureKey === featureKey &&
          (o.overrideType === "entitlement_limit_override" ||
            o.overrideType === "feature_access_override" ||
            o.overrideType === "grant" ||
            o.overrideType === "increase" ||
            o.overrideType === "disable" ||
            o.overrideType === "restrict" ||
            o.overrideType === "support_compensation" ||
            o.overrideType === "migration_correction")
      );
      if (override) {
        if (
          override.overrideType === "disable" ||
          override.overrideType === "restrict" ||
          (override.limitType === "boolean" && override.limitValue === 0)
        ) {
          return { limit: 0, source: "override", enabled: false, overrideId: override._id };
        }
        if (override.limitType === "unlimited" || override.overrideLimitType === "unlimited") {
          return { limit: "unlimited" as const, source: "override", enabled: true, overrideId: override._id };
        }
        const val =
          override.overrideLimitValue !== undefined
            ? override.overrideLimitValue
            : override.limitValue !== undefined
            ? override.limitValue
            : baseLimit;
        return {
          limit: val,
          source: "override",
          enabled: isBool ? val !== 0 : true,
          overrideId: override._id,
        };
      }
      return {
        limit: baseLimit,
        source: isManualPlanGrant ? "manual_grant" : "plan",
        enabled: isBool ? !!baseLimit : true,
      };
    };

    const effectiveBranches = resolveFeature("inventory.max_branches", planEntitlements.maxBranchesPerApp);
    const effectiveMembers = resolveFeature("workspace.max_members", planEntitlements.maxMembersPerOrganization);
    const effectiveProducts = resolveFeature("inventory.max_products", planEntitlements.maxProductsPerWorkspace);
    const effectiveTransactions = resolveFeature("inventory.max_monthly_transactions", (planEntitlements as any).maxTransactionsPerMonth ?? 1000);

    // Calculate usage percentages & warnings
    const calcWarning = (usage: number, limit: number | string) => {
      if (typeof limit !== "number" || limit <= 0) return { percent: 0, warning: null };
      const pct = Math.round((usage / limit) * 100);
      let warning: string | null = null;
      if (pct >= 100) warning = "100%";
      else if (pct >= 90) warning = "90%";
      else if (pct >= 80) warning = "80%";
      else if (pct >= 50) warning = "50%";
      return { percent: pct, warning };
    };

    const branchWarning = calcWarning(branchCount, effectiveBranches.limit);
    const memberWarning = calcWarning(memberCount, effectiveMembers.limit);

    return {
      workspaceId: effectiveWsId,
      planKey: effectivePlanKey,
      planName:
        effectivePlanKey === "premium"
          ? "Premium"
          : effectivePlanKey === "standard"
          ? "Standard"
          : "Free Trial",
      isTrial: isTrial && !isManualPlanGrant,
      isManualPlanGrant,
      planGrantDetails,
      subscriptionStatus,
      entitlementStatus,
      billingAccount: billingAccount ? { id: billingAccount._id, email: billingAccount.billingEmail } : null,
      trialEnd: effectiveTrialEnd,
      currentPeriodEnd: subscription?.currentPeriodEnd || null,
      membership: membership ? { role: membership.role, status: membership.status } : null,
      features: {
        "inventory.max_branches": {
          limit: effectiveBranches.limit,
          currentUsage: branchCount,
          remaining: typeof effectiveBranches.limit === "number" ? Math.max(0, effectiveBranches.limit - branchCount) : "unlimited",
          source: effectiveBranches.source,
          percent: branchWarning.percent,
          warning: branchWarning.warning,
        },
        "workspace.max_members": {
          limit: effectiveMembers.limit,
          currentUsage: memberCount,
          remaining: typeof effectiveMembers.limit === "number" ? Math.max(0, effectiveMembers.limit - memberCount) : "unlimited",
          source: effectiveMembers.source,
          percent: memberWarning.percent,
          warning: memberWarning.warning,
        },
        "inventory.max_products": {
          limit: effectiveProducts.limit,
          currentUsage: 0,
          remaining: effectiveProducts.limit,
          source: effectiveProducts.source,
        },
        "inventory.max_monthly_transactions": {
          limit: effectiveTransactions.limit,
          currentUsage: 0,
          remaining: effectiveTransactions.limit,
          source: effectiveTransactions.source,
        },
        "inventory.basic_reports": { enabled: true, source: isManualPlanGrant ? "manual_grant" : "plan" },
        "inventory.advanced_reports": { enabled: planEntitlements.advancedReports, source: isManualPlanGrant ? "manual_grant" : "plan" },
        "inventory.api_access": { enabled: planEntitlements.apiAccess, source: isManualPlanGrant ? "manual_grant" : "plan" },
        "inventory.custom_roles": { enabled: planEntitlements.customRoles, source: isManualPlanGrant ? "manual_grant" : "plan" },
      },
      allowedApplications: ["inventory"],
      overrides: validOverrides.map((o: any) => ({
        id: o._id,
        overrideId: o._id,
        featureKey: o.featureKey,
        overrideType: o.overrideType,
        limitType: o.limitType || o.overrideLimitType,
        limitValue: o.limitValue !== undefined ? o.limitValue : o.overrideLimitValue,
        grantedPlanKey: o.grantedPlanKey,
        grantType: o.grantType,
        status: o.status,
        reason: o.reason,
        customerVisibleReason: o.customerVisibleReason,
        supportTicketReference: o.supportTicketReference,
        createdByAdminId: o.createdByAdminId,
        approvedByAdminId: o.approvedByAdminId,
        effectiveFrom: o.effectiveFrom,
        expiresAt: o.expiresAt,
        reviewAt: o.reviewAt,
      })),
      usage: {
        branches: branchCount,
        members: memberCount,
        products: 0,
        transactions: 0,
        apps: 1,
      },
    };
}

export const getEntitlementContext = query({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    return computeEntitlementContext(ctx, args);
  },
});

/**
 * Check or Require Entitlement Limits
 */
async function checkEntitlementLimitImpl(ctx: any, args: any): Promise<any> {
    const context = await computeEntitlementContext(ctx, {
      workspaceId: args.workspaceId,
      userId: args.userId,
    });

    if (context.entitlementStatus === "restricted" || context.entitlementStatus === "expired") {
      return {
        allowed: false,
        code: "ENTITLEMENT_RESTRICTED",
        featureKey: args.featureKey,
        currentUsage: 0,
        limit: 0,
        remaining: 0,
        planKey: context.planKey,
        message: "Organization entitlements are restricted due to subscription status.",
        upgradePlan: "standard",
      };
    }

    const featureInfo = (context.features as any)[args.featureKey];
    if (!featureInfo) {
      // Default to allowed for unmetered / boolean features that are enabled
      return {
        allowed: true,
        featureKey: args.featureKey,
        currentUsage: 0,
        limit: "unlimited",
        remaining: "unlimited",
        planKey: context.planKey,
        source: "plan",
        warnings: [],
      };
    }

    const amount = args.requestedAmount || 1;
    const currentUsage = featureInfo.currentUsage ?? 0;
    const limit = featureInfo.limit;

    if (limit === "unlimited") {
      return {
        allowed: true,
        featureKey: args.featureKey,
        currentUsage,
        limit: "unlimited",
        remaining: "unlimited",
        planKey: context.planKey,
        source: featureInfo.source || "plan",
        warnings: [],
      };
    }

    const numericLimit = Number(limit) || 0;
    const allowed = currentUsage + amount <= numericLimit;
    const remaining = Math.max(0, numericLimit - currentUsage);

    const upgradePlan = context.planKey === "free_trial" ? "standard" : context.planKey === "standard" ? "premium" : undefined;
    const warnings = featureInfo.warning ? [featureInfo.warning] : [];

    if (!allowed) {
      let resourceName = "resources";
      if (args.featureKey.includes("branch")) resourceName = "branches";
      else if (args.featureKey.includes("member")) resourceName = "members";
      else if (args.featureKey.includes("product")) resourceName = "products";

      return {
        allowed: false,
        code: "ENTITLEMENT_LIMIT_REACHED",
        featureKey: args.featureKey,
        currentUsage,
        limit: numericLimit,
        remaining,
        planKey: context.planKey,
        source: featureInfo.source || "plan",
        upgradePlan,
        warnings,
        message: `Your plan allows ${numericLimit} ${resourceName}. Upgrade to ${upgradePlan ? upgradePlan.charAt(0).toUpperCase() + upgradePlan.slice(1) : "Premium"} for more.`,
      };
    }

    return {
      allowed: true,
      featureKey: args.featureKey,
      currentUsage,
      limit: numericLimit,
      remaining: Math.max(0, numericLimit - (currentUsage + amount)),
      planKey: context.planKey,
      source: featureInfo.source || "plan",
      warnings,
    };
}

export const checkEntitlementLimit = query({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
    featureKey: v.string(),
    requestedAmount: v.optional(v.number()),
    userId: v.optional(v.id("users")),
    permission: v.optional(v.string()),
    productKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return checkEntitlementLimitImpl(ctx, args);
  },
});

/**
 * Mutation: Recalculate workspace entitlements durably in workspaceEntitlements table
 */
export const recalculateWorkspaceEntitlements = mutation({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
    actorUserId: v.optional(v.union(v.id("users"), v.string())),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { org, orgId, workspace, workspaceId } = await resolveOrganization(ctx, args.workspaceId);
    const targetId = workspaceId || orgId || (workspace ? workspace._id : org ? org._id : null);
    if (!targetId) {
      throw new Error("WORKSPACE_NOT_FOUND");
    }

    const targetIdStr = String(targetId);
    const { plan, isTrial, activePlan } = await getSubscriptionForWorkspaceOrOrg(ctx, targetIdStr);
    const effectivePlanKey = (activePlan || plan?.key || "free_trial").toLowerCase();

    const limits = plan?.limits || {};
    const maxOrgs = limits.maxOrganizations ?? (effectivePlanKey === "premium" ? 10 : effectivePlanKey === "standard" ? 3 : 1);
    const maxBranches = limits.maxBranchesPerApp ?? (effectivePlanKey === "premium" ? 10 : effectivePlanKey === "standard" ? 3 : 1);
    const maxMembers = limits.maxMembersPerOrganization ?? (effectivePlanKey === "premium" ? 50 : effectivePlanKey === "standard" ? 10 : 2);
    const maxProducts = limits.maxProductsPerWorkspace ?? (effectivePlanKey === "premium" ? 25000 : effectivePlanKey === "standard" ? 5000 : 500);
    const maxTransactions = limits.maxTransactionsPerMonth ?? (effectivePlanKey === "premium" ? 25000 : effectivePlanKey === "standard" ? 5000 : 300);

    const now = Date.now();
    const featuresToSet = [
      { key: "workspace.max_owned", limitValue: maxOrgs, limitType: "fixed" as const },
      { key: "inventory.max_branches", limitValue: maxBranches, limitType: "fixed" as const },
      { key: "workspace.max_members", limitValue: maxMembers, limitType: "fixed" as const },
      { key: "inventory.max_products", limitValue: maxProducts, limitType: "fixed" as const },
      { key: "inventory.max_monthly_transactions", limitValue: maxTransactions, limitType: "fixed" as const },
      { key: "inventory.export_data", limitValue: undefined, limitType: "boolean" as const, enabled: true },
      { key: "inventory.advanced_reports", limitValue: undefined, limitType: "boolean" as const, enabled: effectivePlanKey !== "free_trial" },
      { key: "inventory.api_access", limitValue: undefined, limitType: "boolean" as const, enabled: effectivePlanKey === "premium" },
    ];

    for (const feat of featuresToSet) {
      const existing = await ctx.db
        .query("workspaceEntitlements")
        .withIndex("by_workspace_feature", (q: any) =>
          q.eq("workspaceId", targetId).eq("featureKey", feat.key)
        )
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          planKey: effectivePlanKey,
          planId: effectivePlanKey,
          limitValue: feat.limitValue,
          limitType: feat.limitType,
          enabled: feat.enabled !== undefined ? feat.enabled : true,
          source: "plan",
          status: "active",
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("workspaceEntitlements", {
          workspaceId: targetId,
          planKey: effectivePlanKey,
          planId: effectivePlanKey,
          featureKey: feat.key,
          limitValue: feat.limitValue,
          limitType: feat.limitType,
          enabled: feat.enabled !== undefined ? feat.enabled : true,
          source: "plan",
          status: "active",
          effectiveFrom: now,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    // Insert audit event
    await ctx.db.insert("entitlementEvents", {
      workspaceId: targetId,
      actorUserId: args.actorUserId,
      eventType: "entitlement.recalculated",
      reason: args.reason || "Authoritative recalculation",
      newValue: { planKey: effectivePlanKey, isTrial },
      createdAt: now,
    });

    return {
      success: true,
      workspaceId: targetIdStr,
      planKey: effectivePlanKey,
      recalculatedAt: now,
    };
  },
});

export const recalculateEntitlements = recalculateWorkspaceEntitlements;

/**
 * Superadmin: Create Entitlement Override with multi-tier risk governance
 */
async function createEntitlementOverrideImpl(ctx: any, args: any): Promise<any> {
    const { org, orgId, workspace, workspaceId } = await resolveOrganization(ctx, args.workspaceId);
    const targetId = workspaceId || orgId || (workspace ? workspace._id : org ? org._id : null);
    if (!targetId) throw new Error("WORKSPACE_NOT_FOUND");

    const now = Date.now();
    const effectiveFrom = args.effectiveFrom || now;

    if (args.expiresAt && args.expiresAt <= effectiveFrom) {
      throw new Error("INVALID_EXPIRATION: Expiration date must be after effective date.");
    }

    // Determine risk level & approval requirement
    const isHighRisk =
      args.requiresApproval === true ||
      args.overrideType === "manual_plan_grant" ||
      args.overrideType === "billing_state_correction" ||
      args.overrideType === "manual_plan_revoke" ||
      args.limitType === "unlimited" ||
      args.overrideLimitType === "unlimited" ||
      args.grantedPlanKey === "premium";

    let initialStatus: "draft" | "pending_approval" | "active" = "active";
    if (args.status) {
      if (args.status === "draft" || args.status === "pending_approval" || args.status === "active") {
        initialStatus = args.status;
      }
    } else if (isHighRisk && !args.approvedByAdminId) {
      initialStatus = "pending_approval";
    }

    // If an active override already exists for this exact featureKey, auto-retire it if new one is immediately active
    if (initialStatus === "active" && args.featureKey) {
      const existing = await ctx.db
        .query("entitlementOverrides")
        .withIndex("by_workspace_feature", (q: any) =>
          q.eq("workspaceId", targetId).eq("featureKey", args.featureKey!)
        )
        .filter((q: any) => q.eq(q.field("status"), "active"))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          status: "revoked",
          revokedByAdminId: args.createdByAdminId,
          revokedAt: now,
          updatedAt: now,
        });
      }
    }

    const overrideId = await ctx.db.insert("entitlementOverrides", {
      workspaceId: targetId,
      featureKey: args.featureKey,
      productKey: args.productKey,
      overrideType: args.overrideType,
      limitType: args.limitType || args.overrideLimitType,
      limitValue: args.limitValue !== undefined ? args.limitValue : args.overrideLimitValue,
      overrideLimitType: args.overrideLimitType || args.limitType,
      overrideLimitValue: args.overrideLimitValue !== undefined ? args.overrideLimitValue : args.limitValue,
      previousPlanKey: args.previousPlanKey,
      grantedPlanKey: args.grantedPlanKey,
      extensionDays: args.extensionDays,
      grantType: args.grantType || "administrative_override",
      reason: args.reason,
      customerVisibleReason: args.customerVisibleReason,
      supportTicketReference: args.supportTicketReference,
      externalReference: args.externalReference,
      metadata: args.metadata,
      status: initialStatus,
      effectiveFrom,
      expiresAt: args.expiresAt,
      reviewAt: args.reviewAt,
      createdByAdminId: args.createdByAdminId,
      approvedByAdminId: args.approvedByAdminId,
      approvedAt: args.approvedByAdminId ? now : undefined,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("entitlementEvents", {
      workspaceId: targetId,
      actorUserId: String(args.createdByAdminId),
      eventType: `entitlement.override_${initialStatus === "pending_approval" ? "submitted" : "created"}`,
      featureKey: args.featureKey,
      productKey: args.productKey,
      reason: args.reason,
      newValue: {
        overrideId,
        overrideType: args.overrideType,
        status: initialStatus,
        limitType: args.limitType || args.overrideLimitType,
        limitValue: args.limitValue !== undefined ? args.limitValue : args.overrideLimitValue,
        grantedPlanKey: args.grantedPlanKey,
        expiresAt: args.expiresAt,
        requiresApproval: isHighRisk,
      },
      createdAt: now,
    });

    return {
      success: true,
      overrideId,
      workspaceId: targetId,
      featureKey: args.featureKey,
      status: initialStatus,
      effectiveFrom,
      isPendingApproval: initialStatus === "pending_approval",
    };
}

export const createEntitlementOverride = mutation({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
    featureKey: v.optional(v.string()),
    productKey: v.optional(v.string()),
    overrideType: v.union(
      v.literal("entitlement_limit_override"),
      v.literal("feature_access_override"),
      v.literal("trial_extension"),
      v.literal("manual_plan_grant"),
      v.literal("manual_plan_revoke"),
      v.literal("billing_state_correction"),
      v.literal("grace_period_extension"),
      v.literal("support_compensation"),
      v.literal("migration_correction"),
      v.literal("grant"),
      v.literal("increase"),
      v.literal("disable"),
      v.literal("restrict")
    ),
    limitType: v.optional(v.union(v.literal("boolean"), v.literal("fixed"), v.literal("unlimited"))),
    limitValue: v.optional(v.number()),
    overrideLimitType: v.optional(v.union(v.literal("boolean"), v.literal("fixed"), v.literal("unlimited"))),
    overrideLimitValue: v.optional(v.number()),
    previousPlanKey: v.optional(v.string()),
    grantedPlanKey: v.optional(v.string()),
    extensionDays: v.optional(v.number()),
    grantType: v.optional(
      v.union(
        v.literal("support_comp"),
        v.literal("internal_test"),
        v.literal("partner"),
        v.literal("migration"),
        v.literal("billing_correction"),
        v.literal("administrative_override")
      )
    ),
    reason: v.string(),
    customerVisibleReason: v.optional(v.string()),
    supportTicketReference: v.optional(v.string()),
    externalReference: v.optional(v.string()),
    createdByAdminId: v.union(v.id("users"), v.id("platformAdmins"), v.string()),
    approvedByAdminId: v.optional(v.union(v.id("users"), v.id("platformAdmins"), v.string())),
    effectiveFrom: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    reviewAt: v.optional(v.number()),
    requiresApproval: v.optional(v.boolean()),
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("pending_approval"),
        v.literal("active"),
        v.literal("expired"),
        v.literal("revoked"),
        v.literal("rejected")
      )
    ),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return createEntitlementOverrideImpl(ctx, args);
  },
});

/**
 * Superadmin: Legacy alias for applyEntitlementOverride
 */
export const applyEntitlementOverride = mutation({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
    featureKey: v.string(),
    productKey: v.optional(v.string()),
    overrideType: v.union(
      v.literal("grant"),
      v.literal("increase"),
      v.literal("disable"),
      v.literal("restrict"),
      v.literal("entitlement_limit_override"),
      v.literal("feature_access_override"),
      v.literal("trial_extension"),
      v.literal("manual_plan_grant"),
      v.literal("manual_plan_revoke"),
      v.literal("billing_state_correction"),
      v.literal("grace_period_extension"),
      v.literal("support_compensation"),
      v.literal("migration_correction")
    ),
    limitType: v.union(v.literal("boolean"), v.literal("fixed"), v.literal("unlimited")),
    limitValue: v.optional(v.number()),
    reason: v.string(),
    createdByAdminId: v.union(v.id("users"), v.id("platformAdmins"), v.string()),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return createEntitlementOverrideImpl(ctx, {
      workspaceId: args.workspaceId,
      featureKey: args.featureKey,
      productKey: args.productKey,
      overrideType: args.overrideType as any,
      limitType: args.limitType,
      limitValue: args.limitValue,
      reason: args.reason,
      createdByAdminId: args.createdByAdminId,
      expiresAt: args.expiresAt,
    });
  },
});

/**
 * Superadmin: Submit Draft Override for Approval
 */
export const submitEntitlementOverrideForApproval = mutation({
  args: {
    overrideId: v.id("entitlementOverrides"),
    adminId: v.optional(v.union(v.id("users"), v.id("platformAdmins"), v.string())),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const override = await ctx.db.get(args.overrideId);
    if (!override) throw new Error("OVERRIDE_NOT_FOUND");
    if (override.status !== "draft") {
      throw new Error(`INVALID_STATUS_TRANSITION: Cannot submit override with status '${override.status}' for approval.`);
    }

    const now = Date.now();
    await ctx.db.patch(args.overrideId, {
      status: "pending_approval",
      updatedAt: now,
    });

    await ctx.db.insert("entitlementEvents", {
      workspaceId: override.workspaceId,
      actorUserId: args.adminId ? String(args.adminId) : String(override.createdByAdminId),
      eventType: "entitlement.override_submitted_for_approval",
      featureKey: override.featureKey,
      reason: args.reason || "Submitted for dual-admin approval",
      details: { overrideId: args.overrideId },
      createdAt: now,
    });

    return {
      success: true,
      overrideId: args.overrideId,
      status: "pending_approval",
    };
  },
});

/**
 * Superadmin: Approve Entitlement Override (Dual-Admin Enforcement)
 */
export const approveEntitlementOverride = mutation({
  args: {
    overrideId: v.id("entitlementOverrides"),
    approvedByAdminId: v.union(v.id("users"), v.id("platformAdmins"), v.string()),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const override = await ctx.db.get(args.overrideId);
    if (!override) throw new Error("OVERRIDE_NOT_FOUND");

    if (override.status !== "pending_approval" && override.status !== "draft") {
      throw new Error(`INVALID_STATUS_TRANSITION: Cannot approve override with status '${override.status}'.`);
    }

    // Enforce dual-admin rule: Approver must be distinct from creator
    if (String(args.approvedByAdminId) === String(override.createdByAdminId)) {
      throw new Error("DUAL_ADMIN_APPROVAL_REQUIRED: Self-approval is not permitted for governance-restricted overrides.");
    }

    const now = Date.now();

    // Auto-retire any existing active override for the same featureKey
    if (override.featureKey) {
      const existing = await ctx.db
        .query("entitlementOverrides")
        .withIndex("by_workspace_feature", (q: any) =>
          q.eq("workspaceId", override.workspaceId).eq("featureKey", override.featureKey!)
        )
        .filter((q: any) => q.eq(q.field("status"), "active"))
        .collect();

      for (const ex of existing) {
        if (ex._id !== override._id) {
          await ctx.db.patch(ex._id, {
            status: "revoked",
            revokedByAdminId: args.approvedByAdminId,
            revokedAt: now,
            updatedAt: now,
          });
        }
      }
    }

    await ctx.db.patch(args.overrideId, {
      status: "active",
      approvedByAdminId: args.approvedByAdminId,
      approvedAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("entitlementEvents", {
      workspaceId: override.workspaceId,
      actorUserId: String(args.approvedByAdminId),
      eventType: "entitlement.override_approved",
      featureKey: override.featureKey,
      reason: args.reason || "Dual-admin override approval granted",
      details: {
        overrideId: args.overrideId,
        createdByAdminId: override.createdByAdminId,
        approvedByAdminId: args.approvedByAdminId,
      },
      createdAt: now,
    });

    return {
      success: true,
      overrideId: args.overrideId,
      status: "active",
      approvedByAdminId: args.approvedByAdminId,
      approvedAt: now,
    };
  },
});

/**
 * Superadmin: Reject Entitlement Override
 */
export const rejectEntitlementOverride = mutation({
  args: {
    overrideId: v.id("entitlementOverrides"),
    rejectedByAdminId: v.union(v.id("users"), v.id("platformAdmins"), v.string()),
    rejectionReason: v.string(),
  },
  handler: async (ctx, args) => {
    const override = await ctx.db.get(args.overrideId);
    if (!override) throw new Error("OVERRIDE_NOT_FOUND");

    const now = Date.now();
    await ctx.db.patch(args.overrideId, {
      status: "rejected",
      updatedAt: now,
    });

    await ctx.db.insert("entitlementEvents", {
      workspaceId: override.workspaceId,
      actorUserId: String(args.rejectedByAdminId),
      eventType: "entitlement.override_rejected",
      featureKey: override.featureKey,
      reason: args.rejectionReason,
      details: { overrideId: args.overrideId },
      createdAt: now,
    });

    return {
      success: true,
      overrideId: args.overrideId,
      status: "rejected",
      rejectedAt: now,
    };
  },
});

/**
 * Superadmin: Revoke Entitlement Override
 */
export const revokeEntitlementOverride = mutation({
  args: {
    overrideId: v.id("entitlementOverrides"),
    reason: v.optional(v.string()),
    adminId: v.optional(v.union(v.id("users"), v.id("platformAdmins"), v.string())),
  },
  handler: async (ctx, args) => {
    const override = await ctx.db.get(args.overrideId);
    if (!override) throw new Error("OVERRIDE_NOT_FOUND");

    const now = Date.now();
    await ctx.db.patch(args.overrideId, {
      status: "revoked",
      revokedByAdminId: args.adminId,
      revokedAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("entitlementEvents", {
      workspaceId: override.workspaceId,
      actorUserId: args.adminId ? String(args.adminId) : undefined,
      eventType: "entitlement.override_revoked",
      featureKey: override.featureKey,
      reason: args.reason || "Manual administrative revocation",
      oldValue: { overrideId: args.overrideId },
      createdAt: now,
    });

    return {
      success: true,
      overrideId: args.overrideId,
      status: "revoked",
      revokedAt: now,
    };
  },
});

/**
 * Superadmin: Extend Free Trial Period
 */
export const extendTrialPeriod = mutation({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
    additionalDays: v.number(),
    reason: v.string(),
    customerVisibleReason: v.optional(v.string()),
    supportTicketReference: v.optional(v.string()),
    adminId: v.union(v.id("users"), v.id("platformAdmins"), v.string()),
  },
  handler: async (ctx, args) => {
    const { org, orgId, workspace, workspaceId } = await resolveOrganization(ctx, args.workspaceId);
    const targetId = workspaceId || orgId || (workspace ? workspace._id : org ? org._id : null);
    if (!targetId) throw new Error("WORKSPACE_NOT_FOUND");

    const now = Date.now();
    const additionalMs = args.additionalDays * 24 * 60 * 60 * 1000;

    // Fetch existing subscription
    let sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_organizationId", (q: any) => q.eq("organizationId", targetId as any))
      .first();

    if (!sub) {
      sub = await ctx.db
        .query("subscriptions")
        .withIndex("by_workspace", (q: any) => q.eq("workspaceId", targetId as any))
        .first();
    }

    const currentTrialEnd = sub?.trialEnd || sub?.trialEndsAt || now;
    const baseDate = currentTrialEnd > now ? currentTrialEnd : now;
    const newTrialEnd = baseDate + additionalMs;

    if (sub) {
      await ctx.db.patch(sub._id, {
        trialEnd: newTrialEnd,
        trialEndsAt: newTrialEnd,
        trialStatus: "extended",
        trialExtensionDays: (sub.trialExtensionDays || 0) + args.additionalDays,
        trialExtensionReason: args.reason,
        extendedByAdminId: String(args.adminId),
        extendedAt: now,
        previousTrialEnd: currentTrialEnd,
        updatedAt: now,
      });
    }

    // Create a time-bound trial_extension override
    const override = await createEntitlementOverrideImpl(ctx, {
      workspaceId: targetId,
      featureKey: "organization.trial_period",
      overrideType: "trial_extension",
      grantType: "support_comp",
      extensionDays: args.additionalDays,
      reason: args.reason,
      customerVisibleReason: args.customerVisibleReason || `Trial extended by ${args.additionalDays} days for customer support.`,
      supportTicketReference: args.supportTicketReference,
      createdByAdminId: args.adminId,
      effectiveFrom: now,
      expiresAt: newTrialEnd,
    });

    return {
      success: true,
      workspaceId: targetId,
      newTrialEnd,
      additionalDays: args.additionalDays,
      overrideId: override.overrideId,
    };
  },
});

/**
 * Superadmin: Grant Manual Plan (e.g. for enterprise pilot, internal test, partner)
 */
export const grantManualPlan = mutation({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
    planKey: v.union(v.literal("standard"), v.literal("premium")),
    durationDays: v.optional(v.number()),
    grantType: v.optional(
      v.union(
        v.literal("support_comp"),
        v.literal("internal_test"),
        v.literal("partner"),
        v.literal("migration"),
        v.literal("billing_correction"),
        v.literal("administrative_override")
      )
    ),
    reason: v.string(),
    customerVisibleReason: v.optional(v.string()),
    supportTicketReference: v.optional(v.string()),
    adminId: v.union(v.id("users"), v.id("platformAdmins"), v.string()),
    approverAdminId: v.optional(v.union(v.id("users"), v.id("platformAdmins"), v.string())),
    reviewAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { org, orgId, workspace, workspaceId } = await resolveOrganization(ctx, args.workspaceId);
    const targetId = workspaceId || orgId || (workspace ? workspace._id : org ? org._id : null);
    if (!targetId) throw new Error("WORKSPACE_NOT_FOUND");

    const now = Date.now();
    const expiresAt = args.durationDays ? now + args.durationDays * 24 * 60 * 60 * 1000 : undefined;

    return createEntitlementOverrideImpl(ctx, {
      workspaceId: targetId,
      featureKey: "plan.grant",
      overrideType: "manual_plan_grant",
      grantedPlanKey: args.planKey,
      grantType: args.grantType || "administrative_override",
      reason: args.reason,
      customerVisibleReason: args.customerVisibleReason || `Granted ${args.planKey.toUpperCase()} access by platform administrators.`,
      supportTicketReference: args.supportTicketReference,
      createdByAdminId: args.adminId,
      approvedByAdminId: args.approverAdminId,
      effectiveFrom: now,
      expiresAt,
      reviewAt: args.reviewAt,
      requiresApproval: !args.approverAdminId,
      metadata: {
        planKey: args.planKey,
        type: "manual_plan_grant",
      },
    });
  },
});

/**
 * Superadmin: Query Workspace Overrides
 */
export const getWorkspaceOverrides = query({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { org, orgId, workspace, workspaceId } = await resolveOrganization(ctx, args.workspaceId);
    const targetId = workspaceId || orgId || (workspace ? workspace._id : org ? org._id : null);
    if (!targetId) return [];

    let overrides = await ctx.db
      .query("entitlementOverrides")
      .withIndex("by_workspace", (q: any) => q.eq("workspaceId", targetId))
      .collect();

    if (args.status) {
      overrides = overrides.filter((o) => o.status === args.status);
    }

    return overrides.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/**
 * Superadmin: Query Override Detail
 */
export const getOverrideDetail = query({
  args: {
    overrideId: v.id("entitlementOverrides"),
  },
  handler: async (ctx, args) => {
    const override = await ctx.db.get(args.overrideId);
    if (!override) return null;

    const events = await ctx.db
      .query("entitlementEvents")
      .withIndex("by_workspace", (q: any) => q.eq("workspaceId", override.workspaceId))
      .collect();

    const relatedEvents = events
      .filter((e) => e.details?.overrideId === args.overrideId || e.newValue?.overrideId === args.overrideId)
      .sort((a, b) => b.createdAt - a.createdAt);

    return {
      ...override,
      auditHistory: relatedEvents,
    };
  },
});

/**
 * Superadmin: Query Override History
 */
export const getOverrideHistory = query({
  args: {
    workspaceId: v.optional(v.union(v.id("workspaces"), v.id("organizations"), v.string())),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let events: any[] = [];
    if (args.workspaceId) {
      const { org, orgId, workspace, workspaceId } = await resolveOrganization(ctx, args.workspaceId);
      const targetId = workspaceId || orgId || (workspace ? workspace._id : org ? org._id : null);
      if (targetId) {
        events = await ctx.db
          .query("entitlementEvents")
          .withIndex("by_workspace", (q: any) => q.eq("workspaceId", targetId))
          .collect();
      }
    } else {
      events = await ctx.db
        .query("entitlementEvents")
        .withIndex("by_createdAt")
        .order("desc")
        .take(args.limit || 100);
    }

    return events
      .filter((e) => e.eventType.startsWith("entitlement.override_"))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, args.limit || 100);
  },
});

/**
 * System / Cron / Superadmin: Reconcile Overrides and Entitlements
 */
export const reconcileOverridesAndEntitlements = mutation({
  args: {
    workspaceId: v.optional(v.union(v.id("workspaces"), v.id("organizations"), v.string())),
    triggeredByAdminId: v.optional(v.union(v.id("users"), v.id("platformAdmins"), v.string())),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let overridesToEvaluate: any[] = [];

    if (args.workspaceId) {
      const { org, orgId, workspace, workspaceId } = await resolveOrganization(ctx, args.workspaceId);
      const targetId = workspaceId || orgId || (workspace ? workspace._id : org ? org._id : null);
      if (targetId) {
        overridesToEvaluate = await ctx.db
          .query("entitlementOverrides")
          .withIndex("by_workspace", (q: any) => q.eq("workspaceId", targetId))
          .filter((q: any) => q.eq(q.field("status"), "active"))
          .collect();
      }
    } else {
      overridesToEvaluate = await ctx.db
        .query("entitlementOverrides")
        .withIndex("by_status", (q: any) => q.eq("status", "active"))
        .collect();
    }

    let expiredCount = 0;
    for (const ov of overridesToEvaluate) {
      if (ov.expiresAt && ov.expiresAt <= now) {
        await ctx.db.patch(ov._id, {
          status: "expired",
          updatedAt: now,
        });
        expiredCount++;

        await ctx.db.insert("entitlementEvents", {
          workspaceId: ov.workspaceId,
          actorUserId: args.triggeredByAdminId ? String(args.triggeredByAdminId) : "system",
          eventType: "entitlement.override_expired",
          featureKey: ov.featureKey,
          reason: "Automatic expiration during scheduled entitlement reconciliation",
          oldValue: { overrideId: ov._id, expiresAt: ov.expiresAt },
          createdAt: now,
        });
      }
    }

    return {
      success: true,
      expiredCount,
      reconciledAt: now,
    };
  },
});

/**
 * Superadmin: Detect Entitlement Mismatches
 */
export const detectEntitlementMismatches = query({
  args: {
    workspaceId: v.optional(v.union(v.id("workspaces"), v.id("organizations"), v.string())),
  },
  handler: async (ctx, args) => {
    const mismatches: any[] = [];
    const now = Date.now();

    let workspacesToCheck: any[] = [];
    if (args.workspaceId) {
      const { org, orgId, workspace, workspaceId } = await resolveOrganization(ctx, args.workspaceId);
      const targetId = workspaceId || orgId || (workspace ? workspace._id : org ? org._id : null);
      if (targetId) workspacesToCheck = [{ _id: targetId }];
    } else {
      workspacesToCheck = await ctx.db.query("organizations").take(50);
    }

    for (const ws of workspacesToCheck) {
      const wsId = ws._id;
      const sub = await ctx.db
        .query("subscriptions")
        .withIndex("by_organizationId", (q: any) => q.eq("organizationId", wsId))
        .first();

      const entitlements = await ctx.db
        .query("workspaceEntitlements")
        .withIndex("by_workspace", (q: any) => q.eq("workspaceId", wsId))
        .collect();

      const overrides = await ctx.db
        .query("entitlementOverrides")
        .withIndex("by_workspace", (q: any) => q.eq("workspaceId", wsId))
        .filter((q: any) => q.eq(q.field("status"), "active"))
        .collect();

      // Check 1: Active subscription without stored workspace entitlements
      if (sub && sub.status === "active" && entitlements.length === 0) {
        mismatches.push({
          workspaceId: wsId,
          type: "MISSING_ENTITLEMENTS",
          message: "Active subscription has no stored workspace entitlements.",
          severity: "high",
        });
      }

      // Check 2: Expired override still marked active
      for (const ov of overrides) {
        if (ov.expiresAt && ov.expiresAt < now) {
          mismatches.push({
            workspaceId: wsId,
            type: "EXPIRED_OVERRIDE_ACTIVE",
            message: `Override for ${ov.featureKey} expired at ${new Date(ov.expiresAt).toISOString()} but is marked active.`,
            overrideId: ov._id,
            severity: "medium",
          });
        }
      }

      // Check 3: Duplicate active entitlements for the same feature
      const featureMap = new Map<string, number>();
      for (const ent of entitlements) {
        if (ent.status === "active") {
          featureMap.set(ent.featureKey, (featureMap.get(ent.featureKey) || 0) + 1);
        }
      }
      for (const [key, count] of featureMap.entries()) {
        if (count > 1) {
          mismatches.push({
            workspaceId: wsId,
            type: "DUPLICATE_ACTIVE_ENTITLEMENTS",
            message: `Feature ${key} has ${count} duplicate active entitlement records.`,
            featureKey: key,
            severity: "medium",
          });
        }
      }
    }

    return {
      mismatchesCount: mismatches.length,
      mismatches,
    };
  },
});

/**
 * Atomic Usage Counter Increment / Decrement
 */
export const updateUsageCounter = mutation({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
    featureKey: v.string(),
    delta: v.number(),
    productKey: v.optional(v.string()),
    periodStart: v.optional(v.number()),
    periodEnd: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { org, orgId, workspace, workspaceId } = await resolveOrganization(ctx, args.workspaceId);
    const targetId = workspaceId || orgId || (workspace ? workspace._id : org ? org._id : null);
    if (!targetId) throw new Error("WORKSPACE_NOT_FOUND");

    const now = Date.now();
    const existing = await ctx.db
      .query("usageCounters")
      .withIndex("by_workspace_feature", (q: any) =>
        q.eq("workspaceId", targetId).eq("featureKey", args.featureKey)
      )
      .first();

    let newUsage = 0;
    if (existing) {
      newUsage = Math.max(0, existing.usageValue + args.delta);
      await ctx.db.patch(existing._id, {
        usageValue: newUsage,
        periodStart: args.periodStart ?? existing.periodStart,
        periodEnd: args.periodEnd ?? existing.periodEnd,
        updatedAt: now,
      });
    } else {
      newUsage = Math.max(0, args.delta);
      await ctx.db.insert("usageCounters", {
        workspaceId: targetId,
        featureKey: args.featureKey,
        productKey: args.productKey,
        usageValue: newUsage,
        periodStart: args.periodStart,
        periodEnd: args.periodEnd,
        updatedAt: now,
      });
    }

    return {
      success: true,
      workspaceId: targetId,
      featureKey: args.featureKey,
      currentUsage: newUsage,
    };
  },
});

/**
 * Query: Get user's active entitlements based on their organizations
 */
export const getUserEntitlements = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const ownedWorkspaces = await ctx.db
      .query("workspaces")
      .withIndex("by_owner", (q: any) => q.eq("ownerId", args.userId))
      .filter((q: any) => q.eq(q.field("status"), "active"))
      .collect();

    const ownerMemberships = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_userId", (q: any) => q.eq("userId", args.userId))
      .filter((q: any) => q.eq(q.field("role"), "OWNER"))
      .collect();

    const totalWorkspaces = Math.max(ownedWorkspaces.length, ownerMemberships.length);

    let activeSub: any = null;
    let plan = DEFAULT_PLANS.find((p) => p.key === "free_trial") || DEFAULT_PLANS[0];

    for (const om of ownerMemberships) {
      const sub = await ctx.db
        .query("subscriptions")
        .withIndex("by_organizationId", (q: any) => q.eq("organizationId", om.organizationId))
        .first();
      if (sub && sub.status === "active" && (sub.planKey === "standard" || sub.planKey === "premium")) {
        activeSub = sub;
        plan = (DEFAULT_PLANS.find((p) => p.key === sub.planKey) as any) || plan;
        break;
      }
      if (sub && !activeSub) activeSub = sub;
    }

    const isTrial = !activeSub || activeSub.status === "trial" || activeSub.status === "trialing";
    const entitlements = getEntitlementsFromPlan(plan, isTrial);

    return {
      ...entitlements,
      status: activeSub?.status || "trialing",
      trialEnd: isTrial ? (activeSub?.trialEnd || activeSub?.trialEndsAt) : null,
      currentPeriodEnd: activeSub?.currentPeriodEnd,
      usage: {
        workspaces: totalWorkspaces,
        members: 0,
        branches: 0,
        apps: 0,
        products: 0,
        transactions: 0,
      },
    };
  },
});

/**
 * Query: Get workspace entitlements & live resource usage
 */
export const getWorkspaceEntitlements = query({
  args: { workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()) },
  handler: async (ctx, args) => {
    return computeEntitlementContext(ctx, { workspaceId: args.workspaceId });
  },
});

/**
 * Query: Check if user is eligible for a Free Trial organization (limit: 1 per user)
 */
export const getFreeTrialEligibility = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const ownedWorkspaces = await ctx.db
      .query("workspaces")
      .withIndex("by_owner", (q: any) => q.eq("ownerId", args.userId))
      .filter((q: any) => q.neq(q.field("status"), "deleted"))
      .collect();

    const ownerMemberships = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_userId", (q: any) => q.eq("userId", args.userId))
      .filter((q: any) => q.eq(q.field("role"), "OWNER") && q.eq(q.field("status"), "ACTIVE"))
      .collect();

    const checkedOrgIds = new Set<string>();

    for (const ws of ownedWorkspaces) {
      if (ws.organizationId) checkedOrgIds.add(ws.organizationId);
      if (ws.status === "trial" || ws.planId === "free_trial" || ws.planId === "free") {
        return {
          allowed: false,
          hasFreeTrial: true,
          organizationName: ws.name,
          organizationId: ws._id,
        };
      }
    }

    for (const om of ownerMemberships) {
      checkedOrgIds.add(om.organizationId);
    }

    for (const orgId of checkedOrgIds) {
      const sub = await ctx.db
        .query("subscriptions")
        .withIndex("by_organizationId", (q: any) => q.eq("organizationId", orgId as any))
        .first();

      if (sub && (sub.planKey === "free_trial" || sub.planKey === "free" || sub.status === "trial" || sub.status === "trialing")) {
        const org = await ctx.db.get(orgId as any);
        return {
          allowed: false,
          hasFreeTrial: true,
          organizationName: (org as any)?.name || "Existing Organization",
          organizationId: orgId,
          trialEndsAt: sub.trialEnd || sub.trialEndsAt,
        };
      }
    }

    return {
      allowed: true,
      hasFreeTrial: false,
    };
  },
});

/**
 * Query: Validate whether a user can create another workspace or organization
 */
export const canCreateWorkspace = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const ownedWorkspaces = await ctx.db
      .query("workspaces")
      .withIndex("by_owner", (q: any) => q.eq("ownerId", args.userId))
      .filter((q: any) => q.neq(q.field("status"), "deleted") && q.neq(q.field("status"), "archived"))
      .collect();

    const ownerMemberships = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_userId", (q: any) => q.eq("userId", args.userId))
      .filter((q: any) => q.eq(q.field("role"), "OWNER") && q.eq(q.field("status"), "ACTIVE"))
      .collect();

    const uniqueOwnedIds = new Set<string>();
    ownedWorkspaces.forEach((w) => uniqueOwnedIds.add(w._id));
    ownerMemberships.forEach((m) => uniqueOwnedIds.add(m.organizationId));

    const currentOwned = uniqueOwnedIds.size;

    let maxOwned = 3;
    const override = await ctx.db
      .query("organizationLimitOverrides")
      .withIndex("by_user_feature", (q: any) =>
        q.eq("userId", args.userId).eq("featureKey", "organization.max_owned_count")
      )
      .first();

    if (override && (!override.expiresAt || override.expiresAt > Date.now())) {
      maxOwned = override.overrideLimit;
    }

    let hasFreeTrial = false;
    let trialOrgName = "";

    for (const ws of ownedWorkspaces) {
      if (ws.status === "trial" || ws.planId === "free_trial" || ws.planId === "free") {
        hasFreeTrial = true;
        trialOrgName = ws.name;
        break;
      }
    }

    if (!hasFreeTrial) {
      for (const orgId of uniqueOwnedIds) {
        const sub = await ctx.db
          .query("subscriptions")
          .withIndex("by_organizationId", (q: any) => q.eq("organizationId", orgId as any))
          .first();
        if (sub && (sub.planKey === "free_trial" || sub.planKey === "free" || sub.status === "trial" || sub.status === "trialing")) {
          hasFreeTrial = true;
          const org = await ctx.db.get(orgId as any);
          trialOrgName = (org as any)?.name || "";
          break;
        }
      }
    }

    const allowed = currentOwned < maxOwned;
    return {
      allowed,
      ownedCount: currentOwned,
      ownedLimit: maxOwned,
      trialCount: hasFreeTrial ? 1 : 0,
      trialLimit: 1,
      currentOwnedOrganizations: currentOwned,
      maximumOwnedOrganizations: maxOwned,
      remainingOwnedOrganizations: Math.max(0, maxOwned - currentOwned),
      freeTrial: {
        available: !hasFreeTrial,
        hasFreeTrial,
        organizationName: trialOrgName,
      },
    };
  },
});

/**
 * Query: Can Create Branch
 */
export const canCreateBranch = query({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
    productKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const res = await checkEntitlementLimitImpl(ctx, {
      workspaceId: args.workspaceId,
      featureKey: "inventory.max_branches",
      productKey: args.productKey || "inventory",
    });
    return {
      allowed: res.allowed,
      current: res.currentUsage,
      max: res.limit,
      remaining: res.remaining,
      planKey: res.planKey,
      upgradePlan: res.upgradePlan,
      message: res.message,
    };
  },
});

/**
 * Query: Can Invite Member
 */
export const canInviteMember = query({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
  },
  handler: async (ctx, args) => {
    const res = await checkEntitlementLimitImpl(ctx, {
      workspaceId: args.workspaceId,
      featureKey: "workspace.max_members",
    });
    return {
      allowed: res.allowed,
      current: res.currentUsage,
      max: res.limit,
      remaining: res.remaining,
      planKey: res.planKey,
      upgradePlan: res.upgradePlan,
      message: res.message,
    };
  },
});

/**
 * Query: Organization Context
 */
export const getOrganizationContext = query({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { org, orgId, workspace, workspaceId } = await resolveOrganization(ctx, args.workspaceId);
    const targetOrgId = orgId || org?._id;
    const targetWsId = workspaceId || workspace?._id;

    let membership: any = null;
    if (targetOrgId) {
      membership = await ctx.db
        .query("organizationMemberships")
        .withIndex("by_org_and_user", (q: any) =>
          q.eq("organizationId", targetOrgId).eq("userId", args.userId)
        )
        .first();
    }
    if (!membership && targetWsId) {
      membership = await ctx.db
        .query("workspaceMemberships")
        .withIndex("by_workspace_user", (q: any) =>
          q.eq("workspaceId", targetWsId).eq("userId", args.userId)
        )
        .first();
    }

    const { plan, subscription, isTrial } = await getSubscriptionForWorkspaceOrOrg(ctx, args.workspaceId);

    let branches: any[] = [];
    if (targetOrgId) {
      branches = await ctx.db
        .query("branches")
        .withIndex("by_organizationId", (q: any) => q.eq("organizationId", targetOrgId))
        .filter((q: any) => q.neq(q.field("status"), "deleted") && q.neq(q.field("status"), "ARCHIVED"))
        .collect();
    } else if (targetWsId) {
      branches = await ctx.db
        .query("branches")
        .withIndex("by_workspace", (q: any) => q.eq("workspaceId", targetWsId))
        .filter((q: any) => q.neq(q.field("status"), "deleted") && q.neq(q.field("status"), "ARCHIVED"))
        .collect();
    }

    const role = (membership?.role || "owner").toLowerCase();
    const isOwnerOrAdmin = role === "owner" || role === "admin";

    return {
      workspace: {
        id: String(targetWsId || targetOrgId || ""),
        name: org?.name || workspace?.name || "My Organization",
        status: (org?.status || workspace?.status || (isTrial ? "trial" : "active")).toLowerCase(),
        currency: org?.currency || workspace?.currency || "NGN",
        timezone: org?.timezone || workspace?.timezone || "Africa/Lagos",
      },
      membership: {
        role,
        status: (membership?.status || "active").toLowerCase(),
      },
      billing: {
        plan: isTrial ? "free_trial" : (subscription?.planKey || "standard"),
        subscriptionStatus: subscription?.status || (isTrial ? "trialing" : "active"),
        entitlementStatus: "active",
        trialEnd: isTrial ? (subscription?.trialEnd || subscription?.trialEndsAt || null) : null,
      },
      applications: [
        {
          key: "inventory",
          status: "completed",
          access: true,
        },
      ],
      branches: branches.map((b) => ({
        id: String(b._id),
        name: b.name,
        isPrimary: !!b.isPrimary,
        status: b.status || "active",
      })),
      permissions: isOwnerOrAdmin
        ? [
            "inventory.view",
            "inventory.manage_products",
            "inventory.view_stock",
            "inventory.record_sales",
            "inventory.manage_members",
            "inventory.manage_branch_access",
            "inventory.manage_settings",
          ]
        : ["inventory.view", "inventory.view_stock", "inventory.record_sales"],
    };
  },
});
