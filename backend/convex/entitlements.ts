import { query } from "./_generated/server.js";
import { v } from "convex/values";
import { DEFAULT_PLANS } from "./plans.js";
import { resolveOrganization } from "./applications.js";

function getEntitlementsFromPlan(plan: any, isTrial: boolean) {
  const limits = plan?.limits || {};
  const maxApps = limits.maxAppsPerOrganization ?? limits.maxAppsPerWorkspace ?? limits.apps ?? 1;
  const maxBranches = limits.maxBranchesPerApp ?? limits.branches ?? 1;
  const maxOrgs = limits.maxOrganizations ?? limits.maxWorkspaces ?? limits.orgs ?? 1;
  const maxMembers = limits.maxMembersPerOrganization ?? limits.maxMembersPerWorkspace ?? limits.members ?? 2;
  const maxProducts = limits.maxProductsPerWorkspace ?? limits.products ?? 500;
  const maxTransactions = limits.maxTransactionsPerMonth ?? limits.transactions ?? 300;

  return {
    planKey: plan?.key || (isTrial ? "free_trial" : "standard"),
    planName: plan?.name || (isTrial ? "Free Trial" : "Standard"),
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
    isTrial,
  };
}

/**
 * Authoritative helper to fetch organization subscription and plan
 */
async function getSubscriptionForWorkspaceOrOrg(ctx: any, rawId: string) {
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
  const isPaidActive = sub.status === "active" && (rawKey === "standard" || rawKey === "premium");
  const isTrialing = sub.status === "trial" || sub.status === "trialing";
  const activePlanKey = isPaidActive ? rawKey : isTrialing ? "free_trial" : "free_trial";

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
    isTrial: activePlanKey === "free_trial" || activePlanKey === "free",
    org,
    workspace,
    targetOrgId,
    targetWsId,
  };
}

/**
 * Query: Get user's active entitlements based on their organizations
 */
export const getUserEntitlements = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // Count owned workspaces
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

    // If user has an active organization, resolve its plan
    let activeSub: any = null;
    let plan = DEFAULT_PLANS.find((p) => p.key === "free_trial") || DEFAULT_PLANS[0];

    for (const om of ownerMemberships) {
      const sub = await ctx.db
        .query("subscriptions")
        .withIndex("by_organizationId", (q: any) => q.eq("organizationId", om.organizationId))
        .first();
      if (sub && sub.status === "active" && sub.planKey === "standard") {
        activeSub = sub;
        plan = (DEFAULT_PLANS.find((p) => p.key === "standard") as any) || plan;
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
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const { plan, subscription, isTrial, targetOrgId, targetWsId } =
      await getSubscriptionForWorkspaceOrOrg(ctx, args.workspaceId);

    const entitlements = getEntitlementsFromPlan(plan, isTrial);

    // Live usage counters
    let activeAppCount = 0;
    let activeBranchCount = 0;
    let activeMemberCount = 0;

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

    return {
      ...entitlements,
      status: subscription?.status || (isTrial ? "trialing" : "active"),
      trialEnd: isTrial ? (subscription?.trialEnd || subscription?.trialEndsAt) : null,
      currentPeriodEnd: subscription?.currentPeriodEnd,
      usage: {
        workspaces: 1,
        apps: activeAppCount,
        branches: activeBranchCount,
        members: activeMemberCount,
        products: 0,
        transactions: 0,
      },
    };
  },
});

/**
 * Query: Check if user is eligible for a Free Trial organization (limit: 1 per user)
 */
export const getFreeTrialEligibility = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // 1. Check workspaces owned by user with trial status
    const ownedWorkspaces = await ctx.db
      .query("workspaces")
      .withIndex("by_owner", (q: any) => q.eq("ownerId", args.userId))
      .filter((q: any) => q.neq(q.field("status"), "deleted"))
      .collect();

    // 2. Check organization memberships owned by user
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

    // Check subscriptions for any owned organization
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

    for (const ws of ownedWorkspaces) {
      const sub = await ctx.db
        .query("subscriptions")
        .withIndex("by_workspace", (q: any) => q.eq("workspaceId", ws._id))
        .first();

      if (sub && (sub.planKey === "free_trial" || sub.planKey === "free" || sub.status === "trial" || sub.status === "trialing")) {
        return {
          allowed: false,
          hasFreeTrial: true,
          organizationName: ws.name,
          organizationId: ws._id,
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
 * Query: Validate whether a user can create another workspace or organization (limit: 3 owned)
 */
export const canCreateWorkspace = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // 1. Gather all active owned organizations
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

    // Check for superadmin / override limit
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

    // Check Free Trial status
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
      current: currentOwned,
      max: maxOwned,
      currentOwned,
      maximumOwned: maxOwned,
      currentOwnedOrganizations: currentOwned,
      maxOwnedOrganizations: maxOwned,
      remaining: Math.max(0, maxOwned - currentOwned),
      freeTrial: {
        available: !hasFreeTrial,
        hasFreeTrial,
        organizationName: trialOrgName,
        reason: hasFreeTrial
          ? "You already have an organization on Free Trial."
          : undefined,
      },
    };
  },
});

/**
 * Query: Validate whether a workspace can activate an app
 */
export const canActivateApp = query({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
    productKey: v.string(),
  },
  handler: async (ctx, args) => {
    const { plan, isTrial, targetOrgId, targetWsId } =
      await getSubscriptionForWorkspaceOrOrg(ctx, args.workspaceId);

    const entitlements = getEntitlementsFromPlan(plan, isTrial);

    let activeCount = 0;
    let isAlreadyActive = false;
    const normalizedTarget = args.productKey.toLowerCase();

    if (targetOrgId) {
      const orgApps = await ctx.db
        .query("orgApplications")
        .withIndex("by_organizationId", (q: any) => q.eq("organizationId", targetOrgId))
        .filter((q: any) => q.eq(q.field("enabled"), true))
        .collect();

      activeCount = orgApps.length;
      for (const oa of orgApps) {
        const app = await ctx.db.get(oa.applicationId);
        if (app && (app.key || "").toLowerCase() === normalizedTarget) {
          isAlreadyActive = true;
          break;
        }
      }
    } else if (targetWsId) {
      const wsApps = await ctx.db
        .query("workspaceProducts")
        .withIndex("by_workspace", (q: any) => q.eq("workspaceId", targetWsId))
        .filter((q: any) => q.eq(q.field("status"), "active"))
        .collect();

      activeCount = wsApps.length;
      isAlreadyActive = wsApps.some((a: any) => (a.productKey || "").toLowerCase() === normalizedTarget);
    }

    const isAllowedByPlan =
      entitlements.allowedApps.includes("*") ||
      entitlements.allowedApps.some((app: string) => {
        const appNorm = app.toLowerCase();
        return (
          appNorm === normalizedTarget ||
          (appNorm === "tasks" && normalizedTarget === "taskmanagement") ||
          (appNorm === "taskmanagement" && normalizedTarget === "tasks")
        );
      });

    if (!isAllowedByPlan) {
      return {
        allowed: false,
        reason: isTrial
          ? "Free Trial includes Inventory only. Upgrade to Standard to activate this application."
          : "App not included in your plan",
        current: activeCount,
        max: entitlements.maxAppsPerOrganization,
        remaining: 0,
      };
    }

    if (entitlements.maxAppsPerOrganization === "unlimited" || entitlements.maxAppsPerOrganization >= 999999) {
      return {
        allowed: true,
        current: activeCount,
        max: "unlimited" as const,
        remaining: "unlimited" as const,
        isAlreadyActive,
        isAllowedByPlan: true,
      };
    }

    const maxNumeric = Number(entitlements.maxAppsPerOrganization) || (isTrial ? 1 : 3);
    const allowed = isAlreadyActive || activeCount < maxNumeric;

    return {
      allowed,
      isAlreadyActive,
      isAllowedByPlan: true,
      current: activeCount,
      max: maxNumeric,
      remaining: Math.max(0, maxNumeric - activeCount),
    };
  },
});

/**
 * Query: Validate whether a workspace can create another branch for an app
 */
export const canCreateBranch = query({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
    productKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { plan, isTrial, targetOrgId, targetWsId } =
      await getSubscriptionForWorkspaceOrOrg(ctx, args.workspaceId);

    const entitlements = getEntitlementsFromPlan(plan, isTrial);

    let existingBranches: any[] = [];
    if (targetOrgId) {
      existingBranches = await ctx.db
        .query("branches")
        .withIndex("by_organizationId", (q: any) => q.eq("organizationId", targetOrgId))
        .collect();
    } else if (targetWsId) {
      existingBranches = await ctx.db
        .query("branches")
        .withIndex("by_workspace", (q: any) => q.eq("workspaceId", targetWsId))
        .collect();
    }

    const activeBranches = existingBranches.filter(
      (b: any) =>
        b.status !== "deleted" &&
        b.status !== "ARCHIVED" &&
        (!args.productKey || !b.productKey || b.productKey === args.productKey)
    );

    const maxNumeric = Number(entitlements.maxBranchesPerApp) || (isTrial ? 1 : 3);
    const allowed = activeBranches.length < maxNumeric;

    return {
      allowed,
      current: activeBranches.length,
      max: maxNumeric,
      remaining: Math.max(0, maxNumeric - activeBranches.length),
      planKey: entitlements.planKey,
      upgradePlan: isTrial ? "standard" : undefined,
      message: isTrial && !allowed ? "Your Free Trial includes one Inventory branch." : undefined,
    };
  },
});

/**
 * Query: Validate whether a workspace can invite another team member
 */
export const canInviteMember = query({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
  },
  handler: async (ctx, args) => {
    const { plan, isTrial, targetOrgId, targetWsId } =
      await getSubscriptionForWorkspaceOrOrg(ctx, args.workspaceId);

    const entitlements = getEntitlementsFromPlan(plan, isTrial);

    let currentCount = 0;
    if (targetOrgId) {
      const members = await ctx.db
        .query("organizationMemberships")
        .withIndex("by_organizationId", (q: any) => q.eq("organizationId", targetOrgId))
        .filter((q: any) => q.eq(q.field("status"), "ACTIVE"))
        .collect();
      currentCount = members.length;
    } else if (targetWsId) {
      const members = await ctx.db
        .query("workspaceMemberships")
        .withIndex("by_workspace", (q: any) => q.eq("workspaceId", targetWsId))
        .filter((q: any) => q.eq(q.field("status"), "active"))
        .collect();
      currentCount = members.length;
    }

    const max = Number(entitlements.maxMembersPerOrganization) || (isTrial ? 2 : 10);
    return {
      allowed: currentCount < max,
      current: currentCount,
      max,
      remaining: Math.max(0, max - currentCount),
      planKey: entitlements.planKey,
    };
  },
});

/**
 * Query: Standard Organization Context Response (Contract Section 16)
 */
export const getOrganizationContext = query({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { org, orgId, workspace, workspaceId, sub } = await resolveOrganization(ctx, args.workspaceId);
    const targetOrgId = orgId || org?._id;
    const targetWsId = workspaceId || workspace?._id;

    // Membership
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

    // Subscription & Plan
    const { plan, subscription, isTrial } = await getSubscriptionForWorkspaceOrOrg(ctx, args.workspaceId);

    // Branches
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

    const primaryBranch = branches.find((b) => b.isPrimary) || branches[0];

    // Onboarding status for inventory
    let onboardingStatus = "setup_incomplete";
    const flow = await ctx.db
      .query("onboardingFlows")
      .withIndex("by_workspace_product", (q: any) =>
        q.eq("workspaceId", targetWsId || targetOrgId).eq("productKey", "inventory")
      )
      .first();
    if (flow?.status === "COMPLETED" || flow?.status === "completed") {
      onboardingStatus = "completed";
    }

    const role = (membership?.role || "owner").toLowerCase();
    const isOwnerOrAdmin = role === "owner" || role === "admin";

    return {
      workspace: {
        id: (targetWsId || targetOrgId || "").toString(),
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
          status: onboardingStatus,
          access: true,
        },
      ],
      branches: branches.map((b) => ({
        id: b._id.toString(),
        name: b.name,
        isPrimary: !!b.isPrimary,
        status: b.status || "active",
      })),
      permissions: isOwnerOrAdmin
        ? [
            "inventory.view",
            "inventory.manage_products",
            "inventory.view_stock",
            "inventory.receive_stock",
            "inventory.adjust_stock",
            "inventory.record_sales",
            "inventory.cancel_sales",
            "inventory.process_returns",
            "inventory.view_cost",
            "inventory.view_profit",
            "inventory.view_reports",
            "inventory.export_data",
            "inventory.manage_members",
            "inventory.manage_branch_access",
            "inventory.manage_settings",
          ]
        : [
            "inventory.view",
            "inventory.view_stock",
            "inventory.record_sales",
          ],
    };
  },
});
