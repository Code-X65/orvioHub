import { mutation, MutationCtx } from "./_generated/server.js";
import { v } from "convex/values";
import { resolveOrganization } from "./applications.js";

export const handleWebhook = mutation({
  args: {
    event: v.string(),
    data: v.any(),
    providerEventId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { event, data } = args;
    const eventId = args.providerEventId || String(data?.id || data?.reference || `evt_${Date.now()}`);

    // 1. Webhook Deduplication: Check if providerEventId already exists
    if (eventId) {
      const existingEvent = await ctx.db
        .query("billingEvents")
        .withIndex("by_provider_event_id", (q) => q.eq("providerEventId", eventId))
        .first();

      if (existingEvent) {
        await ctx.db.insert("auditLogs", {
          action: "billing.webhook_duplicate",
          resource: `webhook:${eventId}`,
          severity: "info",
          metadata: { eventId, eventType: event },
          timestamp: Date.now(),
        });
        return { status: "already_processed", eventId };
      }
    }

    // Insert billing event
    const billingEventId = await ctx.db.insert("billingEvents", {
      provider: "paystack",
      providerEventId: eventId,
      eventType: event,
      status: "received",
      payloadMetadata: data,
      createdAt: Date.now(),
    });

    try {
      switch (event) {
        case "charge.success":
          await handlePaymentSuccess(ctx, data, eventId);
          break;

        case "subscription.create":
          await handleSubscriptionCreate(ctx, data, eventId);
          break;

        case "invoice.payment_success":
          await handleInvoicePayment(ctx, data, eventId);
          break;

        case "subscription.disable":
          await handleSubscriptionCancel(ctx, data, eventId);
          break;

        default:
          console.log("Unhandled Paystack event:", event);
      }

      await ctx.db.patch(billingEventId, {
        status: "processed",
        processedAt: Date.now(),
      });
    } catch (err: any) {
      await ctx.db.patch(billingEventId, {
        status: "failed",
        errorMessage: err?.message || String(err),
      });
      throw err;
    }

    return { status: "processed", eventId };
  },
});

async function handlePaymentSuccess(ctx: MutationCtx, data: any, eventId?: string) {
  const { reference, amount, paid_at, authorization, metadata, customer } = data;
  const paidAmountNaira = (amount || 0) / 100;
  const paidTime = paid_at ? new Date(paid_at).getTime() : Date.now();

  // Find payment by reference
  let payment = reference
    ? await ctx.db
        .query("payments")
        .withIndex("by_reference", (q) => q.eq("reference", reference))
        .first()
    : null;

  let rawTargetId = payment?.organizationId || payment?.workspaceId || metadata?.organizationId || metadata?.workspaceId;
  let orgId = null;
  let workspaceId = null;

  if (rawTargetId) {
    const resolved = await resolveOrganization(ctx, String(rawTargetId));
    orgId = resolved.orgId;
    workspaceId = resolved.workspaceId;
  }

  // Resolve subscription
  let subscription: any = null;
  if (payment?.subscriptionId) {
    subscription = await ctx.db.get(payment.subscriptionId);
  } else if (orgId) {
    subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", orgId!))
      .first();
  } else if (workspaceId) {
    subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId!))
      .first();
  }

  const interval = subscription?.billingInterval || (paidAmountNaira >= 50000 ? "annual" : "monthly");
  const periodDays = interval === "annual" ? 365 : 30;
  const periodEnd = paidTime + periodDays * 86_400_000;

  if (subscription) {
    await ctx.db.patch(subscription._id, {
      planKey: "standard",
      selectedPlan: "standard",
      activePlan: "standard",
      status: "active",
      checkoutStatus: "completed",
      paymentStatus: "success",
      entitlementStatus: "active",
      billingInterval: interval,
      lastPaymentDate: paidTime,
      nextPaymentDate: periodEnd,
      currentPeriodStart: paidTime,
      currentPeriodEnd: periodEnd,
      lastPaymentReference: reference,
      trialStart: undefined,
      trialEnd: undefined,
      trialEndsAt: undefined,
      activatedAt: paidTime,
      paystackCustomerCode: customer?.customer_code || subscription.paystackCustomerCode,
      paystackSubscriptionCode: data.subscription_code || subscription.paystackSubscriptionCode,
      paystackPlanCode: data.plan?.plan_code || subscription.paystackPlanCode,
      updatedAt: Date.now(),
    });

    if (subscription.workspaceId) {
      await ctx.db.patch(subscription.workspaceId, {
        planId: "standard",
        status: "active",
        updatedAt: Date.now(),
      });

      // Update workspace entitlements for standard plan
      const existingEntitlements = await ctx.db
        .query("workspaceEntitlements")
        .withIndex("by_workspace", (q: any) => q.eq("workspaceId", subscription.workspaceId))
        .collect();

      const standardLimits: Record<string, number | undefined> = {
        branches: 3,
        members: 10,
        products: 5000,
        monthly_transactions: 5000,
        inventory: undefined,
      };

      for (const [key, limit] of Object.entries(standardLimits)) {
        const existing = existingEntitlements.find((e: any) => e.featureKey === key);
        if (existing) {
          await ctx.db.patch(existing._id, {
            planId: "standard",
            limitValue: limit,
            enabled: true,
            status: "active",
            effectiveUntil: periodEnd,
            updatedAt: Date.now(),
          });
        } else {
          await ctx.db.insert("workspaceEntitlements", {
            workspaceId: subscription.workspaceId,
            planId: "standard",
            featureKey: key,
            limitValue: limit,
            limitType: key === "inventory" ? "boolean" : "fixed",
            enabled: true,
            status: "active",
            effectiveFrom: paidTime,
            effectiveUntil: periodEnd,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        }
      }
    }
  }

  if (payment) {
    await ctx.db.patch(payment._id, {
      status: "completed",
      paystackPaymentId: String(data.id || ""),
      paystackAuthorization: authorization?.authorization_code,
      providerEventId: eventId,
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
  } else {
    // Record payment & invoice
    const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const invoiceId = await ctx.db.insert("invoices", {
      organizationId: orgId || undefined,
      workspaceId: workspaceId || undefined,
      subscriptionId: subscription?._id,
      invoiceNumber,
      status: "paid",
      amount: paidAmountNaira,
      currency: "NGN",
      dueDate: paidTime,
      paidAt: paidTime,
      paymentMethod: "paystack",
      paystackPaymentId: String(data.id || ""),
      paymentReference: reference,
      items: [
        {
          description: `Orviohub Standard Plan (${interval === "annual" ? "Annual" : "Monthly"})`,
          quantity: 1,
          unitPrice: paidAmountNaira,
          total: paidAmountNaira,
        },
      ],
      createdAt: Date.now(),
    });

    await ctx.db.insert("payments", {
      organizationId: orgId || undefined,
      workspaceId: workspaceId || undefined,
      invoiceId,
      subscriptionId: subscription?._id,
      amount: paidAmountNaira,
      currency: "NGN",
      paymentMethod: "paystack",
      reference,
      provider: "paystack",
      providerReference: reference,
      providerEventId: eventId,
      paystackPaymentId: String(data.id || ""),
      paystackAuthorization: authorization?.authorization_code,
      status: "completed",
      createdAt: Date.now(),
      completedAt: paidTime,
    });
  }

  // Update audit log
  if (orgId) {
    await ctx.db.insert("auditLogs", {
      organizationId: orgId,
      action: "billing.webhook_received",
      resource: `webhook:${eventId || reference}`,
      severity: "info",
      metadata: {
        event: "charge.success",
        reference,
        amount: paidAmountNaira,
      },
      timestamp: Date.now(),
      createdAt: Date.now(),
    });
  }
}

async function handleSubscriptionCreate(ctx: MutationCtx, data: any, eventId?: string) {
  const { subscription_code, customer, plan } = data;
  const email = customer?.email?.toLowerCase()?.trim();
  if (!email) return;

  const user = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", email))
    .first();

  if (user) {
    const orgMembership = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("role"), "OWNER"))
      .first();

    if (orgMembership) {
      const subscription = await ctx.db
        .query("subscriptions")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", orgMembership.organizationId))
        .first();

      if (subscription) {
        await ctx.db.patch(subscription._id, {
          paystackSubscriptionId: subscription_code,
          paystackSubscriptionCode: subscription_code,
          paystackCustomerCode: customer.customer_code,
          paystackPlanCode: plan?.plan_code,
          planKey: "standard",
          selectedPlan: "standard",
          activePlan: "standard",
          status: "active",
          updatedAt: Date.now(),
        });
      }
    }
  }
}

async function handleInvoicePayment(ctx: MutationCtx, data: any, eventId?: string) {
  const { subscription_code, paid, amount, paid_at } = data;
  if (!paid) return;

  const paidAmountNaira = (amount || 0) / 100;
  const paidTime = paid_at ? new Date(paid_at).getTime() : Date.now();

  const allSubs = await ctx.db.query("subscriptions").collect();
  const subscription = allSubs.find(
    (s) => s.paystackSubscriptionId === subscription_code || s.paystackSubscriptionCode === subscription_code
  );

  if (subscription) {
    const interval = subscription.billingInterval || "monthly";
    const periodDays = interval === "annual" ? 365 : 30;

    await ctx.db.patch(subscription._id, {
      status: "active",
      activePlan: "standard",
      lastPaymentDate: paidTime,
      nextPaymentDate: paidTime + periodDays * 86_400_000,
      currentPeriodStart: paidTime,
      currentPeriodEnd: paidTime + periodDays * 86_400_000,
      updatedAt: Date.now(),
    });
  }
}

async function handleSubscriptionCancel(ctx: MutationCtx, data: any, eventId?: string) {
  const { subscription_code } = data;
  const allSubs = await ctx.db.query("subscriptions").collect();
  const subscription = allSubs.find(
    (s) => s.paystackSubscriptionId === subscription_code || s.paystackSubscriptionCode === subscription_code
  );

  if (subscription) {
    await ctx.db.patch(subscription._id, {
      status: "canceled",
      activePlan: null,
      entitlementStatus: "inactive",
      cancelledAt: Date.now(),
      updatedAt: Date.now(),
    });
  }
}
