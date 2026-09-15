import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import {
  Shield,
  Building2,
  CheckCircle,
  AlertCircle,
  XCircle,
  Loader2,
  X,
  Layers,
  Key,
} from 'lucide-react';
import { StaffMember } from './TransferStaffModal';

interface StaffAccessSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  member: StaffMember | null;
}

interface AccessSummaryData {
  user: {
    id: string;
    name: string;
    email: string;
  };
  workspaceMembership: {
    workspaceId: string;
    role: string;
    status: string;
  };
  applicationMembership: {
    applicationKey: string;
    role: string;
    status: string;
    suspendedAt?: number;
    suspensionReason?: string;
  };
  branches: Array<{
    branchId: string;
    branchName: string;
    branchCode?: string;
    status: string;
    role: string;
    permissions: string[];
    suspendedAt?: number;
    suspensionReason?: string;
    removedAt?: number;
    removalReason?: string;
  }>;
}

export const StaffAccessSummaryModal: React.FC<StaffAccessSummaryModalProps> = ({
  isOpen,
  onClose,
  workspaceId,
  member,
}) => {
  const [summary, setSummary] = useState<AccessSummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && member) {
      setIsLoading(true);
      api
        .get<AccessSummaryData>(
          `/workspaces/${workspaceId}/applications/inventory/members/${member.id}/access?userId=${member.userId}`
        )
        .then((res) => {
          setSummary(res);
        })
        .catch((err) => {
          toast.error(err.message || 'Failed to fetch access summary');
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setSummary(null);
    }
  }, [isOpen, member, workspaceId]);

  if (!isOpen || !member) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-2xl rounded-xl bg-slate-900 border border-slate-800 text-white max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Staff Access Summary</h3>
              <p className="text-xs text-slate-400">
                Evaluation of workspace, application, and store-level permissions hierarchy.
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

        {isLoading ? (
          <div className="py-16 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
            <p className="text-xs text-slate-400">Evaluating access permissions...</p>
          </div>
        ) : summary ? (
          <div className="space-y-5">
            {/* User Profile Banner */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center font-bold text-white text-sm shrink-0">
                  {summary.user.name?.[0] || 'U'}
                </div>
                <div>
                  <p className="font-semibold text-sm text-white">{summary.user.name}</p>
                  <p className="text-xs text-slate-400">{summary.user.email}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold uppercase bg-slate-800 text-slate-300 border border-slate-700">
                  Workspace: {summary.workspaceMembership?.role || 'MEMBER'}
                </span>
              </div>
            </div>

            {/* Hierarchy Path Visual */}
            <div className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                <Layers className="w-4 h-4 text-indigo-400" />
                <span>Security Hierarchy Level</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                  User Account ({summary.user.email})
                </span>
                <span className="text-slate-600">→</span>
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-indigo-300">
                  Workspace ({summary.workspaceMembership?.status || 'Active'})
                </span>
                <span className="text-slate-600">→</span>
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-emerald-300">
                  Inventory App ({summary.applicationMembership?.status || 'Active'})
                </span>
              </div>
            </div>

            {/* Branch Access Breakdown */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Assigned Store Branches ({summary.branches?.length || 0})
                </h4>
              </div>

              <div className="space-y-2.5">
                {summary.branches?.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 rounded-xl bg-slate-950/40 border border-slate-800">
                    <Building2 className="w-6 h-6 mx-auto mb-1 text-slate-600" />
                    <p className="text-xs">No store branches currently assigned.</p>
                  </div>
                ) : (
                  summary.branches.map((b) => (
                    <div
                      key={b.branchId}
                      className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-slate-400" />
                          <span className="font-semibold text-xs text-white">{b.branchName}</span>
                          {b.branchCode && (
                            <span className="text-[10px] font-mono text-slate-500">[{b.branchCode}]</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                            {b.role.replace('_', ' ')}
                          </span>
                          {b.status === 'active' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                              <CheckCircle className="w-3.5 h-3.5" />
                              Active
                            </span>
                          ) : b.status === 'suspended' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400">
                              <AlertCircle className="w-3.5 h-3.5" />
                              Suspended
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-400">
                              <XCircle className="w-3.5 h-3.5" />
                              Removed
                            </span>
                          )}
                        </div>
                      </div>

                      {b.suspensionReason && (
                        <p className="text-[11px] text-amber-300/90 bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/20">
                          Suspension Reason: {b.suspensionReason}
                        </p>
                      )}

                      {/* Permissions List Preview */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 uppercase">
                          <Key className="w-3 h-3 text-slate-500" />
                          <span>Active Permissions ({b.permissions?.length || 0})</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {(b.permissions || []).map((perm) => (
                            <span
                              key={perm}
                              className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-slate-900 border border-slate-800 text-slate-300"
                            >
                              {perm}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-slate-500 text-xs">
            No access data available.
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end pt-3 border-t border-slate-800">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
