import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { CustomSelect } from '@/components/ui/custom-select';
import { WorkspaceSwitcher } from '@/components/workspace/WorkspaceSwitcher';
import { toast } from 'sonner';
import {
  Users,
  UserPlus,
  Mail,
  ShieldAlert,
  Search,
  Trash2,
  Ban,
  X,
  Store,
  ChevronLeft,
  Layers,
  ShieldCheck,
  Sliders,
} from 'lucide-react';

interface MemberRecord {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatar?: string;
  role: string;
  status: string;
  createdAt: number;
  productAccess?: Array<{
    id: string;
    productKey: string;
    role: string;
    permissions: string[];
    branchIds?: string[];
    status: string;
  }>;
}

interface AppAccessItem {
  productKey: string;
  productName?: string;
  appRole: string;
  branchIds: string[];
  branches?: Array<{
    id: string;
    name: string;
    code?: string;
    city?: string;
    state?: string;
  }>;
}

interface InvitationRecord {
  id: string;
  email: string;
  role: string;
  organizationRole?: string;
  productKey?: string;
  appAccess?: AppAccessItem[];
  branchIds?: string[];
  status: string;
  expiresAt: number;
  isExpired: boolean;
  createdAt: number;
}

interface BranchItem {
  id: string;
  name: string;
  code?: string;
  productKey?: string;
  isPrimary?: boolean;
  city?: string;
  state?: string;
}

interface AppAccessConfig {
  productKey: string;
  name: string;
  enabled: boolean;
  role: string;
  supportsBranches: boolean;
  branchIds: string[];
}

const DEFAULT_APPS: AppAccessConfig[] = [
  {
    productKey: 'inventory',
    name: 'Inventory Management',
    enabled: true,
    role: 'inventory_manager',
    supportsBranches: true,
    branchIds: [],
  },
  {
    productKey: 'pos',
    name: 'Point of Sale (POS)',
    enabled: false,
    role: 'cashier',
    supportsBranches: true,
    branchIds: [],
  },
  {
    productKey: 'taskmanagement',
    name: 'Task & Workflow Management',
    enabled: false,
    role: 'contributor',
    supportsBranches: false,
    branchIds: [],
  },
];

const APP_ROLES: Record<string, Array<{ value: string; label: string }>> = {
  inventory: [
    { value: 'inventory_manager', label: 'Inventory Manager' },
    { value: 'stock_manager', label: 'Stock Keeper' },
    { value: 'sales_attendant', label: 'Sales Attendant' },
    { value: 'cashier', label: 'Cashier' },
  ],
  pos: [
    { value: 'store_manager', label: 'Store Manager' },
    { value: 'cashier', label: 'Cashier' },
    { value: 'supervisor', label: 'Supervisor' },
  ],
  taskmanagement: [
    { value: 'project_lead', label: 'Project Lead' },
    { value: 'contributor', label: 'Contributor' },
    { value: 'viewer', label: 'Viewer' },
  ],
};

const ORG_ROLES = [
  { value: 'admin', label: 'Admin (Full Management & Team Controls)' },
  { value: 'manager', label: 'Manager (Operations & Resource Management)' },
  { value: 'staff', label: 'Staff (Standard Operational Access)' },
  { value: 'viewer', label: 'Viewer (Read-Only Organization Access)' },
];

export const WorkspaceMembers: React.FC = () => {
  const navigate = useNavigate();
  const { currentWorkspace, currentRole, hasPermission } = useWorkspaceStore();

  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [invitations, setInvitations] = useState<InvitationRecord[]>([]);
  const [workspaceBranches, setWorkspaceBranches] = useState<BranchItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'members' | 'invitations'>('members');

  // Modal states for Invite
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteOrgRole, setInviteOrgRole] = useState('staff');
  const [inviteApps, setInviteApps] = useState<AppAccessConfig[]>(DEFAULT_APPS);
  const [inviteMessage, setInviteMessage] = useState('');

  // Granular Access Edit Modal
  const [editMember, setEditMember] = useState<MemberRecord | null>(null);
  const [editAccessData, setEditAccessData] = useState<{
    organizationRole: string;
    apps: Array<{
      productKey: string;
      productName: string;
      supportsBranches: boolean;
      hasAccess: boolean;
      role: string;
      branchIds: string[];
    }>;
  } | null>(null);
  const [_isLoadingAccess, setIsLoadingAccess] = useState(false);
  const [isSavingAccess, setIsSavingAccess] = useState(false);

  // Suspend/Remove Modals
  const [actionMember, setActionMember] = useState<MemberRecord | null>(null);
  const [actionType, setActionType] = useState<'suspend' | 'remove' | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  const canManageMembers =
    hasPermission('workspace.manage_members') || currentRole === 'owner' || currentRole === 'admin';

  const loadData = async () => {
    if (!currentWorkspace?.id) return;
    setIsLoading(true);
    try {
      const [membersRes, invitesRes, branchesRes] = await Promise.all([
        api.get<{ members: MemberRecord[] }>(`/workspaces/${currentWorkspace.id}/members`),
        api.get<{ invitations: InvitationRecord[] }>(`/workspaces/${currentWorkspace.id}/invitations`),
        api.get<{ branches: BranchItem[] }>(`/workspaces/${currentWorkspace.id}/branches`).catch(() => ({ branches: [] })),
      ]);
      setMembers(membersRes.members || []);
      setInvitations(invitesRes.invitations || []);
      const branchesList = branchesRes.branches || [];
      setWorkspaceBranches(branchesList);

      // Pre-populate branches for inventory/pos default apps
      if (branchesList.length > 0) {
        setInviteApps((prev) =>
          prev.map((app) =>
            app.supportsBranches && app.branchIds.length === 0
              ? { ...app, branchIds: [branchesList[0].id] }
              : app
          )
        );
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load team data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentWorkspace?.id]);

  // Handle Invitation Submission with Hybrid App & Branch permissions
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !currentWorkspace?.id) return;

    const enabledApps = inviteApps.filter((a) => a.enabled);
    const appAccessPayload = enabledApps.map((a) => ({
      productKey: a.productKey,
      appRole: a.role,
      branchIds: a.supportsBranches ? a.branchIds : [],
    }));

    setIsSubmittingInvite(true);
    try {
      await api.post(`/workspaces/${currentWorkspace.id}/invitations`, {
        email: inviteEmail.trim().toLowerCase(),
        organizationRole: inviteOrgRole,
        role: inviteOrgRole,
        appAccess: appAccessPayload,
        message: inviteMessage.trim() || undefined,
      });

      toast.success(`Invitation sent to ${inviteEmail}`);
      setIsInviteModalOpen(false);
      setInviteEmail('');
      setInviteMessage('');
      setInviteApps(DEFAULT_APPS);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send invitation');
    } finally {
      setIsSubmittingInvite(false);
    }
  };

  // Open Edit Access Modal and load member access matrix
  const handleOpenEditAccess = async (m: MemberRecord) => {
    if (!currentWorkspace?.id) return;
    setEditMember(m);
    setIsLoadingAccess(true);
    try {
      const res = await api.get<{ data: any }>(
        `/workspaces/${currentWorkspace.id}/members/${m.userId}/access`
      );
      setEditAccessData({
        organizationRole: res.data.organizationRole || m.role,
        apps: res.data.apps || [],
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to load member access');
      setEditMember(null);
    } finally {
      setIsLoadingAccess(false);
    }
  };

  // Save Granular Member Access changes
  const handleSaveMemberAccess = async () => {
    if (!editMember || !editAccessData || !currentWorkspace?.id) return;
    setIsSavingAccess(true);
    try {
      await api.patch(`/workspaces/${currentWorkspace.id}/members/${editMember.userId}/access`, {
        organizationRole: editAccessData.organizationRole,
        appAccess: editAccessData.apps.map((app) => ({
          productKey: app.productKey,
          enabled: app.hasAccess,
          appRole: app.role,
          branchIds: app.supportsBranches ? app.branchIds : [],
        })),
      });

      toast.success(`Updated permissions for ${editMember.name}`);
      setEditMember(null);
      setEditAccessData(null);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update member access');
    } finally {
      setIsSavingAccess(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!actionMember || !actionType || !currentWorkspace?.id) return;
    setIsProcessingAction(true);
    try {
      if (actionType === 'suspend') {
        await api.post(`/workspaces/${currentWorkspace.id}/members/${actionMember.id}/suspend`, {
          reason: actionReason || undefined,
        });
        toast.success(`Suspended ${actionMember.name}`);
      } else if (actionType === 'remove') {
        await api.delete(`/workspaces/${currentWorkspace.id}/members/${actionMember.id}`, {
          data: { reason: actionReason || undefined },
        });
        toast.success(`Removed ${actionMember.name} from workspace`);
      }
      setActionMember(null);
      setActionType(null);
      setActionReason('');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || `Failed to ${actionType} member`);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleRestoreMember = async (membershipId: string, memberName: string) => {
    if (!currentWorkspace?.id) return;
    try {
      await api.post(`/workspaces/${currentWorkspace.id}/members/${membershipId}/restore`);
      toast.success(`Restored ${memberName}`);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to restore member');
    }
  };

  const handleResendInvite = async (invitationId: string) => {
    if (!currentWorkspace?.id) return;
    try {
      await api.post(`/workspaces/${currentWorkspace.id}/invitations/${invitationId}/resend`);
      toast.success('Invitation resent successfully.');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to resend invitation');
    }
  };

  const handleRevokeInvite = async (invitationId: string) => {
    if (!currentWorkspace?.id) return;
    try {
      await api.post(`/workspaces/${currentWorkspace.id}/invitations/${invitationId}/revoke`);
      toast.success('Invitation revoked.');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to revoke invitation');
    }
  };

  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return members;
    const q = searchQuery.toLowerCase();
    return members.filter(
      (m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    );
  }, [members, searchQuery]);

  const filteredInvitations = useMemo(() => {
    if (!searchQuery.trim()) return invitations;
    const q = searchQuery.toLowerCase();
    return invitations.filter((inv) => inv.email.toLowerCase().includes(q));
  }, [invitations, searchQuery]);

  const activeMembersCount = members.filter((m) => m.status.toLowerCase() === 'active').length;
  const pendingInvitesCount = invitations.filter(
    (inv) => inv.status.toLowerCase() === 'pending' && !inv.isExpired
  ).length;
  const suspendedCount = members.filter((m) => m.status.toLowerCase() === 'suspended').length;

  return (
    <div className="min-h-screen bg-black text-slate-100 flex flex-col justify-between">
      {/* Universal Settings Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/settings')}
              className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white tracking-tight">
                  Team Members & Access
                </h1>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold uppercase">
                  {currentRole}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Manage organization roles, application access, and branch assignments
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <WorkspaceSwitcher />
            {canManageMembers && (
              <Button
                onClick={() => setIsInviteModalOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-lg h-9 shadow-md shadow-indigo-600/20 flex items-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Invite Member</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 space-y-6">
        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-400">Active Members</span>
              <p className="text-xl font-bold text-white">{activeMembersCount}</p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-400">Pending Invitations</span>
              <p className="text-xl font-bold text-white">{pendingInvitesCount}</p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-400">Suspended</span>
              <p className="text-xl font-bold text-white">{suspendedCount}</p>
            </div>
          </div>
        </div>

        {/* Tab & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('members')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'members'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              Active Members ({members.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('invitations')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'invitations'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              Pending Invitations ({invitations.length})
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or email..."
              className="pl-9 bg-slate-900/90 border-slate-800 text-white text-xs rounded-lg h-9"
            />
          </div>
        </div>

        {/* Tables */}
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Spinner className="w-6 h-6 text-indigo-500" />
            <p className="text-xs">Loading members & invitations...</p>
          </div>
        ) : activeTab === 'members' ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3.5">Member</th>
                  <th className="p-3.5">Organization Role</th>
                  <th className="p-3.5">Application & Branch Permissions</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">
                      No members found matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((m) => {
                    const isOwner = m.role.toLowerCase() === 'owner';
                    const isSuspended = m.status.toLowerCase() === 'suspended';

                    return (
                      <tr key={m.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-indigo-950 border border-indigo-500/30 text-indigo-300 flex items-center justify-center font-bold text-xs">
                              {m.name ? m.name.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <div>
                              <p className="font-semibold text-white">{m.name}</p>
                              <p className="text-[11px] text-slate-500">{m.email}</p>
                            </div>
                          </div>
                        </td>

                        <td className="p-3.5">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold ${
                              isOwner
                                ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                                : m.role.toLowerCase() === 'admin'
                                ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {m.role}
                          </span>
                        </td>

                        <td className="p-3.5">
                          {m.productAccess && m.productAccess.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-1.5">
                              {m.productAccess.map((pa) => (
                                <span
                                  key={pa.id || pa.productKey}
                                  className="inline-flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded"
                                >
                                  <Store className="w-3 h-3" />
                                  <span className="capitalize">{pa.productKey}:</span>
                                  <span className="text-white capitalize">
                                    {pa.role.replace('_', ' ')}
                                  </span>
                                  {pa.branchIds && pa.branchIds.length > 0 && (
                                    <span className="text-[9px] text-emerald-300/80 bg-emerald-950/80 px-1 py-0.2 rounded ml-0.5">
                                      {pa.branchIds.length} br.
                                    </span>
                                  )}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-500 italic">Organization only</span>
                          )}
                        </td>

                        <td className="p-3.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                              isSuspended
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isSuspended ? 'bg-rose-400' : 'bg-emerald-400'
                              }`}
                            />
                            <span className="capitalize">{m.status}</span>
                          </span>
                        </td>

                        <td className="p-3.5 text-right space-x-1">
                          {canManageMembers && !isOwner && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenEditAccess(m)}
                                className="h-7 text-xs text-indigo-400 hover:text-white hover:bg-indigo-500/10 cursor-pointer"
                              >
                                <Sliders className="w-3 h-3 mr-1" />
                                Permissions
                              </Button>

                              {isSuspended ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRestoreMember(m.id, m.name)}
                                  className="h-7 text-xs text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
                                >
                                  Restore
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setActionMember(m);
                                    setActionType('suspend');
                                  }}
                                  className="h-7 text-xs text-amber-400 hover:bg-amber-500/10 cursor-pointer"
                                >
                                  <Ban className="w-3 h-3 mr-1" />
                                  Suspend
                                </Button>
                              )}

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setActionMember(m);
                                  setActionType('remove');
                                }}
                                className="h-7 text-xs text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3.5">Email</th>
                  <th className="p-3.5">Organization Role</th>
                  <th className="p-3.5">Applications & Branches</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Expires</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredInvitations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      No invitations found.
                    </td>
                  </tr>
                ) : (
                  filteredInvitations.map((inv) => {
                    const isPending = inv.status.toLowerCase() === 'pending' && !inv.isExpired;
                    return (
                      <tr key={inv.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3.5 font-medium text-white">{inv.email}</td>
                        <td className="p-3.5 uppercase font-mono text-[10px] text-indigo-400 font-semibold">
                          {inv.organizationRole || inv.role}
                        </td>
                        <td className="p-3.5 text-slate-300">
                          {inv.appAccess && inv.appAccess.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {inv.appAccess.map((app) => (
                                <span
                                  key={app.productKey}
                                  className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300"
                                >
                                  {app.productName || app.productKey} ({app.appRole.replace('_', ' ')})
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="capitalize text-slate-400">
                              {inv.productKey || 'All'}
                            </span>
                          )}
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                              isPending
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : inv.status === 'accepted'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-slate-800 text-slate-500'
                            }`}
                          >
                            {inv.isExpired ? 'Expired' : inv.status}
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-400">
                          {new Date(inv.expiresAt).toLocaleDateString()}
                        </td>
                        <td className="p-3.5 text-right space-x-1">
                          {canManageMembers && isPending && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleResendInvite(inv.id)}
                                className="h-7 text-xs text-indigo-400 hover:bg-indigo-500/10 cursor-pointer"
                              >
                                Resend
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRevokeInvite(inv.id)}
                                className="h-7 text-xs text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                              >
                                Revoke
                              </Button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Modern Hybrid Invite Member Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f0a0d] border border-white/10 rounded-2xl p-6 max-w-xl w-full shadow-2xl space-y-6 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Invite Team Member</h2>
                  <p className="text-[11px] text-slate-400">
                    Assign organization role and scoped application & branch access
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSendInvite} className="space-y-5">
              {/* Email Address */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Email Address *</label>
                <Input
                  type="email"
                  required
                  placeholder="colleague@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="bg-black/60 border-white/10 text-white text-xs rounded-lg"
                />
              </div>

              {/* Organization Role */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Organization Role *</label>
                <CustomSelect
                  options={ORG_ROLES}
                  value={inviteOrgRole}
                  onChange={(val) => setInviteOrgRole(val)}
                  searchable={false}
                />
              </div>

              {/* Application & Branch Permissions Checklist */}
              <div className="space-y-3 pt-2 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-400" />
                    Applications & Branches Access
                  </label>
                  <span className="text-[10px] text-slate-400">Select modules to provision</span>
                </div>

                <div className="space-y-3">
                  {inviteApps.map((app, appIdx) => {
                    const rolesForApp = APP_ROLES[app.productKey] || [
                      { value: 'staff', label: 'Staff' },
                    ];

                    return (
                      <div
                        key={app.productKey}
                        className={`p-3.5 rounded-xl border transition-colors ${
                          app.enabled
                            ? 'bg-white/[0.03] border-indigo-500/40'
                            : 'bg-black/40 border-white/5 opacity-75'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <label className="flex items-center gap-2.5 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={app.enabled}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setInviteApps((prev) =>
                                  prev.map((item, i) =>
                                    i === appIdx ? { ...item, enabled: checked } : item
                                  )
                                );
                              }}
                              className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                            />
                            <span className="text-xs font-bold text-white flex items-center gap-1.5">
                              <Store className="w-3.5 h-3.5 text-emerald-400" />
                              {app.name}
                            </span>
                          </label>

                          {app.enabled && (
                            <div className="w-48">
                              <CustomSelect
                                options={rolesForApp}
                                value={app.role}
                                onChange={(val) => {
                                  setInviteApps((prev) =>
                                    prev.map((item, i) =>
                                      i === appIdx ? { ...item, role: val } : item
                                    )
                                  );
                                }}
                                searchable={false}
                              />
                            </div>
                          )}
                        </div>

                        {/* Branch Selection for apps supporting branches */}
                        {app.enabled && app.supportsBranches && (
                          <div className="mt-3 pt-2.5 border-t border-white/5 space-y-2">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-400 font-medium">
                                Assigned Branches:
                              </span>
                              <span className="text-[10px] text-slate-500">
                                {workspaceBranches.length} branch(es) available
                              </span>
                            </div>

                            {workspaceBranches.length === 0 ? (
                              <p className="text-[11px] text-amber-400 italic">
                                No branches created yet. Default primary branch will be assigned upon creation.
                              </p>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {workspaceBranches.map((b) => {
                                  const isSelected = app.branchIds.includes(b.id);
                                  return (
                                    <label
                                      key={b.id}
                                      className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer select-none transition-colors ${
                                        isSelected
                                          ? 'bg-emerald-500/10 border-emerald-500/30 text-white'
                                          : 'bg-black/30 border-white/5 text-slate-400 hover:text-slate-200'
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={(e) => {
                                          const checked = e.target.checked;
                                          setInviteApps((prev) =>
                                            prev.map((item, i) => {
                                              if (i !== appIdx) return item;
                                              const nextBranches = checked
                                                ? [...item.branchIds, b.id]
                                                : item.branchIds.filter((id) => id !== b.id);
                                              return { ...item, branchIds: nextBranches };
                                            })
                                          );
                                        }}
                                        className="rounded bg-slate-900 border-slate-700 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer"
                                      />
                                      <span className="truncate">
                                        {b.name} {b.city ? `(${b.city})` : ''}
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}

                        {app.enabled && !app.supportsBranches && (
                          <div className="mt-2 text-[11px] text-slate-400 italic">
                            Organization-wide access (Branch assignment not required for this app)
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Live Permission Summary Card */}
              <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-2 text-xs">
                <span className="font-bold text-white flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-indigo-300">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Permission Review Summary
                </span>
                <div className="space-y-1 text-slate-300 text-[11px]">
                  <p>
                    <span className="text-slate-500">Org Role:</span>{' '}
                    <strong className="text-white capitalize">{inviteOrgRole}</strong>
                  </p>
                  <div>
                    <span className="text-slate-500">Apps:</span>
                    {inviteApps.filter((a) => a.enabled).length === 0 ? (
                      <span className="text-amber-400 ml-1">
                        No apps granted (Organization access only)
                      </span>
                    ) : (
                      <ul className="list-disc list-inside mt-0.5 space-y-0.5 pl-1">
                        {inviteApps
                          .filter((a) => a.enabled)
                          .map((a) => (
                            <li key={a.productKey}>
                              <strong className="text-white">{a.name}</strong>:{' '}
                              <span className="text-emerald-400 capitalize">
                                {a.role.replace('_', ' ')}
                              </span>
                              {a.supportsBranches && (
                                <span className="text-slate-400 ml-1">
                                  (
                                  {a.branchIds.length > 0
                                    ? `${a.branchIds.length} branch(es)`
                                    : 'No branch selected'}
                                  )
                                </span>
                              )}
                            </li>
                          ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Personal Message (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Welcome to our team! Here is your invitation link."
                  value={inviteMessage}
                  onChange={(e) => setInviteMessage(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-black/60 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="border-white/10 bg-transparent text-slate-300 text-xs rounded-lg cursor-pointer hover:bg-white/5"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmittingInvite}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-lg flex items-center gap-1.5 shadow-md shadow-indigo-600/20 cursor-pointer"
                >
                  {isSubmittingInvite && <Spinner className="w-3.5 h-3.5" />}
                  <span>Send Invitation</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Granular Member Access Modal */}
      {editMember && editAccessData && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f0a0d] border border-white/10 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h2 className="text-base font-bold text-white">
                  Edit Access: {editMember.name}
                </h2>
                <p className="text-[11px] text-slate-400">{editMember.email}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditMember(null);
                  setEditAccessData(null);
                }}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Organization Role Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Organization Role</label>
                <CustomSelect
                  options={ORG_ROLES}
                  value={editAccessData.organizationRole}
                  onChange={(val) =>
                    setEditAccessData((prev) =>
                      prev ? { ...prev, organizationRole: val } : null
                    )
                  }
                  searchable={false}
                />
              </div>

              {/* Applications Matrix */}
              <div className="space-y-3 pt-2 border-t border-white/10">
                <label className="text-xs font-semibold text-white uppercase tracking-wider block">
                  Application & Branch Permissions
                </label>

                <div className="space-y-3">
                  {editAccessData.apps.map((app, appIdx) => {
                    const rolesForApp = APP_ROLES[app.productKey] || [
                      { value: 'staff', label: 'Staff' },
                    ];

                    return (
                      <div
                        key={app.productKey}
                        className={`p-3.5 rounded-xl border transition-colors ${
                          app.hasAccess
                            ? 'bg-white/[0.03] border-indigo-500/40'
                            : 'bg-black/40 border-white/5 opacity-75'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <label className="flex items-center gap-2.5 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={app.hasAccess}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setEditAccessData((prev) => {
                                  if (!prev) return null;
                                  const updatedApps = prev.apps.map((a, i) =>
                                    i === appIdx ? { ...a, hasAccess: checked } : a
                                  );
                                  return { ...prev, apps: updatedApps };
                                });
                              }}
                              className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                            />
                            <span className="text-xs font-bold text-white flex items-center gap-1.5">
                              <Store className="w-3.5 h-3.5 text-emerald-400" />
                              {app.productName || app.productKey}
                            </span>
                          </label>

                          {app.hasAccess && (
                            <div className="w-44">
                              <CustomSelect
                                options={rolesForApp}
                                value={app.role}
                                onChange={(val) => {
                                  setEditAccessData((prev) => {
                                    if (!prev) return null;
                                    const updatedApps = prev.apps.map((a, i) =>
                                      i === appIdx ? { ...a, role: val } : a
                                    );
                                    return { ...prev, apps: updatedApps };
                                  });
                                }}
                                searchable={false}
                              />
                            </div>
                          )}
                        </div>

                        {app.hasAccess && app.supportsBranches && (
                          <div className="mt-3 pt-2.5 border-t border-white/5 space-y-2">
                            <span className="text-[11px] text-slate-400 font-medium block">
                              Assigned Branches:
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {workspaceBranches.map((b) => {
                                const isSelected = app.branchIds.includes(b.id);
                                return (
                                  <label
                                    key={b.id}
                                    className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer select-none transition-colors ${
                                      isSelected
                                        ? 'bg-emerald-500/10 border-emerald-500/30 text-white'
                                        : 'bg-black/30 border-white/5 text-slate-400 hover:text-slate-200'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={(e) => {
                                        const checked = e.target.checked;
                                        setEditAccessData((prev) => {
                                          if (!prev) return null;
                                          const updatedApps = prev.apps.map((a, i) => {
                                            if (i !== appIdx) return a;
                                            const nextBranches = checked
                                              ? [...a.branchIds, b.id]
                                              : a.branchIds.filter((id) => id !== b.id);
                                            return { ...a, branchIds: nextBranches };
                                          });
                                          return { ...prev, apps: updatedApps };
                                        });
                                      }}
                                      className="rounded bg-slate-900 border-slate-700 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer"
                                    />
                                    <span className="truncate">
                                      {b.name} {b.city ? `(${b.city})` : ''}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditMember(null);
                  setEditAccessData(null);
                }}
                className="border-white/10 bg-transparent text-xs rounded-lg cursor-pointer hover:bg-white/5"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={isSavingAccess}
                onClick={handleSaveMemberAccess}
                className="bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white rounded-lg shadow-md shadow-indigo-600/20 cursor-pointer"
              >
                {isSavingAccess && <Spinner className="w-3 h-3 mr-1" />}
                Save Permissions
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Suspend / Remove Confirmation Modal */}
      {actionMember && actionType && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  actionType === 'remove'
                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}
              >
                {actionType === 'remove' ? (
                  <Trash2 className="w-5 h-5" />
                ) : (
                  <Ban className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-white capitalize">
                  {actionType} Member
                </h3>
                <p className="text-xs text-slate-400">{actionMember.name}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300">
              {actionType === 'remove'
                ? 'Are you sure you want to remove this member? Their access to all organization apps and branches will be revoked.'
                : 'Are you sure you want to suspend this member? They will be unable to log in until restored.'}
            </p>

            <div className="space-y-1.5">
              <label className="text-[11px] text-slate-400">Reason (Optional)</label>
              <Input
                type="text"
                placeholder="e.g. End of contract"
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                className="bg-slate-950 border-slate-800 text-xs text-white rounded-lg h-8"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setActionMember(null);
                  setActionType(null);
                }}
                className="border-slate-800 text-xs rounded-lg cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={isProcessingAction}
                onClick={handleConfirmAction}
                className={`text-xs font-semibold text-white rounded-lg cursor-pointer ${
                  actionType === 'remove'
                    ? 'bg-rose-600 hover:bg-rose-500'
                    : 'bg-amber-600 hover:bg-amber-500'
                }`}
              >
                {isProcessingAction && <Spinner className="w-3 h-3 mr-1" />}
                Confirm {actionType}
              </Button>
            </div>
          </div>
        </div>
      )}

      <footer className="w-full border-t border-white/5 bg-black py-4 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} Orviohub Inc. • Team & Permissions Engine
      </footer>
    </div>
  );
};

export default WorkspaceMembers;
