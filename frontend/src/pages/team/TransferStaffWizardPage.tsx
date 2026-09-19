import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useBranchStore } from '@/stores/useBranchStore';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  ArrowRightLeft,
  ArrowLeft,
  Building2,
  Clock,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Loader2,
  Shield,
  Send,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const TransferStaffWizardPage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspaceStore();
  const { branches } = useBranchStore();

  const [member, setMember] = useState<any>(null);
  const [sourceBranchId, setSourceBranchId] = useState('');
  const [targetBranchId, setTargetBranchId] = useState('');
  const [newBranchRole, setNewBranchRole] = useState<'manager' | 'staff' | 'viewer' | 'accountant'>('staff');
  const [assignmentType, setAssignmentType] = useState<'primary' | 'secondary' | 'temporary'>('primary');
  const [temporaryDays, setTemporaryDays] = useState(14);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const workspaceId = currentWorkspace?.id || '';

  useEffect(() => {
    const fetchMember = async () => {
      if (!workspaceId || !userId) return;
      setIsLoading(true);
      try {
        const res = await api.get<{ data?: any; member?: any }>(`/workspaces/${workspaceId}/applications/inventory/members/${userId}`);
        const m = res?.data?.member || res?.data || res?.member;
        if (m) {
          const normalized = {
            ...m,
            branchAssignments: Array.isArray(m.branchAssignments) ? m.branchAssignments : [],
          };
          setMember(normalized);
          if (normalized.branchAssignments.length > 0) {
            setSourceBranchId(normalized.branchAssignments[0].branchId);
          }
        }
      } catch {
        // Mock fallback
        setMember({
          userId,
          name: 'Staff Operator',
          email: 'staff@example.com',
          branchAssignments: [
            { branchId: branches[0]?.id || 'b1', branchName: branches[0]?.name || 'Current Branch', branchRole: 'staff' },
          ],
        });
        if (branches.length > 0) {
          setSourceBranchId(branches[0].id);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchMember();
  }, [workspaceId, userId, branches]);

  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId || !userId || !targetBranchId) {
      toast.error('Please select destination branch location.');
      return;
    }
    if (sourceBranchId && sourceBranchId === targetBranchId) {
      toast.error('Source and Destination branches cannot be the same.');
      return;
    }

    const temporaryUntil = assignmentType === 'temporary'
      ? Date.now() + temporaryDays * 24 * 60 * 60 * 1000
      : undefined;

    setIsSubmitting(true);
    try {
      await api.post(`/workspaces/${workspaceId}/applications/inventory/members/${userId}/transfer`, {
        sourceBranchId: sourceBranchId || undefined,
        targetBranchId,
        newBranchRole,
        assignmentType,
        temporaryUntil,
        reason: reason.trim() || undefined,
      });

      toast.success(`Staff member successfully transferred to destination branch!`);
      navigate(`/inventory/team/members/${userId}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || err?.message || 'Failed to transfer staff');
    } finally {
      setIsSubmitting(false);
    }
  };

  const sourceBranch = branches.find((b) => b.id === sourceBranchId);
  const targetBranch = branches.find((b) => b.id === targetBranchId);

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-6 animate-in fade-in duration-150">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(`/inventory/team/members/${userId}`)}
        className="text-slate-400 hover:text-white -ml-2 text-xs"
      >
        <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
        Back to Member Details
      </Button>

      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <ArrowRightLeft className="w-5 h-5 text-[#e6a8d6]" />
          Branch Staff Transfer Wizard
        </h1>
        <p className="text-xs text-slate-400">
          Relocate or cross-assign <strong>{member?.name || 'Staff Member'}</strong> between retail store locations.
        </p>
      </div>

      <form onSubmit={handleExecuteTransfer} className="space-y-6">
        {/* 1. Visual Transition Preview */}
        <div className="p-6 rounded-2xl bg-[#120a11] border border-white/10 shadow-xl space-y-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Transfer Route Preview
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
            {/* Origin Card */}
            <div className="md:col-span-2 p-4 rounded-xl bg-black/40 border border-white/10 space-y-1 text-center sm:text-left">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Origin Store</span>
              <p className="text-sm font-bold text-white truncate">{sourceBranch?.name || 'Unassigned / HQ'}</p>
              <span className="text-[11px] text-slate-400 block font-mono">Current Location</span>
            </div>

            {/* Transition Arrow */}
            <div className="flex flex-col items-center justify-center text-[#e6a8d6]">
              <ArrowRightLeft className="w-6 h-6 animate-pulse" />
              <span className="text-[10px] font-bold uppercase mt-1">
                {assignmentType}
              </span>
            </div>

            {/* Target Card */}
            <div className="md:col-span-2 p-4 rounded-xl bg-[#714b67]/15 border border-[#714b67]/40 space-y-1 text-center sm:text-left">
              <span className="text-[10px] font-bold text-[#e6a8d6] uppercase">Destination Store</span>
              <p className="text-sm font-bold text-white truncate">{targetBranch?.name || 'Select Destination'}</p>
              <span className="text-[11px] text-emerald-400 block font-mono capitalize">Role: {newBranchRole}</span>
            </div>
          </div>
        </div>

        {/* 2. Destination & Role Configuration */}
        <div className="p-6 rounded-2xl bg-[#120a11]/90 border border-white/10 shadow-xl space-y-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-white/10 pb-3">
            <Building2 className="w-4 h-4 text-emerald-400" />
            Transfer Parameters
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-200">Origin Branch (Current)</Label>
              <select
                value={sourceBranchId}
                onChange={(e) => setSourceBranchId(e.target.value)}
                className="w-full h-9 px-3 rounded-md bg-black/50 border border-white/10 text-xs text-white focus:outline-none focus:border-[#714b67]"
              >
                <option value="">-- No Source Branch (Add Assignment) --</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-200">Destination Branch *</Label>
              <select
                value={targetBranchId}
                onChange={(e) => setTargetBranchId(e.target.value)}
                required
                className="w-full h-9 px-3 rounded-md bg-black/50 border border-white/10 text-xs text-white focus:outline-none focus:border-[#714b67]"
              >
                <option value="">-- Select Target Branch --</option>
                {branches
                  .filter((b) => b.id !== sourceBranchId)
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-200">Role at Destination Store *</Label>
              <select
                value={newBranchRole}
                onChange={(e) => setNewBranchRole(e.target.value as any)}
                className="w-full h-9 px-3 rounded-md bg-black/50 border border-white/10 text-xs text-white focus:outline-none focus:border-[#714b67]"
              >
                <option value="manager">Branch Manager (Location Admin)</option>
                <option value="staff">Branch Staff (Registers & Stock)</option>
                <option value="accountant">Accountant</option>
                <option value="viewer">Viewer (Read-Only)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-200">Transfer Nature *</Label>
              <select
                value={assignmentType}
                onChange={(e) => setAssignmentType(e.target.value as any)}
                className="w-full h-9 px-3 rounded-md bg-black/50 border border-white/10 text-xs text-white focus:outline-none focus:border-[#714b67]"
              >
                <option value="primary">Permanent Relocation (Primary)</option>
                <option value="secondary">Cross-Location Assignment (Secondary)</option>
                <option value="temporary">Temporary Store Coverage (Expires automatically)</option>
              </select>
            </div>

            {assignmentType === 'temporary' && (
              <div className="sm:col-span-2 space-y-1.5 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <Label className="text-xs text-amber-300 font-bold flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Temporary Assignment Duration
                </Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min={1}
                    max={180}
                    value={temporaryDays}
                    onChange={(e) => setTemporaryDays(parseInt(e.target.value) || 1)}
                    className="w-32 bg-black/60 border-white/10 text-xs text-white"
                  />
                  <span className="text-xs text-slate-300">Days from today (Expires: {new Date(Date.now() + temporaryDays * 86400000).toLocaleDateString()})</span>
                </div>
              </div>
            )}

            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs text-slate-200">Transfer Reason / Audit Note</Label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="e.g. Relocated to Lekki flagship due to branch expansion; store coverage for peak season."
                className="w-full p-3 rounded-xl bg-black/50 border border-white/10 text-xs text-white focus:outline-none focus:border-[#714b67]"
              />
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate(`/inventory/team/members/${userId}`)}
            className="text-slate-400 hover:text-white text-xs"
          >
            Cancel
          </Button>

          <Button
            type="submit"
            disabled={isSubmitting || !targetBranchId}
            className="bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold px-6 h-10 shadow-lg shadow-[#714b67]/25 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                Executing Relocation...
              </>
            ) : (
              'Confirm & Execute Transfer'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};
