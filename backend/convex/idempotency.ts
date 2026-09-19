import { mutation, query } from "./_generated/server.js";
import { v } from "convex/values";

export const acquireOrCheck = mutation({
  args: {
    key: v.string(),
    scope: v.string(),
    fingerprint: v.string(),
    ttlMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const ttl = args.ttlMs ?? 86_400_000; // 24 hours default retention
    const existing = await ctx.db
      .query("idempotencyKeys")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (existing) {
      // Check for payload mismatch first
      if (existing.fingerprint !== args.fingerprint) {
        return { action: "MISMATCH" as const };
      }

      // If expired, permit re-acquisition
      if (existing.expiresAt <= now) {
        await ctx.db.patch(existing._id, {
          status: "processing",
          fingerprint: args.fingerprint,
          scope: args.scope,
          statusCode: undefined,
          responseBody: undefined,
          lockedAt: now,
          createdAt: now,
          expiresAt: now + ttl,
        });
        return { action: "ACQUIRED" as const };
      }

      if (existing.status === "completed") {
        return {
          action: "REPLAY" as const,
          statusCode: existing.statusCode ?? 200,
          responseBody: existing.responseBody ?? "{}",
        };
      }

      if (existing.status === "processing") {
        // If locked longer than 30 seconds, treat previous worker as dead and reclaim
        const isStale = (now - (existing.lockedAt ?? existing.createdAt)) > 30_000;
        if (isStale) {
          await ctx.db.patch(existing._id, {
            lockedAt: now,
          });
          return { action: "ACQUIRED" as const };
        }
        return { action: "PROCESSING" as const };
      }

      // If previous attempt failed, allow retry
      if (existing.status === "failed") {
        await ctx.db.patch(existing._id, {
          status: "processing",
          lockedAt: now,
          expiresAt: now + ttl,
        });
        return { action: "ACQUIRED" as const };
      }
    }

    // Insert brand new processing record
    await ctx.db.insert("idempotencyKeys", {
      key: args.key,
      scope: args.scope,
      fingerprint: args.fingerprint,
      status: "processing",
      createdAt: now,
      expiresAt: now + ttl,
      lockedAt: now,
    });

    return { action: "ACQUIRED" as const };
  },
});

export const complete = mutation({
  args: {
    key: v.string(),
    statusCode: v.number(),
    responseBody: v.string(),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("idempotencyKeys")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "completed",
        statusCode: args.statusCode,
        responseBody: args.responseBody,
        userId: args.userId,
        lockedAt: undefined,
      });
      return true;
    }
    return false;
  },
});

export const fail = mutation({
  args: {
    key: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("idempotencyKeys")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "failed",
        lockedAt: undefined,
      });
      return true;
    }
    return false;
  },
});

export const getByIdempotencyKey = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("idempotencyKeys")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
  },
});

/**
 * Acquire or check billing operation idempotency record
 */
export const acquireBillingIdempotency = mutation({
  args: {
    key: v.string(),
    operation: v.union(
      v.literal("upgrade_checkout"),
      v.literal("upgrade_verify"),
      v.literal("upgrade_webhook"),
      v.literal("subscription_activate"),
      v.literal("invoice_create"),
      v.literal("checkout_initialize"),
      v.literal("payment_verify"),
      v.literal("plan_change"),
      v.literal("subscription_cancel"),
      v.literal("subscription_resume"),
      v.literal("webhook_process")
    ),
    requestFingerprint: v.string(),
    workspaceId: v.optional(v.union(v.id("workspaces"), v.id("organizations"), v.string())),
    providerReference: v.optional(v.string()),
    ttlMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const ttl = args.ttlMs ?? 86_400_000 * 7; // 7 days retention for billing idempotency

    const existing = await ctx.db
      .query("billingIdempotencyRecords")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (existing) {
      if (existing.requestFingerprint !== args.requestFingerprint) {
        return { action: "MISMATCH" as const };
      }

      if (existing.status === "completed") {
        return {
          action: "REPLAY" as const,
          statusCode: existing.responseStatus ?? 200,
          responseBody: existing.responseBody,
        };
      }

      if (existing.status === "processing") {
        const isStale = (now - existing.createdAt) > 30_000;
        if (isStale) {
          await ctx.db.patch(existing._id, {
            createdAt: now,
          });
          return { action: "ACQUIRED" as const };
        }
        return { action: "PROCESSING" as const };
      }

      if (existing.status === "failed") {
        await ctx.db.patch(existing._id, {
          status: "processing",
          createdAt: now,
          expiresAt: now + ttl,
        });
        return { action: "ACQUIRED" as const };
      }
    }

    await ctx.db.insert("billingIdempotencyRecords", {
      key: args.key,
      operation: args.operation,
      workspaceId: args.workspaceId,
      providerReference: args.providerReference,
      requestFingerprint: args.requestFingerprint,
      status: "processing",
      createdAt: now,
      expiresAt: now + ttl,
    });

    return { action: "ACQUIRED" as const };
  },
});

/**
 * Complete billing idempotency record with cached response
 */
export const completeBillingIdempotency = mutation({
  args: {
    key: v.string(),
    responseStatus: v.number(),
    responseBody: v.any(),
    resourceType: v.optional(v.string()),
    resourceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("billingIdempotencyRecords")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (existing) {
      const now = Date.now();
      await ctx.db.patch(existing._id, {
        status: "completed",
        responseStatus: args.responseStatus,
        responseBody: args.responseBody,
        resourceType: args.resourceType,
        resourceId: args.resourceId,
        completedAt: now,
      });
      return true;
    }
    return false;
  },
});

/**
 * Mark billing idempotency record failed
 */
export const failBillingIdempotency = mutation({
  args: {
    key: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("billingIdempotencyRecords")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "failed",
      });
      return true;
    }
    return false;
  },
});
