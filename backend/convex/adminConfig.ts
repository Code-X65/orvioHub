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
    resourceType: "systemConfig",
    resourceId,
    details,
    createdAt: Date.now(),
  });
}

/**
 * getSystemConfig
 * Retrieves system settings and feature toggles
 */
export const getSystemConfig = query({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    await verifyAdminSession(ctx, args.sessionToken);

    const configs = await ctx.db.query("systemConfig").collect();
    const configMap: Record<string, any> = {};

    for (const c of configs) {
      configMap[c.configKey] = c.configValue;
    }

    // Default configuration fallbacks
    return {
      maintenanceMode: configMap["maintenanceMode"] ?? false,
      signupEnabled: configMap["signupEnabled"] ?? true,
      emailVerificationRequired: configMap["emailVerificationRequired"] ?? true,
      googleAuthEnabled: configMap["googleAuthEnabled"] ?? true,
      facebookAuthEnabled: configMap["facebookAuthEnabled"] ?? true,
      rateLimitMaxAttemptsPerMin: configMap["rateLimitMaxAttemptsPerMin"] ?? 5,
      sessionIdleTimeoutHours: configMap["sessionIdleTimeoutHours"] ?? 8,
      defaultTrialDays: configMap["defaultTrialDays"] ?? 14,
    };
  },
});

/**
 * updateSystemConfig
 * Updates a specific system configuration key
 */
export const updateSystemConfig = mutation({
  args: {
    sessionToken: v.string(),
    key: v.string(),
    value: v.any(),
  },
  handler: async (ctx, args) => {
    const { admin } = await verifyAdminSession(ctx, args.sessionToken);

    const existing = await ctx.db
      .query("systemConfig")
      .withIndex("by_key", (q) => q.eq("configKey", args.key))
      .first();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        configValue: args.value,
        updatedAt: now,
        updatedBy: admin._id,
      });
    } else {
      await ctx.db.insert("systemConfig", {
        configKey: args.key,
        configValue: args.value,
        updatedAt: now,
        updatedBy: admin._id,
      });
    }

    await logAudit(ctx, admin._id, "SYSTEM_CONFIG_UPDATED", args.key, {
      configKey: args.key,
      newValue: args.value,
    });

    return { success: true };
  },
});

/**
 * getFeatureFlags
 * Retrieves all registered feature flags and rollout percentages
 */
export const getFeatureFlags = query({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    await verifyAdminSession(ctx, args.sessionToken);

    const configs = await ctx.db.query("systemConfig").collect();
    const flags = configs
      .filter((c: any) => c.configKey.startsWith("ff_"))
      .map((c: any) => ({
        key: c.configKey.replace("ff_", ""),
        configKey: c.configKey,
        enabled: !!c.configValue?.enabled,
        rolloutPercentage: c.configValue?.rolloutPercentage ?? 100,
        description: c.configValue?.description || "",
        updatedAt: c.updatedAt,
      }));

    if (flags.length === 0) {
      return [
        {
          key: "inventory_pos_checkout",
          configKey: "ff_inventory_pos_checkout",
          enabled: true,
          rolloutPercentage: 100,
          description: "Enable point-of-sale checkout and receipt generation in Inventory.",
          updatedAt: Date.now(),
        },
        {
          key: "multi_branch_topologies",
          configKey: "ff_multi_branch_topologies",
          enabled: true,
          rolloutPercentage: 100,
          description: "Allows organizations to create multiple branches and assign scoped staff.",
          updatedAt: Date.now(),
        },
        {
          key: "explorer_mode",
          configKey: "ff_explorer_mode",
          enabled: true,
          rolloutPercentage: 100,
          description: "Allows new users to test products in sandbox mode before creating an organization.",
          updatedAt: Date.now(),
        },
        {
          key: "whatsapp_notifications",
          configKey: "ff_whatsapp_notifications",
          enabled: false,
          rolloutPercentage: 0,
          description: "WhatsApp transactional notification alerts for stock warnings and orders.",
          updatedAt: Date.now(),
        },
      ];
    }

    return flags;
  },
});

/**
 * updateFeatureFlag
 * Toggles or updates rollout percentage for a feature flag
 */
export const updateFeatureFlag = mutation({
  args: {
    sessionToken: v.string(),
    flagKey: v.string(),
    enabled: v.boolean(),
    rolloutPercentage: v.optional(v.number()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { admin } = await verifyAdminSession(ctx, args.sessionToken);

    const configKey = `ff_${args.flagKey}`;
    const existing = await ctx.db
      .query("systemConfig")
      .withIndex("by_key", (q) => q.eq("configKey", configKey))
      .first();

    const now = Date.now();
    const flagData = {
      enabled: args.enabled,
      rolloutPercentage: args.rolloutPercentage ?? 100,
      description: args.description || existing?.configValue?.description || "",
    };

    if (existing) {
      await ctx.db.patch(existing._id, {
        configValue: flagData,
        updatedAt: now,
        updatedBy: admin._id,
      });
    } else {
      await ctx.db.insert("systemConfig", {
        configKey,
        configValue: flagData,
        updatedAt: now,
        updatedBy: admin._id,
      });
    }

    await logAudit(ctx, admin._id, "FEATURE_FLAG_UPDATED", configKey, flagData);

    return { success: true };
  },
});
