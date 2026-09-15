import React, { useState } from "react";
import { Ban, AlertTriangle, Loader2, X } from "lucide-react";

interface SuspendModalProps {
  isOpen: boolean;
  targetType: "user" | "organization";
  targetName: string;
  targetId: string;
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: (data: { reason: string; notes: string }) => Promise<void>;
}

export const SuspendModal: React.FC<SuspendModalProps> = ({
  isOpen,
  targetType,
  targetName,
  targetId,
  isLoading = false,
  onClose,
  onConfirm,
}) => {
  const [reason, setReason] = useState("policy_violation");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (reason === "other" && !notes.trim()) {
      setError("Please provide internal notes when selecting 'Other' as the reason.");
      return;
    }

    try {
      await onConfirm({ reason, notes: notes.trim() });
    } catch (err: any) {
      setError(err.message || `Failed to suspend ${targetType}.`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="max-w-lg w-full rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-5 shadow-2xl relative">
        <button
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-5 right-5 text-slate-400 hover:text-white transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl shrink-0 bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <Ban className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">
              Suspend {targetType === "user" ? "User Account" : "Organization"}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Target: <span className="font-semibold text-slate-200">{targetName}</span>{" "}
              <span className="font-mono text-slate-500 text-[10px]">({targetId})</span>
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Primary Reason for Suspension *
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isLoading}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:border-rose-500 outline-none cursor-pointer"
            >
              <option value="policy_violation">Terms of Service / Acceptable Use Policy Violation</option>
              <option value="security_concern">Security Concern / Suspected Account Compromise</option>
              <option value="fraud_suspected">Suspected Fraudulent Activity / Identity Misrepresentation</option>
              <option value="payment_failure">Persistent Payment Failure / Chargeback Dispute</option>
              <option value="other">Other (Specify in internal notes)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Internal Administrator Notes {reason === "other" && <span className="text-rose-400">*</span>}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isLoading}
              rows={3}
              placeholder="Record audit reasoning, investigation references, or support ticket IDs..."
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:border-rose-500 outline-none resize-none"
            />
          </div>

          {/* Impact Statement */}
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] text-slate-400 space-y-1.5">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              Immediate System Impact:
            </span>
            {targetType === "user" ? (
              <p>
                All active web and mobile device sessions will be revoked instantly. The user will be blocked from signing in until an administrator manually reactivates the account.
              </p>
            ) : (
              <p>
                Access to this organization will be immediately halted for all member accounts. Associated apps, branches, and active subscriptions will be suspended.
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              disabled={isLoading}
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-600/30 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Confirm Suspension</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SuspendModal;
