import { query, mutation } from "./_generated/server.js";
import { v } from "convex/values";

export const listByWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const payments = await ctx.db
      .query("manualPayments")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .collect();

    // Attach admin details if available
    const enriched = await Promise.all(
      payments.map(async (p) => {
        const adminUser = await ctx.db.get(p.recordedBy);
        return {
          ...p,
          recordedByName: adminUser?.name || "Admin",
          recordedByEmail: adminUser?.email || "",
        };
      })
    );

    return enriched;
  },
});

export const recordPayment = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    planKey: v.string(), // "standard" | "premium"
    amount: v.number(), // in kobo
    currency: v.optional(v.string()), // "NGN"
    billingCycle: v.string(), // "monthly" | "annual"
    paymentReference: v.string(),
    paymentMethod: v.string(), // "bank_transfer" | "cash" | "pos" | "cheque" | "other"
    paidAt: v.optional(v.number()),
    recordedBy: v.id("users"),
    notes: v.optional(v.string()),
    extensionDays: v.optional(v.number()), // e.g. 30 for monthly, 365 for annual
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const paidAt = args.paidAt || now;
    const currency = args.currency || "NGN";
    const extensionDays = args.extensionDays || (args.billingCycle === "annual" ? 365 : 30);

    // 1. Insert manual payment record
    const paymentId = await ctx.db.insert("manualPayments", {
      workspaceId: args.workspaceId,
      planKey: args.planKey,
      amount: args.amount,
      currency,
      billingCycle: args.billingCycle,
      paymentReference: args.paymentReference,
      paymentMethod: args.paymentMethod,
      paidAt,
      recordedBy: args.recordedBy,
      notes: args.notes,
      createdAt: now,
    });

    // 2. Fetch or create subscription record
    const existingSub = await ctx.db
      .query("subscriptions")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    // Determine new period end: either from existing valid end date, or from today + extensionDays
    const baseDate = existingSub && existingSub.currentPeriodEnd > now
      ? existingSub.currentPeriodEnd
      : now;
    const newPeriodEnd = baseDate + extensionDays * 86_400_000;

    if (existingSub) {
      await ctx.db.patch(existingSub._id, {
        planKey: args.planKey,
        status: "active",
        currentPeriodEnd: newPeriodEnd,
        cancelAtPeriodEnd: false,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("subscriptions", {
        workspaceId: args.workspaceId,
        planKey: args.planKey,
        status: "active",
        currentPeriodStart: now,
        currentPeriodEnd: newPeriodEnd,
        cancelAtPeriodEnd: false,
        createdAt: now,
        updatedAt: now,
      });
    }

    // 3. Sync workspace planId
    await ctx.db.patch(args.workspaceId, {
      planId: args.planKey,
      updatedAt: now,
    });

    return {
      paymentId,
      workspaceId: args.workspaceId,
      planKey: args.planKey,
      currentPeriodEnd: newPeriodEnd,
      status: "active",
    };
  },
});
