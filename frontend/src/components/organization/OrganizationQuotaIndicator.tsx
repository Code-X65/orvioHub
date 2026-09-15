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
  const hasOverride = eligibility.override?.active;

  if (variant === 'minimal') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold font-mono border',
          isLimitReached
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
            : 'bg-[#714b67]/20 border-[#714b67]/40 text-[#f0d8e8]',
          className
        )}
      >
        <span>
          {current}/{max} Owned
        </span>
        {hasOverride && <Sparkles className="w-2.5 h-2.5 text-[#FDB02F]" />}
      </span>
    );
  }

  if (variant === 'compact') {
    return (
      <div
        className={cn(
          'flex items-center justify-between px-2.5 py-1.5 rounded bg-[#080608] border text-xs',
          isLimitReached
            ? 'border-amber-500/30 text-amber-200/90'
            : 'border-white/10 text-slate-300',
          className
        )}
      >
        <div className="flex items-center gap-2">
          {isLimitReached ? (
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          ) : (
            <ShieldCheck className="w-3.5 h-3.5 text-[#f0d8e8] shrink-0" />
          )}
          <span className="text-[11px] font-medium">
            Organizations owned: <strong className="text-white font-semibold">{current} of {max}</strong>
          </span>
        </div>

        <span className="text-[10px] font-mono text-slate-400">
          {isLimitReached ? (
            <span className="text-amber-400 font-semibold">Limit reached</span>
          ) : (
            <span>{remaining} slot{remaining === 1 ? '' : 's'} remaining</span>
          )}
        </span>
      </div>
    );
  }

  // Detailed variant
  return (
    <div
      className={cn(
        'p-3 rounded-lg border bg-[#0a0709] space-y-2',
        isLimitReached ? 'border-amber-500/40 bg-amber-500/5' : 'border-white/10',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'w-7 h-7 rounded flex items-center justify-center border',
              isLimitReached
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'bg-[#714b67]/20 border-[#714b67]/40 text-[#f0d8e8]'
            )}
          >
            {isLimitReached ? (
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
            isLimitReached ? 'bg-amber-500' : 'bg-[#714b67]'
          )}
          style={{ width: `${Math.min(100, (current / max) * 100)}%` }}
        />
      </div>

      {isLimitReached ? (
        <p className="text-[11px] text-amber-300/90 leading-relaxed">
          You currently own the maximum of {max} organizations. You can still freely join other businesses by invitation.
        </p>
      ) : (
        <p className="text-[11px] text-slate-400 leading-relaxed">
          You can create {remaining} more owned organization{remaining === 1 ? '' : 's'}. Joined organizations do not consume your creation slots.
        </p>
      )}
    </div>
  );
};
