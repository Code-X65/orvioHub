import React, { useState } from "react";
import { Trash2, AlertTriangle, Loader2, X, Clock, Zap } from "lucide-react";

interface DeleteModalProps {
  isOpen: boolean;
  targetType: "user" | "organization";
  targetName: string;
  targetId: string;
  ownedWorkspacesCount?: number;
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: (options: {
    reason?: string;
    notes?: string;
    transferWorkspaceOwnership?: boolean;
    newOwnerId?: string;
    cancelSubscriptions?: boolean;
    adminForceDelete?: boolean;
  }) => Promise<void>;
}

export const DeleteModal: React.FC<DeleteModalProps> = ({
  isOpen,
  targetType,
  targetName,
  targetId,
  ownedWorkspacesCount = 0,
  isLoading = false,
  onClose,
  onConfirm,
}) => {
  const [reason, setReason] = useState("admin_action");
  const [notes, setNotes] = useState("");
  const [cancelSubscriptions, setCancelSubscriptions] = useState(true);
  const [adminForceDelete, setAdminForceDelete] = useState(false);
  const [transferOwnership, setTransferOwnership] = useState(false);
  const [newOwnerId, setNewOwnerId] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (confirmText.trim().toUpperCase() !== "DELETE") {
      setError("Please type DELETE to confirm this operation.");
      return;
    }

    if (transferOwnership && !newOwnerId.trim()) {
      setError("Please specify the New Owner User ID to transfer workspace ownership.");
      return;
    }

    try {
      await onConfirm({
        reason,
        notes: notes.trim() || undefined,
        cancelSubscriptions,
        adminForceDelete,
        transferWorkspaceOwnership: transferOwnership,
        newOwnerId: transferOwnership ? newOwnerId.trim() : undefined,
      });
    } catch (err: any) {
      setError(err.message || `Failed to delete ${targetType}.`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="max-w-lg w-full rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-5 right-5 text-slate-400 hover:text-white transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl shrink-0 bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <Trash2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">
              Permanently Delete {targetType === "user" ? "User Account" : "Organization"}
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

        {/* Owned Workspaces Warning */}
        {targetType === "user" && ownedWorkspacesCount > 0 && (
          <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/30 space-y-2 text-xs">
            <div className="flex items-center gap-2 text-amber-300 font-semibold">
              <AlertTriangle className="w-4 h-4" />
              <span>Workspace Ownership Alert</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              This user is the registered owner of <strong className="text-white">{ownedWorkspacesCount}</strong> organization(s).
              To preserve business data, transfer ownership or the organization will become ownerless.
            </p>

            <label className="flex items-center gap-2 pt-1 text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={transferOwnership}
                onChange={(e) => setTransferOwnership(e.target.checked)}
                className="accent-brand-500 rounded"
              />
              <span className="text-[11px] font-medium">Transfer workspace ownership to another user</span>
            </label>

            {transferOwnership && (
              <div className="pt-1">
                <input
                  type="text"
                  value={newOwnerId}
                  onChange={(e) => setNewOwnerId(e.target.value)}
                  placeholder="Enter New Owner User ID..."
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white outline-none focus:border-brand-500 font-mono"
                />
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Deletion Mode Selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 block">Deletion Execution Mode</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAdminForceDelete(false)}
                className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                  !adminForceDelete
                    ? "bg-brand-500/10 border-brand-500/40 text-brand-300"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-white">
                  <Clock className="w-3.5 h-3.5 text-brand-400" />
                  <span>7-Day Grace Period</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                  NDPA compliant cooling-off window. Reversible via admin or user token.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setAdminForceDelete(true)}
                className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                  adminForceDelete
                    ? "bg-rose-500/10 border-rose-500/40 text-rose-300"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-white">
                  <Zap className="w-3.5 h-3.5 text-rose-400" />
                  <span>Immediate Force Delete</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                  Emergency purge. Bypasses 7-day grace period. Irreversible.
                </p>
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Deletion Reason</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:border-rose-500 outline-none cursor-pointer"
            >
              <option value="admin_action">Superadmin Administrative Action</option>
              <option value="gdpr_ndpa_erasure">NDPA 2023 / Right to Erasure Request</option>
              <option value="fraud_or_abuse">Severe Fraud, Security, or Platform Abuse</option>
              <option value="non_payment">Permanent Non-Payment & Abandonment</option>
              <option value="user_request">User Formal Request</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Administrative Notes (Optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Case summary or legal tracking ID..."
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:border-rose-500 outline-none resize-none"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={cancelSubscriptions}
              onChange={(e) => setCancelSubscriptions(e.target.checked)}
              className="accent-rose-500 rounded"
            />
            <span>Automatically cancel active billing subscriptions and pending charges</span>
          </label>

          {/* Type DELETE to confirm */}
          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-semibold text-rose-300">
              Type <span className="font-mono font-bold">DELETE</span> to confirm *
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-rose-500/40 text-xs text-white outline-none focus:border-rose-400 font-mono"
            />
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
              disabled={isLoading || confirmText.trim().toUpperCase() !== "DELETE"}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-600/30 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{adminForceDelete ? "Permanently Force Delete" : "Schedule Deletion (7-Day Grace)"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DeleteModal;
