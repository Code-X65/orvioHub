import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';
import { dataService } from '../src/services/dataService.js';
import { entitlementService } from '../src/services/entitlementService.js';
import { getPlanLimits } from '../src/config/planLimits.js';

describe('MVP Billing System - Phase 2 Plan Limits & Enforcement Test Suite', () => {
  let app: FastifyInstance;
  const originalGetUserById = dataService.getUserById;
  const originalGetUserWorkspaces = dataService.getUserWorkspaces;
  const originalGetWorkspaceSubscription = dataService.getWorkspaceSubscription;
  const originalCountActiveWorkspaceProducts = dataService.countActiveWorkspaceProducts;
  const originalGetWorkspaceMembers = dataService.getWorkspaceMembers;
  const originalGetProductsByWorkspace = dataService.getProductsByWorkspace;
  const originalActivateWorkspaceProduct = dataService.activateWorkspaceProduct;

  before(async () => {
    app = await buildApp();
    await app.ready();

    dataService.getUserById = async (id: string) => ({
      id,
      email: 'user@phase2test.com',
      name: 'Phase 2 User',
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
    dataService.getUserById = originalGetUserById;
    dataService.getUserWorkspaces = originalGetUserWorkspaces;
    dataService.getWorkspaceSubscription = originalGetWorkspaceSubscription;
    dataService.countActiveWorkspaceProducts = originalCountActiveWorkspaceProducts;
    dataService.getWorkspaceMembers = originalGetWorkspaceMembers;
    dataService.getProductsByWorkspace = originalGetProductsByWorkspace;
    dataService.activateWorkspaceProduct = originalActivateWorkspaceProduct;
    await app.close();
  });

  test('1. Plan Limits Configuration Matrix (Free, Standard, Premium)', () => {
    const freeLimits = getPlanLimits('free');
    assert.strictEqual(freeLimits.maxWorkspaces, 1);
    assert.strictEqual(freeLimits.maxAppsPerWorkspace, 1);
    assert.strictEqual(freeLimits.maxMembers, 2);
    assert.strictEqual(freeLimits.maxProducts, 500);

    const standardLimits = getPlanLimits('standard');
    assert.strictEqual(standardLimits.maxWorkspaces, 3);
    assert.strictEqual(standardLimits.maxAppsPerWorkspace, 3);
    assert.strictEqual(standardLimits.maxMembers, 10);
    assert.strictEqual(standardLimits.maxProducts, 5000);

    const premiumLimits = getPlanLimits('premium');
    assert.strictEqual(premiumLimits.maxWorkspaces, 10);
    assert.strictEqual(premiumLimits.maxAppsPerWorkspace, 999999);
    assert.strictEqual(premiumLimits.maxMembers, 50);
    assert.strictEqual(premiumLimits.maxProducts, 25000);
  });

  test('2. AC-2.2: Workspace Creation Limits Enforcement', async () => {
    // 1. User on Free plan already owns 1 workspace -> blocked
    dataService.getUserWorkspaces = async () => [
      { workspace: { id: 'ws_1' }, role: 'owner', isOwner: true } as any,
    ];
    dataService.getWorkspaceSubscription = async () => ({
      workspaceId: 'ws_1',
      planKey: 'free',
      status: 'active',
    } as any);

    const check1 = await entitlementService.checkWorkspaceCreationEntitlement('user_123');
    assert.strictEqual(check1.allowed, false);
    assert.ok(check1.error?.includes('Your Free plan includes 1 workspace'));

    // HTTP endpoint test
    const token = app.jwt.sign({ userId: 'user_123', email: 'user@phase2test.com' });
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/workspaces',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Blocked Store' },
    });

    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.json().error.code, 'PLAN_LIMIT_REACHED');

    // 2. User on Standard plan with 1 workspace -> allowed
    dataService.getWorkspaceSubscription = async () => ({
      workspaceId: 'ws_1',
      planKey: 'standard',
      status: 'active',
    } as any);

    const check2 = await entitlementService.checkWorkspaceCreationEntitlement('user_123');
    assert.strictEqual(check2.allowed, true);
  });

  test('3. AC-2.3: Application Activation Limits Enforcement', async () => {
    // Free plan with 1 active app -> blocked from activating 2nd app
    dataService.getWorkspaceSubscription = async () => ({
      workspaceId: 'ws_free',
      planKey: 'free',
      status: 'active',
    } as any);
    dataService.countActiveWorkspaceProducts = async () => 1;

    const check1 = await entitlementService.checkAppActivationEntitlement('ws_free', 'crm');
    assert.strictEqual(check1.allowed, false);
    assert.ok(check1.error?.includes('Free plan includes 1 application'));

    // HTTP endpoint test
    const token = app.jwt.sign({ userId: 'user_123', email: 'user@phase2test.com' });
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/workspaces/ws_free/products/crm/activate',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });

    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.json().error.code, 'PLAN_LIMIT_REACHED');

    // Upgraded to Standard plan -> allows up to 3 apps
    dataService.getWorkspaceSubscription = async () => ({
      workspaceId: 'ws_free',
      planKey: 'standard',
      status: 'active',
    } as any);

    const check2 = await entitlementService.checkAppActivationEntitlement('ws_free', 'crm');
    assert.strictEqual(check2.allowed, true);
  });

  test('4. AC-2.4: Member Invitation Limits Enforcement', async () => {
    // Free plan with 2 members -> blocked from inviting 3rd
    dataService.getWorkspaceSubscription = async () => ({
      workspaceId: 'ws_members',
      planKey: 'free',
      status: 'active',
    } as any);
    dataService.getWorkspaceMembers = async () => [
      { id: 'm1', role: 'owner' } as any,
      { id: 'm2', role: 'member' } as any,
    ];

    const check1 = await entitlementService.checkMemberInvitationEntitlement('ws_members');
    assert.strictEqual(check1.allowed, false);
    assert.ok(check1.error?.includes('Free plan allows 2 members'));

    // HTTP endpoint test
    const token = app.jwt.sign({ userId: 'user_123', email: 'user@phase2test.com' });
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/organizations/ws_members/invitations',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        invitations: [{ email: 'third@example.com', role: 'MEMBER' }],
      },
    });

    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.json().error.code, 'PLAN_LIMIT_REACHED');
  });

  test('5. AC-2.5: Product Catalog Limits Enforcement', async () => {
    // Free plan with 500 products -> blocked from adding 501st
    dataService.getWorkspaceSubscription = async () => ({
      workspaceId: 'ws_products',
      planKey: 'free',
      status: 'active',
    } as any);
    dataService.getInventoryProducts = async () => new Array(500).fill({ id: 'p' }) as any[];

    const check1 = await entitlementService.checkProductCreationEntitlement('ws_products', 1);
    assert.strictEqual(check1.allowed, false);
    assert.ok(check1.error?.includes('Free plan allows 500 products'));

    // Upgraded to Standard plan -> allows up to 5000 products
    dataService.getWorkspaceSubscription = async () => ({
      workspaceId: 'ws_products',
      planKey: 'standard',
      status: 'active',
    } as any);

    const check2 = await entitlementService.checkProductCreationEntitlement('ws_products', 1);
    assert.strictEqual(check2.allowed, true);
  });
});
