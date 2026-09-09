import { mutation, query } from "./_generated/server.js";
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

async function logAudit(ctx: any, adminId: any, action: string, resourceId?: string, details?: any) {
  await ctx.db.insert("adminAuditLogs", {
    adminId,
    action,
    resourceType: "workspaces",
    resourceId,
    details,
    createdAt: Date.now(),
  });
}

/**
 * listOrganizations
 * Paginated query for workspaces/organizations with member counts and owner details
 */
export const listOrganizations = query({
  args: {
    sessionToken: v.string(),
    search: v.optional(v.string()),
    statusFilter: v.optional(v.string()),
    typeFilter: v.optional(v.string()),
    planFilter: v.optional(v.string()), // "all" | "free_trial" | "standard"
    branchFilter: v.optional(v.string()), // "all" | "1" | "2-5" | "multiple"
    onboardingFilter: v.optional(v.string()), // "all" | "completed" | "pending"
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
    sortBy: v.optional(v.string()), // "createdAt" | "name"
    sortOrder: v.optional(v.string()), // "asc" | "desc"
  },
  handler: async (ctx, args) => {
    await verifyAdminSession(ctx, args.sessionToken);

    let workspaces = await ctx.db.query("workspaces").collect();

    // 1. Search Filter (name or slug)
    if (args.search && args.search.trim()) {
      const q = args.search.toLowerCase().trim();
      workspaces = workspaces.filter((w: any) => {
        const name = (w.name || "").toLowerCase();
        const slug = (w.slug || "").toLowerCase();
        return name.includes(q) || slug.includes(q);
      });
    }

    // 2. Status Filter
    if (args.statusFilter && args.statusFilter !== "all") {
      const targetStatus = args.statusFilter.toLowerCase();
      workspaces = workspaces.filter(
        (w: any) => (w.status || "active").toLowerCase() === targetStatus
      );
    }

    // 3. Type Filter
    if (args.typeFilter && args.typeFilter !== "all") {
      const targetType = args.typeFilter.toLowerCase();
      workspaces = workspaces.filter(
        (w: any) => (w.type || "business").toLowerCase() === targetType
      );
    }

    // Fetch related maps for all workspaces
    const allMemberships = await ctx.db.query("workspaceMemberships").collect();
    const allProducts = await ctx.db.query("workspaceProducts").collect();
    const allBranches = await ctx.db.query("branches").collect();
    const allSubscriptions = await ctx.db.query("subscriptions").collect();
    const allOrgProfiles = await ctx.db.query("organizationProfiles").collect();
    const allAppOnboardings = await ctx.db.query("applicationOnboardingResponses").collect();

    const memberCountMap: Record<string, number> = {};
    for (const m of allMemberships) {
      memberCountMap[m.workspaceId] = (memberCountMap[m.workspaceId] || 0) + 1;
    }

    const productCountMap: Record<string, string[]> = {};
    for (const p of allProducts) {
      if (!productCountMap[p.workspaceId]) productCountMap[p.workspaceId] = [];
      productCountMap[p.workspaceId].push(p.productKey);
    }

    // Map branches by workspace & organizationId
    const branchCountMap: Record<string, number> = {};
    for (const b of allBranches) {
      if (b.status === "deleted" || b.status === "archived") continue;
      if (b.workspaceId) {
        branchCountMap[b.workspaceId] = (branchCountMap[b.workspaceId] || 0) + 1;
      }
      if (b.organizationId) {
        branchCountMap[b.organizationId] = (branchCountMap[b.organizationId] || 0) + 1;
      }
    }

    // Map subscriptions
    const subMap: Record<string, any> = {};
    for (const s of allSubscriptions) {
      if (s.workspaceId) subMap[s.workspaceId] = s;
      if (s.organizationId) subMap[s.organizationId] = s;
    }

    // Map profiles
    const profileMap: Record<string, any> = {};
    for (const p of allOrgProfiles) {
      profileMap[p.organizationId] = p;
    }

    // Map inventory app onboardings
    const appOnboardingMap: Record<string, any> = {};
    for (const a of allAppOnboardings) {
      appOnboardingMap[a.organizationId] = a;
    }

    // 4. Plan Filter
    if (args.planFilter && args.planFilter !== "all") {
      const targetPlan = args.planFilter.toLowerCase();
      workspaces = workspaces.filter((w: any) => {
        const sub = subMap[w._id] || (w.organizationId ? subMap[w.organizationId] : null);
        const planKey = (sub?.planKey || w.planId || "free_trial").toLowerCase();
        return planKey === targetPlan;
      });
    }

    // 5. Branch Count Filter
    if (args.branchFilter && args.branchFilter !== "all") {
      workspaces = workspaces.filter((w: any) => {
        const count = branchCountMap[w._id] || (w.organizationId ? branchCountMap[w.organizationId] : 0) || 0;
        if (args.branchFilter === "1") return count <= 1;
        if (args.branchFilter === "2-5") return count >= 2 && count <= 5;
        if (args.branchFilter === "multiple") return count > 1;
        return true;
      });
    }

    // 6. Onboarding Completion Filter
    if (args.onboardingFilter && args.onboardingFilter !== "all") {
      workspaces = workspaces.filter((w: any) => {
        const orgId = w.organizationId || w._id;
        const orgCompleted = !!profileMap[orgId];
        const invCompleted = !!appOnboardingMap[orgId];
        const allCompleted = orgCompleted && invCompleted;
        if (args.onboardingFilter === "completed") return allCompleted;
        if (args.onboardingFilter === "pending") return !allCompleted;
        return true;
      });
    }

    // 7. Sorting
    const sortBy = args.sortBy || "createdAt";
    const sortOrder = args.sortOrder || "desc";
    workspaces.sort((a: any, b: any) => {
      let valA = a[sortBy] ?? 0;
      let valB = b[sortBy] ?? 0;
      if (typeof valA === "string") valA = valA.toLowerCase();
      if (typeof valB === "string") valB = valB.toLowerCase();

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    const totalCount = workspaces.length;
    const page = Math.max(1, args.page || 1);
    const pageSize = Math.min(100, Math.max(1, args.pageSize || 10));
    const offset = (page - 1) * pageSize;
    const paginated = workspaces.slice(offset, offset + pageSize);

    // Enrich items
    const items = [];
    for (const ws of paginated) {
      let ownerEmail = "Unknown";
      let ownerName = "Unknown";
      if (ws.ownerId) {
        const owner: any = await ctx.db.get(ws.ownerId);
        if (owner) {
          ownerEmail = owner.email;
          ownerName = owner.name || owner.displayName || "Owner";
        }
      }

      const orgId = ws.organizationId || ws._id;
      const sub = subMap[ws._id] || subMap[orgId];
      const branchCount = branchCountMap[ws._id] || branchCountMap[orgId] || 0;
      const orgProfile = profileMap[orgId];
      const invOnboarding = appOnboardingMap[orgId];

      items.push({
        id: ws._id,
        organizationId: ws.organizationId,
        name: ws.name,
        slug: ws.slug,
        type: ws.type || "business",
        status: ws.status || "active",
        ownerId: ws.ownerId,
        ownerName,
        ownerEmail,
        memberCount: memberCountMap[ws._id] || 0,
        enabledProducts: productCountMap[ws._id] || ws.enabledModules || ["Inventory"],
        branchCount,
        subscription: sub
          ? {
              planKey: sub.planKey,
              status: sub.status,
              trialEndsAt: sub.trialEndsAt,
              currentPeriodEnd: sub.currentPeriodEnd,
            }
          : {
              planKey: ws.planId || "free_trial",
              status: "active",
            },
        onboardingFlags: {
          orgProfileCompleted: !!orgProfile,
          inventoryOnboardingCompleted: !!invOnboarding,
        },
        currency: ws.currency || "NGN",
        country: ws.country,
        createdAt: ws.createdAt,
      });
    }

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
 * getOrganizationDetails
 * Full detail inspection of a single organization
 */
export const getOrganizationDetails = query({
  args: {
    sessionToken: v.string(),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    await verifyAdminSession(ctx, args.sessionToken);

    const ws = await ctx.db.get(args.workspaceId);
    if (!ws) throw new Error("Organization not found.");

    const orgId = ws.organizationId || ws._id;

    // 1. Owner info
    let owner = null;
    if (ws.ownerId) {
      const ownerDoc: any = await ctx.db.get(ws.ownerId);
      if (ownerDoc) {
        owner = {
          id: ownerDoc._id,
          name: ownerDoc.name || ownerDoc.displayName || "Owner",
          email: ownerDoc.email,
          createdAt: ownerDoc.createdAt,
        };
      }
    }

    // 2. Memberships
    const memberships = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const memberDetails = [];
    for (const m of memberships) {
      const u: any = await ctx.db.get(m.userId);
      memberDetails.push({
        id: m._id,
        userId: m.userId,
        name: u?.name || "User",
        email: u?.email || "Unknown",
        role: m.role,
        status: m.status,
        joinedAt: m.createdAt,
      });
    }

    // 3. Products & Applications
    const products = await ctx.db
      .query("workspaceProducts")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    // 4. Branches
    let branches = await ctx.db
      .query("branches")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    if (branches.length === 0 && ws.organizationId) {
      branches = await ctx.db
        .query("branches")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", ws.organizationId!))
        .collect();
    }

    // 5. Subscription & Payment History
    let subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    if (!subscription && ws.organizationId) {
      subscription = await ctx.db
        .query("subscriptions")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", ws.organizationId!))
        .first();
    }

    let payments = await ctx.db
      .query("payments")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    if (payments.length === 0 && ws.organizationId) {
      payments = await ctx.db
        .query("payments")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", ws.organizationId!))
        .collect();
    }

    // 6. Onboarding Answers (US-5)
    let orgProfile = null;
    let inventoryOnboarding = null;

    if (ws.organizationId) {
      orgProfile = await ctx.db
        .query("organizationProfiles")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", ws.organizationId!))
        .first();

      const invApp = await ctx.db
        .query("applications")
        .withIndex("by_key", (q: any) => q.eq("key", "inventory"))
        .first();

      if (invApp) {
        inventoryOnboarding = await ctx.db
          .query("applicationOnboardingResponses")
          .withIndex("by_org_and_app", (q: any) =>
            q.eq("organizationId", ws.organizationId!).eq("applicationId", invApp._id)
          )
          .first();
      }
    }

    // 7. Owner's other organizations & trial status check
    const ownerOtherOrgs: any[] = [];
    let ownerHasOtherTrial = false;
    if (ws.ownerId) {
      const allOwnerWorkspaces = await ctx.db
        .query("workspaces")
        .withIndex("by_owner", (q) => q.eq("ownerId", ws.ownerId!))
        .collect();

      for (const otherWs of allOwnerWorkspaces) {
        if (otherWs._id === ws._id) continue;
        const otherSub = await ctx.db
          .query("subscriptions")
          .withIndex("by_workspace", (q) => q.eq("workspaceId", otherWs._id))
          .first();

        const otherPlan = otherSub?.planKey || otherWs.planId || "free_trial";
        const isOtherTrial = otherPlan === "free_trial" || otherPlan === "free" || otherSub?.status === "trial" || otherSub?.status === "trialing";
        if (isOtherTrial) {
          ownerHasOtherTrial = true;
        }

        ownerOtherOrgs.push({
          id: otherWs._id,
          name: otherWs.name,
          slug: otherWs.slug,
          planKey: otherPlan,
          status: otherSub?.status || otherWs.status || "active",
          isTrial: isOtherTrial,
        });
      }
    }

    const now = Date.now();
    const planKey = (subscription?.planKey || ws.planId || "free_trial").toLowerCase();
    const isFreeTrial = planKey === "free_trial" || planKey === "free" || subscription?.status === "trial" || subscription?.status === "trialing";
    const trialEndsAt = subscription?.trialEndsAt || subscription?.trialEnd || (isFreeTrial ? (subscription?.currentPeriodEnd || (ws.createdAt + 30 * 86_400_000)) : undefined);
    const daysRemaining = trialEndsAt ? Math.max(0, Math.ceil((trialEndsAt - now) / (1000 * 60 * 60 * 24))) : null;

    const activeProductsCount = products.filter((p: any) => p.status === "active").length;
    const activeBranchesCount = branches.filter((b: any) => b.status !== "deleted" && b.status !== "archived").length;

    return {
      organization: {
        id: ws._id,
        organizationId: ws.organizationId,
        name: ws.name,
        slug: ws.slug,
        type: ws.type || "business",
        status: ws.status || "active",
        country: ws.country,
        state: ws.state,
        city: ws.city,
        timezone: ws.timezone,
        currency: ws.currency || "NGN",
        logoUrl: ws.logoUrl,
        createdAt: ws.createdAt,
      },
      owner,
      ownerOtherOrgs,
      ownerHasOtherTrial,
      entitlements: {
        isFreeTrial,
        planKey,
        maxApplications: isFreeTrial ? 1 : "unlimited",
        activeApplications: activeProductsCount,
        maxBranches: isFreeTrial ? 1 : "unlimited",
        activeBranches: activeBranchesCount,
        trialEndsAt,
        daysRemaining,
      },
      members: memberDetails,
      products: products.map((p: any) => ({
        id: p._id,
        productKey: p.productKey,
        status: p.status,
        trialEndsAt: p.trialEndsAt,
        activatedAt: p.activatedAt,
      })),
      branches: branches
        .filter((b: any) => b.status !== "deleted")
        .map((b: any) => ({
          id: b._id,
          name: b.name,
          code: b.code || "MAIN",
          isPrimary: b.isPrimary || false,
          isActive: b.isActive !== false,
          status: b.status || "active",
          state: b.state,
          city: b.city,
          formattedAddress: b.formattedAddress || b.address,
          phone: b.phone,
          createdAt: b.createdAt,
        })),
      subscription: subscription
        ? {
            id: subscription._id,
            planKey: subscription.planKey,
            status: subscription.status,
            trialEndsAt: subscription.trialEndsAt,
            currentPeriodStart: subscription.currentPeriodStart,
            currentPeriodEnd: subscription.currentPeriodEnd,
            amount: subscription.amount,
            currency: subscription.currency,
          }
        : null,
      payments: payments.map((pay: any) => ({
        id: pay._id,
        amount: pay.amount,
        currency: pay.currency,
        status: pay.status,
        provider: pay.provider,
        reference: pay.reference,
        createdAt: pay.createdAt,
      })),
      onboardingAnswers: {
        organizationProfile: orgProfile
          ? {
              businessType: orgProfile.businessType,
              branchCountRange: orgProfile.branchCountRange,
              productCountRange: orgProfile.productCountRange,
              primaryUsers: orgProfile.primaryUsers,
              completedAt: orgProfile.completedAt,
            }
          : null,
        inventoryOnboarding: inventoryOnboarding
          ? {
              previousTools: inventoryOnboarding.previousTools,
              painPoints: inventoryOnboarding.painPoints,
              priorityFeatures: inventoryOnboarding.priorityFeatures,
              needsMultiBranch: inventoryOnboarding.needsMultiBranch,
              teamComfortLevel: inventoryOnboarding.teamComfortLevel,
              completedAt: inventoryOnboarding.completedAt,
            }
          : null,
      },
    };
  },
});

/**
 * suspendOrganization
 * Suspends an organization and disables active product access
 */
export const suspendOrganization = mutation({
  args: {
    sessionToken: v.string(),
    workspaceId: v.id("workspaces"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { admin } = await verifyAdminSession(ctx, args.sessionToken);

    const ws = await ctx.db.get(args.workspaceId);
    if (!ws) throw new Error("Organization not found.");

    const now = Date.now();
    await ctx.db.patch(args.workspaceId, {
      status: "suspended",
      updatedAt: now,
    });

    await logAudit(ctx, admin._id, "ORGANIZATION_SUSPENDED", args.workspaceId, {
      name: ws.name,
      slug: ws.slug,
      reason: args.reason,
    });

    return { success: true };
  },
});

/**
 * activateOrganization
 * Reactivates a suspended organization
 */
export const activateOrganization = mutation({
  args: {
    sessionToken: v.string(),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const { admin } = await verifyAdminSession(ctx, args.sessionToken);

    const ws = await ctx.db.get(args.workspaceId);
    if (!ws) throw new Error("Organization not found.");

    await ctx.db.patch(args.workspaceId, {
      status: "active",
      updatedAt: Date.now(),
    });

    await logAudit(ctx, admin._id, "ORGANIZATION_ACTIVATED", args.workspaceId, {
      name: ws.name,
    });

    return { success: true };
  },
});

/**
 * transferOwnership
 * Transfers workspace ownership to another user
 */
export const transferOwnership = mutation({
  args: {
    sessionToken: v.string(),
    workspaceId: v.id("workspaces"),
    newOwnerUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { admin } = await verifyAdminSession(ctx, args.sessionToken);

    const ws = await ctx.db.get(args.workspaceId);
    if (!ws) throw new Error("Organization not found.");

    const newOwner = await ctx.db.get(args.newOwnerUserId);
    if (!newOwner) throw new Error("Target new owner user not found.");

    const now = Date.now();
    const oldOwnerId = ws.ownerId;

    // Update workspace ownerId
    await ctx.db.patch(args.workspaceId, {
      ownerId: args.newOwnerUserId,
      updatedAt: now,
    });

    // Ensure new owner has OWNER role in workspaceMemberships
    const newOwnerMembership = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .filter((q) => q.eq(q.field("userId"), args.newOwnerUserId))
      .first();

    if (newOwnerMembership) {
      await ctx.db.patch(newOwnerMembership._id, {
        role: "OWNER",
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("workspaceMemberships", {
        workspaceId: args.workspaceId,
        userId: args.newOwnerUserId,
        role: "OWNER",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
    }

    await logAudit(ctx, admin._id, "ORGANIZATION_OWNERSHIP_TRANSFERRED", args.workspaceId, {
      workspaceName: ws.name,
      oldOwnerId,
      newOwnerUserId: args.newOwnerUserId,
      newOwnerEmail: newOwner.email,
    });

    return { success: true };
  },
});

/**
 * enableProduct
 * Manually activates a product for an organization
 */
export const enableProduct = mutation({
  args: {
    sessionToken: v.string(),
    workspaceId: v.id("workspaces"),
    productKey: v.string(),
  },
  handler: async (ctx, args) => {
    const { admin } = await verifyAdminSession(ctx, args.sessionToken);

    const ws = await ctx.db.get(args.workspaceId);
    if (!ws) throw new Error("Organization not found.");

    const now = Date.now();
    const existing = await ctx.db
      .query("workspaceProducts")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .filter((q) => q.eq(q.field("productKey"), args.productKey))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "ACTIVE",
      });
    } else {
      await ctx.db.insert("workspaceProducts", {
        workspaceId: args.workspaceId,
        productKey: args.productKey,
        status: "ACTIVE",
        activatedBy: ws.ownerId || admin._id,
        activatedAt: now,
      });
    }

    await logAudit(ctx, admin._id, "ORGANIZATION_PRODUCT_ENABLED", args.workspaceId, {
      productKey: args.productKey,
      workspaceName: ws.name,
    });

    return { success: true };
  },
});

/**
 * disableProduct
 * Disables a product for an organization
 */
export const disableProduct = mutation({
  args: {
    sessionToken: v.string(),
    workspaceId: v.id("workspaces"),
    productKey: v.string(),
  },
  handler: async (ctx, args) => {
    const { admin } = await verifyAdminSession(ctx, args.sessionToken);

    const ws = await ctx.db.get(args.workspaceId);
    if (!ws) throw new Error("Organization not found.");

    const existing = await ctx.db
      .query("workspaceProducts")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .filter((q) => q.eq(q.field("productKey"), args.productKey))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "SUSPENDED",
        suspendedAt: Date.now(),
      });
    }

    await logAudit(ctx, admin._id, "ORGANIZATION_PRODUCT_DISABLED", args.workspaceId, {
      productKey: args.productKey,
      workspaceName: ws.name,
    });

    return { success: true };
  },
});

/**
 * resetOnboarding
 * Resets onboarding flows for an organization
 */
export const resetOnboarding = mutation({
  args: {
    sessionToken: v.string(),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const { admin } = await verifyAdminSession(ctx, args.sessionToken);

    const flows = await ctx.db
      .query("onboardingFlows")
      .withIndex("by_workspaceId", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const now = Date.now();
    for (const f of flows) {
      await ctx.db.patch(f._id, {
        status: "IN_PROGRESS",
        currentStep: "WELCOME",
        completedSteps: [],
        lastUpdatedAt: now,
      });
    }

    await logAudit(ctx, admin._id, "ORGANIZATION_ONBOARDING_RESET", args.workspaceId, {
      resetFlowCount: flows.length,
    });

    return { success: true, count: flows.length };
  },
});

/**
 * deleteOrganization
 * Permanently deletes an organization and cleans up its memberships and products
 */
export const deleteOrganization = mutation({
  args: {
    sessionToken: v.string(),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const { admin } = await verifyAdminSession(ctx, args.sessionToken);

    const ws = await ctx.db.get(args.workspaceId);
    if (!ws) throw new Error("Organization not found.");

    const name = ws.name;

    // 1. Delete memberships
    const memberships = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    for (const m of memberships) {
      await ctx.db.delete(m._id);
    }

    // 2. Delete products
    const products = await ctx.db
      .query("workspaceProducts")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    for (const p of products) {
      await ctx.db.delete(p._id);
    }

    // 3. Delete workspace
    await ctx.db.delete(args.workspaceId);

    await logAudit(ctx, admin._id, "ORGANIZATION_DELETED", args.workspaceId, {
      workspaceName: name,
    });

    return { success: true };
  },
});

/**
 * extendTrial
 * Super Admin ability to extend Free Trial duration by N days
 */
export const extendTrial = mutation({
  args: {
    sessionToken: v.string(),
    workspaceId: v.id("workspaces"),
    days: v.number(),
  },
  handler: async (ctx, args) => {
    const { admin } = await verifyAdminSession(ctx, args.sessionToken);

    const ws = await ctx.db.get(args.workspaceId);
    if (!ws) throw new Error("Organization not found.");

    let subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    if (!subscription && ws.organizationId) {
      subscription = await ctx.db
        .query("subscriptions")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", ws.organizationId!))
        .first();
    }

    const now = Date.now();
    const additionalMs = args.days * 24 * 60 * 60 * 1000;
    const baseEnd = Math.max(
      now,
      subscription?.trialEndsAt || subscription?.currentPeriodEnd || (ws.createdAt + 30 * 86_400_000)
    );
    const newTrialEndsAt = baseEnd + additionalMs;

    if (subscription) {
      await ctx.db.patch(subscription._id, {
        trialEndsAt: newTrialEndsAt,
        trialEnd: newTrialEndsAt,
        currentPeriodEnd: newTrialEndsAt,
        status: "trial",
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("subscriptions", {
        organizationId: ws.organizationId || (ws._id as any),
        workspaceId: ws._id,
        userId: ws.ownerId,
        planKey: "free_trial",
        status: "trial",
        billingInterval: "monthly",
        currentPeriodStart: now,
        currentPeriodEnd: newTrialEndsAt,
        trialStart: now,
        trialEnd: newTrialEndsAt,
        trialEndsAt: newTrialEndsAt,
        amount: 0,
        currency: ws.currency || "NGN",
        cancelAtPeriodEnd: false,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Also extend trial on active workspaceProducts
    const products = await ctx.db
      .query("workspaceProducts")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    for (const p of products) {
      await ctx.db.patch(p._id, {
        trialEndsAt: newTrialEndsAt,
      });
    }

    await logAudit(ctx, admin._id, "ORGANIZATION_TRIAL_EXTENDED", args.workspaceId, {
      workspaceName: ws.name,
      addedDays: args.days,
      newTrialEndsAt,
    });

    return { success: true, newTrialEndsAt };
  },
});

/**
 * updateOrganizationPlan
 * Super Admin ability to switch an organization between Free Trial and Standard
 */
export const updateOrganizationPlan = mutation({
  args: {
    sessionToken: v.string(),
    workspaceId: v.id("workspaces"),
    planKey: v.string(),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { admin } = await verifyAdminSession(ctx, args.sessionToken);

    const ws = await ctx.db.get(args.workspaceId);
    if (!ws) throw new Error("Organization not found.");

    let subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    if (!subscription && ws.organizationId) {
      subscription = await ctx.db
        .query("subscriptions")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", ws.organizationId!))
        .first();
    }

    const now = Date.now();
    const isFreeTrial = args.planKey === "free_trial" || args.planKey === "free";
    const status = args.status || (isFreeTrial ? "trial" : "active");
    const periodEnd = isFreeTrial ? now + 30 * 86_400_000 : now + 30 * 86_400_000;

    if (subscription) {
      await ctx.db.patch(subscription._id, {
        planKey: args.planKey,
        status: status as any,
        currentPeriodEnd: periodEnd,
        trialEndsAt: isFreeTrial ? periodEnd : undefined,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("subscriptions", {
        organizationId: ws.organizationId || (ws._id as any),
        workspaceId: ws._id,
        userId: ws.ownerId,
        planKey: args.planKey,
        status: status as any,
        billingInterval: "monthly",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        trialStart: isFreeTrial ? now : undefined,
        trialEnd: isFreeTrial ? periodEnd : undefined,
        trialEndsAt: isFreeTrial ? periodEnd : undefined,
        amount: isFreeTrial ? 0 : 750000,
        currency: ws.currency || "NGN",
        cancelAtPeriodEnd: false,
        createdAt: now,
        updatedAt: now,
      });
    }

    await ctx.db.patch(args.workspaceId, {
      planId: args.planKey,
      updatedAt: now,
    });

    await logAudit(ctx, admin._id, "ORGANIZATION_PLAN_UPDATED", args.workspaceId, {
      workspaceName: ws.name,
      planKey: args.planKey,
      status,
    });

    return { success: true };
  },
});
