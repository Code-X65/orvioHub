import { query, mutation } from "./_generated/server.js";
import { v } from "convex/values";
import { DEFAULT_PLANS } from "./plans.js";
import { generateNextInvoiceNumber } from "./invoices.js";
import { resolveOrganization } from "./applications.js";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const getOrganizationById = query({
  args: { organizationId: v.union(v.id("organizations"), v.id("workspaces"), v.string()) },
  handler: async (ctx, args) => {
    const { org } = await resolveOrganization(ctx, args.organizationId);
    return org;
  },
});

export const getOrganizationBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
  },
});

export const getMembership = query({
  args: {
    organizationId: v.union(v.id("organizations"), v.id("workspaces"), v.string()),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // 1. Check directly on organizationMemberships
    let membership = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_org_and_user", (q: any) =>
        q.eq("organizationId", args.organizationId as any).eq("userId", args.userId)
      )
      .first();

    if (membership) return membership;

    // 2. If organizationId is actually a workspaceId, resolve workspace and check organization
    let ws = null;
    try {
      ws = await ctx.db.get(args.organizationId as any);
    } catch {
      // not a convex ID
    }
    if (ws && (ws as any).organizationId) {
      membership = await ctx.db
        .query("organizationMemberships")
        .withIndex("by_org_and_user", (q: any) =>
          q.eq("organizationId", (ws as any).organizationId).eq("userId", args.userId)
        )
        .first();
      if (membership) return membership;
    }

    // 3. Fallback: check workspaceMemberships
    const wsMembership = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_workspace_user", (q: any) =>
        q.eq("workspaceId", args.organizationId as any).eq("userId", args.userId)
      )
      .first();

    if (wsMembership) {
      return {
        _id: wsMembership._id,
        _creationTime: wsMembership._creationTime,
        organizationId: args.organizationId,
        userId: wsMembership.userId,
        role: wsMembership.role || "MEMBER",
        status: wsMembership.status || "ACTIVE",
        createdAt: wsMembership.createdAt,
        updatedAt: wsMembership.updatedAt || wsMembership.createdAt,
      };
    }

    return null;
  },
});

export const getUserMemberships = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const memberships = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    const results = [];
    for (const m of memberships) {
      const org = await ctx.db.get(m.organizationId);
      if (org) {
        results.push({ membership: m, organization: org });
      }
    }
    return results;
  },
});

export async function ensureUserHasNoOtherFreeTrial(
  ctx: { db: any },
  userId: any,
  excludeOrgId?: any
) {
  const memberships = await ctx.db
    .query("organizationMemberships")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .collect();

  for (const m of memberships) {
    if (excludeOrgId && m.organizationId?.toString() === excludeOrgId?.toString()) {
      continue;
    }
    // Only count organizations where the user is an OWNER
    if (m.role !== "OWNER") continue;

    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_organizationId", (q: any) => q.eq("organizationId", m.organizationId))
      .first();

    if (!sub) continue;

    const planKey = (sub.planKey || "").toLowerCase();
    const isFreeTrial = planKey === "free_trial" || planKey === "free";
    const isActiveOrTrial = ["trial", "trialing", "active"].includes(sub.status);

    if (isFreeTrial && isActiveOrTrial) {
      const isExpired = sub.trialEndsAt && sub.trialEndsAt < Date.now() && sub.status !== "active";
      if (!isExpired) {
        await ctx.db.insert("organizationAuditLogs", {
          userId,
          eventType: "organization.free_trial_limit_reached",
          metadata: {
            organizationId: m.organizationId?.toString(),
            message: "Attempted to create second Free Trial organization",
          },
          createdAt: Date.now(),
        });
        throw new Error(
          "FREE_TRIAL_LIMIT_REACHED: You already have an organization on Free Trial. Please choose Standard for this new organization."
        );
      }
    }
  }
}

export const getUserFreeTrialStatus = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const memberships = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    for (const m of memberships) {
      if (m.role !== "OWNER") continue;

      const sub = await ctx.db
        .query("subscriptions")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", m.organizationId))
        .first();

      if (!sub) continue;

      const planKey = (sub.planKey || "").toLowerCase();
      const isFreeTrial = planKey === "free_trial" || planKey === "free";
      const isActiveOrTrial = ["trial", "trialing", "active"].includes(sub.status);

      if (isFreeTrial && isActiveOrTrial) {
        const isExpired = sub.trialEndsAt && sub.trialEndsAt < Date.now() && sub.status !== "active";
        if (!isExpired) {
          const org = await ctx.db.get(m.organizationId);
          return {
            hasFreeTrial: true,
            organizationId: m.organizationId,
            organizationName: org?.name || "Existing Business",
            trialEndsAt: sub.trialEndsAt,
          };
        }
      }
    }

    return { hasFreeTrial: false };
  },
});

export const DEFAULT_MAX_OWNED_ORGS_PER_USER = 3;
export const FEATURE_KEY_ORG_LIMIT = "organization.max_owned_count";

export async function computeOrganizationCreationEligibility(
  ctx: { db: any },
  userId: any
) {
  // 1. Check for superadmin override
  const override = await ctx.db
    .query("organizationLimitOverrides")
    .withIndex("by_user_feature", (q: any) =>
      q.eq("userId", userId).eq("featureKey", FEATURE_KEY_ORG_LIMIT)
    )
    .first();

  let maxOwned = DEFAULT_MAX_OWNED_ORGS_PER_USER;
  let overrideData: any = undefined;
  if (override && (!override.expiresAt || override.expiresAt > Date.now())) {
    maxOwned = override.overrideLimit;
    overrideData = {
      active: true,
      grantedBy: override.grantedBy,
      reason: override.reason,
      expiresAt: override.expiresAt || null,
      overrideLimit: override.overrideLimit,
    };
  }

  // 2. Count active and archived organizations owned by user
  const ownedOrgs = await ctx.db
    .query("organizations")
    .withIndex("by_ownerId", (q: any) => q.eq("ownerId", userId))
    .collect();

  const memberships = await ctx.db
    .query("organizationMemberships")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .collect();

  const ownerOrgIds = new Set<string>();

  for (const org of ownedOrgs) {
    if (org && org.status !== "deleted" && !org.deletedAt) {
      ownerOrgIds.add(org._id.toString());
    }
  }

  let hasFreeTrial = false;
  let freeTrialOrgId: string | undefined = undefined;
  let freeTrialOrgName: string | undefined = undefined;
  let freeTrialEndsAt: number | undefined = undefined;

  for (const m of memberships) {
    if (m.role === "OWNER" && (m.status === "ACTIVE" || m.status === "INVITED")) {
      const org = await ctx.db.get(m.organizationId);
      if (org && org.status !== "deleted" && !org.deletedAt) {
        ownerOrgIds.add(org._id.toString());
      }
    }

    // Check free trial status for owned orgs
    if (m.role === "OWNER" && m.status === "ACTIVE") {
      const sub = await ctx.db
        .query("subscriptions")
        .withIndex("by_organizationId", (q: any) => q.eq("organizationId", m.organizationId))
        .first();

      if (sub) {
        const planKey = (sub.planKey || "").toLowerCase();
        const isFreeTrial = planKey === "free_trial" || planKey === "free";
        const isActiveOrTrial = ["trial", "trialing", "active"].includes(sub.status);
        if (isFreeTrial && isActiveOrTrial) {
          const isExpired = sub.trialEndsAt && sub.trialEndsAt < Date.now() && sub.status !== "active";
          if (!isExpired) {
            hasFreeTrial = true;
            freeTrialOrgId = m.organizationId.toString();
            freeTrialEndsAt = sub.trialEndsAt;
            const org = await ctx.db.get(m.organizationId);
            if (org) freeTrialOrgName = org.name;
          }
        }
      }
    }
  }

  const currentOwned = ownerOrgIds.size;
  const remaining = Math.max(maxOwned - currentOwned, 0);
  const allowed = currentOwned < maxOwned;

  const reasons: string[] = [];
  if (!allowed) {
    reasons.push("organization_limit_reached");
  }
  if (hasFreeTrial) {
    reasons.push("free_trial_limit_reached");
  }

  return {
    canCreate: allowed,
    allowed,
    currentOwned,
    currentOwnedOrganizations: currentOwned,
    maximumOwned: maxOwned,
    maximumOwnedOrganizations: maxOwned,
    remainingOwned: remaining,
    remainingOwnedOrganizations: remaining,
    freeTrial: {
      used: hasFreeTrial ? 1 : 0,
      maximum: 1,
      available: !hasFreeTrial,
      organizationId: freeTrialOrgId,
      organizationName: freeTrialOrgName,
      trialEndsAt: freeTrialEndsAt,
    },
    reasons,
    recommendedPlan: hasFreeTrial ? "standard" : "free_trial",
    override: overrideData,
    code: allowed ? undefined : "ORGANIZATION_LIMIT_REACHED",
    message: allowed
      ? undefined
      : `You have reached the maximum of ${maxOwned} organizations you can create.`,
  };
}

export async function ensureUserCanCreateOrganization(
  ctx: { db: any },
  userId: any
) {
  const eligibility = await computeOrganizationCreationEligibility(ctx, userId);
  if (!eligibility.allowed) {
    await ctx.db.insert("organizationAuditLogs", {
      userId,
      eventType: "organization.creation_limit_reached",
      metadata: {
        currentOwned: eligibility.currentOwnedOrganizations,
        limit: eligibility.maximumOwnedOrganizations,
      },
      createdAt: Date.now(),
    });

    throw new Error("ORGANIZATION_LIMIT_REACHED");
  }
  return eligibility;
}

export const getOrganizationCreationEligibility = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await computeOrganizationCreationEligibility(ctx, args.userId);
  },
});

export const getUserOrganizationsCategorized = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const eligibility = await computeOrganizationCreationEligibility(ctx, args.userId);
    const memberships = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_userId", (q: any) => q.eq("userId", args.userId))
      .collect();

    const owned: any[] = [];
    const joined: any[] = [];
    const archived: any[] = [];
    const seenOrgIds = new Set<string>();

    for (const m of memberships) {
      if (m.status !== "ACTIVE" && m.status !== "INVITED") continue;
      const org = await ctx.db.get(m.organizationId);
      if (!org || org.status === "deleted" || org.deletedAt) continue;

      const orgIdStr = org._id.toString();
      if (seenOrgIds.has(orgIdStr)) continue;
      seenOrgIds.add(orgIdStr);

      const sub = await ctx.db
        .query("subscriptions")
        .withIndex("by_organizationId", (q: any) => q.eq("organizationId", org._id))
        .first();

      const item = {
        organization: org,
        membership: m,
        subscription: sub,
        role: m.role || (org.ownerId === args.userId ? "OWNER" : "MEMBER"),
        status: org.status || "active",
      };

      if (org.status === "archived") {
        archived.push(item);
      } else if (org.ownerId === args.userId || m.role === "OWNER") {
        owned.push(item);
      } else {
        joined.push(item);
      }
    }

    return {
      owned,
      joined,
      archived,
      creationLimit: {
        currentOwned: eligibility.currentOwnedOrganizations,
        maximumOwned: eligibility.maximumOwnedOrganizations,
        remaining: eligibility.remainingOwnedOrganizations,
        canCreate: eligibility.allowed,
      },
    };
  },
});

export const getOrganizationSettings = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("organizationSettings")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .first();
  },
});

export const createOrganization = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    industry: v.string(),
    country: v.string(),
    timezone: v.string(),
    currency: v.optional(v.string()),
    website: v.optional(v.string()),
    size: v.optional(v.string()),
    logo: v.optional(v.string()),
    phone: v.optional(v.string()),
    planId: v.optional(v.string()),
    billingCycle: v.optional(v.string()),
    paymentGateway: v.optional(v.string()),
    paymentReference: v.optional(v.string()),
    products: v.optional(v.array(v.string())),
    primaryBranch: v.optional(
      v.object({
        name: v.string(),
        code: v.optional(v.string()),
        country: v.optional(v.string()),
        state: v.optional(v.string()),
        stateCode: v.optional(v.string()),
        lga: v.optional(v.string()),
        city: v.optional(v.string()),
        street: v.optional(v.string()),
        blockNumber: v.optional(v.string()),
        area: v.optional(v.string()),
        landmark: v.optional(v.string()),
      })
    ),
    invitations: v.optional(
      v.array(
        v.object({
          email: v.string(),
          role: v.string(),
          branchAccess: v.optional(v.array(v.string())),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    // 1. Verify user exists and email is verified
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }
    if (!user.emailVerified) {
      throw new Error("EMAIL_NOT_VERIFIED");
    }

    const now = Date.now();
    const activeProducts = Array.isArray(args.products) ? args.products : ["inventory"];
    const activePlan = args.planId === "standard" ? "standard" : "free_trial";

    // Enforce Rule 1: Max 3 owned organizations per user
    await ensureUserCanCreateOrganization(ctx, args.userId);

    // Enforce Rule 2: One free trial organization per user
    if (activePlan === "free_trial") {
      await ensureUserHasNoOtherFreeTrial(ctx, args.userId);
    }

    // 2. Check idempotency: If user already has an active onboarding with an org
    const onboarding = await ctx.db
      .query("onboardingProgress")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (onboarding && onboarding.organizationId) {
      const existingOrg = await ctx.db.get(onboarding.organizationId);
      if (existingOrg) {
        // Return existing organization with owner membership
        const membership = await ctx.db
          .query("organizationMemberships")
          .withIndex("by_org_and_user", (q: any) =>
            q.eq("organizationId", existingOrg._id).eq("userId", args.userId)
          )
          .first();

        // Ensure workspace exists
        let ws = await ctx.db
          .query("workspaces")
          .withIndex("by_organizationId", (q) => q.eq("organizationId", existingOrg._id))
          .first();

        if (!ws) {
          const wsId = await ctx.db.insert("workspaces", {
            organizationId: existingOrg._id,
            name: existingOrg.name,
            slug: existingOrg.slug,
            type: existingOrg.industry || "business",
            ownerId: args.userId,
            country: existingOrg.country || "NG",
            timezone: existingOrg.timezone || "Africa/Lagos",
            currency: args.currency || (existingOrg.country === "NG" ? "NGN" : "USD"),
            status: "active",
            planId: activePlan,
            isDefault: true,
            enabledModules: activeProducts,
            settings: {
              phone: args.phone,
              currency: args.currency || (existingOrg.country === "NG" ? "NGN" : "USD"),
              timezone: existingOrg.timezone,
            },
            createdAt: now,
            updatedAt: now,
          });
          ws = await ctx.db.get(wsId);
        }

        if (ws) {
          // Ensure subscription
          const existingSub = await ctx.db
            .query("subscriptions")
            .withIndex("by_workspace", (q) => q.eq("workspaceId", ws!._id))
            .first();

          if (!existingSub) {
            const isStandardPaid = activePlan === "standard" && Boolean(args.paymentReference);
            const trialDays = 30;
            const trialEnd = now + trialDays * 86_400_000;
            const interval = args.billingCycle === "annual" ? "annual" : "monthly";

            await ctx.db.insert("subscriptions", {
              organizationId: existingOrg._id,
              workspaceId: ws._id,
              planKey: activePlan === "standard" ? "standard" : "free_trial",
              selectedPlan: activePlan === "standard" ? "standard" : "free_trial",
              activePlan: isStandardPaid ? "standard" : (activePlan === "standard" ? null : "free_trial"),
              status: isStandardPaid ? "active" : (activePlan === "standard" ? "pending" : "trial"),
              checkoutStatus: isStandardPaid ? "completed" : (activePlan === "standard" ? "pending" : "not_required"),
              paymentStatus: isStandardPaid ? "success" : (activePlan === "standard" ? "pending" : "not_required"),
              entitlementStatus: isStandardPaid || activePlan !== "standard" ? "active" : "inactive",
              billingInterval: interval,
              currentPeriodStart: now,
              currentPeriodEnd: isStandardPaid
                ? now + (interval === "annual" ? 365 : 30) * 86_400_000
                : trialEnd,
              trialStart: activePlan === "standard" ? undefined : now,
              trialEnd: activePlan === "standard" ? undefined : trialEnd,
              trialEndsAt: activePlan === "standard" ? undefined : trialEnd,
              paymentMethod: args.paymentGateway === "paystack" ? "paystack" : (args.paymentGateway === "flutterwave" ? "flutterwave" : "bank_transfer"),
              amount: activePlan === "standard" ? (interval === "annual" ? 75000 : 7500) : 0,
              currency: args.currency || (existingOrg.country === "NG" ? "NGN" : "USD"),
              lastPaymentReference: args.paymentReference,
              cancelAtPeriodEnd: false,
              createdAt: now,
              updatedAt: now,
            });
          }

          // Ensure workspace membership
          const wsMem = await ctx.db
            .query("workspaceMemberships")
            .withIndex("by_workspace_user", (q) =>
              q.eq("workspaceId", ws!._id).eq("userId", args.userId)
            )
            .first();

          if (!wsMem) {
            await ctx.db.insert("workspaceMemberships", {
              workspaceId: ws._id,
              userId: args.userId,
              status: "active",
              defaultRole: "owner",
              role: "owner",
              acceptedAt: now,
              createdAt: now,
              updatedAt: now,
            });
          }

          // Ensure products
          for (const prodKey of activeProducts) {
            const wsProd = await ctx.db
              .query("workspaceProducts")
              .withIndex("by_workspace_product", (q) =>
                q.eq("workspaceId", ws!._id).eq("productKey", prodKey)
              )
              .first();

            if (!wsProd) {
              await ctx.db.insert("workspaceProducts", {
                workspaceId: ws._id,
                productKey: prodKey,
                status: "active",
                planId: activePlan,
                trialStartedAt: now,
                activatedBy: args.userId,
                activatedAt: now,
              });
            }
          }
        }

        return {
          organization: existingOrg,
          membership: membership || { role: "OWNER" as const, status: "ACTIVE" as const },
          onboarding,
          isDuplicate: true,
        };
      }
    }

    // 2b. Users are free - each organization has its own subscription (Free Trial or Standard).
    // Generate unique slug
    let baseSlug = generateSlug(args.name);
    if (!baseSlug) {
      baseSlug = "organization";
    }

    let slug = baseSlug;
    let counter = 1;
    while (true) {
      const existingSlug = await ctx.db
        .query("organizations")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first();

      if (!existingSlug) break;
      counter++;
      slug = `${baseSlug}-${counter}`;
    }

    // 3. ATOMIC CREATION: Org + Membership + Settings + Workspace + WorkspaceMembership + Products + Branch + Onboarding
    const organizationId = await ctx.db.insert("organizations", {
      name: args.name,
      slug,
      industry: args.industry,
      country: args.country,
      timezone: args.timezone,
      website: args.website,
      size: args.size,
      logo: args.logo,
      phone: args.phone,
      currency: args.currency || (args.country === "NG" ? "NGN" : "USD"),
      ownerId: args.userId,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("organizationAuditLogs", {
      organizationId: organizationId.toString(),
      userId: args.userId,
      eventType: "organization.created",
      metadata: {
        name: args.name,
        slug,
        planId: activePlan,
      },
      createdAt: now,
    });

    const membershipId = await ctx.db.insert("organizationMemberships", {
      organizationId,
      userId: args.userId,
      role: "OWNER",
      status: "ACTIVE",
      joinedAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("organizationSettings", {
      organizationId,
      enabledModules: activeProducts,
      workspaceReady: true,
      workspaceInitializedAt: now,
      defaults: {},
      updatedAt: now,
    });

    // Auto-provision primary workspace
    const workspaceId = await ctx.db.insert("workspaces", {
      organizationId,
      name: args.name,
      slug,
      type: args.industry || "business",
      ownerId: args.userId,
      country: args.country || "NG",
      timezone: args.timezone || "Africa/Lagos",
      currency: args.currency || (args.country === "NG" ? "NGN" : "USD"),
      status: "active",
      planId: activePlan,
      isDefault: true,
      enabledModules: activeProducts,
      settings: {
        phone: args.phone,
        currency: args.currency || (args.country === "NG" ? "NGN" : "USD"),
        timezone: args.timezone,
        billingCycle: args.billingCycle,
        paymentGateway: args.paymentGateway,
        paymentReference: args.paymentReference,
      },
      createdAt: now,
      updatedAt: now,
    });

    // Create Subscription: 30-day Free Trial (default) or Standard (paid)
    const isStandardPaid = activePlan === "standard" && Boolean(args.paymentReference);
    const trialDays = 30;
    const trialEnd = now + trialDays * 86_400_000;
    const interval = args.billingCycle === "annual" ? "annual" : "monthly";

    const subscriptionId = await ctx.db.insert("subscriptions", {
      organizationId,
      workspaceId,
      planKey: activePlan === "standard" ? "standard" : "free_trial",
      selectedPlan: activePlan === "standard" ? "standard" : "free_trial",
      activePlan: isStandardPaid ? "standard" : (activePlan === "standard" ? null : "free_trial"),
      status: isStandardPaid ? "active" : (activePlan === "standard" ? "pending" : "trial"),
      checkoutStatus: isStandardPaid ? "completed" : (activePlan === "standard" ? "pending" : "not_required"),
      paymentStatus: isStandardPaid ? "success" : (activePlan === "standard" ? "pending" : "not_required"),
      entitlementStatus: isStandardPaid || activePlan !== "standard" ? "active" : "inactive",
      billingInterval: interval,
      currentPeriodStart: now,
      currentPeriodEnd: isStandardPaid
        ? now + (interval === "annual" ? 365 : 30) * 86_400_000
        : trialEnd,
      trialStart: activePlan === "standard" ? undefined : now,
      trialEnd: activePlan === "standard" ? undefined : trialEnd,
      trialEndsAt: activePlan === "standard" ? undefined : trialEnd,
      paymentMethod: args.paymentGateway === "paystack" ? "paystack" : (args.paymentGateway === "flutterwave" ? "flutterwave" : "bank_transfer"),
      amount: activePlan === "standard" ? (interval === "annual" ? 75000 : 7500) : 0,
      currency: "NGN",
      lastPaymentReference: args.paymentReference,
      cancelAtPeriodEnd: false,
      activatedAt: isStandardPaid ? now : undefined,
      createdAt: now,
      updatedAt: now,
    });

    // Record payment & invoice if Standard plan was paid
    if (isStandardPaid) {
      const standardAmount = interval === "annual" ? 75000 : 7500;
      const paymentId = await ctx.db.insert("payments", {
        organizationId,
        workspaceId,
        userId: args.userId,
        amount: standardAmount,
        currency: "NGN",
        provider: args.paymentGateway || "paystack",
        providerReference: args.paymentReference,
        paymentMethod: (args.paymentGateway as any) || "paystack",
        reference: args.paymentReference,
        status: "success",
        createdAt: now,
        completedAt: now,
      });

      const invoiceNumber = await generateNextInvoiceNumber(ctx);
      const invoiceId = await ctx.db.insert("invoices", {
        organizationId,
        workspaceId,
        subscriptionId,
        paymentId,
        invoiceNumber,
        status: "paid",
        amount: standardAmount,
        currency: "NGN",
        periodStart: now,
        periodEnd: now + (interval === "annual" ? 365 : 30) * 86_400_000,
        issuedAt: now,
        paidAt: now,
        dueDate: now,
        paymentReference: args.paymentReference,
        paymentMethod: (args.paymentGateway as any) || "paystack",
        items: [
          {
            description: `Orviohub Standard Plan (${interval === "annual" ? "Annual" : "Monthly"})`,
            quantity: 1,
            unitPrice: standardAmount,
            total: standardAmount,
          },
        ],
        createdAt: now,
        updatedAt: now,
      });

      await ctx.db.insert("auditLogs", {
        actorId: args.userId,
        actorUserId: args.userId,
        organizationId,
        action: "billing.invoice_created",
        resource: `invoice:${invoiceId}`,
        severity: "info",
        metadata: {
          invoiceNumber,
          amount: standardAmount,
          paymentReference: args.paymentReference,
        },
        timestamp: now,
      });

      const user = await ctx.db.get(args.userId);
      if (user && user.email) {
        await ctx.db.insert("emailOutbox", {
          to: user.email,
          template: "invoice_generated" as any,
          payload: {
            firstName: user.name?.split(" ")[0] || "there",
            name: user.name || "Customer",
            orgName: args.name,
            planName: "Standard Plan",
            billingInterval: interval === "annual" ? "Annual" : "Monthly",
            amount: String(standardAmount),
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
    }

    // Enqueue trial started email if on Free Trial
    if (!isStandardPaid) {
      const user = await ctx.db.get(args.userId);
      if (user && user.email) {
        await ctx.db.insert("emailOutbox", {
          to: user.email,
          template: "trial_started" as any,
          payload: {
            firstName: user.name?.split(" ")[0] || "there",
            name: user.name || "Customer",
            orgName: args.name,
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
    }

    // Owner workspace membership
    await ctx.db.insert("workspaceMemberships", {
      workspaceId,
      userId: args.userId,
      status: "active",
      defaultRole: "owner",
      role: "owner",
      acceptedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    // Primary branch
    const branchData = args.primaryBranch;
    const branchId = await ctx.db.insert("branches", {
      workspaceId,
      name: branchData?.name || "Main Store",
      code: branchData?.code || "MAIN",
      isPrimary: true,
      status: "active",
      country: branchData?.country || args.country || "Nigeria",
      state: branchData?.state || "Lagos",
      stateCode: branchData?.stateCode,
      lga: branchData?.lga,
      city: branchData?.city || "Ikeja",
      street: branchData?.street,
      blockNumber: branchData?.blockNumber,
      area: branchData?.area,
      landmark: branchData?.landmark,
      phone: args.phone,
      createdAt: now,
      updatedAt: now,
    });

    // Provision selected products & product memberships for owner
    for (const prodKey of activeProducts) {
      await ctx.db.insert("workspaceProducts", {
        workspaceId,
        productKey: prodKey,
        status: "active",
        planId: activePlan,
        trialStartedAt: now,
        activatedBy: args.userId,
        activatedAt: now,
      });

      await ctx.db.insert("productMemberships", {
        workspaceId,
        userId: args.userId,
        productKey: prodKey,
        role: "owner",
        permissions: ["*"],
        branchIds: [branchId],
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
    }

    // Provision invitations if supplied
    if (args.invitations && args.invitations.length > 0) {
      for (const inv of args.invitations) {
        if (!inv.email || !inv.email.includes("@")) continue;
        const tokenHash = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        await ctx.db.insert("workspaceInvitations", {
          workspaceId,
          email: inv.email.toLowerCase().trim(),
          emailNormalized: inv.email.toLowerCase().trim(),
          role: inv.role || "member",
          branchIds: [branchId],
          tokenHash,
          status: "pending",
          invitedBy: args.userId,
          expiresAt: now + 7 * 86400000,
          createdAt: now,
        });
      }
    }

    const progress = await ctx.db
      .query("onboardingProgress")
      .withIndex("by_userId", (q: any) => q.eq("userId", args.userId))
      .first();

    const isAlreadyCompleted = progress && progress.status === "COMPLETED";
    const nextStep = isAlreadyCompleted ? "COMPLETED" : "MODULE_SELECTION";
    const nextStatus = isAlreadyCompleted ? "COMPLETED" : "IN_PROGRESS";

    let completedSteps = [
      "ACCOUNT_CREATED",
      "EMAIL_VERIFIED",
      "ORGANIZATION_CREATION",
      "ORGANIZATION_CREATED",
      "ORGANIZATION_CONFIGURED",
    ];
    let onboardingId;
    if (progress) {
      completedSteps = Array.from(
        new Set([...progress.completedSteps, "ORGANIZATION_CREATION", "ORGANIZATION_CREATED", "ORGANIZATION_CONFIGURED"])
      );
      await ctx.db.patch(progress._id, {
        organizationId,
        currentStep: nextStep as any,
        status: nextStatus as any,
        completedSteps,
        updatedAt: now,
      });
      onboardingId = progress._id;
    } else {
      onboardingId = await ctx.db.insert("onboardingProgress", {
        userId: args.userId,
        organizationId,
        currentStep: nextStep as any,
        status: nextStatus as any,
        completedSteps,
        startedAt: now,
        updatedAt: now,
      });
    }

    // Audit log
    await ctx.db.insert("auditLogs", {
      actorId: args.userId,
      organizationId,
      action: "organization.created",
      resource: `organization:${organizationId}`,
      metadata: { name: args.name, slug },
      timestamp: now,
    });

    const organization = await ctx.db.get(organizationId);
    const membership = await ctx.db.get(membershipId);
    const updatedOnboarding = await ctx.db.get(onboardingId!);

    return {
      organization,
      membership,
      onboarding: updatedOnboarding,
      isDuplicate: false,
    };
  },
});

export const updateOrganization = mutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    name: v.optional(v.string()),
    industry: v.optional(v.string()),
    country: v.optional(v.string()),
    timezone: v.optional(v.string()),
    website: v.optional(v.string()),
    size: v.optional(v.string()),
    logo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check permission
    const membership = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_org_and_user", (q: any) =>
        q.eq("organizationId", args.organizationId).eq("userId", args.userId)
      )
      .first();

    if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
      throw new Error("ORGANIZATION_ACCESS_DENIED");
    }

    const org = await ctx.db.get(args.organizationId);
    if (!org) {
      throw new Error("ORGANIZATION_NOT_FOUND");
    }

    const now = Date.now();
    const patchData: Record<string, unknown> = { updatedAt: now };
    if (args.name !== undefined) patchData.name = args.name;
    if (args.industry !== undefined) patchData.industry = args.industry;
    if (args.country !== undefined) patchData.country = args.country;
    if (args.timezone !== undefined) patchData.timezone = args.timezone;
    if (args.website !== undefined) patchData.website = args.website;
    if (args.size !== undefined) patchData.size = args.size;
    if (args.logo !== undefined) patchData.logo = args.logo;

    await ctx.db.patch(args.organizationId, patchData);

    // Audit log
    await ctx.db.insert("auditLogs", {
      actorId: args.userId,
      organizationId: args.organizationId,
      action: "organization.updated",
      resource: `organization:${args.organizationId}`,
      metadata: patchData,
      timestamp: now,
    });

    return await ctx.db.get(args.organizationId);
  },
});

export const leaveOrganization = mutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_org_and_user", (q: any) =>
        q.eq("organizationId", args.organizationId).eq("userId", args.userId)
      )
      .first();

    if (!membership || membership.status !== "ACTIVE") {
      throw new Error("MEMBERSHIP_NOT_FOUND");
    }

    if (membership.role === "OWNER") {
      const allMembers = await ctx.db
        .query("organizationMemberships")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", args.organizationId))
        .collect();

      const activeMembers = allMembers.filter((m) => m.status === "ACTIVE");
      const activeOwners = activeMembers.filter((m) => m.role === "OWNER");

      if (activeOwners.length === 1 && activeMembers.length > 1) {
        throw new Error("OWNER_CANNOT_LEAVE");
      }
    }

    await ctx.db.delete(membership._id);

    const now = Date.now();
    await ctx.db.insert("auditLogs", {
      actorId: args.userId,
      organizationId: args.organizationId,
      action: "organization.member_left",
      resource: `organization:${args.organizationId}`,
      metadata: { userId: args.userId },
      timestamp: now,
    });

    return { success: true };
  },
});

export const deleteOrganization = mutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // 1. Verify caller is OWNER of this organization
    const membership = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_org_and_user", (q: any) =>
        q.eq("organizationId", args.organizationId).eq("userId", args.userId)
      )
      .first();

    if (!membership || membership.role !== "OWNER") {
      throw new Error("ORGANIZATION_ACCESS_DENIED");
    }

    // 2. Safeguard: Cannot delete if other active members exist
    const allMembers = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", args.organizationId))
      .collect();

    const otherActiveMembers = allMembers.filter(
      (m) => m.userId !== args.userId && m.status === "ACTIVE"
    );

    if (otherActiveMembers.length > 0) {
      throw new Error("CANNOT_DELETE_ORG_WITH_MEMBERS");
    }

    // 3. Cascade cleanup
    // Delete memberships
    for (const m of allMembers) {
      await ctx.db.delete(m._id);
    }

    // Delete organizationSettings
    const settings = await ctx.db
      .query("organizationSettings")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", args.organizationId))
      .collect();
    for (const s of settings) {
      await ctx.db.delete(s._id);
    }

    // Delete organizationModules
    const modules = await ctx.db
      .query("organizationModules")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", args.organizationId))
      .collect();
    for (const mod of modules) {
      await ctx.db.delete(mod._id);
    }

    // Delete invitations
    const invites = await ctx.db
      .query("invitations")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", args.organizationId))
      .collect();
    for (const inv of invites) {
      await ctx.db.delete(inv._id);
    }

    // Delete workspaces
    const workspaces = await ctx.db
      .query("workspaces")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", args.organizationId))
      .collect();
    for (const ws of workspaces) {
      await ctx.db.delete(ws._id);
    }

    // Dissociate onboardingProgress
    const onboardingRecords = await ctx.db
      .query("onboardingProgress")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", args.organizationId))
      .collect();
    for (const onb of onboardingRecords) {
      await ctx.db.patch(onb._id, { organizationId: undefined });
    }

    // Delete auditLogs
    const auditRecords = await ctx.db
      .query("auditLogs")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", args.organizationId))
      .collect();
    for (const aud of auditRecords) {
      await ctx.db.delete(aud._id);
    }

    // Delete organization record itself
    await ctx.db.delete(args.organizationId);

    return { success: true };
  },
});

export const getOrganizationMembers = query({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const caller = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_org_and_user", (q: any) =>
        q.eq("organizationId", args.organizationId).eq("userId", args.userId)
      )
      .first();
    if (!caller) throw new Error("ORGANIZATION_ACCESS_DENIED");

    const memberships = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", args.organizationId))
      .collect();

    const results = [];
    for (const m of memberships) {
      const user = await ctx.db.get(m.userId);
      if (user) {
        results.push({
          id: m._id,
          organizationId: m.organizationId,
          userId: m.userId,
          role: m.role,
          status: m.status,
          joinedAt: m.joinedAt,
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            avatarUrl: user.avatarUrl,
          },
        });
      }
    }
    return results;
  },
});

export const updateMemberRole = mutation({
  args: {
    organizationId: v.id("organizations"),
    callerUserId: v.id("users"),
    targetUserId: v.id("users"),
    newRole: v.union(
      v.literal("OWNER"),
      v.literal("ADMIN"),
      v.literal("MANAGER"),
      v.literal("SALES_ATTENDANT"),
      v.literal("STOCK_MANAGER"),
      v.literal("ACCOUNTANT"),
      v.literal("MEMBER")
    ),
  },
  handler: async (ctx, args) => {
    const caller = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_org_and_user", (q: any) =>
        q.eq("organizationId", args.organizationId).eq("userId", args.callerUserId)
      )
      .first();

    if (!caller || (caller.role !== "OWNER" && caller.role !== "ADMIN")) {
      throw new Error("ORGANIZATION_ACCESS_DENIED");
    }

    const target = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_org_and_user", (q: any) =>
        q.eq("organizationId", args.organizationId).eq("userId", args.targetUserId)
      )
      .first();

    if (!target) throw new Error("MEMBER_NOT_FOUND");

    // Last-Owner Protection: If demoting an OWNER, ensure at least one active OWNER remains
    if (target.role === "OWNER" && args.newRole !== "OWNER") {
      const allMembers = await ctx.db
        .query("organizationMemberships")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", args.organizationId))
        .collect();
      const activeOwners = allMembers.filter((m) => m.role === "OWNER" && m.status === "ACTIVE");
      if (activeOwners.length <= 1) {
        throw new Error("CANNOT_REMOVE_LAST_OWNER");
      }
    }

    await ctx.db.patch(target._id, {
      role: args.newRole,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

export const removeMember = mutation({
  args: {
    organizationId: v.id("organizations"),
    callerUserId: v.id("users"),
    targetUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const caller = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_org_and_user", (q: any) =>
        q.eq("organizationId", args.organizationId).eq("userId", args.callerUserId)
      )
      .first();

    if (!caller || (caller.role !== "OWNER" && caller.role !== "ADMIN")) {
      throw new Error("ORGANIZATION_ACCESS_DENIED");
    }

    const target = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_org_and_user", (q: any) =>
        q.eq("organizationId", args.organizationId).eq("userId", args.targetUserId)
      )
      .first();

    if (!target) throw new Error("MEMBER_NOT_FOUND");

    // Last-Owner Protection
    if (target.role === "OWNER") {
      const allMembers = await ctx.db
        .query("organizationMemberships")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", args.organizationId))
        .collect();
      const activeOwners = allMembers.filter((m) => m.role === "OWNER" && m.status === "ACTIVE");
      if (activeOwners.length <= 1) {
        throw new Error("CANNOT_REMOVE_LAST_OWNER");
      }
    }

    await ctx.db.delete(target._id);
    return { success: true };
  },
});

export const createOrganizationWithPlan = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    phone: v.string(),
    category: v.string(),
    currency: v.optional(v.string()),
    street: v.optional(v.string()),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    country: v.optional(v.string()),
    address: v.optional(v.string()),
    industry: v.optional(v.string()),
    timezone: v.optional(v.string()),
    website: v.optional(v.string()),
    businessType: v.optional(v.string()),
    branchCountRange: v.optional(v.string()),
    productCountRange: v.optional(v.string()),
    primaryUsers: v.optional(v.array(v.string())),
    planKey: v.union(v.literal("free_trial"), v.literal("standard")),
    billingInterval: v.optional(v.union(v.literal("monthly"), v.literal("annual"))),
    paymentGateway: v.optional(v.string()),
    paymentReference: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("USER_NOT_FOUND");

    const now = Date.now();
    const planKey = args.planKey === "standard" ? "standard" : "free_trial";
    const currency = args.currency || (args.country === "Nigeria" || !args.country ? "NGN" : "USD");
    const country = args.country || "Nigeria";
    const timezone = args.timezone || "Africa/Lagos";
    const fullAddress =
      args.address ||
      [args.street, args.city, args.state, country].filter(Boolean).join(", ");
    const interval = args.billingInterval === "annual" ? "annual" : "monthly";

    // 1. Enforce Rule 1: Max 3 owned organizations per user
    await ensureUserCanCreateOrganization(ctx, args.userId);

    // 1b. Enforce Free Trial rule: Only one Free Trial organization per user
    if (planKey === "free_trial") {
      await ensureUserHasNoOtherFreeTrial(ctx, args.userId);
    }

    // 2. Generate unique slug
    let baseSlug = generateSlug(args.name) || "org";
    let slug = baseSlug;
    let counter = 1;
    while (true) {
      const existing = await ctx.db
        .query("organizations")
        .withIndex("by_slug", (q: any) => q.eq("slug", slug))
        .first();
      if (!existing) break;
      slug = `${baseSlug}-${counter++}`;
    }

    // 3. Create organizations record
    const organizationId = await ctx.db.insert("organizations", {
      name: args.name.trim(),
      slug,
      industry: args.industry || args.category,
      category: args.category,
      country,
      timezone,
      currency,
      phone: args.phone.trim(),
      street: args.street,
      city: args.city,
      state: args.state,
      address: fullAddress,
      website: args.website,
      ownerId: args.userId,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("organizationAuditLogs", {
      organizationId: organizationId.toString(),
      userId: args.userId,
      eventType: "organization.created",
      metadata: {
        name: args.name,
        slug,
        planId: planKey,
      },
      createdAt: now,
    });

    // 4. Create owner membership
    await ctx.db.insert("organizationMemberships", {
      organizationId,
      userId: args.userId,
      role: "OWNER",
      status: "ACTIVE",
      joinedAt: now,
      updatedAt: now,
    });

    // 5. Create organization settings
    await ctx.db.insert("organizationSettings", {
      organizationId,
      enabledModules: ["inventory"],
      workspaceReady: true,
      workspaceInitializedAt: now,
      defaults: {},
      updatedAt: now,
    });

    // 6. Create organization profile if context fields provided
    const hasProfileAnswers =
      args.businessType ||
      args.branchCountRange ||
      args.productCountRange ||
      (args.primaryUsers && args.primaryUsers.length > 0);

    if (hasProfileAnswers) {
      await ctx.db.insert("organizationProfiles", {
        organizationId,
        businessType: args.businessType,
        branchCountRange: args.branchCountRange,
        productCountRange: args.productCountRange,
        primaryUsers: args.primaryUsers,
        completedAt: now,
      });
    }

    // 7. Auto-provision base workspace
    const workspaceId = await ctx.db.insert("workspaces", {
      organizationId,
      name: args.name.trim(),
      slug,
      type: args.category || "business",
      ownerId: args.userId,
      country,
      state: args.state,
      city: args.city,
      timezone,
      currency,
      status: "active",
      planId: planKey,
      isDefault: true,
      enabledModules: ["inventory"],
      settings: {
        phone: args.phone,
        category: args.category,
        address: fullAddress,
        billingCycle: interval,
        paymentGateway: args.paymentGateway,
        paymentReference: args.paymentReference,
      },
      createdAt: now,
      updatedAt: now,
    });

    // 8. Workspace membership
    await ctx.db.insert("workspaceMemberships", {
      workspaceId,
      userId: args.userId,
      role: "owner",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    // 8b. Create billing account
    const billingAccountId = await ctx.db.insert("billingAccounts", {
      ownerUserId: args.userId,
      organizationId,
      workspaceId,
      billingEmail: user.email,
      billingPhone: args.phone.trim(),
      provider: "paystack",
      currency,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    // 9. Create Subscription
    let subscriptionId;
    let subscriptionStatus: "trial" | "pending" | "active";

    if (planKey === "free_trial") {
      const trialDays = 30;
      const trialEnd = now + trialDays * 86_400_000;
      subscriptionStatus = "trial";

      subscriptionId = await ctx.db.insert("subscriptions", {
        organizationId,
        workspaceId,
        billingAccountId,
        planKey: "free_trial",
        selectedPlan: "free_trial",
        activePlan: "free_trial",
        status: "trial",
        checkoutStatus: "not_required",
        paymentStatus: "not_required",
        entitlementStatus: "active",
        billingInterval: "monthly",
        currentPeriodStart: now,
        currentPeriodEnd: trialEnd,
        trialStart: now,
        trialEnd,
        trialEndsAt: trialEnd,
        paymentMethod: "bank_transfer",
        amount: 0,
        currency,
        cancelAtPeriodEnd: false,
        createdAt: now,
        updatedAt: now,
      });

      // Seed Free Trial Entitlements (Branches: 1, Members: 2, Products: 500, Monthly Tx: 300)
      const features = [
        { key: "branches", val: 1, type: "fixed" as const },
        { key: "members", val: 2, type: "fixed" as const },
        { key: "products", val: 500, type: "fixed" as const },
        { key: "monthly_transactions", val: 300, type: "fixed" as const },
        { key: "inventory", val: undefined, type: "boolean" as const },
      ];
      for (const feat of features) {
        await ctx.db.insert("workspaceEntitlements", {
          workspaceId,
          planId: "free_trial",
          featureKey: feat.key,
          limitValue: feat.val,
          limitType: feat.type,
          enabled: true,
          status: "active",
          effectiveFrom: now,
          effectiveUntil: trialEnd,
          createdAt: now,
          updatedAt: now,
        });
      }
    } else {
      // Standard plan (₦7,500/mo = 750,000 kobo or ₦75,000/yr = 7,500,000 kobo)
      const isPaid = Boolean(args.paymentReference);
      subscriptionStatus = isPaid ? "active" : "pending";
      const periodDays = interval === "annual" ? 365 : 30;
      const periodEnd = now + periodDays * 86_400_000;
      const amount = interval === "annual" ? 75000 : 7500;

      subscriptionId = await ctx.db.insert("subscriptions", {
        organizationId,
        workspaceId,
        billingAccountId,
        planKey: "standard",
        selectedPlan: "standard",
        activePlan: isPaid ? "standard" : null,
        status: subscriptionStatus,
        checkoutStatus: isPaid ? "completed" : "pending",
        paymentStatus: isPaid ? "success" : "pending",
        entitlementStatus: isPaid ? "active" : "inactive",
        billingInterval: interval,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        paymentMethod: (args.paymentGateway as any) || "paystack",
        amount,
        currency,
        lastPaymentReference: args.paymentReference,
        cancelAtPeriodEnd: false,
        activatedAt: isPaid ? now : undefined,
        createdAt: now,
        updatedAt: now,
      });

      // Seed Standard Entitlements (Branches: 3, Members: 10, Products: 5000, Monthly Tx: 5000)
      const features = [
        { key: "branches", val: 3, type: "fixed" as const },
        { key: "members", val: 10, type: "fixed" as const },
        { key: "products", val: 5000, type: "fixed" as const },
        { key: "monthly_transactions", val: 5000, type: "fixed" as const },
        { key: "inventory", val: undefined, type: "boolean" as const },
      ];
      for (const feat of features) {
        await ctx.db.insert("workspaceEntitlements", {
          workspaceId,
          planId: "standard",
          featureKey: feat.key,
          limitValue: feat.val,
          limitType: feat.type,
          enabled: isPaid,
          status: isPaid ? "active" : "pending",
          effectiveFrom: now,
          effectiveUntil: isPaid ? periodEnd : undefined,
          createdAt: now,
          updatedAt: now,
        });
      }

      if (isPaid && args.paymentReference) {
        await ctx.db.insert("payments", {
          organizationId,
          workspaceId,
          userId: args.userId,
          subscriptionId,
          amount,
          currency,
          provider: args.paymentGateway || "paystack",
          providerReference: args.paymentReference,
          reference: args.paymentReference,
          paymentMethod: (args.paymentGateway as any) || "paystack",
          status: "completed",
          createdAt: now,
          completedAt: now,
        });
      }
    }

    // 10. Provision main branch
    const inventoryApp = await ctx.db
      .query("applications")
      .withIndex("by_key", (q: any) => q.eq("key", "inventory"))
      .first();

    const branchId = await ctx.db.insert("branches", {
      workspaceId,
      organizationId,
      applicationId: inventoryApp?._id,
      productKey: "inventory",
      name: "Main Branch",
      code: "MAIN",
      isPrimary: true,
      status: "active",
      country,
      state: args.state || "Lagos",
      city: args.city || "Ikeja",
      street: args.street,
      phone: args.phone,
      createdAt: now,
      updatedAt: now,
    });

    // 10b. Create default branch settings
    await ctx.db.insert("branchSettings", {
      branchId,
      workspaceId,
      productKey: "inventory",
      displayName: "Main Branch",
      receiptFooter: "Thank you for your business!",
      negativeStockAllowed: false,
      allowNegativeStock: false,
      enforceStockCheck: true,
      lowStockThreshold: 5,
      isPrimary: true,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    // 10c. Provision workspaceProducts for Inventory
    await ctx.db.insert("workspaceProducts", {
      workspaceId,
      productKey: "inventory",
      status: "active",
      planId: planKey,
      trialStartedAt: planKey === "free_trial" ? now : undefined,
      trialEndsAt: planKey === "free_trial" ? now + 30 * 86400000 : undefined,
      activatedBy: args.userId,
      activatedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("productMemberships", {
      workspaceId,
      userId: args.userId,
      productKey: "inventory",
      role: "inventory_owner",
      permissions: ["*"],
      branchIds: [branchId],
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    // 10d. Initialize Inventory Onboarding Flow
    await ctx.db.insert("onboardingFlows", {
      userId: args.userId,
      workspaceId,
      productKey: "inventory",
      entryPoint: "organization_creation",
      flowVersion: "1.0",
      status: "IN_PROGRESS",
      currentStep: "business_category",
      completedSteps: ["welcome"],
      skippedSteps: [],
      startedAt: now,
      lastUpdatedAt: now,
    });

    // 11. Update onboardingProgress
    const progress = await ctx.db
      .query("onboardingProgress")
      .withIndex("by_userId", (q: any) => q.eq("userId", args.userId))
      .first();

    if (progress) {
      const completedSteps = Array.from(
        new Set([...progress.completedSteps, "ORGANIZATION_CREATION"])
      );
      await ctx.db.patch(progress._id, {
        organizationId,
        currentStep: "ORGANIZATION_CREATED",
        completedSteps,
        updatedAt: now,
      });
    }

    // 12. Audit Logs
    await ctx.db.insert("auditLogs", {
      actorId: args.userId,
      actorUserId: args.userId,
      organizationId,
      workspaceId,
      action: "workspace.creation_started",
      resource: `workspace:${workspaceId}`,
      severity: "info",
      metadata: {
        organizationName: args.name.trim(),
        planKey,
      },
      timestamp: now,
    });

    await ctx.db.insert("auditLogs", {
      actorId: args.userId,
      actorUserId: args.userId,
      organizationId,
      workspaceId,
      action: "workspace.created",
      resource: `workspace:${workspaceId}`,
      severity: "info",
      metadata: {
        organizationName: args.name.trim(),
        planKey,
        branchId: branchId.toString(),
      },
      timestamp: now,
    });

    await ctx.db.insert("auditLogs", {
      actorId: args.userId,
      actorUserId: args.userId,
      organizationId,
      workspaceId,
      action: "billing.subscription_created",
      resource: `subscription:${subscriptionId}`,
      severity: "info",
      metadata: {
        organizationName: args.name.trim(),
        planKey,
        status: subscriptionStatus,
        billingInterval: interval,
      },
      timestamp: now,
    });

    // 13. Welcome notification
    await ctx.db.insert("notifications", {
      userId: args.userId,
      workspaceId,
      productKey: "inventory",
      type: "workspace.created",
      title: `Welcome to ${args.name.trim()}!`,
      body: `Your organization is ready on the ${planKey === "free_trial" ? "30-Day Free Trial" : "Standard Plan"}. Let's get your inventory set up!`,
      severity: "SUCCESS",
      channel: "IN_APP",
      status: "UNREAD",
      createdAt: now,
    });

    return {
      organizationId,
      workspaceId,
      subscriptionId,
      slug,
      name: args.name.trim(),
      status: subscriptionStatus,
      planKey,
      hasDefaultBranch: true,
    };
  },
});

/**
 * Query: Get caller's granular application and branch permissions in an organization (US-RBAC1)
 */
export const getUserAppPermissions = query({
  args: {
    organizationId: v.union(v.id("organizations"), v.id("workspaces"), v.string()),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { orgId } = await resolveOrganization(ctx, args.organizationId);
    if (!orgId) {
      return {
        role: "MEMBER",
        isFullAdmin: false,
        allowedApplications: [],
        allowedBranches: [],
        primaryBranchId: null,
      };
    }

    const membership = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_org_and_user", (q: any) =>
        q.eq("organizationId", orgId).eq("userId", args.userId)
      )
      .first();

    if (!membership || membership.status !== "ACTIVE") {
      return {
        role: null,
        isFullAdmin: false,
        allowedApplications: [],
        allowedBranches: [],
        primaryBranchId: null,
      };
    }

    const isFullAdmin = membership.role === "OWNER" || membership.role === "ADMIN";

    return {
      role: membership.role,
      isFullAdmin,
      allowedApplications: membership.allowedApplications || [],
      allowedBranches: membership.allowedBranches || [],
      primaryBranchId: membership.primaryBranchId || null,
    };
  },
});

/**
 * Query: Check if user has permission to access a specific application (US-RBAC2)
 */
export const checkUserAppAccess = query({
  args: {
    organizationId: v.union(v.id("organizations"), v.id("workspaces"), v.string()),
    userId: v.id("users"),
    applicationKey: v.string(),
  },
  handler: async (ctx, args) => {
    const { orgId } = await resolveOrganization(ctx, args.organizationId);
    if (!orgId) return { allowed: false, reason: "ORGANIZATION_NOT_FOUND" };

    const membership = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_org_and_user", (q: any) =>
        q.eq("organizationId", orgId).eq("userId", args.userId)
      )
      .first();

    if (!membership || membership.status !== "ACTIVE") {
      return { allowed: false, reason: "NOT_AN_ACTIVE_MEMBER" };
    }

    if (membership.role === "OWNER" || membership.role === "ADMIN") {
      return { allowed: true, role: membership.role, isFullAdmin: true };
    }

    // If allowedApplications is defined and non-empty, must contain key
    if (membership.allowedApplications && membership.allowedApplications.length > 0) {
      const allowed = membership.allowedApplications.includes(args.applicationKey);
      return {
        allowed,
        role: membership.role,
        isFullAdmin: false,
        reason: allowed ? undefined : "APP_ACCESS_RESTRICTED",
      };
    }

    // Default: all active apps allowed if no explicit restriction set
    return { allowed: true, role: membership.role, isFullAdmin: false };
  },
});

/**
 * Query: Check if user has permission to access a specific branch (US-RBAC3)
 */
export const checkUserBranchAccess = query({
  args: {
    organizationId: v.union(v.id("organizations"), v.id("workspaces"), v.string()),
    userId: v.id("users"),
    branchId: v.id("branches"),
  },
  handler: async (ctx, args) => {
    const { orgId } = await resolveOrganization(ctx, args.organizationId);
    if (!orgId) return { allowed: false, reason: "ORGANIZATION_NOT_FOUND" };

    const membership = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_org_and_user", (q: any) =>
        q.eq("organizationId", orgId).eq("userId", args.userId)
      )
      .first();

    if (!membership || membership.status !== "ACTIVE") {
      return { allowed: false, reason: "NOT_AN_ACTIVE_MEMBER" };
    }

    if (membership.role === "OWNER" || membership.role === "ADMIN") {
      return { allowed: true, role: membership.role, isFullAdmin: true };
    }

    // If allowedBranches is defined and non-empty, must contain branchId
    if (membership.allowedBranches && membership.allowedBranches.length > 0) {
      const allowed = membership.allowedBranches.includes(args.branchId);
      return {
        allowed,
        role: membership.role,
        isFullAdmin: false,
        reason: allowed ? undefined : "BRANCH_ACCESS_RESTRICTED",
      };
    }

    // Default: all branches allowed if no restriction set
    return { allowed: true, role: membership.role, isFullAdmin: false };
  },
});

/**
 * Mutation: Update member's granular application and branch permissions (US-RBAC4)
 */
export const updateMemberAppPermissions = mutation({
  args: {
    organizationId: v.union(v.id("organizations"), v.id("workspaces"), v.string()),
    callerUserId: v.id("users"),
    targetUserId: v.id("users"),
    allowedApplications: v.optional(v.array(v.string())),
    allowedBranches: v.optional(v.array(v.id("branches"))),
    primaryBranchId: v.optional(v.id("branches")),
  },
  handler: async (ctx, args) => {
    const { orgId } = await resolveOrganization(ctx, args.organizationId);
    if (!orgId) throw new Error("ORGANIZATION_NOT_FOUND");

    // 1. Caller must be OWNER or ADMIN
    const callerMembership = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_org_and_user", (q: any) =>
        q.eq("organizationId", orgId).eq("userId", args.callerUserId)
      )
      .first();

    if (!callerMembership || (callerMembership.role !== "OWNER" && callerMembership.role !== "ADMIN")) {
      throw new Error("INSUFFICIENT_PERMISSIONS");
    }

    // 2. Target member
    const targetMembership = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_org_and_user", (q: any) =>
        q.eq("organizationId", orgId).eq("userId", args.targetUserId)
      )
      .first();

    if (!targetMembership) throw new Error("MEMBER_NOT_FOUND");

    const now = Date.now();
    await ctx.db.patch(targetMembership._id, {
      allowedApplications: args.allowedApplications,
      allowedBranches: args.allowedBranches,
      primaryBranchId: args.primaryBranchId,
      updatedAt: now,
    });

    return { success: true };
  },
});

/**
 * Mutation: Archive an organization (US-ARCH1)
 * Preserves all business data while disabling operations.
 * Remains counted against the owner's organization creation limit.
 */
export const archiveOrganization = mutation({
  args: {
    organizationId: v.union(v.id("organizations"), v.id("workspaces"), v.string()),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { orgId, org } = await resolveOrganization(ctx, args.organizationId);
    if (!orgId || !org) throw new Error("ORGANIZATION_NOT_FOUND");

    const membership = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_org_and_user", (q: any) =>
        q.eq("organizationId", orgId).eq("userId", args.userId)
      )
      .first();

    const isOwner = org.ownerId === args.userId || membership?.role === "OWNER";
    if (!isOwner) throw new Error("ORGANIZATION_ACCESS_DENIED");

    const now = Date.now();
    await ctx.db.patch(orgId, {
      status: "archived",
      archivedAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("organizationAuditLogs", {
      organizationId: orgId.toString(),
      userId: args.userId,
      eventType: "organization.archived",
      metadata: { name: org.name },
      createdAt: now,
    });

    return { success: true };
  },
});

/**
 * Mutation: Restore an archived organization (US-ARCH2)
 */
export const restoreOrganization = mutation({
  args: {
    organizationId: v.union(v.id("organizations"), v.id("workspaces"), v.string()),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { orgId, org } = await resolveOrganization(ctx, args.organizationId);
    if (!orgId || !org) throw new Error("ORGANIZATION_NOT_FOUND");

    const membership = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_org_and_user", (q: any) =>
        q.eq("organizationId", orgId).eq("userId", args.userId)
      )
      .first();

    const isOwner = org.ownerId === args.userId || membership?.role === "OWNER";
    if (!isOwner) throw new Error("ORGANIZATION_ACCESS_DENIED");

    const now = Date.now();
    await ctx.db.patch(orgId, {
      status: "active",
      archivedAt: undefined,
      updatedAt: now,
    });

    await ctx.db.insert("organizationAuditLogs", {
      organizationId: orgId.toString(),
      userId: args.userId,
      eventType: "organization.restored",
      metadata: { name: org.name },
      createdAt: now,
    });

    return { success: true };
  },
});

/**
 * Mutation: Transfer organization ownership to another user (US-OWN1)
 */
export const transferOrganizationOwnership = mutation({
  args: {
    organizationId: v.union(v.id("organizations"), v.id("workspaces"), v.string()),
    currentOwnerId: v.id("users"),
    newOwnerId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { orgId, org } = await resolveOrganization(ctx, args.organizationId);
    if (!orgId || !org) throw new Error("ORGANIZATION_NOT_FOUND");

    const currentOwnerMem = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_org_and_user", (q: any) =>
        q.eq("organizationId", orgId).eq("userId", args.currentOwnerId)
      )
      .first();

    const isOwner = org.ownerId === args.currentOwnerId || currentOwnerMem?.role === "OWNER";
    if (!isOwner) throw new Error("ORGANIZATION_ACCESS_DENIED");

    const targetUser = await ctx.db.get(args.newOwnerId);
    if (!targetUser) throw new Error("TARGET_USER_NOT_FOUND");

    // Check target user's creation eligibility
    const targetEligibility = await computeOrganizationCreationEligibility(ctx, args.newOwnerId);
    if (!targetEligibility.allowed) {
      throw new Error("TARGET_USER_ORGANIZATION_LIMIT_REACHED");
    }

    const now = Date.now();

    // 1. Update organization ownerId
    await ctx.db.patch(orgId, {
      ownerId: args.newOwnerId,
      updatedAt: now,
    });

    // 2. Demote current owner to ADMIN
    if (currentOwnerMem) {
      await ctx.db.patch(currentOwnerMem._id, {
        role: "ADMIN",
        updatedAt: now,
      });
    }

    // 3. Promote target user to OWNER (or create membership if not present)
    const targetMem = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_org_and_user", (q: any) =>
        q.eq("organizationId", orgId).eq("userId", args.newOwnerId)
      )
      .first();

    if (targetMem) {
      await ctx.db.patch(targetMem._id, {
        role: "OWNER",
        status: "ACTIVE",
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("organizationMemberships", {
        organizationId: orgId,
        userId: args.newOwnerId,
        role: "OWNER",
        status: "ACTIVE",
        joinedAt: now,
        updatedAt: now,
      });
    }

    await ctx.db.insert("organizationAuditLogs", {
      organizationId: orgId.toString(),
      userId: args.currentOwnerId,
      eventType: "organization.ownership_transferred",
      metadata: {
        fromUserId: args.currentOwnerId,
        toUserId: args.newOwnerId,
      },
      createdAt: now,
    });

    return { success: true };
  },
});

/**
 * Superadmin: Set custom organization limit override for a user
 */
export const setOrganizationLimitOverride = mutation({
  args: {
    userId: v.id("users"),
    overrideLimit: v.number(),
    reason: v.string(),
    grantedBy: v.string(),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("organizationLimitOverrides")
      .withIndex("by_user_feature", (q: any) =>
        q.eq("userId", args.userId).eq("featureKey", FEATURE_KEY_ORG_LIMIT)
      )
      .first();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        overrideLimit: args.overrideLimit,
        reason: args.reason,
        grantedBy: args.grantedBy,
        expiresAt: args.expiresAt,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("organizationLimitOverrides", {
        userId: args.userId,
        featureKey: FEATURE_KEY_ORG_LIMIT,
        overrideLimit: args.overrideLimit,
        reason: args.reason,
        grantedBy: args.grantedBy,
        expiresAt: args.expiresAt,
        createdAt: now,
        updatedAt: now,
      });
    }

    await ctx.db.insert("organizationAuditLogs", {
      userId: args.userId,
      eventType: "organization.limit_override_granted",
      metadata: {
        overrideLimit: args.overrideLimit,
        reason: args.reason,
        grantedBy: args.grantedBy,
        expiresAt: args.expiresAt,
      },
      createdAt: now,
    });

    return { success: true };
  },
});

/**
 * Superadmin: Remove organization limit override for a user
 */
export const removeOrganizationLimitOverride = mutation({
  args: {
    userId: v.id("users"),
    removedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("organizationLimitOverrides")
      .withIndex("by_user_feature", (q: any) =>
        q.eq("userId", args.userId).eq("featureKey", FEATURE_KEY_ORG_LIMIT)
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    await ctx.db.insert("organizationAuditLogs", {
      userId: args.userId,
      eventType: "organization.limit_override_removed",
      metadata: { removedBy: args.removedBy },
      createdAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Superadmin: Query organization limit events / audit log
 */
export const getOrganizationLimitEvents = query({
  args: {
    userId: v.optional(v.id("users")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let logs;
    if (args.userId) {
      logs = await ctx.db
        .query("organizationAuditLogs")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId!))
        .order("desc")
        .take(args.limit || 50);
    } else {
      logs = await ctx.db
        .query("organizationAuditLogs")
        .order("desc")
        .take(args.limit || 50);
    }
    return logs;
  },
});

/**
 * Superadmin: Organization ownership usage overview
 */
export const getSuperadminOrganizationUsage = query({
  args: {},
  handler: async (ctx) => {
    const orgs = await ctx.db.query("organizations").collect();
    const activeOrgs = orgs.filter((o) => o.status !== "deleted" && !o.deletedAt);
    const archivedOrgs = orgs.filter((o) => o.status === "archived");

    const ownerCounts: Record<string, number> = {};
    for (const org of activeOrgs) {
      if (org.ownerId) {
        const idStr = org.ownerId.toString();
        ownerCounts[idStr] = (ownerCounts[idStr] || 0) + 1;
      }
    }

    const usersAtLimit = Object.values(ownerCounts).filter((c) => c >= DEFAULT_MAX_OWNED_ORGS_PER_USER).length;

    return {
      totalOrganizations: activeOrgs.length,
      archivedOrganizations: archivedOrgs.length,
      uniqueOwnersCount: Object.keys(ownerCounts).length,
      usersAtLimitCount: usersAtLimit,
      defaultMaxOwnedLimit: DEFAULT_MAX_OWNED_ORGS_PER_USER,
    };
  },
});


