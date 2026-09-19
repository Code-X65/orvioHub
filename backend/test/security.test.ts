import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { dataService } from '../src/services/dataService.js';
import type { FastifyInstance } from 'fastify';

describe('Phase 8: Security & Multi-Tenant Isolation Test Suite', () => {
  let app: FastifyInstance;
  let tenant1Token: string;
  let tenant1UserId: string;
  let tenant1WsId: string;

  let tenant2Token: string;
  let tenant2UserId: string;
  let tenant2WsId: string;

  before(async () => {
    app = await buildApp();
    await app.ready();

    const timestamp = Date.now();

    // Tenant 1
    const { user: user1 } = await dataService.createUser({
      name: 'Tenant 1 User',
      email: `t1_${timestamp}@test.com`,
      password: 'Password123!',
      emailVerified: true,
    });
    tenant1UserId = user1.id;
    const session1 = await dataService.createSession(tenant1UserId, {
      userAgent: 'test-agent',
      ipAddress: '127.0.0.1',
      authenticationMethod: 'password',
      tokenVersion: user1.tokenVersion ?? 1,
    });
    tenant1Token = app.jwt.sign({
      userId: tenant1UserId,
      email: user1.email,
      sessionId: session1.sessionId,
      tokenVersion: user1.tokenVersion ?? 1,
    });

    // Tenant 2
    const { user: user2 } = await dataService.createUser({
      name: 'Tenant 2 User',
      email: `t2_${timestamp}@test.com`,
      password: 'Password123!',
      emailVerified: true,
    });
    tenant2UserId = user2.id;
    const session2 = await dataService.createSession(tenant2UserId, {
      userAgent: 'test-agent',
      ipAddress: '127.0.0.1',
      authenticationMethod: 'password',
      tokenVersion: user2.tokenVersion ?? 1,
    });
    tenant2Token = app.jwt.sign({
      userId: tenant2UserId,
      email: user2.email,
      sessionId: session2.sessionId,
      tokenVersion: user2.tokenVersion ?? 1,
    });

    // Workspaces
    const ws1Res = await app.inject({
      method: 'POST',
      url: '/api/v1/workspaces',
      headers: { authorization: `Bearer ${tenant1Token}` },
      payload: { name: 'Tenant 1 Store', slug: `t1-${timestamp}` },
    });
    tenant1WsId = JSON.parse(ws1Res.payload).data.workspace.id;

    const ws2Res = await app.inject({
      method: 'POST',
      url: '/api/v1/workspaces',
      headers: { authorization: `Bearer ${tenant2Token}` },
      payload: { name: 'Tenant 2 Store', slug: `t2-${timestamp}` },
    });
    tenant2WsId = JSON.parse(ws2Res.payload).data.workspace.id;
  });

  after(async () => {
    await app.close();
  });

  test('1. Cross-tenant workspace access is strictly blocked (Tenant 2 cannot read Tenant 1)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${tenant1WsId}`,
      headers: { authorization: `Bearer ${tenant2Token}` },
    });
    assert.ok(res.statusCode === 403 || res.statusCode === 404);
  });

  test('2. Cross-tenant branch access is strictly blocked', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${tenant1WsId}/inventory/branches`,
      headers: { authorization: `Bearer ${tenant2Token}` },
    });
    assert.ok(res.statusCode === 403 || res.statusCode === 404);
  });

  test('3. Cross-tenant member management is strictly blocked', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${tenant1WsId}/members`,
      headers: { authorization: `Bearer ${tenant2Token}` },
    });
    assert.ok(res.statusCode === 403 || res.statusCode === 404);
  });

  test('4. Sensitive secrets like password hashes and session secrets are never returned in responses', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${tenant1WsId}/context`,
      headers: { authorization: `Bearer ${tenant1Token}` },
    });
    assert.equal(res.statusCode, 200);
    const bodyStr = res.payload;
    assert.ok(!bodyStr.includes('passwordHash'));
    assert.ok(!bodyStr.includes('twoFactorSecret'));
    assert.ok(!bodyStr.includes('refreshToken'));
  });
});
