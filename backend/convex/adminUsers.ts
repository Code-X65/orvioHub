import { mutation, query } from "./_generated/server.js";
import { v } from "convex/values";
import { DEFAULT_PLANS } from "./plans.js";

// Helper to authenticate admin
async function verifyAdminSession(
  ctx: any,
  sessionToken?: string,
  requiredPermission?: string
) {
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

  // Permission check placeholder (all active platformAdmins have full superadmin permissions)
  if (requiredPermission && admin.role !== "super_admin" && admin.role !== "superadmin") {
    // If specific non-superadmin roles are introduced in the future:
    throw new Error(`Forbidden: missing permission ${requiredPermission}`);
  }

  return { admin, session };
}

async function logAudit(
  ctx: any,
  adminId: any,
  action: string,
  resourceId?: string,
  details?: any,
  eventType?: string
) {
  const now = Date.now();
  await ctx.db.insert("adminAuditLogs", {
    adminId,
    action,
    resourceType: "users",
    resourceId,
    details,
    createdAt: now,
  });

  if (eventType) {
    await ctx.db.insert("auditLogs", {
      actorId: adminId,
      actorUserId: adminId,
      targetUserId: resourceId,
      eventType,
      action: eventType,
      entityType: "user",
      entityId: resourceId,
      resource: "users",
      severity: details?.severity || "info",
      metadata: details,
      createdAt: now,
      timestamp: now,
    });
  }
}

/**
 * listUsers
 * Paginated query with advanced search (ID, email, name, phone, org, paystack ref) and comprehensive filters
 */
export const listUsers = query({
  args: {
    sessionToken: v.string(),
    search: v.optional(v.string()),
    verifiedFilter: v.optional(
      v.union(v.literal("all"), v.literal("verified"), v.literal("unverified"))
    ),
    statusFilter: v.optional(v.string()),
    userTypeFilter: v.optional(v.string()), // "all" | "ACCOUNT_OWNER" | "ORG_MEMBER" | "GENERAL_USER"
    orgFilter: v.optional(v.string()), // "all" | "has_orgs" | "no_orgs" | "limit_reached"
    billingFilter: v.optional(v.string()), // "all" | "active_sub" | "trial" | "failed_payments"
    onboardingFilter: v.optional(v.string()), // "all" | "completed" | "incomplete"
    roleFilter: v.optional(v.string()), // "all" | "superadmin" | "user"
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
    sortBy: v.optional(v.string()), // "createdAt" | "lastLoginAt" | "email" | "name"
    sortOrder: v.optional(v.string()), // "asc" | "desc"
  },
  handler: async (ctx, args) => {
    await verifyAdminSession(ctx, args.sessionToken, "admin.users.search");

    let users = await ctx.db.query("users").collect();

    const [
      memberships,
      workspaces,
      identities,
      subscriptions,
      plans,
      branches,
      workspaceProducts,
      payments,
      userProfiles,
      limitOverrides,
    ] = await Promise.all([
      ctx.db.query("workspaceMemberships").collect(),
      ctx.db.query("workspaces").collect(),
      ctx.db.query("authIdentities").collect(),
      ctx.db.query("subscriptions").collect(),
      ctx.db.query("plans").collect(),
      ctx.db.query("branches").collect(),
      ctx.db.query("workspaceProducts").collect(),
      ctx.db.query("payments").collect(),
      ctx.db.query("userProfiles").collect(),
      ctx.db.query("organizationLimitOverrides").collect(),
    ]);

    const defaultPlan = DEFAULT_PLANS.find((p) => p.key === "free") || DEFAULT_PLANS[0];

    const membershipCounts: Record<string, number> = {};
    for (const m of memberships) {
      membershipCounts[m.userId] = (membershipCounts[m.userId] || 0) + 1;
    }

    const ownedWorkspacesMap: Record<string, any[]> = {};
    for (const w of workspaces) {
      if (w.ownerId && w.status !== "deleted") {
        if (!ownedWorkspacesMap[w.ownerId]) ownedWorkspacesMap[w.ownerId] = [];
        ownedWorkspacesMap[w.ownerId].push(w);
      }
    }

    const failedPaymentsByOrg = new Set(
      payments.filter((p: any) => p.status === "failed").map((p: any) => p.workspaceId || p.organizationId)
    );

    const profileMap = new Map(userProfiles.map((up: any) => [up.userId, up]));

    // 1. Search Filter (User ID, Name, Email, Phone, Org Name, Org ID, Paystack Customer Code)
    if (args.search && args.search.trim()) {
      const q = args.search.toLowerCase().trim();
      users = users.filter((u: any) => {
        const id = (u._id || "").toLowerCase();
        const name = (u.name || `${u.firstName || ""} ${u.lastName || ""}`).toLowerCase();
        const email = (u.email || "").toLowerCase();
        const phone = (u.phone || "").toLowerCase();

        // Check if any owned workspace matches search
        const owned = ownedWorkspacesMap[u._id] || [];
        const matchesOrg = owned.some(
          (w: any) =>
            (w.name || "").toLowerCase().includes(q) ||
            (w._id || "").toLowerCase().includes(q) ||
            (w.slug || "").toLowerCase().includes(q)
        );

        // Check paystack customer code from subscriptions
        const userSubs = subscriptions.filter(
          (s: any) => s.userId === u._id || owned.some((w: any) => w._id === s.workspaceId)
        );
        const matchesPaystack = userSubs.some((s: any) =>
          (s.paystackCustomerCode || "").toLowerCase().includes(q)
        );

        return (
          id.includes(q) ||
          name.includes(q) ||
          email.includes(q) ||
          phone.includes(q) ||
          matchesOrg ||
          matchesPaystack
        );
      });
    }

    // 2. Email Verification Filter
    if (args.verifiedFilter && args.verifiedFilter !== "all") {
      if (args.verifiedFilter === "verified") {
        users = users.filter((u: any) => !!u.emailVerified);
      } else if (args.verifiedFilter === "unverified") {
        users = users.filter((u: any) => !u.emailVerified);
      }
    }

    // 3. Status Filter (ACTIVE / SUSPENDED / DELETED)
    if (args.statusFilter && args.statusFilter !== "all") {
      const targetStatus = args.statusFilter.toUpperCase();
      users = users.filter((u: any) => (u.status || "ACTIVE").toUpperCase() === targetStatus);
    }

    // 4. Role Filter (Superadmin / Regular user)
    if (args.roleFilter && args.roleFilter !== "all") {
      if (args.roleFilter === "superadmin") {
        users = users.filter((u: any) => u.role === "superadmin" || u.role === "admin");
      } else if (args.roleFilter === "user") {
        users = users.filter((u: any) => u.role !== "superadmin" && u.role !== "admin");
      }
    }

    // 5. User Type Filter
    if (args.userTypeFilter && args.userTypeFilter !== "all") {
      users = users.filter((u: any) => {
        const ownedCount = (ownedWorkspacesMap[u._id] || []).length;
        const memberCount = membershipCounts[u._id] || 0;
        if (args.userTypeFilter === "ACCOUNT_OWNER") return ownedCount > 0;
        if (args.userTypeFilter === "ORG_MEMBER") return ownedCount === 0 && memberCount > 0;
        if (args.userTypeFilter === "GENERAL_USER") return ownedCount === 0 && memberCount === 0;
        return true;
      });
    }

    // 6. Organization Filter
    if (args.orgFilter && args.orgFilter !== "all") {
      users = users.filter((u: any) => {
        const ownedCount = (ownedWorkspacesMap[u._id] || []).length;
        const memberCount = membershipCounts[u._id] || 0;
        const total = ownedCount + memberCount;
        if (args.orgFilter === "has_orgs") return total > 0;
        if (args.orgFilter === "no_orgs") return total === 0;
        if (args.orgFilter === "limit_reached") return ownedCount >= 3;
        return true;
      });
    }

    // 7. Onboarding Filter
    if (args.onboardingFilter && args.onboardingFilter !== "all") {
      users = users.filter((u: any) => {
        const prof = profileMap.get(u._id);
        const isCompleted = u.personalOnboardingCompleted || prof?.personalOnboardingCompleted;
        if (args.onboardingFilter === "completed") return !!isCompleted;
        if (args.onboardingFilter === "incomplete") return !isCompleted;
        return true;
      });
    }

    // 8. Date Range Filter
    if (args.startDate) {
      users = users.filter((u: any) => (u.createdAt || 0) >= args.startDate!);
    }
    if (args.endDate) {
      users = users.filter((u: any) => (u.createdAt || 0) <= args.endDate!);
    }

    // 9. Sorting
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

    const identityMap: Record<string, string[]> = {};
    for (const ident of identities) {
      if (!identityMap[ident.userId]) identityMap[ident.userId] = [];
      if (!identityMap[ident.userId].includes(ident.provider)) {
        identityMap[ident.userId].push(ident.provider);
      }
    }

    const items = paginated.map((u: any) => {
      const providers = identityMap[u._id] || [];
      if (providers.length === 0) {
        if (u.passwordHash) providers.push("password");
        if (u.phoneVerified) providers.push("phone");
      }

      const owned = ownedWorkspacesMap[u._id] || [];
      const memberCount = membershipCounts[u._id] || 0;

      let userType: "ACCOUNT_OWNER" | "ORG_MEMBER" | "GENERAL_USER" = "GENERAL_USER";
      if (owned.length > 0) {
        userType = "ACCOUNT_OWNER";
      } else if (memberCount > 0) {
        userType = "ORG_MEMBER";
      }

      // Subscription & Plan detection
      let sub = subscriptions.find((s: any) => s.userId === u._id);
      if (!sub && owned.length > 0) {
        sub = subscriptions.find((s: any) => owned.some((w: any) => w._id === s.workspaceId));
      }

      const rawSubPlan = sub?.planKey === "free_trial" ? "free" : (sub?.planKey || "free");
      const isPaidTier = rawSubPlan === "standard" || rawSubPlan === "premium";
      const hasPayment = Boolean(sub?.paystackSubscriptionId || sub?.lastPaymentDate);
      const isPaidActive = isPaidTier && sub?.status === "active" && hasPayment;
      const planKey = isPaidTier && !isPaidActive ? "free" : rawSubPlan;
      const subStatus = isPaidTier && !isPaidActive ? "trialing" : (sub?.status || "trialing");

      const matchedPlan =
        plans.find((p: any) => p.key === planKey || (planKey === "free" && p.key === "free_trial")) ||
        DEFAULT_PLANS.find((p) => p.key === planKey) ||
        defaultPlan;

      const override = (limitOverrides || []).find(
        (o: any) => o.userId === u._id && o.featureKey === "organization.max_owned_count" && (!o.expiresAt || o.expiresAt > Date.now())
      );
      const userMaxOrgs = override?.overrideLimit ?? 3;
      const isLimitReached = owned.length >= userMaxOrgs;

      const workspaceIds = new Set(owned.map((w: any) => w._id));
      const activeApps = workspaceProducts
        .filter((wp: any) => workspaceIds.has(wp.workspaceId) && wp.status === "active")
        .map((wp: any) => wp.productKey);
      const uniqueApps = Array.from(new Set(activeApps));

      const activeBranchesCount = branches.filter(
        (b: any) => workspaceIds.has(b.workspaceId) && b.status === "active"
      ).length;

      // Risk / Warning indicators
      const warnings: string[] = [];
      if (!u.emailVerified) warnings.push("unverified_email");
      if (u.status === "SUSPENDED") warnings.push("account_suspended");
      if (owned.some((w: any) => failedPaymentsByOrg.has(w._id))) warnings.push("failed_payment");
      if (isLimitReached) warnings.push("org_limit_reached");
      if (u.failedLoginAttempts && u.failedLoginAttempts > 3) warnings.push("recent_failed_logins");

      const prof = profileMap.get(u._id);
      const onboardingCompleted = !!(u.personalOnboardingCompleted || prof?.personalOnboardingCompleted);

      return {
        id: u._id,
        email: u.email,
        name: u.name || `${u.firstName || ""} ${u.lastName || ""}`.trim() || "User",
        firstName: u.firstName,
        lastName: u.lastName,
        displayName: u.displayName,
        phone: u.phone,
        phoneNormalized: u.phoneNormalized,
        phoneStatus: u.phone ? (u.phoneVerifiedAt || u.phoneStatus === "verified" ? "verified" : (u.phoneStatus || "unverified")) : "not_set",
        avatar: u.avatar || u.avatarUrl || prof?.avatar || prof?.avatarUrl,
        avatarUrl: u.avatarUrl || u.avatar || prof?.avatarUrl || prof?.avatar,
        country: u.country || "Nigeria",
        emailVerified: !!u.emailVerified,
        phoneVerified: !!(u.phoneVerifiedAt || u.phoneStatus === "verified"),
        phoneVerifiedAt: u.phoneVerifiedAt,
        phoneUsedForRecovery: !!u.phoneUsedForRecovery,
        phoneUsedForMfa: !!u.phoneUsedForMfa,
        status: u.status || "ACTIVE",
        role: u.role || "user",
        userType,
        providers,
        organizationCount: owned.length + memberCount,
        ownedOrganizationsCount: owned.length,
        memberOrganizationsCount: memberCount,
        activeApplications: uniqueApps,
        activeBranchesCount,
        lastLoginAt: u.lastLoginAt,
        createdAt: u.createdAt,
        onboardingCompleted,
        warnings,
        subscription: {
          planKey,
          status: subStatus,
          pendingPlanKey: sub?.pendingPlanKey,
        },
        ownershipQuota: {
          ownedCount: owned.length,
          maxLimit: userMaxOrgs,
          remainingSlots: Math.max(0, userMaxOrgs - owned.length),
          isLimitReached,
          hasOverride: !!override,
          overrideLimit: override?.overrideLimit,
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
 * getUserOverview
 * Returns high-level platform statistics and status badges for user detail header & overview
 */
export const getUserOverview = query({
  args: {
    sessionToken: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await verifyAdminSession(ctx, args.sessionToken, "admin.users.view");

    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found.");

    const [
      workspaces,
      memberships,
      identities,
      sessions,
      workspaceProducts,
      branches,
      subscriptions,
      payments,
      userProfile,
      flows,
    ] = await Promise.all([
      ctx.db.query("workspaces").collect(),
      ctx.db.query("workspaceMemberships").withIndex("by_user", (q) => q.eq("userId", args.userId)).collect(),
      ctx.db.query("authIdentities").withIndex("by_userId", (q) => q.eq("userId", args.userId)).collect(),
      ctx.db.query("sessions").withIndex("by_userId", (q) => q.eq("userId", args.userId)).collect(),
      ctx.db.query("workspaceProducts").collect(),
      ctx.db.query("branches").collect(),
      ctx.db.query("subscriptions").collect(),
      ctx.db.query("payments").collect(),
      ctx.db.query("userProfiles").withIndex("by_userId", (q) => q.eq("userId", args.userId)).first(),
      ctx.db.query("onboardingFlows").withIndex("by_user", (q) => q.eq("userId", args.userId)).collect(),
    ]);

    const ownedWorkspaces = workspaces.filter((w: any) => w.ownerId === args.userId && w.status !== "deleted");
    const activeOwned = ownedWorkspaces.filter((w: any) => (w.status || "active") === "active");
    const suspendedOwned = ownedWorkspaces.filter((w: any) => w.status === "suspended");

    const ownedWsIds = new Set(ownedWorkspaces.map((w: any) => w._id));
    const activeApps = workspaceProducts.filter(
      (wp: any) => ownedWsIds.has(wp.workspaceId) && wp.status === "active"
    );
    const activeBranches = branches.filter(
      (b: any) => ownedWsIds.has(b.workspaceId) && b.status === "active"
    );

    const activeSessions = sessions.filter((s: any) => !s.revokedAt && s.expiresAt > Date.now());

    // Billing relationships
    const userSubs = subscriptions.filter(
      (s: any) => s.userId === args.userId || ownedWorkspaces.some((w: any) => w._id === s.workspaceId)
    );
    const activeSubsCount = userSubs.filter((s: any) => s.status === "active").length;
    const userPayments = payments.filter(
      (p: any) => p.userId === args.userId || ownedWorkspaces.some((w: any) => w._id === p.workspaceId)
    );
    const failedPaymentsCount = userPayments.filter((p: any) => p.status === "failed").length;

    // Detect billing mismatches
    let mismatchesCount = 0;
    for (const sub of userSubs) {
      if (
        (sub.planKey === "standard" || sub.planKey === "premium") &&
        (sub.status === "trial" || sub.status === "trialing")
      ) {
        mismatchesCount++;
      }
    }

    const personalOnboardingStatus =
      user.personalOnboardingCompleted || userProfile?.personalOnboardingCompleted
        ? "completed"
        : "incomplete";

    return {
      user: {
        id: user._id,
        name: user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim() || "User",
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar || user.avatarUrl || userProfile?.avatar || userProfile?.avatarUrl,
        avatarUrl: user.avatarUrl || user.avatar || userProfile?.avatarUrl || userProfile?.avatar,
        emailVerified: !!user.emailVerified,
        phoneVerified: !!((user as any).phoneVerified || user.phoneVerifiedAt),
        status: user.status || "ACTIVE",
        role: user.role || "user",
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      },
      onboarding: {
        personalStatus: personalOnboardingStatus,
        organizations: {
          total: ownedWorkspaces.length,
          completed: flows.filter((f: any) => f.status === "COMPLETED").length,
          incomplete: flows.filter((f: any) => f.status !== "COMPLETED").length,
        },
        applications: {
          inventory: {
            activeCount: activeApps.filter((a: any) => a.productKey === "inventory").length,
          },
        },
      },
      organizations: {
        owned: ownedWorkspaces.length,
        joined: memberships.filter((m: any) => !ownedWsIds.has(m.workspaceId)).length,
        active: activeOwned.length,
        suspended: suspendedOwned.length,
      },
      access: {
        applications: new Set(activeApps.map((a: any) => a.productKey)).size,
        branches: activeBranches.length,
      },
      billing: {
        activeSubscriptions: activeSubsCount,
        failedPayments: failedPaymentsCount,
        mismatches: mismatchesCount,
      },
      security: {
        twoFactorEnabled: !!user.twoFactorEnabled,
        phoneStatus: user.phone ? (user.phoneVerifiedAt || user.phoneStatus === "verified" ? "verified" : (user.phoneStatus || "unverified")) : "not_set",
        phoneNormalized: user.phoneNormalized,
        phoneVerified: !!(user.phoneVerifiedAt || user.phoneStatus === "verified"),
        phoneVerifiedAt: user.phoneVerifiedAt,
        phoneUsedForRecovery: !!user.phoneUsedForRecovery,
        phoneUsedForMfa: !!user.phoneUsedForMfa,
        activeSessions: activeSessions.length,
        recentFailedLogins: user.failedLoginAttempts || 0,
        isLocked: !!(user.lockedUntil && user.lockedUntil > Date.now()),
      },
    };
  },
});

/**
 * getUserProfile
 * Comprehensive personal profile, Nigerian geographical state/LGA, preferences
 */
export const getUserProfile = query({
  args: {
    sessionToken: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await verifyAdminSession(ctx, args.sessionToken, "admin.users.view");

    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found.");

    const [userProfile, userPref, userPhones] = await Promise.all([
      ctx.db.query("userProfiles").withIndex("by_userId", (q) => q.eq("userId", args.userId)).first(),
      ctx.db.query("userPreferences").withIndex("by_userId", (q) => q.eq("userId", args.userId)).first(),
      ctx.db.query("userPhones").withIndex("by_user", (q) => q.eq("userId", args.userId)).collect(),
    ]);

    return {
      id: user._id,
      name: user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim() || "User",
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName,
      preferredName: user.preferredName,
      avatar: user.avatar || user.avatarUrl || userProfile?.avatar || userProfile?.avatarUrl,
      avatarUrl: user.avatarUrl || user.avatar || userProfile?.avatarUrl || userProfile?.avatar,
      jobTitle: user.jobTitle,
      department: user.department,
      bio: user.bio,
      email: user.email,
      emailNormalized: user.emailNormalized,
      emailVerified: !!user.emailVerified,
      emailVerifiedAt: user.emailVerifiedAt,
      phone: user.phone,
      phoneNormalized: user.phoneNormalized,
      phoneStatus: user.phone ? (user.phoneVerifiedAt || user.phoneStatus === "verified" ? "verified" : (user.phoneStatus || "unverified")) : "not_set",
      phoneVerified: !!(user.phoneVerifiedAt || user.phoneStatus === "verified"),
      phoneVerifiedAt: user.phoneVerifiedAt,
      phoneUsedForRecovery: !!user.phoneUsedForRecovery,
      phoneUsedForMfa: !!user.phoneUsedForMfa,
      phoneVisibility: user.phoneVisibility || "workspace",
      additionalPhones: userPhones.map((p: any) => ({
        phone: p.phone,
        isVerified: p.isVerified,
        isPrimary: p.isPrimary,
        verifiedAt: p.verifiedAt,
      })),
      country: user.country || "Nigeria",
      state: user.state,
      stateCode: user.stateCode,
      lga: user.lga,
      city: user.city,
      timezone: user.timezone || "Africa/Lagos",
      language: user.language || "en",
      locale: user.locale || "en-NG",
      dateFormat: user.dateFormat || "DD/MM/YYYY",
      numberFormat: user.numberFormat || "standard",
      currencyPreference: user.currencyPreference || "NGN",
      theme: userPref?.theme || user.theme || "system",
      status: user.status || "ACTIVE",
      role: user.role || "user",
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt,
      profileCompletedAt: user.profileCompletedAt || userProfile?.completedAt,
    };
  },
});

/**
 * getUserOnboarding
 * Multi-layer onboarding details (personal answers, organization answers, application answers)
 */
export const getUserOnboarding = query({
  args: {
    sessionToken: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await verifyAdminSession(ctx, args.sessionToken, "admin.users.view_onboarding");

    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found.");

    const [
      userProfile,
      userConsents,
      flows,
      events,
      workspaces,
      orgProfiles,
      appResponses,
    ] = await Promise.all([
      ctx.db.query("userProfiles").withIndex("by_userId", (q) => q.eq("userId", args.userId)).first(),
      ctx.db.query("userConsents").withIndex("by_userId", (q) => q.eq("userId", args.userId)).collect(),
      ctx.db.query("onboardingFlows").withIndex("by_user", (q) => q.eq("userId", args.userId)).collect(),
      ctx.db.query("onboardingEvents").withIndex("by_userId", (q) => q.eq("userId", args.userId)).collect(),
      ctx.db.query("workspaces").withIndex("by_owner", (q) => q.eq("ownerId", args.userId)).collect(),
      ctx.db.query("organizationProfiles").collect(),
      ctx.db.query("applicationOnboardingResponses").collect(),
    ]);

    // 1. Registration Metadata
    const tosConsent = userConsents.find((c: any) => c.consentType === "terms_of_service");
    const privacyConsent = userConsents.find((c: any) => c.consentType === "privacy_policy");
    const marketingConsent = userConsents.find((c: any) => c.consentType === "marketing_communications");

    const registrationMetadata = {
      registeredAt: user.createdAt,
      signupMethod: user.passwordHash ? "email_password" : "oauth",
      emailVerifiedAt: user.emailVerifiedAt,
      firstLoginAt: user.lastLoginAt,
      termsAcceptedAt: tosConsent?.grantedAt,
      privacyPolicyAcceptedAt: privacyConsent?.grantedAt,
      marketingConsent: {
        granted: marketingConsent?.granted ?? false,
        grantedAt: marketingConsent?.grantedAt,
      },
      acquisitionSource: userProfile?.acquisitionSource || "direct",
      acquisitionSourceOther: userProfile?.acquisitionSourceOther,
    };

    // 2. Personal Onboarding Answers
    const personalAnswers = {
      completed: !!(user.personalOnboardingCompleted || userProfile?.personalOnboardingCompleted),
      currentStep: userProfile?.currentStep || (user.personalOnboardingCompleted ? 4 : 1),
      completedAt: userProfile?.completedAt,
      updatedAt: userProfile?.updatedAt,
      intendedUse: userProfile?.useCases || [],
      role: userProfile?.role,
      managesBusiness: userProfile?.managesBusiness,
      acquisitionSource: userProfile?.acquisitionSource,
      acquisitionSourceOther: userProfile?.acquisitionSourceOther,
    };

    // 3. Organization Onboarding Answers
    const orgAnswers = workspaces.map((ws: any) => {
      const orgProf = orgProfiles.find(
        (op: any) => op.organizationId === ws.organizationId || op.organizationId === ws._id
      );
      const flow = flows.find((f: any) => f.workspaceId === ws._id);

      return {
        workspaceId: ws._id,
        organizationName: ws.name,
        slug: ws.slug,
        businessType: orgProf?.businessType || ws.type || "retail",
        branchCountRange: orgProf?.branchCountRange || "1",
        productCountRange: orgProf?.productCountRange || "1-50",
        country: ws.country || "Nigeria",
        currency: ws.currency || "NGN",
        timezone: ws.timezone || "Africa/Lagos",
        status: flow?.status || (ws.status === "active" ? "COMPLETED" : "IN_PROGRESS"),
        currentStep: flow?.currentStep || "COMPLETED",
        completedSteps: flow?.completedSteps || [],
        skippedSteps: flow?.skippedSteps || [],
        startedAt: flow?.startedAt || ws.createdAt,
        completedAt: flow?.completedAt || (ws.status === "active" ? ws.createdAt : undefined),
      };
    });

    // 4. Application Onboarding Answers (e.g. Inventory)
    const appAnswers = appResponses.map((ar: any) => {
      const ws = workspaces.find((w: any) => w.organizationId === ar.organizationId || w._id === ar.organizationId);
      return {
        organizationId: ar.organizationId,
        organizationName: ws?.name || "Organization",
        applicationKey: "inventory",
        previousTools: ar.previousTools || [],
        painPoints: ar.painPoints || [],
        priorityFeatures: ar.priorityFeatures || [],
        needsMultiBranch: ar.needsMultiBranch || false,
        teamComfortLevel: ar.teamComfortLevel || "intermediate",
        completedAt: ar.completedAt,
      };
    });

    return {
      registrationMetadata,
      personalAnswers,
      organizations: orgAnswers,
      applications: appAnswers,
      timelineEvents: events.slice(0, 30).map((e: any) => ({
        id: e._id,
        eventType: e.eventType,
        step: e.step,
        productKey: e.productKey,
        workspaceId: e.workspaceId,
        createdAt: e.createdAt,
        metadata: e.metadata,
      })),
    };
  },
});

/**
 * getUserAuthenticationSummary
 * Safe authentication summary (primary login method, linked providers, 2FA status, backup code count, login count)
 * Strictly hides secrets (passwords, tokens, TOTP secrets, raw backup codes)
 */
export const getUserAuthenticationSummary = query({
  args: {
    sessionToken: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await verifyAdminSession(ctx, args.sessionToken, "admin.users.view_security_summary");

    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found.");

    const [identities, authEventsList] = await Promise.all([
      ctx.db.query("authIdentities").withIndex("by_userId", (q) => q.eq("userId", args.userId)).collect(),
      ctx.db.query("authEvents").withIndex("by_userId", (q) => q.eq("userId", args.userId)).order("desc").take(50),
    ]);

    const connectedProviders = identities.map((idDoc: any) => ({
      provider: idDoc.provider,
      providerEmail: idDoc.providerEmail || user.email,
      providerEmailVerified: !!idDoc.providerEmailVerified,
      connectedAt: idDoc.createdAt,
      lastUsedAt: idDoc.lastUsedAt,
    }));

    if (user.passwordHash && !connectedProviders.some((p: any) => p.provider === "password")) {
      connectedProviders.unshift({
        provider: "password",
        providerEmail: user.email,
        providerEmailVerified: !!user.emailVerified,
        connectedAt: user.createdAt,
        lastUsedAt: user.lastLoginAt,
      });
    }

    const failedLogins = authEventsList.filter((e: any) => e.eventType?.includes("failed")).length;
    const suspiciousLogins = authEventsList.filter((e: any) => e.eventType?.includes("suspicious")).length;

    return {
      primaryLoginMethod: connectedProviders[0]?.provider || "password",
      connectedProviders,
      emailVerified: !!user.emailVerified,
      emailVerifiedAt: user.emailVerifiedAt,
      phone: user.phone,
      phoneNormalized: user.phoneNormalized,
      phoneStatus: user.phone ? (user.phoneVerifiedAt || user.phoneStatus === "verified" ? "verified" : (user.phoneStatus || "unverified")) : "not_set",
      phoneVerified: !!(user.phoneVerifiedAt || user.phoneStatus === "verified"),
      phoneVerifiedAt: user.phoneVerifiedAt,
      phoneUsedForRecovery: !!user.phoneUsedForRecovery,
      phoneUsedForMfa: !!user.phoneUsedForMfa,
      twoFactor: {
        enabled: !!user.twoFactorEnabled,
        backupCodesRemaining: user.twoFactorBackupCodes ? user.twoFactorBackupCodes.length : 0,
      },
      stats: {
        totalLogins: user.totalLoginCount || (user.lastLoginAt ? 1 : 0),
        failedLoginsCount: user.failedLoginAttempts || failedLogins,
        suspiciousLoginsCount: suspiciousLogins,
        lastLoginAt: user.lastLoginAt,
        lastLoginIp: user.lastLoginIp,
        lockedUntil: user.lockedUntil,
        isLocked: !!(user.lockedUntil && user.lockedUntil > Date.now()),
      },
    };
  },
});

/**
 * getUserSecuritySummary
 * Sanitized session metadata (masked IP, device, OS, location) and security audit log events
 */
export const getUserSecuritySummary = query({
  args: {
    sessionToken: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await verifyAdminSession(ctx, args.sessionToken, "admin.users.view_security_summary");

    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found.");

    const [sessions, userAuditLogs, authEventsList] = await Promise.all([
      ctx.db.query("sessions").withIndex("by_userId", (q) => q.eq("userId", args.userId)).collect(),
      ctx.db.query("userAuditLogs").withIndex("by_userId", (q) => q.eq("userId", args.userId)).order("desc").take(30),
      ctx.db.query("authEvents").withIndex("by_userId", (q) => q.eq("userId", args.userId)).order("desc").take(30),
    ]);

    const now = Date.now();

    // Helper to mask IP address (e.g. 192.168.1.100 -> 192.168.xxx.xxx)
    const maskIp = (ip?: string) => {
      if (!ip) return "system";
      const parts = ip.split(".");
      if (parts.length === 4) return `${parts[0]}.${parts[1]}.xxx.xxx`;
      return ip.substring(0, Math.min(8, ip.length)) + "...";
    };

    const sanitizedSessions = sessions.map((s: any) => {
      const isExpired = s.expiresAt < now;
      const isRevoked = !!s.revokedAt;
      return {
        id: s._id,
        deviceName: s.deviceName || "Browser Session",
        authenticationMethod: s.authenticationMethod || "password",
        maskedIp: maskIp(s.ipAddress),
        userAgent: s.userAgent || "Desktop Browser",
        lastActiveAt: s.lastActiveAt,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        status: isRevoked ? "revoked" : isExpired ? "expired" : "active",
        isRevoked,
      };
    });

    const activeSessionsCount = sanitizedSessions.filter((s) => s.status === "active").length;
    const revokedSessionsCount = sanitizedSessions.filter((s) => s.isRevoked).length;

    return {
      metrics: {
        activeSessionsCount,
        revokedSessionsCount,
        totalSessionsCount: sessions.length,
        twoFactorEnabled: !!user.twoFactorEnabled,
        lastLoginAt: user.lastLoginAt,
        failedAttempts: user.failedLoginAttempts || 0,
        lockedUntil: user.lockedUntil,
        isLocked: !!(user.lockedUntil && user.lockedUntil > now),
      },
      sessions: sanitizedSessions,
      recentSecurityEvents: authEventsList.map((e: any) => ({
        id: e._id,
        eventType: e.eventType,
        maskedIp: maskIp(e.ipAddress),
        userAgent: e.userAgent,
        createdAt: e.createdAt,
        metadata: e.metadata,
      })),
      recentUserAuditLogs: userAuditLogs.map((l: any) => ({
        id: l._id,
        eventType: l.eventType,
        severity: l.severity,
        maskedIp: maskIp(l.ipAddress),
        createdAt: l.createdAt,
        metadata: l.metadata,
      })),
    };
  },
});

/**
 * getUserOrganizations
 * Details all owned, joined, archived, and suspended organizations with ownership limit checks
 */
export const getUserOrganizations = query({
  args: {
    sessionToken: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await verifyAdminSession(ctx, args.sessionToken, "admin.users.view_memberships");

    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found.");

    const [
      allWorkspaces,
      userMemberships,
      allMemberships,
      subscriptions,
      branches,
      workspaceProducts,
      plans,
      override,
    ] = await Promise.all([
      ctx.db.query("workspaces").collect(),
      ctx.db.query("workspaceMemberships").withIndex("by_user", (q) => q.eq("userId", args.userId)).collect(),
      ctx.db.query("workspaceMemberships").collect(),
      ctx.db.query("subscriptions").collect(),
      ctx.db.query("branches").collect(),
      ctx.db.query("workspaceProducts").collect(),
      ctx.db.query("plans").collect(),
      ctx.db
        .query("organizationLimitOverrides")
        .withIndex("by_user_feature", (q) =>
          q.eq("userId", args.userId).eq("featureKey", "organization.max_owned_count")
        )
        .first(),
    ]);

    const defaultPlan = DEFAULT_PLANS.find((p) => p.key === "free") || DEFAULT_PLANS[0];

    const owned = allWorkspaces.filter((w: any) => w.ownerId === args.userId);
    const ownedIds = new Set(owned.map((w: any) => w._id));

    const joinedWorkspaceIds = userMemberships
      .filter((m: any) => !ownedIds.has(m.workspaceId))
      .map((m: any) => m.workspaceId);

    const joined = allWorkspaces.filter((w: any) => joinedWorkspaceIds.includes(w._id));

    const enrichOrg = (ws: any, isOwner: boolean, membership?: any) => {
      const sub = subscriptions.find(
        (s: any) => s.workspaceId === ws._id || s.organizationId === ws.organizationId
      );
      const planKey = (sub?.planKey || ws.planId || "free_trial").toLowerCase();
      const isTrial =
        planKey === "free_trial" ||
        planKey === "free" ||
        sub?.status === "trial" ||
        sub?.status === "trialing";

      const matchedPlan =
        plans.find((p: any) => p.key === planKey || (planKey === "free" && p.key === "free_trial")) ||
        DEFAULT_PLANS.find((p) => p.key === planKey) ||
        defaultPlan;

      const wsMembers = allMemberships.filter((m: any) => m.workspaceId === ws._id && m.status === "active");
      const wsApps = workspaceProducts.filter((wp: any) => wp.workspaceId === ws._id && wp.status === "active");
      const wsBranches = branches.filter((b: any) => b.workspaceId === ws._id && b.status === "active");

      const now = Date.now();
      const trialEndsAt =
        sub?.trialEndsAt ||
        sub?.trialEnd ||
        (isTrial ? sub?.currentPeriodEnd || ws.createdAt + 30 * 86_400_000 : undefined);
      const daysRemaining = trialEndsAt
        ? Math.max(0, Math.ceil((trialEndsAt - now) / (1000 * 60 * 60 * 24)))
        : null;

      return {
        id: ws._id,
        organizationId: ws.organizationId || ws._id,
        name: ws.name,
        slug: ws.slug,
        type: ws.type || "retail",
        country: ws.country || "Nigeria",
        currency: ws.currency || "NGN",
        timezone: ws.timezone || "Africa/Lagos",
        status: ws.status || "active",
        isOwner,
        role: isOwner ? "OWNER" : membership?.role || "MEMBER",
        membershipStatus: membership?.status || (isOwner ? "active" : "unknown"),
        planKey,
        planName: matchedPlan.name,
        subscriptionStatus: sub?.status || (isTrial ? "trialing" : "active"),
        isTrial,
        trialEndsAt,
        daysRemaining,
        stats: {
          memberCount: wsMembers.length,
          applicationCount: wsApps.length,
          branchCount: wsBranches.length,
        },
        createdAt: ws.createdAt,
        updatedAt: ws.updatedAt,
      };
    };

    const ownedOrgs = owned
      .filter((w: any) => w.status !== "deleted" && w.status !== "archived")
      .map((w: any) => enrichOrg(w, true));

    const joinedOrgs = joined
      .filter((w: any) => w.status !== "deleted")
      .map((w: any) => {
        const m = userMemberships.find((mem: any) => mem.workspaceId === w._id);
        return enrichOrg(w, false, m);
      });

    const archivedOrgs = owned
      .filter((w: any) => w.status === "archived" || w.status === "deleted")
      .map((w: any) => enrichOrg(w, true));

    const suspendedOrgs = owned
      .filter((w: any) => w.status === "suspended")
      .map((w: any) => enrichOrg(w, true));

    const baseLimit = 3;
    const maxLimit = override?.overrideLimit ?? baseLimit;
    const ownedCount = ownedOrgs.length;
    const remainingSlots = Math.max(0, maxLimit - ownedCount);

    return {
      ownershipQuota: {
        ownedCount,
        maxLimit,
        remainingSlots,
        isLimitReached: ownedCount >= maxLimit,
        hasOverride: !!override,
        overrideLimit: override?.overrideLimit,
        overrideReason: override?.reason,
      },
      owned: ownedOrgs,
      joined: joinedOrgs,
      archived: archivedOrgs,
      suspended: suspendedOrgs,
    };
  },
});

/**
 * getUserAccess
 * Returns hierarchical access tree (Organization -> Applications -> Role -> Branches -> Role/Permissions)
 * and staff transfer history
 */
export const getUserAccess = query({
  args: {
    sessionToken: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await verifyAdminSession(ctx, args.sessionToken, "admin.users.view_memberships");

    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found.");

    const [
      workspaces,
      userMemberships,
      productMembershipsList,
      appBranchAccessList,
      branches,
      transfers,
    ] = await Promise.all([
      ctx.db.query("workspaces").collect(),
      ctx.db.query("workspaceMemberships").withIndex("by_user", (q: any) => q.eq("userId", args.userId)).collect(),
      ctx.db.query("productMemberships").collect(),
      ctx.db.query("appBranchAccess").collect(),
      ctx.db.query("branches").collect(),
      ctx.db.query("organizationAuditLogs").withIndex("by_userId", (q: any) => q.eq("userId", args.userId)).collect(),
    ]);

    const ownedWs = workspaces.filter((w: any) => w.ownerId === args.userId);
    const memberWsIds = new Set(userMemberships.map((m: any) => m.workspaceId));
    const allUserWorkspaces = workspaces.filter(
      (w: any) => w.ownerId === args.userId || memberWsIds.has(w._id)
    );

    const hierarchy = allUserWorkspaces.map((ws: any) => {
      const isOwner = ws.ownerId === args.userId;
      const wsMembership = userMemberships.find((m: any) => m.workspaceId === ws._id);

      // App memberships for this workspace
      const userApps = productMembershipsList.filter(
        (am: any) => am.workspaceId === ws._id && am.userId === args.userId
      );

      // Default inventory access if owner
      const applications = [
        {
          key: "inventory",
          name: "Inventory Management",
          status: "active",
          role: isOwner ? "Inventory Owner" : userApps.find((a: any) => a.productKey === "inventory")?.role || "Staff",
          membershipStatus: isOwner ? "active" : userApps.find((a: any) => a.productKey === "inventory")?.status || "active",
          branches: branches
            .filter((b: any) => b.workspaceId === ws._id)
            .map((b: any) => {
              const bMem = appBranchAccessList.find(
                (bm: any) => bm.branchId === b._id && bm.userId === args.userId
              );
              return {
                branchId: b._id,
                branchName: b.name,
                branchCode: b.code || "MAIN",
                isPrimary: !!b.isPrimary,
                status: b.status || "active",
                userRole: isOwner ? "Manager / Owner" : "Member",
                userStatus: isOwner ? "active" : bMem?.status || "active",
                permissions: isOwner
                  ? ["view", "sell", "adjust_stock", "reports", "manage_staff", "settings"]
                  : ["view", "sell"],
                assignedAt: bMem?.createdAt || ws.createdAt,
              };
            }),
        },
      ];

      return {
        workspaceId: ws._id,
        organizationName: ws.name,
        slug: ws.slug,
        isOwner,
        organizationRole: isOwner ? "OWNER" : wsMembership?.role || "MEMBER",
        applications,
      };
    });

    const transferHistory = transfers
      .filter((t: any) => t.eventType?.includes("branch"))
      .map((t: any) => {
        const metadata = t.metadata || {};
        const srcBranch = branches.find((b: any) => b._id === metadata.sourceBranchId);
        const tgtBranch = branches.find((b: any) => b._id === metadata.targetBranchId);
        const ws = workspaces.find((w: any) => w._id === t.workspaceId || w._id === metadata.workspaceId);

        return {
          id: t._id,
          workspaceId: t.workspaceId || metadata.workspaceId,
          organizationName: ws?.name || "Organization",
          applicationKey: metadata.applicationKey || "inventory",
          sourceBranchName: srcBranch?.name || metadata.sourceBranchName || "Unknown Branch",
          targetBranchName: tgtBranch?.name || metadata.targetBranchName || "Unknown Branch",
          previousRole: metadata.previousRole || "Staff",
          newRole: metadata.newRole || "Staff",
          reason: metadata.reason || t.eventType,
          effectiveAt: t.createdAt,
        };
      });

    return {
      hierarchy,
      transferHistory,
    };
  },
});

/**
 * getUserBilling
 * Details per-organization subscriptions, Paystack customer codes, payment transactions, and automated mismatch detection
 */
export const getUserBilling = query({
  args: {
    sessionToken: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await verifyAdminSession(ctx, args.sessionToken, "admin.users.view_billing");

    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found.");

    const [
      workspaces,
      subscriptions,
      payments,
      invoices,
      manualPayments,
      plans,
    ] = await Promise.all([
      ctx.db.query("workspaces").withIndex("by_owner", (q) => q.eq("ownerId", args.userId)).collect(),
      ctx.db.query("subscriptions").collect(),
      ctx.db.query("payments").collect(),
      ctx.db.query("invoices").collect(),
      ctx.db.query("manualPayments").collect(),
      ctx.db.query("plans").collect(),
    ]);

    const defaultPlan = DEFAULT_PLANS.find((p) => p.key === "free") || DEFAULT_PLANS[0];

    const ownedWsIds = new Set(workspaces.map((w: any) => w._id));

    const userSubscriptions = subscriptions.filter(
      (s: any) => s.userId === args.userId || ownedWsIds.has(s.workspaceId)
    );

    const userPayments = payments.filter(
      (p: any) => p.userId === args.userId || ownedWsIds.has(p.workspaceId)
    );

    const userInvoices = invoices.filter(
      (i: any) => ownedWsIds.has(i.workspaceId)
    );

    const userManualPayments = manualPayments.filter(
      (m: any) => ownedWsIds.has(m.workspaceId)
    );

    // Build automated Mismatch Detection
    const mismatches: {
      type: string;
      severity: "warning" | "critical";
      organizationId: string;
      organizationName: string;
      message: string;
    }[] = [];

    const organizationBilling = workspaces.map((ws: any) => {
      const sub = userSubscriptions.find((s: any) => s.workspaceId === ws._id);
      const orgPayments = userPayments.filter((p: any) => p.workspaceId === ws._id);
      const orgInvoices = userInvoices.filter((i: any) => i.workspaceId === ws._id);

      const planKey = (sub?.planKey || ws.planId || "free_trial").toLowerCase();
      const plan = plans.find((p: any) => p.key === planKey) || defaultPlan;

      const hasSuccessfulPayment = orgPayments.some((p: any) => p.status === "success" || p.status === "completed");

      // Mismatch check 1: Payment verified but subscription status is trial/inactive
      if (hasSuccessfulPayment && (planKey === "free" || planKey === "free_trial")) {
        mismatches.push({
          type: "PAYMENT_WITHOUT_PAID_PLAN",
          severity: "critical",
          organizationId: ws._id,
          organizationName: ws.name,
          message: `Successful Paystack payment recorded, but active subscription plan is '${planKey}'.`,
        });
      }

      // Mismatch check 2: Standard plan with trial dates
      if ((planKey === "standard" || planKey === "premium") && (sub?.status === "trial" || sub?.status === "trialing")) {
        mismatches.push({
          type: "PAID_PLAN_IN_TRIAL_STATUS",
          severity: "warning",
          organizationId: ws._id,
          organizationName: ws.name,
          message: `Subscription has plan '${planKey}' but status is '${sub?.status}'.`,
        });
      }

      return {
        workspaceId: ws._id,
        organizationName: ws.name,
        slug: ws.slug,
        subscription: {
          id: sub?._id,
          planKey,
          planName: plan.name,
          status: sub?.status || "trialing",
          amount: sub?.amount || plan.price?.monthly || 0,
          currency: sub?.currency || "NGN",
          billingInterval: sub?.billingInterval || "monthly",
          currentPeriodStart: sub?.currentPeriodStart || ws.createdAt,
          currentPeriodEnd: sub?.currentPeriodEnd || ws.createdAt + 30 * 86_400_000,
          paystackCustomerCode: sub?.paystackCustomerCode,
          paystackSubscriptionCode: sub?.paystackSubscriptionCode,
          lastPaymentReference: sub?.lastPaymentReference,
          lastPaymentDate: sub?.lastPaymentDate,
          cancelAtPeriodEnd: !!sub?.cancelAtPeriodEnd,
        },
        payments: orgPayments.map((p: any) => ({
          id: p._id,
          amount: p.amount,
          currency: p.currency || "NGN",
          provider: p.provider || "paystack",
          reference: p.reference || p.providerReference,
          status: p.status,
          createdAt: p.createdAt,
          completedAt: p.completedAt,
        })),
        invoices: orgInvoices.map((inv: any) => ({
          id: inv._id,
          invoiceNumber: inv.invoiceNumber,
          amount: inv.amount,
          currency: inv.currency || "NGN",
          status: inv.status,
          dueDate: inv.dueDate,
          paidAt: inv.paidAt,
          pdfUrl: inv.pdfUrl,
          createdAt: inv.createdAt,
        })),
      };
    });

    return {
      summary: {
        totalSubscriptions: userSubscriptions.length,
        activePaidSubscriptions: userSubscriptions.filter((s: any) => s.status === "active" && s.planKey !== "free_trial").length,
        failedPaymentsCount: userPayments.filter((p: any) => p.status === "failed").length,
        totalPaymentsRecorded: userPayments.length,
        isConsistent: mismatches.length === 0,
        mismatchCount: mismatches.length,
      },
      mismatches,
      organizations: organizationBilling,
      manualPayments: userManualPayments.map((m: any) => ({
        id: m._id,
        workspaceId: m.workspaceId,
        planKey: m.planKey,
        amount: m.amount,
        currency: m.currency,
        paymentReference: m.paymentReference,
        paymentMethod: m.paymentMethod,
        paidAt: m.paidAt,
        notes: m.notes,
      })),
    };
  },
});

/**
 * getUserUsage
 * Usage vs plan entitlements across all owned organizations
 */
export const getUserUsage = query({
  args: {
    sessionToken: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await verifyAdminSession(ctx, args.sessionToken, "admin.users.view_billing");

    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found.");

    const [
      workspaces,
      subscriptions,
      plans,
      branches,
      workspaceProducts,
      memberships,
    ] = await Promise.all([
      ctx.db.query("workspaces").withIndex("by_owner", (q) => q.eq("ownerId", args.userId)).collect(),
      ctx.db.query("subscriptions").collect(),
      ctx.db.query("plans").collect(),
      ctx.db.query("branches").collect(),
      ctx.db.query("workspaceProducts").collect(),
      ctx.db.query("workspaceMemberships").collect(),
    ]);

    const defaultPlan = DEFAULT_PLANS.find((p) => p.key === "free") || DEFAULT_PLANS[0];

    const orgUsage = workspaces.map((ws: any) => {
      const sub = subscriptions.find((s: any) => s.workspaceId === ws._id);
      const planKey = (sub?.planKey || ws.planId || "free_trial").toLowerCase();
      const plan = plans.find((p: any) => p.key === planKey) || defaultPlan;

      const limits = plan.limits || defaultPlan.limits;
      const maxApps = limits.maxAppsPerOrganization ?? limits.apps ?? 1;
      const maxBranches = limits.maxBranchesPerApp ?? limits.branches ?? 1;
      const maxMembers = limits.maxMembersPerOrganization ?? limits.members ?? 2;
      const maxProducts = limits.maxProductsPerWorkspace ?? limits.products ?? 500;
      const maxTransactions = limits.maxTransactionsPerMonth ?? limits.transactions ?? 500;

      const activeAppsCount = workspaceProducts.filter(
        (wp: any) => wp.workspaceId === ws._id && wp.status === "active"
      ).length;
      const activeBranchesCount = branches.filter(
        (b: any) => b.workspaceId === ws._id && b.status === "active"
      ).length;
      const activeMembersCount = memberships.filter(
        (m: any) => m.workspaceId === ws._id && m.status === "active"
      ).length;

      return {
        workspaceId: ws._id,
        organizationName: ws.name,
        slug: ws.slug,
        planKey,
        planName: plan.name,
        limits: {
          maxApps,
          maxBranches,
          maxMembers,
          maxProducts,
          maxTransactions,
        },
        currentUsage: {
          apps: activeAppsCount,
          branches: activeBranchesCount,
          members: activeMembersCount,
          products: 0,
          transactions: 0,
        },
      };
    });

    return {
      userId: args.userId,
      ownedOrganizationsCount: workspaces.length,
      maxOrganizationsLimit: 3,
      organizations: orgUsage,
    };
  },
});

/**
 * getUserNotifications
 * User notification diagnostics, delivery logs, email bounce state, preferences
 */
export const getUserNotifications = query({
  args: {
    sessionToken: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await verifyAdminSession(ctx, args.sessionToken, "admin.users.view_audit_logs");

    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found.");

    const [notifications, preferences, emailOutboxList] = await Promise.all([
      ctx.db.query("notifications").withIndex("by_userId", (q) => q.eq("userId", args.userId)).order("desc").take(50),
      ctx.db.query("notificationPreferences").withIndex("by_userId", (q) => q.eq("userId", args.userId)).collect(),
      ctx.db.query("emailOutbox").collect(),
    ]);

    const userEmails = emailOutboxList.filter((e: any) => e.to?.toLowerCase() === user.email?.toLowerCase());

    const totalNotifications = notifications.length;
    const unreadCount = notifications.filter((n: any) => n.status === "UNREAD").length;
    const failedEmailsCount = userEmails.filter((e: any) => e.status === "FAILED").length;

    return {
      metrics: {
        totalNotifications,
        unreadCount,
        failedEmailsCount,
        emailDeliverySuccessRate: userEmails.length > 0 ? Math.round(((userEmails.length - failedEmailsCount) / userEmails.length) * 100) : 100,
      },
      preferences: preferences.map((p: any) => ({
        category: p.category,
        channel: p.channel,
        enabled: p.enabled,
        updatedAt: p.updatedAt,
      })),
      recentNotifications: notifications.slice(0, 20).map((n: any) => ({
        id: n._id,
        title: n.title,
        body: n.body,
        type: n.type,
        severity: n.severity,
        channel: n.channel,
        status: n.status,
        createdAt: n.createdAt,
        readAt: n.readAt,
      })),
      emailDeliveryLogs: userEmails.slice(0, 20).map((e: any) => ({
        id: e._id,
        template: e.template,
        status: e.status,
        attempts: e.attempts,
        lastError: e.lastError,
        createdAt: e.createdAt,
        sentAt: e.sentAt,
      })),
    };
  },
});

/**
 * getUserActivity
 * Full multi-source audit timeline (userAuditLogs, auditLogs, workspaceAuditLogs, authEvents) with filters and pagination
 */
export const getUserActivity = query({
  args: {
    sessionToken: v.string(),
    userId: v.id("users"),
    category: v.optional(v.string()), // "all" | "auth" | "admin" | "billing" | "org"
    severity: v.optional(v.string()), // "all" | "info" | "warning" | "critical"
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await verifyAdminSession(ctx, args.sessionToken, "admin.users.view_audit_logs");

    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found.");

    const [userAuditLogs, adminAuditLogs, authEventsList] = await Promise.all([
      ctx.db.query("userAuditLogs").withIndex("by_userId", (q) => q.eq("userId", args.userId)).collect(),
      ctx.db.query("auditLogs").withIndex("by_target_user", (q) => q.eq("targetUserId", args.userId)).collect(),
      ctx.db.query("authEvents").withIndex("by_userId", (q) => q.eq("userId", args.userId)).collect(),
    ]);

    const maskIp = (ip?: string) => {
      if (!ip) return "system";
      const parts = ip.split(".");
      if (parts.length === 4) return `${parts[0]}.${parts[1]}.xxx.xxx`;
      return ip.substring(0, Math.min(8, ip.length)) + "...";
    };

    let allEvents: any[] = [];

    for (const l of userAuditLogs) {
      allEvents.push({
        id: l._id,
        source: "user_audit",
        category: "user_action",
        eventType: l.eventType,
        severity: l.severity || "info",
        actor: user.name || user.email,
        maskedIp: maskIp(l.ipAddress),
        userAgent: l.userAgent,
        requestId: l.requestId,
        metadata: l.metadata,
        timestamp: l.createdAt,
      });
    }

    for (const l of adminAuditLogs) {
      allEvents.push({
        id: l._id,
        source: "admin_audit",
        category: "admin_action",
        eventType: l.eventType || l.action,
        severity: l.severity || "warning",
        actor: l.actorId ? `Admin (${l.actorId})` : "System Admin",
        maskedIp: maskIp(l.ipAddress),
        userAgent: l.userAgent,
        requestId: l.requestId,
        metadata: l.metadata,
        timestamp: l.createdAt || l.timestamp,
      });
    }

    for (const e of authEventsList) {
      allEvents.push({
        id: e._id,
        source: "auth_event",
        category: "security",
        eventType: e.eventType,
        severity: e.eventType?.includes("failed") ? "warning" : "info",
        actor: user.email,
        maskedIp: maskIp(e.ipAddress),
        userAgent: e.userAgent,
        metadata: e.metadata,
        timestamp: e.createdAt,
      });
    }

    // Apply filters
    if (args.severity && args.severity !== "all") {
      allEvents = allEvents.filter((ev) => ev.severity === args.severity);
    }
    if (args.category && args.category !== "all") {
      allEvents = allEvents.filter((ev) => ev.category === args.category);
    }
    if (args.startDate) {
      allEvents = allEvents.filter((ev) => ev.timestamp >= args.startDate!);
    }
    if (args.endDate) {
      allEvents = allEvents.filter((ev) => ev.timestamp <= args.endDate!);
    }

    // Sort descending
    allEvents.sort((a, b) => b.timestamp - a.timestamp);

    const maxLimit = Math.min(200, Math.max(1, args.limit || 50));
    return allEvents.slice(0, maxLimit);
  },
});

/**
 * getUserSupportNotes
 * Returns private internal support notes for authorized superadmins
 */
export const getUserSupportNotes = query({
  args: {
    sessionToken: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await verifyAdminSession(ctx, args.sessionToken, "admin.users.manage_notes");

    const notes = await ctx.db
      .query("userAdminSupportNotes")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();

    return notes.map((n: any) => ({
      id: n._id,
      userId: n.userId,
      adminUserId: n.authorId,
      adminName: n.authorName || "Admin",
      category: n.category,
      note: n.note,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
    }));
  },
});

/**
 * addSupportNote
 * Adds an internal admin note with category and audit log
 */
export const addSupportNote = mutation({
  args: {
    sessionToken: v.string(),
    userId: v.id("users"),
    organizationId: v.optional(v.string()),
    category: v.union(
      v.literal("support"),
      v.literal("billing"),
      v.literal("security"),
      v.literal("onboarding"),
      v.literal("general")
    ),
    note: v.string(),
  },
  handler: async (ctx, args) => {
    const { admin } = await verifyAdminSession(ctx, args.sessionToken, "admin.users.manage_notes");

    if (!args.note.trim()) {
      throw new Error("Support note content cannot be empty.");
    }

    const now = Date.now();
    const noteId = await ctx.db.insert("userAdminSupportNotes", {
      userId: args.userId,
      authorId: admin._id,
      authorName: admin.name || admin.email,
      category: args.category,
      note: args.note.trim(),
      visibility: "admin_only",
      createdAt: now,
      updatedAt: now,
    });

    await logAudit(
      ctx,
      admin._id,
      "ADMIN_SUPPORT_NOTE_CREATED",
      args.userId,
      { category: args.category, noteId },
      "admin.user_support_note_created"
    );

    return { success: true, noteId };
  },
});

/**
 * deleteSupportNote
 * Deletes an internal support note with audit log
 */
export const deleteSupportNote = mutation({
  args: {
    sessionToken: v.string(),
    noteId: v.id("userAdminSupportNotes"),
  },
  handler: async (ctx, args) => {
    const { admin } = await verifyAdminSession(ctx, args.sessionToken, "admin.users.manage_notes");

    const note = await ctx.db.get(args.noteId);
    if (!note) throw new Error("Support note not found.");

    await ctx.db.delete(args.noteId);

    await logAudit(
      ctx,
      admin._id,
      "ADMIN_SUPPORT_NOTE_DELETED",
      note.userId,
      { noteId: args.noteId, category: note.category },
      "admin.user_support_note_deleted"
    );

    return { success: true };
  },
});

/**
 * suspendUser
 * Suspends user account, records reasons/notes, revokes active sessions, and queues email
 */
export const suspendUser = mutation({
  args: {
    sessionToken: v.string(),
    userId: v.id("users"),
    reason: v.optional(v.string()),
    notes: v.optional(v.string()),
    revokeAllSessions: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { admin } = await verifyAdminSession(ctx, args.sessionToken, "admin.users.suspend");

    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found.");

    if (admin.email && user.email && admin.email.toLowerCase() === user.email.toLowerCase()) {
      throw new Error("You cannot suspend your own user account.");
    }

    if (user.role === "superadmin") {
      const allUsers = await ctx.db.query("users").collect();
      const activeSuperadmins = allUsers.filter(
        (u: any) =>
          u.role === "superadmin" &&
          (u.status || "ACTIVE") === "ACTIVE" &&
          !u.deletedAt
      );
      if (activeSuperadmins.length < 2) {
        throw new Error(
          "Cannot suspend superadmin: At least 2 active superadmins must exist on the platform."
        );
      }
    }

    const now = Date.now();
    await ctx.db.patch(args.userId, {
      status: "SUSPENDED",
      suspendedAt: now,
      suspendedBy: admin._id,
      suspensionReason: args.reason || "policy_violation",
      suspensionNotes: args.notes,
      updatedAt: now,
    });

    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    for (const s of sessions) {
      await ctx.db.patch(s._id, { revokedAt: now });
    }

    await ctx.db.insert("emailOutbox", {
      to: user.email,
      template: "accountSuspended",
      payload: {
        name: user.name || user.firstName || "there",
        email: user.email,
        reason: args.reason || "Policy violation",
        notes: args.notes || "",
      },
      status: "PENDING",
      attempts: 0,
      nextAttemptAt: now,
      createdAt: now,
      updatedAt: now,
    });

    await logAudit(
      ctx,
      admin._id,
      "USER_SUSPENDED",
      args.userId,
      {
        userEmail: user.email,
        reason: args.reason,
        notes: args.notes,
        revokedSessionCount: sessions.length,
        severity: "high",
      },
      "admin.user_account_suspended"
    );

    return { success: true };
  },
});

/**
 * activateUser / restoreUser
 * Restores a suspended user account
 */
export const activateUser = mutation({
  args: {
    sessionToken: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { admin } = await verifyAdminSession(ctx, args.sessionToken, "admin.users.restore");

    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found.");

    const now = Date.now();
    await ctx.db.patch(args.userId, {
      status: "ACTIVE",
      suspendedAt: undefined,
      suspendedBy: undefined,
      suspensionReason: undefined,
      suspensionNotes: undefined,
      updatedAt: now,
    });

    await logAudit(
      ctx,
      admin._id,
      "USER_ACTIVATED",
      args.userId,
      { userEmail: user.email, severity: "high" },
      "admin.user_account_restored"
    );

    return { success: true };
  },
});

export const restoreUser = activateUser;

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
    const { admin } = await verifyAdminSession(ctx, args.sessionToken, "admin.users.restore");

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
 * revokeSpecificSession
 * Revokes a single user session by session ID with required reason & audit
 */
export const revokeSpecificSession = mutation({
  args: {
    sessionToken: v.string(),
    userId: v.id("users"),
    sessionId: v.id("sessions"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { admin } = await verifyAdminSession(ctx, args.sessionToken, "admin.users.suspend");

    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found.");

    const now = Date.now();
    await ctx.db.patch(args.sessionId, {
      revokedAt: now,
    });

    await logAudit(
      ctx,
      admin._id,
      "USER_SESSION_REVOKED_SPECIFIC",
      args.userId,
      {
        sessionId: args.sessionId,
        reason: args.reason || "Administrative session revocation",
      },
      "admin.user_session_revoked"
    );

    return { success: true };
  },
});

/**
 * revokeUserSessions
 * Revokes all sessions for a user
 */
export const revokeUserSessions = mutation({
  args: {
    sessionToken: v.string(),
    userId: v.id("users"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { admin } = await verifyAdminSession(ctx, args.sessionToken, "admin.users.suspend");

    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found.");

    const now = Date.now();
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    for (const s of sessions) {
      await ctx.db.patch(s._id, { revokedAt: now });
    }

    await logAudit(
      ctx,
      admin._id,
      "USER_SESSIONS_REVOKED_ALL",
      args.userId,
      {
        userEmail: user.email,
        revokedCount: sessions.length,
        reason: args.reason || "Administrative signout on all devices",
      },
      "admin.user_sessions_revoked"
    );

    return { success: true, count: sessions.length };
  },
});

/**
 * deleteUser
 * Superadmin-initiated user deletion with pre-checks, workspace transfer, grace period vs force delete
 */
export const deleteUser = mutation({
  args: {
    sessionToken: v.string(),
    userId: v.id("users"),
    reason: v.optional(v.string()),
    notes: v.optional(v.string()),
    transferWorkspaceOwnership: v.optional(v.boolean()),
    newOwnerId: v.optional(v.id("users")),
    cancelSubscriptions: v.optional(v.boolean()),
    adminForceDelete: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { admin } = await verifyAdminSession(ctx, args.sessionToken, "admin.users.delete");
    const now = Date.now();

    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found.");

    if (admin.email && user.email && admin.email.toLowerCase() === user.email.toLowerCase()) {
      throw new Error("You cannot delete your own user account via the admin panel.");
    }

    if (user.role === "superadmin") {
      const allUsers = await ctx.db.query("users").collect();
      const superadmins = allUsers.filter(
        (u: any) =>
          u.role === "superadmin" &&
          (u.status || "ACTIVE") === "ACTIVE" &&
          !u.deletedAt
      );
      if (superadmins.length <= 1) {
        throw new Error("Cannot delete the only superadmin. Add another superadmin first.");
      }
    }

    const ownedWorkspaces = await ctx.db
      .query("workspaces")
      .withIndex("by_owner", (q: any) => q.eq("ownerId", args.userId))
      .filter((q: any) => q.neq(q.field("status"), "deleted"))
      .collect();

    if (ownedWorkspaces.length > 0) {
      if (args.transferWorkspaceOwnership && args.newOwnerId) {
        const targetNewOwner = await ctx.db.get(args.newOwnerId);
        if (!targetNewOwner) throw new Error("Target new owner user not found.");

        for (const ws of ownedWorkspaces) {
          await ctx.db.patch(ws._id, {
            ownerId: args.newOwnerId,
            updatedAt: now,
          });

          const membership = await ctx.db
            .query("workspaceMemberships")
            .withIndex("by_workspace", (q: any) => q.eq("workspaceId", ws._id))
            .filter((q: any) => q.eq(q.field("userId"), args.newOwnerId))
            .first();

          if (membership) {
            await ctx.db.patch(membership._id, { role: "OWNER", updatedAt: now });
          } else {
            await ctx.db.insert("workspaceMemberships", {
              workspaceId: ws._id,
              userId: args.newOwnerId,
              role: "OWNER",
              status: "active",
              createdAt: now,
              updatedAt: now,
            });
          }
        }
      } else if (args.adminForceDelete) {
        for (const ws of ownedWorkspaces) {
          await ctx.db.patch(ws._id, {
            status: "deleted",
            deletedAt: now,
            deletedBy: admin._id,
            updatedAt: now,
          });
        }
      } else {
        throw new Error(
          "User owns active workspaces. You must transfer ownership to another member before deletion."
        );
      }
    }

    if (args.cancelSubscriptions) {
      const userSubs = await ctx.db
        .query("subscriptions")
        .withIndex("by_user", (q: any) => q.eq("userId", args.userId))
        .collect();

      for (const sub of userSubs) {
        await ctx.db.patch(sub._id, {
          status: "canceled",
          cancelAtPeriodEnd: false,
          updatedAt: now,
        });
      }
    }

    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
    for (const s of sessions) {
      await ctx.db.patch(s._id, { revokedAt: now });
    }

    if (args.adminForceDelete) {
      const originalEmail = user.email;
      const anonymizedEmail = `deleted_${args.userId}@deleted.local`;

      const authIdentities = await ctx.db
        .query("authIdentities")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .collect();
      for (const id of authIdentities) await ctx.db.delete(id._id);

      const memberships = await ctx.db
        .query("workspaceMemberships")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect();
      for (const m of memberships) await ctx.db.delete(m._id);

      await ctx.db.patch(args.userId, {
        name: "Deleted User",
        firstName: "Deleted",
        lastName: "User",
        displayName: "Deleted User",
        email: anonymizedEmail,
        emailNormalized: anonymizedEmail,
        passwordHash: undefined,
        twoFactorEnabled: false,
        twoFactorSecret: undefined,
        twoFactorPendingSecret: undefined,
        twoFactorBackupCodes: undefined,
        phone: undefined,
        avatar: undefined,
        avatarUrl: undefined,
        bio: undefined,
        status: "DELETED",
        deletedAt: now,
        deletedBy: admin._id,
        updatedAt: now,
      });

      await logAudit(
        ctx,
        admin._id,
        "USER_DELETED_FORCE",
        args.userId,
        {
          deletedUserEmail: originalEmail,
          reason: args.reason,
          severity: "critical",
        },
        "admin.user_deleted"
      );

      return { success: true, immediate: true };
    } else {
      const scheduledDeletionAt = now + 7 * 86400000;

      await ctx.db.insert("accountDeletionRequests", {
        userId: args.userId,
        status: "PENDING",
        reason: args.reason,
        requestedBy: admin._id,
        requestedAt: now,
        scheduledDeletionAt,
        adminForceDelete: false,
      });

      await ctx.db.patch(args.userId, {
        deletionRequestedAt: now,
        deletionScheduledAt: scheduledDeletionAt,
        deletedBy: admin._id,
        updatedAt: now,
      });

      await logAudit(
        ctx,
        admin._id,
        "USER_DELETION_SCHEDULED",
        args.userId,
        {
          deletedUserEmail: user.email,
          reason: args.reason,
          scheduledDeletionAt,
          severity: "critical",
        },
        "admin.user_deleted"
      );

      return { success: true, immediate: false, scheduled: true, scheduledDeletionAt };
    }
  },
});

/**
 * getSuspensionHistory
 * Retrieves past suspension and restore events for a user
 */
export const getSuspensionHistory = query({
  args: {
    sessionToken: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await verifyAdminSession(ctx, args.sessionToken, "admin.users.view_audit_logs");

    const logs = await ctx.db
      .query("auditLogs")
      .withIndex("by_target_user", (q) => q.eq("targetUserId", args.userId))
      .collect();

    const suspensionLogs = logs
      .filter(
        (l) =>
          l.eventType === "admin.user_suspended" ||
          l.eventType === "admin.user_account_suspended" ||
          l.eventType === "admin.user_restored" ||
          l.eventType === "admin.user_account_restored" ||
          l.action === "USER_SUSPENDED" ||
          l.action === "USER_ACTIVATED"
      )
      .sort((a, b) => (b.createdAt || b.timestamp) - (a.createdAt || a.timestamp));

    return suspensionLogs.map((l) => ({
      id: l._id,
      eventType: l.eventType || l.action,
      action: l.action,
      severity: l.severity,
      metadata: l.metadata,
      createdAt: l.createdAt || l.timestamp,
    }));
  },
});

/**
 * unlinkUserPhone
 * Admin action to unlink/reset a user's phone for administrative recovery
 */
export const unlinkUserPhone = mutation({
  args: {
    sessionToken: v.string(),
    userId: v.id("users"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const { admin } = await verifyAdminSession(ctx, args.sessionToken, "admin.users.update");
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found.");

    const now = Date.now();
    const oldPhone = user.phone;
    const oldNormalized = user.phoneNormalized;

    await ctx.db.patch(args.userId, {
      phone: undefined,
      phoneNormalized: undefined,
      phoneVerifiedAt: undefined,
      phoneStatus: "not_set",
      phoneUsedForRecovery: false,
      phoneUsedForMfa: false,
      updatedAt: now,
    });

    // Invalidate any pending challenges
    const pendingChallenges = await ctx.db
      .query("phoneVerificationChallenges")
      .withIndex("by_user_purpose", (q) => q.eq("userId", args.userId))
      .collect();

    for (const ch of pendingChallenges) {
      if (ch.status === "pending") {
        await ctx.db.patch(ch._id, { status: "cancelled" });
      }
    }

    await logAudit(
      ctx,
      admin._id,
      "USER_PHONE_UNLINKED",
      args.userId,
      {
        previousPhone: oldPhone,
        previousPhoneNormalized: oldNormalized,
        reason: args.reason,
        severity: "warning",
      },
      "admin.user_phone_unlinked"
    );

    return { success: true };
  },
});

/**
 * overrideUserPhoneVerified
 * Admin action to mark a user's phone verified
 */
export const overrideUserPhoneVerified = mutation({
  args: {
    sessionToken: v.string(),
    userId: v.id("users"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const { admin } = await verifyAdminSession(ctx, args.sessionToken, "admin.users.update");
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found.");
    if (!user.phone) throw new Error("User has no phone number to mark verified.");

    const now = Date.now();
    await ctx.db.patch(args.userId, {
      phoneVerifiedAt: now,
      phoneStatus: "verified",
      updatedAt: now,
    });

    await logAudit(
      ctx,
      admin._id,
      "USER_PHONE_OVERRIDE_VERIFIED",
      args.userId,
      {
        phone: user.phone,
        phoneNormalized: user.phoneNormalized,
        reason: args.reason,
        severity: "warning",
      },
      "admin.user_phone_override_verified"
    );

    return { success: true, verifiedAt: now };
  },
});

