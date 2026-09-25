/**
 * Canonical Subscription Plans & Limits Configuration
 * Single source of truth across frontend and backend.
 */

export type PlanTier = 'free_trial' | 'standard' | 'premium' | 'enterprise' | 'free';

export const VALID_PLAN_KEYS: readonly PlanTier[] = [
  'free_trial',
  'standard',
  'premium',
  'enterprise',
  'free',
] as const;

export interface CanonicalPlanConfig {
  key: string;
  name: string;
  public: boolean;
  paid: boolean;
  trialDays: number | null;
  limits: {
    ownedOrganizations: number;
    branchesPerOrganization: number;
    membersPerOrganization: number;
    productsPerOrganization: number;
    monthlyTransactions: number;
  };
  features: {
    inventory: boolean;
    advancedReports: boolean;
    apiAccess: boolean;
    customRoles: boolean;
    advancedExports: boolean;
  };
  allowedApplications: string[];
}

export const PLAN_CONFIG: Record<PlanTier, CanonicalPlanConfig> = {
  free_trial: {
    key: 'free_trial',
    name: 'Free Trial',
    public: true,
    paid: false,
    trialDays: 30,
    limits: {
      ownedOrganizations: 1,
      branchesPerOrganization: 1,
      membersPerOrganization: 2,
      productsPerOrganization: 500,
      monthlyTransactions: 300,
    },
    features: {
      inventory: true,
      advancedReports: false,
      apiAccess: false,
      customRoles: false,
      advancedExports: false,
    },
    allowedApplications: ['inventory'],
  },

  standard: {
    key: 'standard',
    name: 'Standard',
    public: true,
    paid: true,
    trialDays: null,
    limits: {
      ownedOrganizations: 3,
      branchesPerOrganization: 3,
      membersPerOrganization: 10,
      productsPerOrganization: 5000,
      monthlyTransactions: 5000,
    },
    features: {
      inventory: true,
      advancedReports: true,
      apiAccess: false,
      customRoles: false,
      advancedExports: true,
    },
    allowedApplications: ['inventory'],
  },

  premium: {
    key: 'premium',
    name: 'Premium',
    public: true,
    paid: true,
    trialDays: null,
    limits: {
      ownedOrganizations: 10,
      branchesPerOrganization: 10,
      membersPerOrganization: 50,
      productsPerOrganization: 25000,
      monthlyTransactions: 25000,
    },
    features: {
      inventory: true,
      advancedReports: true,
      apiAccess: true,
      customRoles: true,
      advancedExports: true,
    },
    allowedApplications: ['inventory'],
  },

  enterprise: {
    key: 'enterprise',
    name: 'Enterprise',
    public: false,
    paid: true,
    trialDays: null,
    limits: {
      ownedOrganizations: 50,
      branchesPerOrganization: 100,
      membersPerOrganization: 500,
      productsPerOrganization: 100000,
      monthlyTransactions: 100000,
    },
    features: {
      inventory: true,
      advancedReports: true,
      apiAccess: true,
      customRoles: true,
      advancedExports: true,
    },
    allowedApplications: ['inventory', 'pos', 'booking', 'gym', 'billing', 'taskmanagement'],
  },

  free: {
    // Legacy mapping only - not exposed, not selectable for new subscriptions
    key: 'free',
    name: 'Legacy Free',
    public: false,
    paid: false,
    trialDays: 30,
    limits: {
      ownedOrganizations: 1,
      branchesPerOrganization: 1,
      membersPerOrganization: 2,
      productsPerOrganization: 500,
      monthlyTransactions: 300,
    },
    features: {
      inventory: true,
      advancedReports: false,
      apiAccess: false,
      customRoles: false,
      advancedExports: false,
    },
    allowedApplications: ['inventory'],
  },
};

export interface PlanLimitConfig {
  maxOrganizations: number;
  maxAppsPerOrganization: number | 'unlimited';
  maxBranchesPerApp: number;
  maxMembersPerOrganization: number;
  maxProductsPerWorkspace: number;
  maxTransactionsPerMonth: number;
  // Feature flags
  basicReports: boolean;
  advancedReports: boolean;
  apiAccess: boolean;
  customRoles: boolean;
  advancedExports: boolean;
  // Aliases for compatibility
  maxWorkspaces: number;
  maxAppsPerWorkspace: number | 'unlimited';
  maxMembers: number;
  maxProducts: number;
  maxTransactions: number;
  allowedApps: string[];
}

export const PLAN_LIMITS: Record<PlanTier, PlanLimitConfig> = {
  free_trial: {
    maxOrganizations: 1,
    maxAppsPerOrganization: 1,
    maxBranchesPerApp: 1,
    maxMembersPerOrganization: 2,
    maxProductsPerWorkspace: 500,
    maxTransactionsPerMonth: 300,
    basicReports: true,
    advancedReports: false,
    apiAccess: false,
    customRoles: false,
    advancedExports: false,
    maxWorkspaces: 1,
    maxAppsPerWorkspace: 1,
    maxMembers: 2,
    maxProducts: 500,
    maxTransactions: 300,
    allowedApps: ['inventory'],
  },
  free: {
    // Legacy fallback mapped to free_trial
    maxOrganizations: 1,
    maxAppsPerOrganization: 1,
    maxBranchesPerApp: 1,
    maxMembersPerOrganization: 2,
    maxProductsPerWorkspace: 500,
    maxTransactionsPerMonth: 300,
    basicReports: true,
    advancedReports: false,
    apiAccess: false,
    customRoles: false,
    advancedExports: false,
    maxWorkspaces: 1,
    maxAppsPerWorkspace: 1,
    maxMembers: 2,
    maxProducts: 500,
    maxTransactions: 300,
    allowedApps: ['inventory'],
  },
  standard: {
    maxOrganizations: 3,
    maxAppsPerOrganization: 3,
    maxBranchesPerApp: 3,
    maxMembersPerOrganization: 10,
    maxProductsPerWorkspace: 5000,
    maxTransactionsPerMonth: 5000,
    basicReports: true,
    advancedReports: true,
    apiAccess: false,
    customRoles: false,
    advancedExports: true,
    maxWorkspaces: 3,
    maxAppsPerWorkspace: 3,
    maxMembers: 10,
    maxProducts: 5000,
    maxTransactions: 5000,
    allowedApps: ['inventory'],
  },
  premium: {
    maxOrganizations: 10,
    maxAppsPerOrganization: 'unlimited',
    maxBranchesPerApp: 10,
    maxMembersPerOrganization: 50,
    maxProductsPerWorkspace: 25000,
    maxTransactionsPerMonth: 25000,
    basicReports: true,
    advancedReports: true,
    apiAccess: true,
    customRoles: true,
    advancedExports: true,
    maxWorkspaces: 10,
    maxAppsPerWorkspace: 'unlimited',
    maxMembers: 50,
    maxProducts: 25000,
    maxTransactions: 25000,
    allowedApps: ['inventory'],
  },
  enterprise: {
    maxOrganizations: 50,
    maxAppsPerOrganization: 'unlimited',
    maxBranchesPerApp: 100,
    maxMembersPerOrganization: 500,
    maxProductsPerWorkspace: 100000,
    maxTransactionsPerMonth: 100000,
    basicReports: true,
    advancedReports: true,
    apiAccess: true,
    customRoles: true,
    advancedExports: true,
    maxWorkspaces: 50,
    maxAppsPerWorkspace: 'unlimited',
    maxMembers: 500,
    maxProducts: 100000,
    maxTransactions: 100000,
    allowedApps: ['inventory', 'pos', 'booking', 'gym', 'billing', 'taskmanagement'],
  },
};

export function getPlanLimits(planKey?: string): PlanLimitConfig {
  const norm = (planKey || 'free_trial').toLowerCase() as keyof typeof PLAN_LIMITS;
  if (norm === 'free') return PLAN_LIMITS.free_trial;
  return PLAN_LIMITS[norm] || PLAN_LIMITS.free_trial;
}

export function getCanonicalPlanConfig(planKey?: string): CanonicalPlanConfig {
  const norm = (planKey || 'free_trial').toLowerCase() as keyof typeof PLAN_CONFIG;
  if (norm === 'free') return PLAN_CONFIG.free_trial;
  return PLAN_CONFIG[norm] || PLAN_CONFIG.free_trial;
}

/**
 * Standardized Entitlement Limit Error Response helper (Section 6)
 */
export function buildEntitlementLimitError(
  featureKey: string,
  currentUsage: number,
  limit: number,
  planKey: string = 'free_trial'
) {
  const upgradePlan = planKey === 'free_trial' ? 'standard' : 'premium';
  const resourceName = featureKey.includes('branch')
    ? `branch${limit === 1 ? '' : 'es'}`
    : featureKey.includes('member')
    ? `member${limit === 1 ? '' : 's'}`
    : featureKey.includes('product')
    ? `product${limit === 1 ? '' : 's'}`
    : 'item';

  return {
    error: {
      code: 'ENTITLEMENT_LIMIT_REACHED',
      featureKey,
      currentUsage,
      limit,
      upgradePlan,
      message: `Your current plan allows ${limit} ${resourceName}.`,
    },
  };
}
