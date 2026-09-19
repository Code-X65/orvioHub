import React, { useState } from 'react';
import type { OverrideItem } from './OverrideList';

export interface OverrideApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  override: OverrideItem | null;
  currentAdminId: string;
  onApprove: (data: { overrideId: string; reason?: string; totpCode?: string }) => Promise<void>;
  onReject: (data: { overrideId: string; rejectionReason: string }) => Promise<void>;
}

export const OverrideApprovalModal: React.FC<OverrideApprovalModalProps> = ({
  isOpen,
  onClose,
  override,
  currentAdminId,
  onApprove,
  onReject,
}) => {
  const [mode, setMode] = useState<'approve' | 'reject'>('approve');
  const [reason, setReason] = useState<string>('');
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [totpCode, setTotpCode] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !override) return null;

  const isSelf = String(override.createdByAdminId) === String(currentAdminId);
  const isHighRisk =
    override.overrideType === 'manual_plan_grant' ||
    override.overrideType === 'billing_state_correction' ||
    override.limitType === 'unlimited' ||
    override.grantedPlanKey === 'premium';

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSelf) {
      setError('Self-approval is strictly forbidden. A separate administrator must approve this override.');
      return;
    }
    if (isHighRisk && !totpCode.trim()) {
      setError('Second-factor TOTP verification is required to approve high-risk overrides.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await onApprove({
        overrideId: override.id || override._id || '',
        reason,
        totpCode,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Approval failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectionReason.trim()) {
      setError('A mandatory rejection reason must be provided.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await onReject({
        overrideId: override.id || override._id || '',
        rejectionReason,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Rejection failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              {mode === 'approve' ? 'Review & Approve Override' : 'Reject Override'}
            </h3>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg p-1"
            >
              ✕
            </button>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Type: <span className="font-mono text-indigo-600 dark:text-indigo-400">{override.overrideType}</span>
          </p>
        </div>

        {/* Self-approval Warning */}
        {isSelf && (
          <div className="bg-rose-50 dark:bg-rose-950/40 border-b border-rose-200 dark:border-rose-900/60 p-4 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2.5">
            <span className="text-base">🚫</span>
            <div>
              <p className="font-semibold">Dual-Admin Separation Enforced</p>
              <p className="mt-0.5 opacity-90">
                You created this override request. Governance policy requires a different platform administrator to review and approve it.
              </p>
            </div>
          </div>
        )}

        {/* Override Detail Card */}
        <div className="p-4 mx-6 mt-4 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs space-y-1.5">
          <div className="flex justify-between text-slate-600 dark:text-slate-400">
            <span>Requested By:</span>
            <span className="font-mono text-slate-800 dark:text-slate-200">{override.createdByAdminId}</span>
          </div>
          <div className="flex justify-between text-slate-600 dark:text-slate-400">
            <span>Justification:</span>
            <span className="font-medium text-slate-800 dark:text-slate-200 max-w-[200px] truncate text-right">
              {override.reason}
            </span>
          </div>
          {override.supportTicketReference && (
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Ticket Ref:</span>
              <span className="font-mono text-indigo-600 dark:text-indigo-400">{override.supportTicketReference}</span>
            </div>
          )}
        </div>

        {/* Toggle Mode Buttons */}
        <div className="px-6 pt-4 flex gap-2">
          <button
            type="button"
            onClick={() => { setMode('approve'); setError(null); }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
              mode === 'approve'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
            }`}
          >
            Approve
          </button>
          <button
            type="button"
            onClick={() => { setMode('reject'); setError(null); }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
              mode === 'reject'
                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
            }`}
          >
            Reject
          </button>
        </div>

        {mode === 'approve' ? (
          <form onSubmit={handleApprove} className="p-6 space-y-4">
            {error && (
              <div className="p-3 text-xs bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-lg">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Approval Note <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <textarea
                rows={2}
                placeholder="Review notes or approval confirmation..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            {isHighRisk && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  TOTP Second-Factor Code <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  placeholder="6-digit authenticator code"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  className="w-full text-xs px-3 py-2 font-mono tracking-widest text-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || isSelf}
                className="px-4 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-colors"
              >
                {loading ? 'Approving...' : 'Confirm Approval'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleReject} className="p-6 space-y-4">
            {error && (
              <div className="p-3 text-xs bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-lg">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Rejection Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                placeholder="Explain why this override is being rejected..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-colors"
              >
                {loading ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
