import { mutation, query } from "./_generated/server.js";
import { v } from "convex/values";

const template = v.union(
  v.literal("verification"),
  v.literal("invitation"),
  v.literal("onboardingCompleted"),
  v.literal("passwordReset"),
  v.literal("emailChange")
);

export const enqueue = mutation({
  args: { to: v.string(), template, payload: v.any() },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("emailOutbox", {
      ...args,
      status: "PENDING",
      attempts: 0,
      nextAttemptAt: now,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const ready = query({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const messages = await ctx.db
      .query("emailOutbox")
      .withIndex("by_status_and_nextAttemptAt", (q) => q.eq("status", "PENDING"))
      .collect();
    return messages.filter((message) => message.nextAttemptAt <= now).slice(0, args.limit);
  },
});

export const claim = mutation({
  args: { id: v.id("emailOutbox") },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.id);
    const now = Date.now();
    if (!message || message.status !== "PENDING" || message.nextAttemptAt > now) return null;
    await ctx.db.patch(message._id, {
      status: "PROCESSING",
      lockedUntil: now + 60_000,
      updatedAt: now,
    });
    return message;
  },
});

export const markSent = mutation({
  args: { id: v.id("emailOutbox"), providerMessageId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.id, {
      status: "SENT",
      providerMessageId: args.providerMessageId,
      lockedUntil: undefined,
      sentAt: now,
      updatedAt: now,
    });
  },
});

export const markFailed = mutation({
  args: { id: v.id("emailOutbox"), error: v.string() },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.id);
    if (!message) return;
    const now = Date.now();
    const attempts = message.attempts + 1;
    const permanentlyFailed = attempts >= 8;
    await ctx.db.patch(args.id, {
      status: permanentlyFailed ? "FAILED" : "PENDING",
      attempts,
      nextAttemptAt: now + Math.min(60_000 * 2 ** attempts, 3_600_000),
      lockedUntil: undefined,
      lastError: args.error.slice(0, 1_000),
      updatedAt: now,
    });
  },
});
