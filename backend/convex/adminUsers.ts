import { mutation, query } from "./_generated/server.js";
import { v } from "convex/values";
import { DEFAULT_PLANS } from "./plans.js";

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

async function logAudit(ctx: any, adminId: any, action: string, resourceId?: string, details?: any) {
  await ctx.db.insert("adminAuditLogs", {
    adminId,
    action,
    resourceType: "users",
    resourceId,
    details,
    createdAt: Date.now(),
  });
}

/**
 * listUsers
 * Paginated query with search, filter (verified, status, date), and sorting
 */
export const listUsers = query({
  args: {
    sessionToken: v.string(),
    search: v.optional(v.string()),
    verifiedFilter: v.optional(v.union(v.literal("all"), v.literal("verified"), v.literal("unverified"))),
    statusFilter: v.optional(v.string()),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
    sortBy: v.optional(v.string()), // "createdAt" | "lastLoginAt" | "email"
    sortOrder: v.optional(v.string()), // "asc" | "desc"
  },
  handler: async (ctx, args) => {
    await verifyAdminSession(ctx, args.sessionToken);

    let users = await ctx.db.query("users").collect();

    // 1. Search Filter
    if (args.search && args.search.trim()) {
      const q = args.search.toLowerCase().trim();
      users = users.filter((u: any) => {
        const name = (u.name || `${u.firstName || ""} ${u.lastName || ""}`).toLowerCase();
        const email = (u.email || "").toLowerCase();
        return name.includes(q) || email.includes(q);
      });
    }

    // 2. Email Verified Filter
    if (args.verifiedFilter && args.verifiedFilter !== "all") {
      if (args.verifiedFilter === "verified") {
        users = users.filter((u: any) => !!u.emailVerified);
      } else if (args.verifiedFilter === "unverified") {
        users = users.filter((u: any) => !u.emailVerified);
      }
    }

    // 3. Status Filter (ACTIVE / SUSPENDED)
    if (args.statusFilter && args.statusFilter !== "all") {
      const targetStatus = args.statusFilter.toUpperCase();
      users = users.filter((u: any) => (u.status || "ACTIVE") === targetStatus);
    }

    // 4. Sorting
    const sortBy = args.sortBy || "createdAt";
    const sortOrder = args.sortOrder || "desc";
    users.sort((a: any, b: any) => {
      let valA = a[sortBy] ?? 0;
      let valB = b[sortBy] ?? 0;
      if (typeof valA === "string") valA = valA.toLowerCase();
      if (typeof valB === "string") valB = valB.toLowerCase();

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    const totalCount = users.length;
    const page = Math.max(1, args.page || 1);
    const pageSize = Math.min(100, Math.max(1, args.pageSize || 10));
    const offset = (page - 1) * pageSize;
    const paginated = users.slice(offset, offset + pageSize);

    // Enrich with workspace count, ownership, auth identities, subscriptions, and usage
    const [memberships, workspaces, identities, subscriptions, plans, branches, workspaceProducts] = await Promise.all([
      ctx.db.query("workspaceMemberships").collect(),
      ctx.db.query("workspaces").collect(),
      ctx.db.query("authIdentities").collect(),
      ctx.db.query("subscriptions").collect(),
      ctx.db.query("plans").collect(),
      ctx.db.query("branches").collect(),
      ctx.db.query("workspaceProducts").collect(),
    ]);

    const membershipCounts: Record<string, number> = {};
    for (const m of memberships) {
      membershipCounts[m.userId] = (membershipCounts[m.userId] || 0) + 1;
    }

    const ownedWorkspaceUserIds = new Set(workspaces.map((w: any) => w.ownerId));

    const identityMap: Record<string, string[]> = {};
    for (const ident of identities) {
      if (!identityMap[ident.userId]) identityMap[ident.userId] = [];
      if (!identityMap[ident.userId].includes(ident.provider)) {
        identityMap[ident.userId].push(ident.provider);
      }
    }

    const defaultPlan = DEFAULT_PLANS.find((p) => p.key === "free") || DEFAULT_PLANS[0];

    const items = paginated.map((u: any) => {
      const providers = identityMap[u._id] || [];
      if (providers.length === 0) {
        if (u.passwordHash) providers.push("password");
        if (u.phoneVerified) providers.push("phone");
      }

      let userType: "ACCOUNT_OWNER" | "ORG_MEMBER" | "GENERAL_USER" = "GENERAL_USER";
      if (ownedWorkspaceUserIds.has(u._id)) {
        userType = "ACCOUNT_OWNER";
      } else if (membershipCounts[u._id] && membershipCounts[u._id] > 0) {
        userType = "ORG_MEMBER";
      }

      // Find user subscription
      let sub = subscriptions.find((s: any) => s.userId === u._id);
      const userWorkspaces = workspaces.filter((w: any) => w.ownerId === u._id && w.status === "active");
      if (!sub && userWorkspaces.length > 0) {
        sub = subscriptions.find((s: any) => userWorkspaces.some((w: any) => w._id === s.workspaceId));
      }

      const rawSubPlan = sub?.planKey === "free_trial" ? "free" : (sub?.planKey || "free");
      const isPaidTier = rawSubPlan === "standard" || rawSubPlan === "premium";
      const hasPayment = Boolean(sub?.paystackSubscriptionId || sub?.lastPaymentDate);
      const isPaidActive = isPaidTier && sub?.status === "active" && hasPayment;

      const planKey = (isPaidTier && !isPaidActive) ? "free" : rawSubPlan;
      const subStatus = (isPaidTier && !isPaidActive) ? "trialing" : (sub?.status || "trialing");

      const matchedPlan = plans.find((p: any) => p.key === planKey || (planKey === "free" && p.key === "free_trial")) ||
        DEFAULT_PLANS.find((p) => p.key === planKey) ||
        defaultPlan;

      const limits = matchedPlan.limits || defaultPlan.limits;
      const maxOrgs = limits.maxOrganizations ?? limits.maxWorkspaces ?? limits.orgs ?? 1;
      const maxApps = limits.maxAppsPerOrganization ?? limits.maxAppsPerWorkspace ?? limits.apps ?? 1;
      const maxBranches = limits.maxBranchesPerApp ?? limits.branches ?? 1;
      const maxMembers = limits.maxMembersPerOrganization ?? limits.maxMembersPerWorkspace ?? limits.members ?? 2;
      const maxProducts = limits.maxProductsPerWorkspace ?? limits.products ?? 500;
      const maxTransactions = limits.maxTransactionsPerMonth ?? limits.transactions ?? 500;

      const workspaceIds = new Set(userWorkspaces.map((w: any) => w._id));
      const activeAppsCount = workspaceProducts.filter((wp: any) => workspaceIds.has(wp.workspaceId) && wp.status === "active").length;
      const activeBranchesCount = branches.filter((b: any) => workspaceIds.has(b.workspaceId) && b.status === "active").length;
      const activeMembersCount = memberships.filter((m: any) => workspaceIds.has(m.workspaceId) && m.status === "active").length;

      // Free trial quota tracking across owned workspaces
      let activeTrialOrgId: string | undefined;
      let activeTrialOrgName: string | undefined;
      let paidOrgsCount = 0;

      for (const w of userWorkspaces) {
        const wSub = subscriptions.find((s: any) => s.workspaceId === w._id || s.organizationId === w.organizationId);
        const pKey = (wSub?.planKey || w.planId || "free_trial").toLowerCase();
        const isTrial = pKey === "free_trial" || pKey === "free" || wSub?.status === "trial" || wSub?.status === "trialing";
        if (isTrial && !activeTrialOrgId) {
          activeTrialOrgId = w._id;
          activeTrialOrgName = w.name;
        } else if (!isTrial) {
          paidOrgsCount++;
        }
      }

      return {
        id: u._id,
        email: u.email,
        name: u.name || `${u.firstName || ""} ${u.lastName || ""}`.trim() || "User",
        emailVerified: !!u.emailVerified,
        status: u.status || "ACTIVE",
        userType,
        providers,
        organizationCount: userWorkspaces.length || membershipCounts[u._id] || 0,
        lastLoginAt: u.lastLoginAt,
        createdAt: u.createdAt,
        freeTrialQuota: {
          hasActiveTrialOrg: !!activeTrialOrgId,
          activeTrialOrgId,
          activeTrialOrgName,
          totalOwnedOrgs: userWorkspaces.length,
          totalPaidOrgs: paidOrgsCount,
        },
        subscription: {
          planKey,
          status: subStatus,
          pendingPlanKey: sub?.pendingPlanKey || (isPaidTier && !isPaidActive ? rawSubPlan : undefined),
        },
        entitlements: {
          maxOrganizations: maxOrgs,
          maxAppsPerOrganization: maxApps,
          maxBranchesPerApp: maxBranches,
          maxMembersPerOrganization: maxMembers,
          maxProductsPerWorkspace: maxProducts,
          maxTransactionsPerMonth: maxTransactions,
        },
        usage: {
          workspaces: userWorkspaces.length,
          apps: activeAppsCount,
          branches: activeBranchesCount,
          members: activeMembersCount,
          products: 0,
          transactions: 0,
        },
      };
    });

    return {
      items,
      totalCount,
      page,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize),
    };
  },
});

/**
 * getUserDetails
 * Fetches comprehensive details for a single user
 */
export const getUserDetails = query({
  args: {
    sessionToken: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await verifyAdminSession(ctx, args.sessionToken);

    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found.");

    // 1. OAuth identities
    const identities = await ctx.db
      .query("authIdentities")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    // 2. Active sessions
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    // 3. Organization / Workspace Memberships & Plans
    const memberships = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const now = Date.now();
    const workspaceDetails = [];
    let activeTrialOrgId: string | undefined;
    let activeTrialOrgName: string | undefined;
    let totalOwnedOrgs = 0;
    let totalPaidOrgs = 0;

    for (const m of memberships) {
      const ws: any = await ctx.db.get(m.workspaceId);
      if (ws) {
        const sub = await ctx.db
          .query("subscriptions")
          .withIndex("by_workspace", (q) => q.eq("workspaceId", ws._id))
          .first();

        const planKey = (sub?.planKey || ws.planId || "free_trial").toLowerCase();
        const isTrial = planKey === "free_trial" || planKey === "free" || sub?.status === "trial" || sub?.status === "trialing";
        const trialEndsAt = sub?.trialEndsAt || sub?.trialEnd || (isTrial ? (sub?.currentPeriodEnd || (ws.createdAt + 30 * 86_400_000)) : undefined);
        const daysRemaining = trialEndsAt ? Math.max(0, Math.ceil((trialEndsAt - now) / (1000 * 60 * 60 * 24))) : null;

        if (ws.ownerId === args.userId) {
          totalOwnedOrgs++;
          if (isTrial && !activeTrialOrgId) {
            activeTrialOrgId = ws._id;
            activeTrialOrgName = ws.name;
          } else if (!isTrial) {
            totalPaidOrgs++;
          }
        }

        workspaceDetails.push({
          membershipId: m._id,
          workspaceId: ws._id,
          name: ws.name,
          slug: ws.slug,
          role: m.role,
          status: m.status,
          planKey,
          isTrial,
          trialEndsAt,
          daysRemaining,
          subscriptionStatus: sub?.status || "active",
          isOwner: ws.ownerId === args.userId,
          joinedAt: m.createdAt,
        });
      }
    }

    // 4. User Audit Logs (recent 10)
    const auditLogs = await ctx.db
      .query("userAuditLogs")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(10);

    return {
      user: {
        id: user._id,
        email: user.email,
        name: user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim() || "User",
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName,
        phone: user.phone,
        emailVerified: !!user.emailVerified,
        emailVerifiedAt: user.emailVerifiedAt,
        status: user.status || "ACTIVE",
        avatar: user.avatar || user.avatarUrl,
        country: user.country,
        timezone: user.timezone,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      },
      freeTrialQuota: {
        hasActiveTrialOrg: !!activeTrialOrgId,
        activeTrialOrgId,
        activeTrialOrgName,
        totalOwnedOrgs,
        totalPaidOrgs,
      },
      identities: identities.map((id: any) => ({
        id: id._id,
        provider: id.provider,
        providerEmail: id.providerEmail,
        createdAt: id.createdAt,
        lastUsedAt: id.lastUsedAt,
      })),
      sessions: sessions.map((s: any) => ({
        id: s._id,
        deviceName: s.deviceName || s.userAgent?.substring(0, 40) || "Browser",
        ipAddress: s.ipAddress,
        createdAt: s.createdAt,
        lastActiveAt: s.lastActiveAt,
        expiresAt: s.expiresAt,
        isRevoked: !!s.revokedAt,
      })),
      workspaces: workspaceDetails,
      recentAuditLogs: auditLogs,
    };
  },
});

/**
 * suspendUser
 * Suspends user account and revokes active sessions
 */
export const suspendUser = mutation({
  args: {
    sessionToken: v.string(),
    userId: v.id("users"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { admin } = await verifyAdminSession(ctx, args.sessionToken);

    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found.");

    const now = Date.now();
    await ctx.db.patch(args.userId, {
      status: "SUSPENDED",
      updatedAt: now,
    });

    // Revoke all active user sessions
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    for (const s of sessions) {
      await ctx.db.patch(s._id, {
        revokedAt: now,
      });
    }

    await logAudit(ctx, admin._id, "USER_SUSPENDED", args.userId, {
      userEmail: user.email,
      reason: args.reason,
      revokedSessionCount: sessions.length,
    });

    return { success: true };
  },
});

/**
 * activateUser
 * Reactivates a suspended user account
 */
export const activateUser = mutation({
  args: {
    sessionToken: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { admin } = await verifyAdminSession(ctx, args.sessionToken);

    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found.");

    await ctx.db.patch(args.userId, {
      status: "ACTIVE",
      updatedAt: Date.now(),
    });

    await logAudit(ctx, admin._id, "USER_ACTIVATED", args.userId, {
      userEmail: user.email,
    });

    return { success: true };
  },
});

/**
 * verifyUserEmail
 * Manually marks user's email as verified
 */
export const verifyUserEmail = mutation({
  args: {
    sessionToken: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { admin } = await verifyAdminSession(ctx, args.sessionToken);

    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found.");

    const now = Date.now();
    await ctx.db.patch(args.userId, {
      emailVerified: true,
      emailVerifiedAt: now,
      updatedAt: now,
    });

    await logAudit(ctx, admin._id, "USER_EMAIL_MANUALLY_VERIFIED", args.userId, {
      userEmail: user.email,
    });

    return { success: true };
  },
});

/**
 * revokeUserSessions
 * Revokes all sessions for a specific user
 */
export const revokeUserSessions = mutation({
  args: {
    sessionToken: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { admin } = await verifyAdminSession(ctx, args.sessionToken);

    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found.");

    const now = Date.now();
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    for (const s of sessions) {
      await ctx.db.patch(s._id, {
        revokedAt: now,
      });
    }

    await logAudit(ctx, admin._id, "USER_SESSIONS_REVOKED", args.userId, {
      userEmail: user.email,
      revokedCount: sessions.length,
    });

    return { success: true, count: sessions.length };
  },
});

/**
 * deleteUser
 * Permanently deletes a user account with safety cleanup
 */
export const deleteUser = mutation({
  args: {
    sessionToken: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { admin } = await verifyAdminSession(ctx, args.sessionToken);

    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found.");

    const email = user.email;

    // 1. Delete sessions
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
    for (const s of sessions) {
      await ctx.db.delete(s._id);
    }

    // 2. Delete memberships
    const memberships = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const m of memberships) {
      await ctx.db.delete(m._id);
    }

    // 3. Delete user
    await ctx.db.delete(args.userId);

    await logAudit(ctx, admin._id, "USER_DELETED", args.userId, {
      deletedUserEmail: email,
    });

    return { success: true };
  },
});

function generateSecureToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * impersonateUser
 * Initiates an audited, short-lived impersonation session for platform admins
 */
export const impersonateUser = mutation({
  args: {
    sessionToken: v.string(),
    userId: v.id("users"),
    reason: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { admin } = await verifyAdminSession(ctx, args.sessionToken);

    const user = await ctx.db.get(args.userId);
    if (!user || user.deletedAt) {
      throw new Error("User not found or deleted.");
    }

    if (user.status === "SUSPENDED") {
      throw new Error("Cannot impersonate a suspended user account.");
    }

    const now = Date.now();
    const sessionToken = generateSecureToken();
    const refreshToken = `impersonate_${generateSecureToken()}`;
    const oneHourMs = 60 * 60 * 1000;

    const sessionId = await ctx.db.insert("sessions", {
      userId: user._id,
      sessionHash: sessionToken,
      refreshToken,
      deviceId: "admin_impersonation_session",
      deviceName: `Admin Support (${admin.name || admin.email})`,
      authenticationMethod: "admin_impersonation",
      tokenVersion: user.tokenVersion ?? 0,
      userAgent: args.userAgent || "Admin Portal Impersonation",
      ipAddress: args.ipAddress,
      lastActiveAt: now,
      expiresAt: now + oneHourMs,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("adminAuditLogs", {
      adminId: admin._id,
      action: "USER_IMPERSONATION_STARTED",
      resourceType: "users",
      resourceId: args.userId,
      details: {
        targetUserEmail: user.email,
        targetUserName: user.name,
        reason: args.reason || "Support Investigation",
        sessionId,
        ipAddress: args.ipAddress,
      },
      createdAt: now,
    });

    return {
      success: true,
      sessionId,
      sessionToken,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        name: user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim(),
        role: "user",
      },
      expiresAt: now + oneHourMs,
    };
  },
});

export const getUserUsage = query({
  args: {
    userId: v.id("users"),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.sessionToken) {
      await verifyAdminSession(ctx, args.sessionToken);
    }

    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    let sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q: any) => q.eq("userId", args.userId))
      .first();

    const userWorkspaces = await ctx.db
      .query("workspaces")
      .withIndex("by_owner", (q: any) => q.eq("ownerId", args.userId))
      .filter((q: any) => q.eq(q.field("status"), "active"))
      .collect();

    if (!sub && userWorkspaces.length > 0) {
      for (const ws of userWorkspaces) {
        const wsSub = await ctx.db
          .query("subscriptions")
          .withIndex("by_workspace", (q: any) => q.eq("workspaceId", ws._id))
          .first();
        if (wsSub && wsSub.status === "active") {
          sub = wsSub;
          break;
        }
      }
    }

    const planKey = sub?.planKey === "free_trial" ? "free" : (sub?.planKey || "free");
    const defaultPlan = DEFAULT_PLANS.find((p) => p.key === "free") || DEFAULT_PLANS[0];

    let plan = await ctx.db
      .query("plans")
      .withIndex("by_key", (q: any) => q.eq("key", planKey))
      .first();

    if (!plan && planKey === "free") {
      plan = await ctx.db
        .query("plans")
        .withIndex("by_key", (q: any) => q.eq("key", "free_trial"))
        .first();
    }

    const limits = plan?.limits || defaultPlan.limits;
    const maxOrgs = limits.maxOrganizations ?? limits.maxWorkspaces ?? limits.orgs ?? 1;
    const maxApps = limits.maxAppsPerOrganization ?? limits.maxAppsPerWorkspace ?? limits.apps ?? 1;
    const maxBranches = limits.maxBranchesPerApp ?? limits.branches ?? 1;
    const maxMembers = limits.maxMembersPerOrganization ?? limits.maxMembersPerWorkspace ?? limits.members ?? 2;
    const maxProducts = limits.maxProductsPerWorkspace ?? limits.products ?? 500;
    const maxTransactions = limits.maxTransactionsPerMonth ?? limits.transactions ?? 500;

    const workspaceIds = new Set(userWorkspaces.map((w: any) => w._id));

    const [branches, workspaceProducts, memberships] = await Promise.all([
      ctx.db.query("branches").collect(),
      ctx.db.query("workspaceProducts").collect(),
      ctx.db.query("workspaceMemberships").collect(),
    ]);

    const activeAppsCount = workspaceProducts.filter((wp: any) => workspaceIds.has(wp.workspaceId) && wp.status === "active").length;
    const activeBranchesCount = branches.filter((b: any) => workspaceIds.has(b.workspaceId) && b.status === "active").length;
    const activeMembersCount = memberships.filter((m: any) => workspaceIds.has(m.workspaceId) && m.status === "active").length;

    return {
      userId: args.userId,
      email: user.email,
      name: user.name,
      planKey,
      subscription: sub,
      entitlements: {
        maxOrganizations: maxOrgs,
        maxAppsPerOrganization: maxApps,
        maxBranchesPerApp: maxBranches,
        maxMembersPerOrganization: maxMembers,
        maxProductsPerWorkspace: maxProducts,
        maxTransactionsPerMonth: maxTransactions,
      },
      usage: {
        workspaces: userWorkspaces.length,
        apps: activeAppsCount,
        branches: activeBranchesCount,
        members: activeMembersCount,
        products: 0,
        transactions: 0,
      },
    };
  },
});


