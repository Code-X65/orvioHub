import { dataService } from './dataService.js';
import { getPlanLimits, PLAN_LIMITS, type PlanTier } from '../config/planLimits.js';

export interface EntitlementCheckResult {
  allowed: boolean;
  current: number;
  limit: number;
  planKey: string;
  error?: string;
}

export class EntitlementService {
  /**
   * User Story 2.2: Workspace Creation Limits
   * Free: 1, Standard: 3, Premium: 10
   */
  public async checkWorkspaceCreationEntitlement(userId: string): Promise<EntitlementCheckResult> {
    const userWorkspaces = await dataService.getUserWorkspaces(userId);
    const ownedWorkspaces = (userWorkspaces || []).filter(
      (w: any) => w.isOwner || w.role?.toLowerCase() === 'owner'
    );
    const count = ownedWorkspaces.length;

    // Determine highest active subscription plan across user's owned workspaces
    let userHighestPlan: PlanTier = 'free';
    for (const ws of ownedWorkspaces) {
      const wsId = (ws as any).workspace?.id || (ws as any).workspaceId || (ws as any).id;
      if (wsId) {
        const sub = await dataService.getWorkspaceSubscription(wsId);
        if (sub && sub.status === 'active') {
          const plan = (sub.planKey || 'free').toLowerCase() as PlanTier;
          if (plan === 'premium') {
            userHighestPlan = 'premium';
            break;
          } else if (plan === 'standard') {
            userHighestPlan = 'standard';
          }
        }
      }
    }

    const limits = getPlanLimits(userHighestPlan);
    const maxWorkspaces = limits.maxWorkspaces;

    if (count >= maxWorkspaces) {
      const planName = userHighestPlan.charAt(0).toUpperCase() + userHighestPlan.slice(1);
      const nextPlan = userHighestPlan === 'free' ? 'Standard' : 'Premium';
      return {
        allowed: false,
        current: count,
        limit: maxWorkspaces,
        planKey: userHighestPlan,
        error: `Your ${planName} plan includes ${maxWorkspaces} workspace${
          maxWorkspaces > 1 ? 's' : ''
        }. Upgrade to ${nextPlan} to create more.`,
      };
    }

    return {
      allowed: true,
      current: count,
      limit: maxWorkspaces,
      planKey: userHighestPlan,
    };
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
    const planKey = (sub?.planKey || 'free').toLowerCase() as PlanTier;
    const limits = getPlanLimits(planKey);

    const activeCount = await dataService.countActiveWorkspaceProducts(workspaceId);

    if (activeCount >= limits.maxAppsPerWorkspace) {
      const planName = planKey.charAt(0).toUpperCase() + planKey.slice(1);
      const nextPlan = planKey === 'free' ? 'Standard' : 'Premium';
      return {
        allowed: false,
        current: activeCount,
        limit: limits.maxAppsPerWorkspace,
        planKey,
        error: `${planName} plan includes ${limits.maxAppsPerWorkspace} application${
          limits.maxAppsPerWorkspace > 1 ? 's' : ''
        }. Upgrade to ${nextPlan} to activate more.`,
      };
    }

    return {
      allowed: true,
      current: activeCount,
      limit: limits.maxAppsPerWorkspace,
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
    const sub = await dataService.getWorkspaceSubscription(workspaceId);
    const planKey = (sub?.planKey || 'free').toLowerCase() as PlanTier;
    const limits = getPlanLimits(planKey);

    let currentCount = 0;
    try {
      const members = await dataService.getWorkspaceMembers(workspaceId, callerUserId || '');
      currentCount = Array.isArray(members) ? members.length : 0;
    } catch {
      currentCount = 1;
    }

    if (currentCount >= limits.maxMembers) {
      const planName = planKey.charAt(0).toUpperCase() + planKey.slice(1);
      const nextPlan = planKey === 'free' ? 'Standard' : 'Premium';
      return {
        allowed: false,
        current: currentCount,
        limit: limits.maxMembers,
        planKey,
        error: `${planName} plan allows ${limits.maxMembers} members. Upgrade to ${nextPlan} for more.`,
      };
    }

    return {
      allowed: true,
      current: currentCount,
      limit: limits.maxMembers,
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
}

export const entitlementService = new EntitlementService();
