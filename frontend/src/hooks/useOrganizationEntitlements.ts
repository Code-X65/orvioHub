import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

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

export function useOrganizationEntitlements(organizationId?: string | null) {
  const [summary, setSummary] = useState<OrganizationUsageSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(organizationId));
  const [error, setError] = useState<string | null>(null);

  const fetchUsage = useCallback(async (bypassCache = false) => {
    if (!organizationId) {
      setSummary(null);
      setIsLoading(false);
      return;
    }

    try {
      const res = await api.get<{ success: boolean; data: OrganizationUsageSummary }>(
        `/organizations/${organizationId}/usage/summary`,
        { bypassCache, cacheTtlMs: 15000 }
      );
      if (res?.data) {
        setSummary(res.data);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch usage quotas.');
    } finally {
      setIsLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

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
    isLoading,
    error,
    refetch: () => fetchUsage(true),
  };
}

