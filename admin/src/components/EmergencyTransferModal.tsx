import React, { useState } from "react";
import { UserCheck, AlertTriangle, Loader2 } from "lucide-react";

interface Member {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
}

interface EmergencyTransferModalProps {
  isOpen: boolean;
  workspaceName: string;
  currentOwnerName?: string;
  members: Member[];
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: (targetUserId: string, reason: string, ticketNumber?: string) => Promise<void>;
}

export const EmergencyTransferModal: React.FC<EmergencyTransferModalProps> = ({
  isOpen,
  workspaceName,
  currentOwnerName,
  members,
  isLoading = false,
  onClose,
  onConfirm,
}) => {
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [ticketNumber, setTicketNumber] = useState<string>("");
  const [confirmationPhrase, setConfirmationPhrase] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const targetPhrase = "TRANSFER OWNERSHIP";
  const isValid =
    selectedUserId.trim() !== "" &&
    reason.trim().length >= 10 &&
    confirmationPhrase.trim().toUpperCase() === targetPhrase;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setError(null);
    try {
      await onConfirm(selectedUserId, reason.trim(), ticketNumber.trim() || undefined);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to transfer ownership.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border border-amber-500/30 rounded-2xl p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Emergency Ownership Recovery</h3>
              <p className="text-xs text-slate-400">Break-glass tenant owner reassignment</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-slate-400 hover:text-white p-1 text-xs cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Warning Banner */}
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-200/90 leading-relaxed space-y-1">
            <p className="font-semibold text-amber-300">Privileged Superadmin Action</p>
            <p>
              Reassigning ownership of <span className="font-bold text-white">"{workspaceName}"</span> demotes the current owner (
              <span className="font-medium text-white">{currentOwnerName || "Unknown"}</span>) to Admin and grants full legal, billing, and organizational authority to the designated member.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">
              Select New Owner <span className="text-rose-400">*</span>
            </label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500"
              required
            >
              <option value="">-- Choose active team member --</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name} ({m.email}) - {m.role}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">
                Support Ticket / Reference #
              </label>
              <input
                type="text"
                placeholder="e.g. TICKET-94812"
                value={ticketNumber}
                onChange={(e) => setTicketNumber(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">
                Confirmation Phrase <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                placeholder="Type TRANSFER OWNERSHIP"
                value={confirmationPhrase}
                onChange={(e) => setConfirmationPhrase(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 font-mono"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">
              Recovery Justification / Audit Reason <span className="text-rose-400">*</span>
            </label>
            <textarea
              rows={3}
              placeholder="Detail the verified customer authorization, account recovery request, or legal transfer rationale (min 10 characters)..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isValid || isLoading}
              className={`px-4 py-2 rounded-xl text-white font-semibold transition flex items-center gap-2 ${
                isValid && !isLoading
                  ? "bg-amber-600 hover:bg-amber-500 shadow-lg shadow-amber-600/30 cursor-pointer"
                  : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50"
              }`}
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Authorize Ownership Reassignment</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmergencyTransferModal;
