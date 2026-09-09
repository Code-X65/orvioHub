import { query } from "./_generated/server.js";
import { v } from "convex/values";
import { DEFAULT_PLANS } from "./plans.js";

function getEntitlementsFromPlan(plan: any) {
  const limits = plan?.limits || {};
  const maxApps = limits.maxAppsPerOrganization ?? limits.maxAppsPerWorkspace ?? limits.apps ?? 1;
  const maxBranches = limits.maxBranchesPerApp ?? limits.branches ?? 1;
  const maxOrgs = limits.maxOrganizations ?? limits.maxWorkspaces ?? limits.orgs ?? 1;
  const maxMembers = limits.maxMembersPerOrganization ?? limits.maxMembersPerWorkspace ?? limits.members ?? 2;
  const maxProducts = limits.maxProductsPerWorkspace ?? limits.products ?? 500;
  const maxTransactions = limits.maxTransactionsPerMonth ?? limits.transactions ?? 500;

  return {
    planKey: plan?.key || "free",
    planName: plan?.name || "Free Trial",
    maxOrganizations: maxOrgs,
    maxWorkspaces: maxOrgs,
    maxAppsPerOrganization: maxApps,
    maxAppsPerWorkspace: maxApps,
    maxBranchesPerApp: maxBranches,
    maxMembersPerOrganization: maxMembers,
    maxMembersPerWorkspace: maxMembers,
    maxProductsPerWorkspace: maxProducts,
    maxTransactionsPerMonth: maxTransactions,
    allowedApps: plan?.allowedAppKeys || plan?.allowedApps || ["inventory", "tasks", "taskmanagement", "pos"],
    isTrial: plan?.key === "free" || plan?.key === "free_trial",
  };
}

/**
 * Helper to fetch subscription and plan for a user
 */
async function getPlanForUser(ctx: any, userId: any) {
  let subscription = await ctx.db
    .query("subscriptions")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();

  if (!subscription) {
    const ownedWorkspaces = await ctx.db
      .query("workspaces")
      .withIndex("by_owner", (q: any) => q.eq("ownerId", userId))
      .collect();

    for (const ws of ownedWorkspaces) {
      const wsSub = await ctx.db
        .query("subscriptions")
        .withIndex("by_workspace", (q: any) => q.eq("workspaceId", ws._id))
        .first();
      if (wsSub && wsSub.status === "active") {
        subscription = wsSub;
        break;
      }
    }
  }

  const defaultPlan = DEFAULT_PLANS.find((p) => p.key === "free") || DEFAULT_PLANS[0];

  if (!subscription) {
    return { plan: defaultPlan, subscription: null };
  }

  const planKey = subscription.planKey;
  const alternateKey = planKey === "free" ? "free_trial" : planKey === "free_trial" ? "free" : null;

  let plan = await ctx.db
    .query("plans")
    .withIndex("by_key", (q: any) => q.eq("key", planKey))
    .first();

  if (!plan && alternateKey) {
    plan = await ctx.db
      .query("plans")
      .withIndex("by_key", (q: any) => q.eq("key", alternateKey))
      .first();
  }

  if (!plan) {
    plan = (DEFAULT_PLANS.find((p) => p.key === planKey || p.key === alternateKey) as any) || defaultPlan;
  }

  return { plan, subscription };
}

/**
 * Query: Get user's active entitlements based on their user subscription
 */
export const getUserEntitlements = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const { plan, subscription } = await getPlanForUser(ctx, args.userId);
    const entitlements = getEntitlementsFromPlan(plan);

    // Compute live owned workspaces & organizations usage
    const ownedWorkspaces = await ctx.db
      .query("workspaces")
      .withIndex("by_owner", (q: any) => q.eq("ownerId", args.userId))
      .filter((q: any) => q.eq(q.field("status"), "active"))
      .collect();

    // Also count organization memberships where user is OWNER
    const ownerMemberships = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_userId", (q: any) => q.eq("userId", args.userId))
      .filter((q: any) => q.eq(q.field("role"), "OWNER"))
      .collect();

    const totalWorkspaces = Math.max(ownedWorkspaces.length, ownerMemberships.length);

    return {
      ...entitlements,
      status: subscription?.status || "trialing",
      trialEnd: subscription?.trialEnd,
      currentPeriodEnd: subscription?.currentPeriodEnd,
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
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) throw new Error("Workspace not found");

    const ownerId = workspace.ownerId;
    let subscription: any = null;

    if (ownerId) {
      subscription = await ctx.db
        .query("subscriptions")
        .withIndex("by_user", (q: any) => q.eq("userId", ownerId))
        .first();
    }

    if (!subscription) {
      subscription = await ctx.db
        .query("subscriptions")
        .withIndex("by_workspace", (q: any) => q.eq("workspaceId", args.workspaceId))
        .first();
    }

    const defaultPlan = DEFAULT_PLANS.find((p) => p.key === "free") || DEFAULT_PLANS[0];
    const planKey = subscription?.planKey || "free";
    const alternateKey = planKey === "free" ? "free_trial" : planKey === "free_trial" ? "free" : null;

    let plan = await ctx.db
      .query("plans")
      .withIndex("by_key", (q: any) => q.eq("key", planKey))
      .first();

    if (!plan && alternateKey) {
      plan = await ctx.db
        .query("plans")
        .withIndex("by_key", (q: any) => q.eq("key", alternateKey))
        .first();
    }

    if (!plan) {
      plan = (DEFAULT_PLANS.find((p) => p.key === planKey || p.key === alternateKey) as any) || defaultPlan;
    }

    const entitlements = getEntitlementsFromPlan(plan);

    // Live usage counters
    const activeApps = await ctx.db
      .query("workspaceProducts")
      .withIndex("by_workspace", (q: any) => q.eq("workspaceId", args.workspaceId))
      .filter((q: any) => q.eq(q.field("status"), "active"))
      .collect();

    const activeBranches = await ctx.db
      .query("branches")
      .withIndex("by_workspace", (q: any) => q.eq("workspaceId", args.workspaceId))
      .filter((q: any) => q.eq(q.field("status"), "active"))
      .collect();

    const activeMembers = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_workspace", (q: any) => q.eq("workspaceId", args.workspaceId))
      .filter((q: any) => q.eq(q.field("status"), "active"))
      .collect();

    const ownedWorkspaces = ownerId
      ? await ctx.db
          .query("workspaces")
          .withIndex("by_owner", (q: any) => q.eq("ownerId", ownerId))
          .filter((q: any) => q.eq(q.field("status"), "active"))
          .collect()
      : [workspace];

    return {
      ...entitlements,
      status: subscription?.status || "trialing",
      trialEnd: subscription?.trialEnd,
      currentPeriodEnd: subscription?.currentPeriodEnd,
      usage: {
        workspaces: ownedWorkspaces.length,
        apps: activeApps.length,
        branches: activeBranches.length,
        members: activeMembers.length,
        products: 0,
        transactions: 0,
      },
    };
  },
});

/**
 * Query: Validate whether a user can create another workspace or organization
 */
export const canCreateWorkspace = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const { plan } = await getPlanForUser(ctx, args.userId);
    const entitlements = getEntitlementsFromPlan(plan);

    const existingWorkspaces = await ctx.db
      .query("workspaces")
      .withIndex("by_owner", (q: any) => q.eq("ownerId", args.userId))
      .filter((q: any) => q.eq(q.field("status"), "active"))
      .collect();

    const ownerMemberships = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_userId", (q: any) => q.eq("userId", args.userId))
      .filter((q: any) => q.eq(q.field("role"), "OWNER"))
      .collect();

    const current = Math.max(existingWorkspaces.length, ownerMemberships.length);
    const max = entitlements.maxOrganizations;

    return {
      allowed: current < max,
      current,
      max,
      remaining: Math.max(0, max - current),
      planKey: entitlements.planKey,
    };
  },
});

/**
 * Query: Validate whether a workspace can activate an app
 */
export const canActivateApp = query({
  args: { workspaceId: v.id("workspaces"), productKey: v.string() },
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) throw new Error("Workspace not found");

    const ownerId = workspace.ownerId;
    let subscription: any = null;

    if (ownerId) {
      subscription = await ctx.db
        .query("subscriptions")
        .withIndex("by_user", (q: any) => q.eq("userId", ownerId))
        .first();
    }

    if (!subscription) {
      subscription = await ctx.db
        .query("subscriptions")
        .withIndex("by_workspace", (q: any) => q.eq("workspaceId", args.workspaceId))
        .first();
    }

    const defaultPlan = DEFAULT_PLANS.find((p) => p.key === "free") || DEFAULT_PLANS[0];
    const planKey = subscription?.planKey || "free";
    const alternateKey = planKey === "free" ? "free_trial" : planKey === "free_trial" ? "free" : null;

    let plan = await ctx.db
      .query("plans")
      .withIndex("by_key", (q: any) => q.eq("key", planKey))
      .first();

    if (!plan && alternateKey) {
      plan = await ctx.db
        .query("plans")
        .withIndex("by_key", (q: any) => q.eq("key", alternateKey))
        .first();
    }

    if (!plan) {
      plan = (DEFAULT_PLANS.find((p) => p.key === planKey || p.key === alternateKey) as any) || defaultPlan;
    }

    const entitlements = getEntitlementsFromPlan(plan);
    const activatedApps = await ctx.db
      .query("workspaceProducts")
      .withIndex("by_workspace", (q: any) => q.eq("workspaceId", args.workspaceId))
      .filter((q: any) => q.eq(q.field("status"), "active"))
      .collect();

    const isAlreadyActive = activatedApps.some((a) => a.productKey === args.productKey);
    const normalizedTarget = args.productKey.toLowerCase();
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
        reason: "App not included in your plan",
        current: activatedApps.length,
        max: entitlements.maxAppsPerOrganization,
        remaining: 0,
      };
    }

    if (entitlements.maxAppsPerOrganization === "unlimited") {
      return {
        allowed: true,
        current: activatedApps.length,
        max: "unlimited" as const,
        remaining: "unlimited" as const,
        isAlreadyActive,
        isAllowedByPlan: true,
      };
    }

    const maxNumeric = Number(entitlements.maxAppsPerOrganization) || 1;
    const allowed = isAlreadyActive || activatedApps.length < maxNumeric;

    return {
      allowed,
      isAlreadyActive,
      isAllowedByPlan: true,
      current: activatedApps.length,
      max: maxNumeric,
      remaining: Math.max(0, maxNumeric - activatedApps.length),
    };
  },
});

/**
 * Query: Validate whether a workspace can create another branch for an app
 */
export const canCreateBranch = query({
  args: { workspaceId: v.id("workspaces"), productKey: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) throw new Error("Workspace not found");

    const ownerId = workspace.ownerId;
    let subscription: any = null;

    if (ownerId) {
      subscription = await ctx.db
        .query("subscriptions")
        .withIndex("by_user", (q: any) => q.eq("userId", ownerId))
        .first();
    }

    if (!subscription) {
      subscription = await ctx.db
        .query("subscriptions")
        .withIndex("by_workspace", (q: any) => q.eq("workspaceId", args.workspaceId))
        .first();
    }

    const defaultPlan = DEFAULT_PLANS.find((p) => p.key === "free") || DEFAULT_PLANS[0];
    const planKey = subscription?.planKey || "free";
    const alternateKey = planKey === "free" ? "free_trial" : planKey === "free_trial" ? "free" : null;

    let plan = await ctx.db
      .query("plans")
      .withIndex("by_key", (q: any) => q.eq("key", planKey))
      .first();

    if (!plan && alternateKey) {
      plan = await ctx.db
        .query("plans")
        .withIndex("by_key", (q: any) => q.eq("key", alternateKey))
        .first();
    }

    if (!plan) {
      plan = (DEFAULT_PLANS.find((p) => p.key === planKey || p.key === alternateKey) as any) || defaultPlan;
    }

    const entitlements = getEntitlementsFromPlan(plan);

    let branchQuery = ctx.db
      .query("branches")
      .withIndex("by_workspace", (q: any) => q.eq("workspaceId", args.workspaceId));

    const existingBranches = (await branchQuery.collect()).filter(
      (b: any) => (!args.productKey || !b.productKey || b.productKey === args.productKey) && b.status === "active"
    );

    if (entitlements.maxBranchesPerApp === "unlimited") {
      return {
        allowed: true,
        current: existingBranches.length,
        max: "unlimited" as const,
        remaining: "unlimited" as const,
      };
    }

    const maxNumeric = Number(entitlements.maxBranchesPerApp) || 1;
    return {
      allowed: existingBranches.length < maxNumeric,
      current: existingBranches.length,
      max: maxNumeric,
      remaining: Math.max(0, maxNumeric - existingBranches.length),
    };
  },
});

/**
 * Query: Validate whether a workspace can invite another team member
 */
export const canInviteMember = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) throw new Error("Workspace not found");

    const ownerId = workspace.ownerId;
    let subscription: any = null;

    if (ownerId) {
      subscription = await ctx.db
        .query("subscriptions")
        .withIndex("by_user", (q: any) => q.eq("userId", ownerId))
        .first();
    }

    if (!subscription) {
      subscription = await ctx.db
        .query("subscriptions")
        .withIndex("by_workspace", (q: any) => q.eq("workspaceId", args.workspaceId))
        .first();
    }

    const defaultPlan = DEFAULT_PLANS.find((p) => p.key === "free") || DEFAULT_PLANS[0];
    const planKey = subscription?.planKey || "free";
    const alternateKey = planKey === "free" ? "free_trial" : planKey === "free_trial" ? "free" : null;

    let plan = await ctx.db
      .query("plans")
      .withIndex("by_key", (q: any) => q.eq("key", planKey))
      .first();

    if (!plan && alternateKey) {
      plan = await ctx.db
        .query("plans")
        .withIndex("by_key", (q: any) => q.eq("key", alternateKey))
        .first();
    }

    if (!plan) {
      plan = (DEFAULT_PLANS.find((p) => p.key === planKey || p.key === alternateKey) as any) || defaultPlan;
    }

    const entitlements = getEntitlementsFromPlan(plan);
    const existingMembers = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_workspace", (q: any) => q.eq("workspaceId", args.workspaceId))
      .filter((q: any) => q.eq(q.field("status"), "active"))
      .collect();

    const max = entitlements.maxMembersPerOrganization;
    return {
      allowed: existingMembers.length < max,
      current: existingMembers.length,
      max,
      remaining: Math.max(0, max - existingMembers.length),
    };
  },
});
