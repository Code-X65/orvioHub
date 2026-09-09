import { query, mutation } from "./_generated/server.js";
import { v } from "convex/values";

export const listByOrganization = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    let payments = await ctx.db
      .query("manualPayments")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", args.organizationId))
      .order("desc")
      .collect();

    if (payments.length === 0) {
      // Fallback: primary workspace of the organization
      const ws = await ctx.db
        .query("workspaces")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", args.organizationId))
        .first();
      if (ws) {
        payments = await ctx.db
          .query("manualPayments")
          .withIndex("by_workspace", (q) => q.eq("workspaceId", ws._id))
          .order("desc")
          .collect();
      }
    }

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
    organizationId: v.optional(v.id("organizations")),
    workspaceId: v.optional(v.id("workspaces")),
    planKey: v.string(), // "standard" | "premium"
    amount: v.number(), // in kobo
    currency: v.optional(v.string()), // "NGN"
    billingCycle: v.string(), // "monthly" | "annual"
    paymentReference: v.string(),
    paymentMethod: v.string(), // "bank_transfer" | "cash" | "pos" | "cheque" | "manual" | "other"
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

    let orgId = args.organizationId;
    let wsId = args.workspaceId;

    if (!orgId && wsId) {
      const ws: any = await ctx.db.get(wsId);
      if (ws?.organizationId) orgId = ws.organizationId;
    }
    if (!wsId && orgId) {
      const ws = await ctx.db
        .query("workspaces")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", orgId!))
        .first();
      if (ws) wsId = ws._id;
    }

    // 1. Insert manual payment record
    const paymentId = await ctx.db.insert("manualPayments", {
      organizationId: orgId,
      workspaceId: wsId,
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
    let existingSub = null;
    if (orgId) {
      existingSub = await ctx.db
        .query("subscriptions")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", orgId!))
        .first();
    }
    if (!existingSub && wsId) {
      existingSub = await ctx.db
        .query("subscriptions")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", wsId!))
        .first();
    }

    // Determine new period end
    const baseDate = existingSub && existingSub.currentPeriodEnd > now
      ? existingSub.currentPeriodEnd
      : now;
    const newPeriodEnd = baseDate + extensionDays * 86_400_000;

    let subId;
    if (existingSub) {
      await ctx.db.patch(existingSub._id, {
        organizationId: orgId || existingSub.organizationId,
        planKey: args.planKey,
        status: "active",
        currentPeriodEnd: newPeriodEnd,
        cancelAtPeriodEnd: false,
        updatedAt: now,
      });
      subId = existingSub._id;
    } else {
      subId = await ctx.db.insert("subscriptions", {
        organizationId: orgId,
        workspaceId: wsId,
        planKey: args.planKey,
        status: "active",
        currentPeriodStart: now,
        currentPeriodEnd: newPeriodEnd,
        paymentMethod: "manual",
        amount: args.amount,
        currency,
        cancelAtPeriodEnd: false,
        createdAt: now,
        updatedAt: now,
      });
    }

    // 3. Record in payments table (org-scoped)
    const amountInNaira = Math.round(args.amount / 100);
    await ctx.db.insert("payments", {
      organizationId: orgId,
      workspaceId: wsId,
      userId: args.recordedBy,
      subscriptionId: subId,
      amount: amountInNaira > 0 ? amountInNaira : args.amount,
      currency,
      provider: "manual",
      providerReference: args.paymentReference,
      paymentMethod: "manual",
      reference: args.paymentReference,
      status: "success",
      createdAt: now,
      completedAt: now,
    });

    // 4. Sync workspace planId if workspace exists
    if (wsId) {
      await ctx.db.patch(wsId, {
        planId: args.planKey,
        updatedAt: now,
      });
    }

    return {
      paymentId,
      organizationId: orgId,
      workspaceId: wsId,
      planKey: args.planKey,
      currentPeriodEnd: newPeriodEnd,
      status: "active",
    };
  },
});
