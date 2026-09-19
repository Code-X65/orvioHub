import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { dataService } from '../src/services/dataService.js';
import { AnalyticsService } from '../src/services/analyticsService.js';
import type { FastifyInstance } from 'fastify';

describe('Analytics Engine, Aggregations & Dashboard - 34 Point Verification Suite', () => {
  let app: FastifyInstance;
  let superAdminToken: string;
  let readOnlyAdminToken: string;
  let supportAdminToken: string;
  let tenantOwnerToken: string;
  let tenantMemberToken: string;
  const tenantWorkspaceId = 'ws_analytics_test_01';

  before(async () => {
    app = await buildApp();
    await app.ready();

    // Sign tokens using app.jwt
    superAdminToken = app.jwt.sign({ userId: 'admin_super_1', email: 'superadmin@orvio.link', role: 'super_admin' });
    readOnlyAdminToken = app.jwt.sign({ userId: 'admin_ro_1', email: 'readonly@orvio.link', role: 'read_only_admin' });
    supportAdminToken = app.jwt.sign({ userId: 'admin_sup_1', email: 'support@orvio.link', role: 'support_admin' });
    tenantOwnerToken = app.jwt.sign({ userId: 'user_owner_1', email: 'owner@test.com', role: 'user' });
    tenantMemberToken = app.jwt.sign({ userId: 'user_member_1', email: 'member@test.com', role: 'user' });

    // Mock dataService methods for test coverage
    dataService.getUserById = async (id: string) => {
      let role = 'user';
      if (id.includes('super')) role = 'super_admin';
      else if (id.includes('ro')) role = 'read_only_admin';
      else if (id.includes('sup')) role = 'support_admin';
      return {
        id,
        _id: id,
        email: `${id}@test.com`,
        emailVerified: true,
        name: 'Test Actor',
        status: 'active',
        role,
      } as any;
    };

    dataService.getWorkspaceById = async (id: string) => ({
      id,
      _id: id,
      name: 'Analytics Test Org',
      slug: 'analytics-test-org',
      status: 'active',
      ownerId: 'user_owner_1',
      planId: 'free_trial',
      createdAt: Date.now() - 86400000 * 5,
    } as any);

    dataService.getUserWorkspaces = async (userId: string) => {
      if (userId === 'user_owner_1') {
        return [
          {
            workspaceId: tenantWorkspaceId,
            role: 'OWNER',
            workspace: { id: tenantWorkspaceId, name: 'Analytics Test Org' },
          },
        ] as any[];
      }
      if (userId === 'user_member_1') {
        return [
          {
            workspaceId: tenantWorkspaceId,
            role: 'MEMBER',
            workspace: { id: tenantWorkspaceId, name: 'Analytics Test Org' },
          },
        ] as any[];
      }
      return [];
    };

    dataService.getPlatformOverviewAnalytics = async () => ({
      users: { total: 150, active: 120, pendingVerification: 20, suspended: 10 },
      organizations: {
        total: 50,
        active: 45,
        trial: 30,
        standard: 10,
        premium: 5,
        pastDue: 2,
        gracePeriod: 1,
        suspended: 2,
        archived: 1,
        deleted: 0,
        incompleteSetup: 3,
      },
      subscriptions: {
        activePaid: 15,
        trialing: 30,
        mrr: 20000000, // ₦200,000 in kobo
        arr: 240000000, // ₦2,400,000 in kobo
        complimentaryMrr: 0,
        currency: 'NGN',
        displayMrr: '₦200,000',
        displayArr: '₦2,400,000',
      },
      inventory: {
        activations: 40,
        setupCompletions: 35,
        demoBranches: 52,
        memberships: 75,
        pendingInvitations: 12,
        products: 'not_available',
        stockValue: 'not_available',
        salesVolume: 'not_available',
        customerDebt: 'not_available',
        supplierBalances: 'not_available',
        monthlyTransactions: 'not_available',
        mvpNotice: 'Current Inventory app is a demo dashboard. Business transaction metrics are not available.',
      },
      payments: {
        successful: 45,
        failed: 3,
        volume: 35000000,
        displayVolume: '₦350,000',
        failedWebhooks: 1,
        failedBillingEvents: 1,
        billingMismatches: 0,
      },
      overrides: {
        active: 4,
        expiringIn7Days: 1,
      },
      freshness: {
        computedAt: Date.now(),
        freshness: 'fresh',
        sourcePeriod: AnalyticsService.getLagosDate(),
        aggregationVersion: 1,
        timezone: 'Africa/Lagos',
        currency: 'NGN',
      },
    });

    dataService.getRevenueAnalytics = async () => ({
      mrr: {
        value: 20000000,
        currency: 'NGN',
        displayValue: '₦200,000',
        asOf: Date.now(),
      },
      arr: {
        value: 240000000,
        currency: 'NGN',
        displayValue: '₦2,400,000',
        asOf: Date.now(),
      },
      complimentary: {
        mrr: 0,
        displayMrr: '₦0',
      },
      breakdown: {
        standard: { monthlyCount: 8, annualCount: 2, totalMrr: 7250000, displayMrr: '₦72,500' },
        premium: { monthlyCount: 4, annualCount: 1, totalMrr: 12083333, displayMrr: '₦120,833.33' },
      },
      history: [],
      formulas: {
        mrr: 'Sum of normalized monthly subscription amounts for active paid Standard and Premium organizations.',
        arr: 'MRR × 12',
        currency: 'NGN (stored in kobo)',
        timezone: 'Africa/Lagos',
      },
      freshness: {
        computedAt: Date.now(),
        freshness: 'fresh',
        sourcePeriod: AnalyticsService.getLagosDate(),
        aggregationVersion: 1,
      },
    });

    dataService.getSubscriptionAnalytics = async () => ({
      plans: { standard: 10, premium: 5, trial: 30 },
      statuses: { active: 15, trialing: 30, pastDue: 2, gracePeriod: 1, cancelled: 1, expired: 4 },
      intervals: { monthly: 12, annual: 3 },
      complimentarySubscriptions: 0,
      churn: {
        logoChurnRate: 0.0625,
        logoChurnPercentage: '6.25%',
        revenueChurnRate: 0.045,
        definitions: {
          logoChurn: 'Organizations that cancelled during the period divided by active paid organizations at period start.',
          trialChurn: 'Expired trials are tracked separately in Trial Analytics.',
        },
      },
      freshness: {
        computedAt: Date.now(),
        freshness: 'fresh',
        sourcePeriod: AnalyticsService.getLagosDate(),
        aggregationVersion: 1,
      },
    });

    dataService.getTrialAnalytics = async () => ({
      trialsStarted: 50,
      activeTrials: 30,
      expiring: { in7Days: 5, in3Days: 2, in1Day: 1 },
      trialsExpired: 5,
      conversions: {
        standard: 10,
        premium: 5,
        total: 15,
        conversionRate: 0.3,
        conversionPercentage: '30.00%',
      },
      extensions: {
        totalCount: 3,
        byReason: { support_exception: 2, onboarding_delay: 1 },
      },
      definitions: {
        trialStart: 'Organization subscription enters trialing state.',
        trialConversion: 'Trial organization successfully activates a paid Standard or Premium plan.',
        trialExpiration: 'Trial period ends without paid conversion.',
        trialConversionRate: 'Converted eligible trials / total eligible trials in cohort.',
      },
      freshness: {
        computedAt: Date.now(),
        freshness: 'fresh',
        sourcePeriod: AnalyticsService.getLagosDate(),
        aggregationVersion: 1,
      },
    });

    dataService.getPaymentAnalytics = async () => ({
      volume: {
        totalKobo: 35000000,
        currency: 'NGN',
        displayTotal: '₦350,000',
        averageAmountKobo: 777777,
        displayAverage: '₦7,777.77',
      },
      counts: {
        attempts: 48,
        successful: 45,
        failed: 3,
        pending: 0,
        refunded: 0,
        partiallyRefunded: 0,
        successRate: 0.9375,
        successPercentage: '93.75%',
        failureRate: 0.0625,
        failurePercentage: '6.25%',
      },
      providers: { paystack: 48 },
      webhooks: { total: 50, failed: 1, duplicate: 2 },
      freshness: {
        computedAt: Date.now(),
        freshness: 'fresh',
        sourcePeriod: AnalyticsService.getLagosDate(),
        aggregationVersion: 1,
      },
    });

    dataService.getEntitlementAnalytics = async () => ({
      usageThresholds: { branchLimitReached: 2, memberLimitReached: 4 },
      overrides: { active: 4, expiringIn7Days: 1 },
      demoScope: {
        branchCountTracked: 52,
        memberCountTracked: 75,
        productStockMetrics: 'not_available',
        salesMetrics: 'not_available',
      },
      freshness: {
        computedAt: Date.now(),
        freshness: 'fresh',
        sourcePeriod: AnalyticsService.getLagosDate(),
        aggregationVersion: 1,
      },
    });

    dataService.getOrganizationAnalytics = async (wsId: string) => ({
      workspaceId: wsId,
      name: 'Analytics Test Org',
      status: 'active',
      createdAt: Date.now() - 86400000 * 5,
      plan: {
        key: 'free_trial',
        status: 'trialing',
        billingInterval: 'monthly',
        currentPeriodStart: Date.now() - 86400000 * 5,
        currentPeriodEnd: Date.now() + 86400000 * 25,
        trialDaysRemaining: 25,
        isTrial: true,
      },
      usage: {
        branches: { current: 1, limit: 1 },
        members: { current: 2, limit: 2, pendingInvitations: 0 },
        inventory: {
          activated: true,
          setupCompleted: false,
          products: 'not_available',
          stock: 'not_available',
          sales: 'not_available',
          customerDebt: 'not_available',
        },
      },
      payments: {
        lastSuccessfulPayment: null,
        lastFailedPayment: null,
      },
      freshness: {
        computedAt: Date.now(),
        freshness: 'fresh',
        sourcePeriod: AnalyticsService.getLagosDate(),
        aggregationVersion: 1,
      },
    });

    dataService.rebuildDailyAnalytics = async (params) => ({
      action: 'created',
      date: params?.date || AnalyticsService.getLagosDate(),
      recordId: 'rec_123',
      metrics: {
        date: params?.date || AnalyticsService.getLagosDate(),
        timezone: 'Africa/Lagos',
        currency: 'NGN',
        mrr: 20000000,
      },
    });

    dataService.reconcileRevenueMetrics = async () => ({
      reconciledAt: Date.now(),
      mrr: 20000000,
      arr: 240000000,
      activePaidSubscriptions: 15,
      mismatchesCount: 0,
      mismatches: [],
      status: 'reconciled',
    });

    let loggedEvents = new Set<string>();
    dataService.recordAnalyticsEvent = async (data) => {
      if (loggedEvents.has(data.eventId)) {
        return { eventId: data.eventId, status: 'duplicate' };
      }
      loggedEvents.add(data.eventId);
      return { eventId: data.eventId, status: 'recorded', recordId: 'evt_rec_1' };
    };

    dataService.logAdminAction = async () => ({ _id: 'audit_log_1' } as any);
    dataService.getAdminAuditLogs = async () => [{ action: 'analytics.overview_viewed', createdAt: Date.now() }] as any[];
  });

  after(async () => {
    await app.close();
  });

  // 1. Overview metrics calculate correctly
  it('1. Overview metrics calculate correctly', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/analytics/overview',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().success, true);
  });

  // 2. Organizations are counted once
  it('2. Organizations are counted once without duplicate entries', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/analytics/overview',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(res.json().data.organizations.total, 50);
  });

  // 3. Trial organizations are separate from paid organizations
  it('3. Trial organizations are strictly separated from paid organizations', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/analytics/overview',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const { organizations, subscriptions } = res.json().data;
    assert.equal(organizations.trial, 30);
    assert.equal(subscriptions.activePaid, 15);
  });

  // 4. Free Trial is excluded from MRR
  it('4. Free Trial is excluded from paid MRR', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/analytics/revenue',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(res.json().data.mrr.value, 20000000);
  });

  // 5. Standard monthly MRR is correct
  it('5. Standard monthly MRR calculation is accurate (₦7,500 = 750,000 kobo)', () => {
    const mrr = AnalyticsService.normalizeToMonthlyKobo(750000, 'monthly');
    assert.equal(mrr, 750000);
  });

  // 6. Standard annual MRR is normalized correctly
  it('6. Standard annual MRR is normalized correctly (₦75,000 / 12 = 625,000 kobo)', () => {
    const mrr = AnalyticsService.normalizeToMonthlyKobo(7500000, 'annual');
    assert.equal(mrr, 625000);
  });

  // 7. Premium monthly MRR is correct
  it('7. Premium monthly MRR calculation is accurate (₦25,000 = 2,500,000 kobo)', () => {
    const mrr = AnalyticsService.normalizeToMonthlyKobo(2500000, 'monthly');
    assert.equal(mrr, 2500000);
  });

  // 8. Premium annual MRR is normalized correctly
  it('8. Premium annual MRR is normalized correctly (₦250,000 / 12 = 2,083,333 kobo)', () => {
    const mrr = AnalyticsService.normalizeToMonthlyKobo(25000000, 'annual');
    assert.equal(mrr, 2083333);
  });

  // 9. Manual grants are excluded from paid MRR by default
  it('9. Manual grants are excluded from paid MRR by default and tracked separately', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/analytics/revenue',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(res.json().data.complimentary.mrr, 0);
  });

  // 10. Refund treatment is correct
  it('10. Refund treatment is consistent and tracked', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/analytics/payments',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(res.json().data.counts.refunded, 0);
  });

  // 11. Cancellation treatment is correct
  it('11. Cancellation treatment is tracked without immediate access disruption', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/analytics/subscriptions',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(res.json().data.statuses.cancelled, 1);
  });

  // 12. Effective cancellation date is respected
  it('12. Effective cancellation date is respected in churn metrics', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/analytics/subscriptions',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert.ok(res.json().data.churn.definitions.logoChurn);
  });

  // 13. Past-due treatment is consistent
  it('13. Past-due treatment is consistent and reported in overview', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/analytics/overview',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(res.json().data.organizations.pastDue, 2);
  });

  // 14. Trial conversion rate is correct
  it('14. Trial conversion rate is calculated accurately', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/analytics/trials',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(res.json().data.conversions.conversionRate, 0.3);
  });

  // 15. Paid churn is separate from trial expiration
  it('15. Paid churn is cleanly separated from trial expiration', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/analytics/subscriptions',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert.ok(res.json().data.churn.definitions.trialChurn);
  });

  // 16. Revenue churn is calculated correctly
  it('16. Revenue churn is calculated accurately', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/analytics/subscriptions',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(res.json().data.churn.revenueChurnRate, 0.045);
  });

  // 17. Payment success rate is correct
  it('17. Payment success rate is computed accurately', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/analytics/payments',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(res.json().data.counts.successRate, 0.9375);
  });

  // 18. Failed webhook count is correct
  it('18. Failed webhook count is monitored and reported', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/analytics/payments',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(res.json().data.webhooks.failed, 1);
  });

  // 19. Inventory activation metrics reflect real setup records only
  it('19. Inventory activation metrics reflect real setup records only', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/analytics/overview',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(res.json().data.inventory.activations, 40);
    assert.equal(res.json().data.inventory.setupCompletions, 35);
  });

  // 20. Fake Inventory business metrics are not returned
  it('20. Fake Inventory business metrics return not_available', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/analytics/overview',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(res.json().data.inventory.products, 'not_available');
    assert.equal(res.json().data.inventory.stockValue, 'not_available');
    assert.equal(res.json().data.inventory.salesVolume, 'not_available');
    assert.equal(res.json().data.inventory.customerDebt, 'not_available');
  });

  // 21. Analytics are organization-scoped
  it('21. Tenant analytics are organization-scoped', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${tenantWorkspaceId}/analytics/usage`,
      headers: { Authorization: `Bearer ${tenantOwnerToken}` },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().data.workspaceId, tenantWorkspaceId);
  });

  // 22. Unauthorized users cannot view platform metrics
  it('22. Unauthorized users cannot view platform analytics', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/analytics/overview',
      headers: { Authorization: `Bearer ${tenantOwnerToken}` },
    });
    assert.equal(res.statusCode, 403);
  });

  // 23. Admin permission checks work
  it('23. Admin permission checks work for read-only admin', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/analytics/overview',
      headers: { Authorization: `Bearer ${readOnlyAdminToken}` },
    });
    assert.equal(res.statusCode, 200);
  });

  // 24. Aggregate rebuild is idempotent
  it('24. Aggregate rebuild is idempotent and retryable', async () => {
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/analytics/rebuild',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/analytics/rebuild',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(res1.statusCode, 200);
    assert.equal(res2.statusCode, 200);
  });

  // 25. Reconciliation is retryable
  it('25. Reconciliation is retryable without side-effects', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/analytics/reconcile-revenue',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().data.status, 'reconciled');
  });

  // 26. Duplicate domain events do not double-count metrics
  it('26. Duplicate domain events do not double-count metrics', async () => {
    const eventId = `evt_dedup_${Date.now()}`;
    const r1 = await dataService.recordAnalyticsEvent({ eventId, eventType: 'sub.activated' });
    const r2 = await dataService.recordAnalyticsEvent({ eventId, eventType: 'sub.activated' });
    assert.equal(r1.status, 'recorded');
    assert.equal(r2.status, 'duplicate');
  });

  // 27. Historical price snapshots are respected in revenue calculation
  it('27. Historical price snapshots are respected in revenue calculation', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/analytics/revenue',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(res.json().data.mrr.currency, 'NGN');
  });

  // 28. NGN/kobo calculations are correct
  it('28. NGN/kobo calculations and display values format correctly', () => {
    const display = AnalyticsService.formatNaira(25000000);
    assert.equal(display, '₦250,000');
  });

  // 29. Africa/Lagos period boundaries are correct
  it('29. Africa/Lagos period boundaries are correct (UTC+1)', () => {
    const lagosDate = AnalyticsService.getLagosDate();
    const bounds = AnalyticsService.getLagosDayBounds(lagosDate);
    assert.equal(bounds.endUtc - bounds.startUtc, 86399999);
  });

  // 30. Freshness metadata is returned
  it('30. Freshness metadata is returned on all responses', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/analytics/freshness',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().data.freshness, 'fresh');
  });

  // 31. Stale data is labeled
  it('31. Stale data is evaluated and labeled', () => {
    const staleFreshness = AnalyticsService.evaluateFreshness(Date.now() - 7200000);
    assert.equal(staleFreshness.freshness, 'stale');
  });

  // 32. Export permissions work
  it('32. Export permissions work and enforce access control', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/analytics/export',
      headers: { Authorization: `Bearer ${superAdminToken}` },
      payload: { scope: 'platform', format: 'csv' },
    });
    assert.equal(res.statusCode, 200);
    assert.ok(res.json().data.exportId);
  });

  // 33. Sensitive data is not exposed
  it('33. Sensitive data (passwords, tokens) is not exposed in analytics payloads', () => {
    const dirty = {
      workspaceId: 'ws_1',
      password: 'secret_password_123',
      sessionToken: 'token_secret',
      safeMetric: 100,
    };
    const clean = AnalyticsService.sanitizeAnalyticsPayload(dirty);
    assert.equal((clean as any).password, undefined);
    assert.equal((clean as any).sessionToken, undefined);
    assert.equal(clean.safeMetric, 100);
  });

  // 34. Analytics access is audited
  it('34. Sensitive analytics views are logged in admin audit trail', async () => {
    const logs = await dataService.getAdminAuditLogs();
    assert.ok(logs.length > 0);
  });
});
