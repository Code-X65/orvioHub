import React from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FreeTrialLimitNoticeProps {
  organizationName?: string;
  className?: string;
}

export const FreeTrialLimitNotice: React.FC<FreeTrialLimitNoticeProps> = ({
  organizationName,
  className = '',
}) => {
  return (
    <div
      className={cn(
        'p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-left space-y-2',
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
