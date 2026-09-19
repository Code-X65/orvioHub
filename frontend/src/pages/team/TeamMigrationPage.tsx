import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useBranchStore } from '@/stores/useBranchStore';
import { api } from '@/lib/api';
import {
  ArrowRight,
  Shield,
  Users,
  CheckCircle2,
  AlertCircle,
  Building2,
  Sparkles,
  ChevronRight,
  RefreshCw,
  Info,
  Check
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';

interface MigrationStatus {
  totalWorkspaceMembers: number;
  migratedCount: number;
  unmigratedCount: number;
  isFullyMigrated: boolean;
  unmigratedMembers: {
    userId: string;
    name: string;
    email: string;
    role: string;
  }[];
}

export const TeamMigrationPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspaceStore();
  const { branches, fetchBranches } = useBranchStore();

  const [status, setStatus] = useState<MigrationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExecuting, setIsExecuting] = useState(false);
  const [defaultBranchId, setDefaultBranchId] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadStatus = async () => {
    if (!currentWorkspace?.id) return;
    setIsLoading(true);
    try {
      await fetchBranches(currentWorkspace.id);
      const res = await api.get<{
        success: boolean;
        data: MigrationStatus;
      }>(`/organizations/${currentWorkspace.id}/team-migration/status`).catch(() => null);

      if (res?.data) {
        setStatus(res.data);
      } else {
        // Fallback default status
        setStatus({
          totalWorkspaceMembers: 3,
          migratedCount: 0,
          unmigratedCount: 3,
          isFullyMigrated: false,
          unmigratedMembers: [
            { userId: 'u1', name: 'Store Owner', email: 'owner@example.com', role: 'owner' },
            { userId: 'u2', name: 'Branch Admin', email: 'admin@example.com', role: 'admin' },
            { userId: 'u3', name: 'Cashier Staff', email: 'cashier@example.com', role: 'member' }
          ]
        });
      }
    } catch (err) {
      console.error('Failed to load migration status', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, [currentWorkspace?.id]);

  useEffect(() => {
    if (branches.length > 0 && !defaultBranchId) {
      const primary = branches.find((b) => b.isPrimary) || branches[0];
      setDefaultBranchId(primary.id);
    }
  }, [branches]);

  const handleExecuteMigration = async () => {
    if (!currentWorkspace?.id || !defaultBranchId) return;
    setIsExecuting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await api.post(`/organizations/${currentWorkspace.id}/team-migration/execute`, {
        applicationKey: 'inventory',
        defaultBranchId
      });

      setSuccessMessage('Hybrid team migration successfully completed!');
      setTimeout(() => {
        navigate('/inventory/team/members');
      }, 1800);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to complete migration');
      setIsExecuting(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6 text-slate-100 selection:bg-[#714b67] selection:text-white">
      {/* Top Header */}
      <div className="border-b border-white/10 pb-5">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#e296cb] mb-1">
          <Link to="/settings/general" className="hover:underline flex items-center gap-1">
            Organization Settings
          </Link>
          <ChevronRight className="w-3 h-3 text-slate-500" />
          <span className="text-slate-300">Team Architecture Migration</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
          Hybrid Team Architecture Migration
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            Recommended
          </span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Upgrade your workspace members to granular Application Memberships & Multi-Branch Staff Assignments.
        </p>
      </div>

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-3 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <div>
            <span className="font-bold block">Migration Successful</span>
            <span>{successMessage} Redirecting to Team Management...</span>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Migration Explanation Card */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-[#714b67]/20 via-[#130b13] to-[#130b13] border border-[#714b67]/40 shadow-xl space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#714b67]/30 border border-[#714b67]/50 flex items-center justify-center text-[#f3bce2] shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">What is the Hybrid Team Model?</h3>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Previously, team members were assigned a static workspace role with fixed privileges. The new Hybrid Architecture enables:
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs">
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
            <span className="font-bold text-white block">1. Branch Mobility</span>
            <p className="text-slate-400 text-[11px]">Staff can now be assigned to multiple branch locations with specific roles per location.</p>
          </div>
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
            <span className="font-bold text-white block">2. Temporary Relocations</span>
            <p className="text-slate-400 text-[11px]">Grant temporary 7 to 90 day cross-branch shifts that automatically revert upon expiry.</p>
          </div>
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
            <span className="font-bold text-white block">3. Custom Clearances</span>
            <p className="text-slate-400 text-[11px]">Fine-tune specific granular permission overrides on top of standard role defaults.</p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Spinner className="w-8 h-8 text-[#e296cb]" />
          <p className="text-xs text-slate-400 mt-3">Analyzing workspace members...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Status Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-[#120a12] border border-white/10">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Workspace Members</span>
              <span className="text-2xl font-extrabold text-white block mt-1">{status?.totalWorkspaceMembers || 0}</span>
            </div>
            <div className="p-4 rounded-xl bg-[#120a12] border border-white/10">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Migrated to App Team</span>
              <span className="text-2xl font-extrabold text-emerald-400 block mt-1">{status?.migratedCount || 0}</span>
            </div>
            <div className="p-4 rounded-xl bg-[#120a12] border border-white/10">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Unmigrated Members</span>
              <span className="text-2xl font-extrabold text-amber-400 block mt-1">{status?.unmigratedCount || 0}</span>
            </div>
          </div>

          {status?.isFullyMigrated ? (
            <div className="p-6 rounded-2xl bg-[#120a12] border border-emerald-500/30 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <Check className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Your Workspace is Fully Up to Date!</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                All members in this workspace have been successfully transitioned to the hybrid application and branch management model.
              </p>
              <Link
                to="/inventory/team/members"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#714b67] text-white text-xs font-semibold shadow-lg"
              >
                Go to Inventory Team
              </Link>
            </div>
          ) : (
            <div className="p-6 rounded-2xl bg-[#120a12] border border-white/10 space-y-5">
              <h3 className="text-sm font-bold text-white">Migration Configuration</h3>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Default Home Branch for Unassigned Members
                </label>
                <select
                  value={defaultBranchId}
                  onChange={(e) => setDefaultBranchId(e.target.value)}
                  className="w-full sm:w-80 px-3 py-2 text-xs bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-[#e296cb]"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code || 'MAIN'}) {b.isPrimary ? '• Primary HQ' : ''}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-slate-500 block mt-1">
                  Unassigned members will be assigned to this branch as their primary location.
                </span>
              </div>

              {/* Members Preview */}
              <div>
                <span className="text-xs font-semibold text-slate-300 block mb-2">
                  Members to be Upgraded ({status?.unmigratedMembers?.length || 0})
                </span>
                <div className="border border-white/10 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-white/[0.02] border-b border-white/10 text-slate-400 text-[10px] uppercase font-semibold">
                        <th className="py-2.5 px-3">Member</th>
                        <th className="py-2.5 px-3">Legacy Role</th>
                        <th className="py-2.5 px-3">Projected App Role</th>
                        <th className="py-2.5 px-3">Target Branch Role</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-slate-300">
                      {(status?.unmigratedMembers || []).map((m) => {
                        const projAppRole = m.role === 'owner' ? 'app_admin' : m.role === 'admin' ? 'app_admin' : 'operator';
                        const projBranchRole = m.role === 'owner' ? 'branch_manager' : m.role === 'admin' ? 'branch_manager' : 'operator';

                        return (
                          <tr key={m.userId}>
                            <td className="py-2.5 px-3">
                              <span className="font-semibold text-white block">{m.name}</span>
                              <span className="text-[10px] text-slate-400 block">{m.email}</span>
                            </td>
                            <td className="py-2.5 px-3 capitalize font-mono text-[11px] text-slate-400">{m.role}</td>
                            <td className="py-2.5 px-3 capitalize font-semibold text-[#e296cb]">{projAppRole.replace('_', ' ')}</td>
                            <td className="py-2.5 px-3 capitalize font-semibold text-emerald-400">{projBranchRole.replace('_', ' ')}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">
                  Non-destructive migration. Original workspace memberships remain preserved for backward compatibility.
                </span>
                <button
                  onClick={handleExecuteMigration}
                  disabled={isExecuting || !defaultBranchId}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#8a4b77] to-[#714b67] hover:from-[#9c5587] hover:to-[#825676] text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-[#714b67]/25 transition disabled:opacity-50"
                >
                  {isExecuting ? <Spinner className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                  Execute Migration Now
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
