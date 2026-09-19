import { mutation, query } from "./_generated/server.js";
import { v } from "convex/values";
import { checkHasFinancialRecords } from "./organizations.js";
import { resolveOrganization } from "./applications.js";

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
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    let ws: any = null;
    const wsId = ctx.db.normalizeId("workspaces", args.workspaceId);
    if (wsId) {
      ws = await ctx.db.get(wsId);
    }
    if (!ws) {
      const orgId = ctx.db.normalizeId("organizations", args.workspaceId);
      if (orgId) {
        ws = await ctx.db
          .query("workspaces")
          .withIndex("by_organizationId", (q) => q.eq("organizationId", orgId))
          .first();
      }
    }

    if (!ws || ws.deletedAt || (ws.status || "").toLowerCase() === "deleted") return null;
    const targetWsId = ws._id;

    let membership = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", targetWsId).eq("userId", args.userId)
      )
      .first();

    // Fallback: check workspace owner or organization membership
    let orgMembership: any = null;
    let orgOwner = false;
    if (ws.organizationId) {
      orgMembership = await ctx.db
        .query("organizationMemberships")
        .withIndex("by_org_and_user", (q: any) =>
          q.eq("organizationId", ws.organizationId).eq("userId", args.userId)
        )
        .first();

      const org: any = await ctx.db.get(ws.organizationId);
      if (org && org.ownerId === args.userId) {
        orgOwner = true;
      }
    }

    const isOwner = ws.ownerId === args.userId || orgMembership?.role === "OWNER" || orgOwner;
    const isAdmin = isOwner || orgMembership?.role === "ADMIN";

    if (!membership && !isOwner && !isAdmin) {
      return null;
    }

    let products = await ctx.db
      .query("workspaceProducts")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", targetWsId))
      .collect();

    if (!products || products.length === 0) {
      const mods = ws.enabledModules || ["inventory"];
      products = mods.map((mod: string) => ({
        productKey: mod,
        status: "active",
        planId: "free",
      })) as any;
    }

    const productMemberships = await ctx.db
      .query("productMemberships")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", targetWsId).eq("userId", args.userId)
      )
      .collect();

    const permissions = new Set<string>();
    const role = (
      membership?.role ||
      membership?.defaultRole ||
      (isOwner ? "owner" : isAdmin ? "admin" : "member")
    ).toLowerCase();

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

    // Resolve name: fallback to organization name if workspace name is placeholder
    let wsName = ws.name || "Workspace";
    if ((wsName === "Main Workspace" || !wsName) && ws.organizationId) {
      const org: any = await ctx.db.get(ws.organizationId);
      if (org?.name) wsName = org.name;
    }

    // Resolve subscription
    let sub: any = null;
    if (ws.organizationId) {
      sub = await ctx.db
        .query("subscriptions")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", ws.organizationId))
        .first();
    }
    if (!sub) {
      sub = await ctx.db
        .query("subscriptions")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", targetWsId))
        .first();
    }

    const authoritativePlanKey = (
      (sub?.status === "active" ? (sub?.activePlan || sub?.selectedPlan || sub?.planKey) : null) ||
      sub?.activePlan ||
      sub?.planKey ||
      ws.planId ||
      "free_trial"
    );
    const rawPlanKey = authoritativePlanKey === "free" ? "free_trial" : authoritativePlanKey;
    const planKey = rawPlanKey.toLowerCase();
    const planName = planKey === "standard" ? "Standard Plan" : planKey === "premium" ? "Premium Plan" : "Free Trial Plan";
    const subscriptionStatus = sub?.status || "trialing";

    return {
      workspace: {
        id: ws._id,
        workspaceId: ws._id,
        organizationId: ws.organizationId || null,
        name: wsName,
        slug: ws.slug || "",
        type: ws.type || "business",
        planId: planKey,
        planKey,
        planName,
        subscriptionStatus,
        subscription: sub,
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
        id: membership?._id || ws._id,
        role: role,
        status: membership?.status || "active",
      },
      products: (products || []).map((p: any) => ({
        key: p.productKey || p.key || "",
        status: p.status || "active",
        planId: p.planId,
      })),
      permissions: Array.from(permissions),
    };
  },
});

export const selectWorkspace = mutation({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
    userId: v.id("users"),
    productKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let ws: any = null;
    const wsId = ctx.db.normalizeId("workspaces", args.workspaceId);
    if (wsId) {
      ws = await ctx.db.get(wsId);
    }
    if (!ws) {
      const orgId = ctx.db.normalizeId("organizations", args.workspaceId);
      if (orgId) {
        ws = await ctx.db
          .query("workspaces")
          .withIndex("by_organizationId", (q) => q.eq("organizationId", orgId))
          .first();
      }
    }

    if (!ws) throw new Error("WORKSPACE_NOT_FOUND");
    const targetWsId = ws._id;

    const status = (ws.status || "active").toLowerCase();
    if (status === "archived" || status === "deleted" || status === "suspended") {
      throw new Error(`WORKSPACE_${status.toUpperCase()}`);
    }

    let membership = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", targetWsId).eq("userId", args.userId)
      )
      .first();

    // Fallback: check workspace owner or organization membership
    let orgOwner = false;
    let orgMembership: any = null;
    if (ws.organizationId) {
      orgMembership = await ctx.db
        .query("organizationMemberships")
        .withIndex("by_org_and_user", (q: any) =>
          q.eq("organizationId", ws.organizationId).eq("userId", args.userId)
        )
        .first();

      const org: any = await ctx.db.get(ws.organizationId);
      if (org && org.ownerId === args.userId) {
        orgOwner = true;
      }
    }

    if (!membership && (orgMembership || orgOwner)) {
      if ((orgMembership && orgMembership.status === "ACTIVE") || orgOwner) {
        const memRole = (orgMembership?.role === "OWNER" || orgOwner) ? "owner" : orgMembership?.role === "ADMIN" ? "admin" : "member";
        const memId = await ctx.db.insert("workspaceMemberships", {
          workspaceId: targetWsId,
          userId: args.userId,
          status: "active",
          defaultRole: memRole,
          role: memRole,
          acceptedAt: Date.now(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        membership = await ctx.db.get(memId);
      }
    }

    if (!membership && ws.ownerId === args.userId) {
      const memId = await ctx.db.insert("workspaceMemberships", {
        workspaceId: targetWsId,
        userId: args.userId,
        status: "active",
        defaultRole: "owner",
        role: "owner",
        acceptedAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      membership = await ctx.db.get(memId);
    }

    const memStatus = (membership?.status || "").toLowerCase();
    if (!membership || memStatus !== "active") {
      throw new Error("WORKSPACE_ACCESS_DENIED");
    }

    // Verify product access if specified
    if (args.productKey) {
      let product = await ctx.db
        .query("workspaceProducts")
        .withIndex("by_workspace_product", (q) =>
          q.eq("workspaceId", targetWsId).eq("productKey", args.productKey!)
        )
        .first();

      if (!product) {
        // Auto-provision product entitlement for inventory
        if (args.productKey === "inventory") {
          const prodId = await ctx.db.insert("workspaceProducts", {
            workspaceId: targetWsId,
            productKey: "inventory",
            status: "active",
            planId: "free",
            trialStartedAt: Date.now(),
            activatedBy: args.userId as any,
            activatedAt: Date.now(),
          });
          product = await ctx.db.get(prodId);
        }
      }

      const prodStatus = (product?.status || "").toLowerCase();
      if (!product || (prodStatus !== "active" && prodStatus !== "trial")) {
        throw new Error("PRODUCT_NOT_ENTITLED");
      }
    }

    // Update user's last selected workspace and product context
    await ctx.db.patch(args.userId, {
      lastSelectedWorkspaceId: `${targetWsId}`,
      ...(args.productKey ? { lastSelectedProduct: args.productKey } : {}),
      updatedAt: Date.now(),
    });

    // Log workspace_selected audit event
    await ctx.db.insert("workspaceAuditLogs", {
      workspaceId: targetWsId,
      actorUserId: args.userId,
      eventType: "workspace.workspace_selected",
      entityType: "workspace",
      entityId: targetWsId,
      severity: "info",
      metadata: { productKey: args.productKey },
      createdAt: Date.now(),
    });

    // Resolve complete context
    let products = await ctx.db
      .query("workspaceProducts")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", targetWsId))
      .collect();

    if (!products || products.length === 0) {
      const mods = ws.enabledModules || ["inventory"];
      products = mods.map((mod: string) => ({
        productKey: mod,
        status: "active",
        planId: "free",
      })) as any;
    }

    const productMemberships = await ctx.db
      .query("productMemberships")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", targetWsId).eq("userId", args.userId)
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

    let wsName = ws.name || "Workspace";
    if ((wsName === "Main Workspace" || !wsName) && ws.organizationId) {
      const org: any = await ctx.db.get(ws.organizationId);
      if (org?.name) wsName = org.name;
    }

    return {
      workspace: {
        id: ws._id,
        name: wsName,
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
      products: (products || []).map((p: any) => ({
        key: p.productKey || p.key || "",
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
    // 1. Direct workspace memberships
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
      try {
        memberships = await ctx.db
          .query("workspaceMemberships")
          .withIndex("by_user", (q) => q.eq("userId", args.userId))
          .collect();
      } catch {
        memberships = [];
      }
    }

    // 2. Owned workspaces
    let ownedWorkspaces: any[] = [];
    try {
      ownedWorkspaces = await ctx.db
        .query("workspaces")
        .withIndex("by_owner", (q) => q.eq("ownerId", args.userId))
        .collect();
    } catch {
      ownedWorkspaces = [];
    }

    // 3. Organization memberships
    let orgMemberships: any[] = [];
    try {
      orgMemberships = await ctx.db
        .query("organizationMemberships")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .collect();
    } catch {
      orgMemberships = [];
    }

    const wsMap = new Map<string, { ws: any; membership: any; orgMembership: any }>();

    // Add direct memberships
    for (const m of memberships || []) {
      const memStatus = (m?.status || "active").toLowerCase();
      if (memStatus === "removed" || memStatus === "deleted") continue;
      const ws: any = await ctx.db.get(m.workspaceId as any);
      if (ws) {
        wsMap.set(String(ws._id), { ws, membership: m, orgMembership: null });
      }
    }

    // Add owned workspaces
    for (const ws of ownedWorkspaces || []) {
      const wsId = String(ws._id);
      if (!wsMap.has(wsId)) {
        wsMap.set(wsId, { ws, membership: null, orgMembership: null });
      }
    }

    // Add workspaces through organizations
    for (const om of orgMemberships || []) {
      if ((om.status || "").toLowerCase() === "inactive") continue;
      const orgWorkspaces = await ctx.db
        .query("workspaces")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", om.organizationId))
        .collect();

      for (const ws of orgWorkspaces) {
        const wsId = String(ws._id);
        if (!wsMap.has(wsId)) {
          wsMap.set(wsId, { ws, membership: null, orgMembership: om });
        } else {
          const entry = wsMap.get(wsId)!;
          if (!entry.orgMembership) entry.orgMembership = om;
        }
      }
    }

    const results = [];
    const searchFilter = args.search ? args.search.toLowerCase().trim() : null;
    const targetProduct = args.productKey ? args.productKey.toLowerCase().trim() : null;

    for (const entry of Array.from(wsMap.values())) {
      const { ws, membership, orgMembership } = entry;
      const wsStatus = (ws.status || "active").toLowerCase();
      if (ws.deletedAt || wsStatus === "archived" || wsStatus === "deleted") continue;

      let wsName = ws.name || "";
      let wsSlug = ws.slug || "";

      // If workspace has placeholder name, look up organization name
      if ((wsName === "Main Workspace" || !wsName) && ws.organizationId) {
        const org = (await ctx.db.get(ws.organizationId as any)) as any;
        if (org && typeof org.name === "string") wsName = org.name;
      }

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

      // If no products registered, fallback to enabledModules or empty array
      if (!products || products.length === 0) {
        const mods = ws.enabledModules || [];
        products = mods.map((mod: string) => ({
          productKey: mod,
          status: "active",
          planId: "free",
        }));
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

      let role = "member";
      if (membership?.role || membership?.defaultRole) {
        role = membership.role || membership.defaultRole;
      } else if (ws.ownerId === args.userId || orgMembership?.role === "OWNER") {
        role = "owner";
      } else if (orgMembership?.role === "ADMIN") {
        role = "admin";
      }

      // Resolve subscription
      let sub: any = null;
      if (ws.organizationId) {
        sub = await ctx.db
          .query("subscriptions")
          .withIndex("by_organizationId", (q) => q.eq("organizationId", ws.organizationId))
          .first();
      }
      if (!sub) {
        sub = await ctx.db
          .query("subscriptions")
          .withIndex("by_workspace", (q) => q.eq("workspaceId", ws._id))
          .first();
      }

      let org: any = null;
      if (ws.organizationId) {
        org = await ctx.db.get(ws.organizationId as any);
      }

      const authoritativePlanKey = (
        (sub?.status === "active" ? (sub?.activePlan || sub?.selectedPlan || sub?.planKey) : null) ||
        sub?.activePlan ||
        sub?.selectedPlan ||
        sub?.planKey ||
        org?.planKey ||
        org?.planId ||
        ws.planKey ||
        ws.planId ||
        "free_trial"
      );
      const rawPlanKey = authoritativePlanKey === "free" ? "free_trial" : authoritativePlanKey;
      const planKey = rawPlanKey.toLowerCase();
      const planName = planKey === "standard" ? "Standard Plan" : planKey === "premium" ? "Premium Plan" : "Free 30-Day Plan";
      const subscriptionStatus = sub?.status || "trialing";

      results.push({
        workspace: {
          id: ws._id,
          workspaceId: ws._id,
          organizationId: ws.organizationId || null,
          name: wsName || "Workspace",
          slug: wsSlug || "",
          type: ws.type || "business",
          planId: planKey,
          planKey,
          planName,
          subscriptionStatus,
          subscription: sub,
          currency: ws.currency || "NGN",
          country: ws.country,
          timezone: ws.timezone,
          logoUrl: ws.logoUrl,
          status: ws.status || "active",
          createdAt: ws.createdAt,
        },
        role,
        membershipId: membership?._id || ws._id,
        enabledProducts: (products || []).map((p) => ({
          productKey: p.productKey || "",
          status: p.status || "active",
          planId: p.planId || planKey,
        })),
      });
    }
    return results;
  },
});

export const getWorkspaceById = query({
  args: { workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()) },
  handler: async (ctx, args) => {
    if (!args.workspaceId || args.workspaceId === "undefined" || args.workspaceId === "null") {
      return null;
    }
    const wsId = ctx.db.normalizeId("workspaces", args.workspaceId);
    if (wsId) {
      const ws = await ctx.db.get(wsId);
      if (ws) return ws;
    }
    const orgId = ctx.db.normalizeId("organizations", args.workspaceId);
    if (orgId) {
      const ws = await ctx.db
        .query("workspaces")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", orgId))
        .first();
      if (ws) return ws;
    }
    return null;
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
  args: { organizationId: v.union(v.id("organizations"), v.id("workspaces"), v.string()) },
  handler: async (ctx, args) => {
    let orgId = ctx.db.normalizeId("organizations", args.organizationId);
    if (!orgId) {
      const wsId = ctx.db.normalizeId("workspaces", args.organizationId);
      if (wsId) {
        const ws = await ctx.db.get(wsId);
        if (ws?.organizationId) orgId = ws.organizationId;
      }
    }
    if (!orgId) return [];
    return await ctx.db
      .query("workspaces")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", orgId!)
      )
      .collect();
  },
});

export const getDefaultWorkspace = query({
  args: { organizationId: v.union(v.id("organizations"), v.id("workspaces"), v.string()) },
  handler: async (ctx, args) => {
    let orgId = ctx.db.normalizeId("organizations", args.organizationId);
    if (!orgId) {
      const wsId = ctx.db.normalizeId("workspaces", args.organizationId);
      if (wsId) {
        const ws = await ctx.db.get(wsId);
        if (ws?.organizationId) orgId = ws.organizationId;
      }
    }
    if (!orgId) return null;
    const workspaces = await ctx.db
      .query("workspaces")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", orgId!)
      )
      .collect();
    return workspaces.find((w) => w.isDefault) || workspaces[0] || null;
  },
});

export const updateWorkspace = mutation({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
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
    let wsId = ctx.db.normalizeId("workspaces", args.workspaceId);
    if (!wsId) {
      const resolved = await resolveOrganization(ctx, args.workspaceId);
      if (resolved.workspaceId) wsId = resolved.workspaceId;
    }
    if (!wsId) throw new Error("WORKSPACE_NOT_FOUND");
    const workspace = await ctx.db.get(wsId);
    if (!workspace) throw new Error("WORKSPACE_NOT_FOUND");

    if (args.currency && args.currency !== workspace.currency) {
      const hasFinance = await checkHasFinancialRecords(ctx, workspace.organizationId || wsId);
      if (hasFinance) {
        throw new Error(
          "CURRENCY_LOCKED: Workspace currency cannot be modified because financial or sales records already exist."
        );
      }
    }

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

    await ctx.db.patch(wsId, patch);
    return { success: true };
  },
});

export const activateWorkspaceProduct = mutation({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
    productKey: v.string(),
    planId: v.optional(v.string()),
    userId: v.union(v.id("users"), v.string()),
  },
  handler: async (ctx, args) => {
    let wsId = ctx.db.normalizeId("workspaces", args.workspaceId);
    if (!wsId) {
      const resolved = await resolveOrganization(ctx, args.workspaceId);
      if (resolved.workspaceId) wsId = resolved.workspaceId;
    }
    if (!wsId) throw new Error("WORKSPACE_NOT_FOUND");

    const uId = ctx.db.normalizeId("users", args.userId) || (args.userId as any);
    const now = Date.now();
    const existing = await ctx.db
      .query("workspaceProducts")
      .withIndex("by_workspace_product", (q) =>
        q.eq("workspaceId", wsId!).eq("productKey", args.productKey)
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
      workspaceId: wsId,
      productKey: args.productKey,
      status: "active",
      planId: args.planId || "standard",
      trialStartedAt: now,
      trialEndsAt: now + 30 * 86_400_000,
      activatedBy: uId,
      activatedAt: now,
    });

    // Auto-assign product membership for user as owner with wildcard
    const existingPm = await ctx.db
      .query("productMemberships")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", wsId!).eq("userId", uId)
      )
      .filter((q) => q.eq(q.field("productKey"), args.productKey))
      .first();

    if (!existingPm) {
      await ctx.db.insert("productMemberships", {
        workspaceId: wsId,
        userId: uId,
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
      workspaceId: wsId,
      actorUserId: uId,
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
  args: { workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()) },
  handler: async (ctx, args) => {
    let wsId = ctx.db.normalizeId("workspaces", args.workspaceId);
    if (!wsId) {
      try {
        const resolved = await resolveOrganization(ctx, args.workspaceId);
        if (resolved.workspaceId) wsId = resolved.workspaceId;
      } catch {}
    }
    if (!wsId) {
      return [];
    }
    return await ctx.db
      .query("workspaceProducts")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", wsId!))
      .collect();
  },
});

export const getWorkspaceMembership = query({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
    userId: v.union(v.id("users"), v.string()),
  },
  handler: async (ctx, args) => {
    let wsId = ctx.db.normalizeId("workspaces", args.workspaceId);
    let uId = ctx.db.normalizeId("users", args.userId);
    let orgId = ctx.db.normalizeId("organizations", args.workspaceId);
    let orgDoc: any = null;
    let wsDoc: any = null;

    try {
      const resolved = await resolveOrganization(ctx, args.workspaceId);
      if (resolved.workspaceId) wsId = resolved.workspaceId;
      if (resolved.orgId) orgId = resolved.orgId;
      if (resolved.org) orgDoc = resolved.org;
      if (resolved.workspace) wsDoc = resolved.workspace;
    } catch {}

    if (wsId && uId) {
      const mem = await ctx.db
        .query("workspaceMemberships")
        .withIndex("by_workspace_user", (q) =>
          q.eq("workspaceId", wsId!).eq("userId", uId!)
        )
        .first();
      if (mem) return mem;
    }

    // Check organization membership
    if (orgId && uId) {
      const orgMem = await ctx.db
        .query("organizationMemberships")
        .withIndex("by_org_and_user", (q: any) =>
          q.eq("organizationId", orgId!).eq("userId", uId!)
        )
        .first();
      if (orgMem) {
        return {
          _id: orgMem._id,
          workspaceId: wsId || args.workspaceId,
          userId: uId,
          role: orgMem.role || "member",
          status: orgMem.status || "active",
          invitedAt: orgMem.invitedAt,
          joinedAt: orgMem.joinedAt,
        };
      }
    }

    // Check direct owner
    if (!orgDoc && orgId) {
      try {
        orgDoc = await ctx.db.get(orgId);
      } catch {}
    }
    if (!wsDoc && wsId) {
      try {
        wsDoc = await ctx.db.get(wsId);
      } catch {}
    }

    if (
      (orgDoc && (String(orgDoc.ownerId) === String(args.userId) || (uId && String(orgDoc.ownerId) === String(uId)))) ||
      (wsDoc && (String(wsDoc.ownerId) === String(args.userId) || (uId && String(wsDoc.ownerId) === String(uId))))
    ) {
      return {
        _id: "synthetic_owner_membership",
        workspaceId: wsId || args.workspaceId,
        userId: uId || args.userId,
        role: "owner",
        status: "active",
        joinedAt: Date.now(),
      };
    }

    return null;
  },
});

export const getProductMembership = query({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
    userId: v.union(v.id("users"), v.string()),
    productKey: v.string(),
  },
  handler: async (ctx, args) => {
    let wsId = ctx.db.normalizeId("workspaces", args.workspaceId);
    let uId = ctx.db.normalizeId("users", args.userId);
    let orgId = ctx.db.normalizeId("organizations", args.workspaceId);
    let orgDoc: any = null;
    let wsDoc: any = null;

    try {
      const resolved = await resolveOrganization(ctx, args.workspaceId);
      if (resolved.workspaceId) wsId = resolved.workspaceId;
      if (resolved.orgId) orgId = resolved.orgId;
      if (resolved.org) orgDoc = resolved.org;
      if (resolved.workspace) wsDoc = resolved.workspace;
    } catch {}

    if (wsId && uId) {
      const pm = await ctx.db
        .query("productMemberships")
        .withIndex("by_workspace_user", (q) =>
          q.eq("workspaceId", wsId!).eq("userId", uId!)
        )
        .filter((q) => q.eq(q.field("productKey"), args.productKey))
        .first();
      if (pm) return pm;
    }

    // Check direct owner or org owner
    if (!orgDoc && orgId) {
      try {
        orgDoc = await ctx.db.get(orgId);
      } catch {}
    }
    if (!wsDoc && wsId) {
      try {
        wsDoc = await ctx.db.get(wsId);
      } catch {}
    }

    if (
      (orgDoc && (String(orgDoc.ownerId) === String(args.userId) || (uId && String(orgDoc.ownerId) === String(uId)))) ||
      (wsDoc && (String(wsDoc.ownerId) === String(args.userId) || (uId && String(wsDoc.ownerId) === String(uId))))
    ) {
      return {
        _id: "synthetic_owner_product_membership",
        workspaceId: wsId || args.workspaceId,
        userId: uId || args.userId,
        productKey: args.productKey,
        role: "owner",
        permissions: ["*"],
        status: "active",
      };
    }

    return null;
  },
});

export const getWorkspaceAuditLogs = query({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    let targetWsId: any = args.workspaceId;
    if (typeof args.workspaceId === "string") {
      const bySlug = await ctx.db
        .query("workspaces")
        .withIndex("by_slug", (q) => q.eq("slug", args.workspaceId as string))
        .first();
      if (bySlug) {
        targetWsId = bySlug._id;
      }
    }

    const logs = await ctx.db
      .query("workspaceAuditLogs")
      .withIndex("by_workspace_created", (q) => q.eq("workspaceId", targetWsId))
      .order("desc")
      .take(limit);

    if (logs.length === 0 && targetWsId !== args.workspaceId) {
      return await ctx.db
        .query("workspaceAuditLogs")
        .withIndex("by_workspace_created", (q) => q.eq("workspaceId", args.workspaceId as any))
        .order("desc")
        .take(limit);
    }
    return logs;
  },
});

export const logWorkspaceAudit = mutation({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.string()),
    actorUserId: v.optional(v.union(v.id("users"), v.string())),
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

export const activateProductEntitlement = mutation({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.string()),
    userId: v.union(v.id("users"), v.string()),
    productKey: v.string(),
    planId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const wsId = ctx.db.normalizeId("workspaces", args.workspaceId);
    if (!wsId) return { success: false, reason: "INVALID_WORKSPACE" };

    const ws = await ctx.db.get(wsId);
    if (!ws) return { success: false, reason: "WORKSPACE_NOT_FOUND" };

    const uId = ctx.db.normalizeId("users", args.userId);

    let existing = await ctx.db
      .query("workspaceProducts")
      .withIndex("by_workspace_product", (q) =>
        q.eq("workspaceId", wsId).eq("productKey", args.productKey)
      )
      .first();

    const now = Date.now();
    if (!existing) {
      await ctx.db.insert("workspaceProducts", {
        workspaceId: wsId,
        productKey: args.productKey,
        status: "active",
        planId: args.planId || "free",
        activatedBy: (uId || ws.ownerId) as any,
        activatedAt: now,
      });
    } else {
      await ctx.db.patch(existing._id, {
        status: "active",
        activatedAt: now,
      });
    }

    return { success: true };
  },
});

// ==========================================
// LIFECYCLE & OWNERSHIP MUTATIONS
// ==========================================

/** Allowed lifecycle transitions */
const WORKSPACE_TRANSITIONS: Record<string, string[]> = {
  creating: ["setup_incomplete", "trial", "active"],
  setup_incomplete: ["trial", "active", "deleting", "archived"],
  trial: ["active", "past_due", "suspended", "archived", "deleting"],
  active: ["past_due", "suspended", "archived", "deleting"],
  past_due: ["active", "suspended", "archived", "deleting"],
  suspended: ["active", "archived", "deleting"],
  archived: ["active", "deleting"],
  deleting: ["active", "deleted"],
  deleted: [],
};

function canTransitionWorkspace(fromStatus: string, toStatus: string): boolean {
  const from = (fromStatus || "active").toLowerCase();
  const to = (toStatus || "active").toLowerCase();
  if (from === to) return true;
  const allowed = WORKSPACE_TRANSITIONS[from] || [];
  return allowed.includes(to);
}

export const archiveWorkspace = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    callerUserId: v.id("users"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ws = await ctx.db.get(args.workspaceId);
    if (!ws || ws.deletedAt || ws.status === "deleted") {
      throw new Error("WORKSPACE_NOT_FOUND");
    }

    const callerMembership = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", args.callerUserId)
      )
      .first();

    const callerRole = (callerMembership?.role || callerMembership?.defaultRole || "").toLowerCase();
    if (!callerMembership || callerRole !== "owner") {
      throw new Error("ONLY_OWNER_CAN_ARCHIVE_WORKSPACE");
    }

    if (ws.status === "archived") {
      return { success: true, status: "archived" };
    }

    if (!canTransitionWorkspace(ws.status || "active", "archived")) {
      throw new Error(`CANNOT_TRANSITION_STATUS_FROM_${(ws.status || "").toUpperCase()}_TO_ARCHIVED`);
    }

    const now = Date.now();
    await ctx.db.patch(args.workspaceId, {
      status: "archived",
      archivedAt: now,
      archivedBy: args.callerUserId as string,
      updatedAt: now,
    });

    await ctx.db.insert("workspaceAuditLogs", {
      workspaceId: args.workspaceId,
      actorUserId: args.callerUserId,
      eventType: "workspace.archived",
      entityType: "workspace",
      entityId: args.workspaceId,
      severity: "warning",
      metadata: { reason: args.reason, previousStatus: ws.status },
      createdAt: now,
    });

    const members = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    for (const member of members) {
      if (member.status === "active") {
        await ctx.db.insert("notifications", {
          userId: member.userId,
          type: "workspace_archived",
          title: `Workspace "${ws.name}" has been archived`,
          body: `The workspace has been placed in read-only archive mode.`,
          data: { workspaceId: args.workspaceId, workspaceName: ws.name },
          severity: "WARNING",
          channel: "IN_APP",
          status: "UNREAD",
          createdAt: now,
        });
      }
    }

    return { success: true, status: "archived" };
  },
});

export const restoreWorkspace = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    callerUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const ws = await ctx.db.get(args.workspaceId);
    if (!ws || ws.deletedAt || ws.status === "deleted") {
      throw new Error("WORKSPACE_NOT_FOUND");
    }

    const callerMembership = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", args.callerUserId)
      )
      .first();

    const callerRole = (callerMembership?.role || callerMembership?.defaultRole || "").toLowerCase();
    if (!callerMembership || callerRole !== "owner") {
      throw new Error("ONLY_OWNER_CAN_RESTORE_WORKSPACE");
    }

    if (ws.status === "active") {
      return { success: true, status: "active" };
    }

    if (!canTransitionWorkspace(ws.status || "archived", "active")) {
      throw new Error(`CANNOT_TRANSITION_STATUS_FROM_${(ws.status || "").toUpperCase()}_TO_ACTIVE`);
    }

    const now = Date.now();
    await ctx.db.patch(args.workspaceId, {
      status: "active",
      restoredAt: now,
      restoredBy: args.callerUserId as string,
      updatedAt: now,
    });

    await ctx.db.insert("workspaceAuditLogs", {
      workspaceId: args.workspaceId,
      actorUserId: args.callerUserId,
      eventType: "workspace.restored",
      entityType: "workspace",
      entityId: args.workspaceId,
      severity: "info",
      metadata: { previousStatus: ws.status },
      createdAt: now,
    });

    return { success: true, status: "active" };
  },
});

export const suspendWorkspace = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    callerUserId: v.id("users"),
    reason: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ws = await ctx.db.get(args.workspaceId);
    if (!ws || ws.deletedAt || ws.status === "deleted") {
      throw new Error("WORKSPACE_NOT_FOUND");
    }

    const callerMembership = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", args.callerUserId)
      )
      .first();

    const callerRole = (callerMembership?.role || callerMembership?.defaultRole || "").toLowerCase();
    if (!callerMembership || (callerRole !== "owner" && callerRole !== "admin")) {
      throw new Error("UNAUTHORIZED_SUSPEND_WORKSPACE");
    }

    if (!canTransitionWorkspace(ws.status || "active", "suspended")) {
      throw new Error(`CANNOT_TRANSITION_STATUS_FROM_${(ws.status || "").toUpperCase()}_TO_SUSPENDED`);
    }

    const now = Date.now();
    await ctx.db.patch(args.workspaceId, {
      status: "suspended",
      suspendedAt: now,
      suspendedBy: args.callerUserId as string,
      suspensionReason: args.reason || "Administrative suspension",
      suspensionNotes: args.notes,
      updatedAt: now,
    });

    await ctx.db.insert("workspaceAuditLogs", {
      workspaceId: args.workspaceId,
      actorUserId: args.callerUserId,
      eventType: "workspace.suspended",
      entityType: "workspace",
      entityId: args.workspaceId,
      severity: "warning",
      metadata: { reason: args.reason, previousStatus: ws.status },
      createdAt: now,
    });

    return { success: true, status: "suspended" };
  },
});

export const requestWorkspaceDeletion = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    callerUserId: v.id("users"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ws = await ctx.db.get(args.workspaceId);
    if (!ws || ws.deletedAt || ws.status === "deleted") {
      throw new Error("WORKSPACE_NOT_FOUND");
    }

    const callerMembership = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", args.callerUserId)
      )
      .first();

    const callerRole = (callerMembership?.role || callerMembership?.defaultRole || "").toLowerCase();
    if (!callerMembership || callerRole !== "owner") {
      throw new Error("ONLY_OWNER_CAN_DELETE_WORKSPACE");
    }

    const now = Date.now();
    const purgeScheduledAt = now + 30 * 86_400_000;

    await ctx.db.patch(args.workspaceId, {
      status: "deleting",
      deletionRequestedAt: now,
      deletionRequestedBy: args.callerUserId as string,
      deletionReason: args.reason,
      deletionStatus: "pending_cooldown",
      purgeScheduledAt,
      updatedAt: now,
    });

    await ctx.db.insert("workspaceAuditLogs", {
      workspaceId: args.workspaceId,
      actorUserId: args.callerUserId,
      eventType: "workspace.deletion_requested",
      entityType: "workspace",
      entityId: args.workspaceId,
      severity: "warning",
      metadata: { purgeScheduledAt, reason: args.reason },
      createdAt: now,
    });

    return { success: true, status: "deleting", purgeScheduledAt };
  },
});

export const cancelWorkspaceDeletion = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    callerUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const ws = await ctx.db.get(args.workspaceId);
    if (!ws) {
      throw new Error("WORKSPACE_NOT_FOUND");
    }

    if (ws.status !== "deleting" && !ws.deletionRequestedAt) {
      throw new Error("NO_PENDING_DELETION_TO_CANCEL");
    }

    const callerMembership = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", args.callerUserId)
      )
      .first();

    const callerRole = (callerMembership?.role || callerMembership?.defaultRole || "").toLowerCase();
    if (!callerMembership || callerRole !== "owner") {
      throw new Error("ONLY_OWNER_CAN_CANCEL_DELETION");
    }

    const now = Date.now();
    await ctx.db.patch(args.workspaceId, {
      status: "active",
      deletionCancelledAt: now,
      deletionStatus: undefined,
      deletionRequestedAt: undefined,
      deletionRequestedBy: undefined,
      purgeScheduledAt: undefined,
      updatedAt: now,
    });

    await ctx.db.insert("workspaceAuditLogs", {
      workspaceId: args.workspaceId,
      actorUserId: args.callerUserId,
      eventType: "workspace.deletion_cancelled",
      entityType: "workspace",
      entityId: args.workspaceId,
      severity: "info",
      metadata: { previousStatus: "deleting" },
      createdAt: now,
    });

    return { success: true, status: "active" };
  },
});

export const transferWorkspaceOwnership = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    callerUserId: v.id("users"),
    newOwnerUserId: v.id("users"),
    transferPassword: v.optional(v.string()),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.callerUserId === args.newOwnerUserId) {
      throw new Error("CANNOT_TRANSFER_TO_SELF");
    }

    const ws = await ctx.db.get(args.workspaceId);
    if (!ws || ws.deletedAt || ws.status === "deleted") {
      throw new Error("WORKSPACE_NOT_FOUND");
    }

    const callerMembership = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", args.callerUserId)
      )
      .first();

    const callerRole = (callerMembership?.role || callerMembership?.defaultRole || "").toLowerCase();
    if (!callerMembership || callerRole !== "owner") {
      throw new Error("ONLY_OWNER_CAN_TRANSFER_OWNERSHIP");
    }

    const newOwnerMembership = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", args.newOwnerUserId)
      )
      .first();

    if (!newOwnerMembership || (newOwnerMembership.status || "").toLowerCase() !== "active") {
      throw new Error("NEW_OWNER_MUST_BE_ACTIVE_MEMBER");
    }

    const newOwnerWorkspaces = await ctx.db
      .query("workspaces")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.newOwnerUserId))
      .collect();

    const activeOwned = newOwnerWorkspaces.filter(
      (w) => !w.deletedAt && (w.status || "").toLowerCase() !== "deleted"
    );

    if (activeOwned.length >= 3) {
      throw new Error("TARGET_USER_WORKSPACE_LIMIT_REACHED");
    }

    const now = Date.now();

    await ctx.db.patch(args.workspaceId, {
      ownerId: args.newOwnerUserId,
      updatedAt: now,
    });

    await ctx.db.patch(newOwnerMembership._id, {
      role: "owner",
      defaultRole: "owner",
      updatedAt: now,
    });

    await ctx.db.patch(callerMembership._id, {
      role: "admin",
      defaultRole: "admin",
      updatedAt: now,
    });

    await ctx.db.insert("workspaceAuditLogs", {
      workspaceId: args.workspaceId,
      actorUserId: args.callerUserId,
      eventType: "workspace.ownership_transferred",
      entityType: "workspace",
      entityId: args.workspaceId,
      severity: "warning",
      metadata: {
        previousOwnerId: args.callerUserId,
        newOwnerId: args.newOwnerUserId,
        reason: args.reason,
      },
      createdAt: now,
    });

    await ctx.db.insert("notifications", {
      userId: args.newOwnerUserId,
      type: "workspace_ownership_transferred",
      title: `You are now the owner of ${ws.name}`,
      body: `Ownership was transferred to you.`,
      data: { workspaceId: args.workspaceId, workspaceName: ws.name },
      severity: "INFO",
      channel: "IN_APP",
      status: "UNREAD",
      createdAt: now,
    });

    await ctx.db.insert("notifications", {
      userId: args.callerUserId,
      type: "workspace_ownership_transferred",
      title: `Ownership of ${ws.name} transferred`,
      body: `You are now an administrator in this workspace.`,
      data: { workspaceId: args.workspaceId, workspaceName: ws.name },
      severity: "INFO",
      channel: "IN_APP",
      status: "UNREAD",
      createdAt: now,
    });

    return { success: true, newOwnerId: args.newOwnerUserId };
  },
});

export const getWorkspaceEligibility = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const ownedWorkspaces = await ctx.db
      .query("workspaces")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.userId))
      .collect();

    const activeOwned = ownedWorkspaces.filter(
      (w) => !w.deletedAt && (w.status || "").toLowerCase() !== "deleted"
    );

    const trialCount = activeOwned.filter(
      (w) => (w.status || "").toLowerCase() === "trial"
    ).length;

    const allMemberships = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const activeJoined = allMemberships.filter(
      (m) => (m.status || "").toLowerCase() === "active" && (m.role || "").toLowerCase() !== "owner"
    ).length;

    const maxLimit = 3;
    const allowed = activeOwned.length < maxLimit;

    return {
      allowed,
      ownedCount: activeOwned.length,
      ownedLimit: maxLimit,
      trialCount,
      trialLimit: 1,
      freeTrialEligible: trialCount === 0,
      joinedCount: activeJoined,
      canCreateTrial: trialCount === 0 && allowed,
      reasons: allowed ? [] : ["Plan workspace limit (3) reached"],
    };
  },
});
