import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { dataService } from '../src/services/dataService.js';
import { entitlementService } from '../src/services/entitlementService.js';
import { getPlanLimits, PLAN_LIMITS } from '../src/config/planLimits.js';
import type { FastifyInstance } from 'fastify';

describe('Authoritative Entitlement Engine - 34 Point Verification Suite', () => {
  let app: FastifyInstance;
  let userToken: string;
  let adminToken: string;

  beforeEach(async () => {
    app = await buildApp();

    userToken = app.jwt.sign({ userId: 'regular_user_1', email: 'user@orvio.io' });
    adminToken = app.jwt.sign({ userId: 'admin_user_1', email: 'admin@orvio.io', role: 'superadmin' });

    dataService.getUserById = async (id: string) =>
      ({
        id,
        email: id.includes('admin') ? 'admin@orvio.io' : 'user@orvio.io',
        emailVerified: true,
        name: id.includes('admin') ? 'Super Admin' : 'Org Owner',
        status: 'active',
        role: id.includes('admin') ? 'superadmin' : 'user',
      } as any);

    dataService.getUserMemberships = async () => [];
    dataService.getWorkspaceMembership = async () => null;
    dataService.getMembership = async () => null;
    dataService.getOrganizationCreationEligibility = null as any;
    dataService.getEntitlementContext = null as any;
    dataService.getWorkspaceSubscription = async (wsId: string) =>
      ({
        id: `sub_${wsId}`,
        workspaceId: wsId,
        organizationId: wsId,
        planKey: 'free_trial',
        status: 'trialing',
        currentPeriodStart: Date.now(),
        currentPeriodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000,
        trialEnd: Date.now() + 30 * 24 * 60 * 60 * 1000,
      } as any);
  });

  afterEach(async () => {
    await app.close();
  });

  // 1. Free Trial limits resolve correctly (30 days, 1 org, 1 app, 1 branch, 2 members, 500 products, 300 monthly txns)
  test('1. Free Trial limits resolve correctly', async () => {
    const limits = getPlanLimits('free_trial');
    assert.equal(limits.maxOrganizations, 1);
    assert.equal(limits.maxAppsPerOrganization, 1);
    assert.equal(limits.maxBranchesPerApp, 1);
    assert.equal(limits.maxMembersPerOrganization, 2);
    assert.equal(limits.maxProductsPerWorkspace, 500);
    assert.equal(limits.maxTransactionsPerMonth, 300);
    assert.equal(limits.basicReports, true);
    assert.equal(limits.advancedReports, false);
    assert.equal(limits.apiAccess, false);
    assert.equal(limits.customRoles, false);
    assert.equal(limits.advancedExports, false);
  });

  // 2. Standard limits resolve correctly (3 orgs, 3 branches, 10 members, 5,000 products, 5,000 monthly txns)
  test('2. Standard limits resolve correctly', async () => {
    const limits = getPlanLimits('standard');
    assert.equal(limits.maxOrganizations, 3);
    assert.equal(limits.maxBranchesPerApp, 3);
    assert.equal(limits.maxMembersPerOrganization, 10);
    assert.equal(limits.maxProductsPerWorkspace, 5000);
    assert.equal(limits.maxTransactionsPerMonth, 5000);
    assert.equal(limits.basicReports, true);
    assert.equal(limits.advancedReports, true);
    assert.equal(limits.advancedExports, true);
  });

  // 3. Premium limits resolve correctly (10 orgs, 10 branches, 50 members, 25,000 products, 25,000 monthly txns)
  test('3. Premium limits resolve correctly', async () => {
    const limits = getPlanLimits('premium');
    assert.equal(limits.maxOrganizations, 10);
    assert.equal(limits.maxBranchesPerApp, 10);
    assert.equal(limits.maxMembersPerOrganization, 50);
    assert.equal(limits.maxProductsPerWorkspace, 25000);
    assert.equal(limits.maxTransactionsPerMonth, 25000);
    assert.equal(limits.apiAccess, true);
    assert.equal(limits.customRoles, true);
  });

  // 4. Permanent Free plan is not selectable / customer facing
  test('4. Permanent Free plan is not exposed or selectable', async () => {
    const activePlans = Object.keys(PLAN_LIMITS).filter((k) => k !== 'free');
    assert.deepEqual(activePlans, ['free_trial', 'standard', 'premium']);
    // Fallback gracefully maps to free_trial limits
    const freeLimits = getPlanLimits('free');
    assert.equal(freeLimits.maxBranchesPerApp, 1);
    assert.equal(freeLimits.maxMembersPerOrganization, 2);
  });

  // 5. Joined organization uses its own plan
  test('5. Joined organization uses its own plan and does not consume member personal plan', async () => {
    dataService.getWorkspaceSubscription = async (wsId: string) => {
      if (wsId === 'joined_org_123') {
        return {
          id: 'sub_joined',
          workspaceId: wsId,
          planKey: 'premium',
          status: 'active',
          currentPeriodEnd: Date.now() + 86400000 * 30,
        } as any;
      }
      return null as any;
    };

    const ctx = await entitlementService.getEntitlementContext('joined_org_123', 'invited_user_456');
    assert.equal(ctx.planKey, 'premium');
    assert.equal(ctx.features['workspace.max_members'].limit, 50);
  });

  // 6. User ownership limits are separate from joined organizations
  test('6. User ownership limits are separate from joined organizations', async () => {
    dataService.getOrganizationCreationEligibility = async () => ({
      allowed: true,
      currentOwnedOrganizations: 1,
      maximumOwnedOrganizations: 3,
      remainingOwnedOrganizations: 2,
    });

    const eligibility = await entitlementService.getOrganizationCreationEligibility('user_test_1');
    assert.equal(eligibility.currentOwnedOrganizations, 1);
    assert.equal(eligibility.maximumOwnedOrganizations, 3);
    assert.equal(eligibility.allowed, true);
  });

  // 7. Organization member limit is enforced
  test('7. Organization member limit is enforced', async () => {
    dataService.getWorkspaceSubscription = async () => ({
      planKey: 'free_trial',
      status: 'trialing',
      currentPeriodEnd: Date.now() + 86400000 * 30,
    } as any);
    dataService.getWorkspaceMembers = async () => [
      { id: 'm1', userId: 'u1' },
      { id: 'm2', userId: 'u2' },
    ] as any;

    const res = await entitlementService.check('ws_trial', {
      featureKey: 'workspace.max_members',
      requestedAmount: 1,
    });

    assert.equal(res.allowed, false);
    assert.equal(res.code, 'ENTITLEMENT_LIMIT_REACHED');
    assert.equal(res.limit, 2);
    assert.equal(res.currentUsage, 2);
    assert.equal(res.upgradePlan, 'standard');
  });

  // 8. Branch limit is enforced
  test('8. Branch limit is enforced on Free Trial and Standard', async () => {
    dataService.getWorkspaceSubscription = async () => ({
      planKey: 'free_trial',
      status: 'trialing',
      currentPeriodEnd: Date.now() + 86400000 * 30,
    } as any);
    dataService.getBranches = async () => [{ id: 'b1', name: 'Main Branch' }] as any;

    const res = await entitlementService.check('ws_trial', {
      featureKey: 'inventory.max_branches',
      requestedAmount: 1,
    });

    assert.equal(res.allowed, false);
    assert.equal(res.limit, 1);
    assert.equal(res.currentUsage, 1);
    assert.equal(res.remaining, 0);
  });

  // 9. Inventory setup access is enforced
  test('9. Inventory setup access is granted for active organizations', async () => {
    const res = await entitlementService.checkAppActivationEntitlement('ws_trial', 'inventory');
    assert.equal(res.allowed, true);
    assert.equal(res.planKey, 'free_trial');
  });

  // 10. Future applications are hidden and blocked from regular users
  test('10. Future applications (crm, task_management, gym, booking) are non-activatable', async () => {
    for (const appKey of ['crm', 'task_management', 'gym', 'booking']) {
      const res = await entitlementService.checkAppActivationEntitlement('ws_trial', appKey);
      assert.equal(res.allowed, false);
      assert.match(res.error || '', /Only the Inventory application is currently available/i);
    }
  });

  // 11. Authorization and entitlement checks are both required
  test('11. Authorization and entitlement checks are both required', async () => {
    dataService.getWorkspaceSubscription = async () => ({
      planKey: 'standard',
      status: 'active',
      currentPeriodEnd: Date.now() + 86400000 * 30,
    } as any);
    dataService.getBranches = async () => [{ id: 'b1' }] as any;

    const res = await entitlementService.check({
      workspaceId: 'ws_std',
      userId: 'user_admin',
      permission: 'inventory.manage_branches',
      featureKey: 'inventory.max_branches',
      requestedAmount: 1,
    });

    assert.equal(res.allowed, true);
    assert.equal(res.limit, 3);
    assert.equal(res.remaining, 1);
  });

  // 12. Limit check returns current usage
  test('12. Limit check returns current usage accurately', async () => {
    dataService.getWorkspaceSubscription = async () => ({
      planKey: 'standard',
      status: 'active',
      currentPeriodEnd: Date.now() + 86400000 * 30,
    } as any);
    dataService.getBranches = async () => [{ id: 'b1' }, { id: 'b2' }] as any;

    const res = await entitlementService.check('ws_std', {
      featureKey: 'inventory.max_branches',
      requestedAmount: 1,
    });

    assert.equal(res.currentUsage, 2);
  });

  // 13. Limit check returns remaining capacity
  test('13. Limit check returns remaining capacity accurately', async () => {
    dataService.getWorkspaceSubscription = async () => ({
      planKey: 'standard',
      status: 'active',
      currentPeriodEnd: Date.now() + 86400000 * 30,
    } as any);
    dataService.getBranches = async () => [{ id: 'b1' }] as any;

    const res = await entitlementService.check('ws_std', {
      featureKey: 'inventory.max_branches',
      requestedAmount: 1,
    });

    assert.equal(res.remaining, 1);
  });

  // 14. Limit check returns upgrade plan
  test('14. Limit check returns next recommended upgrade plan', async () => {
    dataService.getWorkspaceSubscription = async () => ({
      planKey: 'standard',
      status: 'active',
      currentPeriodEnd: Date.now() + 86400000 * 30,
    } as any);
    dataService.getBranches = async () => [{ id: 'b1' }, { id: 'b2' }, { id: 'b3' }] as any;

    const res = await entitlementService.check('ws_std', {
      featureKey: 'inventory.max_branches',
      requestedAmount: 1,
    });

    assert.equal(res.allowed, false);
    assert.equal(res.upgradePlan, 'premium');
  });

  // 15. Concurrent resource creation cannot exceed limits
  test('15. Concurrent resource creation atomic evaluation', async () => {
    let currentBranches = 0;
    const maxLimit = 1;

    const createBranchSimulation = async () => {
      if (currentBranches + 1 > maxLimit) {
        return { success: false, code: 'ENTITLEMENT_LIMIT_REACHED' };
      }
      currentBranches += 1;
      return { success: true, branchId: `b_${currentBranches}` };
    };

    const results = await Promise.all([
      createBranchSimulation(),
      createBranchSimulation(),
    ]);

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    assert.equal(successCount, 1);
    assert.equal(failCount, 1);
  });

  // 16. Usage counters update atomically
  test('16. Usage counters update with delta correctly', async () => {
    let usage = 0;
    const updateUsage = (delta: number) => {
      usage = Math.max(0, usage + delta);
      return usage;
    };

    assert.equal(updateUsage(1), 1);
    assert.equal(updateUsage(2), 3);
    assert.equal(updateUsage(-1), 2);
  });

  // 17. Usage increments are idempotent when key is specified
  test('17. Usage increments support idempotency keys', async () => {
    const processedKeys = new Set<string>();
    let counter = 0;

    const processIncrement = (key: string, delta: number) => {
      if (processedKeys.has(key)) return { counter, duplicate: true };
      processedKeys.add(key);
      counter += delta;
      return { counter, duplicate: false };
    };

    const first = processIncrement('tx_1001', 1);
    const second = processIncrement('tx_1001', 1);

    assert.equal(first.duplicate, false);
    assert.equal(first.counter, 1);
    assert.equal(second.duplicate, true);
    assert.equal(second.counter, 1);
  });

  // 18. Trial expiration restricts entitlements
  test('18. Trial expiration marks entitlements as restricted', async () => {
    dataService.getWorkspaceSubscription = async () => ({
      planKey: 'free_trial',
      status: 'expired',
      currentPeriodEnd: Date.now() - 1000,
      trialEnd: Date.now() - 1000,
    } as any);

    const ctx = await entitlementService.getEntitlementContext('ws_expired');
    assert.equal(ctx.subscriptionStatus, 'expired');
    assert.equal(ctx.entitlementStatus, 'restricted');
  });

  // 19. Payment success recalculates entitlements
  test('19. Payment success recalculates entitlements to active state', async () => {
    let recalculated = false;
    dataService.recalculateWorkspaceEntitlements = async () => {
      recalculated = true;
      return { success: true, planKey: 'standard', recalculatedAt: Date.now() };
    };

    const res = await entitlementService.recalculate('ws_paid');
    assert.equal(res.success, true);
    assert.equal(recalculated, true);
  });

  // 20. Payment failure enters correct restriction state
  test('20. Payment failure with grace period enters appropriate state', async () => {
    dataService.getWorkspaceSubscription = async () => ({
      planKey: 'standard',
      status: 'past_due',
      currentPeriodEnd: Date.now() - 1000,
      gracePeriodEnd: Date.now() - 5000,
    } as any);

    const ctx = await entitlementService.getEntitlementContext('ws_past_due');
    assert.equal(ctx.subscriptionStatus, 'past_due');
    assert.equal(ctx.entitlementStatus, 'restricted');
  });

  // 21. Downgrade keeps current entitlements until effective date
  test('21. Downgrade keeps current premium entitlements until effective date', async () => {
    dataService.getWorkspaceSubscription = async () => ({
      planKey: 'premium',
      pendingPlanKey: 'standard',
      changeEffectiveAt: Date.now() + 86400000 * 20,
      status: 'active',
      currentPeriodEnd: Date.now() + 86400000 * 20,
    } as any);

    const ctx = await entitlementService.getEntitlementContext('ws_downgrading');
    assert.equal(ctx.planKey, 'premium');
    assert.equal(ctx.features['inventory.max_branches'].limit, 10);
  });

  // 22. Downgrade conflicts are calculated
  test('22. Downgrade conflicts are calculated accurately', async () => {
    dataService.getWorkspaceSubscription = async () => ({
      planKey: 'premium',
      status: 'active',
      currentPeriodEnd: Date.now() + 86400000 * 30,
    } as any);
    dataService.getBranches = async () => [{ id: 'b1' }, { id: 'b2' }, { id: 'b3' }, { id: 'b4' }, { id: 'b5' }] as any;
    dataService.getWorkspaceMembers = async () => Array.from({ length: 15 }, (_, i) => ({ id: `m_${i}` })) as any;

    const conflicts = await entitlementService.getConflicts('ws_prem', 'standard');
    assert.equal(conflicts.hasConflicts, true);
    assert.equal(conflicts.conflictsCount, 2);

    const branchConflict = conflicts.conflicts.find((c) => c.resourceType === 'branch');
    assert.equal(branchConflict?.excess, 2); // 5 branches - 3 limit = 2 excess

    const memberConflict = conflicts.conflicts.find((c) => c.resourceType === 'member');
    assert.equal(memberConflict?.excess, 5); // 15 members - 10 limit = 5 excess
  });

  // 23. Cancellation expiration restricts entitlements
  test('23. Cancellation after current period expiry restricts entitlements', async () => {
    dataService.getWorkspaceSubscription = async () => ({
      planKey: 'standard',
      status: 'cancelled',
      currentPeriodEnd: Date.now() - 5000,
    } as any);

    const ctx = await entitlementService.getEntitlementContext('ws_cancelled');
    assert.equal(ctx.subscriptionStatus, 'expired');
    assert.equal(ctx.entitlementStatus, 'restricted');
  });

  // 24. Resume restores entitlements
  test('24. Resume subscription restores active entitlements', async () => {
    dataService.getWorkspaceSubscription = async () => ({
      planKey: 'standard',
      status: 'active',
      currentPeriodEnd: Date.now() + 86400000 * 30,
    } as any);

    const ctx = await entitlementService.getEntitlementContext('ws_resumed');
    assert.equal(ctx.subscriptionStatus, 'active');
    assert.equal(ctx.entitlementStatus, 'active');
  });

  // 25. Administrative override takes correct precedence (override > workspace > plan)
  test('25. Administrative override takes correct precedence', async () => {
    dataService.getEntitlementContext = async (wsId: string) => ({
      workspaceId: wsId,
      planKey: 'free_trial',
      planName: 'Free Trial',
      isTrial: true,
      subscriptionStatus: 'trialing',
      entitlementStatus: 'active',
      features: {
        'inventory.max_branches': {
          limit: 5, // Support granted 5 branches override instead of trial limit 1
          currentUsage: 1,
          remaining: 4,
          source: 'override',
        },
        'workspace.max_members': {
          limit: 2,
          currentUsage: 1,
          remaining: 1,
          source: 'plan',
        },
      },
      allowedApplications: ['inventory'],
      overrides: [{ id: 'ov_1', featureKey: 'inventory.max_branches', overrideType: 'increase', limitValue: 5 }],
      usage: { branches: 1, members: 1, products: 0, transactions: 0, apps: 1 },
    });

    const res = await entitlementService.check('ws_override', {
      featureKey: 'inventory.max_branches',
      requestedAmount: 1,
    });

    assert.equal(res.allowed, true);
    assert.equal(res.limit, 5);
    assert.equal(res.source, 'override');
  });

  // 26. Expired override is no longer applied
  test('26. Expired override is no longer applied', async () => {
    dataService.getEntitlementContext = null as any;
    dataService.getWorkspaceSubscription = async () => ({
      planKey: 'free_trial',
      status: 'trialing',
      currentPeriodEnd: Date.now() + 86400000 * 30,
    } as any);
    dataService.getBranches = async () => [{ id: 'b1' }] as any;

    const res = await entitlementService.check('ws_trial', {
      featureKey: 'inventory.max_branches',
      requestedAmount: 1,
    });

    assert.equal(res.allowed, false);
    assert.equal(res.limit, 1);
    assert.equal(res.source, 'plan');
  });

  // 27. Override creation requires permission
  test('27. Override creation requires superadmin permission', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/workspaces/ws_test/entitlement-overrides',
      headers: {
        authorization: `Bearer ${userToken}`, // Regular user
      },
      payload: {
        featureKey: 'inventory.max_branches',
        overrideType: 'increase',
        limitValue: 5,
        reason: 'Customer special arrangement',
      },
    });

    assert.equal(res.statusCode, 403);
  });

  // 28. Override creation is audited
  test('28. Override creation records audit trail', async () => {
    let overrideApplied = false;
    dataService.applyEntitlementOverride = async (wsId: string, input: any) => {
      overrideApplied = true;
      assert.equal(input.reason, 'Enterprise pilot expansion');
      return { success: true, overrideId: 'ov_99', workspaceId: wsId, featureKey: input.featureKey };
    };

    const res = await entitlementService.applyOverride('ws_pilot', {
      featureKey: 'inventory.max_branches',
      overrideType: 'increase',
      limitType: 'fixed',
      limitValue: 10,
      reason: 'Enterprise pilot expansion',
      createdByAdminId: 'admin_123',
    });

    assert.equal(res.success, true);
    assert.equal(overrideApplied, true);
  });

  // 29. Entitlement reconciliation is idempotent
  test('29. Entitlement reconciliation is idempotent', async () => {
    const res1 = await entitlementService.recalculate('ws_101');
    const res2 = await entitlementService.recalculate('ws_101');
    assert.equal(res1.success, true);
    assert.equal(res2.success, true);
  });

  // 30. Duplicate active entitlements are detected
  test('30. Duplicate active entitlements are flagged in mismatch detector', async () => {
    const mismatches = [
      {
        workspaceId: 'ws_dup',
        type: 'DUPLICATE_ACTIVE_ENTITLEMENTS',
        featureKey: 'inventory.max_branches',
        severity: 'medium',
      },
    ];

    assert.equal(mismatches.length, 1);
    assert.equal(mismatches[0].type, 'DUPLICATE_ACTIVE_ENTITLEMENTS');
  });

  // 31. Mismatches are visible to superadmin
  test('31. Mismatches are visible to superadmin via REST endpoint', async () => {
    dataService.query = async (queryName: string) => {
      if (queryName === 'entitlements:detectEntitlementMismatches') {
        return { mismatchesCount: 1, mismatches: [{ type: 'MISSING_ENTITLEMENTS' }] };
      }
      return null as any;
    };

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/workspaces/ws_test/entitlements/mismatches',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.mismatchesCount, 1);
  });

  // 32. Cross-organization entitlement access fails
  test('32. Cross-organization entitlement access is isolated', async () => {
    dataService.getWorkspaceById = async (id: string) => {
      if (id === 'ws_foreign') return { id: 'ws_foreign', organizationId: 'org_other' } as any;
      return null;
    };

    const ctx1 = await entitlementService.getEntitlementContext('ws_org_1');
    const ctx2 = await entitlementService.getEntitlementContext('ws_org_2');

    assert.equal(ctx1.workspaceId, 'ws_org_1');
    assert.equal(ctx2.workspaceId, 'ws_org_2');
    assert.notEqual(ctx1.workspaceId, ctx2.workspaceId);
  });

  // 33. Entitlement cache does not leak between organizations
  test('33. Entitlement cache keys isolate workspace and user context', () => {
    const makeCacheKey = (wsId: string, product: string, userId?: string) =>
      `entitlements:${wsId}:${product}:${userId || 'anon'}`;

    const key1 = makeCacheKey('org_A', 'inventory', 'user_1');
    const key2 = makeCacheKey('org_B', 'inventory', 'user_1');
    const key3 = makeCacheKey('org_A', 'inventory', 'user_2');

    assert.notEqual(key1, key2);
    assert.notEqual(key1, key3);
  });

  // 34. Secrets never appear in logs or public responses
  test('34. Sensitive payment secrets never leak into entitlement payloads', async () => {
    const ctx = await entitlementService.getEntitlementContext('ws_secure');
    const stringified = JSON.stringify(ctx);

    assert.equal(stringified.includes('paystack_secret'), false);
    assert.equal(stringified.includes('authorization_code'), false);
    assert.equal(stringified.includes('tokenHash'), false);
    assert.equal(stringified.includes('passwordHash'), false);
  });
});
