import { query, mutation } from "./_generated/server.js";
import { v } from "convex/values";
import { DEFAULT_PLANS } from "./plans.js";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const getOrganizationById = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.organizationId);
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
  _ctx: { db: any },
  _userId: any,
  _excludeOrgId?: any
) {
  // Users are permitted to have multiple organizations on the Free Trial tier.
  return;
}

export const getUserFreeTrialStatus = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const memberships = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    for (const m of memberships) {
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
            const trialEnd = now + 30 * 86_400_000;
            await ctx.db.insert("subscriptions", {
              organizationId: existingOrg._id,
              workspaceId: ws._id,
              planKey: "free_trial",
              status: "trial",
              billingInterval: "monthly",
              currentPeriodStart: now,
              currentPeriodEnd: trialEnd,
              trialStart: now,
              trialEnd,
              trialEndsAt: trialEnd,
              paymentMethod: "bank_transfer",
              amount: 0,
              currency: "NGN",
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
      createdAt: now,
      updatedAt: now,
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

    await ctx.db.insert("subscriptions", {
      organizationId,
      workspaceId,
      planKey: activePlan === "standard" ? "standard" : "free_trial",
      status: isStandardPaid ? "active" : (activePlan === "standard" ? "pending" : "trial"),
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
      cancelAtPeriodEnd: false,
      createdAt: now,
      updatedAt: now,
    });

    // Record payment if Standard plan was paid
    if (isStandardPaid) {
      await ctx.db.insert("payments", {
        organizationId,
        workspaceId,
        userId: args.userId,
        amount: interval === "annual" ? 75000 : 7500,
        currency: "NGN",
        provider: args.paymentGateway || "paystack",
        providerReference: args.paymentReference,
        paymentMethod: (args.paymentGateway as any) || "paystack",
        reference: args.paymentReference,
        status: "success",
        createdAt: now,
        completedAt: now,
      });
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

    let completedSteps = [
      "ACCOUNT_CREATED",
      "EMAIL_VERIFIED",
      "ORGANIZATION_CREATION",
      "ORGANIZATION_CREATED",
      "ORGANIZATION_CONFIGURED",
    ];
    let onboardingId;
    if (onboarding) {
      completedSteps = Array.from(
        new Set([...onboarding.completedSteps, "ORGANIZATION_CREATION", "ORGANIZATION_CREATED", "ORGANIZATION_CONFIGURED"])
      );
      await ctx.db.patch(onboarding._id, {
        organizationId,
        currentStep: "COMPLETED",
        status: "COMPLETED",
        completedSteps,
        updatedAt: now,
      });
      onboardingId = onboarding._id;
    } else {
      onboardingId = await ctx.db.insert("onboardingProgress", {
        userId: args.userId,
        organizationId,
        currentStep: "COMPLETED",
        status: "COMPLETED",
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
