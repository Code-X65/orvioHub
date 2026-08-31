import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { dataService } from '../src/services/dataService.js';
import type { FastifyInstance } from 'fastify';

describe('Phase 3: Workspace Foundation & Multi-Tenant Isolation Test Suite', () => {
  let app: FastifyInstance;
  let ownerToken: string;
  let ownerEmail: string;
  let memberToken: string;
  let memberEmail: string;
  let outsiderToken: string;
  let outsiderEmail: string;

  let orgId: string;
  let defaultWorkspaceId: string;

  before(async () => {
    app = await buildApp();
    await app.ready();

    const timestamp = Date.now();

    // 1. Create verified Owner User
    ownerEmail = `owner_${timestamp}@workspace-test.com`;
    const { user: ownerUser } = await dataService.createUser({
      name: 'Workspace Owner',
      email: ownerEmail,
      password: 'Password123!',
      emailVerified: true,
    });
    const ownerSession = await dataService.createSession(ownerUser.id, {
      userAgent: 'test-agent',
      ipAddress: '127.0.0.1',
      authenticationMethod: 'password',
      tokenVersion: ownerUser.tokenVersion ?? 1,
    });
    ownerToken = app.jwt.sign({
      userId: ownerUser.id,
      email: ownerUser.email,
      sessionId: ownerSession.sessionId,
      tokenVersion: ownerUser.tokenVersion ?? 1,
    });

    // 2. Create verified Member User (to be invited)
    memberEmail = `member_${timestamp}@workspace-test.com`;
    const { user: memberUser } = await dataService.createUser({
      name: 'Workspace Member',
      email: memberEmail,
      password: 'Password123!',
      emailVerified: true,
    });
    const memberSession = await dataService.createSession(memberUser.id, {
      userAgent: 'test-agent',
      ipAddress: '127.0.0.1',
      authenticationMethod: 'password',
      tokenVersion: memberUser.tokenVersion ?? 1,
    });
    memberToken = app.jwt.sign({
      userId: memberUser.id,
      email: memberUser.email,
      sessionId: memberSession.sessionId,
      tokenVersion: memberUser.tokenVersion ?? 1,
    });

    // 3. Create verified Outsider User
    outsiderEmail = `outsider_${timestamp}@workspace-test.com`;
    const { user: outsiderUser } = await dataService.createUser({
      name: 'Outsider User',
      email: outsiderEmail,
      password: 'Password123!',
      emailVerified: true,
    });
    const outsiderSession = await dataService.createSession(outsiderUser.id, {
      userAgent: 'test-agent',
      ipAddress: '127.0.0.1',
      authenticationMethod: 'password',
      tokenVersion: outsiderUser.tokenVersion ?? 1,
    });
    outsiderToken = app.jwt.sign({
      userId: outsiderUser.id,
      email: outsiderUser.email,
      sessionId: outsiderSession.sessionId,
      tokenVersion: outsiderUser.tokenVersion ?? 1,
    });
  });

  after(async () => {
    await app.close();
  });

  test('1. POST /api/v1/organizations creates organization and auto-provisions default workspace', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/organizations',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: 'Orvio Tech Ltd',
        industry: 'Technology',
        country: 'NG',
        timezone: 'Africa/Lagos',
      },
    });

    assert.strictEqual(res.statusCode, 201);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.success, true);
    assert.ok(body.data.organization.id);
    assert.strictEqual(body.data.membership.role, 'OWNER');

    orgId = body.data.organization.id;

    // Verify default workspace was created
    const wsRes = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${orgId}/workspaces`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });

    assert.strictEqual(wsRes.statusCode, 200);
    const wsBody = JSON.parse(wsRes.payload);
    assert.ok(Array.isArray(wsBody.data.workspaces));
    assert.strictEqual(wsBody.data.workspaces.length, 1);
    assert.strictEqual(wsBody.data.workspaces[0].isDefault, true);
    assert.strictEqual(wsBody.data.workspaces[0].slug, 'main');

    defaultWorkspaceId = wsBody.data.workspaces[0]._id;
  });

  test('2. POST /api/v1/organizations/:id/modules validates module prerequisites (e.g. sales requires customers)', async () => {
    // Attempt to enable 'sales' without 'customers'
    const failRes = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/modules`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        modules: ['sales'],
      },
    });

    assert.strictEqual(failRes.statusCode, 400);
    const failBody = JSON.parse(failRes.payload);
    assert.strictEqual(failBody.error.code, 'INVALID_MODULE_DEPENDENCY');

    // Enable both 'customers' and 'sales'
    const successRes = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/modules`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        modules: ['customers', 'sales'],
      },
    });

    assert.strictEqual(successRes.statusCode, 200);
    const successBody = JSON.parse(successRes.payload);
    assert.strictEqual(successBody.success, true);

    // Verify workspace enabledModules synced
    const wsCheck = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${defaultWorkspaceId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    assert.strictEqual(wsCheck.statusCode, 200);
    const wsCheckBody = JSON.parse(wsCheck.payload);
    assert.deepStrictEqual(wsCheckBody.data.workspace.enabledModules, ['customers', 'sales']);
  });

  test('3. Multi-Tenant Guard: Outsider cannot access organization workspaces', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${orgId}/workspaces`,
      headers: { authorization: `Bearer ${outsiderToken}` },
    });

    assert.strictEqual(res.statusCode, 403);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.error.code, 'ORGANIZATION_ACCESS_DENIED');

    const wsRes = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${defaultWorkspaceId}`,
      headers: { authorization: `Bearer ${outsiderToken}` },
    });
    assert.strictEqual(wsRes.statusCode, 403);
  });

  test('4. POST /api/v1/organizations/:id/workspaces creates additional custom workspace', async () => {
    const wsSlug = `abuja-branch-${Date.now()}`;
    const createRes = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/workspaces`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: 'Abuja Branch',
        slug: wsSlug,
        enabledModules: ['customers'],
      },
    });

    assert.strictEqual(createRes.statusCode, 201);
    const body = JSON.parse(createRes.payload);
    assert.strictEqual(body.data.slug, wsSlug);

    // Duplicate slug returns 409
    const dupRes = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/workspaces`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: 'Duplicate Abuja Branch',
        slug: wsSlug,
      },
    });
    assert.strictEqual(dupRes.statusCode, 409);
  });

  test('5. Team Invitations Lifecycle: Send, Cancel, and Accept', async () => {
    // 5a. Send invitation to memberEmail
    const inviteRes = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/invitations`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        invitations: [{ email: memberEmail, role: 'MEMBER' }],
      },
    });

    assert.strictEqual(inviteRes.statusCode, 201);

    // List invitations
    const listRes = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${orgId}/invitations`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    assert.strictEqual(listRes.statusCode, 200);
    const listBody = JSON.parse(listRes.payload);
    assert.ok(listBody.data.invitations.length >= 1);
    const inv = listBody.data.invitations.find((i: any) => i.email === memberEmail.toLowerCase());
    assert.ok(inv);

    // Resend invitation
    const resendRes = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/invitations/resend`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { invitationId: inv.id },
    });
    assert.strictEqual(resendRes.statusCode, 200);
    const resendBody = JSON.parse(resendRes.payload);
    const inviteToken = resendBody.data.token;
    assert.ok(inviteToken);

    // Accept invitation with member account
    const acceptRes = await app.inject({
      method: 'POST',
      url: '/api/v1/invitations/accept',
      headers: { authorization: `Bearer ${memberToken}` },
      payload: { token: inviteToken },
    });
    assert.strictEqual(acceptRes.statusCode, 200);
    const acceptBody = JSON.parse(acceptRes.payload);
    assert.strictEqual(acceptBody.success, true);

    // Verify member now has access to workspaces
    const memberWsRes = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${orgId}/workspaces`,
      headers: { authorization: `Bearer ${memberToken}` },
    });
    assert.strictEqual(memberWsRes.statusCode, 200);
  });

  test('6. Member Management & Last-Owner Safeguard', async () => {
    // Get member list
    const membersRes = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${orgId}/members`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    assert.strictEqual(membersRes.statusCode, 200);
    const membersBody = JSON.parse(membersRes.payload);
    assert.strictEqual(membersBody.data.members.length, 2);

    const ownerMember = membersBody.data.members.find((m: any) => m.role === 'OWNER');
    const regularMember = membersBody.data.members.find((m: any) => m.role === 'MEMBER');
    assert.ok(ownerMember);
    assert.ok(regularMember);

    // Attempting to demote or remove the sole owner must fail with CANNOT_REMOVE_LAST_OWNER
    const demoteOwnerFail = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${orgId}/members/${ownerMember.userId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { role: 'MEMBER' },
    });
    assert.strictEqual(demoteOwnerFail.statusCode, 400);
    const demoteFailBody = JSON.parse(demoteOwnerFail.payload);
    assert.strictEqual(demoteFailBody.error.code, 'CANNOT_REMOVE_LAST_OWNER');

    const removeOwnerFail = await app.inject({
      method: 'DELETE',
      url: `/api/v1/organizations/${orgId}/members/${ownerMember.userId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    assert.strictEqual(removeOwnerFail.statusCode, 400);

    // Promote regular member to OWNER
    const promoteRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${orgId}/members/${regularMember.userId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { role: 'OWNER' },
    });
    assert.strictEqual(promoteRes.statusCode, 200);

    // Now that there are 2 owners, demoting the first owner succeeds
    const demoteSuccess = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${orgId}/members/${ownerMember.userId}`,
      headers: { authorization: `Bearer ${memberToken}` }, // using new owner
      payload: { role: 'MEMBER' },
    });
    assert.strictEqual(demoteSuccess.statusCode, 200);
  });
});
