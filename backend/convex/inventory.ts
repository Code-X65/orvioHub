import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

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
      v.literal("SPLIT")
    ),
    customerName: v.optional(v.string()),
    customerPhone: v.optional(v.string()),
    notes: v.optional(v.string()),
    cashierUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const timestampSuffix = Math.floor(now / 1000).toString().slice(-4);
    const randomSuffix = Math.random().toString(36).substring(2, 5).toUpperCase();
    const saleNumber = `ORD-${timestampSuffix}-${randomSuffix}`;
    const receiptNumber = `RCP-${timestampSuffix}-${randomSuffix}`;

    let subtotal = 0;
    const saleItems = [];

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
    }

    const taxAmount = 0; // Tax calculation configurable in workspace settings
    const discountAmount = 0;
    const totalAmount = subtotal + taxAmount - discountAmount;

    const saleId = await ctx.db.insert("inventorySales", {
      workspaceId: args.workspaceId,
      saleNumber,
      receiptNumber,
      cashierUserId: args.cashierUserId,
      items: saleItems,
      subtotal,
      taxAmount,
      discountAmount,
      totalAmount,
      paymentMethod: args.paymentMethod,
      customerName: args.customerName,
      customerPhone: args.customerPhone,
      notes: args.notes,
      createdAt: now,
    });

    return {
      saleId,
      saleNumber,
      receiptNumber,
      totalAmount,
      itemCount: saleItems.length,
      createdAt: now,
    };
  },
});

export const getDashboardMetrics = query({
  args: {
    workspaceId: v.id("workspaces"),
    branchId: v.optional(v.union(v.id("branches"), v.string())),
    allowedBranchIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    let products = await ctx.db
      .query("inventoryProducts")
      .withIndex("by_workspaceId", (i) => i.eq("workspaceId", args.workspaceId))
      .collect();

    // Products are workspace-global, but branch-scoped dashboards derive their
    // stock from movements in the permitted branch set rather than exposing
    // the workspace-wide product balances.
    if (args.branchId || args.allowedBranchIds) {
      const allMovements = await ctx.db.query("inventoryStockMovements")
        .withIndex("by_workspaceId", (i) => i.eq("workspaceId", args.workspaceId)).collect();
      const scoped = args.branchId
        ? allMovements.filter((m) => String(m.branchId) === String(args.branchId))
        : allMovements.filter((m) => m.branchId && args.allowedBranchIds!.includes(String(m.branchId)));
      const balances = new Map<string, number>();
      for (const movement of scoped.sort((a, b) => a.createdAt - b.createdAt)) {
        const key = `${String(movement.branchId)}:${String(movement.productId)}`;
        balances.set(key, movement.balanceAfter ?? ((balances.get(key) || 0) + movement.quantity));
      }
      const byProduct = new Map<string, number>();
      for (const [key, balance] of balances) {
        const productId = key.slice(key.indexOf(':') + 1);
        byProduct.set(productId, (byProduct.get(productId) || 0) + balance);
      }
      products = products.filter((product) => byProduct.has(String(product._id))).map((product) => ({ ...product, stockQuantity: byProduct.get(String(product._id)) || 0 }));
    }

    let sales = await ctx.db
      .query("inventorySales")
      .withIndex("by_workspaceId", (i) => i.eq("workspaceId", args.workspaceId))
      .collect();
    // Historical sales without a branch are not returned to restricted users.
    if (args.branchId) sales = sales.filter((s: any) => String(s.branchId) === String(args.branchId));
    else if (args.allowedBranchIds) sales = sales.filter((s: any) => s.branchId && args.allowedBranchIds!.includes(String(s.branchId)));

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

export const recordOpeningStock = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    branchId: v.optional(v.union(v.id("branches"), v.string())),
    entries: v.array(
      v.object({
        productId: v.union(v.id("inventoryProducts"), v.id("products"), v.string()),
        quantity: v.number(),
        unitCost: v.optional(v.number()),
        totalCost: v.optional(v.number()),
        notes: v.optional(v.string()),
      })
    ),
    notes: v.optional(v.string()),
    referenceType: v.optional(v.string()),
    referenceId: v.optional(v.string()),
    actorUserId: v.optional(v.union(v.id("users"), v.string())),
    userId: v.optional(v.union(v.id("users"), v.string())),
    deviceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const effectiveUserId = args.actorUserId || args.userId;
    const normalizedUserId = (effectiveUserId ? ctx.db.normalizeId("users", effectiveUserId) : undefined) ?? undefined;
    const normalizedBranchId = (args.branchId ? ctx.db.normalizeId("branches", args.branchId) : undefined) ?? undefined;

    const movementIds: string[] = [];
    let totalQuantity = 0;
    let totalValuation = 0;

    for (const entry of args.entries) {
      const normalizedProductId = ctx.db.normalizeId("inventoryProducts", entry.productId);
      if (!normalizedProductId) continue;

      const product = await ctx.db.get(normalizedProductId);
      if (!product || product.workspaceId !== args.workspaceId) continue;

      const balanceBefore = product.stockQuantity;
      const newStock = entry.quantity;
      const unitCost = entry.unitCost !== undefined ? entry.unitCost : product.costPrice;
      const totalCost = entry.totalCost !== undefined ? entry.totalCost : unitCost * entry.quantity;

      // Update product stock balance and costPrice if provided
      await ctx.db.patch(product._id, {
        stockQuantity: newStock,
        costPrice: unitCost > 0 ? unitCost : product.costPrice,
        updatedAt: now,
      });

      // Insert stock movement in inventoryStockMovements
      const movId = await ctx.db.insert("inventoryStockMovements", {
        workspaceId: args.workspaceId,
        branchId: normalizedBranchId,
        productId: product._id,
        quantity: entry.quantity,
        unitCost,
        totalCost,
        balanceBefore,
        balanceAfter: newStock,
        type: "OPENING_STOCK",
        movementType: "opening_stock",
        reason: "Opening Stock Entry",
        notes: entry.notes || args.notes,
        referenceType: args.referenceType || "onboarding",
        referenceId: args.referenceId,
        actorUserId: normalizedUserId,
        userId: normalizedUserId,
        deviceId: args.deviceId,
        createdAt: now,
      });

      // Insert also in stockMovements
      await ctx.db.insert("stockMovements", {
        workspaceId: args.workspaceId,
        branchId: normalizedBranchId,
        productId: product._id,
        quantity: entry.quantity,
        unitCost,
        totalCost,
        balanceBefore,
        balanceAfter: newStock,
        movementType: "opening_stock",
        reason: "Opening Stock Entry",
        notes: entry.notes || args.notes,
        referenceType: args.referenceType || "onboarding",
        referenceId: args.referenceId,
        actorUserId: normalizedUserId,
        userId: normalizedUserId,
        deviceId: args.deviceId,
        createdAt: now,
      });

      movementIds.push(movId);
      totalQuantity += entry.quantity;
      totalValuation += totalCost;
    }

    return {
      success: true,
      recordedCount: movementIds.length,
      totalQuantity,
      totalValuation,
      movementIds,
    };
  },
});

export const getStockMovements = query({
  args: {
    workspaceId: v.id("workspaces"),
    branchId: v.optional(v.union(v.id("branches"), v.string())),
    productId: v.optional(v.union(v.id("inventoryProducts"), v.string())),
    movementType: v.optional(v.string()),
    limit: v.optional(v.number()),
    allowedBranchIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    let movements = await ctx.db
      .query("inventoryStockMovements")
      .withIndex("by_workspaceId", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    if (args.branchId) movements = movements.filter((m) => String(m.branchId) === String(args.branchId));
    else if (args.allowedBranchIds) movements = movements.filter((m) => m.branchId && args.allowedBranchIds!.includes(String(m.branchId)));

    if (args.productId) {
      movements = movements.filter((m) => m.productId === args.productId);
    }

    if (args.movementType) {
      const targetType = args.movementType.toLowerCase();
      movements = movements.filter(
        (m) =>
          (m.movementType && m.movementType.toLowerCase() === targetType) ||
          (m.type && m.type.toLowerCase() === targetType)
      );
    }

    // Sort descending by createdAt
    movements.sort((a, b) => b.createdAt - a.createdAt);

    if (args.limit) {
      movements = movements.slice(0, args.limit);
    }

    // Attach product details
    const populated = await Promise.all(
      movements.map(async (m) => {
        let product: any = null;
        try {
          const normProdId = ctx.db.normalizeId("inventoryProducts", m.productId);
          if (normProdId) {
            product = await ctx.db.get(normProdId);
          }
        } catch {}
        return {
          ...m,
          productName: product?.name || "Unknown Product",
          sku: product?.sku || "N/A",
          unit: product?.unit || "pcs",
        };
      })
    );

    return populated;
  },
});

export const getOpeningStock = query({
  args: {
    workspaceId: v.id("workspaces"),
    branchId: v.optional(v.union(v.id("branches"), v.string())),
    allowedBranchIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const products = await ctx.db
      .query("inventoryProducts")
      .withIndex("by_workspaceId", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const movements = await ctx.db
      .query("inventoryStockMovements")
      .withIndex("by_workspaceId", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const scopedMovements = args.branchId
      ? movements.filter((m) => String(m.branchId) === String(args.branchId))
      : args.allowedBranchIds
        ? movements.filter((m) => m.branchId && args.allowedBranchIds!.includes(String(m.branchId)))
        : movements;
    const openingMovements = scopedMovements.filter(
      (m) =>
        m.movementType === "opening_stock" ||
        m.type === "OPENING_STOCK" ||
        m.type === "opening_stock" ||
        m.type === "INITIAL"
    );

    const openingMap = new Map<string, any>();
    for (const mov of openingMovements) {
      openingMap.set(mov.productId, mov);
    }

    // Never expose the workspace-global product balance to a restricted
    // branch scope. Aggregate the latest branch balances only from permitted
    // movements; legacy unscoped movements were excluded above.
    const scopedBalances = new Map<string, number>();
    if (args.branchId || args.allowedBranchIds) {
      for (const movement of scopedMovements.sort((a, b) => a.createdAt - b.createdAt)) {
        const key = `${String(movement.branchId)}:${String(movement.productId)}`;
        scopedBalances.set(key, movement.balanceAfter ?? ((scopedBalances.get(key) || 0) + movement.quantity));
      }
    }
    const stockByProduct = new Map<string, number>();
    for (const [key, balance] of scopedBalances) {
      const productId = key.slice(key.indexOf(':') + 1);
      stockByProduct.set(productId, (stockByProduct.get(productId) || 0) + balance);
    }

    const visibleProducts = (args.branchId || args.allowedBranchIds)
      ? products.filter((p) => stockByProduct.has(String(p._id)))
      : products;
    const items = visibleProducts.map((p) => {
      const mov = openingMap.get(p._id);
      const currentStock = stockByProduct.has(String(p._id)) ? stockByProduct.get(String(p._id))! : p.stockQuantity;
      return {
        productId: p._id,
        name: p.name,
        sku: p.sku,
        category: p.category,
        costPrice: p.costPrice,
        sellingPrice: p.sellingPrice,
        unit: p.unit,
        currentStock,
        openingQuantity: mov ? mov.quantity : currentStock,
        unitCost: mov?.unitCost !== undefined ? mov.unitCost : p.costPrice,
        totalCost: mov?.totalCost !== undefined ? mov.totalCost : (p.costPrice * currentStock),
        hasOpeningStock: !!mov,
        recordedAt: mov?.createdAt,
      };
    });

    return {
      products: items,
      totalProducts: visibleProducts.length,
      recordedCount: openingMap.size,
      isFullyRecorded: visibleProducts.length > 0 && openingMap.size >= visibleProducts.length,
    };
  },
});
