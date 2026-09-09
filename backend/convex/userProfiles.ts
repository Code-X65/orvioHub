import { query, mutation } from "./_generated/server.js";
import { v } from "convex/values";

/**
 * Query personal onboarding profile for a user
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
      profile: profile || null,
    };
  },
});

/**
 * Submit and save personal onboarding answers
 */
export const savePersonalOnboarding = mutation({
  args: {
    userId: v.union(v.id("users"), v.string()),
    useCases: v.array(v.string()),
    acquisitionSource: v.string(),
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

    let profileId;
    if (existing) {
      await ctx.db.patch(existing._id, {
        useCases: args.useCases,
        acquisitionSource: args.acquisitionSource,
        role: args.role,
        managesBusiness: args.managesBusiness,
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
        role: args.role,
        managesBusiness: args.managesBusiness,
        personalOnboardingCompleted: true,
        completedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Also mark on users record for fast lookup
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
