import { query, mutation } from "./_generated/server.js";
import { v } from "convex/values";

export const getByWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    return invoices.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const getById = query({
  args: { invoiceId: v.id("invoices") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.invoiceId);
  },
});

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    billingInterval: v.union(v.literal("monthly"), v.literal("annual")),
    paymentMethod: v.union(v.literal("bank_transfer"), v.literal("paystack")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    const plan = await ctx.db
      .query("plans")
      .withIndex("by_key", (q) => q.eq("key", "standard"))
      .first();

    const monthlyPrice = plan?.price?.monthly || 7500;
    const annualPrice = plan?.price?.annual || 75000;
    const amount = args.billingInterval === "annual" ? annualPrice : monthlyPrice;
    const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

    const invoiceId = await ctx.db.insert("invoices", {
      workspaceId: args.workspaceId,
      subscriptionId: subscription ? subscription._id : undefined,
      invoiceNumber,
      status: "pending",
      amount,
      currency: "NGN",
      dueDate: now + 3 * 24 * 60 * 60 * 1000, // 3 days grace
      paymentMethod: args.paymentMethod,
      items: [
        {
          description: `Orviohub Standard (${args.billingInterval === "annual" ? "Annual" : "Monthly"})`,
          quantity: 1,
          unitPrice: amount,
          total: amount,
        },
      ],
      createdAt: now,
    });

    return { invoiceId, invoiceNumber, amount };
  },
});

export const createInvoice = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    subscriptionId: v.optional(v.id("subscriptions")),
    amount: v.number(),
    currency: v.optional(v.string()),
    dueDate: v.optional(v.number()),
    items: v.array(
      v.object({
        description: v.string(),
        quantity: v.number(),
        unitPrice: v.number(),
        total: v.number(),
      })
    ),
    paymentMethod: v.optional(v.union(v.literal("bank_transfer"), v.literal("paystack"))),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

    const invoiceId = await ctx.db.insert("invoices", {
      workspaceId: args.workspaceId,
      subscriptionId: args.subscriptionId,
      invoiceNumber,
      status: "pending",
      amount: args.amount,
      currency: args.currency || "NGN",
      dueDate: args.dueDate || now + 3 * 86_400_000,
      paymentMethod: args.paymentMethod,
      items: args.items,
      createdAt: now,
    });

    return await ctx.db.get(invoiceId);
  },
});

export const markAsPaid = mutation({
  args: {
    invoiceId: v.id("invoices"),
    paymentMethod: v.union(v.literal("bank_transfer"), v.literal("paystack")),
    paystackPaymentId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) throw new Error("Invoice not found");

    await ctx.db.patch(args.invoiceId, {
      status: "paid",
      paidAt: now,
      paymentMethod: args.paymentMethod,
      paystackPaymentId: args.paystackPaymentId,
    });

    return await ctx.db.get(args.invoiceId);
  },
});

