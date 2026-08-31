import { query, mutation } from "./_generated/server.js";
import { v } from "convex/values";

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

    if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
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
