import { mutation } from "../_generated/server.js";
import { v } from "convex/values";

/**
 * purgeAllTestData
 * Safely clears operational tenant, user, organization, branch, and inventory data
 * in batches to respect Convex's 4096 operation limit, while preserving superadmin
 * credentials, core application catalogs, plans/pricing, locations dataset,
 * and system configurations.
 * 
 * STRICTLY PRESERVED:
 * - platformAdmins (Super Admin credentials)
 * - users where role === "superadmin" or role === "admin" (and their authIdentities)
 * - systemConfig (System global configuration)
 * - products & applications (Core SaaS application definitions)
 * - plans & planEntitlements (Subscription pricing tiers & entitlements)
 * - locations (Nigerian States & LGAs reference dataset)
 */

const TABLES_TO_PURGE = [
  // Auth & User auxiliary tables
  "sessions",
  "userIdentities",
  "userPreferences",
  "userConsents",
  "userActivities",
  "authEvents",
  "oauthCodes",
  "accountDeletionRequests",
  "dataExportRequests",
  "userAuditLogs",

  // Inventory & Commerce tables
  "inventoryCategories",
  "inventoryUnits",
  "branchStockBalances",
  "inventoryProducts",
  "inventoryCustomers",
  "inventoryCustomerLedger",
  "inventorySales",
  "inventoryStockMovements",
  "receiptSettings",

  // Billing & Subscription tables
  "billingAccounts",
  "subscriptions",
  "subscriptionHistory",
  "invoices",
  "payments",
  "receipts",
  "invoiceCounters",
  "billingAdjustments",
  "billingEvents",
  "billingIdempotencyRecords",
  "manualPayments",
  "paymentTransactions",
  "workspaceEntitlements",
  "entitlementOverrides",
  "entitlementEvents",
  "entitlementReconciliationJobs",
  "usageCounters",

  // Workspace & Member tables
  "branches",
  "branchSettings",
  "productMemberships",
  "workspaceProducts",
  "workspaceMemberships",
  "workspaceInvitations",
  "workspaceSettings",
  "workspaceBranding",
  "workspaceAuditLogs",
  "applicationSettings",

  // Organization & Module tables
  "organizations",
  "organizationProfiles",
  "organizationSettings",
  "organizationModules",
  "organizationMemberships",
  "organizationLimitOverrides",
  "organizationAuditLogs",
  "orgApplications",
  "applicationOnboardingResponses",
  "invitations",
  "productNotifyList",

  // Onboarding & Flow tables
  "onboardingEvents",
  "onboardingFlows",
  "onboardingProgress",

  // Notifications, Outbox & Telemetry
  "notifications",
  "notificationQueue",
  "notificationPreferences",
  "emailOutbox",
  "emailEvents",
  "auditLogs",
  "platformStats",
  "notes",

  // Workspaces parent table
  "workspaces",
] as const;

export const purgeBatch = mutation({
  args: {
    confirmText: v.optional(v.string()),
    batchLimit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.confirmText && args.confirmText !== "YES_PURGE_TEST_DATA") {
      throw new Error("Confirmation token mismatch. Must provide 'YES_PURGE_TEST_DATA'.");
    }

    const batchLimit = args.batchLimit || 400;
    const summary: Record<string, number> = {};
    let totalDeletedInBatch = 0;

    // 1. Identify superadmin user IDs to preserve
    const allUsers = await ctx.db.query("users").collect();
    const superadminUserIds = new Set<string>();
    const usersToDelete: typeof allUsers = [];

    for (const u of allUsers) {
      if (u.role === "superadmin" || u.role === "admin") {
        superadminUserIds.add(u._id);
      } else {
        usersToDelete.push(u);
      }
    }

    // 2. Clear non-superadmin authIdentities & userProfiles
    const nonAdminAuthIdentities = (await ctx.db.query("authIdentities").take(batchLimit)).filter(
      (id) => !superadminUserIds.has(id.userId)
    );
    for (const identity of nonAdminAuthIdentities) {
      await ctx.db.delete(identity._id);
      totalDeletedInBatch++;
    }
    if (nonAdminAuthIdentities.length > 0) {
      summary["authIdentities"] = nonAdminAuthIdentities.length;
    }

    const nonAdminUserProfiles = (await ctx.db.query("userProfiles").take(batchLimit)).filter(
      (p) => !superadminUserIds.has(p.userId)
    );
    for (const profile of nonAdminUserProfiles) {
      await ctx.db.delete(profile._id);
      totalDeletedInBatch++;
    }
    if (nonAdminUserProfiles.length > 0) {
      summary["userProfiles"] = nonAdminUserProfiles.length;
    }

    // 3. Clear non-superadmin users (in slice up to batchLimit)
    const usersBatch = usersToDelete.slice(0, batchLimit);
    for (const u of usersBatch) {
      await ctx.db.delete(u._id);
      totalDeletedInBatch++;
    }
    if (usersBatch.length > 0) {
      summary["users"] = usersBatch.length;
    }

    // 4. Clear generic tables in batches
    for (const tableName of TABLES_TO_PURGE) {
      if (totalDeletedInBatch >= 1500) break; // Keep under Convex execution read/write limits
      try {
        const records = await (ctx.db.query(tableName as any) as any).take(batchLimit);
        for (const record of records) {
          await ctx.db.delete(record._id);
          totalDeletedInBatch++;
        }
        if (records.length > 0) {
          summary[tableName] = records.length;
        }
      } catch {}
    }



    // Check if more records remain in any table
    let remainingRecords = 0;
    const remainingSample = usersToDelete.length - usersBatch.length;
    remainingRecords += Math.max(0, remainingSample);

    for (const tableName of TABLES_TO_PURGE) {
      try {
        const check = await (ctx.db.query(tableName as any) as any).take(1);
        if (check.length > 0) {
          remainingRecords++;
        }
      } catch {}
    }

    const hasMore = remainingRecords > 0 || totalDeletedInBatch > 0;

    return {
      success: true,
      batchDeletedCount: totalDeletedInBatch,
      deletedSummary: summary,
      hasMore,
      timestamp: Date.now(),
    };
  },
});

export const getPurgeStatus = mutation({
  args: {},
  handler: async (ctx) => {
    const counts: Record<string, number> = {};
    for (const tableName of TABLES_TO_PURGE) {
      try {
        counts[tableName] = (await (ctx.db.query(tableName as any) as any).take(1000)).length;
      } catch {
        counts[tableName] = 0;
      }
    }

    const nonAdminUsers = (await ctx.db.query("users").collect()).filter(
      (u) => u.role !== "superadmin" && u.role !== "admin"
    ).length;
    counts["users (non-superadmin)"] = nonAdminUsers;

    const preserved = {
      platformAdminsCount: (await ctx.db.query("platformAdmins").collect()).length,
      superadminUsersCount: (await ctx.db.query("users").collect()).filter(
        (u) => u.role === "superadmin" || u.role === "admin"
      ).length,
      productsCount: (await ctx.db.query("products").collect()).length,
      applicationsCount: (await ctx.db.query("applications").collect()).length,
      plansCount: (await ctx.db.query("plans").collect()).length,
      planEntitlementsCount: (await ctx.db.query("planEntitlements").collect()).length,
      locationsCount: (await ctx.db.query("locations").collect()).length,
      systemConfigCount: (await ctx.db.query("systemConfig").collect()).length,
    };

    return {
      operationalTableCounts: counts,
      preservedTables: preserved,
    };
  },
});
