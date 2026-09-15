import { mutation, query } from "./_generated/server.js";
import { v } from "convex/values";

/**
 * Accept an organization invite from the in-dashboard notification.
 * Validates the invite, creates membership, marks invite accepted, and marks notification read.
 */
export const acceptInviteFromNotification = mutation({
  args: {
    inviteId: v.id("invitations"),
    userId: v.id("users"),
    notificationId: v.optional(v.id("notifications")),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("USER_NOT_FOUND");

    const invite = await ctx.db.get(args.inviteId);
    if (!invite) throw new Error("INVITATION_NOT_FOUND");

    // Email match check
    if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
      throw new Error("INVITATION_EMAIL_MISMATCH");
    }

    // Status check
    if (invite.status === "ACCEPTED") {
      throw new Error("INVITATION_ALREADY_ACCEPTED");
    }
    if (invite.status === "CANCELLED") {
      throw new Error("INVITATION_CANCELLED");
    }

    const now = Date.now();

    // Expiry check
    if (invite.expiresAt < now || invite.status === "EXPIRED") {
      if (invite.status !== "EXPIRED") {
        await ctx.db.patch(args.inviteId, { status: "EXPIRED" });
      }
      throw new Error("INVITATION_EXPIRED");
    }

    // Create or update organization membership
    const existingMembership = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_org_and_user", (q: any) =>
        q.eq("organizationId", invite.organizationId).eq("userId", user._id)
      )
      .first();

    if (existingMembership) {
      await ctx.db.patch(existingMembership._id, {
        role: invite.role,
        status: "ACTIVE",
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("organizationMemberships", {
        organizationId: invite.organizationId,
        userId: user._id,
        role: invite.role,
        status: "ACTIVE",
        joinedAt: now,
        updatedAt: now,
      });
    }

    // Mark invite as accepted
    await ctx.db.patch(args.inviteId, {
      status: "ACCEPTED",
      acceptedAt: now,
    });

    // Mark related notification(s) as read
    if (args.notificationId) {
      const notif = await ctx.db.get(args.notificationId);
      if (notif && notif.userId === args.userId) {
        await ctx.db.patch(args.notificationId, {
          status: "READ",
          readAt: now,
        });
      }
    }

    // Also find and mark any other invite notifications for this invite
    const relatedNotifs = await ctx.db
      .query("notifications")
      .withIndex("by_user_type", (q) =>
        q.eq("userId", args.userId).eq("type", "org_invite")
      )
      .collect();

    for (const n of relatedNotifs) {
      if (n.data?.inviteId === args.inviteId && n.status === "UNREAD") {
        await ctx.db.patch(n._id, { status: "READ", readAt: now });
      }
    }

    // Audit log
    await ctx.db.insert("auditLogs", {
      actorId: user._id,
      organizationId: invite.organizationId,
      action: "invitation.accepted_from_dashboard",
      resource: `invitation:${invite._id}`,
      metadata: { role: invite.role },
      timestamp: now,
    });

    const org = await ctx.db.get(invite.organizationId);

    return {
      success: true,
      organization: org ? { id: org._id, name: org.name, slug: org.slug } : null,
      role: invite.role,
    };
  },
});

/**
 * Decline an organization invite from the in-dashboard notification.
 */
export const declineInviteFromNotification = mutation({
  args: {
    inviteId: v.id("invitations"),
    userId: v.id("users"),
    notificationId: v.optional(v.id("notifications")),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("USER_NOT_FOUND");

    const invite = await ctx.db.get(args.inviteId);
    if (!invite) throw new Error("INVITATION_NOT_FOUND");

    // Email match
    if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
      throw new Error("INVITATION_EMAIL_MISMATCH");
    }

    if (invite.status !== "PENDING") {
      throw new Error("INVITATION_NOT_PENDING");
    }

    const now = Date.now();

    // Mark invite as cancelled (DECLINED is not in the union, use CANCELLED)
    await ctx.db.patch(args.inviteId, {
      status: "CANCELLED",
    });

    // Mark notification as read
    if (args.notificationId) {
      const notif = await ctx.db.get(args.notificationId);
      if (notif && notif.userId === args.userId) {
        await ctx.db.patch(args.notificationId, {
          status: "READ",
          readAt: now,
        });
      }
    }

    // Mark any other related invite notifications
    const relatedNotifs = await ctx.db
      .query("notifications")
      .withIndex("by_user_type", (q) =>
        q.eq("userId", args.userId).eq("type", "org_invite")
      )
      .collect();

    for (const n of relatedNotifs) {
      if (n.data?.inviteId === args.inviteId && n.status === "UNREAD") {
        await ctx.db.patch(n._id, { status: "READ", readAt: now });
      }
    }

    // Audit log
    await ctx.db.insert("auditLogs", {
      actorId: user._id,
      organizationId: invite.organizationId,
      action: "invitation.declined_from_dashboard",
      resource: `invitation:${invite._id}`,
      metadata: { role: invite.role },
      timestamp: now,
    });

    return { success: true };
  },
});

/**
 * Accept a workspace invite from in-dashboard notification.
 */
export const acceptWorkspaceInviteFromNotification = mutation({
  args: {
    inviteId: v.id("workspaceInvitations"),
    userId: v.id("users"),
    notificationId: v.optional(v.id("notifications")),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("USER_NOT_FOUND");

    const invite = await ctx.db.get(args.inviteId);
    if (!invite) throw new Error("INVITATION_NOT_FOUND");

    if (invite.status === "accepted") throw new Error("INVITATION_ALREADY_ACCEPTED");
    if (invite.status === "declined" || invite.status === "revoked") {
      throw new Error(`INVITATION_${invite.status.toUpperCase()}`);
    }

    const now = Date.now();
    if (invite.expiresAt < now || invite.status === "expired") {
      if (invite.status !== "expired") {
        await ctx.db.patch(invite._id, { status: "expired" });
      }
      throw new Error("INVITATION_EXPIRED");
    }

    const emailNormalized = user.email.toLowerCase().trim();
    if (emailNormalized !== invite.emailNormalized) {
      throw new Error("INVITATION_EMAIL_MISMATCH");
    }

    const orgRole = invite.organizationRole || invite.role || "staff";

    // 1. Create or update workspaceMembership
    const existingMembership = await ctx.db
      .query("workspaceMemberships")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", invite.workspaceId).eq("userId", user._id)
      )
      .first();

    if (existingMembership) {
      await ctx.db.patch(existingMembership._id, {
        role: orgRole,
        status: "active",
        acceptedAt: now,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("workspaceMemberships", {
        workspaceId: invite.workspaceId,
        userId: user._id,
        role: orgRole,
        status: "active",
        invitedBy: invite.invitedBy,
        invitedAt: invite.createdAt,
        acceptedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }

    // 2. Provision App and Branch Access
    if (invite.appAccess && Array.isArray(invite.appAccess) && invite.appAccess.length > 0) {
      for (const app of invite.appAccess) {
        const existingPm = await ctx.db
          .query("productMemberships")
          .withIndex("by_workspace_product_user", (q) =>
            q.eq("workspaceId", invite.workspaceId).eq("productKey", app.productKey).eq("userId", user._id)
          )
          .first();

        if (existingPm) {
          await ctx.db.patch(existingPm._id, {
            role: app.appRole,
            branchIds: app.branchIds as any,
            status: "active",
            updatedAt: now,
          });
        } else {
          await ctx.db.insert("productMemberships", {
            workspaceId: invite.workspaceId,
            userId: user._id,
            productKey: app.productKey,
            role: app.appRole,
            permissions: [],
            branchIds: app.branchIds as any,
            status: "active",
            createdAt: now,
            updatedAt: now,
          });
        }

        // Branch access
        for (const branchId of app.branchIds) {
          const existingBranchAccess = await ctx.db
            .query("appBranchAccess")
            .withIndex("by_branch_user", (q) =>
              q.eq("branchId", branchId as any).eq("userId", user._id)
            )
            .first();

          if (existingBranchAccess) {
            await ctx.db.patch(existingBranchAccess._id, {
              status: "active",
              updatedAt: now,
            });
          } else {
            await ctx.db.insert("appBranchAccess", {
              workspaceId: invite.workspaceId,
              userId: user._id,
              productKey: app.productKey,
              branchId: branchId as any,
              status: "active",
              grantedBy: invite.invitedBy,
              createdAt: now,
              updatedAt: now,
            });
          }
        }
      }
    } else if (invite.productKey) {
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

    // 3. Mark invite accepted
    await ctx.db.patch(invite._id, {
      status: "accepted",
      acceptedAt: now,
      acceptedBy: user._id,
      inviteeUserId: user._id,
      updatedAt: now,
    });

    // 4. Mark related notifications as read
    if (args.notificationId) {
      const notif = await ctx.db.get(args.notificationId);
      if (notif && notif.userId === args.userId) {
        await ctx.db.patch(args.notificationId, {
          status: "READ",
          readAt: now,
        });
      }
    }

    const relatedNotifs = await ctx.db
      .query("notifications")
      .withIndex("by_user_type", (q) =>
        q.eq("userId", user._id).eq("type", "workspace_invite")
      )
      .collect();

    for (const n of relatedNotifs) {
      if (n.data?.inviteId === invite._id && n.status === "UNREAD") {
        await ctx.db.patch(n._id, { status: "READ", readAt: now });
      }
    }

    // 5. Audit logs
    await ctx.db.insert("workspaceAuditLogs", {
      workspaceId: invite.workspaceId,
      actorUserId: user._id,
      eventType: "workspace.invitation_accepted",
      entityType: "workspaceInvitation",
      entityId: invite._id,
      severity: "info",
      metadata: { role: orgRole },
      createdAt: now,
    });

    const ws = await ctx.db.get(invite.workspaceId);
    return {
      success: true,
      workspace: ws ? { id: ws._id, name: ws.name, slug: ws.slug } : null,
      role: orgRole,
    };
  },
});

/**
 * Decline a workspace invite from in-dashboard notification.
 */
export const declineWorkspaceInviteFromNotification = mutation({
  args: {
    inviteId: v.id("workspaceInvitations"),
    userId: v.id("users"),
    notificationId: v.optional(v.id("notifications")),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("USER_NOT_FOUND");

    const invite = await ctx.db.get(args.inviteId);
    if (!invite) throw new Error("INVITATION_NOT_FOUND");

    const emailNormalized = user.email.toLowerCase().trim();
    if (emailNormalized !== invite.emailNormalized) {
      throw new Error("INVITATION_EMAIL_MISMATCH");
    }

    if (invite.status !== "pending") {
      throw new Error("INVITATION_NOT_PENDING");
    }

    const now = Date.now();
    await ctx.db.patch(invite._id, {
      status: "declined",
      declinedAt: now,
      updatedAt: now,
    });

    if (args.notificationId) {
      const notif = await ctx.db.get(args.notificationId);
      if (notif && notif.userId === args.userId) {
        await ctx.db.patch(args.notificationId, {
          status: "READ",
          readAt: now,
        });
      }
    }

    const relatedNotifs = await ctx.db
      .query("notifications")
      .withIndex("by_user_type", (q) =>
        q.eq("userId", user._id).eq("type", "workspace_invite")
      )
      .collect();

    for (const n of relatedNotifs) {
      if (n.data?.inviteId === invite._id && n.status === "UNREAD") {
        await ctx.db.patch(n._id, { status: "READ", readAt: now });
      }
    }

    await ctx.db.insert("workspaceAuditLogs", {
      workspaceId: invite.workspaceId,
      actorUserId: user._id,
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

/**
 * Get all pending invitations for a user by their email.
 * Returns enriched invitation data for both organization and workspace invites.
 */
export const getPendingInvitesForUser = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return [];

    const email = user.email.toLowerCase();
    const now = Date.now();

    // 1. Organization invitations
    const orgInvites = await ctx.db
      .query("invitations")
      .withIndex("by_email", (q) => q.eq("email", email))
      .collect();

    const pendingOrgInvites = orgInvites.filter(
      (inv) => inv.status === "PENDING" && inv.expiresAt > now
    );

    const enrichedOrgInvites = await Promise.all(
      pendingOrgInvites.map(async (inv) => {
        const org = await ctx.db.get(inv.organizationId);
        const inviter = await ctx.db.get(inv.invitedBy);

        const existingMembership = await ctx.db
          .query("organizationMemberships")
          .withIndex("by_org_and_user", (q: any) =>
            q.eq("organizationId", inv.organizationId).eq("userId", args.userId)
          )
          .first();

        if (existingMembership && existingMembership.status === "ACTIVE") {
          return null; // Skip — user already a member
        }

        return {
          id: inv._id,
          inviteType: "organization" as const,
          organizationId: inv.organizationId,
          organizationName: org?.name || "Organization",
          organizationSlug: org?.slug || "",
          role: inv.role,
          inviterName: inviter?.name || "A teammate",
          email: inv.email,
          status: inv.status,
          expiresAt: inv.expiresAt,
          createdAt: inv.createdAt,
        };
      })
    );

    // 2. Workspace invitations
    let wsInvites: any[] = [];
    try {
      wsInvites = await ctx.db
        .query("workspaceInvitations")
        .withIndex("by_email_status", (q) =>
          q.eq("emailNormalized", email).eq("status", "pending")
        )
        .collect();
    } catch {
      wsInvites = [];
    }

    const pendingWsInvites = wsInvites.filter((inv) => inv.expiresAt > now);

    const enrichedWsInvites = await Promise.all(
      pendingWsInvites.map(async (inv) => {
        const ws: any = await ctx.db.get(inv.workspaceId);
        const inviter: any = await ctx.db.get(inv.invitedBy);

        const existingMembership = await ctx.db
          .query("workspaceMemberships")
          .withIndex("by_workspace_user", (q) =>
            q.eq("workspaceId", inv.workspaceId).eq("userId", args.userId)
          )
          .first();

        if (existingMembership && existingMembership.status?.toLowerCase() === "active") {
          return null;
        }

        return {
          id: inv._id,
          inviteType: "workspace" as const,
          workspaceId: inv.workspaceId,
          organizationName: ws?.name || "Workspace",
          organizationSlug: ws?.slug || "",
          role: inv.organizationRole || inv.role,
          inviterName: inviter?.name || "A teammate",
          email: inv.email,
          status: inv.status,
          expiresAt: inv.expiresAt,
          createdAt: inv.createdAt,
          tokenHash: inv.tokenHash,
        };
      })
    );

    const allInvites = [
      ...enrichedOrgInvites.filter(Boolean),
      ...enrichedWsInvites.filter(Boolean),
    ];

    // Sort by newest first
    allInvites.sort((a: any, b: any) => b.createdAt - a.createdAt);

    return allInvites;
  },
});
