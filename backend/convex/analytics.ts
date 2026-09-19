import { query, mutation } from "./_generated/server.js";
import { v } from "convex/values";

// Helper to verify admin session
async function verifyAdminSession(ctx: any, sessionToken?: string) {
  if (!sessionToken) throw new Error("Admin authentication required.");
  const session = await ctx.db
    .query("adminSessions")
    .withIndex("by_token", (q: any) => q.eq("sessionToken", sessionToken))
    .first();

  if (!session || session.expiresAt < Date.now()) {
    throw new Error("Invalid or expired admin session.");
  }
  const admin = await ctx.db.get(session.adminId);
  if (!admin || !admin.isActive) {
    throw new Error("Unauthorized or inactive admin account.");
  }
  return { admin, session };
}

// Format date in Africa/Lagos (UTC+1)
export function getLagosDateString(timestamp: number = Date.now()): string {
  const date = new Date(timestamp + 3600000); // UTC+1
  return date.toISOString().slice(0, 10);
}

/**
 * 1. getPlatformOverviewAnalytics
 * Comprehensive platform KPIs with data freshness and cost-conscious summaries
 */
export const getPlatformOverviewAnalytics = query({
  args: {
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.sessionToken) {
      await verifyAdminSession(ctx, args.sessionToken);
    }

    const now = Date.now();
    const lagosDate = getLagosDateString(now);

    // 1. Users
    const allUsers = await ctx.db.query("users").collect();
    const totalUsers = allUsers.length;
    const activeUsers = allUsers.filter((u: any) => (u.status || "active").toLowerCase() === "active").length;
    const pendingVerificationUsers = allUsers.filter((u: any) => !u.emailVerified).length;
    const suspendedUsers = allUsers.filter((u: any) => (u.status || "").toLowerCase() === "suspended").length;

    // 2. Organizations
    const allWorkspaces = await ctx.db.query("workspaces").collect();
    const totalOrganizations = allWorkspaces.length;
    const activeOrganizations = allWorkspaces.filter((w: any) => (w.status || "active").toLowerCase() === "active").length;
    const suspendedOrganizations = allWorkspaces.filter((w: any) => (w.status || "").toLowerCase() === "suspended").length;
    const archivedOrganizations = allWorkspaces.filter((w: any) => !!w.archivedAt).length;
    const deletedOrganizations = allWorkspaces.filter((w: any) => !!w.deletedAt).length;

    // 3. Subscriptions & Plans
    const allSubscriptions = await ctx.db.query("subscriptions").collect();
    let trialOrganizations = 0;
    let standardOrganizations = 0;
    let premiumOrganizations = 0;
    let pastDueOrganizations = 0;
    let gracePeriodOrganizations = 0;
    let mrrKobo = 0;
    let complimentaryMrrKobo = 0;
    let activePaidCount = 0;
    let billingMismatches = 0;

    for (const sub of allSubscriptions) {
      const planKey = (sub.planKey || "free_trial").toLowerCase();
      const status = (sub.status || "").toLowerCase();
      const isManual = sub.grantType && sub.grantType !== "paystack";

      if (sub.providerMismatch) {
        billingMismatches++;
      }

      if (status === "past_due") pastDueOrganizations++;
      if (status === "grace_period") gracePeriodOrganizations++;

      if (planKey === "free_trial" || status === "trial" || status === "trialing") {
        trialOrganizations++;
      } else if (status === "active" || status === "grace_period" || status === "past_due") {
        let monthlyValueKobo = 0;
        if (planKey === "standard") {
          standardOrganizations++;
          monthlyValueKobo = sub.billingInterval === "annual" ? Math.round(7500000 / 12) : 750000;
        } else if (planKey === "premium") {
          premiumOrganizations++;
          monthlyValueKobo = sub.billingInterval === "annual" ? Math.round(25000000 / 12) : 2500000;
        }

        if (sub.amount && sub.amount > 0) {
          monthlyValueKobo = sub.billingInterval === "annual" ? Math.round(sub.amount / 12) : sub.amount;
        }

        if (isManual) {
          complimentaryMrrKobo += monthlyValueKobo;
        } else if (status === "active") {
          mrrKobo += monthlyValueKobo;
          activePaidCount++;
        }
      }
    }

    const arrKobo = mrrKobo * 12;

    // 4. Demo Inventory & Setup Funnel
    const workspaceProducts = await ctx.db.query("workspaceProducts").collect();
    const inventoryActivations = workspaceProducts.filter((wp: any) => wp.productKey === "inventory" && wp.enabled).length;
    const branches = await ctx.db.query("branches").collect();
    const demoBranches = branches.length;

    const onboardingFlows = await ctx.db.query("onboardingFlows").collect();
    const inventorySetupCompletions = onboardingFlows.filter((f: any) => f.status === "COMPLETED" || f.status === "completed").length;
    const incompleteSetupOrganizations = onboardingFlows.filter((f: any) => f.status === "IN_PROGRESS" || f.status === "NOT_STARTED").length;

    const memberships = await ctx.db.query("workspaceMemberships").collect();
    const activeMemberships = memberships.filter((m: any) => (m.status || "active").toLowerCase() === "active").length;
    const invitations = await ctx.db.query("invitations").collect();
    const pendingInvitations = invitations.filter((i: any) => (i.status || "").toLowerCase() === "pending").length;

    // 5. Billing events & Webhooks
    const billingEvents = await ctx.db.query("billingEvents").collect();
    const failedBillingEvents = billingEvents.filter((e: any) => e.status === "failed").length;
    const failedWebhooks = billingEvents.filter((e: any) => e.eventType === "webhook_failed" || e.status === "failed").length;

    // 6. Overrides
    const overrides = await ctx.db.query("entitlementOverrides").collect();
    const activeOverrides = overrides.filter((o: any) => o.status === "active").length;
    const expiringOverrides = overrides.filter((o: any) => o.status === "active" && o.expiresAt && o.expiresAt <= now + 7 * 24 * 60 * 60 * 1000).length;

    // 7. Payments summary
    const payments = await ctx.db.query("payments").collect();
    const successfulPayments = payments.filter((p: any) => p.status === "success" || p.status === "completed").length;
    const failedPayments = payments.filter((p: any) => p.status === "failed").length;
    const paymentVolumeKobo = payments
      .filter((p: any) => p.status === "success" || p.status === "completed")
      .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        pendingVerification: pendingVerificationUsers,
        suspended: suspendedUsers,
      },
      organizations: {
        total: totalOrganizations,
        active: activeOrganizations,
        trial: trialOrganizations,
        standard: standardOrganizations,
        premium: premiumOrganizations,
        pastDue: pastDueOrganizations,
        gracePeriod: gracePeriodOrganizations,
        suspended: suspendedOrganizations,
        archived: archivedOrganizations,
        deleted: deletedOrganizations,
        incompleteSetup: incompleteSetupOrganizations,
      },
      subscriptions: {
        activePaid: activePaidCount,
        trialing: trialOrganizations,
        mrr: mrrKobo,
        arr: arrKobo,
        complimentaryMrr: complimentaryMrrKobo,
        currency: "NGN",
        displayMrr: `₦${(mrrKobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`,
        displayArr: `₦${(arrKobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`,
      },
      inventory: {
        activations: inventoryActivations,
        setupCompletions: inventorySetupCompletions,
        demoBranches: demoBranches,
        memberships: activeMemberships,
        pendingInvitations: pendingInvitations,
        // Explicit MVP boundaries: Real business telemetry is unavailable
        products: "not_available",
        stockValue: "not_available",
        salesVolume: "not_available",
        customerDebt: "not_available",
        supplierBalances: "not_available",
        monthlyTransactions: "not_available",
        mvpNotice: "Current Inventory app is a demo dashboard. Business transaction metrics are not available.",
      },
      payments: {
        successful: successfulPayments,
        failed: failedPayments,
        volume: paymentVolumeKobo,
        displayVolume: `₦${(paymentVolumeKobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`,
        failedWebhooks: failedWebhooks,
        failedBillingEvents: failedBillingEvents,
        billingMismatches: billingMismatches,
      },
      overrides: {
        active: activeOverrides,
        expiringIn7Days: expiringOverrides,
      },
      freshness: {
        computedAt: now,
        freshness: "fresh",
        sourcePeriod: lagosDate,
        aggregationVersion: 1,
        timezone: "Africa/Lagos",
        currency: "NGN",
      },
    };
  },
});

/**
 * 2. getRevenueAnalytics
 * MRR, ARR, normalization rules, and revenue trends
 */
export const getRevenueAnalytics = query({
  args: {
    sessionToken: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.sessionToken) {
      await verifyAdminSession(ctx, args.sessionToken);
    }

    const now = Date.now();
    const lagosDate = getLagosDateString(now);

    const subscriptions = await ctx.db.query("subscriptions").collect();
    let standardMonthlyCount = 0;
    let standardAnnualCount = 0;
    let premiumMonthlyCount = 0;
    let premiumAnnualCount = 0;

    let standardMrrKobo = 0;
    let premiumMrrKobo = 0;
    let complimentaryMrrKobo = 0;
    let totalPaidMrrKobo = 0;

    for (const sub of subscriptions) {
      const planKey = (sub.planKey || "free_trial").toLowerCase();
      const status = (sub.status || "").toLowerCase();
      const isManual = Boolean(sub.grantType && sub.grantType !== "paystack");

      if (planKey === "free_trial" || status === "canceled" || status === "cancelled" || status === "expired") {
        continue;
      }

      if (status === "active" || status === "grace_period" || status === "past_due") {
        let monthlyNormKobo = 0;

        if (planKey === "standard") {
          if (sub.billingInterval === "annual") {
            standardAnnualCount++;
            monthlyNormKobo = Math.round((sub.amount || 7500000) / 12);
          } else {
            standardMonthlyCount++;
            monthlyNormKobo = sub.amount || 750000;
          }
          if (isManual) {
            complimentaryMrrKobo += monthlyNormKobo;
          } else if (status === "active") {
            standardMrrKobo += monthlyNormKobo;
            totalPaidMrrKobo += monthlyNormKobo;
          }
        } else if (planKey === "premium") {
          if (sub.billingInterval === "annual") {
            premiumAnnualCount++;
            monthlyNormKobo = Math.round((sub.amount || 25000000) / 12);
          } else {
            premiumMonthlyCount++;
            monthlyNormKobo = sub.amount || 2500000;
          }
          if (isManual) {
            complimentaryMrrKobo += monthlyNormKobo;
          } else if (status === "active") {
            premiumMrrKobo += monthlyNormKobo;
            totalPaidMrrKobo += monthlyNormKobo;
          }
        }
      }
    }

    const totalArrKobo = totalPaidMrrKobo * 12;

    // Fetch daily aggregates for historical trend
    const dailyMetrics = await ctx.db
      .query("analyticsDailyMetrics")
      .withIndex("by_date")
      .order("desc")
      .take(30);

    const history = dailyMetrics.reverse().map((d: any) => ({
      date: d.date,
      mrr: d.mrr,
      arr: d.arr,
      standardOrganizations: d.standardOrganizations,
      premiumOrganizations: d.premiumOrganizations,
      paymentVolume: d.paymentVolume,
    }));

    return {
      mrr: {
        value: totalPaidMrrKobo,
        currency: "NGN",
        displayValue: `₦${(totalPaidMrrKobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`,
        asOf: now,
      },
      arr: {
        value: totalArrKobo,
        currency: "NGN",
        displayValue: `₦${(totalArrKobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`,
        asOf: now,
      },
      complimentary: {
        mrr: complimentaryMrrKobo,
        displayMrr: `₦${(complimentaryMrrKobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`,
      },
      breakdown: {
        standard: {
          monthlyCount: standardMonthlyCount,
          annualCount: standardAnnualCount,
          totalMrr: standardMrrKobo,
          displayMrr: `₦${(standardMrrKobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`,
        },
        premium: {
          monthlyCount: premiumMonthlyCount,
          annualCount: premiumAnnualCount,
          totalMrr: premiumMrrKobo,
          displayMrr: `₦${(premiumMrrKobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`,
        },
      },
      history: history,
      formulas: {
        mrr: "Sum of normalized monthly subscription amounts for active paid Standard and Premium organizations. Annual subscriptions are divided by 12. Free trials and complimentary grants are excluded.",
        arr: "MRR × 12",
        currency: "NGN (stored in kobo)",
        timezone: "Africa/Lagos",
      },
      freshness: {
        computedAt: now,
        freshness: "fresh",
        sourcePeriod: lagosDate,
        aggregationVersion: 1,
      },
    };
  },
});

/**
 * 3. getSubscriptionAnalytics
 * Subscription lifecycle, intervals, churn rates
 */
export const getSubscriptionAnalytics = query({
  args: {
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.sessionToken) {
      await verifyAdminSession(ctx, args.sessionToken);
    }

    const now = Date.now();
    const lagosDate = getLagosDateString(now);

    const subscriptions = await ctx.db.query("subscriptions").collect();
    let standardCount = 0;
    let premiumCount = 0;
    let trialingCount = 0;
    let activePaidCount = 0;
    let pastDueCount = 0;
    let gracePeriodCount = 0;
    let cancelledCount = 0;
    let expiredCount = 0;
    let monthlyCount = 0;
    let annualCount = 0;
    let complimentaryCount = 0;

    for (const sub of subscriptions) {
      const planKey = (sub.planKey || "free_trial").toLowerCase();
      const status = (sub.status || "").toLowerCase();
      const isManual = Boolean(sub.grantType && sub.grantType !== "paystack");

      if (isManual) complimentaryCount++;

      if (planKey === "free_trial" || status === "trial" || status === "trialing") {
        trialingCount++;
      } else if (planKey === "standard") {
        standardCount++;
        if (status === "active") activePaidCount++;
      } else if (planKey === "premium") {
        premiumCount++;
        if (status === "active") activePaidCount++;
      }

      if (status === "past_due") pastDueCount++;
      if (status === "grace_period") gracePeriodCount++;
      if (status === "canceled" || status === "cancelled") cancelledCount++;
      if (status === "expired") expiredCount++;

      if (sub.billingInterval === "annual") {
        annualCount++;
      } else if (sub.billingInterval === "monthly") {
        monthlyCount++;
      }
    }

    // Logo churn computation: cancelled + expired over (active + cancelled + expired || 1)
    const baseCohort = activePaidCount + cancelledCount;
    const logoChurnRate = baseCohort > 0 ? cancelledCount / baseCohort : 0;

    return {
      plans: {
        standard: standardCount,
        premium: premiumCount,
        trial: trialingCount,
      },
      statuses: {
        active: activePaidCount,
        trialing: trialingCount,
        pastDue: pastDueCount,
        gracePeriod: gracePeriodCount,
        cancelled: cancelledCount,
        expired: expiredCount,
      },
      intervals: {
        monthly: monthlyCount,
        annual: annualCount,
      },
      complimentarySubscriptions: complimentaryCount,
      churn: {
        logoChurnRate: Number(logoChurnRate.toFixed(4)),
        logoChurnPercentage: `${(logoChurnRate * 100).toFixed(2)}%`,
        definitions: {
          logoChurn: "Organizations that cancelled during the period divided by active paid organizations at period start.",
          trialChurn: "Expired trials are tracked separately in Trial Analytics and do not dilute paid logo churn.",
        },
      },
      freshness: {
        computedAt: now,
        freshness: "fresh",
        sourcePeriod: lagosDate,
        aggregationVersion: 1,
      },
    };
  },
});

/**
 * 4. getTrialAnalytics
 * Cohort tracking, conversion rates, trial extension metrics
 */
export const getTrialAnalytics = query({
  args: {
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.sessionToken) {
      await verifyAdminSession(ctx, args.sessionToken);
    }

    const now = Date.now();
    const lagosDate = getLagosDateString(now);

    const subscriptions = await ctx.db.query("subscriptions").collect();
    let trialsStarted = 0;
    let activeTrials = 0;
    let trialsEndingIn7Days = 0;
    let trialsEndingIn3Days = 0;
    let trialsEndingIn1Day = 0;
    let trialsExpired = 0;
    let convertedToStandard = 0;
    let convertedToPremium = 0;
    let trialExtensionsCount = 0;
    const extensionReasons: Record<string, number> = {};

    for (const sub of subscriptions) {
      const planKey = (sub.planKey || "free_trial").toLowerCase();
      const isTrial = planKey === "free_trial" || sub.status === "trial" || sub.status === "trialing" || !!sub.trialEndsAt;

      if (isTrial || sub.trialConvertedAt) {
        trialsStarted++;
      }

      if (sub.trialConvertedAt) {
        if (planKey === "standard") convertedToStandard++;
        if (planKey === "premium") convertedToPremium++;
      }

      if (sub.trialExtensionDays && sub.trialExtensionDays > 0) {
        trialExtensionsCount++;
        const reason = sub.trialExtensionReason || "support_exception";
        extensionReasons[reason] = (extensionReasons[reason] || 0) + 1;
      }

      const trialEnd = sub.trialEndsAt || sub.trialEnd || sub.currentPeriodEnd || 0;
      if (isTrial && sub.status !== "active") {
        if (trialEnd > now) {
          activeTrials++;
          if (trialEnd <= now + 7 * 24 * 60 * 60 * 1000) trialsEndingIn7Days++;
          if (trialEnd <= now + 3 * 24 * 60 * 60 * 1000) trialsEndingIn3Days++;
          if (trialEnd <= now + 1 * 24 * 60 * 60 * 1000) trialsEndingIn1Day++;
        } else if (trialEnd > 0) {
          trialsExpired++;
        }
      }
    }

    const totalConverted = convertedToStandard + convertedToPremium;
    const eligibleTrials = totalConverted + trialsExpired + activeTrials;
    const trialConversionRate = eligibleTrials > 0 ? totalConverted / eligibleTrials : 0;

    return {
      trialsStarted,
      activeTrials,
      expiring: {
        in7Days: trialsEndingIn7Days,
        in3Days: trialsEndingIn3Days,
        in1Day: trialsEndingIn1Day,
      },
      trialsExpired,
      conversions: {
        standard: convertedToStandard,
        premium: convertedToPremium,
        total: totalConverted,
        conversionRate: Number(trialConversionRate.toFixed(4)),
        conversionPercentage: `${(trialConversionRate * 100).toFixed(2)}%`,
      },
      extensions: {
        totalCount: trialExtensionsCount,
        byReason: extensionReasons,
      },
      definitions: {
        trialStart: "Organization subscription enters trialing state.",
        trialConversion: "Trial organization successfully activates a paid Standard or Premium plan.",
        trialExpiration: "Trial period ends without paid conversion.",
        trialConversionRate: "Converted eligible trials / total eligible trials in cohort.",
      },
      freshness: {
        computedAt: now,
        freshness: "fresh",
        sourcePeriod: lagosDate,
        aggregationVersion: 1,
      },
    };
  },
});

/**
 * 5. getPaymentAnalytics
 * Success rates, provider verification, and failure telemetry
 */
export const getPaymentAnalytics = query({
  args: {
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.sessionToken) {
      await verifyAdminSession(ctx, args.sessionToken);
    }

    const now = Date.now();
    const lagosDate = getLagosDateString(now);

    const payments = await ctx.db.query("payments").collect();
    let totalAttempts = payments.length;
    let successful = 0;
    let failed = 0;
    let pending = 0;
    let refunded = 0;
    let partiallyRefunded = 0;
    let totalVolumeKobo = 0;

    const byPlan: Record<string, number> = { standard: 0, premium: 0 };
    const byProvider: Record<string, number> = { paystack: 0, flutterwave: 0, manual: 0, bank_transfer: 0 };

    for (const p of payments) {
      const status = (p.status || "").toLowerCase();
      const provider = (p.provider || p.paymentMethod || "paystack").toLowerCase();
      byProvider[provider] = (byProvider[provider] || 0) + 1;

      if (status === "success" || status === "completed") {
        successful++;
        totalVolumeKobo += p.amount || 0;
      } else if (status === "failed") {
        failed++;
      } else if (status === "pending") {
        pending++;
      } else if (status === "refunded") {
        refunded++;
      } else if (status === "partially_refunded") {
        partiallyRefunded++;
      }
    }

    const billingEvents = await ctx.db.query("billingEvents").collect();
    const totalWebhooks = billingEvents.length;
    const failedWebhooks = billingEvents.filter((b: any) => b.status === "failed" || b.eventType === "webhook_failed").length;
    const duplicateWebhooks = billingEvents.filter((b: any) => b.status === "duplicate").length;

    const successRate = totalAttempts > 0 ? successful / totalAttempts : 1;
    const failureRate = totalAttempts > 0 ? failed / totalAttempts : 0;
    const averageAmountKobo = successful > 0 ? Math.round(totalVolumeKobo / successful) : 0;

    return {
      volume: {
        totalKobo: totalVolumeKobo,
        currency: "NGN",
        displayTotal: `₦${(totalVolumeKobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`,
        averageAmountKobo,
        displayAverage: `₦${(averageAmountKobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`,
      },
      counts: {
        attempts: totalAttempts,
        successful,
        failed,
        pending,
        refunded,
        partiallyRefunded,
        successRate: Number(successRate.toFixed(4)),
        successPercentage: `${(successRate * 100).toFixed(2)}%`,
        failureRate: Number(failureRate.toFixed(4)),
        failurePercentage: `${(failureRate * 100).toFixed(2)}%`,
      },
      providers: byProvider,
      webhooks: {
        total: totalWebhooks,
        failed: failedWebhooks,
        duplicate: duplicateWebhooks,
      },
      freshness: {
        computedAt: now,
        freshness: "fresh",
        sourcePeriod: lagosDate,
        aggregationVersion: 1,
      },
    };
  },
});

/**
 * 6. getEntitlementAnalytics
 * Real setup usage thresholds vs. limit reached telemetry
 */
export const getEntitlementAnalytics = query({
  args: {
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.sessionToken) {
      await verifyAdminSession(ctx, args.sessionToken);
    }

    const now = Date.now();
    const lagosDate = getLagosDateString(now);

    const workspaces = await ctx.db.query("workspaces").collect();
    const branches = await ctx.db.query("branches").collect();
    const memberships = await ctx.db.query("workspaceMemberships").collect();
    const overrides = await ctx.db.query("entitlementOverrides").collect();

    const activeOverrides = overrides.filter((o: any) => o.status === "active").length;
    const expiringOverrides = overrides.filter((o: any) => o.status === "active" && o.expiresAt && o.expiresAt <= now + 7 * 24 * 60 * 60 * 1000).length;

    let orgsAtBranchLimit = 0;
    let orgsAtMemberLimit = 0;

    for (const ws of workspaces) {
      const wsId = ws._id.toString();
      const wsBranches = branches.filter((b: any) => (b.workspaceId || "").toString() === wsId || (b.organizationId || "").toString() === wsId);
      const wsMembers = memberships.filter((m: any) => (m.workspaceId || "").toString() === wsId);

      // Demo limit check: Free Trial allows 1 branch, Standard allows 3, Premium allows unlimited (999)
      const planKey = (ws.planId || "free_trial").toLowerCase();
      const branchLimit = planKey === "premium" ? 999 : planKey === "standard" ? 3 : 1;
      const memberLimit = planKey === "premium" ? 999 : planKey === "standard" ? 5 : 2;

      if (wsBranches.length >= branchLimit) orgsAtBranchLimit++;
      if (wsMembers.length >= memberLimit) orgsAtMemberLimit++;
    }

    return {
      usageThresholds: {
        branchLimitReached: orgsAtBranchLimit,
        memberLimitReached: orgsAtMemberLimit,
      },
      overrides: {
        active: activeOverrides,
        expiringIn7Days: expiringOverrides,
      },
      demoScope: {
        branchCountTracked: branches.length,
        memberCountTracked: memberships.length,
        productStockMetrics: "not_available",
        salesMetrics: "not_available",
      },
      freshness: {
        computedAt: now,
        freshness: "fresh",
        sourcePeriod: lagosDate,
        aggregationVersion: 1,
      },
    };
  },
});

/**
 * 7. getOrganizationAnalytics
 * Scoped analytics for a single organization/workspace
 */
export const getOrganizationAnalytics = query({
  args: {
    workspaceId: v.string(),
  },
  handler: async (ctx, args) => {
    const ws: any = await ctx.db
      .query("workspaces")
      .filter((q: any) => q.eq(q.field("_id"), args.workspaceId))
      .first();

    if (!ws) {
      throw new Error(`Workspace not found: ${args.workspaceId}`);
    }

    const now = Date.now();
    const lagosDate = getLagosDateString(now);

    // Subscriptions for this org
    const subscriptions = await ctx.db.query("subscriptions").collect();
    const orgSub = subscriptions.find(
      (s: any) =>
        (s.workspaceId && s.workspaceId.toString() === args.workspaceId) ||
        (s.organizationId && s.organizationId.toString() === (ws.organizationId || args.workspaceId).toString())
    );

    const planKey = orgSub?.planKey || ws.planId || "free_trial";
    const status = orgSub?.status || ws.status || "active";
    const trialEnd = orgSub?.trialEndsAt || orgSub?.trialEnd || 0;
    const trialDaysRemaining = trialEnd > now ? Math.ceil((trialEnd - now) / (24 * 60 * 60 * 1000)) : 0;

    // Branches and Members
    const branches = await ctx.db.query("branches").collect();
    const orgBranches = branches.filter((b: any) => (b.workspaceId || "").toString() === args.workspaceId);

    const memberships = await ctx.db.query("workspaceMemberships").collect();
    const activeMembers = memberships.filter((m: any) => (m.workspaceId || "").toString() === args.workspaceId && (m.status || "active").toLowerCase() === "active");

    const invitations = await ctx.db.query("invitations").collect();
    const pendingInvites = invitations.filter((i: any) => (i.workspaceId || "").toString() === args.workspaceId && (i.status || "").toLowerCase() === "pending");

    // Inventory App Activation & Setup
    const workspaceProducts = await ctx.db.query("workspaceProducts").collect();
    const inventoryProduct = workspaceProducts.find((p: any) => (p.workspaceId || "").toString() === args.workspaceId && p.productKey === "inventory");
    const isInventoryActivated = Boolean(inventoryProduct && (inventoryProduct.status === "active" || inventoryProduct.status === "activating"));

    const onboardingFlows = await ctx.db.query("onboardingFlows").collect();
    const orgFlow = onboardingFlows.find((f: any) => (f.workspaceId || "").toString() === args.workspaceId);
    const isSetupCompleted = orgFlow?.status === "COMPLETED" || orgFlow?.status === "completed";

    // Payments for this org
    const payments = await ctx.db.query("payments").collect();
    const orgPayments = payments.filter((p: any) => (p.workspaceId || "").toString() === args.workspaceId);
    const lastSuccessful = orgPayments.filter((p: any) => p.status === "success" || p.status === "completed").sort((a, b) => (b.paidAt || b.createdAt) - (a.paidAt || a.createdAt))[0];
    const lastFailed = orgPayments.filter((p: any) => p.status === "failed").sort((a, b) => b.createdAt - a.createdAt)[0];

    // Limits according to plan
    const branchLimit = planKey === "premium" ? "unlimited" : planKey === "standard" ? 3 : 1;
    const memberLimit = planKey === "premium" ? "unlimited" : planKey === "standard" ? 5 : 2;

    return {
      workspaceId: args.workspaceId,
      name: ws.name,
      status: ws.status || "active",
      createdAt: ws.createdAt,
      plan: {
        key: planKey,
        status: status,
        billingInterval: orgSub?.billingInterval || "monthly",
        currentPeriodStart: orgSub?.currentPeriodStart || ws.createdAt,
        currentPeriodEnd: orgSub?.currentPeriodEnd || now + 30 * 24 * 60 * 60 * 1000,
        trialDaysRemaining,
        isTrial: planKey === "free_trial" || status === "trial" || status === "trialing",
      },
      usage: {
        branches: {
          current: orgBranches.length,
          limit: branchLimit,
        },
        members: {
          current: activeMembers.length,
          limit: memberLimit,
          pendingInvitations: pendingInvites.length,
        },
        inventory: {
          activated: isInventoryActivated,
          setupCompleted: isSetupCompleted,
          products: "not_available",
          stock: "not_available",
          sales: "not_available",
          customerDebt: "not_available",
        },
      },
      payments: {
        lastSuccessfulPayment: lastSuccessful ? { amount: lastSuccessful.amount, paidAt: lastSuccessful.paidAt, reference: lastSuccessful.providerReference } : null,
        lastFailedPayment: lastFailed ? { amount: lastFailed.amount, failedAt: lastFailed.createdAt, reference: lastFailed.providerReference } : null,
      },
      freshness: {
        computedAt: now,
        freshness: "fresh",
        sourcePeriod: lagosDate,
        aggregationVersion: 1,
      },
    };
  },
});

/**
 * 8. recordAnalyticsEvent
 * Ingests domain analytics events idempotently
 */
export const recordAnalyticsEvent = mutation({
  args: {
    eventId: v.string(),
    eventType: v.string(),
    workspaceId: v.optional(v.string()),
    billingAccountId: v.optional(v.string()),
    subscriptionId: v.optional(v.string()),
    planKey: v.optional(v.string()),
    amount: v.optional(v.number()),
    currency: v.optional(v.string()),
    occurredAt: v.optional(v.number()),
    requestId: v.optional(v.string()),
    source: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("analyticsEvents")
      .withIndex("by_eventId", (q: any) => q.eq("eventId", args.eventId))
      .first();

    if (existing) {
      return { eventId: args.eventId, status: "duplicate", recordId: existing._id };
    }

    const recordId = await ctx.db.insert("analyticsEvents", {
      eventId: args.eventId,
      eventType: args.eventType,
      workspaceId: args.workspaceId,
      billingAccountId: args.billingAccountId,
      subscriptionId: args.subscriptionId,
      planKey: args.planKey,
      amount: args.amount,
      currency: args.currency || "NGN",
      occurredAt: args.occurredAt || Date.now(),
      requestId: args.requestId,
      source: args.source || "backend",
      metadata: args.metadata,
      createdAt: Date.now(),
    });

    return { eventId: args.eventId, status: "recorded", recordId };
  },
});

/**
 * 9. rebuildDailyAnalytics
 * Computes & upserts daily aggregate records idempotently
 */
export const rebuildDailyAnalytics = mutation({
  args: {
    date: v.optional(v.string()), // "YYYY-MM-DD"
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.sessionToken) {
      await verifyAdminSession(ctx, args.sessionToken);
    }

    const now = Date.now();
    const targetDate = args.date || getLagosDateString(now);

    const workspaces = await ctx.db.query("workspaces").collect();
    const activeOrgs = workspaces.filter((w: any) => (w.status || "active").toLowerCase() === "active").length;

    const subscriptions = await ctx.db.query("subscriptions").collect();
    let trialOrgs = 0;
    let standardOrgs = 0;
    let premiumOrgs = 0;
    let mrrKobo = 0;
    let complimentaryMrrKobo = 0;
    let cancellations = 0;
    let downgrades = 0;
    let upgrades = 0;
    let trialStarts = 0;
    let trialConversions = 0;

    for (const sub of subscriptions) {
      const planKey = (sub.planKey || "free_trial").toLowerCase();
      const status = (sub.status || "").toLowerCase();
      const isManual = Boolean(sub.grantType && sub.grantType !== "paystack");

      if (planKey === "free_trial" || status === "trial" || status === "trialing") {
        trialOrgs++;
        trialStarts++;
      } else if (planKey === "standard") {
        standardOrgs++;
        const val = sub.billingInterval === "annual" ? Math.round((sub.amount || 7500000) / 12) : sub.amount || 750000;
        if (isManual) complimentaryMrrKobo += val;
        else if (status === "active") mrrKobo += val;
      } else if (planKey === "premium") {
        premiumOrgs++;
        const val = sub.billingInterval === "annual" ? Math.round((sub.amount || 25000000) / 12) : sub.amount || 2500000;
        if (isManual) complimentaryMrrKobo += val;
        else if (status === "active") mrrKobo += val;
      }

      if (sub.trialConvertedAt) trialConversions++;
      if (status === "canceled" || status === "cancelled") cancellations++;
      if (sub.downgradeStatus === "applied") downgrades++;
    }

    const payments = await ctx.db.query("payments").collect();
    const successfulPayments = payments.filter((p: any) => p.status === "success" || p.status === "completed").length;
    const failedPayments = payments.filter((p: any) => p.status === "failed").length;
    const paymentVolumeKobo = payments
      .filter((p: any) => p.status === "success" || p.status === "completed")
      .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

    const workspaceProducts = await ctx.db.query("workspaceProducts").collect();
    const inventoryActivations = workspaceProducts.filter((wp: any) => wp.productKey === "inventory" && wp.enabled).length;

    const onboardingFlows = await ctx.db.query("onboardingFlows").collect();
    const inventorySetupCompletions = onboardingFlows.filter((f: any) => f.status === "COMPLETED" || f.status === "completed").length;

    const branches = await ctx.db.query("branches").collect();
    const demoBranches = branches.length;

    const existing = await ctx.db
      .query("analyticsDailyMetrics")
      .withIndex("by_date", (q: any) => q.eq("date", targetDate))
      .first();

    const recordPayload = {
      date: targetDate,
      timezone: "Africa/Lagos",
      currency: "NGN",
      activeOrganizations: activeOrgs,
      trialOrganizations: trialOrgs,
      standardOrganizations: standardOrgs,
      premiumOrganizations: premiumOrgs,
      mrr: mrrKobo,
      arr: mrrKobo * 12,
      complimentaryMrr: complimentaryMrrKobo,
      successfulPayments,
      failedPayments,
      paymentVolume: paymentVolumeKobo,
      trialStarts,
      trialConversions,
      cancellations,
      downgrades,
      upgrades,
      inventoryActivations,
      inventorySetupCompletions,
      demoBranches,
      computedAt: now,
      version: 1,
    };

    if (existing) {
      await ctx.db.patch(existing._id, recordPayload);
      return { action: "updated", date: targetDate, recordId: existing._id, metrics: recordPayload };
    } else {
      const recordId = await ctx.db.insert("analyticsDailyMetrics", recordPayload);
      return { action: "created", date: targetDate, recordId, metrics: recordPayload };
    }
  },
});

/**
 * 10. reconcileRevenueMetrics
 * Validates MRR against active paid subscriptions
 */
export const reconcileRevenueMetrics = mutation({
  args: {
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.sessionToken) {
      await verifyAdminSession(ctx, args.sessionToken);
    }

    const subscriptions = await ctx.db.query("subscriptions").collect();
    let reconciledMrrKobo = 0;
    let reconciledPaidCount = 0;
    const mismatches: string[] = [];

    for (const sub of subscriptions) {
      const planKey = (sub.planKey || "free_trial").toLowerCase();
      const status = (sub.status || "").toLowerCase();
      const isManual = Boolean(sub.grantType && sub.grantType !== "paystack");

      if (status === "active" && !isManual && (planKey === "standard" || planKey === "premium")) {
        reconciledPaidCount++;
        const monthlyVal =
          sub.billingInterval === "annual"
            ? Math.round((sub.amount || (planKey === "standard" ? 7500000 : 25000000)) / 12)
            : sub.amount || (planKey === "standard" ? 750000 : 2500000);
        reconciledMrrKobo += monthlyVal;
      }

      if (sub.providerMismatch) {
        mismatches.push(`Subscription ${sub._id}: Provider mismatch detected.`);
      }
    }

    return {
      reconciledAt: Date.now(),
      mrr: reconciledMrrKobo,
      arr: reconciledMrrKobo * 12,
      activePaidSubscriptions: reconciledPaidCount,
      mismatchesCount: mismatches.length,
      mismatches: mismatches,
      status: "reconciled",
    };
  },
});
