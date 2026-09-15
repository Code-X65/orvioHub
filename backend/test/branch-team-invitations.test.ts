import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';
import { dataService } from '../src/services/dataService.js';
import { hasInventoryPermission, INVENTORY_ROLES, INVENTORY_PERMISSIONS } from '../src/config/inventoryRbac.js';

describe('Branch-Level Team Invitations & RBAC Test Suite', () => {
  let app: FastifyInstance;
  const ownerUserId = 'user_owner_branch_test';
  const managerUserId = 'user_manager_branch_test';
  const cashierUserId = 'user_cashier_branch_test';
  const testWorkspaceId = 'ws_branch_team_suite';
  const testBranchIdA = 'branch_lekki_hub';
  const testBranchIdB = 'branch_ikeja_mall';
  const testMembershipId = 'bm_test_mem_001';

  // Backups
  const originalGetUserById = dataService.getUserById;
  const originalListBranchMembers = dataService.listBranchMembers;
  const originalCreateWorkspaceInvitation = dataService.createWorkspaceInvitation;
  const originalTransferBranchMember = dataService.transferBranchMember;
  const originalUpdateBranchMemberRole = dataService.updateBranchMemberRole;
  const originalSetBranchMemberStatus = dataService.setBranchMemberStatus;
  const originalListBranchTransfers = dataService.listBranchTransfers;
  const originalSearchSafeUsersByEmail = dataService.searchSafeUsersByEmail;

  before(async () => {
    app = await buildApp();
    await app.ready();

    dataService.getUserById = async (id: string) => ({
      id,
      email: id === ownerUserId ? 'owner@orvio.io' : 'cashier@orvio.io',
      name: id === ownerUserId ? 'Workspace Owner' : 'Branch Cashier',
      emailVerified: true,
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as any);

    dataService.createSession = async () => ({
      sessionId: 'sess_branch_test',
      refreshToken: 'ref_branch_test',
    } as any);

    dataService.logAudit = async () => ({} as any);
  });

  after(async () => {
    dataService.getUserById = originalGetUserById;
    dataService.listBranchMembers = originalListBranchMembers;
    dataService.createWorkspaceInvitation = originalCreateWorkspaceInvitation;
    dataService.transferBranchMember = originalTransferBranchMember;
    dataService.updateBranchMemberRole = originalUpdateBranchMemberRole;
    dataService.setBranchMemberStatus = originalSetBranchMemberStatus;
    dataService.listBranchTransfers = originalListBranchTransfers;
    dataService.searchSafeUsersByEmail = originalSearchSafeUsersByEmail;
    await app.close();
  });

  const getAuthHeaders = (userId: string) => {
    const token = app.jwt.sign({
      userId,
      email: userId === ownerUserId ? 'owner@orvio.io' : 'cashier@orvio.io',
    });
    return {
      authorization: `Bearer ${token}`,
    };
  };

  // 1. RBAC Evaluator Unit Tests
  test('RBAC Permission Matrix evaluates roles and custom permissions correctly', () => {
    assert.strictEqual(INVENTORY_ROLES.INVENTORY_OWNER, 'inventory_owner');
    assert.strictEqual(INVENTORY_ROLES.CASHIER, 'cashier');
    assert.strictEqual(INVENTORY_ROLES.STOCK_MANAGER, 'stock_manager');

    // Owner has all permissions
    assert.strictEqual(hasInventoryPermission('inventory_owner', INVENTORY_PERMISSIONS.VIEW_INVENTORY), true);
    assert.strictEqual(hasInventoryPermission('inventory_owner', INVENTORY_PERMISSIONS.MANAGE_BRANCHES), true);
    assert.strictEqual(hasInventoryPermission('inventory_owner', INVENTORY_PERMISSIONS.VIEW_PROFITS), true);

    // Cashier can record sales and view selling prices, but cannot view cost prices or profits
    assert.strictEqual(hasInventoryPermission('cashier', INVENTORY_PERMISSIONS.RECORD_SALES), true);
    assert.strictEqual(hasInventoryPermission('cashier', INVENTORY_PERMISSIONS.VIEW_SELLING_PRICES), true);
    assert.strictEqual(hasInventoryPermission('cashier', INVENTORY_PERMISSIONS.VIEW_COST_PRICES), false);
    assert.strictEqual(hasInventoryPermission('cashier', INVENTORY_PERMISSIONS.VIEW_PROFITS), false);

    // Custom granted override works
    assert.strictEqual(
      hasInventoryPermission('cashier', INVENTORY_PERMISSIONS.VIEW_COST_PRICES, ['view_cost_prices']),
      true
    );
  });

  // 2. List Branch Team Members
  test('GET /api/v1/workspaces/:workspaceId/applications/inventory/team returns member directory', async () => {
    dataService.listBranchMembers = async (wsId, options) => {
      assert.strictEqual(wsId, testWorkspaceId);
      assert.strictEqual(options?.applicationKey, 'inventory');
      return [
        {
          id: testMembershipId,
          workspaceId: wsId,
          applicationKey: 'inventory',
          branchId: options?.branchId || testBranchIdA,
          branchName: 'Lekki Hub',
          userId: cashierUserId,
          user: {
            id: cashierUserId,
            name: 'Branch Cashier',
            email: 'cashier@orvio.io',
            avatar: null,
            status: 'active',
          },
          role: 'cashier',
          permissions: ['record_sales', 'process_payments'],
          status: 'active',
          assignedAt: Date.now(),
        },
      ];
    };

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${testWorkspaceId}/applications/inventory/team?branchId=${testBranchIdA}`,
      headers: getAuthHeaders(ownerUserId),
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.members.length, 1);
    assert.strictEqual(body.data.members[0].role, 'cashier');
    assert.strictEqual(body.data.members[0].branchName, 'Lekki Hub');
  });

  // 3. Invite Branch Member
  test('POST /api/v1/workspaces/:workspaceId/applications/inventory/team/invite creates branch-scoped invite', async () => {
    let capturedArgs: any = null;
    dataService.createWorkspaceInvitation = async (args) => {
      capturedArgs = args;
      return {
        id: 'inv_branch_123',
        email: args.email,
        role: args.role,
        branchId: args.branchIds?.[0],
        expiresAt: args.expiresAt,
      };
    };

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${testWorkspaceId}/applications/inventory/team/invite`,
      headers: getAuthHeaders(ownerUserId),
      payload: {
        email: 'newcashier@company.com',
        role: 'cashier',
        branchId: testBranchIdA,
      },
    });

    assert.strictEqual(res.statusCode, 201);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.invitation.email, 'newcashier@company.com');
    assert.strictEqual(body.data.invitation.role, 'cashier');
    assert.strictEqual(capturedArgs.workspaceId, testWorkspaceId);
    assert.strictEqual(capturedArgs.branchIds[0], testBranchIdA);
  });

  // 4. Atomic Branch Transfer
  test('POST /api/v1/workspaces/:workspaceId/applications/inventory/team/transfer records transfer and moves member', async () => {
    let capturedTransfer: any = null;
    dataService.transferBranchMember = async (args) => {
      capturedTransfer = args;
      return {
        membership: {
          id: args.membershipId,
          workspaceId: args.workspaceId,
          branchId: args.targetBranchId,
          role: args.newRole || 'cashier',
          status: 'active',
        },
        transferId: 'tr_log_001',
      };
    };

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${testWorkspaceId}/applications/inventory/team/transfer`,
      headers: getAuthHeaders(ownerUserId),
      payload: {
        membershipId: testMembershipId,
        targetBranchId: testBranchIdB,
        newRole: 'stock_manager',
        message: 'Promoted to stock manager at Ikeja Mall',
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.membership.branchId, testBranchIdB);
    assert.strictEqual(body.data.membership.role, 'stock_manager');
    assert.strictEqual(capturedTransfer.membershipId, testMembershipId);
    assert.strictEqual(capturedTransfer.targetBranchId, testBranchIdB);
    assert.strictEqual(capturedTransfer.newRole, 'stock_manager');
  });

  // 5. Update Branch Role
  test('PATCH /api/v1/workspaces/:workspaceId/applications/inventory/team/members/:membershipId/role updates role', async () => {
    let capturedUpdate: any = null;
    dataService.updateBranchMemberRole = async (args) => {
      capturedUpdate = args;
      return {
        id: args.membershipId,
        workspaceId: args.workspaceId,
        role: args.role,
        permissions: ['view_reports', 'export_reports'],
      };
    };

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/workspaces/${testWorkspaceId}/applications/inventory/team/members/${testMembershipId}/role`,
      headers: getAuthHeaders(ownerUserId),
      payload: {
        role: 'accountant',
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.member.role, 'accountant');
    assert.strictEqual(capturedUpdate.role, 'accountant');
  });

  // 6. Member Status (Suspend / Remove)
  test('PATCH /api/v1/workspaces/:workspaceId/applications/inventory/team/members/:membershipId/status suspends member', async () => {
    let capturedStatus: any = null;
    dataService.setBranchMemberStatus = async (args) => {
      capturedStatus = args;
      return {
        id: args.membershipId,
        workspaceId: args.workspaceId,
        status: args.status,
      };
    };

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/workspaces/${testWorkspaceId}/applications/inventory/team/members/${testMembershipId}/status`,
      headers: getAuthHeaders(ownerUserId),
      payload: {
        status: 'suspended',
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.member.status, 'suspended');
    assert.strictEqual(capturedStatus.status, 'suspended');
  });

  // 7. List Branch Transfers Log
  test('GET /api/v1/workspaces/:workspaceId/applications/inventory/team/transfers lists transfer audit entries', async () => {
    dataService.listBranchTransfers = async () => [
      {
        id: 'tr_log_001',
        userId: cashierUserId,
        userName: 'Branch Cashier',
        userEmail: 'cashier@orvio.io',
        sourceBranchId: testBranchIdA,
        sourceBranchName: 'Lekki Hub',
        targetBranchId: testBranchIdB,
        targetBranchName: 'Ikeja Mall',
        previousRole: 'cashier',
        newRole: 'stock_manager',
        transferredBy: 'Workspace Owner',
        effectiveDate: Date.now(),
        message: 'Promoted to stock manager at Ikeja Mall',
        createdAt: Date.now(),
      },
    ];

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${testWorkspaceId}/applications/inventory/team/transfers`,
      headers: getAuthHeaders(ownerUserId),
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.transfers.length, 1);
    assert.strictEqual(body.data.transfers[0].sourceBranchName, 'Lekki Hub');
    assert.strictEqual(body.data.transfers[0].targetBranchName, 'Ikeja Mall');
  });

  // 8. Safe Public User Email Search
  test('GET /api/v1/users/search returns safe profile for existing user without leaking private details', async () => {
    dataService.searchSafeUsersByEmail = async (email) => {
      if (email.toLowerCase() === 'cashier@orvio.io') {
        return {
          id: cashierUserId,
          name: 'Branch Cashier',
          avatar: null,
          exists: true,
        };
      }
      return null;
    };

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/users/search?email=cashier@orvio.io`,
      headers: getAuthHeaders(ownerUserId),
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.user.exists, true);
    assert.strictEqual(body.data.user.name, 'Branch Cashier');
    assert.strictEqual(body.data.user.password, undefined);
    assert.strictEqual(body.data.user.hashedPassword, undefined);
  });

  // 9. Symmetric Organization Routes
  test('GET /api/v1/organizations/:organizationId/applications/inventory/team functions symmetrically', async () => {
    dataService.listBranchMembers = async () => [];

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${testWorkspaceId}/applications/inventory/team`,
      headers: getAuthHeaders(ownerUserId),
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.success, true);
    assert.deepStrictEqual(body.data.members, []);
  });

  // 10. Access Context Resolution (/me/access-context)
  test('GET /api/v1/me/access-context returns accessible applications and assigned branches', async () => {
    dataService.getAccessContext = async (userId: string) => {
      return [
        {
          workspace: {
            id: testWorkspaceId,
            name: 'Code X Stores',
            role: 'member',
            status: 'active',
          },
          applications: [
            {
              key: 'inventory',
              name: 'Inventory & POS',
              status: 'active',
              role: 'cashier',
              branches: [
                {
                  id: testBranchIdA,
                  name: 'Main Store',
                  isDefault: true,
                  role: 'cashier',
                  permissions: ['inventory.view', 'inventory.record_sales'],
                },
              ],
            },
            {
              key: 'task_management',
              name: 'Task Management',
              status: 'no_access',
              branches: [],
            },
          ],
        },
      ];
    };

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/me/access-context',
      headers: getAuthHeaders(cashierUserId),
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.length, 1);
    assert.strictEqual(body.data[0].workspace.name, 'Code X Stores');
    assert.strictEqual(body.data[0].applications[0].key, 'inventory');
    assert.strictEqual(body.data[0].applications[0].branches[0].role, 'cashier');
    assert.strictEqual(body.data[0].applications[1].status, 'no_access');
  });

  // 11. Inventory Fine-Grained Context Resolution
  test('GET /api/v1/workspaces/:workspaceId/applications/inventory/context resolves branch RBAC and permissions', async () => {
    dataService.resolveInventoryContext = async ({ workspaceId, userId, branchId }) => {
      return {
        workspaceMembership: { active: true, role: 'member', status: 'active' },
        applicationMembership: { active: true, applicationKey: 'inventory', status: 'active', role: 'cashier' },
        branchMembership: {
          active: true,
          branchId,
          role: 'cashier',
          permissions: ['inventory.view', 'inventory.record_sales'],
        },
        permissions: ['inventory.view', 'inventory.record_sales'],
      };
    };

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${testWorkspaceId}/applications/inventory/context?branchId=${testBranchIdA}`,
      headers: getAuthHeaders(cashierUserId),
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.workspaceMembership.active, true);
    assert.strictEqual(body.data.applicationMembership.active, true);
    assert.strictEqual(body.data.branchMembership.active, true);
    assert.deepStrictEqual(body.data.permissions, ['inventory.view', 'inventory.record_sales']);
  });
});


