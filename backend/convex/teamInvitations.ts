import { query, mutation } from "./_generated/server.js";
import { v } from "convex/values";

/**
 * 1. List Application Team Invitations
 */
export const listTeamInvitations = query({
  args: {
    workspaceId: v.string(),
    applicationKey: v.string(),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const wsId = ctx.db.normalizeId("workspaces", args.workspaceId) || args.workspaceId;
    const now = Date.now();

    const invites = await ctx.db
      .query("teamInvitations")
      .withIndex("by_workspace_app", (q: any) =>
        q.eq("workspaceId", wsId).eq("applicationKey", args.applicationKey)
      )
      .collect();

    const branches = await ctx.db
      .query("branches")
      .withIndex("by_workspace", (q: any) => q.eq("workspaceId", wsId))
      .collect();

    const branchMap = new Map(branches.map((b) => [String(b._id), b.name]));

    const mapped = invites.map((inv) => {
      const isExpired = inv.status === "pending" && inv.expiresAt <= now;
      const status = isExpired ? "expired" : inv.status;

      return {
        id: inv._id,
        email: inv.email,
        phoneNumber: inv.phoneNumber,
        appRole: inv.appRole,
        branchAssignments: (inv.branchAssignments || []).map((ba) => ({
          branchId: ba.branchId,
          branchName: branchMap.get(String(ba.branchId)) || "Branch",
          branchRole: ba.branchRole,
        })),
        status,
        invitedAt: inv.invitedAt,
        expiresAt: inv.expiresAt,
        message: inv.message,
        createdAt: inv.createdAt,
      };
    });

    if (args.status && args.status !== "all") {
      return mapped.filter((i) => i.status === args.status);
    }

    return mapped;
  },
});

/**
 * 2. Create Single Team Invitation
 */
export const createTeamInvitation = mutation({
  args: {
    workspaceId: v.string(),
    callerUserId: v.id("users"),
    applicationKey: v.string(),
    email: v.string(),
    phoneNumber: v.optional(v.string()),
    appRole: v.union(v.literal("admin"), v.literal("member"), v.literal("viewer")),
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
        })
      )
    ),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const wsId = ctx.db.normalizeId("workspaces", args.workspaceId) || args.workspaceId;
    const email = args.email.trim().toLowerCase();
    const now = Date.now();
    const expiresAt = now + 7 * 24 * 60 * 60 * 1000; // 7 days expiration

    // 1. Enforce Plan Limits
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

    const pendingInvites = await ctx.db
      .query("teamInvitations")
      .withIndex("by_workspace_app", (q: any) =>
        q.eq("workspaceId", wsId).eq("applicationKey", args.applicationKey)
      )
      .collect();

    const pendingCount = pendingInvites.filter(
      (i) => i.status === "pending" && i.expiresAt > now
    ).length;

    if (activeCount + pendingCount >= maxMembers) {
      throw new Error("PLAN_MEMBER_LIMIT_REACHED");
    }

    // 2. Check if already active member
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q: any) => q.eq("email", email))
      .first();

    if (existingUser) {
      const activeMembership = await ctx.db
        .query("applicationMemberships")
        .withIndex("by_workspace_user_app", (q: any) =>
          q.eq("workspaceId", wsId).eq("userId", existingUser._id).eq("applicationKey", args.applicationKey)
        )
        .first();

      if (activeMembership && activeMembership.status === "active") {
        throw new Error("USER_ALREADY_APPLICATION_MEMBER");
      }
    }

    // 3. Check for existing pending invitation (update/resend instead of duplicating)
    const existingInvite = await ctx.db
      .query("teamInvitations")
      .withIndex("by_email_status", (q: any) => q.eq("email", email).eq("status", "pending"))
      .first();

    let invitationId;
    if (existingInvite && existingInvite.workspaceId === wsId && existingInvite.applicationKey === args.applicationKey) {
      await ctx.db.patch(existingInvite._id, {
        appRole: args.appRole,
        branchAssignments: args.branchAssignments as any,
        message: args.message,
        expiresAt,
        invitedBy: args.callerUserId,
        invitedAt: now,
      });
      invitationId = existingInvite._id;
    } else {
      invitationId = await ctx.db.insert("teamInvitations", {
        workspaceId: wsId,
        applicationKey: args.applicationKey,
        email,
        phoneNumber: args.phoneNumber,
        appRole: args.appRole,
        branchAssignments: args.branchAssignments as any,
        message: args.message,
        invitedBy: args.callerUserId,
        invitedAt: now,
        expiresAt,
        status: "pending",
        existingUserId: existingUser?._id,
        createdAt: now,
      });
    }

    // 4. Audit Log
    await ctx.db.insert("membershipAuditLogs", {
      workspaceId: wsId,
      actorUserId: args.callerUserId,
      targetUserId: existingUser ? existingUser._id : (args.callerUserId as any),
      actionType: "team_invited",
      membershipType: "application",
      membershipId: String(invitationId),
      applicationKey: args.applicationKey,
      newRole: args.appRole,
      createdAt: now,
    });

    return { success: true, invitationId };
  },
});

/**
 * 3. Bulk Create Team Invitations (CSV / Array)
 */
export const bulkCreateTeamInvitations = mutation({
  args: {
    workspaceId: v.string(),
    callerUserId: v.id("users"),
    applicationKey: v.string(),
    invitations: v.array(
      v.object({
        email: v.string(),
        phoneNumber: v.optional(v.string()),
        appRole: v.union(v.literal("admin"), v.literal("member"), v.literal("viewer")),
        branchRole: v.optional(
          v.union(v.literal("manager"), v.literal("staff"), v.literal("viewer"), v.literal("accountant"))
        ),
        branchId: v.optional(v.string()),
        jobTitle: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const wsId = ctx.db.normalizeId("workspaces", args.workspaceId) || args.workspaceId;
    const now = Date.now();
    const expiresAt = now + 7 * 24 * 60 * 60 * 1000;
    const results: Array<{ email: string; success: boolean; error?: string; invitationId?: string }> = [];

    for (const item of args.invitations) {
      const email = item.email.trim().toLowerCase();
      try {
        const branchAssignments = item.branchId && item.branchRole
          ? [{ branchId: item.branchId, branchRole: item.branchRole }]
          : undefined;

        const invId = await ctx.db.insert("teamInvitations", {
          workspaceId: wsId,
          applicationKey: args.applicationKey,
          email,
          phoneNumber: item.phoneNumber,
          appRole: item.appRole,
          branchAssignments: branchAssignments as any,
          invitedBy: args.callerUserId,
          invitedAt: now,
          expiresAt,
          status: "pending",
          createdAt: now,
        });

        results.push({ email, success: true, invitationId: invId });
      } catch (err: any) {
        results.push({ email, success: false, error: err.message });
      }
    }

    return { results, totalSent: results.filter((r) => r.success).length };
  },
});

/**
 * 4. Accept Team Invitation
 */
export const acceptTeamInvitation = mutation({
  args: {
    invitationId: v.id("teamInvitations"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const invite = await ctx.db.get(args.invitationId);
    if (!invite) throw new Error("INVITATION_NOT_FOUND");
    if (invite.status !== "pending") throw new Error("INVITATION_ALREADY_PROCESSED");
    if (invite.expiresAt <= now) throw new Error("INVITATION_EXPIRED");

    const wsId = invite.workspaceId;

    // 1. Mark invite accepted
    await ctx.db.patch(invite._id, {
      status: "accepted",
      acceptedAt: now,
    });

    // 2. Provision application membership
    const existingMem = await ctx.db
      .query("applicationMemberships")
      .withIndex("by_workspace_user_app", (q: any) =>
        q.eq("workspaceId", wsId).eq("userId", args.userId).eq("applicationKey", invite.applicationKey)
      )
      .first();

    if (existingMem) {
      await ctx.db.patch(existingMem._id, {
        appRole: invite.appRole,
        role: invite.appRole,
        status: "active",
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("applicationMemberships", {
        workspaceId: wsId,
        userId: args.userId,
        applicationKey: invite.applicationKey,
        appRole: invite.appRole,
        role: invite.appRole,
        status: "active",
        addedBy: invite.invitedBy,
        addedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }

    // 3. Provision branch assignments
    if (invite.branchAssignments && invite.branchAssignments.length > 0) {
      for (const ba of invite.branchAssignments) {
        const bId = ctx.db.normalizeId("branches", ba.branchId) || ba.branchId;
        const existingBA = await ctx.db
          .query("branchAssignments")
          .withIndex("by_workspace_user_branch", (q: any) =>
            q.eq("workspaceId", wsId).eq("userId", args.userId).eq("branchId", bId)
          )
          .first();

        if (existingBA) {
          await ctx.db.patch(existingBA._id, {
            applicationKey: invite.applicationKey,
            branchRole: ba.branchRole,
            role: ba.branchRole,
            status: "active",
            assignedBy: invite.invitedBy,
            assignedAt: now,
            updatedAt: now,
          });
        } else {
          await ctx.db.insert("branchAssignments", {
            workspaceId: wsId,
            userId: args.userId,
            applicationKey: invite.applicationKey,
            branchId: bId as any,
            branchRole: ba.branchRole,
            role: ba.branchRole,
            assignmentType: "primary",
            status: "active",
            assignedBy: invite.invitedBy,
            assignedAt: now,
            createdAt: now,
            updatedAt: now,
          });
        }
      }
    }

    // 4. Audit log
    await ctx.db.insert("membershipAuditLogs", {
      workspaceId: wsId,
      actorUserId: args.userId,
      targetUserId: args.userId,
      actionType: "invite_accepted",
      membershipType: "application",
      membershipId: String(invite._id),
      applicationKey: invite.applicationKey,
      createdAt: now,
    });

    return { success: true, workspaceId: wsId, applicationKey: invite.applicationKey };
  },
});

/**
 * 5. Decline Invitation
 */
export const declineTeamInvitation = mutation({
  args: {
    invitationId: v.id("teamInvitations"),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const invite = await ctx.db.get(args.invitationId);
    if (!invite) throw new Error("INVITATION_NOT_FOUND");
    await ctx.db.patch(invite._id, {
      status: "declined",
      declinedAt: Date.now(),
    });
    return { success: true };
  },
});

/**
 * 6. Revoke Invitation
 */
export const revokeTeamInvitation = mutation({
  args: {
    invitationId: v.id("teamInvitations"),
    callerUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const invite = await ctx.db.get(args.invitationId);
    if (!invite) throw new Error("INVITATION_NOT_FOUND");
    await ctx.db.patch(invite._id, {
      status: "revoked",
    });
    return { success: true };
  },
});

/**
 * 7. Cron: Cleanup Expired Temporary Branch Assignments
 */
export const cleanupExpiredAssignments = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const expiredAssignments = await ctx.db
      .query("branchAssignments")
      .withIndex("by_temporary_until", (q: any) => q.lte("temporaryUntil", now))
      .collect();

    let cleaned = 0;
    for (const a of expiredAssignments) {
      if (a.assignmentType === "temporary" && a.status === "active") {
        await ctx.db.patch(a._id, {
          status: "removed",
          updatedAt: now,
        });
        cleaned++;
      }
    }

    return { cleanedCount: cleaned };
  },
});
