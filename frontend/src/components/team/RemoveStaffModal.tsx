import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Trash2, ShieldCheck, Loader2, X } from 'lucide-react';
import { StaffMember } from './TransferStaffModal';

interface RemoveStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  member: StaffMember | null;
  onSuccess: () => void;
}

export const RemoveStaffModal: React.FC<RemoveStaffModalProps> = ({
  isOpen,
  onClose,
  workspaceId,
  member,
  onSuccess,
}) => {
  const [scope, setScope] = useState<'branch' | 'inventory'>('branch');
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !member) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmed) {
      toast.error('Please confirm understanding of removal effects.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (scope === 'inventory') {
        await api.delete(`/workspaces/${workspaceId}/applications/inventory/members/${member.id}/inventory`, {
          data: { reason: reason.trim() || undefined },
        });
        toast.success(`Removed ${member.user?.name || 'staff member'} from Inventory application.`);
      } else {
        await api.delete(`/workspaces/${workspaceId}/applications/inventory/members/${member.id}`, {
          data: { reason: reason.trim() || undefined },
        });
        toast.success(`Removed ${member.user?.name || 'staff member'} from ${member.branchName}.`);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove staff member');
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
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Remove Staff Access</h3>
              <p className="text-xs text-slate-400">
                Revoke access while safely preserving workspace membership and historical logs.
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
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-rose-600 to-rose-700 flex items-center justify-center font-bold text-white text-xs shrink-0">
              {member.user?.name?.[0] || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm text-white truncate">{member.user?.name || 'Staff User'}</p>
              <p className="text-xs text-slate-400 truncate">{member.user?.email}</p>
              <p className="text-[10px] text-slate-400 mt-1">
                Current Branch: <strong className="text-slate-200">{member.branchName}</strong>
              </p>
            </div>
          </div>

          {/* Removal Scope Selector */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-slate-300">Choose Removal Scope</Label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setScope('branch')}
                className={`p-3 rounded-lg border text-left transition ${
                  scope === 'branch'
                    ? 'border-rose-500/50 bg-rose-500/10 text-white'
                    : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:bg-slate-900'
                }`}
              >
                <p className="font-semibold text-xs text-white">From This Branch Only</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Revokes access to {member.branchName}</p>
              </button>

              <button
                type="button"
                onClick={() => setScope('inventory')}
                className={`p-3 rounded-lg border text-left transition ${
                  scope === 'inventory'
                    ? 'border-rose-500/50 bg-rose-500/10 text-white'
                    : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:bg-slate-900'
                }`}
              >
                <p className="font-semibold text-xs text-white">From Entire Inventory</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Revokes all inventory branches</p>
              </button>
            </div>
          </div>

          {/* Reason Input */}
          <div className="space-y-2">
            <Label htmlFor="remove-reason" className="text-xs font-semibold text-slate-300">
              Reason for Removal (Optional)
            </Label>
            <Input
              id="remove-reason"
              placeholder="e.g. End of contract / Role reorganization"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="bg-slate-950/60 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-rose-500 text-xs"
            />
          </div>

          {/* Safety & Preservation Notice */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs">
            <div className="flex items-center gap-2 font-semibold text-emerald-400">
              <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>Workspace Preservation & Historical Audit Safeguards</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-400">
              <li>The user account and workspace membership are <strong>never deleted</strong>.</li>
              <li>Other workspace applications (POS, Invoicing, etc.) remain untouched.</li>
              <li>All historical sales transactions, stock movement records, and cashier receipts remain attributed to this user.</li>
            </ul>
          </div>

          {/* Confirmation Checkbox */}
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-rose-500/5 border border-rose-500/20">
            <input
              type="checkbox"
              id="confirm-removal"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded border-rose-500/40 bg-slate-900 text-rose-500 focus:ring-rose-500/20 cursor-pointer"
            />
            <Label htmlFor="confirm-removal" className="text-xs text-rose-200/90 cursor-pointer select-none">
              I understand that {member.user?.name || 'this member'} will lose inventory access immediately according to the selected scope.
            </Label>
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
              disabled={isSubmitting || !confirmed}
              className="bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs gap-2"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Remove Access
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
