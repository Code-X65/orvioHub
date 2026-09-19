import React, { useState } from 'react';

export interface CreateOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  organizationName?: string;
  onSubmit: (data: any) => Promise<void>;
}

export const CreateOverrideModal: React.FC<CreateOverrideModalProps> = ({
  isOpen,
  onClose,
  workspaceId,
  organizationName,
  onSubmit,
}) => {
  const [overrideType, setOverrideType] = useState<string>('entitlement_limit_override');
  const [featureKey, setFeatureKey] = useState<string>('inventory.max_branches');
  const [limitType, setLimitType] = useState<'fixed' | 'unlimited' | 'boolean'>('fixed');
  const [limitValue, setLimitValue] = useState<number>(5);
  const [grantedPlanKey, setGrantedPlanKey] = useState<'standard' | 'premium'>('standard');
  const [extensionDays, setExtensionDays] = useState<number>(14);
  const [grantType, setGrantType] = useState<string>('support_comp');
  const [durationDays, setDurationDays] = useState<number>(30);
  const [isPermanent, setIsPermanent] = useState<boolean>(false);
  const [reason, setReason] = useState<string>('');
  const [customerVisibleReason, setCustomerVisibleReason] = useState<string>('');
  const [supportTicketReference, setSupportTicketReference] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isHighRisk =
    overrideType === 'manual_plan_grant' ||
    overrideType === 'billing_state_correction' ||
    overrideType === 'manual_plan_revoke' ||
    limitType === 'unlimited' ||
    (overrideType === 'manual_plan_grant' && grantedPlanKey === 'premium');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('A mandatory internal administrative reason is required.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const now = Date.now();
      const expiresAt = isPermanent ? undefined : now + durationDays * 24 * 60 * 60 * 1000;

      await onSubmit({
        overrideType,
        featureKey: overrideType === 'manual_plan_grant' ? undefined : featureKey,
        limitType: overrideType === 'entitlement_limit_override' ? limitType : undefined,
        limitValue: overrideType === 'entitlement_limit_override' && limitType === 'fixed' ? Number(limitValue) : undefined,
        grantedPlanKey: overrideType === 'manual_plan_grant' ? grantedPlanKey : undefined,
        extensionDays: overrideType === 'trial_extension' ? Number(extensionDays) : undefined,
        grantType,
        reason,
        customerVisibleReason: customerVisibleReason || undefined,
        supportTicketReference: supportTicketReference || undefined,
        expiresAt,
        requiresApproval: isHighRisk,
      });

      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create override.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Create Custom Override</h3>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg p-1"
            >
              ✕
            </button>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Applying exception for <span className="font-semibold text-slate-700 dark:text-slate-300">{organizationName || workspaceId}</span>
          </p>
        </div>

        {/* High-risk Alert Banner */}
        {isHighRisk && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/60 p-4 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
            <span className="text-base">⚠️</span>
            <div>
              <p className="font-semibold">Dual-Admin Approval Required (High Risk)</p>
              <p className="mt-0.5 opacity-90">
                This action requires approval by a second platform administrator before taking effect. Self-approval is strictly blocked.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 text-xs bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-lg">
              {error}
            </div>
          )}

          {/* Override Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Override Type</label>
            <select
              value={overrideType}
              onChange={(e) => setOverrideType(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="entitlement_limit_override">Resource Limit Override</option>
              <option value="feature_access_override">Feature Access Override</option>
              <option value="trial_extension">Free Trial Extension</option>
              <option value="manual_plan_grant">Manual Plan Grant (Pilot / Partner)</option>
              <option value="billing_state_correction">Manual Billing State Correction</option>
              <option value="support_compensation">Support Compensation Remedy</option>
            </select>
          </div>

          {/* Feature Key (if limit override) */}
          {overrideType === 'entitlement_limit_override' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Target Feature</label>
              <select
                value={featureKey}
                onChange={(e) => setFeatureKey(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="inventory.max_branches">Branches (inventory.max_branches)</option>
                <option value="workspace.max_members">Members (workspace.max_members)</option>
                <option value="inventory.max_products">Products (inventory.max_products)</option>
                <option value="inventory.max_monthly_transactions">Transactions (inventory.max_monthly_transactions)</option>
              </select>
            </div>
          )}

          {/* Limit Value */}
          {overrideType === 'entitlement_limit_override' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Limit Type</label>
                <select
                  value={limitType}
                  onChange={(e: any) => setLimitType(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="fixed">Fixed Numerical Value</option>
                  <option value="unlimited">Unlimited (High Risk)</option>
                </select>
              </div>
              {limitType === 'fixed' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">New Limit Value</label>
                  <input
                    type="number"
                    min="1"
                    value={limitValue}
                    onChange={(e) => setLimitValue(Number(e.target.value))}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}
            </div>
          )}

          {/* Manual Plan Grant options */}
          {overrideType === 'manual_plan_grant' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Granted Plan Tier</label>
              <select
                value={grantedPlanKey}
                onChange={(e: any) => setGrantedPlanKey(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              >
                <option value="standard">Standard Plan</option>
                <option value="premium">Premium Plan (High Risk)</option>
              </select>
            </div>
          )}

          {/* Trial extension days */}
          {overrideType === 'trial_extension' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Additional Days</label>
              <input
                type="number"
                min="1"
                max="90"
                value={extensionDays}
                onChange={(e) => setExtensionDays(Number(e.target.value))}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          {/* Duration / Expiry */}
          {overrideType !== 'trial_extension' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Duration & Expiration</label>
                <label className="text-xs text-slate-500 flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPermanent}
                    onChange={(e) => setIsPermanent(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Permanent / Indefinite
                </label>
              </div>
              {!isPermanent && (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={durationDays}
                    onChange={(e) => setDurationDays(Number(e.target.value))}
                    className="w-28 text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-xs text-slate-500">days from today</span>
                </div>
              )}
            </div>
          )}

          {/* Internal Reason */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Internal Admin Reason <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={2}
              placeholder="e.g. VIP client pilot agreement per ticket #8941"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {/* Customer-Visible Note */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Customer-Visible Notice <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Complimentary branch allowance courtesy of Support"
              value={customerVisibleReason}
              onChange={(e) => setCustomerVisibleReason(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
              Only this note will be shown to the tenant. Internal notes remain private to platform admins.
            </p>
          </div>

          {/* Support Ticket Reference */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Support Ticket Reference <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. TICKET-9821"
              value={supportTicketReference}
              onChange={(e) => setSupportTicketReference(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-4 py-2 text-xs font-medium text-white rounded-lg shadow-sm transition-colors focus:ring-2 focus:outline-none ${
                isHighRisk
                  ? 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500'
                  : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500'
              }`}
            >
              {loading ? 'Creating...' : isHighRisk ? 'Submit for Approval' : 'Activate Override'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
