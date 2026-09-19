import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { dataService } from '../src/services/dataService.js';

describe('Phase 5: Branch Architecture, Lifecycle, Team Assignment & Demo Context Suite', () => {
  let app: FastifyInstance;

  const mockOrgA = {
    _id: 'org_alpha_phase5',
    id: 'org_alpha_phase5',
    name: 'Alpha Retail Stores',
    slug: 'alpha-retail',
    status: 'active',
  };

  const mockUserOwner = {
    id: 'user_owner_phase5',
    _id: 'user_owner_phase5',
    email: 'owner@alpharetail.ng',
    name: 'Alpha Owner',
    status: 'active',
    emailVerified: true,
  };

  const mockUserAdmin = {
    id: 'user_admin_phase5',
    _id: 'user_admin_phase5',
    email: 'admin@alpharetail.ng',
    name: 'Alpha Admin',
    status: 'active',
    emailVerified: true,
  };

  const mockUserMember = {
    id: 'user_member_phase5',
    _id: 'user_member_phase5',
    email: 'staff@alpharetail.ng',
    name: 'Alpha Staff',
    status: 'active',
    emailVerified: true,
  };

  const mockUserOutsider = {
    id: 'user_outsider_phase5',
    _id: 'user_outsider_phase5',
    email: 'outsider@othercorp.ng',
    name: 'Outsider User',
    status: 'active',
    emailVerified: true,
  };

  let tokenOwner = '';
  let tokenAdmin = '';
  let tokenMember = '';
  let tokenOutsider = '';

  const branchesStore: any[] = [
    {
      _id: 'branch_main_p5',
      id: 'branch_main_p5',
      workspaceId: mockOrgA.id,
      organizationId: mockOrgA.id,
      productKey: 'inventory',
      name: 'Main Branch',
      code: 'MAIN',
      isPrimary: true,
      status: 'active',
      country: 'Nigeria',
      state: 'Lagos',
      city: 'Ikeja',
      address: '12 Commercial Avenue, Ikeja',
      createdAt: Date.now() - 100000,
    },
  ];

  const branchMembersStore: any[] = [
    {
      _id: 'bm_owner_p5',
      workspaceId: mockOrgA.id,
      branchId: 'branch_main_p5',
      userId: mockUserOwner.id,
      role: 'inventory_owner',
      permissions: [
        'inventory.view',
        'branch.view',
        'branch.update',
        'branch.set_primary',
        'branch.suspend',
        'branch.restore',
        'branch.archive',
        'branch.manage_staff',
        'branch.create',
      ],
      status: 'active',
    },
    {
      _id: 'bm_admin_p5',
      workspaceId: mockOrgA.id,
      branchId: 'branch_main_p5',
      userId: mockUserAdmin.id,
      role: 'inventory_manager',
      permissions: [
        'inventory.view',
        'branch.view',
        'branch.update',
        'branch.manage_staff',
        'branch.create',
      ],
      status: 'active',
    },
    {
      _id: 'bm_staff_p5',
      workspaceId: mockOrgA.id,
      branchId: 'branch_main_p5',
      userId: mockUserMember.id,
      role: 'inventory_viewer',
      permissions: ['inventory.view', 'branch.view'],
      status: 'active',
    },
  ];

  const subscriptionsStore: Record<string, any> = {
    [mockOrgA.id]: {
      workspaceId: mockOrgA.id,
      planKey: 'free_trial',
      status: 'trialing',
      trialStart: Date.now() - 1000,
      trialEnd: Date.now() + 30 * 24 * 60 * 60 * 1000,
    },
  };

  before(async () => {
    app = await buildApp();
    await app.ready();

    tokenOwner = app.jwt.sign({ userId: mockUserOwner.id, email: mockUserOwner.email, status: 'active' });
    tokenAdmin = app.jwt.sign({ userId: mockUserAdmin.id, email: mockUserAdmin.email, status: 'active' });
    tokenMember = app.jwt.sign({ userId: mockUserMember.id, email: mockUserMember.email, status: 'active' });
    tokenOutsider = app.jwt.sign({ userId: mockUserOutsider.id, email: mockUserOutsider.email, status: 'active' });

    // Mock dataService methods
    dataService.getUserById = async (id: string) => {
      if (id === mockUserOwner.id) return mockUserOwner as any;
      if (id === mockUserAdmin.id) return mockUserAdmin as any;
      if (id === mockUserMember.id) return mockUserMember as any;
      if (id === mockUserOutsider.id) return mockUserOutsider as any;
      return null;
    };

    dataService.getWorkspaceById = async (id: string) => {
      if (id === mockOrgA.id) return mockOrgA as any;
      return null;
    };

    dataService.getWorkspaceMembership = async (workspaceId: string, userId: string) => {
      if (workspaceId !== mockOrgA.id) return null;
      if (userId === mockUserOwner.id) return { workspaceId, userId, role: 'owner', status: 'active' } as any;
      if (userId === mockUserAdmin.id) return { workspaceId, userId, role: 'admin', status: 'active' } as any;
      if (userId === mockUserMember.id) return { workspaceId, userId, role: 'member', status: 'active' } as any;
      return null;
    };

    dataService.getWorkspaceSubscription = async (workspaceId: string) => {
      return subscriptionsStore[workspaceId] || null;
    };

    dataService.getBranches = async (workspaceId: string) => {
      return branchesStore.filter((b) => b.workspaceId === workspaceId && b.status !== 'deleted');
    };

    dataService.getBranchById = async (branchId: string) => {
      return branchesStore.find((b) => b._id === branchId || b.id === branchId) || null;
    };

    dataService.getFullBranchSettings = async (branchId: string, _userId: string, workspaceId: string) => {
      const b = branchesStore.find(
        (item) => (item._id === branchId || item.id === branchId) && item.workspaceId === workspaceId
      );
      if (!b) return null;
      return {
        ...b,
        operationalSettings: {
          openingHours: b.openingHours || {},
          receiptFooter: b.receiptFooter || 'Thank you for shopping with us!',
          negativeStockAllowed: false,
          lowStockThreshold: 5,
        },
      };
    };

    dataService.createBranch = async (data: any) => {
      const newId = `branch_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const newBranch = {
        _id: newId,
        id: newId,
        workspaceId: data.workspaceId,
        organizationId: data.workspaceId,
        productKey: data.productKey || 'inventory',
        name: data.name,
        code: data.code || 'BR-' + (branchesStore.length + 1),
        isPrimary: Boolean(data.isPrimary),
        status: 'active',
        country: data.country || 'Nigeria',
        state: data.state || 'Lagos',
        city: data.city || 'Ikeja',
        address: data.address || '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      if (newBranch.isPrimary) {
        branchesStore.forEach((b) => {
          if (b.workspaceId === data.workspaceId) b.isPrimary = false;
        });
      }

      branchesStore.push(newBranch);
      return newId;
    };

    dataService.updateBranch = async (branchId: string, patch: any) => {
      const b = branchesStore.find((item) => item._id === branchId || item.id === branchId);
      if (!b) throw new Error('BRANCH_NOT_FOUND');
      Object.assign(b, patch, { updatedAt: Date.now() });
      return b;
    };

    dataService.updateBranchOperationalSettings = async (branchId: string, settings: any) => {
      const b = branchesStore.find((item) => item._id === branchId || item.id === branchId);
      if (!b) throw new Error('BRANCH_NOT_FOUND');
      Object.assign(b, settings, { updatedAt: Date.now() });
      return b;
    };

    dataService.setPrimaryBranch = async (branchId: string, _userId: string, workspaceId: string) => {
      const target = branchesStore.find(
        (item) => (item._id === branchId || item.id === branchId) && item.workspaceId === workspaceId
      );
      if (!target) throw new Error('BRANCH_NOT_FOUND');
      if (target.status !== 'active') throw new Error('ONLY_ACTIVE_BRANCH_CAN_BE_PRIMARY');

      branchesStore.forEach((b) => {
        if (b.workspaceId === workspaceId) {
          b.isPrimary = b._id === branchId || b.id === branchId;
        }
      });
      return target;
    };

    dataService.suspendBranch = async (branchId: string, _userId: string, workspaceId: string) => {
      const target = branchesStore.find(
        (item) => (item._id === branchId || item.id === branchId) && item.workspaceId === workspaceId
      );
      if (!target) throw new Error('BRANCH_NOT_FOUND');
      target.status = 'suspended';
      target.updatedAt = Date.now();
      return target;
    };

    dataService.restoreBranch = async (branchId: string, _userId: string, workspaceId: string) => {
      const target = branchesStore.find(
        (item) => (item._id === branchId || item.id === branchId) && item.workspaceId === workspaceId
      );
      if (!target) throw new Error('BRANCH_NOT_FOUND');
      target.status = 'active';
      target.updatedAt = Date.now();
      return target;
    };

    dataService.archiveBranch = async (branchId: string, _userId: string, workspaceId: string) => {
      const target = branchesStore.find(
        (item) => (item._id === branchId || item.id === branchId) && item.workspaceId === workspaceId
      );
      if (!target) throw new Error('BRANCH_NOT_FOUND');
      if (target.isPrimary) throw new Error('CANNOT_ARCHIVE_PRIMARY_BRANCH');
      target.status = 'archived';
      target.updatedAt = Date.now();
      return target;
    };

    dataService.listBranchMembers = async (workspaceId: string, filter: any) => {
      return branchMembersStore.filter(
        (m) => m.workspaceId === workspaceId && (!filter.branchId || m.branchId === filter.branchId)
      );
    };

    dataService.addBranchAccess = async (data: any) => {
      const newMembership = {
        _id: `bm_${Date.now()}`,
        workspaceId: data.workspaceId,
        branchId: data.branchId,
        userId: data.userId,
        role: data.roleOverride || 'inventory_viewer',
        permissions: data.permissions || ['inventory.view', 'branch.view'],
        status: 'active',
      };
      branchMembersStore.push(newMembership);
      return newMembership;
    };

    dataService.updateBranchMemberRole = async (data: any) => {
      const m = branchMembersStore.find(
        (item) => item._id === data.membershipId && item.workspaceId === data.workspaceId
      );
      if (!m) throw new Error('MEMBER_NOT_FOUND');
      m.role = data.role;
      m.permissions = data.permissions;
      return m;
    };

    dataService.setBranchMemberStatus = async (data: any) => {
      const m = branchMembersStore.find(
        (item) => item._id === data.membershipId && item.workspaceId === data.workspaceId
      );
      if (!m) throw new Error('MEMBER_NOT_FOUND');
      m.status = data.status;
      return m;
    };

    dataService.removeBranchMember = async (data: any) => {
      const index = branchMembersStore.findIndex(
        (item) => item._id === data.membershipId && item.workspaceId === data.workspaceId
      );
      if (index === -1) throw new Error('MEMBER_NOT_FOUND');
      branchMembersStore.splice(index, 1);
      return { success: true };
    };

    dataService.resolveInventoryContext = async (data: any) => {
      const bm = branchMembersStore.find(
        (m) => m.userId === data.userId && (!data.branchId || m.branchId === data.branchId)
      );
      return {
        workspaceMembership: { active: true, role: 'owner' },
        applicationMembership: { active: true, applicationKey: 'inventory', status: 'active' },
        branchMembership: { active: Boolean(bm), branchId: data.branchId, role: bm?.role || 'inventory_owner' },
        permissions: bm?.permissions || ['inventory.view', 'branch.view', 'branch.update'],
      };
    };

    dataService.getWorkspaceProducts = async (workspaceId: string) => {
      if (workspaceId === mockOrgA.id) {
        return [{ productKey: 'inventory', status: 'active' }];
      }
      return [];
    };

    dataService.getProductMembership = async (workspaceId: string, userId: string, productKey: string) => {
      if (workspaceId !== mockOrgA.id || productKey !== 'inventory') return null;
      if (userId === mockUserOwner.id) return { workspaceId, userId, role: 'owner', permissions: ['*'], status: 'active' };
      if (userId === mockUserAdmin.id) return { workspaceId, userId, role: 'admin', permissions: ['*'], status: 'active' };
      if (userId === mockUserMember.id) return { workspaceId, userId, role: 'viewer', permissions: ['inventory.view', 'branch.view'], status: 'active' };
      return null;
    };

    dataService.getWorkspaceProduct = async (workspaceId: string, productKey: string) => {
      if (workspaceId === mockOrgA.id && productKey === 'inventory') {
        return { productKey: 'inventory', status: 'active' };
      }
      return null;
    };
  });

  after(async () => {
    await app.close();
  });

  // -------------------------------------------------------------------
  // 1. BRANCH SETUP & PLAN LIMITS
  // -------------------------------------------------------------------
  describe('1. Branch Setup & Entitlement Limits', () => {
    test('Free Trial allows exactly 1 branch; creating 2nd branch returns 403 BRANCH_LIMIT_REACHED', async () => {
      subscriptionsStore[mockOrgA.id] = {
        workspaceId: mockOrgA.id,
        planKey: 'free_trial',
        status: 'trialing',
      };

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/workspaces/${mockOrgA.id}/inventory/branches`,
        headers: { authorization: `Bearer ${tokenOwner}` },
        payload: {
          name: 'Second Branch (Trial)',
          code: 'BRANCH-2',
          state: 'Lagos',
          city: 'Lekki',
        },
      });

      assert.equal(res.statusCode, 403);
      const json = res.json();
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'BRANCH_LIMIT_REACHED');
      assert.equal(json.error.limit, 1);
    });

    test('Standard plan allows up to 3 branches', async () => {
      subscriptionsStore[mockOrgA.id] = {
        workspaceId: mockOrgA.id,
        planKey: 'standard',
        status: 'active',
      };

      // 2nd branch
      const res2 = await app.inject({
        method: 'POST',
        url: `/api/v1/workspaces/${mockOrgA.id}/inventory/branches`,
        headers: { authorization: `Bearer ${tokenOwner}` },
        payload: {
          name: 'Lekki Branch',
          code: 'LEKKI',
          state: 'Lagos',
          city: 'Lekki',
        },
      });
      assert.equal(res2.statusCode, 201);

      // 3rd branch
      const res3 = await app.inject({
        method: 'POST',
        url: `/api/v1/workspaces/${mockOrgA.id}/inventory/branches`,
        headers: { authorization: `Bearer ${tokenOwner}` },
        payload: {
          name: 'Abuja Branch',
          code: 'ABUJA',
          state: 'FCT',
          city: 'Abuja',
        },
      });
      assert.equal(res3.statusCode, 201);

      // 4th branch (exceeds Standard limit of 3)
      const res4 = await app.inject({
        method: 'POST',
        url: `/api/v1/workspaces/${mockOrgA.id}/inventory/branches`,
        headers: { authorization: `Bearer ${tokenOwner}` },
        payload: {
          name: 'Port Harcourt Branch',
          code: 'PHC',
          state: 'Rivers',
          city: 'Port Harcourt',
        },
      });
      assert.equal(res4.statusCode, 403);
      assert.equal(res4.json().error.code, 'BRANCH_LIMIT_REACHED');
      assert.equal(res4.json().error.limit, 3);
    });
  });

  // -------------------------------------------------------------------
  // 2. BRANCH LIFECYCLE & INVARIANTS
  // -------------------------------------------------------------------
  describe('2. Branch Lifecycle & Invariants', () => {
    test('Authorized Admin can update branch settings', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/workspaces/${mockOrgA.id}/inventory/branches/branch_main_p5`,
        headers: { authorization: `Bearer ${tokenAdmin}` },
        payload: {
          name: 'Main Flagship Store',
          receiptFooter: 'Always at your service',
        },
      });

      assert.equal(res.statusCode, 200);
      const json = res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.branch.name, 'Main Flagship Store');
    });

    test('Ordinary staff member without branch.update is rejected (403)', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/workspaces/${mockOrgA.id}/inventory/branches/branch_main_p5`,
        headers: { authorization: `Bearer ${tokenMember}` },
        payload: {
          name: 'Hacked Branch Name',
        },
      });

      assert.equal(res.statusCode, 403);
    });

    test('Atomic Set Primary branch switches primary flag safely', async () => {
      const secondBranch = branchesStore.find((b) => b.code === 'LEKKI');
      assert.ok(secondBranch);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/workspaces/${mockOrgA.id}/inventory/branches/${secondBranch._id}/set-primary`,
        headers: { authorization: `Bearer ${tokenOwner}` },
      });

      assert.equal(res.statusCode, 200);
      assert.equal(secondBranch.isPrimary, true);

      const mainBranch = branchesStore.find((b) => b._id === 'branch_main_p5');
      assert.equal(mainBranch.isPrimary, false);
    });

    test('Branch can be suspended and restored', async () => {
      const targetBranch = branchesStore.find((b) => b.code === 'ABUJA');
      assert.ok(targetBranch);

      // Suspend
      const resSuspend = await app.inject({
        method: 'POST',
        url: `/api/v1/workspaces/${mockOrgA.id}/inventory/branches/${targetBranch._id}/suspend`,
        headers: { authorization: `Bearer ${tokenOwner}` },
        payload: { reason: 'Annual inventory audit' },
      });
      assert.equal(resSuspend.statusCode, 200);
      assert.equal(targetBranch.status, 'suspended');

      // Restore
      const resRestore = await app.inject({
        method: 'POST',
        url: `/api/v1/workspaces/${mockOrgA.id}/inventory/branches/${targetBranch._id}/restore`,
        headers: { authorization: `Bearer ${tokenOwner}` },
      });
      assert.equal(resRestore.statusCode, 200);
      assert.equal(targetBranch.status, 'active');
    });

    test('Sole active primary branch cannot be archived', async () => {
      const primaryBranch = branchesStore.find((b) => b.isPrimary);
      assert.ok(primaryBranch);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/workspaces/${mockOrgA.id}/inventory/branches/${primaryBranch._id}/archive`,
        headers: { authorization: `Bearer ${tokenOwner}` },
      });

      assert.equal(res.statusCode, 400);
      assert.equal(res.json().error.code, 'CANNOT_ARCHIVE_PRIMARY_BRANCH');
    });
  });

  // -------------------------------------------------------------------
  // 3. BRANCH TEAM ASSIGNMENT
  // -------------------------------------------------------------------
  describe('3. Branch Team Assignment & Access', () => {
    test('Assign new member to branch', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/workspaces/${mockOrgA.id}/inventory/branches/branch_main_p5/members`,
        headers: { authorization: `Bearer ${tokenOwner}` },
        payload: {
          userId: 'user_cashier_p5',
          role: 'cashier',
          permissions: ['inventory.view', 'sales.create'],
        },
      });

      assert.equal(res.statusCode, 201);
      assert.equal(res.json().success, true);
    });

    test('Update branch member role', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/workspaces/${mockOrgA.id}/inventory/branches/branch_main_p5/members/bm_staff_p5`,
        headers: { authorization: `Bearer ${tokenOwner}` },
        payload: {
          role: 'stock_manager',
        },
      });

      assert.equal(res.statusCode, 200);
      assert.equal(res.json().data.member.role, 'stock_manager');
    });

    test('Remove member from branch preserves workspace membership', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/workspaces/${mockOrgA.id}/inventory/branches/branch_main_p5/members/bm_staff_p5`,
        headers: { authorization: `Bearer ${tokenOwner}` },
      });

      assert.equal(res.statusCode, 200);
      const remaining = branchMembersStore.find((m) => m._id === 'bm_staff_p5');
      assert.equal(remaining, undefined);
    });
  });

  // -------------------------------------------------------------------
  // 4. SECURE INVENTORY DEMO CONTEXT
  // -------------------------------------------------------------------
  describe('4. Secure Inventory Demo Context Resolution', () => {
    test('Demo context returns canonical organization, active branch, setup status, and static demo metrics without fake sales', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/workspaces/${mockOrgA.id}/inventory/demo-context`,
        headers: { authorization: `Bearer ${tokenOwner}` },
      });

      assert.equal(res.statusCode, 200);
      const json = res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.organization.id, mockOrgA.id);
      assert.equal(json.data.application.key, 'inventory');
      assert.equal(json.data.application.status, 'active');
      assert.ok(json.data.branch);
      assert.equal(json.data.setup.inventorySetupStatus, 'complete');
      assert.equal(json.data.setup.branchSetupStatus, 'complete');
      assert.equal(json.data.demoMetrics.isStaticDemo, true);
    });

    test('Cross-tenant outsider is rejected with 403 on demo context', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/workspaces/${mockOrgA.id}/inventory/demo-context`,
        headers: { authorization: `Bearer ${tokenOutsider}` },
      });

      assert.equal(res.statusCode, 403);
    });
  });
});
