import { mutation, query } from "./_generated/server.js";
import { Id } from "./_generated/dataModel.js";
import { v } from "convex/values";
import { resolveOrganization } from "./applications.js";

function normalizePhone(phone?: string | null): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return undefined;
  if (digits.startsWith("234") && digits.length === 13) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 11) return `+234${digits.slice(1)}`;
  if (digits.length === 10) return `+234${digits}`;
  return phone.startsWith("+") ? phone : `+${digits}`;
}

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
      phoneNormalized: args.phoneNormalized || normalizePhone(args.phone),
      phoneVerified: false,
      phoneStatus: args.phone ? "pending" : "unverified",
      email: args.email,
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
  args: { workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()) },
  handler: async (ctx, args) => {
    let resolvedWsId: Id<"workspaces"> | undefined = undefined;
    const directWs = ctx.db.normalizeId("workspaces", args.workspaceId);
    if (directWs) {
      resolvedWsId = directWs;
    } else {
      const orgId = ctx.db.normalizeId("organizations", args.workspaceId);
      if (orgId) {
        const ws = await ctx.db
          .query("workspaces")
          .withIndex("by_organizationId", (q) => q.eq("organizationId", orgId))
          .first();
        if (ws) resolvedWsId = ws._id;
      }
    }

    let branches: any[] = [];
    if (resolvedWsId) {
      branches = await ctx.db
        .query("branches")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", resolvedWsId!))
        .collect();
    }

    const orgId = ctx.db.normalizeId("organizations", args.workspaceId);
    if (orgId) {
      const orgBranches = await ctx.db
        .query("branches")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", orgId))
        .collect();
      for (const ob of orgBranches) {
        if (!branches.some((b) => b._id === ob._id)) {
          branches.push(ob);
        }
      }
    }
    
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

    const branchMap = new Map<string, any>();

    if (resolvedOrgId) {
      const orgBranches = await ctx.db
        .query("branches")
        .withIndex("by_organizationId", (q) =>
          q.eq("organizationId", resolvedOrgId!)
        )
        .collect();
      for (const b of orgBranches) {
        branchMap.set(String(b._id), b);
      }

      const orgWorkspaces = await ctx.db
        .query("workspaces")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", resolvedOrgId!))
        .collect();
      for (const w of orgWorkspaces) {
        const wsBranches = await ctx.db
          .query("branches")
          .withIndex("by_workspace", (q) => q.eq("workspaceId", w._id))
          .collect();
        for (const b of wsBranches) {
          branchMap.set(String(b._id), b);
        }
      }
    }

    if (resolvedWsId) {
      const wsBranches = await ctx.db
        .query("branches")
        .withIndex("by_workspace", (q) =>
          q.eq("workspaceId", resolvedWsId!)
        )
        .collect();
      for (const b of wsBranches) {
        branchMap.set(String(b._id), b);
      }
    }

    let branches = Array.from(branchMap.values());

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
    let resolvedWsId: Id<"workspaces"> | undefined = undefined;

    const directOrg = ctx.db.normalizeId("organizations", args.organizationId);
    if (directOrg) {
      resolvedOrgId = directOrg;
    } else {
      const wsId = ctx.db.normalizeId("workspaces", args.organizationId);
      if (wsId) {
        resolvedWsId = wsId;
        const ws = await ctx.db.get(wsId);
        if (ws?.organizationId) resolvedOrgId = ws.organizationId;
      }
    }

    if (!resolvedOrgId && !resolvedWsId) return [];

    let resolvedAppId = args.applicationId;
    const appKey = (args.applicationKey || "inventory").toLowerCase();
    if (!resolvedAppId) {
      const app = await ctx.db
        .query("applications")
        .withIndex("by_key", (q: any) => q.eq("key", appKey))
        .first();
      if (app) resolvedAppId = app._id;
    }

    const branchMap = new Map<string, any>();

    // 1. Direct query by (organizationId, applicationId)
    if (resolvedOrgId && resolvedAppId) {
      const orgAppBranches = await ctx.db
        .query("branches")
        .withIndex("by_org_and_app", (q: any) =>
          q.eq("organizationId", resolvedOrgId!).eq("applicationId", resolvedAppId!)
        )
        .collect();
      for (const b of orgAppBranches) {
        branchMap.set(String(b._id), b);
      }
    }

    // 2. Query by organizationId
    if (resolvedOrgId) {
      const orgBranches = await ctx.db
        .query("branches")
        .withIndex("by_organizationId", (q: any) =>
          q.eq("organizationId", resolvedOrgId!)
        )
        .collect();
      for (const b of orgBranches) {
        if (!branchMap.has(String(b._id))) {
          if (
            !b.applicationId ||
            !resolvedAppId ||
            b.applicationId === resolvedAppId ||
            !b.productKey ||
            b.productKey.toLowerCase() === appKey
          ) {
            branchMap.set(String(b._id), b);
          }
        }
      }
    }

    // 3. Query all workspaces for this organization or the direct workspace
    const workspaceIds = new Set<string>();
    if (resolvedWsId) workspaceIds.add(String(resolvedWsId));
    if (resolvedOrgId) {
      const orgWorkspaces = await ctx.db
        .query("workspaces")
        .withIndex("by_organizationId", (q: any) => q.eq("organizationId", resolvedOrgId!))
        .collect();
      for (const w of orgWorkspaces) {
        workspaceIds.add(String(w._id));
      }
    }

    for (const wid of workspaceIds) {
      const normWid = ctx.db.normalizeId("workspaces", wid);
      if (normWid) {
        const wsBranches = await ctx.db
          .query("branches")
          .withIndex("by_workspace", (q: any) => q.eq("workspaceId", normWid))
          .collect();
        for (const b of wsBranches) {
          if (!branchMap.has(String(b._id))) {
            if (
              !b.applicationId ||
              !resolvedAppId ||
              b.applicationId === resolvedAppId ||
              !b.productKey ||
              b.productKey.toLowerCase() === appKey
            ) {
              branchMap.set(String(b._id), b);
            }
          }
        }
      }
    }

    const allBranches = Array.from(branchMap.values());
    const active = allBranches.filter(
      (b) =>
        b.status !== "deleted" &&
        b.status !== "archived" &&
        b.status !== "inactive" &&
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
    const isOrgPhoneVerified = Boolean(org.phoneVerifiedAt || org.phoneStatus === "verified");
    const phoneVerified = Boolean(phone && phone === org.phone && isOrgPhoneVerified);
    const phoneStatus = phoneVerified ? "verified" : (phone ? "pending" : "unverified");

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
      phoneNormalized: normalizePhone(phone),
      phoneVerified,
      phoneVerifiedAt: phoneVerified ? (org.phoneVerifiedAt || now) : undefined,
      phoneStatus,
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
    workspaceId: v.union(v.id("workspaces"), v.id("organizations"), v.string()),
    userId: v.id("users"),
    productKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let resolvedWsId: Id<"workspaces"> | undefined = undefined;
    let resolvedOrgId: Id<"organizations"> | undefined = undefined;

    const directWs = ctx.db.normalizeId("workspaces", args.workspaceId);
    if (directWs) {
      resolvedWsId = directWs;
      const ws = await ctx.db.get(directWs);
      if (ws?.organizationId) resolvedOrgId = ws.organizationId;
    } else {
      const orgId = ctx.db.normalizeId("organizations", args.workspaceId);
      if (orgId) {
        resolvedOrgId = orgId;
        const ws = await ctx.db
          .query("workspaces")
          .withIndex("by_organizationId", (q) => q.eq("organizationId", orgId))
          .first();
        if (ws) resolvedWsId = ws._id;
      }
    }

    if (!resolvedWsId && !resolvedOrgId) return [];

    let isOwnerOrAdmin = false;

    if (resolvedWsId) {
      const membership = await ctx.db
        .query("workspaceMemberships")
        .withIndex("by_workspace_user", (q) =>
          q.eq("workspaceId", resolvedWsId!).eq("userId", args.userId)
        )
        .first();

      if (membership && membership.status.toLowerCase() === "active") {
        const role = (membership.role || membership.defaultRole || "member").toLowerCase();
        if (role === "owner" || role === "admin") {
          isOwnerOrAdmin = true;
        }
      }
    }

    if (!isOwnerOrAdmin && resolvedOrgId) {
      const orgMem = await ctx.db
        .query("organizationMemberships")
        .withIndex("by_org_and_user", (q) =>
          q.eq("organizationId", resolvedOrgId!).eq("userId", args.userId)
        )
        .first();

      if (orgMem && (orgMem.status as string) === "ACTIVE") {
        const orgRole = (orgMem.role || "MEMBER").toUpperCase();
        if (orgRole === "OWNER" || orgRole === "ADMIN") {
          isOwnerOrAdmin = true;
        }
      }
    }

    const branchMap = new Map<string, any>();
    if (resolvedWsId) {
      const allWsBranches = await ctx.db
        .query("branches")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", resolvedWsId!))
        .collect();
      for (const b of allWsBranches) {
        branchMap.set(String(b._id), b);
      }
    }

    if (resolvedOrgId) {
      const allOrgBranches = await ctx.db
        .query("branches")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", resolvedOrgId!))
        .collect();
      for (const b of allOrgBranches) {
        branchMap.set(String(b._id), b);
      }
    }

    const activeBranches = Array.from(branchMap.values()).filter(
      (b) => b.status !== "deleted" && b.status !== "archived" && b.isActive !== false
    );

    const sortFn = (a: any, b: any) => {
      if (a.isPrimary && !b.isPrimary) return -1;
      if (!a.isPrimary && b.isPrimary) return 1;
      return a.name.localeCompare(b.name);
    };

    return activeBranches.sort(sortFn);
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
        patch.phoneStatus = 'unverified';
        patch.verificationCode = undefined;
        patch.codeExpiresAt = undefined;
      }
    }

    if (args.email !== undefined) patch.email = args.email;
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

export function getDefaultBranchPermissions(role: string | undefined): string[] {
  switch ((role || "").toLowerCase()) {
    case "owner":
    case "admin":
    case "inventory_owner":
      return ["*"];
    case "inventory_manager":
    case "manager":
    case "branch_manager":
      return ["branch.view", "branch.update", "branch.set_primary", "branch.suspend", "branch.restore", "branch.archive"];
    case "member":
    case "viewer":
    case "sales_attendant":
    case "cashier":
    case "stock_manager":
      return ["branch.view"];
    default:
      return [];
  }
}

async function assertBranchAccess(
  ctx: any,
  branch: any,
  callerUserId?: string,
  requiredPermission?: string,
  expectedWorkspaceId?: string
) {
  if (!branch) {
    throw new Error("BRANCH_NOT_FOUND");
  }
  if (!callerUserId) {
    throw new Error("AUTHENTICATION_REQUIRED");
  }

  // Cross-tenant verification
  if (expectedWorkspaceId) {
    const wsIdStr = String(expectedWorkspaceId);
    const branchWsStr = branch.workspaceId ? String(branch.workspaceId) : undefined;
    const branchOrgStr = branch.organizationId ? String(branch.organizationId) : undefined;

    let matches = false;
    if (branchWsStr && (branchWsStr === wsIdStr)) matches = true;
    if (branchOrgStr && (branchOrgStr === wsIdStr)) matches = true;

    if (!matches) {
      try {
        const { org, orgId, workspace, workspaceId } = await resolveOrganization(ctx, expectedWorkspaceId);
        if (orgId && (branchOrgStr === String(orgId) || branchWsStr === String(orgId))) matches = true;
        if (workspaceId && (branchWsStr === String(workspaceId) || branchOrgStr === String(workspaceId))) matches = true;
        if (org && (branchOrgStr === String(org._id) || branchWsStr === String(org._id))) matches = true;
        if (workspace && (branchWsStr === String(workspace._id) || branchOrgStr === String(workspace._id))) matches = true;
      } catch {}
    }

    if (!matches && (branchWsStr || branchOrgStr)) {
      throw new Error("BRANCH_NOT_FOUND");
    }
  }

  const userId = ctx.db.normalizeId("users", callerUserId);
  const userDoc = userId ? await ctx.db.get(userId) : null;
  if (!userDoc || userDoc.status === "suspended" || userDoc.status === "deleted") {
    throw new Error("USER_SUSPENDED_OR_DELETED");
  }

  let isMember = false;
  let isOwnerOrAdmin = false;
  let membershipRole = "";

  if (branch.workspaceId) {
    const workspace = await ctx.db.get(branch.workspaceId);
    if (workspace && String(workspace.ownerId) === String(callerUserId)) {
      isMember = true;
      isOwnerOrAdmin = true;
      membershipRole = "owner";
    }

    const workspaceMembership = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_workspace_user", (q: any) =>
        q.eq("workspaceId", branch.workspaceId).eq("userId", userId)
      )
      .first();
    if (workspaceMembership && String(workspaceMembership.status).toLowerCase() === "active") {
      isMember = true;
      membershipRole = String(workspaceMembership.role || workspaceMembership.defaultRole || "member").toLowerCase();
      isOwnerOrAdmin ||= membershipRole === "owner" || membershipRole === "admin";
    }
  }

  if (branch.organizationId) {
    const organization = await ctx.db.get(branch.organizationId);
    if (organization && String(organization.ownerId) === String(callerUserId)) {
      isMember = true;
      isOwnerOrAdmin = true;
      membershipRole = "owner";
    }

    const organizationMembership = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_org_and_user", (q: any) =>
        q.eq("organizationId", branch.organizationId).eq("userId", userId)
      )
      .first();
    if (organizationMembership && String(organizationMembership.status).toLowerCase() === "active") {
      isMember = true;
      membershipRole ||= String(organizationMembership.role || "member").toLowerCase();
      const role = String(organizationMembership.role || "member").toLowerCase();
      isOwnerOrAdmin ||= role === "owner" || role === "admin";
    }
  }

  if (!isMember) throw new Error("ORGANIZATION_ACCESS_DENIED");
  if (isOwnerOrAdmin) return;

  let permissions = getDefaultBranchPermissions(membershipRole);
  let branchIds: string[] | undefined;
  if (branch.workspaceId) {
    const productMembership = await ctx.db
      .query("productMemberships")
      .withIndex("by_workspace_product_user", (q: any) =>
        q.eq("workspaceId", branch.workspaceId).eq("productKey", branch.productKey || "inventory").eq("userId", userId)
      )
      .first();

    if (productMembership) {
      if (String(productMembership.status).toLowerCase() !== "active") {
        throw new Error("PRODUCT_ACCESS_DENIED");
      }
      permissions = productMembership.permissions?.length
        ? productMembership.permissions
        : getDefaultBranchPermissions(productMembership.role || membershipRole);
      branchIds = productMembership.branchIds?.map((id: any) => String(id));
    }
  }

  if (branchIds && branchIds.length > 0 && !branchIds.includes(String(branch._id))) {
    throw new Error("BRANCH_ACCESS_DENIED");
  }
  if (!requiredPermission || (!permissions.includes("*") && !permissions.includes(requiredPermission))) {
    throw new Error("BRANCH_PERMISSION_DENIED");
  }
}

/**
 * Query: Get full branch details with its operational settings
 */
export const getBranchSettings = query({
  args: {
    branchId: v.union(v.id("branches"), v.string()),
    callerUserId: v.optional(v.union(v.id("users"), v.string())),
    workspaceId: v.optional(v.union(v.id("workspaces"), v.id("organizations"), v.string())),
  },
  handler: async (ctx, args) => {
    let branch: any = null;
    try {
      branch = await ctx.db.get(args.branchId as any);
    } catch {}
    if (!branch && typeof args.branchId === "string") {
      const bId = ctx.db.normalizeId("branches", args.branchId);
      if (bId) {
        try {
          branch = await ctx.db.get(bId);
        } catch {}
      }
    }
    if (!branch || branch.status === "deleted" || branch.deletedAt) return null;

    if (args.callerUserId || args.workspaceId) {
      await assertBranchAccess(ctx, branch, args.callerUserId as any, "branch.view", args.workspaceId as any);
    }

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

    // If branch-specific settings don't exist yet, check applicationSettings for inheritance
    let inheritedReceipt: any = null;
    let inheritedStock: any = null;
    if (!settings && (branch.workspaceId || branch.organizationId)) {
      const appSettingsDoc = await ctx.db
        .query("applicationSettings")
        .withIndex("by_workspace_product", (q) =>
          q.eq("workspaceId", (branch.workspaceId || branch.organizationId) as any).eq("productKey", "inventory")
        )
        .first();
      if (appSettingsDoc?.settings) {
        inheritedReceipt = appSettingsDoc.settings.receiptSettings;
        inheritedStock = appSettingsDoc.settings.stockRules;
      }
    }

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
      isActive: branch.isActive ?? (branch.status === "active"),
      // Contact
      phone: branch.phone || "",
      email: branch.email || "",
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
      // POS & Receipts (Per-Location)
      receiptFooter: settings?.receiptFooter ?? inheritedReceipt?.footerMessage ?? "",
      paperWidth: settings?.paperWidth ?? inheritedReceipt?.paperWidth ?? "80mm",
      tin: settings?.tin ?? inheritedReceipt?.tin ?? "",
      vatRate: settings?.vatRate ?? inheritedReceipt?.vatRate ?? 7.5,
      enableVat: settings?.enableVat ?? inheritedReceipt?.enableVat ?? false,
      showCashier: settings?.showCashier ?? inheritedReceipt?.showCashier ?? true,
      showCustomer: settings?.showCustomer ?? inheritedReceipt?.showCustomer ?? true,
      showBarcode: settings?.showBarcode ?? inheritedReceipt?.showBarcode ?? true,
      headerText: settings?.headerText ?? inheritedReceipt?.headerText ?? "Welcome to our store",
      footerMessage: settings?.footerMessage ?? inheritedReceipt?.footerMessage ?? "Thank you for your patronage! Please keep this receipt.",
      returnPolicy: settings?.returnPolicy ?? inheritedReceipt?.returnPolicy ?? "Goods in original condition may be returned within 7 days.",
      receiptPrefix: settings?.receiptPrefix ?? inheritedReceipt?.receiptPrefix ?? "INV-",
      tagline: settings?.tagline ?? inheritedReceipt?.tagline ?? "Quality goods & exceptional service",
      // Inventory Rules (Per-Location)
      negativeStockAllowed: settings?.negativeStockAllowed ?? inheritedStock?.negativeStockAllowed ?? false,
      lowStockThreshold: settings?.lowStockThreshold ?? inheritedStock?.lowStockThreshold ?? 10,
      stockAdjustmentApprovalRequired: settings?.stockAdjustmentApprovalRequired ?? inheritedStock?.stockAdjustmentApprovalRequired ?? false,
      discrepancyApprovalThreshold: settings?.discrepancyApprovalThreshold ?? 0,
      enforceStockCountApproval: settings?.enforceStockCountApproval ?? false,
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
    // POS & Receipts (Per-Location)
    receiptFooter: v.optional(v.string()),
    paperWidth: v.optional(v.string()),
    tin: v.optional(v.string()),
    vatRate: v.optional(v.number()),
    enableVat: v.optional(v.boolean()),
    showCashier: v.optional(v.boolean()),
    showCustomer: v.optional(v.boolean()),
    showBarcode: v.optional(v.boolean()),
    headerText: v.optional(v.string()),
    footerMessage: v.optional(v.string()),
    returnPolicy: v.optional(v.string()),
    receiptPrefix: v.optional(v.string()),
    tagline: v.optional(v.string()),
    // Inventory Rules (Per-Location)
    negativeStockAllowed: v.optional(v.boolean()),
    lowStockThreshold: v.optional(v.number()),
    stockAdjustmentApprovalRequired: v.optional(v.boolean()),
    discrepancyApprovalThreshold: v.optional(v.number()),
    enforceStockCountApproval: v.optional(v.boolean()),
    callerUserId: v.optional(v.union(v.id("users"), v.string())),
    workspaceId: v.optional(v.union(v.id("workspaces"), v.id("organizations"), v.string())),
  },
  handler: async (ctx, args) => {
    let branch: any = null;
    try {
      branch = await ctx.db.get(args.branchId as any);
    } catch {}
    if (!branch && typeof args.branchId === "string") {
      const bId = ctx.db.normalizeId("branches", args.branchId);
      if (bId) {
        try {
          branch = await ctx.db.get(bId);
        } catch {}
      }
    }
    if (!branch || branch.status === "deleted" || branch.deletedAt) {
      throw new Error("BRANCH_NOT_FOUND");
    }

    await assertBranchAccess(ctx, branch, args.callerUserId as any, "branch.update", args.workspaceId as any);

    if (branch.status === "archived") {
      throw new Error("BRANCH_NOT_ACTIVE");
    }

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
      paperWidth: args.paperWidth !== undefined ? args.paperWidth : existing?.paperWidth,
      tin: args.tin !== undefined ? args.tin : existing?.tin,
      vatRate: args.vatRate !== undefined ? args.vatRate : existing?.vatRate,
      enableVat: args.enableVat !== undefined ? args.enableVat : existing?.enableVat,
      showCashier: args.showCashier !== undefined ? args.showCashier : existing?.showCashier,
      showCustomer: args.showCustomer !== undefined ? args.showCustomer : existing?.showCustomer,
      showBarcode: args.showBarcode !== undefined ? args.showBarcode : existing?.showBarcode,
      headerText: args.headerText !== undefined ? args.headerText : existing?.headerText,
      footerMessage: args.footerMessage !== undefined ? args.footerMessage : existing?.footerMessage,
      returnPolicy: args.returnPolicy !== undefined ? args.returnPolicy : existing?.returnPolicy,
      receiptPrefix: args.receiptPrefix !== undefined ? args.receiptPrefix : existing?.receiptPrefix,
      tagline: args.tagline !== undefined ? args.tagline : existing?.tagline,
      negativeStockAllowed: args.negativeStockAllowed !== undefined ? args.negativeStockAllowed : existing?.negativeStockAllowed,
      lowStockThreshold: args.lowStockThreshold !== undefined ? args.lowStockThreshold : existing?.lowStockThreshold,
      stockAdjustmentApprovalRequired: args.stockAdjustmentApprovalRequired !== undefined ? args.stockAdjustmentApprovalRequired : existing?.stockAdjustmentApprovalRequired,
      discrepancyApprovalThreshold: args.discrepancyApprovalThreshold !== undefined ? args.discrepancyApprovalThreshold : existing?.discrepancyApprovalThreshold,
      enforceStockCountApproval: args.enforceStockCountApproval !== undefined ? args.enforceStockCountApproval : existing?.enforceStockCountApproval,
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
        action: "branch.updated",
        eventType: "branch.updated",
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
    workspaceId: v.optional(v.union(v.id("workspaces"), v.id("organizations"), v.string())),
  },
  handler: async (ctx, args) => {
    let branch: any = null;
    try {
      branch = await ctx.db.get(args.branchId as any);
    } catch {}
    if (!branch || branch.status === "deleted" || branch.deletedAt) {
      throw new Error("BRANCH_NOT_FOUND");
    }

    await assertBranchAccess(ctx, branch, args.callerUserId as any, "branch.set_primary", args.workspaceId as any);

    if (branch.status === "suspended" || branch.status === "archived") {
      throw new Error("Only active branches can be set as primary.");
    }

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

    // Unset existing primary branches atomically
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
    workspaceId: v.optional(v.union(v.id("workspaces"), v.id("organizations"), v.string())),
  },
  handler: async (ctx, args) => {
    let branch: any = null;
    try {
      branch = await ctx.db.get(args.branchId as any);
    } catch {}
    if (!branch || branch.status === "deleted" || branch.deletedAt) {
      throw new Error("BRANCH_NOT_FOUND");
    }

    await assertBranchAccess(ctx, branch, args.callerUserId as any, "branch.suspend", args.workspaceId as any);

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
      (b) => b._id !== branch._id && b.status !== "archived" && b.status !== "suspended" && b.status !== "deleted"
    );

    if (branch.isPrimary && activeSiblings.length === 0) {
      throw new Error("Cannot suspend the only active primary branch.");
    }

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
    workspaceId: v.optional(v.union(v.id("workspaces"), v.id("organizations"), v.string())),
  },
  handler: async (ctx, args) => {
    let branch: any = null;
    try {
      branch = await ctx.db.get(args.branchId as any);
    } catch {}
    if (!branch || branch.status === "deleted" || branch.deletedAt) {
      throw new Error("BRANCH_NOT_FOUND");
    }

    await assertBranchAccess(ctx, branch, args.callerUserId as any, "branch.restore", args.workspaceId as any);

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
    workspaceId: v.optional(v.union(v.id("workspaces"), v.id("organizations"), v.string())),
  },
  handler: async (ctx, args) => {
    let branch: any = null;
    try {
      branch = await ctx.db.get(args.branchId as any);
    } catch {}
    if (!branch || branch.status === "deleted" || branch.deletedAt) {
      throw new Error("BRANCH_NOT_FOUND");
    }

    await assertBranchAccess(ctx, branch, args.callerUserId as any, "branch.archive", args.workspaceId as any);

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
