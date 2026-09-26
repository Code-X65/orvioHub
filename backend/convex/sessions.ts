import { internalMutation, mutation, query } from "./_generated/server.js";
import { v } from "convex/values";

export const createSession = mutation({
  args: {
    userId: v.id("users"),
    sessionHash: v.string(),
    deviceId: v.optional(v.string()),
    deviceName: v.optional(v.string()),
    authenticationMethod: v.optional(v.string()),
    mfaVerified: v.optional(v.boolean()),
    rememberMe: v.optional(v.boolean()),
    tokenVersion: v.number(),
    expiresAt: v.number(),
    absoluteExpiresAt: v.optional(v.number()),
    userAgent: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    lastVisitedUrl: v.optional(v.string()),
    lastVisitedSubdomain: v.optional(v.string()),
    lastVisitedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (
      user &&
      (user.status === "SUSPENDED" ||
        user.status === "suspended" ||
        user.status === "DELETED" ||
        user.status === "deleted")
    ) {
      throw new Error("ACCOUNT_SUSPENDED");
    }

    const now = Date.now();
    const absoluteExpiresAt = args.absoluteExpiresAt || args.expiresAt;
    const sessionId = await ctx.db.insert("sessions", {
      userId: args.userId,
      sessionHash: args.sessionHash,
      deviceId: args.deviceId,
      deviceName: args.deviceName,
      authenticationMethod: args.authenticationMethod || "password",
      mfaVerified: args.mfaVerified ?? false,
      rememberMe: args.rememberMe ?? false,
      tokenVersion: args.tokenVersion,
      userAgent: args.userAgent,
      ipAddress: args.ipAddress,
      lastActiveAt: now,
      expiresAt: args.expiresAt,
      absoluteExpiresAt,
      lastVisitedUrl: args.lastVisitedUrl,
      lastVisitedSubdomain: args.lastVisitedSubdomain,
      lastVisitedAt: args.lastVisitedAt,
      createdAt: now,
      updatedAt: now,
    });
    return sessionId;
  },
});

export const rotateSession = mutation({
  args: {
    oldSessionHash: v.string(),
    newSessionHash: v.string(),
    newExpiresAt: v.number(),
    userAgent: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    deviceName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_sessionHash", (q) => q.eq("sessionHash", args.oldSessionHash))
      .first();

    if (!session) {
      throw new Error("INVALID_TOKEN");
    }

    const now = Date.now();

    // A rotated credential cannot be used again. If presented, treat as reuse:
    // Revoke only the presented session, write an audit/security event, and return
    // clean reauthentication failure (SESSION_REVOKED). Do not wipe all user sessions.
    if (session.revokedAt) {
      await ctx.db.insert("authEvents", {
        eventType: "auth.token_reuse_detected",
        userId: session.userId,
        sessionId: session._id,
        ipAddress: args.ipAddress || session.ipAddress,
        userAgent: args.userAgent || session.userAgent,
        metadata: {
          reason: "TOKEN_REUSE_DETECTED",
          revokedAt: session.revokedAt,
          previousReason: session.revocationReason,
        },
        createdAt: now,
      });

      if (!session.revocationReason) {
        await ctx.db.patch(session._id, {
          revocationReason: "TOKEN_REUSE_DETECTED",
          updatedAt: now,
        });
      }

      // A second browser tab can present the same cookie while the first tab is
      // rotating it. This is recoverable: the replacement cookie may already
      // be on its way to the browser, so do not classify it as a logout-worthy
      // revoked session.
      if (session.revocationReason === "REPLACED_BY_ROTATION" && session.replacedBySessionId) {
        return {
          concurrentRefresh: true,
          replacementSessionId: session.replacedBySessionId,
        };
      }

      throw new Error("SESSION_REVOKED");
    }

    const absoluteExpiresAt = session.absoluteExpiresAt || session.expiresAt;
    if (absoluteExpiresAt < now || session.expiresAt < now) {
      throw new Error("TOKEN_EXPIRED");
    }

    const user = await ctx.db.get(session.userId);
    if (!user || user.status === "DELETED" || user.status === "deleted") {
      throw new Error("USER_NOT_ACTIVE");
    }
    if (user.status === "SUSPENDED" || user.status === "suspended") {
      throw new Error("ACCOUNT_SUSPENDED");
    }
    if (user.status === "INACTIVE" || user.status === "inactive") {
      throw new Error("USER_NOT_ACTIVE");
    }

    const currentTokenVersion = user.tokenVersion ?? 0;
    if (session.tokenVersion !== currentTokenVersion) {
      throw new Error("SESSION_INVALIDATED");
    }

    // Revoke old session with explicit reason and link to replacement
    await ctx.db.patch(session._id, {
      revokedAt: now,
      revocationReason: "REPLACED_BY_ROTATION",
      replacedBySessionHash: args.newSessionHash,
      updatedAt: now,
    });

    // The initial login establishes the immutable 7- or 30-day lifetime.
    // Rotation is not a sliding-expiration mechanism; use that absolute value
    // directly so a "remember me" session is not accidentally shortened by a
    // refresh request that carries a shorter proposed expiry.
    const effectiveExpiresAt = absoluteExpiresAt;

    // Create new rotated session
    const newSessionId = await ctx.db.insert("sessions", {
      userId: session.userId,
      sessionHash: args.newSessionHash,
      deviceId: session.deviceId,
      deviceName: args.deviceName || session.deviceName,
      authenticationMethod: session.authenticationMethod,
      mfaVerified: session.mfaVerified,
      rememberMe: session.rememberMe ?? false,
      tokenVersion: currentTokenVersion,
      userAgent: args.userAgent || session.userAgent,
      ipAddress: args.ipAddress || session.ipAddress,
      lastActiveAt: now,
      expiresAt: effectiveExpiresAt,
      absoluteExpiresAt,
      replacedSessionId: session._id,
      createdAt: now,
      updatedAt: now,
    });

    // Update old session with replacement ID
    await ctx.db.patch(session._id, {
      replacedBySessionId: newSessionId,
    });

    return {
      sessionId: newSessionId,
      userId: user._id,
      email: user.email,
      name: user.name,
      tokenVersion: currentTokenVersion,
      rememberMe: session.rememberMe ?? false,
      expiresAt: effectiveExpiresAt,
      absoluteExpiresAt,
    };
  },
});

export const logout = mutation({
  args: {
    sessionId: v.optional(v.id("sessions")),
    sessionHash: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let session = null;
    if (args.sessionId) {
      session = await ctx.db.get(args.sessionId);
    }
    if (!session && args.sessionHash) {
      session = await ctx.db
        .query("sessions")
        .withIndex("by_sessionHash", (q) => q.eq("sessionHash", args.sessionHash))
        .first();
    }
    const now = Date.now();
    let targetUserId = args.userId;

    if (session) {
      if (!session.revokedAt) {
        await ctx.db.patch(session._id, {
          revokedAt: now,
          revocationReason: args.reason || "USER_LOGOUT",
          updatedAt: now,
        });
      }
      targetUserId = targetUserId || session.userId;
    }

    // Insert auth event for audit
    if (targetUserId) {
      await ctx.db.insert("authEvents", {
        eventType: "auth.logout",
        userId: targetUserId,
        sessionId: session?._id,
        ipAddress: args.ipAddress || session?.ipAddress,
        userAgent: args.userAgent || session?.userAgent,
        metadata: { reason: args.reason || "USER_LOGOUT" },
        createdAt: now,
      });
    }

    return { success: true };
  },
});

export const validateSession = query({
  args: {
    sessionId: v.optional(v.id("sessions")),
    sessionHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let session = null;
    if (args.sessionId) {
      session = await ctx.db.get(args.sessionId);
    }
    if (!session && args.sessionHash) {
      session = await ctx.db
        .query("sessions")
        .withIndex("by_sessionHash", (q) => q.eq("sessionHash", args.sessionHash))
        .first();
    }
    if (!session) {
      return { valid: false, error: "SESSION_NOT_FOUND" };
    }

    if (session.revokedAt) {
      return { valid: false, error: "SESSION_REVOKED" };
    }

    const now = Date.now();
    const absoluteExpiresAt = session.absoluteExpiresAt || session.expiresAt;
    if (absoluteExpiresAt < now || session.expiresAt <= now) {
      return { valid: false, error: "TOKEN_EXPIRED" };
    }

    const user = await ctx.db.get(session.userId);
    if (!user || user.status === "DELETED" || user.status === "deleted") {
      return { valid: false, error: "USER_NOT_ACTIVE" };
    }
    if (user.status === "SUSPENDED" || user.status === "suspended") {
      return {
        valid: false,
        error: "ACCOUNT_SUSPENDED",
        reason: user.suspensionReason || "Account suspended",
      };
    }
    if (user.status === "INACTIVE" || user.status === "inactive") {
      return { valid: false, error: "USER_NOT_ACTIVE" };
    }

    const currentTokenVersion = user.tokenVersion ?? 0;
    if (session.tokenVersion !== currentTokenVersion) {
      return { valid: false, error: "SESSION_INVALIDATED" };
    }

    return {
      valid: true,
      session: {
        id: session._id,
        userId: user._id,
        email: user.email,
        tokenVersion: currentTokenVersion,
      },
    };
  },
});

export const revokeSession = mutation({
  args: {
    sessionHash: v.optional(v.string()),
    sessionId: v.optional(v.id("sessions")),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let session = null;
    if (args.sessionId) {
      session = await ctx.db.get(args.sessionId);
    } else if (args.sessionHash) {
      session = await ctx.db
        .query("sessions")
        .withIndex("by_sessionHash", (q) => q.eq("sessionHash", args.sessionHash))
        .first();
    }
    if (session && !session.revokedAt) {
      const now = Date.now();
      await ctx.db.patch(session._id, {
        revokedAt: now,
        revocationReason: args.reason || "EXPLICIT_REVOCATION",
        updatedAt: now,
      });
    }
    return { success: true };
  },
});

export const revokeSessionById = mutation({
  args: {
    sessionId: v.id("sessions"),
    userId: v.id("users"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== args.userId) {
      throw new Error("SESSION_NOT_FOUND");
    }

    if (!session.revokedAt) {
      const now = Date.now();
      await ctx.db.patch(session._id, {
        revokedAt: now,
        revocationReason: args.reason || "EXPLICIT_REVOCATION",
        updatedAt: now,
      });
    }
    return { success: true };
  },
});

export const revokeAllUserSessions = mutation({
  args: {
    userId: v.id("users"),
    exceptSessionId: v.optional(v.union(v.id("sessions"), v.string())),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    const now = Date.now();
    let count = 0;
    for (const session of sessions) {
      if (args.exceptSessionId && String(session._id) === String(args.exceptSessionId)) {
        continue;
      }
      if (!session.revokedAt) {
        await ctx.db.patch(session._id, {
          revokedAt: now,
          revocationReason: args.reason || "USER_LOGOUT",
          updatedAt: now,
        });
        count++;
      }
    }
    return { count };
  },
});

export const revokeAllOtherSessions = mutation({
  args: {
    userId: v.id("users"),
    exceptSessionId: v.optional(v.string()),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    const now = Date.now();
    let count = 0;
    for (const session of sessions) {
      if (args.exceptSessionId && String(session._id) === String(args.exceptSessionId)) {
        continue;
      }
      if (!session.revokedAt) {
        await ctx.db.patch(session._id, {
          revokedAt: now,
          revocationReason: args.reason || "USER_LOGOUT",
          updatedAt: now,
        });
        count++;
      }
    }
    return { count };
  },
});

export const getUserSessions = query({
  args: {
    userId: v.id("users"),
    includeRevoked: v.optional(v.boolean()),
    currentSessionId: v.optional(v.id("sessions")),
  },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();

    const now = Date.now();
    const activeSessions = args.includeRevoked
      ? sessions
      : sessions.filter((s) => !s.revokedAt && (s.absoluteExpiresAt || s.expiresAt) > now && s.expiresAt > now);

    return activeSessions.map((s) => ({
      id: s._id,
      deviceId: s.deviceId,
      deviceName: s.deviceName,
      userAgent: s.userAgent,
      ipAddress: s.ipAddress,
      authenticationMethod: s.authenticationMethod,
      mfaVerified: s.mfaVerified ?? false,
      createdAt: s.createdAt,
      lastActiveAt: s.lastActiveAt || s.createdAt,
      expiresAt: s.expiresAt,
      absoluteExpiresAt: s.absoluteExpiresAt || s.expiresAt,
      isCurrent: Boolean(args.currentSessionId && String(s._id) === String(args.currentSessionId)),
      isRevoked: Boolean(s.revokedAt),
      revocationReason: s.revocationReason,
      isExpired: (s.absoluteExpiresAt || s.expiresAt) < now,
    }));
  },
});

export const getSessionByRefreshToken = query({
  args: {
    sessionHash: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.sessionHash) return null;
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_sessionHash", (q) => q.eq("sessionHash", args.sessionHash))
      .first();
    return session || null;
  },
});

// Name the direct-session lookup for the new cookie flow.  The existing
// getSessionByRefreshToken export remains temporarily for deployed callers;
// both deliberately query the same hash-only index.
export const getSessionBySessionHash = query({
  args: { sessionHash: v.string() },
  handler: async (ctx, args) => {
    if (!args.sessionHash) return null;
    return await ctx.db
      .query("sessions")
      .withIndex("by_sessionHash", (q) => q.eq("sessionHash", args.sessionHash))
      .first();
  },
});

export const touchSessionActivity = mutation({
  args: {
    sessionId: v.union(v.id("sessions"), v.string()),
  },
  handler: async (ctx, args) => {
    const normalizedId = ctx.db.normalizeId("sessions", args.sessionId);
    if (!normalizedId) return;
    const session = await ctx.db.get(normalizedId);
    if (session && !session.revokedAt) {
      await ctx.db.patch(normalizedId, {
        lastActiveAt: Date.now(),
      });
    }
  },
});

export const updateSessionContext = mutation({
  args: {
    sessionId: v.union(v.id("sessions"), v.string()),
    lastVisitedUrl: v.optional(v.string()),
    lastVisitedSubdomain: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const normalizedId = ctx.db.normalizeId("sessions", args.sessionId);
    if (!normalizedId) {
      return { success: false, error: "INVALID_SESSION_ID" };
    }
    const session = await ctx.db.get(normalizedId);
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt < Date.now() ||
      (session.absoluteExpiresAt && session.absoluteExpiresAt < Date.now())
    ) {
      return { success: false, error: "SESSION_NOT_ACTIVE" };
    }
    const now = Date.now();
    await ctx.db.patch(normalizedId, {
      lastVisitedUrl: args.lastVisitedUrl,
      lastVisitedSubdomain: args.lastVisitedSubdomain,
      lastVisitedAt: now,
      lastActiveAt: now,
      updatedAt: now,
    });
    return { success: true };
  },
});

export const getSessionById = query({
  args: {
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) return null;
    return {
      id: session._id,
      userId: session.userId,
      deviceId: session.deviceId,
      deviceName: session.deviceName,
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
      authenticationMethod: session.authenticationMethod,
      rememberMe: session.rememberMe ?? false,
      tokenVersion: session.tokenVersion,
      lastVisitedUrl: session.lastVisitedUrl,
      lastVisitedSubdomain: session.lastVisitedSubdomain,
      lastVisitedAt: session.lastVisitedAt,
      lastActiveAt: session.lastActiveAt,
      expiresAt: session.expiresAt,
      absoluteExpiresAt: session.absoluteExpiresAt || session.expiresAt,
      isRevoked: Boolean(session.revokedAt),
      revocationReason: session.revocationReason,
      revokedAt: session.revokedAt,
    };
  },
});

/**
 * One-time migration to sanitize legacy session records and ensure
 * absoluteExpiresAt is properly backfilled on any active rows.
 */
export const purgeLegacyCredentialFields = internalMutation({
  args: {},
  handler: async (ctx) => {
    const sessions = await ctx.db.query("sessions").collect();
    let sanitized = 0;
    const now = Date.now();
    for (const session of sessions as any[]) {
      const patches: Record<string, any> = {};
      if (session.refreshToken !== undefined) {
        patches.refreshToken = undefined;
      }
      if (session.replacedByToken !== undefined) {
        patches.replacedByToken = undefined;
      }
      if (!session.absoluteExpiresAt) {
        patches.absoluteExpiresAt = session.expiresAt || (now + 7 * 24 * 60 * 60 * 1000);
      }
      if (Object.keys(patches).length > 0) {
        patches.updatedAt = now;
        await ctx.db.patch(session._id, patches);
        sanitized++;
      }
    }
    return { sanitized, total: sessions.length };
  },
});
