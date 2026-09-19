import { query, mutation } from "./_generated/server.js";
import { v } from "convex/values";
import { resolveOrganization } from "./applications.js";

/**
 * Base Application Role Permission Definitions
 */
const APP_ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: [
    "team.manage",
    "team.invite",
    "team.transfer",
    "team.remove",
    "roles.manage",
    "branches.manage",
    "inventory.view",
    "inventory.create",
    "inventory.edit",
    "inventory.delete",
    "inventory.adjust",
    "pos.checkout",
    "reports.view",
    "settings.manage",
  ],
  member: [
    "inventory.view",
    "inventory.create",
    "inventory.edit",
    "pos.checkout",
    "reports.view",
  ],
  viewer: [
    "inventory.view",
    "reports.view",
  ],
};

/**
 * Branch-Specific Role Permission Additions
 */
const BRANCH_ROLE_PERMISSIONS: Record<string, string[]> = {
  manager: [
    "branch.manage",
    "branch.staff.view",
    "branch.staff.assign",
    "inventory.view",
    "inventory.create",
    "inventory.edit",
    "inventory.adjust",
    "inventory.transfer",
    "pos.checkout",
    "pos.refund",
    "reports.view",
  ],
  staff: [
    "inventory.view",
    "inventory.create",
    "inventory.edit",
    "pos.checkout",
  ],
  cashier: [
    "pos.checkout",
    "inventory.view",
  ],
  stock_manager: [
    "inventory.view",
    "inventory.create",
    "inventory.edit",
    "inventory.adjust",
    "inventory.transfer",
  ],
  accountant: [
    "reports.view",
    "inventory.view",
    "pos.view",
  ],
  viewer: [
    "inventory.view",
    "reports.view",
  ],
};

/**
 * Helper to normalize workspace ID
 */
function resolveWsId(ctx: any, raw: string) {
  return ctx.db.normalizeId("workspaces", raw) || raw;
}

/**
 * 1. Calculate Effective Permissions for a User in an Application and Optional Branch
 */
export const calculateEffectivePermissions = query({
  args: {
    workspaceId: v.string(),
    userId: v.id("users"),
    applicationKey: v.string(),
    branchId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const wsId = resolveWsId(ctx, args.workspaceId);

    // 1. Check workspace membership (legacy fallback / owner / admin bypass)
    const wsMem = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_workspace_user", (q: any) => q.eq("workspaceId", wsId).eq("userId", args.userId))
      .first();

    const isWsOwner = wsMem && (wsMem.role || "").toLowerCase() === "owner";
    const isWsAdmin = wsMem && (wsMem.role || "").toLowerCase() === "admin";

    if (isWsOwner || isWsAdmin) {
      return {
        isOwner: isWsOwner,
        isAdmin: true,
        appRole: "admin",
        branchRoles: {},
        effectivePermissions: [
          ...APP_ROLE_PERMISSIONS.admin,
          ...BRANCH_ROLE_PERMISSIONS.manager,
          "superadmin.full",
        ],
        branchAssignments: [],
      };
    }

    // 2. Load Application Membership
    const appMem = await ctx.db
      .query("applicationMemberships")
      .withIndex("by_workspace_user_app", (q: any) =>
        q.eq("workspaceId", wsId).eq("userId", args.userId).eq("applicationKey", args.applicationKey)
      )
      .first();

    const appRole = appMem?.appRole || appMem?.role || (wsMem?.role === "member" ? "member" : "viewer");
    const appPermissions = APP_ROLE_PERMISSIONS[appRole] || APP_ROLE_PERMISSIONS.viewer;
    const customAppPerms = appMem?.customPermissions || appMem?.permissions || [];

    // 3. Load Branch Assignments
    const now = Date.now();
    const branchAssignments = await ctx.db
      .query("branchAssignments")
      .withIndex("by_user_workspace", (q: any) => q.eq("userId", args.userId).eq("workspaceId", wsId))
      .collect();

    const activeAssignments = branchAssignments.filter((b) => {
      const isAppMatch = !b.applicationKey || b.applicationKey === args.applicationKey;
      const isActive = !b.status || b.status === "active";
      const notExpired = !b.temporaryUntil || b.temporaryUntil > now;
      return isAppMatch && isActive && notExpired;
    });

    const branchRoleMap: Record<string, string> = {};
    const branchPermsSet = new Set<string>();

    for (const assignment of activeAssignments) {
      const bRole = (assignment.branchRole || assignment.role || "staff").toLowerCase();
      branchRoleMap[String(assignment.branchId)] = bRole;

      const perms = BRANCH_ROLE_PERMISSIONS[bRole] || BRANCH_ROLE_PERMISSIONS.staff;
      for (const p of perms) {
        branchPermsSet.add(p);
      }

      if (assignment.customPermissions) {
        for (const cp of assignment.customPermissions) {
          branchPermsSet.add(cp);
        }
      }
    }

    // Combine all permissions (Union of App Role Base + Branch Roles + Custom Overrides)
    const effectiveSet = new Set<string>([
      ...appPermissions,
      ...customAppPerms,
      ...Array.from(branchPermsSet),
    ]);

    return {
      isOwner: false,
      isAdmin: appRole === "admin",
      appRole,
      branchRoles: branchRoleMap,
      effectivePermissions: Array.from(effectiveSet),
      branchAssignments: activeAssignments,
    };
  },
});

/**
 * 2. List Application Team Members
 */
export const listApplicationMembers = query({
  args: {
    workspaceId: v.string(),
    applicationKey: v.string(),
    branchId: v.optional(v.string()),
    status: v.optional(v.string()),
    searchQuery: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { org, orgId, workspace, workspaceId } = await resolveOrganization(ctx, args.workspaceId);
    const targetWsId = workspaceId || ctx.db.normalizeId("workspaces", args.workspaceId);
    const now = Date.now();

    // 1. Gather all branches for this organization / workspace
    let rawBranches: any[] = [];
    if (orgId) {
      try {
        const orgBranches = await ctx.db
          .query("branches")
          .withIndex("by_organizationId", (q: any) => q.eq("organizationId", orgId))
          .collect();
        rawBranches.push(...orgBranches);
      } catch {}
    }
    if (targetWsId) {
      try {
        const wsBranches = await ctx.db
          .query("branches")
          .withIndex("by_workspace", (q: any) => q.eq("workspaceId", targetWsId))
          .collect();
        rawBranches.push(...wsBranches);
      } catch {}
    }
    if (args.workspaceId) {
      try {
        const directBranches = await ctx.db
          .query("branches")
          .filter((q: any) => q.eq(q.field("workspaceId"), args.workspaceId))
          .collect();
        rawBranches.push(...directBranches);
      } catch {}
    }

    const seenBranchIds = new Set<string>();
    const branches = rawBranches.filter((b) => {
      const bId = String(b._id);
      if (seenBranchIds.has(bId)) return false;
      seenBranchIds.add(bId);
      return b.status !== "ARCHIVED" && b.status !== "deleted";
    });

    const primaryBranch = branches.find((b) => b.isPrimary) || branches[0] || null;
    const branchMap = new Map(branches.map((b) => [String(b._id), b]));

    // 2. Fetch all branch assignments and memberships across org and workspace
    let allBranchAssignments: any[] = [];
    let allBranchMemberships: any[] = [];
    let appMembers: any[] = [];
    let wsMembers: any[] = [];
    let orgMembers: any[] = [];

    if (targetWsId) {
      try {
        const res = await ctx.db
          .query("branchAssignments")
          .withIndex("by_workspace", (q: any) => q.eq("workspaceId", targetWsId))
          .collect();
        allBranchAssignments.push(...res);
      } catch {}

      try {
        const res = await ctx.db
          .query("applicationMemberships")
          .withIndex("by_workspace_app", (q: any) =>
            q.eq("workspaceId", targetWsId).eq("applicationKey", args.applicationKey)
          )
          .collect();
        appMembers.push(...res);
      } catch {}

      try {
        const res = await ctx.db
          .query("workspaceMemberships")
          .withIndex("by_workspace", (q: any) => q.eq("workspaceId", targetWsId))
          .collect();
        wsMembers.push(...res);
      } catch {}

      try {
        const res = await ctx.db
          .query("branchMemberships")
          .withIndex("by_workspace_application", (q: any) =>
            q.eq("workspaceId", String(targetWsId)).eq("applicationKey", args.applicationKey)
          )
          .collect();
        allBranchMemberships.push(...res);
      } catch {}
    }

    if (orgId) {
      try {
        const res = await ctx.db
          .query("organizationMemberships")
          .withIndex("by_organizationId", (q: any) => q.eq("organizationId", orgId))
          .collect();
        orgMembers.push(...res);
      } catch {}

      try {
        const res = await ctx.db
          .query("branchMemberships")
          .filter((q: any) => q.eq(q.field("organizationId"), orgId))
          .collect();
        allBranchMemberships.push(...res);
      } catch {}
    }

    // 3. Aggregate unique users
    const userRoleMap = new Map<string, {
      userId: any;
      appRole: string;
      role: string;
      isOwner: boolean;
      isFounder: boolean;
      status: string;
      jobTitle?: string;
      addedAt: number;
    }>();

    const ownerId = org?.ownerId || workspace?.ownerId;

    // 3a. Org Owner / Workspace Owner (Founder)
    if (org?.ownerId) {
      const uId = String(org.ownerId);
      userRoleMap.set(uId, {
        userId: org.ownerId,
        appRole: "admin",
        role: "owner",
        isOwner: true,
        isFounder: true,
        status: "active",
        jobTitle: "Branch Founder",
        addedAt: org.createdAt || Date.now(),
      });
    }

    if (workspace?.ownerId) {
      const uId = String(workspace.ownerId);
      const existing = userRoleMap.get(uId);
      if (!existing) {
        userRoleMap.set(uId, {
          userId: workspace.ownerId,
          appRole: "admin",
          role: "owner",
          isOwner: true,
          isFounder: true,
          status: "active",
          jobTitle: "Branch Founder",
          addedAt: workspace.createdAt || Date.now(),
        });
      } else {
        existing.isOwner = true;
        existing.isFounder = true;
        existing.appRole = "admin";
      }
    }

    // 3b. Organization Members
    for (const om of orgMembers) {
      const uId = String(om.userId);
      const isOwner = (om.role || "").toUpperCase() === "OWNER" || uId === String(ownerId);
      const isAdmin = isOwner || (om.role || "").toUpperCase() === "ADMIN" || (om.role || "").toUpperCase() === "MANAGER";
      const existing = userRoleMap.get(uId);
      if (!existing) {
        userRoleMap.set(uId, {
          userId: om.userId,
          appRole: isOwner ? "admin" : isAdmin ? "admin" : "member",
          role: om.role || "member",
          isOwner,
          isFounder: isOwner,
          status: (om.status || "active").toLowerCase(),
          jobTitle: isOwner ? "Branch Founder" : undefined,
          addedAt: om.joinedAt || om.createdAt || Date.now(),
        });
      } else if (isOwner) {
        existing.isOwner = true;
        existing.isFounder = true;
        existing.appRole = "admin";
      }
    }

    // 3c. Workspace Members
    for (const wm of wsMembers) {
      const uId = String(wm.userId);
      const isOwner = (wm.role || "").toUpperCase() === "OWNER" || uId === String(ownerId);
      const isAdmin = isOwner || (wm.role || "").toUpperCase() === "ADMIN" || (wm.role || "").toUpperCase() === "MANAGER";
      const existing = userRoleMap.get(uId);
      if (!existing) {
        userRoleMap.set(uId, {
          userId: wm.userId,
          appRole: isOwner ? "admin" : isAdmin ? "admin" : "member",
          role: wm.role || "member",
          isOwner,
          isFounder: isOwner,
          status: (wm.status || "active").toLowerCase(),
          jobTitle: isOwner ? "Branch Founder" : undefined,
          addedAt: wm.acceptedAt || wm.createdAt || Date.now(),
        });
      } else if (isOwner) {
        existing.isOwner = true;
        existing.isFounder = true;
        existing.appRole = "admin";
      }
    }

    // 3d. Application Members
    for (const am of appMembers) {
      const uId = String(am.userId);
      const isOwner = uId === String(ownerId) || am.appRole === "owner";
      const isAdmin = isOwner || am.appRole === "admin";
      const existing = userRoleMap.get(uId);
      if (!existing) {
        userRoleMap.set(uId, {
          userId: am.userId,
          appRole: isOwner ? "admin" : isAdmin ? "admin" : "member",
          role: am.appRole || "member",
          isOwner,
          isFounder: isOwner,
          status: (am.status || "active").toLowerCase(),
          jobTitle: isOwner ? "Branch Founder" : am.jobTitle,
          addedAt: am.addedAt || am.createdAt || Date.now(),
        });
      } else if (isOwner) {
        existing.isOwner = true;
        existing.isFounder = true;
        existing.appRole = "admin";
      }
    }

    // 3e. Branch Memberships
    for (const bm of allBranchMemberships) {
      const uId = String(bm.userId);
      const isOwner = uId === String(ownerId) || bm.role === "inventory_owner" || bm.role === "OWNER";
      const isAdmin = isOwner || bm.role === "inventory_manager" || bm.role === "ADMIN" || bm.role === "manager";
      const existing = userRoleMap.get(uId);
      if (!existing) {
        userRoleMap.set(uId, {
          userId: bm.userId,
          appRole: isOwner ? "admin" : isAdmin ? "admin" : "member",
          role: bm.role || "member",
          isOwner,
          isFounder: isOwner,
          status: (bm.status || "active").toLowerCase(),
          jobTitle: isOwner ? "Branch Founder" : bm.jobTitle,
          addedAt: bm.assignedAt || bm.createdAt || Date.now(),
        });
      } else if (isOwner) {
        existing.isOwner = true;
        existing.isFounder = true;
        existing.appRole = "admin";
      }
    }

    // 4. Build enriched team members with branch assignments
    const enriched: any[] = [];

    for (const [uId, uMeta] of userRoleMap.entries()) {
      let user: any = null;
      try {
        const normalized = ctx.db.normalizeId("users", uMeta.userId);
        if (normalized) user = await ctx.db.get(normalized);
      } catch {}

      if (!user && typeof uMeta.userId === "string" && uMeta.userId.includes("@")) {
        try {
          user = await ctx.db
            .query("users")
            .withIndex("by_email", (q: any) => q.eq("emailNormalized", uMeta.userId.toLowerCase().trim()))
            .first();
        } catch {}
      }

      // Collect branch assignments for this user
      const userAssignments: any[] = [];
      const seenAssignmentBranchIds = new Set<string>();

      // From branchAssignments table
      allBranchAssignments
        .filter((a) => {
          const isUser = String(a.userId) === uId;
          const isApp = !a.applicationKey || a.applicationKey === args.applicationKey;
          const notExpired = !a.temporaryUntil || a.temporaryUntil > now;
          return isUser && isApp && notExpired;
        })
        .forEach((a) => {
          const bId = String(a.branchId);
          if (!seenAssignmentBranchIds.has(bId)) {
            seenAssignmentBranchIds.add(bId);
            const bData = branchMap.get(bId);
            userAssignments.push({
              id: a._id,
              branchId: bId,
              branchName: bData?.name || a.branchName || "Branch Location",
              branchCode: bData?.code || a.branchCode || "",
              branchRole: a.branchRole || a.role || (uMeta.isFounder ? "Founder" : "staff"),
              assignmentType: a.assignmentType || "primary",
              temporaryUntil: a.temporaryUntil,
              assignedAt: a.assignedAt || a.grantedAt || a.createdAt,
            });
          }
        });

      // From branchMemberships table
      allBranchMemberships
        .filter((bm) => String(bm.userId) === uId)
        .forEach((bm) => {
          const bId = String(bm.branchId);
          if (!seenAssignmentBranchIds.has(bId)) {
            seenAssignmentBranchIds.add(bId);
            const bData = branchMap.get(bId);
            userAssignments.push({
              id: bm._id,
              branchId: bId,
              branchName: bData?.name || bm.branchName || "Branch Location",
              branchCode: bData?.code || bm.branchCode || "",
              branchRole: bm.role ? bm.role.replace("inventory_", "").replace("_", " ") : (uMeta.isFounder ? "Founder" : "staff"),
              assignmentType: bm.assignmentType || "primary",
              temporaryUntil: bm.temporaryUntil,
              assignedAt: bm.assignedAt || bm.createdAt,
            });
          }
        });

      // For Founder/Owner: Ensure they have branch assignments across all branches
      if (uMeta.isFounder || uMeta.isOwner) {
        branches.forEach((b) => {
          const bId = String(b._id);
          if (!seenAssignmentBranchIds.has(bId)) {
            seenAssignmentBranchIds.add(bId);
            userAssignments.push({
              id: `founder_${uId}_${bId}`,
              branchId: bId,
              branchName: b.name || "Branch Location",
              branchCode: b.code || "MAIN",
              branchRole: "Founder",
              assignmentType: b.isPrimary ? "primary" : "secondary",
              assignedAt: uMeta.addedAt,
            });
          }
        });
      }

      // Fallback: If no explicit branch assignment yet, assign to active/primary branch
      if (userAssignments.length === 0 && primaryBranch) {
        const bId = String(primaryBranch._id);
        seenAssignmentBranchIds.add(bId);
        userAssignments.push({
          id: `synth_${uId}_${bId}`,
          branchId: bId,
          branchName: primaryBranch.name || "Main Branch",
          branchCode: primaryBranch.code || "",
          branchRole: uMeta.isFounder ? "Founder / Manager" : (uMeta.role ? uMeta.role.replace("inventory_", "").replace("_", " ") : "staff"),
          assignmentType: "primary",
          assignedAt: uMeta.addedAt,
        });
      }

      // Filter by specific branchId if requested
      if (args.branchId && args.branchId !== "all") {
        const hasBranch = userAssignments.some((a) => a.branchId === args.branchId);
        if (!hasBranch) continue;
      }

      // Filter by status
      if (args.status && args.status !== "all") {
        if ((uMeta.status || "active") !== args.status) continue;
      }

      const resolvedName = user?.name || user?.displayName || (user?.email ? user.email.split("@")[0] : "") || "Team Member";
      const resolvedEmail = user?.email || (typeof uMeta.userId === "string" && uMeta.userId.includes("@") ? uMeta.userId : "");

      // Filter by search query
      if (args.searchQuery) {
        const q = args.searchQuery.toLowerCase();
        const userName = resolvedName.toLowerCase();
        const userEmail = resolvedEmail.toLowerCase();
        const jobTitle = (uMeta.jobTitle || "").toLowerCase();
        if (!userName.includes(q) && !userEmail.includes(q) && !jobTitle.includes(q)) {
          continue;
        }
      }

      enriched.push({
        id: uMeta.userId,
        userId: uMeta.userId,
        name: resolvedName,
        email: resolvedEmail,
        avatar: user?.avatar || user?.avatarUrl,
        jobTitle: uMeta.jobTitle || (uMeta.isFounder ? "Founder" : user?.jobTitle || ""),
        employeeId: user?.employeeId || "",
        phoneNumber: user?.phone || user?.phoneNumber || "",
        appRole: uMeta.isFounder ? "admin" : uMeta.appRole,
        role: uMeta.role,
        isOwner: uMeta.isOwner,
        isFounder: uMeta.isFounder,
        status: uMeta.status || "active",
        branchAssignments: userAssignments,
        addedAt: uMeta.addedAt,
      });
    }

    return enriched;
  },
});

/**
 * 3. Get Single Member Details
 */
export const getApplicationMember = query({
  args: {
    workspaceId: v.string(),
    applicationKey: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { org, orgId, workspace, workspaceId } = await resolveOrganization(ctx, args.workspaceId);
    const targetWsId = workspaceId || ctx.db.normalizeId("workspaces", args.workspaceId);
    const now = Date.now();

    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("USER_NOT_FOUND");

    const ownerId = org?.ownerId || workspace?.ownerId;
    const isOwner = String(args.userId) === String(ownerId);

    // Fetch branches for name resolution
    let rawBranches: any[] = [];
    if (orgId) {
      try {
        const orgB = await ctx.db
          .query("branches")
          .withIndex("by_organizationId", (q: any) => q.eq("organizationId", orgId))
          .collect();
        rawBranches.push(...orgB);
      } catch {}
    }
    if (targetWsId) {
      try {
        const wsB = await ctx.db
          .query("branches")
          .withIndex("by_workspace", (q: any) => q.eq("workspaceId", targetWsId))
          .collect();
        rawBranches.push(...wsB);
      } catch {}
    }
    const branchMap = new Map(rawBranches.map((b) => [String(b._id), b]));
    const primaryBranch = rawBranches[0] || null;

    let branchAssignments: any[] = [];
    if (targetWsId) {
      try {
        const res = await ctx.db
          .query("branchAssignments")
          .withIndex("by_user_workspace", (q: any) => q.eq("userId", args.userId).eq("workspaceId", targetWsId))
          .collect();
        branchAssignments.push(...res);
      } catch {}
    }

    const enrichedAssignments = branchAssignments
      .filter((a) => !a.applicationKey || a.applicationKey === args.applicationKey)
      .map((a) => {
        const b = branchMap.get(String(a.branchId));
        return {
          id: a._id,
          branchId: String(a.branchId),
          branchName: b?.name || "Branch Location",
          branchCode: b?.code || "",
          branchRole: a.branchRole || a.role || (isOwner ? "Founder" : "staff"),
          assignmentType: a.assignmentType || "secondary",
          temporaryUntil: a.temporaryUntil,
          isExpired: Boolean(a.temporaryUntil && a.temporaryUntil <= now),
          assignedAt: a.assignedAt || a.createdAt,
        };
      });

    if (enrichedAssignments.length === 0 && primaryBranch) {
      enrichedAssignments.push({
        id: `synth_${args.userId}_${primaryBranch._id}`,
        branchId: String(primaryBranch._id),
        branchName: primaryBranch.name || "Main Branch",
        branchCode: primaryBranch.code || "",
        branchRole: isOwner ? "Founder / Manager" : "staff",
        assignmentType: "primary",
        assignedAt: Date.now(),
      });
    }

    // Fetch Audit Logs for this member
    let auditLogs: any[] = [];
    try {
      auditLogs = await ctx.db
        .query("membershipAuditLogs")
        .withIndex("by_target", (q: any) => q.eq("targetUserId", args.userId))
        .collect();
    } catch {}

    return {
      userId: user._id,
      name: user.name || user.displayName || "Team Member",
      email: user.email,
      avatar: user.avatar || user.avatarUrl,
      appRole: isOwner ? "admin" : "member",
      role: isOwner ? "owner" : "member",
      isOwner,
      isFounder: isOwner,
      status: "active",
      jobTitle: isOwner ? "Branch Founder" : user.jobTitle || "",
      employeeId: user.employeeId || "",
      phoneNumber: user.phone || user.phoneNumber || "",
      customPermissions: [],
      branchAssignments: enrichedAssignments,
      auditLogs: auditLogs.filter((l) => !targetWsId || l.workspaceId === targetWsId),
      createdAt: user.createdAt,
    };
  },
});

/**
 * 4. Add / Provision Member to Application with Branch Assignments
 */
export const addApplicationMember = mutation({
  args: {
    workspaceId: v.string(),
    callerUserId: v.id("users"),
    targetUserId: v.id("users"),
    applicationKey: v.string(),
    appRole: v.union(v.literal("admin"), v.literal("member"), v.literal("viewer")),
    jobTitle: v.optional(v.string()),
    employeeId: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    branchAssignments: v.optional(
      v.array(
        v.object({
          branchId: v.string(),
          branchRole: v.union(
            v.literal("manager"),
            v.literal("staff"),
            v.literal("viewer"),
            v.literal("accountant")
          ),
          assignmentType: v.optional(
            v.union(v.literal("primary"), v.literal("secondary"), v.literal("temporary"))
          ),
          temporaryUntil: v.optional(v.number()),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    const wsId = resolveWsId(ctx, args.workspaceId);
    const now = Date.now();

    // Check plan capacity
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_workspace", (q: any) => q.eq("workspaceId", wsId))
      .first();

    const planKey = (sub?.planKey || "free_trial").toLowerCase();
    const maxMembers = planKey === "premium" ? 50 : planKey === "standard" ? 10 : 2;

    const existingMembers = await ctx.db
      .query("applicationMemberships")
      .withIndex("by_workspace_app", (q: any) =>
        q.eq("workspaceId", wsId).eq("applicationKey", args.applicationKey)
      )
      .collect();

    const activeCount = existingMembers.filter((m) => m.status === "active").length;
    if (activeCount >= maxMembers) {
      throw new Error("PLAN_MEMBER_LIMIT_REACHED");
    }

    // Check existing
    const existing = await ctx.db
      .query("applicationMemberships")
      .withIndex("by_workspace_user_app", (q: any) =>
        q.eq("workspaceId", wsId).eq("userId", args.targetUserId).eq("applicationKey", args.applicationKey)
      )
      .first();

    let membershipId;
    if (existing) {
      await ctx.db.patch(existing._id, {
        appRole: args.appRole,
        role: args.appRole,
        status: "active",
        jobTitle: args.jobTitle,
        employeeId: args.employeeId,
        phoneNumber: args.phoneNumber,
        updatedAt: now,
      });
      membershipId = existing._id;
    } else {
      membershipId = await ctx.db.insert("applicationMemberships", {
        workspaceId: wsId,
        userId: args.targetUserId,
        applicationKey: args.applicationKey,
        appRole: args.appRole,
        role: args.appRole,
        status: "active",
        addedBy: args.callerUserId,
        addedAt: now,
        jobTitle: args.jobTitle,
        employeeId: args.employeeId,
        phoneNumber: args.phoneNumber,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Add branch assignments
    if (args.branchAssignments && args.branchAssignments.length > 0) {
      for (const ba of args.branchAssignments) {
        const bId = ctx.db.normalizeId("branches", ba.branchId) || ba.branchId;
        const existingBA = await ctx.db
          .query("branchAssignments")
          .withIndex("by_workspace_user_branch", (q: any) =>
            q.eq("workspaceId", wsId).eq("userId", args.targetUserId).eq("branchId", bId)
          )
          .first();

        if (existingBA) {
          await ctx.db.patch(existingBA._id, {
            applicationKey: args.applicationKey,
            branchRole: ba.branchRole,
            role: ba.branchRole,
            assignmentType: ba.assignmentType || "primary",
            temporaryUntil: ba.temporaryUntil,
            status: "active",
            assignedBy: args.callerUserId,
            assignedAt: now,
            updatedAt: now,
          });
        } else {
          await ctx.db.insert("branchAssignments", {
            workspaceId: wsId,
            userId: args.targetUserId,
            applicationKey: args.applicationKey,
            branchId: bId as any,
            branchRole: ba.branchRole,
            role: ba.branchRole,
            assignmentType: ba.assignmentType || "primary",
            temporaryUntil: ba.temporaryUntil,
            status: "active",
            assignedBy: args.callerUserId,
            assignedAt: now,
            createdAt: now,
            updatedAt: now,
          });
        }
      }
    }

    // Audit Log
    await ctx.db.insert("membershipAuditLogs", {
      workspaceId: wsId,
      actorUserId: args.callerUserId,
      targetUserId: args.targetUserId,
      actionType: "app_member_added",
      membershipType: "application",
      membershipId: String(membershipId),
      applicationKey: args.applicationKey,
      newRole: args.appRole,
      createdAt: now,
    });

    return { success: true, membershipId };
  },
});

/**
 * 5. Transfer Staff Member Across Branches (Atomic Transfer)
 */
export const transferBranchStaff = mutation({
  args: {
    workspaceId: v.string(),
    callerUserId: v.id("users"),
    targetUserId: v.id("users"),
    applicationKey: v.string(),
    sourceBranchId: v.string(),
    targetBranchId: v.string(),
    newBranchRole: v.union(
      v.literal("manager"),
      v.literal("staff"),
      v.literal("viewer"),
      v.literal("accountant")
    ),
    assignmentType: v.union(
      v.literal("primary"),
      v.literal("secondary"),
      v.literal("temporary")
    ),
    temporaryUntil: v.optional(v.number()),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const wsId = resolveWsId(ctx, args.workspaceId);
    const now = Date.now();
    const sourceBId = ctx.db.normalizeId("branches", args.sourceBranchId) || args.sourceBranchId;
    const targetBId = ctx.db.normalizeId("branches", args.targetBranchId) || args.targetBranchId;

    // 1. Find source branch assignment
    const sourceBA = await ctx.db
      .query("branchAssignments")
      .withIndex("by_workspace_user_branch", (q: any) =>
        q.eq("workspaceId", wsId).eq("userId", args.targetUserId).eq("branchId", sourceBId)
      )
      .first();

    const previousRole = sourceBA?.branchRole || sourceBA?.role || "staff";

    // 2. If permanent transfer, remove/deactivate source assignment
    if (args.assignmentType === "primary" && sourceBA) {
      await ctx.db.delete(sourceBA._id);
    }

    // 3. Upsert destination branch assignment
    const targetBA = await ctx.db
      .query("branchAssignments")
      .withIndex("by_workspace_user_branch", (q: any) =>
        q.eq("workspaceId", wsId).eq("userId", args.targetUserId).eq("branchId", targetBId)
      )
      .first();

    let targetAssignmentId;
    if (targetBA) {
      await ctx.db.patch(targetBA._id, {
        applicationKey: args.applicationKey,
        branchRole: args.newBranchRole,
        role: args.newBranchRole,
        assignmentType: args.assignmentType,
        temporaryUntil: args.temporaryUntil,
        status: "active",
        assignedBy: args.callerUserId,
        assignedAt: now,
        updatedAt: now,
      });
      targetAssignmentId = targetBA._id;
    } else {
      targetAssignmentId = await ctx.db.insert("branchAssignments", {
        workspaceId: wsId,
        userId: args.targetUserId,
        applicationKey: args.applicationKey,
        branchId: targetBId as any,
        branchRole: args.newBranchRole,
        role: args.newBranchRole,
        assignmentType: args.assignmentType,
        temporaryUntil: args.temporaryUntil,
        status: "active",
        assignedBy: args.callerUserId,
        assignedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }

    // 4. Record transfer ledger
    await ctx.db.insert("branchTransfers", {
      workspaceId: wsId,
      applicationKey: args.applicationKey,
      userId: args.targetUserId,
      sourceBranchId: String(sourceBId),
      targetBranchId: String(targetBId),
      previousRole,
      newRole: args.newBranchRole,
      reason: args.reason,
      transferredBy: args.callerUserId,
      effectiveDate: now,
      createdAt: now,
    });

    // 5. Record audit log
    await ctx.db.insert("membershipAuditLogs", {
      workspaceId: wsId,
      actorUserId: args.callerUserId,
      targetUserId: args.targetUserId,
      actionType: "branch_staff_transferred",
      membershipType: "branch",
      membershipId: String(targetAssignmentId),
      applicationKey: args.applicationKey,
      branchId: targetBId as any,
      previousRole,
      newRole: args.newBranchRole,
      reason: args.reason,
      createdAt: now,
    });

    return { success: true, targetAssignmentId };
  },
});

/**
 * 6. Suspend / Restore / Remove Application Member
 */
export const setMemberStatus = mutation({
  args: {
    workspaceId: v.string(),
    callerUserId: v.id("users"),
    targetUserId: v.id("users"),
    applicationKey: v.string(),
    status: v.union(v.literal("active"), v.literal("suspended"), v.literal("removed")),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const wsId = resolveWsId(ctx, args.workspaceId);
    const now = Date.now();

    const mem = await ctx.db
      .query("applicationMemberships")
      .withIndex("by_workspace_user_app", (q: any) =>
        q.eq("workspaceId", wsId).eq("userId", args.targetUserId).eq("applicationKey", args.applicationKey)
      )
      .first();

    if (mem) {
      await ctx.db.patch(mem._id, {
        status: args.status,
        suspendedAt: args.status === "suspended" ? now : undefined,
        suspensionReason: args.status === "suspended" ? args.reason : undefined,
        removedAt: args.status === "removed" ? now : undefined,
        removalReason: args.status === "removed" ? args.reason : undefined,
        updatedAt: now,
      });
    }

    // Also update all branch assignments
    const assignments = await ctx.db
      .query("branchAssignments")
      .withIndex("by_user_workspace", (q: any) => q.eq("userId", args.targetUserId).eq("workspaceId", wsId))
      .collect();

    for (const ba of assignments) {
      if (!ba.applicationKey || ba.applicationKey === args.applicationKey) {
        await ctx.db.patch(ba._id, {
          status: args.status,
          updatedAt: now,
        });
      }
    }

    // Audit Log
    await ctx.db.insert("membershipAuditLogs", {
      workspaceId: wsId,
      actorUserId: args.callerUserId,
      targetUserId: args.targetUserId,
      actionType: `member_${args.status}`,
      membershipType: "application",
      membershipId: mem ? String(mem._id) : String(args.targetUserId),
      applicationKey: args.applicationKey,
      reason: args.reason,
      createdAt: now,
    });

    return { success: true };
  },
});
