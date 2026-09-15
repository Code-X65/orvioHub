import { query, mutation } from "./_generated/server.js";
import { Id } from "./_generated/dataModel.js";
import { v } from "convex/values";
import { ensureUserHasNoOtherFreeTrial, ensureUserCanCreateOrganization } from "./organizations.js";

export const MANDATORY_STEPS = [
  "EMAIL_VERIFICATION",
  "ORGANIZATION_CREATION",
  "MODULE_SELECTION",
  "WORKSPACE_INITIALIZATION",
] as const;

export const OPTIONAL_STEPS = ["TEAM_INVITATION"] as const;

export const getOnboardingStatus = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    let progress = await ctx.db
      .query("onboardingProgress")
      .withIndex("by_userId", (q: any) => q.eq("userId", args.userId))
      .first();

    if (!progress) {
      const now = Date.now();
      const initialStep = user.emailVerified
        ? ("ORGANIZATION_CREATION" as const)
        : ("EMAIL_VERIFICATION" as const);
      const completedSteps = ["ACCOUNT_CREATED"];
      if (user.emailVerified) completedSteps.push("EMAIL_VERIFIED");

      progress = {
        _id: "" as any,
        _creationTime: now,
        userId: args.userId,
        currentStep: initialStep,
        status: "IN_PROGRESS",
        completedSteps,
        startedAt: now,
        updatedAt: now,
      };
    }

    let organization = null;
    let membership = null;
    let settings = null;

    if (progress.organizationId) {
      organization = await ctx.db.get(progress.organizationId);
      membership = await ctx.db
        .query("organizationMemberships")
        .withIndex("by_org_and_user", (q: any) =>
          q.eq("organizationId", progress!.organizationId!).eq("userId", args.userId)
        )
        .first();
      settings = await ctx.db
        .query("organizationSettings")
        .withIndex("by_organizationId", (q) =>
          q.eq("organizationId", progress!.organizationId!)
        )
        .first();
    }

    // Determine if current step is skippable
    const canSkipCurrentStep = OPTIONAL_STEPS.includes(
      progress.currentStep as (typeof OPTIONAL_STEPS)[number]
    );

    return {
      status: progress.status,
      currentStep: progress.currentStep,
      completedSteps: progress.completedSteps,
      canSkipCurrentStep,
      organization: organization
        ? {
            id: organization._id,
            name: organization.name,
            slug: organization.slug,
            industry: organization.industry,
            country: organization.country,
            timezone: organization.timezone,
            website: organization.website,
            size: organization.size,
          }
        : null,
      membership: membership
        ? {
            role: membership.role,
            status: membership.status,
          }
        : null,
      workspace: settings
        ? {
            ready: settings.workspaceReady,
            enabledModules: settings.enabledModules,
          }
        : null,
    };
  },
});

export const skipStep = mutation({
  args: {
    userId: v.id("users"),
    step: v.string(),
  },
  handler: async (ctx, args) => {
    if (!OPTIONAL_STEPS.includes(args.step as (typeof OPTIONAL_STEPS)[number])) {
      throw new Error("STEP_NOT_SKIPPABLE");
    }

    const progress = await ctx.db
      .query("onboardingProgress")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (!progress) {
      throw new Error("ONBOARDING_NOT_FOUND");
    }

    const now = Date.now();
    const completedSteps = Array.from(
      new Set([...progress.completedSteps, `${args.step}_SKIPPED`])
    );

    // If skipping TEAM_INVITATION, current step advances to COMPLETED
    await ctx.db.patch(progress._id, {
      currentStep: "COMPLETED",
      completedSteps,
      updatedAt: now,
    });

    return {
      currentStep: "COMPLETED",
      completedSteps,
    };
  },
});

export const completeOnboarding = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    if (!user.emailVerified) {
      throw new Error("EMAIL_NOT_VERIFIED");
    }

    const progress = await ctx.db
      .query("onboardingProgress")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (!progress || !progress.organizationId) {
      throw new Error("ONBOARDING_INCOMPLETE");
    }

    // Check organization and settings
    const org = await ctx.db.get(progress.organizationId);
    if (!org) {
      throw new Error("ORGANIZATION_NOT_FOUND");
    }

    const membership = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_org_and_user", (q: any) =>
        q.eq("organizationId", org._id).eq("userId", args.userId)
      )
      .first();

    const roleUpper = String(membership?.role || '').toUpperCase();
    if (!membership || (roleUpper !== "OWNER" && roleUpper !== "ADMIN")) {
      throw new Error("ORGANIZATION_ACCESS_DENIED");
    }

    let settings = await ctx.db
      .query("organizationSettings")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", org._id))
      .first();

    const now = Date.now();

    if (!settings) {
      const settingsId = await ctx.db.insert("organizationSettings", {
        organizationId: org._id,
        enabledModules: ["inventory"],
        workspaceReady: true,
        workspaceInitializedAt: now,
        updatedAt: now,
      });
      settings = await ctx.db.get(settingsId);
    } else {
      const updates: Record<string, any> = {};
      if (settings.enabledModules.length === 0) {
        updates.enabledModules = ["inventory"];
      }
      if (!settings.workspaceReady) {
        updates.workspaceReady = true;
        updates.workspaceInitializedAt = now;
      }
      if (Object.keys(updates).length > 0) {
        updates.updatedAt = now;
        await ctx.db.patch(settings._id, updates);
      }
    }

    const completedSteps = Array.from(
      new Set([...progress.completedSteps, "COMPLETED"])
    );

    await ctx.db.patch(progress._id, {
      currentStep: "COMPLETED",
      status: "COMPLETED",
      completedSteps,
      completedAt: now,
      updatedAt: now,
    });

    // Audit log
    await ctx.db.insert("auditLogs", {
      actorId: args.userId,
      organizationId: org._id,
      action: "onboarding.completed",
      resource: `onboarding:${progress._id}`,
      metadata: { completedAt: now },
      timestamp: now,
    });

    return {
      status: "COMPLETED",
      currentStep: "COMPLETED",
      completedAt: now,
      organization: {
        id: org._id,
        name: org.name,
        slug: org.slug,
      },
    };
  },
});

export const skipOnboardingPermanently = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("USER_NOT_FOUND");

    let progress = await ctx.db
      .query("onboardingProgress")
      .withIndex("by_userId", (q: any) => q.eq("userId", args.userId))
      .first();

    const now = Date.now();
    if (progress) {
      await ctx.db.patch(progress._id, {
        status: "COMPLETED",
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("onboardingProgress", {
        userId: args.userId,
        status: "COMPLETED",
        currentStep: "COMPLETED",
        completedSteps: ["SKIPPED_PERMANENTLY"],
        startedAt: now,
        updatedAt: now,
      });
    }

    const flows = await ctx.db
      .query("onboardingFlows")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    for (const f of flows) {
      await ctx.db.patch(f._id, {
        status: "completed",
        currentStep: "completed",
        completedAt: now,
        lastUpdatedAt: now,
      });
    }

    return { success: true, status: "COMPLETED" };
  },
});

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function getOrCreateInventoryApp(ctx: any) {
  const existing = await ctx.db
    .query("applications")
    .withIndex("by_key", (q: any) => q.eq("key", "inventory"))
    .first();
  if (existing) return existing;

  const now = Date.now();
  const appId = await ctx.db.insert("applications", {
    key: "inventory",
    name: "Inventory",
    enabled: true,
    createdAt: now,
    updatedAt: now,
  });
  return await ctx.db.get(appId);
}

export const seedApplications = mutation({
  args: {},
  handler: async (ctx) => {
    return await getOrCreateInventoryApp(ctx);
  },
});

/**
 * US-1: Create a business (organization) with context
 * Creates organization, owner membership, Inventory orgApplication,
 * optional organizationProfile, default subscription, and default branch if single location.
 */
export const createOrganizationWithOnboarding = mutation({
  args: {
    userId: v.id("users"),
    // Required core fields (US-1)
    name: v.string(),
    phone: v.string(),
    category: v.string(), // Provision Store, Boutique, Electronics, Cosmetics, Pharmacy, Restaurant, Other
    currency: v.optional(v.string()), // default "NGN"
    street: v.optional(v.string()),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    country: v.optional(v.string()), // default "Nigeria"
    address: v.optional(v.string()),
    industry: v.optional(v.string()),
    timezone: v.optional(v.string()),
    website: v.optional(v.string()),
    // Optional context questions (US-1)
    businessType: v.optional(v.string()), // retail, wholesale, service, manufacturing, pharmacy/health, food & beverage, other
    branchCountRange: v.optional(v.string()), // "1", "2-5", "6-20", "20+"
    productCountRange: v.optional(v.string()), // "1-50", "51-200", "201-1,000", "1,000+"
    primaryUsers: v.optional(v.array(v.string())), // owner, manager, sales attendants, stock/store keepers, accountant/bookkeeper, other
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("USER_NOT_FOUND");

    // Enforce Rule 1: Max 3 owned organizations per user
    await ensureUserCanCreateOrganization(ctx, args.userId);

    // Enforce Rule 2: One free trial organization per user
    await ensureUserHasNoOtherFreeTrial(ctx, args.userId);

    const now = Date.now();
    const currency = args.currency || "NGN";
    const country = args.country || "Nigeria";
    const timezone = args.timezone || "Africa/Lagos";
    const fullAddress =
      args.address ||
      [args.street, args.city, args.state, country].filter(Boolean).join(", ");

    // Generate unique slug
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

    // 1. Create organizations record
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
      createdAt: now,
      updatedAt: now,
    });

    // 2. Create organizationMemberships record with role "OWNER"
    await ctx.db.insert("organizationMemberships", {
      organizationId,
      userId: args.userId,
      role: "OWNER",
      status: "ACTIVE",
      joinedAt: now,
      updatedAt: now,
    });

    // 3. Create organizationProfiles record if optional questions were answered
    let profileId = null;
    const hasProfileAnswers =
      args.businessType ||
      args.branchCountRange ||
      args.productCountRange ||
      (args.primaryUsers && args.primaryUsers.length > 0);

    if (hasProfileAnswers) {
      profileId = await ctx.db.insert("organizationProfiles", {
        organizationId,
        businessType: args.businessType,
        branchCountRange: args.branchCountRange,
        productCountRange: args.productCountRange,
        primaryUsers: args.primaryUsers,
        completedAt: now,
      });
    }

    // 4. Create base workspace for operational backward-compatibility
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
      planId: "free_trial",
      isDefault: true,
      enabledModules: [],
      settings: {
        phone: args.phone,
        category: args.category,
        address: fullAddress,
      },
      createdAt: now,
      updatedAt: now,
    });

    // Create 30-day Free Trial subscription (Rule 1)
    const trialDays = 30;
    const trialEnd = now + trialDays * 86_400_000;
    await ctx.db.insert("subscriptions", {
      organizationId,
      workspaceId,
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
      currency,
      cancelAtPeriodEnd: false,
      createdAt: now,
      updatedAt: now,
    });

    // Create workspace membership
    await ctx.db.insert("workspaceMemberships", {
      workspaceId,
      userId: args.userId,
      role: "owner",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    // Update user onboarding progress
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

    return {
      organizationId,
      workspaceId,
      branchId: null,
      slug,
      name: args.name.trim(),
      hasDefaultBranch: false,
    };
  },
});

/**
 * Helper to resolve an organization whether passed an organizationId or workspaceId
 */
async function resolveOrganization(
  ctx: { db: any },
  rawId: string
): Promise<{
  org: any;
  orgId: Id<"organizations"> | null;
  workspace?: any;
  workspaceId?: Id<"workspaces"> | null;
}> {
  // 1. Check if rawId is a direct organizations ID
  const directOrgId = ctx.db.normalizeId("organizations", rawId);
  if (directOrgId) {
    const org = await ctx.db.get(directOrgId);
    if (org) {
      let ws = await ctx.db
        .query("workspaces")
        .withIndex("by_organizationId", (q: any) => q.eq("organizationId", directOrgId))
        .first();
      if (!ws && org.ownerId) {
        ws = await ctx.db
          .query("workspaces")
          .withIndex("by_owner", (q: any) => q.eq("ownerId", org.ownerId))
          .first();
      }
      return { org, orgId: directOrgId, workspace: ws || null, workspaceId: ws?._id || null };
    }
  }

  // 2. Check if rawId is a workspaces ID
  const wsId = ctx.db.normalizeId("workspaces", rawId);
  if (wsId) {
    const ws = await ctx.db.get(wsId);
    if (ws) {
      if (ws.organizationId) {
        const org = await ctx.db.get(ws.organizationId);
        if (org) {
          return { org, orgId: ws.organizationId, workspace: ws, workspaceId: ws._id };
        }
      }
      // If workspace has no organizationId linked, look for an org with matching owner or slug
      if (ws.ownerId) {
        const org = await ctx.db
          .query("organizations")
          .withIndex("by_ownerId", (q: any) => q.eq("ownerId", ws.ownerId))
          .first();
        if (org) {
          return { org, orgId: org._id, workspace: ws, workspaceId: ws._id };
        }
      }
      if (ws.slug) {
        const org = await ctx.db
          .query("organizations")
          .withIndex("by_slug", (q: any) => q.eq("slug", ws.slug))
          .first();
        if (org) {
          return { org, orgId: org._id, workspace: ws, workspaceId: ws._id };
        }
      }
      return { org: null, orgId: null, workspace: ws, workspaceId: ws._id };
    }
  }

  return { org: null, orgId: null, workspace: null, workspaceId: null };
}

/**
 * US-2: Save first-time Inventory setup answers
 */
export const saveInventoryOnboarding = mutation({
  args: {
    organizationId: v.union(v.id("organizations"), v.id("workspaces"), v.string()),
    userId: v.optional(v.id("users")),
    previousTools: v.optional(v.array(v.string())),
    painPoints: v.optional(v.array(v.string())),
    priorityFeatures: v.optional(v.array(v.string())),
    needsMultiBranch: v.optional(v.boolean()),
    teamComfortLevel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let { org, orgId, workspace } = await resolveOrganization(ctx, args.organizationId);

    // If workspace was provided but has no linked organization, create/link one now
    if (!org && workspace) {
      const now = Date.now();
      const newOrgId = await ctx.db.insert("organizations", {
        name: workspace.name || "My Business",
        slug: workspace.slug || `org-${Date.now()}`,
        industry: workspace.type || "business",
        country: workspace.country || "Nigeria",
        timezone: workspace.timezone || "Africa/Lagos",
        currency: workspace.currency || "NGN",
        ownerId: workspace.ownerId,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.patch(workspace._id, { organizationId: newOrgId });
      if (workspace.ownerId) {
        await ctx.db.insert("organizationMemberships", {
          organizationId: newOrgId,
          userId: workspace.ownerId,
          role: "OWNER",
          status: "ACTIVE",
          joinedAt: now,
          updatedAt: now,
        });
      }
      orgId = newOrgId;
      org = await ctx.db.get(newOrgId);
    }

    if (!org || !orgId) throw new Error("ORGANIZATION_NOT_FOUND");
    const resolvedOrgId = orgId;

    if (args.userId) {
      const membership = await ctx.db
        .query("organizationMemberships")
        .withIndex("by_org_and_user", (q: any) =>
          q.eq("organizationId", resolvedOrgId).eq("userId", args.userId)
        )
        .first();

      let hasAccess = !!membership;
      if (!hasAccess && workspace) {
        const wsMembership = await ctx.db
          .query("workspaceMemberships")
          .withIndex("by_workspace_user", (q: any) =>
            q.eq("workspaceId", workspace._id).eq("userId", args.userId)
          )
          .first();
        if (wsMembership) hasAccess = true;
      }

      if (!hasAccess) {
        throw new Error("NOT_AN_ORGANIZATION_MEMBER");
      }
    }

    const inventoryApp = await getOrCreateInventoryApp(ctx);
    const now = Date.now();

    // Upsert into applicationOnboardingResponses
    const existing = await ctx.db
      .query("applicationOnboardingResponses")
      .withIndex("by_org_and_app", (q: any) =>
        q.eq("organizationId", resolvedOrgId).eq("applicationId", inventoryApp._id)
      )
      .first();

    let responseId;
    if (existing) {
      await ctx.db.patch(existing._id, {
        previousTools: args.previousTools,
        painPoints: args.painPoints,
        priorityFeatures: args.priorityFeatures,
        needsMultiBranch: args.needsMultiBranch,
        teamComfortLevel: args.teamComfortLevel,
        completedAt: now,
      });
      responseId = existing._id;
    } else {
      responseId = await ctx.db.insert("applicationOnboardingResponses", {
        organizationId: resolvedOrgId,
        applicationId: inventoryApp._id,
        previousTools: args.previousTools,
        painPoints: args.painPoints,
        priorityFeatures: args.priorityFeatures,
        needsMultiBranch: args.needsMultiBranch,
        teamComfortLevel: args.teamComfortLevel,
        completedAt: now,
      });
    }

    // Ensure orgApplications record exists and is enabled
    const existingOrgApp = await ctx.db
      .query("orgApplications")
      .withIndex("by_org_and_app", (q: any) =>
        q.eq("organizationId", resolvedOrgId).eq("applicationId", inventoryApp._id)
      )
      .first();

    if (!existingOrgApp) {
      await ctx.db.insert("orgApplications", {
        organizationId: resolvedOrgId,
        applicationId: inventoryApp._id,
        enabled: true,
        config: { onboardingCompleted: true },
        createdAt: now,
        updatedAt: now,
      });
    } else {
      await ctx.db.patch(existingOrgApp._id, {
        enabled: true,
        config: { ...(existingOrgApp.config || {}), onboardingCompleted: true },
        updatedAt: now,
      });
    }

    // Default branch logic: If user indicated needsMultiBranch === false, ensure at least one branch exists
    if (args.needsMultiBranch === false) {
      const existingBranches = await ctx.db
        .query("branches")
        .withIndex("by_organizationId", (q: any) =>
          q.eq("organizationId", resolvedOrgId)
        )
        .collect();

      const activeBranches = existingBranches.filter(
        (b) => b.status !== "deleted" && b.status !== "archived"
      );

      if (activeBranches.length === 0) {
        const ws = workspace || await ctx.db
          .query("workspaces")
          .withIndex("by_organizationId", (q: any) =>
            q.eq("organizationId", resolvedOrgId)
          )
          .first();

        await ctx.db.insert("branches", {
          organizationId: resolvedOrgId,
          applicationId: inventoryApp._id,
          workspaceId: ws?._id,
          productKey: "inventory",
          name: "Main Branch",
          code: "MAIN",
          isPrimary: true,
          isActive: true,
          status: "active",
          country: org.country || "Nigeria",
          address: org.address,
          phone: org.phone,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    return {
      success: true,
      responseId,
      organizationId: resolvedOrgId,
      applicationId: inventoryApp._id,
    };
  },
});

/**
 * Query: Check if inventory onboarding has been completed for an org
 */
export const getInventoryOnboardingStatus = query({
  args: { organizationId: v.union(v.id("organizations"), v.id("workspaces"), v.string()) },
  handler: async (ctx, args) => {
    const { org, orgId } = await resolveOrganization(ctx, args.organizationId);
    if (!org || !orgId) return { completed: false, responses: null, organization: null, inventoryApp: null };

    const inventoryApp = await ctx.db
      .query("applications")
      .withIndex("by_key", (q: any) => q.eq("key", "inventory"))
      .first();

    if (!inventoryApp) {
      return { completed: false, responses: null, organization: org, inventoryApp: null };
    }

    const responses = await ctx.db
      .query("applicationOnboardingResponses")
      .withIndex("by_org_and_app", (q: any) =>
        q.eq("organizationId", orgId).eq("applicationId", inventoryApp._id)
      )
      .first();

    return {
      completed: !!responses,
      responses,
      organization: org,
      inventoryApp,
    };
  },
});

/**
 * Query: Get organization profile (context questions)
 */
export const getOrganizationProfile = query({
  args: { organizationId: v.union(v.id("organizations"), v.id("workspaces"), v.string()) },
  handler: async (ctx, args) => {
    const { orgId } = await resolveOrganization(ctx, args.organizationId);
    if (!orgId) return null;
    return await ctx.db
      .query("organizationProfiles")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", orgId))
      .first();
  },
});

/**
 * Query: Get application onboarding responses for an organization
 */
export const getApplicationOnboardingResponses = query({
  args: {
    organizationId: v.union(v.id("organizations"), v.id("workspaces"), v.string()),
    applicationKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { orgId } = await resolveOrganization(ctx, args.organizationId);
    if (!orgId) return null;
    const appKey = args.applicationKey || "inventory";
    const app = await ctx.db
      .query("applications")
      .withIndex("by_key", (q: any) => q.eq("key", appKey))
      .first();

    if (!app) return null;

    return await ctx.db
      .query("applicationOnboardingResponses")
      .withIndex("by_org_and_app", (q: any) =>
        q.eq("organizationId", orgId).eq("applicationId", app._id)
      )
      .first();
  },
});

/**
 * Query: Get all organizations for current user with profile, branch count, and app status
 */
export const getMyOrganizations = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const memberships = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    const inventoryApp = await ctx.db
      .query("applications")
      .withIndex("by_key", (q: any) => q.eq("key", "inventory"))
      .first();

    const results = [];
    for (const m of memberships) {
      const org = await ctx.db.get(m.organizationId);
      if (!org) continue;

      const profile = await ctx.db
        .query("organizationProfiles")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", org._id))
        .first();

      let inventoryCompleted = false;
      let inventoryActive = false;
      if (inventoryApp) {
        const appResponse = await ctx.db
          .query("applicationOnboardingResponses")
          .withIndex("by_org_and_app", (q: any) =>
            q.eq("organizationId", org._id).eq("applicationId", inventoryApp._id)
          )
          .first();
        inventoryCompleted = !!appResponse;

        const invOrgApp = await ctx.db
          .query("orgApplications")
          .withIndex("by_org_and_app", (q: any) =>
            q.eq("organizationId", org._id).eq("applicationId", inventoryApp._id)
          )
          .first();
        if (invOrgApp && invOrgApp.enabled) {
          inventoryActive =
            invOrgApp.status === "active" ||
            invOrgApp.status === "trial" ||
            !invOrgApp.status;
        }
      }

      // Check all org applications
      const orgApps = await ctx.db
        .query("orgApplications")
        .withIndex("by_organizationId", (q: any) => q.eq("organizationId", org._id))
        .collect();
      const activeApps = orgApps.filter(
        (a) => a.enabled && a.status !== "inactive" && a.status !== "suspended"
      );

      // Count branches for this org
      const branches = await ctx.db
        .query("branches")
        .withIndex("by_organizationId", (q: any) => q.eq("organizationId", org._id))
        .collect();

      const activeBranches = branches.filter(
        (b) => b.status !== "deleted" && b.status !== "archived"
      );

      // Subscription
      const sub = await ctx.db
        .query("subscriptions")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", org._id))
        .first();

      results.push({
        organization: org,
        membership: m,
        profile,
        inventoryActive,
        hasActiveApps: activeApps.length > 0,
        activeAppsCount: activeApps.length,
        inventoryOnboardingCompleted: inventoryCompleted,
        branchCount: activeBranches.length,
        subscription: sub
          ? {
              planKey:
                sub.activePlan ||
                (sub.status === "active" ? (sub.selectedPlan || sub.planKey) : null) ||
                sub.planKey ||
                "free_trial",
              activePlan:
                sub.activePlan ||
                (sub.status === "active" ? (sub.selectedPlan || sub.planKey) : null),
              selectedPlan: sub.selectedPlan,
              status: sub.status,
              trialEndsAt: sub.trialEndsAt,
              currentPeriodEnd: sub.currentPeriodEnd,
            }
          : null,
      });
    }

    return results;
  },
});

/**
 * Query: Get raw org application documents for an organization
 */
export const getOrgApplicationsRaw = query({
  args: {
    organizationId: v.union(v.id("organizations"), v.id("workspaces"), v.string()),
  },
  handler: async (ctx, args) => {
    const { orgId } = await resolveOrganization(ctx, args.organizationId);
    if (!orgId) return [];

    const orgApps = await ctx.db
      .query("orgApplications")
      .withIndex("by_organizationId", (q: any) => q.eq("organizationId", orgId))
      .collect();

    const results = [];
    for (const oa of orgApps) {
      const app = await ctx.db.get(oa.applicationId);
      results.push({
        ...oa,
        app: app || null,
      });
    }
    return results;
  },
});

/**
 * Query: Check if an application is active for an organization (US-A4)
 */
export const isApplicationActiveForOrg = query({
  args: {
    organizationId: v.union(v.id("organizations"), v.id("workspaces"), v.string()),
    applicationKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { orgId } = await resolveOrganization(ctx, args.organizationId);
    if (!orgId) return { active: false, status: null, orgApp: null, app: null };

    const key = args.applicationKey || "inventory";
    const app = await ctx.db
      .query("applications")
      .withIndex("by_key", (q: any) => q.eq("key", key))
      .first();

    if (!app) {
      return { active: false, status: null, orgApp: null, app: null };
    }

    const orgApp = await ctx.db
      .query("orgApplications")
      .withIndex("by_org_and_app", (q: any) =>
        q.eq("organizationId", orgId).eq("applicationId", app._id)
      )
      .first();

    if (!orgApp || !orgApp.enabled) {
      return { active: false, status: "inactive", orgApp: null, app };
    }

    const isActive =
      orgApp.status === "active" || orgApp.status === "trial" || !orgApp.status;

    return {
      active: isActive,
      status: orgApp.status || (isActive ? "trial" : "inactive"),
      planId: orgApp.planId || "free_trial",
      orgApp,
      app,
    };
  },
});

/**
 * Query: Check if an application is enabled for an organization
 */
export const getOrgApplicationStatus = query({
  args: {
    organizationId: v.union(v.id("organizations"), v.id("workspaces"), v.string()),
    applicationKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { orgId } = await resolveOrganization(ctx, args.organizationId);
    if (!orgId) return { enabled: false, active: false, app: null, orgApp: null };

    const key = args.applicationKey || "inventory";
    const app = await ctx.db
      .query("applications")
      .withIndex("by_key", (q: any) => q.eq("key", key))
      .first();

    if (!app) {
      return { enabled: false, active: false, app: null, orgApp: null };
    }

    const orgApp = await ctx.db
      .query("orgApplications")
      .withIndex("by_org_and_app", (q: any) =>
        q.eq("organizationId", orgId).eq("applicationId", app._id)
      )
      .first();

    const isEnabled = orgApp ? orgApp.enabled : false;
    const isActive =
      isEnabled &&
      (orgApp?.status === "active" || orgApp?.status === "trial" || !orgApp?.status);

    return {
      enabled: isEnabled,
      active: isActive,
      app,
      orgApp,
    };
  },
});

/**
 * Mutation: Explicitly activate an application for an organization (US-A2)
 */
export const activateApplication = mutation({
  args: {
    organizationId: v.union(v.id("organizations"), v.id("workspaces"), v.string()),
    applicationKey: v.string(), // e.g. "inventory"
    planKey: v.string(), // "free_trial" | "standard"
    billingCycle: v.optional(v.string()), // "monthly" | "annual"
    paymentReference: v.optional(v.string()),
    paymentGateway: v.optional(v.string()),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const { org, orgId, workspace } = await resolveOrganization(ctx, args.organizationId);
    if (!org || !orgId) {
      throw new Error("ORGANIZATION_NOT_FOUND");
    }

    // Validate caller permissions if userId provided
    if (args.userId) {
      const membership = await ctx.db
        .query("organizationMemberships")
        .withIndex("by_org_and_user", (q: any) =>
          q.eq("organizationId", orgId).eq("userId", args.userId!)
        )
        .first();

      if (!membership || membership.status !== "ACTIVE") {
        throw new Error("ORGANIZATION_ACCESS_DENIED");
      }

      const allowedRoles = ["OWNER", "ADMIN", "MANAGER"];
      if (!allowedRoles.includes(membership.role)) {
        throw new Error("INSUFFICIENT_PERMISSIONS");
      }
    }

    const now = Date.now();
    const planKey = args.planKey === "standard" ? "standard" : "free_trial";
    const interval = args.billingCycle === "annual" ? "annual" : "monthly";
    const isPaid = planKey === "standard";

    // Resolve or create application
    let app = await ctx.db
      .query("applications")
      .withIndex("by_key", (q: any) => q.eq("key", args.applicationKey))
      .first();

    if (!app) {
      const appId = await ctx.db.insert("applications", {
        key: args.applicationKey,
        name: args.applicationKey.charAt(0).toUpperCase() + args.applicationKey.slice(1),
        enabled: true,
        createdAt: now,
        updatedAt: now,
      });
      app = await ctx.db.get(appId);
    }

    // Determine existing subscription / plan
    const orgSub = await ctx.db
      .query("subscriptions")
      .withIndex("by_organizationId", (q: any) => q.eq("organizationId", orgId))
      .first();

    const currentPlanKey = (orgSub?.planKey || planKey).toLowerCase();
    const isFreeTrialOrg = (currentPlanKey === "free_trial" || currentPlanKey === "free") && !isPaid;

    // Enforce Rule 3: Limit applications on Free Trial orgs
    if (isFreeTrialOrg) {
      const existingOrgApps = await ctx.db
        .query("orgApplications")
        .withIndex("by_organizationId", (q: any) => q.eq("organizationId", orgId))
        .collect();

      const activeOtherApps = existingOrgApps.filter(
        (a: any) =>
          a.applicationId !== app!._id &&
          a.enabled &&
          (a.status === "active" || a.status === "trial" || a.status === "trialing")
      );

      if (activeOtherApps.length >= 1) {
        throw new Error(
          "Free Trial organizations can only activate 1 application. Upgrade to Standard to activate more applications."
        );
      }
    }

    // Determine trial and period dates (Rule 1: 30 days)
    const trialDays = 30;
    const trialEnd = now + trialDays * 86_400_000;
    const periodEnd = isPaid
      ? now + (interval === "annual" ? 365 : 30) * 86_400_000
      : trialEnd;

    // Upsert orgApplications
    const existingOrgApp = await ctx.db
      .query("orgApplications")
      .withIndex("by_org_and_app", (q: any) =>
        q.eq("organizationId", orgId).eq("applicationId", app!._id)
      )
      .first();

    let orgApplicationId;
    const appStatus = isPaid ? "active" : "trial";

    if (existingOrgApp) {
      orgApplicationId = existingOrgApp._id;
      await ctx.db.patch(existingOrgApp._id, {
        enabled: true,
        status: appStatus,
        planId: planKey,
        billingCycle: interval,
        trialStartsAt: isPaid ? existingOrgApp.trialStartsAt : now,
        trialEndsAt: isPaid ? existingOrgApp.trialEndsAt : trialEnd,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        paymentReference: args.paymentReference || existingOrgApp.paymentReference,
        paymentGateway: args.paymentGateway || existingOrgApp.paymentGateway,
        activatedAt: now,
        activatedBy: args.userId,
        updatedAt: now,
      });
    } else {
      orgApplicationId = await ctx.db.insert("orgApplications", {
        organizationId: orgId,
        applicationId: app!._id,
        enabled: true,
        status: appStatus,
        planId: planKey,
        billingCycle: interval,
        trialStartsAt: isPaid ? undefined : now,
        trialEndsAt: isPaid ? undefined : trialEnd,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        paymentReference: args.paymentReference,
        paymentGateway: args.paymentGateway,
        activatedAt: now,
        activatedBy: args.userId,
        config: { initialSetup: true },
        createdAt: now,
        updatedAt: now,
      });
    }

    // Sync workspace and subscription for operational compatibility
    if (workspace) {
      const existingWsProd = await ctx.db
        .query("workspaceProducts")
        .withIndex("by_workspace_product", (q: any) =>
          q.eq("workspaceId", workspace._id).eq("productKey", args.applicationKey)
        )
        .first();

      if (existingWsProd) {
        await ctx.db.patch(existingWsProd._id, {
          status: "active",
          planId: planKey,
        });
      } else {
        await ctx.db.insert("workspaceProducts", {
          workspaceId: workspace._id,
          productKey: args.applicationKey,
          status: "active",
          planId: planKey,
          activatedBy: args.userId || org.ownerId,
          activatedAt: now,
        });
      }

      // Upsert subscription
      const existingSub = await ctx.db
        .query("subscriptions")
        .withIndex("by_organizationId", (q: any) => q.eq("organizationId", orgId))
        .first();

      if (existingSub) {
        await ctx.db.patch(existingSub._id, {
          planKey,
          status: isPaid ? "active" : "trial",
          billingInterval: interval,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          trialEndsAt: isPaid ? undefined : trialEnd,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("subscriptions", {
          organizationId: orgId,
          workspaceId: workspace._id,
          planKey,
          status: isPaid ? "active" : "trial",
          billingInterval: interval,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          trialStart: isPaid ? undefined : now,
          trialEnd: isPaid ? undefined : trialEnd,
          trialEndsAt: isPaid ? undefined : trialEnd,
          paymentMethod: (args.paymentGateway as any) || "paystack",
          amount: isPaid ? (interval === "annual" ? 75000 : 7500) : 0,
          currency: org.currency || "NGN",
          cancelAtPeriodEnd: false,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    return {
      success: true,
      orgApplicationId,
      applicationId: app!._id,
      applicationKey: args.applicationKey,
      status: appStatus,
      planId: planKey,
      trialEndsAt: isPaid ? null : trialEnd,
    };
  },
});

/**
 * Query: Resolve current organization, application (Inventory), and default/selected branch for UI (US-5)
 */
export const getCurrentOrgAppContext = query({
  args: {
    organizationId: v.union(v.id("organizations"), v.id("workspaces"), v.string()),
    applicationKey: v.optional(v.string()),
    branchId: v.optional(v.union(v.id("branches"), v.string())),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const { org, orgId, workspace } = await resolveOrganization(ctx, args.organizationId);
    if (!org || !orgId) {
      return null;
    }

    const appKey = args.applicationKey || "inventory";
    const app = await ctx.db
      .query("applications")
      .withIndex("by_key", (q: any) => q.eq("key", appKey))
      .first();

    // Check application enablement & active status
    let isAppEnabled = false;
    let appStatus: string | null = null;
    if (app) {
      const orgApp = await ctx.db
        .query("orgApplications")
        .withIndex("by_org_and_app", (q: any) =>
          q.eq("organizationId", orgId).eq("applicationId", app._id)
        )
        .first();
      isAppEnabled = orgApp?.enabled ?? false;
      appStatus = orgApp?.status ?? (isAppEnabled ? "active" : "inactive");
    }

    // Check membership
    let membership = null;
    if (args.userId) {
      membership = await ctx.db
        .query("organizationMemberships")
        .withIndex("by_org_and_user", (q: any) =>
          q.eq("organizationId", orgId).eq("userId", args.userId!)
        )
        .first();
    }

    // Fetch branches for this org
    const branches = await ctx.db
      .query("branches")
      .withIndex("by_organizationId", (q: any) => q.eq("organizationId", orgId))
      .collect();

    const activeBranches = branches.filter(
      (b) => b.status !== "deleted" && b.status !== "archived" && b.isActive !== false
    );

    // Fetch onboarding responses
    let onboardingResponses = null;
    if (app) {
      onboardingResponses = await ctx.db
        .query("applicationOnboardingResponses")
        .withIndex("by_org_and_app", (q: any) =>
          q.eq("organizationId", orgId).eq("applicationId", app._id)
        )
        .first();
    }

    activeBranches.sort((a, b) => {
      if (a.isPrimary && !b.isPrimary) return -1;
      if (!a.isPrimary && b.isPrimary) return 1;
      return a.name.localeCompare(b.name);
    });

    // Determine current branch
    let currentBranch = null;
    if (args.branchId) {
      const bId = ctx.db.normalizeId("branches", args.branchId);
      if (bId) {
        currentBranch = activeBranches.find((b) => b._id === bId) || null;
      }
    }
    if (!currentBranch && activeBranches.length > 0) {
      currentBranch = activeBranches.find((b) => b.isPrimary) || activeBranches[0];
    }

    return {
      organization: org,
      workspace: workspace || null,
      application: app ? { ...app, isEnabled: isAppEnabled, status: appStatus } : null,
      membership,
      branches: activeBranches,
      currentBranch,
      onboardingCompleted: !!onboardingResponses,
      onboardingResponses,
    };
  },
});

/**
 * Query: List all applications and their activation status for an org (US-A4)
 */
export const getOrganizationApps = query({
  args: {
    organizationId: v.union(v.id("organizations"), v.id("workspaces"), v.string()),
  },
  handler: async (ctx, args) => {
    const { org, orgId } = await resolveOrganization(ctx, args.organizationId);
    if (!org || !orgId) return [];

    // Get all available applications
    const allApps = await ctx.db.query("applications").collect();

    // Get all orgApplications for this org
    const orgApps = await ctx.db
      .query("orgApplications")
      .withIndex("by_organizationId", (q: any) => q.eq("organizationId", orgId))
      .collect();

    const orgAppMap = new Map(orgApps.map((oa: any) => [oa.applicationId, oa]));

    return allApps
      .filter((app) => app.enabled)
      .map((app) => {
        const orgApp = orgAppMap.get(app._id);
        const key = app.key || "inventory";
        const defaultNames: Record<string, string> = {
          inventory: "Inventory",
          pos: "POS",
          booking: "Booking",
          gym: "Gym Management",
          taskmanagement: "Task Management",
        };
        const name = app.name || defaultNames[key] || (key.charAt(0).toUpperCase() + key.slice(1));

        return {
          applicationId: app._id,
          key,
          name,
          isActivated: !!orgApp?.enabled,
          status: orgApp?.status || "inactive",
          planId: orgApp?.planId,
          billingCycle: orgApp?.billingCycle,
          trialEndsAt: orgApp?.trialEndsAt,
          activatedAt: orgApp?.activatedAt,
        };
      });
  },
});


