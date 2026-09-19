import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { dataService } from '../src/services/dataService.js';
import type { FastifyInstance } from 'fastify';

describe('Phase 8: Demo Branches Test Suite', () => {
  let app: FastifyInstance;
  let ownerToken: string;
  let ownerUserId: string;
  let wsId: string;
  let primaryBranchId: string;

  before(async () => {
    app = await buildApp();
    await app.ready();

    const timestamp = Date.now();
    const ownerEmail = `branch_owner_${timestamp}@test.com`;
    const { user: owner } = await dataService.createUser({
      name: 'Branch Owner',
      email: ownerEmail,
      password: 'Password123!',
      emailVerified: true,
    });
    ownerUserId = owner.id;

    const ownerSession = await dataService.createSession(ownerUserId, {
      userAgent: 'test-agent',
      ipAddress: '127.0.0.1',
      authenticationMethod: 'password',
      tokenVersion: owner.tokenVersion ?? 1,
    });

    ownerToken = app.jwt.sign({
      userId: ownerUserId,
      email: ownerEmail,
      sessionId: ownerSession.sessionId,
      tokenVersion: owner.tokenVersion ?? 1,
    });

    // Create workspace
    const wsRes = await app.inject({
      method: 'POST',
      url: '/api/v1/workspaces',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { name: 'Branch Org', slug: `branch-org-${timestamp}`, initialProduct: 'inventory' },
    });
    wsId = JSON.parse(wsRes.payload).data.workspace.id;
  });

  after(async () => {
    await app.close();
  });

  test('1. Workspace creation provisions primary demo branch', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${wsId}/inventory/branches`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length >= 1);
    const primary = body.data.find((b: any) => b.isPrimary);
    assert.ok(primary);
    primaryBranchId = primary.id || primary._id;
  });

  test('2. Primary demo branch contact and location details can be updated', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/workspaces/${wsId}/branches/${primaryBranchId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: 'Main Flagship Store',
        code: 'FLAGSHIP',
        phone: '+2348012345678',
        address: '12 Marina Road, Lagos',
      },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
  });

  test('3. Only primary branch cannot be archived without another primary branch', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${wsId}/branches/${primaryBranchId}/archive`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    // Archiving the only active primary branch is protected
    assert.ok(res.statusCode === 400 || res.statusCode === 403 || res.statusCode === 422);
  });
});
