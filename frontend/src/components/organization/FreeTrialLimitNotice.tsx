import React from 'react';
import { AlertCircle, AlertTriangle, ArrowRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FreeTrialLimitNoticeProps {
  organizationName?: string;
  className?: string;
  variant?: 'already_used' | 'plan_limits' | 'branch_limit';
  onUpgrade?: () => void;
}

export const FreeTrialLimitNotice: React.FC<FreeTrialLimitNoticeProps> = ({
  organizationName,
  className = '',
  variant = 'already_used',
  onUpgrade,
}) => {
  if (variant === 'plan_limits') {
    return (
      <div
        className={cn(
          'p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-left space-y-3',
          className
        )}
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1.5 flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <p className="text-xs font-bold text-amber-200 uppercase tracking-wide">
                Free Trial Architecture &amp; Constraint Notice
              </p>
              <span className="text-[10px] font-semibold text-amber-400/90 bg-amber-500/20 px-2 py-0.5 rounded-full w-fit">
                1 App &bull; 1 Branch &bull; 2 Members
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Choosing the Free Trial configures your organization with a maximum quota of{' '}
              <strong className="text-white">1 active application</strong> and{' '}
              <strong className="text-white">1 branch location</strong>. If your enterprise manages multiple stores, warehouses, or more than 2 team members, consider selecting the{' '}
              <span className="text-amber-200 font-semibold">Standard Plan</span> now to avoid reconfiguration.
            </p>
            {onUpgrade && (
              <button
                type="button"
                onClick={onUpgrade}
                className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-[#f0d8e8] hover:text-white underline underline-offset-4 cursor-pointer"
              >
                <span>Switch to Standard Plan (3 Branches &amp; 10 Members)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'branch_limit') {
    return (
      <div
        className={cn(
          'p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-left space-y-2',
          className
        )}
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1 flex-1">
            <p className="text-xs font-bold text-amber-200">
              Branch Creation Limit Reached (Free Trial)
            </p>
            <p className="text-xs text-slate-300 leading-relaxed">
              Organizations on the 30-Day Free Trial are limited to 1 operational branch location. Upgrade to Standard to add multiple branches, regional stores, and warehouse transfers.
            </p>
            {onUpgrade && (
              <button
                type="button"
                onClick={onUpgrade}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#FDB02F]" />
                <span>Upgrade to Standard</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-left space-y-2',
        className
      )}
    >
      <div className="flex items-start gap-2.5">
        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-xs font-semibold text-amber-200">
            Free Trial Already Used
          </p>
          <p className="text-xs text-slate-300 leading-relaxed">
            You already have an organization on Free Trial
            {organizationName ? ` (${organizationName})` : ''}. Each Orviohub account is eligible for 1 Free Trial organization.
          </p>
          <p className="text-[11px] text-amber-300/80 font-medium">
            To create this additional organization, please select the <span className="underline font-semibold">Standard Plan</span> below.
          </p>
        </div>
      </div>
    </div>
  );
};
