import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import {
  ArrowRightLeft,
  Building2,
  Loader2,
  ArrowRight,
  AlertCircle,
  X,
} from 'lucide-react';
import { BranchOption } from './InviteBranchMemberModal';

export interface StaffMember {
  id: string;
  userId: string;
  user?: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  } | null;
  branchId: string;
  branchName: string;
  role: string;
  status: string;
}

interface TransferStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  member: StaffMember | null;
  branches: BranchOption[];
  onSuccess: () => void;
}

const ROLES = [
  { key: 'cashier', label: 'Cashier / Sales Attendant' },
  { key: 'stock_manager', label: 'Stock Manager' },
  { key: 'inventory_manager', label: 'Inventory Manager' },
  { key: 'accountant', label: 'Accountant' },
  { key: 'inventory_owner', label: 'Inventory Owner' },
  { key: 'inventory_viewer', label: 'Inventory Viewer' },
];

export const TransferStaffModal: React.FC<TransferStaffModalProps> = ({
  isOpen,
  onClose,
  workspaceId,
  member,
  branches,
  onSuccess,
}) => {
  const availableBranches = branches.filter((b) => b.id !== member?.branchId);
  const [targetBranchId, setTargetBranchId] = useState<string>(availableBranches[0]?.id || '');
  const [newRole, setNewRole] = useState<string>(member?.role || 'cashier');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (member) {
      setNewRole(member.role);
      const other = branches.filter((b) => b.id !== member.branchId);
      if (other.length > 0) {
        setTargetBranchId(other[0].id);
      }
    }
  }, [member, branches]);

  if (!isOpen || !member) return null;

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetBranchId) {
      toast.error('Please select a destination branch.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post(`/workspaces/${workspaceId}/applications/inventory/team/transfer`, {
        membershipId: member.id,
        targetBranchId,
        newRole,
        message: message.trim() || undefined,
      });

      toast.success(`Successfully transferred ${member.user?.name || 'staff member'}!`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to transfer staff member');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentBranchName = member.branchName || 'Current Branch';
  const targetBranch = branches.find((b) => b.id === targetBranchId);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-xl bg-slate-900 border border-slate-800 text-white max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
              <ArrowRightLeft className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Transfer Staff Member</h3>
              <p className="text-xs text-slate-400">
                Reassign an active team member to another branch location with optional role adjustment.
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

        <form onSubmit={handleTransfer} className="space-y-4 pt-1">
          {/* Member badge preview */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center font-bold text-white text-xs shrink-0">
              {member.user?.name?.[0] || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm text-white truncate">{member.user?.name || 'Staff'}</p>
              <p className="text-xs text-slate-400 truncate">{member.user?.email}</p>
            </div>
          </div>

          {/* Transfer visual preview */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-xs">
            <div className="space-y-1">
              <span className="text-[10px] text-slate-500 font-semibold uppercase">Source Branch</span>
              <p className="font-bold text-slate-300">{currentBranchName}</p>
            </div>
            <div className="p-2 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <ArrowRight className="w-4 h-4" />
            </div>
            <div className="space-y-1 text-right">
              <span className="text-[10px] text-slate-500 font-semibold uppercase">Destination Branch</span>
              <p className="font-bold text-emerald-400">{targetBranch?.name || 'Select Branch'}</p>
            </div>
          </div>

          {/* Destination Branch Picker */}
          <div className="space-y-2">
            <Label htmlFor="dest-branch" className="text-xs font-semibold text-slate-300">
              Select Destination Branch
            </Label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
              <select
                id="dest-branch"
                value={targetBranchId}
                onChange={(e) => setTargetBranchId(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-md bg-slate-950/60 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
              >
                {availableBranches.length === 0 ? (
                  <option value="" disabled>
                    No other branches available
                  </option>
                ) : (
                  availableBranches.map((b) => (
                    <option key={b.id} value={b.id} className="bg-slate-900 text-white">
                      {b.name} {b.city ? `(${b.city})` : ''} {b.code ? `• ${b.code}` : ''}
                    </option>
                  ))
                )}
              </select>
            </div>
            {availableBranches.length === 0 && (
              <p className="text-[11px] text-amber-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                You must create at least one additional branch before transferring staff.
              </p>
            )}
          </div>

          {/* New Role in Destination Branch */}
          <div className="space-y-2">
            <Label htmlFor="dest-role" className="text-xs font-semibold text-slate-300">
              Staff Role at Destination Branch
            </Label>
            <select
              id="dest-role"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-md bg-slate-950/60 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
            >
              {ROLES.map((r) => (
                <option key={r.key} value={r.key} className="bg-slate-900 text-white">
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* Transfer Note */}
          <div className="space-y-2">
            <Label htmlFor="transfer-msg" className="text-xs font-semibold text-slate-300">
              Transfer Reason / Note (Optional)
            </Label>
            <Input
              id="transfer-msg"
              placeholder="e.g. Relocating to manage the Ikeja Mall grand opening"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="bg-slate-950/60 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-sky-500 text-xs"
            />
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
              disabled={isSubmitting || !targetBranchId}
              className="bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs gap-2"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Complete Transfer
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
