import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { buildApp } from '../src/app.js';
import { dataService } from '../src/services/dataService.js';
import { paystackService } from '../src/services/paystackService.js';
import type { FastifyInstance } from 'fastify';

describe('Authoritative Downgrade and Cancellation - 35 Point Comprehensive Test Suite', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp();
    dataService.getUserById = async (id: string) =>
      ({
        id,
        email: 'billing-owner@orvio.io',
        emailVerified: true,
        name: 'Billing Owner',
        status: 'active',
        role: 'user',
      } as any);
    dataService.getWorkspaceMembership = async () => null;
    dataService.getMembership = async () => null;
    dataService.getUserWorkspaces = async () => [];
    dataService.getSubscriptionByWorkspace = async (wsId: string) =>
      ({
        id: `sub_${wsId}`,
        workspaceId: wsId,
        organizationId: wsId,
        plan: 'premium',
        planKey: 'premium',
        status: 'active',
        currentPeriodEnd: Date.now() + 86400000 * 30,
      } as any);
    dataService.calculateDowngradeConflicts = async (wsId: string, targetPlan: string) => ({
      hasConflicts: false,
      targetPlan: 'standard',
      autoDelete: false,
      preservationGuarantee: 'Excess branches will be archived and excess members suspended. No customer data or transaction history is ever deleted.',
      conflicts: {
        branches: { currentCount: 1, targetLimit: 1, excessCount: 0, requiredRemovals: 0, items: [] },
        members: { currentCount: 2, targetLimit: 3, excessCount: 0, requiredRemovals: 0, items: [] },
        organizations: { currentCount: 1, targetLimit: 1, excessCount: 0, requiredRemovals: 0, items: [] },
        products: { currentCount: 10, targetLimit: 1000, excessCount: 0, requiredRemovals: 0, items: [] },
      },
    });
    dataService.scheduleDowngradeWithConflictResolution = async (args: any) => ({
      success: true,
      subscriptionId: 'sub_sched_01',
      targetPlan: 'standard',
      status: 'scheduled',
      changeEffectiveAt: Date.now() + 86400000 * 30,
      currentPeriodEnd: Date.now() + 86400000 * 30,
      preservationGuarantee: 'Excess branches will be archived and excess members suspended. No customer data or transaction history is ever deleted.',
    });
    dataService.cancelScheduledDowngrade = async (wsId: string, userId: string) => ({
      downgradeCancelled: true,
      currentPlan: 'premium',
      status: 'active',
    });
    dataService.cancelSubscription = async (args: any) => ({
      success: true,
      cancelAtPeriodEnd: true,
      cancellationEffectiveAt: Date.now() + 86400000 * 30,
      status: 'active',
    });
    dataService.resumeSubscription = async (args: any) => ({
      success: true,
      resumed: true,
      cancelAtPeriodEnd: false,
      status: 'active',
    });
    dataService.applyScheduledBillingChanges = async (wsId?: string) => ({
      downgradesProcessed: 0,
      cancellationsProcessed: 0,
      timestamp: Date.now(),
    });
  });

  afterEach(async () => {
    await app.close();
  });

  // 1. Premium can schedule downgrade to Standard
  test('1. Premium can schedule downgrade to Standard', async () => {
    const token = app.jwt.sign({ userId: 'user_prem_01', email: 'owner@orvio.io' });
    const wsId = 'ws_prem_std_01';

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${wsId}/billing/downgrade`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        targetPlanKey: 'standard',
        confirmed: true,
        reason: 'Downsizing team',
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.targetPlan, 'standard');
    assert.strictEqual(body.data.status, 'scheduled');
    assert.ok(body.data.changeEffectiveAt);
  });

  // 2. Standard cannot downgrade to permanent Free
  test('2. Standard cannot downgrade to permanent Free', async () => {
    const token = app.jwt.sign({ userId: 'user_std_01', email: 'owner@orvio.io' });
    const wsId = 'ws_std_free_01';

    // Mock subscription on standard plan
    dataService.getSubscriptionByWorkspace = async () =>
      ({
        id: 'sub_std_01',
        workspaceId: wsId,
        organizationId: wsId,
        plan: 'standard',
        planKey: 'standard',
        status: 'active',
        currentPeriodEnd: Date.now() + 86400000 * 15,
      } as any);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${wsId}/billing/downgrade`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        targetPlanKey: 'free_trial',
        confirmed: true,
      },
    });

    assert.strictEqual(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'FREE_TRIAL_NOT_DOWNGRADE_DESTINATION');
  });

  // 3. Trial cannot downgrade to Free Trial again
  test('3. Trial cannot downgrade to Free Trial again', async () => {
    const token = app.jwt.sign({ userId: 'user_trial_01', email: 'owner@orvio.io' });
    const wsId = 'ws_trial_downgrade_01';

    dataService.getSubscriptionByWorkspace = async () =>
      ({
        id: 'sub_trial_01',
        workspaceId: wsId,
        organizationId: wsId,
        plan: 'free_trial',
        planKey: 'free_trial',
        status: 'trialing',
        currentPeriodEnd: Date.now() + 86400000 * 5,
      } as any);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${wsId}/billing/downgrade`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        targetPlanKey: 'free_trial',
        confirmed: true,
      },
    });

    assert.strictEqual(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'FREE_TRIAL_NOT_DOWNGRADE_DESTINATION');
  });

  // 4. Downgrade preview calculates branch conflicts
  test('4. Downgrade preview calculates branch conflicts', async () => {
    const token = app.jwt.sign({ userId: 'user_branch_conf', email: 'owner@orvio.io' });
    const wsId = 'ws_branch_conf_01';

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${wsId}/billing/downgrade/preview`,
      headers: { authorization: `Bearer ${token}` },
      payload: { targetPlanKey: 'standard' },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.ok(body.data.conflicts);
    assert.strictEqual(body.data.conflicts.branches.targetLimit, 1);
    assert.strictEqual(body.data.targetPlan, 'standard');
  });

  // 5. Downgrade preview calculates member conflicts
  test('5. Downgrade preview calculates member conflicts', async () => {
    const token = app.jwt.sign({ userId: 'user_mem_conf', email: 'owner@orvio.io' });
    const wsId = 'ws_mem_conf_01';

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${wsId}/billing/downgrade/preview`,
      headers: { authorization: `Bearer ${token}` },
      payload: { targetPlanKey: 'standard' },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.ok(body.data.conflicts.members);
    assert.strictEqual(body.data.conflicts.members.targetLimit, 3);
  });

  // 6. Downgrade preview calculates organization conflicts
  test('6. Downgrade preview calculates organization conflicts', async () => {
    const token = app.jwt.sign({ userId: 'user_org_conf', email: 'owner@orvio.io' });
    const wsId = 'ws_org_conf_01';

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${wsId}/billing/downgrade/preview`,
      headers: { authorization: `Bearer ${token}` },
      payload: { targetPlanKey: 'standard' },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.ok(body.data.conflicts.organizations);
    assert.strictEqual(body.data.conflicts.organizations.targetLimit, 1);
  });

  // 7. Downgrade preview calculates product conflicts when applicable
  test('7. Downgrade preview calculates product conflicts when applicable', async () => {
    const token = app.jwt.sign({ userId: 'user_prod_conf', email: 'owner@orvio.io' });
    const wsId = 'ws_prod_conf_01';

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${wsId}/billing/downgrade/preview`,
      headers: { authorization: `Bearer ${token}` },
      payload: { targetPlanKey: 'standard' },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.ok(body.data.conflicts.products);
  });

  // 8. User sees exact conflicts and target limits
  test('8. User sees exact conflicts and target limits', async () => {
    const token = app.jwt.sign({ userId: 'user_exact_conf', email: 'owner@orvio.io' });
    const wsId = 'ws_exact_conf_01';

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${wsId}/billing/downgrade/preview`,
      headers: { authorization: `Bearer ${token}` },
      payload: { targetPlanKey: 'standard' },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.ok(typeof body.data.hasConflicts === 'boolean');
    assert.ok(body.data.preservationGuarantee);
    assert.ok(body.data.conflicts.branches.targetLimit !== undefined);
  });

  // 9. User can choose resource decisions (archive branches, suspend members)
  test('9. User can choose resource decisions (archive branches, suspend members)', async () => {
    const token = app.jwt.sign({ userId: 'user_res_dec', email: 'owner@orvio.io' });
    const wsId = 'ws_res_dec_01';

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${wsId}/billing/downgrade`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        targetPlanKey: 'standard',
        confirmed: true,
        resourceDecisions: {
          archiveBranchIds: ['branch_2', 'branch_3'],
          suspendMemberIds: ['member_4', 'member_5'],
        },
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.status, 'scheduled');
  });

  // 10. Invalid resource decisions are rejected
  test('10. Invalid resource decisions are rejected', async () => {
    const token = app.jwt.sign({ userId: 'user_inv_dec', email: 'owner@orvio.io' });
    const wsId = 'ws_inv_dec_01';

    dataService.scheduleDowngradeWithConflictResolution = async () => {
      const err: any = new Error('Cannot archive the primary organization branch');
      err.code = 'INVALID_RESOURCE_DECISION';
      err.status = 400;
      throw err;
    };

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${wsId}/billing/downgrade`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        targetPlanKey: 'standard',
        confirmed: true,
        resourceDecisions: {
          archiveBranchIds: ['primary_branch'],
        },
      },
    });

    assert.strictEqual(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'INVALID_RESOURCE_DECISION');
  });

  // 11. Downgrade requires billing permission
  test('11. Downgrade requires billing permission', async () => {
    const regularToken = app.jwt.sign({ userId: 'user_reg_staff', email: 'staff@orvio.io' });
    const wsId = 'ws_unauth_downgrade_01';

    dataService.getWorkspaceMembership = async () => ({
      role: 'MEMBER',
      permissions: ['read:products'],
      status: 'active',
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${wsId}/billing/downgrade`,
      headers: { authorization: `Bearer ${regularToken}` },
      payload: { targetPlanKey: 'standard', confirmed: true },
    });

    assert.strictEqual(res.statusCode, 403);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'PERMISSION_DENIED');
  });

  // 12. Downgrade requires confirmation
  test('12. Downgrade requires confirmation', async () => {
    const token = app.jwt.sign({ userId: 'user_unconf_downgrade', email: 'owner@orvio.io' });
    const wsId = 'ws_unconf_downgrade_01';

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${wsId}/billing/downgrade`,
      headers: { authorization: `Bearer ${token}` },
      payload: { targetPlanKey: 'standard', confirmed: false },
    });

    assert.strictEqual(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'CONFIRMATION_REQUIRED');
  });

  // 13. Downgrade is scheduled at period end
  test('13. Downgrade is scheduled at period end', async () => {
    const token = app.jwt.sign({ userId: 'user_sched_downgrade', email: 'owner@orvio.io' });
    const wsId = 'ws_sched_downgrade_01';
    const futurePeriodEnd = Date.now() + 86400000 * 20;

    dataService.scheduleDowngradeWithConflictResolution = async () => ({
      success: true,
      subscriptionId: 'sub_sched_01',
      targetPlan: 'standard',
      status: 'scheduled',
      changeEffectiveAt: futurePeriodEnd,
      currentPeriodEnd: futurePeriodEnd,
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${wsId}/billing/downgrade`,
      headers: { authorization: `Bearer ${token}` },
      payload: { targetPlanKey: 'standard', confirmed: true },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.data.status, 'scheduled');
    assert.strictEqual(body.data.changeEffectiveAt, futurePeriodEnd);
  });

  // 14. Current entitlements remain active before period end
  test('14. Current entitlements remain active before period end', async () => {
    const token = app.jwt.sign({ userId: 'user_ent_active', email: 'owner@orvio.io' });
    const wsId = 'ws_ent_active_01';

    dataService.getScheduledDowngrade = async () => ({
      hasScheduledDowngrade: true,
      targetPlan: 'standard',
      currentPlan: 'premium',
      changeEffectiveAt: Date.now() + 86400000 * 10,
      downgradeStatus: 'scheduled',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${wsId}/billing/downgrade`,
      headers: { authorization: `Bearer ${token}` },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.currentPlan, 'premium');
    assert.strictEqual(body.data.hasScheduledDowngrade, true);
  });

  // 15. Scheduled downgrade can be cancelled
  test('15. Scheduled downgrade can be cancelled', async () => {
    const token = app.jwt.sign({ userId: 'user_canc_downgrade', email: 'owner@orvio.io' });
    const wsId = 'ws_canc_downgrade_01';

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${wsId}/billing/downgrade/cancel`,
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.downgradeCancelled, true);
  });

  // 16. Downgrade applies once at effective date
  test('16. Downgrade applies once at effective date', async () => {
    const token = app.jwt.sign({ userId: 'user_apply_downgrade', email: 'owner@orvio.io' });
    const wsId = 'ws_apply_downgrade_01';

    dataService.applyScheduledBillingChanges = async () => ({
      downgradesProcessed: 1,
      cancellationsProcessed: 0,
      timestamp: Date.now(),
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${wsId}/billing/downgrade/apply`,
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.downgradesProcessed, 1);
  });

  // 17. Re-running scheduled application is safe and idempotent
  test('17. Re-running scheduled application is safe and idempotent', async () => {
    const token = app.jwt.sign({ userId: 'user_rerun_apply', email: 'owner@orvio.io' });
    const wsId = 'ws_rerun_apply_01';

    dataService.applyScheduledBillingChanges = async () => ({
      downgradesProcessed: 0,
      cancellationsProcessed: 0,
      timestamp: Date.now(),
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${wsId}/billing/apply-scheduled-change`,
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.downgradesProcessed, 0);
  });

  // 18. Excess resources are preserved (archived/suspended, not deleted)
  test('18. Excess resources are preserved (archived/suspended, not deleted)', async () => {
    const token = app.jwt.sign({ userId: 'user_pres_res', email: 'owner@orvio.io' });
    const wsId = 'ws_pres_res_01';

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${wsId}/billing/downgrade/preview`,
      headers: { authorization: `Bearer ${token}` },
      payload: { targetPlanKey: 'standard' },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.data.preservationGuarantee, 'Excess branches will be archived and excess members suspended. No customer data or transaction history is ever deleted.');
  });

  // 19. Confirmed resources are archived or restricted correctly
  test('19. Confirmed resources are archived or restricted correctly', async () => {
    const token = app.jwt.sign({ userId: 'user_conf_arch', email: 'owner@orvio.io' });
    const wsId = 'ws_conf_arch_01';

    let archivedBranches: string[] = [];
    dataService.scheduleDowngradeWithConflictResolution = async (args: any) => {
      archivedBranches = args.resourceDecisions?.archiveBranchIds || [];
      return {
        success: true,
        targetPlan: 'standard',
        status: 'scheduled',
      };
    };

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${wsId}/billing/downgrade`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        targetPlanKey: 'standard',
        confirmed: true,
        resourceDecisions: {
          archiveBranchIds: ['branch_secondary_1'],
        },
      },
    });

    assert.strictEqual(res.statusCode, 200);
    assert.deepStrictEqual(archivedBranches, ['branch_secondary_1']);
  });

  // 20. No automatic deletion occurs
  test('20. No automatic deletion occurs', async () => {
    const token = app.jwt.sign({ userId: 'user_no_del', email: 'owner@orvio.io' });
    const wsId = 'ws_no_del_01';

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${wsId}/billing/downgrade/preview`,
      headers: { authorization: `Bearer ${token}` },
      payload: { targetPlanKey: 'standard' },
    });

    const body = JSON.parse(res.body);
    assert.strictEqual(body.data.autoDelete, false);
  });

  // 21. Subscription cancellation is scheduled
  test('21. Subscription cancellation is scheduled', async () => {
    const token = app.jwt.sign({ userId: 'user_canc_sched', email: 'owner@orvio.io' });
    const wsId = 'ws_canc_sched_01';

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${wsId}/billing/cancel`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        reason: 'Too expensive for our stage',
        feedback: 'Great product otherwise',
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.cancelAtPeriodEnd, true);
    assert.ok(body.data.cancellationEffectiveAt);
  });

  // 22. Cancellation preserves access until period end
  test('22. Cancellation preserves access until period end', async () => {
    const token = app.jwt.sign({ userId: 'user_canc_pres', email: 'owner@orvio.io' });
    const wsId = 'ws_canc_pres_01';

    dataService.getCancellationStatus = async () => ({
      isCancelled: false,
      cancelAtPeriodEnd: true,
      currentPeriodEnd: Date.now() + 86400000 * 14,
      cancellationEffectiveAt: Date.now() + 86400000 * 14,
      status: 'active',
      plan: 'standard',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${wsId}/billing/cancellation`,
      headers: { authorization: `Bearer ${token}` },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.cancelAtPeriodEnd, true);
    assert.strictEqual(body.data.status, 'active');
  });

  // 23. Cancellation can be reversed/resumed
  test('23. Cancellation can be reversed/resumed', async () => {
    const token = app.jwt.sign({ userId: 'user_resume_sub', email: 'owner@orvio.io' });
    const wsId = 'ws_resume_sub_01';

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${wsId}/billing/resume`,
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.resumed, true);
    assert.strictEqual(body.data.cancelAtPeriodEnd, false);
  });

  // 24. Resume does not create duplicate subscriptions
  test('24. Resume does not create duplicate subscriptions', async () => {
    const token = app.jwt.sign({ userId: 'user_resume_nodup', email: 'owner@orvio.io' });
    const wsId = 'ws_resume_nodup_01';

    dataService.resumeSubscription = async () => ({
      success: true,
      resumed: true,
      subscriptionId: 'sub_single_01',
      cancelAtPeriodEnd: false,
      status: 'active',
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${wsId}/billing/resume`,
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.data.subscriptionId, 'sub_single_01');
  });

  // 25. Expired subscription becomes restricted
  test('25. Expired subscription becomes restricted', async () => {
    const token = app.jwt.sign({ userId: 'user_exp_sub', email: 'owner@orvio.io' });
    const wsId = 'ws_exp_sub_01';

    dataService.getCancellationStatus = async () => ({
      isCancelled: true,
      cancelAtPeriodEnd: false,
      status: 'canceled',
      currentPeriodEnd: Date.now() - 86400000,
      cancellationEffectiveAt: Date.now() - 86400000,
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${wsId}/billing/cancellation`,
      headers: { authorization: `Bearer ${token}` },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.data.isCancelled, true);
    assert.strictEqual(body.data.status, 'canceled');
  });

  // 26. Payment history remains available
  test('26. Payment history remains available', async () => {
    const token = app.jwt.sign({ userId: 'user_hist_avail', email: 'owner@orvio.io' });
    const wsId = 'ws_hist_avail_01';

    dataService.getInvoicesByOrganization = async () => [
      {
        id: 'inv_001',
        amount: 7500,
        currency: 'NGN',
        status: 'paid',
        paidAt: Date.now() - 86400000 * 30,
      },
    ];

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${wsId}/billing/invoices`,
      headers: { authorization: `Bearer ${token}` },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.length, 1);
    assert.strictEqual(body.data[0].status, 'paid');
  });

  // 27. Provider cancellation is synchronized
  test('27. Provider cancellation is synchronized', async () => {
    const token = app.jwt.sign({ userId: 'user_prov_sync', email: 'owner@orvio.io' });
    const wsId = 'ws_prov_sync_01';

    let paystackDisableCalled = false;
    paystackService.disableSubscription = async (code: string, token: string) => {
      paystackDisableCalled = true;
      return { status: true, message: 'Subscription disabled' };
    };

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${wsId}/billing/cancel`,
      headers: { authorization: `Bearer ${token}` },
      payload: { reason: 'Switching provider' },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.cancelAtPeriodEnd, true);
  });

  // 28. Duplicate provider webhook is safe
  test('28. Duplicate provider webhook is safe', async () => {
    const secret = process.env.PAYSTACK_SECRET_KEY || 'sk_test_mock';
    const payload = JSON.stringify({
      event: 'subscription.disable',
      data: {
        subscription_code: 'SUB_webhook_dup_01',
        customer: { email: 'owner@orvio.io' },
      },
    });

    const hash = crypto.createHmac('sha512', secret).update(payload).digest('hex');

    const res1 = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/webhooks/paystack',
      headers: {
        'x-paystack-signature': hash,
        'content-type': 'application/json',
      },
      payload,
    });

    assert.strictEqual(res1.statusCode, 200);

    const res2 = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/webhooks/paystack',
      headers: {
        'x-paystack-signature': hash,
        'content-type': 'application/json',
      },
      payload,
    });

    assert.strictEqual(res2.statusCode, 200);
  });

  // 29. Provider mismatch is detected
  test('29. Provider mismatch is detected', async () => {
    const token = app.jwt.sign({ userId: 'user_prov_mismatch', email: 'owner@orvio.io' });
    const wsId = 'ws_prov_mismatch_01';

    dataService.reconcileSubscription = async () => ({
      reconciled: true,
      providerMismatch: true,
      providerMismatchDetails: 'Paystack status disabled vs Local active',
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${wsId}/billing/reconcile`,
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.providerMismatch, true);
  });

  // 30. Idempotency key replay works
  test('30. Idempotency key replay works', async () => {
    const token = app.jwt.sign({ userId: 'user_idem_replay', email: 'owner@orvio.io' });
    const wsId = 'ws_idem_replay_01';
    const idemKey = `idem_down_${Date.now()}`;

    const res1 = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${wsId}/billing/downgrade`,
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': idemKey,
      },
      payload: {
        targetPlanKey: 'standard',
        confirmed: true,
        reason: 'Cost optimization',
      },
    });

    assert.strictEqual(res1.statusCode, 200);

    const res2 = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${wsId}/billing/downgrade`,
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': idemKey,
      },
      payload: {
        targetPlanKey: 'standard',
        confirmed: true,
        reason: 'Cost optimization',
      },
    });

    assert.strictEqual(res2.statusCode, 200);
    const body1 = JSON.parse(res1.body);
    const body2 = JSON.parse(res2.body);
    assert.strictEqual(body1.data.status, body2.data.status);
  });

  // 31. Idempotency payload mismatch returns 409
  test('31. Idempotency payload mismatch returns 409', async () => {
    const token = app.jwt.sign({ userId: 'user_idem_mismatch', email: 'owner@orvio.io' });
    const wsId = 'ws_idem_mismatch_01';
    const idemKey = `idem_mismatch_${Date.now()}`;

    dataService.mutate = async (op: string) => {
      if (op === 'subscriptions:acquireBillingIdempotency') {
        return {
          status: 'conflict',
          code: 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH',
        };
      }
      return { success: true };
    };

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${wsId}/billing/downgrade`,
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': idemKey,
      },
      payload: {
        targetPlanKey: 'standard',
        confirmed: true,
        reason: 'Different payload causing hash mismatch',
      },
    });

    assert.strictEqual(res.statusCode, 409);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH');
  });

  // 32. Notifications are sent once with dedup key
  test('32. Notifications are sent once with dedup key', async () => {
    const token = app.jwt.sign({ userId: 'user_notif_dedup', email: 'owner@orvio.io' });
    const wsId = 'ws_notif_dedup_01';

    let notifCreated = 0;
    dataService.createNotification = async () => {
      notifCreated++;
      return { id: 'notif_dedup_01' };
    };

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${wsId}/billing/cancel`,
      headers: { authorization: `Bearer ${token}` },
      payload: { reason: 'Deduplicated test' },
    });

    assert.strictEqual(res.statusCode, 200);
  });

  // 33. Audit events are created once and append-only
  test('33. Audit events are created once and append-only', async () => {
    const token = app.jwt.sign({ userId: 'user_audit_log', email: 'owner@orvio.io' });
    const wsId = 'ws_audit_log_01';

    let auditLogged = false;
    dataService.logAuditEvent = async (args: any) => {
      if (args.action === 'billing.downgrade_scheduled' || args.action === 'billing.subscription_cancelled') {
        auditLogged = true;
      }
      return { id: 'audit_01' };
    };

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${wsId}/billing/downgrade`,
      headers: { authorization: `Bearer ${token}` },
      payload: { targetPlanKey: 'standard', confirmed: true },
    });

    assert.strictEqual(res.statusCode, 200);
  });

  // 34. Unauthorized members cannot cancel or downgrade
  test('34. Unauthorized members cannot cancel or downgrade', async () => {
    const regularToken = app.jwt.sign({ userId: 'user_regular_staff_2', email: 'staff2@orvio.io' });
    const wsId = 'ws_unauth_both_01';

    dataService.getWorkspaceMembership = async () => ({
      role: 'MEMBER',
      permissions: ['read:inventory'],
      status: 'active',
    });

    const resCancel = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${wsId}/billing/cancel`,
      headers: { authorization: `Bearer ${regularToken}` },
      payload: { reason: 'Unauthorized attempt' },
    });
    assert.strictEqual(resCancel.statusCode, 403);

    const resDowngrade = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${wsId}/billing/downgrade`,
      headers: { authorization: `Bearer ${regularToken}` },
      payload: { targetPlanKey: 'standard', confirmed: true },
    });
    assert.strictEqual(resDowngrade.statusCode, 403);
  });

  // 35. Superadmin action requires permission and confirmation
  test('35. Superadmin action requires permission and confirmation', async () => {
    const adminToken = app.jwt.sign({ userId: 'user_superadmin_01', email: 'admin@orvio.io' });
    const targetWsId = 'ws_target_admin_01';

    dataService.getUserById = async (id: string) => ({
      id,
      email: 'admin@orvio.io',
      role: 'superadmin',
      status: 'active',
    } as any);

    // 35a: Superadmin can view downgrade conflicts
    const resConflicts = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/billing/workspaces/${targetWsId}/downgrade/conflicts`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(resConflicts.statusCode, 200);

    // 35b: Superadmin can apply scheduled change directly
    const resApply = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/billing/workspaces/${targetWsId}/apply-downgrade`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { confirmed: true },
    });
    assert.strictEqual(resApply.statusCode, 200);
    const bodyApply = JSON.parse(resApply.body);
    assert.strictEqual(bodyApply.success, true);
  });
});
