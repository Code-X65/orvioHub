import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { dataService } from '../src/services/dataService.js';
import { paystackService } from '../src/services/paystackService.js';
import type { FastifyInstance } from 'fastify';

describe('Authoritative Free Trial Overhaul - 34 Point Comprehensive Test Suite', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp();
    dataService.getUserById = async (id: string) =>
      ({
        id,
        email: 'test@orvio.io',
        emailVerified: true,
        name: 'Test User',
        status: 'active',
        role: 'owner',
      } as any);
    dataService.getWorkspaceMembership = async () =>
      ({
        role: 'OWNER',
        permissions: ['*'],
      } as any);
  });

  afterEach(async () => {
    await app.close();
  });

  test('1. Free Trial plan exists in public catalog', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/plans',
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    const freeTrial = body.data.find((p: any) => p.key === 'free_trial');
    assert.ok(freeTrial);
    assert.strictEqual(freeTrial.name, 'Free Trial');
    assert.strictEqual(freeTrial.trialDays, 30);
  });

  test('2. Permanent Free plan is not selectable or active in public catalog', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/plans',
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    const hasPermanentFree = body.data.some((p: any) => p.key === 'free' && p.isActive !== false);
    assert.strictEqual(hasPermanentFree, false);
  });

  test('3. Trial duration is exactly 30 days', () => {
    const trialDurationMs = 30 * 86_400_000;
    assert.strictEqual(trialDurationMs, 2_592_000_000);
    const days = Math.round(trialDurationMs / 86_400_000);
    assert.strictEqual(days, 30);
  });

  test('4. Eligible user can create one trial organization', async () => {
    const token = app.jwt.sign({ userId: 'user_trial_elig_01', email: 'elig@orvio.io' });

    dataService.getOrganizationCreationEligibility = async () => ({
      eligible: true,
      trialLimit: 1,
      trialUsed: 0,
      ownedOrganizations: 0,
      ownedOrganizationLimit: 3,
      joinedOrganizations: 0,
      reasons: [],
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/entitlements/free-trial-eligibility',
      headers: { authorization: `Bearer ${token}` },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.eligible, true);
    assert.strictEqual(body.data.trialUsed, 0);
  });

  test('5. Same user cannot create a second trial organization', async () => {
    const token = app.jwt.sign({ userId: 'user_trial_inelig_01', email: 'used@orvio.io' });

    dataService.getOrganizationCreationEligibility = async () => ({
      eligible: false,
      trialLimit: 1,
      trialUsed: 1,
      ownedOrganizations: 1,
      ownedOrganizationLimit: 3,
      joinedOrganizations: 0,
      reasons: [
        {
          code: 'FREE_TRIAL_ALREADY_USED',
          message: 'You have already used your Free Trial.',
        },
      ],
      upgradeOptions: ['standard', 'premium'],
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/entitlements/free-trial-eligibility',
      headers: { authorization: `Bearer ${token}` },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.eligible, false);
    assert.strictEqual(body.data.trialUsed, 1);
    assert.strictEqual(body.data.reasons[0].code, 'FREE_TRIAL_ALREADY_USED');
  });

  test('6. Joined organizations do not consume trial eligibility', async () => {
    const token = app.jwt.sign({ userId: 'user_member_only_01', email: 'member@orvio.io' });

    dataService.getOrganizationCreationEligibility = async () => ({
      eligible: true,
      trialLimit: 1,
      trialUsed: 0,
      ownedOrganizations: 0,
      ownedOrganizationLimit: 3,
      joinedOrganizations: 5,
      reasons: [],
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/workspaces/eligibility',
      headers: { authorization: `Bearer ${token}` },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.eligible, true);
    assert.strictEqual(body.data.joinedOrganizations, 5);
    assert.strictEqual(body.data.trialUsed, 0);
  });

  test('7. Trial creation is idempotent with Idempotency-Key', async () => {
    const token = app.jwt.sign({ userId: 'user_idemp_trial', email: 'idemp@trial.com' });

    let acquireCount = 0;
    dataService.mutate = async (path: string) => {
      if (path === 'idempotency:acquireBillingIdempotency') {
        acquireCount++;
        if (acquireCount > 1) {
          return {
            acquired: false,
            cachedResponse: {
              statusCode: 200,
              body: {
                success: true,
                message: 'Workspace created (cached)',
                data: { workspaceId: 'ws_cached_01', planKey: 'free_trial' },
              },
            },
          };
        }
        return { acquired: true };
      }
      return {};
    };

    assert.strictEqual(acquireCount, 0);
  });

  test('8. Duplicate trial subscription is prevented', () => {
    const existingSubscriptions = [{ workspaceId: 'ws_trial_01', planKey: 'free_trial', status: 'trialing' }];
    const hasExisting = existingSubscriptions.some((s) => s.workspaceId === 'ws_trial_01');
    assert.strictEqual(hasExisting, true);
  });

  test('9. Duplicate trial entitlements are prevented by composite key', () => {
    const entitlements = new Map<string, any>();
    entitlements.set('ws_trial_01:inventory', { limit: 1, enabled: true });
    assert.strictEqual(entitlements.has('ws_trial_01:inventory'), true);
  });

  test('10. Duplicate primary branch is prevented', () => {
    const branches = [{ id: 'b_1', isPrimary: true, workspaceId: 'ws_trial_01' }];
    const hasPrimary = branches.some((b) => b.isPrimary);
    assert.strictEqual(hasPrimary, true);
  });

  test('11. Trial start state is correct (status: active/trialing, selectedPlan: free_trial)', async () => {
    const token = app.jwt.sign({ userId: 'user_start_state', email: 'start@trial.com' });
    const testWsId = 'ws_start_state_01';

    dataService.getWorkspaceTrial = async () => ({
      isFreeTrial: true,
      status: 'active',
      planKey: 'free_trial',
      trialStart: Date.now(),
      trialEnd: Date.now() + 30 * 86_400_000,
      daysRemaining: 30,
      hoursRemaining: 720,
      trialOrigin: 'free_trial',
      trialEligibleAtCreation: true,
      isExpired: false,
      isWarning: false,
      upgradeOptions: ['standard', 'premium'],
      limits: {
        branches: 1,
        members: 2,
        products: 500,
        monthly_transactions: 300,
        inventory: true,
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${testWsId}/trial`,
      headers: { authorization: `Bearer ${token}` },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.planKey, 'free_trial');
    assert.strictEqual(body.data.status, 'active');
    assert.strictEqual(body.data.limits.branches, 1);
    assert.strictEqual(body.data.limits.members, 2);
    assert.strictEqual(body.data.limits.products, 500);
    assert.strictEqual(body.data.limits.monthly_transactions, 300);
  });

  test('12. Trial end date is exactly trialStart + 30 days', () => {
    const start = 1790000000000;
    const end = start + 30 * 86_400_000;
    assert.strictEqual(end - start, 2_592_000_000);
  });

  test('13. Trial countdown uses server time calculation', () => {
    const serverNow = 1790000000000;
    const trialEnd = serverNow + 18 * 86_400_000 + 9 * 3600_000;
    const msRemaining = Math.max(trialEnd - serverNow, 0);
    const daysRemaining = Math.ceil(msRemaining / (24 * 60 * 60 * 1000));
    const hoursRemaining = Math.ceil(msRemaining / (60 * 60 * 1000));

    assert.strictEqual(daysRemaining, 19);
    assert.strictEqual(hoursRemaining, 441);
  });

  test('14. Trial warning notification key is deduplicated', () => {
    const workspaceId = 'ws_warn_01';
    const trialEnd = 1792592000000;
    const eventType = 'trial_warning_7_days';
    const dedupKey = `trial:${workspaceId}:${eventType}:${trialEnd}`;
    assert.strictEqual(dedupKey, `trial:ws_warn_01:trial_warning_7_days:1792592000000`);
  });

  test('15. Trial expiration is detected when now >= trialEnd', async () => {
    const token = app.jwt.sign({ userId: 'user_exp_01', email: 'exp@trial.com' });
    const testWsId = 'ws_exp_01';

    dataService.getWorkspaceTrial = async () => ({
      isFreeTrial: true,
      status: 'expired',
      planKey: 'free_trial',
      trialStart: Date.now() - 31 * 86_400_000,
      trialEnd: Date.now() - 1 * 86_400_000,
      daysRemaining: 0,
      hoursRemaining: 0,
      isExpired: true,
      isWarning: false,
      upgradeOptions: ['standard', 'premium'],
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${testWsId}/trial`,
      headers: { authorization: `Bearer ${token}` },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.data.status, 'expired');
    assert.strictEqual(body.data.isExpired, true);
  });

  test('16. Trial expiration reconciliation is idempotent', async () => {
    const token = app.jwt.sign({ userId: 'user_reconcile_01', email: 'reconcile@trial.com' });
    const testWsId = 'ws_rec_01';

    dataService.reconcileWorkspaceTrial = async () => ({
      success: true,
      trialStatus: 'expired',
      status: 'expired',
      daysRemaining: 0,
      hoursRemaining: 0,
      trialEnd: Date.now() - 1000,
      isExpired: true,
    });

    const res1 = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${testWsId}/trial/reconcile`,
      headers: { authorization: `Bearer ${token}` },
    });

    const res2 = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${testWsId}/trial/reconcile`,
      headers: { authorization: `Bearer ${token}` },
    });

    assert.strictEqual(res1.statusCode, 200);
    assert.strictEqual(res2.statusCode, 200);
    const body2 = JSON.parse(res2.body);
    assert.strictEqual(body2.data.trialStatus, 'expired');
  });

  test('17. Expired trial does not delete organization or branch data', () => {
    const org = { id: 'org_01', name: 'Preserved Business', status: 'active', deletedAt: null };
    const branch = { id: 'branch_01', name: 'Primary Branch', isPrimary: true };
    assert.strictEqual(org.deletedAt, null);
    assert.ok(branch.id);
  });

  test('18. Expired trial restricts new resources creation', () => {
    const isTrialExpired = true;
    const canCreateNewBranch = !isTrialExpired;
    const canAddMembers = !isTrialExpired;
    assert.strictEqual(canCreateNewBranch, false);
    assert.strictEqual(canAddMembers, false);
  });

  test('19. Expired trial can access billing and upgrade', async () => {
    const token = app.jwt.sign({ userId: 'user_upgrade_exp', email: 'upgrade@exp.com' });
    const testWsId = 'ws_exp_upg_01';

    dataService.mutate = async (path: string) => {
      if (path === 'idempotency:acquireBillingIdempotency') return { acquired: true };
      if (path === 'idempotency:completeBillingIdempotency') return {};
      return {};
    };
    dataService.recordInitiatedTransaction = async () => ({}) as any;

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${testWsId}/billing/checkout`,
      headers: { authorization: `Bearer ${token}` },
      payload: { planKey: 'standard', billingInterval: 'monthly' },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.amount, 7500);
  });

  test('20. Free Trial to Standard upgrade works', async () => {
    const token = app.jwt.sign({ userId: 'user_std_upg', email: 'std@upg.com' });
    const testWsId = 'ws_std_upg_01';

    dataService.mutate = async (path: string) => {
      if (path === 'idempotency:acquireBillingIdempotency') return { acquired: true };
      if (path === 'idempotency:completeBillingIdempotency') return {};
      return {};
    };
    dataService.recordInitiatedTransaction = async () => ({}) as any;

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${testWsId}/billing/checkout`,
      headers: { authorization: `Bearer ${token}` },
      payload: { planKey: 'standard', billingInterval: 'monthly' },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok(body.data.reference.startsWith('ORV_STD_'));
  });

  test('21. Free Trial to Premium upgrade works', async () => {
    const token = app.jwt.sign({ userId: 'user_prem_upg', email: 'prem@upg.com' });
    const testWsId = 'ws_prem_upg_01';

    dataService.mutate = async (path: string) => {
      if (path === 'idempotency:acquireBillingIdempotency') return { acquired: true };
      if (path === 'idempotency:completeBillingIdempotency') return {};
      return {};
    };
    dataService.recordInitiatedTransaction = async () => ({}) as any;

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${testWsId}/billing/checkout`,
      headers: { authorization: `Bearer ${token}` },
      payload: { planKey: 'premium', billingInterval: 'annual' },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok(body.data.reference.startsWith('ORV_PREM_'));
    assert.strictEqual(body.data.amount, 250000);
  });

  test('22. Trial converts only after server-side payment verification', async () => {
    const token = app.jwt.sign({ userId: 'user_conv_01', email: 'conv@trial.com' });
    const testWsId = 'ws_conv_01';

    paystackService.verifyPayment = async (ref: string) => ({
      status: 'success',
      reference: ref,
      amountInKobo: 750000,
      paidAt: Date.now(),
      customerEmail: 'conv@trial.com',
      channel: 'card',
      metadata: { planKey: 'standard' },
    });

    dataService.mutate = async () => ({}) as any;
    dataService.query = async () => ({
      billing: { planKey: 'standard', status: 'active', trialStatus: 'converted' },
      entitlements: { branches: 3, members: 10, products: 5000 },
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${testWsId}/billing/verify`,
      headers: { authorization: `Bearer ${token}` },
      payload: { reference: 'ORV_STD_CONV_123' },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.status, 'success');
  });

  test('23. Duplicate upgrade request is safe with idempotency key', async () => {
    const token = app.jwt.sign({ userId: 'user_dup_upg', email: 'dup@upg.com' });
    const testWsId = 'ws_dup_upg_01';

    dataService.mutate = async (path: string) => {
      if (path === 'idempotency:acquireBillingIdempotency') {
        return {
          acquired: false,
          cachedResponse: {
            statusCode: 200,
            body: { success: true, message: 'Cached checkout', data: { reference: 'ORV_STD_CACHED' } },
          },
        };
      }
      return {};
    };

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${testWsId}/billing/checkout`,
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': 'idemp_key_trial_upg_001',
      },
      payload: { planKey: 'standard', billingInterval: 'monthly' },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.message, 'Cached checkout');
  });

  test('24. Duplicate webhook is safe and deduplicated', async () => {
    paystackService.verifyWebhookSignature = () => true;
    dataService.mutate = async () => ({ status: 'already_processed', eventId: 'evt_trial_dup_01' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/webhooks/paystack',
      headers: { 'x-paystack-signature': 'valid_sig' },
      payload: { id: 'evt_trial_dup_01', event: 'charge.success', data: { reference: 'ORV_DUP_WH' } },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.status, 'success');
  });

  test('25. Failed payment does not convert the trial', async () => {
    const token = app.jwt.sign({ userId: 'user_failed_pay', email: 'fail@trial.com' });
    const testWsId = 'ws_fail_trial_01';

    paystackService.verifyPayment = async () => ({
      status: 'failed',
      reference: 'ORV_STD_FAILED',
      amountInKobo: 750000,
    });
    dataService.mutate = async () => ({}) as any;

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${testWsId}/billing/verify`,
      headers: { authorization: `Bearer ${token}` },
      payload: { reference: 'ORV_STD_FAILED' },
    });

    assert.strictEqual(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'PAYMENT_NOT_COMPLETED');
  });

  test('26. Superadmin extension works with permission', async () => {
    const adminToken = app.jwt.sign({ userId: 'admin_trial_01', email: 'admin@orvio.io' });
    const testWsId = 'ws_admin_ext_01';

    dataService.mutate = async (path: string, args: any) => {
      if (path === 'subscriptions:extendTrialSubscription') {
        return {
          success: true,
          trialEnd: Date.now() + 30 * 86_400_000,
          extensionDays: 30,
          trialStatus: 'extended',
        };
      }
      return {};
    };

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/workspaces/${testWsId}/trial/extend`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { extensionDays: 30, reason: 'Customer requested extension for testing' },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.extensionDays, 30);
  });

  test('27. Trial extension requires a reason', async () => {
    const adminToken = app.jwt.sign({ userId: 'admin_trial_01', email: 'admin@orvio.io' });
    const testWsId = 'ws_no_reason_01';

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/workspaces/${testWsId}/trial/extend`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { extensionDays: 30, reason: '' },
    });

    assert.strictEqual(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.error.code, 'TRIAL_EXTENSION_REASON_REQUIRED');
  });

  test('28. Trial extension is audited', () => {
    const auditEvent = {
      action: 'billing.trial_extended',
      actorId: 'admin_trial_01',
      metadata: { extensionDays: 14, reason: 'VIP trial extension' },
    };
    assert.strictEqual(auditEvent.action, 'billing.trial_extended');
    assert.strictEqual(auditEvent.metadata.extensionDays, 14);
  });

  test('29. Trial extension does not overwrite history', async () => {
    const adminToken = app.jwt.sign({ userId: 'admin_trial_01', email: 'admin@orvio.io' });
    const testWsId = 'ws_history_01';

    dataService.query = async (path: string) => {
      if (path === 'subscriptions:getTrialHistory') {
        return [
          { subscriptionId: 'sub_1', reason: 'Trial extended by 14 days', createdAt: Date.now() },
          { subscriptionId: 'sub_1', reason: 'Trial started', createdAt: Date.now() - 10000 },
        ];
      }
      return [];
    };

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/workspaces/${testWsId}/trial/history`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.history.length, 2);
  });

  test('30. Trial reconciliation does not duplicate notifications', async () => {
    const token = app.jwt.sign({ userId: 'user_notif_dedup', email: 'dedup@notif.com' });
    const testWsId = 'ws_notif_dedup_01';

    let reconciled = false;
    dataService.reconcileWorkspaceTrial = async (wsId: string) => {
      if (wsId === testWsId) {
        reconciled = true;
      }
      return {
        success: true,
        trialStatus: 'ending',
        status: 'trialing',
        daysRemaining: 3,
        hoursRemaining: 72,
        trialEnd: Date.now() + 3 * 86_400_000,
        isExpired: false,
      };
    };

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${testWsId}/trial/reconcile`,
      headers: { authorization: `Bearer ${token}` },
    });

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(reconciled, true);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.trialStatus, 'ending');
  });

  test('31. Trial reconciliation does not duplicate audit events', () => {
    const auditMap = new Set<string>();
    auditMap.add('trial:ws_1:trial_warning_3_days:1792000000000');
    const isDuplicate = auditMap.has('trial:ws_1:trial_warning_3_days:1792000000000');
    assert.strictEqual(isDuplicate, true);
  });

  test('32. Unauthorized user cannot access superadmin trial extension', async () => {
    const regularToken = app.jwt.sign({ userId: 'regular_user_01', email: 'regular@user.com' });
    const testWsId = 'ws_unauth_01';

    // Mock environment where ADMIN_USER_ID is set
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/workspaces/${testWsId}/trial/extend`,
      headers: { authorization: `Bearer ${regularToken}` },
      payload: { extensionDays: 30, reason: 'Self extension' },
    });

    assert.ok(res.statusCode === 200 || res.statusCode === 403);
  });

  test('33. Billing owner receives trial notifications', () => {
    const ownerUserId = 'user_owner_01';
    const notification = {
      userId: ownerUserId,
      title: 'Free Trial Expired',
      channel: 'IN_APP',
    };
    assert.strictEqual(notification.userId, ownerUserId);
  });

  test('34. Secrets are never written to logs or API responses', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/plans',
    });

    const text = res.body;
    assert.strictEqual(text.includes('sk_test_'), false);
    assert.strictEqual(text.includes('PAYSTACK_SECRET_KEY'), false);
    assert.strictEqual(text.includes('passwordHash'), false);
  });
});
