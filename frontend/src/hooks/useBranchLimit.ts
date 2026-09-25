import { useMemo } from 'react';
import { getPlanLimits, getCanonicalPlanConfig } from '@orviohub/shared';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';

export interface UseBranchLimitOptions {
  planKey?: string;
  currentCount?: number;
  branches?: any[];
}

export interface BranchLimitResult {
  maxBranches: number;
  currentBranches: number;
  atLimit: boolean;
  remaining: number;
  isFreeTrial: boolean;
  upgradePlan: 'standard' | 'premium' | 'enterprise' | null;
  planName: string;
  limitMessage: string;
}

/**
 * Hook to retrieve and enforce canonical branch limits across all branch setup and creation components.
 */
export function useBranchLimit(options?: UseBranchLimitOptions): BranchLimitResult {
  const { currentWorkspace, branches: storeBranches } = useWorkspaceStore();

  const resolvedPlanKey = (
    options?.planKey ||
    currentWorkspace?.planKey ||
    'free_trial'
  ).toLowerCase();

  const currentBranches =
    options?.currentCount !== undefined
      ? options.currentCount
      : options?.branches !== undefined
      ? options.branches.length
      : storeBranches?.length || 0;

  return useMemo(() => {
    const limits = getPlanLimits(resolvedPlanKey);
    const planConfig = getCanonicalPlanConfig(resolvedPlanKey);
    const maxBranches = limits.maxBranchesPerApp || 1;
    const isFreeTrial = resolvedPlanKey === 'free_trial' || resolvedPlanKey === 'free';
    const atLimit = currentBranches >= maxBranches;
    const remaining = Math.max(0, maxBranches - currentBranches);

    const upgradePlan: 'standard' | 'premium' | 'enterprise' | null = isFreeTrial
      ? 'standard'
      : resolvedPlanKey === 'standard'
      ? 'premium'
      : resolvedPlanKey === 'premium'
      ? 'enterprise'
      : null;

    const limitMessage = isFreeTrial
      ? `Free Trial organizations are limited to 1 branch. Upgrade to Standard to create up to 3 branches.`
      : atLimit
      ? `You have reached the maximum limit of ${maxBranches} branches on the ${planConfig.name} plan. Upgrade to ${upgradePlan || 'next tier'} for additional branches.`
      : `${remaining} of ${maxBranches} branch slots remaining on ${planConfig.name}.`;

    return {
      maxBranches,
      currentBranches,
      atLimit,
      remaining,
      isFreeTrial,
      upgradePlan,
      planName: planConfig.name,
      limitMessage,
    };
  }, [resolvedPlanKey, currentBranches]);
}
