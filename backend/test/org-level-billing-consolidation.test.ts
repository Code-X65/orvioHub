import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';
import { dataService } from '../src/services/dataService.js';
import { entitlementService } from '../src/services/entitlementService.js';
import { env } from '../src/config/env.js';

describe('Consolidate Billing to Per-Organization Only Test Suite', () => {
  let app: FastifyInstance;
  const originalGetUserById = dataService.getUserById;
  const originalCreateUser = dataService.createUser;
  const originalCreateOrganization = dataService.createOrganization;
  const originalGetOrganizationSubscription = dataService.getOrganizationSubscription;
  const originalUpdateOrganizationSubscription = dataService.updateOrganizationSubscription;
  const originalExtendOrganizationTrial = dataService.extendOrganizationTrial;
  const originalRecordOrganizationManualPayment = dataService.recordOrganizationManualPayment;
  const originalGetOrganizationPayments = dataService.getOrganizationPayments;
  const originalGetUserWorkspaces = dataService.getUserWorkspaces;
  const originalGetUserMemberships = dataService.getUserMemberships;
  const originalAdminId = env.ADMIN_USER_ID;

  const adminId = 'admin_super_user_id';
  const testUserId = 'test_user_free_id';

  before(async () => {
    app = await buildApp();
    await app.ready();

    (env as any).ADMIN_USER_ID = adminId;

    dataService.getUserById = async (id: string) => ({
      id,
      email: id === adminId ? 'admin@orviohub.localhost' : 'user@orviohub.localhost',
      name: id === adminId ? 'Admin User' : 'Regular User',
      emailVerified: true,
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as any);

    dataService.createSession = async () => ({
      sessionId: 'sess_test_123',
      refreshToken: 'refresh_test_123',
    } as any);

    dataService.logAudit = async () => ({} as any);
  });

  after(async () => {
    (env as any).ADMIN_USER_ID = originalAdminId;
    dataService.getUserById = originalGetUserById;
    dataService.createUser = originalCreateUser;
    dataService.createOrganization = originalCreateOrganization;
    dataService.getOrganizationSubscription = originalGetOrganizationSubscription;
    dataService.updateOrganizationSubscription = originalUpdateOrganizationSubscription;
    dataService.extendOrganizationTrial = originalExtendOrganizationTrial;
    dataService.recordOrganizationManualPayment = originalRecordOrganizationManualPayment;
    dataService.getOrganizationPayments = originalGetOrganizationPayments;
    dataService.getUserWorkspaces = originalGetUserWorkspaces;
    dataService.getUserMemberships = originalGetUserMemberships;
    await app.close();
  });

  test('1. User Signup is 100% free: Creates user without requiring plan selection or creating user subscription', async () => {
    let createdPayload: any = null;
    dataService.createUser = async (payload: any) => {
      createdPayload = payload;
      return {
        user: {
          id: testUserId,
          email: payload.email,
          name: payload.name,
          emailVerified: false,
          status: 'active',
          tokenVersion: 1,
        },
      } as any;
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: {
        firstName: 'John',
        lastName: 'Doe',
        email: 'johndoe@example.com',
        password: 'Password123!',
        passwordConfirmation: 'Password123!',
        country: 'Nigeria',
      },
    });

    assert.strictEqual(res.statusCode, 201);
    const body = res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.user.email, 'johndoe@example.com');
    // Ensure no billing fields were forced into createUser
    assert.strictEqual(createdPayload.planKey, undefined);
    assert.strictEqual(createdPayload.paymentMethod, undefined);
  });

  test('2. Organization Creation with Free Trial: assigns free_trial plan and trialing status', async () => {
    let orgCreatedWith: any = null;
    dataService.createOrganization = async (payload: any) => {
      orgCreatedWith = payload;
      return {
        organization: { id: 'org_trial_1', name: payload.name, currency: 'NGN' },
        workspace: { id: 'ws_trial_1', name: payload.name },
        membership: { id: 'mem_1', role: 'OWNER' },
      } as any;
    };

    const token = app.jwt.sign({ userId: testUserId, email: 'user@orviohub.localhost' });
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/organizations',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Alpha Mart Ltd',
        industry: 'retail',
        currency: 'NGN',
        planId: 'free_trial',
      },
    });

    assert.strictEqual(res.statusCode, 201);
    const body = res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(orgCreatedWith.planId, 'free_trial');
  });

  test('3. Organization Creation with Standard Plan: activates standard plan upon valid payment reference', async () => {
    let orgCreatedWith: any = null;
    let subscriptionUpdatedWith: any = null;

    dataService.createOrganization = async (payload: any) => {
      orgCreatedWith = payload;
      return {
        organization: { id: 'org_standard_2', name: payload.name, currency: 'NGN' },
        workspace: { id: 'ws_standard_2', name: payload.name },
        membership: { id: 'mem_2', role: 'OWNER' },
      } as any;
    };

    dataService.updateOrganizationSubscription = async (orgId, planKey, status, end, trial, cancel) => {
      subscriptionUpdatedWith = { orgId, planKey, status, end };
      return { id: 'sub_std_2', organizationId: orgId, planKey, status } as any;
    };

    const token = app.jwt.sign({ userId: testUserId, email: 'user@orviohub.localhost' });
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/organizations',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Beta Superstore',
        industry: 'retail',
        currency: 'NGN',
        planId: 'standard',
        billingCycle: 'monthly',
        paymentGateway: 'paystack',
        paymentReference: 'pst_ref_123456',
      },
    });

    assert.strictEqual(res.statusCode, 201);
    const body = res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(subscriptionUpdatedWith.planKey, 'standard');
    assert.strictEqual(subscriptionUpdatedWith.status, 'active');
  });

  test('4. Multiple Organizations: A single user can own multiple organizations with different plans', async () => {
    dataService.getUserWorkspaces = async () => [
      { workspace: { id: 'ws_1', name: 'Org 1 (Trial)' }, role: 'owner', isOwner: true } as any,
      { workspace: { id: 'ws_2', name: 'Org 2 (Standard)' }, role: 'owner', isOwner: true } as any,
    ];

    const entitlementCheck = await entitlementService.checkWorkspaceCreationEntitlement(testUserId);
    assert.strictEqual(entitlementCheck.allowed, true);
  });

  test('5. Admin Subscriptions Management: Admin can view organization subscriptions, change plan, extend trial, and record manual payment', async () => {
    const adminToken = app.jwt.sign({ userId: adminId, email: 'admin@orviohub.localhost' });

    // A) Get Organization Subscription
    dataService.getOrganizationSubscription = async (orgId: string) => ({
      organizationId: orgId,
      planKey: 'free_trial',
      status: 'trialing',
      trialEndsAt: Date.now() + 5 * 86_400_000,
      currentPeriodStart: Date.now(),
      currentPeriodEnd: Date.now() + 14 * 86_400_000,
      cancelAtPeriodEnd: false,
    } as any);

    const getRes = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/organizations/org_trial_1/subscription',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(getRes.statusCode, 200);
    assert.strictEqual(getRes.json().data.subscription.planKey, 'free_trial');

    // B) Extend Trial
    let extendedDaysCount = 0;
    dataService.extendOrganizationTrial = async (orgId: string, days: number) => {
      extendedDaysCount = days;
      return { organizationId: orgId, days, trialEndsAt: Date.now() + 19 * 86_400_000 } as any;
    };

    const extendRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/organizations/org_trial_1/subscription/extend-trial',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { extensionDays: 14 },
    });
    assert.strictEqual(extendRes.statusCode, 200);
    assert.strictEqual(extendedDaysCount, 14);

    // C) Change Plan to Standard
    let changedPlan: any = null;
    dataService.updateOrganizationSubscription = async (orgId, planKey, status) => {
      changedPlan = { orgId, planKey, status };
      return { organizationId: orgId, planKey, status } as any;
    };

    const changeRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/organizations/org_trial_1/subscription/change',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { planKey: 'standard', status: 'active' },
    });
    assert.strictEqual(changeRes.statusCode, 200);
    assert.strictEqual(changedPlan.planKey, 'standard');
    assert.strictEqual(changedPlan.status, 'active');

    // D) Record Manual Payment
    let manualPaymentRecorded: any = null;
    dataService.recordOrganizationManualPayment = async (data: any) => {
      manualPaymentRecorded = data;
      return { id: 'man_pay_1', ...data } as any;
    };

    const payRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/organizations/org_trial_1/payments/manual',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        planKey: 'standard',
        amount: 750000,
        billingCycle: 'monthly',
        paymentReference: 'OFFLINE-GTB-001',
        paymentMethod: 'bank_transfer',
      },
    });
    assert.strictEqual(payRes.statusCode, 201);
    assert.strictEqual(manualPaymentRecorded.paymentReference, 'OFFLINE-GTB-001');

    // E) Get Payment History
    dataService.getOrganizationPayments = async () => [
      { id: 'pay_1', amount: 7500, status: 'success', provider: 'paystack' },
    ] as any;
    dataService.listManualPayments = async () => [
      { id: 'man_1', amount: 750000, status: 'success', paymentMethod: 'bank_transfer' },
    ] as any;

    const histRes = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/organizations/org_trial_1/payments',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(histRes.statusCode, 200);
    assert.strictEqual(histRes.json().data.payments.length, 1);
    assert.strictEqual(histRes.json().data.manualPayments.length, 1);
  });
});
