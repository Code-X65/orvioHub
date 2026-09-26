import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { handleApiError } from '@/lib/error-handler';
import { createQueryKey } from '@/lib/react-query-adapter';

export interface MetricItem {
  current: number;
  limit: number;
  percent: number;
  isApproaching: boolean;
  isReached: boolean;
}

export interface OrganizationUsageSummary {
  organizationId: string;
  planKey: string;
  limits: {
    maxApps: number;
    maxBranches: number;
    maxMembers: number;
    maxProducts: number;
    maxTransactions: number;
  };
  metrics: {
    apps: MetricItem;
    branches: MetricItem;
    members: MetricItem;
    products: MetricItem;
    transactions: MetricItem;
  };
  hasApproachingLimits: boolean;
  hasExceededLimits: boolean;
  warningMessage: string | null;
  subscription?: any;
}

export const createOrgUsageQueryKey = (organizationId?: string | null) =>
  createQueryKey('/organizations/usage/summary', { organizationId: organizationId || '' });

export function useOrganizationEntitlements(organizationId?: string | null) {
  const queryKey = createOrgUsageQueryKey(organizationId);

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!organizationId) return null;
      try {
        return await api.get<OrganizationUsageSummary>(
          `/organizations/${organizationId}/usage/summary`,
          { cacheTtlMs: 15000 }
        );
      } catch (err) {
        handleApiError(err, 'fetch organization usage summary', { showError: false });
        throw err;
      }
    },
    enabled: Boolean(organizationId),
    staleTime: 1000 * 30, // 30 seconds
  });

  const summary = query.data || null;
  const planKey = (summary?.subscription?.activePlan || summary?.planKey || 'free_trial').toLowerCase();
  const isTrial = planKey === 'free' || planKey === 'free_trial' || planKey === 'trial';
  const isStandard = planKey === 'standard';
  const isPremium = planKey === 'premium';

  return {
    summary,
    planKey,
    activePlan: summary?.subscription?.activePlan || (isStandard ? 'standard' : isPremium ? 'premium' : 'free_trial'),
    isTrial,
    isStandard,
    isPremium,
    subscription: summary?.subscription,
    metrics: summary?.metrics,
    limits: summary?.limits,
    warningMessage: summary?.warningMessage,
    hasApproachingLimits: Boolean(summary?.hasApproachingLimits),
    hasExceededLimits: Boolean(summary?.hasExceededLimits),
    isLoading: Boolean(organizationId) && query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    refetch: () => query.refetch(),
  };
}
