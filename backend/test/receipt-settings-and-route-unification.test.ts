import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { dataService } from '../src/services/dataService.js';
import type { FastifyInstance } from 'fastify';

describe('Receipt Settings & Route Unification Test Suite (Gaps 3 & 4)', () => {
  let app: FastifyInstance;
  let authToken: string;
  let workspaceId: string;
  let orgId: string;

  before(async () => {
    app = await buildApp();
    await app.ready();

    // 1. Create a verified user
    const email = `receipt_user_${Date.now()}@example.com`;
    const { user } = await dataService.createUser({
      name: 'Receipt Merchant',
      email,
      password: 'Password123!',
      emailVerified: true,
    });

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

    // Create organization / workspace
    const orgRes = await app.inject({
      method: 'POST',
      url: '/api/v1/organizations',
      headers: {
        authorization: `Bearer ${authToken}`,
      },
      payload: {
        name: 'Lagos Island Retail Mart',
        industry: 'Retail & Supermarket',
        country: 'Nigeria',
        currency: 'NGN',
        timezone: 'Africa/Lagos',
      },
    });
    const orgBody = JSON.parse(orgRes.body);
    orgId = orgBody.data?.organization?.id || orgBody.data?.id;
    workspaceId = orgId;
  });

  after(async () => {
    await app.close();
  });

  test('1. GET /api/v1/workspaces/:id/settings/receipt returns initial default receipt config', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${workspaceId}/settings/receipt`,
      headers: {
        authorization: `Bearer ${authToken}`,
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.success, true);
    assert.ok(body.data.settings);
    assert.equal(body.data.settings.paperWidth, '80mm');
    assert.equal(body.data.settings.vatRate, 7.5);
  });

  test('2. PATCH /api/v1/workspaces/:id/settings/receipt updates receipt customization', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/workspaces/${workspaceId}/settings/receipt`,
      headers: {
        authorization: `Bearer ${authToken}`,
      },
      payload: {
        storeName: 'Lagos Island Mega Mart',
        tagline: 'Best Prices in Lagos',
        footerText: 'Thank you for shopping! Goods in good condition refundable in 3 days.',
        returnPolicy: 'No refunds on perishable goods.',
        tin: '20394857-0001',
        vatRate: 7.5,
        enableVat: true,
        paperWidth: '58mm',
        phone: '+234 802 345 6789',
        address: 'Plot 4, Marina Street, Lagos Island',
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.success, true);
    assert.equal(body.data.settings.storeName, 'Lagos Island Mega Mart');
    assert.equal(body.data.settings.tin, '20394857-0001');
    assert.equal(body.data.settings.paperWidth, '58mm');
    assert.equal(body.data.settings.enableVat, true);
  });

  test('3. Route Parity: GET /api/v1/organizations/:id/settings/receipt and /api/v1/orgs/:id/settings/receipt return identical receipt settings', async () => {
    const orgRes = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${orgId}/settings/receipt`,
      headers: {
        authorization: `Bearer ${authToken}`,
      },
    });
    assert.equal(orgRes.statusCode, 200);
    const orgBody = JSON.parse(orgRes.body);

    const aliasRes = await app.inject({
      method: 'GET',
      url: `/api/v1/orgs/${orgId}/settings/receipt`,
      headers: {
        authorization: `Bearer ${authToken}`,
      },
    });
    assert.equal(aliasRes.statusCode, 200);
    const aliasBody = JSON.parse(aliasRes.body);

    assert.equal(orgBody.data.settings.storeName, 'Lagos Island Mega Mart');
    assert.equal(aliasBody.data.settings.storeName, 'Lagos Island Mega Mart');
    assert.equal(orgBody.data.settings.tin, aliasBody.data.settings.tin);
  });

  test('4. Route Parity: GET /api/v1/workspaces/:id/branches and /api/v1/organizations/:id/branches both succeed', async () => {
    const wsBranchesRes = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${workspaceId}/branches`,
      headers: {
        authorization: `Bearer ${authToken}`,
      },
    });
    assert.equal(wsBranchesRes.statusCode, 200);

    const orgBranchesRes = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${orgId}/branches`,
      headers: {
        authorization: `Bearer ${authToken}`,
      },
    });
    assert.equal(orgBranchesRes.statusCode, 200);
  });
});
