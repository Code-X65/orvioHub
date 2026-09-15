import { query, mutation } from "./_generated/server.js";
import { v } from "convex/values";

// Helper to resolve user
async function resolveUser(ctx: any, userIdArg: any) {
  let user = null;
  try {
    user = await ctx.db.get(userIdArg);
  } catch {}
  if (!user) {
    user = await ctx.db.query("users").filter((q: any) => q.eq(q.field("_id"), userIdArg)).first();
  }
  return user;
}

// Get user profile details
export const getUserProfile = query({
  args: { userId: v.union(v.id("users"), v.string()) },
  handler: async (ctx, args) => {
    const user = await resolveUser(ctx, args.userId);
    if (!user) return null;

    const preferences = await ctx.db
      .query("userPreferences")
      .withIndex("by_userId", (q: any) => q.eq("userId", user._id))
      .first();

    const consents = await ctx.db
      .query("userConsents")
      .withIndex("by_userId", (q: any) => q.eq("userId", user._id))
      .collect();

    const deletionRequest = await ctx.db
      .query("accountDeletionRequests")
      .withIndex("by_userId", (q: any) => q.eq("userId", user._id))
      .filter((q: any) =>
        q.or(
          q.eq(q.field("status"), "PENDING"),
          q.eq(q.field("status"), "COOLING_OFF")
        )
      )
      .first();

    return {
      user,
      preferences,
      consents,
      activeDeletionRequest: deletionRequest,
    };
  },
});

// Update personal details
export const updatePersonalDetails = mutation({
  args: {
    userId: v.union(v.id("users"), v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    displayName: v.optional(v.string()),
    preferredName: v.optional(v.string()),
    jobTitle: v.optional(v.string()),
    department: v.optional(v.string()),
    bio: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await resolveUser(ctx, args.userId);
    if (!user) throw new Error("USER_NOT_FOUND");

    const { userId, ...updates } = args;
    const now = Date.now();
    const cleanUpdates: Record<string, any> = { updatedAt: now };

    for (const [k, val] of Object.entries(updates)) {
      if (val !== undefined) cleanUpdates[k] = val;
    }

    if (updates.firstName || updates.lastName) {
      const fName = updates.firstName ?? user.firstName ?? "";
      const lName = updates.lastName ?? user.lastName ?? "";
      cleanUpdates.name = `${fName} ${lName}`.trim() || user.name;
    }

    await ctx.db.patch(user._id, cleanUpdates);
    return await ctx.db.get(user._id);
  },
});

// Update avatar URL
export const updateAvatar = mutation({
  args: {
    userId: v.union(v.id("users"), v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await resolveUser(ctx, args.userId);
    if (!user) throw new Error("USER_NOT_FOUND");
    const now = Date.now();
    await ctx.db.patch(user._id, {
      avatar: args.avatarUrl,
      avatarUrl: args.avatarUrl,
      updatedAt: now,
    });
    return await ctx.db.get(user._id);
  },
});

// Update contact info & location
export const updateContactDetails = mutation({
  args: {
    userId: v.union(v.id("users"), v.string()),
    phone: v.optional(v.string()),
    phoneVisibility: v.optional(v.union(v.literal("private"), v.literal("workspace"))),
    country: v.optional(v.string()),
    state: v.optional(v.string()),
    stateCode: v.optional(v.string()),
    lga: v.optional(v.string()),
    city: v.optional(v.string()),
    timezone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await resolveUser(ctx, args.userId);
    if (!user) throw new Error("USER_NOT_FOUND");

    const { userId, ...updates } = args;
    const now = Date.now();
    const cleanUpdates: Record<string, any> = { updatedAt: now };

    for (const [k, val] of Object.entries(updates)) {
      if (val !== undefined) cleanUpdates[k] = val;
    }

    await ctx.db.patch(user._id, cleanUpdates);
    return await ctx.db.get(user._id);
  },
});

// Request Phone verification code
export const setPhoneVerificationCode = mutation({
  args: {
    userId: v.union(v.id("users"), v.string()),
    phone: v.string(),
    code: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await resolveUser(ctx, args.userId);
    if (!user) throw new Error("USER_NOT_FOUND");
    await ctx.db.patch(user._id, {
      phone: args.phone,
      phoneVerificationCode: args.code,
      phoneVerificationExpiresAt: args.expiresAt,
      updatedAt: Date.now(),
    });
  },
});

// Confirm Phone verification code
export const verifyPhoneCode = mutation({
  args: {
    userId: v.union(v.id("users"), v.string()),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await resolveUser(ctx, args.userId);
    if (!user) throw new Error("USER_NOT_FOUND");

    if (!user.phoneVerificationCode || user.phoneVerificationCode !== args.code) {
      throw new Error("INVALID_PHONE_VERIFICATION_CODE");
    }

    if (user.phoneVerificationExpiresAt && user.phoneVerificationExpiresAt < Date.now()) {
      throw new Error("EXPIRED_PHONE_VERIFICATION_CODE");
    }

    const now = Date.now();
    await ctx.db.patch(user._id, {
      phoneVerifiedAt: now,
      phoneVerificationCode: undefined,
      phoneVerificationExpiresAt: undefined,
      updatedAt: now,
    });

    return await ctx.db.get(user._id);
  },
});

// Get or upsert user preferences
export const getUserPreferences = query({
  args: { userId: v.union(v.id("users"), v.string()) },
  handler: async (ctx, args) => {
    const user = await resolveUser(ctx, args.userId);
    if (!user) return null;
    return await ctx.db
      .query("userPreferences")
      .withIndex("by_userId", (q: any) => q.eq("userId", user._id))
      .first();
  },
});

export const updateUserPreferences = mutation({
  args: {
    userId: v.union(v.id("users"), v.string()),
    theme: v.optional(v.union(v.literal("dark"), v.literal("light"), v.literal("system"))),
    language: v.optional(v.string()),
    timezone: v.optional(v.string()),
    country: v.optional(v.string()),
    dateFormat: v.optional(v.string()),
    numberFormat: v.optional(v.string()),
    currencyPreference: v.optional(v.string()),
    firstDayOfWeek: v.optional(v.union(v.literal("monday"), v.literal("sunday"))),
    layoutDensity: v.optional(v.union(v.literal("compact"), v.literal("comfortable"))),
    marketingEmailEnabled: v.optional(v.boolean()),
    productEmailEnabled: v.optional(v.boolean()),
    securityEmailEnabled: v.optional(v.boolean()),
    inventoryAlertsEnabled: v.optional(v.boolean()),
    taskRemindersEnabled: v.optional(v.boolean()),
    billingAlertsEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await resolveUser(ctx, args.userId);
    if (!user) throw new Error("USER_NOT_FOUND");
    const { userId, ...prefUpdates } = args;
    const now = Date.now();

    const existing = await ctx.db
      .query("userPreferences")
      .withIndex("by_userId", (q: any) => q.eq("userId", user._id))
      .first();

    const cleanUpdates: Record<string, any> = { updatedAt: now };
    for (const [k, val] of Object.entries(prefUpdates)) {
      if (val !== undefined) cleanUpdates[k] = val;
    }

    if (existing) {
      await ctx.db.patch(existing._id, cleanUpdates);
      return await ctx.db.get(existing._id);
    } else {
      const id = await ctx.db.insert("userPreferences", {
        userId: user._id,
        ...cleanUpdates,
      } as any);
      return await ctx.db.get(id);
    }
  },
});

// User audit logs & security activity
export const logUserActivity = mutation({
  args: {
    userId: v.union(v.id("users"), v.string()),
    eventType: v.string(),
    targetType: v.optional(v.string()),
    targetId: v.optional(v.string()),
    severity: v.union(v.literal("info"), v.literal("warning"), v.literal("critical")),
    metadata: v.optional(v.any()),
    requestId: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await resolveUser(ctx, args.userId);
    if (!user) return;
    return await ctx.db.insert("userAuditLogs", {
      ...args,
      userId: user._id,
      createdAt: Date.now(),
    });
  },
});

export const getUserActivityLogs = query({
  args: {
    userId: v.union(v.id("users"), v.string()),
    limit: v.optional(v.number()),
    eventType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await resolveUser(ctx, args.userId);
    if (!user) return [];
    const limit = args.limit || 50;
    let query = ctx.db
      .query("userAuditLogs")
      .withIndex("by_user_and_created", (q: any) => q.eq("userId", user._id))
      .order("desc");

    const logs = await query.take(limit);

    if (args.eventType && args.eventType !== "ALL") {
      return logs.filter((log) => log.eventType === args.eventType);
    }

    return logs;
  },
});

export const reportSuspiciousActivity = mutation({
  args: {
    userId: v.union(v.id("users"), v.string()),
    activityId: v.id("userAuditLogs"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await resolveUser(ctx, args.userId);
    if (!user) throw new Error("USER_NOT_FOUND");
    const activity = await ctx.db.get(args.activityId);
    if (!activity || activity.userId !== user._id) {
      throw new Error("ACTIVITY_NOT_FOUND");
    }

    await ctx.db.patch(args.activityId, {
      isSuspicious: true,
      suspiciousReportedAt: Date.now(),
      suspiciousReason: args.reason,
    });

    // Also record security event
    await ctx.db.insert("userAuditLogs", {
      userId: user._id,
      eventType: "SUSPICIOUS_ACTIVITY_REPORTED",
      targetType: "userAuditLogs",
      targetId: args.activityId,
      severity: "critical",
      metadata: { originalEvent: activity.eventType, reason: args.reason },
      createdAt: Date.now(),
    });

    return true;
  },
});

// Consents
export const recordConsent = mutation({
  args: {
    userId: v.union(v.id("users"), v.string()),
    consentType: v.string(),
    version: v.string(),
    granted: v.boolean(),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await resolveUser(ctx, args.userId);
    if (!user) throw new Error("USER_NOT_FOUND");
    const existing = await ctx.db
      .query("userConsents")
      .withIndex("by_user_and_consentType", (q: any) =>
        q.eq("userId", user._id).eq("consentType", args.consentType)
      )
      .first();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        granted: args.granted,
        grantedAt: args.granted ? now : existing.grantedAt,
        withdrawnAt: args.granted ? undefined : now,
        version: args.version,
        source: args.source,
      });
      return await ctx.db.get(existing._id);
    } else {
      const id = await ctx.db.insert("userConsents", {
        userId: user._id,
        consentType: args.consentType,
        version: args.version,
        granted: args.granted,
        grantedAt: now,
        withdrawnAt: args.granted ? undefined : now,
        source: args.source,
      });
      return await ctx.db.get(id);
    }
  },
});

export const getUserConsents = query({
  args: { userId: v.union(v.id("users"), v.string()) },
  handler: async (ctx, args) => {
    const user = await resolveUser(ctx, args.userId);
    if (!user) return [];
    return await ctx.db
      .query("userConsents")
      .withIndex("by_userId", (q: any) => q.eq("userId", user._id))
      .collect();
  },
});

// Account Deletion Requests
export const requestAccountDeletion = mutation({
  args: {
    userId: v.union(v.id("users"), v.string()),
    reason: v.optional(v.string()),
    coolingOffDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await resolveUser(ctx, args.userId);
    if (!user) throw new Error("USER_NOT_FOUND");
    const now = Date.now();

    // 1. Critical Check: Does user own active workspaces?
    const ownedWorkspaces = await ctx.db
      .query("workspaces")
      .withIndex("by_owner", (q: any) => q.eq("ownerId", user._id))
      .filter((q: any) => q.neq(q.field("status"), "deleted"))
      .collect();

    if (ownedWorkspaces.length > 0) {
      const err: any = new Error(
        "You must transfer ownership or close your workspaces before deleting your account."
      );
      err.code = "SOLE_OWNER_CANNOT_LEAVE_WORKSPACE";
      err.ownedWorkspaces = ownedWorkspaces.map((w: any) => ({
        workspaceId: w._id,
        workspace: { name: w.name, slug: w.slug },
      }));
      throw err;
    }

    // 2. Critical Check: Is user the only superadmin?
    if (user.role === "superadmin") {
      const allUsers = await ctx.db.query("users").collect();
      const superadmins = allUsers.filter(
        (u: any) =>
          u.role === "superadmin" &&
          u.status !== "SUSPENDED" &&
          u.status !== "suspended" &&
          u.status !== "DELETED" &&
          u.status !== "deleted"
      );
      if (superadmins.length <= 1) {
        throw new Error("Cannot delete the only superadmin. Add another superadmin first.");
      }
    }

    // 3. Grace period calculation (default 7 days)
    const days = args.coolingOffDays ?? 7;
    const scheduledDeletionAt = now + days * 24 * 60 * 60 * 1000;

    // 4. Generate cancellation token
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    const token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

    const existing = await ctx.db
      .query("accountDeletionRequests")
      .withIndex("by_userId", (q: any) => q.eq("userId", user._id))
      .filter((q: any) =>
        q.or(
          q.eq(q.field("status"), "PENDING"),
          q.eq(q.field("status"), "COOLING_OFF"),
          q.eq(q.field("status"), "pending"),
          q.eq(q.field("status"), "cooling_off")
        )
      )
      .first();

    let deletionRequestId;
    if (existing) {
      await ctx.db.patch(existing._id, {
        reason: args.reason,
        scheduledDeletionAt,
        status: "COOLING_OFF",
        deletionTokenHash: token,
        requestedAt: now,
        requestedBy: user._id,
      });
      deletionRequestId = existing._id;
    } else {
      deletionRequestId = await ctx.db.insert("accountDeletionRequests", {
        userId: user._id,
        status: "COOLING_OFF",
        reason: args.reason,
        requestedBy: user._id,
        requestedAt: now,
        scheduledDeletionAt,
        deletionTokenHash: token,
        adminForceDelete: false,
      });
    }

    // 5. Update user deletion tracking
    await ctx.db.patch(user._id, {
      deletionRequestedAt: now,
      deletionScheduledAt: scheduledDeletionAt,
      updatedAt: now,
    });

    // 6. Queue confirmation email with cancellation link
    const cancellationLink = `https://accounts.orviohub.com/profile/delete?cancelToken=${token}`;
    await ctx.db.insert("emailOutbox", {
      to: user.email,
      template: "userDeletionRequested",
      payload: {
        name: user.name || user.firstName || "there",
        email: user.email,
        scheduledDate: new Date(scheduledDeletionAt).toLocaleDateString(),
        cancellationLink,
        gracePeriodDays: String(days),
      },
      status: "PENDING",
      attempts: 0,
      nextAttemptAt: now,
      createdAt: now,
      updatedAt: now,
    });

    // 7. Audit log event: user.deletion_requested
    await ctx.db.insert("auditLogs", {
      actorId: user._id,
      actorUserId: user._id,
      targetUserId: user._id,
      eventType: "user.deletion_requested",
      action: "user.deletion_requested",
      entityType: "user",
      entityId: user._id,
      resource: "users",
      severity: "medium",
      metadata: {
        reason: args.reason,
        gracePeriodDays: days,
        scheduledDeletionAt,
      },
      createdAt: now,
      timestamp: now,
    });

    return {
      deletionRequestId,
      scheduledDeletionAt,
      gracePeriodDays: days,
      token,
      message: "Account deletion scheduled. Check email for cancellation link.",
    };
  },
});

export const cancelAccountDeletion = mutation({
  args: {
    userId: v.optional(v.union(v.id("users"), v.string())),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let existing: any = null;

    if (args.token) {
      existing = await ctx.db
        .query("accountDeletionRequests")
        .withIndex("by_token_hash", (q: any) => q.eq("deletionTokenHash", args.token!))
        .first();
    } else if (args.userId) {
      const user = await resolveUser(ctx, args.userId);
      if (user) {
        existing = await ctx.db
          .query("accountDeletionRequests")
          .withIndex("by_userId", (q: any) => q.eq("userId", user._id))
          .filter((q: any) =>
            q.or(
              q.eq(q.field("status"), "PENDING"),
              q.eq(q.field("status"), "COOLING_OFF"),
              q.eq(q.field("status"), "pending"),
              q.eq(q.field("status"), "cooling_off")
            )
          )
          .first();
      }
    }

    if (!existing) throw new Error("NO_ACTIVE_DELETION_REQUEST");

    const now = Date.now();
    await ctx.db.patch(existing._id, {
      status: "CANCELLED",
      cancelledAt: now,
    });

    // Clear user tracking flags
    await ctx.db.patch(existing.userId, {
      deletionRequestedAt: undefined,
      deletionScheduledAt: undefined,
      updatedAt: now,
    });

    // Audit log event: user.deletion_cancelled
    await ctx.db.insert("auditLogs", {
      actorId: existing.userId,
      actorUserId: existing.userId,
      targetUserId: existing.userId,
      eventType: "user.deletion_cancelled",
      action: "user.deletion_cancelled",
      entityType: "user",
      entityId: existing.userId,
      resource: "users",
      severity: "medium",
      metadata: { cancelledBy: existing.userId },
      createdAt: now,
      timestamp: now,
    });

    return { success: true, message: "Account deletion has been successfully cancelled." };
  },
});

export const getAccountDeletionStatus = query({
  args: { userId: v.union(v.id("users"), v.string()) },
  handler: async (ctx, args) => {
    const user = await resolveUser(ctx, args.userId);
    if (!user) return null;

    const request = await ctx.db
      .query("accountDeletionRequests")
      .withIndex("by_userId", (q: any) => q.eq("userId", user._id))
      .filter((q: any) =>
        q.or(
          q.eq(q.field("status"), "PENDING"),
          q.eq(q.field("status"), "COOLING_OFF"),
          q.eq(q.field("status"), "pending"),
          q.eq(q.field("status"), "cooling_off")
        )
      )
      .first();

    if (!request) return { hasActiveRequest: false, status: "NONE" };
    const now = Date.now();
    const daysRemaining = Math.max(
      0,
      Math.ceil((request.scheduledDeletionAt - now) / (24 * 60 * 60 * 1000))
    );

    return {
      id: request._id,
      hasActiveRequest: true,
      status: request.status,
      reason: request.reason,
      requestedAt: request.requestedAt,
      scheduledDeletionAt: request.scheduledDeletionAt,
      daysRemaining,
    };
  },
});

// Data Export Requests
export const createDataExportRequest = mutation({
  args: {
    userId: v.union(v.id("users"), v.string()),
    data: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const user = await resolveUser(ctx, args.userId);
    if (!user) throw new Error("USER_NOT_FOUND");
    const now = Date.now();
    const expiresAt = now + 7 * 24 * 60 * 60 * 1000; // 7 days

    const id = await ctx.db.insert("dataExportRequests", {
      userId: user._id,
      status: "READY",
      requestedAt: now,
      completedAt: now,
      expiresAt,
      data: args.data,
    });

    return await ctx.db.get(id);
  },
});

export const getDataExportRequest = query({
  args: {
    userId: v.union(v.id("users"), v.string()),
    exportId: v.id("dataExportRequests"),
  },
  handler: async (ctx, args) => {
    const user = await resolveUser(ctx, args.userId);
    if (!user) return null;
    const exportReq = await ctx.db.get(args.exportId);
    if (!exportReq || exportReq.userId !== user._id) {
      return null;
    }
    return exportReq;
  },
});
