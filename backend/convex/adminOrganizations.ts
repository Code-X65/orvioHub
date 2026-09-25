import { mutation, query } from "./_generated/server.js";
import { v } from "convex/values";
import { requireAdminPermission, verifyAndConsumeStepUpToken } from "./adminAuth.js";

// Helper to authenticate admin
async function verifyAdminSession(ctx: any, sessionToken?: string, permission?: any) {
  if (permission) {
    return requireAdminPermission(ctx, sessionToken, permission);
  }
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

async function resolveWorkspace(ctx: any, id: any) {
  let ws: any = null;
  try {
    ws = await (ctx.db as any).get(id);
  } catch {}
  if (!ws) {
    try {
      ws = await ctx.db
        .query("workspaces")
        .withIndex("by_organizationId", (q: any) => q.eq("organizationId", id))
        .first();
    } catch {}
  } else if (ws.industry !== undefined && ws.type === undefined) {
    const primaryWs: any = await ctx.db
      .query("workspaces")
      .withIndex("by_organizationId", (q: any) => q.eq("organizationId", ws._id))
      .first();
    if (primaryWs) return primaryWs;
  }
  return ws;
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

    // The directory is an operational console, not an export endpoint. Bound
    // every read so a growing tenant base cannot exhaust a single Convex call.
    const ADMIN_DIRECTORY_SCAN_LIMIT = 500;
    let workspaces = await ctx.db.query("workspaces").take(ADMIN_DIRECTORY_SCAN_LIMIT);
    const directoryTruncated = workspaces.length === ADMIN_DIRECTORY_SCAN_LIMIT;

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
    const [allMemberships, allProducts, allBranches, allSubscriptions, allOrgProfiles, allAppOnboardings] = await Promise.all([
      ctx.db.query("workspaceMemberships").take(ADMIN_DIRECTORY_SCAN_LIMIT),
      ctx.db.query("workspaceProducts").take(ADMIN_DIRECTORY_SCAN_LIMIT),
      ctx.db.query("branches").take(ADMIN_DIRECTORY_SCAN_LIMIT),
      ctx.db.query("subscriptions").take(ADMIN_DIRECTORY_SCAN_LIMIT),
      ctx.db.query("organizationProfiles").take(ADMIN_DIRECTORY_SCAN_LIMIT),
      ctx.db.query("applicationOnboardingResponses").take(ADMIN_DIRECTORY_SCAN_LIMIT),
    ]);

    const memberCountMap: Record<string, number> = {};
    for (const m of allMemberships) {
      memberCountMap[m.workspaceId] = (memberCountMap[m.workspaceId] || 0) + 1;
    }

    const productCountMap: Record<string, string[]> = {};
    for (const p of allProducts) {
      if (!productCountMap[p.workspaceId]) productCountMap[p.workspaceId] = [];
      productCountMap[p.workspaceId].push(p.productKey);
    }

    // Map unique branches by workspace & organizationId
    const branchSetByWorkspace: Record<string, Set<string>> = {};
    for (const b of allBranches) {
      if (b.status === "deleted" || b.status === "archived") continue;
      const bId = String(b._id);
      if (b.workspaceId) {
        if (!branchSetByWorkspace[b.workspaceId]) branchSetByWorkspace[b.workspaceId] = new Set();
        branchSetByWorkspace[b.workspaceId].add(bId);
      }
      if (b.organizationId) {
        if (!branchSetByWorkspace[b.organizationId]) branchSetByWorkspace[b.organizationId] = new Set();
        branchSetByWorkspace[b.organizationId].add(bId);
      }
    }

    const getBranchCount = (wsId: string, orgId?: string) => {
      const set = new Set<string>();
      if (wsId && branchSetByWorkspace[wsId]) {
        for (const id of branchSetByWorkspace[wsId]) set.add(id);
      }
      if (orgId && branchSetByWorkspace[orgId]) {
        for (const id of branchSetByWorkspace[orgId]) set.add(id);
      }
      return set.size;
    };

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
        const orgId = w.organizationId || w._id;
        const sub = subMap[w._id] || subMap[orgId];
        const planKey = (sub?.planKey || sub?.planId || w.planKey || w.planId || "free_trial").toLowerCase();
        return planKey === targetPlan;
      });
    }

    // 5. Branch Count Filter
    if (args.branchFilter && args.branchFilter !== "all") {
      workspaces = workspaces.filter((w: any) => {
        const count = getBranchCount(w._id, w.organizationId);
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
      const branchCount = getBranchCount(ws._id, orgId);
      const orgProfile = profileMap[orgId];
      const invOnboarding = appOnboardingMap[orgId];
      const planKey = (sub?.planKey || sub?.planId || (ws as any).planKey || (ws as any).planId || "free_trial").toLowerCase();
      const subStatus = sub?.status || (ws as any).subscriptionStatus || ws.status || "active";

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
        subscription: {
          planKey,
          status: subStatus,
          trialEndsAt: sub?.trialEndsAt,
          currentPeriodEnd: sub?.currentPeriodEnd,
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
      isTruncated: directoryTruncated,
      scanLimit: ADMIN_DIRECTORY_SCAN_LIMIT,
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

    // 4. Branches (deduplicated by ID)
    const branchesByWs = await ctx.db
      .query("branches")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    let branchesByOrg: any[] = [];
    if (ws.organizationId) {
      branchesByOrg = await ctx.db
        .query("branches")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", ws.organizationId!))
        .collect();
    }

    const branchMap = new Map<string, any>();
    for (const b of [...branchesByWs, ...branchesByOrg]) {
      if (b.status !== "deleted") {
        branchMap.set(String(b._id), b);
      }
    }
    const branches = Array.from(branchMap.values());

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

        const otherPlan = (otherSub?.planKey || otherSub?.planId || (otherWs as any).planKey || (otherWs as any).planId || "free_trial").toLowerCase();
        const isOtherTrial = otherPlan === "free_trial" || otherPlan === "free" || otherSub?.status === "trial" || otherSub?.status === "trialing";
        if (isOtherTrial) {
          ownerHasOtherTrial = true;
        }

        ownerOtherOrgs.push({
          id: otherWs._id,
          name: otherWs.name,
          slug: otherWs.slug,
          planKey: otherPlan,
          status: otherSub?.status || (otherWs as any).subscriptionStatus || otherWs.status || "active",
          isTrial: isOtherTrial,
        });
      }
    }

    const now = Date.now();
    const rawPlanKey = (subscription?.planKey === "free" ? "free_trial" : subscription?.planKey || (ws as any).planKey || (ws as any).planId || "free_trial").toLowerCase();
    const subStatus = (subscription?.status || (ws as any).subscriptionStatus || ws.status || "active").toLowerCase();
    const isPaidActive = subStatus === "active" && (rawPlanKey === "standard" || rawPlanKey === "premium");
    const isFreeTrial = !isPaidActive && (rawPlanKey === "free_trial" || rawPlanKey === "free" || subStatus === "trial" || subStatus === "trialing");
    const planKey = isPaidActive ? rawPlanKey : isFreeTrial ? "free_trial" : rawPlanKey;
    const trialEndsAt = isPaidActive ? undefined : (subscription?.trialEndsAt || subscription?.trialEnd || (isFreeTrial ? (subscription?.currentPeriodEnd || (ws.createdAt + 30 * 86_400_000)) : undefined));
    const daysRemaining = trialEndsAt ? Math.max(0, Math.ceil((trialEndsAt - now) / (1000 * 60 * 60 * 24))) : null;

    // Consistency Check
    const consistencyIssues: string[] = [];
    if (!subscription) {
      consistencyIssues.push("missing_subscription");
    } else {
      if (subStatus === "active" && rawPlanKey !== "standard" && rawPlanKey !== "premium") {
        consistencyIssues.push("active_paid_subscription_has_invalid_plan");
      }
      if (rawPlanKey === "standard" && subStatus === "active" && (subscription.trialEnd || subscription.trialEndsAt)) {
        consistencyIssues.push("standard_subscription_has_trial_end");
      }
      const hasSuccessPayment = payments.some((p: any) => p.status === "success" || p.status === "completed");
      if (hasSuccessPayment && subStatus !== "active") {
        consistencyIssues.push("successful_payment_subscription_not_active");
      }
      if (subscription.activePlan && subscription.activePlan !== rawPlanKey && subStatus === "active") {
        consistencyIssues.push("active_plan_mismatch");
      }
    }

    const activeProductsCount = products.filter((p: any) => p.status === "active").length;
    const activeBranchesCount = branches.filter((b: any) => b.status === "active").length;

    return {
      organization: {
        id: ws._id,
        organizationId: ws.organizationId,
        name: ws.name,
        slug: ws.slug,
        type: ws.type || "business",
        planId: planKey,
        planKey,
        status: ws.status || "active",
        subscriptionStatus: subStatus,
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
      billingConsistency: {
        consistent: consistencyIssues.length === 0,
        status: consistencyIssues.length === 0 ? "consistent" : "mismatch detected",
        issues: consistencyIssues,
      },
      entitlements: {
        isFreeTrial,
        planKey,
        maxApplications: isFreeTrial ? 1 : 3,
        activeApplications: activeProductsCount,
        maxBranches: isFreeTrial ? 1 : 3,
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
            planKey: planKey,
            selectedPlan: subscription.selectedPlan || planKey,
            activePlan: isPaidActive ? planKey : (isFreeTrial ? "free_trial" : null),
            status: subStatus,
            checkoutStatus: subscription.checkoutStatus || (isPaidActive ? "completed" : "pending"),
            paymentStatus: subscription.paymentStatus || (isPaidActive ? "success" : "pending"),
            trialEndsAt: subscription.trialEndsAt,
            currentPeriodStart: subscription.currentPeriodStart,
            currentPeriodEnd: subscription.currentPeriodEnd,
            amount: subscription.amount,
            currency: subscription.currency,
          }
        : {
            id: null,
            planKey: planKey,
            status: subStatus,
          },
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
 * Suspends an organization/workspace and disables active product access
 */
export const suspendOrganization = mutation({
  args: {
    sessionToken: v.string(),
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
    reason: v.optional(v.string()), // "payment_failure" | "policy_violation" | "fraud" | "other"
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { admin } = await verifyAdminSession(ctx, args.sessionToken, "admin.organizations.suspend");

    const ws = await resolveWorkspace(ctx, args.workspaceId);
    if (!ws) throw new Error("Organization not found.");
    const targetWorkspaceId = ws._id;

    const now = Date.now();
    await ctx.db.patch(targetWorkspaceId, {
      status: "suspended",
      suspendedAt: now,
      suspendedBy: admin._id,
      suspensionReason: args.reason || "policy_violation",
      suspensionNotes: args.notes,
      updatedAt: now,
    });

    // Pause active subscriptions
    const subscriptions = await ctx.db
      .query("subscriptions")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", targetWorkspaceId))
      .collect();

    for (const sub of subscriptions) {
      if (sub.status === "active" || sub.status === "trialing") {
        await ctx.db.patch(sub._id, {
          status: "suspended",
          updatedAt: now,
        });
      }
    }

    // Notify workspace owner
    if (ws.ownerId) {
      const owner: any = await ctx.db.get(ws.ownerId);
      if (owner && owner.email) {
        await ctx.db.insert("emailOutbox", {
          to: owner.email,
          template: "workspaceSuspended",
          payload: {
            name: owner.name || owner.firstName || "there",
            workspaceName: ws.name,
            reason: args.reason || "Administrative policy action",
          },
          status: "PENDING",
          attempts: 0,
          nextAttemptAt: now,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    // Audit log event: admin.workspace_suspended (high severity)
    await ctx.db.insert("auditLogs", {
      actorId: admin._id,
      actorUserId: admin._id,
      targetWorkspaceId,
      workspaceId: targetWorkspaceId,
      organizationId: ws.organizationId,
      eventType: "admin.workspace_suspended",
      action: "admin.workspace_suspended",
      entityType: "workspace",
      entityId: targetWorkspaceId,
      resource: "workspaces",
      severity: "high",
      metadata: {
        workspaceName: ws.name,
        slug: ws.slug,
        reason: args.reason,
        notes: args.notes,
        adminUserId: admin._id,
      },
      createdAt: now,
      timestamp: now,
    });

    await logAudit(ctx, admin._id, "ORGANIZATION_SUSPENDED", targetWorkspaceId, {
      name: ws.name,
      reason: args.reason,
      notes: args.notes,
    });

    return { success: true };
  },
});

/**
 * activateOrganization
 * Reactivates a suspended organization/workspace
 */
export const activateOrganization = mutation({
  args: {
    sessionToken: v.string(),
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
  },
  handler: async (ctx, args) => {
    const { admin } = await verifyAdminSession(ctx, args.sessionToken, "admin.organizations.restore");

    const ws = await resolveWorkspace(ctx, args.workspaceId);
    if (!ws) throw new Error("Organization not found.");
    const targetWorkspaceId = ws._id;

    const now = Date.now();
    await ctx.db.patch(targetWorkspaceId, {
      status: "active",
      suspendedAt: undefined,
      suspendedBy: undefined,
      suspensionReason: undefined,
      suspensionNotes: undefined,
      updatedAt: now,
    });

    // Reactivate suspended subscriptions
    const subscriptions = await ctx.db
      .query("subscriptions")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", targetWorkspaceId))
      .collect();

    for (const sub of subscriptions) {
      if (sub.status === "suspended") {
        await ctx.db.patch(sub._id, {
          status: "active",
          updatedAt: now,
        });
      }
    }

    // Audit log event: admin.workspace_restored (high severity)
    await ctx.db.insert("auditLogs", {
      actorId: admin._id,
      actorUserId: admin._id,
      targetWorkspaceId,
      workspaceId: targetWorkspaceId,
      organizationId: ws.organizationId,
      eventType: "admin.workspace_restored",
      action: "admin.workspace_restored",
      entityType: "workspace",
      entityId: targetWorkspaceId,
      resource: "workspaces",
      severity: "high",
      metadata: {
        workspaceName: ws.name,
        adminUserId: admin._id,
      },
      createdAt: now,
      timestamp: now,
    });

    await logAudit(ctx, admin._id, "ORGANIZATION_ACTIVATED", targetWorkspaceId, {
      name: ws.name,
    });

    return { success: true };
  },
});

export const restoreOrganization = activateOrganization;

/**
 * deleteOrganization / deleteWorkspace
 * Deletes workspace with subscription checks, grace period or immediate force delete
 */
export const deleteOrganization = mutation({
  args: {
    sessionToken: v.string(),
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
    reason: v.optional(v.string()),
    notes: v.optional(v.string()),
    cancelSubscriptions: v.optional(v.boolean()),
    adminForceDelete: v.optional(v.boolean()),
    confirmationPhrase: v.optional(v.string()),
    stepUpToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { admin } = await verifyAdminSession(ctx, args.sessionToken, "admin.organizations.archive");

    const ws = await resolveWorkspace(ctx, args.workspaceId);
    if (!ws) throw new Error("Organization not found.");
    const targetWorkspaceId = ws._id;

    // High Risk Verification: If force delete, verify step-up token and confirmation phrase
    if (args.adminForceDelete) {
      if (args.stepUpToken) {
        await verifyAndConsumeStepUpToken(
          ctx,
          admin._id,
          args.stepUpToken,
          "delete_organization",
          String(targetWorkspaceId)
        );
      }

      const expectedPhrase = ws.slug || "DELETE";
      if (!args.confirmationPhrase || (args.confirmationPhrase !== expectedPhrase && args.confirmationPhrase !== "DELETE")) {
        throw new Error(
          `CONFIRMATION_REQUIRED: High-risk deletion requires exact confirmation phrase match ('${expectedPhrase}').`
        );
      }
    }

    const now = Date.now();



    // 1. Check subscriptions
    const subscriptions = await ctx.db
      .query("subscriptions")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", targetWorkspaceId))
      .collect();

    const activeSubs = subscriptions.filter(
      (s) => s.status === "active" || s.status === "trialing"
    );

    if (activeSubs.length > 0 && !args.cancelSubscriptions) {
      throw new Error(
        "Workspace has active subscriptions. Cancel subscriptions first or pass cancelSubscriptions: true."
      );
    }

    if (args.cancelSubscriptions) {
      for (const sub of activeSubs) {
        await ctx.db.patch(sub._id, {
          status: "canceled",
          cancelAtPeriodEnd: false,
          updatedAt: now,
        });
      }
    }

    // 2. Notify workspace owner
    if (ws.ownerId) {
      const owner: any = await ctx.db.get(ws.ownerId);
      if (owner && owner.email) {
        await ctx.db.insert("emailOutbox", {
          to: owner.email,
          template: "workspaceDeleted",
          payload: {
            name: owner.name || owner.firstName || "there",
            workspaceName: ws.name,
            reason: args.reason || "Administrative workspace closure",
          },
          status: "PENDING",
          attempts: 0,
          nextAttemptAt: now,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    if (args.adminForceDelete) {
      // Immediate deletion (soft-deleted with business data preserved per NDPA retention policy)
      await ctx.db.patch(targetWorkspaceId, {
        status: "deleted",
        deletedAt: now,
        deletedBy: admin._id,
        updatedAt: now,
      });

      // Audit log event: admin.workspace_deleted (critical severity)
      await ctx.db.insert("auditLogs", {
        actorId: admin._id,
        actorUserId: admin._id,
        targetWorkspaceId,
        workspaceId: targetWorkspaceId,
        organizationId: ws.organizationId,
        eventType: "admin.workspace_deleted",
        action: "admin.workspace_deleted",
        entityType: "workspace",
        entityId: targetWorkspaceId,
        resource: "workspaces",
        severity: "critical",
        metadata: {
          workspaceName: ws.name,
          slug: ws.slug,
          reason: args.reason,
          notes: args.notes,
          adminForceDelete: true,
          adminUserId: admin._id,
        },
        createdAt: now,
        timestamp: now,
      });

      await logAudit(ctx, admin._id, "ORGANIZATION_DELETED_FORCE", targetWorkspaceId, {
        workspaceName: ws.name,
        reason: args.reason,
      });

      return { success: true, immediate: true };
    } else {
      // 7-day grace period
      const scheduledDeletionAt = now + 7 * 86400000;
      await ctx.db.patch(targetWorkspaceId, {
        status: "deleting",
        deletionRequestedAt: now,
        deletionScheduledAt: scheduledDeletionAt,
        deletedBy: admin._id,
        updatedAt: now,
      });

      // Audit log event: admin.workspace_deleted (critical severity)
      await ctx.db.insert("auditLogs", {
        actorId: admin._id,
        actorUserId: admin._id,
        targetWorkspaceId,
        workspaceId: targetWorkspaceId,
        organizationId: ws.organizationId,
        eventType: "admin.workspace_deleted",
        action: "admin.workspace_deleted",
        entityType: "workspace",
        entityId: targetWorkspaceId,
        resource: "workspaces",
        severity: "critical",
        metadata: {
          workspaceName: ws.name,
          slug: ws.slug,
          reason: args.reason,
          notes: args.notes,
          adminForceDelete: false,
          scheduledDeletionAt,
          adminUserId: admin._id,
        },
        createdAt: now,
        timestamp: now,
      });

      await logAudit(ctx, admin._id, "ORGANIZATION_DELETION_SCHEDULED", targetWorkspaceId, {
        workspaceName: ws.name,
        reason: args.reason,
        scheduledDeletionAt,
      });

      return { success: true, immediate: false, scheduled: true, scheduledDeletionAt };
    }
  },
});

export const deleteWorkspace = deleteOrganization;

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
    const { admin } = await verifyAdminSession(ctx, args.sessionToken, "admin.members.manage_access");

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
    const { admin } = await verifyAdminSession(ctx, args.sessionToken, "admin.applications.manage");

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
    const { admin } = await verifyAdminSession(ctx, args.sessionToken, "admin.applications.manage");

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
    const { admin } = await verifyAdminSession(ctx, args.sessionToken, "admin.onboarding.manage");

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
    const { admin } = await verifyAdminSession(ctx, args.sessionToken, "admin.trial_extensions.create");

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
    const { admin } = await verifyAdminSession(ctx, args.sessionToken, "admin.manual_plan_grants.create");

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

/**
 * getAdminOrganizationFullSettings
 * Authoritative cross-tenant inspector for Superadmin.
 */
export const getAdminOrganizationFullSettings = query({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await verifyAdminSession(ctx, args.sessionToken);

    const ws = await resolveWorkspace(ctx, args.workspaceId);
    if (!ws) return null;

    const [settings, branding, branches, apps] = await Promise.all([
      ctx.db
        .query("workspaceSettings")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", ws._id))
        .first(),
      ctx.db
        .query("workspaceBranding")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", ws._id))
        .first(),
      ctx.db
        .query("branches")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", ws._id))
        .collect(),
      ctx.db
        .query("applicationSettings")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", ws._id))
        .collect(),
    ]);

    let owner: any = null;
    if (ws.ownerId) {
      owner = await ctx.db.get(ws.ownerId);
    }

    return {
      workspace: ws,
      owner: owner ? { id: owner._id, name: owner.name, email: owner.email } : null,
      settings: settings || {},
      branding: branding || {},
      branches: branches || [],
      applications: apps || [],
    };
  },
});

/**
 * adminTransferOrganizationOwnership
 * Break-glass tool to reassign OWNER role with justification.
 */
export const adminTransferOrganizationOwnership = mutation({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
    newOwnerUserId: v.union(v.id("users"), v.string()),
    reason: v.string(),
    ticketNumber: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
    stepUpToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { admin } = await verifyAdminSession(ctx, args.sessionToken, "admin.members.manage_access");

    const ws = await resolveWorkspace(ctx, args.workspaceId);
    if (!ws) throw new Error("Workspace not found");

    if (args.stepUpToken) {
      await verifyAndConsumeStepUpToken(
        ctx,
        admin._id,
        args.stepUpToken,
        "transfer_ownership",
        String(ws._id)
      );
    }

    const newOwner: any = await ctx.db.get(args.newOwnerUserId as any);
    if (!newOwner) throw new Error("Target user does not exist");


    const now = Date.now();
    const previousOwnerId = ws.ownerId;

    // Update workspace owner
    await ctx.db.patch(ws._id, {
      ownerId: newOwner._id,
      updatedAt: now,
    });

    // Also update organization record if present
    if (ws.organizationId) {
      await ctx.db.patch(ws.organizationId, {
        ownerId: newOwner._id,
        updatedAt: now,
      });

      // Demote previous owner to ADMIN if membership exists
      if (previousOwnerId) {
        const prevMember = await ctx.db
          .query("organizationMemberships")
          .withIndex("by_org_and_user", (q) =>
            q.eq("organizationId", ws.organizationId!).eq("userId", previousOwnerId)
          )
          .first();
        if (prevMember) {
          await ctx.db.patch(prevMember._id, { role: "ADMIN", updatedAt: now });
        }
      }

      // Promote new owner membership
      const targetMember = await ctx.db
        .query("organizationMemberships")
        .withIndex("by_org_and_user", (q) =>
          q.eq("organizationId", ws.organizationId!).eq("userId", newOwner._id)
        )
        .first();

      if (targetMember) {
        await ctx.db.patch(targetMember._id, { role: "OWNER", updatedAt: now });
      } else {
        await ctx.db.insert("organizationMemberships", {
          organizationId: ws.organizationId,
          userId: newOwner._id,
          role: "OWNER",
          status: "ACTIVE",
          joinedAt: now,
          updatedAt: now,
        });
      }
    }

    await logAudit(ctx, admin._id, "ORGANIZATION_OWNERSHIP_TRANSFERRED", ws._id, {
      previousOwnerId,
      newOwnerUserId: newOwner._id,
      newOwnerEmail: newOwner.email,
      reason: args.reason,
      ticketNumber: args.ticketNumber,
    });

    return { success: true };
  },
});

/**
 * toggleBranchStatus
 * Suspend, activate, or archive a specific branch location directly
 */
export const toggleBranchStatus = mutation({
  args: {
    sessionToken: v.string(),
    branchId: v.id("branches"),
    targetStatus: v.union(v.literal("active"), v.literal("suspended"), v.literal("archived")),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { admin } = await verifyAdminSession(ctx, args.sessionToken, "admin.branches.manage");

    const branch = await ctx.db.get(args.branchId);
    if (!branch) {
      throw new Error("Branch location not found.");
    }

    const previousStatus = branch.status || "active";
    const now = Date.now();

    await ctx.db.patch(args.branchId, {
      status: args.targetStatus,
      isActive: args.targetStatus === "active",
      updatedAt: now,
    });

    await logAudit(ctx, admin._id, "admin.branch_status_toggled", String(args.branchId), {
      branchName: branch.name,
      previousStatus,
      newStatus: args.targetStatus,
      workspaceId: branch.workspaceId,
      organizationId: branch.organizationId,
      reason: args.reason || "Status toggled by administrator",
    });

    return { success: true, branchId: args.branchId, status: args.targetStatus };
  },
});

/**
 * overrideWorkspacePhoneVerified
 * Superadmin action to mark a workspace / organization phone verified
 */
export const overrideWorkspacePhoneVerified = mutation({
  args: {
    sessionToken: v.string(),
    workspaceId: v.string(),
    phone: v.optional(v.string()),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const { admin } = await verifyAdminSession(ctx, args.sessionToken, "admin.members.manage_access");
    const ws = await resolveWorkspace(ctx, args.workspaceId);
    if (!ws) throw new Error("Workspace not found.");

    const phoneToVerify = args.phone || ws.phone;
    if (!phoneToVerify) throw new Error("Workspace has no phone number to mark verified.");

    const now = Date.now();
    const phoneDigits = phoneToVerify.replace(/\D/g, "");
    const phoneNormalized = phoneDigits.startsWith("234")
      ? `+${phoneDigits}`
      : (phoneDigits.startsWith("0") ? `+234${phoneDigits.slice(1)}` : `+234${phoneDigits}`);

    await ctx.db.patch(ws._id, {
      phone: phoneToVerify,
      phoneNormalized: ws.phoneNormalized || phoneNormalized,
      phoneVerifiedAt: now,
      phoneStatus: "verified",
      updatedAt: now,
    });

    if (ws.organizationId) {
      try {
        const org: any = await ctx.db.get(ws.organizationId);
        if (org) {
          await ctx.db.patch(org._id, {
            phone: phoneToVerify,
            phoneNormalized: org.phoneNormalized || phoneNormalized,
            phoneVerifiedAt: now,
            phoneStatus: "verified",
            updatedAt: now,
          });
        }
      } catch {}
    }

    // Invalidate pending challenges
    const pending = await ctx.db
      .query("phoneVerificationChallenges")
      .withIndex("by_workspace_purpose", (q) => q.eq("workspaceId", String(ws._id)))
      .collect();
    for (const ch of pending) {
      if (ch.status === "pending") {
        await ctx.db.patch(ch._id, { status: "cancelled" });
      }
    }

    await logAudit(ctx, admin._id, "WORKSPACE_PHONE_OVERRIDE_VERIFIED", String(ws._id), {
      phone: phoneToVerify,
      phoneNormalized,
      reason: args.reason,
      severity: "warning",
    });

    return { success: true, verifiedAt: now, phone: phoneToVerify, phoneNormalized };
  },
});

/**
 * unlinkWorkspacePhone
 * Superadmin action to unlink/reset a workspace / organization phone number
 */
export const unlinkWorkspacePhone = mutation({
  args: {
    sessionToken: v.string(),
    workspaceId: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const { admin } = await verifyAdminSession(ctx, args.sessionToken, "admin.members.manage_access");
    const ws = await resolveWorkspace(ctx, args.workspaceId);
    if (!ws) throw new Error("Workspace not found.");

    const now = Date.now();
    const oldPhone = ws.phone;
    const oldNormalized = ws.phoneNormalized;

    await ctx.db.patch(ws._id, {
      phone: undefined,
      phoneNormalized: undefined,
      phoneVerifiedAt: undefined,
      phoneStatus: "not_set",
      updatedAt: now,
    });

    if (ws.organizationId) {
      try {
        const org = await ctx.db.get(ws.organizationId);
        if (org) {
          await ctx.db.patch(org._id, {
            phone: undefined,
            phoneNormalized: undefined,
            phoneVerifiedAt: undefined,
            phoneStatus: "not_set",
            updatedAt: now,
          });
        }
      } catch {}
    }

    const pending = await ctx.db
      .query("phoneVerificationChallenges")
      .withIndex("by_workspace_purpose", (q) => q.eq("workspaceId", String(ws._id)))
      .collect();
    for (const ch of pending) {
      if (ch.status === "pending") {
        await ctx.db.patch(ch._id, { status: "cancelled" });
      }
    }

    await logAudit(ctx, admin._id, "WORKSPACE_PHONE_UNLINKED", String(ws._id), {
      previousPhone: oldPhone,
      previousPhoneNormalized: oldNormalized,
      reason: args.reason,
      severity: "warning",
    });

    return { success: true };
  },
});

/**
 * overrideBranchPhoneVerified
 * Superadmin action to mark a branch location phone verified
 */
export const overrideBranchPhoneVerified = mutation({
  args: {
    sessionToken: v.string(),
    branchId: v.id("branches"),
    phone: v.optional(v.string()),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const { admin } = await verifyAdminSession(ctx, args.sessionToken, "admin.branches.manage");
    const branch = await ctx.db.get(args.branchId);
    if (!branch) throw new Error("Branch not found.");

    const phoneToVerify = args.phone || branch.phone;
    if (!phoneToVerify) throw new Error("Branch has no phone number to mark verified.");

    const now = Date.now();
    const phoneDigits = phoneToVerify.replace(/\D/g, "");
    const phoneNormalized = phoneDigits.startsWith("234")
      ? `+${phoneDigits}`
      : (phoneDigits.startsWith("0") ? `+234${phoneDigits.slice(1)}` : `+234${phoneDigits}`);

    await ctx.db.patch(args.branchId, {
      phone: phoneToVerify,
      phoneNormalized: branch.phoneNormalized || phoneNormalized,
      phoneVerified: true,
      phoneVerifiedAt: now,
      phoneStatus: "verified",
      updatedAt: now,
    });

    const pending = await ctx.db
      .query("phoneVerificationChallenges")
      .withIndex("by_branch_purpose", (q) => q.eq("branchId", String(args.branchId)))
      .collect();
    for (const ch of pending) {
      if (ch.status === "pending") {
        await ctx.db.patch(ch._id, { status: "cancelled" });
      }
    }

    await logAudit(ctx, admin._id, "BRANCH_PHONE_OVERRIDE_VERIFIED", String(args.branchId), {
      branchName: branch.name,
      phone: phoneToVerify,
      phoneNormalized,
      reason: args.reason,
      severity: "warning",
    });

    return { success: true, verifiedAt: now, branchId: args.branchId, phone: phoneToVerify, phoneNormalized };
  },
});

/**
 * unlinkBranchPhone
 * Superadmin action to unlink/reset a branch location phone number
 */
export const unlinkBranchPhone = mutation({
  args: {
    sessionToken: v.string(),
    branchId: v.id("branches"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const { admin } = await verifyAdminSession(ctx, args.sessionToken, "admin.branches.manage");
    const branch = await ctx.db.get(args.branchId);
    if (!branch) throw new Error("Branch not found.");

    const now = Date.now();
    const oldPhone = branch.phone;
    const oldNormalized = branch.phoneNormalized;

    await ctx.db.patch(args.branchId, {
      phone: undefined,
      phoneNormalized: undefined,
      phoneVerified: false,
      phoneVerifiedAt: undefined,
      phoneStatus: "unverified",
      updatedAt: now,
    });

    const pending = await ctx.db
      .query("phoneVerificationChallenges")
      .withIndex("by_branch_purpose", (q) => q.eq("branchId", String(args.branchId)))
      .collect();
    for (const ch of pending) {
      if (ch.status === "pending") {
        await ctx.db.patch(ch._id, { status: "cancelled" });
      }
    }

    await logAudit(ctx, admin._id, "BRANCH_PHONE_UNLINKED", String(args.branchId), {
      branchName: branch.name,
      previousPhone: oldPhone,
      previousPhoneNormalized: oldNormalized,
      reason: args.reason,
      severity: "warning",
    });

    return { success: true, branchId: args.branchId };
  },
});
