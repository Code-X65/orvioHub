import { mutation, MutationCtx } from "./_generated/server.js";
import { v } from "convex/values";

export const handleWebhook = mutation({
  args: {
    event: v.string(),
    data: v.any(),
  },
  handler: async (ctx, args) => {
    const { event, data } = args;

    switch (event) {
      case "charge.success":
        await handlePaymentSuccess(ctx, data);
        break;

      case "subscription.create":
        await handleSubscriptionCreate(ctx, data);
        break;

      case "invoice.payment_success":
        await handleInvoicePayment(ctx, data);
        break;

      case "subscription.disable":
        await handleSubscriptionCancel(ctx, data);
        break;

      default:
        console.log("Unhandled Paystack event:", event);
    }

    return { status: "processed" };
  },
});

async function handlePaymentSuccess(ctx: MutationCtx, data: any) {
  const { reference, amount, paid_at, authorization, metadata } = data;
  const paidAmountNaira = (amount || 0) / 100;
  const paidTime = paid_at ? new Date(paid_at).getTime() : Date.now();

  // Find payment by reference
  let payment = reference
    ? await ctx.db
        .query("payments")
        .withIndex("by_reference", (q) => q.eq("reference", reference))
        .first()
    : null;

  let workspaceId = payment?.workspaceId;
  if (!workspaceId && metadata?.workspaceId) {
    workspaceId = metadata.workspaceId as any;
  }

  if (payment) {
    await ctx.db.patch(payment._id, {
      status: "completed",
      paystackPaymentId: String(data.id || ""),
      paystackAuthorization: authorization?.authorization_code,
      completedAt: paidTime,
    });

    if (payment.invoiceId) {
      const invoice = await ctx.db.get(payment.invoiceId);
      if (invoice) {
        await ctx.db.patch(invoice._id, {
          status: "paid",
          paidAt: paidTime,
          paymentMethod: "paystack",
          paystackPaymentId: String(data.id || ""),
        });
      }
    }

    if (payment.subscriptionId) {
      const subscription: any = await ctx.db.get(payment.subscriptionId);
      if (subscription) {
        const interval = subscription.billingInterval || "monthly";
        const periodDays = interval === "annual" ? 365 : 30;
        await ctx.db.patch(subscription._id, {
          planKey: "standard",
          status: "active",
          lastPaymentDate: paidTime,
          nextPaymentDate: paidTime + periodDays * 86_400_000,
          currentPeriodStart: paidTime,
          currentPeriodEnd: paidTime + periodDays * 86_400_000,
          updatedAt: Date.now(),
        });

        if (subscription.workspaceId) {
          await ctx.db.patch(subscription.workspaceId, {
            planId: "standard",
            updatedAt: Date.now(),
          });
        }
      }
    }
  } else if (workspaceId) {
    // If no existing payment record, find subscription by workspace
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId!))
      .first();

    if (subscription) {
      const interval = subscription.billingInterval || "monthly";
      const periodDays = interval === "annual" ? 365 : 30;

      // Create invoice
      const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const invoiceId = await ctx.db.insert("invoices", {
        workspaceId,
        subscriptionId: subscription._id,
        invoiceNumber,
        status: "paid",
        amount: paidAmountNaira,
        currency: "NGN",
        dueDate: paidTime,
        paidAt: paidTime,
        paymentMethod: "paystack",
        paystackPaymentId: String(data.id || ""),
        items: [
          {
            description: `Orviohub Standard Subscription (${interval === "annual" ? "Annual" : "Monthly"})`,
            quantity: 1,
            unitPrice: paidAmountNaira,
            total: paidAmountNaira,
          },
        ],
        createdAt: Date.now(),
      });

      // Record payment
      await ctx.db.insert("payments", {
        workspaceId,
        invoiceId,
        subscriptionId: subscription._id,
        amount: paidAmountNaira,
        currency: "NGN",
        paymentMethod: "paystack",
        reference,
        paystackPaymentId: String(data.id || ""),
        paystackAuthorization: authorization?.authorization_code,
        status: "completed",
        createdAt: Date.now(),
        completedAt: paidTime,
      });

      // Upgrade subscription to standard active
      await ctx.db.patch(subscription._id, {
        planKey: "standard",
        status: "active",
        lastPaymentDate: paidTime,
        nextPaymentDate: paidTime + periodDays * 86_400_000,
        currentPeriodStart: paidTime,
        currentPeriodEnd: paidTime + periodDays * 86_400_000,
        trialEnd: undefined,
        updatedAt: Date.now(),
      });

      await ctx.db.patch(workspaceId, {
        planId: "standard",
        updatedAt: Date.now(),
      });
    }
  }
}

async function handleSubscriptionCreate(ctx: MutationCtx, data: any) {
  const { subscription_code, customer, plan } = data;
  const email = customer?.email?.toLowerCase()?.trim();
  if (!email) return;

  // Find user by email
  const user = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", email))
    .first();

  if (user) {
    const wsMembership = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (wsMembership) {
      const subscription = await ctx.db
        .query("subscriptions")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", wsMembership.workspaceId))
        .first();

      if (subscription) {
        await ctx.db.patch(subscription._id, {
          paystackSubscriptionId: subscription_code,
          planKey: "standard",
          status: "active",
          updatedAt: Date.now(),
        });
      }
    }
  }
}

async function handleInvoicePayment(ctx: MutationCtx, data: any) {
  const { subscription_code, paid, amount, paid_at } = data;
  if (!paid) return;

  const paidAmountNaira = (amount || 0) / 100;
  const paidTime = paid_at ? new Date(paid_at).getTime() : Date.now();

  const allSubs = await ctx.db.query("subscriptions").collect();
  const subscription = allSubs.find((s) => s.paystackSubscriptionId === subscription_code);

  if (subscription) {
    const interval = subscription.billingInterval || "monthly";
    const periodDays = interval === "annual" ? 365 : 30;

    await ctx.db.patch(subscription._id, {
      status: "active",
      lastPaymentDate: paidTime,
      nextPaymentDate: paidTime + periodDays * 86_400_000,
      currentPeriodStart: paidTime,
      currentPeriodEnd: paidTime + periodDays * 86_400_000,
      updatedAt: Date.now(),
    });
  }
}

async function handleSubscriptionCancel(ctx: MutationCtx, data: any) {
  const { subscription_code } = data;
  const allSubs = await ctx.db.query("subscriptions").collect();
  const subscription = allSubs.find((s) => s.paystackSubscriptionId === subscription_code);

  if (subscription) {
    await ctx.db.patch(subscription._id, {
      status: "canceled",
      updatedAt: Date.now(),
    });
  }
}
