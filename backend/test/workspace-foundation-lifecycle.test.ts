import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { dataService } from '../src/services/dataService.js';
import type { FastifyInstance } from 'fastify';

describe('Authoritative Organization & Workspace Foundation Upgrade Test Suite', () => {
  let app: FastifyInstance;
  let ownerToken: string;
  let ownerId: string;
  let ownerEmail: string;

  let memberToken: string;
  let memberId: string;
  let memberEmail: string;

  let testWorkspaceId: string;

  before(async () => {
    app = await buildApp();
    await app.ready();

    const timestamp = Date.now();

    // 1. Create verified Owner
    ownerEmail = `org_owner_${timestamp}@example.com`;
    const { user: ownerUser } = await dataService.createUser({
      name: 'Workspace Owner',
      email: ownerEmail,
      password: 'Password123!',
      emailVerified: true,
    });
    ownerId = ownerUser.id;
    const ownerSession = await dataService.createSession(ownerId, {
      userAgent: 'test-agent',
      ipAddress: '127.0.0.1',
      authenticationMethod: 'password',
      tokenVersion: ownerUser.tokenVersion ?? 1,
    });
    ownerToken = app.jwt.sign({
      userId: ownerId,
      email: ownerEmail,
      sessionId: ownerSession.sessionId,
      tokenVersion: ownerUser.tokenVersion ?? 1,
    });

    // 2. Create verified Member
    memberEmail = `org_member_${timestamp}@example.com`;
    const { user: memberUser } = await dataService.createUser({
      name: 'Team Member',
      email: memberEmail,
      password: 'Password123!',
      emailVerified: true,
    });
    memberId = memberUser.id;
    const memberSession = await dataService.createSession(memberId, {
      userAgent: 'test-agent',
      ipAddress: '127.0.0.1',
      authenticationMethod: 'password',
      tokenVersion: memberUser.tokenVersion ?? 1,
    });
    memberToken = app.jwt.sign({
      userId: memberId,
      email: memberEmail,
      sessionId: memberSession.sessionId,
      tokenVersion: memberUser.tokenVersion ?? 1,
    });
  });

  after(async () => {
    await app.close();
  });

  test('1. GET /api/v1/entitlements/can-create-workspace returns allowed=true for new user', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/entitlements/can-create-workspace',
      headers: { authorization: `Bearer ${ownerToken}` },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.success, true);
    assert.equal(body.data.allowed, true);
    assert.equal(body.data.limit ?? body.data.ownedLimit, 3);
  });

  test('2. POST /api/v1/workspaces provisions a new workspace with primary branch & inventory foundation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/workspaces',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: 'Apex Retail Stores',
        type: 'retail',
        currency: 'NGN',
        country: 'NG',
        state: 'Lagos',
        city: 'Ikeja',
        phone: '+2348012345678',
        initialProduct: 'inventory',
      },
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.body);
    assert.equal(body.success, true);
    assert.ok(body.data.workspace.id);
    testWorkspaceId = body.data.workspace.id;
  });

  test('3. GET /api/v1/workspaces lists user workspaces with owner role', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/workspaces',
      headers: { authorization: `Bearer ${ownerToken}` },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data.workspaces));
    const created = body.data.workspaces.find((w: any) => (w.workspace?.id === testWorkspaceId || w.workspace?.workspaceId === testWorkspaceId || w.id === testWorkspaceId));
    assert.ok(created);
    assert.equal(created.role.toLowerCase(), 'owner');
  });

  test('4. GET /api/v1/workspaces/:workspaceId/applications lists inventory as visible', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${testWorkspaceId}/applications`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data.applications));
    const invApp = body.data.applications.find((a: any) => a.key === 'inventory' || a.productKey === 'inventory');
    assert.ok(invApp);
  });

  test('5. GET /api/v1/workspaces/:workspaceId/inventory/branches returns branches', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${testWorkspaceId}/inventory/branches`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length >= 1);
  });

  test('6. POST /api/v1/workspaces/:workspaceId/archive archives workspace (Owner only)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${testWorkspaceId}/archive`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { reason: 'End of financial year archival' },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.success, true);
  });

  test('7. POST /api/v1/workspaces/:workspaceId/restore restores archived workspace to active', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${testWorkspaceId}/restore`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.success, true);
  });

  test('8. POST /api/v1/workspaces/:workspaceId/suspend suspends workspace', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${testWorkspaceId}/suspend`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { reason: 'Compliance review' },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.success, true);
  });

  test('9. POST /api/v1/workspaces/:workspaceId/deletion/request and /cancel manage cooling-off', async () => {
    // Request deletion
    const reqRes = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${testWorkspaceId}/deletion/request`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { reason: 'Closing business' },
    });

    assert.equal(reqRes.statusCode, 200);
    const reqBody = JSON.parse(reqRes.body);
    assert.equal(reqBody.success, true);
    assert.ok(reqBody.data.purgeScheduledAt);

    // Cancel deletion
    const cancelRes = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${testWorkspaceId}/deletion/cancel`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });

    assert.equal(cancelRes.statusCode, 200);
    const cancelBody = JSON.parse(cancelRes.body);
    assert.equal(cancelBody.success, true);
  });

  test('10. Non-member cannot access workspace endpoints (Multi-Tenant Isolation)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${testWorkspaceId}/applications`,
      headers: { authorization: `Bearer ${memberToken}` },
    });

    // Must be denied
    assert.ok(res.statusCode === 403 || res.statusCode === 404 || res.statusCode === 500);
  });
});
