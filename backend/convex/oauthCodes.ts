import { mutation, query } from "./_generated/server.js";
import { v } from "convex/values";

export const generateAuthCode = mutation({
  args: {
    codeHash: v.string(),
    userId: v.id("users"),
    sessionId: v.optional(v.string()),
    productKey: v.string(),
    redirectUri: v.string(),
    codeChallenge: v.optional(v.string()),
    codeChallengeMethod: v.optional(v.string()),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("oauthCodes", {
      codeHash: args.codeHash,
      userId: args.userId,
      sessionId: args.sessionId,
      productKey: args.productKey,
      redirectUri: args.redirectUri,
      codeChallenge: args.codeChallenge,
      codeChallengeMethod: args.codeChallengeMethod,
      expiresAt: args.expiresAt,
      createdAt: now,
    });
    return id;
  },
});

export const consumeAuthCode = mutation({
  args: {
    codeHash: v.string(),
    redirectUri: v.string(),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("oauthCodes")
      .withIndex("by_codeHash", (q) => q.eq("codeHash", args.codeHash))
      .first();

    if (!record) {
      throw new Error("INVALID_GRANT");
    }

    if (record.consumedAt) {
      throw new Error("AUTHORIZATION_CODE_ALREADY_USED");
    }

    if (record.expiresAt < Date.now()) {
      throw new Error("AUTHORIZATION_CODE_EXPIRED");
    }

    if (record.redirectUri !== args.redirectUri) {
      throw new Error("REDIRECT_URI_MISMATCH");
    }

    await ctx.db.patch(record._id, {
      consumedAt: Date.now(),
    });

    const user = await ctx.db.get(record.userId);
    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    return {
      userId: record.userId,
      sessionId: record.sessionId,
      productKey: record.productKey,
      codeChallenge: record.codeChallenge,
      codeChallengeMethod: record.codeChallengeMethod,
      user,
    };
  },
});

export const getAuthCodeByHash = query({
  args: { codeHash: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("oauthCodes")
      .withIndex("by_codeHash", (q) => q.eq("codeHash", args.codeHash))
      .first();
  },
});
