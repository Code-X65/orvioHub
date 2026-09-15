export type PlanTier = 'free' | 'standard' | 'premium';

export interface PlanLimitConfig {
  maxOrganizations: number;
  maxAppsPerOrganization: number;
  maxBranchesPerApp: number;
  maxMembersPerOrganization: number;
  maxProductsPerWorkspace: number;
  maxTransactionsPerMonth: number;
  // Legacy aliases
  maxWorkspaces: number;
  maxAppsPerWorkspace: number;
  maxMembers: number;
  maxProducts: number;
  maxTransactions: number;
  allowedApps: string[];
}

export const PLAN_LIMITS: Record<PlanTier, PlanLimitConfig> = {
  free: {
    maxOrganizations: 1,
    maxAppsPerOrganization: 1,
    maxBranchesPerApp: 1,
    maxMembersPerOrganization: 2,
    maxProductsPerWorkspace: 500,
    maxTransactionsPerMonth: 500,
    maxWorkspaces: 1,
    maxAppsPerWorkspace: 1,
    maxMembers: 2,
    maxProducts: 500,
    maxTransactions: 500,
    allowedApps: ['inventory', 'tasks', 'taskmanagement', 'pos'],
  },
  standard: {
    maxOrganizations: 3,
    maxAppsPerOrganization: 3,
    maxBranchesPerApp: 3,
    maxMembersPerOrganization: 10,
    maxProductsPerWorkspace: 5000,
    maxTransactionsPerMonth: 5000,
    maxWorkspaces: 3,
    maxAppsPerWorkspace: 3,
    maxMembers: 10,
    maxProducts: 5000,
    maxTransactions: 5000,
    allowedApps: ['inventory', 'tasks', 'taskmanagement', 'pos', 'booking', 'gym'],
  },
  premium: {
    maxOrganizations: 10,
    maxAppsPerOrganization: 999999, // unlimited
    maxBranchesPerApp: 10,
    maxMembersPerOrganization: 50,
    maxProductsPerWorkspace: 25000,
    maxTransactionsPerMonth: 25000,
    maxWorkspaces: 10,
    maxAppsPerWorkspace: 999999,
    maxMembers: 50,
    maxProducts: 25000,
    maxTransactions: 25000,
    allowedApps: ['inventory', 'tasks', 'taskmanagement', 'pos', 'booking', 'gym', 'crm', 'analytics', 'invoicing', 'hr'],
  },
};

export function getPlanLimits(planKey?: string): PlanLimitConfig {
  let key = (planKey || 'free').toLowerCase() as PlanTier;
  if (key === ('free_trial' as any)) key = 'free';
  return PLAN_LIMITS[key] || PLAN_LIMITS.free;
}
