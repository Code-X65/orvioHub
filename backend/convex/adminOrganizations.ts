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
    resourceType: "workspaces",
    resourceId,
    details,
    createdAt: Date.now(),
  });
}

/**
 * listOrganizations
 * Paginated query for workspaces/organizations with member counts and owner details
 */
export const listOrganizations = query({
  args: {
    sessionToken: v.string(),
    search: v.optional(v.string()),
    statusFilter: v.optional(v.string()),
    typeFilter: v.optional(v.string()),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
    sortBy: v.optional(v.string()), // "createdAt" | "name"
    sortOrder: v.optional(v.string()), // "asc" | "desc"
  },
  handler: async (ctx, args) => {
    await verifyAdminSession(ctx, args.sessionToken);

    let workspaces = await ctx.db.query("workspaces").collect();

    // 1. Search Filter (name or slug)
    if (args.search && args.search.trim()) {
      const q = args.search.toLowerCase().trim();
      workspaces = workspaces.filter((w: any) => {
        const name = (w.name || "").toLowerCase();
        const slug = (w.slug || "").toLowerCase();
        return name.includes(q) || slug.includes(q);
      });
    }

    // 2. Status Filter
    if (args.statusFilter && args.statusFilter !== "all") {
      const targetStatus = args.statusFilter.toLowerCase();
      workspaces = workspaces.filter(
        (w: any) => (w.status || "active").toLowerCase() === targetStatus
      );
    }

    // 3. Type Filter
    if (args.typeFilter && args.typeFilter !== "all") {
      const targetType = args.typeFilter.toLowerCase();
      workspaces = workspaces.filter(
        (w: any) => (w.type || "business").toLowerCase() === targetType
      );
    }

    // 4. Sorting
    const sortBy = args.sortBy || "createdAt";
    const sortOrder = args.sortOrder || "desc";
    workspaces.sort((a: any, b: any) => {
      let valA = a[sortBy] ?? 0;
      let valB = b[sortBy] ?? 0;
      if (typeof valA === "string") valA = valA.toLowerCase();
      if (typeof valB === "string") valB = valB.toLowerCase();

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    const totalCount = workspaces.length;
    const page = Math.max(1, args.page || 1);
    const pageSize = Math.min(100, Math.max(1, args.pageSize || 10));
    const offset = (page - 1) * pageSize;
    const paginated = workspaces.slice(offset, offset + pageSize);

    // Fetch members and products counts
    const allMemberships = await ctx.db.query("workspaceMemberships").collect();
    const allProducts = await ctx.db.query("workspaceProducts").collect();

    const memberCountMap: Record<string, number> = {};
    for (const m of allMemberships) {
      memberCountMap[m.workspaceId] = (memberCountMap[m.workspaceId] || 0) + 1;
    }

    const productCountMap: Record<string, string[]> = {};
    for (const p of allProducts) {
      if (!productCountMap[p.workspaceId]) productCountMap[p.workspaceId] = [];
      productCountMap[p.workspaceId].push(p.productKey);
    }

    // Enrich with owner email
    const items = [];
    for (const ws of paginated) {
      let ownerEmail = "Unknown";
      let ownerName = "Unknown";
      if (ws.ownerId) {
        const owner: any = await ctx.db.get(ws.ownerId);
        if (owner) {
          ownerEmail = owner.email;
          ownerName = owner.name || owner.displayName || "Owner";
        }
      }

      items.push({
        id: ws._id,
        name: ws.name,
        slug: ws.slug,
        type: ws.type || "business",
        status: ws.status || "active",
        ownerId: ws.ownerId,
        ownerName,
        ownerEmail,
        memberCount: memberCountMap[ws._id] || 0,
        enabledProducts: productCountMap[ws._id] || ws.enabledModules || [],
        currency: ws.currency || "NGN",
        country: ws.country,
        createdAt: ws.createdAt,
      });
    }

    return {
      items,
      totalCount,
      page,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize),
    };
  },
});

/**
 * getOrganizationDetails
 * Full detail inspection of a single organization
 */
export const getOrganizationDetails = query({
  args: {
    sessionToken: v.string(),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    await verifyAdminSession(ctx, args.sessionToken);

    const ws = await ctx.db.get(args.workspaceId);
    if (!ws) throw new Error("Organization not found.");

    // 1. Owner info
    let owner = null;
    if (ws.ownerId) {
      const ownerDoc: any = await ctx.db.get(ws.ownerId);
      if (ownerDoc) {
        owner = {
          id: ownerDoc._id,
          name: ownerDoc.name || ownerDoc.displayName || "Owner",
          email: ownerDoc.email,
          createdAt: ownerDoc.createdAt,
        };
      }
    }

    // 2. Memberships
    const memberships = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const memberDetails = [];
    for (const m of memberships) {
      const u: any = await ctx.db.get(m.userId);
      memberDetails.push({
        id: m._id,
        userId: m.userId,
        name: u?.name || "User",
        email: u?.email || "Unknown",
        role: m.role,
        status: m.status,
        joinedAt: m.createdAt,
      });
    }

    // 3. Products
    const products = await ctx.db
      .query("workspaceProducts")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    // 4. Branches
    const branches = await ctx.db
      .query("branches")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    // 5. Onboarding flows
    const flows = await ctx.db
      .query("onboardingFlows")
      .withIndex("by_workspaceId", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    return {
      organization: {
        id: ws._id,
        name: ws.name,
        slug: ws.slug,
        type: ws.type || "business",
        status: ws.status || "active",
        country: ws.country,
        state: ws.state,
        city: ws.city,
        timezone: ws.timezone,
        currency: ws.currency || "NGN",
        logoUrl: ws.logoUrl,
        createdAt: ws.createdAt,
      },
      owner,
      members: memberDetails,
      products: products.map((p: any) => ({
        id: p._id,
        productKey: p.productKey,
        status: p.status,
        trialEndsAt: p.trialEndsAt,
        activatedAt: p.activatedAt,
      })),
      branches: branches.map((b: any) => ({
        id: b._id,
        name: b.name,
        code: b.code,
        status: b.status,
        address: b.address,
      })),
      onboarding: flows.map((f: any) => ({
        id: f._id,
        productKey: f.productKey,
        status: f.status,
        currentStep: f.currentStep,
        completedSteps: f.completedSteps,
        lastUpdatedAt: f.lastUpdatedAt,
      })),
    };
  },
});

/**
 * suspendOrganization
 * Suspends an organization and disables active product access
 */
export const suspendOrganization = mutation({
  args: {
    sessionToken: v.string(),
    workspaceId: v.id("workspaces"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { admin } = await verifyAdminSession(ctx, args.sessionToken);

    const ws = await ctx.db.get(args.workspaceId);
    if (!ws) throw new Error("Organization not found.");

    const now = Date.now();
    await ctx.db.patch(args.workspaceId, {
      status: "suspended",
      updatedAt: now,
    });

    await logAudit(ctx, admin._id, "ORGANIZATION_SUSPENDED", args.workspaceId, {
      name: ws.name,
      slug: ws.slug,
      reason: args.reason,
    });

    return { success: true };
  },
});

/**
 * activateOrganization
 * Reactivates a suspended organization
 */
export const activateOrganization = mutation({
  args: {
    sessionToken: v.string(),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const { admin } = await verifyAdminSession(ctx, args.sessionToken);

    const ws = await ctx.db.get(args.workspaceId);
    if (!ws) throw new Error("Organization not found.");

    await ctx.db.patch(args.workspaceId, {
      status: "active",
      updatedAt: Date.now(),
    });

    await logAudit(ctx, admin._id, "ORGANIZATION_ACTIVATED", args.workspaceId, {
      name: ws.name,
    });

    return { success: true };
  },
});

/**
 * transferOwnership
 * Transfers workspace ownership to another user
 */
export const transferOwnership = mutation({
  args: {
    sessionToken: v.string(),
    workspaceId: v.id("workspaces"),
    newOwnerUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { admin } = await verifyAdminSession(ctx, args.sessionToken);

    const ws = await ctx.db.get(args.workspaceId);
    if (!ws) throw new Error("Organization not found.");

    const newOwner = await ctx.db.get(args.newOwnerUserId);
    if (!newOwner) throw new Error("Target new owner user not found.");

    const now = Date.now();
    const oldOwnerId = ws.ownerId;

    // Update workspace ownerId
    await ctx.db.patch(args.workspaceId, {
      ownerId: args.newOwnerUserId,
      updatedAt: now,
    });

    // Ensure new owner has OWNER role in workspaceMemberships
    const newOwnerMembership = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .filter((q) => q.eq(q.field("userId"), args.newOwnerUserId))
      .first();

    if (newOwnerMembership) {
      await ctx.db.patch(newOwnerMembership._id, {
        role: "OWNER",
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("workspaceMemberships", {
        workspaceId: args.workspaceId,
        userId: args.newOwnerUserId,
        role: "OWNER",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
    }

    await logAudit(ctx, admin._id, "ORGANIZATION_OWNERSHIP_TRANSFERRED", args.workspaceId, {
      workspaceName: ws.name,
      oldOwnerId,
      newOwnerUserId: args.newOwnerUserId,
      newOwnerEmail: newOwner.email,
    });

    return { success: true };
  },
});

/**
 * enableProduct
 * Manually activates a product for an organization
 */
export const enableProduct = mutation({
  args: {
    sessionToken: v.string(),
    workspaceId: v.id("workspaces"),
    productKey: v.string(),
  },
  handler: async (ctx, args) => {
    const { admin } = await verifyAdminSession(ctx, args.sessionToken);

    const ws = await ctx.db.get(args.workspaceId);
    if (!ws) throw new Error("Organization not found.");

    const now = Date.now();
    const existing = await ctx.db
      .query("workspaceProducts")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .filter((q) => q.eq(q.field("productKey"), args.productKey))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "ACTIVE",
      });
    } else {
      await ctx.db.insert("workspaceProducts", {
        workspaceId: args.workspaceId,
        productKey: args.productKey,
        status: "ACTIVE",
        activatedBy: ws.ownerId || admin._id,
        activatedAt: now,
      });
    }

    await logAudit(ctx, admin._id, "ORGANIZATION_PRODUCT_ENABLED", args.workspaceId, {
      productKey: args.productKey,
      workspaceName: ws.name,
    });

    return { success: true };
  },
});

/**
 * disableProduct
 * Disables a product for an organization
 */
export const disableProduct = mutation({
  args: {
    sessionToken: v.string(),
    workspaceId: v.id("workspaces"),
    productKey: v.string(),
  },
  handler: async (ctx, args) => {
    const { admin } = await verifyAdminSession(ctx, args.sessionToken);

    const ws = await ctx.db.get(args.workspaceId);
    if (!ws) throw new Error("Organization not found.");

    const existing = await ctx.db
      .query("workspaceProducts")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .filter((q) => q.eq(q.field("productKey"), args.productKey))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "SUSPENDED",
        suspendedAt: Date.now(),
      });
    }

    await logAudit(ctx, admin._id, "ORGANIZATION_PRODUCT_DISABLED", args.workspaceId, {
      productKey: args.productKey,
      workspaceName: ws.name,
    });

    return { success: true };
  },
});

/**
 * resetOnboarding
 * Resets onboarding flows for an organization
 */
export const resetOnboarding = mutation({
  args: {
    sessionToken: v.string(),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const { admin } = await verifyAdminSession(ctx, args.sessionToken);

    const flows = await ctx.db
      .query("onboardingFlows")
      .withIndex("by_workspaceId", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const now = Date.now();
    for (const f of flows) {
      await ctx.db.patch(f._id, {
        status: "IN_PROGRESS",
        currentStep: "WELCOME",
        completedSteps: [],
        lastUpdatedAt: now,
      });
    }

    await logAudit(ctx, admin._id, "ORGANIZATION_ONBOARDING_RESET", args.workspaceId, {
      resetFlowCount: flows.length,
    });

    return { success: true, count: flows.length };
  },
});

/**
 * deleteOrganization
 * Permanently deletes an organization and cleans up its memberships and products
 */
export const deleteOrganization = mutation({
  args: {
    sessionToken: v.string(),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const { admin } = await verifyAdminSession(ctx, args.sessionToken);

    const ws = await ctx.db.get(args.workspaceId);
    if (!ws) throw new Error("Organization not found.");

    const name = ws.name;

    // 1. Delete memberships
    const memberships = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    for (const m of memberships) {
      await ctx.db.delete(m._id);
    }

    // 2. Delete products
    const products = await ctx.db
      .query("workspaceProducts")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    for (const p of products) {
      await ctx.db.delete(p._id);
    }

    // 3. Delete workspace
    await ctx.db.delete(args.workspaceId);

    await logAudit(ctx, admin._id, "ORGANIZATION_DELETED", args.workspaceId, {
      workspaceName: name,
    });

    return { success: true };
  },
});
