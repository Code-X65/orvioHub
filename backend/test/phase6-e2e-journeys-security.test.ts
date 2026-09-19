import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { dataService } from '../src/services/dataService.js';
import { PLAN_LIMITS } from '../src/config/planLimits.js';

describe('Phase 6: End-to-End User Journeys, Integration & Security Matrix Suite', () => {
  let app: FastifyInstance;

  const mockUsers = {
    ownerA: { id: 'usr_owner_a', _id: 'usr_owner_a', email: 'owner.a@example.ng', name: 'Owner A', status: 'active', emailVerified: true },
    adminA: { id: 'usr_admin_a', _id: 'usr_admin_a', email: 'admin.a@example.ng', name: 'Admin A', status: 'active', emailVerified: true },
    memberA: { id: 'usr_member_a', _id: 'usr_member_a', email: 'member.a@example.ng', name: 'Member A', status: 'active', emailVerified: true },
    ownerB: { id: 'usr_owner_b', _id: 'usr_owner_b', email: 'owner.b@example.ng', name: 'Owner B', status: 'active', emailVerified: true },
    superadmin: { id: 'usr_superadmin', _id: 'usr_superadmin', email: 'super@orviohub.com', name: 'Platform Superadmin', status: 'active', role: 'superadmin', emailVerified: true },
  };

  const tokens: Record<string, string> = {};

  const state = {
    organizations: [] as any[],
    memberships: [] as any[],
    subscriptions: {} as Record<string, any>,
    branches: [] as any[],
    branchMembers: [] as any[],
    auditLogs: [] as any[],
    notifications: [] as any[],
  };

  before(async () => {
    app = await buildApp();
    await app.ready();

    // Generate JWT tokens
    for (const [key, user] of Object.entries(mockUsers)) {
      tokens[key] = app.jwt.sign({ userId: user.id, email: user.email, status: user.status });
    }

    // Mock dataService
    dataService.getUserById = async (id: string) => {
      return Object.values(mockUsers).find((u) => u.id === id) || null as any;
    };

    dataService.getWorkspaceById = async (id: string) => {
      return state.organizations.find((o) => o._id === id || o.id === id) || null;
    };

    dataService.getWorkspaceMembership = async (workspaceId: string, userId: string) => {
      const m = state.memberships.find((mem) => (mem.workspaceId === workspaceId || mem.organizationId === workspaceId) && mem.userId === userId);
      return m || null;
    };

    dataService.getWorkspaceSubscription = async (workspaceId: string) => {
      return state.subscriptions[workspaceId] || null;
    };

    dataService.getBranches = async (workspaceId: string) => {
      return state.branches.filter((b) => (b.workspaceId === workspaceId || b.organizationId === workspaceId) && b.status !== 'deleted');
    };

    dataService.getBranchById = async (branchId: string) => {
      return state.branches.find((b) => b._id === branchId || b.id === branchId) || null;
    };

    dataService.getFullBranchSettings = async (branchId: string, _userId?: string, workspaceId?: string) => {
      const b = state.branches.find((item) => (item._id === branchId || item.id === branchId) && (!workspaceId || item.workspaceId === workspaceId || item.organizationId === workspaceId));
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
      const newId = `br_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const newBranch = {
        _id: newId,
        id: newId,
        workspaceId: data.workspaceId,
        organizationId: data.workspaceId,
        productKey: data.productKey || 'inventory',
        name: data.name,
        code: data.code || 'BR-' + (state.branches.length + 1),
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
        state.branches.forEach((b) => {
          if (b.workspaceId === data.workspaceId || b.organizationId === data.workspaceId) {
            b.isPrimary = false;
          }
        });
      }

      state.branches.push(newBranch);
      return newId;
    };

    dataService.updateBranch = async (branchId: string, patch: any) => {
      const b = state.branches.find((item) => item._id === branchId || item.id === branchId);
      if (!b) throw new Error('BRANCH_NOT_FOUND');
      Object.assign(b, patch, { updatedAt: Date.now() });
      return b;
    };

    dataService.updateBranchOperationalSettings = async (branchId: string, settings: any) => {
      const b = state.branches.find((item) => item._id === branchId || item.id === branchId);
      if (!b) throw new Error('BRANCH_NOT_FOUND');
      Object.assign(b, settings, { updatedAt: Date.now() });
      return b;
    };

    dataService.setPrimaryBranch = async (branchId: string, _userId: string, workspaceId: string) => {
      const target = state.branches.find((item) => (item._id === branchId || item.id === branchId) && (item.workspaceId === workspaceId || item.organizationId === workspaceId));
      if (!target) throw new Error('BRANCH_NOT_FOUND');
      if (target.status !== 'active') throw new Error('ONLY_ACTIVE_BRANCH_CAN_BE_PRIMARY');

      state.branches.forEach((b) => {
        if (b.workspaceId === workspaceId || b.organizationId === workspaceId) {
          b.isPrimary = b._id === branchId || b.id === branchId;
        }
      });
      return target;
    };

    dataService.suspendBranch = async (branchId: string, _userId: string, workspaceId: string) => {
      const target = state.branches.find((item) => (item._id === branchId || item.id === branchId) && (item.workspaceId === workspaceId || item.organizationId === workspaceId));
      if (!target) throw new Error('BRANCH_NOT_FOUND');
      target.status = 'suspended';
      target.updatedAt = Date.now();
      return target;
    };

    dataService.restoreBranch = async (branchId: string, _userId: string, workspaceId: string) => {
      const target = state.branches.find((item) => (item._id === branchId || item.id === branchId) && (item.workspaceId === workspaceId || item.organizationId === workspaceId));
      if (!target) throw new Error('BRANCH_NOT_FOUND');
      target.status = 'active';
      target.updatedAt = Date.now();
      return target;
    };

    dataService.archiveBranch = async (branchId: string, _userId: string, workspaceId: string) => {
      const target = state.branches.find((item) => (item._id === branchId || item.id === branchId) && (item.workspaceId === workspaceId || item.organizationId === workspaceId));
      if (!target) throw new Error('BRANCH_NOT_FOUND');
      if (target.isPrimary) throw new Error('CANNOT_ARCHIVE_PRIMARY_BRANCH');
      target.status = 'archived';
      target.updatedAt = Date.now();
      return target;
    };

    dataService.listBranchMembers = async (workspaceId: string, filter: any) => {
      return state.branchMembers.filter(
        (m) => (m.workspaceId === workspaceId || m.organizationId === workspaceId) && (!filter.branchId || m.branchId === filter.branchId)
      );
    };

    dataService.addBranchAccess = async (data: any) => {
      const newMembership = {
        _id: `bm_${Date.now()}`,
        workspaceId: data.workspaceId,
        organizationId: data.workspaceId,
        branchId: data.branchId,
        userId: data.userId,
        role: data.roleOverride || 'inventory_viewer',
        permissions: data.permissions || ['inventory.view', 'branch.view'],
        status: 'active',
      };
      state.branchMembers.push(newMembership);
      return newMembership;
    };

    dataService.updateBranchMemberRole = async (data: any) => {
      const m = state.branchMembers.find((item) => item._id === data.membershipId && (item.workspaceId === data.workspaceId || item.organizationId === data.workspaceId));
      if (!m) throw new Error('MEMBER_NOT_FOUND');
      m.role = data.role;
      m.permissions = data.permissions;
      return m;
    };

    dataService.setBranchMemberStatus = async (data: any) => {
      const m = state.branchMembers.find((item) => item._id === data.membershipId && (item.workspaceId === data.workspaceId || item.organizationId === data.workspaceId));
      if (!m) throw new Error('MEMBER_NOT_FOUND');
      m.status = data.status;
      return m;
    };

    dataService.removeBranchMember = async (data: any) => {
      const index = state.branchMembers.findIndex((item) => item._id === data.membershipId && (item.workspaceId === data.workspaceId || item.organizationId === data.workspaceId));
      if (index === -1) throw new Error('MEMBER_NOT_FOUND');
      state.branchMembers.splice(index, 1);
      return { success: true };
    };

    dataService.resolveInventoryContext = async (data: any) => {
      const bm = state.branchMembers.find((m) => m.userId === data.userId && (!data.branchId || m.branchId === data.branchId));
      return {
        workspaceMembership: { active: true, role: 'owner' },
        applicationMembership: { active: true, applicationKey: 'inventory', status: 'active' },
        branchMembership: { active: Boolean(bm), branchId: data.branchId, role: bm?.role || 'inventory_owner' },
        permissions: bm?.permissions || ['inventory.view', 'branch.view', 'branch.update'],
      };
    };

    dataService.getWorkspaceProducts = async (workspaceId: string) => {
      const org = state.organizations.find((o) => o._id === workspaceId || o.id === workspaceId);
      if (org) {
        return [{ productKey: 'inventory', status: 'active' }];
      }
      return [];
    };

    dataService.getProductMembership = async (workspaceId: string, userId: string, productKey: string) => {
      if (productKey !== 'inventory') return null;
      const mem = state.memberships.find((m) => (m.workspaceId === workspaceId || m.organizationId === workspaceId) && m.userId === userId);
      if (!mem) return null;
      return {
        workspaceId,
        userId,
        role: mem.role,
        permissions: mem.role === 'owner' || mem.role === 'admin' ? ['*'] : ['inventory.view', 'branch.view'],
        status: 'active',
      };
    };

    dataService.getWorkspaceProduct = async (workspaceId: string, productKey: string) => {
      if (productKey === 'inventory') {
        return { productKey: 'inventory', status: 'active' };
      }
      return null;
    };

    dataService.logAudit = async (data: any) => {
      state.auditLogs.push({ ...data, createdAt: Date.now() });
      return `audit_${Date.now()}`;
    };
  });

  after(async () => {
    await app.close();
  });

  // -------------------------------------------------------------------
  // JOURNEY A: NEW ORGANIZATION ONBOARDING
  // -------------------------------------------------------------------
  describe('Journey A: New Organization Onboarding & Provisioning', () => {
    test('Verified user creates organization, receives 30-day Free Trial and auto-created MAIN branch', async () => {
      const orgId = 'org_e2e_alpha';
      const newOrg = {
        _id: orgId,
        id: orgId,
        name: 'Alpha Mega Mart',
        slug: 'alpha-mega-mart',
        country: 'Nigeria',
        currency: 'NGN',
        timezone: 'Africa/Lagos',
        status: 'active',
        ownerId: mockUsers.ownerA.id,
      };
      state.organizations.push(newOrg);

      // Owner membership
      state.memberships.push({
        _id: `mem_${orgId}_owner`,
        workspaceId: orgId,
        organizationId: orgId,
        userId: mockUsers.ownerA.id,
        role: 'owner',
        status: 'active',
      });

      // 30-Day Free Trial Subscription
      const now = Date.now();
      state.subscriptions[orgId] = {
        workspaceId: orgId,
        organizationId: orgId,
        planKey: 'free_trial',
        status: 'trialing',
        trialStart: now,
        trialEnd: now + 30 * 24 * 60 * 60 * 1000,
      };

      // Auto-created MAIN branch
      state.branches.push({
        _id: `br_${orgId}_main`,
        id: `br_${orgId}_main`,
        workspaceId: orgId,
        organizationId: orgId,
        productKey: 'inventory',
        name: 'Main Branch',
        code: 'MAIN',
        isPrimary: true,
        status: 'active',
        country: 'Nigeria',
        state: 'Lagos',
        city: 'Ikeja',
        createdAt: now,
      });

      // Branch membership
      state.branchMembers.push({
        _id: `bm_${orgId}_owner`,
        workspaceId: orgId,
        organizationId: orgId,
        branchId: `br_${orgId}_main`,
        userId: mockUsers.ownerA.id,
        role: 'inventory_owner',
        permissions: ['*'],
        status: 'active',
      });

      // Query demo context
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/workspaces/${orgId}/inventory/demo-context`,
        headers: { authorization: `Bearer ${tokens.ownerA}` },
      });

      assert.equal(res.statusCode, 200);
      const json = res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.organization.id, orgId);
      assert.equal(json.data.application.key, 'inventory');
      assert.equal(json.data.branch.code, 'MAIN');
      assert.equal(json.data.branch.isPrimary, true);
      assert.equal(json.data.setup.inventorySetupStatus, 'complete');
      assert.equal(json.data.demoMetrics.isStaticDemo, true);
    });
  });

  // -------------------------------------------------------------------
  // JOURNEY B: ORGANIZATION SWITCHING & ISOLATION
  // -------------------------------------------------------------------
  describe('Journey B: Organization Switching & Tenant Isolation', () => {
    test('Owner A switching to Org B where they are not a member is rejected with 403', async () => {
      const orgBId = 'org_e2e_beta';
      state.organizations.push({
        _id: orgBId,
        id: orgBId,
        name: 'Beta Store',
        status: 'active',
        ownerId: mockUsers.ownerB.id,
      });

      state.memberships.push({
        _id: `mem_${orgBId}_owner`,
        workspaceId: orgBId,
        organizationId: orgBId,
        userId: mockUsers.ownerB.id,
        role: 'owner',
        status: 'active',
      });

      // Owner A tries to access Org B
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/workspaces/${orgBId}/inventory/demo-context`,
        headers: { authorization: `Bearer ${tokens.ownerA}` },
      });

      assert.equal(res.statusCode, 403);
    });

    test('Header vs URL parameter mismatch is rejected with 400 TENANT_ID_MISMATCH', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/workspaces/org_e2e_alpha/inventory/demo-context`,
        headers: {
          authorization: `Bearer ${tokens.ownerA}`,
          'x-workspace-id': 'org_e2e_beta', // Mismatch!
        },
      });

      assert.equal(res.statusCode, 400);
      assert.equal(res.json().error.code, 'TENANT_ID_MISMATCH');
    });
  });

  // -------------------------------------------------------------------
  // JOURNEY C & D: PLAN LIMITS & MULTI-BRANCH PROGRESSION
  // -------------------------------------------------------------------
  describe('Journey C & D: Nigerian Branch Addition & Plan Limits Progression', () => {
    test('Free Trial blocks second branch creation', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/workspaces/org_e2e_alpha/inventory/branches`,
        headers: { authorization: `Bearer ${tokens.ownerA}` },
        payload: {
          name: 'Victoria Island Branch',
          code: 'VI-01',
          country: 'Nigeria',
          state: 'Lagos',
          city: 'Victoria Island',
        },
      });

      assert.equal(res.statusCode, 403);
      assert.equal(res.json().error.code, 'BRANCH_LIMIT_REACHED');
      assert.equal(res.json().error.limit, 1);
    });

    test('Upgrade to Standard allows up to 3 branches', async () => {
      state.subscriptions['org_e2e_alpha'] = {
        workspaceId: 'org_e2e_alpha',
        planKey: 'standard',
        status: 'active',
      };

      // Branch 2
      const res2 = await app.inject({
        method: 'POST',
        url: `/api/v1/workspaces/org_e2e_alpha/inventory/branches`,
        headers: { authorization: `Bearer ${tokens.ownerA}` },
        payload: {
          name: 'Victoria Island Branch',
          code: 'VI-01',
          country: 'Nigeria',
          state: 'Lagos',
          city: 'Victoria Island',
        },
      });
      assert.equal(res2.statusCode, 201);

      // Branch 3
      const res3 = await app.inject({
        method: 'POST',
        url: `/api/v1/workspaces/org_e2e_alpha/inventory/branches`,
        headers: { authorization: `Bearer ${tokens.ownerA}` },
        payload: {
          name: 'Ibadan Branch',
          code: 'IBADAN',
          country: 'Nigeria',
          state: 'Oyo',
          city: 'Ibadan',
        },
      });
      assert.equal(res3.statusCode, 201);

      // Branch 4 (exceeds limit of 3)
      const res4 = await app.inject({
        method: 'POST',
        url: `/api/v1/workspaces/org_e2e_alpha/inventory/branches`,
        headers: { authorization: `Bearer ${tokens.ownerA}` },
        payload: {
          name: 'Kano Branch',
          code: 'KANO',
          country: 'Nigeria',
          state: 'Kano',
          city: 'Kano',
        },
      });
      assert.equal(res4.statusCode, 403);
      assert.equal(res4.json().error.code, 'BRANCH_LIMIT_REACHED');
      assert.equal(res4.json().error.limit, 3);
    });
  });

  // -------------------------------------------------------------------
  // JOURNEY E: BRANCH ADMINISTRATION & ATOMIC PRIMARY SWITCH
  // -------------------------------------------------------------------
  describe('Journey E: Branch Administration & Atomic Primary Switch', () => {
    test('Set Primary branch atomically designates target branch and clears previous primary', async () => {
      const viBranch = state.branches.find((b) => b.code === 'VI-01');
      assert.ok(viBranch);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/workspaces/org_e2e_alpha/inventory/branches/${viBranch._id}/set-primary`,
        headers: { authorization: `Bearer ${tokens.ownerA}` },
      });

      assert.equal(res.statusCode, 200);
      assert.equal(viBranch.isPrimary, true);

      const mainBranch = state.branches.find((b) => b.code === 'MAIN');
      assert.equal(mainBranch.isPrimary, false);
    });

    test('Archiving the current primary branch is rejected', async () => {
      const viBranch = state.branches.find((b) => b.code === 'VI-01');
      assert.ok(viBranch);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/workspaces/org_e2e_alpha/inventory/branches/${viBranch._id}/archive`,
        headers: { authorization: `Bearer ${tokens.ownerA}` },
      });

      assert.equal(res.statusCode, 400);
      assert.equal(res.json().error.code, 'CANNOT_ARCHIVE_PRIMARY_BRANCH');
    });

    test('Archiving a non-primary branch succeeds', async () => {
      const ibadanBranch = state.branches.find((b) => b.code === 'IBADAN');
      assert.ok(ibadanBranch);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/workspaces/org_e2e_alpha/inventory/branches/${ibadanBranch._id}/archive`,
        headers: { authorization: `Bearer ${tokens.ownerA}` },
      });

      assert.equal(res.statusCode, 200);
      assert.equal(ibadanBranch.status, 'archived');
    });
  });

  // -------------------------------------------------------------------
  // JOURNEY F: MULTI-TIER TEAM ACCESS & PERMISSIONS
  // -------------------------------------------------------------------
  describe('Journey F: Multi-Tier Team Access & Separation of Scopes', () => {
    test('Adding member to branch creates granular branch membership', async () => {
      state.memberships.push({
        _id: 'mem_org_alpha_staff',
        workspaceId: 'org_e2e_alpha',
        organizationId: 'org_e2e_alpha',
        userId: mockUsers.memberA.id,
        role: 'member',
        status: 'active',
      });

      const viBranch = state.branches.find((b) => b.code === 'VI-01');
      assert.ok(viBranch);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/workspaces/org_e2e_alpha/inventory/branches/${viBranch._id}/members`,
        headers: { authorization: `Bearer ${tokens.ownerA}` },
        payload: {
          userId: mockUsers.memberA.id,
          role: 'cashier',
          permissions: ['inventory.view', 'sales.create'],
        },
      });

      assert.equal(res.statusCode, 201);
      assert.equal(res.json().success, true);
    });

    test('Audit events are appended for every mutation', async () => {
      assert.ok(state.auditLogs.length > 0);
      const branchAudit = state.auditLogs.find((l) => l.action.startsWith('branch.'));
      assert.ok(branchAudit);
      assert.equal(branchAudit.productKey, 'inventory');
    });
  });
});
