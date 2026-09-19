import React from 'react';

export interface UserSafeOverrideNoticeProps {
  customerVisibleReason?: string;
  expiresAt?: number;
  planName?: string;
  isManualGrant?: boolean;
}

export const UserSafeOverrideNotice: React.FC<UserSafeOverrideNoticeProps> = ({
  customerVisibleReason,
  expiresAt,
  planName,
  isManualGrant = false,
}) => {
  if (!customerVisibleReason && !isManualGrant) return null;

  const formatExpiry = (timestamp?: number) => {
    if (!timestamp) return 'Indefinite duration';
    const d = new Date(timestamp);
    return `Active until ${d.toLocaleDateString()} (${Math.ceil((timestamp - Date.now()) / (1000 * 60 * 60 * 24))} days remaining)`;
  };

  return (
    <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-r from-indigo-50/80 via-blue-50/60 to-purple-50/80 dark:from-indigo-950/40 dark:via-blue-950/30 dark:to-purple-950/40 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-indigo-600/10 dark:bg-indigo-400/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-sm">
          ✨
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-200">
              {isManualGrant ? `Special ${planName || 'Plan'} Access Active` : 'Custom Feature Allowance Active'}
            </h4>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
              Granted
            </span>
          </div>
          <p className="text-xs text-slate-700 dark:text-slate-300 mt-1">
            {customerVisibleReason || 'You have been granted custom platform allowances by our customer support team.'}
          </p>
          {expiresAt && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 flex items-center gap-1 font-medium">
              <span>🕒</span>
              <span>{formatExpiry(expiresAt)}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
