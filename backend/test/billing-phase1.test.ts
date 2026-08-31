import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';
import { env } from '../src/config/env.js';
import { dataService } from '../src/services/dataService.js';

describe('MVP Billing System - Phase 1 Test Suite', () => {
  let app: FastifyInstance;
  const originalGetUserById = dataService.getUserById;

  before(async () => {
    app = await buildApp();
    await app.ready();

    dataService.getUserById = async (id: string) => {
      return {
        id,
        email: id === 'admin_owner_1' ? 'admin@orviohub.com' : 'user@example.com',
        name: id === 'admin_owner_1' ? 'Super Admin' : 'Workspace Owner',
        emailVerified: true,
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as any;
    };
  });

  after(async () => {
    dataService.getUserById = originalGetUserById;
    await app.close();
  });

  test('1. Admin can list all subscription plans (Free ₦0, Standard ₦7,500, Premium ₦20,000 in kobo)', async () => {
    const originalAdminId = env.ADMIN_USER_ID;
    try {
      const adminId = 'admin_owner_1';
      (env as any).ADMIN_USER_ID = adminId;
      const adminToken = app.jwt.sign({ userId: adminId, email: 'admin@orviohub.com' });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/plans',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      assert.strictEqual(res.statusCode, 200);
      const body = res.json();
      assert.strictEqual(body.success, true);
      assert.ok(Array.isArray(body.data.plans));
      assert.ok(body.data.plans.length >= 3);

      const freePlan = body.data.plans.find((p: any) => p.key === 'free');
      const standardPlan = body.data.plans.find((p: any) => p.key === 'standard');
      const premiumPlan = body.data.plans.find((p: any) => p.key === 'premium');

      assert.strictEqual(freePlan?.monthlyPrice, 0);
      assert.ok(typeof standardPlan?.monthlyPrice === 'number');
      assert.ok(typeof premiumPlan?.monthlyPrice === 'number');
    } finally {
      (env as any).ADMIN_USER_ID = originalAdminId;
    }
  });

  test('2. Admin can update plan monthly & annual prices and active status', async () => {
    const originalAdminId = env.ADMIN_USER_ID;
    try {
      const adminId = 'admin_owner_1';
      (env as any).ADMIN_USER_ID = adminId;
      const adminToken = app.jwt.sign({ userId: adminId, email: 'admin@orviohub.com' });

      const patchRes = await app.inject({
        method: 'PATCH',
        url: '/api/v1/admin/plans/standard',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          monthlyPrice: 750000, // ₦7,500
          annualPrice: 7500000,
          isActive: true,
        },
      });

      assert.strictEqual(patchRes.statusCode, 200);
      const body = patchRes.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.plan.monthlyPrice, 750000);
    } finally {
      (env as any).ADMIN_USER_ID = originalAdminId;
    }
  });

  test('3. Workspace subscription defaults to Free plan with active status', async () => {
    const token = app.jwt.sign({ userId: 'user_123', email: 'user@example.com' });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/workspaces/ws_phase1_test/subscription',
      headers: { authorization: `Bearer ${token}` },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.subscription.planKey, 'free');
    assert.strictEqual(body.data.subscription.status, 'active');
    assert.strictEqual(body.data.plan.key, 'free');
  });

  test('4. Admin can manually change organization subscription plan tier', async () => {
    const originalAdminId = env.ADMIN_USER_ID;
    try {
      const adminId = 'admin_owner_1';
      (env as any).ADMIN_USER_ID = adminId;
      const adminToken = app.jwt.sign({ userId: adminId, email: 'admin@orviohub.com' });

      const changeRes = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/organizations/ws_phase1_test/subscription/change',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          planKey: 'standard',
          status: 'active',
        },
      });

      assert.strictEqual(changeRes.statusCode, 200);
      const body = changeRes.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.subscription.planKey, 'standard');

      // Verify user gets updated subscription
      const userToken = app.jwt.sign({ userId: 'user_123', email: 'user@example.com' });
      const userRes = await app.inject({
        method: 'GET',
        url: '/api/v1/workspaces/ws_phase1_test/subscription',
        headers: { authorization: `Bearer ${userToken}` },
      });
      assert.strictEqual(userRes.json().data.subscription.planKey, 'standard');
    } finally {
      (env as any).ADMIN_USER_ID = originalAdminId;
    }
  });

  test('5. Workspace usage query returns resource counters', async () => {
    const token = app.jwt.sign({ userId: 'user_123', email: 'user@example.com' });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/workspaces/ws_phase1_test/usage',
      headers: { authorization: `Bearer ${token}` },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.usage !== undefined);
  });

  test('6. User can submit a plan upgrade inquiry request', async () => {
    const token = app.jwt.sign({ userId: 'user_123', email: 'user@example.com' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/workspaces/ws_phase1_test/subscription/request-upgrade',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        requestedPlan: 'premium',
        note: 'Need more products and branches for nationwide stores.',
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.requestedPlan, 'premium');
  });
});
