import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Lock, ShieldCheck, Loader2, X } from 'lucide-react';
import { StaffMember } from './TransferStaffModal';

interface SuspendStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  member: StaffMember | null;
  onSuccess: () => void;
}

export const SuspendStaffModal: React.FC<SuspendStaffModalProps> = ({
  isOpen,
  onClose,
  workspaceId,
  member,
  onSuccess,
}) => {
  const [reason, setReason] = useState('');
  const [suspendAllBranches, setSuspendAllBranches] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !member) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.post(`/workspaces/${workspaceId}/applications/inventory/members/${member.id}/suspend`, {
        reason: reason.trim() || undefined,
        suspendAllBranches,
      });

      toast.success(
        suspendAllBranches
          ? `Suspended all Inventory access for ${member.user?.name || 'staff member'}.`
          : `Suspended access for ${member.user?.name || 'staff member'} on ${member.branchName}.`
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to suspend staff member');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-xl bg-slate-900 border border-slate-800 text-white max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Lock className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Suspend Branch Access</h3>
              <p className="text-xs text-slate-400">
                Temporarily pause this staff member's ability to operate in this store.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Member info preview */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-amber-600 to-amber-700 flex items-center justify-center font-bold text-white text-xs shrink-0">
              {member.user?.name?.[0] || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm text-white truncate">{member.user?.name || 'Staff User'}</p>
              <p className="text-xs text-slate-400 truncate">{member.user?.email}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-slate-400">Branch: <strong className="text-slate-200">{member.branchName}</strong></span>
                <span className="text-[10px] text-slate-400">• Role: <strong className="text-slate-200 uppercase">{member.role.replace('_', ' ')}</strong></span>
              </div>
            </div>
          </div>

          {/* Reason Input */}
          <div className="space-y-2">
            <Label htmlFor="suspend-reason" className="text-xs font-semibold text-slate-300">
              Reason for Suspension (Required for audit logs)
            </Label>
            <Input
              id="suspend-reason"
              placeholder="e.g. Extended leave of absence / security review"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="bg-slate-950/60 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-amber-500 text-xs"
              required
            />
          </div>

          {/* Suspend All Branches Checkbox */}
          <div className="flex items-center gap-2.5 p-3 rounded-lg bg-slate-950/40 border border-slate-800/80">
            <input
              type="checkbox"
              id="suspend-all-branches"
              checked={suspendAllBranches}
              onChange={(e) => setSuspendAllBranches(e.target.checked)}
              className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500/20 cursor-pointer"
            />
            <Label htmlFor="suspend-all-branches" className="text-xs text-slate-300 cursor-pointer select-none">
              Suspend across <strong>all</strong> Inventory branches in this workspace
            </Label>
          </div>

          {/* Safety & Preservation Notice */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2 text-xs text-amber-200/90">
            <div className="flex items-center gap-2 font-semibold text-amber-300">
              <ShieldCheck className="w-4 h-4 shrink-0 text-amber-400" />
              <span>Safety & Record Preservation Guarantee</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-200/80">
              <li>Workspace membership remains fully intact.</li>
              <li>Historical sales, receipts, and stock ledger entries remain attributed to this user.</li>
              <li>Access can be restored immediately at any time without data loss.</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !reason.trim()}
              className="bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs gap-2"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Confirm Suspension
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
