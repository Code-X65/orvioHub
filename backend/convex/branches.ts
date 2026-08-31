import { mutation, query } from "./_generated/server.js";
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
    workspaceId: v.id("workspaces"),
    name: v.string(),
    code: v.optional(v.string()),
    isPrimary: v.optional(v.boolean()),
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

    // Check existing branches for this workspace
    const existingBranches = await ctx.db
      .query("branches")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const activeExisting = existingBranches.filter(
      (b) => b.status !== "deleted" && b.status !== "archived"
    );

    // Auto-generate code if missing
    let code = args.code?.trim().toUpperCase();
    if (!code) {
      code = args.name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4) || "BR01";
    }

    // Check code uniqueness within workspace
    const duplicateCode = activeExisting.find((b) => b.code?.toUpperCase() === code);
    if (duplicateCode) {
      throw new Error(`Branch code '${code}' already exists in this workspace.`);
    }

    // Determine primary status
    const shouldBePrimary = args.isPrimary !== undefined ? args.isPrimary : activeExisting.length === 0;

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
      workspaceId: args.workspaceId,
      name: args.name.trim(),
      code,
      isPrimary: shouldBePrimary,
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

    if (args.callerUserId) {
      await ctx.db.insert("workspaceAuditLogs", {
        workspaceId: args.workspaceId,
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

    if (args.callerUserId) {
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

export const update = updateBranch;
export const create = createBranch;
