import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';
import { dataService } from '../src/services/dataService.js';

describe('Paystack & Flutterwave Billing Integration Test Suite', () => {
  let app: FastifyInstance;
  const originalGetUserById = dataService.getUserById;

  const testUserId = 'test_owner_user_1';
  const testWorkspaceId = 'test_ws_ngn_123';
  let userToken: string;

  before(async () => {
    app = await buildApp();
    await app.ready();

    dataService.getUserById = async (id: string) => {
      return {
        id,
        email: 'founder@store.ng',
        name: 'Nigerian Founder',
        emailVerified: true,
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as any;
    };

    userToken = app.jwt.sign({
      userId: testUserId,
      email: 'founder@store.ng',
    });
  });

  after(async () => {
    dataService.getUserById = originalGetUserById;
    await app.close();
  });

  test('1. Public GET /api/v1/plans returns all active plans in Nigerian Naira / kobo', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/plans',
    });

    assert.strictEqual(res.statusCode, 200);
    const body = res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length >= 3);

    const standard = body.data.find((p: any) => p.key === 'standard');
    assert.ok(standard);
    assert.strictEqual(standard.currency, 'NGN');
    assert.strictEqual(standard.monthlyPrice, 750000); // ₦7,500
  });

  test('2. POST /api/v1/billing/initialize with Paystack returns authorization URL and reference', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/initialize',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        workspaceId: testWorkspaceId,
        planKey: 'standard',
        billingCycle: 'monthly',
        gateway: 'paystack',
        callbackUrl: 'http://localhost:5173/billing/callback',
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.gateway, 'paystack');
    assert.ok(body.data.checkoutUrl);
    assert.ok(body.data.reference.startsWith('orv_pst_'));
    assert.strictEqual(body.data.amount, 7500); // ₦7,500
    assert.strictEqual(body.data.amountInKobo, 750000);
    assert.strictEqual(body.data.currency, 'NGN');
  });

  test('3. POST /api/v1/billing/initialize with Flutterwave returns checkout link and tx_ref', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/initialize',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        workspaceId: testWorkspaceId,
        planKey: 'premium',
        billingCycle: 'annual',
        gateway: 'flutterwave',
        callbackUrl: 'http://localhost:5173/billing/callback',
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.gateway, 'flutterwave');
    assert.ok(body.data.checkoutUrl);
    assert.ok(body.data.reference.startsWith('orv_flw_'));
    assert.strictEqual(body.data.amount, 200000); // ₦200,000 / year
    assert.strictEqual(body.data.currency, 'NGN');
  });

  test('4. GET /api/v1/billing/verify verifies Paystack transaction and upgrades subscription', async () => {
    const reference = `orv_pst_test_${Date.now()}`;

    // First initiate
    await dataService.recordInitiatedTransaction({
      workspaceId: testWorkspaceId,
      planKey: 'standard',
      amount: 750000,
      currency: 'NGN',
      billingCycle: 'monthly',
      gateway: 'paystack',
      gatewayReference: reference,
      customerEmail: 'founder@store.ng',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/billing/verify?reference=${reference}&gateway=paystack`,
      headers: { authorization: `Bearer ${userToken}` },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.gateway, 'paystack');
    assert.strictEqual(body.data.status, 'success');
  });

  test('5. POST /api/v1/webhooks/paystack processes charge.success event idempotently', async () => {
    const reference = `orv_pst_webhook_${Date.now()}`;

    await dataService.recordInitiatedTransaction({
      workspaceId: testWorkspaceId,
      planKey: 'premium',
      amount: 2000000,
      currency: 'NGN',
      billingCycle: 'monthly',
      gateway: 'paystack',
      gatewayReference: reference,
      customerEmail: 'founder@store.ng',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/paystack',
      headers: {
        'content-type': 'application/json',
      },
      payload: {
        event: 'charge.success',
        data: {
          reference,
          amount: 2000000,
          currency: 'NGN',
          channel: 'card',
          paid_at: new Date().toISOString(),
          customer: { email: 'founder@store.ng' },
        },
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = res.json();
    assert.strictEqual(body.status, 'success');
  });

  test('6. POST /api/v1/webhooks/flutterwave processes charge.completed event', async () => {
    const txRef = `orv_flw_webhook_${Date.now()}`;

    await dataService.recordInitiatedTransaction({
      workspaceId: testWorkspaceId,
      planKey: 'standard',
      amount: 750000,
      currency: 'NGN',
      billingCycle: 'monthly',
      gateway: 'flutterwave',
      gatewayReference: txRef,
      customerEmail: 'founder@store.ng',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/flutterwave',
      headers: {
        'content-type': 'application/json',
      },
      payload: {
        event: 'charge.completed',
        data: {
          tx_ref: txRef,
          flw_ref: `FLW-MOCK-${Date.now()}`,
          amount: 7500,
          currency: 'NGN',
          status: 'successful',
          payment_type: 'card',
        },
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = res.json();
    assert.strictEqual(body.status, 'success');
  });
});
