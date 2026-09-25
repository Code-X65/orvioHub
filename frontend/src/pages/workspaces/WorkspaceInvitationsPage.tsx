import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Mail,
  UserPlus,
  Copy,
  RotateCcw,
  Trash2,
  Clock,
  Loader2,
  ArrowLeft,
} from 'lucide-react';

export const WorkspaceInvitationsPage: React.FC = () => {
  const { workspaceId: paramWorkspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const { memberships, activeOrganizationId } = useAuthStore();
  const { currentWorkspace } = useWorkspaceStore();

  const workspaceId = paramWorkspaceId || activeOrganizationId || currentWorkspace?.id;
  const activeMembership =
    memberships.find((m) => m.organization.id === workspaceId) || memberships[0];

  const isOwnerOrAdmin = activeMembership?.role === 'OWNER' || activeMembership?.role === 'ADMIN';

  const [invitations, setInvitations] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInviting, setIsInviting] = useState(false);

  // Invite Form
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<
    'OWNER' | 'ADMIN' | 'MANAGER' | 'SALES_ATTENDANT' | 'STOCK_MANAGER' | 'ACCOUNTANT' | 'MEMBER' | 'VIEWER'
  >('MEMBER');
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);

  const loadData = async () => {
    if (!workspaceId) return;
    setIsLoading(true);
    try {
      const [invRes, branchRes] = await Promise.all([
        api.get<{ data: any[] }>(`/organizations/${workspaceId}/invitations`).catch(() => ({ data: [] })),
        api.get<{ data: any[] }>(`/workspaces/${workspaceId}/inventory/branches`).catch(() => ({ data: [] })),
      ]);
      setInvitations(invRes.data || []);
      setBranches(branchRes.data || []);
    } catch (err: any) {
      toast.error('Failed to load invitations: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [workspaceId]);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId || !email) return;

    setIsInviting(true);
    try {
      await api.post(`/organizations/${workspaceId}/invitations`, {
        invitations: [
          {
            email: email.trim().toLowerCase(),
            role,
            branchAccess: selectedBranchIds.length > 0 ? selectedBranchIds : undefined,
          },
        ],
      });
      toast.success(`Invitation sent to ${email}.`);
      setEmail('');
      setSelectedBranchIds([]);
      await loadData();
    } catch (err: any) {
      toast.error('Failed to send invitation: ' + err.message);
    } finally {
      setIsInviting(false);
    }
  };


  const handleResend = async (invitationId: string, inviteEmail: string) => {
    if (!workspaceId) return;
    try {
      await api.post(`/invitations/${invitationId}/resend`, {});
      toast.success(`Invitation resent to ${inviteEmail}.`);
      await loadData();
    } catch (err: any) {
      toast.error('Failed to resend invitation: ' + err.message);
    }
  };

  const handleCancel = async (invitationId: string) => {
    if (!workspaceId) return;
    try {
      await api.delete(`/invitations/${invitationId}`);
      toast.success('Invitation cancelled.');
      await loadData();
    } catch (err: any) {
      toast.error('Failed to cancel invitation: ' + err.message);
    }
  };

  const copyInviteLink = (token: string) => {
    const url = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(url);
    toast.success('Invitation link copied to clipboard.');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-6 h-6 text-[#e6a8d6] animate-spin" />
        <p className="text-xs text-slate-400">Loading invitations...</p>
      </div>
    );
  }

  const pendingInvitations = invitations.filter(
    (i) => (i.status || '').toUpperCase() === 'PENDING'
  );

  return (
    <div className="min-h-screen bg-black text-slate-100 p-6 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Mail className="w-6 h-6 text-purple-400" />
            Team Invitations
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Invite teammates to your workspace and assign roles and branch access.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/settings/members')}
          className="text-xs border-white/10 hover:bg-white/5"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
          Back to Members
        </Button>
      </div>

      {/* Invite Form */}
      {isOwnerOrAdmin && (
        <form
          onSubmit={handleSendInvite}
          className="p-5 rounded-2xl border border-white/10 bg-neutral-900/60 space-y-4 shadow-xl"
        >
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-purple-400" />
            Invite New Member
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs text-slate-300">Email Address *</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@example.com"
                required
                className="bg-black/60 border-white/15 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">Workspace Role *</Label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="w-full bg-black/60 border border-white/15 rounded-lg px-3 py-2 text-xs text-white"
              >
                <option value="OWNER">Owner (Full Legal & Org Ownership)</option>
                <option value="ADMIN">Admin (Full Control)</option>
                <option value="MANAGER">Manager (Store/Ops Lead)</option>
                <option value="SALES_ATTENDANT">Sales Attendant (POS Checkout)</option>
                <option value="STOCK_MANAGER">Stock Keeper (Inventory Audits)</option>
                <option value="ACCOUNTANT">Accountant (Finance & Billing)</option>
                <option value="MEMBER">Member (Standard Access)</option>
                <option value="VIEWER">Viewer (Read Only)</option>
              </select>
            </div>
          </div>

          {branches.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">Assign Branch Access</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {branches.map((b) => {
                  const isChecked = selectedBranchIds.includes(b.id || b._id);
                  return (
                    <label
                      key={b.id || b._id}
                      className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition ${
                        isChecked
                          ? 'border-purple-500/40 bg-purple-500/10 text-white'
                          : 'border-white/10 bg-black/40 text-slate-400'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const id = b.id || b._id;
                          if (e.target.checked) {
                            setSelectedBranchIds([...selectedBranchIds, id]);
                          } else {
                            setSelectedBranchIds(selectedBranchIds.filter((x) => x !== id));
                          }
                        }}
                        className="rounded border-white/20 text-purple-600 focus:ring-0"
                      />
                      <span className="truncate">{b.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              size="sm"
              disabled={isInviting || !email}
              className="bg-purple-600 hover:bg-purple-500 text-xs"
            >
              {isInviting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Send Invitation'}
            </Button>
          </div>
        </form>
      )}

      {/* Pending Invitations List */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-400" />
          Pending Invitations ({pendingInvitations.length})
        </h2>

        {pendingInvitations.length === 0 ? (
          <div className="p-8 text-center rounded-2xl border border-white/10 bg-neutral-900/30 text-slate-500 text-xs">
            No pending invitations. Invite team members above.
          </div>
        ) : (
          <div className="divide-y divide-white/5 rounded-2xl border border-white/10 bg-neutral-900/40 overflow-hidden">
            {pendingInvitations.map((inv) => (
              <div key={inv.id || inv._id} className="p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-white">{inv.email}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      {inv.role}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Invited {new Date(inv.createdAt || Date.now()).toLocaleDateString()} • Expires in{' '}
                    {Math.max(0, Math.ceil(((inv.expiresAt || 0) - Date.now()) / 86400000))} days
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {inv.token && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyInviteLink(inv.token)}
                      className="text-xs text-slate-300 hover:text-white"
                      title="Copy invitation link"
                    >
                      <Copy className="w-3.5 h-3.5 mr-1" />
                      Copy Link
                    </Button>
                  )}
                  {isOwnerOrAdmin && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleResend(inv.id || inv._id, inv.email)}
                        className="text-xs text-slate-300 hover:text-white"
                        title="Resend invitation"
                      >
                        <RotateCcw className="w-3.5 h-3.5 mr-1" />
                        Resend
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCancel(inv.id || inv._id)}
                        className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                        title="Cancel invitation"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
