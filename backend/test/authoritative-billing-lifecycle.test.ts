import { describe, it, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { dataService } from '../src/services/dataService.js';
import type { FastifyInstance } from 'fastify';

describe('Authoritative Organization Billing Lifecycle Test Suite', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  test('1. Free Trial Organization Creation - authoritative context has 30-day trial & trial limits', async () => {
    const testUserId = 'user_auth_trial_1';
    const testOrgId = 'org_auth_trial_1';

    dataService.getUserById = async () => ({
      id: testUserId,
      email: 'trial@orvio.io',
      emailVerified: true,
      name: 'Trial User',
    } as any);

    dataService.getOrganizationBillingContext = async (orgId: string) => ({
      organization: {
        id: orgId,
        name: 'Trial Bakery',
        status: 'trial',
      },
      billing: {
        planKey: 'free_trial',
        planName: 'Free Trial',
        selectedPlan: 'free_trial',
        activePlan: 'free_trial',
        status: 'trialing',
        subscriptionStatus: 'trialing',
        paymentStatus: 'none',
        checkoutStatus: 'completed',
        entitlementStatus: 'trial',
        currentPeriodStart: Date.now(),
        currentPeriodEnd: Date.now() + 30 * 86_400_000,
        trialStart: Date.now(),
        trialEnd: Date.now() + 30 * 86_400_000,
        amount: 0,
        currency: 'NGN',
        billingInterval: 'monthly',
        lastPaymentReference: null,
      },
      entitlements: {
        maxApplications: 1,
        maxBranchesPerApplication: 1,
        maxMembers: 2,
        maxProducts: 500,
        maxMonthlyTransactions: 500,
      },
      usage: {
        applications: 1,
        branches: 1,
        members: 1,
        products: 10,
      },
    } as any);

    const token = app.jwt.sign({ userId: testUserId, email: 'trial@orvio.io' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${testOrgId}/billing/context`,
      headers: { authorization: `Bearer ${token}` },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.billing.activePlan, 'free_trial');
    assert.strictEqual(body.data.billing.status, 'trialing');
    assert.strictEqual(body.data.entitlements.maxApplications, 1);
    assert.strictEqual(body.data.entitlements.maxBranchesPerApplication, 1);
    assert.strictEqual(body.data.entitlements.maxMembers, 2);
    assert.ok(body.data.billing.trialEnd !== null);
  });

  test('2. Standard Plan Organization - Paystack verification activates Standard with no trial dates', async () => {
    const testUserId = 'user_auth_std_1';
    const testOrgId = 'org_auth_std_1';

    dataService.getUserById = async () => ({
      id: testUserId,
      email: 'owner@stdstore.com',
      emailVerified: true,
      name: 'Standard Store Owner',
    } as any);

    dataService.confirmPaymentAndActivateOrg = async (args: any) => ({
      organizationId: args.organizationId,
      workspaceId: 'ws_std_1',
      subscriptionId: 'sub_std_1',
      invoiceId: 'inv_std_1',
      invoiceNumber: 'INV-2026-0001',
      planKey: 'standard',
      status: 'active',
      activePlan: 'standard',
      amount: args.amount || 7500,
      currentPeriodEnd: Date.now() + 30 * 86_400_000,
      hasDefaultBranch: true,
    } as any);

    dataService.getOrganizationBillingContext = async (orgId: string) => ({
      organization: {
        id: orgId,
        name: 'Prime Retail',
        status: 'active',
      },
      billing: {
        planKey: 'standard',
        planName: 'Standard',
        selectedPlan: 'standard',
        activePlan: 'standard',
        status: 'active',
        subscriptionStatus: 'active',
        paymentStatus: 'paid',
        checkoutStatus: 'completed',
        entitlementStatus: 'paid_active',
        currentPeriodStart: Date.now(),
        currentPeriodEnd: Date.now() + 30 * 86_400_000,
        trialStart: null,
        trialEnd: null,
        amount: 7500,
        currency: 'NGN',
        billingInterval: 'monthly',
        lastPaymentReference: 'pstk_ref_123456',
      },
      entitlements: {
        maxApplications: 3,
        maxBranchesPerApplication: 3,
        maxMembers: 10,
        maxProducts: 5000,
        maxMonthlyTransactions: 5000,
      },
      usage: {
        applications: 1,
        branches: 2,
        members: 4,
        products: 150,
      },
    } as any);

    const token = app.jwt.sign({ userId: testUserId, email: 'owner@stdstore.com' });

    // Step A: Confirm payment
    const confirmRes = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/confirm-org-payment',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        organizationId: testOrgId,
        paymentReference: 'pstk_ref_123456',
        amount: 7500,
        billingInterval: 'monthly',
      },
    });

    assert.strictEqual(confirmRes.statusCode, 200);
    const confirmBody = JSON.parse(confirmRes.body);
    assert.strictEqual(confirmBody.success, true);
    assert.strictEqual(confirmBody.data.planKey, 'standard');
    assert.strictEqual(confirmBody.data.status, 'active');

    // Step B: Query billing context
    const contextRes = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${testOrgId}/billing/context`,
      headers: { authorization: `Bearer ${token}` },
    });

    assert.strictEqual(contextRes.statusCode, 200);
    const contextBody = JSON.parse(contextRes.body);
    assert.strictEqual(contextBody.data.billing.activePlan, 'standard');
    assert.strictEqual(contextBody.data.billing.status, 'active');
    assert.strictEqual(contextBody.data.billing.trialStart, null);
    assert.strictEqual(contextBody.data.billing.trialEnd, null);
    assert.strictEqual(contextBody.data.entitlements.maxApplications, 3);
    assert.strictEqual(contextBody.data.entitlements.maxBranchesPerApplication, 3);
    assert.strictEqual(contextBody.data.entitlements.maxMembers, 10);
    assert.strictEqual(contextBody.data.entitlements.maxProducts, 5000);
  });

  test('3. Organization Billing Consistency Checker endpoint', async () => {
    const testUserId = 'user_auth_chk_1';
    const testOrgId = 'org_auth_chk_1';

    dataService.getUserById = async () => ({
      id: testUserId,
      email: 'admin@orvio.io',
      emailVerified: true,
      name: 'Admin User',
    } as any);

    dataService.checkOrganizationBillingConsistency = async (orgId: string) => ({
      consistent: true,
      issues: [],
    } as any);

    const token = app.jwt.sign({ userId: testUserId, email: 'admin@orvio.io' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${testOrgId}/billing/consistency`,
      headers: { authorization: `Bearer ${token}` },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.consistent, true);
    assert.deepStrictEqual(body.data.issues, []);
  });

  test('4. Standard Checkout Initialization - returns reference and authorization details', async () => {
    const testUserId = 'user_auth_init_1';
    const testOrgId = 'org_auth_init_1';

    dataService.getUserById = async () => ({
      id: testUserId,
      email: 'checkout@user.com',
      emailVerified: true,
      name: 'Checkout User',
    } as any);

    dataService.initializeBillingCheckout = async (args: any) => ({
      reference: 'ORV-PAY-123456',
      amount: 7500,
      currency: 'NGN',
      email: args.email,
      organizationId: args.organizationId,
      planKey: 'standard',
      billingInterval: 'monthly',
    } as any);

    const token = app.jwt.sign({ userId: testUserId, email: 'checkout@user.com' });

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${testOrgId}/billing/checkout`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        planKey: 'standard',
        billingInterval: 'monthly',
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.planKey, 'standard');
    assert.strictEqual(body.data.amount, 7500);
    assert.strictEqual(body.data.reference, 'ORV-PAY-123456');
  });
});
