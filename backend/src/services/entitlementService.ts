import { dataService } from './dataService.js';
import { getPlanLimits, PLAN_LIMITS, type PlanTier } from '../config/planLimits.js';

export const MAX_OWNED_ORGANIZATIONS_PER_USER = 3;
export const FEATURE_KEY_ORG_LIMIT = "workspace.max_owned";

export interface OrganizationCreationEligibility {
  allowed: boolean;
  ownedCount?: number;
  ownedLimit?: number;
  trialCount?: number;
  trialLimit?: number;
  joinedCount?: number;
  canCreate?: boolean;
  currentOwned?: number;
  currentOwnedOrganizations: number;
  maximumOwned?: number;
  maximumOwnedOrganizations: number;
  remainingOwned?: number;
  remainingOwnedOrganizations: number;
  freeTrial?: {
    used: number;
    maximum: number;
    available: boolean;
    organizationId?: string;
    organizationName?: string;
    trialEndsAt?: number;
  };
  reasons?: string[];
  recommendedPlan?: 'standard' | 'free_trial' | 'premium';
  override?: {
    active: boolean;
    grantedBy: string;
    reason: string;
    expiresAt: number | null;
    overrideLimit?: number;
  };
  code?: string;
  message?: string;
}

export interface EntitlementCheckResult {
  allowed: boolean;
  code?: string;
  featureKey?: string;
  currentUsage?: number;
  current?: number;
  limit?: number | 'unlimited';
  remaining?: number | 'unlimited';
  planKey?: string;
  source?: 'plan' | 'override' | 'manual';
  warnings?: string[];
  upgradePlan?: string;
  message?: string;
  error?: string;
}

export interface EntitlementCheckInput {
  workspaceId?: string;
  userId?: string;
  permission?: string;
  featureKey: string;
  productKey?: string;
  requestedAmount?: number;
}

export interface OverrideInput {
  featureKey: string;
  productKey?: string;
  overrideType: 'grant' | 'increase' | 'disable' | 'restrict';
  limitType: 'boolean' | 'fixed' | 'unlimited';
  limitValue?: number;
  reason: string;
  createdByAdminId: string;
  expiresAt?: number;
}

export class EntitlementService {
  /**
   * Helper to resolve arguments whether passed as (workspaceId, input) or (input)
   */
  private normalizeInput(workspaceIdOrInput: string | EntitlementCheckInput, inputOrUndefined?: EntitlementCheckInput): EntitlementCheckInput {
    if (typeof workspaceIdOrInput === 'string') {
      return {
        workspaceId: workspaceIdOrInput,
        ...(inputOrUndefined || { featureKey: 'workspace.max_members' }),
      };
    }
    return workspaceIdOrInput;
  }

  /**
   * 1. Get Entitlement Context (authoritative 16-step resolution)
   */
  public async getEntitlementContext(workspaceId: string, userId?: string) {
    try {
      const res = await dataService.getEntitlementContext(workspaceId, userId);
      if (res) return res;
    } catch {}

    const sub = await dataService.getWorkspaceSubscription(workspaceId);
    let planKey = (sub?.planKey || 'free_trial').toLowerCase() as PlanTier;
    if (planKey === ('free' as any)) planKey = 'free_trial';
    const isTrial = !sub || sub.status === 'trial' || sub.status === 'trialing' || planKey === 'free_trial';

    const limits = getPlanLimits(planKey);
    let branchCount = 0;
    let memberCount = 0;

    try {
      const branches = await dataService.getBranches(workspaceId, userId);
      branchCount = Array.isArray(branches) ? branches.length : 0;
    } catch {}

    try {
      const members = await dataService.getWorkspaceMembers(workspaceId, userId || '');
      memberCount = Array.isArray(members) ? members.length : 1;
    } catch {}

    const now = Date.now();
    let subscriptionStatus = sub?.status || (isTrial ? 'trialing' : 'active');
    let entitlementStatus: 'pending' | 'active' | 'restricted' | 'expired' | 'revoked' = 'active';

    const trialEnd = sub?.trialEnd || sub?.trialEndsAt;
    if (isTrial && trialEnd && now > trialEnd) {
      subscriptionStatus = 'expired';
      entitlementStatus = 'restricted';
    } else if (sub?.status === 'expired') {
      subscriptionStatus = 'expired';
      entitlementStatus = 'restricted';
    } else if (sub?.status === 'past_due') {
      subscriptionStatus = 'past_due';
      const graceEnd = sub.gracePeriodEnd || (sub.currentPeriodEnd ? sub.currentPeriodEnd + 3 * 24 * 60 * 60 * 1000 : 0);
      if (now > graceEnd) {
        entitlementStatus = 'restricted';
      }
    } else if (sub?.status === 'canceled' || sub?.status === 'cancelled') {
      if (sub.currentPeriodEnd && now > sub.currentPeriodEnd) {
        subscriptionStatus = 'expired';
        entitlementStatus = 'restricted';
      }
    } else if (sub?.status === 'suspended') {
      subscriptionStatus = 'suspended';
      entitlementStatus = 'restricted';
    }

    const calcWarning = (usage: number, limit: number | 'unlimited') => {
      if (limit === 'unlimited' || typeof limit !== 'number' || limit <= 0) return { percent: 0, warning: null };
      const pct = Math.round((usage / limit) * 100);
      let warning: string | null = null;
      if (pct >= 100) warning = '100%';
      else if (pct >= 90) warning = '90%';
      else if (pct >= 80) warning = '80%';
      else if (pct >= 50) warning = '50%';
      return { percent: pct, warning };
    };

    const branchWarn = calcWarning(branchCount, limits.maxBranchesPerApp);
    const memberWarn = calcWarning(memberCount, limits.maxMembersPerOrganization);

    return {
      workspaceId,
      planKey: isTrial ? 'free_trial' : planKey,
      planName: isTrial ? 'Free Trial' : planKey === 'premium' ? 'Premium' : 'Standard',
      isTrial,
      subscriptionStatus,
      entitlementStatus,
      trialEnd: isTrial ? (trialEnd || null) : null,
      currentPeriodEnd: sub?.currentPeriodEnd || null,
      features: {
        'inventory.max_branches': {
          limit: limits.maxBranchesPerApp,
          currentUsage: branchCount,
          remaining: Math.max(0, limits.maxBranchesPerApp - branchCount),
          source: 'plan',
          percent: branchWarn.percent,
          warning: branchWarn.warning,
        },
        'workspace.max_members': {
          limit: limits.maxMembersPerOrganization,
          currentUsage: memberCount,
          remaining: Math.max(0, limits.maxMembersPerOrganization - memberCount),
          source: 'plan',
          percent: memberWarn.percent,
          warning: memberWarn.warning,
        },
        'inventory.max_products': {
          limit: limits.maxProductsPerWorkspace,
          currentUsage: 0,
          remaining: limits.maxProductsPerWorkspace,
          source: 'plan',
        },
        'inventory.max_monthly_transactions': {
          limit: limits.maxTransactionsPerMonth,
          currentUsage: 0,
          remaining: limits.maxTransactionsPerMonth,
          source: 'plan',
        },
        'inventory.basic_reports': { enabled: true, source: 'plan' },
        'inventory.advanced_reports': { enabled: limits.advancedReports, source: 'plan' },
        'inventory.api_access': { enabled: limits.apiAccess, source: 'plan' },
        'inventory.custom_roles': { enabled: limits.customRoles, source: 'plan' },
      },
      allowedApplications: ['inventory'],
      overrides: [],
      usage: {
        branches: branchCount,
        members: memberCount,
        products: 0,
        transactions: 0,
        apps: 1,
      },
    };
  }

  /**
   * 2. Get Active Plan for workspace
   */
  public async getActivePlan(workspaceId: string): Promise<string> {
    const sub = await dataService.getWorkspaceSubscription(workspaceId);
    if (!sub) return 'free_trial';
    const key = (sub.planKey || 'free_trial').toLowerCase();
    return key === 'free' ? 'free_trial' : key;
  }

  /**
   * 3. Get Workspace Entitlement for a specific feature
   */
  public async getWorkspaceEntitlement(workspaceId: string, featureKey: string, productKey?: string) {
    const ctx = await this.getEntitlementContext(workspaceId);
    const feat = (ctx.features as any)[featureKey];
    if (feat) {
      return {
        workspaceId,
        featureKey,
        productKey,
        limitValue: feat.limit,
        limitType: typeof feat.limit === 'number' ? 'fixed' : feat.limit === 'unlimited' ? 'unlimited' : 'boolean',
        enabled: feat.enabled !== undefined ? feat.enabled : true,
        source: feat.source || 'plan',
        status: ctx.entitlementStatus,
      };
    }
    return null;
  }

  /**
   * 4. Check entitlement limit (non-blocking)
   */
  public async check(workspaceIdOrInput: string | EntitlementCheckInput, inputOrUndefined?: EntitlementCheckInput): Promise<EntitlementCheckResult> {
    const input = this.normalizeInput(workspaceIdOrInput, inputOrUndefined);
    const workspaceId = input.workspaceId || '';
    const ctx = await this.getEntitlementContext(workspaceId, input.userId);

    const feature = (ctx.features as any)[input.featureKey];
    const amount = input.requestedAmount || 1;

    if (!feature) {
      return {
        allowed: true,
        featureKey: input.featureKey,
        currentUsage: 0,
        limit: 'unlimited',
        remaining: 'unlimited',
        planKey: ctx.planKey,
        source: 'plan',
        warnings: [],
      };
    }

    const currentUsage = feature.currentUsage ?? 0;
    const limit = feature.limit;

    if (limit === 'unlimited') {
      return {
        allowed: true,
        featureKey: input.featureKey,
        currentUsage,
        limit: 'unlimited',
        remaining: 'unlimited',
        planKey: ctx.planKey,
        source: feature.source || 'plan',
        warnings: [],
      };
    }

    const numLimit = Number(limit) || 0;
    const allowed = currentUsage + amount <= numLimit;
    const remaining = Math.max(0, numLimit - currentUsage);
    const upgradePlan = ctx.planKey === 'free_trial' ? 'standard' : ctx.planKey === 'standard' ? 'premium' : undefined;

    if (!allowed) {
      let resource = 'resources';
      if (input.featureKey.includes('branch')) resource = 'branches';
      else if (input.featureKey.includes('member')) resource = 'members';
      else if (input.featureKey.includes('product')) resource = 'products';

      const upgradeName = upgradePlan ? upgradePlan.charAt(0).toUpperCase() + upgradePlan.slice(1) : 'Premium';
      return {
        allowed: false,
        code: 'ENTITLEMENT_LIMIT_REACHED',
        featureKey: input.featureKey,
        currentUsage,
        current: currentUsage,
        limit: numLimit,
        remaining,
        planKey: ctx.planKey,
        source: feature.source || 'plan',
        upgradePlan,
        warnings: feature.warning ? [feature.warning] : [],
        message: `Your plan allows ${numLimit} ${resource}. Upgrade to ${upgradeName} for more.`,
      };
    }

    return {
      allowed: true,
      featureKey: input.featureKey,
      currentUsage,
      current: currentUsage,
      limit: numLimit,
      remaining: Math.max(0, numLimit - (currentUsage + amount)),
      planKey: ctx.planKey,
      source: feature.source || 'plan',
      warnings: feature.warning ? [feature.warning] : [],
    };
  }

  public async checkLimit(workspaceIdOrInput: string | EntitlementCheckInput, inputOrUndefined?: EntitlementCheckInput): Promise<EntitlementCheckResult> {
    return this.check(workspaceIdOrInput, inputOrUndefined);
  }

  /**
   * 5. Require entitlement limit (throws error on denial)
   */
  public async require(workspaceIdOrInput: string | EntitlementCheckInput, inputOrUndefined?: EntitlementCheckInput): Promise<EntitlementCheckResult> {
    const res = await this.check(workspaceIdOrInput, inputOrUndefined);
    if (!res.allowed) {
      const err: any = new Error(res.message || 'Entitlement limit reached');
      err.code = res.code || 'ENTITLEMENT_LIMIT_REACHED';
      err.statusCode = 403;
      err.featureKey = res.featureKey;
      err.currentUsage = res.currentUsage;
      err.limit = res.limit;
      err.remaining = res.remaining;
      err.upgradePlan = res.upgradePlan;
      throw err;
    }
    return res;
  }

  public async requireLimit(workspaceIdOrInput: string | EntitlementCheckInput, inputOrUndefined?: EntitlementCheckInput): Promise<EntitlementCheckResult> {
    return this.require(workspaceIdOrInput, inputOrUndefined);
  }

  /**
   * 6. Get Usage for a feature or all features
   */
  public async getUsage(workspaceId: string, featureKey?: string) {
    const ctx = await this.getEntitlementContext(workspaceId);
    if (featureKey) {
      const feat = (ctx.features as any)[featureKey];
      return {
        featureKey,
        currentUsage: feat?.currentUsage ?? 0,
        limit: feat?.limit,
        remaining: feat?.remaining,
      };
    }
    return ctx.usage;
  }

  /**
   * 7. Recalculate workspace entitlements
   */
  public async recalculate(workspaceId: string, actorUserId?: string, reason?: string) {
    try {
      return await dataService.recalculateWorkspaceEntitlements(workspaceId, actorUserId, reason);
    } catch {}
    return {
      success: true,
      workspaceId,
      recalculatedAt: Date.now(),
    };
  }

  /**
   * 8. Apply Administrative Override (Legacy & Direct)
   */
  public async applyOverride(workspaceId: string, input: OverrideInput) {
    try {
      return await dataService.applyEntitlementOverride(workspaceId, input);
    } catch (err: any) {
      if (err.message && err.message.includes('DUAL_ADMIN_APPROVAL_REQUIRED')) throw err;
      if (err.message && err.message.includes('INVALID_EXPIRATION')) throw err;
    }
    return {
      success: true,
      workspaceId,
      featureKey: input.featureKey,
      appliedAt: Date.now(),
    };
  }

  /**
   * 8b. Create Entitlement Override with Multi-Tier Risk Governance
   */
  public async createOverride(workspaceId: string, data: any) {
    return dataService.createEntitlementOverride({
      workspaceId,
      ...data,
    });
  }

  /**
   * 8c. Submit Override for Approval
   */
  public async submitForApproval(overrideId: string, adminId?: string, reason?: string) {
    return dataService.submitEntitlementOverrideForApproval(overrideId, adminId, reason);
  }

  /**
   * 8d. Approve Override (Enforces Dual-Admin Separation)
   */
  public async approveOverride(overrideId: string, approvedByAdminId: string, reason?: string) {
    return dataService.approveEntitlementOverride(overrideId, approvedByAdminId, reason);
  }

  /**
   * 8e. Reject Override
   */
  public async rejectOverride(overrideId: string, rejectedByAdminId: string, rejectionReason: string) {
    return dataService.rejectEntitlementOverride(overrideId, rejectedByAdminId, rejectionReason);
  }

  /**
   * 9. Remove / Revoke Administrative Override
   */
  public async removeOverride(workspaceId: string, overrideId: string, adminId?: string, reason?: string) {
    try {
      return await dataService.revokeEntitlementOverride(overrideId, adminId, reason);
    } catch {}
    return {
      success: true,
      overrideId,
      revokedAt: Date.now(),
    };
  }

  public async revokeOverride(overrideId: string, adminId?: string, reason?: string) {
    return this.removeOverride('', overrideId, adminId, reason);
  }

  /**
   * 9b. Extend Free Trial Period
   */
  public async extendTrial(data: {
    workspaceId: string;
    additionalDays: number;
    reason: string;
    customerVisibleReason?: string;
    supportTicketReference?: string;
    adminId: string;
  }) {
    return dataService.extendTrialPeriod(data);
  }

  /**
   * 9c. Grant Manual Plan (Enterprise Pilot, Partner, Support Exception)
   */
  public async grantManualPlan(data: {
    workspaceId: string;
    planKey: 'standard' | 'premium';
    durationDays?: number;
    grantType?: string;
    reason: string;
    customerVisibleReason?: string;
    supportTicketReference?: string;
    adminId: string;
    approverAdminId?: string;
    reviewAt?: number;
  }) {
    return dataService.grantManualPlan(data);
  }

  /**
   * 9d. List Workspace Overrides
   */
  public async getOverrides(workspaceId: string, status?: string) {
    try {
      return await dataService.getWorkspaceOverrides(workspaceId, status);
    } catch {}
    return [];
  }

  /**
   * 9e. Get Override Detail
   */
  public async getOverrideDetail(overrideId: string) {
    return dataService.getOverrideDetail(overrideId);
  }

  /**
   * 9f. Get Override History
   */
  public async getOverrideHistory(workspaceId?: string, limit?: number) {
    try {
      return await dataService.getOverrideHistory(workspaceId, limit);
    } catch {}
    return [];
  }

  /**
   * 9g. Reconcile Overrides & Entitlements
   */
  public async reconcile(workspaceId?: string, triggeredByAdminId?: string) {
    return dataService.reconcileOverridesAndEntitlements(workspaceId, triggeredByAdminId);
  }

  /**
   * 10. Get Conflicts for a target downgrade plan
   */
  public async getConflicts(workspaceId: string, targetPlanKey: string) {
    const ctx = await this.getEntitlementContext(workspaceId);
    const targetLimits = getPlanLimits(targetPlanKey);
    const conflicts: any[] = [];

    const branchUsage = ctx.usage.branches || 0;
    if (branchUsage > targetLimits.maxBranchesPerApp) {
      conflicts.push({
        resourceType: 'branch',
        featureKey: 'inventory.max_branches',
        currentCount: branchUsage,
        targetLimit: targetLimits.maxBranchesPerApp,
        excess: branchUsage - targetLimits.maxBranchesPerApp,
        message: `Your organization has ${branchUsage} branches, but ${targetPlanKey} allows ${targetLimits.maxBranchesPerApp}.`,
      });
    }

    const memberUsage = ctx.usage.members || 0;
    if (memberUsage > targetLimits.maxMembersPerOrganization) {
      conflicts.push({
        resourceType: 'member',
        featureKey: 'workspace.max_members',
        currentCount: memberUsage,
        targetLimit: targetLimits.maxMembersPerOrganization,
        excess: memberUsage - targetLimits.maxMembersPerOrganization,
        message: `Your organization has ${memberUsage} members, but ${targetPlanKey} allows ${targetLimits.maxMembersPerOrganization}.`,
      });
    }

    return {
      workspaceId,
      targetPlanKey,
      hasConflicts: conflicts.length > 0,
      conflictsCount: conflicts.length,
      conflicts,
    };
  }

  // ==========================================
  // Legacy / Route Compatibility Methods
  // ==========================================

  public async checkWorkspaceCreationEntitlement(userId: string): Promise<EntitlementCheckResult> {
    const eligibility = await this.getOrganizationCreationEligibility(userId);
    return {
      allowed: eligibility.allowed,
      current: eligibility.currentOwnedOrganizations,
      limit: eligibility.maximumOwnedOrganizations,
      planKey: 'free_trial',
      error: eligibility.allowed
        ? undefined
        : `You have reached the maximum of ${eligibility.maximumOwnedOrganizations} organizations you can create.`,
    };
  }

  public async getOrganizationCreationEligibility(userId: string): Promise<OrganizationCreationEligibility> {
    try {
      const res = await dataService.getOrganizationCreationEligibility(userId);
      if (res) return res;
    } catch {}

    let ownedCount = 0;
    try {
      const memberships = await dataService.getUserMemberships(userId);
      ownedCount = (memberships || []).filter(
        (m: any) =>
          m.membership?.role === 'OWNER' &&
          m.organization?.status !== 'deleted' &&
          !m.organization?.deletedAt
      ).length;
    } catch {}

    const limit = MAX_OWNED_ORGANIZATIONS_PER_USER;
    const allowed = ownedCount < limit;
    return {
      allowed,
      ownedCount,
      ownedLimit: limit,
      trialCount: 0,
      trialLimit: 1,
      joinedCount: 0,
      reasons: allowed ? [] : ['OWNERSHIP_LIMIT_REACHED'],
      currentOwnedOrganizations: ownedCount,
      maximumOwnedOrganizations: limit,
      remainingOwnedOrganizations: Math.max(limit - ownedCount, 0),
      code: allowed ? undefined : 'ORGANIZATION_LIMIT_REACHED',
      message: allowed
        ? undefined
        : `You have reached the maximum of ${limit} organizations you can create.`,
    };
  }

  public async requireCanCreateOrganization(userId: string): Promise<OrganizationCreationEligibility> {
    const eligibility = await this.getOrganizationCreationEligibility(userId);
    if (!eligibility.allowed) {
      const err: any = new Error(
        eligibility.message ||
          `You already own ${eligibility.currentOwnedOrganizations} organizations. You can still join other organizations by invitation.`
      );
      err.code = 'ORGANIZATION_LIMIT_REACHED';
      err.statusCode = 409;
      err.currentOwnedOrganizations = eligibility.currentOwnedOrganizations;
      err.maximumOwnedOrganizations = eligibility.maximumOwnedOrganizations;
      throw err;
    }
    return eligibility;
  }

  public async checkAppActivationEntitlement(
    workspaceId: string,
    productKey?: string
  ): Promise<EntitlementCheckResult> {
    const targetNorm = (productKey || 'inventory').toLowerCase();
    if (targetNorm !== 'inventory') {
      return {
        allowed: false,
        current: 1,
        limit: 1,
        planKey: 'free_trial',
        error: 'Only the Inventory application is currently available.',
      };
    }
    return {
      allowed: true,
      current: 1,
      limit: 1,
      planKey: 'free_trial',
    };
  }

  public async checkMemberInvitationEntitlement(
    workspaceId: string,
    callerUserId?: string
  ): Promise<EntitlementCheckResult> {
    return this.check({
      workspaceId,
      userId: callerUserId,
      featureKey: 'workspace.max_members',
      requestedAmount: 1,
    });
  }

  public async checkBranchCreationEntitlement(
    workspaceIdOrUserId: string,
    callerUserIdOrWorkspaceId?: string,
    productKey?: string
  ): Promise<EntitlementCheckResult> {
    let workspaceId = workspaceIdOrUserId;
    let callerUserId = callerUserIdOrWorkspaceId;

    if (
      workspaceIdOrUserId &&
      callerUserIdOrWorkspaceId &&
      workspaceIdOrUserId.startsWith('user_') &&
      !callerUserIdOrWorkspaceId.startsWith('user_')
    ) {
      workspaceId = callerUserIdOrWorkspaceId;
      callerUserId = workspaceIdOrUserId;
    }

    return this.check({
      workspaceId,
      userId: callerUserId,
      featureKey: 'inventory.max_branches',
      productKey: productKey || 'inventory',
      requestedAmount: 1,
    });
  }

  public async checkProductCreationEntitlement(
    workspaceId: string,
    countToAdd: number = 1
  ): Promise<EntitlementCheckResult> {
    return this.check({
      workspaceId,
      featureKey: 'inventory.max_products',
      requestedAmount: countToAdd,
    });
  }

  public async getWorkspaceUsageSummary(workspaceId: string, userId?: string) {
    const ctx = await this.getEntitlementContext(workspaceId, userId);
    return {
      workspaceId,
      planKey: ctx.planKey,
      planName: ctx.planName,
      isTrial: ctx.isTrial,
      status: ctx.subscriptionStatus,
      entitlementStatus: ctx.entitlementStatus,
      trialEnd: ctx.trialEnd,
      currentPeriodEnd: ctx.currentPeriodEnd,
      usage: ctx.usage,
      features: ctx.features,
      overrides: ctx.overrides,
      allowedApplications: ctx.allowedApplications,
    };
  }

  public async getOrganizationUsageSummary(organizationId: string, userId?: string) {
    return this.getWorkspaceUsageSummary(organizationId, userId);
  }
}

export const entitlementService = new EntitlementService();
