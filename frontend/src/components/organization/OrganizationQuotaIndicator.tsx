import React from 'react';
import { ShieldCheck, AlertTriangle, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OrganizationCreationEligibility } from '@/hooks/useOrganizationEligibility';

interface OrganizationQuotaIndicatorProps {
  eligibility: OrganizationCreationEligibility;
  className?: string;
  variant?: 'compact' | 'detailed' | 'minimal';
}

export const OrganizationQuotaIndicator: React.FC<OrganizationQuotaIndicatorProps> = ({
  eligibility,
  className = '',
  variant = 'compact',
}) => {
  const current = eligibility.currentOwned ?? eligibility.currentOwnedOrganizations ?? 0;
  const max = eligibility.maximumOwned ?? eligibility.maximumOwnedOrganizations ?? 3;
  const remaining = eligibility.remainingOwned ?? eligibility.remainingOwnedOrganizations ?? Math.max(max - current, 0);
  const isLimitReached = !eligibility.canCreate || current >= max;
  const isApproachingLimit = !isLimitReached && remaining <= 1;
  const hasOverride = eligibility.override?.active;

  if (variant === 'minimal') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold font-mono border',
          isLimitReached
            ? 'bg-red-500/10 border-red-500/30 text-red-300'
            : isApproachingLimit
            ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
            : 'bg-[#714b67]/20 border-[#714b67]/40 text-[#f0d8e8]',
          className
        )}
      >
        <span>
          {isApproachingLimit ? `⚠️ ${current}/${max} (1 slot left)` : `${current}/${max} Owned`}
        </span>
        {hasOverride && <Sparkles className="w-2.5 h-2.5 text-[#FDB02F]" />}
      </span>
    );
  }

  if (variant === 'compact') {
    return (
      <div
        className={cn(
          'flex items-center justify-between px-2.5 py-1.5 rounded-xl border text-xs transition-all',
          isLimitReached
            ? 'border-red-500/30 bg-red-500/10 text-red-200'
            : isApproachingLimit
            ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
            : 'border-white/10 bg-[#080608] text-slate-300',
          className
        )}
      >
        <div className="flex items-center gap-2">
          {isLimitReached ? (
            <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
          ) : isApproachingLimit ? (
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          ) : (
            <ShieldCheck className="w-3.5 h-3.5 text-[#f0d8e8] shrink-0" />
          )}
          <span className="text-[11px] font-medium">
            {isApproachingLimit ? (
              <span className="font-semibold text-amber-300">
                ⚠️ {current} of {max} — {remaining} remaining
              </span>
            ) : (
              <span>
                Organizations owned: <strong className="text-white font-semibold">{current} of {max}</strong>
              </span>
            )}
          </span>
        </div>

        <span className="text-[10px] font-mono">
          {isLimitReached ? (
            <span className="text-red-400 font-semibold">Limit reached</span>
          ) : isApproachingLimit ? (
            <span className="text-amber-400 font-semibold">Approaching limit</span>
          ) : (
            <span className="text-slate-400">{remaining} slot{remaining === 1 ? '' : 's'} remaining</span>
          )}
        </span>
      </div>
    );
  }

  // Detailed variant
  return (
    <div
      className={cn(
        'p-3 rounded-xl border bg-[#0a0709] space-y-2',
        isLimitReached
          ? 'border-red-500/40 bg-red-500/5'
          : isApproachingLimit
          ? 'border-amber-500/40 bg-amber-500/10'
          : 'border-white/10',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'w-7 h-7 rounded-lg flex items-center justify-center border',
              isLimitReached
                ? 'bg-red-500/20 border-red-500/40 text-red-300'
                : isApproachingLimit
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'bg-[#714b67]/20 border-[#714b67]/40 text-[#f0d8e8]'
            )}
          >
            {isLimitReached || isApproachingLimit ? (
              <AlertTriangle className="w-4 h-4" />
            ) : (
              <ShieldCheck className="w-4 h-4" />
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-white">Organization Ownership Quota</p>
            <p className="text-[10px] text-slate-400">
              {current} of {max} organizations created & owned
            </p>
          </div>
        </div>

        <span
          className={cn(
            'px-2 py-0.5 rounded text-[11px] font-mono font-bold border',
            isLimitReached
              ? 'bg-red-500/20 border-red-500/30 text-red-300'
              : isApproachingLimit
              ? 'bg-amber-500/20 border-amber-500/30 text-amber-300'
              : 'bg-white/5 border-white/10 text-white'
          )}
        >
          {remaining} left
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300',
            isLimitReached
              ? 'bg-red-500'
              : isApproachingLimit
              ? 'bg-amber-500'
              : 'bg-[#714b67]'
          )}
          style={{ width: `${Math.min(100, (current / max) * 100)}%` }}
        />
      </div>

      {isLimitReached ? (
        <p className="text-[11px] text-red-300/90 leading-relaxed">
          You currently own the maximum of {max} organizations. You can still freely join other businesses by invitation.
        </p>
      ) : isApproachingLimit ? (
        <p className="text-[11px] text-amber-300/90 leading-relaxed">
          ⚠️ Approaching ownership quota: You have used {current} of {max} organization creation slots ({remaining} slot remaining).
        </p>
      ) : (
        <p className="text-[11px] text-slate-400 leading-relaxed">
          You can create {remaining} more owned organization{remaining === 1 ? '' : 's'}. Joined organizations do not consume your creation slots.
        </p>
      )}
    </div>
  );
};
