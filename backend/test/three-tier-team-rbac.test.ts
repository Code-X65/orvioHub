import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';
import { dataService } from '../src/services/dataService.js';

describe('Three-Tier Team & Role Management System Test Suite', () => {
  let app: FastifyInstance;
  const ownerUserId = 'test_owner_user_id';
  const adminUserId = 'test_admin_user_id';
  const memberUserId = 'test_member_user_id';
  const targetUserId = 'test_target_user_id';
  const testWorkspaceId = 'test_ws_team_suite';

  const originalGetUserById = dataService.getUserById;
  const originalGetRoleDefinitions = dataService.getRoleDefinitions;
  const originalResolve3TierPermissions = dataService.resolve3TierPermissions;
  const originalCheckUserPermission3Tier = dataService.checkUserPermission3Tier;
  const originalGetMembershipAuditLogs = dataService.getMembershipAuditLogs;
  const originalGrantApplicationAccess = dataService.grantApplicationAccess;
  const originalRevokeApplicationAccess = dataService.revokeApplicationAccess;
  const originalAssignBranchRole = dataService.assignBranchRole;
  const originalRemoveBranchAssignment = dataService.removeBranchAssignment;
  const originalGetBranchAssignments = dataService.getBranchAssignments;

  before(async () => {
    app = await buildApp();
    await app.ready();

    dataService.getUserById = async (id: string) => ({
      id,
      email: `${id}@example.com`,
      name: `User ${id}`,
      emailVerified: true,
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as any);

    dataService.createSession = async () => ({
      sessionId: 'sess_test_3tier',
      refreshToken: 'refresh_test_3tier',
    } as any);

    dataService.logAudit = async () => ({} as any);
  });

  after(async () => {
    dataService.getUserById = originalGetUserById;
    dataService.getRoleDefinitions = originalGetRoleDefinitions;
    dataService.resolve3TierPermissions = originalResolve3TierPermissions;
    dataService.checkUserPermission3Tier = originalCheckUserPermission3Tier;
    dataService.getMembershipAuditLogs = originalGetMembershipAuditLogs;
    dataService.grantApplicationAccess = originalGrantApplicationAccess;
    dataService.revokeApplicationAccess = originalRevokeApplicationAccess;
    dataService.assignBranchRole = originalAssignBranchRole;
    dataService.removeBranchAssignment = originalRemoveBranchAssignment;
    dataService.getBranchAssignments = originalGetBranchAssignments;
    await app.close();
  });

  const getAuthHeaders = (userId: string) => {
    const token = app.jwt.sign({
      userId,
      email: `${userId}@example.com`,
    });
    return {
      authorization: `Bearer ${token}`,
    };
  };

  test('1. GET /roles returns workspace and application role definitions', async () => {
    dataService.getRoleDefinitions = async () => ({
      workspaceRoles: [
        { roleKey: 'owner', name: 'Owner', isSystemRole: true, permissions: ['workspace.view', 'workspace.delete'] },
        { roleKey: 'admin', name: 'Admin', isSystemRole: true, permissions: ['workspace.view', 'member.invite'] },
        { roleKey: 'member', name: 'Member', isSystemRole: true, permissions: ['workspace.view'] },
        { roleKey: 'guest', name: 'Guest', isSystemRole: true, permissions: ['workspace.view'] },
      ],
      applicationRoles: {
        inventory: [
          { applicationKey: 'inventory', roleKey: 'admin', permissions: ['inventory.view', 'inventory.products.delete'] },
          { applicationKey: 'inventory', roleKey: 'member', permissions: ['inventory.view', 'inventory.products.create'] },
          { applicationKey: 'inventory', roleKey: 'viewer', permissions: ['inventory.view'] },
        ],
      },
    } as any);

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${testWorkspaceId}/roles`,
      headers: getAuthHeaders(ownerUserId),
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.workspaceRoles.length, 4);
    assert.ok(body.data.applicationRoles.inventory);
  });

  test('2. GET /permissions/evaluate returns 3-tier resolved permissions', async () => {
    dataService.resolve3TierPermissions = async (_wsId, userId, appKey, branchId) => ({
      hasAccess: true,
      role: 'ADMIN',
      workspaceRole: 'admin',
      membershipStatus: 'active',
      permissions: ['workspace.view', 'member.invite', 'inventory.view', 'inventory.products.create'],
      applicationAccess: appKey ? {
        applicationKey: 'inventory',
        role: 'member',
        branchIds: ['branch_ikeja_1'],
        permissions: ['inventory.view', 'inventory.products.create'],
      } : null,
      branchAccess: branchId ? {
        branchId: 'branch_ikeja_1',
        role: 'staff',
        permissions: ['branch.view', 'branch.sales.create'],
      } : null,
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${testWorkspaceId}/permissions/evaluate?applicationKey=inventory&branchId=branch_ikeja_1`,
      headers: getAuthHeaders(adminUserId),
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.workspaceRole, 'admin');
    assert.strictEqual(body.data.applicationAccess.role, 'member');
    assert.strictEqual(body.data.branchAccess.role, 'staff');
  });

  test('3. POST /permissions/check returns true when permission is granted', async () => {
    dataService.checkUserPermission3Tier = async (_wsId, _userId, permission) => {
      if (permission === 'inventory.products.create') {
        return { allowed: true, role: 'member', tier: 'application' };
      }
      return { allowed: false, reason: 'PERMISSION_NOT_GRANTED' };
    };

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${testWorkspaceId}/permissions/check`,
      headers: getAuthHeaders(memberUserId),
      payload: {
        permission: 'inventory.products.create',
        applicationKey: 'inventory',
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.allowed, true);
    assert.strictEqual(body.data.tier, 'application');
  });

  test('4. POST & DELETE /branch-assignments assigns and removes branch role', async () => {
    dataService.assignBranchRole = async () => ({
      id: 'assignment_123',
      success: true,
    } as any);

    dataService.removeBranchAssignment = async () => ({
      success: true,
    } as any);

    // Assign
    const postRes = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${testWorkspaceId}/branch-assignments`,
      headers: getAuthHeaders(adminUserId),
      payload: {
        userId: targetUserId,
        branchId: 'branch_vi_01',
        role: 'manager',
        reason: 'Promoted to branch manager',
      },
    });

    assert.strictEqual(postRes.statusCode, 200);
    const postBody = JSON.parse(postRes.payload);
    assert.strictEqual(postBody.success, true);
    assert.strictEqual(postBody.data.id, 'assignment_123');

    // Delete
    const delRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/workspaces/${testWorkspaceId}/branch-assignments/assignment_123`,
      headers: getAuthHeaders(adminUserId),
      payload: {
        reason: 'Transferred',
      },
    });

    assert.strictEqual(delRes.statusCode, 200);
    const delBody = JSON.parse(delRes.payload);
    assert.strictEqual(delBody.success, true);
  });

  test('5. GET /audit-logs/memberships retrieves audit log trail', async () => {
    dataService.getMembershipAuditLogs = async () => [
      {
        id: 'log_01',
        workspaceId: testWorkspaceId,
        actorUserId: adminUserId,
        actorName: 'Admin User',
        targetUserId,
        targetName: 'Target User',
        actionType: 'role_changed',
        membershipType: 'workspace',
        previousRole: 'member',
        newRole: 'admin',
        createdAt: Date.now(),
      },
    ];

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${testWorkspaceId}/audit-logs/memberships`,
      headers: getAuthHeaders(adminUserId),
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.logs.length, 1);
    assert.strictEqual(body.data.logs[0].actionType, 'role_changed');
  });
});
