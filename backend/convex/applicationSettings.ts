import { mutation, query } from "./_generated/server.js";
import { v } from "convex/values";

async function resolveWorkspace(ctx: any, id: any) {
  let ws: any = null;
  try {
    ws = await (ctx.db as any).get(id);
  } catch {}
  if (!ws) {
    try {
      ws = await ctx.db
        .query("workspaces")
        .withIndex("by_organizationId", (q: any) => q.eq("organizationId", id))
        .first();
    } catch {}
  }
  return ws;
}

/**
 * Get application settings for a specific productKey (e.g. "inventory")
 */
export const getApplicationSettings = query({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
    productKey: v.string(),
  },
  handler: async (ctx, args) => {
    const ws = await resolveWorkspace(ctx, args.workspaceId);
    const targetWorkspaceId = ws ? ws._id : args.workspaceId;

    const appSettings = await ctx.db
      .query("applicationSettings")
      .withIndex("by_workspace_product", (q) =>
        q.eq("workspaceId", targetWorkspaceId).eq("productKey", args.productKey)
      )
      .first();

    // Default settings defaults for Inventory
    const defaultInventorySettings = {
      productConfig: {
        skuPrefix: "PRD",
        autoGenerateSku: true,
        enableBarcodes: true,
        defaultCategory: "General",
        allowProductArchive: true,
        priceLevelsEnabled: false,
        costVisibility: "admin_only",
      },
      stockRules: {
        negativeStockAllowed: false,
        lowStockThreshold: 10,
        stockAdjustmentApprovalRequired: false,
        costingMethod: "FIFO",
        autoDeductOnSale: true,
        branchTransferApprovalRequired: true,
      },
      salesRules: {
        paymentMethods: ["CASH", "CARD", "TRANSFER"],
        allowCreditSales: false,
        allowDiscounts: true,
        maxDiscountPercentage: 15,
        requireCustomerForCredit: true,
        saleCancellationAllowed: true,
        receiptPrefix: "INV-",
      },
      receiptSettings: {
        storeName: ws?.name || "Store",
        tagline: "Quality & Service",
        footerMessage: "Thank you for your business!",
        showCashier: true,
        showCustomer: true,
        showBarcode: true,
        taxDisplay: true,
        paperWidth: "80mm",
      },
    };

    return {
      workspaceId: targetWorkspaceId,
      productKey: args.productKey,
      displayName: appSettings?.displayName || (args.productKey === "inventory" ? "Inventory & POS" : args.productKey),
      enabled: appSettings?.enabled ?? (ws?.enabledModules?.includes(args.productKey) || false),
      settings: appSettings?.settings || (args.productKey === "inventory" ? defaultInventorySettings : {}),
      updatedAt: appSettings?.updatedAt || Date.now(),
    };
  },
});

/**
 * Update application settings for a specific productKey
 */
export const updateApplicationSettings = mutation({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
    productKey: v.string(),
    displayName: v.optional(v.string()),
    settings: v.any(),
    callerUserId: v.optional(v.union(v.id("users"), v.string())),
  },
  handler: async (ctx, args) => {
    const ws = await resolveWorkspace(ctx, args.workspaceId);
    if (!ws) throw new Error("Workspace not found");

    const now = Date.now();

    const existing = await ctx.db
      .query("applicationSettings")
      .withIndex("by_workspace_product", (q) =>
        q.eq("workspaceId", ws._id).eq("productKey", args.productKey)
      )
      .first();

    let beforeValues: any = null;

    if (existing) {
      beforeValues = existing.settings;
      await ctx.db.patch(existing._id, {
        displayName: args.displayName || existing.displayName,
        settings: args.settings,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("applicationSettings", {
        workspaceId: ws._id,
        productKey: args.productKey,
        displayName: args.displayName || args.productKey,
        enabled: true,
        settings: args.settings,
        createdAt: now,
        updatedAt: now,
      });
    }

    if (args.callerUserId) {
      await ctx.db.insert("workspaceAuditLogs", {
        workspaceId: ws._id,
        actorUserId: args.callerUserId as any,
        productKey: args.productKey,
        action: "application.settings_updated",
        eventType: "application.settings_updated",
        resourceType: "application_settings",
        resourceId: args.productKey,
        beforeValues,
        afterValues: args.settings,
        createdAt: now,
      });
    }

    return { success: true };
  },
});

/**
 * List all applications with status for a workspace
 */
export const listWorkspaceApplications = query({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
  },
  handler: async (ctx, args) => {
    const ws = await resolveWorkspace(ctx, args.workspaceId);
    if (!ws) return [];

    const availableApps = [
      {
        key: "inventory",
        name: "Inventory & POS",
        description: "Complete retail, stock management, barcode scanning, and multi-branch sales tracking.",
        icon: "Package",
        category: "Commerce",
        status: ws.enabledModules?.includes("inventory") ? "active" : "available",
      },
      {
        key: "taskmanagement",
        name: "Tasks & Operations",
        description: "Internal team workflows, staff task assignments, and checklist execution.",
        icon: "CheckSquare",
        category: "Productivity",
        status: ws.enabledModules?.includes("taskmanagement") ? "active" : "available",
      },
      {
        key: "crm",
        name: "Customer CRM",
        description: "Manage client relationships, purchase histories, loyalty, and communications.",
        icon: "Users",
        category: "Commerce",
        status: ws.enabledModules?.includes("crm") ? "active" : "available",
      },
      {
        key: "accounting",
        name: "Financial Accounting",
        description: "General ledger, income statements, tax reporting, and multi-currency ledgers.",
        icon: "Calculator",
        category: "Finance",
        status: ws.enabledModules?.includes("accounting") ? "active" : "available",
      },
    ];

    return availableApps;
  },
});

/**
 * Set application activation/suspension status
 */
export const setApplicationStatus = mutation({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
    productKey: v.string(),
    action: v.union(
      v.literal("activate"),
      v.literal("deactivate"),
      v.literal("suspend"),
      v.literal("restore")
    ),
    callerUserId: v.optional(v.union(v.id("users"), v.string())),
  },
  handler: async (ctx, args) => {
    const ws = await resolveWorkspace(ctx, args.workspaceId);
    if (!ws) throw new Error("Workspace not found");

    const now = Date.now();
    const currentModules = ws.enabledModules || [];
    let updatedModules = [...currentModules];

    if (args.action === "activate" || args.action === "restore") {
      if (!updatedModules.includes(args.productKey)) {
        updatedModules.push(args.productKey);
      }
    } else if (args.action === "deactivate" || args.action === "suspend") {
      updatedModules = updatedModules.filter((m) => m !== args.productKey);
    }

    await ctx.db.patch(ws._id, {
      enabledModules: updatedModules,
      updatedAt: now,
    });

    // Also update applicationSettings if present
    const appSettings = await ctx.db
      .query("applicationSettings")
      .withIndex("by_workspace_product", (q) =>
        q.eq("workspaceId", ws._id).eq("productKey", args.productKey)
      )
      .first();

    if (appSettings) {
      await ctx.db.patch(appSettings._id, {
        enabled: args.action === "activate" || args.action === "restore",
        updatedAt: now,
      });
    }

    if (args.callerUserId) {
      await ctx.db.insert("workspaceAuditLogs", {
        workspaceId: ws._id,
        actorUserId: args.callerUserId as any,
        productKey: args.productKey,
        action: `application.${args.action}d`,
        eventType: `application.${args.action}d`,
        resourceType: "workspace_application",
        resourceId: args.productKey,
        afterValues: { status: args.action, enabledModules: updatedModules },
        createdAt: now,
      });
    }

    return { success: true, enabledModules: updatedModules };
  },
});
