import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';
import { dataService } from '../src/services/dataService.js';
import { entitlementService } from '../src/services/entitlementService.js';

describe('MVP Billing System - Phase 4 Usage Tracking & Limit Warnings Test Suite', () => {
  let app: FastifyInstance;
  const userId = 'user_p4_tester';
  const workspaceId = 'ws_phase4_test';
  let token: string;

  const originalGetUserById = dataService.getUserById;
  const originalGetWorkspaceSubscription = dataService.getWorkspaceSubscription;
  const originalGetInventoryProducts = dataService.getInventoryProducts;
  const originalCountActiveWorkspaceProducts = dataService.countActiveWorkspaceProducts;
  const originalGetWorkspaceMembers = dataService.getWorkspaceMembers;
  const originalGetWorkspaceUsage = dataService.getWorkspaceUsage;
  const originalGetUserWorkspaces = dataService.getUserWorkspaces;
  const originalLogAudit = dataService.logAudit;

  before(async () => {
    app = await buildApp();
    await app.ready();

    token = app.jwt.sign({
      userId,
      email: 'user_p4@example.com',
    });

    dataService.getUserById = async (id: string) => ({
      id,
      email: 'user_p4@example.com',
      name: 'P4 User',
      emailVerified: true,
      status: 'active',
      tokenVersion: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as any);

    dataService.logAudit = async () => ({} as any);
  });

  after(async () => {
    dataService.getUserById = originalGetUserById;
    dataService.getWorkspaceSubscription = originalGetWorkspaceSubscription;
    dataService.getInventoryProducts = originalGetInventoryProducts;
    dataService.countActiveWorkspaceProducts = originalCountActiveWorkspaceProducts;
    dataService.getWorkspaceMembers = originalGetWorkspaceMembers;
    dataService.getWorkspaceUsage = originalGetWorkspaceUsage;
    dataService.getUserWorkspaces = originalGetUserWorkspaces;
    dataService.logAudit = originalLogAudit;
    await app.close();
  });

  test('1. Workspace usage summary computes live capacity percentages for all 5 resources', async () => {
    // Subscription is Standard
    dataService.getWorkspaceSubscription = async () => ({
      workspaceId,
      planKey: 'standard',
      status: 'active',
      currentPeriodStart: Date.now(),
      currentPeriodEnd: Date.now() + 30 * 86_400_000,
      cancelAtPeriodEnd: false,
    });
    dataService.getUserWorkspaces = async () => [
      { workspace: { id: workspaceId }, role: 'owner', isOwner: true } as any,
    ];
    dataService.countActiveWorkspaceProducts = async () => 1;
    dataService.getWorkspaceMembers = async () => [{ id: 'm1', role: 'owner' }] as any[];
    dataService.getInventoryProducts = async () => new Array(2500).fill({ id: 'p' }) as any[];
    dataService.getWorkspaceUsage = async () => ({
      workspaceId,
      counters: { transactionsCount: 1000, productsCount: 2500, membersCount: 1, appsCount: 1 },
      records: [],
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${workspaceId}/usage/summary`,
      headers: { authorization: `Bearer ${token}` },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.planKey, 'standard');
    assert.strictEqual(body.data.metrics.products.current, 2500);
    assert.strictEqual(body.data.metrics.products.limit, 5000);
    assert.strictEqual(body.data.metrics.products.percent, 50);
    assert.strictEqual(body.data.metrics.transactions.percent, 20); // 1000 of 5000
    assert.strictEqual(body.data.hasApproachingLimits, false);
    assert.strictEqual(body.data.hasExceededLimits, false);
  });

  test('2. Workspace approaching 80% product limit returns hasApproachingLimits=true and warningMessage', async () => {
    dataService.getWorkspaceSubscription = async () => ({
      workspaceId,
      planKey: 'free',
      status: 'active',
      currentPeriodStart: Date.now(),
      currentPeriodEnd: Date.now() + 30 * 86_400_000,
      cancelAtPeriodEnd: false,
    });
    // 425 products out of 500 (85%)
    dataService.getInventoryProducts = async () => new Array(425).fill({ id: 'p' }) as any[];
    dataService.countActiveWorkspaceProducts = async () => 1;
    dataService.getWorkspaceMembers = async () => [{ id: 'm1' }] as any[];
    dataService.getWorkspaceUsage = async () => ({
      workspaceId,
      counters: { transactionsCount: 10, productsCount: 425, membersCount: 1, appsCount: 1 },
      records: [],
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${workspaceId}/usage/summary`,
      headers: { authorization: `Bearer ${token}` },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = res.json();
    assert.strictEqual(body.data.metrics.products.percent, 85);
    assert.strictEqual(body.data.metrics.products.isApproaching, true);
    assert.strictEqual(body.data.hasApproachingLimits, true);
    assert.ok(body.data.warningMessage.includes('85% of your product quota'));
  });

  test('3. Workspace reaching 100% capacity returns hasExceededLimits=true and limit-reached warningMessage', async () => {
    dataService.getWorkspaceSubscription = async () => ({
      workspaceId,
      planKey: 'free',
      status: 'active',
      currentPeriodStart: Date.now(),
      currentPeriodEnd: Date.now() + 30 * 86_400_000,
      cancelAtPeriodEnd: false,
    });
    // 500 products out of 500 (100%)
    dataService.getInventoryProducts = async () => new Array(500).fill({ id: 'p' }) as any[];

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${workspaceId}/usage/summary`,
      headers: { authorization: `Bearer ${token}` },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = res.json();
    assert.strictEqual(body.data.metrics.products.percent, 100);
    assert.strictEqual(body.data.metrics.products.isReached, true);
    assert.strictEqual(body.data.hasExceededLimits, true);
    assert.ok(body.data.warningMessage.includes('Product limit reached (500/500)'));
  });

  test('4. Public endpoint GET /billing/payment-details returns official Nigerian bank transfer accounts', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/billing/payment-details',
    });

    assert.strictEqual(res.statusCode, 200);
    const body = res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data.bankAccounts));
    assert.strictEqual(body.data.bankAccounts[0].bankName, 'Guaranty Trust Bank (GTBank)');
    assert.strictEqual(body.data.bankAccounts[0].accountNumber, '0123456789');
    assert.ok(body.data.instructions.includes('Workspace Slug'));
  });

  test('5. Workspace user can submit plan upgrade inquiry with transfer reference', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${workspaceId}/subscription/request-upgrade`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        requestedPlan: 'premium',
        contactMethod: 'in_app',
        note: 'Transfer Ref: GTB-NIP-9921491. Paid ₦20,000 for Premium monthly plan.',
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.requestedPlan, 'premium');
    assert.strictEqual(body.data.supportEmail, 'billing@orviohub.com');
  });
});
