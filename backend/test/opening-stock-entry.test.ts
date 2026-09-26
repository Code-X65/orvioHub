import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';

describe('Opening Stock Entry (Standalone) Test Suite', () => {
  let app: FastifyInstance;
  let userToken: string;
  let userId: string;
  let orgId: string;
  let branchId: string;
  let product1Id: string;
  let product2Id: string;

  before(async () => {
    app = await buildApp();
    await app.ready();

    // 1. Sign up user
    const userEmail = `stock_test_${Date.now()}@acme.com`;
    const signupRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: {
        email: userEmail,
        password: 'Password123!',
        name: 'Stock Manager',
      },
    });
    const signupBody = JSON.parse(signupRes.body);
    userId = signupBody.data.user.id;

    // Verify email
    const { dataService } = await import('../src/services/dataService.js');
    const rawUser = await dataService.getUserByEmail(userEmail);
    if (rawUser?.emailVerificationToken) {
      await app.inject({
        method: 'GET',
        url: `/api/v1/auth/verify-email?token=${rawUser.emailVerificationToken}&email=${encodeURIComponent(userEmail)}`,
      });
    }

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: userEmail,
        password: 'Password123!',
      },
    });
    const loginBody = JSON.parse(loginRes.body);
    userToken = loginBody.data.token;

    // 2. Create organization with inventory module
    const orgRes = await app.inject({
      method: 'POST',
      url: '/api/v1/organizations',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        name: 'Prime Retail Hub',
        currency: 'NGN',
        country: 'Nigeria',
      },
    });
    const orgBody = JSON.parse(orgRes.body);
    orgId = orgBody.data?.organization?.id || orgBody.data?.id || orgBody.organization?.id;

    // Select inventory module
    await app.inject({
      method: 'POST',
      url: '/api/v1/onboarding/modules',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        organizationId: orgId,
        modules: ['inventory'],
      },
    });

    // 3. Create primary branch
    const branchRes = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/branches/auto-main`,
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        name: 'Prime Retail Main',
      },
    });
    const branchBody = JSON.parse(branchRes.body);
    branchId = branchBody.branchId || branchBody.branch?.id || branchBody.branch?._id;

    // 4. Create products in catalog
    const p1Res = await app.inject({
      method: 'POST',
      url: '/api/v1/inventory/products',
      headers: {
        authorization: `Bearer ${userToken}`,
        'x-workspace-id': orgId,
      },
      payload: {
        sku: `PEAK-${Date.now()}`,
        name: 'Peak Evaporated Milk 160g',
        category: 'Dairy',
        costPrice: 450,
        sellingPrice: 600,
        stockQuantity: 0, // initially 0
        minStockLevel: 10,
        unit: 'tin',
      },
    });
    const p1Body = JSON.parse(p1Res.body);
    product1Id = p1Body.data.productId;

    const p2Res = await app.inject({
      method: 'POST',
      url: '/api/v1/inventory/products',
      headers: {
        authorization: `Bearer ${userToken}`,
        'x-workspace-id': orgId,
      },
      payload: {
        sku: `MILO-${Date.now()}`,
        name: 'Nestle Milo Tin 500g',
        category: 'Beverages',
        costPrice: 3200,
        sellingPrice: 4000,
        stockQuantity: 0,
        minStockLevel: 5,
        unit: 'tin',
      },
    });
    const p2Body = JSON.parse(p2Res.body);
    product2Id = p2Body.data.productId;
  });

  after(async () => {
    await app.close();
  });

  test('1. GET /api/v1/inventory/opening-stock returns products ready for opening stock entry', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/inventory/opening-stock?branchId=${branchId}`,
      headers: {
        authorization: `Bearer ${userToken}`,
        'x-workspace-id': orgId,
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data.products));
    assert.ok(body.data.totalProducts >= 2);

    const p1 = body.data.products.find((p: any) => p.productId === product1Id);
    assert.ok(p1);
    assert.equal(p1.currentStock, 0);
  });

  test('2. POST /api/v1/inventory/opening-stock records opening stock movements and updates stock balances', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/inventory/opening-stock',
      headers: {
        authorization: `Bearer ${userToken}`,
        'x-workspace-id': orgId,
      },
      payload: {
        branchId,
        entries: [
          {
            productId: product1Id,
            quantity: 50,
            unitCost: 450,
            totalCost: 22500,
            notes: 'Shelf A1 Initial Count',
          },
          {
            productId: product2Id,
            quantity: 20,
            unitCost: 3200,
            totalCost: 64000,
            notes: 'Shelf B2 Initial Count',
          },
        ],
        notes: 'Initial Onboarding Opening Stock',
      },
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.body);
    assert.equal(body.success, true);
    assert.equal(body.data.recordedCount, 2);
    assert.equal(body.data.totalQuantity, 70);
    assert.equal(body.data.totalValuation, 86500);

    // Verify products have updated stockQuantity
    const prodRes = await app.inject({
      method: 'GET',
      url: '/api/v1/inventory/products',
      headers: {
        authorization: `Bearer ${userToken}`,
        'x-workspace-id': orgId,
      },
    });
    const prods = JSON.parse(prodRes.body).data.products;
    const p1 = prods.find((p: any) => p._id === product1Id || p.id === product1Id);
    const p2 = prods.find((p: any) => p._id === product2Id || p.id === product2Id);

    assert.equal(p1.stockQuantity, 50);
    assert.equal(p2.stockQuantity, 20);
  });

  test('3. GET /api/v1/inventory/stock-movements filters by movementType = "opening_stock"', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/inventory/stock-movements?movementType=opening_stock&branchId=${branchId}`,
      headers: {
        authorization: `Bearer ${userToken}`,
        'x-workspace-id': orgId,
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data.movements));
    assert.ok(body.data.movements.length >= 2);

    const mov1 = body.data.movements.find((m: any) => m.productId === product1Id);
    assert.ok(mov1);
    assert.equal(mov1.quantity, 50);
    assert.equal(mov1.unitCost, 450);
    assert.equal(mov1.totalCost, 22500);
    assert.equal(mov1.movementType, 'opening_stock');
    assert.equal(mov1.referenceType, 'onboarding');
  });

  test('4. POST /api/v1/onboarding/inventory/complete-step marks opening_stock_entry as completed', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/onboarding/inventory/complete-step',
      headers: {
        authorization: `Bearer ${userToken}`,
        'x-workspace-id': orgId,
      },
      payload: {
        step: 'opening_stock_entry',
        workspaceId: orgId,
        metadata: {
          productsCount: 2,
          totalQuantity: 70,
          branchId,
        },
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.success, true);
    assert.equal(body.data.step, 'opening_stock_entry');
    assert.equal(body.data.completed, true);
  });

  test('5. POST /api/v1/onboarding/inventory/skip-step skips opening_stock_entry gracefully', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/onboarding/inventory/skip-step',
      headers: {
        authorization: `Bearer ${userToken}`,
        'x-workspace-id': orgId,
      },
      payload: {
        step: 'opening_stock_entry',
        workspaceId: orgId,
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.success, true);
    assert.equal(body.data.step, 'opening_stock_entry');
    assert.equal(body.data.skipped, true);
  });

  test('6. POST /api/v1/inventory/opening-stock rejects empty entries array with 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/inventory/opening-stock',
      headers: {
        authorization: `Bearer ${userToken}`,
        'x-workspace-id': orgId,
      },
      payload: {
        entries: [],
      },
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.equal(body.success, false);
  });
});
