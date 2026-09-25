import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { resolveOrganization } from "./applications";

export const getProducts = query({
  args: {
    workspaceId: v.id("workspaces"),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let q = ctx.db
      .query("inventoryProducts")
      .withIndex("by_workspaceId", (i) => i.eq("workspaceId", args.workspaceId));

    const products = await q.collect();
    if (args.category) {
      return products.filter((p) => p.category === args.category);
    }
    return products;
  },
});

export const createProduct = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    sku: v.string(),
    name: v.string(),
    category: v.string(),
    description: v.optional(v.string()),
    costPrice: v.number(),
    sellingPrice: v.number(),
    stockQuantity: v.number(),
    minStockLevel: v.number(),
    unit: v.string(),
    imageUrl: v.optional(v.string()),
    actorUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("inventoryProducts")
      .withIndex("by_workspace_and_sku", (i) =>
        i.eq("workspaceId", args.workspaceId).eq("sku", args.sku)
      )
      .first();

    if (existing) {
      throw new Error(`PRODUCT_SKU_ALREADY_EXISTS: SKU ${args.sku} already exists.`);
    }

    const productId = await ctx.db.insert("inventoryProducts", {
      workspaceId: args.workspaceId,
      sku: args.sku,
      name: args.name,
      category: args.category,
      description: args.description,
      costPrice: args.costPrice,
      sellingPrice: args.sellingPrice,
      stockQuantity: args.stockQuantity,
      minStockLevel: args.minStockLevel,
      unit: args.unit,
      imageUrl: args.imageUrl,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    // Record initial stock movement
    if (args.stockQuantity > 0) {
      await ctx.db.insert("inventoryStockMovements", {
        workspaceId: args.workspaceId,
        productId,
        type: "INITIAL",
        quantity: args.stockQuantity,
        balanceBefore: 0,
        balanceAfter: args.stockQuantity,
        reason: "Initial inventory setup",
        actorUserId: args.actorUserId,
        createdAt: now,
      });
    }

    return productId;
  },
});

export const seedSampleProducts = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    sector: v.union(v.literal("retail"), v.literal("groceries"), v.literal("fashion"), v.literal("electronics")),
    actorUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const sampleSets: Record<string, Array<{ sku: string; name: string; category: string; costPrice: number; sellingPrice: number; stockQuantity: number; minStockLevel: number; unit: string }>> = {
      retail: [
        { sku: "RET-001", name: "Premium Notebook (A5)", category: "Stationery", costPrice: 1200, sellingPrice: 2500, stockQuantity: 50, minStockLevel: 10, unit: "pcs" },
        { sku: "RET-002", name: "Stainless Steel Water Bottle", category: "Accessories", costPrice: 3500, sellingPrice: 6500, stockQuantity: 30, minStockLevel: 5, unit: "pcs" },
        { sku: "RET-003", name: "Wireless Ergonomic Mouse", category: "Electronics", costPrice: 8000, sellingPrice: 14500, stockQuantity: 20, minStockLevel: 4, unit: "pcs" },
      ],
      groceries: [
        { sku: "GROC-001", name: "Organic Brown Rice 5kg", category: "Food & Grains", costPrice: 7500, sellingPrice: 11000, stockQuantity: 40, minStockLevel: 8, unit: "bag" },
        { sku: "GROC-002", name: "Extra Virgin Olive Oil 1L", category: "Pantry", costPrice: 9000, sellingPrice: 13500, stockQuantity: 25, minStockLevel: 5, unit: "bottle" },
        { sku: "GROC-003", name: "Pure Honey Jar 500g", category: "Condiments", costPrice: 3000, sellingPrice: 5000, stockQuantity: 35, minStockLevel: 6, unit: "jar" },
      ],
      fashion: [
        { sku: "FSH-001", name: "Classic Cotton T-Shirt (Black/M)", category: "Apparel", costPrice: 4000, sellingPrice: 9500, stockQuantity: 45, minStockLevel: 10, unit: "pcs" },
        { sku: "FSH-002", name: "Slim Fit Denim Jeans (32)", category: "Pants", costPrice: 12000, sellingPrice: 24000, stockQuantity: 20, minStockLevel: 5, unit: "pcs" },
        { sku: "FSH-003", name: "Leather Minimalist Wallet", category: "Accessories", costPrice: 5500, sellingPrice: 12000, stockQuantity: 15, minStockLevel: 3, unit: "pcs" },
      ],
      electronics: [
        { sku: "ELEC-001", name: "Fast USB-C Charging Cable (2M)", category: "Cables", costPrice: 1500, sellingPrice: 4000, stockQuantity: 60, minStockLevel: 15, unit: "pcs" },
        { sku: "ELEC-002", name: "Noise-Cancelling Earbuds Pro", category: "Audio", costPrice: 18000, sellingPrice: 32000, stockQuantity: 15, minStockLevel: 3, unit: "pcs" },
        { sku: "ELEC-003", name: "20,000mAh Power Bank", category: "Power", costPrice: 14000, sellingPrice: 25000, stockQuantity: 25, minStockLevel: 5, unit: "pcs" },
      ],
    };

    const selectedSet = sampleSets[args.sector] || sampleSets.retail;
    const createdIds: string[] = [];

    for (const item of selectedSet) {
      const existing = await ctx.db
        .query("inventoryProducts")
        .withIndex("by_workspace_and_sku", (i) =>
          i.eq("workspaceId", args.workspaceId).eq("sku", item.sku)
        )
        .first();

      if (!existing) {
        const id = await ctx.db.insert("inventoryProducts", {
          workspaceId: args.workspaceId,
          sku: item.sku,
          name: item.name,
          category: item.category,
          costPrice: item.costPrice,
          sellingPrice: item.sellingPrice,
          stockQuantity: item.stockQuantity,
          minStockLevel: item.minStockLevel,
          unit: item.unit,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });

        await ctx.db.insert("inventoryStockMovements", {
          workspaceId: args.workspaceId,
          productId: id,
          type: "INITIAL",
          quantity: item.stockQuantity,
          balanceBefore: 0,
          balanceAfter: item.stockQuantity,
          reason: `Sample catalog seed (${args.sector})`,
          actorUserId: args.actorUserId,
          createdAt: now,
        });

        createdIds.push(id);
      }
    }

    return { createdCount: createdIds.length, productIds: createdIds };
  },
});

export const recordSale = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    customerId: v.optional(v.id("inventoryCustomers")),
    branchId: v.optional(v.union(v.id("branches"), v.string())),
    items: v.array(
      v.object({
        productId: v.id("inventoryProducts"),
        quantity: v.number(),
      })
    ),
    paymentMethod: v.union(
      v.literal("CASH"),
      v.literal("CARD"),
      v.literal("TRANSFER"),
      v.literal("SPLIT"),
      v.literal("USSD"),
      v.literal("CREDIT")
    ),
    customerName: v.optional(v.string()),
    customerPhone: v.optional(v.string()),
    notes: v.optional(v.string()),
    metadata: v.optional(v.any()),
    cashierUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const timestampSuffix = Math.floor(now / 1000).toString().slice(-4);
    const randomSuffix = Math.random().toString(36).substring(2, 5).toUpperCase();
    const saleNumber = `ORD-${timestampSuffix}-${randomSuffix}`;
    const receiptNumber = `RCP-${timestampSuffix}-${randomSuffix}`;

    // 1. Fetch current receipt settings to capture frozen snapshot
    const receiptSetting = await ctx.db
      .query("receiptSettings")
      .withIndex("by_workspaceId", (i) => i.eq("workspaceId", args.workspaceId))
      .first();

    const receiptSnapshot = receiptSetting
      ? {
          storeName: receiptSetting.storeName,
          tagline: receiptSetting.tagline,
          headerText: receiptSetting.headerText,
          footerText: receiptSetting.footerText,
          returnPolicy: receiptSetting.returnPolicy,
          tin: receiptSetting.tin,
          vatRate: receiptSetting.vatRate,
          phone: receiptSetting.phone,
          email: receiptSetting.email,
          address: receiptSetting.address,
          logoUrl: receiptSetting.logoUrl,
        }
      : {
          storeName: "Orviohub Merchant",
          tagline: "Quality goods & exceptional service",
          headerText: "Welcome to our store",
          footerText: "Thank you for your patronage!",
          returnPolicy: "Goods in original condition may be returned within 7 days.",
          tin: "",
          vatRate: 7.5,
          phone: "",
          email: "",
          address: "Nigeria",
          logoUrl: "",
        };

    let subtotal = 0;
    const saleItems = [];
    const lowStockAlerts: Array<{ name: string; current: number; min: number; unit: string }> = [];

    // 2. Process Items and Atomic Stock Decrements
    for (const item of args.items) {
      const product = await ctx.db.get(item.productId);
      if (!product) {
        throw new Error(`PRODUCT_NOT_FOUND: Product ${item.productId} does not exist.`);
      }

      if (product.workspaceId !== args.workspaceId) {
        throw new Error(`UNAUTHORIZED: Product does not belong to this workspace.`);
      }

      if (product.stockQuantity < item.quantity) {
        throw new Error(
          `INSUFFICIENT_STOCK: Only ${product.stockQuantity} ${product.unit} of "${product.name}" in stock.`
        );
      }

      const itemTotal = product.sellingPrice * item.quantity;
      subtotal += itemTotal;

      saleItems.push({
        productId: product._id,
        sku: product.sku,
        name: product.name,
        quantity: item.quantity,
        unitPrice: product.sellingPrice,
        totalPrice: itemTotal,
      });

      // Atomic Stock Decrement
      const newStock = product.stockQuantity - item.quantity;
      await ctx.db.patch(product._id, {
        stockQuantity: newStock,
        updatedAt: now,
      });

      // Stock Movement Log
      await ctx.db.insert("inventoryStockMovements", {
        workspaceId: args.workspaceId,
        productId: product._id,
        type: "SALE",
        quantity: -item.quantity,
        balanceBefore: product.stockQuantity,
        balanceAfter: newStock,
        reason: `POS Sale #${saleNumber}`,
        referenceId: saleNumber,
        actorUserId: args.cashierUserId,
        createdAt: now,
      });

      // Check for Low Stock Trigger
      if (newStock <= product.minStockLevel) {
        lowStockAlerts.push({
          name: product.name,
          current: newStock,
          min: product.minStockLevel,
          unit: product.unit,
        });
      }
    }

    const taxAmount = 0;
    const discountAmount = 0;
    const totalAmount = subtotal + taxAmount - discountAmount;

    // 3. Handle Credit Sale Customer Ledger
    if (args.paymentMethod === "CREDIT") {
      if (!args.customerId) {
        throw new Error("CUSTOMER_REQUIRED: Credit sales require selecting or creating a customer.");
      }
      const customer = await ctx.db.get(args.customerId);
      if (!customer) {
        throw new Error("CUSTOMER_NOT_FOUND: Selected customer does not exist.");
      }
      if (customer.status === "blocked") {
        throw new Error("CUSTOMER_BLOCKED: Customer account is blocked from credit purchases.");
      }

      const newBalance = customer.currentBalance + totalAmount;
      if (customer.creditLimit && newBalance > customer.creditLimit) {
        throw new Error(
          `CREDIT_LIMIT_EXCEEDED: New balance ₦${newBalance.toLocaleString()} exceeds customer limit of ₦${customer.creditLimit.toLocaleString()}.`
        );
      }

      await ctx.db.patch(customer._id, {
        currentBalance: newBalance,
        updatedAt: now,
      });

      await ctx.db.insert("inventoryCustomerLedger", {
        workspaceId: args.workspaceId,
        customerId: customer._id,
        branchId: args.branchId,
        type: "DEBT_INCURRED",
        amount: totalAmount,
        balanceBefore: customer.currentBalance,
        balanceAfter: newBalance,
        paymentMethod: "CREDIT",
        notes: `Credit purchase #${saleNumber}`,
        recordedBy: args.cashierUserId,
        createdAt: now,
      });
    }

    // 4. Record Sale with Frozen Receipt Snapshot
    const saleId = await ctx.db.insert("inventorySales", {
      workspaceId: args.workspaceId,
      saleNumber,
      receiptNumber,
      cashierUserId: args.cashierUserId,
      customerId: args.customerId,
      items: saleItems,
      subtotal,
      taxAmount,
      discountAmount,
      totalAmount,
      paymentMethod: args.paymentMethod,
      customerName: args.customerName,
      customerPhone: args.customerPhone,
      notes: args.notes,
      status: "COMPLETED",
      receiptSnapshot,
      metadata: args.metadata,
      createdAt: now,
    });

    // 5. Automated Operational Notification Dispatch for Low Stock
    for (const alert of lowStockAlerts) {
      await ctx.db.insert("notifications", {
        userId: args.cashierUserId,
        workspaceId: args.workspaceId,
        productKey: "inventory",
        type: "INVENTORY_LOW_STOCK",
        title: `Low Stock Alert: ${alert.name}`,
        body: `Stock for "${alert.name}" is down to ${alert.current} ${alert.unit} (Threshold: ${alert.min} ${alert.unit}).`,
        severity: "WARNING",
        channel: "IN_APP",
        status: "UNREAD",
        createdAt: now,
      });
    }

    return {
      saleId,
      saleNumber,
      receiptNumber,
      totalAmount,
      itemCount: saleItems.length,
      receiptSnapshot,
      createdAt: now,
    };
  },
});

/**
 * Cancel / Void a completed sale and atomically restore stock balances
 */
export const cancelSale = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    saleId: v.id("inventorySales"),
    actorUserId: v.id("users"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const sale = await ctx.db.get(args.saleId);
    if (!sale) throw new Error("SALE_NOT_FOUND");
    if (sale.workspaceId !== args.workspaceId) throw new Error("UNAUTHORIZED");
    if (sale.status === "CANCELLED") throw new Error("SALE_ALREADY_CANCELLED");

    // 1. Reverse Stock Reductions
    for (const item of sale.items) {
      const product = await ctx.db.get(item.productId);
      if (product) {
        const restoredStock = product.stockQuantity + item.quantity;
        await ctx.db.patch(product._id, {
          stockQuantity: restoredStock,
          updatedAt: now,
        });

        await ctx.db.insert("inventoryStockMovements", {
          workspaceId: args.workspaceId,
          productId: product._id,
          type: "RETURN",
          quantity: item.quantity,
          balanceBefore: product.stockQuantity,
          balanceAfter: restoredStock,
          reason: `Sale cancelled #${sale.saleNumber}: ${args.reason}`,
          referenceId: sale.saleNumber,
          actorUserId: args.actorUserId,
          createdAt: now,
        });
      }
    }

    // 2. Reverse Customer Debt if Credit Sale
    if (sale.paymentMethod === "CREDIT" && sale.customerId) {
      const customer = await ctx.db.get(sale.customerId);
      if (customer) {
        const newBalance = Math.max(0, customer.currentBalance - sale.totalAmount);
        await ctx.db.patch(customer._id, {
          currentBalance: newBalance,
          updatedAt: now,
        });

        await ctx.db.insert("inventoryCustomerLedger", {
          workspaceId: args.workspaceId,
          customerId: customer._id,
          saleId: sale._id,
          type: "ADJUSTMENT",
          amount: -sale.totalAmount,
          balanceBefore: customer.currentBalance,
          balanceAfter: newBalance,
          paymentMethod: "CREDIT_REVERSAL",
          notes: `Reversal for cancelled sale #${sale.saleNumber}`,
          recordedBy: args.actorUserId,
          createdAt: now,
        });
      }
    }

    // 3. Update Sale Status
    await ctx.db.patch(sale._id, {
      status: "CANCELLED",
      cancelledAt: now,
      cancelledBy: args.actorUserId,
      cancellationReason: args.reason,
    });

    // 4. Audit Log
    await ctx.db.insert("auditLogs", {
      actorId: String(args.actorUserId),
      actorUserId: String(args.actorUserId),
      workspaceId: args.workspaceId,
      productKey: "inventory",
      action: "sale.cancelled",
      resource: `sale:${sale._id}`,
      severity: "warning",
      metadata: {
        saleNumber: sale.saleNumber,
        totalAmount: sale.totalAmount,
        reason: args.reason,
      },
      timestamp: now,
    });

    return { success: true, saleNumber: sale.saleNumber };
  },
});

/**
 * Customer Directory & Debt Ledger Operations
 */
export const getCustomers = query({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
  },
  handler: async (ctx, args) => {
    const { orgId, workspaceId } = await resolveOrganization(ctx, args.workspaceId);
    const targetId = (workspaceId || orgId || args.workspaceId) as any;

    return await ctx.db
      .query("inventoryCustomers")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", targetId))
      .collect();
  },
});

export const createCustomer = mutation({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
    name: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.optional(v.string()),
    creditLimit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const { orgId, workspaceId } = await resolveOrganization(ctx, args.workspaceId);
    const targetId = (workspaceId || orgId || args.workspaceId) as any;

    const customerId = await ctx.db.insert("inventoryCustomers", {
      workspaceId: targetId,
      name: args.name.trim(),
      phone: args.phone?.trim(),
      email: args.email?.trim(),
      address: args.address?.trim(),
      creditLimit: args.creditLimit ?? 50000,
      currentBalance: 0,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    return customerId;
  },
});

export const recordCustomerRepayment = mutation({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
    customerId: v.id("inventoryCustomers"),
    amount: v.number(),
    paymentMethod: v.union(v.literal("CASH"), v.literal("TRANSFER"), v.literal("CARD"), v.literal("USSD")),
    recordedBy: v.id("users"),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const customer = await ctx.db.get(args.customerId);
    if (!customer) throw new Error("CUSTOMER_NOT_FOUND");
    if (args.amount <= 0) throw new Error("INVALID_AMOUNT: Repayment amount must be positive.");

    const newBalance = Math.max(0, customer.currentBalance - args.amount);
    await ctx.db.patch(customer._id, {
      currentBalance: newBalance,
      updatedAt: now,
    });

    const ledgerId = await ctx.db.insert("inventoryCustomerLedger", {
      workspaceId: args.workspaceId as any,
      customerId: customer._id,
      type: "PAYMENT_RECEIVED",
      amount: args.amount,
      balanceBefore: customer.currentBalance,
      balanceAfter: newBalance,
      paymentMethod: args.paymentMethod,
      notes: args.notes || `Repayment via ${args.paymentMethod}`,
      recordedBy: args.recordedBy,
      createdAt: now,
    });

    return { success: true, ledgerId, newBalance };
  },
});

/**
 * Log Branch Switched Audit Event
 */
export const logBranchSwitched = mutation({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
    previousBranchId: v.optional(v.string()),
    newBranchId: v.string(),
    actorUserId: v.optional(v.union(v.id("users"), v.string())),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const { orgId, workspaceId } = await resolveOrganization(ctx, args.workspaceId);
    const targetWs = (workspaceId || orgId || args.workspaceId) as any;

    await ctx.db.insert("auditLogs", {
      actorId: args.actorUserId ? String(args.actorUserId) : undefined,
      actorUserId: args.actorUserId ? String(args.actorUserId) : undefined,
      workspaceId: targetWs,
      organizationId: orgId || undefined,
      productKey: "inventory",
      action: "branch.switched",
      resource: `branch:${args.newBranchId}`,
      severity: "info",
      metadata: {
        previousBranchId: args.previousBranchId,
        newBranchId: args.newBranchId,
      },
      timestamp: now,
    });

    return { logged: true };
  },
});

export const getDashboardMetrics = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const products = await ctx.db
      .query("inventoryProducts")
      .withIndex("by_workspaceId", (i) => i.eq("workspaceId", args.workspaceId))
      .collect();

    const sales = await ctx.db
      .query("inventorySales")
      .withIndex("by_workspaceId", (i) => i.eq("workspaceId", args.workspaceId))
      .collect();

    const totalProducts = products.length;
    const lowStockProducts = products.filter((p) => p.stockQuantity <= p.minStockLevel);
    const totalStockValue = products.reduce((acc, p) => acc + p.costPrice * p.stockQuantity, 0);
    const totalRevenue = sales.reduce((acc, s) => acc + s.totalAmount, 0);

    const recentSales = sales
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5);

    return {
      totalProducts,
      lowStockCount: lowStockProducts.length,
      lowStockProducts: lowStockProducts.slice(0, 5),
      totalStockValue,
      totalRevenue,
      totalSalesCount: sales.length,
      recentSales,
    };
  },
});

export const getReceiptSettings = query({
  args: {
    workspaceId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("receiptSettings")
      .withIndex("by_workspaceId", (i) => i.eq("workspaceId", args.workspaceId))
      .first();

    if (existing) {
      return existing;
    }

    // Default template inheriting workspace/organization information
    let ws: any = null;
    try {
      ws = await ctx.db.get(args.workspaceId as any);
    } catch {
      // in case of non-id string
    }

    return {
      workspaceId: args.workspaceId,
      storeName: ws?.name || "Orviohub Merchant",
      tagline: "Quality goods & exceptional service",
      headerText: "Welcome to our store",
      footerText: "Thank you for your patronage! Please keep this receipt.",
      returnPolicy: "Goods in original condition may be returned or exchanged within 7 days.",
      tin: "",
      vatRate: 7.5,
      enableVat: false,
      showCashier: true,
      showCustomer: true,
      showBarcode: true,
      paperWidth: "80mm" as const,
      phone: ws?.phone || "",
      email: "",
      address: [ws?.city, ws?.state, ws?.country || "Nigeria"].filter(Boolean).join(", "),
      logoUrl: ws?.logoUrl || "",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  },
});

export const updateReceiptSettings = mutation({
  args: {
    workspaceId: v.string(),
    storeName: v.optional(v.string()),
    tagline: v.optional(v.string()),
    headerText: v.optional(v.string()),
    footerText: v.optional(v.string()),
    returnPolicy: v.optional(v.string()),
    tin: v.optional(v.string()),
    vatRate: v.optional(v.number()),
    enableVat: v.optional(v.boolean()),
    showCashier: v.optional(v.boolean()),
    showCustomer: v.optional(v.boolean()),
    showBarcode: v.optional(v.boolean()),
    paperWidth: v.optional(v.union(v.literal("58mm"), v.literal("80mm"))),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("receiptSettings")
      .withIndex("by_workspaceId", (i) => i.eq("workspaceId", args.workspaceId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        storeName: args.storeName !== undefined ? args.storeName : existing.storeName,
        tagline: args.tagline !== undefined ? args.tagline : existing.tagline,
        headerText: args.headerText !== undefined ? args.headerText : existing.headerText,
        footerText: args.footerText !== undefined ? args.footerText : existing.footerText,
        returnPolicy: args.returnPolicy !== undefined ? args.returnPolicy : existing.returnPolicy,
        tin: args.tin !== undefined ? args.tin : existing.tin,
        vatRate: args.vatRate !== undefined ? args.vatRate : existing.vatRate,
        enableVat: args.enableVat !== undefined ? args.enableVat : existing.enableVat,
        showCashier: args.showCashier !== undefined ? args.showCashier : existing.showCashier,
        showCustomer: args.showCustomer !== undefined ? args.showCustomer : existing.showCustomer,
        showBarcode: args.showBarcode !== undefined ? args.showBarcode : existing.showBarcode,
        paperWidth: args.paperWidth !== undefined ? args.paperWidth : existing.paperWidth,
        phone: args.phone !== undefined ? args.phone : existing.phone,
        email: args.email !== undefined ? args.email : existing.email,
        address: args.address !== undefined ? args.address : existing.address,
        logoUrl: args.logoUrl !== undefined ? args.logoUrl : existing.logoUrl,
        updatedAt: now,
      });
      return await ctx.db.get(existing._id);
    } else {
      const id = await ctx.db.insert("receiptSettings", {
        workspaceId: args.workspaceId,
        storeName: args.storeName,
        tagline: args.tagline,
        headerText: args.headerText,
        footerText: args.footerText,
        returnPolicy: args.returnPolicy,
        tin: args.tin,
        vatRate: args.vatRate ?? 7.5,
        enableVat: args.enableVat ?? false,
        showCashier: args.showCashier ?? true,
        showCustomer: args.showCustomer ?? true,
        showBarcode: args.showBarcode ?? true,
        paperWidth: args.paperWidth ?? "80mm",
        phone: args.phone,
        email: args.email,
        address: args.address,
        logoUrl: args.logoUrl,
        createdAt: now,
        updatedAt: now,
      });
      return await ctx.db.get(id);
    }
  },
});

/**
 * Single unified query returning the complete Demo Inventory Dashboard Context:
 * { organization, application, branch, branchesSummary, setup, permissions }
 */
export const getDemoContext = query({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
    branchId: v.optional(v.union(v.id("branches"), v.string())),
    userId: v.optional(v.union(v.id("users"), v.string())),
  },
  handler: async (ctx, args) => {
    const { org, orgId, workspace, workspaceId } = await resolveOrganization(ctx, args.workspaceId);
    const targetOrgId = orgId;
    const targetWsId = workspaceId;

    if (!targetOrgId && !targetWsId) {
      return null;
    }

    // 1. Resolve Application Status
    const app = await ctx.db
      .query("applications")
      .withIndex("by_key", (q) => q.eq("key", "inventory"))
      .first();

    let orgApp: any = null;
    if (targetOrgId && app) {
      orgApp = await ctx.db
        .query("orgApplications")
        .withIndex("by_org_and_app", (q) =>
          q.eq("organizationId", targetOrgId).eq("applicationId", app._id)
        )
        .first();
    }

    const appSettings = (targetWsId || targetOrgId)
      ? await ctx.db
          .query("applicationSettings")
          .withIndex("by_workspace_product", (q) =>
            q.eq("workspaceId", (targetWsId || targetOrgId) as any).eq("productKey", "inventory")
          )
          .first()
      : null;

    // 2. Resolve Branches
    let branches: any[] = [];
    if (targetOrgId) {
      branches = await ctx.db
        .query("branches")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", targetOrgId))
        .collect();
    }
    if (branches.length === 0 && targetWsId) {
      branches = await ctx.db
        .query("branches")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", targetWsId))
        .collect();
    }

    const activeBranches = branches.filter((b) => !b.deletedAt && b.status !== "archived");

    // 3. Resolve Active Branch
    let activeBranch: any = null;
    if (args.branchId) {
      activeBranch = branches.find(
        (b) => b._id === args.branchId || (b.code && b.code.toLowerCase() === args.branchId!.toLowerCase())
      );
    }
    if (!activeBranch) {
      activeBranch = activeBranches.find((b) => b.isPrimary) || activeBranches[0] || null;
    }

    // 4. Resolve Onboarding / Setup Progress
    let onboardFlow: any = null;
    if (targetWsId) {
      onboardFlow = await ctx.db
        .query("onboardingFlows")
        .withIndex("by_workspace_product", (q) =>
          q.eq("workspaceId", targetWsId).eq("productKey", "inventory")
        )
        .order("desc")
        .first();
    }

    // 5. Resolve User Permissions
    let isOwner = false;
    let userRole = "MEMBER";
    if (args.userId && targetOrgId) {
      const uId = ctx.db.normalizeId("users", args.userId);
      if (uId) {
        if (org?.ownerId === uId) {
          isOwner = true;
          userRole = "OWNER";
        } else {
          const membership = await ctx.db
            .query("organizationMemberships")
            .withIndex("by_org_and_user", (q: any) =>
              q.eq("organizationId", targetOrgId).eq("userId", uId)
            )
            .first();
          if (membership) {
            userRole = membership.role;
            if (membership.role === "OWNER") isOwner = true;
          }
        }
      }
    } else if (org) {
      isOwner = true; // fallback if no specific user checked
    }

    const canManageBranches = isOwner || userRole === "ADMIN" || userRole === "MANAGER";
    const canManageSettings = isOwner || userRole === "ADMIN";

    // 6. Master Categories & Units Count
    const categoriesCount = (targetWsId || targetOrgId)
      ? (
          await ctx.db
            .query("inventoryCategories")
            .withIndex("by_workspace", (q) => q.eq("workspaceId", (targetWsId || targetOrgId) as any))
            .collect()
        ).length
      : 0;

    const unitsCount = (targetWsId || targetOrgId)
      ? (
          await ctx.db
            .query("inventoryUnits")
            .withIndex("by_workspace", (q) => q.eq("workspaceId", (targetWsId || targetOrgId) as any))
            .collect()
        ).length
      : 0;

    return {
      organization: {
        id: (targetOrgId || targetWsId) as string,
        name: org?.name || workspace?.name || "Code X Stores",
        slug: org?.slug || workspace?.slug || "",
        logoUrl: org?.logo || workspace?.logoUrl || "",
        currency: org?.currency || workspace?.currency || "NGN",
        timezone: org?.timezone || workspace?.timezone || "Africa/Lagos",
        status: org?.status || workspace?.status || "active",
      },
      application: {
        key: "inventory",
        name: "Inventory",
        displayName: appSettings?.displayName || "Inventory Management",
        status: orgApp?.status || (orgApp?.enabled ? "active" : "inactive"),
        enabled: Boolean(orgApp?.enabled ?? true),
      },
      branch: activeBranch
        ? {
            id: activeBranch._id,
            name: activeBranch.name,
            code: activeBranch.code || "MAIN",
            isPrimary: Boolean(activeBranch.isPrimary),
            status: activeBranch.status || "active",
            address:
              activeBranch.formattedAddress ||
              activeBranch.address ||
              [activeBranch.city, activeBranch.state, activeBranch.country || "Nigeria"].filter(Boolean).join(", "),
            phone: activeBranch.phone || "",
            email: activeBranch.email || "",
          }
        : null,
      branchesSummary: {
        totalCount: branches.length,
        activeCount: activeBranches.length,
        branches: branches.map((b) => ({
          id: b._id,
          name: b.name,
          code: b.code || "",
          isPrimary: Boolean(b.isPrimary),
          status: b.status,
          address: b.formattedAddress || b.address || "",
        })),
      },
      setup: {
        inventorySetupComplete: Boolean(
          onboardFlow?.status === "completed" ||
            onboardFlow?.status === "COMPLETED" ||
            orgApp?.enabled
        ),
        branchSetupComplete: branches.length > 0,
        currentStep: onboardFlow?.currentStep || "completed",
        completedSteps: onboardFlow?.completedSteps || [],
      },
      permissions: {
        isOwner,
        role: userRole,
        canManageBranches,
        canManageSettings,
      },
      masterData: {
        categoriesCount,
        unitsCount,
      },
    };
  },
});

/**
 * Log when the demo dashboard is opened for auditing
 */
export const logDashboardOpened = mutation({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
    branchId: v.optional(v.string()),
    actorUserId: v.optional(v.union(v.id("users"), v.string())),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const { orgId, workspaceId } = await resolveOrganization(ctx, args.workspaceId);
    const targetWs = (workspaceId || orgId || args.workspaceId) as any;

    await ctx.db.insert("auditLogs", {
      actorId: args.actorUserId ? String(args.actorUserId) : undefined,
      actorUserId: args.actorUserId ? String(args.actorUserId) : undefined,
      workspaceId: targetWs,
      organizationId: orgId || undefined,
      productKey: "inventory",
      action: "inventory.demo_dashboard_opened",
      resource: `branch:${args.branchId || "primary"}`,
      severity: "info",
      metadata: {
        branchId: args.branchId,
        openedAt: now,
      },
      timestamp: now,
    });

    return { logged: true };
  },
});

/**
 * Categories Master Data Queries & Mutations
 */
export const getCategories = query({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
  },
  handler: async (ctx, args) => {
    const { orgId, workspaceId } = await resolveOrganization(ctx, args.workspaceId);
    const targetId = (workspaceId || orgId || args.workspaceId) as any;

    const list = await ctx.db
      .query("inventoryCategories")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", targetId))
      .collect();

    if (list.length === 0) {
      // Return standard default categories for demo
      return [
        { _id: "cat_default_1", name: "Groceries & Dairy", slug: "groceries-dairy", isSystem: true },
        { _id: "cat_default_2", name: "Beverages", slug: "beverages", isSystem: true },
        { _id: "cat_default_3", name: "Grains & Flour", slug: "grains-flour", isSystem: true },
        { _id: "cat_default_4", name: "Personal Care", slug: "personal-care", isSystem: true },
        { _id: "cat_default_5", name: "Household & Cleaning", slug: "household-cleaning", isSystem: true },
      ];
    }

    return list;
  },
});

export const createCategory = mutation({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
    name: v.string(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const { orgId, workspaceId } = await resolveOrganization(ctx, args.workspaceId);
    const targetId = (workspaceId || orgId || args.workspaceId) as any;
    const slug = args.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-");

    const existing = await ctx.db
      .query("inventoryCategories")
      .withIndex("by_workspace_slug", (q) => q.eq("workspaceId", targetId).eq("slug", slug))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("inventoryCategories", {
      workspaceId: targetId,
      name: args.name.trim(),
      slug,
      description: args.description,
      icon: args.icon,
      isSystem: false,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Units Master Data Queries & Mutations
 */
export const getUnits = query({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
  },
  handler: async (ctx, args) => {
    const { orgId, workspaceId } = await resolveOrganization(ctx, args.workspaceId);
    const targetId = (workspaceId || orgId || args.workspaceId) as any;

    const list = await ctx.db
      .query("inventoryUnits")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", targetId))
      .collect();

    if (list.length === 0) {
      return [
        { _id: "unit_1", name: "Pieces", code: "pcs", symbol: "pcs", isDefault: true },
        { _id: "unit_2", name: "Carton / Box", code: "carton", symbol: "ctn", isDefault: false },
        { _id: "unit_3", name: "Bag", code: "bag", symbol: "bag", isDefault: false },
        { _id: "unit_4", name: "Kilogram", code: "kg", symbol: "kg", isDefault: false },
        { _id: "unit_5", name: "Litre / Bottle", code: "bottle", symbol: "btl", isDefault: false },
      ];
    }

    return list;
  },
});

export const createUnit = mutation({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
    name: v.string(),
    code: v.string(),
    symbol: v.optional(v.string()),
    isDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const { orgId, workspaceId } = await resolveOrganization(ctx, args.workspaceId);
    const targetId = (workspaceId || orgId || args.workspaceId) as any;
    const code = args.code.toLowerCase().trim();

    const existing = await ctx.db
      .query("inventoryUnits")
      .withIndex("by_workspace_code", (q) => q.eq("workspaceId", targetId).eq("code", code))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("inventoryUnits", {
      workspaceId: targetId,
      name: args.name.trim(),
      code,
      symbol: args.symbol || code,
      isDefault: Boolean(args.isDefault),
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Product Archive & Restore Mutations
 */
export const archiveProduct = mutation({
  args: {
    productId: v.id("inventoryProducts"),
    actorUserId: v.optional(v.id("users")),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("PRODUCT_NOT_FOUND");

    await ctx.db.patch(args.productId, {
      isArchived: true,
      archivedAt: now,
      archivedBy: args.actorUserId,
      isActive: false,
      updatedAt: now,
    });

    await ctx.db.insert("auditLogs", {
      actorId: args.actorUserId ? String(args.actorUserId) : undefined,
      actorUserId: args.actorUserId ? String(args.actorUserId) : undefined,
      workspaceId: product.workspaceId,
      productKey: "inventory",
      action: "product.archived",
      resource: `product:${args.productId}`,
      severity: "info",
      metadata: {
        productName: product.name,
        sku: product.sku,
        reason: args.reason,
      },
      timestamp: now,
    });

    return { success: true };
  },
});

export const restoreProduct = mutation({
  args: {
    productId: v.id("inventoryProducts"),
    actorUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("PRODUCT_NOT_FOUND");

    await ctx.db.patch(args.productId, {
      isArchived: false,
      archivedAt: undefined,
      archivedBy: undefined,
      isActive: true,
      updatedAt: now,
    });

    await ctx.db.insert("auditLogs", {
      actorId: args.actorUserId ? String(args.actorUserId) : undefined,
      actorUserId: args.actorUserId ? String(args.actorUserId) : undefined,
      workspaceId: product.workspaceId,
      productKey: "inventory",
      action: "product.restored",
      resource: `product:${args.productId}`,
      severity: "info",
      metadata: {
        productName: product.name,
        sku: product.sku,
      },
      timestamp: now,
    });

    return { success: true };
  },
});

