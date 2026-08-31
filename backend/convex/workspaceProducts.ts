import { query, mutation } from "./_generated/server.js";
import { v } from "convex/values";

export const countActive = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const products = await ctx.db
      .query("workspaceProducts")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    return products.filter((p) => {
      const s = (p.status || "").toLowerCase();
      return s === "active" || s === "trial";
    }).length;
  },
});

export const activate = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    productKey: v.string(),
    activatedBy: v.id("users"),
    planId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("workspaceProducts")
      .withIndex("by_workspace_product", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("productKey", args.productKey)
      )
      .first();

    const now = Date.now();

    if (existing) {
      const status = (existing.status || "").toLowerCase();
      if (status === "active" || status === "trial") {
        return { alreadyActivated: true, workspaceProduct: existing };
      }
      await ctx.db.patch(existing._id, {
        status: "active",
        planId: args.planId || existing.planId || "standard",
        activatedBy: args.activatedBy,
        activatedAt: now,
      });
      return { alreadyActivated: false, workspaceProduct: await ctx.db.get(existing._id) };
    }

    const workspaceProductId = await ctx.db.insert("workspaceProducts", {
      workspaceId: args.workspaceId,
      productKey: args.productKey,
      status: "active",
      planId: args.planId || "standard",
      trialStartedAt: now,
      trialEndsAt: now + 30 * 86_400_000,
      activatedBy: args.activatedBy,
      activatedAt: now,
    });

    // Ensure product membership for activating owner
    const existingProductMembership = await ctx.db
      .query("productMemberships")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", args.activatedBy)
      )
      .filter((q) => q.eq(q.field("productKey"), args.productKey))
      .first();

    if (!existingProductMembership) {
      await ctx.db.insert("productMemberships", {
        workspaceId: args.workspaceId,
        userId: args.activatedBy,
        productKey: args.productKey,
        role: "owner",
        permissions: ["*"],
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
    }

    // High-severity / Informational Audit Log
    await ctx.db.insert("workspaceAuditLogs", {
      workspaceId: args.workspaceId,
      actorUserId: args.activatedBy,
      eventType: "workspace.product_activated",
      entityType: "product",
      entityId: args.productKey,
      severity: "info",
      metadata: { productKey: args.productKey, planId: args.planId || "standard" },
      createdAt: now,
    });

    return {
      alreadyActivated: false,
      workspaceProduct: await ctx.db.get(workspaceProductId),
    };
  },
});
