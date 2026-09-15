import { query, mutation } from "./_generated/server.js";
import { v } from "convex/values";

/**
 * Generate next sequential invoice number: INV-000001, INV-000002, etc.
 */
export async function generateNextInvoiceNumber(ctx: { db: any }): Promise<string> {
  const allInvoices = await ctx.db.query("invoices").collect();
  const nextSeq = allInvoices.length + 1;
  return `INV-${String(nextSeq).padStart(6, "0")}`;
}

export const getByWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    return invoices.sort((a, b) => (b.issuedAt || b.createdAt) - (a.issuedAt || a.createdAt));
  },
});

export const getByOrganization = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    let invoices = await ctx.db
      .query("invoices")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", args.organizationId))
      .collect();

    if (invoices.length === 0) {
      // Fallback: check invoices for workspaces of this organization
      const workspaces = await ctx.db
        .query("workspaces")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", args.organizationId))
        .collect();

      for (const ws of workspaces) {
        const wsInvoices = await ctx.db
          .query("invoices")
          .withIndex("by_workspace", (q) => q.eq("workspaceId", ws._id))
          .collect();
        invoices.push(...wsInvoices);
      }
    }

    const org = await ctx.db.get(args.organizationId);

    const enriched = invoices.map((inv) => ({
      ...inv,
      id: inv._id,
      organizationName: org?.name || "Organization",
      organizationAddress: org?.address || org?.street || "Nigeria",
      organizationPhone: org?.phone || "",
    }));

    return enriched.sort((a, b) => (b.issuedAt || b.paidAt || b.createdAt) - (a.issuedAt || a.paidAt || a.createdAt));
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
        .withIndex("by_invoiceNumber", (q) => q.eq("invoiceNumber", args.invoiceId))
        .first();
    }
    if (!invoice) return null;

    let org: any = null;
    if (invoice.organizationId) {
      org = await ctx.db.get(invoice.organizationId);
    } else if (invoice.workspaceId) {
      const ws: any = await ctx.db.get(invoice.workspaceId);
      if (ws?.organizationId) {
        org = await ctx.db.get(ws.organizationId);
      }
    }

    let sub: any = null;
    if (invoice.subscriptionId) {
      sub = await ctx.db.get(invoice.subscriptionId);
    }

    let payment: any = null;
    if (invoice.paymentId) {
      payment = await ctx.db.get(invoice.paymentId);
    }

    return {
      ...invoice,
      id: invoice._id,
      organization: org
        ? {
            id: org._id,
            name: org.name,
            slug: org.slug,
            address:
              org.address ||
              `${org.street || ""}, ${org.city || ""}, ${org.state || ""}, ${org.country || "Nigeria"}`
                .trim()
                .replace(/^,\s*/, ""),
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
      .withIndex("by_invoiceNumber", (q) => q.eq("invoiceNumber", args.invoiceNumber))
      .first();
  },
});

export const createOrganizationInvoice = mutation({
  args: {
    organizationId: v.id("organizations"),
    subscriptionId: v.optional(v.id("subscriptions")),
    paymentId: v.optional(v.id("payments")),
    amount: v.number(),
    currency: v.optional(v.string()),
    periodStart: v.optional(v.number()),
    periodEnd: v.optional(v.number()),
    paymentReference: v.optional(v.string()),
    paymentMethod: v.optional(
      v.union(
        v.literal("bank_transfer"),
        v.literal("paystack"),
        v.literal("flutterwave"),
        v.literal("manual")
      )
    ),
    billingInterval: v.optional(v.string()),
    planName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const invoiceNumber = await generateNextInvoiceNumber(ctx);
    const interval = args.billingInterval === "annual" ? "Annual" : "Monthly";
    const planTitle = args.planName || "Standard Plan";

    const invoiceId = await ctx.db.insert("invoices", {
      organizationId: args.organizationId,
      subscriptionId: args.subscriptionId,
      paymentId: args.paymentId,
      invoiceNumber,
      status: "paid",
      amount: args.amount,
      currency: args.currency || "NGN",
      issuedAt: now,
      paidAt: now,
      dueDate: now,
      periodStart: args.periodStart || now,
      periodEnd:
        args.periodEnd ||
        now + (args.billingInterval === "annual" ? 365 : 30) * 86_400_000,
      paymentReference: args.paymentReference,
      paymentMethod: args.paymentMethod || "paystack",
      items: [
        {
          description: `Orviohub ${planTitle} (${interval})`,
          quantity: 1,
          unitPrice: args.amount,
          total: args.amount,
        },
      ],
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("auditLogs", {
      organizationId: args.organizationId,
      action: "billing.invoice_created",
      resource: `invoice:${invoiceId}`,
      severity: "info",
      metadata: {
        invoiceNumber,
        amount: args.amount,
        paymentReference: args.paymentReference,
      },
      timestamp: now,
    });

    return await ctx.db.get(invoiceId);
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
    const invoiceNumber = await generateNextInvoiceNumber(ctx);

    const invoiceId = await ctx.db.insert("invoices", {
      workspaceId: args.workspaceId,
      subscriptionId: subscription ? subscription._id : undefined,
      invoiceNumber,
      status: "pending",
      amount,
      currency: "NGN",
      dueDate: now + 3 * 24 * 60 * 60 * 1000,
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
    const invoiceNumber = await generateNextInvoiceNumber(ctx);

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
