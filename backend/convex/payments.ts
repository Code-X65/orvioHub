import { query, mutation } from "./_generated/server.js";
import { v } from "convex/values";

export const getByWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    return payments.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const getPending = query({
  args: {
    paymentMethod: v.optional(v.union(v.literal("bank_transfer"), v.literal("paystack"))),
  },
  handler: async (ctx, args) => {
    let paymentsQuery = ctx.db.query("payments");

    if (args.paymentMethod) {
      const pm = args.paymentMethod;
      paymentsQuery = paymentsQuery.filter((q) =>
        q.and(q.eq(q.field("status"), "pending"), q.eq(q.field("paymentMethod"), pm))
      );
    } else {
      paymentsQuery = paymentsQuery.filter((q) => q.eq(q.field("status"), "pending"));
    }

    const pending = await paymentsQuery.collect();

    return await Promise.all(
      pending.map(async (payment) => {
        const workspace = payment.workspaceId ? await ctx.db.get(payment.workspaceId) : null;
        const invoice = payment.invoiceId ? await ctx.db.get(payment.invoiceId) : null;
        return {
          ...payment,
          workspace: workspace || { name: "Unknown Workspace" },
          invoice,
        };
      })
    );
  },
});

export const getBankDetails = query({
  args: { invoiceId: v.id("invoices") },
  handler: async (ctx, args) => {
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) throw new Error("Invoice not found");

    return {
      bankName: "Guaranty Trust Bank (GTBank)",
      accountNumber: "0123456789",
      accountName: "Orvio Technologies Limited",
      reference: invoice.invoiceNumber,
      amount: invoice.amount,
      secondaryBank: {
        bankName: "Providus Bank",
        accountNumber: "5401928374",
        accountName: "Orvio Technologies Limited",
      },
    };
  },
});

export const submitBankTransferProof = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    subscriptionId: v.id("subscriptions"),
    amount: v.number(),
    bankName: v.string(),
    accountNumber: v.string(),
    accountName: v.string(),
    reference: v.string(),
    proofOfPaymentUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // 1. Create pending invoice if not present
    const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
    const invoiceId = await ctx.db.insert("invoices", {
      workspaceId: args.workspaceId,
      subscriptionId: args.subscriptionId,
      invoiceNumber,
      status: "pending",
      amount: args.amount,
      currency: "NGN",
      dueDate: now + 3 * 86_400_000,
      paymentMethod: "bank_transfer",
      items: [
        {
          description: "Orviohub Standard Plan Subscription",
          quantity: 1,
          unitPrice: args.amount,
          total: args.amount,
        },
      ],
      createdAt: now,
    });

    // 2. Insert payment record
    const paymentId = await ctx.db.insert("payments", {
      workspaceId: args.workspaceId,
      invoiceId,
      subscriptionId: args.subscriptionId,
      amount: args.amount,
      currency: "NGN",
      paymentMethod: "bank_transfer",
      reference: args.reference,
      status: "pending",
      bankTransferDetails: {
        bankName: args.bankName,
        accountNumber: args.accountNumber,
        accountName: args.accountName,
        reference: args.reference,
        proofOfPaymentUrl: args.proofOfPaymentUrl,
      },
      createdAt: now,
    });

    return { paymentId, invoiceId };
  },
});

export const verifyBankTransfer = mutation({
  args: {
    paymentId: v.id("payments"),
    verified: v.boolean(),
    verifiedByUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const payment = await ctx.db.get(args.paymentId);
    if (!payment) throw new Error("Payment record not found");

    const now = Date.now();

    if (args.verified) {
      // 1. Mark payment as completed
      await ctx.db.patch(args.paymentId, {
        status: "completed",
        completedAt: now,
        bankTransferDetails: payment.bankTransferDetails
          ? {
              ...payment.bankTransferDetails,
              verifiedBy: args.verifiedByUserId,
              verifiedAt: now,
            }
          : undefined,
      });

      // 2. Update Invoice
      if (payment.invoiceId) {
        await ctx.db.patch(payment.invoiceId, {
          status: "paid",
          paidAt: now,
        });
      }

      // 3. Upgrade / Renew Subscription
      if (payment.subscriptionId) {
        const subscription: any = await ctx.db.get(payment.subscriptionId);
        if (subscription) {
          const interval = subscription.billingInterval || "monthly";
          const periodDays = interval === "annual" ? 365 : 30;

          await ctx.db.patch(subscription._id, {
            planKey: "standard",
            status: "active",
            paymentMethod: "bank_transfer",
            amount: payment.amount,
            lastPaymentDate: now,
            nextPaymentDate: now + periodDays * 86_400_000,
            currentPeriodStart: now,
            currentPeriodEnd: now + periodDays * 86_400_000,
            trialEnd: undefined,
            updatedAt: now,
          });

          if (subscription.workspaceId) {
            await ctx.db.patch(subscription.workspaceId, {
              planId: "standard",
              updatedAt: now,
            });
          }
        }
      }

      return { success: true, status: "completed" };
    } else {
      // Reject payment
      await ctx.db.patch(args.paymentId, {
        status: "failed",
        bankTransferDetails: payment.bankTransferDetails
          ? {
              ...payment.bankTransferDetails,
              verifiedBy: args.verifiedByUserId,
              verifiedAt: now,
            }
          : undefined,
      });

      return { success: true, status: "failed" };
    }
  },
});

export const verifyBankTransferPayment = verifyBankTransfer;

