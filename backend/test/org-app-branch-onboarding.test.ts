import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';
import { dataService } from '../src/services/dataService.js';

describe('Zoho-Style Model: Organization -> Application Activation -> Branch Setup Test Suite', () => {
  let app: FastifyInstance;
  const testUserId = 'test_owner_user_id';
  const testOrgId = 'test_org_123';

  const originalGetUserById = dataService.getUserById;
  const originalCreateOrganizationWithOnboarding = dataService.createOrganizationWithOnboarding;
  const originalGetMyOrganizations = dataService.getMyOrganizations;
  const originalGetInventoryOnboardingStatus = dataService.getInventoryOnboardingStatus;
  const originalSaveInventoryOnboarding = dataService.saveInventoryOnboarding;
  const originalListBranches = dataService.listBranches;
  const originalCreateBranch = dataService.createBranch;
  const originalAutoCreateMainBranch = dataService.autoCreateMainBranch;
  const originalGetCurrentOrgAppContext = dataService.getCurrentOrgAppContext;
  const originalActivateApplication = dataService.activateApplication;
  const originalGetOrganizationApps = dataService.getOrganizationApps;
  const originalIsApplicationActiveForOrg = dataService.isApplicationActiveForOrg;
  const originalGetOrganizationWorkspaces = dataService.getOrganizationWorkspaces;

  before(async () => {
    app = await buildApp();
    await app.ready();

    dataService.getUserById = async (id: string) => ({
      id,
      email: 'owner@business.localhost',
      name: 'Business Owner',
      emailVerified: true,
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as any);

    dataService.createSession = async () => ({
      sessionId: 'sess_test_123',
      refreshToken: 'refresh_test_123',
    } as any);

    dataService.logAudit = async () => ({} as any);
    dataService.getOrganizationWorkspaces = async () => [] as any;
  });

  after(async () => {
    dataService.getUserById = originalGetUserById;
    dataService.createOrganizationWithOnboarding = originalCreateOrganizationWithOnboarding;
    dataService.getMyOrganizations = originalGetMyOrganizations;
    dataService.getInventoryOnboardingStatus = originalGetInventoryOnboardingStatus;
    dataService.saveInventoryOnboarding = originalSaveInventoryOnboarding;
    dataService.listBranches = originalListBranches;
    dataService.createBranch = originalCreateBranch;
    dataService.autoCreateMainBranch = originalAutoCreateMainBranch;
    dataService.getCurrentOrgAppContext = originalGetCurrentOrgAppContext;
    dataService.activateApplication = originalActivateApplication;
    dataService.getOrganizationApps = originalGetOrganizationApps;
    dataService.isApplicationActiveForOrg = originalIsApplicationActiveForOrg;
    dataService.getOrganizationWorkspaces = originalGetOrganizationWorkspaces;
    await app.close();
  });

  const getAuthHeaders = () => {
    const token = app.jwt.sign({
      userId: testUserId,
      email: 'owner@business.localhost',
    });
    return {
      authorization: `Bearer ${token}`,
    };
  };

  test('US-A1: POST /api/v1/organizations/with-onboarding creates organization without activating apps or branches', async () => {
    let calledWithArgs: any = null;
    dataService.createOrganizationWithOnboarding = async (args: any) => {
      calledWithArgs = args;
      return {
        organizationId: testOrgId,
        workspaceId: 'ws_123',
        branchId: null,
        slug: 'supermart-retail-ltd',
        name: args.name,
        hasDefaultBranch: false,
      };
    };

    const payload = {
      name: 'Supermart Retail Ltd',
      phone: '+2348012345678',
      category: 'Provision Store',
      street: '12 Marina Street',
      city: 'Lagos Island',
      state: 'Lagos',
      country: 'Nigeria',
      currency: 'NGN',
      businessType: 'retail',
      branchCountRange: '1',
      productCountRange: '51-200',
      primaryUsers: ['owner', 'sales_attendant'],
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/organizations/with-onboarding',
      headers: {
        ...getAuthHeaders(),
      },
      payload,
    });

    assert.strictEqual(res.statusCode, 201);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.organizationId, testOrgId);
    assert.strictEqual(body.data.branchId, null);
    assert.strictEqual(body.data.hasDefaultBranch, false);
    assert.strictEqual(calledWithArgs.name, 'Supermart Retail Ltd');
    assert.strictEqual(calledWithArgs.userId, testUserId);
  });

  test('US-A4: GET /api/v1/organizations/my-organizations returns status distinguishing no-app vs active-app orgs', async () => {
    dataService.getMyOrganizations = async (userId: string) => [
      {
        organization: {
          _id: testOrgId,
          name: 'Supermart Retail Ltd',
        },
        membership: { role: 'OWNER', status: 'ACTIVE' },
        inventoryActive: false,
        hasActiveApps: false,
        activeAppsCount: 0,
        branchCount: 0,
      },
      {
        organization: {
          _id: 'org_active_456',
          name: 'Lagos Superstore',
        },
        membership: { role: 'OWNER', status: 'ACTIVE' },
        inventoryActive: true,
        hasActiveApps: true,
        activeAppsCount: 1,
        branchCount: 2,
      },
    ];

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/organizations/my-organizations',
      headers: {
        ...getAuthHeaders(),
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.length, 2);
    assert.strictEqual(body.data[0].hasActiveApps, false);
    assert.strictEqual(body.data[0].inventoryActive, false);
    assert.strictEqual(body.data[1].hasActiveApps, true);
    assert.strictEqual(body.data[1].inventoryActive, true);
  });

  test('US-A2: POST /api/v1/organizations/:id/applications/inventory/activate enables Free Trial', async () => {
    let activateArgs: any = null;
    dataService.activateApplication = async (args: any) => {
      activateArgs = args;
      return {
        success: true,
        orgApplicationId: 'org_app_trial_123',
        applicationId: 'app_inv_123',
        applicationKey: 'inventory',
        status: 'trial',
        planId: 'free_trial',
        trialEndsAt: Date.now() + 14 * 86_400_000,
      };
    };

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${testOrgId}/applications/inventory/activate`,
      headers: {
        ...getAuthHeaders(),
      },
      payload: {
        planKey: 'free_trial',
        billingCycle: 'monthly',
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.status, 'trial');
    assert.strictEqual(body.data.planId, 'free_trial');
    assert.strictEqual(activateArgs.organizationId, testOrgId);
    assert.strictEqual(activateArgs.applicationKey, 'inventory');
  });

  test('US-A2: POST /api/v1/organizations/:id/applications/inventory/activate enables Standard Plan with payment', async () => {
    let activateArgs: any = null;
    dataService.activateApplication = async (args: any) => {
      activateArgs = args;
      return {
        success: true,
        orgApplicationId: 'org_app_standard_123',
        applicationId: 'app_inv_123',
        applicationKey: 'inventory',
        status: 'active',
        planId: 'standard',
        trialEndsAt: null,
      };
    };

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${testOrgId}/applications/inventory/activate`,
      headers: {
        ...getAuthHeaders(),
      },
      payload: {
        planKey: 'standard',
        billingCycle: 'annual',
        paymentReference: 'pst_test_ref_98765',
        paymentGateway: 'paystack',
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.status, 'active');
    assert.strictEqual(body.data.planId, 'standard');
    assert.strictEqual(activateArgs.paymentReference, 'pst_test_ref_98765');
  });

  test('US-A3: Branch creation fails if application is not activated', async () => {
    dataService.createBranch = async () => {
      throw new Error('APPLICATION_NOT_ACTIVATED');
    };

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${testOrgId}/branches`,
      headers: {
        ...getAuthHeaders(),
      },
      payload: {
        name: 'Early Branch Attempt',
      },
    });

    assert.strictEqual(res.statusCode, 400);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'APPLICATION_NOT_ACTIVATED');
  });

  test('US-A3: Branch creation succeeds after application is activated', async () => {
    dataService.createBranch = async (args: any) => ({
      branchId: 'branch_created_123',
      name: args.name,
      code: args.code,
      isPrimary: args.isPrimary,
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${testOrgId}/branches`,
      headers: {
        ...getAuthHeaders(),
      },
      payload: {
        name: 'Victoria Island Flagship',
        code: 'VI01',
        isPrimary: true,
      },
    });

    assert.strictEqual(res.statusCode, 201);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.name, 'Victoria Island Flagship');
    assert.strictEqual(body.code, 'VI01');
  });

  test('US-A4: GET /api/v1/organizations/:id/applications/:key/status returns accurate status', async () => {
    dataService.isApplicationActiveForOrg = async (orgId: string, key?: string) => ({
      active: true,
      status: 'trial',
      planId: 'free_trial',
      app: { key: 'inventory', name: 'Inventory' },
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${testOrgId}/applications/inventory/status`,
      headers: {
        ...getAuthHeaders(),
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.active, true);
    assert.strictEqual(body.data.status, 'trial');
  });
});
