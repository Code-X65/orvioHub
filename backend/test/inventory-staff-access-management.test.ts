import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';
import { dataService } from '../src/services/dataService.js';
import { hasInventoryPermission, INVENTORY_PERMISSIONS } from '../src/config/inventoryRbac.js';

describe('Inventory Staff Access Management Test Suite', () => {
  let app: FastifyInstance;
  const ownerUserId = 'user_owner_access_test';
  const managerUserId = 'user_manager_access_test';
  const staffUserId = 'user_staff_access_test';
  const testWorkspaceId = 'ws_staff_access_suite';
  const testBranchIdA = 'branch_lekki_main';
  const testBranchIdB = 'branch_ikeja_hub';
  const testMembershipId = 'bm_staff_mem_001';

  // Backups
  const originalGetUserById = dataService.getUserById;
  const originalTransferBranchMember = dataService.transferBranchMember;
  const originalSuspendBranchMember = dataService.suspendBranchMember;
  const originalRestoreBranchMember = dataService.restoreBranchMember;
  const originalRemoveBranchMember = dataService.removeBranchMember;
  const originalRemoveInventoryMember = dataService.removeInventoryMember;
  const originalAddBranchAccess = dataService.addBranchAccess;
  const originalGetStaffAccessSummary = dataService.getStaffAccessSummary;
  const originalListBranchTransfers = dataService.listBranchTransfers;

  before(async () => {
    app = await buildApp();
    await app.ready();

    dataService.getUserById = async (id: string) =>
      ({
        id,
        email: id === ownerUserId ? 'owner@orvio.io' : 'staff@orvio.io',
        name: id === ownerUserId ? 'Workspace Owner' : 'Staff User',
        emailVerified: true,
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as any);

    dataService.createSession = async () =>
      ({
        sessionId: 'sess_staff_test',
        refreshToken: 'ref_staff_test',
      } as any);

    dataService.logAudit = async () => ({} as any);
  });

  after(async () => {
    dataService.getUserById = originalGetUserById;
    dataService.transferBranchMember = originalTransferBranchMember;
    dataService.suspendBranchMember = originalSuspendBranchMember;
    dataService.restoreBranchMember = originalRestoreBranchMember;
    dataService.removeBranchMember = originalRemoveBranchMember;
    dataService.removeInventoryMember = originalRemoveInventoryMember;
    dataService.addBranchAccess = originalAddBranchAccess;
    dataService.getStaffAccessSummary = originalGetStaffAccessSummary;
    dataService.listBranchTransfers = originalListBranchTransfers;
    await app.close();
  });

  const getAuthHeaders = (userId: string) => {
    const token = app.jwt.sign({
      userId,
      email: userId === ownerUserId ? 'owner@orvio.io' : 'staff@orvio.io',
    });
    return {
      authorization: `Bearer ${token}`,
    };
  };

  // 1. RBAC Permissions validation
  test('RBAC includes branch governance permissions', () => {
    assert.strictEqual(
      hasInventoryPermission('inventory_owner', INVENTORY_PERMISSIONS.TRANSFER_MEMBERS),
      true
    );
    assert.strictEqual(
      hasInventoryPermission('inventory_owner', INVENTORY_PERMISSIONS.SUSPEND_MEMBERS),
      true
    );
    assert.strictEqual(
      hasInventoryPermission('inventory_owner', INVENTORY_PERMISSIONS.REMOVE_MEMBERS),
      true
    );
    assert.strictEqual(
      hasInventoryPermission('inventory_owner', INVENTORY_PERMISSIONS.CHANGE_ROLES),
      true
    );

    // Manager can change roles and transfer members
    assert.strictEqual(
      hasInventoryPermission('inventory_manager', INVENTORY_PERMISSIONS.TRANSFER_MEMBERS),
      true
    );
    assert.strictEqual(
      hasInventoryPermission('inventory_manager', INVENTORY_PERMISSIONS.CHANGE_ROLES),
      true
    );

    // Cashier cannot suspend, remove, or transfer members
    assert.strictEqual(
      hasInventoryPermission('cashier', INVENTORY_PERMISSIONS.TRANSFER_MEMBERS),
      false
    );
    assert.strictEqual(
      hasInventoryPermission('cashier', INVENTORY_PERMISSIONS.SUSPEND_MEMBERS),
      false
    );
    assert.strictEqual(
      hasInventoryPermission('cashier', INVENTORY_PERMISSIONS.REMOVE_MEMBERS),
      false
    );
  });

  // 2. Transfer Staff Member
  test('POST /workspaces/:id/applications/inventory/members/:id/transfer executes transfer with audit log', async () => {
    let capturedArgs: any = null;
    dataService.transferBranchMember = async (args: any) => {
      capturedArgs = args;
      return {
        transferId: 'tr_12345',
        membershipId: args.membershipId,
        sourceBranchId: testBranchIdA,
        targetBranchId: args.targetBranchId,
        newRole: args.newRole || 'cashier',
        transferredAt: Date.now(),
      };
    };

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${testWorkspaceId}/applications/inventory/members/${testMembershipId}/transfer`,
      headers: getAuthHeaders(ownerUserId),
      payload: {
        targetBranchId: testBranchIdB,
        newRole: 'stock_manager',
        reason: 'Relocating to head stock at Ikeja Hub',
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.transferId, 'tr_12345');
    assert.strictEqual(capturedArgs.targetBranchId, testBranchIdB);
    assert.strictEqual(capturedArgs.newRole, 'stock_manager');
    assert.strictEqual(capturedArgs.reason, 'Relocating to head stock at Ikeja Hub');
  });

  // 3. Suspend Staff Member Access
  test('POST /workspaces/:id/applications/inventory/members/:id/suspend suspends branch access with reason', async () => {
    let capturedArgs: any = null;
    dataService.suspendBranchMember = async (args: any) => {
      capturedArgs = args;
      return {
        membershipId: args.membershipId,
        status: 'suspended',
        suspendedAt: Date.now(),
        suspensionReason: args.reason,
      };
    };

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${testWorkspaceId}/applications/inventory/members/${testMembershipId}/suspend`,
      headers: getAuthHeaders(ownerUserId),
      payload: {
        reason: 'Temporary investigation of cash register variance',
        suspendAllBranches: false,
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.status, 'suspended');
    assert.strictEqual(capturedArgs.reason, 'Temporary investigation of cash register variance');
    assert.strictEqual(capturedArgs.suspendAllBranches, false);
  });

  // 4. Restore Staff Member Access
  test('POST /workspaces/:id/applications/inventory/members/:id/restore restores active access', async () => {
    let capturedArgs: any = null;
    dataService.restoreBranchMember = async (args: any) => {
      capturedArgs = args;
      return {
        membershipId: args.membershipId,
        status: 'active',
        restoredAt: Date.now(),
      };
    };

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${testWorkspaceId}/applications/inventory/members/${testMembershipId}/restore`,
      headers: getAuthHeaders(ownerUserId),
    });

    assert.strictEqual(res.statusCode, 200);
    const body = res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.status, 'active');
    assert.strictEqual(capturedArgs.membershipId, testMembershipId);
  });

  // 5. Add Branch Access
  test('POST /workspaces/:id/applications/inventory/members/:id/branches grants branch access', async () => {
    let capturedArgs: any = null;
    dataService.addBranchAccess = async (args: any) => {
      capturedArgs = args;
      return {
        membershipId: 'bm_new_access_002',
        branchId: args.branchId,
        role: args.roleOverride || 'cashier',
        status: 'active',
      };
    };

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${testWorkspaceId}/applications/inventory/members/${testMembershipId}/branches`,
      headers: getAuthHeaders(ownerUserId),
      payload: {
        branchId: testBranchIdB,
        role: 'cashier',
        userId: staffUserId,
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.branchId, testBranchIdB);
    assert.strictEqual(capturedArgs.branchId, testBranchIdB);
  });

  // 6. Remove Staff from Branch (Non-destructive)
  test('DELETE /workspaces/:id/applications/inventory/members/:id removes staff from branch only', async () => {
    let capturedArgs: any = null;
    dataService.removeBranchMember = async (args: any) => {
      capturedArgs = args;
      return {
        membershipId: args.membershipId,
        status: 'removed',
        removedAt: Date.now(),
        reason: args.reason,
      };
    };

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/workspaces/${testWorkspaceId}/applications/inventory/members/${testMembershipId}`,
      headers: getAuthHeaders(ownerUserId),
      payload: {
        reason: 'Shift reassignment completed',
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(capturedArgs.reason, 'Shift reassignment completed');
  });

  // 7. Remove Staff from Inventory (Preserves Workspace Membership)
  test('DELETE /workspaces/:id/applications/inventory/members/:id/inventory removes staff from inventory app while keeping workspace', async () => {
    let capturedArgs: any = null;
    dataService.removeInventoryMember = async (args: any) => {
      capturedArgs = args;
      return {
        membershipId: args.membershipId,
        applicationKey: 'inventory',
        status: 'removed',
        removedAt: Date.now(),
        workspaceMembershipPreserved: true,
      };
    };

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/workspaces/${testWorkspaceId}/applications/inventory/members/${testMembershipId}/inventory`,
      headers: getAuthHeaders(ownerUserId),
      payload: {
        reason: 'Leaving inventory department for marketing',
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.workspaceMembershipPreserved, true);
    assert.strictEqual(capturedArgs.reason, 'Leaving inventory department for marketing');
  });

  // 8. Staff Access Summary Evaluation
  test('GET /workspaces/:id/applications/inventory/members/:id/access returns complete access evaluation', async () => {
    dataService.getStaffAccessSummary = async () => ({
      user: {
        id: staffUserId,
        name: 'Staff User',
        email: 'staff@orvio.io',
      },
      workspaceMembership: {
        workspaceId: testWorkspaceId,
        role: 'MEMBER',
        status: 'active',
      },
      applicationMembership: {
        applicationKey: 'inventory',
        role: 'member',
        status: 'active',
      },
      branches: [
        {
          branchId: testBranchIdA,
          branchName: 'Lekki Main Store',
          branchCode: 'LK-01',
          status: 'active',
          role: 'cashier',
          permissions: ['inventory.record_sales', 'inventory.view_inventory'],
        },
      ],
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${testWorkspaceId}/applications/inventory/members/${testMembershipId}/access`,
      headers: getAuthHeaders(ownerUserId),
    });

    assert.strictEqual(res.statusCode, 200);
    const body = res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.workspaceMembership.role, 'MEMBER');
    assert.strictEqual(body.data.branches.length, 1);
    assert.strictEqual(body.data.branches[0].branchName, 'Lekki Main Store');
  });
});
