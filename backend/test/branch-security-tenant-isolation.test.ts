import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { buildApp } from '../src/app.js';
import { dataService } from '../src/services/dataService.js';
import type { FastifyInstance } from 'fastify';

async function addWorkspaceMemberHelper(
  workspaceId: string,
  ownerUserId: string,
  user: { id: string; email: string },
  role: string,
  status: 'active' | 'suspended' = 'active'
) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  await dataService.mutate('workspaceMembers:createWorkspaceInvitation', {
    workspaceId: workspaceId as any,
    callerUserId: ownerUserId as any,
    email: user.email,
    role,
    organizationRole: role,
    appAccess: [
      {
        productKey: 'inventory',
        appRole: role,
        branchIds: [],
      },
    ],
    tokenHash,
    expiresAt: Date.now() + 7 * 86400000,
  });

  await dataService.mutate('workspaceMembers:acceptWorkspaceInvitation', {
    tokenHash,
    userId: user.id as any,
  });

  if (status === 'suspended') {
    const mem = (await dataService.query('workspaces:getWorkspaceMembership', {
      workspaceId: workspaceId as any,
      userId: user.id as any,
    })) as any;

    if (mem) {
      await dataService.mutate('workspaceMembers:suspendWorkspaceMember', {
        workspaceId: workspaceId as any,
        membershipId: (mem._id || mem.id) as any,
        callerUserId: ownerUserId as any,
        reason: 'Security isolation test suspension',
      });
    }
  }
}

describe('Phase 2: Comprehensive Branch Security & Tenant Isolation Suite', () => {
  let app: FastifyInstance;

  // Workspace A Identities
  let ownerAToken: string;
  let ownerAUserId: string;
  let adminAToken: string;
  let adminAUserId: string;
  let managerAToken: string;
  let managerAUserId: string;
  let memberAToken: string;
  let memberAUserId: string;
  let viewerAToken: string;
  let viewerAUserId: string;
  let suspendedAToken: string;
  let suspendedAUserId: string;

  // Workspace B Identities
  let ownerBToken: string;
  let ownerBUserId: string;

  // Resources
  let wsAId: string;
  let branchA1Id: string; // primary
  let branchA2Id: string; // secondary
  let wsBId: string;
  let branchB1Id: string; // primary in WS B

  before(async () => {
    app = await buildApp();
    await app.ready();

    const ts = Date.now();

    // 1. Create Owner A
    const ownerAEmail = `owner_a_${ts}@test.com`;
    const { user: ownerA } = await dataService.createUser({
      name: 'Owner A',
      email: ownerAEmail,
      password: 'Password123!',
      emailVerified: true,
    });
    ownerAUserId = ownerA.id;
    const sessionOwnerA = await dataService.createSession(ownerAUserId, {
      userAgent: 'test-agent',
      ipAddress: '127.0.0.1',
      authenticationMethod: 'password',
      tokenVersion: ownerA.tokenVersion ?? 1,
    });
    ownerAToken = app.jwt.sign({
      userId: ownerAUserId,
      email: ownerAEmail,
      sessionId: sessionOwnerA.sessionId,
      tokenVersion: ownerA.tokenVersion ?? 1,
    });

    // 2. Create Workspace A
    const wsARes = await app.inject({
      method: 'POST',
      url: '/api/v1/workspaces',
      headers: { authorization: `Bearer ${ownerAToken}` },
      payload: { name: 'Tenant A Corp', slug: `tenant-a-${ts}`, initialProduct: 'inventory' },
    });
    assert.equal(wsARes.statusCode, 201);
    wsAId = JSON.parse(wsARes.payload).data.workspace.id;

    // Upgrade Workspace A to standard plan to support multi-branch fixtures
    await dataService.mutate('subscriptions:create', {
      workspaceId: wsAId,
      planKey: 'standard',
      status: 'active',
      billingInterval: 'monthly',
      paymentMethod: 'paystack',
    });

    // Get primary branch for Workspace A
    const branchesARes = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${wsAId}/inventory/branches`,
      headers: { authorization: `Bearer ${ownerAToken}` },
    });
    const branchesA = JSON.parse(branchesARes.payload).data;
    const primaryA = branchesA.find((b: any) => b.isPrimary);
    branchA1Id = primaryA.id || primaryA._id;

    // Create secondary branch in Workspace A
    const branchA2Res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${wsAId}/branches`,
      headers: { authorization: `Bearer ${ownerAToken}` },
      payload: {
        name: 'Branch A2 Annex',
        code: 'A2-ANNEX',
        address: '10 Victoria Island, Lagos',
        phone: '+2348011112222',
        isPrimary: false,
      },
    });
    assert.equal(branchA2Res.statusCode, 201);
    const b2Data = JSON.parse(branchA2Res.payload).data;
    branchA2Id = b2Data.branch.id || b2Data.branch._id;

    // 3. Create Admin A
    const adminAEmail = `admin_a_${ts}@test.com`;
    const { user: adminA } = await dataService.createUser({
      name: 'Admin A',
      email: adminAEmail,
      password: 'Password123!',
      emailVerified: true,
    });
    adminAUserId = adminA.id;
    await addWorkspaceMemberHelper(wsAId, ownerAUserId, { id: adminAUserId, email: adminAEmail }, 'admin');
    const sessionAdminA = await dataService.createSession(adminAUserId, {
      userAgent: 'test-agent',
      ipAddress: '127.0.0.1',
      authenticationMethod: 'password',
      tokenVersion: adminA.tokenVersion ?? 1,
    });
    adminAToken = app.jwt.sign({
      userId: adminAUserId,
      email: adminAEmail,
      sessionId: sessionAdminA.sessionId,
      tokenVersion: adminA.tokenVersion ?? 1,
    });

    // 4. Create Manager A
    const managerAEmail = `manager_a_${ts}@test.com`;
    const { user: managerA } = await dataService.createUser({
      name: 'Manager A',
      email: managerAEmail,
      password: 'Password123!',
      emailVerified: true,
    });
    managerAUserId = managerA.id;
    await addWorkspaceMemberHelper(wsAId, ownerAUserId, { id: managerAUserId, email: managerAEmail }, 'manager');
    const sessionManagerA = await dataService.createSession(managerAUserId, {
      userAgent: 'test-agent',
      ipAddress: '127.0.0.1',
      authenticationMethod: 'password',
      tokenVersion: managerA.tokenVersion ?? 1,
    });
    managerAToken = app.jwt.sign({
      userId: managerAUserId,
      email: managerAEmail,
      sessionId: sessionManagerA.sessionId,
      tokenVersion: managerA.tokenVersion ?? 1,
    });

    // 5. Create Member A
    const memberAEmail = `member_a_${ts}@test.com`;
    const { user: memberA } = await dataService.createUser({
      name: 'Member A',
      email: memberAEmail,
      password: 'Password123!',
      emailVerified: true,
    });
    memberAUserId = memberA.id;
    await addWorkspaceMemberHelper(wsAId, ownerAUserId, { id: memberAUserId, email: memberAEmail }, 'member');
    const sessionMemberA = await dataService.createSession(memberAUserId, {
      userAgent: 'test-agent',
      ipAddress: '127.0.0.1',
      authenticationMethod: 'password',
      tokenVersion: memberA.tokenVersion ?? 1,
    });
    memberAToken = app.jwt.sign({
      userId: memberAUserId,
      email: memberAEmail,
      sessionId: sessionMemberA.sessionId,
      tokenVersion: memberA.tokenVersion ?? 1,
    });

    // 6. Create Viewer A
    const viewerAEmail = `viewer_a_${ts}@test.com`;
    const { user: viewerA } = await dataService.createUser({
      name: 'Viewer A',
      email: viewerAEmail,
      password: 'Password123!',
      emailVerified: true,
    });
    viewerAUserId = viewerA.id;
    await addWorkspaceMemberHelper(wsAId, ownerAUserId, { id: viewerAUserId, email: viewerAEmail }, 'viewer');
    const sessionViewerA = await dataService.createSession(viewerAUserId, {
      userAgent: 'test-agent',
      ipAddress: '127.0.0.1',
      authenticationMethod: 'password',
      tokenVersion: viewerA.tokenVersion ?? 1,
    });
    viewerAToken = app.jwt.sign({
      userId: viewerAUserId,
      email: viewerAEmail,
      sessionId: sessionViewerA.sessionId,
      tokenVersion: viewerA.tokenVersion ?? 1,
    });

    // 7. Create Suspended Member A
    const suspendedAEmail = `suspended_a_${ts}@test.com`;
    const { user: suspendedA } = await dataService.createUser({
      name: 'Suspended A',
      email: suspendedAEmail,
      password: 'Password123!',
      emailVerified: true,
    });
    suspendedAUserId = suspendedA.id;
    await addWorkspaceMemberHelper(wsAId, ownerAUserId, { id: suspendedAUserId, email: suspendedAEmail }, 'member', 'suspended');
    const sessionSuspendedA = await dataService.createSession(suspendedAUserId, {
      userAgent: 'test-agent',
      ipAddress: '127.0.0.1',
      authenticationMethod: 'password',
      tokenVersion: suspendedA.tokenVersion ?? 1,
    });
    suspendedAToken = app.jwt.sign({
      userId: suspendedAUserId,
      email: suspendedAEmail,
      sessionId: sessionSuspendedA.sessionId,
      tokenVersion: suspendedA.tokenVersion ?? 1,
    });

    // 8. Create Workspace B & Owner B
    const ownerBEmail = `owner_b_${ts}@test.com`;
    const { user: ownerB } = await dataService.createUser({
      name: 'Owner B',
      email: ownerBEmail,
      password: 'Password123!',
      emailVerified: true,
    });
    ownerBUserId = ownerB.id;
    const sessionOwnerB = await dataService.createSession(ownerBUserId, {
      userAgent: 'test-agent',
      ipAddress: '127.0.0.1',
      authenticationMethod: 'password',
      tokenVersion: ownerB.tokenVersion ?? 1,
    });
    ownerBToken = app.jwt.sign({
      userId: ownerBUserId,
      email: ownerBEmail,
      sessionId: sessionOwnerB.sessionId,
      tokenVersion: ownerB.tokenVersion ?? 1,
    });

    const wsBRes = await app.inject({
      method: 'POST',
      url: '/api/v1/workspaces',
      headers: { authorization: `Bearer ${ownerBToken}` },
      payload: { name: 'Tenant B Corp', slug: `tenant-b-${ts}`, initialProduct: 'inventory' },
    });
    assert.equal(wsBRes.statusCode, 201);
    wsBId = JSON.parse(wsBRes.payload).data.workspace.id;

    const branchesBRes = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${wsBId}/inventory/branches`,
      headers: { authorization: `Bearer ${ownerBToken}` },
    });
    const branchesB = JSON.parse(branchesBRes.payload).data;
    const primaryB = branchesB.find((b: any) => b.isPrimary);
    branchB1Id = primaryB.id || primaryB._id;
  });

  after(async () => {
    await app.close();
  });

  // ==========================================
  // 1. AUTHENTICATION & SESSION GUARDS
  // ==========================================
  describe('1. Authentication Guards', () => {
    test('Unauthenticated user cannot view branch settings (401)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/workspaces/${wsAId}/branches/${branchA1Id}/settings`,
      });
      assert.equal(res.statusCode, 401);
    });

    test('Unauthenticated user cannot patch branch settings (401)', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/workspaces/${wsAId}/branches/${branchA1Id}/settings`,
        payload: { receiptFooter: 'Hacked footer' },
      });
      assert.equal(res.statusCode, 401);
    });

    test('Unauthenticated user cannot set branch as primary (401)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/workspaces/${wsAId}/branches/${branchA2Id}/set-primary`,
      });
      assert.equal(res.statusCode, 401);
    });

    test('Unauthenticated user cannot suspend branch (401)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/workspaces/${wsAId}/branches/${branchA2Id}/suspend`,
      });
      assert.equal(res.statusCode, 401);
    });

    test('Unauthenticated user cannot restore branch (401)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/workspaces/${wsAId}/branches/${branchA2Id}/restore`,
      });
      assert.equal(res.statusCode, 401);
    });

    test('Unauthenticated user cannot archive branch (401)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/workspaces/${wsAId}/branches/${branchA2Id}/archive`,
      });
      assert.equal(res.statusCode, 401);
    });
  });

  // ==========================================
  // 2. ROLE-BASED ACCESS CONTROL (RBAC)
  // ==========================================
  describe('2. Role-Based Access Control', () => {
    test('Owner A can view and update branch settings', async () => {
      const getRes = await app.inject({
        method: 'GET',
        url: `/api/v1/workspaces/${wsAId}/branches/${branchA1Id}/settings`,
        headers: { authorization: `Bearer ${ownerAToken}` },
      });
      assert.equal(getRes.statusCode, 200);

      const patchRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/workspaces/${wsAId}/branches/${branchA1Id}/settings`,
        headers: { authorization: `Bearer ${ownerAToken}` },
        payload: { receiptFooter: 'Thank you for shopping with Owner A!' },
      });
      assert.equal(patchRes.statusCode, 200);
      assert.equal(JSON.parse(patchRes.payload).success, true);
    });

    test('Admin A can view and update branch settings', async () => {
      const patchRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/workspaces/${wsAId}/branches/${branchA1Id}/settings`,
        headers: { authorization: `Bearer ${adminAToken}` },
        payload: { lowStockThreshold: 15 },
      });
      assert.equal(patchRes.statusCode, 200);
    });

    test('Manager A can view and update branch settings', async () => {
      const patchRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/workspaces/${wsAId}/branches/${branchA1Id}/settings`,
        headers: { authorization: `Bearer ${managerAToken}` },
        payload: { lowStockThreshold: 20 },
      });
      assert.equal(patchRes.statusCode, 200);
    });

    test('Ordinary Member A cannot update branch settings (403)', async () => {
      const patchRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/workspaces/${wsAId}/branches/${branchA1Id}/settings`,
        headers: { authorization: `Bearer ${memberAToken}` },
        payload: { receiptFooter: 'Malicious update' },
      });
      assert.equal(patchRes.statusCode, 403);
    });

    test('Viewer A cannot update branch settings (403)', async () => {
      const patchRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/workspaces/${wsAId}/branches/${branchA1Id}/settings`,
        headers: { authorization: `Bearer ${viewerAToken}` },
        payload: { lowStockThreshold: 50 },
      });
      assert.equal(patchRes.statusCode, 403);
    });

    test('Suspended member cannot view or update branch settings (403)', async () => {
      const getRes = await app.inject({
        method: 'GET',
        url: `/api/v1/workspaces/${wsAId}/branches/${branchA1Id}/settings`,
        headers: { authorization: `Bearer ${suspendedAToken}` },
      });
      assert.equal(getRes.statusCode, 403);

      const patchRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/workspaces/${wsAId}/branches/${branchA1Id}/settings`,
        headers: { authorization: `Bearer ${suspendedAToken}` },
        payload: { lowStockThreshold: 99 },
      });
      assert.equal(patchRes.statusCode, 403);
    });
  });

  // ==========================================
  // 3. CROSS-TENANT ISOLATION & DATA LEAKAGE PREVENTION
  // ==========================================
  describe('3. Cross-Tenant Isolation', () => {
    test('User A cannot view Branch B using Workspace B ID (403/404)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/workspaces/${wsBId}/branches/${branchB1Id}/settings`,
        headers: { authorization: `Bearer ${ownerAToken}` },
      });
      assert.ok(res.statusCode === 403 || res.statusCode === 404);
    });

    test('User A cannot update Branch B using Workspace B ID (403/404)', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/workspaces/${wsBId}/branches/${branchB1Id}/settings`,
        headers: { authorization: `Bearer ${ownerAToken}` },
        payload: { receiptFooter: 'Hacked by Tenant A' },
      });
      assert.ok(res.statusCode === 403 || res.statusCode === 404);
    });

    test('User A cannot target Branch B using Workspace A ID (privacy-safe 404)', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/workspaces/${wsAId}/branches/${branchB1Id}/settings`,
        headers: { authorization: `Bearer ${ownerAToken}` },
        payload: { receiptFooter: 'Cross tenant inject' },
      });
      assert.equal(res.statusCode, 404);
      const body = JSON.parse(res.payload);
      assert.equal(body.error.code, 'BRANCH_NOT_FOUND');
    });

    test('User A cannot set Branch B as primary in Workspace A (404)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/workspaces/${wsAId}/branches/${branchB1Id}/set-primary`,
        headers: { authorization: `Bearer ${ownerAToken}` },
      });
      assert.equal(res.statusCode, 404);
    });

    test('User A cannot suspend Branch B (404/403)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/workspaces/${wsAId}/branches/${branchB1Id}/suspend`,
        headers: { authorization: `Bearer ${ownerAToken}` },
      });
      assert.equal(res.statusCode, 404);
    });

    test('User A cannot archive Branch B (404/403)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/workspaces/${wsAId}/branches/${branchB1Id}/archive`,
        headers: { authorization: `Bearer ${ownerAToken}` },
      });
      assert.equal(res.statusCode, 404);
    });

    test('Forged or random branch ID is safely rejected with 404', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/workspaces/${wsAId}/branches/non_existent_branch_id_12345/settings`,
        headers: { authorization: `Bearer ${ownerAToken}` },
      });
      assert.equal(res.statusCode, 404);
      assert.equal(JSON.parse(res.payload).error.code, 'BRANCH_NOT_FOUND');
    });
  });

  // ==========================================
  // 4. BRANCH STATUS, INVARIANTS & AUDIT
  // ==========================================
  describe('4. Branch Status Lifecycle & Invariants', () => {
    test('Set primary branch atomically updates primary flag', async () => {
      // Set Branch A2 as primary
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/workspaces/${wsAId}/branches/${branchA2Id}/set-primary`,
        headers: { authorization: `Bearer ${ownerAToken}` },
      });
      assert.equal(res.statusCode, 200);

      // Verify A2 is now primary and A1 is no longer primary
      const b2Settings = await dataService.getFullBranchSettings(branchA2Id);
      assert.equal(b2Settings.isPrimary, true);

      const b1Settings = await dataService.getFullBranchSettings(branchA1Id);
      assert.equal(b1Settings.isPrimary, false);
    });

    test('Suspend and restore secondary branch', async () => {
      // First make A1 primary so A2 can be suspended
      await app.inject({
        method: 'POST',
        url: `/api/v1/workspaces/${wsAId}/branches/${branchA1Id}/set-primary`,
        headers: { authorization: `Bearer ${ownerAToken}` },
      });

      // Suspend A2
      const suspendRes = await app.inject({
        method: 'POST',
        url: `/api/v1/workspaces/${wsAId}/branches/${branchA2Id}/suspend`,
        headers: { authorization: `Bearer ${ownerAToken}` },
      });
      assert.equal(suspendRes.statusCode, 200);

      const b2Suspended = await dataService.getFullBranchSettings(branchA2Id);
      assert.equal(b2Suspended.status, 'suspended');
      assert.equal(b2Suspended.isActive, false);

      // Restore A2
      const restoreRes = await app.inject({
        method: 'POST',
        url: `/api/v1/workspaces/${wsAId}/branches/${branchA2Id}/restore`,
        headers: { authorization: `Bearer ${ownerAToken}` },
      });
      assert.equal(restoreRes.statusCode, 200);

      const b2Restored = await dataService.getFullBranchSettings(branchA2Id);
      assert.equal(b2Restored.status, 'active');
      assert.equal(b2Restored.isActive, true);
    });

    test('Cannot archive the only active primary branch', async () => {
      // Suspend A2 so A1 is the only active branch
      await app.inject({
        method: 'POST',
        url: `/api/v1/workspaces/${wsAId}/branches/${branchA2Id}/suspend`,
        headers: { authorization: `Bearer ${ownerAToken}` },
      });

      // Attempt to archive A1
      const archiveRes = await app.inject({
        method: 'POST',
        url: `/api/v1/workspaces/${wsAId}/branches/${branchA1Id}/archive`,
        headers: { authorization: `Bearer ${ownerAToken}` },
      });
      assert.ok(archiveRes.statusCode === 400 || archiveRes.statusCode === 403);

      // Restore A2
      await app.inject({
        method: 'POST',
        url: `/api/v1/workspaces/${wsAId}/branches/${branchA2Id}/restore`,
        headers: { authorization: `Bearer ${ownerAToken}` },
      });
    });

    test('Convex mutation layer independently rejects cross-tenant caller', async () => {
      // Direct call to Convex mutation with cross-tenant caller
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      await assert.rejects(
        async () => {
          await dataService.mutate('workspaceMembers:createWorkspaceInvitation', {
            workspaceId: wsAId as any,
            callerUserId: ownerBUserId as any, // User B is not in Workspace A
            email: 'hacker@test.com',
            role: 'member',
            tokenHash,
            expiresAt: Date.now() + 86400000,
          });
        },
        (err: any) => {
          return (
            err.message.includes('WORKSPACE_ACCESS_DENIED') ||
            err.message.includes('ACCESS_DENIED') ||
            err.message.includes('DENIED') ||
            err.message.includes('Server Error')
          );
        }
      );
    });
  });
});


