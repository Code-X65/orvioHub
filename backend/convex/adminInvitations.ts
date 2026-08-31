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
    resourceType: "invitations",
    resourceId,
    details,
    createdAt: Date.now(),
  });
}

/**
 * listInvitations
 * Paginated list of invitations with organization & inviter details
 */
export const listInvitations = query({
  args: {
    sessionToken: v.string(),
    search: v.optional(v.string()),
    statusFilter: v.optional(v.string()),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await verifyAdminSession(ctx, args.sessionToken);

    const now = Date.now();
    let invites = await ctx.db.query("workspaceInvitations").collect();

    // 1. Search Filter
    if (args.search && args.search.trim()) {
      const q = args.search.toLowerCase().trim();
      invites = invites.filter((inv: any) => (inv.email || "").toLowerCase().includes(q));
    }

    // 2. Status Filter
    if (args.statusFilter && args.statusFilter !== "all") {
      const targetStatus = args.statusFilter.toUpperCase();
      invites = invites.filter((inv: any) => {
        if (targetStatus === "EXPIRED") {
          return inv.expiresAt < now && inv.status !== "ACCEPTED";
        }
        return inv.status === targetStatus;
      });
    }

    invites.sort((a, b) => b.createdAt - a.createdAt);

    const totalCount = invites.length;
    const page = Math.max(1, args.page || 1);
    const pageSize = Math.min(100, Math.max(1, args.pageSize || 10));
    const offset = (page - 1) * pageSize;
    const paginated = invites.slice(offset, offset + pageSize);

    const items = [];
    for (const inv of paginated) {
      const ws = await ctx.db.get(inv.workspaceId);
      const inviter = await ctx.db.get(inv.invitedBy);

      const isExpired = inv.expiresAt < now && inv.status !== "ACCEPTED";
      const displayStatus = isExpired ? "EXPIRED" : inv.status;

      items.push({
        id: inv._id,
        email: inv.email,
        workspaceId: inv.workspaceId,
        organizationName: ws?.name || "Workspace",
        inviterName: inviter?.name || inviter?.displayName || "Team Member",
        role: inv.role,
        productKey: inv.productKey || "general",
        status: displayStatus,
        expiresAt: inv.expiresAt,
        createdAt: inv.createdAt,
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
 * resendInvitation
 * Extends expiration and dispatches invitation email
 */
export const resendInvitation = mutation({
  args: {
    sessionToken: v.string(),
    invitationId: v.id("workspaceInvitations"),
  },
  handler: async (ctx, args) => {
    const { admin } = await verifyAdminSession(ctx, args.sessionToken);

    const inv = await ctx.db.get(args.invitationId);
    if (!inv) throw new Error("Invitation not found.");

    const now = Date.now();
    const newExpiresAt = now + 7 * 24 * 60 * 60 * 1000; // 7 days

    await ctx.db.patch(args.invitationId, {
      expiresAt: newExpiresAt,
      status: "PENDING",
    });

    await logAudit(ctx, admin._id, "INVITATION_RESENT", args.invitationId, {
      email: inv.email,
      workspaceId: inv.workspaceId,
    });

    return { success: true, expiresAt: newExpiresAt };
  },
});

/**
 * revokeInvitation
 * Revokes a pending workspace invitation
 */
export const revokeInvitation = mutation({
  args: {
    sessionToken: v.string(),
    invitationId: v.id("workspaceInvitations"),
  },
  handler: async (ctx, args) => {
    const { admin } = await verifyAdminSession(ctx, args.sessionToken);

    const inv = await ctx.db.get(args.invitationId);
    if (!inv) throw new Error("Invitation not found.");

    await ctx.db.patch(args.invitationId, {
      status: "REVOKED",
      revokedAt: Date.now(),
    });

    await logAudit(ctx, admin._id, "INVITATION_REVOKED", args.invitationId, {
      email: inv.email,
    });

    return { success: true };
  },
});

/**
 * extendInvitationExpiry
 * Extends invitation expiration by an additional 7 days
 */
export const extendInvitationExpiry = mutation({
  args: {
    sessionToken: v.string(),
    invitationId: v.id("workspaceInvitations"),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { admin } = await verifyAdminSession(ctx, args.sessionToken);

    const inv = await ctx.db.get(args.invitationId);
    if (!inv) throw new Error("Invitation not found.");

    const daysToAdd = args.days || 7;
    const newExpiry = Math.max(Date.now(), inv.expiresAt) + daysToAdd * 24 * 60 * 60 * 1000;

    await ctx.db.patch(args.invitationId, {
      expiresAt: newExpiry,
    });

    await logAudit(ctx, admin._id, "INVITATION_EXPIRY_EXTENDED", args.invitationId, {
      email: inv.email,
      newExpiresAt: newExpiry,
    });

    return { success: true, expiresAt: newExpiry };
  },
});

/**
 * acceptInvitationManually
 * Super admin action to manually accept an invitation for a registered user
 */
export const acceptInvitationManually = mutation({
  args: {
    sessionToken: v.string(),
    invitationId: v.id("workspaceInvitations"),
  },
  handler: async (ctx, args) => {
    const { admin } = await verifyAdminSession(ctx, args.sessionToken);

    const inv = await ctx.db.get(args.invitationId);
    if (!inv) throw new Error("Invitation not found.");

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", inv.email.toLowerCase()))
      .first();

    if (!user) {
      throw new Error(`Cannot manually accept: User ${inv.email} does not have an active account yet.`);
    }

    const now = Date.now();

    // Check if membership exists
    const existing = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", inv.workspaceId))
      .filter((q) => q.eq(q.field("userId"), user._id))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "active",
        role: inv.role,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("workspaceMemberships", {
        workspaceId: inv.workspaceId,
        userId: user._id,
        role: inv.role,
        status: "active",
        invitedBy: inv.invitedBy,
        invitedAt: inv.createdAt,
        acceptedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }

    await ctx.db.patch(args.invitationId, {
      status: "ACCEPTED",
      acceptedAt: now,
    });

    await logAudit(ctx, admin._id, "INVITATION_MANUALLY_ACCEPTED", args.invitationId, {
      email: inv.email,
      userId: user._id,
      workspaceId: inv.workspaceId,
    });

    return { success: true };
  },
});

/**
 * getInvitationStats
 * Returns invitation acceptance rate, breakdown by status and roles
 */
export const getInvitationStats = query({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    await verifyAdminSession(ctx, args.sessionToken);

    const now = Date.now();
    const invites = await ctx.db.query("workspaceInvitations").collect();

    const statusCounts: Record<string, number> = {
      pending: 0,
      accepted: 0,
      expired: 0,
      revoked: 0,
    };

    const roleCounts: Record<string, number> = {};

    for (const inv of invites) {
      const isExpired = inv.expiresAt < now && inv.status !== "ACCEPTED";
      const statusKey = isExpired ? "expired" : inv.status.toLowerCase();
      statusCounts[statusKey] = (statusCounts[statusKey] || 0) + 1;

      const role = inv.role || "MEMBER";
      roleCounts[role] = (roleCounts[role] || 0) + 1;
    }

    const total = invites.length;
    const acceptanceRate = total > 0 ? Math.round((statusCounts.accepted / total) * 100) : 0;

    return {
      total,
      acceptanceRate,
      byStatus: statusCounts,
      byRole: roleCounts,
    };
  },
});
