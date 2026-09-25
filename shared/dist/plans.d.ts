/**
 * Canonical Subscription Plans & Limits Configuration
 * Single source of truth across frontend and backend.
 */
export type PlanTier = 'free_trial' | 'standard' | 'premium' | 'enterprise' | 'free';
export declare const VALID_PLAN_KEYS: readonly PlanTier[];
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
export declare const PLAN_CONFIG: Record<PlanTier, CanonicalPlanConfig>;
export interface PlanLimitConfig {
    maxOrganizations: number;
    maxAppsPerOrganization: number | 'unlimited';
    maxBranchesPerApp: number;
    maxMembersPerOrganization: number;
    maxProductsPerWorkspace: number;
    maxTransactionsPerMonth: number;
    basicReports: boolean;
    advancedReports: boolean;
    apiAccess: boolean;
    customRoles: boolean;
    advancedExports: boolean;
    maxWorkspaces: number;
    maxAppsPerWorkspace: number | 'unlimited';
    maxMembers: number;
    maxProducts: number;
    maxTransactions: number;
    allowedApps: string[];
}
export declare const PLAN_LIMITS: Record<PlanTier, PlanLimitConfig>;
export declare function getPlanLimits(planKey?: string): PlanLimitConfig;
export declare function getCanonicalPlanConfig(planKey?: string): CanonicalPlanConfig;
/**
 * Standardized Entitlement Limit Error Response helper (Section 6)
 */
export declare function buildEntitlementLimitError(featureKey: string, currentUsage: number, limit: number, planKey?: string): {
    error: {
        code: string;
        featureKey: string;
        currentUsage: number;
        limit: number;
        upgradePlan: string;
        message: string;
    };
};
//# sourceMappingURL=plans.d.ts.map