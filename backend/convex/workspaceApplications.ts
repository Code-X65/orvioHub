/**
 * workspaceApplications.ts
 *
 * Workspace application foundation — Inventory activation, status management,
 * and access resolution.
 *
 * IMPORTANT: Only "inventory" is visible/activatable to users.
 * Future applications must remain hidden, disabled, and inaccessible.
 */
import { query, mutation } from "./_generated/server.js";
import { v } from "convex/values";

/** The only application visible and activatable in the MVP. */
const VISIBLE_APP_KEY = "inventory";

/**
 * Internal helper — verify caller has active membership and return role.
 */
async function resolveActiveMembership(
  ctx: any,
  workspaceId: any,
  userId: any
): Promise<{ role: string; membership: any }> {
  const membership = await ctx.db
    .query("workspaceMemberships")
    .withIndex("by_workspace_user", (q: any) =>
      q.eq("workspaceId", workspaceId).eq("userId", userId)
    )
    .first();

  if (!membership || membership.status.toLowerCase() !== "active") {
    throw new Error("WORKSPACE_ACCESS_DENIED");
  }

  return { role: (membership.role || "member").toUpperCase(), membership };
}

/**
 * Internal helper — verify workspace exists, is not deleted/archived.
 */
async function resolveActiveWorkspace(ctx: any, rawId: string): Promise<any> {
  const wsId = ctx.db.normalizeId("workspaces", rawId);
  const ws = wsId ? await ctx.db.get(wsId) : null;
  if (!ws || ws.deletedAt || ["deleted", "deleting"].includes((ws.status || "").toLowerCase())) {
    throw new Error("WORKSPACE_NOT_FOUND");
  }
  if ((ws.status || "").toLowerCase() === "suspended") {
    throw new Error("WORKSPACE_SUSPENDED");
  }
  if ((ws.status || "").toLowerCase() === "archived") {
    throw new Error("WORKSPACE_ARCHIVED");
  }
  return ws;
}

// ==========================================
// QUERIES
// ==========================================

/**
 * GET /v1/workspaces/:workspaceId/applications
 * Returns applications visible to the authenticated user.
 * Only "inventory" is shown. Future apps are excluded.
 */
export const getWorkspaceApplications = query({
  args: {
    workspaceId: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const wsId = ctx.db.normalizeId("workspaces", args.workspaceId);
    if (!wsId) return [];
    const ws = await ctx.db.get(wsId);
    if (!ws) return [];

    // Verify membership
    const membership = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_workspace_user", (q: any) =>
        q.eq("workspaceId", wsId).eq("userId", args.userId)
      )
      .first();

    const isOwner = ws.ownerId === args.userId;
    if (!membership && !isOwner) return [];

    // Only return inventory
    const inventoryProduct = await ctx.db
      .query("workspaceProducts")
      .withIndex("by_workspace_product", (q: any) =>
        q.eq("workspaceId", wsId).eq("productKey", VISIBLE_APP_KEY)
      )
      .first();

    const inventoryStatus = inventoryProduct?.status || "inactive";
    const access =
      membership &&
      ["active", "suspended"].includes(membership.status.toLowerCase()) ||
      isOwner;

    return [
      {
        key: VISIBLE_APP_KEY,
        name: "Inventory",
        description: "Point of sale, stock management, and branch operations",
        status: inventoryStatus,
        access,
        setupIncomplete:
          inventoryStatus === "setup_incomplete" || inventoryStatus === "activating",
        onboardingStatus: inventoryProduct?.onboardingStatus || null,
        activatedAt: inventoryProduct?.activatedAt || null,
      },
    ];
  },
});

/**
 * GET /v1/workspaces/:workspaceId/applications/inventory
 */
export const getInventoryApplication = query({
  args: {
    workspaceId: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const wsId = ctx.db.normalizeId("workspaces", args.workspaceId);
    if (!wsId) return null;
    const ws = await ctx.db.get(wsId);
    if (!ws) return null;

    const isOwner = ws.ownerId === args.userId;
    const membership = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_workspace_user", (q: any) =>
        q.eq("workspaceId", wsId).eq("userId", args.userId)
      )
      .first();

    if (!membership && !isOwner) return null;

    const product = await ctx.db
      .query("workspaceProducts")
      .withIndex("by_workspace_product", (q: any) =>
        q.eq("workspaceId", wsId).eq("productKey", VISIBLE_APP_KEY)
      )
      .first();

    if (!product) {
      return {
        key: VISIBLE_APP_KEY,
        name: "Inventory",
        status: "inactive",
        access: isOwner || membership?.status.toLowerCase() === "active",
        setupIncomplete: false,
      };
    }

    return {
      key: VISIBLE_APP_KEY,
      name: "Inventory",
      status: product.status,
      onboardingStatus: product.onboardingStatus,
      activatedAt: product.activatedAt,
      activatedBy: product.activatedBy,
      access: isOwner || membership?.status.toLowerCase() === "active",
      setupIncomplete:
        product.status === "setup_incomplete" || product.status === "activating",
    };
  },
});

// ==========================================
// MUTATIONS
// ==========================================

/**
 * POST /v1/workspaces/:workspaceId/applications/inventory/activate
 *
 * Activates Inventory for the workspace. Creates:
 * - workspaceProducts record (or updates existing)
 * - Primary demo branch (if none exists)
 * - Audit event
 * - Welcome notification
 */
export const activateInventory = mutation({
  args: {
    workspaceId: v.string(),
    userId: v.id("users"),
    requestId: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const wsId = ctx.db.normalizeId("workspaces", args.workspaceId);
    if (!wsId) throw new Error("WORKSPACE_NOT_FOUND");

    const ws = await ctx.db.get(wsId);
    if (!ws) throw new Error("WORKSPACE_NOT_FOUND");

    const wsStatus = (ws.status || "active").toLowerCase();
    if (["deleted", "deleting", "suspended", "archived"].includes(wsStatus)) {
      throw new Error(`WORKSPACE_${wsStatus.toUpperCase()}`);
    }

    // Verify membership and permission
    const { role } = await resolveActiveMembership(ctx, wsId, args.userId);
    if (!["OWNER", "ADMIN"].includes(role)) {
      throw new Error("INSUFFICIENT_PERMISSION");
    }

    // Check if already activated
    let product = await ctx.db
      .query("workspaceProducts")
      .withIndex("by_workspace_product", (q: any) =>
        q.eq("workspaceId", wsId).eq("productKey", VISIBLE_APP_KEY)
      )
      .first();

    if (product) {
      if (product.status === "active") {
        return { alreadyActive: true, productId: product._id };
      }
      // Re-activate suspended/deactivated
      await ctx.db.patch(product._id, {
        status: "setup_incomplete",
        updatedAt: now,
      });
    } else {
      // Create product entitlement
      await ctx.db.insert("workspaceProducts", {
        workspaceId: wsId,
        productKey: VISIBLE_APP_KEY,
        status: "setup_incomplete",
        onboardingStatus: "pending",
        activatedBy: args.userId,
        activatedAt: now,
        trialStartedAt: now,
        trialEndsAt: now + 30 * 86_400_000,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Create primary demo branch if none exists
    const existingBranch = await ctx.db
      .query("branches")
      .withIndex("by_workspace_product", (q: any) =>
        q.eq("workspaceId", wsId).eq("productKey", VISIBLE_APP_KEY)
      )
      .first();

    let primaryBranchId: any = existingBranch?._id;

    if (!existingBranch) {
      primaryBranchId = await ctx.db.insert("branches", {
        workspaceId: wsId,
        productKey: VISIBLE_APP_KEY,
        name: "Main Branch",
        code: "MAIN",
        description: "Primary demo branch",
        isPrimary: true,
        isActive: true,
        status: "active",
        createdBy: args.userId,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Audit event
    await ctx.db.insert("workspaceAuditLogs", {
      workspaceId: wsId,
      actorUserId: args.userId,
      eventType: "workspace.product_activated",
      entityType: "workspace_product",
      entityId: wsId,
      productKey: VISIBLE_APP_KEY,
      severity: "info",
      metadata: {
        productKey: VISIBLE_APP_KEY,
        primaryBranchId,
      },
      requestId: args.requestId,
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
      createdAt: now,
    });

    // Notification to activating user
    await ctx.db.insert("notifications", {
      userId: args.userId,
      workspaceId: wsId,
      productKey: VISIBLE_APP_KEY,
      type: "workspace.product_activated",
      title: "Inventory Activated",
      body: "Inventory has been activated for your workspace. Your main branch is ready to set up.",
      severity: "SUCCESS",
      channel: "IN_APP",
      status: "UNREAD",
      createdAt: now,
    });

    return { alreadyActive: false, primaryBranchId };
  },
});

/**
 * POST /v1/workspaces/:workspaceId/applications/inventory/suspend
 */
export const suspendInventory = mutation({
  args: {
    workspaceId: v.string(),
    userId: v.id("users"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const wsId = ctx.db.normalizeId("workspaces", args.workspaceId);
    if (!wsId) throw new Error("WORKSPACE_NOT_FOUND");

    const { role } = await resolveActiveMembership(ctx, wsId, args.userId);
    if (!["OWNER", "ADMIN"].includes(role)) throw new Error("INSUFFICIENT_PERMISSION");

    const product = await ctx.db
      .query("workspaceProducts")
      .withIndex("by_workspace_product", (q: any) =>
        q.eq("workspaceId", wsId).eq("productKey", VISIBLE_APP_KEY)
      )
      .first();

    if (!product) throw new Error("PRODUCT_NOT_FOUND");

    await ctx.db.patch(product._id, {
      status: "suspended",
      suspendedAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("workspaceAuditLogs", {
      workspaceId: wsId,
      actorUserId: args.userId,
      eventType: "workspace.product_suspended",
      entityType: "workspace_product",
      entityId: wsId,
      productKey: VISIBLE_APP_KEY,
      severity: "warning",
      metadata: { reason: args.reason },
      createdAt: now,
    });

    return { suspended: true };
  },
});

/**
 * POST /v1/workspaces/:workspaceId/applications/inventory/restore
 */
export const restoreInventory = mutation({
  args: {
    workspaceId: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const wsId = ctx.db.normalizeId("workspaces", args.workspaceId);
    if (!wsId) throw new Error("WORKSPACE_NOT_FOUND");

    const { role } = await resolveActiveMembership(ctx, wsId, args.userId);
    if (!["OWNER", "ADMIN"].includes(role)) throw new Error("INSUFFICIENT_PERMISSION");

    const product = await ctx.db
      .query("workspaceProducts")
      .withIndex("by_workspace_product", (q: any) =>
        q.eq("workspaceId", wsId).eq("productKey", VISIBLE_APP_KEY)
      )
      .first();

    if (!product) throw new Error("PRODUCT_NOT_FOUND");

    await ctx.db.patch(product._id, {
      status: "active",
      updatedAt: now,
    });

    await ctx.db.insert("workspaceAuditLogs", {
      workspaceId: wsId,
      actorUserId: args.userId,
      eventType: "workspace.product_restored",
      entityType: "workspace_product",
      entityId: wsId,
      productKey: VISIBLE_APP_KEY,
      severity: "info",
      createdAt: now,
    });

    return { restored: true };
  },
});
