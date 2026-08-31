import { query, mutation } from "./_generated/server.js";
import { v } from "convex/values";

const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export const recordInitiated = mutation({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.string()),
    planKey: v.string(),
    amount: v.number(), // in kobo
    currency: v.string(), // "NGN"
    billingCycle: v.string(), // "monthly" | "annual"
    gateway: v.union(v.literal("paystack"), v.literal("flutterwave")),
    gatewayReference: v.string(),
    customerEmail: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if transaction with this reference already exists
    const existing = await ctx.db
      .query("paymentTransactions")
      .withIndex("by_gateway_ref", (q) => q.eq("gatewayReference", args.gatewayReference))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("paymentTransactions", {
      workspaceId: args.workspaceId,
      planKey: args.planKey,
      amount: args.amount,
      currency: args.currency,
      billingCycle: args.billingCycle,
      gateway: args.gateway,
      gatewayReference: args.gatewayReference,
      status: "pending",
      customerEmail: args.customerEmail,
      metadata: args.metadata,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const markSuccessful = mutation({
  args: {
    gatewayReference: v.string(),
    gateway: v.union(v.literal("paystack"), v.literal("flutterwave")),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const transaction = await ctx.db
      .query("paymentTransactions")
      .withIndex("by_gateway_ref", (q) => q.eq("gatewayReference", args.gatewayReference))
      .first();

    if (!transaction) {
      throw new Error(`Transaction with reference '${args.gatewayReference}' not found.`);
    }

    if (transaction.status === "success") {
      return { alreadyProcessed: true, transactionId: transaction._id };
    }

    // 1. Mark transaction as success
    await ctx.db.patch(transaction._id, {
      status: "success",
      paidAt: now,
      metadata: args.metadata ? { ...transaction.metadata, ...args.metadata } : transaction.metadata,
      updatedAt: now,
    });

    const isAnnual = transaction.billingCycle === "annual";
    const duration = isAnnual ? ONE_YEAR_MS : ONE_MONTH_MS;

    // 2. Update/create workspace subscription
    const existingSub = await ctx.db
      .query("subscriptions")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", transaction.workspaceId as any))
      .first();

    if (existingSub) {
      const baseStart = existingSub.currentPeriodEnd > now ? existingSub.currentPeriodEnd : now;
      await ctx.db.patch(existingSub._id, {
        planKey: transaction.planKey,
        status: "active",
        currentPeriodStart: now,
        currentPeriodEnd: baseStart + duration,
        cancelAtPeriodEnd: false,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("subscriptions", {
        workspaceId: transaction.workspaceId as any,
        planKey: transaction.planKey,
        status: "active",
        currentPeriodStart: now,
        currentPeriodEnd: now + duration,
        cancelAtPeriodEnd: false,
        createdAt: now,
        updatedAt: now,
      });
    }

    // 3. Update workspace planId
    await ctx.db.patch(transaction.workspaceId as any, {
      planId: transaction.planKey,
      updatedAt: now,
    });

    return {
      success: true,
      transactionId: transaction._id,
      planKey: transaction.planKey,
      workspaceId: transaction.workspaceId,
    };
  },
});

export const getByReference = query({
  args: { gatewayReference: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("paymentTransactions")
      .withIndex("by_gateway_ref", (q) => q.eq("gatewayReference", args.gatewayReference))
      .first();
  },
});

export const listByWorkspace = query({
  args: { workspaceId: v.union(v.id("workspaces"), v.string()) },
  handler: async (ctx, args) => {
    const list = await ctx.db
      .query("paymentTransactions")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId as any))
      .collect();

    return list.sort((a, b) => b.createdAt - a.createdAt);
  },
});
