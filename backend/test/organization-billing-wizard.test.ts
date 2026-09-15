import { describe, it, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { dataService } from '../src/services/dataService.js';
import type { FastifyInstance } from 'fastify';

describe('Organization Billing Wizard & Per-Org Subscription Test Suite', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  test('1. Create organization with Free Trial plan: status is trial with 30-day period', async () => {
    const testUserId = 'user_wizard_1';
    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    let createdData: any = null;
    dataService.createOrganizationWithPlan = async (args: any) => {
      createdData = args;
      return {
        organizationId: 'org_wizard_free_1',
        workspaceId: 'ws_wizard_free_1',
        subscriptionId: 'sub_wizard_free_1',
        slug: 'prime-store',
        name: args.name,
        status: 'trial',
        planKey: 'free_trial',
        hasDefaultBranch: true,
      };
    };

    dataService.getUserById = async () => ({
      id: testUserId,
      email: 'owner@wizard.com',
      emailVerified: true,
      name: 'Wizard Owner',
    } as any);

    const token = app.jwt.sign({ userId: testUserId, email: 'owner@wizard.com' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/organizations/with-plan',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Prime Store',
        phone: '08012345678',
        category: 'Provision Store',
        planKey: 'free_trial',
        billingInterval: 'monthly',
      },
    });

    assert.strictEqual(res.statusCode, 201);
    const body = res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.organizationId, 'org_wizard_free_1');
    assert.strictEqual(body.data.status, 'trial');
    assert.strictEqual(body.data.planKey, 'free_trial');
    assert.strictEqual(createdData.planKey, 'free_trial');
  });

  test('2. Create organization with Standard plan: status is pending before payment', async () => {
    const testUserId = 'user_wizard_2';

    let createdData: any = null;
    dataService.createOrganizationWithPlan = async (args: any) => {
      createdData = args;
      return {
        organizationId: 'org_wizard_std_1',
        workspaceId: 'ws_wizard_std_1',
        subscriptionId: 'sub_wizard_std_1',
        slug: 'super-logistics',
        name: args.name,
        status: 'pending',
        planKey: 'standard',
        hasDefaultBranch: true,
      };
    };

    dataService.getUserById = async () => ({
      id: testUserId,
      email: 'owner2@wizard.com',
      emailVerified: true,
      name: 'Standard Owner',
    } as any);

    const token = app.jwt.sign({ userId: testUserId, email: 'owner2@wizard.com' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/organizations/with-plan',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Super Logistics',
        phone: '08099887766',
        category: 'Service',
        planKey: 'standard',
        billingInterval: 'annual',
      },
    });

    assert.strictEqual(res.statusCode, 201);
    const body = res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.organizationId, 'org_wizard_std_1');
    assert.strictEqual(body.data.status, 'pending');
    assert.strictEqual(body.data.planKey, 'standard');
    assert.strictEqual(createdData.billingInterval, 'annual');
  });

  test('3. Confirm payment and activate organization Standard plan', async () => {
    const testUserId = 'user_wizard_2';
    const orgId = 'org_wizard_std_1';

    let paymentConfirmed: any = null;
    dataService.confirmPaymentAndActivateOrg = async (args: any) => {
      paymentConfirmed = args;
      return {
        success: true,
        organizationId: args.organizationId,
        subscriptionId: 'sub_wizard_std_1',
        status: 'active',
        planKey: 'standard',
      };
    };

    dataService.getUserById = async () => ({
      id: testUserId,
      email: 'owner2@wizard.com',
      emailVerified: true,
      name: 'Standard Owner',
    } as any);

    const token = app.jwt.sign({ userId: testUserId, email: 'owner2@wizard.com' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/confirm-org-payment',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        organizationId: orgId,
        paymentReference: 'pstk_ref_998877',
        provider: 'paystack',
        amount: 75000,
        billingInterval: 'annual',
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.status, 'active');
    assert.strictEqual(body.data.planKey, 'standard');
    assert.strictEqual(paymentConfirmed.paymentReference, 'pstk_ref_998877');
    assert.strictEqual(paymentConfirmed.organizationId, orgId);
  });

  test('4. Enforce 1 Free Trial org per user: Reject second Free Trial org creation', async () => {
    const testUserId = 'user_wizard_1';

    dataService.createOrganizationWithPlan = async () => {
      throw new Error('You already have an organization on Free Trial. Please choose Standard for this new organization.');
    };

    dataService.getUserById = async () => ({
      id: testUserId,
      email: 'owner@wizard.com',
      emailVerified: true,
      name: 'Wizard Owner',
    } as any);

    const token = app.jwt.sign({ userId: testUserId, email: 'owner@wizard.com' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/organizations/with-plan',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Second Free Org',
        phone: '08011223344',
        category: 'Boutique',
        planKey: 'free_trial',
      },
    });

    assert.strictEqual(res.statusCode, 403);
    const body = res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'FREE_TRIAL_LIMIT_EXCEEDED');
    assert.ok(body.error.message.includes('already have an organization on Free Trial'));
  });

  test('5. Check user free trial status endpoint returns active trial details', async () => {
    const testUserId = 'user_wizard_1';

    dataService.getUserFreeTrialStatus = async (userId: string) => ({
      hasFreeTrial: true,
      organizationId: 'org_wizard_free_1',
      organizationName: 'Prime Store',
      trialEndsAt: Date.now() + 25 * 86_400_000,
    });

    dataService.getUserById = async () => ({
      id: testUserId,
      email: 'owner@wizard.com',
      emailVerified: true,
      name: 'Wizard Owner',
    } as any);

    const token = app.jwt.sign({ userId: testUserId, email: 'owner@wizard.com' });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/billing/user-free-trial-status',
      headers: { authorization: `Bearer ${token}` },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.hasFreeTrial, true);
    assert.strictEqual(body.data.organizationName, 'Prime Store');
  });

  test('6. Switch pending Standard org to Free Trial plan during onboarding', async () => {
    const testUserId = 'user_wizard_3';
    const orgId = 'org_wizard_switch_1';

    dataService.switchOrgPlan = async (args: any) => ({
      success: true,
      organizationId: args.organizationId,
      planKey: args.newPlanKey,
      status: 'trial',
    });

    dataService.getUserById = async () => ({
      id: testUserId,
      email: 'owner3@wizard.com',
      emailVerified: true,
      name: 'Switch Owner',
    } as any);

    const token = app.jwt.sign({ userId: testUserId, email: 'owner3@wizard.com' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/switch-org-plan',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        organizationId: orgId,
        newPlanKey: 'free_trial',
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.planKey, 'free_trial');
    assert.strictEqual(body.data.status, 'trial');
  });
});
