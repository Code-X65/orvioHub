import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { dataService } from '../src/services/dataService.js';
import type { FastifyInstance } from 'fastify';

describe('Phase 8: Ownership Transfer Test Suite', () => {
  let app: FastifyInstance;
  let currentOwnerToken: string;
  let currentOwnerUserId: string;
  let newOwnerUserId: string;
  let newOwnerToken: string;
  let wsId: string;

  before(async () => {
    app = await buildApp();
    await app.ready();

    const timestamp = Date.now();
    const ownerEmail = `transfer_owner_${timestamp}@test.com`;
    const { user: owner } = await dataService.createUser({
      name: 'Initial Owner',
      email: ownerEmail,
      password: 'Password123!',
      emailVerified: true,
    });
    currentOwnerUserId = owner.id;

    const ownerSession = await dataService.createSession(currentOwnerUserId, {
      userAgent: 'test-agent',
      ipAddress: '127.0.0.1',
      authenticationMethod: 'password',
      tokenVersion: owner.tokenVersion ?? 1,
    });

    currentOwnerToken = app.jwt.sign({
      userId: currentOwnerUserId,
      email: ownerEmail,
      sessionId: ownerSession.sessionId,
      tokenVersion: owner.tokenVersion ?? 1,
    });

    // Create member to receive ownership
    const newOwnerEmail = `new_owner_${timestamp}@test.com`;
    const { user: newOwner } = await dataService.createUser({
      name: 'New Owner',
      email: newOwnerEmail,
      password: 'Password123!',
      emailVerified: true,
    });
    newOwnerUserId = newOwner.id;

    const newOwnerSession = await dataService.createSession(newOwnerUserId, {
      userAgent: 'test-agent',
      ipAddress: '127.0.0.1',
      authenticationMethod: 'password',
      tokenVersion: newOwner.tokenVersion ?? 1,
    });

    newOwnerToken = app.jwt.sign({
      userId: newOwnerUserId,
      email: newOwnerEmail,
      sessionId: newOwnerSession.sessionId,
      tokenVersion: newOwner.tokenVersion ?? 1,
    });

    // Create workspace
    const wsRes = await app.inject({
      method: 'POST',
      url: '/api/v1/workspaces',
      headers: { authorization: `Bearer ${currentOwnerToken}` },
      payload: { name: 'Transfer Org', slug: `transfer-org-${timestamp}` },
    });
    wsId = JSON.parse(wsRes.payload).data.workspace.id;

    // Add new owner as member
    await dataService.mutate('workspaceMembers:addWorkspaceMember', {
      workspaceId: wsId as any,
      userId: newOwnerUserId as any,
      role: 'admin',
      status: 'active',
      callerUserId: currentOwnerUserId as any,
    });
  });

  after(async () => {
    await app.close();
  });

  test('1. Non-owner cannot initiate ownership transfer', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${wsId}/transfer-ownership`,
      headers: { authorization: `Bearer ${newOwnerToken}` },
      payload: {
        newOwnerUserId,
        confirmationPassword: 'Password123!',
      },
    });
    assert.ok(res.statusCode === 403 || res.statusCode === 400);
  });

  test('2. Owner can successfully transfer ownership to an active member with password confirmation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${wsId}/transfer-ownership`,
      headers: { authorization: `Bearer ${currentOwnerToken}` },
      payload: {
        newOwnerUserId,
        confirmationPassword: 'Password123!',
      },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
  });

  test('3. New owner now has OWNER role in workspace context', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${wsId}/context`,
      headers: { authorization: `Bearer ${newOwnerToken}` },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.data.membership.role.toUpperCase(), 'OWNER');
  });
});
