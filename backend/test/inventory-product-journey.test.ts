import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { dataService } from '../src/services/dataService.js';
import type { FastifyInstance } from 'fastify';

describe('Inventory First-Product Journey & POS Telemetry Test Suite', () => {
  let app: FastifyInstance;
  let userToken: string;
  let userId: string;
  let workspaceId: string;

  let seededProductIds: string[] = [];
  let testProductId: string;

  before(async () => {
    app = await buildApp();
    await app.ready();

    const timestamp = Date.now();
    const email = `inventory_owner_${timestamp}@store-test.com`;

    const { user } = await dataService.createUser({
      name: 'Store Owner',
      email,
      password: 'Password123!',
      emailVerified: true,
    });
    userId = user.id;

    const session = await dataService.createSession(user.id, {
      userAgent: 'Mozilla/5.0 Chrome/120.0',
      ipAddress: '127.0.0.1',
      authenticationMethod: 'password',
      tokenVersion: user.tokenVersion ?? 1,
    });

    userToken = app.jwt.sign({
      userId: user.id,
      email: user.email,
      sessionId: session.sessionId,
      tokenVersion: user.tokenVersion ?? 1,
    });

    // Create Workspace without subdomain
    const wsRes = await app.inject({
      method: 'POST',
      url: '/api/v1/workspaces',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        name: 'Apex Supermarket',
        slug: `apex-supermarket-${timestamp}`,
        type: 'RETAIL',
        currency: 'NGN',
        country: 'NG',
        city: 'Lagos',
        initialProduct: 'inventory',
      },
    });

    const wsBody = JSON.parse(wsRes.payload);
    workspaceId = wsBody.data.workspace.id;
  });

  after(async () => {
    await app.close();
  });

  test('1. POST /api/v1/inventory/products/seed-samples seeds sample catalog for groceries sector', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/inventory/products/seed-samples',
      headers: {
        authorization: `Bearer ${userToken}`,
        'x-workspace-id': workspaceId,
      },
      payload: { sector: 'groceries' },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.success, true);
    assert.ok(body.data.createdCount >= 3);
    seededProductIds = body.data.productIds;
  });

  test('2. POST /api/v1/inventory/products adds a custom inventory item with initial stock', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/inventory/products',
      headers: {
        authorization: `Bearer ${userToken}`,
        'x-workspace-id': workspaceId,
      },
      payload: {
        sku: 'CUST-001',
        name: 'Sparkling Mineral Water 750ml',
        category: 'Beverages',
        costPrice: 500,
        sellingPrice: 1200,
        stockQuantity: 100,
        minStockLevel: 10,
        unit: 'bottle',
      },
    });

    assert.strictEqual(res.statusCode, 201);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.success, true);
    assert.ok(body.data.productId);
    testProductId = body.data.productId;
  });

  test('3. GET /api/v1/inventory/products lists all catalog items for the workspace', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/inventory/products',
      headers: {
        authorization: `Bearer ${userToken}`,
        'x-workspace-id': workspaceId,
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.success, true);
    assert.ok(body.data.products.length >= 4);

    const custProduct = body.data.products.find((p: any) => p.sku === 'CUST-001');
    assert.ok(custProduct);
    assert.strictEqual(custProduct.stockQuantity, 100);
  });

  test('4. POST /api/v1/inventory/sales executes sale, decrements stock atomically, and creates receipt', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/inventory/sales',
      headers: {
        authorization: `Bearer ${userToken}`,
        'x-workspace-id': workspaceId,
      },
      payload: {
        items: [{ productId: testProductId, quantity: 5 }],
        paymentMethod: 'CASH',
        customerName: 'Amina Bello',
        notes: 'First guided trial transaction',
      },
    });

    assert.strictEqual(res.statusCode, 201);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.sale.totalAmount, 6000); // 5 x 1200
    assert.ok(body.data.sale.saleNumber.startsWith('ORD-'));
    assert.ok(body.data.sale.receiptNumber.startsWith('RCP-'));

    // Verify stock decremented from 100 to 95
    const productsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/inventory/products',
      headers: {
        authorization: `Bearer ${userToken}`,
        'x-workspace-id': workspaceId,
      },
    });
    const productsBody = JSON.parse(productsRes.payload);
    const updated = productsBody.data.products.find((p: any) => p.sku === 'CUST-001');
    assert.strictEqual(updated.stockQuantity, 95);
  });

  test('5. POST /api/v1/inventory/sales fails if requested quantity exceeds available stock', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/inventory/sales',
      headers: {
        authorization: `Bearer ${userToken}`,
        'x-workspace-id': workspaceId,
      },
      payload: {
        items: [{ productId: testProductId, quantity: 9999 }], // Exceeds available 95
        paymentMethod: 'CASH',
      },
    });

    assert.strictEqual(res.statusCode, 400);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'INSUFFICIENT_STOCK');
  });

  test('6. GET /api/v1/inventory/dashboard returns real-time sales telemetry, stock value, and recent receipts', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/inventory/dashboard',
      headers: {
        authorization: `Bearer ${userToken}`,
        'x-workspace-id': workspaceId,
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.success, true);
    assert.ok(body.data.metrics.totalRevenue >= 6000);
    assert.strictEqual(body.data.metrics.totalSalesCount, 1);
    assert.ok(body.data.metrics.totalProducts >= 4);
    assert.strictEqual(body.data.metrics.recentSales.length, 1);
    assert.strictEqual(body.data.metrics.recentSales[0].customerName, 'Amina Bello');
  });
});
