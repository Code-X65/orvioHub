import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { dataService } from '../src/services/dataService.js';
import type { FastifyInstance } from 'fastify';

describe('Inventory Onboarding: First Sale Tutorial Gap Suite', () => {
  let app: FastifyInstance;
  let authToken: string;
  let userId: string;
  let workspaceId: string;
  let productId: string;

  before(async () => {
    app = await buildApp();
    await app.ready();

    // 1. Create a merchant user
    const timestamp = Date.now();
    const email = `first_sale_merchant_${timestamp}@store-test.com`;
    const { user } = await dataService.createUser({
      name: 'First Sale Retailer',
      email,
      password: 'Password123!',
      emailVerified: true,
    });
    userId = user.id;

    const session = await dataService.createSession(user.id, {
      userAgent: 'test-agent',
      ipAddress: '127.0.0.1',
      authenticationMethod: 'password',
      tokenVersion: user.tokenVersion ?? 1,
    });

    authToken = app.jwt.sign({
      userId: user.id,
      email: user.email,
      sessionId: session.sessionId,
      tokenVersion: user.tokenVersion ?? 1,
    });

    // 2. Create Workspace
    const wsRes = await app.inject({
      method: 'POST',
      url: '/api/v1/workspaces',
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        name: 'Oshodi Super Store',
        slug: `oshodi-store-${timestamp}`,
        type: 'RETAIL',
        currency: 'NGN',
        country: 'NG',
        city: 'Lagos',
        initialProduct: 'inventory',
      },
    });
    const wsBody = JSON.parse(wsRes.payload);
    workspaceId = wsBody.data.workspace.id;

    // 3. Add a product to inventory
    const prodRes = await app.inject({
      method: 'POST',
      url: '/api/v1/inventory/products',
      headers: {
        authorization: `Bearer ${authToken}`,
        'x-workspace-id': workspaceId,
      },
      payload: {
        sku: 'MILK-PEAK-400',
        name: 'Peak Milk 400g Tin',
        category: 'Beverages',
        costPrice: 2200,
        sellingPrice: 2700,
        stockQuantity: 24,
        minStockLevel: 5,
        unit: 'tin',
      },
    });
    const prodBody = JSON.parse(prodRes.payload);
    productId = prodBody.data.productId;
  });

  after(async () => {
    await app.close();
  });

  test('0. Verify canonical redirect from legacy /v1/* to /api/v1/*', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/onboarding/inventory/start',
      headers: {
        authorization: `Bearer ${authToken}`,
        'x-workspace-id': workspaceId,
      },
      payload: { workspaceId },
    });
    assert.equal(res.statusCode, 308);
    assert.equal(res.headers.location, '/api/v1/onboarding/inventory/start');
  });

  test('1. Start Inventory onboarding flow with first_sale_tutorial support', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/onboarding/inventory/start',
      headers: {
        authorization: `Bearer ${authToken}`,
        'x-workspace-id': workspaceId,
      },
      payload: { workspaceId },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.success, true);
    assert.ok(body.data.flow);
    assert.equal(body.data.flow.workspaceId, workspaceId);
    assert.equal(body.data.flow.productKey, 'inventory');
    assert.equal(body.data.flow.status.toLowerCase(), 'in_progress');
  });

  test('2. Progress to first_sale_tutorial step and persist state', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/onboarding/inventory/progress',
      headers: {
        authorization: `Bearer ${authToken}`,
        'x-workspace-id': workspaceId,
      },
      payload: {
        workspaceId,
        currentStep: 'first_sale_tutorial',
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.success, true);
  });

  test('3. Verification of status endpoint reflecting first_sale_tutorial progress', async () => {
    const statusRes = await app.inject({
      method: 'GET',
      url: `/api/v1/onboarding/inventory/status?workspaceId=${workspaceId}`,
      headers: {
        authorization: `Bearer ${authToken}`,
        'x-workspace-id': workspaceId,
      },
    });

    assert.equal(statusRes.statusCode, 200);
    const statusBody = JSON.parse(statusRes.body);
    assert.equal(statusBody.success, true);
    assert.equal(statusBody.data.currentStep, 'first_sale_tutorial');
    assert.equal(statusBody.data.canResume, true);
  });

  test('4. Cannot complete onboarding before completing or skipping first_sale_tutorial', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/onboarding/inventory/complete',
      headers: {
        authorization: `Bearer ${authToken}`,
        'x-workspace-id': workspaceId,
      },
      payload: { workspaceId },
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.equal(body.success, false);
    assert.equal(body.error?.code, 'STEP_INCOMPLETE');
    assert.match(body.error?.message, /first_sale_tutorial/);
  });

  test('5. Log onboarding.first_sale_failed if sale attempt encounters error', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/onboarding/inventory/first-sale-failed',
      headers: {
        authorization: `Bearer ${authToken}`,
        'x-workspace-id': workspaceId,
      },
      payload: {
        workspaceId,
        error: 'Network connectivity timeout during payment terminal handshake',
        step: 'first_sale_tutorial',
        cartItemCount: 1,
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.success, true);
    assert.equal(body.data.logged, true);
  });

  test('6. Record real tutorial sale through POS with stock reduction and metadata', async () => {
    const saleRes = await app.inject({
      method: 'POST',
      url: '/api/v1/inventory/sales',
      headers: {
        authorization: `Bearer ${authToken}`,
        'x-workspace-id': workspaceId,
      },
      payload: {
        items: [
          {
            productId,
            quantity: 2,
          },
        ],
        paymentMethod: 'USSD',
        customerName: 'Amina Bello (Tutorial Walk-in)',
        metadata: {
          tutorial: true,
          channel: 'guided_onboarding',
        },
      },
    });

    assert.equal(saleRes.statusCode, 201);
    const saleBody = JSON.parse(saleRes.body);
    assert.equal(saleBody.success, true);
    const sale = saleBody.data?.sale || saleBody.data;
    assert.ok(sale.saleId || sale.id);
    assert.ok(sale.totalAmount >= 5400);

    // Verify stock decreased from 24 to 22
    const productsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/inventory/products',
      headers: {
        authorization: `Bearer ${authToken}`,
        'x-workspace-id': workspaceId,
      },
    });
    const productsBody = JSON.parse(productsRes.payload);
    const updated = productsBody.data.products.find((p: any) => p.sku === 'MILK-PEAK-400');
    assert.strictEqual(updated.stockQuantity, 22);

    // 7. Mark first_sale_tutorial step as completed with sale reference
    const completeStepRes = await app.inject({
      method: 'POST',
      url: '/api/v1/onboarding/inventory/complete-step',
      headers: {
        authorization: `Bearer ${authToken}`,
        'x-workspace-id': workspaceId,
      },
      payload: {
        workspaceId,
        step: 'first_sale_tutorial',
        metadata: { saleId: sale.saleId || sale.id },
      },
    });

    assert.equal(completeStepRes.statusCode, 200);
    const completeStepBody = JSON.parse(completeStepRes.body);
    assert.equal(completeStepBody.success, true);

    // Verify status confirms completedSteps contains first_sale_tutorial
    const checkRes = await app.inject({
      method: 'GET',
      url: `/api/v1/onboarding/inventory/status?workspaceId=${workspaceId}`,
      headers: {
        authorization: `Bearer ${authToken}`,
        'x-workspace-id': workspaceId,
      },
    });
    const checkBody = JSON.parse(checkRes.body);
    assert.ok(checkBody.data.completedSteps.includes('first_sale_tutorial'));
  });

  test('8. Complete inventory onboarding successfully after tutorial sale completion', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/onboarding/inventory/complete',
      headers: {
        authorization: `Bearer ${authToken}`,
        'x-workspace-id': workspaceId,
      },
      payload: { workspaceId },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.success, true);
    assert.equal(body.data.completed, true);
  });

  test('9. Skip step flow: workspace can complete onboarding if explicitly skipped', async () => {
    const timestamp = Date.now() + 500;
    // Create second workspace to test skip path
    const ws2Res = await app.inject({
      method: 'POST',
      url: '/api/v1/workspaces',
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        name: 'Ikeja Depot Express',
        slug: `ikeja-depot-${timestamp}`,
        type: 'WHOLESALE',
        currency: 'NGN',
        country: 'NG',
        city: 'Lagos',
        initialProduct: 'inventory',
      },
    });
    const ws2Body = JSON.parse(ws2Res.payload);
    const ws2Id = ws2Body.data.workspace.id;

    // Start flow
    await app.inject({
      method: 'POST',
      url: '/api/v1/onboarding/inventory/start',
      headers: {
        authorization: `Bearer ${authToken}`,
        'x-workspace-id': ws2Id,
      },
      payload: { workspaceId: ws2Id },
    });

    // Skip first_sale_tutorial
    const skipRes = await app.inject({
      method: 'POST',
      url: '/api/v1/onboarding/inventory/skip-step',
      headers: {
        authorization: `Bearer ${authToken}`,
        'x-workspace-id': ws2Id,
      },
      payload: {
        workspaceId: ws2Id,
        step: 'first_sale_tutorial',
      },
    });
    assert.equal(skipRes.statusCode, 200);
    const skipBody = JSON.parse(skipRes.body);
    assert.equal(skipBody.success, true);

    // Verify status confirms skippedSteps contains first_sale_tutorial
    const checkRes = await app.inject({
      method: 'GET',
      url: `/api/v1/onboarding/inventory/status?workspaceId=${ws2Id}`,
      headers: {
        authorization: `Bearer ${authToken}`,
        'x-workspace-id': ws2Id,
      },
    });
    const checkBody = JSON.parse(checkRes.body);
    assert.ok(checkBody.data.skippedSteps.includes('first_sale_tutorial'));

    // Complete onboarding should succeed because step was skipped
    const completeRes = await app.inject({
      method: 'POST',
      url: '/api/v1/onboarding/inventory/complete',
      headers: {
        authorization: `Bearer ${authToken}`,
        'x-workspace-id': ws2Id,
      },
      payload: { workspaceId: ws2Id },
    });
    assert.equal(completeRes.statusCode, 200);
    const completeBody = JSON.parse(completeRes.body);
    assert.equal(completeBody.success, true);
    assert.equal(completeBody.data.completed, true);
  });
});
