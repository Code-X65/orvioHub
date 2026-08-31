export type PlanTier = 'free' | 'standard' | 'premium';

export interface PlanLimitConfig {
  maxWorkspaces: number;
  maxAppsPerWorkspace: number;
  maxMembers: number;
  maxProducts: number;
  maxTransactions: number;
}

export const PLAN_LIMITS: Record<PlanTier, PlanLimitConfig> = {
  free: {
    maxWorkspaces: 1,
    maxAppsPerWorkspace: 1,
    maxMembers: 2,
    maxProducts: 500,
    maxTransactions: 300,
  },
  standard: {
    maxWorkspaces: 3,
    maxAppsPerWorkspace: 3,
    maxMembers: 10,
    maxProducts: 5000,
    maxTransactions: 5000,
  },
  premium: {
    maxWorkspaces: 10,
    maxAppsPerWorkspace: 999999, // unlimited
    maxMembers: 50,
    maxProducts: 25000,
    maxTransactions: 25000,
  },
};

export function getPlanLimits(planKey?: string): PlanLimitConfig {
  const key = (planKey || 'free').toLowerCase() as PlanTier;
  return PLAN_LIMITS[key] || PLAN_LIMITS.free;
}
