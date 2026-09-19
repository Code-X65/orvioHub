/**
 * workspacePermissions.ts
 *
 * Canonical permission resolver for the 3-tier hierarchy:
 * 1. Workspace-level roles (owner, admin, member, guest)
 * 2. Application-level access (inventory, tasks, pos, gym, booking, crm; roles: admin, member, viewer)
 * 3. Branch-level assignments (manager, staff, viewer)
 */
import { query } from "./_generated/server.js";
import { v } from "convex/values";

// ==========================================
// 2.1 WORKSPACE-LEVEL PERMISSIONS
// ==========================================
export const WORKSPACE_PERMISSIONS = {
  VIEW: "workspace.view",
  UPDATE_SETTINGS: "workspace.update_settings",
  DELETE: "workspace.delete",
  TRANSFER_OWNERSHIP: "workspace.transfer_ownership",
  MANAGE_BILLING: "workspace.manage_billing",
  MEMBER_INVITE: "member.invite",
  MEMBER_REMOVE: "member.remove",
  MEMBER_CHANGE_ROLE: "member.change_role",
  MEMBER_SUSPEND: "member.suspend",
  MEMBER_VIEW_ALL: "member.view_all",
  APPLICATION_ACTIVATE: "application.activate",
  APPLICATION_DEACTIVATE: "application.deactivate",
  BRANCH_CREATE: "branch.create",
  BRANCH_ARCHIVE: "branch.archive",
} as const;

export const WORKSPACE_ROLE_PERMISSIONS: Record<string, string[]> = {
  owner: [
    WORKSPACE_PERMISSIONS.VIEW,
    WORKSPACE_PERMISSIONS.UPDATE_SETTINGS,
    WORKSPACE_PERMISSIONS.DELETE,
    WORKSPACE_PERMISSIONS.TRANSFER_OWNERSHIP,
    WORKSPACE_PERMISSIONS.MANAGE_BILLING,
    WORKSPACE_PERMISSIONS.MEMBER_INVITE,
    WORKSPACE_PERMISSIONS.MEMBER_REMOVE,
    WORKSPACE_PERMISSIONS.MEMBER_CHANGE_ROLE,
    WORKSPACE_PERMISSIONS.MEMBER_SUSPEND,
    WORKSPACE_PERMISSIONS.MEMBER_VIEW_ALL,
    WORKSPACE_PERMISSIONS.APPLICATION_ACTIVATE,
    WORKSPACE_PERMISSIONS.APPLICATION_DEACTIVATE,
    WORKSPACE_PERMISSIONS.BRANCH_CREATE,
    WORKSPACE_PERMISSIONS.BRANCH_ARCHIVE,
  ],
  admin: [
    WORKSPACE_PERMISSIONS.VIEW,
    WORKSPACE_PERMISSIONS.UPDATE_SETTINGS,
    WORKSPACE_PERMISSIONS.MEMBER_INVITE,
    WORKSPACE_PERMISSIONS.MEMBER_REMOVE,
    WORKSPACE_PERMISSIONS.MEMBER_CHANGE_ROLE,
    WORKSPACE_PERMISSIONS.MEMBER_SUSPEND,
    WORKSPACE_PERMISSIONS.MEMBER_VIEW_ALL,
    WORKSPACE_PERMISSIONS.APPLICATION_ACTIVATE,
    WORKSPACE_PERMISSIONS.APPLICATION_DEACTIVATE,
    WORKSPACE_PERMISSIONS.BRANCH_CREATE,
    WORKSPACE_PERMISSIONS.BRANCH_ARCHIVE,
  ],
  member: [
    WORKSPACE_PERMISSIONS.VIEW,
  ],
  guest: [
    WORKSPACE_PERMISSIONS.VIEW,
  ],
  // Uppercase aliases
  OWNER: [],
  ADMIN: [],
  MEMBER: [],
  GUEST: [],
};
WORKSPACE_ROLE_PERMISSIONS.OWNER = WORKSPACE_ROLE_PERMISSIONS.owner;
WORKSPACE_ROLE_PERMISSIONS.ADMIN = WORKSPACE_ROLE_PERMISSIONS.admin;
WORKSPACE_ROLE_PERMISSIONS.MEMBER = WORKSPACE_ROLE_PERMISSIONS.member;
WORKSPACE_ROLE_PERMISSIONS.GUEST = WORKSPACE_ROLE_PERMISSIONS.guest;

// ==========================================
// 2.2 APPLICATION-LEVEL PERMISSIONS (INVENTORY EXAMPLE)
// ==========================================
export const INVENTORY_PERMISSIONS = {
  VIEW: "inventory.view",
  PRODUCTS_CREATE: "inventory.products.create",
  PRODUCTS_UPDATE: "inventory.products.update",
  PRODUCTS_DELETE: "inventory.products.delete",
  SALES_CREATE: "inventory.sales.create",
  SALES_VOID: "inventory.sales.void",
  STOCK_ADJUST: "inventory.stock.adjust",
  REPORTS_VIEW: "inventory.reports.view",
  REPORTS_EXPORT: "inventory.reports.export",
  SETTINGS_UPDATE: "inventory.settings.update",
  BRANCHES_MANAGE: "inventory.branches.manage",
  STAFF_MANAGE: "inventory.staff.manage",
} as const;

export const APPLICATION_ROLE_PERMISSIONS: Record<string, Record<string, string[]>> = {
  inventory: {
    admin: [
      INVENTORY_PERMISSIONS.VIEW,
      INVENTORY_PERMISSIONS.PRODUCTS_CREATE,
      INVENTORY_PERMISSIONS.PRODUCTS_UPDATE,
      INVENTORY_PERMISSIONS.PRODUCTS_DELETE,
      INVENTORY_PERMISSIONS.SALES_CREATE,
      INVENTORY_PERMISSIONS.SALES_VOID,
      INVENTORY_PERMISSIONS.STOCK_ADJUST,
      INVENTORY_PERMISSIONS.REPORTS_VIEW,
      INVENTORY_PERMISSIONS.REPORTS_EXPORT,
      INVENTORY_PERMISSIONS.SETTINGS_UPDATE,
      INVENTORY_PERMISSIONS.BRANCHES_MANAGE,
      INVENTORY_PERMISSIONS.STAFF_MANAGE,
    ],
    member: [
      INVENTORY_PERMISSIONS.VIEW,
      INVENTORY_PERMISSIONS.PRODUCTS_CREATE,
      INVENTORY_PERMISSIONS.PRODUCTS_UPDATE,
      INVENTORY_PERMISSIONS.SALES_CREATE,
      INVENTORY_PERMISSIONS.STOCK_ADJUST,
      INVENTORY_PERMISSIONS.REPORTS_VIEW,
    ],
    viewer: [
      INVENTORY_PERMISSIONS.VIEW,
      INVENTORY_PERMISSIONS.REPORTS_VIEW,
    ],
  },
  tasks: {
    admin: ["tasks.view", "tasks.create", "tasks.update", "tasks.delete", "tasks.manage"],
    member: ["tasks.view", "tasks.create", "tasks.update"],
    viewer: ["tasks.view"],
  },
  pos: {
    admin: ["pos.view", "pos.sales.create", "pos.sales.void", "pos.reports.view", "pos.reports.export", "pos.settings.update"],
    member: ["pos.view", "pos.sales.create", "pos.reports.view"],
    viewer: ["pos.view"],
  },
  gym: {
    admin: ["gym.view", "gym.members.manage", "gym.plans.manage", "gym.attendance.record", "gym.reports.view"],
    member: ["gym.view", "gym.members.manage", "gym.attendance.record"],
    viewer: ["gym.view"],
  },
  booking: {
    admin: ["booking.view", "booking.manage", "booking.services.manage", "booking.reports.view"],
    member: ["booking.view", "booking.manage"],
    viewer: ["booking.view"],
  },
  crm: {
    admin: ["crm.view", "crm.contacts.manage", "crm.deals.manage", "crm.reports.view"],
    member: ["crm.view", "crm.contacts.manage", "crm.deals.manage"],
    viewer: ["crm.view"],
  },
};

// ==========================================
// 2.3 BRANCH-LEVEL PERMISSIONS
// ==========================================
export const BRANCH_PERMISSIONS = {
  VIEW: "branch.view",
  SALES_CREATE: "branch.sales.create",
  SALES_VOID: "branch.sales.void",
  STOCK_RECEIVE: "branch.stock.receive",
  STOCK_ADJUST: "branch.stock.adjust",
  STAFF_MANAGE: "branch.staff.manage",
  SETTINGS_VIEW: "branch.settings.view",
  SETTINGS_UPDATE: "branch.settings.update",
  REPORTS_VIEW: "branch.reports.view",
  REPORTS_EXPORT: "branch.reports.export",
} as const;

export const BRANCH_ROLE_PERMISSIONS: Record<string, string[]> = {
  manager: [
    BRANCH_PERMISSIONS.VIEW,
    BRANCH_PERMISSIONS.SALES_CREATE,
    BRANCH_PERMISSIONS.SALES_VOID,
    BRANCH_PERMISSIONS.STOCK_RECEIVE,
    BRANCH_PERMISSIONS.STOCK_ADJUST,
    BRANCH_PERMISSIONS.STAFF_MANAGE,
    BRANCH_PERMISSIONS.SETTINGS_VIEW,
    BRANCH_PERMISSIONS.SETTINGS_UPDATE,
    BRANCH_PERMISSIONS.REPORTS_VIEW,
    BRANCH_PERMISSIONS.REPORTS_EXPORT,
  ],
  staff: [
    BRANCH_PERMISSIONS.VIEW,
    BRANCH_PERMISSIONS.SALES_CREATE,
    BRANCH_PERMISSIONS.STOCK_RECEIVE,
    BRANCH_PERMISSIONS.REPORTS_VIEW,
  ],
  viewer: [
    BRANCH_PERMISSIONS.VIEW,
    BRANCH_PERMISSIONS.REPORTS_VIEW,
  ],
  // Uppercase aliases
  MANAGER: [],
  STAFF: [],
  VIEWER: [],
};
BRANCH_ROLE_PERMISSIONS.MANAGER = BRANCH_ROLE_PERMISSIONS.manager;
BRANCH_ROLE_PERMISSIONS.STAFF = BRANCH_ROLE_PERMISSIONS.staff;
BRANCH_ROLE_PERMISSIONS.VIEWER = BRANCH_ROLE_PERMISSIONS.viewer;

/**
 * Returns permissions for a workspace-level role.
 */
export function getWorkspacePermissionsForRole(role: string): string[] {
  const norm = (role || "member").toLowerCase();
  return WORKSPACE_ROLE_PERMISSIONS[norm] || WORKSPACE_ROLE_PERMISSIONS.member;
}

/**
 * Returns permissions for an application-level role.
 */
export function getApplicationPermissionsForRole(appKey: string, role: string): string[] {
  const normApp = (appKey || "inventory").toLowerCase();
  const normRole = (role || "member").toLowerCase();
  const appMap = APPLICATION_ROLE_PERMISSIONS[normApp] || APPLICATION_ROLE_PERMISSIONS.inventory;
  return appMap[normRole] || appMap.member || [];
}

/**
 * Returns permissions for a branch-level role.
 */
export function getBranchPermissionsForRole(role: string): string[] {
  const norm = (role || "staff").toLowerCase();
  return BRANCH_ROLE_PERMISSIONS[norm] || BRANCH_ROLE_PERMISSIONS.staff;
}

// Backward compatibility helper
export function permissionsForRole(role: string): string[] {
  return getWorkspacePermissionsForRole(role);
}

// ==========================================
// CANONICAL 3-TIER RESOLVER QUERY
// ==========================================

export const resolveWorkspacePermissions = query({
  args: {
    workspaceId: v.string(),
    userId: v.id("users"),
    applicationKey: v.optional(v.string()),
    branchId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const wsId = ctx.db.normalizeId("workspaces", args.workspaceId);
    let ws: any = null;
    if (wsId) {
      ws = await ctx.db.get(wsId);
    }

    // 1. Workspace membership
    let membership: any = null;
    if (wsId) {
      membership = await ctx.db
        .query("workspaceMemberships")
        .withIndex("by_workspace_user", (q: any) =>
          q.eq("workspaceId", wsId).eq("userId", args.userId)
        )
        .first();
    }
    if (!membership) {
      membership = await ctx.db
        .query("workspaceMemberships")
        .withIndex("by_workspace_user", (q: any) =>
          q.eq("workspaceId", args.workspaceId as any).eq("userId", args.userId)
        )
        .first();
    }

    const isOwner = ws && ws.ownerId === args.userId;
    if (!membership && !isOwner) {
      return {
        hasAccess: false,
        role: null,
        workspaceRole: null,
        membershipStatus: null,
        permissions: [],
        applicationAccess: null,
        branchAccess: null,
      };
    }

    const memStatus = (membership?.status || "active").toLowerCase();
    if (!isOwner && memStatus !== "active") {
      return {
        hasAccess: false,
        role: null,
        workspaceRole: membership?.role || null,
        membershipStatus: memStatus,
        permissions: [],
        applicationAccess: null,
        branchAccess: null,
      };
    }

    const wsRole = (membership?.role || (isOwner ? "owner" : "member")).toLowerCase();
    const resolvedPermissions = new Set<string>(getWorkspacePermissionsForRole(wsRole));

    // If owner, grant complete workspace/app/branch permissions
    if (wsRole === "owner") {
      for (const group of Object.values(INVENTORY_PERMISSIONS)) {
        resolvedPermissions.add(group);
      }
      for (const group of Object.values(BRANCH_PERMISSIONS)) {
        resolvedPermissions.add(group);
      }
    }

    // 2. Application membership check
    let applicationAccess: any = null;
    if (args.applicationKey) {
      const appKey = args.applicationKey.toLowerCase();
      const appMem = await ctx.db
        .query("applicationMemberships")
        .withIndex("by_workspace_user_app", (q: any) =>
          q.eq("workspaceId", wsId || args.workspaceId).eq("userId", args.userId).eq("applicationKey", appKey)
        )
        .first();

      if (appMem && appMem.status === "active") {
        const appRole = (appMem.role || "member").toLowerCase();
        const appPerms = appMem.permissions && appMem.permissions.length > 0
          ? appMem.permissions
          : getApplicationPermissionsForRole(appKey, appRole);

        for (const p of appPerms) {
          resolvedPermissions.add(p);
        }

        applicationAccess = {
          applicationKey: appKey,
          role: appRole,
          status: appMem.status,
          branchIds: appMem.branchIds || [],
          permissions: appPerms,
        };
      } else if (wsRole === "owner") {
        applicationAccess = {
          applicationKey: appKey,
          role: "admin",
          status: "active",
          branchIds: [],
          permissions: getApplicationPermissionsForRole(appKey, "admin"),
        };
      }
    }

    // 3. Branch assignment check
    let branchAccess: any = null;
    if (args.branchId) {
      const branchId = args.branchId;
      const bAssignment = await ctx.db
        .query("branchAssignments")
        .withIndex("by_workspace_user_branch", (q: any) =>
          q.eq("workspaceId", wsId || args.workspaceId).eq("userId", args.userId).eq("branchId", branchId)
        )
        .first();

      if (bAssignment && (!bAssignment.status || bAssignment.status === "active")) {
        const bRole = (bAssignment.role || "staff").toLowerCase();
        const bPerms = getBranchPermissionsForRole(bRole);
        for (const p of bPerms) {
          resolvedPermissions.add(p);
        }
        branchAccess = {
          branchId,
          role: bRole,
          status: bAssignment.status || "active",
          permissions: bPerms,
        };
      } else if (wsRole === "owner") {
        branchAccess = {
          branchId,
          role: "manager",
          status: "active",
          permissions: getBranchPermissionsForRole("manager"),
        };
      }
    }

    return {
      hasAccess: true,
      role: wsRole.toUpperCase(),
      workspaceRole: wsRole,
      membershipStatus: memStatus,
      permissions: Array.from(resolvedPermissions),
      applicationAccess,
      branchAccess,
    };
  },
});

/**
 * Direct check for a specific permission in workspace context
 */
export const checkUserPermission = query({
  args: {
    workspaceId: v.string(),
    userId: v.id("users"),
    permission: v.string(),
    applicationKey: v.optional(v.string()),
    branchId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const wsId = ctx.db.normalizeId("workspaces", args.workspaceId);
    let ws: any = null;
    if (wsId) {
      ws = await ctx.db.get(wsId);
    }
    if (ws && ws.ownerId === args.userId) {
      return { allowed: true, reason: "OWNER" };
    }

    let membership: any = null;
    if (wsId) {
      membership = await ctx.db
        .query("workspaceMemberships")
        .withIndex("by_workspace_user", (q: any) =>
          q.eq("workspaceId", wsId).eq("userId", args.userId)
        )
        .first();
    }
    if (!membership) {
      membership = await ctx.db
        .query("workspaceMemberships")
        .withIndex("by_workspace_user", (q: any) =>
          q.eq("workspaceId", args.workspaceId as any).eq("userId", args.userId)
        )
        .first();
    }

    if (!membership || membership.status !== "active") {
      return { allowed: false, reason: "NO_ACTIVE_MEMBERSHIP" };
    }

    const wsRole = (membership.role || "member").toLowerCase();
    const wsPerms = getWorkspacePermissionsForRole(wsRole);
    if (wsPerms.includes(args.permission)) {
      return { allowed: true, role: wsRole, tier: "workspace" };
    }

    if (args.applicationKey) {
      const appKey = args.applicationKey.toLowerCase();
      const appMem = await ctx.db
        .query("applicationMemberships")
        .withIndex("by_workspace_user_app", (q: any) =>
          q.eq("workspaceId", wsId || args.workspaceId).eq("userId", args.userId).eq("applicationKey", appKey)
        )
        .first();

      if (appMem && appMem.status === "active") {
        const appRole = (appMem.role || "member").toLowerCase();
        const appPerms = appMem.permissions && appMem.permissions.length > 0
          ? appMem.permissions
          : getApplicationPermissionsForRole(appKey, appRole);

        if (appPerms.includes(args.permission)) {
          if (args.branchId && appMem.branchIds && appMem.branchIds.length > 0) {
            if (!appMem.branchIds.includes(args.branchId)) {
              return { allowed: false, reason: "BRANCH_NOT_SCOPED" };
            }
          }
          return { allowed: true, role: appRole, tier: "application" };
        }
      }
    }

    if (args.branchId) {
      const bAssignment = await ctx.db
        .query("branchAssignments")
        .withIndex("by_workspace_user_branch", (q: any) =>
          q.eq("workspaceId", wsId || args.workspaceId).eq("userId", args.userId).eq("branchId", args.branchId)
        )
        .first();

      if (bAssignment && (!bAssignment.status || bAssignment.status === "active")) {
        const bRole = (bAssignment.role || "staff").toLowerCase();
        const bPerms = getBranchPermissionsForRole(bRole);
        if (bPerms.includes(args.permission)) {
          return { allowed: true, role: bRole, tier: "branch" };
        }
      }
    }

    return { allowed: false, reason: "PERMISSION_NOT_GRANTED" };
  },
});
