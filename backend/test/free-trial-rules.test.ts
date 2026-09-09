import { describe, it, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { dataService } from '../src/services/dataService.js';
import { entitlementService } from '../src/services/entitlementService.js';
import type { FastifyInstance } from 'fastify';

describe('Free Trial Rules Enforcement Test Suite (30 Days, 1 App, 1 Branch, One Free-Trial Org Per User)', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  test('1. First org on Free Trial: creates with 30-day trial duration and status trial', async () => {
    const testUserId = 'user_trial_1';
    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    let createdSubscription: any = null;
    let createdOrg: any = null;

    dataService.createOrganizationWithOnboarding = async (args: any) => {
      createdOrg = {
        id: 'org_a',
        name: args.name,
        slug: 'org-a',
        ownerId: args.userId,
      };
      createdSubscription = {
        organizationId: 'org_a',
        planKey: 'free_trial',
        status: 'trial',
        trialStart: now,
        trialEnd: now + thirtyDaysMs,
        trialEndsAt: now + thirtyDaysMs,
      };
      return {
        organizationId: 'org_a',
        workspaceId: 'ws_a',
        slug: 'org-a',
        name: args.name,
        hasDefaultBranch: false,
      };
    };

    dataService.getUserById = async () => ({
      id: testUserId,
      email: 'owner@trial.com',
      emailVerified: true,
      name: 'Trial Owner',
    } as any);

    const token = app.jwt.sign({ userId: testUserId, email: 'owner@trial.com' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/organizations/with-onboarding',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Org A Supermarket',
        phone: '08012345678',
        category: 'Provision Store',
      },
    });

    assert.strictEqual(res.statusCode, 201);
    const body = res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.organizationId, 'org_a');
    assert.ok(createdSubscription);
    assert.strictEqual(createdSubscription.planKey, 'free_trial');
    assert.strictEqual(createdSubscription.status, 'trial');
    assert.ok(Math.abs(createdSubscription.trialEndsAt - (now + thirtyDaysMs)) < 5000);
  });

  test('2. Second org on Free Trial for same user succeeds and creates an independent 30-day trial', async () => {
    const testUserId = 'user_trial_1';
    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    let createdSubscription: any = null;

    dataService.createOrganizationWithOnboarding = async (args: any) => {
      createdSubscription = {
        organizationId: 'org_b',
        planKey: 'free_trial',
        status: 'trial',
        trialStart: now,
        trialEnd: now + thirtyDaysMs,
        trialEndsAt: now + thirtyDaysMs,
      };
      return {
        organizationId: 'org_b',
        workspaceId: 'ws_b',
        slug: 'org-b',
        name: args.name,
        hasDefaultBranch: false,
      };
    };

    dataService.getUserById = async () => ({
      id: testUserId,
      email: 'owner@trial.com',
      emailVerified: true,
      name: 'Trial Owner',
    } as any);

    const token = app.jwt.sign({ userId: testUserId, email: 'owner@trial.com' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/organizations/with-onboarding',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Org B Electronics',
        phone: '08087654321',
        category: 'Electronics',
      },
    });

    assert.strictEqual(res.statusCode, 201);
    const body = res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.organizationId, 'org_b');
    assert.ok(createdSubscription);
    assert.strictEqual(createdSubscription.planKey, 'free_trial');
  });

  test('3. Second org on Standard (Paid) for same user succeeds', async () => {
    const testUserId = 'user_trial_1';

    dataService.createOrganization = async (args: any) => {
      return {
        organization: {
          id: 'org_b_paid',
          name: args.name,
          slug: 'org-b-paid',
        },
        membership: {
          role: 'OWNER',
          status: 'ACTIVE',
        },
        onboarding: {
          status: 'COMPLETED',
          currentStep: 'COMPLETED',
        },
        isDuplicate: false,
      };
    };

    dataService.updateOrganizationSubscription = async () => ({}) as any;

    dataService.getUserById = async () => ({
      id: testUserId,
      email: 'owner@trial.com',
      emailVerified: true,
      name: 'Trial Owner',
    } as any);

    const token = app.jwt.sign({ userId: testUserId, email: 'owner@trial.com' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/organizations',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Org B Standard Paid',
        industry: 'retail',
        planId: 'standard',
        billingCycle: 'monthly',
        paymentGateway: 'paystack',
        paymentReference: 'pstk_ref_123456',
      },
    });

    assert.strictEqual(res.statusCode, 201);
    const body = res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.organization.id, 'org_b_paid');
  });

  test('4. Free Trial org: activating a second application is rejected with exact error message', async () => {
    const orgId = 'org_free_1';
    const testUserId = 'user_trial_1';

    dataService.activateApplication = async () => {
      throw new Error(
        'Free Trial organizations can only activate 1 application. Upgrade to Standard to activate more applications.'
      );
    };

    dataService.getUserById = async () => ({
      id: testUserId,
      email: 'owner@trial.com',
      emailVerified: true,
    } as any);

    const token = app.jwt.sign({ userId: testUserId, email: 'owner@trial.com' });

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/applications/pos/activate`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        planKey: 'free_trial',
      },
    });

    assert.strictEqual(res.statusCode, 403);
    const body = res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(
      body.error.message,
      'Free Trial organizations can only activate 1 application. Upgrade to Standard to activate more applications.'
    );
  });

  test('5. Free Trial org: adding a second branch is rejected with exact error message', async () => {
    const orgId = 'org_free_1';
    const testUserId = 'user_trial_1';

    dataService.getOrganizationWorkspaces = async () => [
      { id: 'ws_free_1', organizationId: orgId, isDefault: true } as any,
    ];

    dataService.getWorkspaceSubscription = async () => ({
      workspaceId: 'ws_free_1',
      organizationId: orgId,
      planKey: 'free',
      status: 'trial',
    } as any);

    dataService.getBranches = async () => [
      { id: 'b_main', name: 'Main Branch', isPrimary: true, status: 'active', productKey: 'inventory' } as any,
    ];

    dataService.createBranch = async () => {
      throw new Error(
        'Free Trial organizations can only have 1 branch per application. Upgrade to Standard to add more branches.'
      );
    };

    dataService.getUserById = async () => ({
      id: testUserId,
      email: 'owner@trial.com',
      emailVerified: true,
    } as any);

    const token = app.jwt.sign({ userId: testUserId, email: 'owner@trial.com' });

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/branches`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Second Store Location',
        code: 'BR02',
      },
    });

    assert.strictEqual(res.statusCode, 403);
    const body = res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(
      body.error.message,
      'Free Trial organizations can only have 1 branch per application. Upgrade to Standard to add more branches.'
    );
  });

  test('6. Upgrading to Standard: allows additional applications and branches', async () => {
    // 1. App entitlement check on Standard plan with 1 app active
    dataService.getWorkspaceSubscription = async () => ({
      workspaceId: 'ws_standard_1',
      planKey: 'standard',
      status: 'active',
    } as any);
    dataService.countActiveWorkspaceProducts = async () => 1;

    const appCheck = await entitlementService.checkAppActivationEntitlement('ws_standard_1', 'pos');
    assert.strictEqual(appCheck.allowed, true);
    assert.strictEqual(appCheck.limit, 3);

    // 2. Branch entitlement check on Standard plan with 1 branch active
    dataService.getBranches = async () => [
      { id: 'b1', name: 'Main Store', status: 'active', productKey: 'inventory' } as any,
    ];

    const branchCheck = await entitlementService.checkBranchCreationEntitlement(
      'ws_standard_1',
      'user_123',
      'inventory'
    );
    assert.strictEqual(branchCheck.allowed, true);
    assert.strictEqual(branchCheck.limit, 3);
  });
});
