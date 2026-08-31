import React, { useState, useEffect } from 'react';
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

interface InvitationRecord {
  id: string;
  email: string;
  role: string;
  productKey?: string;
  branchIds?: string[];
  status: string;
  expiresAt: number;
  isExpired: boolean;
  createdAt: number;
}

export const WorkspaceMembers: React.FC = () => {
  const navigate = useNavigate();
  const { currentWorkspace, currentRole, hasPermission } = useWorkspaceStore();

  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [invitations, setInvitations] = useState<InvitationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'members' | 'invitations'>('members');

  // Modal states
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviteProductKey, setInviteProductKey] = useState('inventory');
  const [inviteProductRole, setInviteProductRole] = useState('sales_attendant');
  const [inviteMessage, setInviteMessage] = useState('');

  // Role Edit Modal
  const [editingMember, setEditingMember] = useState<MemberRecord | null>(null);
  const [editRole, setEditRole] = useState('member');
  const [editProductRole, setEditProductRole] = useState('sales_attendant');
  const [isSavingRole, setIsSavingRole] = useState(false);

  // Suspend/Remove Modals
  const [actionMember, setActionMember] = useState<MemberRecord | null>(null);
  const [actionType, setActionType] = useState<'suspend' | 'remove' | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  const canManageMembers = hasPermission('workspace.manage_members') || currentRole === 'owner' || currentRole === 'admin';

  const loadData = async () => {
    if (!currentWorkspace?.id) return;
    setIsLoading(true);
    try {
      const [membersRes, invitesRes] = await Promise.all([
        api.get<{ members: MemberRecord[] }>(`/workspaces/${currentWorkspace.id}/members`),
        api.get<{ invitations: InvitationRecord[] }>(`/workspaces/${currentWorkspace.id}/invitations`),
      ]);
      setMembers(membersRes.members || []);
      setInvitations(invitesRes.invitations || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load team data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentWorkspace?.id]);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !currentWorkspace?.id) return;

    setIsSubmittingInvite(true);
    try {
      await api.post(`/workspaces/${currentWorkspace.id}/invitations`, {
        email: inviteEmail.trim().toLowerCase(),
        role: inviteRole,
        productKey: inviteProductKey,
        message: inviteMessage.trim() || undefined,
      });

      toast.success(`Invitation sent to ${inviteEmail}`);
      setIsInviteModalOpen(false);
      setInviteEmail('');
      setInviteMessage('');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send invitation');
    } finally {
      setIsSubmittingInvite(false);
    }
  };

  const handleUpdateRole = async () => {
    if (!editingMember || !currentWorkspace?.id) return;
    setIsSavingRole(true);
    try {
      await api.patch(`/workspaces/${currentWorkspace.id}/members/${editingMember.id}`, {
        role: editRole,
        productKey: 'inventory',
        productRole: editProductRole,
      });
      toast.success(`Updated role for ${editingMember.name}`);
      setEditingMember(null);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update member role');
    } finally {
      setIsSavingRole(false);
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
        toast.success(`${actionMember.name} has been suspended.`);
      } else if (actionType === 'remove') {
        await api.delete(`/workspaces/${currentWorkspace.id}/members/${actionMember.id}`);
        toast.success(`${actionMember.name} has been removed from organization.`);
      }
      setActionMember(null);
      setActionType(null);
      setActionReason('');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to process member action');
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleRestoreMember = async (memberId: string, memberName: string) => {
    if (!currentWorkspace?.id) return;
    try {
      await api.post(`/workspaces/${currentWorkspace.id}/members/${memberId}/restore`, {});
      toast.success(`${memberName} has been restored.`);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to restore member');
    }
  };

  const handleResendInvite = async (inviteId: string) => {
    if (!currentWorkspace?.id) return;
    try {
      await api.post(`/workspaces/${currentWorkspace.id}/invitations/${inviteId}/resend`, {});
      toast.success('Invitation resent successfully');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to resend invitation');
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    if (!currentWorkspace?.id) return;
    try {
      await api.post(`/workspaces/${currentWorkspace.id}/invitations/${inviteId}/revoke`, {});
      toast.success('Invitation revoked');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to revoke invitation');
    }
  };

  const filteredMembers = members.filter((m) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.name.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      m.role.toLowerCase().includes(q)
    );
  });

  const filteredInvitations = invitations.filter((inv) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return inv.email.toLowerCase().includes(q) || inv.role.toLowerCase().includes(q);
  });

  const activeMembersCount = members.filter((m) => m.status.toLowerCase() === 'active').length;
  const suspendedCount = members.filter((m) => m.status.toLowerCase() === 'suspended').length;
  const pendingInvitesCount = invitations.filter((i) => i.status.toLowerCase() === 'pending' && !i.isExpired).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4 sm:gap-6">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="p-2 rounded-sm bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center font-bold text-white shadow-sm text-xs">
                <Users className="w-4 h-4" />
              </div>
              <span className="font-bold text-white text-sm">Organization Members</span>
            </div>
            <WorkspaceSwitcher />
          </div>

          <div className="flex items-center gap-3">
            {canManageMembers && (
              <Button
                onClick={() => setIsInviteModalOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-sm h-9 shadow-md shadow-indigo-600/20 flex items-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Invite Members</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 space-y-6">
        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center gap-4">
            <div className="w-10 h-10 rounded-sm bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-400">Active Members</span>
              <p className="text-xl font-bold text-white">{activeMembersCount}</p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center gap-4">
            <div className="w-10 h-10 rounded-sm bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-400">Pending Invitations</span>
              <p className="text-xl font-bold text-white">{pendingInvitesCount}</p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center gap-4">
            <div className="w-10 h-10 rounded-sm bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
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
              className={`px-4 py-2 rounded-sm text-xs font-semibold transition-all cursor-pointer ${
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
              className={`px-4 py-2 rounded-sm text-xs font-semibold transition-all cursor-pointer ${
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
              className="pl-9 bg-slate-900/90 border-slate-800 text-white text-xs rounded-sm h-9"
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
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3.5">Member</th>
                  <th className="p-3.5">Organization Role</th>
                  <th className="p-3.5">Product Role</th>
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
                    const productRole = m.productAccess?.[0]?.role;

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
                          {productRole ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                              <Store className="w-3 h-3" />
                              <span className="capitalize">{productRole.replace('_', ' ')}</span>
                            </span>
                          ) : (
                            <span className="text-slate-500 italic">No assigned role</span>
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
                                onClick={() => {
                                  setEditingMember(m);
                                  setEditRole(m.role);
                                  setEditProductRole(m.productAccess?.[0]?.role || 'sales_attendant');
                                }}
                                className="h-7 text-xs text-slate-300 hover:text-white cursor-pointer"
                              >
                                Edit Role
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
                                Remove
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
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3.5">Email</th>
                  <th className="p-3.5">Role</th>
                  <th className="p-3.5">Product</th>
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
                        <td className="p-3.5 uppercase font-mono text-[10px] text-slate-400">
                          {inv.role}
                        </td>
                        <td className="p-3.5 capitalize text-slate-300">
                          {inv.productKey || 'All'}
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

      {/* Invite Member Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h2 className="text-base font-bold text-white">Invite Member to Organization</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSendInvite} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Email Address *</label>
                <Input
                  type="email"
                  required
                  placeholder="colleague@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white text-xs rounded-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Product</label>
                  <CustomSelect
                    options={[
                      { value: 'inventory', label: 'Inventory' },
                      { value: 'taskmanagement', label: 'Tasks' },
                    ]}
                    value={inviteProductKey}
                    onChange={(val) => setInviteProductKey(val)}
                    searchable={false}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Organization Role</label>
                  <CustomSelect
                    options={[
                      { value: 'member', label: 'Member' },
                      { value: 'admin', label: 'Admin' },
                      { value: 'viewer', label: 'Viewer' },
                    ]}
                    value={inviteRole}
                    onChange={(val) => setInviteRole(val)}
                    searchable={false}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Product Role</label>
                  <CustomSelect
                    options={[
                      { value: 'sales_attendant', label: 'Sales Attendant' },
                      { value: 'stock_manager', label: 'Stock Manager' },
                      { value: 'inventory_manager', label: 'Inventory Manager' },
                      { value: 'cashier', label: 'Cashier' },
                    ]}
                    value={inviteProductRole}
                    onChange={(val) => setInviteProductRole(val)}
                    searchable={false}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Custom Message (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Welcome to our organization!"
                  value={inviteMessage}
                  onChange={(e) => setInviteMessage(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-[#160f14] border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#714b67]"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="border-white/10 bg-transparent text-slate-300 text-xs rounded-xl cursor-pointer hover:bg-white/5"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmittingInvite}
                  className="bg-gradient-to-r from-[#714b67] to-[#8a5d7e] hover:from-[#805575] hover:to-[#99678c] text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-[#714b67]/20 cursor-pointer"
                >
                  {isSubmittingInvite && <Spinner className="w-3.5 h-3.5" />}
                  <span>Send Invitation</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Role Modal */}
      {editingMember && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0c080b]/95 border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 backdrop-blur-2xl">
            <h2 className="text-base font-bold text-white">Edit Role: {editingMember.name}</h2>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs text-slate-300 font-medium">Organization Role</label>
                <CustomSelect
                  options={[
                    { value: 'member', label: 'Member' },
                    { value: 'admin', label: 'Admin' },
                    { value: 'viewer', label: 'Viewer' },
                  ]}
                  value={editRole}
                  onChange={(val) => setEditRole(val)}
                  searchable={false}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-slate-300 font-medium">Inventory Product Role</label>
                <CustomSelect
                  options={[
                    { value: 'sales_attendant', label: 'Sales Attendant' },
                    { value: 'stock_manager', label: 'Stock Manager' },
                    { value: 'inventory_manager', label: 'Inventory Manager' },
                    { value: 'cashier', label: 'Cashier' },
                  ]}
                  value={editProductRole}
                  onChange={(val) => setEditProductRole(val)}
                  searchable={false}
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingMember(null)}
                className="border-white/10 bg-transparent text-xs rounded-xl cursor-pointer hover:bg-white/5"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={isSavingRole}
                onClick={handleUpdateRole}
                className="bg-gradient-to-r from-[#714b67] to-[#8a5d7e] hover:from-[#805575] hover:to-[#99678c] text-xs font-semibold text-white rounded-xl shadow-md shadow-[#714b67]/20 cursor-pointer"
              >
                {isSavingRole && <Spinner className="w-3 h-3 mr-1" />}
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Suspend / Remove Confirmation Modal */}
      {actionMember && actionType && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                  actionType === 'suspend'
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}
              >
                {actionType === 'suspend' ? <Ban className="w-5 h-5" /> : <Trash2 className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="font-bold text-white text-base capitalize">
                  {actionType} {actionMember.name}?
                </h3>
                <p className="text-xs text-slate-400">
                  {actionType === 'suspend'
                    ? 'Temporarily blocks access to all organization applications.'
                    : 'Permanently revokes organization membership and product permissions while preserving historical transaction records.'}
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-400">Reason (Optional)</label>
              <Input
                type="text"
                placeholder="e.g. Employee offboarding"
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                className="bg-slate-950 border-slate-800 text-xs rounded-sm"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setActionMember(null);
                  setActionType(null);
                }}
                className="border-slate-800 text-xs rounded-sm cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={isProcessingAction}
                onClick={handleConfirmAction}
                className={`text-xs rounded-sm text-white cursor-pointer ${
                  actionType === 'suspend' ? 'bg-amber-600 hover:bg-amber-500' : 'bg-rose-600 hover:bg-rose-500'
                }`}
              >
                {isProcessingAction && <Spinner className="w-3 h-3 mr-1" />}
                Confirm {actionType}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="max-w-7xl w-full mx-auto text-center py-4 border-t border-slate-900 text-xs text-slate-500">
        Orviohub Platform • Organization RBAC & Security
      </footer>
    </div>
  );
};
