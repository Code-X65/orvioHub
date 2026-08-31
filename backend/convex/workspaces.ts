import { mutation, query } from "./_generated/server.js";
import { v } from "convex/values";

export const createWorkspace = mutation({
  args: {
    organizationId: v.optional(v.id("organizations")),
    name: v.string(),
    slug: v.string(),
    type: v.optional(v.string()),
    typeConfig: v.optional(v.any()),
    ownerId: v.optional(v.id("users")),
    country: v.optional(v.string()),
    state: v.optional(v.string()),
    city: v.optional(v.string()),
    timezone: v.optional(v.string()),
    currency: v.optional(v.string()),
    phone: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    initialProduct: v.optional(v.string()),
    isDefault: v.optional(v.boolean()),
    enabledModules: v.optional(v.array(v.string())),
    settings: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const slug = args.slug.toLowerCase().trim();

    // Check duplicate slug
    const existing = await ctx.db
      .query("workspaces")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();

    if (existing) {
      throw new Error("WORKSPACE_SLUG_ALREADY_EXISTS");
    }

    // Enforce Plan Quota: check active owned workspaces count
    if (args.ownerId) {
      const ownedWorkspaces = await ctx.db
        .query("workspaces")
        .withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId))
        .collect();

      const activeOwnedCount = ownedWorkspaces.filter(
        (w: any) => !w.deletedAt && (w.status || "").toLowerCase() !== "deleted"
      ).length;

      const maxAllowed = 3; // Standard plan default limit
      if (activeOwnedCount >= maxAllowed) {
        throw new Error("PLAN_LIMIT_REACHED");
      }
    }

    const initialProduct = (args.initialProduct || "inventory").toLowerCase();

    const workspaceId = await ctx.db.insert("workspaces", {
      organizationId: args.organizationId,
      name: args.name,
      slug,
      type: args.type || "business",
      ownerId: args.ownerId,
      country: args.country || "NG",
      state: args.state,
      city: args.city,
      timezone: args.timezone || "Africa/Lagos",
      currency: args.currency || "NGN",
      logoUrl: args.logoUrl,
      status: "active",
      isDefault: args.isDefault ?? false,
      enabledModules: args.enabledModules || [initialProduct],
      settings: {
        ...(args.settings || {}),
        phone: args.phone,
        typeConfig: args.typeConfig || {},
      },
      createdAt: now,
      updatedAt: now,
    });

    if (args.ownerId) {
      // 1. Owner Workspace Membership
      await ctx.db.insert("workspaceMemberships", {
        workspaceId,
        userId: args.ownerId,
        status: "active",
        defaultRole: "owner",
        role: "owner",
        acceptedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      // 2. Initial Product Entitlement & Product Membership
      await ctx.db.insert("workspaceProducts", {
        workspaceId,
        productKey: initialProduct,
        status: "active",
        planId: "free",
        trialStartedAt: now,
        trialEndsAt: now + 30 * 86_400_000,
        activatedBy: args.ownerId,
        activatedAt: now,
      });

      await ctx.db.insert("productMemberships", {
        workspaceId,
        userId: args.ownerId,
        productKey: initialProduct,
        role: "owner",
        permissions: ["*"],
        status: "active",
        createdAt: now,
        updatedAt: now,
      });

      // 3. Initial Onboarding Flow Record
      await ctx.db.insert("onboardingFlows", {
        userId: args.ownerId,
        workspaceId,
        productKey: initialProduct,
        flowVersion: "1.0",
        status: "IN_PROGRESS",
        currentStep: "store_profile",
        completedSteps: [],
        skippedSteps: [],
        stepData: {
          workspaceName: args.name,
          workspaceType: args.type || "business",
          currency: args.currency || "NGN",
          typeConfig: args.typeConfig || {},
        },
        startedAt: now,
        lastUpdatedAt: now,
      });

      // 4. Initial Primary Branch Provisioning
      const branchName = args.settings?.branchName?.trim() || "Main Store";
      const branchCode = args.settings?.branchCode?.trim().toUpperCase() || "MAIN";
      const primaryBranchId = await ctx.db.insert("branches", {
        workspaceId,
        name: branchName,
        code: branchCode,
        isPrimary: true,
        address: args.settings?.branchAddress,
        phone: args.phone,
        status: "active",
        createdAt: now,
        updatedAt: now,
      });

      // 5. Initial Subscription (Free tier)
      await ctx.db.insert("subscriptions", {
        workspaceId,
        planKey: "free",
        status: "active",
        currentPeriodStart: now,
        currentPeriodEnd: now + 365 * 86_400_000,
        cancelAtPeriodEnd: false,
        createdAt: now,
        updatedAt: now,
      });

      // 6. Welcome In-App Notification
      await ctx.db.insert("notifications", {
        userId: args.ownerId,
        workspaceId,
        productKey: initialProduct,
        type: "workspace.created",
        title: `Welcome to ${args.name}!`,
        body: `Your workspace has been initialized with the ${initialProduct} product and ${branchName} ready to use.`,
        severity: "SUCCESS",
        channel: "IN_APP",
        status: "UNREAD",
        createdAt: now,
      });

      // 7. High-Severity / Informational Audit Event
      await ctx.db.insert("workspaceAuditLogs", {
        workspaceId,
        actorUserId: args.ownerId,
        eventType: "workspace.created",
        entityType: "workspace",
        entityId: workspaceId,
        severity: "info",
        metadata: {
          name: args.name,
          slug,
          type: args.type || "business",
          initialProduct,
          primaryBranchId,
        },
        createdAt: now,
      });
    }

    return workspaceId;
  },
});

export const getWorkspaceContext = query({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const ws = await ctx.db.get(args.workspaceId);
    if (!ws || ws.deletedAt || (ws.status || "").toLowerCase() === "deleted") return null;

    const membership = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", args.userId)
      )
      .first();

    const products = await ctx.db
      .query("workspaceProducts")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const productMemberships = await ctx.db
      .query("productMemberships")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", args.userId)
      )
      .collect();

    const permissions = new Set<string>();
    const role = (membership?.role || membership?.defaultRole || "member").toLowerCase();

    if (role === "owner" || role === "admin") {
      permissions.add("*");
      permissions.add("workspace.view");
      permissions.add("workspace.update");
      permissions.add("workspace.manage_members");
      permissions.add("workspace.manage_roles");
      permissions.add("workspace.manage_products");
      permissions.add("workspace.manage_billing");
    } else {
      permissions.add("workspace.view");
    }

    for (const pm of productMemberships || []) {
      const pmStatus = (pm?.status || "active").toLowerCase();
      if (pmStatus === "active") {
        for (const p of pm.permissions || []) {
          permissions.add(p);
        }
      }
    }

    return {
      workspace: {
        id: ws._id,
        name: ws.name || "Workspace",
        slug: ws.slug || "",
        type: ws.type || "business",
        currency: ws.currency || "NGN",
        country: ws.country,
        state: ws.state,
        city: ws.city,
        timezone: ws.timezone,
        logoUrl: ws.logoUrl,
        status: ws.status || "active",
        createdAt: ws.createdAt,
      },
      membership: membership
        ? {
            id: membership._id,
            role: membership.role || membership.defaultRole || "member",
            status: membership.status || "active",
          }
        : null,
      products: (products || []).map((p) => ({
        key: p.productKey || "",
        status: p.status || "active",
        planId: p.planId,
      })),
      permissions: Array.from(permissions),
    };
  },
});

export const selectWorkspace = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    productKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ws = await ctx.db.get(args.workspaceId);
    if (!ws) throw new Error("WORKSPACE_NOT_FOUND");

    const status = (ws.status || "active").toLowerCase();
    if (status === "archived" || status === "deleted" || status === "suspended") {
      throw new Error(`WORKSPACE_${status.toUpperCase()}`);
    }

    const membership = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", args.userId)
      )
      .first();

    const memStatus = (membership?.status || "").toLowerCase();
    if (!membership || memStatus !== "active") {
      throw new Error("WORKSPACE_ACCESS_DENIED");
    }

    // Verify product access if specified
    if (args.productKey) {
      const product = await ctx.db
        .query("workspaceProducts")
        .withIndex("by_workspace_product", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("productKey", args.productKey!)
        )
        .first();

      const prodStatus = (product?.status || "").toLowerCase();
      if (!product || (prodStatus !== "active" && prodStatus !== "trial")) {
        throw new Error("PRODUCT_NOT_ENTITLED");
      }
    }

    // Update user's last selected workspace and product context
    await ctx.db.patch(args.userId, {
      lastSelectedWorkspaceId: args.workspaceId,
      ...(args.productKey ? { lastSelectedProduct: args.productKey } : {}),
      updatedAt: Date.now(),
    });

    // Log workspace_selected audit event
    await ctx.db.insert("workspaceAuditLogs", {
      workspaceId: args.workspaceId,
      actorUserId: args.userId,
      eventType: "workspace.workspace_selected",
      entityType: "workspace",
      entityId: args.workspaceId,
      severity: "info",
      metadata: { productKey: args.productKey },
      createdAt: Date.now(),
    });

    // Resolve complete context
    const products = await ctx.db
      .query("workspaceProducts")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const productMemberships = await ctx.db
      .query("productMemberships")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", args.userId)
      )
      .collect();

    const permissions = new Set<string>();
    const role = (membership.role || membership.defaultRole || "member").toLowerCase();

    if (role === "owner" || role === "admin") {
      permissions.add("*");
      permissions.add("workspace.view");
      permissions.add("workspace.update");
      permissions.add("workspace.manage_members");
      permissions.add("workspace.manage_roles");
      permissions.add("workspace.manage_products");
      permissions.add("workspace.manage_billing");
    } else {
      permissions.add("workspace.view");
    }

    for (const pm of productMemberships || []) {
      const pmStatus = (pm?.status || "active").toLowerCase();
      if (pmStatus === "active") {
        for (const p of pm.permissions || []) {
          permissions.add(p);
        }
      }
    }

    return {
      workspace: {
        id: ws._id,
        name: ws.name || "Workspace",
        slug: ws.slug || "",
        type: ws.type || "business",
        currency: ws.currency || "NGN",
        country: ws.country,
        state: ws.state,
        city: ws.city,
        timezone: ws.timezone,
        logoUrl: ws.logoUrl,
        status: ws.status || "active",
        createdAt: ws.createdAt,
      },
      membership: {
        id: membership._id,
        role: membership.role || membership.defaultRole || "member",
        status: membership.status || "active",
      },
      products: (products || []).map((p) => ({
        key: p.productKey || "",
        status: p.status || "active",
        planId: p.planId,
      })),
      permissions: Array.from(permissions),
    };
  },
});

export const getUserWorkspaces = query({
  args: {
    userId: v.id("users"),
    productKey: v.optional(v.string()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let memberships: any[] = [];
    try {
      memberships = await ctx.db
        .query("workspaceMemberships")
        .withIndex("by_user_status", (q) => q.eq("userId", args.userId).eq("status", "active"))
        .collect();
    } catch {
      memberships = [];
    }

    if (!memberships || memberships.length === 0) {
      memberships = await ctx.db
        .query("workspaceMemberships")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect();
    }

    const results = [];
    const searchFilter = args.search ? args.search.toLowerCase().trim() : null;
    const targetProduct = args.productKey ? args.productKey.toLowerCase().trim() : null;

    for (const m of memberships || []) {
      const memStatus = (m?.status || "active").toLowerCase();
      if (memStatus === "removed" || memStatus === "deleted") continue;

      const ws: any = await ctx.db.get(m.workspaceId as any);
      if (!ws) continue;

      const wsStatus = (ws.status || "active").toLowerCase();
      if (ws.deletedAt || wsStatus === "archived" || wsStatus === "deleted") continue;

      const wsName = ws.name || "";
      const wsSlug = ws.slug || "";

      if (searchFilter && !wsName.toLowerCase().includes(searchFilter) && !wsSlug.toLowerCase().includes(searchFilter)) {
        continue;
      }

      let products: any[] = [];
      try {
        products = await ctx.db
          .query("workspaceProducts")
          .withIndex("by_workspace", (q) => q.eq("workspaceId", ws._id))
          .collect();
      } catch {
        products = [];
      }

      // Product-aware filtering if specified
      if (targetProduct) {
        const hasProduct = (products || []).some((p) => {
          const pKey = (p?.productKey || "").toLowerCase();
          const pStatus = (p?.status || "active").toLowerCase();
          return pKey === targetProduct && (pStatus === "active" || pStatus === "trial");
        });
        if (!hasProduct) continue;
      }

      results.push({
        workspace: {
          id: ws._id,
          name: ws.name || "Workspace",
          slug: ws.slug || "",
          type: ws.type || "business",
          currency: ws.currency || "NGN",
          country: ws.country,
          timezone: ws.timezone,
          logoUrl: ws.logoUrl,
          status: ws.status || "active",
          createdAt: ws.createdAt,
        },
        role: m.role || m.defaultRole || "member",
        membershipId: m._id,
        enabledProducts: (products || []).map((p) => ({
          productKey: p.productKey || "",
          status: p.status || "active",
          planId: p.planId,
        })),
      });
    }
    return results;
  },
});

export const getWorkspaceById = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.workspaceId);
  },
});

export const getWorkspaceBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("workspaces")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug.toLowerCase()))
      .first();
  },
});

export const getOrganizationWorkspaces = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("workspaces")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .collect();
  },
});

export const getDefaultWorkspace = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const workspaces = await ctx.db
      .query("workspaces")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .collect();
    return workspaces.find((w) => w.isDefault) || workspaces[0] || null;
  },
});

export const updateWorkspace = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.optional(v.string()),
    type: v.optional(v.string()),
    country: v.optional(v.string()),
    state: v.optional(v.string()),
    city: v.optional(v.string()),
    timezone: v.optional(v.string()),
    currency: v.optional(v.string()),
    phone: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    status: v.optional(v.string()),
    enabledModules: v.optional(v.array(v.string())),
    settings: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) throw new Error("WORKSPACE_NOT_FOUND");

    const patch: any = { updatedAt: Date.now() };
    if (args.name !== undefined) patch.name = args.name;
    if (args.type !== undefined) patch.type = args.type;
    if (args.country !== undefined) patch.country = args.country;
    if (args.state !== undefined) patch.state = args.state;
    if (args.city !== undefined) patch.city = args.city;
    if (args.timezone !== undefined) patch.timezone = args.timezone;
    if (args.currency !== undefined) patch.currency = args.currency;
    if (args.logoUrl !== undefined) patch.logoUrl = args.logoUrl;
    if (args.status !== undefined) patch.status = args.status;
    if (args.enabledModules !== undefined) patch.enabledModules = args.enabledModules;
    if (args.settings !== undefined || args.phone !== undefined) {
      patch.settings = {
        ...workspace.settings,
        ...(args.settings || {}),
        ...(args.phone !== undefined ? { phone: args.phone } : {}),
      };
    }

    await ctx.db.patch(args.workspaceId, patch);
    return { success: true };
  },
});

export const activateWorkspaceProduct = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    productKey: v.string(),
    planId: v.optional(v.string()),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("workspaceProducts")
      .withIndex("by_workspace_product", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("productKey", args.productKey)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "active",
        planId: args.planId || existing.planId,
      });
      return { success: true, entitlementId: existing._id };
    }

    const entitlementId = await ctx.db.insert("workspaceProducts", {
      workspaceId: args.workspaceId,
      productKey: args.productKey,
      status: "active",
      planId: args.planId || "standard",
      trialStartedAt: now,
      trialEndsAt: now + 30 * 86_400_000,
      activatedBy: args.userId,
      activatedAt: now,
    });

    // Auto-assign product membership for user as owner with wildcard
    const existingPm = await ctx.db
      .query("productMemberships")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", args.userId)
      )
      .filter((q) => q.eq(q.field("productKey"), args.productKey))
      .first();

    if (!existingPm) {
      await ctx.db.insert("productMemberships", {
        workspaceId: args.workspaceId,
        userId: args.userId,
        productKey: args.productKey,
        role: "owner",
        permissions: ["*"],
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
    }

    // Audit log
    await ctx.db.insert("workspaceAuditLogs", {
      workspaceId: args.workspaceId,
      actorUserId: args.userId,
      eventType: "workspace.product_activated",
      entityType: "product",
      entityId: args.productKey,
      severity: "info",
      metadata: { productKey: args.productKey, planId: args.planId || "standard" },
      createdAt: now,
    });

    return { success: true, entitlementId };
  },
});

export const getWorkspaceProducts = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("workspaceProducts")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
  },
});

export const getWorkspaceMembership = query({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", args.userId)
      )
      .first();
  },
});

export const getProductMembership = query({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    productKey: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("productMemberships")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", args.userId)
      )
      .filter((q) => q.eq(q.field("productKey"), args.productKey))
      .first();
  },
});

export const getWorkspaceAuditLogs = query({
  args: {
    workspaceId: v.id("workspaces"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    return await ctx.db
      .query("workspaceAuditLogs")
      .withIndex("by_workspace_created", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(limit);
  },
});

export const logWorkspaceAudit = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    actorUserId: v.optional(v.id("users")),
    eventType: v.string(),
    entityType: v.string(),
    entityId: v.optional(v.string()),
    severity: v.string(),
    metadata: v.optional(v.any()),
    requestId: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("workspaceAuditLogs", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const getProductAccess = query({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    productKey: v.string(),
  },
  handler: async (ctx, args) => {
    const ws = await ctx.db.get(args.workspaceId);
    if (!ws) throw new Error("WORKSPACE_NOT_FOUND");

    const membership = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", args.userId)
      )
      .first();

    if (!membership || membership.status.toLowerCase() !== "active") {
      return {
        isEntitled: false,
        hasMembership: false,
        status: "NO_ACCESS",
        permissions: [],
        accessibleBranches: [],
      };
    }

    const product = await ctx.db
      .query("workspaceProducts")
      .withIndex("by_workspace_product", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("productKey", args.productKey)
      )
      .first();

    const isEntitled = !!product && (product.status.toLowerCase() === "active" || product.status.toLowerCase() === "trial");

    const productMembership = await ctx.db
      .query("productMemberships")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", args.userId)
      )
      .filter((q) => q.eq(q.field("productKey"), args.productKey))
      .first();

    const role = (membership.role || membership.defaultRole || "member").toLowerCase();
    const permissions = new Set<string>();

    if (role === "owner" || role === "admin") {
      permissions.add("*");
      permissions.add(`${args.productKey}.*`);
    }

    if (productMembership && productMembership.status.toLowerCase() === "active") {
      for (const p of productMembership.permissions || []) {
        permissions.add(p);
      }
    }

    const allBranches = await ctx.db
      .query("branches")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const activeBranches = allBranches.filter(
      (b) => b.status !== "deleted" && b.status !== "archived"
    );

    let accessibleBranches = activeBranches;
    if (role !== "owner" && role !== "admin") {
      if (productMembership?.branchIds && productMembership.branchIds.length > 0) {
        const allowedIds = new Set(productMembership.branchIds);
        accessibleBranches = activeBranches.filter((b) => allowedIds.has(b._id));
      } else {
        accessibleBranches = [];
      }
    }

    accessibleBranches.sort((a, b) => {
      if (a.isPrimary && !b.isPrimary) return -1;
      if (!a.isPrimary && b.isPrimary) return 1;
      return a.name.localeCompare(b.name);
    });

    const defaultBranch = accessibleBranches.find((b) => b.isPrimary) || accessibleBranches[0] || null;

    return {
      isEntitled,
      hasMembership: true,
      productStatus: product?.status || "NOT_ACTIVATED",
      role: productMembership?.role || membership.role,
      permissions: Array.from(permissions),
      accessibleBranches,
      defaultBranch,
    };
  },
});

export const getProductMembers = query({
  args: {
    workspaceId: v.id("workspaces"),
    productKey: v.string(),
  },
  handler: async (ctx, args) => {
    const productMemberships = await ctx.db
      .query("productMemberships")
      .withIndex("by_workspace_product", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("productKey", args.productKey)
      )
      .collect();

    const members = [];
    for (const pm of productMemberships) {
      if (pm.status.toLowerCase() === "removed") continue;
      const user = await ctx.db.get(pm.userId);
      members.push({
        id: pm._id,
        userId: pm.userId,
        name: user?.name || "Unknown",
        email: user?.email || "",
        avatar: user?.avatar || user?.avatarUrl,
        productKey: pm.productKey,
        role: pm.role,
        permissions: pm.permissions,
        branchIds: pm.branchIds,
        status: pm.status,
      });
    }
    return members;
  },
});

export const deleteWorkspace = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ws = await ctx.db.get(args.workspaceId);
    if (!ws) throw new Error("WORKSPACE_NOT_FOUND");

    const membership = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", args.userId)
      )
      .first();

    if (!membership || (membership.role !== "owner" && membership.role !== "OWNER")) {
      throw new Error("WORKSPACE_ACCESS_DENIED");
    }

    const now = Date.now();
    await ctx.db.patch(args.workspaceId, {
      status: "DELETED",
      deletedAt: now,
      updatedAt: now,
    });

    const branches = await ctx.db
      .query("branches")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    for (const b of branches) {
      await ctx.db.patch(b._id, {
        status: "DELETED",
        deletedAt: now,
        updatedAt: now,
      });
    }

    await ctx.db.insert("workspaceAuditLogs", {
      workspaceId: args.workspaceId,
      actorUserId: args.userId,
      eventType: "workspace.deleted",
      entityType: "workspace",
      entityId: args.workspaceId,
      severity: "warning",
      metadata: { reason: args.reason },
      createdAt: now,
    });

    return { success: true };
  },
});


