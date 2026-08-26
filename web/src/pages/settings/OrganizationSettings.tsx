import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { api } from '@/lib/api';
import { AuditLogItem, InvitationItem, Role } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Building2,
  Users,
  ScrollText,
  ArrowLeft,
  UserPlus,
  RotateCw,
  XCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Search,
  Filter,
  Shield,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  DoorOpen,
  Trash2,
  Lock,
} from 'lucide-react';

export const OrganizationSettings: React.FC = () => {
  const navigate = useNavigate();
  const { user, memberships, activeOrganizationId, setActiveOrganizationId, setMemberships } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'team' | 'audit' | 'danger'>('team');

  const activeMembership =
    memberships.find((m) => m.organization.id === activeOrganizationId) || memberships[0];
  const orgId = activeMembership?.organization?.id;
  const isOwner = activeMembership?.role === 'OWNER';
  const isOwnerOrAdmin = activeMembership?.role === 'OWNER' || activeMembership?.role === 'ADMIN';

  // --- Team & Invitations State ---
  const [invitations, setInvitations] = useState<InvitationItem[]>([]);
  const [isLoadingInvitations, setIsLoadingInvitations] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('MEMBER');
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

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
      fetchInvitations();
    } else if (activeTab === 'audit') {
      fetchAuditLogs();
    }
  }, [activeTab, fetchInvitations, fetchAuditLogs]);

  // Handle Send New Invitation
  const handleSendInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !orgId) return;

    setIsSendingInvite(true);
    try {
      await api.post(`/organizations/${orgId}/invitations`, {
        invitations: [{ email: inviteEmail.trim().toLowerCase(), role: inviteRole }],
      });
      toast.success(`Invitation sent to ${inviteEmail.trim()}`);
      setIsInviteModalOpen(false);
      setInviteEmail('');
      setInviteRole('MEMBER');
      fetchInvitations();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send invitation.');
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
      toast.success('Invitation successfully cancelled.');
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

      // Refetch memberships
      const res = await api.get<{ memberships: any[] }>('/organizations');
      const updatedMemberships = res.memberships || [];
      setMemberships(updatedMemberships);

      if (updatedMemberships.length > 0) {
        setActiveOrganizationId(updatedMemberships[0].organization.id);
        navigate('/app');
      } else {
        navigate('/onboarding/organization');
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
      toast.success(`Organization ${activeMembership?.organization?.name} has been permanently deleted.`);
      setIsDeleteModalOpen(false);
      setDeletePassword('');

      // Refetch memberships
      const res = await api.get<{ memberships: any[] }>('/organizations');
      const updatedMemberships = res.memberships || [];
      setMemberships(updatedMemberships);

      if (updatedMemberships.length > 0) {
        setActiveOrganizationId(updatedMemberships[0].organization.id);
        navigate('/app');
      } else {
        navigate('/onboarding/organization');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete organization.');
    } finally {
      setIsDeleting(false);
    }
  };

  const getActionBadgeColor = (action: string) => {
    if (action.includes('created') || action.includes('joined') || action.includes('enabled')) {
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    }
    if (action.includes('resent') || action.includes('updated')) {
      return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
    }
    if (action.includes('cancelled') || action.includes('deleted') || action.includes('disabled')) {
      return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    }
    return 'bg-slate-800 text-slate-300 border-slate-700';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/app')}
              className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Dashboard</span>
            </button>
            <div className="h-4 w-px bg-slate-800" />
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-indigo-400" />
              </div>
              <span className="font-semibold text-slate-100">
                {activeMembership?.organization?.name || 'Organization'}
              </span>
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-indigo-300">
                {activeMembership?.role || 'MEMBER'}
              </span>
            </div>
          </div>

          {/* Org Selector if user has multiple orgs */}
          {memberships.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 hidden sm:inline">Switch Org:</span>
              <select
                value={activeOrganizationId || ''}
                onChange={(e) => setActiveOrganizationId(e.target.value)}
                className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
              >
                {memberships.map((m) => (
                  <option key={m.organization.id} value={m.organization.id}>
                    {m.organization.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Organization Workspace & Security</h1>
            <p className="text-sm text-slate-400 mt-1">
              Manage teammates, track pending invitations, monitor security audit trails, and configure danger zone controls.
            </p>
          </div>

          {isOwnerOrAdmin && activeTab === 'team' && (
            <Button
              onClick={() => setIsInviteModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-4 self-start md:self-auto"
            >
              <UserPlus className="w-4 h-4 mr-1.5" />
              Invite Teammate
            </Button>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 mb-8 space-x-8">
          <button
            onClick={() => setActiveTab('team')}
            className={`pb-4 text-sm font-medium transition-colors relative flex items-center gap-2 ${
              activeTab === 'team'
                ? 'text-indigo-400 border-b-2 border-indigo-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Team & Invitations</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('audit');
              setPage(1);
            }}
            className={`pb-4 text-sm font-medium transition-colors relative flex items-center gap-2 ${
              activeTab === 'audit'
                ? 'text-indigo-400 border-b-2 border-indigo-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ScrollText className="w-4 h-4" />
            <span>Audit Logs</span>
          </button>
          <button
            onClick={() => setActiveTab('danger')}
            className={`pb-4 text-sm font-medium transition-colors relative flex items-center gap-2 ${
              activeTab === 'danger'
                ? 'text-rose-400 border-b-2 border-rose-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Danger Zone</span>
          </button>
        </div>

        {/* Tab 1: Team & Invitations */}
        {activeTab === 'team' && (
          <div className="space-y-8">
            {/* Active Members Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-sm shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-400" />
                    <span>Active Team Members</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">Users who currently have access to this workspace.</p>
                </div>
              </div>

              <div className="divide-y divide-slate-800/80">
                <div className="p-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-semibold text-sm">
                      {user?.name?.slice(0, 2).toUpperCase() || 'ME'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-200">{user?.name}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-medium">
                          You
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">{user?.email}</span>
                    </div>
                  </div>

                  <span className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-800 text-indigo-300 border border-slate-700">
                    {activeMembership?.role || 'MEMBER'}
                  </span>
                </div>
              </div>
            </div>

            {/* Pending & Past Invitations Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-sm shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-400" />
                    <span>Invitations</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Track sent invitations, resend expired links, or revoke pending access.
                  </p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchInvitations}
                  disabled={isLoadingInvitations}
                  className="border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800 text-xs"
                >
                  <RotateCw className={`w-3.5 h-3.5 mr-1.5 ${isLoadingInvitations ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>

              {isLoadingInvitations ? (
                <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                  <span>Loading invitations...</span>
                </div>
              ) : invitations.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs">
                  <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="font-medium text-slate-300">No invitations found</p>
                  <p className="text-slate-500 mt-1">Invite your teammates to collaborate on this organization.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="px-5 py-3">Invitee Email</th>
                        <th className="px-5 py-3">Role</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3">Expires</th>
                        <th className="px-5 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {invitations.map((inv) => {
                        const isExpired = inv.expiresAt < Date.now() || inv.status === 'EXPIRED';
                        const isPending = inv.status === 'PENDING' && !isExpired;
                        const isCancelled = inv.status === 'CANCELLED';
                        const isAccepted = inv.status === 'ACCEPTED';

                        return (
                          <tr key={inv.id} className="hover:bg-slate-800/30 transition-colors">
                            <td className="px-5 py-4 font-medium text-slate-200">{inv.email}</td>
                            <td className="px-5 py-4">
                              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                                {inv.role}
                              </span>
                            </td>
                            <td className="px-5 py-4">
                              {isPending && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                  <Clock className="w-3 h-3" />
                                  Pending
                                </span>
                              )}
                              {isExpired && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-500/10 text-rose-300 border border-rose-500/20">
                                  <AlertCircle className="w-3 h-3" />
                                  Expired
                                </span>
                              )}
                              {isCancelled && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                                  <XCircle className="w-3 h-3" />
                                  Cancelled
                                </span>
                              )}
                              {isAccepted && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Accepted
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-4 text-slate-400">
                              {new Date(inv.expiresAt).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </td>
                            <td className="px-5 py-4 text-right space-x-2">
                              {isOwnerOrAdmin && (isPending || isExpired) && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleResendInvitation(inv.id)}
                                    disabled={resendingId === inv.id}
                                    className="border-slate-800 bg-slate-950 text-indigo-300 hover:bg-slate-800 text-[11px] h-7 px-2.5"
                                  >
                                    {resendingId === inv.id ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <RotateCw className="w-3 h-3 mr-1" />
                                    )}
                                    Resend
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleCancelInvitation(inv.id)}
                                    disabled={cancellingId === inv.id}
                                    className="border-rose-900/40 bg-rose-950/20 text-rose-300 hover:bg-rose-950/40 text-[11px] h-7 px-2.5"
                                  >
                                    {cancellingId === inv.id ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <XCircle className="w-3 h-3 mr-1" />
                                    )}
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

        {/* Tab 2: Audit Logs */}
        {activeTab === 'audit' && (
          <div className="space-y-6">
            {!isOwnerOrAdmin ? (
              <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-sm">
                <Shield className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                <h3 className="text-sm font-semibold text-slate-200">Restricted Access</h3>
                <p className="text-xs text-slate-400 mt-1">
                  You must be an Organization Owner or Admin to inspect the security audit trail.
                </p>
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-sm shadow-sm overflow-hidden">
                {/* Audit Header & Search */}
                <div className="p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                      <ScrollText className="w-4 h-4 text-indigo-400" />
                      <span>Security & Activity Audit Trail</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Immutable record of configuration, invitation, membership, and security actions.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <Input
                        type="text"
                        placeholder="Filter by action (e.g. invitation)"
                        value={actionFilter}
                        onChange={(e) => {
                          setActionFilter(e.target.value);
                          setPage(1);
                        }}
                        className="pl-8 h-8 text-xs bg-slate-950 border-slate-800 text-slate-100 w-56 focus:border-indigo-500"
                      />
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={fetchAuditLogs}
                      disabled={isLoadingAuditLogs}
                      className="border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800 text-xs h-8 px-2.5"
                    >
                      <RotateCw className={`w-3.5 h-3.5 ${isLoadingAuditLogs ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </div>

                {isLoadingAuditLogs ? (
                  <div className="p-16 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                    <span>Loading audit stream...</span>
                  </div>
                ) : auditLogs.length === 0 ? (
                  <div className="p-16 text-center text-slate-400 text-xs">
                    <Filter className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="font-medium text-slate-300">No audit records found</p>
                    <p className="text-slate-500 mt-1">
                      {actionFilter ? 'Try clearing your filter criteria.' : 'Activity will appear as actions occur.'}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                          <tr>
                            <th className="px-5 py-3">Timestamp</th>
                            <th className="px-5 py-3">Actor</th>
                            <th className="px-5 py-3">Action</th>
                            <th className="px-5 py-3">Resource</th>
                            <th className="px-5 py-3 text-right">Details</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {auditLogs.map((log) => {
                            const isExpanded = expandedLogId === log.id;

                            return (
                              <React.Fragment key={log.id}>
                                <tr
                                  className={`hover:bg-slate-800/30 transition-colors cursor-pointer ${
                                    isExpanded ? 'bg-slate-800/20' : ''
                                  }`}
                                  onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                >
                                  <td className="px-5 py-3.5 text-slate-400 whitespace-nowrap">
                                    {new Date(log.timestamp).toLocaleString(undefined, {
                                      month: 'short',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      second: '2-digit',
                                    })}
                                  </td>
                                  <td className="px-5 py-3.5">
                                    {log.actor ? (
                                      <div>
                                        <span className="font-medium text-slate-200 block">{log.actor.name}</span>
                                        <span className="text-[11px] text-slate-400">{log.actor.email}</span>
                                      </div>
                                    ) : (
                                      <span className="text-slate-400 font-mono text-[11px]">System</span>
                                    )}
                                  </td>
                                  <td className="px-5 py-3.5">
                                    <span
                                      className={`px-2 py-0.5 rounded border text-[11px] font-mono font-medium ${getActionBadgeColor(
                                        log.action
                                      )}`}
                                    >
                                      {log.action}
                                    </span>
                                  </td>
                                  <td className="px-5 py-3.5 font-mono text-slate-400 text-[11px]">{log.resource}</td>
                                  <td className="px-5 py-3.5 text-right">
                                    <button
                                      type="button"
                                      className="text-slate-400 hover:text-slate-200 inline-flex items-center gap-1 text-[11px]"
                                    >
                                      <span>{isExpanded ? 'Hide' : 'View'}</span>
                                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                    </button>
                                  </td>
                                </tr>
                                {isExpanded && log.metadata && (
                                  <tr className="bg-slate-950/80 border-b border-slate-800">
                                    <td colSpan={5} className="px-5 py-3">
                                      <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto">
                                        <pre>{JSON.stringify(log.metadata, null, 2)}</pre>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination Bar */}
                    <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 bg-slate-950/40">
                      <div>
                        Showing <span className="font-medium text-slate-200">{auditLogs.length}</span> of{' '}
                        <span className="font-medium text-slate-200">{totalLogs}</span> events
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={page <= 1 || isLoadingAuditLogs}
                          className="border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800 h-7 text-xs px-2.5"
                        >
                          <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                          Previous
                        </Button>
                        <span className="text-xs px-2 text-slate-300">
                          Page {page} of {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          disabled={page >= totalPages || isLoadingAuditLogs}
                          className="border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800 h-7 text-xs px-2.5"
                        >
                          Next
                          <ChevronRight className="w-3.5 h-3.5 ml-1" />
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
          <div className="space-y-6">
            {/* Leave Organization */}
            <div className="bg-slate-900 border border-slate-800 rounded-sm p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                    <DoorOpen className="w-4 h-4 text-amber-400" />
                    <span>Leave Organization</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-xl">
                    Resign from this workspace. You will immediately lose access to all modules, team discussions, and
                    tools. {isOwner && 'Note: As an Owner, you cannot leave if there are other members unless you transfer ownership first.'}
                  </p>
                </div>

                <Button
                  variant="outline"
                  onClick={() => setIsLeaveModalOpen(true)}
                  className="border-amber-900/40 bg-amber-950/20 text-amber-300 hover:bg-amber-950/40 text-xs px-4 self-start sm:self-auto"
                >
                  <DoorOpen className="w-3.5 h-3.5 mr-1.5" />
                  Leave Workspace
                </Button>
              </div>
            </div>

            {/* Delete Organization */}
            {isOwner && (
              <div className="bg-rose-950/10 border border-rose-900/30 rounded-sm p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-semibold text-rose-400 flex items-center gap-2">
                      <Trash2 className="w-4 h-4" />
                      <span>Delete Organization</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-xl">
                      Permanently delete this organization workspace, settings, initialized modules, and cancel pending
                      invitations. This action cannot be undone. You cannot delete an organization while other active members
                      are present.
                    </p>
                  </div>

                  <Button
                    onClick={() => setIsDeleteModalOpen(true)}
                    className="bg-rose-600 hover:bg-rose-500 text-white text-xs px-4 self-start sm:self-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                    Delete Organization
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Invite Member Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-sm p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-indigo-400" />
              <span>Invite Team Member</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1 mb-5">
              Send an invitation email to add a teammate to this organization workspace.
            </p>

            <form onSubmit={handleSendInvitation} className="space-y-4">
              <div>
                <Label htmlFor="inviteEmail" className="text-xs text-slate-300">
                  Email Address
                </Label>
                <Input
                  id="inviteEmail"
                  type="email"
                  required
                  autoFocus
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="mt-1 bg-slate-950 border-slate-800 text-slate-100 text-sm"
                />
              </div>

              <div>
                <Label htmlFor="inviteRole" className="text-xs text-slate-300">
                  Role & Permissions
                </Label>
                <select
                  id="inviteRole"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as Role)}
                  className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="MEMBER">Member (Standard workspace access)</option>
                  <option value="MANAGER">Manager (Team & module management)</option>
                  <option value="ADMIN">Admin (Full configuration & invites)</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSendingInvite || !inviteEmail.trim()}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-4"
                >
                  {isSendingInvite ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Send Invitation'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Leave Organization Modal */}
      {isLeaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-sm p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-semibold text-amber-400 flex items-center gap-2">
              <DoorOpen className="w-5 h-5" />
              <span>Leave {activeMembership?.organization?.name}?</span>
            </h3>
            <p className="text-xs text-slate-300 mt-2">
              Are you sure you want to resign from <span className="font-semibold text-slate-100">{activeMembership?.organization?.name}</span>? You will lose access to all modules and team assets.
            </p>

            <div className="flex justify-end gap-3 pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsLeaveModalOpen(false)}
                className="border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800 text-xs"
              >
                Cancel
              </Button>
              <Button
                onClick={handleLeaveOrganization}
                disabled={isLeaving}
                className="bg-amber-600 hover:bg-amber-500 text-white text-xs px-4"
              >
                {isLeaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                    Leaving...
                  </>
                ) : (
                  'Yes, Leave Workspace'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Organization Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-sm p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-semibold text-rose-400 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              <span>Delete Organization Permanently</span>
            </h3>
            <p className="text-xs text-slate-300 mt-2">
              This will permanently destroy <span className="font-semibold text-slate-100">{activeMembership?.organization?.name}</span>, all associated settings, module records, invitations, and audit logs.
            </p>

            <form onSubmit={handleDeleteOrganization} className="mt-4 space-y-4">
              <div>
                <Label htmlFor="deletePassword" className="text-xs text-slate-300 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-slate-400" />
                  <span>Enter Account Password to Confirm</span>
                </Label>
                <Input
                  id="deletePassword"
                  type="password"
                  required
                  placeholder="Your account password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="mt-1 bg-slate-950 border-slate-800 text-slate-100 text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setDeletePassword('');
                  }}
                  className="border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isDeleting || !deletePassword}
                  className="bg-rose-600 hover:bg-rose-500 text-white text-xs px-4"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Delete Organization'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
