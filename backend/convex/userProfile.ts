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
    const days = args.coolingOffDays ?? 14;
    const scheduledDeletionAt = now + days * 24 * 60 * 60 * 1000;

    const existing = await ctx.db
      .query("accountDeletionRequests")
      .withIndex("by_userId", (q: any) => q.eq("userId", user._id))
      .filter((q: any) =>
        q.or(
          q.eq(q.field("status"), "PENDING"),
          q.eq(q.field("status"), "COOLING_OFF")
        )
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        reason: args.reason,
        scheduledDeletionAt,
        status: "COOLING_OFF",
      });
      return await ctx.db.get(existing._id);
    }

    const id = await ctx.db.insert("accountDeletionRequests", {
      userId: user._id,
      status: "COOLING_OFF",
      reason: args.reason,
      requestedAt: now,
      scheduledDeletionAt,
    });

    return await ctx.db.get(id);
  },
});

export const cancelAccountDeletion = mutation({
  args: { userId: v.union(v.id("users"), v.string()) },
  handler: async (ctx, args) => {
    const user = await resolveUser(ctx, args.userId);
    if (!user) throw new Error("USER_NOT_FOUND");
    const existing = await ctx.db
      .query("accountDeletionRequests")
      .withIndex("by_userId", (q: any) => q.eq("userId", user._id))
      .filter((q: any) =>
        q.or(
          q.eq(q.field("status"), "PENDING"),
          q.eq(q.field("status"), "COOLING_OFF")
        )
      )
      .first();

    if (!existing) throw new Error("NO_ACTIVE_DELETION_REQUEST");

    await ctx.db.patch(existing._id, {
      status: "CANCELLED",
      cancelledAt: Date.now(),
    });

    return true;
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
