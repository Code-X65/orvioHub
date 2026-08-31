import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Query: Get all phones for a user
export const getByUser = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const phones = await ctx.db
      .query("userPhones")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    return phones.map((p) => ({
      _id: p._id,
      userId: p.userId,
      phone: p.phone,
      phoneNormalized: p.phoneNormalized,
      isVerified: p.isVerified,
      isPrimary: p.isPrimary,
      verifiedAt: p.verifiedAt,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
  },
});

// Query: Get phone record by userId and phoneNormalized
export const getByPhone = query({
  args: {
    userId: v.id("users"),
    phone: v.string(),
  },
  handler: async (ctx, args) => {
    const normalized = args.phone.replace(/\D/g, '');
    return await ctx.db
      .query("userPhones")
      .withIndex("by_user_phone", (q) =>
        q.eq("userId", args.userId).eq("phoneNormalized", normalized)
      )
      .first();
  },
});

// Query: Count recent OTP requests in last X minutes (for rate limiting)
export const countRecentOtps = query({
  args: {
    userId: v.id("users"),
    phone: v.string(),
    minutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const normalized = args.phone.replace(/\D/g, '');
    const windowMinutes = args.minutes || 60;
    const sinceTime = Date.now() - windowMinutes * 60 * 1000;

    const record = await ctx.db
      .query("userPhones")
      .withIndex("by_user_phone", (q) =>
        q.eq("userId", args.userId).eq("phoneNormalized", normalized)
      )
      .first();

    if (!record) return 0;
    if (record.lastAttemptAt && record.lastAttemptAt > sinceTime) {
      return record.attemptsCount || 1;
    }
    return 0;
  },
});

// Mutation: Create or update a phone record with new OTP
export const createOrUpdate = mutation({
  args: {
    userId: v.id("users"),
    phone: v.string(),
    phoneNormalized: v.string(),
    verificationCode: v.string(), // bcrypt hashed OTP
    codeExpiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("userPhones")
      .withIndex("by_user_phone", (q) =>
        q.eq("userId", args.userId).eq("phoneNormalized", args.phoneNormalized)
      )
      .first();

    // Check existing phones to see if this should be marked as primary upon verification
    const existingUserPhones = await ctx.db
      .query("userPhones")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const isFirstPhone = existingUserPhones.length === 0;

    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    if (existing) {
      const isWithinWindow = existing.lastAttemptAt && existing.lastAttemptAt > oneHourAgo;
      const newAttemptsCount = isWithinWindow ? (existing.attemptsCount || 0) + 1 : 1;

      await ctx.db.patch(existing._id, {
        phone: args.phone,
        verificationCode: args.verificationCode,
        codeExpiresAt: args.codeExpiresAt,
        attemptsCount: newAttemptsCount,
        lastAttemptAt: now,
        updatedAt: now,
      });

      return {
        phoneId: existing._id,
        attemptsCount: newAttemptsCount,
      };
    }

    const newId = await ctx.db.insert("userPhones", {
      userId: args.userId,
      phone: args.phone,
      phoneNormalized: args.phoneNormalized,
      isVerified: false,
      isPrimary: isFirstPhone,
      verificationCode: args.verificationCode,
      codeExpiresAt: args.codeExpiresAt,
      attemptsCount: 1,
      lastAttemptAt: now,
      createdAt: now,
      updatedAt: now,
    });

    return {
      phoneId: newId,
      attemptsCount: 1,
    };
  },
});

// Mutation: Verify phone OTP
export const verify = mutation({
  args: {
    phoneId: v.id("userPhones"),
  },
  handler: async (ctx, args) => {
    const phoneRecord = await ctx.db.get(args.phoneId);
    if (!phoneRecord) {
      throw new Error("Phone record not found.");
    }

    const now = Date.now();

    // Check if user already has a verified primary phone
    const existingPrimary = await ctx.db
      .query("userPhones")
      .withIndex("by_user_primary", (q) =>
        q.eq("userId", phoneRecord.userId).eq("isPrimary", true)
      )
      .first();

    const shouldBePrimary = !existingPrimary || existingPrimary._id === phoneRecord._id;

    await ctx.db.patch(args.phoneId, {
      isVerified: true,
      isPrimary: shouldBePrimary,
      verifiedAt: now,
      verificationCode: undefined,
      codeExpiresAt: undefined,
      attemptsCount: 0,
      updatedAt: now,
    });

    // If set as primary, update users table
    if (shouldBePrimary) {
      await ctx.db.patch(phoneRecord.userId, {
        phone: phoneRecord.phone,
        phoneVerifiedAt: now,
        updatedAt: now,
      });
    }

    return {
      success: true,
      phoneId: args.phoneId,
      isPrimary: shouldBePrimary,
      phone: phoneRecord.phone,
    };
  },
});

// Mutation: Set a verified phone as primary
export const setPrimary = mutation({
  args: {
    userId: v.id("users"),
    phoneId: v.id("userPhones"),
  },
  handler: async (ctx, args) => {
    const targetPhone = await ctx.db.get(args.phoneId);
    if (!targetPhone || targetPhone.userId !== args.userId) {
      throw new Error("Phone record not found.");
    }
    if (!targetPhone.isVerified) {
      throw new Error("Phone must be verified before setting it as primary.");
    }

    // Demote existing primary phones for this user
    const currentPrimaries = await ctx.db
      .query("userPhones")
      .withIndex("by_user_primary", (q) =>
        q.eq("userId", args.userId).eq("isPrimary", true)
      )
      .collect();

    const now = Date.now();

    for (const primary of currentPrimaries) {
      if (primary._id !== args.phoneId) {
        await ctx.db.patch(primary._id, {
          isPrimary: false,
          updatedAt: now,
        });
      }
    }

    // Mark target as primary
    await ctx.db.patch(args.phoneId, {
      isPrimary: true,
      updatedAt: now,
    });

    // Update users table
    await ctx.db.patch(args.userId, {
      phone: targetPhone.phone,
      phoneVerifiedAt: targetPhone.verifiedAt || now,
      updatedAt: now,
    });

    return { success: true, phoneId: args.phoneId };
  },
});

// Mutation: Delete a phone record
export const deletePhone = mutation({
  args: {
    userId: v.id("users"),
    phoneId: v.id("userPhones"),
  },
  handler: async (ctx, args) => {
    const targetPhone = await ctx.db.get(args.phoneId);
    if (!targetPhone || targetPhone.userId !== args.userId) {
      throw new Error("Phone record not found.");
    }

    const allPhones = await ctx.db
      .query("userPhones")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const verifiedPhones = allPhones.filter((p) => p.isVerified);

    // If deleting a verified phone, ensure user has at least one other verified phone or is unverified
    if (targetPhone.isVerified && verifiedPhones.length <= 1 && allPhones.length > 1) {
      throw new Error("Cannot delete your only verified phone number. Add and verify another phone number first.");
    }

    await ctx.db.delete(args.phoneId);

    // If the deleted phone was primary, promote another verified phone if available
    if (targetPhone.isPrimary) {
      const remainingVerified = verifiedPhones.filter((p) => p._id !== args.phoneId);
      if (remainingVerified.length > 0) {
        const nextPrimary = remainingVerified[0];
        await ctx.db.patch(nextPrimary._id, {
          isPrimary: true,
          updatedAt: Date.now(),
        });
        await ctx.db.patch(args.userId, {
          phone: nextPrimary.phone,
          phoneVerifiedAt: nextPrimary.verifiedAt || Date.now(),
          updatedAt: Date.now(),
        });
      } else {
        await ctx.db.patch(args.userId, {
          phone: undefined,
          phoneVerifiedAt: undefined,
          updatedAt: Date.now(),
        });
      }
    }

    return { success: true, deletedPhoneId: args.phoneId };
  },
});
