import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { dataService } from '../src/services/dataService.js';
import type { FastifyInstance } from 'fastify';

describe('Phase 8: Workspace Switching Test Suite', () => {
  let app: FastifyInstance;
  let userToken: string;
  let userId: string;
  let userEmail: string;

  let outsiderToken: string;
  let outsiderUserId: string;

  let ws1Id: string;
  let ws2Id: string;

  before(async () => {
    app = await buildApp();
    await app.ready();

    const timestamp = Date.now();
    userEmail = `switcher_${timestamp}@test.com`;
    const { user } = await dataService.createUser({
      name: 'Switch User',
      email: userEmail,
      password: 'Password123!',
      emailVerified: true,
    });
    userId = user.id;

    const session = await dataService.createSession(userId, {
      userAgent: 'test-agent',
      ipAddress: '127.0.0.1',
      authenticationMethod: 'password',
      tokenVersion: user.tokenVersion ?? 1,
    });

    userToken = app.jwt.sign({
      userId,
      email: userEmail,
      sessionId: session.sessionId,
      tokenVersion: user.tokenVersion ?? 1,
    });

    // Create outsider user
    const { user: outsider } = await dataService.createUser({
      name: 'Outsider User',
      email: `outsider_${timestamp}@test.com`,
      password: 'Password123!',
      emailVerified: true,
    });
    outsiderUserId = outsider.id;

    const outSession = await dataService.createSession(outsiderUserId, {
      userAgent: 'test-agent',
      ipAddress: '127.0.0.1',
      authenticationMethod: 'password',
      tokenVersion: outsider.tokenVersion ?? 1,
    });

    outsiderToken = app.jwt.sign({
      userId: outsiderUserId,
      email: outsider.email,
      sessionId: outSession.sessionId,
      tokenVersion: outsider.tokenVersion ?? 1,
    });

    // Create 2 workspaces for user
    const createRes1 = await app.inject({
      method: 'POST',
      url: '/api/v1/workspaces',
      headers: { authorization: `Bearer ${userToken}` },
      payload: { name: 'Workspace One', slug: `ws-one-${timestamp}` },
    });
    ws1Id = JSON.parse(createRes1.payload).data.workspace.id;

    const createRes2 = await app.inject({
      method: 'POST',
      url: '/api/v1/workspaces',
      headers: { authorization: `Bearer ${userToken}` },
      payload: { name: 'Workspace Two', slug: `ws-two-${timestamp}` },
    });
    ws2Id = JSON.parse(createRes2.payload).data.workspace.id;
  });

  after(async () => {
    await app.close();
  });

  test('1. User can switch between their own workspaces and receive verified context', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${ws1Id}/select`,
      headers: { authorization: `Bearer ${userToken}` },
      payload: { productKey: 'inventory' },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.equal(body.data.workspace.id, ws1Id);
    assert.equal(body.data.membership.role.toUpperCase(), 'OWNER');
  });

  test('2. User switching to second workspace refreshes context and permissions correctly', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${ws2Id}/select`,
      headers: { authorization: `Bearer ${userToken}` },
      payload: { productKey: 'inventory' },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.equal(body.data.workspace.id, ws2Id);
  });

  test('3. User cannot select/switch to a workspace they do not belong to (403/404 Forbidden)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${ws1Id}/select`,
      headers: { authorization: `Bearer ${outsiderToken}` },
      payload: { productKey: 'inventory' },
    });
    assert.ok(res.statusCode === 403 || res.statusCode === 404);
  });

  test('4. GET /workspaces/:workspaceId/context rejects non-members', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${ws1Id}/context`,
      headers: { authorization: `Bearer ${outsiderToken}` },
    });
    assert.equal(res.statusCode, 404);
  });
});
