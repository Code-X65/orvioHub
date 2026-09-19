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
        const validBranchIds = (app.branchIds || []).filter(
          (id: any) => typeof id === "string" && id.trim().length > 0 && id !== '""' && id !== "''"
        );

        const existingPm = await ctx.db
          .query("productMemberships")
          .withIndex("by_workspace_product_user", (q) =>
            q.eq("workspaceId", invite.workspaceId).eq("productKey", app.productKey).eq("userId", user._id)
          )
          .first();

        if (existingPm) {
          await ctx.db.patch(existingPm._id, {
            role: app.appRole,
            branchIds: validBranchIds.length > 0 ? (validBranchIds as any) : undefined,
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
            branchIds: validBranchIds.length > 0 ? (validBranchIds as any) : undefined,
            status: "active",
            createdAt: now,
            updatedAt: now,
          });
        }

        // Branch access
        for (const branchId of validBranchIds) {
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
      const validInviteBranchIds = (invite.branchIds || []).filter(
        (id: any) => typeof id === "string" && id.trim().length > 0 && id !== '""' && id !== "''"
      );

      const existingPm = await ctx.db
        .query("productMemberships")
        .withIndex("by_workspace_user", (q) =>
          q.eq("workspaceId", invite.workspaceId).eq("userId", user._id)
        )
        .first();

      if (existingPm && existingPm.productKey === invite.productKey) {
        await ctx.db.patch(existingPm._id, {
          role: invite.role,
          branchIds: validInviteBranchIds.length > 0 ? (validInviteBranchIds as any) : undefined,
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
          branchIds: validInviteBranchIds.length > 0 ? (validInviteBranchIds as any) : undefined,
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

/**
 * UNIFIED INVITATION ACCEPTANCE ENGINE
 * Resolves invitations from both 'invitations' and 'workspaceInvitations' tables.
 * Atomically provisions organization, workspace, product/application, and branch memberships.
 */
export const acceptInviteUnified = mutation({
  args: {
    inviteId: v.string(),
    userId: v.id("users"),
    notificationId: v.optional(v.id("notifications")),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("USER_NOT_FOUND");

    const now = Date.now();
    const userEmail = user.email.toLowerCase().trim();

    // 1. Attempt to find invite in 'workspaceInvitations' first
    let wsInvite: any = null;
    try {
      wsInvite = await ctx.db.get(args.inviteId as any);
      if (wsInvite && !("workspaceId" in wsInvite)) {
        wsInvite = null; // not a workspaceInvitation
      }
    } catch {}

    if (!wsInvite) {
      wsInvite = await ctx.db
        .query("workspaceInvitations")
        .withIndex("by_token_hash", (q) => q.eq("tokenHash", args.inviteId))
        .first();
    }

    // 2. Attempt to find invite in 'invitations' table
    let orgInvite: any = null;
    if (!wsInvite) {
      try {
        orgInvite = await ctx.db.get(args.inviteId as any);
        if (orgInvite && !("organizationId" in orgInvite)) {
          orgInvite = null;
        }
      } catch {}

      if (!orgInvite) {
        orgInvite = await ctx.db
          .query("invitations")
          .withIndex("by_token", (q) => q.eq("token", args.inviteId))
          .first();
      }
      if (!orgInvite) {
        orgInvite = await ctx.db
          .query("invitations")
          .withIndex("by_tokenHash", (q) => q.eq("tokenHash", args.inviteId))
          .first();
      }
    }

    if (!wsInvite && !orgInvite) {
      throw new Error("INVITATION_NOT_FOUND");
    }

    // Handle Workspace Invitation Acceptance
    if (wsInvite) {
      if (wsInvite.status === "accepted") throw new Error("INVITATION_ALREADY_ACCEPTED");
      if (wsInvite.status === "declined" || wsInvite.status === "revoked") {
        throw new Error(`INVITATION_${wsInvite.status.toUpperCase()}`);
      }
      if (wsInvite.expiresAt < now || wsInvite.status === "expired") {
        await ctx.db.patch(wsInvite._id, { status: "expired" });
        throw new Error("INVITATION_EXPIRED");
      }
      if (wsInvite.emailNormalized && wsInvite.emailNormalized !== userEmail) {
        throw new Error("INVITATION_EMAIL_MISMATCH");
      }

      const orgRole = wsInvite.organizationRole || wsInvite.role || "staff";

      // A. Workspace Membership
      const existingWsMem = await ctx.db
        .query("workspaceMemberships")
        .withIndex("by_workspace_user", (q) =>
          q.eq("workspaceId", wsInvite.workspaceId).eq("userId", user._id)
        )
        .first();

      if (existingWsMem) {
        await ctx.db.patch(existingWsMem._id, {
          role: orgRole,
          status: "active",
          acceptedAt: now,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("workspaceMemberships", {
          workspaceId: wsInvite.workspaceId,
          userId: user._id,
          role: orgRole,
          status: "active",
          invitedBy: wsInvite.invitedBy,
          invitedAt: wsInvite.createdAt,
          acceptedAt: now,
          createdAt: now,
          updatedAt: now,
        });
      }

      // B. Organization Membership (if workspace is tied to org)
      const wsDoc: any = await ctx.db.get(wsInvite.workspaceId);
      const orgId = wsDoc?.organizationId;
      if (orgId) {
        const existingOrgMem = await ctx.db
          .query("organizationMemberships")
          .withIndex("by_org_and_user", (q: any) =>
            q.eq("organizationId", orgId).eq("userId", user._id)
          )
          .first();

        if (existingOrgMem) {
          await ctx.db.patch(existingOrgMem._id, {
            role: orgRole,
            status: "ACTIVE",
            updatedAt: now,
          });
        } else {
          await ctx.db.insert("organizationMemberships", {
            organizationId: orgId,
            userId: user._id,
            role: orgRole,
            status: "ACTIVE",
            joinedAt: now,
            updatedAt: now,
          });
        }
      }

      // C. Multi-App and Multi-Branch Provisioning
      const assignedBranches: string[] = [];
      if (wsInvite.appAccess && Array.isArray(wsInvite.appAccess) && wsInvite.appAccess.length > 0) {
        for (const app of wsInvite.appAccess) {
          const validBranchIds = (app.branchIds || []).filter(
            (id: any) => typeof id === "string" && id.trim().length > 0 && id !== '""' && id !== "''"
          );

          // Product memberships
          const existingPm = await ctx.db
            .query("productMemberships")
            .withIndex("by_workspace_product_user", (q) =>
              q.eq("workspaceId", wsInvite.workspaceId).eq("productKey", app.productKey).eq("userId", user._id)
            )
            .first();

          if (existingPm) {
            await ctx.db.patch(existingPm._id, {
              role: app.appRole,
              branchIds: validBranchIds.length > 0 ? (validBranchIds as any) : undefined,
              status: "active",
              updatedAt: now,
            });
          } else {
            await ctx.db.insert("productMemberships", {
              workspaceId: wsInvite.workspaceId,
              userId: user._id,
              productKey: app.productKey,
              role: app.appRole,
              permissions: [],
              branchIds: validBranchIds.length > 0 ? (validBranchIds as any) : undefined,
              status: "active",
              createdAt: now,
              updatedAt: now,
            });
          }

          // Application memberships
          const existingAppMem = await ctx.db
            .query("applicationMemberships")
            .withIndex("by_workspace_application_user", (q) =>
              q.eq("workspaceId", String(wsInvite.workspaceId)).eq("applicationKey", app.productKey).eq("userId", user._id)
            )
            .first();

          if (existingAppMem) {
            await ctx.db.patch(existingAppMem._id, {
              role: app.appRole,
              status: "active",
              assignedBy: wsInvite.invitedBy,
              assignedAt: now,
              updatedAt: now,
            });
          } else {
            await ctx.db.insert("applicationMemberships", {
              workspaceId: String(wsInvite.workspaceId),
              userId: user._id,
              applicationKey: app.productKey,
              role: app.appRole,
              permissions: [],
              status: "active",
              assignedBy: wsInvite.invitedBy,
              assignedAt: now,
              createdAt: now,
              updatedAt: now,
            });
          }

          // Branch memberships & access
          for (const bId of validBranchIds) {
            assignedBranches.push(String(bId));
            const existingBm = await ctx.db
              .query("branchMemberships")
              .withIndex("by_user_branch", (q) =>
                q.eq("userId", user._id).eq("branchId", String(bId))
              )
              .first();

            if (existingBm) {
              await ctx.db.patch(existingBm._id, {
                role: app.appRole,
                status: "active",
                assignedByUserId: wsInvite.invitedBy,
                assignedAt: now,
                updatedAt: now,
              });
            } else {
              await ctx.db.insert("branchMemberships", {
                workspaceId: String(wsInvite.workspaceId),
                applicationKey: app.productKey,
                branchId: String(bId),
                userId: user._id,
                role: app.appRole,
                permissions: [],
                status: "active",
                assignedByUserId: wsInvite.invitedBy,
                assignedAt: now,
                createdAt: now,
                updatedAt: now,
              });
            }
          }
        }
      } else if (wsInvite.productKey || wsInvite.branchIds?.length) {
        const pKey = wsInvite.productKey || "inventory";
        const validBranchIds = (wsInvite.branchIds || []).filter(
          (id: any) => typeof id === "string" && id.trim().length > 0 && id !== '""' && id !== "''"
        );

        // Application membership
        const existingAppMem = await ctx.db
          .query("applicationMemberships")
          .withIndex("by_workspace_application_user", (q) =>
            q.eq("workspaceId", String(wsInvite.workspaceId)).eq("applicationKey", pKey).eq("userId", user._id)
          )
          .first();

        if (existingAppMem) {
          await ctx.db.patch(existingAppMem._id, {
            role: wsInvite.role,
            status: "active",
            assignedBy: wsInvite.invitedBy,
            assignedAt: now,
            updatedAt: now,
          });
        } else {
          await ctx.db.insert("applicationMemberships", {
            workspaceId: String(wsInvite.workspaceId),
            userId: user._id,
            applicationKey: pKey,
            role: wsInvite.role,
            permissions: [],
            status: "active",
            assignedBy: wsInvite.invitedBy,
            assignedAt: now,
            createdAt: now,
            updatedAt: now,
          });
        }

        // Branch memberships
        for (const bId of validBranchIds) {
          assignedBranches.push(String(bId));
          const existingBm = await ctx.db
            .query("branchMemberships")
            .withIndex("by_user_branch", (q) =>
              q.eq("userId", user._id).eq("branchId", String(bId))
            )
            .first();

          if (existingBm) {
            await ctx.db.patch(existingBm._id, {
              role: wsInvite.role,
              status: "active",
              assignedByUserId: wsInvite.invitedBy,
              assignedAt: now,
              updatedAt: now,
            });
          } else {
            await ctx.db.insert("branchMemberships", {
              workspaceId: String(wsInvite.workspaceId),
              applicationKey: pKey,
              branchId: String(bId),
              userId: user._id,
              role: wsInvite.role,
              permissions: [],
              status: "active",
              assignedByUserId: wsInvite.invitedBy,
              assignedAt: now,
              createdAt: now,
              updatedAt: now,
            });
          }
        }
      }

      // If no specific branch was assigned, assign primary branch for inventory
      if (assignedBranches.length === 0) {
        try {
          const wsBranches = await ctx.db
            .query("branches")
            .withIndex("by_workspace", (q) => q.eq("workspaceId", wsInvite.workspaceId))
            .collect();
          if (wsBranches.length > 0) {
            const primaryB = wsBranches.find((b) => b.isPrimary) || wsBranches[0];
            const existingBm = await ctx.db
              .query("branchMemberships")
              .withIndex("by_user_branch", (q) =>
                q.eq("userId", user._id).eq("branchId", String(primaryB._id))
              )
              .first();

            if (!existingBm) {
              await ctx.db.insert("branchMemberships", {
                workspaceId: String(wsInvite.workspaceId),
                applicationKey: "inventory",
                branchId: String(primaryB._id),
                userId: user._id,
                role: wsInvite.role || "cashier",
                permissions: [],
                status: "active",
                assignedByUserId: wsInvite.invitedBy,
                assignedAt: now,
                createdAt: now,
                updatedAt: now,
              });
            }
          }
        } catch {}
      }

      // D. Mark Invitation Accepted
      await ctx.db.patch(wsInvite._id, {
        status: "accepted",
        acceptedAt: now,
        acceptedBy: user._id,
        inviteeUserId: user._id,
        updatedAt: now,
      });

      // E. Resolve Notifications
      if (args.notificationId) {
        await ctx.db.patch(args.notificationId, {
          status: "READ",
          readAt: now,
          data: { isResolved: true, inviteStatus: "ACCEPTED", acceptedAt: now },
        });
      }

      const relatedNotifs = await ctx.db
        .query("notifications")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .collect();

      for (const n of relatedNotifs) {
        if (
          n.data?.inviteId === wsInvite._id ||
          n.data?.workspaceId === wsInvite.workspaceId
        ) {
          await ctx.db.patch(n._id, {
            status: "READ",
            readAt: now,
            data: { ...n.data, isResolved: true, inviteStatus: "ACCEPTED", acceptedAt: now },
          });
        }
      }

      // F. Notify Inviter
      if (wsInvite.invitedBy) {
        await ctx.db.insert("notifications", {
          userId: wsInvite.invitedBy,
          type: "INVITATION_ACCEPTED",
          title: "Staff Invitation Accepted",
          body: `${user.name || user.email} accepted the invitation to join ${wsDoc?.name || "Workspace"}.`,
          severity: "SUCCESS",
          channel: "IN_APP",
          status: "UNREAD",
          category: "workspace",
          priority: "HIGH",
          data: {
            workspaceId: wsInvite.workspaceId,
            acceptedUserId: user._id,
            email: user.email,
          },
          createdAt: now,
        });
      }

      return {
        success: true,
        inviteType: "workspace",
        workspaceId: wsInvite.workspaceId,
        workspaceName: wsDoc?.name || "Workspace",
        targetRoute: `/inventory/dashboard?workspaceId=${wsInvite.workspaceId}`,
      };
    }

    // Handle Organization Invitation Acceptance
    if (orgInvite) {
      if (orgInvite.status === "ACCEPTED") throw new Error("INVITATION_ALREADY_ACCEPTED");
      if (orgInvite.status === "CANCELLED") throw new Error("INVITATION_CANCELLED");
      if (orgInvite.expiresAt < now || orgInvite.status === "EXPIRED") {
        await ctx.db.patch(orgInvite._id, { status: "EXPIRED" });
        throw new Error("INVITATION_EXPIRED");
      }
      if (orgInvite.email.toLowerCase().trim() !== userEmail) {
        throw new Error("INVITATION_EMAIL_MISMATCH");
      }

      // A. Organization Membership
      const existingOrgMem = await ctx.db
        .query("organizationMemberships")
        .withIndex("by_org_and_user", (q: any) =>
          q.eq("organizationId", orgInvite.organizationId).eq("userId", user._id)
        )
        .first();

      if (existingOrgMem) {
        await ctx.db.patch(existingOrgMem._id, {
          role: orgInvite.role,
          status: "ACTIVE",
          allowedApplications: orgInvite.allowedApplications,
          allowedBranches: orgInvite.allowedBranches,
          primaryBranchId: orgInvite.primaryBranchId,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("organizationMemberships", {
          organizationId: orgInvite.organizationId,
          userId: user._id,
          role: orgInvite.role,
          status: "ACTIVE",
          allowedApplications: orgInvite.allowedApplications,
          allowedBranches: orgInvite.allowedBranches,
          primaryBranchId: orgInvite.primaryBranchId,
          joinedAt: now,
          updatedAt: now,
        });
      }

      // B. Resolve target workspace
      let targetWs: any = null;
      if (orgInvite.workspaceId) {
        targetWs = await ctx.db.get(orgInvite.workspaceId);
      }
      if (!targetWs) {
        targetWs = await ctx.db
          .query("workspaces")
          .withIndex("by_organizationId", (q: any) => q.eq("organizationId", orgInvite.organizationId))
          .first();
      }

      if (targetWs) {
        const existingWsMem = await ctx.db
          .query("workspaceMemberships")
          .withIndex("by_workspace_user", (q: any) =>
            q.eq("workspaceId", targetWs._id).eq("userId", user._id)
          )
          .first();

        if (existingWsMem) {
          await ctx.db.patch(existingWsMem._id, {
            role: orgInvite.role,
            status: "active",
            acceptedAt: now,
            updatedAt: now,
          });
        } else {
          await ctx.db.insert("workspaceMemberships", {
            workspaceId: targetWs._id,
            userId: user._id,
            role: orgInvite.role,
            status: "active",
            invitedBy: orgInvite.invitedBy,
            invitedAt: orgInvite.createdAt,
            acceptedAt: now,
            createdAt: now,
            updatedAt: now,
          });
        }
      }

      // C. Branch Memberships
      let branchesToAssign = orgInvite.allowedBranches || (orgInvite.primaryBranchId ? [orgInvite.primaryBranchId] : []);
      if (branchesToAssign.length === 0) {
        const orgBranches = await ctx.db
          .query("branches")
          .withIndex("by_organizationId", (q: any) => q.eq("organizationId", orgInvite.organizationId))
          .collect();
        if (orgBranches.length > 0) {
          const primaryB = orgBranches.find((b: any) => b.isPrimary) || orgBranches[0];
          branchesToAssign = [primaryB._id];
        }
      }

      for (const bId of branchesToAssign) {
        const existingBm = await ctx.db
          .query("branchMemberships")
          .withIndex("by_user_branch", (q: any) =>
            q.eq("userId", user._id).eq("branchId", String(bId))
          )
          .first();

        if (existingBm) {
          await ctx.db.patch(existingBm._id, {
            role: orgInvite.role,
            status: "active",
            assignedByUserId: orgInvite.invitedBy,
            assignedAt: now,
            updatedAt: now,
          });
        } else {
          await ctx.db.insert("branchMemberships", {
            workspaceId: String(targetWs?._id || orgInvite.organizationId),
            organizationId: orgInvite.organizationId,
            applicationKey: "inventory",
            branchId: String(bId),
            userId: user._id,
            role: orgInvite.role,
            permissions: [],
            status: "active",
            assignedByUserId: orgInvite.invitedBy,
            assignedAt: now,
            createdAt: now,
            updatedAt: now,
          });
        }
      }

      // D. Mark Accepted
      await ctx.db.patch(orgInvite._id, {
        status: "ACCEPTED",
        acceptedAt: now,
      });

      // E. Resolve Notifications
      if (args.notificationId) {
        await ctx.db.patch(args.notificationId, {
          status: "READ",
          readAt: now,
          data: { isResolved: true, inviteStatus: "ACCEPTED", acceptedAt: now },
        });
      }

      const orgDoc: any = await ctx.db.get(orgInvite.organizationId);

      // F. Notify Inviter
      if (orgInvite.invitedBy) {
        await ctx.db.insert("notifications", {
          userId: orgInvite.invitedBy,
          type: "INVITATION_ACCEPTED",
          title: "Organization Invitation Accepted",
          body: `${user.name || user.email} accepted the invitation to join ${orgDoc?.name || "Organization"}.`,
          severity: "SUCCESS",
          channel: "IN_APP",
          status: "UNREAD",
          category: "workspace",
          priority: "HIGH",
          data: {
            organizationId: orgInvite.organizationId,
            acceptedUserId: user._id,
            email: user.email,
          },
          createdAt: now,
        });
      }

      return {
        success: true,
        inviteType: "organization",
        organizationId: orgInvite.organizationId,
        organizationName: orgDoc?.name || "Organization",
        targetRoute: `/inventory/dashboard?workspaceId=${targetWs?._id || orgInvite.organizationId}`,
      };
    }

    throw new Error("INVITATION_ACCEPT_FAILED");
  },
});

/**
 * UNIFIED INVITATION DECLINE ENGINE
 */
export const declineInviteUnified = mutation({
  args: {
    inviteId: v.string(),
    userId: v.id("users"),
    notificationId: v.optional(v.id("notifications")),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("USER_NOT_FOUND");

    const now = Date.now();

    // 1. Check workspaceInvitations
    let wsInvite: any = null;
    try {
      wsInvite = await ctx.db.get(args.inviteId as any);
      if (wsInvite && !("workspaceId" in wsInvite)) wsInvite = null;
    } catch {}

    if (!wsInvite) {
      wsInvite = await ctx.db
        .query("workspaceInvitations")
        .withIndex("by_token_hash", (q) => q.eq("tokenHash", args.inviteId))
        .first();
    }

    if (wsInvite) {
      await ctx.db.patch(wsInvite._id, {
        status: "declined",
        declinedAt: now,
        updatedAt: now,
      });

      if (args.notificationId) {
        await ctx.db.patch(args.notificationId, {
          status: "READ",
          readAt: now,
          data: { isResolved: true, inviteStatus: "DECLINED" },
        });
      }

      return { success: true, inviteType: "workspace" };
    }

    // 2. Check invitations
    let orgInvite: any = null;
    try {
      orgInvite = await ctx.db.get(args.inviteId as any);
      if (orgInvite && !("organizationId" in orgInvite)) orgInvite = null;
    } catch {}

    if (!orgInvite) {
      orgInvite = await ctx.db
        .query("invitations")
        .withIndex("by_token", (q) => q.eq("token", args.inviteId))
        .first();
    }

    if (orgInvite) {
      await ctx.db.patch(orgInvite._id, {
        status: "CANCELLED",
      });

      if (args.notificationId) {
        await ctx.db.patch(args.notificationId, {
          status: "READ",
          readAt: now,
          data: { isResolved: true, inviteStatus: "CANCELLED" },
        });
      }

      return { success: true, inviteType: "organization" };
    }

    throw new Error("INVITATION_NOT_FOUND");
  },
});

