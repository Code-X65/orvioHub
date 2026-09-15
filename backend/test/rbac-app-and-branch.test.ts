import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';
import { dataService } from '../src/services/dataService.js';

describe('Priority 3: Granular Application & Branch RBAC Test Suite', () => {
  let app: FastifyInstance;
  const adminUserId = 'test_owner_user_id';
  const staffUserId = 'test_staff_user_id';
  const testOrgId = 'test_org_rbac_suite';

  const originalGetUserById = dataService.getUserById;
  const originalGetUserAppPermissions = dataService.getUserAppPermissions;
  const originalCheckUserAppAccess = dataService.checkUserAppAccess;
  const originalCheckUserBranchAccess = dataService.checkUserBranchAccess;
  const originalUpdateMemberAppPermissions = dataService.updateMemberAppPermissions;

  before(async () => {
    app = await buildApp();
    await app.ready();

    dataService.getUserById = async (id: string) => ({
      id,
      email: id === adminUserId ? 'owner@business.localhost' : 'staff@business.localhost',
      name: id === adminUserId ? 'Business Owner' : 'Sales Staff',
      emailVerified: true,
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as any);

    dataService.createSession = async () => ({
      sessionId: 'sess_test_rbac',
      refreshToken: 'refresh_test_rbac',
    } as any);

    dataService.logAudit = async () => ({} as any);
  });

  after(async () => {
    dataService.getUserById = originalGetUserById;
    dataService.getUserAppPermissions = originalGetUserAppPermissions;
    dataService.checkUserAppAccess = originalCheckUserAppAccess;
    dataService.checkUserBranchAccess = originalCheckUserBranchAccess;
    dataService.updateMemberAppPermissions = originalUpdateMemberAppPermissions;
    await app.close();
  });

  const getAuthHeaders = (userId: string) => {
    const token = app.jwt.sign({
      userId,
      email: userId === adminUserId ? 'owner@business.localhost' : 'staff@business.localhost',
    });
    return {
      authorization: `Bearer ${token}`,
    };
  };

  test('GET /:organizationId/my-permissions returns admin privileges for OWNER', async () => {
    dataService.getUserAppPermissions = async () => ({
      role: 'OWNER',
      isFullAdmin: true,
      allowedApplications: [],
      allowedBranches: [],
      primaryBranchId: null,
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${testOrgId}/my-permissions`,
      headers: getAuthHeaders(adminUserId),
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.role, 'OWNER');
    assert.strictEqual(body.data.isFullAdmin, true);
  });

  test('GET /:organizationId/my-permissions returns restricted permissions for STAFF member', async () => {
    dataService.getUserAppPermissions = async () => ({
      role: 'SALES_ATTENDANT',
      isFullAdmin: false,
      allowedApplications: ['pos'],
      allowedBranches: ['branch_ikeja_01'],
      primaryBranchId: 'branch_ikeja_01',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${testOrgId}/my-permissions`,
      headers: getAuthHeaders(staffUserId),
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.isFullAdmin, false);
    assert.deepStrictEqual(body.data.allowedApplications, ['pos']);
    assert.deepStrictEqual(body.data.allowedBranches, ['branch_ikeja_01']);
  });

  test('GET /:organizationId/applications/:appKey/access returns allowed: true for authorized app', async () => {
    dataService.checkUserAppAccess = async (_orgId, _userId, appKey) => {
      if (appKey === 'pos') return { allowed: true, role: 'SALES_ATTENDANT', isFullAdmin: false };
      return { allowed: false, role: 'SALES_ATTENDANT', isFullAdmin: false, reason: 'APP_ACCESS_RESTRICTED' };
    };

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${testOrgId}/applications/pos/access`,
      headers: getAuthHeaders(staffUserId),
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.allowed, true);
  });

  test('GET /:organizationId/applications/:appKey/access returns allowed: false for unauthorized app', async () => {
    dataService.checkUserAppAccess = async (_orgId, _userId, appKey) => {
      if (appKey === 'pos') return { allowed: true, role: 'SALES_ATTENDANT', isFullAdmin: false };
      return { allowed: false, role: 'SALES_ATTENDANT', isFullAdmin: false, reason: 'APP_ACCESS_RESTRICTED' };
    };

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${testOrgId}/applications/inventory/access`,
      headers: getAuthHeaders(staffUserId),
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.allowed, false);
    assert.strictEqual(body.data.reason, 'APP_ACCESS_RESTRICTED');
  });

  test('PATCH /:organizationId/members/:memberId/permissions successfully updates member restrictions', async () => {
    let capturedArgs: any = null;
    dataService.updateMemberAppPermissions = async (args) => {
      capturedArgs = args;
      return { success: true };
    };

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${testOrgId}/members/${staffUserId}/permissions`,
      headers: getAuthHeaders(adminUserId),
      payload: {
        allowedApplications: ['pos', 'inventory'],
        allowedBranches: ['branch_ikeja_01', 'branch_lekki_02'],
        primaryBranchId: 'branch_ikeja_01',
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.success, true);
    assert.strictEqual(capturedArgs.organizationId, testOrgId);
    assert.strictEqual(capturedArgs.callerUserId, adminUserId);
    assert.strictEqual(capturedArgs.targetUserId, staffUserId);
    assert.deepStrictEqual(capturedArgs.allowedApplications, ['pos', 'inventory']);
  });

  test('PATCH /.../permissions rejects non-admin caller with 403', async () => {
    dataService.updateMemberAppPermissions = async () => {
      throw new Error('INSUFFICIENT_PERMISSIONS');
    };

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${testOrgId}/members/${staffUserId}/permissions`,
      headers: getAuthHeaders(staffUserId),
      payload: {
        allowedApplications: ['inventory'],
      },
    });

    assert.strictEqual(res.statusCode, 403);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.success, false);
    assert.ok(body.error.message.includes('owners or administrators'));
  });
});
