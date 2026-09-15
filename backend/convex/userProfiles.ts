import { query, mutation } from "./_generated/server.js";
import { v } from "convex/values";

/**
 * Query personal onboarding profile and progress for a user
 */
export const getPersonalOnboardingProfile = query({
  args: { userId: v.union(v.id("users"), v.string()) },
  handler: async (ctx, args) => {
    let user: any = null;
    try {
      user = await ctx.db.get(args.userId as any);
    } catch {}
    if (!user) {
      user = await ctx.db.query("users").filter((q) => q.eq(q.field("_id"), args.userId as any)).first();
    }

    const resolvedUserId = user ? user._id : (args.userId as any);
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", resolvedUserId))
      .first();

    const personalOnboardingCompleted = Boolean(
      profile?.personalOnboardingCompleted ?? user?.personalOnboardingCompleted ?? false
    );

    return {
      personalOnboardingCompleted,
      currentStep: profile?.currentStep || 1,
      profile: profile || null,
    };
  },
});

/**
 * Save in-progress draft step and answers (Real-time continuity)
 */
export const savePersonalOnboardingProgress = mutation({
  args: {
    userId: v.union(v.id("users"), v.string()),
    currentStep: v.number(),
    useCases: v.optional(v.array(v.string())),
    acquisitionSource: v.optional(v.string()),
    acquisitionSourceOther: v.optional(v.string()),
    role: v.optional(v.string()),
    managesBusiness: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let user: any = null;
    try {
      user = await ctx.db.get(args.userId as any);
    } catch {}
    if (!user) {
      user = await ctx.db.query("users").filter((q) => q.eq(q.field("_id"), args.userId as any)).first();
    }
    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    // If onboarding is already completed, do not allow editing
    if (user.personalOnboardingCompleted) {
      return {
        personalOnboardingCompleted: true,
        alreadyCompleted: true,
      };
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();

    if (existing) {
      if (existing.personalOnboardingCompleted) {
        return {
          personalOnboardingCompleted: true,
          alreadyCompleted: true,
        };
      }
      await ctx.db.patch(existing._id, {
        currentStep: args.currentStep,
        ...(args.useCases !== undefined && { useCases: args.useCases }),
        ...(args.acquisitionSource !== undefined && { acquisitionSource: args.acquisitionSource }),
        ...(args.acquisitionSourceOther !== undefined && { acquisitionSourceOther: args.acquisitionSourceOther }),
        ...(args.role !== undefined && { role: args.role }),
        ...(args.managesBusiness !== undefined && { managesBusiness: args.managesBusiness }),
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("userProfiles", {
        userId: user._id,
        currentStep: args.currentStep,
        useCases: args.useCases,
        acquisitionSource: args.acquisitionSource,
        acquisitionSourceOther: args.acquisitionSourceOther,
        role: args.role,
        managesBusiness: args.managesBusiness,
        personalOnboardingCompleted: false,
        createdAt: now,
        updatedAt: now,
      });
    }

    return {
      success: true,
      currentStep: args.currentStep,
    };
  },
});

/**
 * Submit and finalize personal onboarding answers (One-time only)
 */
export const savePersonalOnboarding = mutation({
  args: {
    userId: v.union(v.id("users"), v.string()),
    useCases: v.array(v.string()),
    acquisitionSource: v.string(),
    acquisitionSourceOther: v.optional(v.string()),
    role: v.optional(v.string()),
    managesBusiness: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let user: any = null;
    try {
      user = await ctx.db.get(args.userId as any);
    } catch {}
    if (!user) {
      user = await ctx.db.query("users").filter((q) => q.eq(q.field("_id"), args.userId as any)).first();
    }
    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    const now = Date.now();

    // Check if profile record already exists
    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();

    // Security Lock: If already marked as completed, do not allow modifying answers
    if (existing?.personalOnboardingCompleted || user.personalOnboardingCompleted) {
      return {
        personalOnboardingCompleted: true,
        alreadyCompleted: true,
        profile: existing,
      };
    }

    let profileId;
    if (existing) {
      await ctx.db.patch(existing._id, {
        useCases: args.useCases,
        acquisitionSource: args.acquisitionSource,
        acquisitionSourceOther: args.acquisitionSourceOther,
        role: args.role,
        managesBusiness: args.managesBusiness,
        currentStep: 4,
        personalOnboardingCompleted: true,
        completedAt: now,
        updatedAt: now,
      });
      profileId = existing._id;
    } else {
      profileId = await ctx.db.insert("userProfiles", {
        userId: user._id,
        useCases: args.useCases,
        acquisitionSource: args.acquisitionSource,
        acquisitionSourceOther: args.acquisitionSourceOther,
        role: args.role,
        managesBusiness: args.managesBusiness,
        currentStep: 4,
        personalOnboardingCompleted: true,
        completedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Mark on user record for instant lookup
    await ctx.db.patch(user._id, {
      personalOnboardingCompleted: true,
      updatedAt: now,
    });

    const updatedProfile = await ctx.db.get(profileId);

    return {
      personalOnboardingCompleted: true,
      profile: updatedProfile,
    };
  },
});

