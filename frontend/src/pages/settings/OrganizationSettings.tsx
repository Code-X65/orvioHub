import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { api } from '@/lib/api';
import { AuditLogItem, InvitationItem, Role } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CustomSelect } from '@/components/ui/custom-select';
import { toast } from 'sonner';
import {
  Building2,
  Users,
  ScrollText,
  ArrowLeft,
  UserPlus,
  RotateCw,
  Clock,
  Loader2,
  Shield,
  AlertTriangle,
  DoorOpen,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CrossOrgMember {
  userId: string;
  name: string;
  email: string;
  fromOrgName: string;
  fromOrgId: string;
  role: string;
}

export const OrganizationSettings: React.FC = () => {
  const navigate = useNavigate();
  const { user, memberships, activeOrganizationId, setActiveOrganizationId, setMemberships } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'team' | 'audit' | 'danger'>('team');

  // Initialize memberships if store is empty on direct URL access
  useEffect(() => {
    const initOrgs = async () => {
      if (memberships.length === 0) {
        try {
          const res = await api.get<{ memberships: any[] }>('/organizations');
          if (res.memberships && res.memberships.length > 0) {
            setMemberships(res.memberships);
            if (!activeOrganizationId) {
              setActiveOrganizationId(res.memberships[0].organization.id);
            }
          }
        } catch {
          // Ignore
        }
      }
    };
    initOrgs();
  }, [memberships.length, activeOrganizationId, setMemberships, setActiveOrganizationId]);

  const activeMembership =
    memberships.find((m) => m.organization.id === activeOrganizationId) || memberships[0];
  const orgId = activeMembership?.organization?.id;
  const isOwner = activeMembership?.role === 'OWNER';
  const isOwnerOrAdmin = activeMembership?.role === 'OWNER' || activeMembership?.role === 'ADMIN';

  // --- Team & Invitations State ---
  const [invitations, setInvitations] = useState<InvitationItem[]>([]);
  const [isLoadingInvitations, setIsLoadingInvitations] = useState(false);
  const [activeMembersList, setActiveMembersList] = useState<any[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  // Invite Modal State
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteModalMode, setInviteModalMode] = useState<'email' | 'existing'>('email');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('MEMBER');
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Cross-Org Teammates State
  const [crossOrgMembers, setCrossOrgMembers] = useState<CrossOrgMember[]>([]);
  const [_isLoadingCrossOrg, _setIsLoadingCrossOrg] = useState(false);
  const [selectedCrossOrgUser, setSelectedCrossOrgUser] = useState<CrossOrgMember | null>(null);


  // --- Audit Log State ---
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [isLoadingAuditLogs, setIsLoadingAuditLogs] = useState(false);
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // --- Leave / Delete Org State ---
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch Active Members of Current Org
  const fetchActiveMembers = useCallback(async () => {
    if (!orgId) return;
    setIsLoadingMembers(true);
    try {
      const res = await api.get<{ data?: { members: any[] }; members?: any[] }>(`/organizations/${orgId}/members`);
      setActiveMembersList(res.data?.members || res.members || []);
    } catch {
      // Failed to load
    } finally {
      setIsLoadingMembers(false);
    }
  }, [orgId]);

  // Fetch Invitations
  const fetchInvitations = useCallback(async () => {
    if (!orgId || !isOwnerOrAdmin) return;
    setIsLoadingInvitations(true);
    try {
      const res = await api.get<{ invitations: InvitationItem[] }>(`/organizations/${orgId}/invitations`);
      setInvitations(res.invitations || []);
    } catch {
      // Non-admins or error
    } finally {
      setIsLoadingInvitations(false);
    }
  }, [orgId, isOwnerOrAdmin]);

  // Fetch Cross-Organization Members for Quick Add
  const fetchCrossOrgMembers = useCallback(async () => {
    if (!orgId || memberships.length <= 1) return;
    _setIsLoadingCrossOrg(true);
    try {
      const otherOrgs = memberships.filter((m) => m.organization.id !== orgId);
      const results: CrossOrgMember[] = [];

      for (const org of otherOrgs) {
        try {
          const res = await api.get<{ data?: { members: any[] }; members?: any[] }>(`/organizations/${org.organization.id}/members`);
          const members = res.data?.members || res.members || [];
          for (const m of members) {
            const memberEmail = (m.user?.email || m.email || '').toLowerCase();
            const currentMemberEmails = activeMembersList.map((cur) => (cur.user?.email || cur.email || '').toLowerCase());
            if (memberEmail && memberEmail !== user?.email?.toLowerCase() && !currentMemberEmails.includes(memberEmail)) {
              if (!results.some((r) => r.email.toLowerCase() === memberEmail)) {
                results.push({
                  userId: m.userId || m.user?.id || m.id,
                  name: m.user?.name || m.name || memberEmail.split('@')[0],
                  email: memberEmail,
                  fromOrgName: org.organization.name,
                  fromOrgId: org.organization.id,
                  role: m.role || 'MEMBER',
                });
              }
            }
          }
        } catch {
          // Ignore
        }
      }

      setCrossOrgMembers(results);
    } finally {
      _setIsLoadingCrossOrg(false);
    }
  }, [orgId, memberships, activeMembersList, user?.email]);

  // Fetch Audit Logs
  const fetchAuditLogs = useCallback(async () => {
    if (!orgId || !isOwnerOrAdmin) return;
    setIsLoadingAuditLogs(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (actionFilter.trim()) {
        params.set('action', actionFilter.trim());
      }

      const res = await api.get<{ logs: AuditLogItem[]; pagination: { total: number; totalPages: number } }>(
        `/organizations/${orgId}/audit-log?${params.toString()}`
      );
      setAuditLogs(res.logs || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotalLogs(res.pagination?.total || 0);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch audit logs.');
    } finally {
      setIsLoadingAuditLogs(false);
    }
  }, [orgId, isOwnerOrAdmin, page, limit, actionFilter]);

  useEffect(() => {
    if (activeTab === 'team') {
      fetchActiveMembers();
      fetchInvitations();
      fetchCrossOrgMembers();
    } else if (activeTab === 'audit') {
      fetchAuditLogs();
    }
  }, [activeTab, fetchActiveMembers, fetchInvitations, fetchCrossOrgMembers, fetchAuditLogs]);

  // Handle Send New Invitation (Email or Cross-Org)
  const handleSendInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmail = (inviteModalMode === 'existing' && selectedCrossOrgUser ? selectedCrossOrgUser.email : inviteEmail).trim().toLowerCase();
    if (!targetEmail || !orgId) return;

    setIsSendingInvite(true);
    try {
      await api.post(`/organizations/${orgId}/invitations`, {
        invitations: [{ email: targetEmail, role: inviteRole }],
      });
      toast.success(
        inviteModalMode === 'existing'
          ? `Added ${selectedCrossOrgUser?.name || targetEmail} to ${activeMembership?.organization?.name} as ${inviteRole}`
          : `Invitation sent to ${targetEmail}`
      );
      setIsInviteModalOpen(false);
      setInviteEmail('');
      setSelectedCrossOrgUser(null);
      setInviteRole('MEMBER');
      fetchInvitations();
      fetchActiveMembers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add member.');
    } finally {
      setIsSendingInvite(false);
    }
  };

  // Handle Resend Invitation
  const handleResendInvitation = async (invitationId: string) => {
    setResendingId(invitationId);
    try {
      const res = await api.post<any>(`/invitations/${invitationId}/resend`);
      toast.success(res.message || 'Invitation resent successfully.');
      fetchInvitations();
    } catch (err: any) {
      toast.error(err.message || 'Failed to resend invitation.');
    } finally {
      setResendingId(null);
    }
  };

  // Handle Cancel Invitation
  const handleCancelInvitation = async (invitationId: string) => {
    setCancellingId(invitationId);
    try {
      await api.delete(`/invitations/${invitationId}`);
      toast.success('Invitation cancelled.');
      fetchInvitations();
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel invitation.');
    } finally {
      setCancellingId(null);
    }
  };

  // Handle Leave Organization
  const handleLeaveOrganization = async () => {
    if (!orgId) return;
    setIsLeaving(true);
    try {
      await api.post(`/organizations/${orgId}/leave`);
      toast.success(`You have left ${activeMembership?.organization?.name}.`);
      setIsLeaveModalOpen(false);

      const res = await api.get<{ memberships: any[] }>('/organizations');
      const updatedMemberships = res.memberships || [];
      setMemberships(updatedMemberships);

      if (updatedMemberships.length > 0) {
        setActiveOrganizationId(updatedMemberships[0].organization.id);
        navigate('/dashboard');
      } else {
        navigate('/onboarding');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to leave organization.');
    } finally {
      setIsLeaving(false);
    }
  };

  // Handle Delete Organization
  const handleDeleteOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return;

    setIsDeleting(true);
    try {
      await api.delete(`/organizations/${orgId}`, {
        password: deletePassword || undefined,
      });
      toast.success(`Organization ${activeMembership?.organization?.name} has been deleted.`);
      setIsDeleteModalOpen(false);
      setDeletePassword('');

      const res = await api.get<{ memberships: any[] }>('/organizations');
      const updatedMemberships = res.memberships || [];
      setMemberships(updatedMemberships);

      if (updatedMemberships.length > 0) {
        setActiveOrganizationId(updatedMemberships[0].organization.id);
        navigate('/dashboard');
      } else {
        navigate('/onboarding');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete organization.');
    } finally {
      setIsDeleting(false);
    }
  };

  const getActionBadgeColor = (action: string) => {
    if (action.includes('created') || action.includes('joined') || action.includes('enabled')) {
      return 'bg-emerald-950 text-emerald-400 border-emerald-800';
    }
    if (action.includes('resent') || action.includes('updated')) {
      return 'bg-zinc-900 text-slate-200 border-zinc-700';
    }
    if (action.includes('cancelled') || action.includes('deleted') || action.includes('disabled')) {
      return 'bg-rose-950 text-rose-400 border-rose-800';
    }
    return 'bg-zinc-900 text-slate-400 border-zinc-800';
  };

  return (
    <div className="min-h-screen bg-black text-slate-100 flex flex-col selection:bg-[#714b67] selection:text-white">
      {/* Top Navbar */}
      <header className="border-b border-white/10 bg-zinc-950 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-1.5 hover:bg-white/5 rounded-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-medium cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Dashboard</span>
            </button>
            <div className="h-4 w-px bg-white/10" />
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded-xs bg-[#714b67] flex items-center justify-center text-white text-xs font-bold">
                <Building2 className="w-3.5 h-3.5" />
              </div>
              <span className="font-bold text-white text-xs sm:text-sm">
                {activeMembership?.organization?.name || 'Organization'}
              </span>
              <span className="text-[10px] uppercase font-semibold px-1.5 py-0.2 rounded-xs bg-white/5 border border-white/10 text-[#f0d8e8]">
                {activeMembership?.role || 'MEMBER'}
              </span>
            </div>
          </div>

          {/* Org Selector */}
          {memberships.length > 1 && (
            <div className="flex items-center gap-2 min-w-[200px]">
              <span className="text-xs text-slate-400 hidden sm:inline">Organization:</span>
              <CustomSelect
                options={memberships.map((m) => ({
                  value: m.organization.id,
                  label: m.organization.name,
                }))}
                value={activeOrganizationId || ''}
                onChange={(val) => setActiveOrganizationId(val)}
                searchable={false}
                triggerClassName="h-8 py-1"
              />
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Organization Settings & Members
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Manage organization members, assign roles, and inspect security audit trails.
            </p>
          </div>

          {isOwnerOrAdmin && activeTab === 'team' && (
            <Button
              onClick={() => {
                fetchCrossOrgMembers();
                setIsInviteModalOpen(true);
              }}
              className="bg-[#714b67] hover:bg-[#86597a] active:bg-[#603f57] text-white text-xs font-medium px-3 h-8 rounded-xs cursor-pointer flex items-center gap-1.5"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add Member</span>
            </Button>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 space-x-6">
          <button
            onClick={() => setActiveTab('team')}
            className={cn(
              'pb-2.5 text-xs font-semibold transition-colors relative flex items-center gap-1.5 cursor-pointer',
              activeTab === 'team'
                ? 'text-[#f0d8e8] border-b-2 border-[#714b67]'
                : 'text-slate-400 hover:text-slate-200'
            )}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Members & Roles</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('audit');
              setPage(1);
            }}
            className={cn(
              'pb-2.5 text-xs font-semibold transition-colors relative flex items-center gap-1.5 cursor-pointer',
              activeTab === 'audit'
                ? 'text-[#f0d8e8] border-b-2 border-[#714b67]'
                : 'text-slate-400 hover:text-slate-200'
            )}
          >
            <ScrollText className="w-3.5 h-3.5" />
            <span>Audit Trail</span>
          </button>
          <button
            onClick={() => setActiveTab('danger')}
            className={cn(
              'pb-2.5 text-xs font-semibold transition-colors relative flex items-center gap-1.5 cursor-pointer',
              activeTab === 'danger'
                ? 'text-rose-400 border-b-2 border-rose-500'
                : 'text-slate-400 hover:text-slate-200'
            )}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Danger Zone</span>
          </button>
        </div>

        {/* Tab 1: Organization Team & Invitations */}
        {activeTab === 'team' && (
          <div className="space-y-6">
            
            {/* Active Members Card */}
            <div className="bg-zinc-950 border border-white/10 rounded-xs overflow-hidden">
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-[#c79dbd]" />
                    <span>Active Organization Members</span>
                  </h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Users with active access to <strong className="text-white">{activeMembership?.organization?.name}</strong>.
                  </p>
                </div>
              </div>

              <div className="divide-y divide-white/5">
                {/* Current User Row */}
                <div className="p-3.5 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-xs bg-[#714b67]/30 border border-[#714b67]/40 flex items-center justify-center text-[#f0d8e8] font-bold text-xs">
                      {user?.name?.slice(0, 2).toUpperCase() || 'ME'}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white">{user?.name}</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded-xs bg-white/10 text-[#f0d8e8] font-semibold">
                          You
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">{user?.email}</span>
                    </div>
                  </div>

                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-xs bg-white/5 text-[#f0d8e8] border border-white/10">
                    {activeMembership?.role || 'MEMBER'}
                  </span>
                </div>

                {/* Other Members */}
                {isLoadingMembers ? (
                  <div className="p-4 text-center text-slate-400 text-xs">
                    <Loader2 className="w-3.5 h-3.5 animate-spin inline-block mr-2" />
                    <span>Loading members...</span>
                  </div>
                ) : (
                  activeMembersList
                    .filter((m) => (m.user?.email || m.email || '').toLowerCase() !== user?.email?.toLowerCase())
                    .map((m) => (
                      <div key={m.id || m.userId} className="p-3.5 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-xs bg-zinc-900 border border-white/10 flex items-center justify-center text-slate-300 font-bold text-xs">
                            {(m.user?.name || m.name || 'U').slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="text-xs font-bold text-white block">{m.user?.name || m.name}</span>
                            <span className="text-[11px] text-slate-400">{m.user?.email || m.email}</span>
                          </div>
                        </div>

                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-xs bg-white/5 text-slate-300 border border-white/10">
                          {m.role || 'MEMBER'}
                        </span>
                      </div>
                    ))
                )}
              </div>
            </div>

            {/* Pending & Past Invitations Card */}
            <div className="bg-zinc-950 border border-white/10 rounded-xs overflow-hidden">
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-[#c79dbd]" />
                    <span>Pending Invitations</span>
                  </h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Sent invitations for <strong className="text-white">{activeMembership?.organization?.name}</strong>.
                  </p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchInvitations}
                  disabled={isLoadingInvitations}
                  className="border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 text-xs h-7 px-2 rounded-xs cursor-pointer"
                >
                  <RotateCw className={cn('w-3 h-3 mr-1', isLoadingInvitations && 'animate-spin')} />
                  Refresh
                </Button>
              </div>

              {isLoadingInvitations ? (
                <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#714b67]" />
                  <span>Loading invitations...</span>
                </div>
              ) : invitations.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-xs space-y-1">
                  <p>No pending invitations.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-black text-slate-400 uppercase text-[10px] tracking-wider border-b border-white/5">
                      <tr>
                        <th className="px-4 py-2.5">Invitee Email</th>
                        <th className="px-4 py-2.5">Role</th>
                        <th className="px-4 py-2.5">Status</th>
                        <th className="px-4 py-2.5">Expires</th>
                        <th className="px-4 py-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {invitations.map((inv) => {
                        const isExpired = inv.expiresAt < Date.now() || inv.status === 'EXPIRED';
                        const isPending = inv.status === 'PENDING' && !isExpired;
                        const isCancelled = inv.status === 'CANCELLED';
                        const isAccepted = inv.status === 'ACCEPTED';

                        return (
                          <tr key={inv.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-3 font-medium text-slate-200">{inv.email}</td>
                            <td className="px-4 py-3">
                              <span className="px-1.5 py-0.5 rounded-xs text-[10px] font-semibold bg-white/5 text-slate-300 border border-white/10">
                                {inv.role}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {isPending && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-xs text-[10px] font-medium bg-amber-950 text-amber-400 border border-amber-800">
                                  Pending
                                </span>
                              )}
                              {isExpired && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-xs text-[10px] font-medium bg-rose-950 text-rose-400 border border-rose-800">
                                  Expired
                                </span>
                              )}
                              {isCancelled && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-xs text-[10px] font-medium bg-zinc-900 text-slate-500 border border-zinc-800">
                                  Cancelled
                                </span>
                              )}
                              {isAccepted && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-xs text-[10px] font-medium bg-emerald-950 text-emerald-400 border border-emerald-800">
                                  Accepted
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-500">
                              {new Date(inv.expiresAt).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 text-right space-x-1.5">
                              {isOwnerOrAdmin && (isPending || isExpired) && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleResendInvitation(inv.id)}
                                    disabled={resendingId === inv.id}
                                    className="border-white/10 bg-white/5 text-[#f0d8e8] hover:bg-white/10 text-[10px] h-6 px-2 rounded-xs cursor-pointer"
                                  >
                                    Resend
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleCancelInvitation(inv.id)}
                                    disabled={cancellingId === inv.id}
                                    className="border-rose-900/40 bg-rose-950/20 text-rose-300 hover:bg-rose-950/40 text-[10px] h-6 px-2 rounded-xs cursor-pointer"
                                  >
                                    Cancel
                                  </Button>
                                </>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Security Audit Logs */}
        {activeTab === 'audit' && (
          <div className="space-y-4">
            {!isOwnerOrAdmin ? (
              <div className="p-6 text-center bg-zinc-950 border border-white/10 rounded-xs">
                <Shield className="w-6 h-6 text-slate-500 mx-auto mb-1.5" />
                <h3 className="text-xs font-semibold text-slate-200">Restricted Access</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Only Organization Owners and Admins can view audit logs.
                </p>
              </div>
            ) : (
              <div className="bg-zinc-950 border border-white/10 rounded-xs overflow-hidden">
                <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <ScrollText className="w-3.5 h-3.5 text-[#c79dbd]" />
                      <span>Audit Logs</span>
                    </h2>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Immutable record of organization activity.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      placeholder="Filter action..."
                      value={actionFilter}
                      onChange={(e) => {
                        setActionFilter(e.target.value);
                        setPage(1);
                      }}
                      className="h-7 text-xs bg-black border-white/10 text-white w-44 rounded-xs"
                    />

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={fetchAuditLogs}
                      disabled={isLoadingAuditLogs}
                      className="border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 text-xs h-7 px-2 rounded-xs cursor-pointer"
                    >
                      <RotateCw className={cn('w-3 h-3', isLoadingAuditLogs && 'animate-spin')} />
                    </Button>
                  </div>
                </div>

                {isLoadingAuditLogs ? (
                  <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-[#714b67]" />
                    <span>Loading audit trail...</span>
                  </div>
                ) : auditLogs.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 text-xs">
                    <p>No audit records found.</p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-black text-slate-400 uppercase text-[10px] tracking-wider border-b border-white/5">
                          <tr>
                            <th className="px-4 py-2.5">Timestamp</th>
                            <th className="px-4 py-2.5">Actor</th>
                            <th className="px-4 py-2.5">Action</th>
                            <th className="px-4 py-2.5">Resource</th>
                            <th className="px-4 py-2.5 text-right">Details</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {auditLogs.map((log) => {
                            const isExpanded = expandedLogId === log.id;

                            return (
                              <React.Fragment key={log.id}>
                                <tr
                                  className="hover:bg-white/[0.02] transition-colors cursor-pointer"
                                  onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                >
                                  <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap text-[11px]">
                                    {new Date(log.timestamp).toLocaleString()}
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <span className="font-medium text-white text-xs block">{log.actor?.name || 'System'}</span>
                                    <span className="text-[10px] text-slate-500">{log.actor?.email || ''}</span>
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <span className={cn('px-1.5 py-0.2 rounded-xs border text-[10px] font-mono', getActionBadgeColor(log.action))}>
                                      {log.action}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2.5 font-mono text-slate-400 text-[10px]">{log.resource}</td>
                                  <td className="px-4 py-2.5 text-right">
                                    <button type="button" className="text-slate-400 hover:text-white text-[11px]">
                                      {isExpanded ? 'Hide' : 'View'}
                                    </button>
                                  </td>
                                </tr>
                                {isExpanded && log.metadata && (
                                  <tr className="bg-black border-b border-white/10">
                                    <td colSpan={5} className="px-4 py-2.5">
                                      <pre className="p-2 bg-zinc-900 rounded-xs border border-white/10 font-mono text-[10px] text-slate-300 overflow-x-auto">
                                        {JSON.stringify(log.metadata, null, 2)}
                                      </pre>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    <div className="p-3 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400 bg-black">
                      <div>
                        <span>{auditLogs.length} of {totalLogs} events</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={page <= 1 || isLoadingAuditLogs}
                          className="border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 h-6 text-[10px] px-2 rounded-xs cursor-pointer"
                        >
                          Prev
                        </Button>
                        <span className="text-[10px] px-1.5 text-slate-400">{page} / {totalPages}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          disabled={page >= totalPages || isLoadingAuditLogs}
                          className="border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 h-6 text-[10px] px-2 rounded-xs cursor-pointer"
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Danger Zone */}
        {activeTab === 'danger' && (
          <div className="space-y-4">
            <div className="bg-zinc-950 border border-white/10 rounded-xs p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <DoorOpen className="w-3.5 h-3.5 text-amber-400" />
                  <span>Leave Organization</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Resign from <strong className="text-white">{activeMembership?.organization?.name}</strong>.
                </p>
              </div>

              <Button
                variant="outline"
                onClick={() => setIsLeaveModalOpen(true)}
                className="border-amber-900/40 bg-amber-950/20 text-amber-300 hover:bg-amber-950/40 text-xs px-3 h-7 rounded-xs cursor-pointer self-start sm:self-auto"
              >
                Leave
              </Button>
            </div>

            {isOwner && (
              <div className="bg-rose-950/10 border border-rose-900/30 rounded-xs p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Organization</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Permanently delete this organization and its data.
                  </p>
                </div>

                <Button
                  onClick={() => setIsDeleteModalOpen(true)}
                  className="bg-rose-600 hover:bg-rose-500 text-white text-xs px-3 h-7 rounded-xs cursor-pointer self-start sm:self-auto"
                >
                  Delete
                </Button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ADD / INVITE MEMBER MODAL */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-zinc-950 border border-white/10 rounded-xs p-5 max-w-md w-full space-y-4">
            
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-[#c79dbd]" />
                <span>Add Member to Organization</span>
              </h3>
              <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-xs bg-white/5 border border-white/10 text-slate-400">
                {activeMembership?.organization?.name}
              </span>
            </div>

            {/* Mode Tabs */}
            {memberships.length > 1 && crossOrgMembers.length > 0 && (
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-black border border-white/10 rounded-xs">
                <button
                  type="button"
                  onClick={() => setInviteModalMode('email')}
                  className={cn(
                    'py-1 text-xs font-medium rounded-xs transition-colors cursor-pointer',
                    inviteModalMode === 'email'
                      ? 'bg-[#714b67] text-white'
                      : 'text-slate-400 hover:text-white'
                  )}
                >
                  Invite by Email
                </button>
                <button
                  type="button"
                  onClick={() => setInviteModalMode('existing')}
                  className={cn(
                    'py-1 text-xs font-medium rounded-xs transition-colors cursor-pointer',
                    inviteModalMode === 'existing'
                      ? 'bg-[#714b67] text-white'
                      : 'text-slate-400 hover:text-white'
                  )}
                >
                  From Other Org ({crossOrgMembers.length})
                </button>
              </div>
            )}

            <form onSubmit={handleSendInvitation} className="space-y-3">
              {inviteModalMode === 'email' && (
                <div className="space-y-1">
                  <Label htmlFor="inviteEmail" className="text-xs text-slate-300">
                    Email Address *
                  </Label>
                  <Input
                    id="inviteEmail"
                    type="email"
                    required
                    autoFocus
                    placeholder="colleague@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="h-8 bg-black border-white/10 text-white rounded-xs text-xs"
                  />
                </div>
              )}

              {inviteModalMode === 'existing' && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">
                    Select Teammate from Another Org
                  </Label>
                  <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                    {crossOrgMembers.map((member) => {
                      const isSelected = selectedCrossOrgUser?.email === member.email;
                      return (
                        <div
                          key={member.email}
                          onClick={() => setSelectedCrossOrgUser(member)}
                          className={cn(
                            'p-2 rounded-xs border transition-colors cursor-pointer flex items-center justify-between text-xs',
                            isSelected
                              ? 'bg-[#714b67]/20 border-[#714b67] text-white'
                              : 'bg-black border-white/10 text-slate-300 hover:border-white/20'
                          )}
                        >
                          <div>
                            <span className="font-bold block">{member.name}</span>
                            <span className="text-[10px] text-slate-500">{member.email}</span>
                          </div>
                          <span className="text-[9px] px-1.5 py-0.2 rounded-xs bg-white/5 border border-white/10 text-slate-400">
                            {member.fromOrgName}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="inviteRole" className="text-xs text-slate-300 font-medium">
                  Role *
                </Label>
                <CustomSelect
                  options={[
                    { value: 'MEMBER', label: 'Member (Standard access)', badge: 'Standard' },
                    { value: 'MANAGER', label: 'Manager (Supervisor)', badge: 'Lead' },
                    { value: 'ADMIN', label: 'Admin (Full access)', badge: 'Admin' },
                  ]}
                  value={inviteRole}
                  onChange={(val) => setInviteRole(val as Role)}
                  searchable={false}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsInviteModalOpen(false);
                    setSelectedCrossOrgUser(null);
                  }}
                  className="border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 text-xs h-7 px-3 rounded-xs cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    isSendingInvite ||
                    (inviteModalMode === 'email' && !inviteEmail.trim()) ||
                    (inviteModalMode === 'existing' && !selectedCrossOrgUser)
                  }
                  className="bg-[#714b67] hover:bg-[#86597a] text-white text-xs h-7 px-3 rounded-xs cursor-pointer"
                >
                  {isSendingInvite ? 'Adding...' : 'Confirm'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Leave Organization Modal */}
      {isLeaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-zinc-950 border border-amber-500/30 rounded-xs p-5 max-w-sm w-full space-y-3">
            <h3 className="text-sm font-bold text-amber-400">
              Leave {activeMembership?.organization?.name}?
            </h3>
            <p className="text-xs text-slate-400">
              You will lose access to all modules and team assets in this organization.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setIsLeaveModalOpen(false)}
                className="border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 text-xs h-7 px-3 rounded-xs cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                onClick={handleLeaveOrganization}
                disabled={isLeaving}
                className="bg-amber-600 hover:bg-amber-500 text-white text-xs h-7 px-3 rounded-xs cursor-pointer"
              >
                {isLeaving ? 'Leaving...' : 'Confirm'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Organization Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-zinc-950 border border-rose-500/30 rounded-xs p-5 max-w-sm w-full space-y-3">
            <h3 className="text-sm font-bold text-rose-400">
              Delete {activeMembership?.organization?.name}?
            </h3>
            <p className="text-xs text-slate-400">
              This action is permanent and cannot be undone.
            </p>

            <div className="space-y-1">
              <Label className="text-xs text-slate-300">Password</Label>
              <Input
                type="password"
                placeholder="Enter account password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                className="h-8 bg-black border-white/10 text-white rounded-xs text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setIsDeleteModalOpen(false)}
                className="border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 text-xs h-7 px-3 rounded-xs cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteOrganization}
                disabled={isDeleting}
                className="bg-rose-600 hover:bg-rose-500 text-white text-xs h-7 px-3 rounded-xs cursor-pointer"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
