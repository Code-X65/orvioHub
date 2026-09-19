import React, { useState, useEffect } from 'react';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useBranchStore } from '@/stores/useBranchStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { api } from '@/lib/api';
import {
  User,
  Shield,
  Building2,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  Mail,
  Check,
  X,
  Store,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';

export const PersonalTeamView: React.FC = () => {
  const { currentWorkspace } = useWorkspaceStore();
  const { activeBranch, branches, setActiveBranch } = useBranchStore();
  const { user } = useAuthStore();

  const [memberData, setMemberData] = useState<any>(null);
  const [receivedInvites, setReceivedInvites] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'assignments' | 'invitations'>('assignments');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadPersonalData = async () => {
    if (!currentWorkspace?.id || !user?.id) return;
    setIsLoading(true);
    try {
      // 1. Fetch current member record
      const memberRes = await api.get<{
        success: boolean;
        data: { member: any };
      }>(`/applications/inventory/team/members/${user.id}?workspaceId=${currentWorkspace.id}`).catch(() => null);

      if (memberRes?.data?.member) {
        setMemberData(memberRes.data.member);
      }

      // 2. Fetch any pending user invitations
      const inviteRes = await api.get<{
        success: boolean;
        data: { invitations: any[] };
      }>(`/invitations?email=${encodeURIComponent(user.email)}`).catch(() => null);

      if (inviteRes?.data?.invitations) {
        setReceivedInvites(inviteRes.data.invitations.filter((i: any) => i.status === 'pending'));
      }
    } catch (err) {
      console.error('Failed to load personal team view', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPersonalData();
  }, [currentWorkspace?.id, user?.id]);

  const handleAcceptInvitation = async (token: string) => {
    try {
      await api.post('/invitations/accept', { token });
      setActionSuccess('Successfully joined workspace/application!');
      setTimeout(() => {
        loadPersonalData();
      }, 1000);
    } catch (err: any) {
      alert(err?.message || 'Failed to accept invitation');
    }
  };

  const handleBranchSwitch = (branchId: string) => {
    const targetBranch = branches.find((b) => b.id === branchId);
    if (targetBranch) {
      setActiveBranch(targetBranch);
      setActionSuccess(`Switched active context to ${targetBranch.name}`);
      setTimeout(() => setActionSuccess(null), 3000);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6 text-slate-100 selection:bg-[#714b67] selection:text-white">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            My Staff Profile & Assignments
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            View your operational branch roles, working locations, and active permission clearances.
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1.5 p-1 bg-white/5 rounded-xl border border-white/10">
          <button
            onClick={() => setActiveTab('assignments')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'assignments'
                ? 'bg-[#714b67] text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            My Branch Roles
          </button>
          <button
            onClick={() => setActiveTab('invitations')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              activeTab === 'invitations'
                ? 'bg-[#714b67] text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Invitations
            {receivedInvites.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-emerald-500 text-black font-bold text-[10px] flex items-center justify-center">
                {receivedInvites.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Spinner className="w-8 h-8 text-[#e296cb]" />
          <p className="text-xs text-slate-400 mt-3">Loading your role profile...</p>
        </div>
      ) : activeTab === 'assignments' ? (
        <div className="space-y-6">
          {/* Identity Card */}
          <div className="p-6 bg-[#130b13] border border-white/10 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#8a4b77] to-[#512c47] flex items-center justify-center text-white text-xl font-extrabold shadow-lg">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white">{user?.name || 'Operator'}</h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Active
                  </span>
                </div>
                <p className="text-xs text-slate-400">{user?.email}</p>
                <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-2">
                  <span>Base App Role: <strong className="text-white capitalize">{memberData?.appRole?.replace('_', ' ') || 'Operator'}</strong></span>
                  {memberData?.employeeId && (
                    <span>• ID: <strong className="text-white font-mono">{memberData.employeeId}</strong></span>
                  )}
                </div>
              </div>
            </div>

            {/* Currently Active Branch Box */}
            <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/10 w-full md:w-auto">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
                Current Working Context
              </span>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-bold text-white">
                  {activeBranch?.name || 'Select Branch'}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  ({activeBranch?.code || 'HQ'})
                </span>
              </div>
            </div>
          </div>

          {/* Assigned Branches List */}
          <div>
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#e296cb]" />
              Your Assigned Branch Locations
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {memberData?.branchAssignments && memberData.branchAssignments.length > 0 ? (
                memberData.branchAssignments.map((assignment: any) => {
                  const isActiveNow = activeBranch?.id === assignment.branchId;
                  const isTemp = assignment.assignmentType === 'temporary';

                  return (
                    <div
                      key={assignment.branchId}
                      className={`p-5 rounded-2xl border transition-all ${
                        isActiveNow
                          ? 'bg-gradient-to-br from-[#714b67]/20 to-white/[0.03] border-[#e296cb]/50 shadow-lg'
                          : 'bg-[#120a12] border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-[#714b67]/20 border border-[#714b67]/40 flex items-center justify-center text-[#f3bce2]">
                            <Store className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-white">{assignment.branchName}</h4>
                            <span className="text-[10px] text-slate-400 font-mono">
                              Code: {assignment.branchCode || 'MAIN'}
                            </span>
                          </div>
                        </div>

                        {assignment.isPrimaryBranch && (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Home Base
                          </span>
                        )}
                      </div>

                      <div className="space-y-1.5 text-xs text-slate-300 mb-4">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Branch Role:</span>
                          <span className="font-semibold text-white capitalize">
                            {assignment.branchRole?.replace('_', ' ') || 'Operator'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Assignment Type:</span>
                          <span className="font-medium capitalize text-slate-300">
                            {assignment.assignmentType}
                          </span>
                        </div>
                        {isTemp && assignment.temporaryUntil && (
                          <div className="flex items-center justify-between text-amber-300 text-[11px]">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Valid Until:
                            </span>
                            <span>{new Date(assignment.temporaryUntil).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>

                      <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                        {isActiveNow ? (
                          <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Working Context Active
                          </span>
                        ) : (
                          <button
                            onClick={() => handleBranchSwitch(assignment.branchId)}
                            className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-200 transition text-center"
                          >
                            Switch to this Branch
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-2 p-8 rounded-2xl bg-[#120a12] border border-white/10 text-center">
                  <Building2 className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">No branch assignments found.</p>
                </div>
              )}
            </div>
          </div>

          {/* Permissions Matrix Accordion */}
          <div className="p-6 bg-[#120a12] border border-white/10 rounded-2xl">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#e296cb]" />
              Active System Capabilities & Clearances
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              These permissions are dynamically computed from your base app role, active branch role, and administrative overrides.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {(memberData?.effectivePermissions || [
                'inventory:view_products',
                'inventory:create_sale',
                'inventory:view_stock',
                'inventory:view_branch_reports'
              ]).map((perm: string) => (
                <div
                  key={perm}
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-xs text-slate-300"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="font-mono text-[11px] truncate">{perm}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Invitations Tab */
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300">
            Pending invitations to join organizations, branches, or applications sent to <strong>{user?.email}</strong>.
          </div>

          {receivedInvites.length === 0 ? (
            <div className="p-12 text-center bg-[#120a12] border border-white/10 rounded-2xl">
              <Mail className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-xs font-semibold text-white">No pending invitations</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                When an administrator invites you to a workspace or branch, it will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {receivedInvites.map((inv) => (
                <div
                  key={inv.id}
                  className="p-5 rounded-2xl bg-[#120a12] border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      Invitation to {inv.workspaceName || 'Organization Workspace'}
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Role: <strong className="text-white capitalize">{inv.appRole || inv.role || 'Member'}</strong>
                    </p>
                    <span className="text-[10px] text-slate-500 block mt-1">
                      Expires: {new Date(inv.expiresAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => handleAcceptInvitation(inv.token || inv.id)}
                      className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                    >
                      <Check className="w-3.5 h-3.5" /> Accept & Join
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
