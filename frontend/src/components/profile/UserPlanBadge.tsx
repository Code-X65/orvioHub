import React from 'react';
import { Sparkles, ShieldCheck, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';

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

export const UserPlanBadge: React.FC<UserPlanBadgeProps> = ({
  planKey,
  status,
  size = 'sm',
  showIcon = true,
  showStatus = false,
  className,
}) => {
  const tier = normalizePlanKey(planKey, status);

  // Size configurations
  const sizeStyles = {
    xs: {
      container: 'px-1.5 py-0.5 text-[10px] gap-1 rounded-sm',
      icon: 'w-3 h-3',
    },
    sm: {
      container: 'px-2.5 py-0.5 text-xs gap-1.5 rounded-sm font-medium',
      icon: 'w-3.5 h-3.5',
    },
    md: {
      container: 'px-3 py-1 text-xs gap-2 rounded-sm font-semibold tracking-wide',
      icon: 'w-4 h-4',
    },
    lg: {
      container: 'px-3.5 py-1.5 text-sm gap-2.5 rounded-sm font-bold tracking-wide',
      icon: 'w-5 h-5',
    },
  }[size];

  // Tier specific styles & metadata
  const tierConfig = {
    free_trial: {
      label: 'Free Trial',
      icon: Sparkles,
      containerClasses:
        'bg-amber-500/10 text-amber-300 border border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.12)] hover:bg-amber-500/15 transition-colors',
      iconClass: 'text-amber-400',
    },
    standard: {
      label: 'Standard',
      icon: ShieldCheck,
      containerClasses:
        'bg-[#714b67]/25 text-[#f3d7ee] border border-[#714b67]/50 shadow-[0_0_12px_rgba(113,75,103,0.18)] hover:bg-[#714b67]/35 transition-colors',
      iconClass: 'text-[#e5b7de]',
    },
    premium: {
      label: 'Premium',
      icon: Crown,
      containerClasses:
        'bg-gradient-to-r from-amber-500/20 via-yellow-400/15 to-amber-500/20 text-amber-200 border border-amber-400/50 shadow-[0_0_16px_rgba(251,191,36,0.22)] hover:border-amber-300/70 transition-all',
      iconClass: 'text-yellow-300 drop-shadow-[0_0_4px_rgba(253,224,71,0.5)]',
    },
  }[tier];

  const Icon = tierConfig.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center select-none font-medium shrink-0',
        sizeStyles.container,
        tierConfig.containerClasses,
        className
      )}
      title={`User Plan: ${tierConfig.label}${status ? ` (${status})` : ''}`}
    >
      {showIcon && <Icon className={cn(sizeStyles.icon, tierConfig.iconClass, 'shrink-0')} />}
      <span className="capitalize">{tierConfig.label}</span>
      {showStatus && status && (
        <span className="text-[10px] opacity-75 font-normal border-l border-white/20 pl-1.5 capitalize">
          {status}
        </span>
      )}
    </span>
  );
};
