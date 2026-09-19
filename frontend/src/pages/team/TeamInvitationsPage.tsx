import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { api } from '@/lib/api';
import {
  Mail,
  Users,
  Search,
  Filter,
  RefreshCw,
  UserPlus,
  Send,
  Trash2,
  Copy,
  Check,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronRight,
  Shield,
  Building2,
  Sparkles
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';

interface InvitationBranchAssignment {
  branchId: string;
  branchName?: string;
  branchCode?: string;
  branchRole: string;
  isPrimary?: boolean;
}

interface TeamInvitation {
  id: string;
  email: string;
  phoneNumber?: string;
  appRole: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  invitedBy: string;
  invitedByName?: string;
  invitedAt: number;
  expiresAt: number;
  token?: string;
  branchAssignments?: InvitationBranchAssignment[];
}

export const TeamInvitationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspaceStore();

  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'pending' | 'accepted' | 'expired' | 'revoked'>('pending');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadInvitations = async () => {
    if (!currentWorkspace?.id) return;
    setIsLoading(true);
    try {
      const res = await api.get<{
        success: boolean;
        data: {
          invitations: TeamInvitation[];
        };
      }>(`/applications/inventory/team/invitations?workspaceId=${currentWorkspace.id}`);

      if (res?.data?.invitations) {
        setInvitations(res.data.invitations);
      }
    } catch (err) {
      console.error('Failed to load team invitations', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInvitations();
  }, [currentWorkspace?.id]);

  const handleCopyInviteLink = (invitation: TeamInvitation) => {
    const inviteUrl = `${window.location.origin}/invite/${invitation.token || invitation.id}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedId(invitation.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleRevoke = async (invitationId: string) => {
    if (!currentWorkspace?.id) return;
    if (!window.confirm('Are you sure you want to revoke this invitation? The link will be immediately invalidated.')) {
      return;
    }

    setActionInProgressId(invitationId);
    setFeedbackMessage(null);
    try {
      await api.post('/applications/inventory/team/invitations/revoke', {
        workspaceId: currentWorkspace.id,
        applicationKey: 'inventory',
        invitationId
      });
      setFeedbackMessage({ type: 'success', text: 'Invitation revoked successfully.' });
      loadInvitations();
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err?.message || 'Failed to revoke invitation.' });
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleResend = async (invitation: TeamInvitation) => {
    if (!currentWorkspace?.id) return;
    setActionInProgressId(invitation.id);
    setFeedbackMessage(null);
    try {
      await api.post('/applications/inventory/team/invitations/resend', {
        workspaceId: currentWorkspace.id,
        applicationKey: 'inventory',
        invitationId: invitation.id
      });
      setFeedbackMessage({ type: 'success', text: `Invitation re-sent to ${invitation.email}.` });
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err?.message || 'Failed to re-send invitation.' });
    } finally {
      setActionInProgressId(null);
    }
  };

  const filteredInvitations = invitations.filter((inv) => {
    const matchesSearch =
      inv.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inv.phoneNumber && inv.phoneNumber.includes(searchQuery));

    const matchesStatus = statusFilter === 'ALL' || inv.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const pendingCount = invitations.filter((i) => i.status === 'pending').length;
  const acceptedCount = invitations.filter((i) => i.status === 'accepted').length;

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6 text-slate-100 selection:bg-[#714b67] selection:text-white">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#e296cb] mb-1">
            <Link to="/inventory/team/members" className="hover:underline flex items-center gap-1">
              <Users className="w-3.5 h-3.5" /> Team Members
            </Link>
            <ChevronRight className="w-3 h-3 text-slate-500" />
            <span className="text-slate-300">Invitations</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            Team Invitations
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#714b67]/30 text-[#f3bce2] border border-[#714b67]/50">
              {pendingCount} Pending
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Track, re-send, or revoke pending invitations for staff and operators joining your Inventory app.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={loadInvitations}
            disabled={isLoading}
            className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-medium text-slate-300 flex items-center gap-2 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link
            to="/inventory/team/members/add"
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#8a4b77] to-[#714b67] hover:from-[#9c5587] hover:to-[#825676] text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-[#714b67]/25 transition"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Invite Member
          </Link>
        </div>
      </div>

      {feedbackMessage && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="text-slate-400 hover:text-white transition text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Control Bar: Filters, Tabs, Search */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-[#130b13] border border-white/10 p-4 rounded-2xl">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-white/5 rounded-xl border border-white/10 w-full md:w-auto overflow-x-auto">
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 ${
              statusFilter === 'pending'
                ? 'bg-[#714b67] text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Pending ({pendingCount})
          </button>
          <button
            onClick={() => setStatusFilter('accepted')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 ${
              statusFilter === 'accepted'
                ? 'bg-[#714b67] text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Accepted ({acceptedCount})
          </button>
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 ${
              statusFilter === 'ALL'
                ? 'bg-[#714b67] text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All History ({invitations.length})
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search email or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-[#e296cb]"
          />
        </div>
      </div>

      {/* Invitations Table */}
      <div className="bg-[#120a12] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Spinner className="w-8 h-8 text-[#e296cb]" />
            <p className="text-xs text-slate-400 mt-3">Loading invitation records...</p>
          </div>
        ) : filteredInvitations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <Mail className="w-12 h-12 text-slate-600 mb-3" />
            <h3 className="text-base font-bold text-white">No invitations found</h3>
            <p className="text-xs text-slate-400 max-w-sm mt-1">
              {searchQuery
                ? 'No invitations match your search query.'
                : 'There are currently no team invitations in this filter state.'}
            </p>
            <Link
              to="/inventory/team/members/add"
              className="mt-4 px-4 py-2 rounded-xl bg-gradient-to-r from-[#8a4b77] to-[#714b67] text-white text-xs font-semibold flex items-center gap-2 shadow-lg transition"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Invite Team Member
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02] text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Recipient</th>
                  <th className="py-3 px-4">App Role</th>
                  <th className="py-3 px-4">Branch Assignments</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Expires</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-200">
                {filteredInvitations.map((inv) => {
                  const isExpired = inv.expiresAt < Date.now() && inv.status === 'pending';
                  const status = isExpired ? 'expired' : inv.status;
                  const isProcessing = actionInProgressId === inv.id;

                  return (
                    <tr key={inv.id} className="hover:bg-white/[0.02] transition">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#8a4b77]/40 to-[#512c47]/40 border border-white/10 flex items-center justify-center text-[#e296cb] font-bold text-xs shrink-0">
                            <Mail className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-semibold text-white block">{inv.email}</span>
                            {inv.phoneNumber && (
                              <span className="text-[10px] text-slate-400 font-mono block">
                                {inv.phoneNumber}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-medium text-slate-300 capitalize">
                          {inv.appRole.replace('_', ' ')}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        {inv.branchAssignments && inv.branchAssignments.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 max-w-xs">
                            {inv.branchAssignments.map((ba, idx) => (
                              <span
                                key={idx}
                                className="text-[10px] font-medium px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300"
                              >
                                {ba.branchName || ba.branchId} ({ba.branchRole.replace('_', ' ')})
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-500 italic">All Branches</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {status === 'pending' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            <Clock className="w-3 h-3" /> Pending
                          </span>
                        )}
                        {status === 'accepted' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3" /> Accepted
                          </span>
                        )}
                        {status === 'expired' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/20 text-slate-400 border border-slate-500/30">
                            <Clock className="w-3 h-3" /> Expired
                          </span>
                        )}
                        {status === 'revoked' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                            <XCircle className="w-3 h-3" /> Revoked
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                        {new Date(inv.expiresAt).toLocaleDateString()}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleCopyInviteLink(inv)}
                                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition"
                                title="Copy Direct Acceptance Link"
                              >
                                {copiedId === inv.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>

                              <button
                                onClick={() => handleResend(inv)}
                                disabled={isProcessing}
                                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition disabled:opacity-50"
                                title="Re-send Email Invitation"
                              >
                                <Send className="w-3.5 h-3.5 text-[#e296cb]" />
                              </button>

                              <button
                                onClick={() => handleRevoke(inv.id)}
                                disabled={isProcessing}
                                className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition disabled:opacity-50"
                                title="Revoke Invitation"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
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
  );
};
