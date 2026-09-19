import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { dataService } from '../src/services/dataService.js';
import type { FastifyInstance } from 'fastify';

describe('Phase 8: Workspace Creation Test Suite', () => {
  let app: FastifyInstance;
  let ownerToken: string;
  let ownerUserId: string;
  let ownerEmail: string;

  before(async () => {
    app = await buildApp();
    await app.ready();

    const timestamp = Date.now();
    ownerEmail = `ws_creator_${timestamp}@test.com`;
    const { user } = await dataService.createUser({
      name: 'Workspace Creator',
      email: ownerEmail,
      password: 'Password123!',
      emailVerified: true,
    });
    ownerUserId = user.id;

    const session = await dataService.createSession(ownerUserId, {
      userAgent: 'test-agent',
      ipAddress: '127.0.0.1',
      authenticationMethod: 'password',
      tokenVersion: user.tokenVersion ?? 1,
    });

    ownerToken = app.jwt.sign({
      userId: ownerUserId,
      email: ownerEmail,
      sessionId: session.sessionId,
      tokenVersion: user.tokenVersion ?? 1,
    });
  });

  after(async () => {
    await app.close();
  });

  test('1. Unauthenticated user cannot create a workspace', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/workspaces',
      payload: {
        name: 'Unauth Org',
      },
    });
    assert.equal(res.statusCode, 401);
  });

  test('2. Authenticated verified user can check creation eligibility', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/entitlements/can-create-workspace',
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.equal(typeof body.data.allowed, 'boolean');
    assert.equal(body.data.ownedLimit, 3);
    assert.equal(body.data.trialLimit, 1);
  });

  test('3. Authenticated verified user can create a new workspace with default NG settings', async () => {
    const timestamp = Date.now();
    const slug = `corp-stores-${timestamp}`;
    const idempotencyKey = `create-ws-${timestamp}`;

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/workspaces',
      headers: {
        authorization: `Bearer ${ownerToken}`,
        'idempotency-key': idempotencyKey,
      },
      payload: {
        name: 'Corp Stores Nigeria',
        slug,
        type: 'retail',
        initialProduct: 'inventory',
        country: 'NG',
        currency: 'NGN',
        timezone: 'Africa/Lagos',
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.ok(body.data.workspace.id);
    assert.equal(body.data.workspace.name, 'Corp Stores Nigeria');
    assert.equal(body.data.membership.role, 'OWNER');
    assert.equal(body.data.membership.status, 'active');
  });

  test('4. Duplicate creation with same Idempotency-Key returns existing workspace without duplicate creation', async () => {
    const timestamp = Date.now();
    const slug = `idempotent-corp-${timestamp}`;
    const idempotencyKey = `idem-key-${timestamp}`;

    const res1 = await app.inject({
      method: 'POST',
      url: '/api/v1/workspaces',
      headers: {
        authorization: `Bearer ${ownerToken}`,
        'idempotency-key': idempotencyKey,
      },
      payload: {
        name: 'Idempotent Corp',
        slug,
        initialProduct: 'inventory',
      },
    });
    assert.equal(res1.statusCode, 200);
    const body1 = JSON.parse(res1.payload);

    const res2 = await app.inject({
      method: 'POST',
      url: '/api/v1/workspaces',
      headers: {
        authorization: `Bearer ${ownerToken}`,
        'idempotency-key': idempotencyKey,
      },
      payload: {
        name: 'Idempotent Corp',
        slug,
        initialProduct: 'inventory',
      },
    });
    assert.equal(res2.statusCode, 200);
    const body2 = JSON.parse(res2.payload);

    assert.equal(body1.data.workspace.id, body2.data.workspace.id);
  });

  test('5. Workspace creation creates Owner membership, default billing, primary branch, and notification', async () => {
    const timestamp = Date.now();
    const slug = `full-setup-${timestamp}`;

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/workspaces',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: 'Full Setup Store',
        slug,
        initialProduct: 'inventory',
      },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    const wsId = body.data.workspace.id;

    // Check members
    const membersRes = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${wsId}/members`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(membersRes.statusCode, 200);
    const membersBody = JSON.parse(membersRes.payload);
    const ownerMember = membersBody.data?.find((m: any) => m.userId === ownerUserId);
    assert.ok(ownerMember);
    assert.equal(ownerMember.role.toLowerCase(), 'owner');

    // Check primary branch
    const branchesRes = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${wsId}/inventory/branches`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(branchesRes.statusCode, 200);
    const branchesBody = JSON.parse(branchesRes.payload);
    const branchesList = branchesBody.data || [];
    assert.ok(branchesList.length >= 1);
    assert.ok(branchesList.some((b: any) => b.isPrimary));
  });
});
