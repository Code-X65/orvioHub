import { dataService } from './dataService.js';
import { getPlanLimits, PLAN_LIMITS, type PlanTier } from '../config/planLimits.js';

export const MAX_OWNED_ORGANIZATIONS_PER_USER = 3;
export const FEATURE_KEY_ORG_LIMIT = "organization.max_owned_count";

export interface OrganizationCreationEligibility {
  allowed: boolean;
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
  current: number;
  limit: number;
  planKey: string;
  error?: string;
}

export class EntitlementService {
  /**
   * Organization / Workspace Creation Eligibility Check (Max 3 owned organizations)
   */
  public async checkWorkspaceCreationEntitlement(userId: string): Promise<EntitlementCheckResult> {
    const eligibility = await this.getOrganizationCreationEligibility(userId);
    return {
      allowed: eligibility.allowed,
      current: eligibility.currentOwnedOrganizations,
      limit: eligibility.maximumOwnedOrganizations,
      planKey: 'free',
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

  /**
   * User Story 2.3: Application Activation Limits
   * Free: 1, Standard: 3, Premium: Unlimited
   */
  public async checkAppActivationEntitlement(
    workspaceId: string,
    productKey?: string
  ): Promise<EntitlementCheckResult> {
    const sub = await dataService.getWorkspaceSubscription(workspaceId);
    let planKey = (sub?.planKey || 'free').toLowerCase() as PlanTier;
    if (planKey === ('free_trial' as any)) planKey = 'free';
    const limits = getPlanLimits(planKey);

    // 1. Check if app is in allowed apps for plan
    if (productKey) {
      const targetNorm = productKey.toLowerCase();
      const isAllowed = limits.allowedApps.some((app) => {
        const norm = app.toLowerCase();
        return (
          norm === targetNorm ||
          (norm === 'tasks' && targetNorm === 'taskmanagement') ||
          (norm === 'taskmanagement' && targetNorm === 'tasks')
        );
      });
      if (!isAllowed) {
        return {
          allowed: false,
          current: 0,
          limit: limits.maxAppsPerOrganization,
          planKey,
          error: 'App not included in your plan',
        };
      }
    }

    // 2. Check active app count against maxAppsPerOrganization
    const activeCount = await dataService.countActiveWorkspaceProducts(workspaceId);

    if (limits.maxAppsPerOrganization < 999999 && activeCount >= limits.maxAppsPerOrganization) {
      if (planKey === 'free') {
        return {
          allowed: false,
          current: activeCount,
          limit: limits.maxAppsPerOrganization,
          planKey,
          error: 'Free Trial organizations can only activate 1 application. Upgrade to Standard to activate more applications.',
        };
      }
      const planName = planKey.charAt(0).toUpperCase() + planKey.slice(1);
      const nextPlan = (planKey as string) === 'free' ? 'Standard' : 'Premium';
      return {
        allowed: false,
        current: activeCount,
        limit: limits.maxAppsPerOrganization,
        planKey,
        error: `${planName} plan includes ${limits.maxAppsPerOrganization} application${
          limits.maxAppsPerOrganization > 1 ? 's' : ''
        }. Upgrade to ${nextPlan} to activate more.`,
      };
    }

    return {
      allowed: true,
      current: activeCount,
      limit: limits.maxAppsPerOrganization,
      planKey,
    };
  }

  /**
   * User Story 2.4: Member Invitation Limits
   * Free: 2, Standard: 10, Premium: 50
   */
  public async checkMemberInvitationEntitlement(
    workspaceId: string,
    callerUserId?: string
  ): Promise<EntitlementCheckResult> {
    let targetWorkspaceId = workspaceId;
    try {
      const orgWorkspaces = await dataService.getOrganizationWorkspaces(workspaceId);
      const primaryWs = orgWorkspaces.find((w: any) => w.isDefault) || orgWorkspaces[0];
      if (primaryWs) {
        targetWorkspaceId = primaryWs._id || primaryWs.id;
      }
    } catch {}

    const sub = await dataService.getWorkspaceSubscription(targetWorkspaceId);
    let planKey = (sub?.planKey || 'free').toLowerCase() as PlanTier;
    if (planKey === ('free_trial' as any)) planKey = 'free';

    const limits = getPlanLimits(planKey);

    let currentCount = 0;
    try {
      const members = await dataService.getWorkspaceMembers(targetWorkspaceId, callerUserId || '');
      currentCount = Array.isArray(members) ? members.length : 0;
    } catch {
      try {
        const orgMembers = await dataService.getOrganizationMembers(workspaceId, callerUserId || '');
        currentCount = Array.isArray(orgMembers) ? orgMembers.length : 0;
      } catch {
        currentCount = 1;
      }
    }

    const maxMembers = limits.maxMembersPerOrganization ?? limits.maxMembers;
    if (currentCount >= maxMembers) {
      const planName = planKey.charAt(0).toUpperCase() + planKey.slice(1);
      const nextPlan = planKey === 'free' ? 'Standard' : 'Premium';
      return {
        allowed: false,
        current: currentCount,
        limit: maxMembers,
        planKey,
        error: `${planName} plan allows ${maxMembers} members. Upgrade to ${nextPlan} for more.`,
      };
    }

    return {
      allowed: true,
      current: currentCount,
      limit: maxMembers,
      planKey,
    };
  }

  /**
   * User Story 2.5: Product Catalog Limits
   * Free: 500, Standard: 5,000, Premium: 25,000
   */
  public async checkProductCreationEntitlement(
    workspaceId: string,
    countToAdd: number = 1
  ): Promise<EntitlementCheckResult> {
    const sub = await dataService.getWorkspaceSubscription(workspaceId);
    const planKey = (sub?.planKey || 'free').toLowerCase() as PlanTier;
    const limits = getPlanLimits(planKey);

    let currentCount = 0;
    try {
      const products = await dataService.getInventoryProducts(workspaceId);
      currentCount = Array.isArray(products) ? products.length : 0;
    } catch {
      currentCount = 0;
    }

    if (currentCount + countToAdd > limits.maxProducts) {
      const planName = planKey.charAt(0).toUpperCase() + planKey.slice(1);
      const nextPlan = planKey === 'free' ? 'Standard' : 'Premium';
      return {
        allowed: false,
        current: currentCount,
        limit: limits.maxProducts,
        planKey,
        error: `${planName} plan allows ${limits.maxProducts.toLocaleString()} products. Upgrade to ${nextPlan} for more.`,
      };
    }

    return {
      allowed: true,
      current: currentCount,
      limit: limits.maxProducts,
      planKey,
    };
  }

  /**
   * User Story 4.1: Unified Workspace Usage Summary & Threshold Warnings
   */
  public async getWorkspaceUsageSummary(workspaceId: string, userId?: string) {
    const sub = await dataService.getWorkspaceSubscription(workspaceId);
    const planKey = (sub?.planKey || 'free').toLowerCase() as PlanTier;
    const limits = getPlanLimits(planKey);

    // 1. Workspaces Count
    let workspacesCount = 1;
    if (userId) {
      try {
        const owned = (await dataService.getUserWorkspaces(userId)) || [];
        workspacesCount = owned.filter((w: any) => w.isOwner || w.role?.toLowerCase() === 'owner').length || 1;
      } catch {
        workspacesCount = 1;
      }
    }

    // 2. Active Apps Count
    let appsCount = 1;
    try {
      appsCount = await dataService.countActiveWorkspaceProducts(workspaceId);
    } catch {
      appsCount = 1;
    }

    // 3. Team Members Count
    let membersCount = 1;
    try {
      const members = await dataService.getWorkspaceMembers(workspaceId, userId || '');
      membersCount = Array.isArray(members) ? members.length : 1;
    } catch {
      membersCount = 1;
    }

    // 4. Products Count
    let productsCount = 0;
    try {
      const products = await dataService.getInventoryProducts(workspaceId);
      productsCount = Array.isArray(products) ? products.length : 0;
    } catch {
      productsCount = 0;
    }

    // 5. Monthly Transactions Count
    let transactionsCount = 0;
    try {
      const usage = await dataService.getWorkspaceUsage(workspaceId);
      transactionsCount = usage?.counters?.transactionsCount || 0;
    } catch {
      transactionsCount = 0;
    }

    const calcMetric = (current: number, limit: number) => {
      const percent = limit > 0 ? Math.min(100, Math.round((current / limit) * 100)) : 0;
      return {
        current,
        limit,
        percent,
        isApproaching: percent >= 80 && percent < 100,
        isReached: percent >= 100,
      };
    };

    const metrics = {
      workspaces: calcMetric(workspacesCount, limits.maxWorkspaces),
      apps: calcMetric(appsCount, limits.maxAppsPerWorkspace),
      members: calcMetric(membersCount, limits.maxMembers),
      products: calcMetric(productsCount, limits.maxProducts),
      transactions: calcMetric(transactionsCount, limits.maxTransactions),
    };

    const hasApproachingLimits = Object.values(metrics).some((m) => m.isApproaching);
    const hasExceededLimits = Object.values(metrics).some((m) => m.isReached);

    let warningMessage: string | null = null;
    if (metrics.products.isReached) {
      warningMessage = `Product limit reached (${metrics.products.current}/${metrics.products.limit}). Upgrade your plan to continue adding products.`;
    } else if (metrics.products.isApproaching) {
      warningMessage = `You have used ${metrics.products.percent}% of your product quota (${metrics.products.current}/${metrics.products.limit}).`;
    } else if (metrics.apps.isReached) {
      warningMessage = `Application limit reached (${metrics.apps.current}/${metrics.apps.limit}). Upgrade to activate more applications.`;
    } else if (metrics.members.isReached) {
      warningMessage = `Team member limit reached (${metrics.members.current}/${metrics.members.limit}). Upgrade to invite more members.`;
    } else if (metrics.workspaces.isReached) {
      warningMessage = `Workspace limit reached (${metrics.workspaces.current}/${metrics.workspaces.limit}). Upgrade to create more workspaces.`;
    }

    return {
      workspaceId,
      planKey,
      limits,
      metrics,
      hasApproachingLimits,
      hasExceededLimits,
      warningMessage,
      subscription: sub,
    };
  }

  /**
   * Organization Usage Summary & Threshold Warnings (Priority 4)
   */
  public async getOrganizationUsageSummary(organizationId: string, userId?: string) {
    const sub = await dataService.getOrganizationSubscription(organizationId).catch(() => null);
    let planKey = (sub?.planKey || 'free_trial').toLowerCase() as PlanTier;
    if (planKey === ('free' as any)) planKey = 'free_trial' as any;
    const limits = getPlanLimits(planKey === ('free_trial' as any) ? 'free' : planKey);

    // 1. Active Apps Count
    let appsCount = 0;
    try {
      const apps = await dataService.getOrganizationApps(organizationId);
      appsCount = Array.isArray(apps)
        ? apps.filter((a: any) => a.isActivated && a.status !== 'inactive' && a.status !== 'suspended').length
        : 0;
    } catch {
      appsCount = 1;
    }

    // 2. Branches Count
    let branchesCount = 0;
    try {
      const branches = await dataService.listBranches({ organizationId });
      branchesCount = Array.isArray(branches) ? branches.length : 0;
    } catch {
      branchesCount = 1;
    }

    // 3. Team Members Count
    let membersCount = 1;
    try {
      const members = await dataService.getOrganizationMembers(organizationId, userId || '');
      membersCount = Array.isArray(members) ? members.length : 1;
    } catch {
      membersCount = 1;
    }

    // 4. Products Count
    let productsCount = 0;
    try {
      const products = await dataService.getInventoryProducts(organizationId);
      productsCount = Array.isArray(products) ? products.length : 0;
    } catch {
      productsCount = 0;
    }

    // 5. Monthly Transactions Count
    let transactionsCount = 0;
    try {
      const usage = await dataService.getWorkspaceUsage(organizationId);
      transactionsCount = usage?.counters?.transactionsCount || 0;
    } catch {
      transactionsCount = 0;
    }

    const calcMetric = (current: number, limit: number) => {
      const percent = limit > 0 ? Math.min(100, Math.round((current / limit) * 100)) : 0;
      return {
        current,
        limit,
        percent,
        isApproaching: percent >= 80 && percent < 100,
        isReached: percent >= 100,
      };
    };

    const isTrial = (planKey as string) === 'free_trial' || (planKey as string) === 'free';
    const maxBranches = limits.maxBranchesPerApp || (isTrial ? 1 : 5);
    const maxApps = limits.maxAppsPerOrganization || (isTrial ? 1 : 3);
    const maxMembers = limits.maxMembersPerOrganization || limits.maxMembers || (isTrial ? 2 : 10);
    const maxProducts = limits.maxProducts || (isTrial ? 500 : 5000);

    const metrics = {
      apps: calcMetric(appsCount, maxApps),
      branches: calcMetric(branchesCount, maxBranches),
      members: calcMetric(membersCount, maxMembers),
      products: calcMetric(productsCount, maxProducts),
      transactions: calcMetric(transactionsCount, limits.maxTransactions || 500),
    };

    const hasApproachingLimits = Object.values(metrics).some((m) => m.isApproaching);
    const hasExceededLimits = Object.values(metrics).some((m) => m.isReached);

    let warningMessage: string | null = null;
    if (metrics.branches.isReached) {
      warningMessage = `Branch limit reached (${metrics.branches.current}/${metrics.branches.limit}). Upgrade your plan to add more branches.`;
    } else if (metrics.products.isReached) {
      warningMessage = `Product limit reached (${metrics.products.current}/${metrics.products.limit}). Upgrade your plan to continue adding products.`;
    } else if (metrics.apps.isReached) {
      warningMessage = `Application limit reached (${metrics.apps.current}/${metrics.apps.limit}). Upgrade to activate more applications.`;
    } else if (metrics.members.isReached) {
      warningMessage = `Team member limit reached (${metrics.members.current}/${metrics.members.limit}). Upgrade to invite more members.`;
    } else if (metrics.branches.isApproaching) {
      warningMessage = `You are near your branch limit (${metrics.branches.current}/${metrics.branches.limit}).`;
    } else if (metrics.products.isApproaching) {
      warningMessage = `You have used ${metrics.products.percent}% of your product quota (${metrics.products.current}/${metrics.products.limit}).`;
    }

    return {
      organizationId,
      planKey,
      limits: {
        maxApps,
        maxBranches,
        maxMembers,
        maxProducts,
        maxTransactions: limits.maxTransactions || 500,
      },
      metrics,
      hasApproachingLimits,
      hasExceededLimits,
      warningMessage,
      subscription: sub,
    };
  }

  /**
   * Branch Creation Limits
   * Free: 1, Standard: 3, Premium: 10 per app
   */
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

    const sub = await dataService.getWorkspaceSubscription(workspaceId);
    let planKey = (sub?.planKey || 'free').toLowerCase() as PlanTier;
    if (planKey === ('free_trial' as any)) planKey = 'free';

    const limits = getPlanLimits(planKey);

    let currentCount = 0;
    try {
      const branches = await dataService.getBranches(workspaceId, callerUserId, productKey);
      currentCount = Array.isArray(branches) ? branches.length : 0;
    } catch {
      currentCount = 0;
    }

    const maxBranches = limits.maxBranchesPerApp || 1;
    if (currentCount >= maxBranches) {
      if (planKey === 'free') {
        return {
          allowed: false,
          current: currentCount,
          limit: maxBranches,
          planKey,
          error: 'Free Trial organizations can only have 1 branch per application. Upgrade to Standard to add more branches.',
        };
      }
      const planName = planKey.charAt(0).toUpperCase() + planKey.slice(1);
      const nextPlan = (planKey as string) === 'free' ? 'Standard' : 'Premium';
      return {
        allowed: false,
        current: currentCount,
        limit: maxBranches,
        planKey,
        error: `${planName} plan allows ${maxBranches} operating branch${
          maxBranches > 1 ? 'es' : ''
        }. Upgrade to ${nextPlan} to create more branches.`,
      };
    }

    return {
      allowed: true,
      current: currentCount,
      limit: maxBranches,
      planKey,
    };
  }

  /**
   * User-Level Entitlements based on Active Subscription
   */
  public async getUserEntitlements(userId: string) {
    const sub = await dataService.getUserSubscription(userId);
    const planKey = (sub?.planKey || 'free_trial').toLowerCase() as PlanTier;
    const limits = getPlanLimits(planKey);

    return {
      userId,
      planKey,
      status: sub?.status || 'active',
      limits,
      subscription: sub,
    };
  }

  /**
   * Aggregated User Usage vs Limits across all owned workspaces
   */
  public async getUserUsage(userId: string) {
    const userEntitlements = await this.getUserEntitlements(userId);
    const limits = userEntitlements.limits;

    const ownedWorkspaces = ((await dataService.getUserWorkspaces(userId)) || []).filter(
      (w: any) => w.isOwner || w.role?.toLowerCase() === 'owner'
    );
    const workspacesCount = ownedWorkspaces.length;

    let totalAppsCount = 0;
    let totalBranchesCount = 0;
    let totalMembersCount = 0;
    let totalProductsCount = 0;

    for (const ws of ownedWorkspaces) {
      const wsId = (ws as any).workspace?.id || (ws as any).id || (ws as any).workspaceId;
      if (wsId) {
        try {
          totalAppsCount += await dataService.countActiveWorkspaceProducts(wsId);
        } catch {}
        try {
          const branches = await dataService.getBranches(wsId, userId);
          totalBranchesCount += Array.isArray(branches) ? branches.length : 0;
        } catch {}
        try {
          const members = await dataService.getWorkspaceMembers(wsId, userId);
          totalMembersCount += Array.isArray(members) ? members.length : 1;
        } catch {}
        try {
          const prods = await dataService.getInventoryProducts(wsId);
          totalProductsCount += Array.isArray(prods) ? prods.length : 0;
        } catch {}
      }
    }

    const calcMetric = (current: number, limit: number) => {
      const percent = limit > 0 ? Math.min(100, Math.round((current / limit) * 100)) : 0;
      return {
        current,
        limit,
        percent,
        isApproaching: percent >= 80 && percent < 100,
        isReached: percent >= 100,
      };
    };

    return {
      userId,
      planKey: userEntitlements.planKey,
      status: userEntitlements.status,
      limits,
      metrics: {
        workspaces: calcMetric(workspacesCount, limits.maxWorkspaces),
        apps: calcMetric(totalAppsCount, limits.maxAppsPerWorkspace),
        branches: calcMetric(totalBranchesCount, limits.maxBranchesPerApp),
        members: calcMetric(totalMembersCount, limits.maxMembers),
        products: calcMetric(totalProductsCount, limits.maxProducts),
        transactions: calcMetric(0, limits.maxTransactions),
      },
    };
  }
}

export const entitlementService = new EntitlementService();
