import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';
import { dataService } from '../src/services/dataService.js';
import { entitlementService } from '../src/services/entitlementService.js';
import { getPlanLimits } from '../src/config/planLimits.js';
import { env } from '../src/config/env.js';

describe('MVP Billing System - Phase 2 Plan Limits & Enforcement Test Suite', () => {
  let app: FastifyInstance;
  const originalGetUserById = dataService.getUserById;
  const originalGetUserWorkspaces = dataService.getUserWorkspaces;
  const originalGetWorkspaceSubscription = dataService.getWorkspaceSubscription;
  const originalCountActiveWorkspaceProducts = dataService.countActiveWorkspaceProducts;
  const originalGetWorkspaceMembers = dataService.getWorkspaceMembers;
  const originalGetProductsByWorkspace = dataService.getProductsByWorkspace;
  const originalActivateWorkspaceProduct = dataService.activateWorkspaceProduct;
  const originalGetBranchesByWorkspace = dataService.getBranchesByWorkspace;
  const originalGetBranches = dataService.getBranches;
  const originalCreateOrganization = dataService.createOrganization;
  const originalListPlans = dataService.listPlans;
  const originalUpdatePlan = dataService.updatePlan;
  const originalGetUserUsage = dataService.getUserUsage;
  const originalAdminId = env.ADMIN_USER_ID;

  const adminId = 'super_admin_test_id';

  before(async () => {
    app = await buildApp();
    await app.ready();

    (env as any).ADMIN_USER_ID = adminId;

    dataService.getUserById = async (id: string) => ({
      id,
      email: id === adminId ? 'admin@orviohub.com' : 'user@phase2test.com',
      name: id === adminId ? 'Super Admin' : 'Phase 2 User',
      emailVerified: true,
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as any);

    dataService.activateWorkspaceProduct = async () => ({
      id: 'wp_1',
      status: 'ACTIVE',
    } as any);
  });

  after(async () => {
    (env as any).ADMIN_USER_ID = originalAdminId;
    dataService.getUserById = originalGetUserById;
    dataService.getUserWorkspaces = originalGetUserWorkspaces;
    dataService.getWorkspaceSubscription = originalGetWorkspaceSubscription;
    dataService.countActiveWorkspaceProducts = originalCountActiveWorkspaceProducts;
    dataService.getWorkspaceMembers = originalGetWorkspaceMembers;
    dataService.getProductsByWorkspace = originalGetProductsByWorkspace;
    dataService.activateWorkspaceProduct = originalActivateWorkspaceProduct;
    dataService.getBranchesByWorkspace = originalGetBranchesByWorkspace;
    dataService.getBranches = originalGetBranches;
    dataService.createOrganization = originalCreateOrganization;
    dataService.listPlans = originalListPlans;
    dataService.updatePlan = originalUpdatePlan;
    dataService.getUserUsage = originalGetUserUsage;
    await app.close();
  });

  test('1. Plan Limits Configuration Matrix (Free, Standard, Premium)', () => {
    const freeLimits = getPlanLimits('free');
    assert.strictEqual(freeLimits.maxWorkspaces, 1);
    assert.strictEqual(freeLimits.maxAppsPerWorkspace, 1);
    assert.strictEqual(freeLimits.maxBranchesPerApp, 1);
    assert.strictEqual(freeLimits.maxMembers, 2);
    assert.strictEqual(freeLimits.maxProducts, 500);
    assert.strictEqual(freeLimits.maxTransactions, 500);

    const standardLimits = getPlanLimits('standard');
    assert.strictEqual(standardLimits.maxWorkspaces, 3);
    assert.strictEqual(standardLimits.maxAppsPerWorkspace, 3);
    assert.strictEqual(standardLimits.maxBranchesPerApp, 3);
    assert.strictEqual(standardLimits.maxMembers, 10);
    assert.strictEqual(standardLimits.maxProducts, 5000);
    assert.strictEqual(standardLimits.maxTransactions, 5000);

    const premiumLimits = getPlanLimits('premium');
    assert.strictEqual(premiumLimits.maxWorkspaces, 10);
    assert.strictEqual(premiumLimits.maxAppsPerWorkspace, 999999);
    assert.strictEqual(premiumLimits.maxBranchesPerApp, 10);
    assert.strictEqual(premiumLimits.maxMembers, 50);
    assert.strictEqual(premiumLimits.maxProducts, 25000);
    assert.strictEqual(premiumLimits.maxTransactions, 25000);
  });

  test('2. Scenario 1: Users can create multiple organizations freely (No user-level org cap)', async () => {
    // User already owns 1 workspace/organization
    dataService.getUserWorkspaces = async () => [
      { workspace: { id: 'ws_1' }, role: 'owner', isOwner: true } as any,
    ];
    dataService.getWorkspaceSubscription = async () => ({
      workspaceId: 'ws_1',
      planKey: 'free_trial',
      status: 'trialing',
    } as any);

    const check1 = await entitlementService.checkWorkspaceCreationEntitlement('user_123');
    assert.strictEqual(check1.allowed, true);

    // Mock createOrganization to succeed
    dataService.createOrganization = async (payload: any) => ({
      organization: { id: 'org_2', name: payload.name },
      workspace: { id: 'ws_2', name: payload.name },
      membership: { id: 'mem_2', role: 'OWNER' },
    } as any);

    // HTTP POST /api/v1/organizations test
    const token = app.jwt.sign({ userId: 'user_123', email: 'user@phase2test.com' });
    const resOrg = await app.inject({
      method: 'POST',
      url: '/api/v1/organizations',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Second Organization Ltd', industry: 'retail' },
    });

    assert.strictEqual(resOrg.statusCode, 201);
    const bodyOrg = resOrg.json();
    assert.strictEqual(bodyOrg.success, true);
  });

  test('3. Scenario 2: Free Trial User tries to activate second app or unallowed tier app -> 403 Forbidden', async () => {
    // Free plan with 1 active app
    dataService.getWorkspaceSubscription = async () => ({
      workspaceId: 'ws_free',
      planKey: 'free',
      status: 'active',
    } as any);
    dataService.countActiveWorkspaceProducts = async () => 1;

    // 1. Trying to activate second app (e.g. pos, which is allowed on free plan) -> limit reached
    const check1 = await entitlementService.checkAppActivationEntitlement('ws_free', 'pos');
    assert.strictEqual(check1.allowed, false);
    assert.ok(
      check1.error?.includes('Free Trial organizations can only activate 1 application') ||
      check1.error?.includes('Free plan includes 1 application')
    );

    // 2. Trying to activate premium-only app (e.g. crm) on free plan -> unallowed
    const checkNotAllowed = await entitlementService.checkAppActivationEntitlement('ws_free', 'crm');
    assert.strictEqual(checkNotAllowed.allowed, false);
    assert.strictEqual(checkNotAllowed.error, 'App not included in your plan');

    // HTTP endpoint test
    const token = app.jwt.sign({ userId: 'user_123', email: 'user@phase2test.com' });
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/workspaces/ws_free/products/pos/activate',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });

    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.json().error.code, 'PLAN_LIMIT_REACHED');
  });

  test('4. Scenario 3: Free Trial User tries to create second branch -> 403 Forbidden with BRANCH_LIMIT_REACHED', async () => {
    // Free plan with 1 active branch
    dataService.getWorkspaceSubscription = async () => ({
      workspaceId: 'ws_free_branch',
      planKey: 'free',
      status: 'active',
    } as any);
    dataService.getBranchesByWorkspace = async () => [
      { id: 'b1', name: 'Main Branch', status: 'active', productKey: 'inventory' } as any,
    ];
    dataService.getBranches = async () => [
      { id: 'b1', name: 'Main Branch', status: 'active', productKey: 'inventory' } as any,
    ];

    const branchCheck = await entitlementService.checkBranchCreationEntitlement('ws_free_branch', 'user_123', 'inventory');
    assert.strictEqual(branchCheck.allowed, false);
    assert.strictEqual(branchCheck.limit, 1);
    assert.strictEqual(branchCheck.current, 1);
    assert.ok(branchCheck.error?.includes('Free') && branchCheck.error?.includes('branch'));

    // HTTP POST /api/v1/workspaces/:workspaceId/branches
    const token = app.jwt.sign({ userId: 'user_123', email: 'user@phase2test.com' });
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/workspaces/ws_free_branch/branches',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Second Branch', code: 'BR02', productKey: 'inventory' },
    });

    assert.strictEqual(res.statusCode, 403);
    const body = res.json();
    assert.ok(body.error.code === 'BRANCH_LIMIT_REACHED' || body.error.code === 'PLAN_LIMIT_REACHED');
    assert.strictEqual(body.error.upgradeRequired, true);
  });

  test('5. Scenario 4: Users can create multiple organizations without user-level limit caps', async () => {
    dataService.getUserWorkspaces = async () => [
      { workspace: { id: 'ws_1' }, role: 'owner', isOwner: true } as any,
      { workspace: { id: 'ws_2' }, role: 'owner', isOwner: true } as any,
      { workspace: { id: 'ws_3' }, role: 'owner', isOwner: true } as any,
    ];
    const checkAllowed = await entitlementService.checkWorkspaceCreationEntitlement('user_123');
    assert.strictEqual(checkAllowed.allowed, true);
  });

  test('6. Scenario 5: Entitlement allows creating additional organizations (each org has its own plan)', async () => {
    dataService.getUserWorkspaces = async () =>
      Array.from({ length: 10 }, (_, i) => ({
        workspace: { id: `ws_${i}` },
        role: 'owner',
        isOwner: true,
      } as any));
    const checkAllowed = await entitlementService.checkWorkspaceCreationEntitlement('user_123');
    assert.strictEqual(checkAllowed.allowed, true);
  });

  test('7. Scenario 6: Superadmin can list and edit plan limits via admin API', async () => {
    dataService.listPlans = async () => [
      { key: 'free', name: 'Free Trial', monthlyPrice: 0, limits: { maxOrganizations: 1 } },
      { key: 'standard', name: 'Standard', monthlyPrice: 750000, limits: { maxOrganizations: 3 } },
      { key: 'premium', name: 'Premium', monthlyPrice: 2000000, limits: { maxOrganizations: 10 } },
    ];

    dataService.updatePlan = async (planKey, updates) => ({
      key: planKey,
      ...updates,
      updatedAt: Date.now(),
    });

    const adminToken = app.jwt.sign({ userId: adminId, email: 'admin@orviohub.com' });

    // 1. GET /api/v1/admin/plans
    const resList = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/plans',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(resList.statusCode, 200);
    const bodyList = resList.json();
    assert.strictEqual(bodyList.success, true);
    assert.strictEqual(bodyList.data.plans.length, 3);

    // 2. PATCH /api/v1/admin/plans/standard
    const resPatch = await app.inject({
      method: 'PATCH',
      url: '/api/v1/admin/plans/standard',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Standard Tier Plus',
        monthlyPrice: 850000,
        limits: {
          maxOrganizations: 4,
          maxAppsPerOrganization: 4,
          maxBranchesPerApp: 4,
          maxMembersPerOrganization: 15,
          maxProductsPerWorkspace: 7500,
          maxTransactionsPerMonth: 7500,
        },
      },
    });

    assert.strictEqual(resPatch.statusCode, 200);
    const bodyPatch = resPatch.json();
    assert.strictEqual(bodyPatch.success, true);
    assert.strictEqual(bodyPatch.data.plan.limits.maxOrganizations, 4);
  });

  test('8. Scenario 7: Superadmin can view user usage against plan limits', async () => {
    dataService.getUserUsage = async (uId) => ({
      userId: uId,
      planKey: 'free',
      entitlements: {
        maxOrganizations: 1,
        maxAppsPerOrganization: 1,
        maxBranchesPerApp: 1,
        maxMembersPerOrganization: 2,
        maxProductsPerWorkspace: 500,
        maxTransactionsPerMonth: 500,
      },
      usage: {
        workspaces: 1,
        apps: 1,
        branches: 1,
        members: 2,
        products: 45,
        transactions: 120,
      },
    });

    const adminToken = app.jwt.sign({ userId: adminId, email: 'admin@orviohub.com' });

    const resUsage = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/users/user_123/usage',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    assert.strictEqual(resUsage.statusCode, 200);
    const bodyUsage = resUsage.json();
    assert.strictEqual(bodyUsage.success, true);
    assert.strictEqual(bodyUsage.data.planKey, 'free');
    assert.strictEqual(bodyUsage.data.entitlements.maxOrganizations, 1);
    assert.strictEqual(bodyUsage.data.usage.workspaces, 1);
  });
});
