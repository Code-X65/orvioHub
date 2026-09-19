import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { dataService } from '../src/services/dataService.js';
import type { FastifyInstance } from 'fastify';

describe('Phase 8: Memberships & Invitations Test Suite', () => {
  let app: FastifyInstance;
  let ownerToken: string;
  let ownerUserId: string;

  let inviteeToken: string;
  let inviteeUserId: string;
  let inviteeEmail: string;

  let wsId: string;
  let membershipId: string;
  let inviteId: string;

  before(async () => {
    app = await buildApp();
    await app.ready();

    const timestamp = Date.now();
    const ownerEmail = `mem_owner_${timestamp}@test.com`;
    const { user: owner } = await dataService.createUser({
      name: 'Membership Owner',
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

    // Create invitee user
    inviteeEmail = `invitee_${timestamp}@test.com`;
    const { user: invitee } = await dataService.createUser({
      name: 'Invitee User',
      email: inviteeEmail,
      password: 'Password123!',
      emailVerified: true,
    });
    inviteeUserId = invitee.id;

    const inviteeSession = await dataService.createSession(inviteeUserId, {
      userAgent: 'test-agent',
      ipAddress: '127.0.0.1',
      authenticationMethod: 'password',
      tokenVersion: invitee.tokenVersion ?? 1,
    });

    inviteeToken = app.jwt.sign({
      userId: inviteeUserId,
      email: inviteeEmail,
      sessionId: inviteeSession.sessionId,
      tokenVersion: invitee.tokenVersion ?? 1,
    });

    // Create workspace
    const wsRes = await app.inject({
      method: 'POST',
      url: '/api/v1/workspaces',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { name: 'Team Org', slug: `team-org-${timestamp}` },
    });
    wsId = JSON.parse(wsRes.payload).data.workspace.id;
  });

  after(async () => {
    await app.close();
  });

  test('1. Owner can create and send workspace invitation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${wsId}/invitations`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        email: inviteeEmail,
        role: 'MEMBER',
      },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    inviteId = body.data.id || body.data._id;
  });

  test('2. Duplicate pending invitation for same email is handled safely', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${wsId}/invitations`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        email: inviteeEmail,
        role: 'MEMBER',
      },
    });
    // Should either return existing invitation or reject gracefully
    assert.ok(res.statusCode === 200 || res.statusCode === 409 || res.statusCode === 400);
  });

  test('3. Owner can list workspace members', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${wsId}/members`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
  });

  test('4. Only owner cannot be removed (last owner protection)', async () => {
    const membersRes = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${wsId}/members`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    const members = JSON.parse(membersRes.payload).data;
    const ownerMembership = members.find((m: any) => m.userId === ownerUserId);
    assert.ok(ownerMembership);

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/workspaces/${wsId}/members/${ownerMembership.id}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    assert.ok(deleteRes.statusCode === 400 || deleteRes.statusCode === 403);
  });
});
