import { v } from "convex/values";
import { mutation } from "./_generated/server.js";

/**
 * Automated Data Retention & Compliance Cleanup Routines (NDPR / GDPR)
 */

/**
 * Purges accounts whose 14-day cooling-off period has expired.
 */
export const purgeExpiredAccountDeletions = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const coolingOffUsers = await ctx.db
      .query("users")
      .filter((q) =>
        q.and(
          q.neq(q.field("scheduledDeletionAt"), undefined),
          q.lte(q.field("scheduledDeletionAt"), now)
        )
      )
      .take(50);

    let purgedCount = 0;
    for (const user of coolingOffUsers) {
      const userId = user._id;

      // 1. Delete all auth and social identities
      const authIdentities = await ctx.db
        .query("authIdentities")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
      for (const id of authIdentities) {
        await ctx.db.delete(id._id);
      }

      const userIdentities = await ctx.db
        .query("userIdentities")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
      for (const id of userIdentities) {
        await ctx.db.delete(id._id);
      }

      // 2. Delete all sessions
      const sessions = await ctx.db
        .query("sessions")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
      for (const s of sessions) {
        await ctx.db.delete(s._id);
      }

      // 3. Delete organization memberships
      const memberships = await ctx.db
        .query("organizationMemberships")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
      for (const m of memberships) {
        await ctx.db.delete(m._id);
      }

      // 4. Delete onboarding progress
      const onboarding = await ctx.db
        .query("onboardingProgress")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();
      if (onboarding) {
        await ctx.db.delete(onboarding._id);
      }

      // 5. Delete personal profile
      const profile = await ctx.db
        .query("personalProfiles")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();
      if (profile) {
        await ctx.db.delete(profile._id);
      }

      // 6. Delete user record
      await ctx.db.delete(userId);
      purgedCount++;
    }

    return { purgedCount };
  },
});

/**
 * Purges workspaces soft-deleted more than 30 days ago.
 */
export const purgeExpiredWorkspaces = mutation({
  args: {},
  handler: async (ctx) => {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const expiredWorkspaces = await ctx.db
      .query("workspaces")
      .filter((q) =>
        q.and(
          q.neq(q.field("deletedAt"), undefined),
          q.lte(q.field("deletedAt"), thirtyDaysAgo)
        )
      )
      .take(50);

    let purgedCount = 0;
    for (const ws of expiredWorkspaces) {
      // Purge workspace memberships
      const wsMemberships = await ctx.db
        .query("workspaceMemberships")
        .withIndex("by_workspaceId", (q) => q.eq("workspaceId", ws._id))
        .collect();
      for (const wm of wsMemberships) {
        await ctx.db.delete(wm._id);
      }

      // Purge branches
      const branches = await ctx.db
        .query("branches")
        .withIndex("by_workspaceId", (q) => q.eq("workspaceId", ws._id))
        .collect();
      for (const b of branches) {
        await ctx.db.delete(b._id);
      }

      await ctx.db.delete(ws._id);
      purgedCount++;
    }

    return { purgedCount };
  },
});

/**
 * Purges security audit logs older than 2 years.
 */
export const purgeExpiredAuditLogs = mutation({
  args: {},
  handler: async (ctx) => {
    const twoYearsAgo = Date.now() - 2 * 365 * 24 * 60 * 60 * 1000;
    const expiredLogs = await ctx.db
      .query("auditLogs")
      .filter((q) => q.lte(q.field("timestamp"), twoYearsAgo))
      .take(200);

    let purgedCount = 0;
    for (const log of expiredLogs) {
      await ctx.db.delete(log._id);
      purgedCount++;
    }

    return { purgedCount };
  },
});
