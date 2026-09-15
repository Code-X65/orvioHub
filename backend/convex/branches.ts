import { mutation, query } from "./_generated/server.js";
import { Id } from "./_generated/dataModel.js";
import { v } from "convex/values";

function buildFormattedAddress(args: {
  blockNumber?: string;
  street?: string;
  area?: string;
  city?: string;
  lga?: string;
  state?: string;
  country?: string;
}): string {
  const parts: string[] = [];
  if (args.blockNumber) parts.push(`Block ${args.blockNumber}`);
  if (args.street) parts.push(args.street);
  if (args.area) parts.push(args.area);
  if (args.city) parts.push(args.city);
  if (args.lga) parts.push(args.lga);
  if (args.state) parts.push(args.state);
  parts.push(args.country || "Nigeria");
  return parts.join(", ");
}

export const createBranch = mutation({
  args: {
    workspaceId: v.optional(v.id("workspaces")),
    organizationId: v.optional(v.union(v.id("organizations"), v.id("workspaces"), v.string())),
    applicationId: v.optional(v.id("applications")),
    name: v.string(),
    code: v.optional(v.string()),
    isPrimary: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
    // Structured Address
    country: v.optional(v.string()),
    state: v.optional(v.string()),
    stateCode: v.optional(v.string()),
    lga: v.optional(v.string()),
    city: v.optional(v.string()),
    street: v.optional(v.string()),
    blockNumber: v.optional(v.string()),
    area: v.optional(v.string()),
    landmark: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    address: v.optional(v.string()),
    formattedAddress: v.optional(v.string()),
    // Contact details
    phone: v.optional(v.string()),
    phoneNormalized: v.optional(v.string()),
    email: v.optional(v.string()),
    managerId: v.optional(v.id("users")),
    callerUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Resolve workspace and organization IDs
    let resolvedWorkspaceId = args.workspaceId;
    let resolvedOrgId: Id<"organizations"> | undefined = undefined;

    if (args.organizationId) {
      const directOrg = ctx.db.normalizeId("organizations", args.organizationId);
      if (directOrg) {
        resolvedOrgId = directOrg;
      } else {
        const wsId = ctx.db.normalizeId("workspaces", args.organizationId);
        if (wsId) {
          if (!resolvedWorkspaceId) resolvedWorkspaceId = wsId;
          const ws = await ctx.db.get(wsId);
          if (ws?.organizationId) resolvedOrgId = ws.organizationId;
        }
      }
    }

    if (!resolvedWorkspaceId && resolvedOrgId) {
      const ws = await ctx.db
        .query("workspaces")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", resolvedOrgId!))
        .first();
      if (ws) resolvedWorkspaceId = ws._id;
    }

    if (!resolvedOrgId && resolvedWorkspaceId) {
      const ws = await ctx.db.get(resolvedWorkspaceId);
      if (ws?.organizationId) resolvedOrgId = ws.organizationId;
    }

    // Resolve application ID
    let resolvedAppId = args.applicationId;
    if (!resolvedAppId) {
      const app = await ctx.db
        .query("applications")
        .withIndex("by_key", (q) => q.eq("key", "inventory"))
        .first();
      if (app) resolvedAppId = app._id;
    }

    // Validate caller membership if callerUserId is provided
    if (args.callerUserId && resolvedOrgId) {
      const membership = await ctx.db
        .query("organizationMemberships")
        .withIndex("by_org_and_user", (q: any) =>
          q.eq("organizationId", resolvedOrgId!).eq("userId", args.callerUserId!)
        )
        .first();
      if (!membership) {
        throw new Error("NOT_AN_ORGANIZATION_MEMBER");
      }
    }

    // Validate that app is enabled and active for the organization
    if (resolvedOrgId && resolvedAppId) {
      const orgApp = await ctx.db
        .query("orgApplications")
        .withIndex("by_org_and_app", (q: any) =>
          q.eq("organizationId", resolvedOrgId!).eq("applicationId", resolvedAppId!)
        )
        .first();
      if (!orgApp || !orgApp.enabled || (orgApp.status && orgApp.status !== "trial" && orgApp.status !== "active")) {
        throw new Error("APPLICATION_NOT_ACTIVATED");
      }
    }

    // Check existing branches
    let existingBranches: any[] = [];
    if (resolvedOrgId) {
      existingBranches = await ctx.db
        .query("branches")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", resolvedOrgId!))
        .collect();
    } else if (resolvedWorkspaceId) {
      existingBranches = await ctx.db
        .query("branches")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", resolvedWorkspaceId!))
        .collect();
    }

    const activeExisting = existingBranches.filter(
      (b) => b.status !== "ARCHIVED" && b.status !== "deleted"
    );

    // 1. Subscription & Plan limit check (scoped to org or workspace)
    let subscription = null;
    if (resolvedOrgId) {
      subscription = await ctx.db
        .query("subscriptions")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", resolvedOrgId!))
        .first();
    }
    if (!subscription && resolvedWorkspaceId) {
      subscription = await ctx.db
        .query("subscriptions")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", resolvedWorkspaceId!))
        .first();
    }

    if (subscription && subscription.status === "suspended") {
      throw new Error(
        "Cannot create branch: Organization subscription is suspended. Please upgrade or reactivate your subscription."
      );
    }

    const planKey =
      subscription?.planKey === "free"
        ? "free_trial"
        : subscription?.planKey || "free_trial";

    // Enforce Rule 4: Limit branches on Free Trial orgs (1 branch per app)
    if (planKey === "free_trial" || planKey === "free") {
      const activeForApp = activeExisting.filter(
        (b) => !resolvedAppId || !b.applicationId || b.applicationId === resolvedAppId
      );
      if (activeForApp.length >= 1) {
        throw new Error(
          "Free Trial organizations can only have 1 branch per application. Upgrade to Standard to add more branches."
        );
      }
    }

    const plan = await ctx.db
      .query("plans")
      .withIndex("by_key", (q) => q.eq("key", planKey))
      .first();

    const rawLimit = plan?.limits?.branches;
    const maxBranches =
      typeof rawLimit === "number"
        ? rawLimit
        : typeof rawLimit === "string" && rawLimit !== "unlimited"
        ? parseInt(rawLimit, 10) || 3
        : rawLimit === "unlimited"
        ? Infinity
        : 3;

    if (activeExisting.length >= maxBranches) {
      throw new Error(
        `Cannot create branch: Plan limit reached (${maxBranches} branches). Upgrade to add more branches.`
      );
    }

    // Auto-generate code if missing
    let code = args.code?.trim().toUpperCase();
    if (!code) {
      code =
        args.name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4) ||
        `BR0${activeExisting.length + 1}`;
    }

    // Check code uniqueness
    const duplicateCode = activeExisting.find(
      (b) => b.code?.toUpperCase() === code
    );
    if (duplicateCode) {
      throw new Error(`Branch code '${code}' already exists.`);
    }

    // Determine primary status
    const shouldBePrimary =
      args.isPrimary !== undefined ? args.isPrimary : activeExisting.length === 0;

    if (shouldBePrimary) {
      for (const b of activeExisting) {
        if (b.isPrimary) {
          await ctx.db.patch(b._id, { isPrimary: false, updatedAt: now });
        }
      }
    }

    // Compute formatted address if structured components provided
    const computedFormattedAddress =
      args.formattedAddress ||
      (args.state || args.city || args.street
        ? buildFormattedAddress({
            blockNumber: args.blockNumber,
            street: args.street,
            area: args.area,
            city: args.city,
            lga: args.lga,
            state: args.state,
            country: args.country,
          })
        : args.address);

    const branchId = await ctx.db.insert("branches", {
      workspaceId: resolvedWorkspaceId,
      organizationId: resolvedOrgId,
      applicationId: resolvedAppId,
      productKey: "inventory",
      name: args.name.trim(),
      code,
      isPrimary: shouldBePrimary,
      isActive: args.isActive !== undefined ? args.isActive : true,
      country: args.country || "Nigeria",
      state: args.state,
      stateCode: args.stateCode,
      lga: args.lga,
      city: args.city,
      street: args.street,
      blockNumber: args.blockNumber,
      area: args.area,
      landmark: args.landmark,
      postalCode: args.postalCode,
      address: computedFormattedAddress,
      formattedAddress: computedFormattedAddress,
      phone: args.phone,
      phoneNormalized: args.phoneNormalized,
      phoneVerified: false,
      email: args.email,
      managerId: args.managerId,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    if (args.callerUserId && resolvedWorkspaceId) {
      await ctx.db.insert("workspaceAuditLogs", {
        workspaceId: resolvedWorkspaceId,
        actorUserId: args.callerUserId,
        eventType: "workspace.branch_created",
        entityType: "branch",
        entityId: branchId,
        severity: "info",
        metadata: { branchName: args.name, code, isPrimary: shouldBePrimary },
        createdAt: now,
      });
    }

    return branchId;
  },
});

export const getBranches = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const branches = await ctx.db
      .query("branches")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    
    const active = branches.filter((b) => b.status !== "deleted" && b.status !== "archived");

    // Sort: Primary first, then alphabetically by name
    return active.sort((a, b) => {
      if (a.isPrimary && !b.isPrimary) return -1;
      if (!a.isPrimary && b.isPrimary) return 1;
      return a.name.localeCompare(b.name);
    });
  },
});

export const listBranches = query({
  args: {
    organizationId: v.optional(v.union(v.id("organizations"), v.id("workspaces"), v.string())),
    applicationId: v.optional(v.id("applications")),
    workspaceId: v.optional(v.id("workspaces")),
  },
  handler: async (ctx, args) => {
    let branches: any[] = [];
    let resolvedOrgId: Id<"organizations"> | undefined = undefined;
    let resolvedWsId = args.workspaceId;

    if (args.organizationId) {
      const directOrg = ctx.db.normalizeId("organizations", args.organizationId);
      if (directOrg) {
        resolvedOrgId = directOrg;
      } else {
        const wsId = ctx.db.normalizeId("workspaces", args.organizationId);
        if (wsId) {
          if (!resolvedWsId) resolvedWsId = wsId;
          const ws = await ctx.db.get(wsId);
          if (ws?.organizationId) resolvedOrgId = ws.organizationId;
        }
      }
    }

    if (resolvedOrgId) {
      branches = await ctx.db
        .query("branches")
        .withIndex("by_organizationId", (q) =>
          q.eq("organizationId", resolvedOrgId!)
        )
        .collect();
    } else if (resolvedWsId) {
      branches = await ctx.db
        .query("branches")
        .withIndex("by_workspace", (q) =>
          q.eq("workspaceId", resolvedWsId!)
        )
        .collect();
    }

    if (args.applicationId) {
      branches = branches.filter(
        (b) => !b.applicationId || b.applicationId === args.applicationId
      );
    }

    const active = branches.filter(
      (b) =>
        b.status !== "deleted" &&
        b.status !== "archived" &&
        b.isActive !== false
    );

    return active.sort((a, b) => {
      if (a.isPrimary && !b.isPrimary) return -1;
      if (!a.isPrimary && b.isPrimary) return 1;
      return a.name.localeCompare(b.name);
    });
  },
});

export const getBranchesForOrgApp = query({
  args: {
    organizationId: v.union(v.id("organizations"), v.id("workspaces"), v.string()),
    applicationId: v.optional(v.id("applications")),
    applicationKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let resolvedOrgId: Id<"organizations"> | undefined = undefined;
    const directOrg = ctx.db.normalizeId("organizations", args.organizationId);
    if (directOrg) {
      resolvedOrgId = directOrg;
    } else {
      const wsId = ctx.db.normalizeId("workspaces", args.organizationId);
      if (wsId) {
        const ws = await ctx.db.get(wsId);
        if (ws?.organizationId) resolvedOrgId = ws.organizationId;
      }
    }

    if (!resolvedOrgId) return [];

    let resolvedAppId = args.applicationId;
    if (!resolvedAppId) {
      const appKey = args.applicationKey || "inventory";
      const app = await ctx.db
        .query("applications")
        .withIndex("by_key", (q: any) => q.eq("key", appKey))
        .first();
      if (app) resolvedAppId = app._id;
    }

    let branches: any[] = [];
    if (resolvedAppId) {
      branches = await ctx.db
        .query("branches")
        .withIndex("by_org_and_app", (q: any) =>
          q.eq("organizationId", resolvedOrgId!).eq("applicationId", resolvedAppId!)
        )
        .collect();
    }

    if (!branches || branches.length === 0) {
      branches = await ctx.db
        .query("branches")
        .withIndex("by_organizationId", (q: any) =>
          q.eq("organizationId", resolvedOrgId!)
        )
        .collect();
    }

    if (!branches || branches.length === 0) {
      const orgWorkspaces = await ctx.db
        .query("workspaces")
        .withIndex("by_organizationId", (q: any) => q.eq("organizationId", resolvedOrgId!))
        .collect();
      for (const w of orgWorkspaces) {
        const wsBranches = await ctx.db
          .query("branches")
          .withIndex("by_workspace", (q: any) => q.eq("workspaceId", w._id))
          .collect();
        for (const wb of wsBranches) {
          if (!branches.some((b: any) => b._id === wb._id)) {
            branches.push(wb);
          }
        }
      }
    }

    const active = branches.filter(
      (b) =>
        b.status !== "deleted" &&
        b.status !== "archived" &&
        b.isActive !== false
    );

    return active.sort((a, b) => {
      if (a.isPrimary && !b.isPrimary) return -1;
      if (!a.isPrimary && b.isPrimary) return 1;
      return a.name.localeCompare(b.name);
    });
  },
});

export const autoCreateMainBranch = mutation({
  args: {
    organizationId: v.union(v.id("organizations"), v.id("workspaces"), v.string()),
    applicationId: v.optional(v.id("applications")),
    userId: v.optional(v.id("users")),
    name: v.optional(v.string()),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let resolvedOrgId: Id<"organizations"> | undefined = undefined;
    let ws = null;
    const directOrg = ctx.db.normalizeId("organizations", args.organizationId);
    if (directOrg) {
      resolvedOrgId = directOrg;
      ws = await ctx.db
        .query("workspaces")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", directOrg))
        .first();
    } else {
      const wsId = ctx.db.normalizeId("workspaces", args.organizationId);
      if (wsId) {
        ws = await ctx.db.get(wsId);
        if (ws?.organizationId) resolvedOrgId = ws.organizationId;
      }
    }

    if (!resolvedOrgId) throw new Error("ORGANIZATION_NOT_FOUND");
    const org = await ctx.db.get(resolvedOrgId);
    if (!org) throw new Error("ORGANIZATION_NOT_FOUND");

    if (args.userId) {
      const membership = await ctx.db
        .query("organizationMemberships")
        .withIndex("by_org_and_user", (q: any) =>
          q.eq("organizationId", resolvedOrgId!).eq("userId", args.userId!)
        )
        .first();
      if (!membership) {
        throw new Error("NOT_AN_ORGANIZATION_MEMBER");
      }
    }

    let resolvedAppId = args.applicationId;
    if (!resolvedAppId) {
      const app = await ctx.db
        .query("applications")
        .withIndex("by_key", (q: any) => q.eq("key", "inventory"))
        .first();
      if (app) resolvedAppId = app._id;
    }

    // Check if any active branch already exists for this org
    const existing = await ctx.db
      .query("branches")
      .withIndex("by_organizationId", (q: any) =>
        q.eq("organizationId", resolvedOrgId!)
      )
      .collect();

    const activeExisting = existing.filter(
      (b) => b.status !== "deleted" && b.status !== "archived" && b.isActive !== false
    );

    if (activeExisting.length > 0) {
      const primary = activeExisting.find((b) => b.isPrimary) || activeExisting[0];
      return { branchId: primary._id, isNew: false, branch: primary };
    }

    // Validate that application is active before creating the initial branch
    if (resolvedOrgId && resolvedAppId) {
      const orgApp = await ctx.db
        .query("orgApplications")
        .withIndex("by_org_and_app", (q: any) =>
          q.eq("organizationId", resolvedOrgId!).eq("applicationId", resolvedAppId!)
        )
        .first();
      if (!orgApp || !orgApp.enabled || (orgApp.status && orgApp.status !== "trial" && orgApp.status !== "active")) {
        throw new Error("APPLICATION_NOT_ACTIVATED");
      }
    }

    const now = Date.now();
    const branchName = args.name?.trim() || "Main Branch";
    const fullAddress = args.address || org.address || "";
    const phone = args.phone || org.phone || "";

    const branchId = await ctx.db.insert("branches", {
      organizationId: resolvedOrgId,
      applicationId: resolvedAppId,
      workspaceId: ws?._id,
      productKey: "inventory",
      name: branchName,
      code: "MAIN",
      isPrimary: true,
      isActive: true,
      country: org.country || "Nigeria",
      address: fullAddress,
      formattedAddress: fullAddress,
      phone,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    const newBranch = await ctx.db.get(branchId);
    return { branchId, isNew: true, branch: newBranch };
  },
});

export const getByWorkspace = getBranches;

export const getAccessibleBranches = query({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    productKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", args.userId)
      )
      .first();

    if (!membership || membership.status.toLowerCase() !== "active") {
      return [];
    }

    const allBranches = await ctx.db
      .query("branches")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const activeBranches = allBranches.filter(
      (b) => b.status !== "deleted" && b.status !== "archived"
    );

    const sortFn = (a: any, b: any) => {
      if (a.isPrimary && !b.isPrimary) return -1;
      if (!a.isPrimary && b.isPrimary) return 1;
      return a.name.localeCompare(b.name);
    };

    const role = (membership.role || membership.defaultRole || "member").toLowerCase();
    if (role === "owner" || role === "admin") {
      return activeBranches.sort(sortFn);
    }

    // Staff member: resolve branch access from product memberships
    const productMemberships = await ctx.db
      .query("productMemberships")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", args.userId)
      )
      .collect();

    const targetProductMemberships = args.productKey
      ? productMemberships.filter((pm) => pm.productKey === args.productKey && pm.status.toLowerCase() === "active")
      : productMemberships.filter((pm) => pm.status.toLowerCase() === "active");

    const allowedBranchIds = new Set<string>();
    for (const pm of targetProductMemberships) {
      if (pm.branchIds && Array.isArray(pm.branchIds)) {
        for (const bid of pm.branchIds) {
          allowedBranchIds.add(bid);
        }
      }
    }

    if (allowedBranchIds.size === 0) {
      return [];
    }

    return activeBranches.filter((b) => allowedBranchIds.has(b._id)).sort(sortFn);
  },
});

export const getBranchById = query({
  args: {
    branchId: v.id("branches"),
    workspaceId: v.optional(v.id("workspaces")),
  },
  handler: async (ctx, args) => {
    const branch = await ctx.db.get(args.branchId);
    if (!branch) return null;
    if (args.workspaceId && branch.workspaceId !== args.workspaceId) {
      return null;
    }
    return branch;
  },
});

export const getById = getBranchById;

export const updateBranch = mutation({
  args: {
    branchId: v.id("branches"),
    name: v.optional(v.string()),
    code: v.optional(v.string()),
    isPrimary: v.optional(v.boolean()),
    // Structured address
    country: v.optional(v.string()),
    state: v.optional(v.string()),
    stateCode: v.optional(v.string()),
    lga: v.optional(v.string()),
    city: v.optional(v.string()),
    street: v.optional(v.string()),
    blockNumber: v.optional(v.string()),
    area: v.optional(v.string()),
    landmark: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    address: v.optional(v.string()),
    formattedAddress: v.optional(v.string()),
    // Contact
    phone: v.optional(v.string()),
    phoneNormalized: v.optional(v.string()),
    email: v.optional(v.string()),
    managerId: v.optional(v.id("users")),
    status: v.optional(v.string()),
    callerUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const branch = await ctx.db.get(args.branchId);
    if (!branch) throw new Error("BRANCH_NOT_FOUND");

    const now = Date.now();
    const patch: any = { updatedAt: now };

    if (args.name !== undefined) patch.name = args.name.trim();

    if (args.code !== undefined) {
      const formattedCode = args.code.trim().toUpperCase();
      const allBranches = await ctx.db
        .query("branches")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", branch.workspaceId))
        .collect();

      const duplicate = allBranches.find(
        (b) => b._id !== branch._id && b.status !== "deleted" && b.code?.toUpperCase() === formattedCode
      );
      if (duplicate) {
        throw new Error(`Branch code '${formattedCode}' is already used by another branch.`);
      }
      patch.code = formattedCode;
    }

    if (args.isPrimary === true) {
      const allBranches = await ctx.db
        .query("branches")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", branch.workspaceId))
        .collect();

      for (const b of allBranches) {
        if (b._id !== branch._id && b.isPrimary) {
          await ctx.db.patch(b._id, { isPrimary: false, updatedAt: now });
        }
      }
      patch.isPrimary = true;
    } else if (args.isPrimary === false) {
      patch.isPrimary = false;
    }

    if (args.country !== undefined) patch.country = args.country;
    if (args.state !== undefined) patch.state = args.state;
    if (args.stateCode !== undefined) patch.stateCode = args.stateCode;
    if (args.lga !== undefined) patch.lga = args.lga;
    if (args.city !== undefined) patch.city = args.city;
    if (args.street !== undefined) patch.street = args.street;
    if (args.blockNumber !== undefined) patch.blockNumber = args.blockNumber;
    if (args.area !== undefined) patch.area = args.area;
    if (args.landmark !== undefined) patch.landmark = args.landmark;
    if (args.postalCode !== undefined) patch.postalCode = args.postalCode;

    // Check if phone was changed to reset phone verification
    if (args.phone !== undefined) {
      patch.phone = args.phone;
      if (args.phoneNormalized !== undefined) {
        patch.phoneNormalized = args.phoneNormalized;
      }
      if (args.phone !== branch.phone) {
        patch.phoneVerified = false;
        patch.phoneVerifiedAt = undefined;
        patch.verificationCode = undefined;
        patch.codeExpiresAt = undefined;
      }
    }

    if (args.email !== undefined) patch.email = args.email;
    if (args.managerId !== undefined) patch.managerId = args.managerId;
    if (args.status !== undefined) patch.status = args.status;

    // Compute formatted address
    const computedFormattedAddress =
      args.formattedAddress ||
      (patch.state || patch.city || patch.street
        ? buildFormattedAddress({
            blockNumber: patch.blockNumber || branch.blockNumber,
            street: patch.street || branch.street,
            area: patch.area || branch.area,
            city: patch.city || branch.city,
            lga: patch.lga || branch.lga,
            state: patch.state || branch.state,
            country: patch.country || branch.country,
          })
        : args.address !== undefined
        ? args.address
        : branch.address);

    patch.address = computedFormattedAddress;
    patch.formattedAddress = computedFormattedAddress;

    await ctx.db.patch(args.branchId, patch);

    if (args.callerUserId && branch.workspaceId) {
      await ctx.db.insert("workspaceAuditLogs", {
        workspaceId: branch.workspaceId,
        actorUserId: args.callerUserId,
        eventType: "workspace.branch_updated",
        entityType: "branch",
        entityId: args.branchId,
        severity: "info",
        metadata: { updates: patch },
        createdAt: now,
      });
    }

    return await ctx.db.get(args.branchId);
  },
});

// Mutation: Save branch phone OTP code
export const savePhoneOtp = mutation({
  args: {
    branchId: v.id("branches"),
    phone: v.string(),
    phoneNormalized: v.string(),
    verificationCode: v.string(), // bcrypt hashed
    codeExpiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const branch = await ctx.db.get(args.branchId);
    if (!branch) throw new Error("Branch not found");

    await ctx.db.patch(args.branchId, {
      phone: args.phone,
      phoneNormalized: args.phoneNormalized,
      verificationCode: args.verificationCode,
      codeExpiresAt: args.codeExpiresAt,
      updatedAt: Date.now(),
    });

    return { success: true, branchId: args.branchId };
  },
});

// Mutation: Verify branch phone OTP
export const verifyPhone = mutation({
  args: {
    branchId: v.id("branches"),
  },
  handler: async (ctx, args) => {
    const branch = await ctx.db.get(args.branchId);
    if (!branch) throw new Error("Branch not found");

    const now = Date.now();
    await ctx.db.patch(args.branchId, {
      phoneVerified: true,
      phoneVerifiedAt: now,
      verificationCode: undefined,
      codeExpiresAt: undefined,
      updatedAt: now,
    });

    return { success: true, branchId: args.branchId };
  },
});

/**
 * Mutation: Create a branch scoped to (organization, application) (US-BR1)
 */
export const createBranchForApplication = mutation({
  args: {
    organizationId: v.union(v.id("organizations"), v.id("workspaces"), v.string()),
    applicationId: v.optional(v.union(v.id("applications"), v.string())),
    applicationKey: v.optional(v.string()),
    name: v.string(),
    code: v.optional(v.string()),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    isPrimary: v.optional(v.boolean()),
    callerUserId: v.optional(v.id("users")),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const effectiveUserId = args.userId || args.callerUserId;

    // 1. Resolve organization & workspace
    let resolvedOrgId: Id<"organizations"> | undefined = undefined;
    let resolvedWorkspaceId: Id<"workspaces"> | undefined = undefined;

    const directOrg = ctx.db.normalizeId("organizations", args.organizationId);
    if (directOrg) {
      resolvedOrgId = directOrg;
      const ws = await ctx.db
        .query("workspaces")
        .withIndex("by_organizationId", (q: any) => q.eq("organizationId", directOrg))
        .first();
      if (ws) resolvedWorkspaceId = ws._id;
    } else {
      const wsId = ctx.db.normalizeId("workspaces", args.organizationId);
      if (wsId) {
        resolvedWorkspaceId = wsId;
        const ws = await ctx.db.get(wsId);
        if (ws?.organizationId) resolvedOrgId = ws.organizationId;
      }
    }

    if (!resolvedOrgId) {
      throw new Error("ORGANIZATION_NOT_FOUND");
    }

    // 2. Resolve application
    let resolvedAppId: Id<"applications"> | undefined = undefined;
    let resolvedAppKey = args.applicationKey || "inventory";

    if (args.applicationId) {
      const directAppId = ctx.db.normalizeId("applications", args.applicationId);
      if (directAppId) {
        resolvedAppId = directAppId;
        const app = await ctx.db.get(directAppId);
        if (app?.key) resolvedAppKey = app.key;
      }
    }

    if (!resolvedAppId) {
      const app = await ctx.db
        .query("applications")
        .withIndex("by_key", (q: any) => q.eq("key", resolvedAppKey))
        .first();
      if (app) {
        resolvedAppId = app._id;
      } else {
        resolvedAppId = await ctx.db.insert("applications", {
          key: resolvedAppKey,
          name: resolvedAppKey.charAt(0).toUpperCase() + resolvedAppKey.slice(1),
          enabled: true,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    // 3. Validate user membership if userId provided
    if (effectiveUserId) {
      const membership = await ctx.db
        .query("organizationMemberships")
        .withIndex("by_org_and_user", (q: any) =>
          q.eq("organizationId", resolvedOrgId!).eq("userId", effectiveUserId)
        )
        .first();

      if (!membership || membership.status !== "ACTIVE") {
        throw new Error("ORGANIZATION_ACCESS_DENIED");
      }
    }

    // 4. Validate organization has active subscription
    const orgSub = await ctx.db
      .query("subscriptions")
      .withIndex("by_organizationId", (q: any) => q.eq("organizationId", resolvedOrgId!))
      .first();

    if (!orgSub || (orgSub.status !== "active" && orgSub.status !== "trial" && orgSub.status !== "trialing")) {
      throw new Error("An active organization subscription is required before creating branches.");
    }

    // 5. Ensure application is activated for organization
    const orgApp = await ctx.db
      .query("orgApplications")
      .withIndex("by_org_and_app", (q: any) =>
        q.eq("organizationId", resolvedOrgId!).eq("applicationId", resolvedAppId!)
      )
      .first();

    const isAppActive =
      !!orgApp &&
      orgApp.enabled !== false &&
      (orgApp.status === "active" || orgApp.status === "trial" || orgApp.status === "trialing");

    if (!isAppActive) {
      throw new Error("APPLICATION_NOT_ACTIVATED");
    }

    // 6. Enforce plan limits (Free Trial orgs: max 1 branch per app)
    const currentPlanKey = (orgSub.planKey || "free_trial").toLowerCase();
    const isFreeTrialOrg = currentPlanKey === "free_trial" || currentPlanKey === "free";

    const existingBranches = await ctx.db
      .query("branches")
      .withIndex("by_org_and_app", (q: any) =>
        q.eq("organizationId", resolvedOrgId!).eq("applicationId", resolvedAppId!)
      )
      .collect();

    const activeBranches = existingBranches.filter(
      (b: any) => b.isActive !== false && b.status !== "archived" && b.status !== "deleted"
    );

    if (isFreeTrialOrg && activeBranches.length >= 1) {
      throw new Error(
        "Free Trial organizations can only have 1 branch per application. Upgrade to Standard to add more branches."
      );
    }

    // 7. Manage isPrimary flag
    let isPrimary = args.isPrimary ?? false;
    if (activeBranches.length === 0) {
      isPrimary = true;
    }

    if (isPrimary) {
      for (const branch of activeBranches) {
        if (branch.isPrimary) {
          await ctx.db.patch(branch._id, { isPrimary: false, updatedAt: now });
        }
      }
    }

    // 8. Insert new branch
    const branchId = await ctx.db.insert("branches", {
      organizationId: resolvedOrgId,
      applicationId: resolvedAppId,
      workspaceId: resolvedWorkspaceId,
      productKey: resolvedAppKey,
      name: args.name.trim(),
      code: args.code?.trim(),
      address: args.address?.trim(),
      formattedAddress: args.address?.trim(),
      phone: args.phone?.trim(),
      isPrimary,
      isActive: true,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    // 9. Audit log
    try {
      if (resolvedWorkspaceId) {
        await ctx.db.insert("workspaceAuditLogs", {
          workspaceId: resolvedWorkspaceId,
          actorUserId: effectiveUserId,
          eventType: "workspace.branch_created",
          entityType: "branch",
          entityId: branchId,
          severity: "info",
          metadata: {
            organizationId: resolvedOrgId,
            applicationId: resolvedAppId,
            branchName: args.name,
            isPrimary,
          },
          createdAt: now,
        });
      }

      await ctx.db.insert("auditLogs", {
        actorUserId: effectiveUserId as any,
        organizationId: resolvedOrgId,
        action: "workspace.branch_created",
        eventType: "workspace.branch_created",
        resource: "branch",
        entityType: "branch",
        entityId: branchId,
        severity: "info",
        metadata: {
          name: args.name,
          code: args.code,
          isPrimary,
          applicationKey: resolvedAppKey,
        },
        timestamp: now,
        createdAt: now,
      });
    } catch {}

    // 10. In-app notification
    try {
      if (effectiveUserId) {
        await ctx.db.insert("notifications", {
          userId: effectiveUserId,
          type: "branch_created",
          title: "Branch Created",
          body: `New branch added: ${args.name}`,
          status: "UNREAD",
          severity: "INFO",
          channel: "IN_APP",
          data: {
            organizationId: resolvedOrgId,
            branchId,
          },
          createdAt: now,
        });
      }
    } catch {}

    const newBranch = await ctx.db.get(branchId);
    return {
      success: true,
      branchId,
      branch: newBranch,
    };
  },
});

/**
 * Mutation: Deactivate / soft-delete branch (US-BR2)
 */
export const deactivateBranch = mutation({
  args: {
    branchId: v.id("branches"),
    callerUserId: v.optional(v.id("users")),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const effectiveUserId = args.userId || args.callerUserId;

    const branch = await ctx.db.get(args.branchId);
    if (!branch) {
      throw new Error("BRANCH_NOT_FOUND");
    }

    if (effectiveUserId && branch.organizationId) {
      const membership = await ctx.db
        .query("organizationMemberships")
        .withIndex("by_org_and_user", (q: any) =>
          q.eq("organizationId", branch.organizationId!).eq("userId", effectiveUserId)
        )
        .first();

      if (!membership || membership.status !== "ACTIVE") {
        throw new Error("ORGANIZATION_ACCESS_DENIED");
      }
    }

    await ctx.db.patch(args.branchId, {
      isActive: false,
      status: "inactive",
      deletedAt: now,
      updatedAt: now,
    });

    // If this was primary, promote another active branch to primary if available
    if (branch.isPrimary && branch.organizationId) {
      const siblingQuery = branch.applicationId
        ? ctx.db
            .query("branches")
            .withIndex("by_org_and_app", (q: any) =>
              q.eq("organizationId", branch.organizationId!).eq("applicationId", branch.applicationId!)
            )
        : ctx.db
            .query("branches")
            .withIndex("by_organizationId", (q: any) =>
              q.eq("organizationId", branch.organizationId!)
            );

      const siblings = await siblingQuery.collect();
      const activeSibling = siblings.find(
        (b: any) => b._id !== args.branchId && b.isActive !== false && b.status !== "archived" && b.status !== "deleted" && b.status !== "inactive"
      );

      if (activeSibling) {
        await ctx.db.patch(activeSibling._id, {
          isPrimary: true,
          updatedAt: now,
        });
      }
    }

    // Audit log
    try {
      if (branch.workspaceId) {
        await ctx.db.insert("workspaceAuditLogs", {
          workspaceId: branch.workspaceId,
          actorUserId: effectiveUserId,
          eventType: "workspace.branch_deactivated",
          entityType: "branch",
          entityId: args.branchId,
          severity: "info",
          metadata: { branchName: branch.name },
          createdAt: now,
        });
      }

      if (branch.organizationId) {
        await ctx.db.insert("auditLogs", {
          actorUserId: effectiveUserId as any,
          organizationId: branch.organizationId,
          action: "workspace.branch_deactivated",
          eventType: "workspace.branch_deactivated",
          resource: "branch",
          entityType: "branch",
          entityId: args.branchId,
          severity: "info",
          metadata: { branchName: branch.name },
          timestamp: now,
          createdAt: now,
        });
      }
    } catch {}

    // Notification
    try {
      if (effectiveUserId) {
        await ctx.db.insert("notifications", {
          userId: effectiveUserId,
          type: "branch_deactivated",
          title: "Branch Deactivated",
          body: `Branch deactivated: ${branch.name}`,
          status: "UNREAD",
          severity: "INFO",
          channel: "IN_APP",
          data: { branchId: args.branchId },
          createdAt: now,
        });
      }
    } catch {}

    return {
      success: true,
      branchId: args.branchId,
    };
  },
});

/**
 * Query: Get full branch details with its operational settings
 */
export const getBranchSettings = query({
  args: {
    branchId: v.union(v.id("branches"), v.string()),
  },
  handler: async (ctx, args) => {
    let branch: any = null;
    try {
      branch = await ctx.db.get(args.branchId as any);
    } catch {}
    if (!branch) return null;

    const settings = await ctx.db
      .query("branchSettings")
      .withIndex("by_branch", (q) => q.eq("branchId", branch._id))
      .first();

    const defaultHours = {
      monday: { open: "08:00", close: "18:00", closed: false },
      tuesday: { open: "08:00", close: "18:00", closed: false },
      wednesday: { open: "08:00", close: "18:00", closed: false },
      thursday: { open: "08:00", close: "18:00", closed: false },
      friday: { open: "08:00", close: "18:00", closed: false },
      saturday: { open: "09:00", close: "17:00", closed: false },
      sunday: { open: "10:00", close: "16:00", closed: true },
    };

    return {
      branchId: branch._id,
      workspaceId: branch.workspaceId,
      organizationId: branch.organizationId,
      name: branch.name,
      code: branch.code || "",
      description: branch.description || "",
      logoUrl: branch.logoUrl || "",
      isPrimary: Boolean(branch.isPrimary),
      status: branch.status || "active",
      isActive: branch.isActive ?? true,
      // Contact
      phone: branch.phone || "",
      email: branch.email || "",
      managerId: branch.managerId,
      // Address
      country: branch.country || "Nigeria",
      state: branch.state || "",
      stateCode: branch.stateCode || "",
      lga: branch.lga || "",
      city: branch.city || "",
      street: branch.street || "",
      blockNumber: branch.blockNumber || "",
      area: branch.area || "",
      landmark: branch.landmark || "",
      postalCode: branch.postalCode || "",
      formattedAddress: branch.formattedAddress || branch.address || "",
      // Operational settings
      openingHours: settings?.openingHours || defaultHours,
      receiptFooter: settings?.receiptFooter || "",
      negativeStockAllowed: settings?.negativeStockAllowed ?? false,
      lowStockThreshold: settings?.lowStockThreshold ?? 10,
      createdAt: branch.createdAt,
      updatedAt: branch.updatedAt,
    };
  },
});

/**
 * Mutation: Update branch operational settings
 */
export const updateBranchSettings = mutation({
  args: {
    branchId: v.union(v.id("branches"), v.string()),
    openingHours: v.optional(v.any()),
    receiptFooter: v.optional(v.string()),
    negativeStockAllowed: v.optional(v.boolean()),
    lowStockThreshold: v.optional(v.number()),
    callerUserId: v.optional(v.union(v.id("users"), v.string())),
  },
  handler: async (ctx, args) => {
    let branch: any = null;
    try {
      branch = await ctx.db.get(args.branchId as any);
    } catch {}
    if (!branch) throw new Error("Branch not found");

    const now = Date.now();

    const existing = await ctx.db
      .query("branchSettings")
      .withIndex("by_branch", (q) => q.eq("branchId", branch._id))
      .first();

    const payload = {
      branchId: branch._id,
      workspaceId: branch.workspaceId || (branch.organizationId as any),
      openingHours: args.openingHours !== undefined ? args.openingHours : existing?.openingHours,
      receiptFooter: args.receiptFooter !== undefined ? args.receiptFooter : existing?.receiptFooter,
      negativeStockAllowed: args.negativeStockAllowed !== undefined ? args.negativeStockAllowed : existing?.negativeStockAllowed,
      lowStockThreshold: args.lowStockThreshold !== undefined ? args.lowStockThreshold : existing?.lowStockThreshold,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
    } else {
      await ctx.db.insert("branchSettings", {
        ...payload,
        createdAt: now,
      });
    }

    if (args.callerUserId && branch.workspaceId) {
      await ctx.db.insert("workspaceAuditLogs", {
        workspaceId: branch.workspaceId,
        branchId: branch._id,
        actorUserId: args.callerUserId as any,
        action: "branch.operational_updated",
        eventType: "branch.operational_updated",
        resourceType: "branch_settings",
        resourceId: branch._id,
        afterValues: payload,
        createdAt: now,
      });
    }

    return { success: true };
  },
});

/**
 * Mutation: Set a branch as primary branch
 */
export const setPrimaryBranch = mutation({
  args: {
    branchId: v.union(v.id("branches"), v.string()),
    callerUserId: v.optional(v.union(v.id("users"), v.string())),
  },
  handler: async (ctx, args) => {
    let branch: any = null;
    try {
      branch = await ctx.db.get(args.branchId as any);
    } catch {}
    if (!branch) throw new Error("Branch not found");

    const now = Date.now();

    // Query all sibling branches
    let siblings: any[] = [];
    if (branch.workspaceId) {
      siblings = await ctx.db
        .query("branches")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", branch.workspaceId!))
        .collect();
    } else if (branch.organizationId) {
      siblings = await ctx.db
        .query("branches")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", branch.organizationId!))
        .collect();
    }

    // Unset existing primary branches
    for (const b of siblings) {
      if (b.isPrimary && b._id !== branch._id) {
        await ctx.db.patch(b._id, { isPrimary: false, updatedAt: now });
      }
    }

    // Set target branch as primary
    await ctx.db.patch(branch._id, { isPrimary: true, updatedAt: now });

    if (args.callerUserId && branch.workspaceId) {
      await ctx.db.insert("workspaceAuditLogs", {
        workspaceId: branch.workspaceId,
        branchId: branch._id,
        actorUserId: args.callerUserId as any,
        action: "branch.set_primary",
        eventType: "branch.set_primary",
        resourceType: "branch",
        resourceId: branch._id,
        createdAt: now,
      });
    }

    return { success: true };
  },
});

/**
 * Mutation: Suspend a branch
 */
export const suspendBranch = mutation({
  args: {
    branchId: v.union(v.id("branches"), v.string()),
    callerUserId: v.optional(v.union(v.id("users"), v.string())),
  },
  handler: async (ctx, args) => {
    let branch: any = null;
    try {
      branch = await ctx.db.get(args.branchId as any);
    } catch {}
    if (!branch) throw new Error("Branch not found");

    const now = Date.now();
    await ctx.db.patch(branch._id, {
      status: "suspended",
      isActive: false,
      updatedAt: now,
    });

    if (args.callerUserId && branch.workspaceId) {
      await ctx.db.insert("workspaceAuditLogs", {
        workspaceId: branch.workspaceId,
        branchId: branch._id,
        actorUserId: args.callerUserId as any,
        action: "branch.suspended",
        eventType: "branch.suspended",
        resourceType: "branch",
        resourceId: branch._id,
        createdAt: now,
      });
    }

    return { success: true };
  },
});

/**
 * Mutation: Restore a suspended branch
 */
export const restoreBranch = mutation({
  args: {
    branchId: v.union(v.id("branches"), v.string()),
    callerUserId: v.optional(v.union(v.id("users"), v.string())),
  },
  handler: async (ctx, args) => {
    let branch: any = null;
    try {
      branch = await ctx.db.get(args.branchId as any);
    } catch {}
    if (!branch) throw new Error("Branch not found");

    const now = Date.now();
    await ctx.db.patch(branch._id, {
      status: "active",
      isActive: true,
      updatedAt: now,
    });

    if (args.callerUserId && branch.workspaceId) {
      await ctx.db.insert("workspaceAuditLogs", {
        workspaceId: branch.workspaceId,
        branchId: branch._id,
        actorUserId: args.callerUserId as any,
        action: "branch.restored",
        eventType: "branch.restored",
        resourceType: "branch",
        resourceId: branch._id,
        createdAt: now,
      });
    }

    return { success: true };
  },
});

/**
 * Mutation: Archive branch (preserves historical data, verifies at least one branch remains)
 */
export const archiveBranch = mutation({
  args: {
    branchId: v.union(v.id("branches"), v.string()),
    callerUserId: v.optional(v.union(v.id("users"), v.string())),
  },
  handler: async (ctx, args) => {
    let branch: any = null;
    try {
      branch = await ctx.db.get(args.branchId as any);
    } catch {}
    if (!branch) throw new Error("Branch not found");

    const now = Date.now();

    // Check sibling active branches
    let siblings: any[] = [];
    if (branch.workspaceId) {
      siblings = await ctx.db
        .query("branches")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", branch.workspaceId!))
        .collect();
    } else if (branch.organizationId) {
      siblings = await ctx.db
        .query("branches")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", branch.organizationId!))
        .collect();
    }

    const activeSiblings = siblings.filter(
      (b) => b._id !== branch._id && b.status !== "archived" && b.status !== "deleted"
    );

    if (activeSiblings.length === 0) {
      throw new Error("Cannot archive the only active branch. Organizations must maintain at least one active branch.");
    }

    // If primary, transfer primary status to the first available active sibling
    if (branch.isPrimary && activeSiblings[0]) {
      await ctx.db.patch(activeSiblings[0]._id, {
        isPrimary: true,
        updatedAt: now,
      });
    }

    await ctx.db.patch(branch._id, {
      status: "archived",
      isActive: false,
      isPrimary: false,
      deletedAt: now,
      updatedAt: now,
    });

    if (args.callerUserId && branch.workspaceId) {
      await ctx.db.insert("workspaceAuditLogs", {
        workspaceId: branch.workspaceId,
        branchId: branch._id,
        actorUserId: args.callerUserId as any,
        action: "branch.archived",
        eventType: "branch.archived",
        resourceType: "branch",
        resourceId: branch._id,
        createdAt: now,
      });
    }

    return { success: true };
  },
});

export const getBranchesForApplication = getBranchesForOrgApp;
export const update = updateBranch;
export const create = createBranch;


