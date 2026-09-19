import { mutation, query } from "./_generated/server.js";
import { v } from "convex/values";

export const createFlow = mutation({
  args: {
    flowId: v.string(),
    provider: v.union(v.literal("google"), v.literal("facebook")),
    stateHash: v.string(),
    nonceHash: v.optional(v.string()),
    pkceChallenge: v.optional(v.string()),
    pkceVerifier: v.optional(v.string()),
    returnTo: v.optional(v.string()),
    product: v.optional(v.string()),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("oauthFlows")
      .withIndex("by_stateHash", (q) => q.eq("stateHash", args.stateHash))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    const id = await ctx.db.insert("oauthFlows", {
      flowId: args.flowId,
      provider: args.provider,
      stateHash: args.stateHash,
      nonceHash: args.nonceHash,
      pkceChallenge: args.pkceChallenge,
      pkceVerifier: args.pkceVerifier,
      returnTo: args.returnTo,
      product: args.product,
      status: "pending",
      expiresAt: args.expiresAt,
      createdAt: Date.now(),
    });

    return { id, flowId: args.flowId };
  },
});

export const getFlowByStateHash = query({
  args: {
    stateHash: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("oauthFlows")
      .withIndex("by_stateHash", (q) => q.eq("stateHash", args.stateHash))
      .first();
  },
});

export const markFlowCompleted = mutation({
  args: {
    stateHash: v.string(),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const flow = await ctx.db
      .query("oauthFlows")
      .withIndex("by_stateHash", (q) => q.eq("stateHash", args.stateHash))
      .first();

    if (!flow) return null;

    const now = Date.now();
    await ctx.db.patch(flow._id, {
      status: "completed",
      usedAt: now,
      userId: args.userId ?? flow.userId,
    });

    return { success: true, flowId: flow.flowId };
  },
});

export const markFlowReplayed = mutation({
  args: {
    stateHash: v.string(),
  },
  handler: async (ctx, args) => {
    const flow = await ctx.db
      .query("oauthFlows")
      .withIndex("by_stateHash", (q) => q.eq("stateHash", args.stateHash))
      .first();

    if (!flow) return null;

    await ctx.db.patch(flow._id, {
      status: "replayed",
    });

    return { success: true, flowId: flow.flowId };
  },
});
