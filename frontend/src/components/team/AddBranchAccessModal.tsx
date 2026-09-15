import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { PlusCircle, Building2, Shield, Loader2, X } from 'lucide-react';
import { StaffMember } from './TransferStaffModal';
import { BranchOption } from './InviteBranchMemberModal';

interface AddBranchAccessModalProps {
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

export const AddBranchAccessModal: React.FC<AddBranchAccessModalProps> = ({
  isOpen,
  onClose,
  workspaceId,
  member,
  branches,
  onSuccess,
}) => {
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [role, setRole] = useState(member?.role || 'cashier');
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (member) {
      setRole(member.role || 'cashier');
      // Set default to first branch different from current branch if available
      const other = branches.filter((b) => b.id !== member.branchId);
      if (other.length > 0) {
        setSelectedBranchId(other[0].id);
      } else if (branches.length > 0) {
        setSelectedBranchId(branches[0].id);
      }
    }
  }, [member, branches]);

  if (!isOpen || !member) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBranchId) {
      toast.error('Please select a branch.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post(`/workspaces/${workspaceId}/applications/inventory/members/${member.id}/branches`, {
        branchId: selectedBranchId,
        role,
        userId: member.userId,
      });

      const branchName = branches.find((b) => b.id === selectedBranchId)?.name || 'the branch';
      toast.success(`Granted access to ${branchName} for ${member.user?.name || 'staff member'}.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add branch access');
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
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <PlusCircle className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Add Branch Access</h3>
              <p className="text-xs text-slate-400">
                Grant this staff member access to an additional store location.
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
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-600 flex items-center justify-center font-bold text-white text-xs shrink-0">
              {member.user?.name?.[0] || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm text-white truncate">{member.user?.name || 'Staff User'}</p>
              <p className="text-xs text-slate-400 truncate">{member.user?.email}</p>
            </div>
          </div>

          {/* Branch Picker */}
          <div className="space-y-2">
            <Label htmlFor="add-branch" className="text-xs font-semibold text-slate-300">
              Select Store Branch
            </Label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
              <select
                id="add-branch"
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-md bg-slate-950/60 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id} className="bg-slate-900 text-white">
                    {b.name} {b.city ? `(${b.city})` : ''} {b.code ? `• ${b.code}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Role Picker */}
          <div className="space-y-2">
            <Label htmlFor="branch-role" className="text-xs font-semibold text-slate-300">
              Branch Role & Authority
            </Label>
            <select
              id="branch-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-md bg-slate-950/60 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              {ROLES.map((r) => (
                <option key={r.key} value={r.key} className="bg-slate-900 text-white">
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* Policy Note */}
          <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800 text-xs text-slate-400 space-y-1">
            <div className="flex items-center gap-1.5 font-medium text-slate-300">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>Permission Scope</span>
            </div>
            <p className="text-[11px]">
              The staff member will only be able to perform sales, inventory counts, or branch actions within this assigned store.
            </p>
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
              disabled={isSubmitting || !selectedBranchId}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs gap-2"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Grant Access
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
