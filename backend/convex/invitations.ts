import { query, mutation } from "./_generated/server.js";
import { v } from "convex/values";

export const getInvitationByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    let invite = await ctx.db
      .query("invitations")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!invite) {
      invite = await ctx.db
        .query("invitations")
        .withIndex("by_tokenHash", (q) => q.eq("tokenHash", args.token))
        .first();
    }

    if (!invite) return null;

    const org = await ctx.db.get(invite.organizationId);
    const inviter = await ctx.db.get(invite.invitedBy);
    return {
      id: invite._id,
      email: invite.email,
      role: invite.role,
      status: invite.status,
      expiresAt: invite.expiresAt,
      isExpired: invite.expiresAt < Date.now(),
      organization: org ? { id: org._id, name: org.name, slug: org.slug } : null,
      inviter: inviter ? { name: inviter.name } : null,
    };
  },
});

export const getOrganizationInvitations = query({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify membership
    const membership = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_org_and_user", (q: any) =>
        q.eq("organizationId", args.organizationId).eq("userId", args.userId)
      )
      .first();

    if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
      throw new Error("ORGANIZATION_ACCESS_DENIED");
    }

    const invites = await ctx.db
      .query("invitations")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .collect();

    // Map without exposing raw secure tokens if not necessary
    return invites.map((inv) => ({
      id: inv._id,
      email: inv.email,
      role: inv.role,
      status: inv.status,
      expiresAt: inv.expiresAt,
      createdAt: inv.createdAt,
    }));
  },
});

export const createInvitations = mutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    invitations: v.array(
      v.object({
        email: v.string(),
        role: v.union(
          v.literal("OWNER"),
          v.literal("ADMIN"),
          v.literal("MANAGER"),
          v.literal("MEMBER")
        ),
        token: v.string(),
        expiresAt: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    // 1. Verify user membership and permission (OWNER or ADMIN)
    const membership = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_org_and_user", (q: any) =>
        q.eq("organizationId", args.organizationId).eq("userId", args.userId)
      )
      .first();

    if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
      throw new Error("ORGANIZATION_ACCESS_DENIED");
    }

    const now = Date.now();
    const created = [];

    for (const inv of args.invitations) {
      const email = inv.email.toLowerCase();

      // Check if user already a member of org
      const existingUser = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first();

      if (existingUser) {
        const existingMember = await ctx.db
          .query("organizationMemberships")
          .withIndex("by_org_and_user", (q: any) =>
            q.eq("organizationId", args.organizationId).eq("userId", existingUser._id)
          )
          .first();

        if (existingMember && existingMember.status === "ACTIVE") {
          throw new Error("USER_ALREADY_MEMBER");
        }
      }

      // Check if pending invitation already exists for this email in this org
      const existingInvite = await ctx.db
        .query("invitations")
        .withIndex("by_org_and_email", (q: any) =>
          q.eq("organizationId", args.organizationId).eq("email", email)
        )
        .first();

      if (existingInvite && existingInvite.status === "PENDING" && existingInvite.expiresAt > now) {
        // Update expiration and token rather than failing
        await ctx.db.patch(existingInvite._id, {
          role: inv.role,
          token: inv.token,
          expiresAt: inv.expiresAt,
          invitedBy: args.userId,
        });
        created.push({ id: existingInvite._id, email, role: inv.role, token: inv.token });
        continue;
      }

      const inviteId = await ctx.db.insert("invitations", {
        organizationId: args.organizationId,
        email,
        role: inv.role,
        token: inv.token,
        status: "PENDING",
        invitedBy: args.userId,
        expiresAt: inv.expiresAt,
        createdAt: now,
      });

      // Audit log
      await ctx.db.insert("auditLogs", {
        actorId: args.userId,
        organizationId: args.organizationId,
        action: "invitation.created",
        resource: `invitation:${inviteId}`,
        metadata: { email, role: inv.role },
        timestamp: now,
      });

      created.push({ id: inviteId, email, role: inv.role, token: inv.token });
    }

    // Update onboarding progress if during onboarding
    const onboarding = await ctx.db
      .query("onboardingProgress")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (onboarding) {
      const completedSteps = Array.from(
        new Set([...onboarding.completedSteps, "TEAM_INVITATION", "TEAM_INVITED"])
      );
      await ctx.db.patch(onboarding._id, {
        currentStep: "COMPLETED",
        completedSteps,
        updatedAt: now,
      });
    }

    return created;
  },
});

export const acceptInvitation = mutation({
  args: {
    token: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // 1. Find invitation by token or tokenHash
    let invite = await ctx.db
      .query("invitations")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!invite) {
      invite = await ctx.db
        .query("invitations")
        .withIndex("by_tokenHash", (q) => q.eq("tokenHash", args.token))
        .first();
    }

    if (!invite) {
      throw new Error("INVITATION_NOT_FOUND");
    }

    if (invite.status === "ACCEPTED") {
      throw new Error("INVITATION_ALREADY_ACCEPTED");
    }

    if (invite.status === "CANCELLED") {
      throw new Error("INVITATION_CANCELLED");
    }

    const now = Date.now();
    if (invite.expiresAt < now || invite.status === "EXPIRED") {
      if (invite.status !== "EXPIRED") {
        await ctx.db.patch(invite._id, { status: "EXPIRED" });
      }
      throw new Error("INVITATION_EXPIRED");
    }

    // 2. Verify accepting user email matches invited email
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
      throw new Error("INVITATION_EMAIL_MISMATCH");
    }

    // 3. Create or update membership
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

    // 4. Mark invitation accepted
    await ctx.db.patch(invite._id, {
      status: "ACCEPTED",
      acceptedAt: now,
    });

    // 5. Audit log
    await ctx.db.insert("auditLogs", {
      actorId: user._id,
      organizationId: invite.organizationId,
      action: "invitation.accepted",
      resource: `invitation:${invite._id}`,
      metadata: { role: invite.role },
      timestamp: now,
    });

    const org = await ctx.db.get(invite.organizationId);

    const onboarding = await ctx.db
      .query("onboardingProgress")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();
    if (onboarding) {
      await ctx.db.patch(onboarding._id, {
        organizationId: invite.organizationId,
        currentStep: "COMPLETED",
        status: "COMPLETED",
        completedSteps: Array.from(new Set([...onboarding.completedSteps, "INVITATION_ACCEPTED", "COMPLETED"])),
        completedAt: now,
        updatedAt: now,
      });
    }

    return {
      organization: org ? { id: org._id, name: org.name, slug: org.slug } : null,
      role: invite.role,
    };
  },
});

export const resendInvitation = mutation({
  args: {
    invitationId: v.id("invitations"),
    userId: v.id("users"),
    token: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const invite = await ctx.db.get(args.invitationId);
    if (!invite) {
      throw new Error("INVITATION_NOT_FOUND");
    }

    // Verify caller permission in the organization
    const membership = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_org_and_user", (q: any) =>
        q.eq("organizationId", invite.organizationId).eq("userId", args.userId)
      )
      .first();

    if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
      throw new Error("ORGANIZATION_ACCESS_DENIED");
    }

    if (invite.status === "ACCEPTED") {
      throw new Error("INVITATION_ALREADY_ACCEPTED");
    }

    const now = Date.now();
    await ctx.db.patch(invite._id, {
      token: args.token,
      expiresAt: args.expiresAt,
      status: "PENDING",
      invitedBy: args.userId,
    });

    // Audit log
    await ctx.db.insert("auditLogs", {
      actorId: args.userId,
      organizationId: invite.organizationId,
      action: "invitation.resent",
      resource: `invitation:${invite._id}`,
      metadata: { email: invite.email, role: invite.role },
      timestamp: now,
    });

    const org = await ctx.db.get(invite.organizationId);
    const inviter = await ctx.db.get(args.userId);

    return {
      id: invite._id,
      email: invite.email,
      role: invite.role,
      status: "PENDING",
      token: args.token,
      expiresAt: args.expiresAt,
      organizationId: invite.organizationId,
      organizationName: org?.name || "your organization",
      inviterName: inviter?.name || "A teammate",
    };
  },
});

export const cancelInvitation = mutation({
  args: {
    invitationId: v.id("invitations"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const invite = await ctx.db.get(args.invitationId);
    if (!invite) {
      throw new Error("INVITATION_NOT_FOUND");
    }

    // Verify caller permission in the organization
    const membership = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_org_and_user", (q: any) =>
        q.eq("organizationId", invite.organizationId).eq("userId", args.userId)
      )
      .first();

    if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
      throw new Error("ORGANIZATION_ACCESS_DENIED");
    }

    if (invite.status === "ACCEPTED") {
      throw new Error("INVITATION_ALREADY_ACCEPTED");
    }

    const now = Date.now();
    await ctx.db.patch(invite._id, {
      status: "CANCELLED",
    });

    // Audit log
    await ctx.db.insert("auditLogs", {
      actorId: args.userId,
      organizationId: invite.organizationId,
      action: "invitation.cancelled",
      resource: `invitation:${invite._id}`,
      metadata: { email: invite.email, role: invite.role },
      timestamp: now,
    });

    return { success: true };
  },
});
