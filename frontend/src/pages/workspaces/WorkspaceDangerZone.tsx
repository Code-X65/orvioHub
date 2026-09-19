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
  Archive,
  RotateCcw,
  UserCheck,
  Trash2,
  ShieldAlert,
  Loader2,
} from 'lucide-react';

export const WorkspaceDangerZone: React.FC = () => {
  const { workspaceId: paramWorkspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const { memberships, activeOrganizationId, user } = useAuthStore();
  const { currentWorkspace, fetchWorkspaces } = useWorkspaceStore();

  const workspaceId = paramWorkspaceId || activeOrganizationId || currentWorkspace?.id;
  const activeMembership =
    memberships.find((m) => m.organization.id === workspaceId) || memberships[0];

  const isOwner = activeMembership?.role === 'OWNER';

  const [workspace, setWorkspace] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals / Action States
  const [actionType, setActionType] = useState<
    'archive' | 'restore' | 'transfer' | 'delete_request' | 'cancel_delete' | null
  >(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Transfer Ownership Form
  const [transferTargetUserId, setTransferTargetUserId] = useState('');
  const [transferPassword, setTransferPassword] = useState('');
  const [transferReason] = useState('');
  const [confirmationName, setConfirmationName] = useState('');

  const loadData = async () => {
    if (!workspaceId) return;
    setIsLoading(true);
    try {
      const [wsRes, memRes] = await Promise.all([
        api.get<{ data: any }>(`/workspaces/${workspaceId}`),
        api.get<{ data: any[] }>(`/workspaces/${workspaceId}/members`),
      ]);
      setWorkspace(wsRes.data);
      setMembers(memRes.data || []);
    } catch (err: any) {
      toast.error('Failed to load workspace danger zone: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [workspaceId]);

  const handleArchive = async () => {
    if (!workspaceId) return;
    setIsSubmitting(true);
    try {
      await api.post(`/workspaces/${workspaceId}/archive`, { reason: 'Archived via Danger Zone' });
      toast.success('Workspace has been archived.');
      setActionType(null);
      await fetchWorkspaces();
      await loadData();
    } catch (err: any) {
      toast.error('Failed to archive workspace: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRestore = async () => {
    if (!workspaceId) return;
    setIsSubmitting(true);
    try {
      await api.post(`/workspaces/${workspaceId}/restore`, {});
      toast.success('Workspace restored to active state.');
      setActionType(null);
      await fetchWorkspaces();
      await loadData();
    } catch (err: any) {
      toast.error('Failed to restore workspace: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTransferOwnership = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId || !transferTargetUserId) {
      toast.error('Please select an active member to transfer ownership to.');
      return;
    }

    if (confirmationName.trim().toLowerCase() !== (workspace?.name || '').trim().toLowerCase()) {
      toast.error(`Please enter "${workspace?.name}" exactly to confirm.`);
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post(`/workspaces/${workspaceId}/transfer-ownership`, {
        newOwnerUserId: transferTargetUserId,
        password: transferPassword || undefined,
        reason: transferReason || undefined,
      });
      toast.success('Ownership transferred successfully.');
      setActionType(null);
      await fetchWorkspaces();
      navigate('/workspaces');
    } catch (err: any) {
      toast.error('Failed to transfer ownership: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRequest = async () => {
    if (!workspaceId) return;
    if (confirmationName.trim().toLowerCase() !== (workspace?.name || '').trim().toLowerCase()) {
      toast.error(`Please enter "${workspace?.name}" exactly to confirm.`);
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post(`/workspaces/${workspaceId}/deletion/request`, {
        reason: 'Requested via Danger Zone',
      });
      toast.success('Workspace scheduled for deletion. 30-day cooling-off period active.');
      setActionType(null);
      await loadData();
      await fetchWorkspaces();
    } catch (err: any) {
      toast.error('Failed to schedule deletion: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelDelete = async () => {
    if (!workspaceId) return;
    setIsSubmitting(true);
    try {
      await api.post(`/workspaces/${workspaceId}/deletion/cancel`, {});
      toast.success('Workspace deletion cancelled.');
      setActionType(null);
      await loadData();
      await fetchWorkspaces();
    } catch (err: any) {
      toast.error('Failed to cancel deletion: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const otherActiveMembers = members.filter(
    (m) => m.userId !== user?.id && (m.status || '').toLowerCase() === 'active'
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-6 h-6 text-[#e6a8d6] animate-spin" />
        <p className="text-xs text-slate-400">Loading Danger Zone...</p>
      </div>
    );
  }

  const isArchived = (workspace?.status || '').toLowerCase() === 'archived';
  const isPendingDeletion = (workspace?.status || '').toLowerCase() === 'deleting';

  return (
    <div className="min-h-screen bg-black text-slate-100 p-6 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-rose-400" />
            Workspace Danger Zone
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            High-impact administrative actions: Ownership transfer, archival, and deletion workflows.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/settings')}
          className="text-xs border-white/10 hover:bg-white/5"
        >
          Back to Settings
        </Button>
      </div>

      {/* Workspace Status Banner */}
      {isPendingDeletion && (
        <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-rose-300">Workspace Scheduled for Deletion</p>
            <p className="text-xs text-slate-400">
              Cooling-off period is active. You can cancel deletion at any time before purge.
            </p>
          </div>
          <Button
            size="sm"
            onClick={handleCancelDelete}
            disabled={isSubmitting}
            className="bg-rose-600 hover:bg-rose-500 text-xs"
          >
            Cancel Deletion
          </Button>
        </div>
      )}

      {isArchived && (
        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-amber-300">Workspace is Archived (Read-Only)</p>
            <p className="text-xs text-slate-400">
              Transactions and operations are paused. Historical data remains intact.
            </p>
          </div>
          <Button
            size="sm"
            onClick={handleRestore}
            disabled={isSubmitting}
            className="bg-amber-600 hover:bg-amber-500 text-xs"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            Restore Workspace
          </Button>
        </div>
      )}

      {/* Action 1: Ownership Transfer */}
      <div className="p-5 rounded-2xl border border-purple-500/20 bg-purple-500/5 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-purple-400" />
              Transfer Workspace Ownership
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              Transfer primary ownership and legal control of this organization to another active team member.
              You will automatically become an Administrator.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={!isOwner}
            onClick={() => {
              setActionType('transfer');
              setConfirmationName('');
            }}
            className="border-purple-500/30 text-purple-300 hover:bg-purple-500/20 text-xs shrink-0"
          >
            Transfer Ownership
          </Button>
        </div>
      </div>

      {/* Action 2: Archive / Unarchive */}
      <div className="p-5 rounded-2xl border border-amber-500/20 bg-amber-500/5 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Archive className="w-4 h-4 text-amber-400" />
              {isArchived ? 'Restore Workspace' : 'Archive Workspace'}
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              {isArchived
                ? 'Re-activate this workspace and resume normal operations and transactions.'
                : 'Place the workspace in read-only archive mode. Historical records, receipts, and audit logs are preserved.'}
            </p>
          </div>
          {isArchived ? (
            <Button
              size="sm"
              variant="outline"
              disabled={!isOwner}
              onClick={handleRestore}
              className="border-amber-500/30 text-amber-300 hover:bg-amber-500/20 text-xs shrink-0"
            >
              Restore Workspace
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={!isOwner}
              onClick={() => setActionType('archive')}
              className="border-amber-500/30 text-amber-300 hover:bg-amber-500/20 text-xs shrink-0"
            >
              Archive Workspace
            </Button>
          )}
        </div>
      </div>

      {/* Action 3: Deletion */}
      <div className="p-5 rounded-2xl border border-rose-500/20 bg-rose-500/5 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-sm font-bold text-rose-300 flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-rose-400" />
              Request Workspace Deletion
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              Permanently delete this organization, including all branches, inventories, and memberships.
              A 30-day cooling-off period applies before permanent purge.
            </p>
          </div>
          <Button
            size="sm"
            variant="destructive"
            disabled={!isOwner || isPendingDeletion}
            onClick={() => {
              setActionType('delete_request');
              setConfirmationName('');
            }}
            className="bg-rose-600 hover:bg-rose-500 text-xs shrink-0"
          >
            Delete Workspace
          </Button>
        </div>
      </div>

      {/* Modal: Transfer Ownership */}
      {actionType === 'transfer' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <form
            onSubmit={handleTransferOwnership}
            className="bg-neutral-900 border border-purple-500/30 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl animate-in zoom-in-95"
          >
            <div className="flex items-center gap-2 text-purple-400 border-b border-white/10 pb-3">
              <UserCheck className="w-5 h-5" />
              <h3 className="text-sm font-bold text-white">Transfer Workspace Ownership</h3>
            </div>

            <p className="text-xs text-slate-300">
              Select an active team member. They must have available capacity in their plan.
            </p>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">Select New Owner *</Label>
              <select
                value={transferTargetUserId}
                onChange={(e) => setTransferTargetUserId(e.target.value)}
                required
                className="w-full bg-black/60 border border-white/15 rounded-lg px-3 py-2 text-xs text-white"
              >
                <option value="">-- Choose an active member --</option>
                {otherActiveMembers.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name || m.email} ({m.role}) - {m.email}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">Your Password (Re-authentication) *</Label>
              <Input
                type="password"
                value={transferPassword}
                onChange={(e) => setTransferPassword(e.target.value)}
                placeholder="Enter your current password"
                required
                className="bg-black/60 border-white/15 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">
                Type <span className="text-purple-400 font-mono font-bold">{workspace?.name}</span> to confirm *
              </Label>
              <Input
                value={confirmationName}
                onChange={(e) => setConfirmationName(e.target.value)}
                placeholder={workspace?.name}
                required
                className="bg-black/60 border-white/15 text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setActionType(null)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="bg-purple-600 hover:bg-purple-500 text-xs"
              >
                {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirm Transfer'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Delete Request */}
      {actionType === 'delete_request' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-rose-500/30 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center gap-2 text-rose-400 border-b border-white/10 pb-3">
              <Trash2 className="w-5 h-5" />
              <h3 className="text-sm font-bold text-white">Delete Workspace Confirmation</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              This will disable access for all members and schedule the organization for deletion.
              You will have a 30-day cooling-off period during which you can cancel.
            </p>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">
                Type <span className="text-rose-400 font-mono font-bold">{workspace?.name}</span> to confirm *
              </Label>
              <Input
                value={confirmationName}
                onChange={(e) => setConfirmationName(e.target.value)}
                placeholder={workspace?.name}
                required
                className="bg-black/60 border-white/15 text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setActionType(null)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={isSubmitting}
                onClick={handleDeleteRequest}
                className="bg-rose-600 hover:bg-rose-500 text-xs"
              >
                {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Schedule Deletion'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Archive */}
      {actionType === 'archive' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-amber-500/30 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center gap-2 text-amber-400 border-b border-white/10 pb-3">
              <Archive className="w-5 h-5" />
              <h3 className="text-sm font-bold text-white">Archive Workspace</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to archive <span className="text-white font-semibold">{workspace?.name}</span>?
              All operations will pause, and members will have read-only access until restored.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setActionType(null)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isSubmitting}
                onClick={handleArchive}
                className="bg-amber-600 hover:bg-amber-500 text-xs"
              >
                {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirm Archival'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
