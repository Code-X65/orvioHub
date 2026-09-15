import React from 'react';

export type PlanTier = 'free_trial' | 'standard' | 'premium';

export interface UserPlanBadgeProps {
  planKey?: string | null;
  status?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showStatus?: boolean;
  className?: string;
}

export const normalizePlanKey = (raw?: string | null, status?: string | null): PlanTier => {
  if (!raw) return 'free_trial';
  const clean = raw.toLowerCase().trim();
  const isPaid = clean === 'premium' || clean.includes('prem') || clean === 'standard' || clean.includes('stand');
  // If status is explicitly provided and is not active (e.g. trialing, pending_payment), fall back to free_trial
  if (isPaid && status && status.toLowerCase().trim() !== 'active') {
    return 'free_trial';
  }
  if (clean === 'premium' || clean.includes('prem')) return 'premium';
  if (clean === 'standard' || clean.includes('stand')) return 'standard';
  return 'free_trial';
};

/**
 * UserPlanBadge: Tier badges on user profiles have been removed as billing and plan tiers
 * are strictly scoped to organizations rather than individual user accounts.
 */
export const UserPlanBadge: React.FC<UserPlanBadgeProps> = () => {
  return null;
};
