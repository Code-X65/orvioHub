import { query } from "./_generated/server.js";
import { v } from "convex/values";

// Helper to authenticate admin
async function verifyAdminSession(ctx: any, sessionToken?: string) {
  if (!sessionToken) throw new Error("Admin authentication required.");
  const session = await ctx.db
    .query("adminSessions")
    .withIndex("by_token", (q: any) => q.eq("sessionToken", sessionToken))
    .first();

  if (!session || session.expiresAt < Date.now()) {
    throw new Error("Invalid or expired session.");
  }
  const admin = await ctx.db.get(session.adminId);
  if (!admin || !admin.isActive) {
    throw new Error("Unauthorized admin account.");
  }
  return { admin, session };
}

/**
 * getDashboardOverview
 * Aggregates platform-wide analytics for the super admin dashboard
 */
export const getDashboardOverview = query({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    await verifyAdminSession(ctx, args.sessionToken);

    const now = Date.now();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayTimestamp = startOfToday.getTime();

    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    // 1. Users Metrics
    const allUsers = await ctx.db.query("users").collect();
    const totalUsers = allUsers.length;
    const verifiedUsers = allUsers.filter((u: any) => u.emailVerified).length;
    const unverifiedUsers = totalUsers - verifiedUsers;

    const newUsersToday = allUsers.filter((u: any) => u.createdAt >= todayTimestamp).length;
    const newUsersThisWeek = allUsers.filter((u: any) => u.createdAt >= sevenDaysAgo).length;
    const newUsersThisMonth = allUsers.filter((u: any) => u.createdAt >= thirtyDaysAgo).length;

    // Active users in last 24h
    const recentSessions = await ctx.db.query("sessions").collect();
    const activeUsersLast24h = new Set(
      recentSessions
        .filter((s: any) => (s.lastActiveAt || s.createdAt || 0) >= oneDayAgo)
        .map((s: any) => s.userId)
    ).size;

    // 2. Organizations / Workspaces Metrics
    const allWorkspaces = await ctx.db.query("workspaces").collect();
    const totalOrganizations = allWorkspaces.length;
    const activeOrganizations = allWorkspaces.filter(
      (w: any) => (w.status || "active").toLowerCase() === "active"
    ).length;
    const organizationsCreatedToday = allWorkspaces.filter(
      (w: any) => (w.createdAt || 0) >= todayTimestamp
    ).length;

    // 3. Incomplete Onboarding & Funnel Metrics
    const onboardingFlows = await ctx.db.query("onboardingFlows").collect();
    const incompleteOnboarding = onboardingFlows.filter(
      (f: any) => f.status === "IN_PROGRESS" || f.status === "NOT_STARTED"
    ).length;
    const completedOnboarding = onboardingFlows.filter(
      (f: any) => f.status === "COMPLETED"
    ).length;

    const usersWithCompletedProfile = allUsers.filter(
      (u: any) => !!u.profileCompletedAt || (!!u.firstName && !!u.lastName)
    ).length;

    const workspaceMemberships = await ctx.db.query("workspaceMemberships").collect();
    const usersWithOrganization = new Set(workspaceMemberships.map((m: any) => m.userId)).size;

    const workspaceProducts = await ctx.db.query("workspaceProducts").collect();
    const usersWithActivatedProduct = new Set(
      workspaceProducts.map((p: any) => p.activatedBy)
    ).size;

    // 4. Product Activations breakdown
    const productActivationsMap: Record<string, number> = {};
    for (const wp of workspaceProducts) {
      const key = wp.productKey || "unknown";
      productActivationsMap[key] = (productActivationsMap[key] || 0) + 1;
    }

    // 5. Recent Admin Activities & System Audit Events
    const recentAuditLogs = await ctx.db
      .query("adminAuditLogs")
      .withIndex("by_created")
      .order("desc")
      .take(6);

    return {
      stats: {
        totalUsers,
        verifiedUsers,
        unverifiedUsers,
        activeUsersLast24h,
        newUsersToday,
        newUsersThisWeek,
        newUsersThisMonth,
        totalOrganizations,
        activeOrganizations,
        incompleteOnboarding,
        organizationsCreatedToday,
      },
      productActivations: productActivationsMap,
      onboardingFunnel: {
        totalSignups: totalUsers,
        profileCompleted: usersWithCompletedProfile,
        orgCreated: usersWithOrganization,
        productActivated: usersWithActivatedProduct,
        onboardingCompleted: completedOnboarding,
      },
      recentActivities: recentAuditLogs,
    };
  },
});

/**
 * getUserStats
 * Returns user growth timeline for the last 30 days
 */
export const getUserStats = query({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    await verifyAdminSession(ctx, args.sessionToken);

    const now = Date.now();
    const days: { date: string; signups: number; activeSessions: number }[] = [];

    const allUsers = await ctx.db.query("users").collect();
    const allSessions = await ctx.db.query("sessions").collect();

    for (let i = 29; i >= 0; i--) {
      const d = new Date(now - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split("T")[0];

      const startDay = new Date(d);
      startDay.setHours(0, 0, 0, 0);
      const startMs = startDay.getTime();
      const endMs = startMs + 24 * 60 * 60 * 1000;

      const signups = allUsers.filter((u: any) => u.createdAt >= startMs && u.createdAt < endMs).length;
      const activeSessions = allSessions.filter((s: any) => (s.lastActiveAt || s.createdAt || 0) >= startMs && (s.lastActiveAt || s.createdAt || 0) < endMs).length;

      days.push({
        date: dateStr,
        signups,
        activeSessions,
      });
    }

    const totalUsers = allUsers.length;
    const verifiedUsers = allUsers.filter((u: any) => u.emailVerified).length;
    const verificationRate = totalUsers > 0 ? Math.round((verifiedUsers / totalUsers) * 100) : 0;

    return {
      dailyGrowth: days,
      verificationRate,
      totalUsers,
      totalActiveSessions: allSessions.filter((s: any) => !s.revokedAt && s.expiresAt > now).length,
    };
  },
});

/**
 * getOrganizationStats
 * Returns organization topology, types, and member distribution
 */
export const getOrganizationStats = query({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    await verifyAdminSession(ctx, args.sessionToken);

    const allWorkspaces = await ctx.db.query("workspaces").collect();
    const allMemberships = await ctx.db.query("workspaceMemberships").collect();
    const allProducts = await ctx.db.query("workspaceProducts").collect();

    const statusCounts: Record<string, number> = { active: 0, suspended: 0, archived: 0 };
    const typeCounts: Record<string, number> = {};

    for (const ws of allWorkspaces) {
      const st = (ws.status || "active").toLowerCase();
      statusCounts[st] = (statusCounts[st] || 0) + 1;

      const tp = ws.type || "business";
      typeCounts[tp] = (typeCounts[tp] || 0) + 1;
    }

    const totalWorkspaces = allWorkspaces.length;
    const avgMembersPerOrg = totalWorkspaces > 0
      ? (allMemberships.length / totalWorkspaces).toFixed(1)
      : "0";

    return {
      totalOrganizations: totalWorkspaces,
      byStatus: statusCounts,
      byType: typeCounts,
      averageMembers: avgMembersPerOrg,
      totalProductActivations: allProducts.length,
    };
  },
});

/**
 * getProductStats
 * Returns product activation counts and popularity
 */
export const getProductStats = query({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    await verifyAdminSession(ctx, args.sessionToken);

    const products = await ctx.db.query("products").collect();
    const workspaceProducts = await ctx.db.query("workspaceProducts").collect();

    const activationCounts: Record<string, number> = {};
    for (const wp of workspaceProducts) {
      const key = wp.productKey || "unknown";
      activationCounts[key] = (activationCounts[key] || 0) + 1;
    }

    const productDetails = products.map((p: any) => ({
      key: p.key,
      name: p.name,
      description: p.description,
      status: p.status,
      activations: activationCounts[p.key] || 0,
    }));

    return {
      products: productDetails,
      totalActivations: workspaceProducts.length,
    };
  },
});
