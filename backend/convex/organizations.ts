import { query, mutation } from "./_generated/server.js";
import { v } from "convex/values";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const getOrganizationById = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.organizationId);
  },
});

export const getOrganizationBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
  },
});

export const getMembership = query({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("organizationMemberships")
      .withIndex("by_org_and_user", (q: any) =>
        q.eq("organizationId", args.organizationId).eq("userId", args.userId)
      )
      .first();
  },
});

export const getUserMemberships = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const memberships = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    const results = [];
    for (const m of memberships) {
      const org = await ctx.db.get(m.organizationId);
      if (org) {
        results.push({ membership: m, organization: org });
      }
    }
    return results;
  },
});

export const getOrganizationSettings = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("organizationSettings")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .first();
  },
});

export const createOrganization = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    industry: v.string(),
    country: v.string(),
    timezone: v.string(),
    website: v.optional(v.string()),
    size: v.optional(v.string()),
    logo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Verify user exists and email is verified
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }
    if (!user.emailVerified) {
      throw new Error("EMAIL_NOT_VERIFIED");
    }

    const now = Date.now();

    // 2. Check idempotency: If user already has an active onboarding with an org
    const onboarding = await ctx.db
      .query("onboardingProgress")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (onboarding && onboarding.organizationId) {
      const existingOrg = await ctx.db.get(onboarding.organizationId);
      if (existingOrg) {
        // Return existing organization with owner membership
        const membership = await ctx.db
          .query("organizationMemberships")
          .withIndex("by_org_and_user", (q: any) =>
            q.eq("organizationId", existingOrg._id).eq("userId", args.userId)
          )
          .first();

        return {
          organization: existingOrg,
          membership: membership || { role: "OWNER" as const, status: "ACTIVE" as const },
          onboarding,
          isDuplicate: true,
        };
      }
    }

    // 3. Generate unique slug
    let baseSlug = generateSlug(args.name);
    if (!baseSlug) {
      baseSlug = "organization";
    }

    let slug = baseSlug;
    let counter = 1;
    while (true) {
      const existingSlug = await ctx.db
        .query("organizations")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first();

      if (!existingSlug) break;
      counter++;
      slug = `${baseSlug}-${counter}`;
    }

    // 4. ATOMIC CREATION: Org + Membership + Settings + Default Workspace + Onboarding Update
    const organizationId = await ctx.db.insert("organizations", {
      name: args.name,
      slug,
      industry: args.industry,
      country: args.country,
      timezone: args.timezone,
      website: args.website,
      size: args.size,
      logo: args.logo,
      createdAt: now,
      updatedAt: now,
    });

    const membershipId = await ctx.db.insert("organizationMemberships", {
      organizationId,
      userId: args.userId,
      role: "OWNER",
      status: "ACTIVE",
      joinedAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("organizationSettings", {
      organizationId,
      enabledModules: [],
      workspaceReady: false,
      defaults: {},
      updatedAt: now,
    });

    // Auto-provision default workspace
    await ctx.db.insert("workspaces", {
      organizationId,
      name: "Main Workspace",
      slug: "main",
      isDefault: true,
      enabledModules: [],
      settings: {
        currency: args.country === "NG" ? "NGN" : "USD",
        timezone: args.timezone,
      },
      createdAt: now,
      updatedAt: now,
    });

    let completedSteps = ["ACCOUNT_CREATED", "EMAIL_VERIFIED", "ORGANIZATION_CREATION", "ORGANIZATION_CREATED"];
    let onboardingId;
    if (onboarding) {
      completedSteps = Array.from(
        new Set([...onboarding.completedSteps, "ORGANIZATION_CREATION", "ORGANIZATION_CREATED", "ORGANIZATION_CONFIGURED"])
      );
      await ctx.db.patch(onboarding._id, {
        organizationId,
        currentStep: "MODULE_SELECTION",
        completedSteps,
        updatedAt: now,
      });
      onboardingId = onboarding._id;
    } else {
      onboardingId = await ctx.db.insert("onboardingProgress", {
        userId: args.userId,
        organizationId,
        currentStep: "MODULE_SELECTION",
        status: "IN_PROGRESS",
        completedSteps,
        startedAt: now,
        updatedAt: now,
      });
    }

    // Audit log
    await ctx.db.insert("auditLogs", {
      actorId: args.userId,
      organizationId,
      action: "organization.created",
      resource: `organization:${organizationId}`,
      metadata: { name: args.name, slug },
      timestamp: now,
    });

    const organization = await ctx.db.get(organizationId);
    const membership = await ctx.db.get(membershipId);
    const updatedOnboarding = await ctx.db.get(onboardingId!);

    return {
      organization,
      membership,
      onboarding: updatedOnboarding,
      isDuplicate: false,
    };
  },
});

export const updateOrganization = mutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    name: v.optional(v.string()),
    industry: v.optional(v.string()),
    country: v.optional(v.string()),
    timezone: v.optional(v.string()),
    website: v.optional(v.string()),
    size: v.optional(v.string()),
    logo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check permission
    const membership = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_org_and_user", (q: any) =>
        q.eq("organizationId", args.organizationId).eq("userId", args.userId)
      )
      .first();

    if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
      throw new Error("ORGANIZATION_ACCESS_DENIED");
    }

    const org = await ctx.db.get(args.organizationId);
    if (!org) {
      throw new Error("ORGANIZATION_NOT_FOUND");
    }

    const now = Date.now();
    const patchData: Record<string, unknown> = { updatedAt: now };
    if (args.name !== undefined) patchData.name = args.name;
    if (args.industry !== undefined) patchData.industry = args.industry;
    if (args.country !== undefined) patchData.country = args.country;
    if (args.timezone !== undefined) patchData.timezone = args.timezone;
    if (args.website !== undefined) patchData.website = args.website;
    if (args.size !== undefined) patchData.size = args.size;
    if (args.logo !== undefined) patchData.logo = args.logo;

    await ctx.db.patch(args.organizationId, patchData);

    // Audit log
    await ctx.db.insert("auditLogs", {
      actorId: args.userId,
      organizationId: args.organizationId,
      action: "organization.updated",
      resource: `organization:${args.organizationId}`,
      metadata: patchData,
      timestamp: now,
    });

    return await ctx.db.get(args.organizationId);
  },
});

export const leaveOrganization = mutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_org_and_user", (q: any) =>
        q.eq("organizationId", args.organizationId).eq("userId", args.userId)
      )
      .first();

    if (!membership || membership.status !== "ACTIVE") {
      throw new Error("MEMBERSHIP_NOT_FOUND");
    }

    if (membership.role === "OWNER") {
      const allMembers = await ctx.db
        .query("organizationMemberships")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", args.organizationId))
        .collect();

      const activeMembers = allMembers.filter((m) => m.status === "ACTIVE");
      const activeOwners = activeMembers.filter((m) => m.role === "OWNER");

      if (activeOwners.length === 1 && activeMembers.length > 1) {
        throw new Error("OWNER_CANNOT_LEAVE");
      }
    }

    await ctx.db.delete(membership._id);

    const now = Date.now();
    await ctx.db.insert("auditLogs", {
      actorId: args.userId,
      organizationId: args.organizationId,
      action: "organization.member_left",
      resource: `organization:${args.organizationId}`,
      metadata: { userId: args.userId },
      timestamp: now,
    });

    return { success: true };
  },
});

export const deleteOrganization = mutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // 1. Verify caller is OWNER of this organization
    const membership = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_org_and_user", (q: any) =>
        q.eq("organizationId", args.organizationId).eq("userId", args.userId)
      )
      .first();

    if (!membership || membership.role !== "OWNER") {
      throw new Error("ORGANIZATION_ACCESS_DENIED");
    }

    // 2. Safeguard: Cannot delete if other active members exist
    const allMembers = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", args.organizationId))
      .collect();

    const otherActiveMembers = allMembers.filter(
      (m) => m.userId !== args.userId && m.status === "ACTIVE"
    );

    if (otherActiveMembers.length > 0) {
      throw new Error("CANNOT_DELETE_ORG_WITH_MEMBERS");
    }

    // 3. Cascade cleanup
    // Delete memberships
    for (const m of allMembers) {
      await ctx.db.delete(m._id);
    }

    // Delete organizationSettings
    const settings = await ctx.db
      .query("organizationSettings")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", args.organizationId))
      .collect();
    for (const s of settings) {
      await ctx.db.delete(s._id);
    }

    // Delete organizationModules
    const modules = await ctx.db
      .query("organizationModules")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", args.organizationId))
      .collect();
    for (const mod of modules) {
      await ctx.db.delete(mod._id);
    }

    // Delete invitations
    const invites = await ctx.db
      .query("invitations")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", args.organizationId))
      .collect();
    for (const inv of invites) {
      await ctx.db.delete(inv._id);
    }

    // Delete workspaces
    const workspaces = await ctx.db
      .query("workspaces")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", args.organizationId))
      .collect();
    for (const ws of workspaces) {
      await ctx.db.delete(ws._id);
    }

    // Dissociate onboardingProgress
    const onboardingRecords = await ctx.db
      .query("onboardingProgress")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", args.organizationId))
      .collect();
    for (const onb of onboardingRecords) {
      await ctx.db.patch(onb._id, { organizationId: undefined });
    }

    // Delete auditLogs
    const auditRecords = await ctx.db
      .query("auditLogs")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", args.organizationId))
      .collect();
    for (const aud of auditRecords) {
      await ctx.db.delete(aud._id);
    }

    // Delete organization record itself
    await ctx.db.delete(args.organizationId);

    return { success: true };
  },
});

export const getOrganizationMembers = query({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const caller = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_org_and_user", (q: any) =>
        q.eq("organizationId", args.organizationId).eq("userId", args.userId)
      )
      .first();
    if (!caller) throw new Error("ORGANIZATION_ACCESS_DENIED");

    const memberships = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", args.organizationId))
      .collect();

    const results = [];
    for (const m of memberships) {
      const user = await ctx.db.get(m.userId);
      if (user) {
        results.push({
          id: m._id,
          organizationId: m.organizationId,
          userId: m.userId,
          role: m.role,
          status: m.status,
          joinedAt: m.joinedAt,
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            avatarUrl: user.avatarUrl,
          },
        });
      }
    }
    return results;
  },
});

export const updateMemberRole = mutation({
  args: {
    organizationId: v.id("organizations"),
    callerUserId: v.id("users"),
    targetUserId: v.id("users"),
    newRole: v.union(
      v.literal("OWNER"),
      v.literal("ADMIN"),
      v.literal("MANAGER"),
      v.literal("MEMBER")
    ),
  },
  handler: async (ctx, args) => {
    const caller = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_org_and_user", (q: any) =>
        q.eq("organizationId", args.organizationId).eq("userId", args.callerUserId)
      )
      .first();

    if (!caller || (caller.role !== "OWNER" && caller.role !== "ADMIN")) {
      throw new Error("ORGANIZATION_ACCESS_DENIED");
    }

    const target = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_org_and_user", (q: any) =>
        q.eq("organizationId", args.organizationId).eq("userId", args.targetUserId)
      )
      .first();

    if (!target) throw new Error("MEMBER_NOT_FOUND");

    // Last-Owner Protection: If demoting an OWNER, ensure at least one active OWNER remains
    if (target.role === "OWNER" && args.newRole !== "OWNER") {
      const allMembers = await ctx.db
        .query("organizationMemberships")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", args.organizationId))
        .collect();
      const activeOwners = allMembers.filter((m) => m.role === "OWNER" && m.status === "ACTIVE");
      if (activeOwners.length <= 1) {
        throw new Error("CANNOT_REMOVE_LAST_OWNER");
      }
    }

    await ctx.db.patch(target._id, {
      role: args.newRole,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

export const removeMember = mutation({
  args: {
    organizationId: v.id("organizations"),
    callerUserId: v.id("users"),
    targetUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const caller = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_org_and_user", (q: any) =>
        q.eq("organizationId", args.organizationId).eq("userId", args.callerUserId)
      )
      .first();

    if (!caller || (caller.role !== "OWNER" && caller.role !== "ADMIN")) {
      throw new Error("ORGANIZATION_ACCESS_DENIED");
    }

    const target = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_org_and_user", (q: any) =>
        q.eq("organizationId", args.organizationId).eq("userId", args.targetUserId)
      )
      .first();

    if (!target) throw new Error("MEMBER_NOT_FOUND");

    // Last-Owner Protection
    if (target.role === "OWNER") {
      const allMembers = await ctx.db
        .query("organizationMemberships")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", args.organizationId))
        .collect();
      const activeOwners = allMembers.filter((m) => m.role === "OWNER" && m.status === "ACTIVE");
      if (activeOwners.length <= 1) {
        throw new Error("CANNOT_REMOVE_LAST_OWNER");
      }
    }

    await ctx.db.delete(target._id);
    return { success: true };
  },
});
