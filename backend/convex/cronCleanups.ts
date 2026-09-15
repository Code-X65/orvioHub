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
    const expiredDeletions = await ctx.db
      .query("accountDeletionRequests")
      .filter((q) =>
        q.and(
          q.or(
            q.eq(q.field("status"), "COOLING_OFF"),
            q.eq(q.field("status"), "PENDING"),
            q.eq(q.field("status"), "cooling_off"),
            q.eq(q.field("status"), "pending")
          ),
          q.lte(q.field("scheduledDeletionAt"), now)
        )
      )
      .take(50);

    let purgedCount = 0;
    for (const req of expiredDeletions) {
      const userId = req.userId;
      const user = await ctx.db.get(userId);
      const originalEmail = user?.email;
      const originalName = user?.name || user?.firstName || "there";

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

      // 2. Delete user phone numbers
      const userPhones = await ctx.db
        .query("userPhones")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      for (const p of userPhones) {
        await ctx.db.delete(p._id);
      }

      // 3. Delete all sessions
      const sessions = await ctx.db
        .query("sessions")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
      for (const s of sessions) {
        await ctx.db.delete(s._id);
      }

      // 4. Delete workspace memberships
      const wsMemberships = await ctx.db
        .query("workspaceMemberships")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      for (const m of wsMemberships) {
        await ctx.db.delete(m._id);
      }

      // 5. Delete preferences & consents
      const prefs = await ctx.db
        .query("userPreferences")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
      for (const p of prefs) {
        await ctx.db.delete(p._id);
      }

      const consents = await ctx.db
        .query("userConsents")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
      for (const c of consents) {
        await ctx.db.delete(c._id);
      }

      // 6. Delete onboarding progress
      const onboarding = await ctx.db
        .query("onboardingProgress" as any)
        .withIndex("by_userId" as any, (q: any) => q.eq("userId", userId))
        .first();
      if (onboarding) {
        await ctx.db.delete(onboarding._id);
      }

      // 7. NDPA Data Anonymization / Erasure:
      // Strip personal credentials & PII while preserving references in historical business records (sales, receipts, audit logs)
      if (user) {
        const anonymizedEmail = `deleted_${userId}@deleted.local`;
        await ctx.db.patch(userId, {
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
          phoneVerifiedAt: undefined,
          phoneVerificationCode: undefined,
          avatar: undefined,
          avatarUrl: undefined,
          bio: undefined,
          status: "DELETED",
          deletedAt: now,
          updatedAt: now,
        });
      }

      // 8. Mark deletion request as completed
      await ctx.db.patch(req._id, {
        status: "COMPLETED",
        completedAt: now,
      });

      // 9. Send final confirmation email if original email was recorded
      if (originalEmail && !originalEmail.endsWith("@deleted.local")) {
        await ctx.db.insert("emailOutbox", {
          to: originalEmail,
          template: "userDeletionFinal",
          payload: {
            name: originalName,
            email: originalEmail,
          },
          status: "PENDING",
          attempts: 0,
          nextAttemptAt: now,
          createdAt: now,
          updatedAt: now,
        });
      }

      // 10. Audit log: user.deletion_completed
      await ctx.db.insert("auditLogs", {
        actorId: req.requestedBy || userId,
        actorUserId: req.requestedBy || userId,
        targetUserId: userId,
        eventType: "user.deletion_completed",
        action: "user.deletion_completed",
        entityType: "user",
        entityId: userId,
        resource: "users",
        severity: "high",
        metadata: {
          deletedBy: req.requestedBy || userId,
          anonymizedRecords: true,
          scheduledDeletionAt: req.scheduledDeletionAt,
          completedAt: now,
        },
        createdAt: now,
        timestamp: now,
      });

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
        .withIndex("by_workspace", (q) => q.eq("workspaceId", ws._id))
        .collect();
      for (const wm of wsMemberships) {
        await ctx.db.delete(wm._id);
      }

      // Purge branches
      const branches = await ctx.db
        .query("branches")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", ws._id))
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
