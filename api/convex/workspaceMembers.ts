import { query, mutation } from "./_generated/server.js";
import { v } from "convex/values";

export const getWorkspaceMembers = query({
  args: {
    workspaceId: v.id("workspaces"),
    callerUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // 1. Verify caller has membership
    const callerMembership = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", args.callerUserId)
      )
      .first();

    if (!callerMembership || callerMembership.status.toLowerCase() !== "active") {
      throw new Error("WORKSPACE_ACCESS_DENIED");
    }

    const memberships = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const productMemberships = await ctx.db
      .query("productMemberships")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const members = [];
    for (const m of memberships) {
      if (m.status.toLowerCase() === "removed") continue;

      const user = await ctx.db.get(m.userId);
      const userProductMemberships = productMemberships.filter(
        (pm) => pm.userId === m.userId && pm.status.toLowerCase() !== "removed"
      );

      members.push({
        id: m._id,
        userId: m.userId,
        name: user?.name || "Unknown User",
        email: user?.email || "",
        avatar: user?.avatar || user?.avatarUrl,
        role: m.role || m.defaultRole || "member",
        status: m.status,
        invitedAt: m.invitedAt,
        acceptedAt: m.acceptedAt,
        createdAt: m.createdAt,
        productAccess: userProductMemberships.map((pm) => ({
          id: pm._id,
          productKey: pm.productKey,
          role: pm.role,
          permissions: pm.permissions,
          branchIds: pm.branchIds,
          status: pm.status,
        })),
      });
    }

    return members;
  },
});

export const getWorkspaceMemberById = query({
  args: {
    workspaceId: v.id("workspaces"),
    membershipId: v.id("workspaceMemberships"),
    callerUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const membership = await ctx.db.get(args.membershipId);
    if (!membership || membership.workspaceId !== args.workspaceId) {
      throw new Error("MEMBER_NOT_FOUND");
    }

    const user = await ctx.db.get(membership.userId);
    const productMemberships = await ctx.db
      .query("productMemberships")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", membership.userId)
      )
      .collect();

    return {
      id: membership._id,
      userId: membership.userId,
      name: user?.name,
      email: user?.email,
      avatar: user?.avatar || user?.avatarUrl,
      role: membership.role || membership.defaultRole || "member",
      status: membership.status,
      createdAt: membership.createdAt,
      productAccess: productMemberships.map((pm) => ({
        id: pm._id,
        productKey: pm.productKey,
        role: pm.role,
        permissions: pm.permissions,
        branchIds: pm.branchIds,
        status: pm.status,
      })),
    };
  },
});

export const updateWorkspaceMemberRole = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    membershipId: v.id("workspaceMemberships"),
    callerUserId: v.id("users"),
    role: v.string(),
    productRole: v.optional(v.string()),
    productKey: v.optional(v.string()),
    branchIds: v.optional(v.array(v.id("branches"))),
  },
  handler: async (ctx, args) => {
    // 1. Verify caller permission (owner or admin)
    const caller = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", args.callerUserId)
      )
      .first();

    const callerRole = (caller?.role || caller?.defaultRole || "").toLowerCase();
    if (!caller || (callerRole !== "owner" && callerRole !== "admin")) {
      throw new Error("WORKSPACE_ACCESS_DENIED");
    }

    const target = await ctx.db.get(args.membershipId);
    if (!target || target.workspaceId !== args.workspaceId) {
      throw new Error("MEMBER_NOT_FOUND");
    }

    // 2. Prevent removing the last owner
    if ((target.role || "").toLowerCase() === "owner" && args.role.toLowerCase() !== "owner") {
      const allOwners = await ctx.db
        .query("workspaceMemberships")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
        .collect();

      const activeOwners = allOwners.filter(
        (m) => (m.role || "").toLowerCase() === "owner" && m.status.toLowerCase() === "active"
      );
      if (activeOwners.length <= 1) {
        throw new Error("CANNOT_REMOVE_LAST_OWNER");
      }
    }

    const now = Date.now();
    await ctx.db.patch(target._id, {
      role: args.role,
      updatedAt: now,
    });

    // Update product role if productKey and productRole provided
    if (args.productKey && args.productRole) {
      const existingPm = await ctx.db
        .query("productMemberships")
        .withIndex("by_workspace_user", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("userId", target.userId)
        )
        .first();

      if (existingPm && existingPm.productKey === args.productKey) {
        await ctx.db.patch(existingPm._id, {
          role: args.productRole,
          branchIds: args.branchIds,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("productMemberships", {
          workspaceId: args.workspaceId,
          userId: target.userId,
          productKey: args.productKey,
          role: args.productRole,
          permissions: [],
          branchIds: args.branchIds,
          status: "active",
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    // Audit log
    await ctx.db.insert("workspaceAuditLogs", {
      workspaceId: args.workspaceId,
      actorUserId: args.callerUserId,
      eventType: "workspace.member_role_changed",
      entityType: "workspaceMembership",
      entityId: target._id,
      severity: "info",
      metadata: { newRole: args.role, productRole: args.productRole },
      createdAt: now,
    });

    return { success: true };
  },
});

export const suspendWorkspaceMember = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    membershipId: v.id("workspaceMemberships"),
    callerUserId: v.id("users"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const caller = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", args.callerUserId)
      )
      .first();

    const callerRole = (caller?.role || "").toLowerCase();
    if (!caller || (callerRole !== "owner" && callerRole !== "admin")) {
      throw new Error("WORKSPACE_ACCESS_DENIED");
    }

    const target = await ctx.db.get(args.membershipId);
    if (!target || target.workspaceId !== args.workspaceId) {
      throw new Error("MEMBER_NOT_FOUND");
    }

    if (target.userId === args.callerUserId) {
      throw new Error("CANNOT_SUSPEND_SELF");
    }

    if ((target.role || "").toLowerCase() === "owner") {
      throw new Error("CANNOT_SUSPEND_OWNER");
    }

    const now = Date.now();
    await ctx.db.patch(target._id, {
      status: "suspended",
      suspendedAt: now,
      updatedAt: now,
    });

    // Audit log
    await ctx.db.insert("workspaceAuditLogs", {
      workspaceId: args.workspaceId,
      actorUserId: args.callerUserId,
      eventType: "workspace.member_suspended",
      entityType: "workspaceMembership",
      entityId: target._id,
      severity: "warning",
      metadata: { reason: args.reason, suspendedUserId: target.userId },
      createdAt: now,
    });

    return { success: true };
  },
});

export const restoreWorkspaceMember = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    membershipId: v.id("workspaceMemberships"),
    callerUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const caller = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", args.callerUserId)
      )
      .first();

    const callerRole = (caller?.role || "").toLowerCase();
    if (!caller || (callerRole !== "owner" && callerRole !== "admin")) {
      throw new Error("WORKSPACE_ACCESS_DENIED");
    }

    const target = await ctx.db.get(args.membershipId);
    if (!target || target.workspaceId !== args.workspaceId) {
      throw new Error("MEMBER_NOT_FOUND");
    }

    const now = Date.now();
    await ctx.db.patch(target._id, {
      status: "active",
      updatedAt: now,
    });

    // Audit log
    await ctx.db.insert("workspaceAuditLogs", {
      workspaceId: args.workspaceId,
      actorUserId: args.callerUserId,
      eventType: "workspace.member_restored",
      entityType: "workspaceMembership",
      entityId: target._id,
      severity: "info",
      metadata: { restoredUserId: target.userId },
      createdAt: now,
    });

    return { success: true };
  },
});

export const removeWorkspaceMember = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    membershipId: v.id("workspaceMemberships"),
    callerUserId: v.id("users"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const caller = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", args.callerUserId)
      )
      .first();

    const callerRole = (caller?.role || "").toLowerCase();
    if (!caller || (callerRole !== "owner" && callerRole !== "admin")) {
      throw new Error("WORKSPACE_ACCESS_DENIED");
    }

    const target = await ctx.db.get(args.membershipId);
    if (!target || target.workspaceId !== args.workspaceId) {
      throw new Error("MEMBER_NOT_FOUND");
    }

    if ((target.role || "").toLowerCase() === "owner") {
      throw new Error("CANNOT_REMOVE_OWNER");
    }

    const now = Date.now();
    await ctx.db.patch(target._id, {
      status: "removed",
      updatedAt: now,
    });

    // Revoke product memberships
    const productMemberships = await ctx.db
      .query("productMemberships")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", target.userId)
      )
      .collect();

    for (const pm of productMemberships) {
      await ctx.db.patch(pm._id, {
        status: "removed",
        updatedAt: now,
      });
    }

    // Audit log
    await ctx.db.insert("workspaceAuditLogs", {
      workspaceId: args.workspaceId,
      actorUserId: args.callerUserId,
      eventType: "workspace.member_removed",
      entityType: "workspaceMembership",
      entityId: target._id,
      severity: "warning",
      metadata: { reason: args.reason, removedUserId: target.userId },
      createdAt: now,
    });

    return { success: true };
  },
});

// ==========================================
// INVITATIONS MODULE
// ==========================================

export const createWorkspaceInvitation = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    callerUserId: v.id("users"),
    email: v.string(),
    role: v.string(),
    productKey: v.optional(v.string()),
    branchIds: v.optional(v.array(v.id("branches"))),
    tokenHash: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    // 1. Verify caller permission
    const caller = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", args.callerUserId)
      )
      .first();

    const callerRole = (caller?.role || "").toLowerCase();
    if (!caller || (callerRole !== "owner" && callerRole !== "admin")) {
      throw new Error("WORKSPACE_ACCESS_DENIED");
    }

    const emailNormalized = args.email.toLowerCase().trim();

    // 2. Check if user is already an active member of this workspace
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email_normalized", (q) => q.eq("emailNormalized", emailNormalized))
      .first();

    if (existingUser) {
      const existingMember = await ctx.db
        .query("workspaceMemberships")
        .withIndex("by_workspace_user", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("userId", existingUser._id)
        )
        .first();

      if (existingMember && existingMember.status.toLowerCase() === "active") {
        throw new Error("USER_ALREADY_MEMBER");
      }
    }

    const now = Date.now();
    const inviteId = await ctx.db.insert("workspaceInvitations", {
      workspaceId: args.workspaceId,
      productKey: args.productKey,
      email: args.email,
      emailNormalized,
      inviteeUserId: existingUser?._id,
      role: args.role,
      branchIds: args.branchIds,
      tokenHash: args.tokenHash,
      status: "pending",
      invitedBy: args.callerUserId,
      expiresAt: args.expiresAt,
      createdAt: now,
    });

    // Audit log
    await ctx.db.insert("workspaceAuditLogs", {
      workspaceId: args.workspaceId,
      actorUserId: args.callerUserId,
      eventType: "workspace.invitation_created",
      entityType: "workspaceInvitation",
      entityId: inviteId,
      severity: "info",
      metadata: { email: emailNormalized, role: args.role, productKey: args.productKey },
      createdAt: now,
    });

    const ws = await ctx.db.get(args.workspaceId);
    const callerUser = await ctx.db.get(args.callerUserId);

    return {
      id: inviteId,
      workspaceName: ws?.name || "Workspace",
      inviterName: callerUser?.name || "A team member",
    };
  },
});

export const getWorkspaceInvitations = query({
  args: {
    workspaceId: v.id("workspaces"),
    callerUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const caller = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", args.callerUserId)
      )
      .first();

    if (!caller || caller.status.toLowerCase() !== "active") {
      throw new Error("WORKSPACE_ACCESS_DENIED");
    }

    const invites = await ctx.db
      .query("workspaceInvitations")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    return invites.map((inv) => ({
      id: inv._id,
      email: inv.email,
      role: inv.role,
      productKey: inv.productKey,
      branchIds: inv.branchIds,
      status: inv.status,
      expiresAt: inv.expiresAt,
      isExpired: inv.expiresAt < Date.now(),
      createdAt: inv.createdAt,
    }));
  },
});

export const getWorkspaceInvitationByToken = query({
  args: { tokenHash: v.string() },
  handler: async (ctx, args) => {
    const invite = await ctx.db
      .query("workspaceInvitations")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", args.tokenHash))
      .first();

    if (!invite) return null;

    const ws = await ctx.db.get(invite.workspaceId);
    const inviter = await ctx.db.get(invite.invitedBy);

    return {
      id: invite._id,
      workspaceId: invite.workspaceId,
      workspaceName: ws?.name || "Workspace",
      workspaceSlug: ws?.slug,
      workspaceLogoUrl: ws?.logoUrl,
      inviterName: inviter?.name || "A team member",
      email: invite.email,
      role: invite.role,
      productKey: invite.productKey,
      branchIds: invite.branchIds,
      status: invite.status,
      expiresAt: invite.expiresAt,
      isExpired: invite.expiresAt < Date.now(),
      createdAt: invite.createdAt,
    };
  },
});

export const acceptWorkspaceInvitation = mutation({
  args: {
    tokenHash: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const invite = await ctx.db
      .query("workspaceInvitations")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", args.tokenHash))
      .first();

    if (!invite) throw new Error("INVITATION_NOT_FOUND");
    if (invite.status === "accepted") throw new Error("INVITATION_ALREADY_ACCEPTED");
    if (invite.status === "declined" || invite.status === "revoked") throw new Error(`INVITATION_${invite.status.toUpperCase()}`);

    const now = Date.now();
    if (invite.expiresAt < now || invite.status === "expired") {
      if (invite.status !== "expired") {
        await ctx.db.patch(invite._id, { status: "expired" });
      }
      throw new Error("INVITATION_EXPIRED");
    }

    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("USER_NOT_FOUND");

    const emailNormalized = user.email.toLowerCase().trim();
    if (emailNormalized !== invite.emailNormalized) {
      throw new Error("INVITATION_EMAIL_MISMATCH");
    }

    // 1. Create or update workspaceMembership
    const existingMembership = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", invite.workspaceId).eq("userId", user._id)
      )
      .first();

    if (existingMembership) {
      await ctx.db.patch(existingMembership._id, {
        role: invite.role,
        status: "active",
        acceptedAt: now,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("workspaceMemberships", {
        workspaceId: invite.workspaceId,
        userId: user._id,
        role: invite.role,
        status: "active",
        invitedBy: invite.invitedBy,
        invitedAt: invite.createdAt,
        acceptedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }

    // 2. Create productMembership if productKey specified
    if (invite.productKey) {
      const existingPm = await ctx.db
        .query("productMemberships")
        .withIndex("by_workspace_user", (q) =>
          q.eq("workspaceId", invite.workspaceId).eq("userId", user._id)
        )
        .first();

      if (existingPm && existingPm.productKey === invite.productKey) {
        await ctx.db.patch(existingPm._id, {
          role: invite.role,
          branchIds: invite.branchIds,
          status: "active",
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("productMemberships", {
          workspaceId: invite.workspaceId,
          userId: user._id,
          productKey: invite.productKey,
          role: invite.role,
          permissions: [],
          branchIds: invite.branchIds,
          status: "active",
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    // 3. Mark invitation accepted
    await ctx.db.patch(invite._id, {
      status: "accepted",
      acceptedAt: now,
      inviteeUserId: user._id,
    });

    // 4. Log audit event
    await ctx.db.insert("workspaceAuditLogs", {
      workspaceId: invite.workspaceId,
      actorUserId: user._id,
      eventType: "workspace.invitation_accepted",
      entityType: "workspaceInvitation",
      entityId: invite._id,
      severity: "info",
      metadata: { role: invite.role, productKey: invite.productKey },
      createdAt: now,
    });

    const ws = await ctx.db.get(invite.workspaceId);
    return {
      workspace: {
        id: ws?._id,
        name: ws?.name,
        slug: ws?.slug,
      },
      role: invite.role,
      productKey: invite.productKey,
    };
  },
});

export const declineWorkspaceInvitation = mutation({
  args: {
    tokenHash: v.string(),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const invite = await ctx.db
      .query("workspaceInvitations")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", args.tokenHash))
      .first();

    if (!invite) throw new Error("INVITATION_NOT_FOUND");
    if (invite.status === "accepted") throw new Error("INVITATION_ALREADY_ACCEPTED");

    const now = Date.now();
    await ctx.db.patch(invite._id, {
      status: "declined",
      declinedAt: now,
    });

    await ctx.db.insert("workspaceAuditLogs", {
      workspaceId: invite.workspaceId,
      actorUserId: args.userId,
      eventType: "workspace.invitation_declined",
      entityType: "workspaceInvitation",
      entityId: invite._id,
      severity: "info",
      metadata: { email: invite.emailNormalized },
      createdAt: now,
    });

    return { success: true };
  },
});

export const resendWorkspaceInvitation = mutation({
  args: {
    invitationId: v.id("workspaceInvitations"),
    callerUserId: v.id("users"),
    newTokenHash: v.string(),
    newExpiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const invite = await ctx.db.get(args.invitationId);
    if (!invite) throw new Error("INVITATION_NOT_FOUND");

    const caller = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", invite.workspaceId).eq("userId", args.callerUserId)
      )
      .first();

    const callerRole = (caller?.role || "").toLowerCase();
    if (!caller || (callerRole !== "owner" && callerRole !== "admin")) {
      throw new Error("WORKSPACE_ACCESS_DENIED");
    }

    if (invite.status === "accepted") throw new Error("INVITATION_ALREADY_ACCEPTED");

    const now = Date.now();
    await ctx.db.patch(invite._id, {
      tokenHash: args.newTokenHash,
      expiresAt: args.newExpiresAt,
      status: "pending",
    });

    await ctx.db.insert("workspaceAuditLogs", {
      workspaceId: invite.workspaceId,
      actorUserId: args.callerUserId,
      eventType: "workspace.invitation_resent",
      entityType: "workspaceInvitation",
      entityId: invite._id,
      severity: "info",
      metadata: { email: invite.emailNormalized },
      createdAt: now,
    });

    const ws = await ctx.db.get(invite.workspaceId);
    const callerUser = await ctx.db.get(args.callerUserId);

    return {
      id: invite._id,
      email: invite.email,
      workspaceName: ws?.name,
      inviterName: callerUser?.name,
    };
  },
});

export const revokeWorkspaceInvitation = mutation({
  args: {
    invitationId: v.id("workspaceInvitations"),
    callerUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const invite = await ctx.db.get(args.invitationId);
    if (!invite) throw new Error("INVITATION_NOT_FOUND");

    const caller = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", invite.workspaceId).eq("userId", args.callerUserId)
      )
      .first();

    const callerRole = (caller?.role || "").toLowerCase();
    if (!caller || (callerRole !== "owner" && callerRole !== "admin")) {
      throw new Error("WORKSPACE_ACCESS_DENIED");
    }

    if (invite.status === "accepted") throw new Error("INVITATION_ALREADY_ACCEPTED");

    const now = Date.now();
    await ctx.db.patch(invite._id, {
      status: "revoked",
      revokedAt: now,
    });

    await ctx.db.insert("workspaceAuditLogs", {
      workspaceId: invite.workspaceId,
      actorUserId: args.callerUserId,
      eventType: "workspace.invitation_revoked",
      entityType: "workspaceInvitation",
      entityId: invite._id,
      severity: "info",
      metadata: { email: invite.emailNormalized },
      createdAt: now,
    });

    return { success: true };
  },
});
