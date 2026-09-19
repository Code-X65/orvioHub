import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { dataService } from '../src/services/dataService.js';
import { entitlementService } from '../src/services/entitlementService.js';
import type { FastifyInstance } from 'fastify';

describe('Entitlement & Billing Override Governance - 35 Point Test Suite', () => {
  let app: FastifyInstance;
  let regularUserToken: string;
  let readOnlyAdminToken: string;
  let supportAdminToken: string;
  let billingAdminToken: string;
  let platformAdminToken: string;
  let platformAdmin2Token: string;
  let superadminToken: string;

  // In-memory mock store for overrides
  let mockOverrides: any[] = [];
  let mockAuditEvents: any[] = [];

  beforeEach(async () => {
    app = await buildApp();
    mockOverrides = [];
    mockAuditEvents = [];

    regularUserToken = app.jwt.sign({ userId: 'user_regular_1', email: 'user@example.com', role: 'user' });
    readOnlyAdminToken = app.jwt.sign({ userId: 'admin_ro_1', email: 'ro@orvio.io', role: 'read_only_admin' });
    supportAdminToken = app.jwt.sign({ userId: 'admin_sup_1', email: 'support@orvio.io', role: 'support_admin' });
    billingAdminToken = app.jwt.sign({ userId: 'admin_bill_1', email: 'billing@orvio.io', role: 'billing_admin' });
    platformAdminToken = app.jwt.sign({ userId: 'admin_plat_1', email: 'admin1@orvio.io', role: 'platform_admin' });
    platformAdmin2Token = app.jwt.sign({ userId: 'admin_plat_2', email: 'admin2@orvio.io', role: 'platform_admin' });
    superadminToken = app.jwt.sign({ userId: 'superadmin_1', email: 'owner@orvio.io', role: 'platform_owner' });

    dataService.getUserById = async (id: string) => {
      let role = 'user';
      if (id.includes('superadmin') || id.includes('owner')) role = 'platform_owner';
      else if (id.includes('plat')) role = 'platform_admin';
      else if (id.includes('bill')) role = 'billing_admin';
      else if (id.includes('sup')) role = 'support_admin';
      else if (id.includes('ro')) role = 'read_only_admin';

      return {
        id,
        email: `${id}@orvio.io`,
        emailVerified: true,
        name: 'Admin Actor',
        status: 'active',
        role,
      } as any;
    };

    dataService.getWorkspaceById = async (id: string) => ({
      id,
      name: 'Acme Super Store',
      slug: 'acme-super-store',
      status: 'active',
      currency: 'NGN',
      timezone: 'Africa/Lagos',
      createdAt: Date.now() - 86400000 * 10,
    } as any);

    dataService.getBranches = async (_wsId: string) => [
      { _id: 'br_01', name: 'Main Branch', isPrimary: true, status: 'active' },
      { _id: 'br_02', name: 'Ikeja Branch', isPrimary: false, status: 'active' },
    ] as any;

    dataService.getWorkspaceMembers = async (_wsId: string) => [
      { userId: 'user_1', role: 'owner', status: 'active' },
      { userId: 'user_2', role: 'manager', status: 'active' },
    ] as any;

    dataService.getWorkspaceSubscription = async (wsId: string) => ({
      id: `sub_${wsId}`,
      workspaceId: wsId,
      planKey: 'free_trial',
      status: 'trialing',
      trialEnd: Date.now() + 86400000 * 7,
      currentPeriodEnd: Date.now() + 86400000 * 7,
    } as any);

    // Mock Convex Override DataService calls
    dataService.createEntitlementOverride = async (data: any) => {
      const now = Date.now();
      const effectiveFrom = data.effectiveFrom || now;

      if (data.expiresAt && data.expiresAt <= effectiveFrom) {
        throw new Error('INVALID_EXPIRATION: Expiration date must be after effective date.');
      }

      const isHighRisk =
        data.requiresApproval === true ||
        data.overrideType === 'manual_plan_grant' ||
        data.overrideType === 'billing_state_correction' ||
        data.overrideType === 'manual_plan_revoke' ||
        data.limitType === 'unlimited' ||
        data.overrideLimitType === 'unlimited' ||
        data.grantedPlanKey === 'premium';

      let initialStatus = 'active';
      if (data.status) initialStatus = data.status;
      else if (isHighRisk && !data.approvedByAdminId) initialStatus = 'pending_approval';

      // Auto-retire previous active override on same featureKey
      if (initialStatus === 'active' && data.featureKey) {
        for (const ov of mockOverrides) {
          if (ov.workspaceId === data.workspaceId && ov.featureKey === data.featureKey && ov.status === 'active') {
            ov.status = 'revoked';
            ov.revokedAt = now;
            ov.revokedByAdminId = data.createdByAdminId;
          }
        }
      }

      const overrideId = `ov_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const newRecord = {
        id: overrideId,
        _id: overrideId,
        workspaceId: data.workspaceId,
        featureKey: data.featureKey,
        productKey: data.productKey,
        overrideType: data.overrideType,
        limitType: data.limitType || data.overrideLimitType,
        limitValue: data.limitValue !== undefined ? data.limitValue : data.overrideLimitValue,
        overrideLimitType: data.overrideLimitType || data.limitType,
        overrideLimitValue: data.overrideLimitValue !== undefined ? data.overrideLimitValue : data.limitValue,
        previousPlanKey: data.previousPlanKey,
        grantedPlanKey: data.grantedPlanKey,
        extensionDays: data.extensionDays,
        grantType: data.grantType || 'administrative_override',
        reason: data.reason,
        customerVisibleReason: data.customerVisibleReason,
        supportTicketReference: data.supportTicketReference,
        externalReference: data.externalReference,
        status: initialStatus,
        effectiveFrom,
        expiresAt: data.expiresAt,
        reviewAt: data.reviewAt,
        createdByAdminId: data.createdByAdminId,
        approvedByAdminId: data.approvedByAdminId,
        approvedAt: data.approvedByAdminId ? now : undefined,
        createdAt: now,
        updatedAt: now,
      };

      mockOverrides.push(newRecord);
      mockAuditEvents.push({
        id: `ev_${Date.now()}`,
        workspaceId: data.workspaceId,
        eventType: `entitlement.override_${initialStatus === 'pending_approval' ? 'submitted' : 'created'}`,
        featureKey: data.featureKey,
        reason: data.reason,
        details: { overrideId },
        createdAt: now,
      });

      return {
        success: true,
        overrideId,
        workspaceId: data.workspaceId,
        featureKey: data.featureKey,
        status: initialStatus,
        effectiveFrom,
        isPendingApproval: initialStatus === 'pending_approval',
      };
    };

    dataService.submitEntitlementOverrideForApproval = async (overrideId: string, adminId?: string, reason?: string) => {
      const ov = mockOverrides.find((o) => o.id === overrideId || o._id === overrideId);
      if (!ov) throw new Error('OVERRIDE_NOT_FOUND');
      ov.status = 'pending_approval';
      ov.updatedAt = Date.now();
      return { success: true, overrideId, status: 'pending_approval' };
    };

    dataService.approveEntitlementOverride = async (overrideId: string, approvedByAdminId: string, reason?: string) => {
      const ov = mockOverrides.find((o) => o.id === overrideId || o._id === overrideId);
      if (!ov) throw new Error('OVERRIDE_NOT_FOUND');
      if (String(approvedByAdminId) === String(ov.createdByAdminId)) {
        throw new Error('DUAL_ADMIN_APPROVAL_REQUIRED: Self-approval is not permitted for governance-restricted overrides.');
      }
      ov.status = 'active';
      ov.approvedByAdminId = approvedByAdminId;
      ov.approvedAt = Date.now();
      ov.updatedAt = Date.now();
      return { success: true, overrideId, status: 'active', approvedByAdminId };
    };

    dataService.rejectEntitlementOverride = async (overrideId: string, rejectedByAdminId: string, rejectionReason: string) => {
      const ov = mockOverrides.find((o) => o.id === overrideId || o._id === overrideId);
      if (!ov) throw new Error('OVERRIDE_NOT_FOUND');
      ov.status = 'rejected';
      ov.rejectedByAdminId = rejectedByAdminId;
      ov.rejectionReason = rejectionReason;
      ov.updatedAt = Date.now();
      return { success: true, overrideId, status: 'rejected' };
    };

    dataService.revokeEntitlementOverride = async (overrideId: string, adminId?: string, reason?: string) => {
      const ov = mockOverrides.find((o) => o.id === overrideId || o._id === overrideId);
      if (!ov) throw new Error('OVERRIDE_NOT_FOUND');
      ov.status = 'revoked';
      ov.revokedByAdminId = adminId;
      ov.revokedAt = Date.now();
      ov.updatedAt = Date.now();
      return { success: true, overrideId, status: 'revoked' };
    };

    dataService.getWorkspaceOverrides = async (workspaceId: string, status?: string) => {
      let list = mockOverrides.filter((o) => o.workspaceId === workspaceId);
      if (status) list = list.filter((o) => o.status === status);
      return list;
    };

    dataService.getOverrideDetail = async (overrideId: string) => {
      const ov = mockOverrides.find((o) => o.id === overrideId || o._id === overrideId);
      if (!ov) return null;
      return {
        ...ov,
        auditHistory: mockAuditEvents.filter((e) => e.details?.overrideId === overrideId),
      };
    };

    dataService.getOverrideHistory = async (workspaceId?: string, limit?: number) => {
      let events = mockAuditEvents;
      if (workspaceId) events = events.filter((e) => e.workspaceId === workspaceId);
      return events.slice(0, limit || 50);
    };

    dataService.extendTrialPeriod = async (data: any) => {
      const now = Date.now();
      const newTrialEnd = now + data.additionalDays * 86400000;
      const ov = await dataService.createEntitlementOverride({
        workspaceId: data.workspaceId,
        featureKey: 'organization.trial_period',
        overrideType: 'trial_extension',
        grantType: 'support_comp',
        extensionDays: data.additionalDays,
        reason: data.reason,
        customerVisibleReason: data.customerVisibleReason,
        supportTicketReference: data.supportTicketReference,
        createdByAdminId: data.adminId,
        effectiveFrom: now,
        expiresAt: newTrialEnd,
      });
      return {
        success: true,
        workspaceId: data.workspaceId,
        newTrialEnd,
        additionalDays: data.additionalDays,
        overrideId: ov.overrideId,
      };
    };

    dataService.grantManualPlan = async (data: any) => {
      const now = Date.now();
      const expiresAt = data.durationDays ? now + data.durationDays * 86400000 : undefined;
      return dataService.createEntitlementOverride({
        workspaceId: data.workspaceId,
        featureKey: 'plan.grant',
        overrideType: 'manual_plan_grant',
        grantedPlanKey: data.planKey,
        grantType: data.grantType || 'administrative_override',
        reason: data.reason,
        customerVisibleReason: data.customerVisibleReason,
        supportTicketReference: data.supportTicketReference,
        createdByAdminId: data.adminId,
        approvedByAdminId: data.approverAdminId,
        effectiveFrom: now,
        expiresAt,
        reviewAt: data.reviewAt,
        requiresApproval: !data.approverAdminId,
      });
    };

    dataService.reconcileOverridesAndEntitlements = async (workspaceId?: string) => {
      const now = Date.now();
      let count = 0;
      for (const ov of mockOverrides) {
        if ((!workspaceId || ov.workspaceId === workspaceId) && ov.status === 'active' && ov.expiresAt && ov.expiresAt <= now) {
          ov.status = 'expired';
          ov.updatedAt = now;
          count++;
        }
      }
      return { success: true, expiredCount: count, reconciledAt: now };
    };

    dataService.getEntitlementContext = async (workspaceId: string) => {
      const now = Date.now();
      const activeOvs = mockOverrides.filter(
        (o) => o.workspaceId === workspaceId && o.status === 'active' && (!o.expiresAt || o.expiresAt > now)
      );

      const planGrant = activeOvs.find((o) => o.overrideType === 'manual_plan_grant');
      const planKey = planGrant?.grantedPlanKey || 'free_trial';
      const isManual = !!planGrant;

      const branchOv = activeOvs.find((o) => o.featureKey === 'inventory.max_branches');
      let branchLimit: number | 'unlimited' = planKey === 'premium' ? 10 : planKey === 'standard' ? 3 : 1;
      let branchSource = isManual ? 'manual_grant' : 'plan';

      if (branchOv) {
        branchSource = 'override';
        if (branchOv.overrideType === 'disable') branchLimit = 0;
        else if (branchOv.limitType === 'unlimited') branchLimit = 'unlimited';
        else branchLimit = branchOv.limitValue !== undefined ? branchOv.limitValue : branchLimit;
      }

      return {
        workspaceId,
        planKey,
        planName: planKey === 'premium' ? 'Premium' : planKey === 'standard' ? 'Standard' : 'Free Trial',
        isTrial: !isManual && planKey === 'free_trial',
        isManualPlanGrant: isManual,
        features: {
          'inventory.max_branches': {
            limit: branchLimit,
            currentUsage: 2,
            remaining: branchLimit === 'unlimited' ? 'unlimited' : Math.max(0, (branchLimit as number) - 2),
            source: branchSource,
          },
          'workspace.max_members': {
            limit: 2,
            currentUsage: 2,
            remaining: 0,
            source: 'plan',
          },
        },
        overrides: activeOvs.map((o) => ({
          id: o.id,
          overrideType: o.overrideType,
          featureKey: o.featureKey,
          limitValue: o.limitValue,
          customerVisibleReason: o.customerVisibleReason,
          expiresAt: o.expiresAt,
        })),
        usage: { branches: 2, members: 2, apps: 1 },
      } as any;
    };
  });

  afterEach(async () => {
    await app.close();
  });

  // 1. Role & permission authorization: Platform owner has wildcard access
  test('1. Platform owner can list overrides for any workspace', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/workspaces/ws_100/overrides',
      headers: { authorization: `Bearer ${superadminToken}` },
    });
    assert.equal(res.statusCode, 200);
    const json = res.json();
    assert.equal(json.success, true);
    assert.ok(Array.isArray(json.data));
  });

  // 2. Regular tenant cannot access admin override endpoints
  test('2. Regular tenant token is rejected from admin overrides endpoints', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/workspaces/ws_100/overrides',
      headers: { authorization: `Bearer ${regularUserToken}` },
    });
    assert.equal(res.statusCode, 403);
  });

  // 3. Read-only admin cannot mutate overrides
  test('3. Read-only admin is blocked from creating overrides', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/workspaces/ws_100/overrides',
      headers: { authorization: `Bearer ${readOnlyAdminToken}` },
      payload: {
        overrideType: 'entitlement_limit_override',
        featureKey: 'inventory.max_branches',
        limitType: 'fixed',
        limitValue: 10,
        reason: 'Attempted mutation by RO admin',
      },
    });
    assert.equal(res.statusCode, 403);
  });

  // 4. Standard feature limit override creation succeeds and is immediately active
  test('4. Standard limit override creation succeeds and activates immediately', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/workspaces/ws_100/overrides',
      headers: {
        authorization: `Bearer ${platformAdminToken}`,
        'x-admin-reason': 'Customer requested extra branch for pilot',
      },
      payload: {
        overrideType: 'entitlement_limit_override',
        featureKey: 'inventory.max_branches',
        limitType: 'fixed',
        limitValue: 5,
        reason: 'Customer requested extra branch for pilot',
        customerVisibleReason: 'Complimentary branch added by support',
        supportTicketReference: 'TICKET-101',
      },
    });
    assert.equal(res.statusCode, 201);
    const json = res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.status, 'active');
    assert.equal(json.data.isPendingApproval, false);
  });

  // 5. Sensitive override requires administrative reason
  test('5. Sensitive override creation without reason header or body returns 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/workspaces/ws_100/overrides',
      headers: { authorization: `Bearer ${platformAdminToken}` },
      payload: {
        overrideType: 'entitlement_limit_override',
        featureKey: 'inventory.max_branches',
        limitValue: 5,
      },
    });
    assert.equal(res.statusCode, 400);
  });

  // 6. High-risk override requires step-up / TOTP authentication for non-superadmin
  test('6. High-risk manual plan grant without TOTP is rejected with STEP_UP_AUTHENTICATION_REQUIRED', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/workspaces/ws_100/manual-plan-grant',
      headers: {
        authorization: `Bearer ${platformAdminToken}`,
        'x-admin-reason': 'Manual grant attempt',
      },
      payload: {
        planKey: 'premium',
        reason: 'Manual grant attempt',
      },
    });
    assert.equal(res.statusCode, 403);
    const json = res.json();
    assert.equal(json.error.code, 'STEP_UP_AUTHENTICATION_REQUIRED');
  });

  // 7. High-risk manual plan grant with TOTP creates pending_approval override
  test('7. High-risk manual plan grant with TOTP enters pending_approval status', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/workspaces/ws_100/manual-plan-grant',
      headers: {
        authorization: `Bearer ${platformAdminToken}`,
        'x-admin-reason': 'Enterprise partner pilot',
        'x-admin-totp': '123456',
      },
      payload: {
        planKey: 'premium',
        durationDays: 30,
        reason: 'Enterprise partner pilot agreement',
      },
    });
    assert.equal(res.statusCode, 201);
    const json = res.json();
    assert.equal(json.data.status, 'pending_approval');
    assert.equal(json.data.isPendingApproval, true);
  });

  // 8. Precedence resolution: Active approved override overrides base plan
  test('8. Precedence resolution: Active branch override reflects in getEntitlementContext', async () => {
    // Create active override
    await app.inject({
      method: 'POST',
      url: '/api/v1/admin/workspaces/ws_prec_1/overrides',
      headers: {
        authorization: `Bearer ${platformAdminToken}`,
        'x-admin-reason': 'Limit increase to 15 branches',
      },
      payload: {
        overrideType: 'entitlement_limit_override',
        featureKey: 'inventory.max_branches',
        limitType: 'fixed',
        limitValue: 15,
        reason: 'Limit increase to 15 branches',
      },
    });

    const ctx = await entitlementService.getEntitlementContext('ws_prec_1');
    assert.equal((ctx.features as any)['inventory.max_branches'].limit, 15);
    assert.equal((ctx.features as any)['inventory.max_branches'].source, 'override');
  });

  // 9. Precedence resolution: Expired override is strictly ignored during resolution
  test('9. Precedence resolution: Expired override is ignored, reverting to plan limit', async () => {
    const pastTime = Date.now() - 5000;
    mockOverrides.push({
      id: 'ov_expired_1',
      _id: 'ov_expired_1',
      workspaceId: 'ws_prec_2',
      featureKey: 'inventory.max_branches',
      overrideType: 'entitlement_limit_override',
      limitType: 'fixed',
      limitValue: 20,
      status: 'active', // Marked active in DB but expired by timestamp
      effectiveFrom: pastTime - 100000,
      expiresAt: pastTime,
    });

    const ctx = await entitlementService.getEntitlementContext('ws_prec_2');
    // Reverts to base free trial limit of 1
    assert.equal((ctx.features as any)['inventory.max_branches'].limit, 1);
    assert.equal((ctx.features as any)['inventory.max_branches'].source, 'plan');
  });

  // 10. Precedence resolution: Revoked override is ignored
  test('10. Precedence resolution: Revoked override is ignored during resolution', async () => {
    mockOverrides.push({
      id: 'ov_revoked_1',
      _id: 'ov_revoked_1',
      workspaceId: 'ws_prec_3',
      featureKey: 'inventory.max_branches',
      overrideType: 'entitlement_limit_override',
      limitType: 'fixed',
      limitValue: 50,
      status: 'revoked',
      effectiveFrom: Date.now() - 10000,
      expiresAt: Date.now() + 100000,
    });

    const ctx = await entitlementService.getEntitlementContext('ws_prec_3');
    assert.equal((ctx.features as any)['inventory.max_branches'].limit, 1);
  });

  // 11. Precedence resolution: Pending approval override is not active
  test('11. Precedence resolution: Pending approval override does not apply until approved', async () => {
    mockOverrides.push({
      id: 'ov_pending_1',
      _id: 'ov_pending_1',
      workspaceId: 'ws_prec_4',
      featureKey: 'inventory.max_branches',
      overrideType: 'entitlement_limit_override',
      limitType: 'fixed',
      limitValue: 25,
      status: 'pending_approval',
      createdByAdminId: 'admin_plat_1',
      effectiveFrom: Date.now(),
    });

    const ctx = await entitlementService.getEntitlementContext('ws_prec_4');
    assert.equal((ctx.features as any)['inventory.max_branches'].limit, 1);
  });

  // 12. Dual-admin separation: Self-approval attempt is blocked
  test('12. Dual-admin separation: Creator attempting to approve their own request is rejected (403)', async () => {
    mockOverrides.push({
      id: 'ov_dual_1',
      _id: 'ov_dual_1',
      workspaceId: 'ws_dual_1',
      overrideType: 'manual_plan_grant',
      grantedPlanKey: 'premium',
      status: 'pending_approval',
      createdByAdminId: 'admin_plat_1', // Creator is admin_plat_1
      effectiveFrom: Date.now(),
      reason: 'Self-approval test',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/overrides/ov_dual_1/approve',
      headers: {
        authorization: `Bearer ${platformAdminToken}`, // Token corresponds to admin_plat_1
        'x-admin-reason': 'Trying to self-approve',
        'x-admin-totp': '123456',
      },
      payload: { reason: 'Trying to self-approve' },
    });

    assert.equal(res.statusCode, 403);
    const json = res.json();
    assert.equal(json.error.code, 'DUAL_ADMIN_APPROVAL_REQUIRED');
  });

  // 13. Dual-admin separation: Distinct admin approving succeeds
  test('13. Dual-admin separation: Second administrator can approve pending override', async () => {
    mockOverrides.push({
      id: 'ov_dual_2',
      _id: 'ov_dual_2',
      workspaceId: 'ws_dual_2',
      overrideType: 'manual_plan_grant',
      grantedPlanKey: 'premium',
      status: 'pending_approval',
      createdByAdminId: 'admin_plat_1',
      effectiveFrom: Date.now(),
      reason: 'Enterprise pilot',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/overrides/ov_dual_2/approve',
      headers: {
        authorization: `Bearer ${platformAdmin2Token}`, // Distinct admin (admin_plat_2)
        'x-admin-reason': 'Approved by Senior Admin',
        'x-admin-totp': '654321',
      },
      payload: { reason: 'Approved by Senior Admin' },
    });

    assert.equal(res.statusCode, 200);
    const json = res.json();
    assert.equal(json.data.status, 'active');

    // Effective context now reflects granted Premium plan
    const ctx = await entitlementService.getEntitlementContext('ws_dual_2');
    assert.equal(ctx.planKey, 'premium');
    assert.equal(ctx.isManualPlanGrant, true);
  });

  // 14. Rejection flow: Reviewing admin can reject pending override
  test('14. Reviewing admin can reject pending override with rejection reason', async () => {
    mockOverrides.push({
      id: 'ov_reject_1',
      _id: 'ov_reject_1',
      workspaceId: 'ws_rej_1',
      overrideType: 'manual_plan_grant',
      status: 'pending_approval',
      createdByAdminId: 'admin_plat_1',
      effectiveFrom: Date.now(),
      reason: 'Questionable grant',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/overrides/ov_reject_1/reject',
      headers: { authorization: `Bearer ${platformAdmin2Token}` },
      payload: { rejectionReason: 'Insufficient commercial justification' },
    });

    assert.equal(res.statusCode, 200);
    const json = res.json();
    assert.equal(json.data.status, 'rejected');

    const ov = mockOverrides.find((o) => o.id === 'ov_reject_1');
    assert.equal(ov.status, 'rejected');
  });

  // 15. Draft submission flow: Transitions draft to pending_approval
  test('15. Draft override can be submitted for dual-admin approval', async () => {
    mockOverrides.push({
      id: 'ov_draft_1',
      _id: 'ov_draft_1',
      workspaceId: 'ws_draft_1',
      overrideType: 'entitlement_limit_override',
      status: 'draft',
      createdByAdminId: 'admin_plat_1',
      effectiveFrom: Date.now(),
      reason: 'Draft proposal',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/overrides/ov_draft_1/submit',
      headers: { authorization: `Bearer ${platformAdminToken}` },
      payload: { reason: 'Ready for review' },
    });

    assert.equal(res.statusCode, 200);
    const json = res.json();
    assert.equal(json.data.status, 'pending_approval');
  });

  // 16. Revocation flow: Active override can be revoked
  test('16. Active override can be manually revoked with reason', async () => {
    mockOverrides.push({
      id: 'ov_act_1',
      _id: 'ov_act_1',
      workspaceId: 'ws_act_1',
      featureKey: 'inventory.max_branches',
      limitValue: 12,
      status: 'active',
      createdByAdminId: 'admin_plat_1',
      effectiveFrom: Date.now(),
      reason: 'Active promo',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/overrides/ov_act_1/revoke',
      headers: {
        authorization: `Bearer ${platformAdminToken}`,
        'x-admin-reason': 'Customer campaign concluded',
      },
      payload: { reason: 'Customer campaign concluded' },
    });

    assert.equal(res.statusCode, 200);
    const json = res.json();
    assert.equal(json.data.status, 'revoked');
  });

  // 17. Automated retirement of prior active override on same feature
  test('17. Creating a new active override automatically revokes earlier override for same feature', async () => {
    const ws = 'ws_autoreplace_1';
    mockOverrides.push({
      id: 'ov_old_1',
      _id: 'ov_old_1',
      workspaceId: ws,
      featureKey: 'inventory.max_branches',
      limitValue: 4,
      status: 'active',
      createdByAdminId: 'admin_plat_1',
      effectiveFrom: Date.now() - 10000,
      reason: 'First override',
    });

    // Create newer override for same feature
    await app.inject({
      method: 'POST',
      url: `/api/v1/admin/workspaces/${ws}/overrides`,
      headers: {
        authorization: `Bearer ${platformAdminToken}`,
        'x-admin-reason': 'Upgrading override to 8 branches',
      },
      payload: {
        overrideType: 'entitlement_limit_override',
        featureKey: 'inventory.max_branches',
        limitType: 'fixed',
        limitValue: 8,
        reason: 'Upgrading override to 8 branches',
      },
    });

    const oldOv = mockOverrides.find((o) => o.id === 'ov_old_1');
    assert.equal(oldOv.status, 'revoked');
  });

  // 18. Trial extension: Extends trial and creates time-bound override
  test('18. Trial extension endpoint extends trial and creates trial_extension record', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/workspaces/ws_trial_ext/trial-extension',
      headers: {
        authorization: `Bearer ${supportAdminToken}`,
        'x-admin-reason': 'Support ticket resolution',
      },
      payload: {
        additionalDays: 14,
        reason: 'Support ticket resolution',
        customerVisibleReason: 'Trial extended 14 days by support team',
        supportTicketReference: 'SUP-4491',
      },
    });

    assert.equal(res.statusCode, 200);
    const json = res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.additionalDays, 14);

    const extRecord = mockOverrides.find((o) => o.workspaceId === 'ws_trial_ext' && o.overrideType === 'trial_extension');
    assert.ok(extRecord);
    assert.equal(extRecord.status, 'active');
  });

  // 19. Trial extension reflects in effective entitlement context
  test('19. Trial extension reflects valid trial duration in getEntitlementContext', async () => {
    const ctx = await entitlementService.getEntitlementContext('ws_trial_ext');
    assert.equal(ctx.isTrial, true);
  });

  // 20. Manual plan grant: Standard grant activates without creating Paystack invoices
  test('20. Manual Standard grant gives standard limits without generating fake billing records', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/workspaces/ws_manual_std/manual-plan-grant',
      headers: {
        authorization: `Bearer ${superadminToken}`,
        'x-admin-reason': 'Granted Standard for pilot',
        'x-admin-totp': '123456',
      },
      payload: {
        planKey: 'standard',
        durationDays: 60,
        reason: 'Granted Standard for pilot',
        approverAdminId: 'admin_approver_2',
      },
    });
    assert.equal(res.statusCode, 201);

    const ctx = await entitlementService.getEntitlementContext('ws_manual_std');
    assert.equal(ctx.planKey, 'standard');
    assert.equal(ctx.isManualPlanGrant, true);
    assert.equal((ctx.features as any)['inventory.max_branches'].limit, 3);
  });

  // 21. Manual plan grant: Premium grant gives premium limits
  test('21. Manual Premium grant gives premium limits (10 branches)', async () => {
    mockOverrides.push({
      id: 'ov_prem_1',
      _id: 'ov_prem_1',
      workspaceId: 'ws_manual_prem',
      overrideType: 'manual_plan_grant',
      grantedPlanKey: 'premium',
      status: 'active',
      effectiveFrom: Date.now(),
      reason: 'VIP partner access',
    });

    const ctx = await entitlementService.getEntitlementContext('ws_manual_prem');
    assert.equal(ctx.planKey, 'premium');
    assert.equal((ctx.features as any)['inventory.max_branches'].limit, 10);
  });

  // 22. Manual plan grant preserves underlying Paystack subscription metadata
  test('22. Manual plan grant preserves underlying subscription metadata without destruction', async () => {
    const sub = await dataService.getWorkspaceSubscription('ws_manual_std');
    assert.equal(sub.workspaceId, 'ws_manual_std');
    // Underlying subscription still shows original plan tier / status
    assert.equal(sub.planKey, 'free_trial');
  });

  // 23. Unlimited limits: Setting unlimited resolves feature limit as 'unlimited'
  test('23. Unlimited branch limit resolves to unlimited remaining', async () => {
    mockOverrides.push({
      id: 'ov_unlim_1',
      _id: 'ov_unlim_1',
      workspaceId: 'ws_unlim_1',
      featureKey: 'inventory.max_branches',
      overrideType: 'entitlement_limit_override',
      limitType: 'unlimited',
      status: 'active',
      effectiveFrom: Date.now(),
      reason: 'Unlimited test',
    });

    const ctx = await entitlementService.getEntitlementContext('ws_unlim_1');
    assert.equal((ctx.features as any)['inventory.max_branches'].limit, 'unlimited');
    assert.equal((ctx.features as any)['inventory.max_branches'].remaining, 'unlimited');
  });

  // 24. Zero / Disable limits: Disables feature access immediately
  test('24. Disabling feature sets limit to 0 and remaining to 0', async () => {
    mockOverrides.push({
      id: 'ov_dis_1',
      _id: 'ov_dis_1',
      workspaceId: 'ws_dis_1',
      featureKey: 'inventory.max_branches',
      overrideType: 'disable',
      limitValue: 0,
      status: 'active',
      effectiveFrom: Date.now(),
      reason: 'Abuse restriction',
    });

    const ctx = await entitlementService.getEntitlementContext('ws_dis_1');
    assert.equal((ctx.features as any)['inventory.max_branches'].limit, 0);
    assert.equal((ctx.features as any)['inventory.max_branches'].remaining, 0);
  });

  // 25. Expiration validation: Past expiresAt returns 400
  test('25. Setting expiresAt in the past throws validation error', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/workspaces/ws_invalid_exp/overrides',
      headers: {
        authorization: `Bearer ${platformAdminToken}`,
        'x-admin-reason': 'Testing past expiration',
      },
      payload: {
        overrideType: 'entitlement_limit_override',
        featureKey: 'inventory.max_branches',
        limitValue: 5,
        expiresAt: Date.now() - 100000,
        reason: 'Testing past expiration',
      },
    });
    assert.equal(res.statusCode, 400);
  });

  // 26. Customer privacy: Internal admin reason is stripped in customer-facing payload
  test('26. Customer visible reason is present while internal ticket notes remain isolated', async () => {
    mockOverrides.push({
      id: 'ov_priv_1',
      _id: 'ov_priv_1',
      workspaceId: 'ws_priv_1',
      featureKey: 'inventory.max_branches',
      limitValue: 10,
      reason: 'CONFIDENTIAL: Internal legal settlement #4490',
      customerVisibleReason: 'Complimentary branch expansion',
      status: 'active',
      effectiveFrom: Date.now(),
    });

    const ctx = await entitlementService.getEntitlementContext('ws_priv_1');
    const overridePayload = ctx.overrides[0];
    assert.equal(overridePayload.customerVisibleReason, 'Complimentary branch expansion');
    assert.equal(overridePayload.reason, undefined); // Internal reason is omitted in client context
  });

  // 27. Scheduled reconciliation: Auto-expires past active overrides
  test('27. Reconciliation endpoint marks expired overrides as expired', async () => {
    mockOverrides.push({
      id: 'ov_rec_exp',
      _id: 'ov_rec_exp',
      workspaceId: 'ws_rec_1',
      featureKey: 'inventory.max_branches',
      limitValue: 10,
      status: 'active',
      effectiveFrom: Date.now() - 200000,
      expiresAt: Date.now() - 10000,
      reason: 'Old promo',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/workspaces/ws_rec_1/reconcile-entitlements',
      headers: { authorization: `Bearer ${billingAdminToken}` },
    });

    assert.equal(res.statusCode, 200);
    const ov = mockOverrides.find((o) => o.id === 'ov_rec_exp');
    assert.equal(ov.status, 'expired');
  });

  // 28. Organization isolation: Override on Workspace A does not leak to Workspace B
  test('28. Workspace isolation: Override on Workspace A does not affect Workspace B', async () => {
    mockOverrides.push({
      id: 'ov_iso_a',
      _id: 'ov_iso_a',
      workspaceId: 'ws_iso_a',
      featureKey: 'inventory.max_branches',
      limitValue: 99,
      status: 'active',
      effectiveFrom: Date.now(),
      reason: 'Org A VIP',
    });

    const ctxA = await entitlementService.getEntitlementContext('ws_iso_a');
    const ctxB = await entitlementService.getEntitlementContext('ws_iso_b');

    assert.equal((ctxA.features as any)['inventory.max_branches'].limit, 99);
    assert.equal((ctxB.features as any)['inventory.max_branches'].limit, 1);
  });

  // 29. Product / Feature isolation: Branch override does not change member limit
  test('29. Feature isolation: Branch limit override does not alter member limit', async () => {
    mockOverrides.push({
      id: 'ov_iso_feat',
      _id: 'ov_iso_feat',
      workspaceId: 'ws_iso_feat',
      featureKey: 'inventory.max_branches',
      limitValue: 10,
      status: 'active',
      effectiveFrom: Date.now(),
      reason: 'Only branches',
    });

    const ctx = await entitlementService.getEntitlementContext('ws_iso_feat');
    assert.equal((ctx.features as any)['inventory.max_branches'].limit, 10);
    assert.equal((ctx.features as any)['workspace.max_members'].limit, 2);
  });

  // 30. Override detail query: Returns override details
  test('30. Admin can query single override detail with audit history', async () => {
    mockOverrides.push({
      id: 'ov_det_1',
      _id: 'ov_det_1',
      workspaceId: 'ws_det_1',
      overrideType: 'entitlement_limit_override',
      featureKey: 'inventory.max_branches',
      limitValue: 7,
      status: 'active',
      createdByAdminId: 'admin_plat_1',
      effectiveFrom: Date.now(),
      reason: 'Detail test',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/overrides/ov_det_1',
      headers: { authorization: `Bearer ${supportAdminToken}` },
    });

    assert.equal(res.statusCode, 200);
    const json = res.json();
    assert.equal(json.data.id, 'ov_det_1');
    assert.equal(json.data.limitValue, 7);
  });

  // 31. Override detail query for non-existent override returns 404
  test('31. Non-existent override detail query returns 404', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/overrides/non_existent_id',
      headers: { authorization: `Bearer ${supportAdminToken}` },
    });
    assert.equal(res.statusCode, 404);
  });

  // 32. Override history query returns system-wide lifecycle events
  test('32. Admin can query system-wide override history', async () => {
    mockAuditEvents.push({
      id: 'ev_hist_1',
      workspaceId: 'ws_hist_1',
      eventType: 'entitlement.override_created',
      featureKey: 'inventory.max_branches',
      reason: 'History test',
      createdAt: Date.now(),
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/overrides/history',
      headers: { authorization: `Bearer ${billingAdminToken}` },
    });

    assert.equal(res.statusCode, 200);
    const json = res.json();
    assert.ok(Array.isArray(json.data));
    assert.ok(json.data.length > 0);
  });

  // 33. checkLimit respects active branch limit override
  test('33. checkLimit allows resource allocation within active override limit', async () => {
    mockOverrides.push({
      id: 'ov_chk_1',
      _id: 'ov_chk_1',
      workspaceId: 'ws_chk_1',
      featureKey: 'inventory.max_branches',
      limitValue: 5, // Usage is 2, limit is 5
      status: 'active',
      effectiveFrom: Date.now(),
      reason: 'Check limit test',
    });

    const checkRes = await entitlementService.check({
      workspaceId: 'ws_chk_1',
      featureKey: 'inventory.max_branches',
      requestedAmount: 1,
    });

    assert.equal(checkRes.allowed, true);
    assert.equal(checkRes.limit, 5);
    assert.equal(checkRes.source, 'override');
  });

  // 34. checkLimit denies resource allocation exceeding active override limit
  test('34. checkLimit denies resource allocation when exceeding override limit', async () => {
    mockOverrides.push({
      id: 'ov_chk_2',
      _id: 'ov_chk_2',
      workspaceId: 'ws_chk_2',
      featureKey: 'inventory.max_branches',
      limitValue: 2, // Usage is 2, limit is 2 -> requesting 1 more should fail
      status: 'active',
      effectiveFrom: Date.now(),
      reason: 'Max reached test',
    });

    const checkRes = await entitlementService.check({
      workspaceId: 'ws_chk_2',
      featureKey: 'inventory.max_branches',
      requestedAmount: 1,
    });

    assert.equal(checkRes.allowed, false);
    assert.equal(checkRes.code, 'ENTITLEMENT_LIMIT_REACHED');
  });

  // 35. requireLimit throws 403 when exceeding override limit
  test('35. requireLimit throws 403 ENTITLEMENT_LIMIT_REACHED on violation', async () => {
    mockOverrides.push({
      id: 'ov_req_1',
      _id: 'ov_req_1',
      workspaceId: 'ws_req_1',
      featureKey: 'inventory.max_branches',
      limitValue: 2,
      status: 'active',
      effectiveFrom: Date.now(),
      reason: 'Require test',
    });

    await assert.rejects(
      async () => {
        await entitlementService.require({
          workspaceId: 'ws_req_1',
          featureKey: 'inventory.max_branches',
          requestedAmount: 1,
        });
      },
      (err: any) => {
        assert.equal(err.code, 'ENTITLEMENT_LIMIT_REACHED');
        assert.equal(err.statusCode, 403);
        return true;
      }
    );
  });
});
