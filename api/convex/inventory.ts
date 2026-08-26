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
