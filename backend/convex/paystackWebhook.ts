import { mutation, query, MutationCtx } from "./_generated/server.js";
import { v } from "convex/values";
import { resolveOrganization } from "./applications.js";
import { generateNextInvoiceNumber, generateNextReceiptNumber } from "./invoices.js";

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

        case "charge.failed":
          await handlePaymentFailed(ctx, data, eventId);
          break;

        case "subscription.create":
          await handleSubscriptionCreate(ctx, data, eventId);
          break;

        case "invoice.payment_success":
          await handleInvoicePayment(ctx, data, eventId);
          break;

        case "invoice.payment_failed":
          await handleInvoicePaymentFailed(ctx, data, eventId);
          break;

        case "invoice.update":
          await handleInvoiceUpdate(ctx, data, eventId);
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

  // Uniqueness rule: If payment already completed, replay safely without duplicate side effects
  if (payment && (payment.status === "completed" || payment.status === "success")) {
    return;
  }

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
    subscription = await ctx.db.get(payment.subscriptionId as any);
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

  const targetPlan = metadata?.planKey ||
    (paidAmountNaira >= 20000 && paidAmountNaira !== 75000 ? "premium" : subscription?.selectedPlan === "premium" ? "premium" : "standard");

  const interval = subscription?.billingInterval || (paidAmountNaira >= 50000 ? "annual" : "monthly");
  const periodDays = interval === "annual" ? 365 : 30;
  const periodEnd = paidTime + periodDays * 86_400_000;

  if (subscription) {
    const prevPlan = subscription.planKey || subscription.activePlan || "free_trial";
    const prevStatus = subscription.status || "trialing";

    await ctx.db.patch(subscription._id, {
      planKey: targetPlan,
      selectedPlan: targetPlan,
      activePlan: targetPlan,
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
      trialStatus: "converted",
      trialConvertedAt: subscription.trialConvertedAt || paidTime,
      trialStart: undefined,
      trialEnd: undefined,
      trialEndsAt: undefined,
      activatedAt: paidTime,
      paystackCustomerCode: customer?.customer_code || subscription.paystackCustomerCode,
      paystackSubscriptionCode: data.subscription_code || subscription.paystackSubscriptionCode,
      paystackPlanCode: data.plan?.plan_code || subscription.paystackPlanCode,
      updatedAt: Date.now(),
    });

    await ctx.db.insert("subscriptionHistory", {
      subscriptionId: subscription._id,
      workspaceId: subscription.workspaceId || subscription.organizationId,
      fromPlanKey: prevPlan,
      toPlanKey: targetPlan,
      fromStatus: prevStatus,
      toStatus: "active",
      reason: `Paystack charge.success for ref ${reference}`,
      metadata: {
        actorType: "webhook",
        actorId: "paystack",
        reference,
      },
      createdAt: Date.now(),
    });

    if (subscription.workspaceId) {
      await ctx.db.patch(subscription.workspaceId, {
        planId: targetPlan,
        status: "active",
        updatedAt: Date.now(),
      });

      // Update workspace entitlements for resolved plan
      const existingEntitlements = await ctx.db
        .query("workspaceEntitlements")
        .withIndex("by_workspace", (q: any) => q.eq("workspaceId", subscription.workspaceId))
        .collect();

      const planLimits: Record<string, number | undefined> = targetPlan === "premium" ? {
        branches: 10,
        members: 50,
        products: 25000,
        monthly_transactions: 25000,
        inventory: undefined,
      } : {
        branches: 3,
        members: 10,
        products: 5000,
        monthly_transactions: 5000,
        inventory: undefined,
      };

      for (const [key, limit] of Object.entries(planLimits)) {
        const existing = existingEntitlements.find((e: any) => e.featureKey === key);
        if (existing) {
          await ctx.db.patch(existing._id, {
            planId: targetPlan,
            limitValue: limit,
            enabled: true,
            status: "active",
            effectiveUntil: periodEnd,
            updatedAt: Date.now(),
          });
        } else {
          await ctx.db.insert("workspaceEntitlements", {
            workspaceId: subscription.workspaceId,
            planId: targetPlan,
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



  // Resolve billing snapshot information
  let orgDoc: any = null;
  if (orgId) {
    const normOrg = ctx.db.normalizeId("organizations", orgId);
    if (normOrg) orgDoc = await ctx.db.get(normOrg);
  }
  let wsDoc: any = null;
  if (workspaceId) {
    const normWs = ctx.db.normalizeId("workspaces", workspaceId);
    if (normWs) {
      wsDoc = await ctx.db.get(normWs);
      if (!orgDoc && wsDoc?.organizationId) {
        orgDoc = await ctx.db.get(wsDoc.organizationId);
      }
    }
  }

  const billingSnapshot = {
    organizationName: orgDoc?.name || wsDoc?.name || "Orviohub Organization",
    organizationAddress: orgDoc?.address || (orgDoc?.street ? `${orgDoc.street}, ${orgDoc.city || ""}, ${orgDoc.state || ""}, ${orgDoc.country || "Nigeria"}`.trim().replace(/^,\s*/, "") : "Lagos, Nigeria"),
    billingEmail: orgDoc?.billingEmail || orgDoc?.email || customer?.email || "billing@orviohub.com",
    billingPhone: orgDoc?.billingPhone || orgDoc?.phone || "",
    currency: "NGN",
    taxConfiguration: {
      taxStatus: "not_configured",
      taxRate: 0,
      taxName: "VAT (Not Configured)",
      taxAmount: 0,
    },
    capturedAt: paidTime,
  };

  const planTitle = targetPlan === "premium" ? "Premium Plan" : "Standard Plan";
  const intervalLabel = interval === "annual" ? "Annual" : "Monthly";

  const lineItems = [
    {
      description: `Orviohub ${planTitle} - ${intervalLabel}`,
      planKey: targetPlan,
      billingInterval: interval,
      quantity: 1,
      unitPrice: paidAmountNaira,
      subtotal: paidAmountNaira,
      discount: 0,
      tax: 0,
      total: paidAmountNaira,
    },
  ];

  let invoiceId = payment?.invoiceId;

  // If no existing invoice for this payment, look up or create one
  if (!invoiceId && reference) {
    const existingInv = await ctx.db
      .query("invoices")
      .withIndex("by_providerReference", (q: any) => q.eq("providerReference", reference))
      .first();

    if (existingInv) {
      invoiceId = existingInv._id;
    }
  }

  if (!invoiceId) {
    const invoiceNumber = await generateNextInvoiceNumber(ctx);
    invoiceId = await ctx.db.insert("invoices", {
      organizationId: orgId || undefined,
      workspaceId: workspaceId || undefined,
      subscriptionId: subscription?._id,
      invoiceNumber,
      invoiceType: "subscription",
      status: "paid",
      planKey: targetPlan,
      billingInterval: interval,
      amount: paidAmountNaira,
      amountSubtotal: paidAmountNaira,
      discountAmount: 0,
      taxAmount: 0,
      totalAmount: paidAmountNaira,
      amountPaid: paidAmountNaira,
      amountDue: 0,
      currency: "NGN",
      billingPeriodStart: paidTime,
      billingPeriodEnd: periodEnd,
      periodStart: paidTime,
      periodEnd: periodEnd,
      issueDate: paidTime,
      issuedAt: paidTime,
      dueDate: paidTime,
      paidAt: paidTime,
      provider: "paystack",
      providerReference: reference,
      providerTransactionId: String(data.id || ""),
      paymentReference: reference,
      paymentMethod: "paystack",
      paystackPaymentId: String(data.id || ""),
      billingSnapshot,
      lineItems,
      items: [
        {
          description: `Orviohub ${planTitle} (${intervalLabel})`,
          quantity: 1,
          unitPrice: paidAmountNaira,
          total: paidAmountNaira,
        },
      ],
      pdfGenerationStatus: "not_started",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await ctx.db.insert("auditLogs", {
      organizationId: orgId ? ctx.db.normalizeId("organizations", orgId) || undefined : undefined,
      action: "billing.invoice_created",
      resource: `invoice:${invoiceId}`,
      severity: "info",
      metadata: {
        invoiceId,
        invoiceNumber,
        reference,
        amount: paidAmountNaira,
        planKey: targetPlan,
      },
      timestamp: Date.now(),
      createdAt: Date.now(),
    });
  } else {
    // Patch existing invoice to paid
    await ctx.db.patch(invoiceId as any, {
      status: "paid",
      paidAt: paidTime,
      amountPaid: paidAmountNaira,
      amountDue: 0,
      providerReference: reference,
      paymentMethod: "paystack",
      paystackPaymentId: String(data.id || ""),
      updatedAt: Date.now(),
    });
  }

  let paymentId = payment?._id;
  if (payment) {
    await ctx.db.patch(payment._id, {
      invoiceId,
      status: "completed",
      paystackPaymentId: String(data.id || ""),
      paystackAuthorization: authorization?.authorization_code,
      providerEventId: eventId,
      paidAt: paidTime,
      completedAt: paidTime,
      updatedAt: Date.now(),
    });
  } else {
    paymentId = await ctx.db.insert("payments", {
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
      providerTransactionId: String(data.id || ""),
      providerEventId: eventId,
      paystackPaymentId: String(data.id || ""),
      paystackAuthorization: authorization?.authorization_code,
      status: "completed",
      paidAt: paidTime,
      createdAt: Date.now(),
      completedAt: paidTime,
      updatedAt: Date.now(),
    });
  }

  // Idempotently create payment receipt
  if (reference) {
    const existingReceipt = await ctx.db
      .query("receipts")
      .withIndex("by_providerReference", (q: any) => q.eq("providerReference", reference))
      .first();

    if (!existingReceipt) {
      const receiptNumber = await generateNextReceiptNumber(ctx);
      const receiptId = await ctx.db.insert("receipts", {
        receiptNumber,
        workspaceId: workspaceId || undefined,
        organizationId: orgId || undefined,
        subscriptionId: subscription?._id,
        invoiceId,
        paymentId,
        provider: "paystack",
        providerReference: reference,
        providerTransactionId: String(data.id || ""),
        amount: paidAmountNaira,
        currency: "NGN",
        paidAt: paidTime,
        paymentMethod: "paystack",
        planKey: targetPlan,
        billingInterval: interval,
        billingSnapshot,
        status: "valid",
        pdfGenerationStatus: "not_started",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      await ctx.db.insert("auditLogs", {
        organizationId: orgId ? ctx.db.normalizeId("organizations", orgId) || undefined : undefined,
        action: "billing.receipt_created",
        resource: `receipt:${receiptId}`,
        severity: "info",
        metadata: {
          receiptId,
          receiptNumber,
          invoiceId,
          paymentId,
          reference,
          amount: paidAmountNaira,
        },
        timestamp: Date.now(),
        createdAt: Date.now(),
      });
    }
  }

  // Update audit log
  if (orgId) {
    await ctx.db.insert("auditLogs", {
      organizationId: orgId ? ctx.db.normalizeId("organizations", orgId) || undefined : undefined,
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
        // Derive plan tier: prefer the subscription's stored planKey if already resolved;
        // otherwise look up the Paystack plan code in the plans table.
        let resolvedPlanKey: string = subscription.planKey || subscription.selectedPlan || "standard";
        if (plan?.plan_code) {
          const allPlans = await ctx.db.query("plans").collect();
          const matchedPlan = allPlans.find((p: any) => p.paystackPlanCode === plan.plan_code);
          if (matchedPlan?.key && ["standard", "premium"].includes(matchedPlan.key)) {
            resolvedPlanKey = matchedPlan.key;
          }
        }
        // Normalize legacy values
        if (resolvedPlanKey === "free" || resolvedPlanKey === "free_trial" || resolvedPlanKey === "trial") {
          resolvedPlanKey = "standard";
        }

        await ctx.db.patch(subscription._id, {
          paystackSubscriptionId: subscription_code,
          paystackSubscriptionCode: subscription_code,
          paystackCustomerCode: customer.customer_code,
          paystackPlanCode: plan?.plan_code,
          planKey: resolvedPlanKey,
          selectedPlan: resolvedPlanKey,
          activePlan: resolvedPlanKey,
          status: "active",
          updatedAt: Date.now(),
        });
      }
    }
  }
}

async function handlePaymentFailed(ctx: MutationCtx, data: any, eventId?: string) {
  const { reference } = data;
  if (!reference) return;

  const payment = await ctx.db
    .query("payments")
    .withIndex("by_reference", (q) => q.eq("reference", reference))
    .first();

  if (payment) {
    await ctx.db.patch(payment._id, {
      status: "failed",
    });
  }
}

async function handleInvoicePaymentFailed(ctx: MutationCtx, data: any, eventId?: string) {
  const { subscription_code } = data;
  if (!subscription_code) return;

  const allSubs = await ctx.db.query("subscriptions").collect();
  const subscription = allSubs.find(
    (s) => s.paystackSubscriptionId === subscription_code || s.paystackSubscriptionCode === subscription_code
  );

  if (subscription) {
    await ctx.db.patch(subscription._id, {
      status: "past_due",
      updatedAt: Date.now(),
    });
  }
}

async function handleInvoiceUpdate(ctx: MutationCtx, data: any, eventId?: string) {
  // Invoice state sync if needed
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
    // Preserve the existing activePlan; do not overwrite Premium with Standard
    const existingPlan = subscription.activePlan || subscription.planKey || "standard";
    const safePlan = ["standard", "premium"].includes(existingPlan) ? existingPlan : "standard";

    await ctx.db.patch(subscription._id, {
      status: "active",
      activePlan: safePlan,
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

/**
 * Superadmin / System: List billing events (optionally filtered by status)
 */
export const listBillingEventsQuery = query({
  args: {
    status: v.optional(v.union(v.literal("received"), v.literal("processed"), v.literal("ignored"), v.literal("failed"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const eventsQuery = args.status
      ? ctx.db.query("billingEvents").withIndex("by_status", (q) => q.eq("status", args.status!))
      : ctx.db.query("billingEvents");
    const events = await eventsQuery.order("desc").take(args.limit || 50);
    return events;
  },
});

export const listBillingEvents = mutation({
  args: {
    status: v.optional(v.union(v.literal("received"), v.literal("processed"), v.literal("ignored"), v.literal("failed"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const eventsQuery = args.status
      ? ctx.db.query("billingEvents").withIndex("by_status", (q) => q.eq("status", args.status!))
      : ctx.db.query("billingEvents");
    const events = await eventsQuery.order("desc").take(args.limit || 50);
    return events;
  },
});

/**
 * Superadmin / System: Manually retry processing a failed or pending webhook event
 */
export const retryFailedWebhook = mutation({
  args: {
    billingEventId: v.optional(v.id("billingEvents")),
    providerEventId: v.optional(v.string()),
    adminUserId: v.optional(v.union(v.id("users"), v.string())),
  },
  handler: async (ctx, args) => {
    let eventDoc = null;
    if (args.billingEventId) {
      eventDoc = await ctx.db.get(args.billingEventId);
    } else if (args.providerEventId) {
      eventDoc = await ctx.db
        .query("billingEvents")
        .withIndex("by_provider_event_id", (q) => q.eq("providerEventId", args.providerEventId!))
        .first();
    }

    if (!eventDoc) {
      throw new Error("BILLING_EVENT_NOT_FOUND");
    }

    const { eventType, payloadMetadata, providerEventId } = eventDoc;
    const now = Date.now();

    try {
      switch (eventType) {
        case "charge.success":
          await handlePaymentSuccess(ctx, payloadMetadata, providerEventId);
          break;
        case "subscription.create":
          await handleSubscriptionCreate(ctx, payloadMetadata, providerEventId);
          break;
        case "invoice.payment_success":
          await handleInvoicePayment(ctx, payloadMetadata, providerEventId);
          break;
        case "subscription.disable":
          await handleSubscriptionCancel(ctx, payloadMetadata, providerEventId);
          break;
        default:
          console.log("Unhandled retry event type:", eventType);
      }

      await ctx.db.patch(eventDoc._id, {
        status: "processed",
        processedAt: now,
        errorMessage: undefined,
      });

      await ctx.db.insert("auditLogs", {
        actorId: args.adminUserId ? String(args.adminUserId) : undefined,
        actorUserId: args.adminUserId ? String(args.adminUserId) : undefined,
        action: "billing.webhook_retried_success",
        resource: `webhook:${providerEventId}`,
        severity: "info",
        metadata: {
          billingEventId: eventDoc._id,
          providerEventId,
          eventType,
        },
        timestamp: now,
      });

      return { success: true, status: "processed", eventId: providerEventId };
    } catch (err: any) {
      await ctx.db.patch(eventDoc._id, {
        status: "failed",
        errorMessage: `Retry failed: ${err?.message || String(err)}`,
      });

      await ctx.db.insert("auditLogs", {
        actorId: args.adminUserId ? String(args.adminUserId) : undefined,
        actorUserId: args.adminUserId ? String(args.adminUserId) : undefined,
        action: "billing.webhook_retried_failed",
        resource: `webhook:${providerEventId}`,
        severity: "high",
        metadata: {
          billingEventId: eventDoc._id,
          providerEventId,
          error: err?.message || String(err),
        },
        timestamp: now,
      });

      throw err;
    }
  },
});

