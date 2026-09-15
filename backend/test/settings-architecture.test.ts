import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';

describe('Settings Architecture (End-to-End)', () => {
  let app: FastifyInstance;
  let testUserId: string;
  let testToken: string;
  let testWorkspaceId: string;
  let testBranchId: string;

  before(async () => {
    app = await buildApp();
    await app.ready();

    // Create a test user and login
    const signupRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: {
        email: `settings-test-${Date.now()}@example.com`,
        password: 'Password123!@#',
        name: 'Settings Test Admin',
      },
    });

    const signupData = JSON.parse(signupRes.body);
    testUserId = signupData.data?.user?.id || signupData.user?.id;
    testToken = signupData.data?.token || signupData.token;

    // Create a test workspace / organization
    const wsRes = await app.inject({
      method: 'POST',
      url: '/api/v1/workspaces',
      headers: {
        Authorization: `Bearer ${testToken}`,
      },
      payload: {
        name: 'Settings Enterprise Hub',
        slug: `settings-hub-${Date.now()}`,
        currency: 'NGN',
        timezone: 'Africa/Lagos',
      },
    });

    const wsData = JSON.parse(wsRes.body);
    testWorkspaceId = wsData.data?.workspace?.id || wsData.workspace?.id || wsData.data?.id;

    // Create a test branch
    const branchRes = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${testWorkspaceId}/branches`,
      headers: {
        Authorization: `Bearer ${testToken}`,
      },
      payload: {
        name: 'Victoria Island Flagship',
        code: `VI-${Date.now().toString().slice(-4)}`,
        country: 'Nigeria',
        state: 'Lagos',
        city: 'Lagos',
      },
    });

    const branchData = JSON.parse(branchRes.body);
    testBranchId = branchData.data?.branch?.id || branchData.branch?.id || branchData.data?.id;
  });

  after(async () => {
    await app.close();
  });

  it('1. GET /api/v1/workspaces/:id/settings returns default workspace settings structure', async () => {
    if (!testWorkspaceId) return;

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${testWorkspaceId}/settings`,
      headers: {
        Authorization: `Bearer ${testToken}`,
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.ok(body.data?.settings);
    assert.strictEqual(body.data.settings.currency, 'NGN');
    assert.strictEqual(body.data.settings.timezone, 'Africa/Lagos');
  });

  it('2. PATCH /api/v1/workspaces/:id/settings/general updates workspace general info', async () => {
    if (!testWorkspaceId) return;

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/workspaces/${testWorkspaceId}/settings/general`,
      headers: {
        Authorization: `Bearer ${testToken}`,
      },
      payload: {
        displayName: 'Settings Hub HQ',
        category: 'Retail & POS',
        description: 'Flagship retail network headquarters',
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.settings.displayName, 'Settings Hub HQ');
    assert.strictEqual(body.data.settings.category, 'Retail & POS');
  });

  it('3. PATCH /api/v1/workspaces/:id/settings/address updates structured Nigerian address', async () => {
    if (!testWorkspaceId) return;

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/workspaces/${testWorkspaceId}/settings/address`,
      headers: {
        Authorization: `Bearer ${testToken}`,
      },
      payload: {
        country: 'Nigeria',
        state: 'Lagos',
        city: 'Ikeja',
        addressLine1: 'Block 4, Computer Village Express',
        postalCode: '100001',
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.settings.state, 'Lagos');
    assert.strictEqual(body.data.settings.addressLine1, 'Block 4, Computer Village Express');
  });

  it('4. PATCH /api/v1/workspaces/:id/settings/localization updates currency & date format', async () => {
    if (!testWorkspaceId) return;

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/workspaces/${testWorkspaceId}/settings/localization`,
      headers: {
        Authorization: `Bearer ${testToken}`,
      },
      payload: {
        currency: 'USD',
        dateFormat: 'DD/MM/YYYY',
        weekStartsOn: 'monday',
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.settings.currency, 'USD');
    assert.strictEqual(body.data.settings.dateFormat, 'DD/MM/YYYY');
  });

  it('5. GET /api/v1/workspaces/:id/applications lists available and active applications', async () => {
    if (!testWorkspaceId) return;

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${testWorkspaceId}/applications`,
      headers: {
        Authorization: `Bearer ${testToken}`,
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data.applications));
    assert.ok(body.data.applications.some((a: any) => a.key === 'inventory'));
  });

  it('6. PATCH /api/v1/workspaces/:id/applications/inventory/settings updates inventory product and stock rules', async () => {
    if (!testWorkspaceId) return;

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/workspaces/${testWorkspaceId}/applications/inventory/settings`,
      headers: {
        Authorization: `Bearer ${testToken}`,
      },
      payload: {
        settings: {
          productConfig: {
            skuPrefix: 'TECH',
            autoGenerateSku: true,
            enableBarcodes: true,
          },
          stockRules: {
            negativeStockAllowed: true,
            lowStockThreshold: 15,
            costingMethod: 'WEIGHTED_AVERAGE',
          },
        },
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.application.settings.productConfig.skuPrefix, 'TECH');
    assert.strictEqual(body.data.application.settings.stockRules.lowStockThreshold, 15);
  });

  it('7. PATCH /api/v1/workspaces/:id/branches/:branchId/settings updates branch opening hours and operational rules', async () => {
    if (!testWorkspaceId || !testBranchId) return;

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/workspaces/${testWorkspaceId}/branches/${testBranchId}/settings`,
      headers: {
        Authorization: `Bearer ${testToken}`,
      },
      payload: {
        lowStockThreshold: 8,
        negativeStockAllowed: false,
        receiptFooter: 'Thank you for visiting Victoria Island Branch!',
        openingHours: {
          monday: { open: '09:00', close: '20:00', closed: false },
          sunday: { open: '12:00', close: '18:00', closed: false },
        },
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.branch.lowStockThreshold, 8);
    assert.strictEqual(body.data.branch.receiptFooter, 'Thank you for visiting Victoria Island Branch!');
  });
});
