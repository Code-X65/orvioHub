import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { dataService } from '../src/services/dataService.js';

describe('Superadmin & User Account Suspension & Deletion', () => {
  let app: FastifyInstance;
  let adminSessionToken: string;
  let testUserToken: string;
  let testUserId: string;
  let testUserEmail: string;

  before(async () => {
    app = await buildApp();
    await app.ready();

    // 1. Create a platform superadmin in Convex and establish an admin session
    const adminEmail = `superadmin_${Date.now()}@orviohub.com`;
    const adminPassword = 'AdminSecretPassword123!';
    await dataService.mutate('adminAuth:createAdmin', {
      email: adminEmail,
      name: 'Super Admin',
      password: adminPassword,
      role: 'super_admin',
      isDevBootstrap: true,
    });
    const adminLoginRes: any = await dataService.mutate('adminAuth:login', {
      email: adminEmail,
      password: adminPassword,
    });
    adminSessionToken = adminLoginRes.token;

    // 2. Create a standard test user
    testUserEmail = `target_user_${Date.now()}@example.com`;
    const { user: testUser } = await dataService.createUser({
      email: testUserEmail,
      name: 'Test Target User',
      emailVerified: true,
      password: 'UserSecretPassword123!',
    });
    testUserId = testUser.id;

    // Create an active session for the user
    const sessionRes = await dataService.createSession(testUserId, {
      deviceName: 'User Laptop',
    });

    testUserToken = app.jwt.sign({
      userId: testUserId,
      email: testUserEmail,
      tokenVersion: testUser.tokenVersion ?? 0,
      sessionId: sessionRes.sessionId,
    });
  });

  after(async () => {
    await app.close();
  });

  test('1. User Deletion: Request 7-day cooling-off period deletion', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/users/me/deletion/request',
      headers: {
        authorization: `Bearer ${testUserToken}`,
      },
      payload: {
        password: 'UserSecretPassword123!',
        reason: 'Switching to another provider',
        coolingOffDays: 7,
      },
    });

    if (res.statusCode !== 200) console.error('TEST 1 RES:', res.payload);
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.success, true);
    assert.ok(body.scheduledDeletionAt || body.data?.scheduledDeletionAt);

    // Verify deletion status endpoint
    const statusRes = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me/deletion/status',
      headers: {
        authorization: `Bearer ${testUserToken}`,
      },
    });
    assert.strictEqual(statusRes.statusCode, 200);
    const statusBody = JSON.parse(statusRes.payload);
    assert.ok(statusBody.data);
    assert.ok(
      statusBody.data.status === 'pending' ||
      statusBody.data.status === 'COOLING_OFF' ||
      statusBody.data.status === 'cooling_off'
    );
  });

  test('2. User Deletion: Cancel active deletion request as authenticated user', async () => {
    const cancelRes = await app.inject({
      method: 'POST',
      url: '/api/v1/users/me/deletion/cancel',
      headers: {
        authorization: `Bearer ${testUserToken}`,
      },
    });

    if (cancelRes.statusCode !== 200) console.error('TEST 2 RES:', cancelRes.payload);
    assert.strictEqual(cancelRes.statusCode, 200);
    const cancelBody = JSON.parse(cancelRes.payload);
    assert.strictEqual(cancelBody.success, true);

    // Verify status is now cancelled or null
    const statusRes = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me/deletion/status',
      headers: {
        authorization: `Bearer ${testUserToken}`,
      },
    });
    const statusBody = JSON.parse(statusRes.payload);
    assert.ok(!statusBody.data || statusBody.data.status === 'cancelled' || statusBody.data.status === 'NONE' || statusBody.data.hasActiveRequest === false);
  });

  test('3. Superadmin Suspension: Suspend user account with structured reason & revoke sessions', async () => {
    const suspendRes = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${testUserId}/suspend`,
      headers: {
        authorization: `Bearer ${adminSessionToken}`,
        'x-admin-token': adminSessionToken,
      },
      payload: {
        reason: 'policy_violation',
        notes: 'User breached terms of service on messaging',
        revokeAllSessions: true,
      },
    });

    assert.strictEqual(suspendRes.statusCode, 200);
    const suspendBody = JSON.parse(suspendRes.payload);
    assert.strictEqual(suspendBody.success, true);

    // Verify target user's active sessions were revoked
    const sessions = await dataService.getUserSessions(testUserId);
    assert.ok(sessions.every((s: any) => s.isRevoked));

    // Verify login is blocked with ACCOUNT_SUSPENDED
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: testUserEmail,
        password: 'UserSecretPassword123!',
      },
    });
    assert.strictEqual(loginRes.statusCode, 403);
    const loginBody = JSON.parse(loginRes.payload);
    assert.strictEqual(loginBody.error.code, 'ACCOUNT_SUSPENDED');
  });

  test('4. Superadmin Restoration: Restore suspended user account', async () => {
    const restoreRes = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${testUserId}/restore`,
      headers: {
        authorization: `Bearer ${adminSessionToken}`,
        'x-admin-token': adminSessionToken,
      },
    });

    assert.strictEqual(restoreRes.statusCode, 200);
    const restoreBody = JSON.parse(restoreRes.payload);
    assert.strictEqual(restoreBody.success, true);

    // Verify user can log in again
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: testUserEmail,
        password: 'UserSecretPassword123!',
      },
    });
    assert.strictEqual(loginRes.statusCode, 200);
    const loginBody = JSON.parse(loginRes.payload);
    assert.ok(loginBody.data.token || loginBody.data.sessionToken);
  });

  test('5. Superadmin Workspace Suspension & Restoration', async () => {
    // Create an organization
    const orgRes = await dataService.createOrganization({
      userId: testUserId,
      name: 'Test Suspension Org',
      industry: 'Retail',
      country: 'Nigeria',
      timezone: 'Africa/Lagos',
    });
    const workspaceId = orgRes.organization.id;

    // Suspend workspace
    const suspendWsRes = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/workspaces/${workspaceId}/suspend`,
      headers: {
        authorization: `Bearer ${adminSessionToken}`,
        'x-admin-token': adminSessionToken,
      },
      payload: {
        reason: 'payment_failure',
        notes: 'Invoice overdue 30 days',
      },
    });
    if (suspendWsRes.statusCode !== 200) console.error('TEST 5 RES:', suspendWsRes.payload);
    assert.strictEqual(suspendWsRes.statusCode, 200);
    const suspendWsBody = JSON.parse(suspendWsRes.payload);
    assert.strictEqual(suspendWsBody.success, true);

    // Restore workspace
    const restoreWsRes = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/workspaces/${workspaceId}/restore`,
      headers: {
        authorization: `Bearer ${adminSessionToken}`,
        'x-admin-token': adminSessionToken,
      },
    });
    assert.strictEqual(restoreWsRes.statusCode, 200);
    const restoreWsBody = JSON.parse(restoreWsRes.payload);
    assert.strictEqual(restoreWsBody.success, true);
  });

  test('6. Superadmin Deletion: Enforce grace period vs force delete', async () => {
    // 6a. Verify pre-check: cannot delete user owning active workspace without transferring ownership
    const preCheckRes = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${testUserId}/delete`,
      headers: {
        authorization: `Bearer ${adminSessionToken}`,
        'x-admin-token': adminSessionToken,
      },
      payload: {
        reason: 'admin_action',
        adminForceDelete: false,
        cancelSubscriptions: true,
      },
    });
    assert.strictEqual(preCheckRes.statusCode, 400);
    const preCheckBody = JSON.parse(preCheckRes.payload);
    assert.ok(preCheckBody.error.message.includes('User owns active workspaces'));

    // 6b. Admin emergency force delete bypass (closes/deactivates owned workspaces and immediately anonymizes per NDPA)
    const forceDelRes = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${testUserId}/delete`,
      headers: {
        authorization: `Bearer ${adminSessionToken}`,
        'x-admin-token': adminSessionToken,
      },
      payload: {
        reason: 'fraud_or_abuse',
        adminForceDelete: true,
        cancelSubscriptions: true,
      },
    });
    if (forceDelRes.statusCode !== 200) console.error('FORCE DEL RES:', forceDelRes.payload);
    assert.strictEqual(forceDelRes.statusCode, 200);
    const forceBody = JSON.parse(forceDelRes.payload);
    assert.strictEqual(forceBody.success, true);
    assert.strictEqual(forceBody.data.immediate, true);

    // 6c. Test 7-day scheduled grace period on a user without owned workspaces
    const { user: userToSchedule } = await dataService.createUser({
      email: `grace_period_user_${Date.now()}@example.com`,
      name: 'Grace Period User',
      password: 'SecurePassword123!',
      emailVerified: true,
    });
    const schedDelRes = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${userToSchedule.id}/delete`,
      headers: {
        authorization: `Bearer ${adminSessionToken}`,
        'x-admin-token': adminSessionToken,
      },
      payload: {
        reason: 'inactive_account',
        adminForceDelete: false,
        cancelSubscriptions: true,
      },
    });
    if (schedDelRes.statusCode !== 200) console.error('SCHED DEL RES:', schedDelRes.payload);
    assert.strictEqual(schedDelRes.statusCode, 200);
    const schedBody = JSON.parse(schedDelRes.payload);
    assert.strictEqual(schedBody.success, true);
    assert.strictEqual(schedBody.data.scheduled, true);
  });
});
