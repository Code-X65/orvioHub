import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';
import { dataService } from '../src/services/dataService.js';
import { entitlementService } from '../src/services/entitlementService.js';

describe('Priority 4: Organization Entitlements & Limit Metering Test Suite', () => {
  let app: FastifyInstance;
  const testUserId = 'test_owner_user_id';
  const testOrgId = 'test_org_entitlement_suite';

  const originalGetUserById = dataService.getUserById;
  const originalGetOrganizationUsageSummary = entitlementService.getOrganizationUsageSummary;
  const originalCheckBranchCreationEntitlement = entitlementService.checkBranchCreationEntitlement;

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
      sessionId: 'sess_test_entitlements',
      refreshToken: 'refresh_test_entitlements',
    } as any);

    dataService.logAudit = async () => ({} as any);
  });

  after(async () => {
    dataService.getUserById = originalGetUserById;
    entitlementService.getOrganizationUsageSummary = originalGetOrganizationUsageSummary;
    entitlementService.checkBranchCreationEntitlement = originalCheckBranchCreationEntitlement;
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

  test('GET /api/v1/organizations/:id/usage/summary returns detailed quota utilization', async () => {
    entitlementService.getOrganizationUsageSummary = async (orgId: string) => ({
      organizationId: orgId,
      planKey: 'free_trial',
      limits: {
        maxApps: 1,
        maxBranches: 1,
        maxMembers: 2,
        maxProducts: 500,
        maxTransactions: 500,
      },
      metrics: {
        apps: { current: 1, limit: 1, percent: 100, isApproaching: false, isReached: true },
        branches: { current: 1, limit: 1, percent: 100, isApproaching: false, isReached: true },
        members: { current: 1, limit: 2, percent: 50, isApproaching: false, isReached: false },
        products: { current: 420, limit: 500, percent: 84, isApproaching: true, isReached: false },
        transactions: { current: 120, limit: 500, percent: 24, isApproaching: false, isReached: false },
      },
      hasApproachingLimits: true,
      hasExceededLimits: true,
      warningMessage: 'Branch limit reached (1/1). Upgrade your plan to add more branches.',
    } as any);

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${testOrgId}/usage/summary`,
      headers: getAuthHeaders(),
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.organizationId, testOrgId);
    assert.strictEqual(body.data.planKey, 'free_trial');
    assert.strictEqual(body.data.hasApproachingLimits, true);
    assert.strictEqual(body.data.hasExceededLimits, true);
    assert.strictEqual(body.data.metrics.products.isApproaching, true);
    assert.strictEqual(body.data.metrics.branches.isReached, true);
  });

  test('POST /api/v1/organizations/:id/branches returns 403 when branch quota is exceeded', async () => {
    dataService.getOrganizationWorkspaces = async () => [
      { id: 'ws_123', isDefault: true },
    ] as any;

    entitlementService.checkBranchCreationEntitlement = async () => ({
      allowed: false,
      current: 1,
      limit: 1,
      planKey: 'free',
      error: 'Free Trial organizations can only have 1 branch per application. Upgrade to Standard to add more branches.',
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${testOrgId}/branches`,
      headers: getAuthHeaders(),
      payload: {
        name: 'Second Branch - Lekki Store',
        code: 'LEKKI',
      },
    });

    assert.strictEqual(res.statusCode, 403);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'BRANCH_LIMIT_REACHED');
    assert.ok(body.error.message.includes('1 branch per application'));
  });
});
