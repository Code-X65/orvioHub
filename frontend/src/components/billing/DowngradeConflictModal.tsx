import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { api } from '@/lib/api';
import {
  GitBranch,
  Users,
  Calendar,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Info,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Archive,
  UserX,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface BranchItem {
  id: string;
  name: string;
  code: string;
  isPrimary?: boolean;
}

interface MemberItem {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
}

interface ConflictItem {
  type: string;
  current: number;
  allowed: number;
  excess: number;
  action: string;
  description: string;
}

interface ConflictData {
  hasConflicts: boolean;
  canSchedule: boolean;
  currentPlan: string;
  targetPlan: string;
  effectiveAt: number;
  targetLimits: {
    maxBranches: number;
    maxMembers: number;
    maxProducts: number;
    maxTransactions: number;
  };
  currentCounts: { branches: number; members: number; products: number };
  excess: { branches: number; members: number };
  conflicts: ConflictItem[];
  branches: BranchItem[];
  members: MemberItem[];
  dataPreservationNotice: string;
}

interface DowngradeConflictModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  organizationId: string;
  organizationName: string;
  currentPeriodEnd?: number;
}

export const DowngradeConflictModal: React.FC<DowngradeConflictModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  organizationId,
  organizationName,
  currentPeriodEnd,
}) => {
  const { user } = useAuthStore();

  const [conflictData, setConflictData] = useState<ConflictData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !organizationId) return;

    let isMounted = true;
    setIsLoading(true);

    const fetchConflicts = async () => {
      try {
        const res: any = await api.post(
          `/workspaces/${organizationId}/billing/downgrade/preview`,
          { targetPlan: 'standard' }
        );
        const data = res.data?.data || res.data || res;

        if (!isMounted) return;

        if (data && Array.isArray(data.branches)) {
          setConflictData(data);

          // Default retained branches up to maxBranches (3)
          const maxBranches = data.targetLimits?.maxBranches || 3;
          const defaultBranches = data.branches.slice(0, maxBranches).map((b: BranchItem) => b.id);
          setSelectedBranchIds(defaultBranches);

          // Default retained members up to maxMembers (10)
          const maxMembers = data.targetLimits?.maxMembers || 10;
          const defaultMems: string[] = [];
          if (user?.id) {
            const owner = data.members.find((m: MemberItem) => m.userId === user.id);
            if (owner) defaultMems.push(owner.userId);
          }
          for (const m of data.members as MemberItem[]) {
            if (!defaultMems.includes(m.userId) && defaultMems.length < maxMembers) {
              defaultMems.push(m.userId);
            }
          }
          setSelectedMemberIds(defaultMems);
        }
      } catch (err: any) {
        if (isMounted) {
          toast.error(err.message || 'Failed to load downgrade conflict details.');
          onClose();
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchConflicts();

    return () => {
      isMounted = false;
    };
  }, [isOpen, organizationId, user?.id, onClose]);

  if (!isOpen) return null;

  const maxBranches = conflictData?.targetLimits?.maxBranches || 3;
  const maxMembers = conflictData?.targetLimits?.maxMembers || 10;
  const hasBranchConflicts = (conflictData?.currentCounts.branches || 0) > maxBranches;
  const hasMemberConflicts = (conflictData?.currentCounts.members || 0) > maxMembers;
  const effectiveTimestamp = conflictData?.effectiveAt || currentPeriodEnd || (Date.now() + 30 * 86_400_000);

  const toggleBranchSelection = (branchId: string) => {
    if (selectedBranchIds.includes(branchId)) {
      if (selectedBranchIds.length === 1) {
        toast.error('At least one active branch must remain selected.');
        return;
      }
      setSelectedBranchIds(selectedBranchIds.filter((id) => id !== branchId));
    } else {
      if (selectedBranchIds.length >= maxBranches) {
        toast.error(`The Standard plan limit allows a maximum of ${maxBranches} active branches.`);
        return;
      }
      setSelectedBranchIds([...selectedBranchIds, branchId]);
    }
  };

  const toggleMemberSelection = (userId: string) => {
    if (userId === user?.id) return; // Cannot deselect owner

    if (selectedMemberIds.includes(userId)) {
      setSelectedMemberIds(selectedMemberIds.filter((id) => id !== userId));
    } else {
      if (selectedMemberIds.length >= maxMembers) {
        toast.error(`The Standard plan limit allows a maximum of ${maxMembers} active team members.`);
        return;
      }
      setSelectedMemberIds([...selectedMemberIds, userId]);
    }
  };

  const handleConfirmDowngrade = async () => {
    if (!organizationId) return;
    setIsSubmitting(true);

    const resourceDecisions: Array<{ resourceType: string; resourceId: string; action: string }> = [];

    // Decisions for branches
    if (conflictData?.branches) {
      for (const b of conflictData.branches) {
        if (selectedBranchIds.includes(b.id)) {
          resourceDecisions.push({ resourceType: 'branch', resourceId: b.id, action: 'keep_active' });
        } else {
          resourceDecisions.push({ resourceType: 'branch', resourceId: b.id, action: 'archive' });
        }
      }
    }

    // Decisions for members
    if (conflictData?.members) {
      for (const m of conflictData.members) {
        if (selectedMemberIds.includes(m.userId)) {
          resourceDecisions.push({ resourceType: 'member', resourceId: m.id, action: 'keep_active' });
        } else {
          resourceDecisions.push({ resourceType: 'member', resourceId: m.id, action: 'suspend' });
        }
      }
    }

    const idempotencyKey = `idemp_dwn_${organizationId}_${Date.now()}`;

    try {
      await api.post(
        `/workspaces/${organizationId}/billing/downgrade`,
        {
          targetPlan: 'standard',
          effectiveAt: effectiveTimestamp,
          resourceDecisions,
          reason: reason.trim() || undefined,
        },
        {
          headers: {
            'Idempotency-Key': idempotencyKey,
          },
        }
      );

      toast.success(
        `Downgrade to Standard scheduled for ${new Date(effectiveTimestamp).toLocaleDateString()}. Your Premium features remain active until then.`
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to schedule plan downgrade.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formattedPeriodEnd = new Date(effectiveTimestamp).toLocaleDateString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="max-w-xl w-full bg-[#140d12] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-white/10 bg-[#1c1219]/60 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Downgrade to Standard Plan
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Switching <span className="text-white font-medium">{organizationName}</span> from Premium to Standard.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition text-xs p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Step Indicator */}
        {(hasBranchConflicts || hasMemberConflicts) && (
          <div className="px-6 py-3 border-b border-white/5 bg-black/30 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] ${
                  step === 1 ? 'bg-[#714b67] text-white' : 'bg-white/10 text-slate-400'
                }`}
              >
                1
              </span>
              <span className={step === 1 ? 'font-bold text-white' : 'text-slate-400'}>
                Retained Branches
              </span>
            </div>
            <div className="w-8 h-[1px] bg-white/10" />
            <div className="flex items-center gap-2">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] ${
                  step === 2 ? 'bg-[#714b67] text-white' : 'bg-white/10 text-slate-400'
                }`}
              >
                2
              </span>
              <span className={step === 2 ? 'font-bold text-white' : 'text-slate-400'}>
                Retained Team
              </span>
            </div>
            <div className="w-8 h-[1px] bg-white/10" />
            <div className="flex items-center gap-2">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] ${
                  step === 3 ? 'bg-[#714b67] text-white' : 'bg-white/10 text-slate-400'
                }`}
              >
                3
              </span>
              <span className={step === 3 ? 'font-bold text-white' : 'text-slate-400'}>
                Confirm
              </span>
            </div>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {isLoading ? (
            <div className="text-center py-12 space-y-3">
              <Loader2 className="w-6 h-6 text-[#714b67] animate-spin mx-auto" />
              <p className="text-slate-400 text-xs">Calculating resource usage against Standard limits...</p>
            </div>
          ) : (
            <>
              {/* Step 1: Branch Selection if excess branches exist */}
              {step === 1 && (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-2.5">
                    <Archive className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-amber-200 block text-xs">
                        Select Active Branches (Max {maxBranches})
                      </span>
                      <p className="text-[11px] text-slate-300 mt-0.5">
                        Standard plan includes up to {maxBranches} branches. Unselected branches will be safely archived with all historical stock data preserved.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {conflictData?.branches.map((b) => {
                      const isSelected = selectedBranchIds.includes(b.id);
                      return (
                        <div
                          key={b.id}
                          onClick={() => toggleBranchSelection(b.id)}
                          className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                            isSelected
                              ? 'bg-[#714b67]/20 border-[#714b67] text-white'
                              : 'bg-black/40 border-white/10 text-slate-400 hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <GitBranch className={`w-4 h-4 ${isSelected ? 'text-[#FDB02F]' : 'text-slate-500'}`} />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs">{b.name}</span>
                                <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-white/5 border border-white/10">
                                  {b.code}
                                </span>
                              </div>
                            </div>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              isSelected
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-rose-500/10 text-rose-400'
                            }`}
                          >
                            {isSelected ? 'KEEP ACTIVE' : 'WILL ARCHIVE'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Step 2: Member Selection if excess members exist */}
              {step === 2 && (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-2.5">
                    <UserX className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-amber-200 block text-xs">
                        Select Retained Team Members (Max {maxMembers})
                      </span>
                      <p className="text-[11px] text-slate-300 mt-0.5">
                        Standard plan includes up to {maxMembers} team members. Unselected members will be suspended (inactive), preserving their accounts and audit histories.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {conflictData?.members.map((m) => {
                      const isSelected = selectedMemberIds.includes(m.userId);
                      const isOwner = m.role === 'OWNER';
                      return (
                        <div
                          key={m.id}
                          onClick={() => !isOwner && toggleMemberSelection(m.userId)}
                          className={`p-3.5 rounded-xl border flex items-center justify-between transition ${
                            isOwner
                              ? 'bg-purple-950/20 border-purple-500/30 text-white cursor-default'
                              : isSelected
                              ? 'bg-[#714b67]/20 border-[#714b67] text-white cursor-pointer'
                              : 'bg-black/40 border-white/10 text-slate-400 hover:border-white/20 cursor-pointer'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Users className={`w-4 h-4 ${isSelected ? 'text-[#FDB02F]' : 'text-slate-500'}`} />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs">{m.name}</span>
                                <span className="text-[10px] text-slate-400">{m.email}</span>
                              </div>
                              <span className="text-[10px] font-mono text-[#c79dbd] uppercase">{m.role}</span>
                            </div>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              isOwner
                                ? 'bg-purple-500/20 text-purple-300'
                                : isSelected
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-rose-500/10 text-rose-400'
                            }`}
                          >
                            {isOwner ? 'OWNER (ACTIVE)' : isSelected ? 'KEEP ACTIVE' : 'WILL SUSPEND'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Step 3: Confirmation Summary */}
              {step === 3 && (
                <div className="space-y-4">
                  {/* Effective Date Card */}
                  <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-xs">Target Plan:</span>
                      <span className="font-bold text-white text-xs">Standard (₦7,500/mo)</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-xs">Scheduled Effective Date:</span>
                      <span className="font-bold text-amber-400 text-xs flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{formattedPeriodEnd}</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-xs">Current Access:</span>
                      <span className="font-bold text-emerald-400 text-xs">
                        Full Premium retained until {formattedPeriodEnd}
                      </span>
                    </div>
                  </div>

                  {/* Data Preservation Guarantee */}
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 space-y-1">
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>Data Preservation Guarantee</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      No data is ever deleted. Archived branches and suspended team members can be restored at any time by upgrading back to Premium.
                    </p>
                  </div>

                  {/* Optional Reason */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 block">
                      Reason for downgrade (optional)
                    </label>
                    <textarea
                      rows={2}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="e.g., Scaling down operations, optimizing subscription costs..."
                      className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white text-xs outline-none focus:ring-1 focus:ring-[#714b67]"
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-[#1c1219]/60 flex items-center justify-between gap-3">
          {step > 1 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStep((s) => (s - 1) as any)}
              className="text-xs border-white/10 text-slate-300 hover:text-white"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              Back
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs border-white/10 text-slate-300 hover:text-white"
            >
              Cancel
            </Button>
          )}

          {step < 3 ? (
            <Button
              size="sm"
              onClick={() => {
                if (step === 1 && !hasMemberConflicts) {
                  setStep(3);
                } else {
                  setStep((s) => (s + 1) as any);
                }
              }}
              className="bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-bold"
            >
              Next Step
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={isSubmitting}
              onClick={handleConfirmDowngrade}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-lg shadow-amber-950/40"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                  Scheduling Downgrade...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  Confirm Downgrade to Standard
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
