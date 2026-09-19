import { query, mutation, MutationCtx } from "./_generated/server.js";
import { v } from "convex/values";
import { resolveOrganization } from "./applications.js";

/**
 * Generate next sequential invoice number atomically: ORV-2026-000001, ORV-2026-000002...
 */
export async function generateNextInvoiceNumber(ctx: { db: any }): Promise<string> {
  const currentYear = new Date().getFullYear();
  const scope = `invoice_${currentYear}`;
  const now = Date.now();

  const counter = await ctx.db
    .query("invoiceCounters")
    .withIndex("by_scope", (q: any) => q.eq("scope", scope))
    .first();

  let nextSeq = 1;
  if (counter) {
    nextSeq = (counter.currentSeq || 0) + 1;
    await ctx.db.patch(counter._id, {
      currentSeq: nextSeq,
      updatedAt: now,
    });
  } else {
    // Check existing count to ensure no collision if counter table was just initialized
    const existingInvoices = await ctx.db.query("invoices").collect();
    nextSeq = existingInvoices.length + 1;
    await ctx.db.insert("invoiceCounters", {
      scope,
      currentSeq: nextSeq,
      updatedAt: now,
    });
  }

  return `ORV-${currentYear}-${String(nextSeq).padStart(6, "0")}`;
}

/**
 * Generate next sequential receipt number atomically: REC-2026-000001...
 */
export async function generateNextReceiptNumber(ctx: { db: any }): Promise<string> {
  const currentYear = new Date().getFullYear();
  const scope = `receipt_${currentYear}`;
  const now = Date.now();

  const counter = await ctx.db
    .query("invoiceCounters")
    .withIndex("by_scope", (q: any) => q.eq("scope", scope))
    .first();

  let nextSeq = 1;
  if (counter) {
    nextSeq = (counter.currentSeq || 0) + 1;
    await ctx.db.patch(counter._id, {
      currentSeq: nextSeq,
      updatedAt: now,
    });
  } else {
    const existingReceipts = await ctx.db.query("receipts").collect();
    nextSeq = existingReceipts.length + 1;
    await ctx.db.insert("invoiceCounters", {
      scope,
      currentSeq: nextSeq,
      updatedAt: now,
    });
  }

  return `REC-${currentYear}-${String(nextSeq).padStart(6, "0")}`;
}

/**
 * Builds an immutable snapshot of organization identity & tax settings at invoice creation.
 */
async function buildBillingSnapshot(ctx: MutationCtx, orgId?: string, workspaceId?: string, customData?: any) {
  let org: any = null;
  let ws: any = null;

  if (orgId) {
    const normOrgId = ctx.db.normalizeId("organizations", orgId);
    if (normOrgId) org = await ctx.db.get(normOrgId);
  }

  if (workspaceId) {
    const normWsId = ctx.db.normalizeId("workspaces", workspaceId);
    if (normWsId) {
      ws = await ctx.db.get(normWsId);
      if (!org && ws?.organizationId) {
        org = await ctx.db.get(ws.organizationId);
      }
    }
  }

  const orgName = customData?.organizationName || org?.name || ws?.name || "Orviohub Organization";
  const orgAddress = customData?.organizationAddress || org?.address || (org?.street ? `${org.street}, ${org.city || ""}, ${org.state || ""}, ${org.country || "Nigeria"}`.trim().replace(/^,\s*/, "") : "Lagos, Nigeria");
  const billingEmail = customData?.billingEmail || org?.billingEmail || org?.email || "billing@orviohub.com";
  const billingPhone = customData?.billingPhone || org?.billingPhone || org?.phone || "";

  return {
    organizationName: orgName,
    organizationAddress: orgAddress,
    billingEmail,
    billingPhone,
    currency: "NGN",
    taxConfiguration: {
      taxStatus: "not_configured",
      taxRate: 0,
      taxName: "VAT (Not Configured)",
      taxAmount: 0,
    },
    capturedAt: Date.now(),
  };
}

/**
 * Idempotent subscription invoice generation.
 */
export const generateSubscriptionInvoice = mutation({
  args: {
    workspaceId: v.optional(v.union(v.id("workspaces"), v.id("organizations"), v.string())),
    organizationId: v.optional(v.union(v.id("organizations"), v.id("workspaces"), v.string())),
    billingAccountId: v.optional(v.union(v.id("billingAccounts"), v.string())),
    subscriptionId: v.optional(v.union(v.id("subscriptions"), v.string())),
    paymentId: v.optional(v.union(v.id("payments"), v.string())),
    providerReference: v.optional(v.string()),
    providerTransactionId: v.optional(v.string()),
    planKey: v.union(v.literal("standard"), v.literal("premium")),
    billingInterval: v.union(v.literal("monthly"), v.literal("annual")),
    amountSubtotal: v.number(),
    discountAmount: v.optional(v.number()),
    taxAmount: v.optional(v.number()),
    totalAmount: v.number(),
    amountPaid: v.optional(v.number()),
    billingPeriodStart: v.optional(v.number()),
    billingPeriodEnd: v.optional(v.number()),
    paymentMethod: v.optional(v.string()),
    paidAt: v.optional(v.number()),
    customSnapshot: v.optional(v.any()),
    lineItems: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // 1. Idempotency Check by providerReference
    if (args.providerReference) {
      const existingByRef = await ctx.db
        .query("invoices")
        .withIndex("by_providerReference", (q: any) => q.eq("providerReference", args.providerReference!))
        .first();

      if (existingByRef) {
        return existingByRef;
      }
    }

    // 2. Idempotency Check by subscriptionId and period
    if (args.subscriptionId && args.billingPeriodStart && args.billingPeriodEnd) {
      const existingInvoices = await ctx.db
        .query("invoices")
        .withIndex("by_subscription", (q: any) => q.eq("subscriptionId", args.subscriptionId as any))
        .collect();

      const duplicate = existingInvoices.find(
        (inv: any) =>
          inv.status === "paid" &&
          inv.billingPeriodStart === args.billingPeriodStart &&
          inv.billingPeriodEnd === args.billingPeriodEnd &&
          inv.planKey === args.planKey
      );

      if (duplicate) {
        return duplicate;
      }
    }

    // 3. Resolve Organization / Workspace IDs
    let orgId = args.organizationId ? String(args.organizationId) : undefined;
    let wsId = args.workspaceId ? String(args.workspaceId) : undefined;

    if (wsId && !orgId) {
      const resolved = await resolveOrganization(ctx, wsId);
      orgId = resolved.orgId ? String(resolved.orgId) : undefined;
      wsId = resolved.workspaceId ? String(resolved.workspaceId) : wsId;
    }

    // 4. Generate next sequential invoice number
    const invoiceNumber = await generateNextInvoiceNumber(ctx);

    // 5. Build immutable billing snapshot
    const billingSnapshot = await buildBillingSnapshot(ctx, orgId, wsId, args.customSnapshot);

    // 6. Build line items
    const intervalLabel = args.billingInterval === "annual" ? "Annual" : "Monthly";
    const planName = args.planKey === "premium" ? "Premium Plan" : "Standard Plan";
    const subtotal = args.amountSubtotal || args.totalAmount;
    const discount = args.discountAmount || 0;
    const tax = args.taxAmount || 0;
    const total = args.totalAmount;

    const lineItems = args.lineItems && Array.isArray(args.lineItems) && args.lineItems.length > 0
      ? args.lineItems
      : [
          {
            description: `Orviohub ${planName} - ${intervalLabel}`,
            planKey: args.planKey,
            billingInterval: args.billingInterval,
            quantity: 1,
            unitPrice: subtotal,
            subtotal,
            discount,
            tax,
            total,
          },
        ];

    const isPaid = (args.amountPaid && args.amountPaid >= total) || !!args.paidAt || !!args.paymentId;
    const status = isPaid ? "paid" : "pending";
    const paidTimestamp = isPaid ? (args.paidAt || now) : undefined;

    const invoiceId = await ctx.db.insert("invoices", {
      organizationId: orgId as any,
      workspaceId: wsId as any,
      billingAccountId: args.billingAccountId as any,
      subscriptionId: args.subscriptionId as any,
      paymentId: args.paymentId as any,
      invoiceNumber,
      invoiceType: "subscription",
      status,
      planKey: args.planKey,
      billingInterval: args.billingInterval,
      amount: total,
      amountSubtotal: subtotal,
      discountAmount: discount,
      taxAmount: tax,
      totalAmount: total,
      amountPaid: isPaid ? total : (args.amountPaid || 0),
      amountDue: isPaid ? 0 : Math.max(0, total - (args.amountPaid || 0)),
      currency: "NGN",
      billingPeriodStart: args.billingPeriodStart || now,
      billingPeriodEnd: args.billingPeriodEnd || (now + (args.billingInterval === "annual" ? 365 : 30) * 86_400_000),
      periodStart: args.billingPeriodStart || now,
      periodEnd: args.billingPeriodEnd || (now + (args.billingInterval === "annual" ? 365 : 30) * 86_400_000),
      issueDate: now,
      issuedAt: now,
      dueDate: isPaid ? now : now + 3 * 86_400_000,
      paidAt: paidTimestamp,
      provider: "paystack",
      providerReference: args.providerReference,
      providerTransactionId: args.providerTransactionId,
      paymentReference: args.providerReference,
      paymentMethod: args.paymentMethod || "paystack",
      billingSnapshot,
      lineItems,
      items: lineItems.map((item: any) => ({
        description: item.description,
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice || item.subtotal,
        total: item.total || item.subtotal,
      })),
      pdfGenerationStatus: "not_started",
      createdAt: now,
      updatedAt: now,
    });

    // Emits audit log
    await ctx.db.insert("auditLogs", {
      organizationId: orgId ? ctx.db.normalizeId("organizations", orgId) || undefined : undefined,
      action: "billing.invoice_created",
      resource: `invoice:${invoiceId}`,
      severity: "info",
      metadata: {
        invoiceId,
        invoiceNumber,
        workspaceId: wsId,
        subscriptionId: args.subscriptionId,
        paymentId: args.paymentId,
        providerReference: args.providerReference,
        amount: total,
        currency: "NGN",
        planKey: args.planKey,
        billingInterval: args.billingInterval,
      },
      timestamp: now,
      createdAt: now,
    });

    if (isPaid) {
      await ctx.db.insert("auditLogs", {
        organizationId: orgId ? ctx.db.normalizeId("organizations", orgId) || undefined : undefined,
        action: "billing.invoice_paid",
        resource: `invoice:${invoiceId}`,
        severity: "info",
        metadata: {
          invoiceId,
          invoiceNumber,
          paymentId: args.paymentId,
          amountPaid: total,
        },
        timestamp: now,
        createdAt: now,
      });
    }

    return await ctx.db.get(invoiceId);
  },
});

/**
 * Idempotent payment receipt generation.
 */
export const generatePaymentReceipt = mutation({
  args: {
    invoiceId: v.optional(v.union(v.id("invoices"), v.string())),
    paymentId: v.optional(v.union(v.id("payments"), v.string())),
    workspaceId: v.optional(v.union(v.id("workspaces"), v.id("organizations"), v.string())),
    organizationId: v.optional(v.union(v.id("organizations"), v.id("workspaces"), v.string())),
    billingAccountId: v.optional(v.union(v.id("billingAccounts"), v.string())),
    subscriptionId: v.optional(v.union(v.id("subscriptions"), v.string())),
    providerReference: v.string(),
    providerTransactionId: v.optional(v.string()),
    amount: v.number(),
    currency: v.optional(v.string()),
    paidAt: v.number(),
    paymentMethod: v.optional(v.string()),
    planKey: v.optional(v.string()),
    billingInterval: v.optional(v.string()),
    customSnapshot: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // 1. Idempotency Check by providerReference
    const existingReceipt = await ctx.db
      .query("receipts")
      .withIndex("by_providerReference", (q: any) => q.eq("providerReference", args.providerReference))
      .first();

    if (existingReceipt) {
      return existingReceipt;
    }

    // 2. Resolve Organization / Workspace IDs
    let orgId = args.organizationId ? String(args.organizationId) : undefined;
    let wsId = args.workspaceId ? String(args.workspaceId) : undefined;

    if (wsId && !orgId) {
      const resolved = await resolveOrganization(ctx, wsId);
      orgId = resolved.orgId ? String(resolved.orgId) : undefined;
      wsId = resolved.workspaceId ? String(resolved.workspaceId) : wsId;
    }

    // 3. Build snapshot and generate receipt number
    const receiptNumber = await generateNextReceiptNumber(ctx);
    const billingSnapshot = await buildBillingSnapshot(ctx, orgId, wsId, args.customSnapshot);

    const receiptId = await ctx.db.insert("receipts", {
      receiptNumber,
      workspaceId: wsId as any,
      organizationId: orgId as any,
      billingAccountId: args.billingAccountId as any,
      subscriptionId: args.subscriptionId as any,
      invoiceId: args.invoiceId as any,
      paymentId: args.paymentId as any,
      provider: "paystack",
      providerReference: args.providerReference,
      providerTransactionId: args.providerTransactionId,
      amount: args.amount,
      currency: args.currency || "NGN",
      paidAt: args.paidAt,
      paymentMethod: args.paymentMethod || "paystack",
      planKey: args.planKey || "standard",
      billingInterval: args.billingInterval || "monthly",
      billingSnapshot,
      status: "valid",
      pdfGenerationStatus: "not_started",
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("auditLogs", {
      organizationId: orgId ? ctx.db.normalizeId("organizations", orgId) || undefined : undefined,
      action: "billing.receipt_created",
      resource: `receipt:${receiptId}`,
      severity: "info",
      metadata: {
        receiptId,
        receiptNumber,
        invoiceId: args.invoiceId,
        paymentId: args.paymentId,
        providerReference: args.providerReference,
        amount: args.amount,
      },
      timestamp: now,
      createdAt: now,
    });

    return await ctx.db.get(receiptId);
  },
});

/**
 * Void an invoice with explicit reason and audit log.
 */
export const voidInvoice = mutation({
  args: {
    invoiceId: v.union(v.id("invoices"), v.string()),
    reason: v.string(),
    actorUserId: v.optional(v.union(v.id("users"), v.string())),
    actorRole: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let invoice: any = null;
    const normId = ctx.db.normalizeId("invoices", args.invoiceId);
    if (normId) {
      invoice = await ctx.db.get(normId);
    } else {
      invoice = await ctx.db
        .query("invoices")
        .withIndex("by_invoiceNumber", (q: any) => q.eq("invoiceNumber", args.invoiceId))
        .first();
    }

    if (!invoice) throw new Error("Invoice not found.");
    if (invoice.status === "void") return invoice;

    const now = Date.now();
    await ctx.db.patch(invoice._id, {
      status: "void",
      voidReason: args.reason,
      voidedAt: now,
      voidedBy: args.actorUserId ? String(args.actorUserId) : undefined,
      updatedAt: now,
    });

    // Record adjustment entry
    await ctx.db.insert("billingAdjustments", {
      workspaceId: invoice.workspaceId,
      organizationId: invoice.organizationId,
      billingAccountId: invoice.billingAccountId,
      invoiceId: invoice._id,
      paymentId: invoice.paymentId,
      adjustmentType: "invoice_void",
      amount: invoice.amount || 0,
      currency: invoice.currency || "NGN",
      reason: args.reason,
      providerReference: invoice.providerReference,
      actorUserId: args.actorUserId,
      actorRole: args.actorRole || "superadmin",
      createdAt: now,
    });

    await ctx.db.insert("auditLogs", {
      organizationId: invoice.organizationId ? ctx.db.normalizeId("organizations", invoice.organizationId) || undefined : undefined,
      action: "billing.invoice_voided",
      resource: `invoice:${invoice._id}`,
      severity: "warning",
      metadata: {
        invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        reason: args.reason,
        actorUserId: args.actorUserId,
      },
      timestamp: now,
      createdAt: now,
    });

    return await ctx.db.get(invoice._id);
  },
});

/**
 * Record a billing adjustment or refund.
 */
export const recordBillingAdjustment = mutation({
  args: {
    invoiceId: v.union(v.id("invoices"), v.string()),
    adjustmentType: v.union(
      v.literal("credit_note"),
      v.literal("debit_adjustment"),
      v.literal("refund"),
      v.literal("partial_refund"),
      v.literal("invoice_void"),
      v.literal("replacement_invoice")
    ),
    amount: v.number(),
    reason: v.string(),
    providerReference: v.optional(v.string()),
    actorUserId: v.optional(v.union(v.id("users"), v.string())),
    actorRole: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    let invoice: any = null;
    const normId = ctx.db.normalizeId("invoices", args.invoiceId);
    if (normId) {
      invoice = await ctx.db.get(normId);
    } else {
      invoice = await ctx.db
        .query("invoices")
        .withIndex("by_invoiceNumber", (q: any) => q.eq("invoiceNumber", args.invoiceId))
        .first();
    }

    if (!invoice) throw new Error("Invoice not found.");

    const now = Date.now();
    const adjustmentId = await ctx.db.insert("billingAdjustments", {
      workspaceId: invoice.workspaceId,
      organizationId: invoice.organizationId,
      billingAccountId: invoice.billingAccountId,
      invoiceId: invoice._id,
      paymentId: invoice.paymentId,
      adjustmentType: args.adjustmentType,
      amount: args.amount,
      currency: invoice.currency || "NGN",
      reason: args.reason,
      providerReference: args.providerReference || invoice.providerReference,
      actorUserId: args.actorUserId,
      actorRole: args.actorRole || "superadmin",
      metadata: args.metadata,
      createdAt: now,
    });

    // Update invoice status if full/partial refund
    if (args.adjustmentType === "refund") {
      await ctx.db.patch(invoice._id, {
        status: "refunded",
        updatedAt: now,
      });
    } else if (args.adjustmentType === "partial_refund") {
      await ctx.db.patch(invoice._id, {
        status: "partially_refunded",
        updatedAt: now,
      });
    }

    // Update payment record if linked
    if (invoice.paymentId) {
      const normPayId = ctx.db.normalizeId("payments", invoice.paymentId);
      if (normPayId) {
        if (args.adjustmentType === "refund") {
          await ctx.db.patch(normPayId, {
            status: "refunded",
            refundedAt: now,
            updatedAt: now,
          });
        } else if (args.adjustmentType === "partial_refund") {
          await ctx.db.patch(normPayId, {
            status: "partially_refunded",
            refundedAt: now,
            updatedAt: now,
          });
        }
      }
    }

    await ctx.db.insert("auditLogs", {
      organizationId: invoice.organizationId ? ctx.db.normalizeId("organizations", invoice.organizationId) || undefined : undefined,
      action: args.adjustmentType === "refund" || args.adjustmentType === "partial_refund" ? "billing.invoice_refunded" : "billing.invoice_adjusted",
      resource: `invoice:${invoice._id}`,
      severity: "warning",
      metadata: {
        adjustmentId,
        invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        adjustmentType: args.adjustmentType,
        amount: args.amount,
        reason: args.reason,
        actorUserId: args.actorUserId,
      },
      timestamp: now,
      createdAt: now,
    });

    return await ctx.db.get(adjustmentId);
  },
});

/**
 * Retry or trigger PDF generation.
 */
export const retryPdfGeneration = mutation({
  args: {
    invoiceId: v.union(v.id("invoices"), v.string()),
    pdfUrl: v.optional(v.string()),
    pdfStorageId: v.optional(v.string()),
    status: v.optional(v.union(v.literal("processing"), v.literal("completed"), v.literal("failed"))),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let invoice: any = null;
    const normId = ctx.db.normalizeId("invoices", args.invoiceId);
    if (normId) {
      invoice = await ctx.db.get(normId);
    } else {
      invoice = await ctx.db
        .query("invoices")
        .withIndex("by_invoiceNumber", (q: any) => q.eq("invoiceNumber", args.invoiceId))
        .first();
    }

    if (!invoice) throw new Error("Invoice not found.");

    const now = Date.now();
    const newStatus = args.status || "processing";

    await ctx.db.patch(invoice._id, {
      pdfGenerationStatus: newStatus,
      pdfUrl: args.pdfUrl || invoice.pdfUrl,
      pdfStorageId: args.pdfStorageId || invoice.pdfStorageId,
      pdfGeneratedAt: newStatus === "completed" ? now : invoice.pdfGeneratedAt,
      pdfGenerationError: args.error || (newStatus === "completed" ? undefined : invoice.pdfGenerationError),
      updatedAt: now,
    });

    await ctx.db.insert("auditLogs", {
      organizationId: invoice.organizationId ? ctx.db.normalizeId("organizations", invoice.organizationId) || undefined : undefined,
      action: newStatus === "completed" ? "billing.invoice_pdf_generated" : newStatus === "failed" ? "billing.invoice_pdf_generation_failed" : "billing.invoice_pdf_generation_started",
      resource: `invoice:${invoice._id}`,
      severity: newStatus === "failed" ? "warning" : "info",
      metadata: {
        invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        pdfGenerationStatus: newStatus,
        error: args.error,
      },
      timestamp: now,
      createdAt: now,
    });

    return await ctx.db.get(invoice._id);
  },
});

/**
 * Superadmin Consistency Check Query.
 * Detects mismatches, orphaned records, and discrepancies across invoices, payments, subscriptions, and receipts.
 */
export const checkBillingConsistency = query({
  args: {
    workspaceId: v.optional(v.string()),
    organizationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const issues: Array<{
      type: string;
      severity: "error" | "warning" | "info";
      resourceId: string;
      description: string;
      details: any;
    }> = [];

    const allInvoices = await ctx.db.query("invoices").collect();
    const allPayments = await ctx.db.query("payments").collect();
    const allReceipts = await ctx.db.query("receipts").collect();

    // 1. Paid invoices without matching payment or receipt
    for (const inv of allInvoices) {
      if (inv.status === "paid") {
        if (!inv.paymentId && !inv.providerReference) {
          issues.push({
            type: "paid_invoice_without_payment_reference",
            severity: "error",
            resourceId: inv._id,
            description: `Invoice ${inv.invoiceNumber} is marked as paid but has no paymentId or providerReference.`,
            details: { invoiceId: inv._id, invoiceNumber: inv.invoiceNumber },
          });
        }

        const linkedReceipt = allReceipts.find(
          (r: any) => r.invoiceId === inv._id || (inv.providerReference && r.providerReference === inv.providerReference)
        );

        if (!linkedReceipt) {
          issues.push({
            type: "paid_invoice_without_receipt",
            severity: "warning",
            resourceId: inv._id,
            description: `Paid invoice ${inv.invoiceNumber} has no corresponding payment receipt.`,
            details: { invoiceId: inv._id, invoiceNumber: inv.invoiceNumber, amount: inv.amount },
          });
        }
      }
    }

    // 2. Successful payments without matching invoice
    for (const pay of allPayments) {
      if (pay.status === "completed" || pay.status === "success") {
        const linkedInv = allInvoices.find(
          (inv: any) =>
            inv._id === pay.invoiceId ||
            (pay.reference && inv.providerReference === pay.reference) ||
            (pay.providerReference && inv.providerReference === pay.providerReference)
        );

        if (!linkedInv) {
          issues.push({
            type: "paid_payment_without_invoice",
            severity: "error",
            resourceId: pay._id,
            description: `Payment ${pay.reference || pay.providerReference || pay._id} succeeded but has no linked subscription invoice.`,
            details: { paymentId: pay._id, reference: pay.reference || pay.providerReference, amount: pay.amount },
          });
        } else if (linkedInv.amount !== pay.amount) {
          issues.push({
            type: "amount_mismatch",
            severity: "error",
            resourceId: pay._id,
            description: `Amount mismatch: Invoice ${linkedInv.invoiceNumber} (₦${linkedInv.amount}) does not match Payment (₦${pay.amount}).`,
            details: { invoiceAmount: linkedInv.amount, paymentAmount: pay.amount },
          });
        }
      }
    }

    return {
      totalInvoicesChecked: allInvoices.length,
      totalPaymentsChecked: allPayments.length,
      totalReceiptsChecked: allReceipts.length,
      issuesCount: issues.length,
      issues,
      checkedAt: Date.now(),
    };
  },
});

export const getByWorkspace = query({
  args: { workspaceId: v.union(v.id("workspaces"), v.string()) },
  handler: async (ctx, args) => {
    let invoices = await ctx.db
      .query("invoices")
      .withIndex("by_workspace", (q: any) => q.eq("workspaceId", args.workspaceId as any))
      .collect();

    // Also check organization workspace mapping if empty
    if (invoices.length === 0) {
      const normWs = ctx.db.normalizeId("workspaces", args.workspaceId);
      if (normWs) {
        const ws: any = await ctx.db.get(normWs);
        if (ws?.organizationId) {
          invoices = await ctx.db
            .query("invoices")
            .withIndex("by_organizationId", (q: any) => q.eq("organizationId", ws.organizationId))
            .collect();
        }
      }
    }

    return invoices.sort((a, b) => (b.issuedAt || b.createdAt) - (a.issuedAt || a.createdAt));
  },
});

export const getByOrganization = query({
  args: { organizationId: v.union(v.id("organizations"), v.string()) },
  handler: async (ctx, args) => {
    let invoices = await ctx.db
      .query("invoices")
      .withIndex("by_organizationId", (q: any) => q.eq("organizationId", args.organizationId as any))
      .collect();

    if (invoices.length === 0) {
      const normOrg = ctx.db.normalizeId("organizations", args.organizationId);
      if (normOrg) {
        const workspaces = await ctx.db
          .query("workspaces")
          .withIndex("by_organizationId", (q: any) => q.eq("organizationId", normOrg))
          .collect();

        for (const ws of workspaces) {
          const wsInvoices = await ctx.db
            .query("invoices")
            .withIndex("by_workspace", (q: any) => q.eq("workspaceId", ws._id))
            .collect();
          invoices.push(...wsInvoices);
        }
      }
    }

    return invoices.sort((a, b) => (b.issuedAt || b.paidAt || b.createdAt) - (a.issuedAt || a.paidAt || a.createdAt));
  },
});

export const getInvoicesForOrg = getByOrganization;

export const getById = query({
  args: { invoiceId: v.union(v.id("invoices"), v.string()) },
  handler: async (ctx, args) => {
    let invoice: any = null;
    const normId = ctx.db.normalizeId("invoices", args.invoiceId);
    if (normId) {
      invoice = await ctx.db.get(normId);
    }
    if (!invoice) {
      invoice = await ctx.db
        .query("invoices")
        .withIndex("by_invoiceNumber", (q: any) => q.eq("invoiceNumber", args.invoiceId))
        .first();
    }
    if (!invoice) return null;

    let org: any = null;
    if (invoice.organizationId) {
      const normOrg = ctx.db.normalizeId("organizations", invoice.organizationId);
      if (normOrg) org = await ctx.db.get(normOrg);
    } else if (invoice.workspaceId) {
      const normWs = ctx.db.normalizeId("workspaces", invoice.workspaceId);
      if (normWs) {
        const ws: any = await ctx.db.get(normWs);
        if (ws?.organizationId) {
          org = await ctx.db.get(ws.organizationId);
        }
      }
    }

    let sub: any = null;
    if (invoice.subscriptionId) {
      const normSub = ctx.db.normalizeId("subscriptions", invoice.subscriptionId);
      if (normSub) sub = await ctx.db.get(normSub);
    }

    let payment: any = null;
    if (invoice.paymentId) {
      const normPay = ctx.db.normalizeId("payments", invoice.paymentId);
      if (normPay) payment = await ctx.db.get(normPay);
    }

    let receipt: any = null;
    receipt = await ctx.db
      .query("receipts")
      .withIndex("by_invoice", (q: any) => q.eq("invoiceId", invoice._id))
      .first();

    if (!receipt && invoice.providerReference) {
      receipt = await ctx.db
        .query("receipts")
        .withIndex("by_providerReference", (q: any) => q.eq("providerReference", invoice.providerReference))
        .first();
    }

    return {
      ...invoice,
      id: invoice._id,
      receipt: receipt ? {
        id: receipt._id,
        receiptNumber: receipt.receiptNumber,
        amount: receipt.amount,
        paidAt: receipt.paidAt,
        status: receipt.status,
      } : null,
      organization: org
        ? {
            id: org._id,
            name: org.name,
            slug: org.slug,
            address: org.address || `${org.street || ""}, ${org.city || ""}, ${org.state || ""}, ${org.country || "Nigeria"}`.trim().replace(/^,\s*/, ""),
            phone: org.phone,
            currency: org.currency || "NGN",
          }
        : null,
      subscription: sub
        ? {
            id: sub._id,
            planKey: sub.planKey,
            billingInterval: sub.billingInterval || "monthly",
            status: sub.status,
          }
        : null,
      payment: payment
        ? {
            id: payment._id,
            provider: payment.provider,
            reference: payment.reference || payment.providerReference,
            status: payment.status,
          }
        : null,
    };
  },
});

export const getByInvoiceNumber = query({
  args: { invoiceNumber: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("invoices")
      .withIndex("by_invoiceNumber", (q: any) => q.eq("invoiceNumber", args.invoiceNumber))
      .first();
  },
});

export const getReceiptById = query({
  args: { receiptId: v.union(v.id("receipts"), v.string()) },
  handler: async (ctx, args) => {
    let receipt: any = null;
    const normId = ctx.db.normalizeId("receipts", args.receiptId);
    if (normId) {
      receipt = await ctx.db.get(normId);
    }
    if (!receipt) {
      receipt = await ctx.db
        .query("receipts")
        .withIndex("by_receiptNumber", (q: any) => q.eq("receiptNumber", args.receiptId))
        .first();
    }
    if (!receipt) {
      receipt = await ctx.db
        .query("receipts")
        .withIndex("by_providerReference", (q: any) => q.eq("providerReference", args.receiptId))
        .first();
    }
    return receipt;
  },
});

export const getReceiptByInvoiceId = query({
  args: { invoiceId: v.union(v.id("invoices"), v.string()) },
  handler: async (ctx, args) => {
    let receipt = await ctx.db
      .query("receipts")
      .withIndex("by_invoice", (q: any) => q.eq("invoiceId", args.invoiceId as any))
      .first();

    if (!receipt) {
      const invoice: any = await ctx.db.get(args.invoiceId as any);
      if (invoice?.providerReference) {
        receipt = await ctx.db
          .query("receipts")
          .withIndex("by_providerReference", (q: any) => q.eq("providerReference", invoice.providerReference))
          .first();
      }
    }
    return receipt;
  },
});

export const getReceiptsByWorkspace = query({
  args: { workspaceId: v.union(v.id("workspaces"), v.string()) },
  handler: async (ctx, args) => {
    const receipts = await ctx.db
      .query("receipts")
      .withIndex("by_workspace", (q: any) => q.eq("workspaceId", args.workspaceId as any))
      .collect();
    return receipts.sort((a, b) => b.paidAt - a.paidAt);
  },
});

export const getAdjustmentsByInvoice = query({
  args: { invoiceId: v.union(v.id("invoices"), v.string()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("billingAdjustments")
      .withIndex("by_invoice", (q: any) => q.eq("invoiceId", args.invoiceId as any))
      .collect();
  },
});

// Backward-compatibility mutation: createOrganizationInvoice
export const createOrganizationInvoice = generateSubscriptionInvoice;
