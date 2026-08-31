import { query, mutation } from "./_generated/server.js";
import { v } from "convex/values";

export const getUserByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .first();
    if (user?.deletedAt) return null;
    return user;
  },
});

export const getUserById = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (user?.deletedAt) return null;
    return user;
  },
});

export const getUserByVerificationToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_verification_token", (q) =>
        q.eq("emailVerificationToken", args.token)
      )
      .first();
  },
});

export const getUserByNormalizedEmail = query({
  args: { emailNormalized: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_email_normalized", (q) => q.eq("emailNormalized", args.emailNormalized.toLowerCase().trim()))
      .first();
  },
});

export const createUser = mutation({
  args: {
    email: v.string(),
    name: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    displayName: v.optional(v.string()),
    country: v.optional(v.string()),
    timezone: v.optional(v.string()),
    locale: v.optional(v.string()),
    phone: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    passwordHash: v.string(),
    emailVerificationToken: v.optional(v.string()),
    emailVerificationExpiresAt: v.optional(v.number()),
    emailVerified: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const emailNorm = args.email.toLowerCase().trim();
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", emailNorm))
      .first();

    if (existing) {
      throw new Error("USER_ALREADY_EXISTS");
    }

    const now = Date.now();
    const displayName = args.displayName || args.name || `${args.firstName || ''} ${args.lastName || ''}`.trim();
    const userId = await ctx.db.insert("users", {
      email: emailNorm,
      emailNormalized: emailNorm,
      name: args.name || displayName,
      firstName: args.firstName,
      lastName: args.lastName,
      displayName,
      country: args.country,
      timezone: args.timezone,
      locale: args.locale,
      phone: args.phone,
      avatarUrl: args.avatarUrl,
      passwordHash: args.passwordHash,
      emailVerified: args.emailVerified ?? false,
      emailVerificationToken: args.emailVerificationToken,
      emailVerificationExpiresAt: args.emailVerificationExpiresAt,
      status: "ACTIVE",
      tokenVersion: 1,
      createdAt: now,
      updatedAt: now,
    });

    // Record password identity in authIdentities
    await ctx.db.insert("authIdentities", {
      userId,
      provider: "password",
      providerSubject: emailNorm,
      providerEmail: emailNorm,
      providerEmailVerified: false,
      createdAt: now,
      lastUsedAt: now,
      updatedAt: now,
    });

    // Initialize onboarding progress immediately upon account creation
    const isVerified = args.emailVerified ?? false;
    await ctx.db.insert("onboardingProgress", {
      userId,
      currentStep: isVerified ? "ORGANIZATION_CREATION" : "EMAIL_VERIFICATION",
      status: "IN_PROGRESS",
      completedSteps: isVerified ? ["ACCOUNT_CREATED", "EMAIL_VERIFIED"] : ["ACCOUNT_CREATED"],
      startedAt: now,
      updatedAt: now,
    });

    return userId;
  },
});

export const setVerificationToken = mutation({
  args: {
    userId: v.id("users"),
    token: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      emailVerificationToken: args.token,
      emailVerificationExpiresAt: args.expiresAt,
      updatedAt: Date.now(),
    });
  },
});

export const verifyUserEmail = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_verification_token", (q) =>
        q.eq("emailVerificationToken", args.token)
      )
      .first();

    if (!user) {
      throw new Error("INVALID_TOKEN");
    }

    if (
      user.emailVerificationExpiresAt &&
      user.emailVerificationExpiresAt < Date.now()
    ) {
      throw new Error("TOKEN_EXPIRED");
    }

    const now = Date.now();
    await ctx.db.patch(user._id, {
      emailVerified: true,
      emailVerifiedAt: now,
      emailVerificationToken: undefined,
      emailVerificationExpiresAt: undefined,
      updatedAt: now,
    });

    // Also update authIdentities email verification
    const identities = await ctx.db
      .query("authIdentities")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();
    for (const identity of identities) {
      if (identity.providerEmail?.toLowerCase() === user.email.toLowerCase()) {
        await ctx.db.patch(identity._id, {
          providerEmailVerified: true,
          updatedAt: now,
        });
      }
    }

    // Update onboarding progress to ORGANIZATION_CREATION
    const onboarding = await ctx.db
      .query("onboardingProgress")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();

    if (onboarding) {
      const completedSteps = Array.from(
        new Set([...onboarding.completedSteps, "EMAIL_VERIFIED"])
      );
      await ctx.db.patch(onboarding._id, {
        currentStep: "ORGANIZATION_CREATION",
        completedSteps,
        updatedAt: now,
      });
    }

    return { userId: user._id, email: user.email };
  },
});

export const touchLastLogin = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.userId, {
      lastLoginAt: now,
      updatedAt: now,
    });
  },
});

export const getIdentityByProvider = query({
  args: {
    provider: v.union(v.literal("google"), v.literal("facebook")),
    providerUserId: v.string(),
  },
  handler: async (ctx, args) => {
    // Check authIdentities first
    const authId = await ctx.db
      .query("authIdentities")
      .withIndex("by_provider_and_subject", (q: any) =>
        q.eq("provider", args.provider).eq("providerSubject", args.providerUserId)
      )
      .first();

    if (authId) {
      return {
        _id: authId._id,
        userId: authId.userId,
        provider: authId.provider,
        providerUserId: authId.providerSubject,
        providerEmail: authId.providerEmail,
        createdAt: authId.createdAt,
        updatedAt: authId.updatedAt || authId.createdAt,
      };
    }

    // Fallback to userIdentities
    return await ctx.db
      .query("userIdentities")
      .withIndex("by_provider_and_providerUserId", (q: any) =>
        q.eq("provider", args.provider).eq("providerUserId", args.providerUserId)
      )
      .first();
  },
});

export const getIdentitiesByUserId = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const authIds = await ctx.db
      .query("authIdentities")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    if (authIds.length > 0) {
      return authIds.map((i) => ({
        id: i._id,
        userId: i.userId,
        provider: i.provider,
        providerSubject: i.providerSubject,
        providerEmail: i.providerEmail,
        providerEmailVerified: i.providerEmailVerified,
        createdAt: i.createdAt,
        lastUsedAt: i.lastUsedAt,
      }));
    }

    // Fallback if not yet migrated to authIdentities
    const legacy = await ctx.db
      .query("userIdentities")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    return legacy.map((i) => ({
      id: i._id,
      userId: i.userId,
      provider: i.provider,
      providerSubject: i.providerUserId,
      providerEmail: i.providerEmail,
      createdAt: i.createdAt,
      lastUsedAt: i.updatedAt,
    }));
  },
});

export const getUserIdentities = getIdentitiesByUserId;

export const linkSocialIdentity = mutation({
  args: {
    userId: v.id("users"),
    provider: v.union(v.literal("google"), v.literal("facebook")),
    providerUserId: v.string(),
    providerEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existingAuth = await ctx.db
      .query("authIdentities")
      .withIndex("by_provider_and_subject", (q: any) =>
        q.eq("provider", args.provider).eq("providerSubject", args.providerUserId)
      )
      .first();

    if (existingAuth) {
      if (existingAuth.userId !== args.userId) {
        throw new Error("OAUTH_IDENTITY_ALREADY_LINKED");
      }
      return existingAuth._id;
    }

    const now = Date.now();
    const id = await ctx.db.insert("authIdentities", {
      userId: args.userId,
      provider: args.provider,
      providerSubject: args.providerUserId,
      providerEmail: args.providerEmail,
      providerEmailVerified: true,
      createdAt: now,
      lastUsedAt: now,
      updatedAt: now,
    });

    // Also keep legacy userIdentities in sync
    await ctx.db.insert("userIdentities", {
      userId: args.userId,
      provider: args.provider,
      providerUserId: args.providerUserId,
      providerEmail: args.providerEmail,
      createdAt: now,
      updatedAt: now,
    });

    return id;
  },
});

export const unlinkIdentity = mutation({
  args: {
    userId: v.id("users"),
    identityId: v.optional(v.union(v.id("authIdentities"), v.string())),
    provider: v.optional(v.union(v.literal("password"), v.literal("google"), v.literal("facebook"), v.literal("phone"), v.literal("apple"), v.string())),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("USER_NOT_FOUND");

    const allIdentities = await ctx.db
      .query("authIdentities")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    const hasPassword = Boolean(user.passwordHash);
    const otherSocialCount = allIdentities.filter(
      (i) => (args.identityId ? i._id !== args.identityId : true) && (args.provider ? i.provider !== args.provider : true) && i.provider !== "password"
    ).length;

    const isPasswordTarget = args.provider === "password" || (args.identityId && allIdentities.find((i) => i._id === args.identityId)?.provider === "password");

    if (isPasswordTarget) {
      if (otherSocialCount === 0) {
        throw new Error("CANNOT_REMOVE_ONLY_LOGIN_METHOD");
      }
      await ctx.db.patch(args.userId, { passwordHash: undefined, updatedAt: Date.now() });
    } else {
      if (!hasPassword && otherSocialCount === 0) {
        throw new Error("CANNOT_REMOVE_ONLY_LOGIN_METHOD");
      }
    }

    const targetIdentity = args.identityId
      ? allIdentities.find((i) => i._id === args.identityId)
      : args.provider
      ? allIdentities.find((i) => i.provider === args.provider)
      : undefined;

    if (targetIdentity) {
      await ctx.db.delete(targetIdentity._id);
    }

    return { success: true };
  },
});

export const createSocialUser = mutation({
  args: {
    email: v.string(),
    name: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    emailVerified: v.boolean(),
    provider: v.union(v.literal("google"), v.literal("facebook")),
    providerUserId: v.string(),
    providerEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const emailNorm = args.email.toLowerCase().trim();
    const userId = await ctx.db.insert("users", {
      email: emailNorm,
      emailNormalized: emailNorm,
      name: args.name,
      firstName: args.firstName,
      lastName: args.lastName,
      displayName: args.name,
      avatarUrl: args.avatarUrl,
      avatar: args.avatarUrl,
      emailVerified: args.emailVerified,
      emailVerifiedAt: args.emailVerified ? now : undefined,
      status: "ACTIVE",
      tokenVersion: 1,
      lastLoginAt: now,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("authIdentities", {
      userId,
      provider: args.provider,
      providerSubject: args.providerUserId,
      providerEmail: args.providerEmail || emailNorm,
      providerEmailVerified: args.emailVerified,
      createdAt: now,
      lastUsedAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("userIdentities", {
      userId,
      provider: args.provider,
      providerUserId: args.providerUserId,
      providerEmail: args.providerEmail,
      createdAt: now,
      updatedAt: now,
    });

    const initialStep = args.emailVerified
      ? "ORGANIZATION_CREATION"
      : "EMAIL_VERIFICATION";
    const completedSteps = args.emailVerified
      ? ["ACCOUNT_CREATED", "EMAIL_VERIFIED"]
      : ["ACCOUNT_CREATED"];

    await ctx.db.insert("onboardingProgress", {
      userId,
      currentStep: initialStep,
      status: "IN_PROGRESS",
      completedSteps,
      startedAt: now,
      updatedAt: now,
    });

    return userId;
  },
});

export const getUserByPasswordResetToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_password_reset_token", (q) =>
        q.eq("passwordResetToken", args.token)
      )
      .first();
  },
});

export const setPasswordResetToken = mutation({
  args: {
    userId: v.id("users"),
    token: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      passwordResetToken: args.token,
      passwordResetExpiresAt: args.expiresAt,
      updatedAt: Date.now(),
    });
  },
});

export const resetPassword = mutation({
  args: {
    token: v.string(),
    passwordHash: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_password_reset_token", (q) =>
        q.eq("passwordResetToken", args.token)
      )
      .first();

    if (!user) {
      throw new Error("INVALID_TOKEN");
    }

    if (
      user.passwordResetExpiresAt &&
      user.passwordResetExpiresAt < Date.now()
    ) {
      throw new Error("TOKEN_EXPIRED");
    }

    const now = Date.now();
    const nextVersion = (user.tokenVersion ?? 0) + 1;
    await ctx.db.patch(user._id, {
      passwordHash: args.passwordHash,
      passwordResetToken: undefined,
      passwordResetExpiresAt: undefined,
      tokenVersion: nextVersion,
      updatedAt: now,
    });

    // Enqueue security notification email
    await ctx.db.insert("emailOutbox", {
      to: user.email,
      template: "securityAlert",
      payload: {
        name: user.name || user.firstName || "User",
        alertType: "password_changed",
        timestamp: now,
      },
      status: "PENDING",
      attempts: 0,
      nextAttemptAt: now,
      createdAt: now,
      updatedAt: now,
    });

    return { userId: user._id, email: user.email };
  },
});

export const updatePassword = mutation({
  args: {
    userId: v.id("users"),
    passwordHash: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }
    const now = Date.now();
    const nextVersion = (user.tokenVersion ?? 0) + 1;
    await ctx.db.patch(args.userId, {
      passwordHash: args.passwordHash,
      tokenVersion: nextVersion,
      updatedAt: now,
    });

    // Enqueue security notification email
    await ctx.db.insert("emailOutbox", {
      to: user.email,
      template: "securityAlert",
      payload: {
        name: user.name || user.firstName || "User",
        alertType: "password_changed",
        timestamp: now,
      },
      status: "PENDING",
      attempts: 0,
      nextAttemptAt: now,
      createdAt: now,
      updatedAt: now,
    });

    return { userId: args.userId };
  },
});

export const invalidateUserSessions = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }
    const currentVersion = user.tokenVersion ?? 0;
    const nextVersion = currentVersion + 1;
    const now = Date.now();
    await ctx.db.patch(args.userId, {
      tokenVersion: nextVersion,
      updatedAt: now,
    });
    return { tokenVersion: nextVersion };
  },
});

export const updateUserProfile = mutation({
  args: {
    userId: v.id("users"),
    name: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    displayName: v.optional(v.string()),
    preferredName: v.optional(v.string()),
    jobTitle: v.optional(v.string()),
    department: v.optional(v.string()),
    bio: v.optional(v.string()),
    avatar: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    phone: v.optional(v.string()),
    phoneVisibility: v.optional(v.union(v.literal("private"), v.literal("workspace"))),
    country: v.optional(v.string()),
    state: v.optional(v.string()),
    stateCode: v.optional(v.string()),
    lga: v.optional(v.string()),
    city: v.optional(v.string()),
    timezone: v.optional(v.string()),
    language: v.optional(v.string()),
    locale: v.optional(v.string()),
    dateFormat: v.optional(v.string()),
    numberFormat: v.optional(v.string()),
    currencyPreference: v.optional(v.string()),
    firstDayOfWeek: v.optional(v.union(v.literal("monday"), v.literal("sunday"))),
    theme: v.optional(v.union(v.literal("dark"), v.literal("light"), v.literal("system"))),
    layoutDensity: v.optional(v.union(v.literal("compact"), v.literal("comfortable"))),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    const { userId, ...fields } = args;
    const updates: Record<string, any> = { updatedAt: Date.now() };

    for (const [key, val] of Object.entries(fields)) {
      if (val !== undefined) {
        updates[key] = typeof val === 'string' ? val.trim() : val;
      }
    }

    if (args.firstName !== undefined || args.lastName !== undefined) {
      const fName = args.firstName ?? user.firstName ?? '';
      const lName = args.lastName ?? user.lastName ?? '';
      updates.name = `${fName} ${lName}`.trim() || user.name;
    }

    if (args.avatarUrl !== undefined && args.avatar === undefined) {
      updates.avatar = args.avatarUrl;
    }

    await ctx.db.patch(args.userId, updates);
    return await ctx.db.get(args.userId);
  },
});

export const updateAvatar = mutation({
  args: {
    userId: v.id("users"),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.userId, {
      avatar: args.avatarUrl || undefined,
      avatarUrl: args.avatarUrl || undefined,
      updatedAt: now,
    });
    return await ctx.db.get(args.userId);
  },
});

export const updatePersonalDetails = mutation({
  args: {
    userId: v.id("users"),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    displayName: v.optional(v.string()),
    preferredName: v.optional(v.string()),
    jobTitle: v.optional(v.string()),
    department: v.optional(v.string()),
    bio: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("USER_NOT_FOUND");

    const { userId, ...updates } = args;
    const cleanUpdates: Record<string, any> = { updatedAt: Date.now() };
    for (const [k, val] of Object.entries(updates)) {
      if (val !== undefined) cleanUpdates[k] = val;
    }
    if (updates.firstName || updates.lastName) {
      const fName = updates.firstName ?? user.firstName ?? "";
      const lName = updates.lastName ?? user.lastName ?? "";
      cleanUpdates.name = `${fName} ${lName}`.trim() || user.name;
    }
    await ctx.db.patch(userId, cleanUpdates);
    return await ctx.db.get(userId);
  },
});

export const updateContactDetails = mutation({
  args: {
    userId: v.id("users"),
    phone: v.optional(v.string()),
    phoneVisibility: v.optional(v.union(v.literal("private"), v.literal("workspace"))),
    country: v.optional(v.string()),
    state: v.optional(v.string()),
    stateCode: v.optional(v.string()),
    lga: v.optional(v.string()),
    city: v.optional(v.string()),
    timezone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("USER_NOT_FOUND");

    const { userId, ...updates } = args;
    const cleanUpdates: Record<string, any> = { updatedAt: Date.now() };
    for (const [k, val] of Object.entries(updates)) {
      if (val !== undefined) cleanUpdates[k] = val;
    }
    await ctx.db.patch(userId, cleanUpdates);
    return await ctx.db.get(userId);
  },
});

export const requestEmailChange = mutation({
  args: {
    userId: v.id("users"),
    newEmail: v.string(),
    token: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.newEmail.toLowerCase().trim()))
      .first();

    if (existing && existing._id !== args.userId) {
      throw new Error("EMAIL_ALREADY_IN_USE");
    }

    const now = Date.now();
    await ctx.db.patch(args.userId, {
      pendingEmail: args.newEmail.toLowerCase().trim(),
      emailChangeToken: args.token,
      emailChangeExpiresAt: args.expiresAt,
      updatedAt: now,
    });

    return { userId: args.userId, pendingEmail: args.newEmail.toLowerCase().trim() };
  },
});

export const confirmEmailChange = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email_change_token", (q) => q.eq("emailChangeToken", args.token))
      .first();

    if (!user || !user.pendingEmail) {
      throw new Error("INVALID_TOKEN");
    }

    if (user.emailChangeExpiresAt && user.emailChangeExpiresAt < Date.now()) {
      throw new Error("TOKEN_EXPIRED");
    }

    const conflict = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", user.pendingEmail!))
      .first();

    if (conflict && conflict._id !== user._id) {
      throw new Error("EMAIL_ALREADY_IN_USE");
    }

    const now = Date.now();
    await ctx.db.patch(user._id, {
      email: user.pendingEmail,
      pendingEmail: undefined,
      emailChangeToken: undefined,
      emailChangeExpiresAt: undefined,
      emailVerified: true,
      updatedAt: now,
    });

    return { userId: user._id, email: user.pendingEmail };
  },
});

export const deleteUserAccount = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    // Delete user identities
    const authIdentities = await ctx.db
      .query("authIdentities")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    for (const identity of authIdentities) {
      await ctx.db.delete(identity._id);
    }

    const identities = await ctx.db
      .query("userIdentities")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    for (const identity of identities) {
      await ctx.db.delete(identity._id);
    }

    // Delete user sessions (GDPR compliance and defense in depth)
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    for (const session of sessions) {
      await ctx.db.delete(session._id);
    }

    // Delete memberships
    const memberships = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    for (const membership of memberships) {
      await ctx.db.delete(membership._id);
    }

    // Delete onboarding record if exists
    const onboarding = await ctx.db
      .query("onboardingProgress")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (onboarding) {
      await ctx.db.delete(onboarding._id);
    }

    // Log audit event
    await ctx.db.insert("auditLogs", {
      actorId: args.userId,
      action: "user.account_deleted",
      resource: `user:${args.userId}`,
      metadata: { email: user.email },
      timestamp: Date.now(),
    });

    // Delete user record
    await ctx.db.delete(args.userId);

    return { success: true };
  },
});

export const exportUserData = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    const identities = await ctx.db
      .query("userIdentities")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    const memberships = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    const organizations = [];
    for (const m of memberships) {
      const org = await ctx.db.get(m.organizationId);
      if (org) {
        organizations.push({
          organization: {
            id: org._id,
            name: org.name,
            slug: org.slug,
            industry: org.industry,
            country: org.country,
          },
          role: m.role,
          status: m.status,
          joinedAt: m.joinedAt,
        });
      }
    }

    const auditLogs = await ctx.db
      .query("auditLogs")
      .withIndex("by_actorId", (q) => q.eq("actorId", args.userId))
      .collect();

    const onboarding = await ctx.db
      .query("onboardingProgress")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    return {
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified,
        timezone: user.timezone,
        locale: user.locale,
        status: user.status,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      identities: identities.map((i) => ({
        provider: i.provider,
        providerEmail: i.providerEmail,
        createdAt: i.createdAt,
      })),
      organizations,
      memberships: organizations,
      onboarding: onboarding
        ? {
            status: onboarding.status,
            currentStep: onboarding.currentStep,
            completedSteps: onboarding.completedSteps,
          }
        : null,
      activityHistory: auditLogs.map((log) => ({
        action: log.action,
        resource: log.resource,
        timestamp: log.timestamp,
        metadata: log.metadata,
      })),
      exportGeneratedAt: Date.now(),
    };
  },
});

export const setTwoFactorPendingSecret = mutation({
  args: {
    userId: v.id("users"),
    secret: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("USER_NOT_FOUND");
    await ctx.db.patch(args.userId, {
      twoFactorPendingSecret: args.secret,
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

export const enableTwoFactor = mutation({
  args: {
    userId: v.id("users"),
    secret: v.string(),
    backupCodes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("USER_NOT_FOUND");
    const now = Date.now();
    await ctx.db.patch(args.userId, {
      twoFactorEnabled: true,
      twoFactorSecret: args.secret,
      twoFactorPendingSecret: undefined,
      twoFactorBackupCodes: args.backupCodes,
      updatedAt: now,
    });
    await ctx.db.insert("auditLogs", {
      actorId: args.userId,
      action: "user.2fa_enabled",
      resource: "auth",
      timestamp: now,
      metadata: { enabledAt: now },
    });
    return { success: true };
  },
});

export const disableTwoFactor = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("USER_NOT_FOUND");
    const now = Date.now();
    await ctx.db.patch(args.userId, {
      twoFactorEnabled: false,
      twoFactorSecret: undefined,
      twoFactorPendingSecret: undefined,
      twoFactorBackupCodes: undefined,
      updatedAt: now,
    });
    await ctx.db.insert("auditLogs", {
      actorId: args.userId,
      action: "user.2fa_disabled",
      resource: "auth",
      timestamp: now,
      metadata: { disabledAt: now },
    });
    return { success: true };
  },
});

export const consumeBackupCode = mutation({
  args: {
    userId: v.id("users"),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || !user.twoFactorBackupCodes) throw new Error("INVALID_BACKUP_CODE");

    const normalizedInput = args.code.trim().toUpperCase();
    const index = user.twoFactorBackupCodes.findIndex((c) => c.toUpperCase() === normalizedInput);
    if (index === -1) {
      throw new Error("INVALID_BACKUP_CODE");
    }

    const updatedCodes = [...user.twoFactorBackupCodes];
    updatedCodes.splice(index, 1);

    await ctx.db.patch(args.userId, {
      twoFactorBackupCodes: updatedCodes,
      updatedAt: Date.now(),
    });

    return { success: true, remainingCodes: updatedCodes.length };
  },
});



export const recordFailedLogin = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("USER_NOT_FOUND");
    const now = Date.now();
    const attempts = (user.failedLoginAttempts || 0) + 1;
    const isLocked = attempts >= 5;
    const lockedUntil = isLocked ? now + 15 * 60 * 1000 : undefined; // 15-minute lockout

    await ctx.db.patch(args.userId, {
      failedLoginAttempts: attempts,
      lockedUntil,
      updatedAt: now,
    });

    return {
      failedAttempts: attempts,
      isLocked,
      lockedUntil,
    };
  },
});

export const resetFailedLogins = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      failedLoginAttempts: 0,
      lockedUntil: undefined,
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

export const incrementTokenVersion = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("USER_NOT_FOUND");
    const currentVersion = user.tokenVersion || 1;
    const nextVersion = currentVersion + 1;
    await ctx.db.patch(args.userId, {
      tokenVersion: nextVersion,
      updatedAt: Date.now(),
    });
    return { success: true, tokenVersion: nextVersion };
  },
});

export const handleSocialAuth = mutation({
  args: {
    provider: v.union(v.literal("google"), v.literal("facebook"), v.literal("apple")),
    providerUserId: v.string(),
    email: v.string(),
    emailVerified: v.boolean(),
    name: v.string(),
    picture: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const emailNorm = args.email.toLowerCase().trim();

    // 1. Check if this exact provider identity already exists
    const existingIdentity = await ctx.db
      .query("authIdentities")
      .withIndex("by_provider_and_subject", (q) =>
        q.eq("provider", args.provider).eq("providerSubject", args.providerUserId)
      )
      .first();

    if (existingIdentity) {
      const user = await ctx.db.get(existingIdentity.userId);
      if (!user) throw new Error("USER_NOT_FOUND");
      await ctx.db.patch(existingIdentity._id, {
        lastUsedAt: now,
        updatedAt: now,
      });
      await ctx.db.patch(user._id, {
        lastLoginAt: now,
        failedLoginAttempts: 0,
        lockedUntil: undefined,
        updatedAt: now,
      });
      return { userId: user._id, isNew: false };
    }

    // 2. Check if user already exists by email
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", emailNorm))
      .first();

    if (existingUser) {
      // Link this social identity to the existing user
      await ctx.db.insert("authIdentities", {
        userId: existingUser._id,
        provider: args.provider,
        providerSubject: args.providerUserId,
        providerEmail: emailNorm,
        providerEmailVerified: args.emailVerified,
        createdAt: now,
        lastUsedAt: now,
        updatedAt: now,
      });

      // Update user verification if verified by social provider
      await ctx.db.patch(existingUser._id, {
        emailVerified: existingUser.emailVerified || args.emailVerified,
        avatarUrl: existingUser.avatarUrl || args.picture,
        lastLoginAt: now,
        failedLoginAttempts: 0,
        lockedUntil: undefined,
        updatedAt: now,
      });

      return { userId: existingUser._id, isNew: false };
    }

    // 3. Brand new user sign-up via Social OAuth
    const newUserId = await ctx.db.insert("users", {
      email: emailNorm,
      emailNormalized: emailNorm,
      name: args.name,
      displayName: args.name,
      avatarUrl: args.picture,
      emailVerified: args.emailVerified,
      emailVerifiedAt: args.emailVerified ? now : undefined,
      country: "Nigeria",
      currencyPreference: "NGN",
      timezone: "Africa/Lagos",
      status: "ACTIVE",
      tokenVersion: 1,
      lastLoginAt: now,
      createdAt: now,
      updatedAt: now,
    });

    // Record social identity in authIdentities
    await ctx.db.insert("authIdentities", {
      userId: newUserId,
      provider: args.provider,
      providerSubject: args.providerUserId,
      providerEmail: emailNorm,
      providerEmailVerified: args.emailVerified,
      createdAt: now,
      lastUsedAt: now,
      updatedAt: now,
    });

    // Initialize onboarding progress at ORGANIZATION_CREATION
    await ctx.db.insert("onboardingProgress", {
      userId: newUserId,
      currentStep: "ORGANIZATION_CREATION",
      status: "IN_PROGRESS",
      completedSteps: ["ACCOUNT_CREATED", "EMAIL_VERIFIED"],
      startedAt: now,
      updatedAt: now,
    });

    return { userId: newUserId, isNew: true };
  },
});


