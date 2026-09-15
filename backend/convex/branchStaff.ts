import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { resolveOrganization } from "./applications";

// Role-to-Permissions Mapping for Inventory
export const INVENTORY_ROLE_PERMISSIONS: Record<string, string[]> = {
  inventory_owner: [
    "view_inventory",
    "manage_products",
    "receive_purchases",
    "adjust_stock",
    "record_sales",
    "cancel_sales",
    "process_returns",
    "view_cost_prices",
    "view_profits",
    "view_reports",
    "export_data",
    "manage_members",
    "manage_branches",
    "manage_settings",
  ],
  inventory_manager: [
    "view_inventory",
    "manage_products",
    "receive_purchases",
    "adjust_stock",
    "record_sales",
    "process_returns",
    "view_reports",
    "manage_branch_members",
  ],
  cashier: [
    "view_products",
    "view_selling_prices",
    "record_sales",
    "process_payments",
    "issue_receipts",
    "view_own_sales",
  ],
  sales_attendant: [
    "view_products",
    "view_selling_prices",
    "record_sales",
    "process_payments",
    "issue_receipts",
    "view_own_sales",
  ],
  stock_manager: [
    "view_products",
    "view_stock",
    "receive_purchases",
    "stock_counts",
    "adjust_stock",
    "view_stock_history",
  ],
  accountant: [
    "view_sales",
    "view_purchases",
    "view_payments",
    "view_customer_balances",
    "view_supplier_balances",
    "view_reports",
    "export_reports",
  ],
  inventory_viewer: [
    "view_products",
    "view_stock",
    "view_reports",
  ],
};

/**
 * List team members for a workspace application (optionally filtered by branch and status)
 */
export const listBranchMembers = query({
  args: {
    workspaceId: v.string(),
    applicationKey: v.optional(v.string()),
    branchId: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const appKey = args.applicationKey || "inventory";

    // 1. Resolve workspace / organization context
    const { org, orgId, workspace, workspaceId } = await resolveOrganization(ctx, args.workspaceId);

    // 2. Query explicit branchMemberships
    let explicitMemberships: any[] = [];
    const queriedWsIds = new Set<string>();

    const tryAddExplicit = async (wsIdKey: string) => {
      if (!wsIdKey || queriedWsIds.has(wsIdKey)) return;
      queriedWsIds.add(wsIdKey);
      try {
        const res = await ctx.db
          .query("branchMemberships")
          .withIndex("by_workspace_application", (q: any) =>
            q.eq("workspaceId", wsIdKey).eq("applicationKey", appKey)
          )
          .collect();
        explicitMemberships.push(...res);
      } catch {}
    };

    await tryAddExplicit(args.workspaceId);
    if (workspaceId) await tryAddExplicit(String(workspaceId));
    if (orgId) await tryAddExplicit(String(orgId));

    if (orgId) {
      try {
        const orgBranchMems = await ctx.db
          .query("branchMemberships")
          .filter((q: any) => q.eq(q.field("organizationId"), orgId))
          .collect();
        explicitMemberships.push(...orgBranchMems);
      } catch {}
    }

    // Deduplicate explicit memberships by _id
    const seenMembershipIds = new Set<string>();
    const uniqueExplicit = explicitMemberships.filter((m) => {
      if (seenMembershipIds.has(m._id)) return false;
      seenMembershipIds.add(m._id);
      return true;
    });

    // 3. Find all branches for this organization/workspace
    let rawBranches: any[] = [];
    if (orgId) {
      try {
        const bList = await ctx.db
          .query("branches")
          .withIndex("by_organizationId", (q: any) => q.eq("organizationId", orgId))
          .collect();
        rawBranches.push(...bList);
      } catch {}
    }

    const targetWsId = workspaceId || ctx.db.normalizeId("workspaces", args.workspaceId);
    if (targetWsId) {
      try {
        const wsBList = await ctx.db
          .query("branches")
          .withIndex("by_workspace", (q: any) => q.eq("workspaceId", targetWsId))
          .collect();
        rawBranches.push(...wsBList);
      } catch {}
    }

    if (args.branchId) {
      try {
        const b = await ctx.db.get(args.branchId as any);
        if (b) rawBranches.push(b);
      } catch {}
    }

    // Deduplicate branches by _id
    const seenBranchIds = new Set<string>();
    const branches = rawBranches.filter((b) => {
      if (seenBranchIds.has(b._id)) return false;
      seenBranchIds.add(b._id);
      return true;
    });

    const activeBranches = branches.filter((b) => b.status !== "ARCHIVED" && b.status !== "deleted");
    const primaryBranch = activeBranches.find((b) => b.isPrimary) || activeBranches[0] || null;

    // Track user IDs that already have a branch membership in this result
    const userBranchKeys = new Set<string>();
    uniqueExplicit.forEach((m) => {
      userBranchKeys.add(`${m.userId}_${m.branchId}`);
    });

    // 4. Fetch Organization Members, Workspace Members, and Owners
    const synthesizedMemberships: any[] = [];
    const rawMemberList: Array<{
      id?: string;
      userId: any;
      role: string;
      status: string;
      allowedBranches?: any[];
      primaryBranchId?: any;
      branchIds?: any[];
      joinedAt?: number;
      createdAt?: number;
      updatedAt?: number;
      source: string;
    }> = [];

    // 4a. Organization Memberships
    if (orgId) {
      try {
        const orgMembers = await ctx.db
          .query("organizationMemberships")
          .withIndex("by_organizationId", (q: any) => q.eq("organizationId", orgId))
          .collect();
        for (const om of orgMembers) {
          rawMemberList.push({
            id: om._id,
            userId: om.userId,
            role: om.role,
            status: om.status,
            allowedBranches: om.allowedBranches,
            primaryBranchId: om.primaryBranchId,
            joinedAt: om.joinedAt,
            updatedAt: om.updatedAt,
            source: "organizationMemberships",
          });
        }
      } catch {}
    }

    // 4b. Workspace Memberships
    if (targetWsId) {
      try {
        const wsMembers = await ctx.db
          .query("workspaceMemberships")
          .withIndex("by_workspace", (q: any) => q.eq("workspaceId", targetWsId))
          .collect();
        for (const wm of wsMembers) {
          rawMemberList.push({
            id: wm._id,
            userId: wm.userId,
            role: wm.role || wm.defaultRole || "staff",
            status: wm.status,
            joinedAt: wm.acceptedAt || wm.createdAt,
            createdAt: wm.createdAt,
            updatedAt: wm.updatedAt,
            source: "workspaceMemberships",
          });
        }
      } catch {}
    }

    // 4c. Org Owner & Workspace Owner
    if (org?.ownerId) {
      rawMemberList.push({
        userId: org.ownerId,
        role: "OWNER",
        status: "ACTIVE",
        joinedAt: org.createdAt,
        source: "orgOwner",
      });
    }
    if (workspace?.ownerId && workspace.ownerId !== org?.ownerId) {
      rawMemberList.push({
        userId: workspace.ownerId,
        role: "OWNER",
        status: "ACTIVE",
        joinedAt: workspace.createdAt,
        source: "workspaceOwner",
      });
    }

    // Deduplicate rawMemberList by userId + role
    const seenUserIds = new Set<string>();
    const uniqueRawMembers = rawMemberList.filter((m) => {
      const isAct = (m.status || "").toUpperCase() === "ACTIVE";
      if (!isAct) return false;
      const key = `${m.userId}_${m.role}`;
      if (seenUserIds.has(key)) return false;
      seenUserIds.add(key);
      return true;
    });

    for (const om of uniqueRawMembers) {
      let mappedRole = "inventory_viewer";
      const roleUpper = (om.role || "").toUpperCase();
      if (roleUpper === "OWNER" || roleUpper === "WORKSPACE_OWNER" || roleUpper === "ORG_OWNER") {
        mappedRole = "inventory_owner";
      } else if (
        roleUpper === "ADMIN" ||
        roleUpper === "MANAGER" ||
        roleUpper === "WORKSPACE_ADMIN" ||
        roleUpper === "ORG_ADMIN"
      ) {
        mappedRole = "inventory_manager";
      } else if (roleUpper === "CASHIER" || roleUpper === "SALES_ATTENDANT") {
        mappedRole = "cashier";
      } else if (roleUpper === "STOCK_MANAGER") {
        mappedRole = "stock_manager";
      } else if (roleUpper === "ACCOUNTANT") {
        mappedRole = "accountant";
      } else if (roleUpper === "INVENTORY_OWNER") {
        mappedRole = "inventory_owner";
      } else if (roleUpper === "INVENTORY_MANAGER") {
        mappedRole = "inventory_manager";
      }

      const targetBranches: any[] = [];
      if (om.allowedBranches && om.allowedBranches.length > 0) {
        om.allowedBranches.forEach((bId: any) => {
          const match = activeBranches.find((b) => b._id === bId || String(b._id) === String(bId));
          if (match) targetBranches.push(match);
        });
      }
      if (targetBranches.length === 0 && om.primaryBranchId) {
        const match = activeBranches.find((b) => b._id === om.primaryBranchId || String(b._id) === String(om.primaryBranchId));
        if (match) targetBranches.push(match);
      }
      if (targetBranches.length === 0 && om.branchIds && om.branchIds.length > 0) {
        om.branchIds.forEach((bId: any) => {
          const match = activeBranches.find((b) => b._id === bId || String(b._id) === String(bId));
          if (match) targetBranches.push(match);
        });
      }
      if (targetBranches.length === 0 && primaryBranch) {
        targetBranches.push(primaryBranch);
      }
      // If no active branches exist in DB at all, create fallback branch
      if (targetBranches.length === 0) {
        targetBranches.push({
          _id: "main",
          name: "Main Branch",
          code: "MAIN",
        });
      }

      for (const tb of targetBranches) {
        const key = `${om.userId}_${tb._id}`;
        if (!userBranchKeys.has(key)) {
          userBranchKeys.add(key);
          synthesizedMemberships.push({
            _id: `synthesized_${om.id || om.userId}_${tb._id}`,
            workspaceId: args.workspaceId,
            organizationId: orgId,
            applicationKey: appKey,
            branchId: String(tb._id),
            branchName: tb.name,
            branchCode: tb.code || "",
            userId: om.userId,
            role: mappedRole,
            permissions: INVENTORY_ROLE_PERMISSIONS[mappedRole] || [],
            status: "active",
            assignedByUserId: org?.ownerId || workspace?.ownerId || om.userId,
            assignedAt: om.joinedAt || om.updatedAt || om.createdAt || Date.now(),
            createdAt: om.joinedAt || om.createdAt || Date.now(),
            updatedAt: om.updatedAt || Date.now(),
          });
        }
      }
    }

    // 5. Also check if branches have managerId not covered
    for (const b of activeBranches) {
      if (b.managerId) {
        const key = `${b.managerId}_${b._id}`;
        if (!userBranchKeys.has(key)) {
          userBranchKeys.add(key);
          synthesizedMemberships.push({
            _id: `synthesized_mgr_${b._id}`,
            workspaceId: args.workspaceId,
            organizationId: orgId,
            applicationKey: appKey,
            branchId: String(b._id),
            branchName: b.name,
            branchCode: b.code || "",
            userId: b.managerId,
            role: "inventory_manager",
            permissions: INVENTORY_ROLE_PERMISSIONS["inventory_manager"] || [],
            status: "active",
            assignedByUserId: org?.ownerId || workspace?.ownerId || b.managerId,
            assignedAt: b.createdAt || Date.now(),
            createdAt: b.createdAt || Date.now(),
            updatedAt: b.updatedAt || Date.now(),
          });
        }
      }
    }

    // 6. Combine explicit + synthesized
    const allMembers = [...uniqueExplicit, ...synthesizedMemberships];

    // 7. Filter by branchId and status if provided
    const filtered = allMembers.filter((m) => {
      if (args.branchId && args.branchId !== "all" && m.branchId !== args.branchId && m.branchId !== "main") {
        return false;
      }
      if (args.status && args.status !== "all" && m.status !== args.status) {
        return false;
      }
      return true;
    });

    // 8. Populate user and branch metadata
    const populated = await Promise.all(
      filtered.map(async (m) => {
        let user: any = null;
        try {
          user = await ctx.db.get(m.userId);
        } catch {}
        if (!user) {
          const uId = ctx.db.normalizeId("users", m.userId);
          if (uId) {
            try {
              user = await ctx.db.get(uId);
            } catch {}
          }
        }

        let branch: any = null;
        if (m.branchId && m.branchId !== "main" && m.branchId !== "all") {
          try {
            branch = await ctx.db.get(m.branchId as any);
          } catch {}
        }

        return {
          id: m._id,
          workspaceId: m.workspaceId,
          applicationKey: m.applicationKey || appKey,
          branchId: m.branchId,
          branchName: branch?.name || m.branchName || "Main Branch",
          branchCode: branch?.code || m.branchCode || "MAIN",
          userId: m.userId,
          user: user
            ? {
                id: user._id,
                name: user.name || user.displayName || user.email?.split("@")[0] || "Staff Member",
                email: user.email || "",
                avatar: user.avatar || user.avatarUrl,
                status: user.status || "active",
              }
            : {
                id: m.userId,
                name: "Staff Member",
                email: "",
                avatar: null,
                status: "active",
              },
          role: m.role || "inventory_viewer",
          permissions: m.permissions || INVENTORY_ROLE_PERMISSIONS[m.role] || [],
          status: m.status || "active",
          assignedByUserId: m.assignedByUserId,
          assignedAt: m.assignedAt,
          transferredFromBranchId: m.transferredFromBranchId,
          transferredFromRole: m.transferredFromRole,
          removedAt: m.removedAt,
          createdAt: m.createdAt,
          updatedAt: m.updatedAt,
        };
      })
    );

    return populated;
  },
});

/**
 * Assign or update a user to a specific branch with a given role
 */
export const assignBranchMember = mutation({
  args: {
    workspaceId: v.string(),
    applicationKey: v.optional(v.string()),
    branchId: v.string(),
    userId: v.id("users"),
    role: v.string(),
    assignedByUserId: v.id("users"),
    permissions: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const appKey = args.applicationKey || "inventory";
    const now = Date.now();
    const perms =
      args.permissions && args.permissions.length > 0
        ? args.permissions
        : INVENTORY_ROLE_PERMISSIONS[args.role] || [];

    // Check if membership already exists for this user in this branch & app
    const existing = await ctx.db
      .query("branchMemberships")
      .withIndex("by_user_branch", (q) =>
        q.eq("userId", args.userId).eq("branchId", args.branchId)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        role: args.role,
        permissions: perms,
        status: "active",
        assignedByUserId: args.assignedByUserId,
        assignedAt: now,
        updatedAt: now,
      });
      return await ctx.db.get(existing._id);
    }

    const id = await ctx.db.insert("branchMemberships", {
      workspaceId: args.workspaceId,
      applicationKey: appKey,
      branchId: args.branchId,
      userId: args.userId,
      role: args.role,
      permissions: perms,
      status: "active",
      assignedByUserId: args.assignedByUserId,
      assignedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    return await ctx.db.get(id);
  },
});

/**
 * Transfer staff member atomically from source branch to target branch
 */
export const transferBranchMember = mutation({
  args: {
    workspaceId: v.string(),
    membershipId: v.union(v.id("branchMemberships"), v.string()),
    fromBranchId: v.optional(v.string()),
    targetBranchId: v.optional(v.string()),
    toBranchId: v.optional(v.string()),
    newRole: v.optional(v.string()),
    toRole: v.optional(v.string()),
    reason: v.optional(v.string()),
    message: v.optional(v.string()),
    transferredBy: v.id("users"),
    effectiveDate: v.optional(v.number()),
    effectiveAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let membership: any = null;
    try {
      membership = await ctx.db.get(args.membershipId as any);
    } catch {}

    const now = Date.now();
    const dstBranchId = args.targetBranchId || args.toBranchId;
    if (!dstBranchId) {
      throw new Error("Target branch ID is required.");
    }

    if (!membership && typeof args.membershipId === "string" && args.membershipId.startsWith("synthesized_")) {
      const parts = args.membershipId.split("_");
      if (parts.length >= 3) {
        const orgMemberId = parts[1];
        const srcBranchId = parts.slice(2).join("_");
        let orgMember: any = null;
        try {
          orgMember = await ctx.db.get(orgMemberId as any);
        } catch {}
        if (orgMember) {
          const roleUpper = (orgMember.role || "").toUpperCase();
          let initialRole = "inventory_viewer";
          if (roleUpper === "OWNER") initialRole = "inventory_owner";
          else if (roleUpper === "ADMIN" || roleUpper === "MANAGER") initialRole = "inventory_manager";
          else if (roleUpper === "CASHIER" || roleUpper === "SALES_ATTENDANT") initialRole = "cashier";
          else if (roleUpper === "STOCK_MANAGER") initialRole = "stock_manager";
          else if (roleUpper === "ACCOUNTANT") initialRole = "accountant";

          const createdId = await ctx.db.insert("branchMemberships", {
            workspaceId: args.workspaceId,
            applicationKey: "inventory",
            branchId: srcBranchId,
            userId: orgMember.userId,
            role: initialRole,
            permissions: INVENTORY_ROLE_PERMISSIONS[initialRole] || [],
            status: "active",
            assignedByUserId: args.transferredBy,
            assignedAt: now,
            createdAt: now,
            updatedAt: now,
          });
          membership = await ctx.db.get(createdId);
        }
      }
    }

    if (!membership) {
      throw new Error("Branch membership not found.");
    }

    const sourceBranchId = args.fromBranchId || membership.branchId;
    if (sourceBranchId === dstBranchId) {
      throw new Error("Target branch must be different from source branch.");
    }

    const effectiveRole = args.newRole || args.toRole || membership.role;
    const permissions = INVENTORY_ROLE_PERMISSIONS[effectiveRole] || membership.permissions;
    const transferReason = args.reason || args.message || "Staff reassignment";

    // 1. Fetch branch names
    let srcBranch: any = null;
    let dstBranch: any = null;
    try {
      srcBranch = await ctx.db.get(sourceBranchId as any);
    } catch {}
    try {
      dstBranch = await ctx.db.get(dstBranchId as any);
    } catch {}

    // 2. Record immutable transfer logs (both tables)
    const transferId = await ctx.db.insert("branchMembershipTransfers", {
      workspaceId: args.workspaceId,
      applicationKey: membership.applicationKey || "inventory",
      userId: membership.userId,
      membershipId: String(membership._id),
      fromBranchId: sourceBranchId,
      toBranchId: dstBranchId,
      fromRole: membership.role,
      toRole: effectiveRole,
      reason: transferReason,
      effectiveAt: args.effectiveAt || args.effectiveDate || now,
      transferredBy: args.transferredBy,
      createdAt: now,
    });

    await ctx.db.insert("branchTransfers", {
      workspaceId: args.workspaceId,
      applicationKey: membership.applicationKey || "inventory",
      userId: membership.userId,
      membershipId: String(membership._id),
      fromBranchId: sourceBranchId,
      toBranchId: dstBranchId,
      sourceBranchId,
      targetBranchId: dstBranchId,
      fromRole: membership.role,
      toRole: effectiveRole,
      previousRole: membership.role,
      newRole: effectiveRole,
      reason: transferReason,
      transferredBy: args.transferredBy,
      effectiveDate: args.effectiveDate || args.effectiveAt || now,
      effectiveAt: args.effectiveAt || args.effectiveDate || now,
      message: transferReason,
      createdAt: now,
    });

    // 3. Close previous branch membership / update to target branch
    const previousRole = membership.role;
    await ctx.db.patch(membership._id, {
      branchId: dstBranchId,
      role: effectiveRole,
      permissions,
      transferredFromBranchId: sourceBranchId,
      transferredFromRole: previousRole,
      assignedByUserId: args.transferredBy,
      assignedAt: now,
      updatedAt: now,
    });

    const updated: any = await ctx.db.get(membership._id);

    // 4. In-App Notification
    try {
      await ctx.db.insert("notifications", {
        userId: membership.userId,
        type: "INVENTORY_STAFF_TRANSFERRED",
        title: "Branch Transfer Notification",
        body: `You have been transferred to ${dstBranch?.name || "new branch"} as ${effectiveRole.replace(/_/g, " ")}.`,
        severity: "INFO",
        channel: "IN_APP",
        status: "UNREAD",
        data: {
          workspaceId: args.workspaceId,
          applicationKey: "inventory",
          fromBranchId: sourceBranchId,
          fromBranchName: srcBranch?.name || "Previous Branch",
          toBranchId: dstBranchId,
          toBranchName: dstBranch?.name || "New Branch",
          previousRole,
          newRole: effectiveRole,
          reason: transferReason,
        },
        createdAt: now,
      });
    } catch {}

    // 5. Audit Log
    try {
      const wsIdNorm = ctx.db.normalizeId("workspaces", args.workspaceId);
      if (wsIdNorm) {
        await ctx.db.insert("workspaceAuditLogs", {
          workspaceId: wsIdNorm,
          actorUserId: args.transferredBy,
          eventType: "inventory.staff_transferred",
          entityType: "branch_membership",
          entityId: String(membership._id),
          severity: "info",
          metadata: {
            targetUserId: membership.userId,
            fromBranchId: sourceBranchId,
            toBranchId: dstBranchId,
            previousRole,
            newRole: effectiveRole,
            reason: transferReason,
          },
          createdAt: now,
        });
      }
    } catch {}

    return {
      success: true,
      membership: {
        id: updated?._id || membership._id,
        userId: updated?.userId || membership.userId,
        applicationKey: updated?.applicationKey || membership.applicationKey,
        branchId: dstBranchId,
        branchName: dstBranch?.name || "Assigned Branch",
        role: effectiveRole,
        status: "active",
      },
      previousAccess: {
        branchId: sourceBranchId,
        branchName: srcBranch?.name || "Previous Branch",
        role: previousRole,
        status: "removed",
      },
      transferId,
    };
  },
});

/**
 * Suspend staff branch access temporarily
 */
export const suspendBranchMember = mutation({
  args: {
    workspaceId: v.string(),
    membershipId: v.union(v.id("branchMemberships"), v.string()),
    reason: v.optional(v.string()),
    suspendAllBranches: v.optional(v.boolean()),
    actingUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    let membership: any = null;
    try {
      membership = await ctx.db.get(args.membershipId as any);
    } catch {}

    const now = Date.now();
    const reason = args.reason || "Temporary suspension";

    if (!membership && typeof args.membershipId === "string" && args.membershipId.startsWith("synthesized_")) {
      const parts = args.membershipId.split("_");
      if (parts.length >= 3) {
        const orgMemberId = parts[1];
        const branchId = parts.slice(2).join("_");
        let orgMember: any = null;
        try {
          orgMember = await ctx.db.get(orgMemberId as any);
        } catch {}
        if (orgMember) {
          const roleUpper = (orgMember.role || "").toUpperCase();
          let initialRole = "inventory_viewer";
          if (roleUpper === "OWNER") initialRole = "inventory_owner";
          else if (roleUpper === "ADMIN" || roleUpper === "MANAGER") initialRole = "inventory_manager";
          else if (roleUpper === "CASHIER" || roleUpper === "SALES_ATTENDANT") initialRole = "cashier";
          else if (roleUpper === "STOCK_MANAGER") initialRole = "stock_manager";
          else if (roleUpper === "ACCOUNTANT") initialRole = "accountant";

          const createdId = await ctx.db.insert("branchMemberships", {
            workspaceId: args.workspaceId,
            applicationKey: "inventory",
            branchId,
            userId: orgMember.userId,
            role: initialRole,
            permissions: INVENTORY_ROLE_PERMISSIONS[initialRole] || [],
            status: "suspended",
            suspendedAt: now,
            suspensionReason: reason,
            assignedByUserId: args.actingUserId,
            assignedAt: now,
            createdAt: now,
            updatedAt: now,
          });
          membership = await ctx.db.get(createdId);
        }
      }
    }

    if (!membership) {
      throw new Error("Branch membership not found.");
    }

    await ctx.db.patch(membership._id, {
      status: "suspended",
      suspendedAt: now,
      suspensionReason: reason,
      updatedAt: now,
    });

    if (args.suspendAllBranches) {
      const allMems = await ctx.db
        .query("branchMemberships")
        .withIndex("by_user_application", (q) =>
          q.eq("userId", membership.userId).eq("applicationKey", "inventory")
        )
        .collect();

      for (const m of allMems) {
        if (m.workspaceId === args.workspaceId && m.status === "active") {
          await ctx.db.patch(m._id, {
            status: "suspended",
            suspendedAt: now,
            suspensionReason: reason,
            updatedAt: now,
          });
        }
      }
    }

    // Notification
    try {
      await ctx.db.insert("notifications", {
        userId: membership.userId,
        type: "INVENTORY_BRANCH_SUSPENDED",
        title: "Inventory Branch Access Suspended",
        body: `Your access to branch has been temporarily suspended. Reason: ${reason}`,
        severity: "WARNING",
        channel: "IN_APP",
        status: "UNREAD",
        data: {
          workspaceId: args.workspaceId,
          applicationKey: "inventory",
          branchId: membership.branchId,
          reason,
        },
        createdAt: now,
      });
    } catch {}

    // Audit Log
    try {
      const wsIdNorm = ctx.db.normalizeId("workspaces", args.workspaceId);
      if (wsIdNorm) {
        await ctx.db.insert("workspaceAuditLogs", {
          workspaceId: wsIdNorm,
          actorUserId: args.actingUserId,
          eventType: "inventory.branch_access_suspended",
          entityType: "branch_membership",
          entityId: String(membership._id),
          severity: "warn",
          metadata: {
            targetUserId: membership.userId,
            branchId: membership.branchId,
            reason,
            suspendAllBranches: args.suspendAllBranches ?? false,
          },
          createdAt: now,
        });
      }
    } catch {}

    return await ctx.db.get(membership._id);
  },
});

/**
 * Restore suspended staff branch access
 */
export const restoreBranchMember = mutation({
  args: {
    workspaceId: v.string(),
    membershipId: v.union(v.id("branchMemberships"), v.string()),
    actingUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    let membership: any = null;
    try {
      membership = await ctx.db.get(args.membershipId as any);
    } catch {}

    const now = Date.now();

    if (!membership && typeof args.membershipId === "string" && args.membershipId.startsWith("synthesized_")) {
      const parts = args.membershipId.split("_");
      if (parts.length >= 3) {
        const orgMemberId = parts[1];
        const branchId = parts.slice(2).join("_");
        let orgMember: any = null;
        try {
          orgMember = await ctx.db.get(orgMemberId as any);
        } catch {}
        if (orgMember) {
          const roleUpper = (orgMember.role || "").toUpperCase();
          let initialRole = "inventory_viewer";
          if (roleUpper === "OWNER") initialRole = "inventory_owner";
          else if (roleUpper === "ADMIN" || roleUpper === "MANAGER") initialRole = "inventory_manager";
          else if (roleUpper === "CASHIER" || roleUpper === "SALES_ATTENDANT") initialRole = "cashier";
          else if (roleUpper === "STOCK_MANAGER") initialRole = "stock_manager";
          else if (roleUpper === "ACCOUNTANT") initialRole = "accountant";

          const createdId = await ctx.db.insert("branchMemberships", {
            workspaceId: args.workspaceId,
            applicationKey: "inventory",
            branchId,
            userId: orgMember.userId,
            role: initialRole,
            permissions: INVENTORY_ROLE_PERMISSIONS[initialRole] || [],
            status: "active",
            assignedByUserId: args.actingUserId,
            assignedAt: now,
            createdAt: now,
            updatedAt: now,
          });
          membership = await ctx.db.get(createdId);
        }
      }
    }

    if (!membership) {
      throw new Error("Branch membership not found.");
    }

    // Verify branch is not archived
    let branch: any = null;
    try {
      branch = await ctx.db.get(membership.branchId as any);
      if (branch && (branch.status === "ARCHIVED" || branch.status === "deleted")) {
        throw new Error("Cannot restore access: Target branch is archived or deleted.");
      }
    } catch (err: any) {
      if (err.message?.includes("Cannot restore access")) throw err;
    }

    await ctx.db.patch(membership._id, {
      status: "active",
      suspendedAt: undefined,
      suspensionReason: undefined,
      updatedAt: now,
    });

    // Notification
    try {
      await ctx.db.insert("notifications", {
        userId: membership.userId,
        type: "INVENTORY_BRANCH_RESTORED",
        title: "Inventory Branch Access Restored",
        body: `Your access to ${branch?.name || "branch"} has been restored.`,
        severity: "INFO",
        channel: "IN_APP",
        status: "UNREAD",
        data: {
          workspaceId: args.workspaceId,
          applicationKey: "inventory",
          branchId: membership.branchId,
        },
        createdAt: now,
      });
    } catch {}

    // Audit Log
    try {
      const wsIdNorm = ctx.db.normalizeId("workspaces", args.workspaceId);
      if (wsIdNorm) {
        await ctx.db.insert("workspaceAuditLogs", {
          workspaceId: wsIdNorm,
          actorUserId: args.actingUserId,
          eventType: "inventory.branch_access_restored",
          entityType: "branch_membership",
          entityId: String(membership._id),
          severity: "info",
          metadata: {
            targetUserId: membership.userId,
            branchId: membership.branchId,
          },
          createdAt: now,
        });
      }
    } catch {}

    return await ctx.db.get(membership._id);
  },
});

/**
 * Remove staff from a specific branch (non-destructive to workspace and user account)
 */
export const removeBranchMember = mutation({
  args: {
    workspaceId: v.string(),
    membershipId: v.union(v.id("branchMemberships"), v.string()),
    reason: v.optional(v.string()),
    removeFromInventory: v.optional(v.boolean()),
    actingUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    let membership: any = null;
    try {
      membership = await ctx.db.get(args.membershipId as any);
    } catch {}

    const now = Date.now();
    const reason = args.reason || "No longer assigned to this branch";

    if (!membership && typeof args.membershipId === "string" && args.membershipId.startsWith("synthesized_")) {
      const parts = args.membershipId.split("_");
      if (parts.length >= 3) {
        const orgMemberId = parts[1];
        const branchId = parts.slice(2).join("_");
        let orgMember: any = null;
        try {
          orgMember = await ctx.db.get(orgMemberId as any);
        } catch {}
        if (orgMember) {
          const roleUpper = (orgMember.role || "").toUpperCase();
          let initialRole = "inventory_viewer";
          if (roleUpper === "OWNER") initialRole = "inventory_owner";
          else if (roleUpper === "ADMIN" || roleUpper === "MANAGER") initialRole = "inventory_manager";
          else if (roleUpper === "CASHIER" || roleUpper === "SALES_ATTENDANT") initialRole = "cashier";
          else if (roleUpper === "STOCK_MANAGER") initialRole = "stock_manager";
          else if (roleUpper === "ACCOUNTANT") initialRole = "accountant";

          const createdId = await ctx.db.insert("branchMemberships", {
            workspaceId: args.workspaceId,
            applicationKey: "inventory",
            branchId,
            userId: orgMember.userId,
            role: initialRole,
            permissions: INVENTORY_ROLE_PERMISSIONS[initialRole] || [],
            status: "removed",
            removedAt: now,
            removalReason: reason,
            assignedByUserId: args.actingUserId,
            assignedAt: now,
            createdAt: now,
            updatedAt: now,
          });
          membership = await ctx.db.get(createdId);
        }
      }
    }

    if (!membership) {
      throw new Error("Branch membership not found.");
    }

    await ctx.db.patch(membership._id, {
      status: "removed",
      removedAt: now,
      removalReason: reason,
      updatedAt: now,
    });

    if (args.removeFromInventory) {
      const appMems = await ctx.db
        .query("applicationMemberships")
        .withIndex("by_workspace_application_user", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("applicationKey", "inventory").eq("userId", membership.userId)
        )
        .collect();

      for (const am of appMems) {
        await ctx.db.patch(am._id, {
          status: "removed",
          removedAt: now,
          removalReason: reason,
          updatedAt: now,
        });
      }
    }

    // Notification
    try {
      await ctx.db.insert("notifications", {
        userId: membership.userId,
        type: "INVENTORY_BRANCH_REMOVED",
        title: "Inventory Branch Assignment Removed",
        body: `Your access to branch has been removed. Reason: ${reason}. Your workspace membership remains unchanged.`,
        severity: "WARNING",
        channel: "IN_APP",
        status: "UNREAD",
        data: {
          workspaceId: args.workspaceId,
          applicationKey: "inventory",
          branchId: membership.branchId,
          reason,
        },
        createdAt: now,
      });
    } catch {}

    // Audit Log
    try {
      const wsIdNorm = ctx.db.normalizeId("workspaces", args.workspaceId);
      if (wsIdNorm) {
        await ctx.db.insert("workspaceAuditLogs", {
          workspaceId: wsIdNorm,
          actorUserId: args.actingUserId,
          eventType: "inventory.branch_access_removed",
          entityType: "branch_membership",
          entityId: String(membership._id),
          severity: "warn",
          metadata: {
            targetUserId: membership.userId,
            branchId: membership.branchId,
            reason,
            removeFromInventory: args.removeFromInventory ?? false,
          },
          createdAt: now,
        });
      }
    } catch {}

    return {
      success: true,
      membershipId: membership._id,
      status: "removed",
      message: "Staff member removed from branch. Workspace membership preserved.",
    };
  },
});

/**
 * Remove staff from Inventory application completely (leaves workspace membership and historical sales intact)
 */
export const removeInventoryMember = mutation({
  args: {
    workspaceId: v.string(),
    membershipId: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    reason: v.optional(v.string()),
    actingUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    let targetUserId = args.userId;

    if (!targetUserId && args.membershipId) {
      try {
        const mem: any = await ctx.db.get(args.membershipId as any);
        if (mem?.userId) targetUserId = mem.userId;
      } catch {}
    }

    if (!targetUserId) {
      throw new Error("Target user could not be resolved.");
    }

    const now = Date.now();
    const reason = args.reason || "No longer works with Inventory";

    // 1. Mark all branch memberships as removed
    const branchMems = await ctx.db
      .query("branchMemberships")
      .withIndex("by_user_application", (q) =>
        q.eq("userId", targetUserId!).eq("applicationKey", "inventory")
      )
      .collect();

    for (const bm of branchMems) {
      if (bm.workspaceId === args.workspaceId && bm.status !== "removed") {
        await ctx.db.patch(bm._id, {
          status: "removed",
          removedAt: now,
          removalReason: reason,
          updatedAt: now,
        });
      }
    }

    // 2. Mark application membership as removed
    const appMems = await ctx.db
      .query("applicationMemberships")
      .withIndex("by_workspace_application_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("applicationKey", "inventory").eq("userId", targetUserId!)
      )
      .collect();

    for (const am of appMems) {
      await ctx.db.patch(am._id, {
        status: "removed",
        removedAt: now,
        removalReason: reason,
        updatedAt: now,
      });
    }

    // 3. In-App Notification
    try {
      await ctx.db.insert("notifications", {
        userId: targetUserId,
        type: "INVENTORY_APPLICATION_REMOVED",
        title: "Inventory Access Removed",
        body: `Your access to the Inventory application in this workspace has been removed. Reason: ${reason}. Your workspace membership remains active.`,
        severity: "WARNING",
        channel: "IN_APP",
        status: "UNREAD",
        data: {
          workspaceId: args.workspaceId,
          applicationKey: "inventory",
          reason,
        },
        createdAt: now,
      });
    } catch {}

    // 4. Audit Log
    try {
      const wsIdNorm = ctx.db.normalizeId("workspaces", args.workspaceId);
      if (wsIdNorm) {
        await ctx.db.insert("workspaceAuditLogs", {
          workspaceId: wsIdNorm,
          actorUserId: args.actingUserId,
          eventType: "inventory.inventory_access_removed",
          entityType: "application_membership",
          entityId: String(targetUserId),
          severity: "warn",
          metadata: {
            targetUserId,
            reason,
          },
          createdAt: now,
        });
      }
    } catch {}

    return {
      success: true,
      userId: targetUserId,
      status: "removed",
      message: "Staff member removed from Inventory. Workspace membership and records preserved.",
    };
  },
});

/**
 * Add branch access for a staff member (supporting multi-branch assignment)
 */
export const addBranchAccess = mutation({
  args: {
    workspaceId: v.string(),
    membershipId: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    branchId: v.string(),
    roleOverride: v.optional(v.string()),
    permissions: v.optional(v.array(v.string())),
    assignedByUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    let targetUserId = args.userId;

    if (!targetUserId && args.membershipId) {
      try {
        const mem: any = await ctx.db.get(args.membershipId as any);
        if (mem?.userId) targetUserId = mem.userId;
      } catch {}
    }

    if (!targetUserId) {
      throw new Error("Target user could not be resolved.");
    }

    const now = Date.now();
    const role = args.roleOverride || "cashier";
    const perms = args.permissions || INVENTORY_ROLE_PERMISSIONS[role] || [];

    const existing = await ctx.db
      .query("branchMemberships")
      .withIndex("by_user_branch", (q) =>
        q.eq("userId", targetUserId!).eq("branchId", args.branchId)
      )
      .first();

    let recordId: any;
    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "active",
        role,
        roleOverride: args.roleOverride,
        permissions: perms,
        assignedByUserId: args.assignedByUserId,
        assignedAt: now,
        removedAt: undefined,
        removalReason: undefined,
        suspendedAt: undefined,
        suspensionReason: undefined,
        updatedAt: now,
      });
      recordId = existing._id;
    } else {
      recordId = await ctx.db.insert("branchMemberships", {
        workspaceId: args.workspaceId,
        applicationKey: "inventory",
        branchId: args.branchId,
        userId: targetUserId,
        role,
        roleOverride: args.roleOverride,
        permissions: perms,
        status: "active",
        assignedByUserId: args.assignedByUserId,
        assignedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Audit Log
    try {
      const wsIdNorm = ctx.db.normalizeId("workspaces", args.workspaceId);
      if (wsIdNorm) {
        await ctx.db.insert("workspaceAuditLogs", {
          workspaceId: wsIdNorm,
          actorUserId: args.assignedByUserId,
          eventType: "inventory.branch_access_granted",
          entityType: "branch_membership",
          entityId: String(recordId),
          severity: "info",
          metadata: {
            targetUserId,
            branchId: args.branchId,
            role,
          },
          createdAt: now,
        });
      }
    } catch {}

    return await ctx.db.get(recordId);
  },
});

/**
 * Get comprehensive Staff Access Summary for dashboard and authorization
 */
export const getStaffAccessSummary = query({
  args: {
    workspaceId: v.string(),
    userId: v.optional(v.id("users")),
    membershipId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let targetUserId = args.userId;
    if (!targetUserId && args.membershipId) {
      try {
        const mem: any = await ctx.db.get(args.membershipId as any);
        if (mem?.userId) targetUserId = mem.userId;
      } catch {}
    }

    if (!targetUserId) {
      return null;
    }

    // 1. Workspace membership
    const wsMembers = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_user", (q) => q.eq("userId", targetUserId!))
      .collect();

    const wsMembership = wsMembers.find(
      (m) => String(m.workspaceId) === String(args.workspaceId)
    );

    // 2. Branch memberships
    const branchMems = await ctx.db
      .query("branchMemberships")
      .withIndex("by_user_application", (q) =>
        q.eq("userId", targetUserId!).eq("applicationKey", "inventory")
      )
      .collect();

    const activeBranchList = await Promise.all(
      branchMems
        .filter((bm) => bm.workspaceId === args.workspaceId)
        .map(async (bm) => {
          let branch: any = null;
          try {
            branch = await ctx.db.get(bm.branchId as any);
          } catch {}

          return {
            branchId: bm.branchId,
            branchName: branch?.name || "Main Branch",
            status: bm.status,
            role: bm.role,
            permissions: bm.permissions || INVENTORY_ROLE_PERMISSIONS[bm.role] || [],
            isDefault: branch?.isPrimary ?? false,
          };
        })
    );

    const isOwner = wsMembership?.role === "owner" || wsMembership?.role === "admin";
    const appStatus = isOwner || activeBranchList.some((b) => b.status === "active") ? "active" : "removed";

    return {
      userId: targetUserId,
      workspaceId: args.workspaceId,
      workspaceMembership: {
        status: wsMembership?.status || (isOwner ? "active" : "removed"),
        role: wsMembership?.role || (isOwner ? "owner" : "member"),
      },
      applications: [
        {
          applicationKey: "inventory",
          status: appStatus,
          role: activeBranchList[0]?.role || (isOwner ? "inventory_owner" : "inventory_viewer"),
          branches: activeBranchList,
        },
      ],
    };
  },
});

/**
 * List branch transfer history for a workspace or specific user
 */
export const listBranchTransfers = query({
  args: {
    workspaceId: v.string(),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    let transfers: any[] = [];
    try {
      transfers = await ctx.db
        .query("branchMembershipTransfers")
        .withIndex("by_workspace", (i) => i.eq("workspaceId", args.workspaceId))
        .order("desc")
        .collect();
    } catch {}

    if (transfers.length === 0) {
      try {
        transfers = await ctx.db
          .query("branchTransfers")
          .withIndex("by_workspace", (i) => i.eq("workspaceId", args.workspaceId))
          .order("desc")
          .collect();
      } catch {}
    }

    const filtered = args.userId ? transfers.filter((t) => t.userId === args.userId) : transfers;

    const populated = await Promise.all(
      filtered.map(async (t) => {
        let user: any = null;
        let transferredBy: any = null;
        try {
          user = await ctx.db.get(t.userId);
        } catch {}
        try {
          transferredBy = await ctx.db.get(t.transferredBy);
        } catch {}

        const srcBranchId = t.fromBranchId || t.sourceBranchId;
        const dstBranchId = t.toBranchId || t.targetBranchId;

        let srcBranch: any = null;
        let dstBranch: any = null;
        try {
          srcBranch = await ctx.db.get(srcBranchId as any);
        } catch {}
        try {
          dstBranch = await ctx.db.get(dstBranchId as any);
        } catch {}

        return {
          id: t._id,
          userId: t.userId,
          userName: user?.name || user?.email || "Staff Member",
          userEmail: user?.email,
          userAvatar: user?.avatar || user?.avatarUrl,
          sourceBranchId: srcBranchId,
          sourceBranchName: srcBranch?.name || "Previous Branch",
          targetBranchId: dstBranchId,
          targetBranchName: dstBranch?.name || "Target Branch",
          previousRole: t.fromRole || t.previousRole,
          newRole: t.toRole || t.newRole,
          transferredBy: transferredBy?.name || transferredBy?.email || "Admin",
          effectiveDate: t.effectiveAt || t.effectiveDate || t.createdAt,
          reason: t.reason || t.message || "Staff reassignment",
          createdAt: t.createdAt,
        };
      })
    );

    return populated;
  },
});

/**
 * Safe public user search by email (sanitized, non-enumerating public profile only)
 */
export const searchSafeUsersByEmail = query({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const normalized = args.email.toLowerCase().trim();
    if (!normalized || normalized.length < 3) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_email_normalized", (i) => i.eq("emailNormalized", normalized))
      .first();

    if (!user) {
      const byEmail = await ctx.db
        .query("users")
        .withIndex("by_email", (i) => i.eq("email", normalized))
        .first();
      if (!byEmail) return null;
      return {
        id: byEmail._id,
        name: byEmail.name || byEmail.displayName || "Orviohub User",
        avatar: byEmail.avatar || byEmail.avatarUrl || null,
        exists: true,
      };
    }

    return {
      id: user._id,
      name: user.name || user.displayName || "Orviohub User",
      avatar: user.avatar || user.avatarUrl || null,
      exists: true,
    };
  },
});

/**
 * Resolve fine-grained context and permissions for an Inventory request
 */
export const resolveInventoryContext = query({
  args: {
    workspaceId: v.string(),
    userId: v.id("users"),
    branchId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Workspace membership
    const wsMemberships = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const wsMembership = wsMemberships.find(
      (m) => String(m.workspaceId) === String(args.workspaceId) && m.status === "active"
    );

    const isWsOwner = wsMembership?.role === "owner" || wsMembership?.role === "admin";

    // 2. Workspace Application Status (Inventory)
    const wsProducts = await ctx.db
      .query("workspaceProducts")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId as any))
      .collect();

    const inventoryApp = wsProducts.find((p) => p.productKey === "inventory");
    const isAppActive = inventoryApp ? (inventoryApp.status === "active" || inventoryApp.status === "trial" || inventoryApp.status === "trialing") : true;

    // 3. Branch Membership
    let branchMembership: any = null;
    if (args.branchId) {
      const branchMembers = await ctx.db
        .query("branchMemberships")
        .withIndex("by_user_branch", (q) =>
          q.eq("userId", args.userId).eq("branchId", args.branchId!)
        )
        .first();

      if (branchMembers && branchMembers.workspaceId === args.workspaceId && branchMembers.status === "active") {
        branchMembership = branchMembers;
      }
    }

    // Determine effective role & permissions
    const effectiveRole = branchMembership?.role || (isWsOwner ? "inventory_owner" : "inventory_viewer");
    const standardPerms = INVENTORY_ROLE_PERMISSIONS[effectiveRole] || [];
    const explicitPermissions = branchMembership?.permissions || standardPerms;

    return {
      workspaceMembership: {
        active: Boolean(wsMembership),
        role: wsMembership?.role || "none",
        status: wsMembership?.status || "inactive",
      },
      applicationMembership: {
        active: Boolean(wsMembership) && isAppActive,
        applicationKey: "inventory",
        status: isAppActive ? "active" : "inactive",
        role: effectiveRole,
      },
      branchMembership: {
        active: Boolean(branchMembership || isWsOwner),
        branchId: args.branchId || null,
        role: effectiveRole,
        permissions: explicitPermissions,
      },
      permissions: explicitPermissions,
    };
  },
});

/**
 * Access-aware dashboard context resolution for home launcher and dashboard routing
 */
export const getAccessContext = query({
  args: {
    userId: v.id("users"),
    workspaceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Get workspace memberships for user
    const wsMemberships = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const activeWsMemberships = wsMemberships.filter(
      (m) =>
        m.status === "active" &&
        (!args.workspaceId || String(m.workspaceId) === String(args.workspaceId))
    );

    const contextList = await Promise.all(
      activeWsMemberships.map(async (m) => {
        let ws: any = null;
        try {
          ws = await ctx.db.get(m.workspaceId);
        } catch {}

        // Load branches assigned to this user for inventory
        const userBranchMemberships = await ctx.db
          .query("branchMemberships")
          .withIndex("by_workspace_user", (q) =>
            q.eq("workspaceId", String(m.workspaceId)).eq("userId", args.userId)
          )
          .collect();

        const activeBranchMemberships = userBranchMemberships.filter(
          (bm) => bm.status === "active" && bm.applicationKey === "inventory"
        );

        const assignedBranches = await Promise.all(
          activeBranchMemberships.map(async (bm) => {
            let branch: any = null;
            try {
              branch = await ctx.db.get(bm.branchId as any);
            } catch {}

            return {
              id: bm.branchId,
              name: branch?.name || "Main Store",
              code: branch?.code || "",
              isDefault: branch?.isPrimary ?? false,
              role: bm.role,
              permissions: bm.permissions || INVENTORY_ROLE_PERMISSIONS[bm.role] || [],
            };
          })
        );

        const isOwnerOrAdmin = m.role === "owner" || m.role === "admin";
        const hasInventoryAccess = isOwnerOrAdmin || assignedBranches.length > 0;

        const applications = [
          {
            key: "inventory",
            name: "Inventory & POS",
            status: hasInventoryAccess ? "active" : "no_access",
            role: assignedBranches[0]?.role || (isOwnerOrAdmin ? "inventory_owner" : "none"),
            statusForUser: hasInventoryAccess ? "active" : "no_access",
            branches: assignedBranches,
          },
          {
            key: "task_management",
            name: "Task Management",
            status: "no_access",
            statusForUser: "no_access",
            branches: [],
          },
          {
            key: "gym",
            name: "Gym Management",
            status: "no_access",
            statusForUser: "no_access",
            branches: [],
          },
        ];

        return {
          workspace: {
            id: m.workspaceId,
            name: ws?.name || "Workspace",
            slug: ws?.slug || "",
            role: m.role,
            status: m.status,
          },
          applications,
        };
      })
    );

    return args.workspaceId ? contextList[0] || null : contextList;
  },
});

