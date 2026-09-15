import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useBranchStore } from '@/stores/useBranchStore';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Users,
  UserPlus,
  ArrowRightLeft,
  Mail,
  Clock,
  CheckCircle,
  AlertCircle,
  Search,
  Building2,
  Lock,
  Unlock,
  Trash2,
  History,
  RotateCw,
  Shield,
  PlusCircle,
} from 'lucide-react';

import { InviteBranchMemberModal } from '@/components/team/InviteBranchMemberModal';
import { TransferStaffModal, StaffMember } from '@/components/team/TransferStaffModal';
import { SuspendStaffModal } from '@/components/team/SuspendStaffModal';
import { RemoveStaffModal } from '@/components/team/RemoveStaffModal';
import { AddBranchAccessModal } from '@/components/team/AddBranchAccessModal';
import { StaffAccessSummaryModal } from '@/components/team/StaffAccessSummaryModal';

interface PendingInvitation {
  id: string;
  email: string;
  role: string;
  branchIds?: string[];
  branchName?: string;
  status: string;
  expiresAt: number;
  createdAt: number;
}

interface TransferRecord {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  sourceBranchName: string;
  targetBranchName: string;
  previousRole: string;
  newRole: string;
  transferredBy: string;
  effectiveDate: number;
  message?: string;
  createdAt: number;
}

export const BranchTeamManagement: React.FC = () => {
  const [searchParams] = useSearchParams();
  const urlOrg = searchParams.get('org');
  const { currentWorkspace } = useWorkspaceStore();
  const { branches } = useBranchStore();

  const [activeSubTab, setActiveSubTab] = useState<'active' | 'suspended' | 'invitations' | 'transfers'>('active');
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [transfers, setTransfers] = useState<TransferRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [selectedRole, setSelectedRole] = useState<string>('all');

  // Modals
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [transferTargetMember, setTransferTargetMember] = useState<StaffMember | null>(null);
  const [suspendTargetMember, setSuspendTargetMember] = useState<StaffMember | null>(null);
  const [removeTargetMember, setRemoveTargetMember] = useState<StaffMember | null>(null);
  const [addBranchTargetMember, setAddBranchTargetMember] = useState<StaffMember | null>(null);
  const [accessSummaryTargetMember, setAccessSummaryTargetMember] = useState<StaffMember | null>(null);

  const workspaceId = urlOrg || currentWorkspace?.id || '';

  const branchOptions = useMemo(() => {
    return branches.map((b) => ({
      id: b.id || (b as any)._id,
      name: b.name,
      code: b.code,
      city: b.city,
    }));
  }, [branches]);

  const loadData = async () => {
    if (!workspaceId) return;
    setIsLoading(true);
    try {
      const [membersRes, invitesRes, transfersRes] = await Promise.all([
        api
          .get<{ members: StaffMember[] }>(
            `/workspaces/${workspaceId}/applications/inventory/members`
          )
          .catch(() => ({ members: [] })),
        api
          .get<{ invitations: PendingInvitation[] }>(
            `/workspaces/${workspaceId}/invitations`
          )
          .catch(() => ({ invitations: [] })),
        api
          .get<{ transfers: TransferRecord[] }>(
            `/workspaces/${workspaceId}/applications/inventory/transfers`
          )
          .catch(() => ({ transfers: [] })),
      ]);

      setMembers(membersRes.members || []);
      setInvitations((invitesRes.invitations || []).filter((i) => i.status === 'pending' || i.status === 'PENDING'));
      setTransfers(transfersRes.transfers || []);
    } catch (err: any) {
      toast.error('Failed to load branch team data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [workspaceId]);

  // Direct Restore action
  const handleRestore = async (memberId: string) => {
    try {
      await api.post(`/workspaces/${workspaceId}/applications/inventory/members/${memberId}/restore`);
      toast.success('Member branch access restored successfully.');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to restore member');
    }
  };

  const handleResendInvite = async (invitationId: string) => {
    try {
      await api.post(`/workspaces/${workspaceId}/applications/inventory/invitations/${invitationId}/resend`);
      toast.success('Invitation resent successfully.');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to resend invitation');
    }
  };

  const handleRevokeInvite = async (invitationId: string) => {
    if (!window.confirm('Are you sure you want to revoke this invitation?')) return;
    try {
      await api.post(`/workspaces/${workspaceId}/applications/inventory/invitations/${invitationId}/revoke`);
      toast.success('Invitation revoked.');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to revoke invitation');
    }
  };

  // Filter active and suspended staff
  const activeStaff = useMemo(() => {
    return members.filter((m) => m.status === 'active' || m.status === 'ACTIVE');
  }, [members]);

  const suspendedStaff = useMemo(() => {
    return members.filter((m) => m.status === 'suspended' || m.status === 'SUSPENDED');
  }, [members]);

  const displayedMembers = useMemo(() => {
    const list = activeSubTab === 'suspended' ? suspendedStaff : activeStaff;
    return list.filter((m) => {
      if (selectedBranchId !== 'all' && m.branchId !== selectedBranchId) return false;
      if (selectedRole !== 'all' && m.role !== selectedRole) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const name = m.user?.name?.toLowerCase() || '';
        const email = m.user?.email?.toLowerCase() || '';
        const branch = m.branchName?.toLowerCase() || '';
        if (!name.includes(q) && !email.includes(q) && !branch.includes(q)) return false;
      }
      return true;
    });
  }, [activeSubTab, activeStaff, suspendedStaff, selectedBranchId, selectedRole, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-emerald-950/30 border border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
            <Users className="w-4 h-4" />
            <span>Branch Staff & Access Governance</span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Store Team Management</h2>
          <p className="text-slate-400 text-sm max-w-xl">
            Assign, transfer, suspend, and govern store personnel across all branch locations with strict data preservation and audit trails.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={isLoading}
            className="border-slate-800 hover:bg-slate-800 text-slate-300 gap-1.5"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={() => setIsInviteOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold gap-2 shadow-lg shadow-emerald-950/40"
          >
            <UserPlus className="w-4 h-4" />
            Invite Staff Member
          </Button>
        </div>
      </div>

      {/* Sub-tabs Navigation */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActiveSubTab('active')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeSubTab === 'active'
                ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            Active Staff ({activeStaff.length})
          </button>
          <button
            onClick={() => setActiveSubTab('suspended')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeSubTab === 'suspended'
                ? 'bg-slate-800 text-amber-300 border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            Suspended Staff ({suspendedStaff.length})
            {suspendedStaff.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-400" />
            )}
          </button>
          <button
            onClick={() => setActiveSubTab('invitations')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeSubTab === 'invitations'
                ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            Pending Invites ({invitations.length})
            {invitations.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            )}
          </button>
          <button
            onClick={() => setActiveSubTab('transfers')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeSubTab === 'transfers'
                ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            Transfer History ({transfers.length})
          </button>
        </div>
      </div>

      {/* TAB 1 & 2: ACTIVE & SUSPENDED STAFF */}
      {(activeSubTab === 'active' || activeSubTab === 'suspended') && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative sm:col-span-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <Input
                placeholder="Search staff name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-slate-950/60 border-slate-800 text-white text-xs placeholder:text-slate-600 focus-visible:ring-emerald-500"
              />
            </div>

            <div>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-md bg-slate-950/60 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="all">All Branches</option>
                {branchOptions.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-md bg-slate-950/60 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="all">All Roles</option>
                <option value="cashier">Cashier</option>
                <option value="stock_manager">Stock Manager</option>
                <option value="inventory_manager">Inventory Manager</option>
                <option value="accountant">Accountant</option>
                <option value="inventory_owner">Inventory Owner</option>
                <option value="inventory_viewer">Inventory Viewer</option>
              </select>
            </div>
          </div>

          {/* Members Table */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden shadow-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-4">Assigned Branch</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {displayedMembers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500 space-y-2">
                      <Users className="w-8 h-8 mx-auto text-slate-600" />
                      <p>No {activeSubTab} staff members match your criteria.</p>
                    </td>
                  </tr>
                ) : (
                  displayedMembers.map((member) => (
                    <tr key={member.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-300 font-bold flex items-center justify-center uppercase shrink-0 border border-emerald-500/30">
                            {member.user?.name?.[0] || member.user?.email?.[0] || 'U'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-200 truncate">
                              {member.user?.name || 'Staff User'}
                            </p>
                            <p className="text-[11px] text-slate-400 truncate">{member.user?.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>{member.branchName}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                          {member.role.replace('_', ' ')}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        {member.status === 'active' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                            <CheckCircle className="w-3.5 h-3.5" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Suspended
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          {/* View Access Summary */}
                          <button
                            type="button"
                            onClick={() => setAccessSummaryTargetMember(member)}
                            title="View full access hierarchy & permissions"
                            className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
                          >
                            <Shield className="w-3.5 h-3.5" />
                          </button>

                          {/* Add Branch Access */}
                          <button
                            type="button"
                            onClick={() => setAddBranchTargetMember(member)}
                            title="Add access to another branch"
                            className="p-1.5 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition cursor-pointer"
                          >
                            <PlusCircle className="w-3.5 h-3.5" />
                          </button>

                          {/* Transfer */}
                          <button
                            type="button"
                            onClick={() => setTransferTargetMember(member)}
                            title="Transfer staff to another branch"
                            className="p-1.5 rounded-md bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 transition cursor-pointer"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                          </button>

                          {/* Suspend or Restore */}
                          {member.status === 'active' ? (
                            <button
                              type="button"
                              onClick={() => setSuspendTargetMember(member)}
                              title="Suspend branch access"
                              className="p-1.5 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 transition cursor-pointer"
                            >
                              <Lock className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleRestore(member.id)}
                              title="Restore branch access"
                              className="p-1.5 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition cursor-pointer"
                            >
                              <Unlock className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Remove */}
                          <button
                            type="button"
                            onClick={() => setRemoveTargetMember(member)}
                            title="Remove staff member"
                            className="p-1.5 rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: PENDING INVITATIONS */}
      {activeSubTab === 'invitations' && (
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden shadow-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Invitee Email</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Expires In</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {invitations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500 space-y-2">
                    <Mail className="w-8 h-8 mx-auto text-slate-600" />
                    <p>No pending branch invitations.</p>
                  </td>
                </tr>
              ) : (
                invitations.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-200">
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span>{inv.email}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                        {inv.role?.replace('_', ' ')}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span>{Math.max(0, Math.ceil((inv.expiresAt - Date.now()) / (1000 * 60 * 60 * 24)))} days</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-amber-500/10 text-amber-300 border border-amber-500/20">
                        Pending
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleResendInvite(inv.id)}
                        className="h-7 text-xs border-slate-700 text-slate-300 hover:bg-slate-800"
                      >
                        Resend
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevokeInvite(inv.id)}
                        className="h-7 text-xs text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
                      >
                        Revoke
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 4: TRANSFER HISTORY */}
      {activeSubTab === 'transfers' && (
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden shadow-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Staff Member</th>
                <th className="py-3 px-4">Source Branch</th>
                <th className="py-3 px-4">Destination Branch</th>
                <th className="py-3 px-4">Role Transition</th>
                <th className="py-3 px-4 text-right">Transferred By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {transfers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 space-y-2">
                    <History className="w-8 h-8 mx-auto text-slate-600" />
                    <p>No staff transfer logs recorded yet.</p>
                  </td>
                </tr>
              ) : (
                transfers.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-3.5 px-4 text-slate-400">
                      {new Date(t.createdAt).toLocaleDateString('en-GB')}
                    </td>

                    <td className="py-3.5 px-4 font-semibold text-slate-200">
                      {t.userName} ({t.userEmail})
                    </td>

                    <td className="py-3.5 px-4 text-slate-300">
                      {t.sourceBranchName}
                    </td>

                    <td className="py-3.5 px-4 text-emerald-400 font-medium">
                      {t.targetBranchName}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-mono text-[10px] text-slate-300">
                        {t.previousRole} → <strong className="text-emerald-300">{t.newRole}</strong>
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right text-slate-400">
                      {t.transferredBy}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      <InviteBranchMemberModal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        workspaceId={workspaceId}
        branches={branchOptions}
        onSuccess={loadData}
      />

      <TransferStaffModal
        isOpen={Boolean(transferTargetMember)}
        onClose={() => setTransferTargetMember(null)}
        workspaceId={workspaceId}
        member={transferTargetMember}
        branches={branchOptions}
        onSuccess={loadData}
      />

      <SuspendStaffModal
        isOpen={Boolean(suspendTargetMember)}
        onClose={() => setSuspendTargetMember(null)}
        workspaceId={workspaceId}
        member={suspendTargetMember}
        onSuccess={loadData}
      />

      <RemoveStaffModal
        isOpen={Boolean(removeTargetMember)}
        onClose={() => setRemoveTargetMember(null)}
        workspaceId={workspaceId}
        member={removeTargetMember}
        onSuccess={loadData}
      />

      <AddBranchAccessModal
        isOpen={Boolean(addBranchTargetMember)}
        onClose={() => setAddBranchTargetMember(null)}
        workspaceId={workspaceId}
        member={addBranchTargetMember}
        branches={branchOptions}
        onSuccess={loadData}
      />

      <StaffAccessSummaryModal
        isOpen={Boolean(accessSummaryTargetMember)}
        onClose={() => setAccessSummaryTargetMember(null)}
        workspaceId={workspaceId}
        member={accessSummaryTargetMember}
      />
    </div>
  );
};
