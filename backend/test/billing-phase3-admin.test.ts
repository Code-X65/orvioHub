import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';
import { env } from '../src/config/env.js';
import { dataService } from '../src/services/dataService.js';

describe('MVP Billing System - Phase 3 Admin Dashboard & Manual Management Test Suite', () => {
  let app: FastifyInstance;
  const originalAdminId = env.ADMIN_USER_ID;
  const adminId = 'super_admin_p3';
  const regularUserId = 'regular_user_p3';
  const workspaceId = 'ws_phase3_test';

  const originalGetUserById = dataService.getUserById;
  const originalListAllSubscriptions = dataService.listAllSubscriptions;
  const originalGetSubscriptionOverviewStats = dataService.getSubscriptionOverviewStats;
  const originalRecordManualPayment = dataService.recordManualPayment;
  const originalListManualPayments = dataService.listManualPayments;

  before(async () => {
    app = await buildApp();
    await app.ready();

    (env as any).ADMIN_USER_ID = adminId;

    dataService.getUserById = async (id: string) => ({
      id,
      email: id === adminId ? 'admin@orviohub.com' : 'user@example.com',
      name: id === adminId ? 'Super Admin' : 'Regular User',
      emailVerified: true,
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as any);
  });

  after(async () => {
    (env as any).ADMIN_USER_ID = originalAdminId;
    dataService.getUserById = originalGetUserById;
    dataService.listAllSubscriptions = originalListAllSubscriptions;
    dataService.getSubscriptionOverviewStats = originalGetSubscriptionOverviewStats;
    dataService.recordManualPayment = originalRecordManualPayment;
    dataService.listManualPayments = originalListManualPayments;
    await app.close();
  });

  test('1. Super admin can list all workspace subscriptions with search & plan filters', async () => {
    dataService.listAllSubscriptions = async (filters) => {
      const mockList = [
        {
          workspaceId: 'ws_1',
          planKey: 'standard',
          status: 'active',
          currentPeriodStart: Date.now() - 10 * 86_400_000,
          currentPeriodEnd: Date.now() + 20 * 86_400_000,
          cancelAtPeriodEnd: false,
          workspaceName: 'Lagos Mega Store',
          workspaceSlug: 'lagos-mega-store',
          ownerName: 'Adeola Johnson',
          ownerEmail: 'adeola@lagosmega.com',
        },
        {
          workspaceId: 'ws_2',
          planKey: 'premium',
          status: 'active',
          currentPeriodStart: Date.now() - 5 * 86_400_000,
          currentPeriodEnd: Date.now() + 25 * 86_400_000,
          cancelAtPeriodEnd: false,
          workspaceName: 'Abuja Super Mart',
          workspaceSlug: 'abuja-super-mart',
          ownerName: 'Chidi Obi',
          ownerEmail: 'chidi@abujamart.com',
        },
      ];

      if (filters?.planKey && filters.planKey !== 'all') {
        return mockList.filter((s) => s.planKey === filters.planKey);
      }
      return mockList;
    };

    const adminToken = app.jwt.sign({ userId: adminId, email: 'admin@orviohub.com' });

    // 1. Fetch all
    const resAll = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/subscriptions',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    assert.strictEqual(resAll.statusCode, 200);
    const bodyAll = resAll.json();
    assert.strictEqual(bodyAll.success, true);
    assert.strictEqual(bodyAll.data.subscriptions.length, 2);

    // 2. Filter by planKey = premium
    const resFiltered = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/subscriptions?planKey=premium',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    assert.strictEqual(resFiltered.statusCode, 200);
    const bodyFiltered = resFiltered.json();
    assert.strictEqual(bodyFiltered.data.subscriptions.length, 1);
    assert.strictEqual(bodyFiltered.data.subscriptions[0].planKey, 'premium');
  });

  test('2. Super admin can fetch platform subscription overview stats and accurate MRR', async () => {
    dataService.getSubscriptionOverviewStats = async () => ({
      totalSubscriptions: 15,
      totalMRRKobo: 12_250_000, // ₦122,500
      totalMRRNaira: 122500,
      expiringSoonCount: 2,
      countsByPlan: {
        free: 10,
        standard: 3,
        premium: 2,
      },
    });

    const adminToken = app.jwt.sign({ userId: adminId, email: 'admin@orviohub.com' });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/subscriptions/stats',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.totalSubscriptions, 15);
    assert.strictEqual(body.data.totalMRRNaira, 122500);
    assert.strictEqual(body.data.expiringSoonCount, 2);
    assert.strictEqual(body.data.countsByPlan.standard, 3);
  });

  test('3. Super admin can record manual offline payment and extend subscription', async () => {
    const paidAtTimestamp = Date.now();
    const expectedExpiry = paidAtTimestamp + 30 * 86_400_000;

    dataService.recordManualPayment = async (data) => ({
      paymentId: 'pay_manual_001',
      workspaceId: data.workspaceId,
      planKey: data.planKey,
      amount: data.amount,
      currentPeriodEnd: expectedExpiry,
      status: 'active',
    });

    const adminToken = app.jwt.sign({ userId: adminId, email: 'admin@orviohub.com' });

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/organizations/${workspaceId}/payments/manual`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        planKey: 'standard',
        amount: 750000, // ₦7,500 in kobo
        currency: 'NGN',
        billingCycle: 'monthly',
        paymentReference: 'GTB-TRX-8291481',
        paymentMethod: 'bank_transfer',
        paidAt: paidAtTimestamp,
        notes: 'Corporate direct transfer confirmed via bank statement',
        extensionDays: 30,
      },
    });

    assert.strictEqual(res.statusCode, 201);
    const body = res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.paymentId, 'pay_manual_001');
    assert.strictEqual(body.data.planKey, 'standard');
    assert.strictEqual(body.data.status, 'active');
  });

  test('4. Super admin can retrieve offline payment history for a workspace', async () => {
    dataService.listManualPayments = async (wsId) => [
      {
        _id: 'pay_manual_001',
        workspaceId: wsId,
        planKey: 'standard',
        amount: 750000,
        currency: 'NGN',
        billingCycle: 'monthly',
        paymentReference: 'GTB-TRX-8291481',
        paymentMethod: 'bank_transfer',
        paidAt: Date.now() - 86_400_000,
        recordedBy: adminId,
        recordedByName: 'Super Admin',
        notes: 'Bank transfer verified',
        createdAt: Date.now() - 86_400_000,
      },
    ];

    const adminToken = app.jwt.sign({ userId: adminId, email: 'admin@orviohub.com' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/organizations/${workspaceId}/payments/manual`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.payments.length, 1);
    assert.strictEqual(body.data.payments[0].paymentReference, 'GTB-TRX-8291481');
    assert.strictEqual(body.data.payments[0].amount, 750000);
  });

  test('5. Non-admin user is rejected from admin subscription endpoints (403 Forbidden)', async () => {
    const userToken = app.jwt.sign({ userId: regularUserId, email: 'user@example.com' });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/subscriptions',
      headers: { authorization: `Bearer ${userToken}` },
    });

    assert.strictEqual(res.statusCode, 403);
    const body = res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'PERMISSION_DENIED');
  });
});
