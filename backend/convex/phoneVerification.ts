import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

function toCanonicalPhoneDigits(phone?: string | null): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('234') && digits.length === 13) return digits;
  if (digits.startsWith('0') && digits.length === 11) return `234${digits.slice(1)}`;
  if (digits.length === 10) return `234${digits}`;
  return digits;
}

function maskPhoneNumber(phone?: string | null): string {
  if (!phone) return '';
  const cleaned = phone.replace(/[^0-9+]/g, '');
  if (cleaned.length <= 4) return '••••';
  const prefix = cleaned.slice(0, 4);
  const suffix = cleaned.slice(-4);
  return `${prefix} •••• ${suffix}`;
}

export const createChallenge = mutation({
  args: {
    userId: v.optional(v.id("users")),
    workspaceId: v.optional(v.string()),
    organizationId: v.optional(v.string()),
    branchId: v.optional(v.string()),
    phone: v.string(),
    phoneNormalized: v.string(),
    purpose: v.string(),
    codeHash: v.string(),
    maxAttempts: v.optional(v.number()),
    expiresInMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    // 1. Rate Limit: Check how many challenges were initiated in the last hour for this phone or user
    const recentChallenges = await ctx.db
      .query("phoneVerificationChallenges")
      .withIndex("by_phone_normalized", (q) => q.eq("phoneNormalized", args.phoneNormalized))
      .filter((q) => q.gte(q.field("createdAt"), oneHourAgo))
      .collect();

    if (recentChallenges.length >= 5) {
      throw new Error("RATE_LIMIT_EXCEEDED: Too many verification attempts. Please try again in an hour.");
    }

    // 2. User-specific validation: Rule 1 (not same as current verified) & Rule 2 (not taken by another account)
    if (args.userId) {
      const user = await ctx.db.get(args.userId);
      if (user) {
        const userCanonical = toCanonicalPhoneDigits(user.phone || user.phoneNormalized || "");
        const proposedCanonical = toCanonicalPhoneDigits(args.phone || args.phoneNormalized || "");
        const isCurrentlyVerified = Boolean(user.phoneVerifiedAt) || user.phoneStatus === "verified";

        // Rule 1: Must not be current verified number
        if (isCurrentlyVerified && userCanonical && userCanonical === proposedCanonical) {
          throw new Error("SAME_PHONE_NUMBER: New phone number cannot be the same as your current verified number.");
        }

        // Rule 2: Must not belong to someone else's account
        const local = proposedCanonical.startsWith("234") ? "0" + proposedCanonical.slice(3) : proposedCanonical;
        const national10 = proposedCanonical.startsWith("234") ? proposedCanonical.slice(3) : proposedCanonical;
        const withPlus = `+${proposedCanonical}`;
        const rawDigits = (args.phone || args.phoneNormalized || "").replace(/\D/g, "");
        const variants = Array.from(new Set([args.phoneNormalized, args.phone, proposedCanonical, local, national10, withPlus, rawDigits])).filter(Boolean);

        for (const variant of variants) {
          const userMatches = await ctx.db
            .query("users")
            .withIndex("by_phone_normalized", (q) => q.eq("phoneNormalized", variant))
            .collect();

          const takenByOtherUser = userMatches.some(
            (u) =>
              !u.deletedAt &&
              u._id !== args.userId &&
              (Boolean(u.phoneVerifiedAt) || u.phoneStatus === "verified" || Boolean(u.phone))
          );
          if (takenByOtherUser) {
            throw new Error("PHONE_ALREADY_IN_USE: This phone number is already associated with another account.");
          }
        }

        // Check users by raw phone field
        for (const variant of variants) {
          const usersByPhone = await ctx.db
            .query("users")
            .filter((q) => q.eq(q.field("phone"), variant))
            .collect();

          const taken = usersByPhone.some(
            (u) =>
              !u.deletedAt &&
              u._id !== args.userId &&
              (Boolean(u.phoneVerifiedAt) || u.phoneStatus === "verified" || Boolean(u.phone))
          );
          if (taken) {
            throw new Error("PHONE_ALREADY_IN_USE: This phone number is already associated with another account.");
          }
        }
      }

      const existing = await ctx.db
        .query("phoneVerificationChallenges")
        .withIndex("by_user_purpose", (q) => q.eq("userId", args.userId))
        .collect();

      for (const ch of existing) {
        if (ch.status === "pending") {
          await ctx.db.patch(ch._id, { status: "cancelled" });
        }
      }
    } else if (args.workspaceId) {
      const existing = await ctx.db
        .query("phoneVerificationChallenges")
        .withIndex("by_workspace_purpose", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("purpose", args.purpose).eq("status", "pending")
        )
        .collect();

      for (const ch of existing) {
        await ctx.db.patch(ch._id, { status: "cancelled" });
      }
    } else if (args.branchId) {
      const existing = await ctx.db
        .query("phoneVerificationChallenges")
        .withIndex("by_branch_purpose", (q) =>
          q.eq("branchId", args.branchId).eq("purpose", args.purpose).eq("status", "pending")
        )
        .collect();

      for (const ch of existing) {
        await ctx.db.patch(ch._id, { status: "cancelled" });
      }
    }

    // 3. Create new challenge
    const maxAttempts = args.maxAttempts ?? 5;
    const expiresAt = now + (args.expiresInMs ?? 10 * 60 * 1000); // default 10 mins

    const challengeId = await ctx.db.insert("phoneVerificationChallenges", {
      userId: args.userId,
      workspaceId: args.workspaceId,
      organizationId: args.organizationId,
      branchId: args.branchId,
      phone: args.phone,
      phoneNormalized: args.phoneNormalized,
      purpose: args.purpose,
      codeHash: args.codeHash,
      status: "pending",
      attempts: 0,
      maxAttempts,
      expiresAt,
      lastResentAt: now,
      resendCount: 0,
      createdAt: now,
    });

    return {
      challengeId,
      expiresAt,
      phoneNormalized: args.phoneNormalized,
    };
  },
});

export const verifyChallenge = mutation({
  args: {
    challengeId: v.optional(v.id("phoneVerificationChallenges")),
    userId: v.optional(v.id("users")),
    workspaceId: v.optional(v.string()),
    branchId: v.optional(v.string()),
    purpose: v.optional(v.string()),
    codeHash: v.string(),
  },
  handler: async (ctx, args) => {
    let challenge = null;

    const purpose = args.purpose || "user_phone_verification";
    const userId = args.userId;
    const workspaceId = args.workspaceId;
    const branchId = args.branchId;

    if (args.challengeId) {
      challenge = await ctx.db.get(args.challengeId);
    } else if (userId) {
      let pending = await ctx.db
        .query("phoneVerificationChallenges")
        .withIndex("by_user_purpose", (q) =>
          q.eq("userId", userId).eq("purpose", purpose).eq("status", "pending")
        )
        .order("desc")
        .first();

      if (!pending && (purpose === "user_phone_verification" || purpose === "user_phone_change")) {
        const altPurpose = purpose === "user_phone_verification" ? "user_phone_change" : "user_phone_verification";
        pending = await ctx.db
          .query("phoneVerificationChallenges")
          .withIndex("by_user_purpose", (q) =>
            q.eq("userId", userId).eq("purpose", altPurpose).eq("status", "pending")
          )
          .order("desc")
          .first();
      }
      challenge = pending;
    } else if (workspaceId) {
      const pending = await ctx.db
        .query("phoneVerificationChallenges")
        .withIndex("by_workspace_purpose", (q) =>
          q.eq("workspaceId", workspaceId).eq("purpose", purpose).eq("status", "pending")
        )
        .order("desc")
        .first();
      challenge = pending;
    } else if (branchId) {
      const pending = await ctx.db
        .query("phoneVerificationChallenges")
        .withIndex("by_branch_purpose", (q) =>
          q.eq("branchId", branchId).eq("purpose", purpose).eq("status", "pending")
        )
        .order("desc")
        .first();
      challenge = pending;
    }

    if (!challenge) {
      throw new Error("CHALLENGE_NOT_FOUND: No active verification challenge found.");
    }

    if (challenge.status !== "pending") {
      throw new Error(`CHALLENGE_INVALID: Challenge is ${challenge.status}. Please request a new code.`);
    }

    const now = Date.now();
    if (challenge.expiresAt < now) {
      await ctx.db.patch(challenge._id, { status: "expired" });
      throw new Error("CHALLENGE_EXPIRED: The verification code has expired. Please request a new code.");
    }

    // Match code hash
    if (challenge.codeHash !== args.codeHash) {
      const newAttempts = (challenge.attempts || 0) + 1;
      const isMax = newAttempts >= challenge.maxAttempts;
      await ctx.db.patch(challenge._id, {
        attempts: newAttempts,
        status: isMax ? "expired" : "pending",
      });

      const attemptsRemaining = Math.max(0, challenge.maxAttempts - newAttempts);
      return {
        success: false,
        error: isMax ? "MAX_ATTEMPTS_EXCEEDED" : "INVALID_CODE",
        attemptsRemaining,
      };
    }

    // Mark challenge as verified
    await ctx.db.patch(challenge._id, {
      status: "verified",
      verifiedAt: now,
    });

    // Update target entities
    if (challenge.userId) {
      const user = await ctx.db.get(challenge.userId);
      if (user) {
        const isPhoneChange = Boolean(
          challenge.purpose === "user_phone_change" ||
          (user.phoneNormalized && user.phoneNormalized !== challenge.phoneNormalized)
        );
        const updateData: Record<string, any> = {
          phone: challenge.phone,
          phoneNormalized: challenge.phoneNormalized,
          phoneVerifiedAt: now,
          phoneStatus: "verified",
          updatedAt: now,
        };

        // If this is a phone number change, reset security flags so they don't persist onto the new number
        if (isPhoneChange) {
          updateData.phoneUsedForRecovery = challenge.purpose === "phone_recovery_setup";
          updateData.phoneUsedForMfa = challenge.purpose === "sms_mfa_setup";
        } else {
          if (challenge.purpose === "phone_recovery_setup") {
            updateData.phoneUsedForRecovery = true;
          }
          if (challenge.purpose === "sms_mfa_setup") {
            updateData.phoneUsedForMfa = true;
          }
        }

        await ctx.db.patch(challenge.userId, updateData);

        // Audit log for user phone change / verification
        await ctx.db.insert("auditLogs", {
          actorId: challenge.userId,
          actorUserId: challenge.userId,
          targetUserId: challenge.userId,
          action: isPhoneChange ? "USER_PHONE_CHANGED" : "USER_PHONE_VERIFIED",
          eventType: isPhoneChange ? "user.phone_changed" : "user.phone_verified",
          resource: "users",
          entityType: "user",
          entityId: challenge.userId,
          severity: isPhoneChange ? "warning" : "info",
          metadata: {
            purpose: challenge.purpose,
            phoneMasked: maskPhoneNumber(challenge.phone),
            isPhoneChange,
            previousPhoneMasked: user.phone ? maskPhoneNumber(user.phone) : undefined,
          },
          timestamp: now,
          createdAt: now,
        });
      }
    } else if (challenge.workspaceId) {
      // Find workspace
      const ws = await ctx.db
        .query("workspaces")
        .filter((q) => q.eq(q.field("_id"), challenge.workspaceId as any))
        .first();

      if (ws) {
        await ctx.db.patch(ws._id, {
          phone: challenge.phone,
          phoneNormalized: challenge.phoneNormalized,
          phoneVerifiedAt: now,
          phoneStatus: "verified",
          updatedAt: now,
        });
      } else {
        // Check organizations table
        const org = await ctx.db
          .query("organizations")
          .filter((q) => q.eq(q.field("_id"), challenge.workspaceId as any))
          .first();
        if (org) {
          await ctx.db.patch(org._id, {
            phone: challenge.phone,
            phoneNormalized: challenge.phoneNormalized,
            phoneVerifiedAt: now,
            phoneStatus: "verified",
            updatedAt: now,
          });
        }
      }

      // Audit log for workspace phone verification
      await ctx.db.insert("auditLogs", {
        actorId: challenge.workspaceId,
        action: "WORKSPACE_PHONE_VERIFIED",
        eventType: "workspace.phone_verified",
        resource: "workspaces",
        entityType: "workspace",
        entityId: challenge.workspaceId,
        severity: "info",
        metadata: {
          purpose: challenge.purpose,
          phoneMasked: maskPhoneNumber(challenge.phone),
        },
        timestamp: now,
        createdAt: now,
      });
    } else if (challenge.branchId) {
      const branch = await ctx.db
        .query("branches")
        .filter((q) => q.eq(q.field("_id"), challenge.branchId as any))
        .first();

      if (branch) {
        await ctx.db.patch(branch._id, {
          phone: challenge.phone,
          phoneNormalized: challenge.phoneNormalized,
          phoneVerified: true,
          phoneVerifiedAt: now,
          phoneStatus: "verified",
          updatedAt: now,
        });
      }

      // Audit log for branch phone verification
      await ctx.db.insert("auditLogs", {
        actorId: challenge.branchId,
        action: "BRANCH_PHONE_VERIFIED",
        eventType: "branch.phone_verified",
        resource: "branches",
        entityType: "branch",
        entityId: challenge.branchId,
        severity: "info",
        metadata: {
          purpose: challenge.purpose,
          phoneMasked: maskPhoneNumber(challenge.phone),
        },
        timestamp: now,
        createdAt: now,
      });
    }

    return {
      success: true,
      phoneNormalized: challenge.phoneNormalized,
      verifiedAt: now,
    };
  },
});

export const resendChallenge = mutation({
  args: {
    challengeId: v.optional(v.id("phoneVerificationChallenges")),
    userId: v.optional(v.id("users")),
    workspaceId: v.optional(v.string()),
    branchId: v.optional(v.string()),
    purpose: v.optional(v.string()),
    newCodeHash: v.string(),
  },
  handler: async (ctx, args) => {
    let challenge = null;

    const purpose = args.purpose || "user_phone_verification";
    const userId = args.userId;
    const workspaceId = args.workspaceId;
    const branchId = args.branchId;

    if (args.challengeId) {
      challenge = await ctx.db.get(args.challengeId);
    } else if (userId) {
      challenge = await ctx.db
        .query("phoneVerificationChallenges")
        .withIndex("by_user_purpose", (q) =>
          q.eq("userId", userId).eq("purpose", purpose).eq("status", "pending")
        )
        .order("desc")
        .first();

      if (!challenge && (purpose === "user_phone_verification" || purpose === "user_phone_change")) {
        const altPurpose = purpose === "user_phone_verification" ? "user_phone_change" : "user_phone_verification";
        challenge = await ctx.db
          .query("phoneVerificationChallenges")
          .withIndex("by_user_purpose", (q) =>
            q.eq("userId", userId).eq("purpose", altPurpose).eq("status", "pending")
          )
          .order("desc")
          .first();
      }
    } else if (workspaceId) {
      challenge = await ctx.db
        .query("phoneVerificationChallenges")
        .withIndex("by_workspace_purpose", (q) =>
          q.eq("workspaceId", workspaceId).eq("purpose", purpose).eq("status", "pending")
        )
        .order("desc")
        .first();
    } else if (branchId) {
      challenge = await ctx.db
        .query("phoneVerificationChallenges")
        .withIndex("by_branch_purpose", (q) =>
          q.eq("branchId", branchId).eq("purpose", purpose).eq("status", "pending")
        )
        .order("desc")
        .first();
    }

    if (!challenge || challenge.status !== "pending") {
      throw new Error("CHALLENGE_NOT_FOUND: No active verification challenge found to resend.");
    }

    const now = Date.now();
    const lastSent = challenge.lastResentAt || challenge.createdAt;
    const cooldownMs = 60 * 1000; // 60s cooldown

    if (now - lastSent < cooldownMs) {
      const waitSeconds = Math.ceil((cooldownMs - (now - lastSent)) / 1000);
      throw new Error(`COOLDOWN_ACTIVE: Please wait ${waitSeconds} seconds before requesting another code.`);
    }

    const resendCount = (challenge.resendCount || 0) + 1;
    if (resendCount > 3) {
      throw new Error("RESEND_LIMIT_EXCEEDED: Maximum resends exceeded for this session. Please try again later.");
    }

    const expiresAt = now + 10 * 60 * 1000; // Extend by 10 mins

    await ctx.db.patch(challenge._id, {
      codeHash: args.newCodeHash,
      expiresAt,
      lastResentAt: now,
      resendCount,
      attempts: 0, // Reset attempt count on fresh code
    });

    return {
      success: true,
      challengeId: challenge._id,
      phoneNormalized: challenge.phoneNormalized,
      expiresAt,
      resendCount,
    };
  },
});

export const getUserPhoneStatus = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    let pendingChallenge = await ctx.db
      .query("phoneVerificationChallenges")
      .withIndex("by_user_purpose", (q) =>
        q.eq("userId", args.userId).eq("purpose", "user_phone_verification").eq("status", "pending")
      )
      .order("desc")
      .first();

    if (!pendingChallenge) {
      pendingChallenge = await ctx.db
        .query("phoneVerificationChallenges")
        .withIndex("by_user_purpose", (q) =>
          q.eq("userId", args.userId).eq("purpose", "user_phone_change").eq("status", "pending")
        )
        .order("desc")
        .first();
    }

    return {
      phone: user.phone || null,
      phoneNormalized: user.phoneNormalized || null,
      phoneStatus: user.phone ? (user.phoneVerifiedAt || user.phoneStatus === "verified" ? "verified" : (user.phoneStatus || "unverified")) : "not_set",
      phoneVerifiedAt: user.phoneVerifiedAt || null,
      phoneUsedForRecovery: user.phoneUsedForRecovery || false,
      phoneUsedForMfa: user.phoneUsedForMfa || false,
      hasPendingChallenge: Boolean(pendingChallenge && pendingChallenge.expiresAt > Date.now()),
      pendingChallengeExpiresAt: pendingChallenge?.expiresAt || null,
    };
  },
});

export const removeUserPhone = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("USER_NOT_FOUND");

    const now = Date.now();
    await ctx.db.patch(args.userId, {
      phone: undefined,
      phoneNormalized: undefined,
      phoneVerifiedAt: undefined,
      phoneStatus: "not_set",
      phoneUsedForRecovery: false,
      phoneUsedForMfa: false,
      updatedAt: now,
    });

    // Invalidate any pending challenges
    const pendingChallenges = await ctx.db
      .query("phoneVerificationChallenges")
      .withIndex("by_user_purpose", (q) => q.eq("userId", args.userId))
      .collect();

    for (const ch of pendingChallenges) {
      if (ch.status === "pending") {
        await ctx.db.patch(ch._id, { status: "cancelled" });
      }
    }

    return { success: true };
  },
});

export const updateUserContact = mutation({
  args: {
    userId: v.id("users"),
    phone: v.optional(v.string()),
    phoneNormalized: v.optional(v.string()),
    phoneVisibility: v.optional(v.union(v.literal("private"), v.literal("workspace"))),
    country: v.optional(v.string()),
    state: v.optional(v.string()),
    stateCode: v.optional(v.string()),
    lga: v.optional(v.string()),
    city: v.optional(v.string()),
    timezone: v.optional(v.string()),
    phoneUsedForRecovery: v.optional(v.boolean()),
    phoneUsedForMfa: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("USER_NOT_FOUND");

    const now = Date.now();
    const updateData: Record<string, any> = { updatedAt: now };

    if (args.phone !== undefined) {
      const userPhoneDigits = (user.phone || user.phoneNormalized || "").replace(/\D/g, "");
      const newPhoneDigits = (args.phone || args.phoneNormalized || "").replace(/\D/g, "");
      const isCurrentlyVerified = Boolean(user.phoneVerifiedAt) || user.phoneStatus === "verified";

      if (isCurrentlyVerified && userPhoneDigits && userPhoneDigits !== newPhoneDigits) {
        throw new Error("VERIFIED_PHONE_LOCKED: Verified phone number cannot be modified directly. Please verify the new number.");
      }

      updateData.phone = args.phone;
      if (args.phoneNormalized !== undefined) {
        updateData.phoneNormalized = args.phoneNormalized;
      }
      // If phone is modified and doesn't match current verified phone, mark unverified
      if (args.phone !== user.phone || args.phoneNormalized !== user.phoneNormalized) {
        if (!isCurrentlyVerified) {
          updateData.phoneVerifiedAt = undefined;
          updateData.phoneStatus = "unverified";
          updateData.phoneUsedForRecovery = false;
          updateData.phoneUsedForMfa = false;
        }
      }
    }

    if (args.phoneVisibility !== undefined) updateData.phoneVisibility = args.phoneVisibility;
    if (args.country !== undefined) updateData.country = args.country;
    if (args.state !== undefined) updateData.state = args.state;
    if (args.stateCode !== undefined) updateData.stateCode = args.stateCode;
    if (args.lga !== undefined) updateData.lga = args.lga;
    if (args.city !== undefined) updateData.city = args.city;
    if (args.timezone !== undefined) updateData.timezone = args.timezone;
    if (args.phoneUsedForRecovery !== undefined) {
      // Only allow enabling if phone is verified
      if (args.phoneUsedForRecovery && (!user.phoneVerifiedAt || user.phoneStatus !== "verified")) {
        throw new Error("PHONE_NOT_VERIFIED: Phone must be verified before enabling account recovery.");
      }
      updateData.phoneUsedForRecovery = args.phoneUsedForRecovery;
    }
    if (args.phoneUsedForMfa !== undefined) {
      if (args.phoneUsedForMfa && (!user.phoneVerifiedAt || user.phoneStatus !== "verified")) {
        throw new Error("PHONE_NOT_VERIFIED: Phone must be verified before enabling SMS MFA.");
      }
      updateData.phoneUsedForMfa = args.phoneUsedForMfa;
    }

    await ctx.db.patch(args.userId, updateData);
    return { success: true };
  },
});

export const isPhoneRegistered = query({
  args: {
    phoneNormalized: v.string(),
    excludeUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const canonical = toCanonicalPhoneDigits(args.phoneNormalized);
    const local = canonical.startsWith('234') ? '0' + canonical.slice(3) : canonical;
    const national10 = canonical.startsWith('234') ? canonical.slice(3) : canonical;
    const withPlus = `+${canonical}`;
    const rawDigits = args.phoneNormalized.replace(/\D/g, '');
    const variants = Array.from(new Set([args.phoneNormalized, canonical, local, national10, withPlus, rawDigits])).filter(Boolean);

    // 1. Check users table by phoneNormalized index
    for (const variant of variants) {
      const userMatches = await ctx.db
        .query("users")
        .withIndex("by_phone_normalized", (q) => q.eq("phoneNormalized", variant))
        .collect();

      const takenInUsers = userMatches.some(
        (u) =>
          !u.deletedAt &&
          (!args.excludeUserId || u._id !== args.excludeUserId) &&
          (Boolean(u.phoneVerifiedAt) || u.phoneStatus === "verified" || Boolean(u.phone))
      );
      if (takenInUsers) return true;
    }

    // 2. Fallback scan on users with phone matching any variant
    for (const variant of variants) {
      const usersByPhone = await ctx.db
        .query("users")
        .filter((q) => q.eq(q.field("phone"), variant))
        .collect();

      const taken = usersByPhone.some(
        (u) =>
          !u.deletedAt &&
          (!args.excludeUserId || u._id !== args.excludeUserId) &&
          (Boolean(u.phoneVerifiedAt) || u.phoneStatus === "verified" || Boolean(u.phone))
      );
      if (taken) return true;
    }

    return false;
  },
});

