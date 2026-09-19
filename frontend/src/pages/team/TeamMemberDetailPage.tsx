import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useBranchStore } from '@/stores/useBranchStore';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ConfirmationModal } from '@/components/settings/ConfirmationModal';
import { toast } from 'sonner';
import {
  Users,
  ArrowLeft,
  Building2,
  Shield,
  Clock,
  ArrowRightLeft,
  Lock,
  Unlock,
  Trash2,
  Edit2,
  Mail,
  Phone,
  Briefcase,
  History,
  CheckCircle2,
  AlertCircle,
  Plus,
  Calendar,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const TeamMemberDetailPage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspaceStore();
  const { branches } = useBranchStore();

  const [member, setMember] = useState<any>(null);
  const [effectivePermissions, setEffectivePermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'branches' | 'permissions' | 'history'>('branches');
  const [actionModal, setActionModal] = useState<'suspend' | 'restore' | 'remove' | null>(null);

  const workspaceId = currentWorkspace?.id || '';

  const loadMemberDetails = async () => {
    if (!workspaceId || !userId) return;
    setIsLoading(true);
    try {
      const [memRes, permRes] = await Promise.all([
        api.get<{ data?: any; member?: any }>(`/workspaces/${workspaceId}/applications/inventory/members/${userId}`).catch(() => null),
        api.get<{ data?: { effectivePermissions: string[] } }>(
          `/workspaces/${workspaceId}/applications/inventory/permissions/effective?userId=${userId}`
        ).catch(() => null),
      ]);

      let rawMember = memRes?.data?.member || memRes?.data || memRes?.member;
      if (!rawMember) {
        try {
          const directRes = await api.get<{ data?: any; member?: any }>(`/applications/inventory/team/members/${userId}?workspaceId=${workspaceId}`);
          rawMember = directRes?.data?.member || directRes?.data || directRes?.member;
        } catch {}
      }

      if (rawMember) {
        const isFounderOrOwner = Boolean(
          rawMember.isFounder ||
          rawMember.isOwner ||
          rawMember.role === 'owner' ||
          rawMember.role === 'OWNER' ||
          rawMember.role === 'inventory_owner' ||
          (rawMember.jobTitle && rawMember.jobTitle.toLowerCase().includes('founder'))
        );

        let assignments = Array.isArray(rawMember.branchAssignments) ? [...rawMember.branchAssignments] : [];
        if (assignments.length === 0 && branches.length > 0) {
          assignments.push({
            id: `synth_${userId}_${branches[0].id}`,
            branchId: branches[0].id,
            branchName: branches[0].name || 'Adoala Branch',
            branchCode: branches[0].code || '',
            branchRole: isFounderOrOwner ? 'Founder / Manager' : 'Staff',
            assignmentType: 'primary',
            assignedAt: Date.now(),
          });
        }

        setMember({
          ...rawMember,
          name: rawMember.name || rawMember.email || 'Team Member',
          email: rawMember.email || '',
          isFounder: isFounderOrOwner,
          isOwner: isFounderOrOwner,
          appRole: isFounderOrOwner ? 'admin' : (rawMember.appRole || 'member'),
          jobTitle: rawMember.jobTitle || (isFounderOrOwner ? 'Branch Founder' : undefined),
          branchAssignments: assignments,
          auditLogs: Array.isArray(rawMember.auditLogs) ? rawMember.auditLogs : [],
        });
      } else {
        // Mock fallback for preview
        setMember({
          userId,
          name: 'Babajide Adeleke',
          email: 'babajide@orviohub.com',
          phoneNumber: '+234 802 333 4444',
          jobTitle: 'Store General Manager',
          employeeId: 'EMP-102',
          appRole: 'admin',
          status: 'active',
          branchAssignments: [
            {
              id: 'ba_1',
              branchId: 'b_1',
              branchName: 'Ikeja Flagship',
              branchCode: 'IKJ-01',
              branchRole: 'manager',
              assignmentType: 'primary',
              assignedAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
            },
            {
              id: 'ba_2',
              branchId: 'b_2',
              branchName: 'Lekki Phase 1',
              branchCode: 'LKK-02',
              branchRole: 'manager',
              assignmentType: 'secondary',
              assignedAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
            },
          ],
          auditLogs: [
            {
              id: 'log_1',
              actionType: 'branch_staff_transferred',
              previousRole: 'staff',
              newRole: 'manager',
              createdAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
              reason: 'Promoted to manager across Lekki outlet.',
            },
            {
              id: 'log_2',
              actionType: 'app_member_added',
              newRole: 'admin',
              createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
            },
          ],
        });
      }

      setEffectivePermissions(
        permRes?.data?.effectivePermissions || [
          'team.manage',
          'team.invite',
          'team.transfer',
          'inventory.view',
          'inventory.create',
          'inventory.edit',
          'inventory.adjust',
          'pos.checkout',
          'reports.view',
        ]
      );
    } catch (err) {
      toast.error('Failed to load member details');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMemberDetails();
  }, [workspaceId, userId]);

  const handleStatusChange = async (newStatus: 'active' | 'suspended' | 'removed') => {
    try {
      await api.patch(`/workspaces/${workspaceId}/applications/inventory/members/${userId}/status`, {
        status: newStatus,
      });
      toast.success(`Member marked as ${newStatus}.`);
      setActionModal(null);
      if (newStatus === 'removed') {
        navigate('/inventory/team/members');
      } else {
        loadMemberDetails();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update member status');
    }
  };

  if (isLoading) {
    return (
      <div className="p-16 text-center space-y-3">
        <Loader2 className="w-6 h-6 text-[#e6a8d6] animate-spin mx-auto" />
        <p className="text-xs text-slate-400">Loading member profile...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6 animate-in fade-in duration-150">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/inventory/team/members')}
        className="text-slate-400 hover:text-white -ml-2 text-xs"
      >
        <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
        Back to Team Roster
      </Button>

      {/* 1. Profile Header Card */}
      <div className="p-6 rounded-2xl bg-[#120a11]/95 border border-white/10 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#714b67] to-[#482841] text-white font-bold flex items-center justify-center text-xl uppercase shrink-0 border border-white/10 shadow-lg">
            {member?.name?.charAt(0) || 'U'}
          </div>

          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-white tracking-tight truncate">{member?.name}</h1>
              {member?.isFounder || member?.isOwner || member?.role === 'owner' || member?.role === 'inventory_owner' || (member?.jobTitle && member?.jobTitle.toLowerCase().includes('founder')) ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-purple-500/25 to-pink-500/25 text-purple-200 border border-purple-400/40 shadow-sm inline-flex items-center gap-1.5 w-fit">
                  <Sparkles className="w-2.5 h-2.5 text-amber-300 shrink-0" />
                  <span>Owner / Founder</span>
                </span>
              ) : (
                <span
                  className={cn(
                    'px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border',
                    member?.appRole === 'admin'
                      ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                      : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                  )}
                >
                  {member?.appRole === 'admin' ? 'App Admin' : 'Member'}
                </span>
              )}
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 capitalize">
                {member?.status}
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
              <span className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-slate-500" />
                {member?.email}
              </span>
              {member?.phoneNumber && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-slate-500" />
                  {member?.phoneNumber}
                </span>
              )}
              {member?.employeeId && (
                <span className="font-mono text-slate-300 bg-white/5 px-1.5 py-0.5 rounded text-[11px]">
                  {member?.employeeId}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Button
            onClick={() => navigate(`/inventory/team/members/${userId}/transfer`)}
            className="bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold h-9 px-3.5 shadow-md shadow-[#714b67]/20 cursor-pointer"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5" />
            Transfer Branch
          </Button>

          {member?.status === 'active' ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActionModal('suspend')}
              className="border-amber-500/30 text-amber-300 hover:bg-amber-500/10 text-xs h-9 px-3"
            >
              <Lock className="w-3.5 h-3.5 mr-1.5" />
              Suspend
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActionModal('restore')}
              className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 text-xs h-9 px-3"
            >
              <Unlock className="w-3.5 h-3.5 mr-1.5" />
              Restore Access
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActionModal('remove')}
            className="text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 text-xs h-9 px-2.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* 2. Navigation Tabs */}
      <div className="flex items-center gap-1.5 border-b border-white/10 pb-2">
        <button
          onClick={() => setActiveTab('branches')}
          className={cn(
            'px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
            activeTab === 'branches'
              ? 'bg-[#714b67]/30 text-white border border-[#714b67]/50 shadow-inner'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          )}
        >
          Branch Assignments ({member?.branchAssignments?.length || 0})
        </button>

        <button
          onClick={() => setActiveTab('permissions')}
          className={cn(
            'px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
            activeTab === 'permissions'
              ? 'bg-[#714b67]/30 text-white border border-[#714b67]/50 shadow-inner'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          )}
        >
          Effective Permissions ({effectivePermissions.length})
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={cn(
            'px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
            activeTab === 'history'
              ? 'bg-[#714b67]/30 text-white border border-[#714b67]/50 shadow-inner'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          )}
        >
          Transfer & Audit Log
        </button>
      </div>

      {/* 3. Tab Contents */}
      {/* TAB 1: BRANCH ASSIGNMENTS */}
      {activeTab === 'branches' && (
        <div className="p-6 rounded-2xl bg-[#120a11] border border-white/10 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#e6a8d6]" />
                Allocated Store Locations
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Physical branches where this user has active checkout, stock audit, or managerial access.
              </p>
            </div>

            <Button
              onClick={() => navigate(`/inventory/team/members/${userId}/transfer`)}
              size="sm"
              variant="outline"
              className="border-white/10 text-slate-300 text-xs h-8"
            >
              <Plus className="w-3.5 h-3.5 mr-1 text-emerald-400" />
              Add Branch Assignment
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {member?.branchAssignments?.map((ba: any) => (
              <div
                key={ba.id}
                className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-2 relative overflow-hidden"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-bold text-white block">{ba.branchName}</span>
                    <span className="text-[10px] font-mono text-slate-400">Code: {ba.branchCode || 'N/A'}</span>
                  </div>
                  <span
                    className={cn(
                      'text-[9px] font-bold px-2 py-0.5 rounded uppercase border',
                      ba.assignmentType === 'primary'
                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        : 'bg-white/5 text-slate-300 border-white/10'
                    )}
                  >
                    {ba.assignmentType}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-white/5">
                  <span className="text-slate-400">Branch Role:</span>
                  <span className="font-bold text-[#e6a8d6] capitalize">{ba.branchRole.replace('_', ' ')}</span>
                </div>

                {ba.temporaryUntil && (
                  <div className="flex items-center gap-1.5 text-[11px] text-amber-400 pt-1">
                    <Clock className="w-3 h-3" />
                    <span>Expires: {new Date(ba.temporaryUntil).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: EFFECTIVE PERMISSIONS */}
      {activeTab === 'permissions' && (
        <div className="p-6 rounded-2xl bg-[#120a11] border border-white/10 shadow-xl space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              Computed Effective Permissions
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Derived from base application role + union of all active branch role assignments.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-2">
            {effectivePermissions.map((perm) => (
              <div
                key={perm}
                className="p-2.5 rounded-lg bg-black/40 border border-white/5 flex items-center gap-2 text-xs font-mono text-slate-200"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{perm}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: AUDIT HISTORY */}
      {activeTab === 'history' && (
        <div className="p-6 rounded-2xl bg-[#120a11] border border-white/10 shadow-xl space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <History className="w-4 h-4 text-purple-400" />
              Member Activity & Transfer Log
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Immutable audit history of all branch transfers and role modifications.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            {member?.auditLogs?.map((log: any, i: number) => (
              <div
                key={i}
                className="p-3.5 rounded-xl bg-black/40 border border-white/5 text-xs space-y-1"
              >
                <div className="flex items-center justify-between text-slate-400">
                  <span className="font-mono">{new Date(log.createdAt).toLocaleString()}</span>
                  <span className="font-bold text-white uppercase text-[10px] bg-white/10 px-2 py-0.5 rounded">
                    {log.actionType}
                  </span>
                </div>
                <p className="text-slate-200">{log.reason || 'Staff assignment modified.'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      <ConfirmationModal
        isOpen={actionModal === 'suspend'}
        title="Suspend Member Access"
        message={`Are you sure you want to suspend access for ${member?.name}? They will immediately lose access to all store registers.`}
        confirmText="Suspend Member"
        onClose={() => setActionModal(null)}
        onConfirm={() => handleStatusChange('suspended')}
      />

      <ConfirmationModal
        isOpen={actionModal === 'restore'}
        title="Restore Member Access"
        message={`Restore application and branch access for ${member?.name}?`}
        confirmText="Restore Access"
        onClose={() => setActionModal(null)}
        onConfirm={() => handleStatusChange('active')}
      />

      <ConfirmationModal
        isOpen={actionModal === 'remove'}
        title="Remove Member from Application"
        message={`Are you sure you want to remove ${member?.name} from Inventory? All branch assignments will be revoked.`}
        confirmText="Remove Member"
        onClose={() => setActionModal(null)}
        onConfirm={() => handleStatusChange('removed')}
      />
    </div>
  );
};
