import { mutation, internalMutation } from "../_generated/server.js";
import { v } from "convex/values";

/**
 * purgeAllTestData
 * Safely clears all test and operational data for production deployment preparation.
 * 
 * STRICTLY PRESERVED TABLES:
 * - platformAdmins (Super Admin credentials)
 * - systemConfig (System global configuration)
 * - products (Core SaaS application definitions)
 * - plans (Subscription pricing tiers)
 * - locations (Nigerian States & LGAs reference dataset)
 */
export const purgeAllTestData = mutation({
  args: {
    confirmText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.confirmText && args.confirmText !== "YES_PURGE_TEST_DATA") {
      throw new Error("Confirmation token mismatch.");
    }

    const summary: Record<string, number> = {};

    // List of all operational and test tables to purge
    const tablesToPurge = [
      // Auth & User Profile tables
      "sessions",
      "authIdentities",
      "userIdentities",
      "userPhones",
      "notifications",
      "notificationPreferences",
      "emailOutbox",
      "notes",
      "oauthCodes",

      // Inventory & Commerce tables
      "inventory",
      "manualPayments",
      "paymentTransactions",
      "usageCounters",
      "subscriptions",

      // Workspace & Member tables
      "branches",
      "productMemberships",
      "workspaceProducts",
      "workspaceMemberships",
      "workspaceInvitations",
      "workspaceAuditLogs",

      // Organization & Module tables
      "organizationMemberships",
      "organizationSettings",
      "organizationModules",
      "invitations",
      "productNotifyList",

      // Onboarding & Flow tables
      "onboardingEvents",
      "onboardingFlows",
      "onboardingProgress",

      // Telemetry & Logs
      "auditLogs",
      "adminAuditLogs",
      "adminLoginAttempts",
      "platformStats",

      // Workspaces & Organizations (parent entities)
      "workspaces",
      "organizations",

      // Users table (parent entity for auth)
      "users",
    ];

    for (const tableName of tablesToPurge) {
      try {
        const records = await (ctx.db.query(tableName as any) as any).collect();
        for (const record of records) {
          await ctx.db.delete(record._id);
        }
        summary[tableName] = records.length;
      } catch (err: any) {
        summary[tableName] = 0;
      }
    }

    // Verify preserved tables are intact
    const preserved = {
      platformAdminsCount: (await ctx.db.query("platformAdmins").collect()).length,
      productsCount: (await ctx.db.query("products").collect()).length,
      plansCount: (await ctx.db.query("plans").collect()).length,
      locationsCount: (await ctx.db.query("locations").collect()).length,
      systemConfigCount: (await ctx.db.query("systemConfig").collect()).length,
    };

    return {
      success: true,
      message: "Test data successfully purged. Platform is ready for deployment.",
      purgedRecordCounts: summary,
      totalRecordsDeleted: Object.values(summary).reduce((a, b) => a + b, 0),
      preservedTables: preserved,
      timestamp: Date.now(),
    };
  },
});
