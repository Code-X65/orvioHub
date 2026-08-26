import { mutation, query } from "./_generated/server.js";
import { v } from "convex/values";

export const createSession = mutation({
  args: {
    userId: v.id("users"),
    sessionHash: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
    deviceId: v.optional(v.string()),
    deviceName: v.optional(v.string()),
    authenticationMethod: v.optional(v.string()),
    mfaVerified: v.optional(v.boolean()),
    tokenVersion: v.number(),
    expiresAt: v.number(),
    userAgent: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const sessionId = await ctx.db.insert("sessions", {
      userId: args.userId,
      sessionHash: args.sessionHash,
      refreshToken: args.refreshToken,
      deviceId: args.deviceId,
      deviceName: args.deviceName,
      authenticationMethod: args.authenticationMethod || "password",
      mfaVerified: args.mfaVerified ?? false,
      tokenVersion: args.tokenVersion,
      userAgent: args.userAgent,
      ipAddress: args.ipAddress,
      lastActiveAt: now,
      expiresAt: args.expiresAt,
      createdAt: now,
      updatedAt: now,
    });
    return sessionId;
  },
});

export const rotateSession = mutation({
  args: {
    oldSessionHash: v.optional(v.string()),
    oldRefreshToken: v.optional(v.string()),
    newSessionHash: v.optional(v.string()),
    newRefreshToken: v.optional(v.string()),
    newExpiresAt: v.number(),
    userAgent: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    deviceName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let session = null;

    if (args.oldSessionHash) {
      session = await ctx.db
        .query("sessions")
        .withIndex("by_sessionHash", (q) => q.eq("sessionHash", args.oldSessionHash))
        .first();
    }

    if (!session && args.oldRefreshToken) {
      session = await ctx.db
        .query("sessions")
        .withIndex("by_refreshToken", (q) => q.eq("refreshToken", args.oldRefreshToken))
        .first();
    }

    if (!session) {
      throw new Error("INVALID_TOKEN");
    }

    // Reuse detection: if token is already revoked, revoke all sessions for this user
    if (session.revokedAt) {
      const allUserSessions = await ctx.db
        .query("sessions")
        .withIndex("by_userId", (q) => q.eq("userId", session.userId))
        .collect();

      for (const s of allUserSessions) {
        if (!s.revokedAt) {
          await ctx.db.patch(s._id, { revokedAt: Date.now() });
        }
      }
      throw new Error("SESSION_REVOKED");
    }

    if (session.expiresAt < Date.now()) {
      throw new Error("TOKEN_EXPIRED");
    }

    const user = await ctx.db.get(session.userId);
    if (!user || user.status === "SUSPENDED" || user.status === "INACTIVE") {
      throw new Error("USER_NOT_ACTIVE");
    }

    const currentTokenVersion = user.tokenVersion ?? 0;
    if (session.tokenVersion !== currentTokenVersion) {
      throw new Error("SESSION_INVALIDATED");
    }

    const now = Date.now();

    // Revoke old session
    await ctx.db.patch(session._id, {
      revokedAt: now,
      replacedByToken: args.newRefreshToken || args.newSessionHash,
      updatedAt: now,
    });

    // Create new rotated session
    const newSessionId = await ctx.db.insert("sessions", {
      userId: session.userId,
      sessionHash: args.newSessionHash,
      refreshToken: args.newRefreshToken,
      deviceId: session.deviceId,
      deviceName: args.deviceName || session.deviceName,
      authenticationMethod: session.authenticationMethod,
      mfaVerified: session.mfaVerified,
      tokenVersion: currentTokenVersion,
      userAgent: args.userAgent || session.userAgent,
      ipAddress: args.ipAddress || session.ipAddress,
      lastActiveAt: now,
      expiresAt: args.newExpiresAt,
      createdAt: now,
      updatedAt: now,
    });

    return {
      sessionId: newSessionId,
      userId: user._id,
      email: user.email,
      name: user.name,
      tokenVersion: currentTokenVersion,
    };
  },
});

export const revokeSession = mutation({
  args: {
    sessionHash: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let session = null;
    if (args.sessionHash) {
      session = await ctx.db
        .query("sessions")
        .withIndex("by_sessionHash", (q) => q.eq("sessionHash", args.sessionHash))
        .first();
    }
    if (!session && args.refreshToken) {
      session = await ctx.db
        .query("sessions")
        .withIndex("by_refreshToken", (q) => q.eq("refreshToken", args.refreshToken))
        .first();
    }

    if (session && !session.revokedAt) {
      await ctx.db.patch(session._id, {
        revokedAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
    return { success: true };
  },
});

export const revokeSessionById = mutation({
  args: {
    sessionId: v.id("sessions"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== args.userId) {
      throw new Error("SESSION_NOT_FOUND");
    }

    if (!session.revokedAt) {
      await ctx.db.patch(session._id, {
        revokedAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
    return { success: true };
  },
});

export const revokeAllUserSessions = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    const now = Date.now();
    for (const session of sessions) {
      if (!session.revokedAt) {
        await ctx.db.patch(session._id, {
          revokedAt: now,
          updatedAt: now,
        });
      }
    }
    return { count: sessions.length };
  },
});

export const revokeAllOtherSessions = mutation({
  args: {
    userId: v.id("users"),
    exceptSessionId: v.optional(v.string()),
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
  },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();

    const now = Date.now();
    return sessions.map((s) => ({
      id: s._id,
      deviceId: s.deviceId,
      deviceName: s.deviceName,
      userAgent: s.userAgent,
      ipAddress: s.ipAddress,
      authenticationMethod: s.authenticationMethod,
      createdAt: s.createdAt,
      lastActiveAt: s.lastActiveAt || s.createdAt,
      expiresAt: s.expiresAt,
      isRevoked: Boolean(s.revokedAt),
      isExpired: s.expiresAt < now,
    }));
  },
});

export const getSessionByRefreshToken = query({
  args: {
    sessionHash: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.sessionHash) {
      const session = await ctx.db
        .query("sessions")
        .withIndex("by_sessionHash", (q) => q.eq("sessionHash", args.sessionHash))
        .first();
      if (session) return session;
    }
    if (args.refreshToken) {
      return await ctx.db
        .query("sessions")
        .withIndex("by_refreshToken", (q) => q.eq("refreshToken", args.refreshToken))
        .first();
    }
    return null;
  },
});

export const touchSessionActivity = mutation({
  args: {
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (session && !session.revokedAt) {
      await ctx.db.patch(args.sessionId, {
        lastActiveAt: Date.now(),
      });
    }
  },
});

