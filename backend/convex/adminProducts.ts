import { mutation, query } from "./_generated/server.js";
import { v } from "convex/values";

// Helper to authenticate admin
async function verifyAdminSession(ctx: any, sessionToken?: string) {
  if (!sessionToken) throw new Error("Admin authentication required.");
  const session = await ctx.db
    .query("adminSessions")
    .withIndex("by_token", (q: any) => q.eq("sessionToken", sessionToken))
    .first();

  if (!session || session.expiresAt < Date.now()) {
    throw new Error("Invalid or expired session.");
  }
  const admin = await ctx.db.get(session.adminId);
  if (!admin || !admin.isActive) {
    throw new Error("Unauthorized admin account.");
  }
  return { admin, session };
}

async function logAudit(ctx: any, adminId: any, action: string, resourceId?: string, details?: any) {
  await ctx.db.insert("adminAuditLogs", {
    adminId,
    action,
    resourceType: "products",
    resourceId,
    details,
    createdAt: Date.now(),
  });
}

/**
 * listProducts
 * Returns all catalog products with live activation counts
 */
export const listProducts = query({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    await verifyAdminSession(ctx, args.sessionToken);

    let products = await ctx.db.query("products").collect();

    // Default seed fallback if products table is currently empty
    if (products.length === 0) {
      const defaultProducts = [
        {
          _id: "prod_inventory" as any,
          key: "inventory",
          name: "Inventory & POS",
          description: "Stock tracking, barcode management, receipts, and point-of-sale checkout.",
          subdomain: "inventory.orviohub.com",
          status: "ACTIVE" as const,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          _id: "prod_tasks" as any,
          key: "taskmanagement",
          name: "Task & Project Management",
          description: "Kanban boards, team assignments, milestones, and project tracking.",
          subdomain: "tasks.orviohub.com",
          status: "ACTIVE" as const,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          _id: "prod_crm" as any,
          key: "crm",
          name: "Customer CRM",
          description: "Client contact directories, interaction history, and lead pipelines.",
          subdomain: "crm.orviohub.com",
          status: "BETA" as const,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          _id: "prod_booking" as any,
          key: "booking",
          name: "Appointments & Booking",
          description: "Online calendar reservations, service scheduling, and client bookings.",
          subdomain: "booking.orviohub.com",
          status: "COMING_SOON" as const,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];
      products = defaultProducts as any;
    }

    const allWorkspaceProducts = await ctx.db.query("workspaceProducts").collect();
    const countMap: Record<string, number> = {};
    for (const wp of allWorkspaceProducts) {
      countMap[wp.productKey] = (countMap[wp.productKey] || 0) + 1;
    }

    return products.map((p: any) => ({
      id: p._id,
      key: p.key,
      name: p.name,
      description: p.description,
      subdomain: p.subdomain,
      status: p.status,
      activationCount: countMap[p.key] || 0,
      createdAt: p.createdAt,
    }));
  },
});

/**
 * enableProductGlobally
 * Enables product in the platform registry
 */
export const enableProductGlobally = mutation({
  args: {
    sessionToken: v.string(),
    productId: v.id("products"),
  },
  handler: async (ctx, args) => {
    const { admin } = await verifyAdminSession(ctx, args.sessionToken);

    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found.");

    await ctx.db.patch(args.productId, {
      status: "ACTIVE",
      updatedAt: Date.now(),
    });

    await logAudit(ctx, admin._id, "PRODUCT_ENABLED_GLOBALLY", args.productId, {
      productKey: product.key,
      name: product.name,
    });

    return { success: true };
  },
});

/**
 * disableProductGlobally
 * Sets product to COMING_SOON / BETA
 */
export const disableProductGlobally = mutation({
  args: {
    sessionToken: v.string(),
    productId: v.id("products"),
    newStatus: v.union(v.literal("BETA"), v.literal("COMING_SOON")),
  },
  handler: async (ctx, args) => {
    const { admin } = await verifyAdminSession(ctx, args.sessionToken);

    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found.");

    await ctx.db.patch(args.productId, {
      status: args.newStatus,
      updatedAt: Date.now(),
    });

    await logAudit(ctx, admin._id, "PRODUCT_STATUS_CHANGED", args.productId, {
      productKey: product.key,
      newStatus: args.newStatus,
    });

    return { success: true };
  },
});

/**
 * grantExtendedTrial
 * Extends trial period for a workspace product
 */
export const grantExtendedTrial = mutation({
  args: {
    sessionToken: v.string(),
    workspaceId: v.id("workspaces"),
    productKey: v.string(),
    additionalDays: v.number(),
  },
  handler: async (ctx, args) => {
    const { admin } = await verifyAdminSession(ctx, args.sessionToken);

    const wp = await ctx.db
      .query("workspaceProducts")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .filter((q) => q.eq(q.field("productKey"), args.productKey))
      .first();

    if (!wp) throw new Error("Workspace product activation record not found.");

    const now = Date.now();
    const currentExpiry = wp.trialEndsAt && wp.trialEndsAt > now ? wp.trialEndsAt : now;
    const newTrialEndsAt = currentExpiry + args.additionalDays * 24 * 60 * 60 * 1000;

    await ctx.db.patch(wp._id, {
      trialEndsAt: newTrialEndsAt,
      status: "ACTIVE",
    });

    await logAudit(ctx, admin._id, "PRODUCT_TRIAL_EXTENDED", wp._id, {
      workspaceId: args.workspaceId,
      productKey: args.productKey,
      additionalDays: args.additionalDays,
      newTrialEndsAt,
    });

    return { success: true, newTrialEndsAt };
  },
});
