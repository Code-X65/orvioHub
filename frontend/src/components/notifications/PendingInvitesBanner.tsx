import React, { useState, useEffect, useCallback } from 'react';
import { Check, X, Loader2, MailCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { handleApiError, isAbortError } from '@/lib/error-handler';
import { useAuthStore } from '@/stores/useAuthStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export interface PendingInvite {
  id: string;
  inviteType: 'organization' | 'workspace';
  organizationId?: string;
  workspaceId?: string;
  organizationName: string;
  organizationSlug?: string;
  role: string;
  inviterName: string;
  email: string;
  status: string;
  expiresAt: number;
  createdAt: number;
}

interface PendingInvitesBannerProps {
  onInviteAccepted?: () => void;
  className?: string;
}

export const PendingInvitesBanner: React.FC<PendingInvitesBannerProps> = ({
  onInviteAccepted,
  className,
}) => {
  const { isAuthenticated } = useAuthStore();
  const { fetchWorkspaces } = useWorkspaceStore();

  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<'accept' | 'decline' | null>(null);

  const inFlightRef = React.useRef(false);

  const fetchPendingInvites = useCallback(async (signal?: AbortSignal) => {
    if (!isAuthenticated || inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const res = await api.get<{ invites: PendingInvite[] }>('/notifications/pending-invites', { signal });
      if (!signal?.aborted) {
        setInvites(res?.invites || []);
      }
    } catch (err: any) {
      if (!isAbortError(err) && !signal?.aborted) {
        handleApiError(err, 'fetch pending invites', { showError: false });
      }
    } finally {
      inFlightRef.current = false;
    }
  }, [isAuthenticated]);

  useEffect(() => {
    const controller = new AbortController();
    fetchPendingInvites(controller.signal);
    return () => controller.abort();
  }, [fetchPendingInvites]);

  const handleAccept = async (invite: PendingInvite) => {
    setProcessingId(invite.id);
    setActionType('accept');
    try {
      await api.post('/notifications/accept-invite', {
        inviteId: invite.id,
        inviteType: invite.inviteType,
      });

      toast.success(`Accepted invitation to ${invite.organizationName}!`);
      setInvites((prev) => prev.filter((i) => i.id !== invite.id));

      await fetchWorkspaces(undefined, undefined, true);
      onInviteAccepted?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to accept invitation.');
    } finally {
      setProcessingId(null);
      setActionType(null);
    }
  };

  const handleDecline = async (invite: PendingInvite) => {
    setProcessingId(invite.id);
    setActionType('decline');
    try {
      await api.post('/notifications/decline-invite', {
        inviteId: invite.id,
        inviteType: invite.inviteType,
      });

      toast.info(`Declined invitation to ${invite.organizationName}.`);
      setInvites((prev) => prev.filter((i) => i.id !== invite.id));
    } catch (err: any) {
      toast.error(err.message || 'Failed to decline invitation.');
    } finally {
      setProcessingId(null);
      setActionType(null);
    }
  };

  if (!isAuthenticated || invites.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'relative p-4 rounded-xs animate-in fade-in slide-in-from-top-2 duration-200',
        className
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FDB02F] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FDB02F]" />
            </span>
            <span className="text-[11px] font-bold text-[#FDB02F] uppercase tracking-wider">
              Pending Team Invitations ({invites.length})
            </span>
          </div>
          <h3 className="text-sm font-bold text-white tracking-tight">
            You have received organization invitations
          </h3>
          <p className="text-xs text-slate-400">
            Accepting an invite grants you immediate access to the organization's workspaces and branches.
          </p>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
          <MailCheck className="w-4 h-4 text-[#FDB02F]" />
          <span>Real-time Sync</span>
        </div>
      </div>

      {/* Invites List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
        {invites.map((invite) => {
          const isBusy = processingId === invite.id;

          return (
            <div
              key={invite.id}
              className="p-3 rounded-xs flex flex-col justify-between gap-3 text-slate-200"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xs text-[#FDB02F] font-bold text-xs flex items-center justify-center shrink-0">
                  {invite.organizationName.charAt(0).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-xs font-bold text-white truncate max-w-[200px]">
                      {invite.organizationName}
                    </h4>
                    <span className="text-[10px] font-semibold text-[#e0a8d3] uppercase tracking-wider">
                      {invite.role}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Invited by <span className="text-slate-200 font-medium">{invite.inviterName}</span>
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleAccept(invite)}
                  disabled={isBusy}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-xs bg-[#714B67] hover:bg-[#85587a] text-white transition disabled:opacity-50 cursor-pointer"
                >
                  {isBusy && actionType === 'accept' ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Accepting...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Accept Invite</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleDecline(invite)}
                  disabled={isBusy}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xs text-slate-400 hover:text-white transition disabled:opacity-50 cursor-pointer"
                >
                  {isBusy && actionType === 'decline' ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <>
                      <X className="w-3.5 h-3.5" />
                      <span>Decline</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
