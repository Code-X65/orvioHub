import { mutation, query } from "./_generated/server.js";
import { v } from "convex/values";
import { requireAdminPermission } from "./adminAuth.js";

// Helper to authenticate admin
async function verifyAdminSession(ctx: any, sessionToken?: string, permission = "admin.onboarding.view") {
  return requireAdminPermission(ctx, sessionToken, permission);
}

async function logAudit(ctx: any, adminId: any, action: string, resourceId?: string, details?: any) {
  await ctx.db.insert("adminAuditLogs", {
    adminId,
    action,
    resourceType: "onboarding",
    resourceId,
    details,
    createdAt: Date.now(),
  });
}

/**
 * getOnboardingFunnel
 * Calculates conversion rates across onboarding stages
 */
export const getOnboardingFunnel = query({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    await verifyAdminSession(ctx, args.sessionToken);

    const allUsers = await ctx.db.query("users").collect();
    const totalSignups = allUsers.length;

    const profileCompleted = allUsers.filter(
      (u: any) => !!u.profileCompletedAt || (!!u.firstName && !!u.lastName)
    ).length;

    const allMemberships = await ctx.db.query("workspaceMemberships").collect();
    const usersWithOrg = new Set(allMemberships.map((m: any) => m.userId)).size;

    const allWorkspaceProducts = await ctx.db.query("workspaceProducts").collect();
    const usersWithProduct = new Set(allWorkspaceProducts.map((p: any) => p.activatedBy)).size;

    const allFlows = await ctx.db.query("onboardingFlows").collect();
    const completedFlows = allFlows.filter((f: any) => f.status === "COMPLETED").length;

    // Conversion rate calculations
    const calcRate = (numerator: number, denominator: number) => {
      if (denominator === 0) return 0;
      return Math.round((numerator / denominator) * 100);
    };

    const stages = [
      {
        id: "signup",
        name: "1. Account Created",
        count: totalSignups,
        conversionRate: 100,
        dropoffRate: 0,
      },
      {
        id: "profile",
        name: "2. Profile Completed",
        count: profileCompleted,
        conversionRate: calcRate(profileCompleted, totalSignups),
        dropoffRate: 100 - calcRate(profileCompleted, totalSignups),
      },
      {
        id: "organization",
        name: "3. Organization Provisioned",
        count: usersWithOrg,
        conversionRate: calcRate(usersWithOrg, profileCompleted || totalSignups),
        dropoffRate: 100 - calcRate(usersWithOrg, profileCompleted || totalSignups),
      },
      {
        id: "product",
        name: "4. Product Activated",
        count: usersWithProduct,
        conversionRate: calcRate(usersWithProduct, usersWithOrg || 1),
        dropoffRate: 100 - calcRate(usersWithProduct, usersWithOrg || 1),
      },
      {
        id: "completed",
        name: "5. Onboarding Finished",
        count: completedFlows,
        conversionRate: calcRate(completedFlows, usersWithProduct || 1),
        dropoffRate: 100 - calcRate(completedFlows, usersWithProduct || 1),
      },
    ];

    return {
      stages,
      overallConversionRate: calcRate(completedFlows, totalSignups),
    };
  },
});

/**
 * getIncompleteOnboarding
 * Lists users currently stalled in the onboarding process
 */
export const getIncompleteOnboarding = query({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    await verifyAdminSession(ctx, args.sessionToken);

    const now = Date.now();
    const flows = await ctx.db
      .query("onboardingFlows")
      .filter((q) => q.neq(q.field("status"), "COMPLETED"))
      .collect();

    const results = [];
    for (const f of flows) {
      const user = await ctx.db.get(f.userId);
      const ws = f.workspaceId ? await ctx.db.get(f.workspaceId) : null;

      const daysInactive = Math.floor((now - (f.lastUpdatedAt || f.startedAt)) / (24 * 60 * 60 * 1000));

      results.push({
        id: f._id,
        userId: f.userId,
        userName: user?.name || "User",
        userEmail: user?.email || "Unknown",
        workspaceId: f.workspaceId,
        workspaceName: (ws && "name" in ws) ? (ws.name as string) : "Pending Organization",
        productKey: f.productKey,
        currentStep: f.currentStep,
        status: f.status,
        completedSteps: f.completedSteps || [],
        daysInactive,
        lastUpdatedAt: f.lastUpdatedAt || f.startedAt,
      });
    }

    // Sort by most inactive
    results.sort((a, b) => b.daysInactive - a.daysInactive);
    return results;
  },
});

/**
 * getOnboardingStepStats
 * Aggregates user counts and completion across individual steps
 */
export const getOnboardingStepStats = query({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    await verifyAdminSession(ctx, args.sessionToken);

    const flows = await ctx.db.query("onboardingFlows").collect();

    const stepCounts: Record<string, number> = {};
    for (const f of flows) {
      const step = f.currentStep || "WELCOME";
      stepCounts[step] = (stepCounts[step] || 0) + 1;
    }

    return stepCounts;
  },
});

/**
 * resetUserOnboarding
 * Resets a user's onboarding state back to a chosen step
 */
export const resetUserOnboarding = mutation({
  args: {
    sessionToken: v.string(),
    flowId: v.id("onboardingFlows"),
    targetStep: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { admin } = await verifyAdminSession(ctx, args.sessionToken, "admin.onboarding.manage");

    const flow = await ctx.db.get(args.flowId);
    if (!flow) throw new Error("Onboarding flow not found.");

    const now = Date.now();
    const step = args.targetStep || "WELCOME";

    await ctx.db.patch(args.flowId, {
      status: "IN_PROGRESS",
      currentStep: step,
      completedSteps: [],
      lastUpdatedAt: now,
    });

    await logAudit(ctx, admin._id, "USER_ONBOARDING_RESET", args.flowId, {
      userId: flow.userId,
      workspaceId: flow.workspaceId,
      productKey: flow.productKey,
      resetToStep: step,
    });

    return { success: true };
  },
});
