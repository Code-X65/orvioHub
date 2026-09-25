import { mutation, query } from "./_generated/server.js";
import { v } from "convex/values";
import { requireAdminPermission } from "./adminAuth.js";

// Helper to authenticate admin
async function verifyAdminSession(ctx: any, sessionToken?: string, permission = "admin.applications.view") {
  return requireAdminPermission(ctx, sessionToken, permission);
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
    const { admin } = await verifyAdminSession(ctx, args.sessionToken, "admin.applications.manage");

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
    const { admin } = await verifyAdminSession(ctx, args.sessionToken, "admin.applications.manage");

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
    const { admin } = await verifyAdminSession(ctx, args.sessionToken, "admin.trial_extensions.create");

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

/**
 * listApplicationWorkspaces
 * Lists all workspaces that have activated a specific application (e.g. inventory)
 */
export const listApplicationWorkspaces = query({
  args: {
    sessionToken: v.string(),
    appKey: v.string(),
    status: v.optional(v.string()),
    planKey: v.optional(v.string()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await verifyAdminSession(ctx, args.sessionToken, "admin.members.view");

    // 1. Fetch all workspaceProducts matching appKey
    const allWp = await ctx.db
      .query("workspaceProducts")
      .withIndex("by_product_status", (q) => q.eq("productKey", args.appKey))
      .collect();

    const results = [];

    for (const wp of allWp) {
      const workspace = await ctx.db.get(wp.workspaceId);
      if (!workspace || workspace.deletedAt) continue;

      let owner = null;
      if (workspace.ownerId) {
        owner = await ctx.db.get(workspace.ownerId);
      }

      // Subscription
      let sub = await ctx.db
        .query("subscriptions")
        .withIndex("by_workspace", (q: any) => q.eq("workspaceId", wp.workspaceId))
        .first();

      if (!sub && workspace.organizationId) {
        sub = await ctx.db
          .query("subscriptions")
          .withIndex("by_organizationId", (q: any) => q.eq("organizationId", workspace.organizationId!))
          .first();
      }

      const planKey = (sub?.planKey || sub?.planId || (workspace as any).planKey || (workspace as any).planId || wp.planId || "free_trial").toLowerCase();

      // Branches count (deduplicated by ID)
      const branchesByWs = await ctx.db
        .query("branches")
        .withIndex("by_workspace", (q: any) => q.eq("workspaceId", wp.workspaceId))
        .collect();
      let branchesByOrg: any[] = [];
      if (workspace.organizationId) {
        branchesByOrg = await ctx.db
          .query("branches")
          .withIndex("by_organizationId", (q: any) => q.eq("organizationId", workspace.organizationId!))
          .collect();
      }
      const branchMap = new Map<string, any>();
      for (const b of [...branchesByWs, ...branchesByOrg]) {
        if (b.status === "active" && !b.deletedAt) {
          branchMap.set(String(b._id), b);
        }
      }
      const activeBranches = Array.from(branchMap.values());

      // Onboarding Flow
      const flow = await ctx.db
        .query("onboardingFlows")
        .withIndex("by_workspace_product", (q: any) =>
          q.eq("workspaceId", wp.workspaceId).eq("productKey", args.appKey)
        )
        .first();

      // Products count (for inventory)
      let productCount = 0;
      if (args.appKey === "inventory") {
        const prods = await ctx.db
          .query("inventoryProducts")
          .withIndex("by_workspaceId", (q: any) => q.eq("workspaceId", wp.workspaceId))
          .collect();
        productCount = prods.filter((p: any) => !p.deletedAt).length;
      }

      const wpStatus = (wp.status || "active").toLowerCase();

      // Filters
      if (args.status && args.status !== "all" && wpStatus !== args.status.toLowerCase()) {
        continue;
      }
      if (args.planKey && args.planKey !== "all" && planKey.toLowerCase() !== args.planKey.toLowerCase()) {
        continue;
      }
      if (args.search) {
        const q = args.search.toLowerCase();
        const wsName = (workspace.name || "").toLowerCase();
        const wsSlug = (workspace.slug || "").toLowerCase();
        const ownerEmail = (owner?.email || "").toLowerCase();
        const ownerName = (owner?.name || "").toLowerCase();
        if (!wsName.includes(q) && !wsSlug.includes(q) && !ownerEmail.includes(q) && !ownerName.includes(q)) {
          continue;
        }
      }

      results.push({
        id: wp._id,
        workspaceId: workspace._id,
        workspaceName: workspace.name,
        workspaceSlug: workspace.slug,
        ownerId: owner?._id,
        ownerName: owner?.name || "Unknown Owner",
        ownerEmail: owner?.email || "No email",
        planKey,
        status: wp.status,
        activatedAt: wp.activatedAt,
        trialStartedAt: wp.trialStartedAt,
        trialEndsAt: wp.trialEndsAt,
        branchCount: activeBranches.length,
        productCount,
        onboarding: {
          status: flow?.status || "not_started",
          currentStep: flow?.currentStep || "welcome",
          completedSteps: flow?.completedSteps || [],
          completedAt: flow?.completedAt,
        },
        lastActiveAt: workspace.updatedAt || wp.activatedAt,
      });
    }

    return results.sort((a, b) => (b.activatedAt || 0) - (a.activatedAt || 0));
  },
});

/**
 * getApplicationStats
 * Summary metrics for a specific application
 */
export const getApplicationStats = query({
  args: {
    sessionToken: v.string(),
    appKey: v.string(),
  },
  handler: async (ctx, args) => {
    await verifyAdminSession(ctx, args.sessionToken, "admin.members.view");

    const allWp = await ctx.db
      .query("workspaceProducts")
      .withIndex("by_product_status", (q) => q.eq("productKey", args.appKey))
      .collect();

    let totalActive = 0;
    let totalSuspended = 0;
    let totalTrial = 0;
    let onboardingCompleted = 0;
    let onboardingInProgress = 0;

    for (const wp of allWp) {
      const s = (wp.status || "").toLowerCase();
      if (s === "active") totalActive++;
      else if (s === "suspended") totalSuspended++;
      else if (s === "trial" || s === "trialing") totalTrial++;

      const flow = await ctx.db
        .query("onboardingFlows")
        .withIndex("by_workspace_product", (q: any) =>
          q.eq("workspaceId", wp.workspaceId).eq("productKey", args.appKey)
        )
        .first();

      if (flow?.status === "completed" || flow?.status === "COMPLETED") {
        onboardingCompleted++;
      } else {
        onboardingInProgress++;
      }
    }

    return {
      appKey: args.appKey,
      totalActivations: allWp.length,
      totalActive,
      totalSuspended,
      totalTrial,
      onboardingCompleted,
      onboardingInProgress,
    };
  },
});

/**
 * listAllBranchMembers (Admin) - Deprecated, team management removed
 */
export const listAllBranchMembers = query({
  args: {
    sessionToken: v.string(),
    workspaceId: v.optional(v.string()),
    role: v.optional(v.string()),
    status: v.optional(v.string()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await verifyAdminSession(ctx, args.sessionToken);
    return [];
  },
});

/**
 * listAllBranchTransfers (Admin) - Deprecated, team management removed
 */
export const listAllBranchTransfers = query({
  args: {
    sessionToken: v.string(),
    workspaceId: v.optional(v.string()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await verifyAdminSession(ctx, args.sessionToken);
    return [];
  },
});

