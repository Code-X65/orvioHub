import { query, mutation } from "./_generated/server.js";
import { v } from "convex/values";

const DEFAULT_PRODUCTS = [
  {
    key: "inventory",
    name: "Inventory & POS",
    description: "Multi-branch warehouse stock, barcode POS checkout, receipts, sales history & telemetry.",
    subdomain: "inventory.orviohub.com",
    status: "active" as const,
    isBeta: false,
    isFeatured: true,
    displayOrder: 1,
    iconUrl: "/icons/inventory.svg",
  },
  {
    key: "taskmanagement",
    name: "Task & Project Management",
    description: "Agile sprints, interactive kanban boards, team workflows & milestone tracking.",
    subdomain: "tasks.orviohub.com",
    status: "active" as const,
    isBeta: false,
    isFeatured: true,
    displayOrder: 2,
    iconUrl: "/icons/tasks.svg",
  },
  {
    key: "crm",
    name: "Customer CRM",
    description: "Client contact directories, communication history, pipelines, and deal conversions.",
    subdomain: "crm.orviohub.com",
    status: "coming_soon" as const,
    isBeta: true,
    isFeatured: false,
    displayOrder: 3,
    iconUrl: "/icons/crm.svg",
  },
  {
    key: "booking",
    name: "Appointments & Booking",
    description: "Online calendar reservations, service scheduling, reminders, and client appointments.",
    subdomain: "booking.orviohub.com",
    status: "coming_soon" as const,
    isBeta: false,
    isFeatured: false,
    displayOrder: 4,
    iconUrl: "/icons/booking.svg",
  },
  {
    key: "gym",
    name: "Gym & Fitness Membership",
    description: "Member passes, attendance tracking, trainer schedules, and class subscriptions.",
    subdomain: "gym.orviohub.com",
    status: "coming_soon" as const,
    isBeta: false,
    isFeatured: false,
    displayOrder: 5,
    iconUrl: "/icons/gym.svg",
  },
];

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const products = await ctx.db.query("products").collect();
    if (products.length === 0) {
      return DEFAULT_PRODUCTS;
    }
    return products.sort((a, b) => (a.displayOrder ?? 99) - (b.displayOrder ?? 99));
  },
});

export const listVisible = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("products").collect();
    const source = all.length > 0 ? all : DEFAULT_PRODUCTS;
    const visible = source.filter((p) => {
      const status = (p.status || "").toLowerCase();
      return status === "active" || status === "coming_soon" || status === "beta";
    });
    return visible.sort((a, b) => (a.displayOrder ?? 99) - (b.displayOrder ?? 99));
  },
});

export const getByKey = query({
  args: { productKey: v.string() },
  handler: async (ctx, args) => {
    const product = await ctx.db
      .query("products")
      .withIndex("by_key", (q) => q.eq("key", args.productKey))
      .first();

    if (!product) {
      const fallback = DEFAULT_PRODUCTS.find((p) => p.key === args.productKey);
      if (fallback) return fallback;
      throw new Error(`Product '${args.productKey}' not found`);
    }

    return product;
  },
});

export const getUsageStats = query({
  args: { productKey: v.string() },
  handler: async (ctx, args) => {
    const activations = await ctx.db
      .query("workspaceProducts")
      .withIndex("by_product_status", (q) => q.eq("productKey", args.productKey))
      .collect();

    const activeList = activations.filter((a) => {
      const s = (a.status || "").toLowerCase();
      return s === "active" || s === "trial";
    });

    const uniqueWorkspaces = new Set(activeList.map((a) => a.workspaceId));

    const notifyList = await ctx.db
      .query("productNotifyList")
      .withIndex("by_product", (q) => q.eq("productKey", args.productKey))
      .collect();

    return {
      activeWorkspaces: uniqueWorkspaces.size,
      totalActivations: activeList.length,
      waitlistCount: notifyList.length,
    };
  },
});

export const getAvailableForWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const allProducts = await ctx.db.query("products").collect();
    const source = allProducts.length > 0 ? allProducts : DEFAULT_PRODUCTS;
    const visible = source.filter((p) => {
      const status = (p.status || "").toLowerCase();
      return status === "active" || status === "coming_soon" || status === "beta";
    });

    const workspaceProducts = await ctx.db
      .query("workspaceProducts")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const activatedKeys = new Set(
      workspaceProducts
        .filter((wp) => {
          const s = (wp.status || "").toLowerCase();
          return s === "active" || s === "trial";
        })
        .map((wp) => wp.productKey)
    );

    return visible
      .sort((a, b) => (a.displayOrder ?? 99) - (b.displayOrder ?? 99))
      .map((product) => ({
        ...product,
        isActivated: activatedKeys.has(product.key),
      }));
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    status: v.union(v.literal("active"), v.literal("coming_soon"), v.literal("draft")),
    displayOrder: v.number(),
    isBeta: v.optional(v.boolean()),
    isFeatured: v.optional(v.boolean()),
    iconUrl: v.optional(v.string()),
    documentationUrl: v.optional(v.string()),
    supportEmail: v.optional(v.string()),
    key: v.optional(v.string()),
    subdomain: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const key = (args.key || args.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")).trim();
    const subdomain = args.subdomain || `${key}.orviohub.com`;

    const existing = await ctx.db
      .query("products")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();

    if (existing) {
      throw new Error("A product with this key already exists.");
    }

    const productId = await ctx.db.insert("products", {
      key,
      name: args.name,
      description: args.description,
      status: args.status,
      displayOrder: args.displayOrder,
      isBeta: args.isBeta ?? false,
      isFeatured: args.isFeatured ?? false,
      iconUrl: args.iconUrl,
      subdomain,
      documentationUrl: args.documentationUrl,
      supportEmail: args.supportEmail,
      createdAt: now,
      updatedAt: now,
    });

    return await ctx.db.get(productId);
  },
});

export const update = mutation({
  args: {
    productKey: v.string(),
    updates: v.object({
      name: v.optional(v.string()),
      description: v.optional(v.string()),
      status: v.optional(
        v.union(
          v.literal("active"),
          v.literal("coming_soon"),
          v.literal("draft"),
          v.literal("ACTIVE"),
          v.literal("BETA"),
          v.literal("COMING_SOON")
        )
      ),
      isBeta: v.optional(v.boolean()),
      isFeatured: v.optional(v.boolean()),
      displayOrder: v.optional(v.number()),
      iconUrl: v.optional(v.string()),
      documentationUrl: v.optional(v.string()),
      supportEmail: v.optional(v.string()),
      subdomain: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const product = await ctx.db
      .query("products")
      .withIndex("by_key", (q) => q.eq("key", args.productKey))
      .first();

    const now = Date.now();

    if (!product) {
      // Auto-upsert default product with updates
      const defaultProd = DEFAULT_PRODUCTS.find((p) => p.key === args.productKey) || {
        key: args.productKey,
        name: args.productKey.charAt(0).toUpperCase() + args.productKey.slice(1),
        description: `Product application for ${args.productKey}`,
        subdomain: `${args.productKey}.orviohub.com`,
        status: "active" as const,
        isBeta: false,
        isFeatured: false,
        displayOrder: 99,
      };

      const newId = await ctx.db.insert("products", {
        ...defaultProd,
        ...args.updates,
        createdAt: now,
        updatedAt: now,
      });

      return await ctx.db.get(newId);
    }

    await ctx.db.patch(product._id, {
      ...args.updates,
      updatedAt: now,
    });

    return await ctx.db.get(product._id);
  },
});

export const archive = mutation({
  args: { productKey: v.string() },
  handler: async (ctx, args) => {
    const product = await ctx.db
      .query("products")
      .withIndex("by_key", (q) => q.eq("key", args.productKey))
      .first();

    if (!product) {
      throw new Error("Product not found");
    }

    await ctx.db.patch(product._id, {
      status: "draft",
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

export const deleteProduct = mutation({
  args: { productKey: v.string() },
  handler: async (ctx, args) => {
    const product = await ctx.db
      .query("products")
      .withIndex("by_key", (q) => q.eq("key", args.productKey))
      .first();

    if (!product) {
      throw new Error("Product not found");
    }

    const s = (product.status || "").toLowerCase();
    if (s !== "draft") {
      throw new Error("Only draft products can be deleted");
    }

    await ctx.db.delete(product._id);
    return { success: true };
  },
});

export const seedDefaultProducts = mutation({
  args: {},
  handler: async (ctx) => {
    const defaults = [
      {
        key: "inventory",
        name: "Inventory & POS",
        description: "Multi-branch warehouse stock, barcode POS checkout, receipts, sales history & telemetry.",
        subdomain: "inventory.orviohub.com",
        status: "active" as const,
        isBeta: false,
        isFeatured: true,
        displayOrder: 1,
        iconUrl: "/icons/inventory.svg",
      },
      {
        key: "taskmanagement",
        name: "Task & Project Management",
        description: "Agile sprints, interactive kanban boards, team workflows & milestone tracking.",
        subdomain: "tasks.orviohub.com",
        status: "active" as const,
        isBeta: false,
        isFeatured: true,
        displayOrder: 2,
        iconUrl: "/icons/tasks.svg",
      },
      {
        key: "crm",
        name: "Customer CRM",
        description: "Client contact directories, communication history, pipelines, and deal conversions.",
        subdomain: "crm.orviohub.com",
        status: "coming_soon" as const,
        isBeta: true,
        isFeatured: false,
        displayOrder: 3,
        iconUrl: "/icons/crm.svg",
      },
      {
        key: "booking",
        name: "Appointments & Booking",
        description: "Online calendar reservations, service scheduling, reminders, and client appointments.",
        subdomain: "booking.orviohub.com",
        status: "coming_soon" as const,
        isBeta: false,
        isFeatured: false,
        displayOrder: 4,
        iconUrl: "/icons/booking.svg",
      },
      {
        key: "gym",
        name: "Gym & Fitness Membership",
        description: "Member passes, attendance tracking, trainer schedules, and class subscriptions.",
        subdomain: "gym.orviohub.com",
        status: "coming_soon" as const,
        isBeta: false,
        isFeatured: false,
        displayOrder: 5,
        iconUrl: "/icons/gym.svg",
      },
    ];

    const now = Date.now();
    const created = [];
    for (const def of defaults) {
      const existing = await ctx.db
        .query("products")
        .withIndex("by_key", (q) => q.eq("key", def.key))
        .first();

      if (!existing) {
        const id = await ctx.db.insert("products", {
          ...def,
          createdAt: now,
          updatedAt: now,
        });
        created.push(id);
      }
    }

    return { createdCount: created.length };
  },
});
