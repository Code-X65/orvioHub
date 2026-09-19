import React from 'react';

export interface EntitlementFeature {
  limit: number | 'unlimited';
  currentUsage: number;
  remaining: number | 'unlimited';
  source: 'plan' | 'override' | 'manual';
  percent?: number;
  warning?: string | null;
  enabled?: boolean;
}

export interface EntitlementContextData {
  workspaceId: string;
  planKey: 'free_trial' | 'standard' | 'premium';
  planName: string;
  isTrial: boolean;
  subscriptionStatus: string;
  entitlementStatus: 'pending' | 'active' | 'restricted' | 'expired' | 'revoked';
  trialEnd?: number | null;
  currentPeriodEnd?: number | null;
  features: Record<string, EntitlementFeature>;
  allowedApplications: string[];
  overrides?: Array<{
    id: string;
    featureKey: string;
    overrideType: string;
    limitValue?: number;
    reason: string;
    expiresAt?: number;
  }>;
  usage: {
    branches: number;
    members: number;
    products: number;
    transactions: number;
    apps: number;
  };
}

/**
 * 1. AdminOverrideBadge Component
 */
export const AdminOverrideBadge: React.FC<{ reason?: string; expiresAt?: number }> = ({ reason, expiresAt }) => {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200 dark:border-purple-700"
      title={reason ? `Support Override: ${reason}${expiresAt ? ` (Expires: ${new Date(expiresAt).toLocaleDateString()})` : ''}` : 'Administrative Override Active'}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
      Custom Limit (Support Granted)
    </span>
  );
};

/**
 * 2. LimitIndicator Component
 */
export const LimitIndicator: React.FC<{
  label: string;
  current: number;
  limit: number | 'unlimited';
  source?: 'plan' | 'override' | 'manual';
  warningThreshold?: number;
}> = ({ label, current, limit, source }) => {
  const isUnlimited = limit === 'unlimited';
  const numericLimit = typeof limit === 'number' ? limit : 0;
  const percent = isUnlimited ? 0 : numericLimit > 0 ? Math.min(100, Math.round((current / numericLimit) * 100)) : 100;
  const isFull = !isUnlimited && current >= numericLimit;
  const isNearLimit = !isUnlimited && percent >= 80;

  return (
    <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
          {source === 'override' && <AdminOverrideBadge />}
        </div>
        <span className="text-sm font-semibold text-gray-900 dark:text-white">
          {current} {isUnlimited ? '/ Unlimited' : `/ ${numericLimit}`}
        </span>
      </div>
      {!isUnlimited && (
        <div className="w-full bg-gray-100 dark:bg-gray-800 h-2 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              isFull ? 'bg-red-500' : isNearLimit ? 'bg-amber-500' : 'bg-primary-600'
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
    </div>
  );
};

/**
 * 3. TrialStatusBanner Component
 */
export const TrialStatusBanner: React.FC<{
  trialEnd?: number | null;
  onUpgradeClick?: () => void;
}> = ({ trialEnd, onUpgradeClick }) => {
  const now = Date.now();
  const daysRemaining = trialEnd ? Math.max(0, Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24))) : 30;

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/40 p-4 mb-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
          {daysRemaining}d
        </div>
        <div>
          <h4 className="text-sm font-semibold text-blue-950 dark:text-blue-100">
            Free Trial Active ({daysRemaining} days remaining)
          </h4>
          <p className="text-xs text-blue-700 dark:text-blue-300">
            You are exploring the Inventory MVP on a 30-day Free Trial. Upgrade anytime to unlock higher limits.
          </p>
        </div>
      </div>
      {onUpgradeClick && (
        <button
          onClick={onUpgradeClick}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
        >
          Upgrade Plan
        </button>
      )}
    </div>
  );
};

/**
 * 4. BillingRestrictionBanner Component
 */
export const BillingRestrictionBanner: React.FC<{
  status: string;
  onManageBilling?: () => void;
}> = ({ status, onManageBilling }) => {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/40 p-4 mb-4 flex items-center justify-between">
      <div>
        <h4 className="text-sm font-bold text-red-900 dark:text-red-200">
          Account Status: {status === 'past_due' ? 'Payment Past Due' : 'Entitlements Restricted'}
        </h4>
        <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">
          New resource creation is temporarily paused. Your existing data is preserved safely. Update payment to restore full access.
        </p>
      </div>
      {onManageBilling && (
        <button
          onClick={onManageBilling}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
        >
          Manage Billing
        </button>
      )}
    </div>
  );
};

/**
 * 5. LimitReachedModal Component
 */
export const LimitReachedModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  resourceName: string;
  current: number;
  limit: number;
  upgradePlan?: string;
  onUpgrade?: () => void;
}> = ({ isOpen, onClose, resourceName, current, limit, upgradePlan = 'Standard', onUpgrade }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-200 dark:border-gray-800">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
          Limit Reached for {resourceName}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          You have reached your {resourceName.toLowerCase()} limit. Current usage: {current} of {limit}.
          Upgrade to {upgradePlan} to create more {resourceName.toLowerCase()}.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          >
            Cancel
          </button>
          {onUpgrade && (
            <button
              onClick={() => {
                onClose();
                onUpgrade();
              }}
              className="px-4 py-2 text-sm font-semibold bg-primary-600 hover:bg-primary-700 text-white rounded-lg"
            >
              Upgrade to {upgradePlan}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * 6. ConflictList Component
 */
export const ConflictList: React.FC<{
  conflicts: Array<{ resourceType: string; currentCount: number; targetLimit: number; excess: number; message: string }>;
}> = ({ conflicts }) => {
  if (!conflicts || conflicts.length === 0) return null;

  return (
    <div className="space-y-2 mt-3">
      {conflicts.map((c, idx) => (
        <div key={idx} className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-xs">
          <p className="font-semibold text-amber-900 dark:text-amber-200">{c.message}</p>
          <p className="text-amber-700 dark:text-amber-300 mt-1">
            Current: {c.currentCount} | New Limit: {c.targetLimit} (Excess: {c.excess})
          </p>
        </div>
      ))}
    </div>
  );
};

/**
 * 7. UsageSummary Component
 */
export const UsageSummary: React.FC<{
  context: EntitlementContextData;
  onUpgradeClick?: () => void;
}> = ({ context, onUpgradeClick }) => {
  const branchFeat = context.features['inventory.max_branches'];
  const memberFeat = context.features['workspace.max_members'];

  return (
    <div className="space-y-4">
      {context.isTrial && <TrialStatusBanner trialEnd={context.trialEnd} onUpgradeClick={onUpgradeClick} />}
      {context.entitlementStatus === 'restricted' && (
        <BillingRestrictionBanner status={context.subscriptionStatus} />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {branchFeat && (
          <LimitIndicator
            label="Operating Branches"
            current={branchFeat.currentUsage}
            limit={branchFeat.limit}
            source={branchFeat.source}
          />
        )}
        {memberFeat && (
          <LimitIndicator
            label="Team Members"
            current={memberFeat.currentUsage}
            limit={memberFeat.limit}
            source={memberFeat.source}
          />
        )}
      </div>
    </div>
  );
};
