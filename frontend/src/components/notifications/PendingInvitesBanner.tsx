import React, { useState, useEffect, useCallback } from 'react';
import { Check, X, Loader2, MailCheck } from 'lucide-react';
import { api } from '@/lib/api';
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

  const fetchPendingInvites = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await api.get<{ invites: PendingInvite[] }>('/notifications/pending-invites');
      setInvites(res?.invites || []);
    } catch {
      // ignore
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchPendingInvites();

    // Poll every 30s
    const interval = setInterval(fetchPendingInvites, 30000);
    const handleFocus = () => fetchPendingInvites();
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchPendingInvites]);

  const handleAccept = async (invite: PendingInvite) => {
    setProcessingId(invite.id);
    setActionType('accept');
    try {
      await api.post('/notifications/accept-invite', {
        inviteId: invite.id,
        inviteType: invite.inviteType,
      });

      toast.success(`Joined ${invite.organizationName}! Welcome to the team.`);
      setInvites((prev) => prev.filter((i) => i.id !== invite.id));

      await fetchWorkspaces();
      if (onInviteAccepted) onInviteAccepted();
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
        'relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br from-[#714B67]/20 via-[#18181f]/80 to-[#FDB02F]/5 border border-[#FDB02F]/25 shadow-[0_4px_30px_rgba(0,0,0,0.5)] backdrop-blur-xl animate-in fade-in slide-in-from-top-3 duration-300',
        className
      )}
    >
      {/* Subtle top glow */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#FDB02F]/50 to-transparent" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-4 border-b border-white/10">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FDB02F] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FDB02F]" />
            </span>
            <span className="text-[11px] font-bold text-[#FDB02F] uppercase tracking-wider">
              Pending Invitations ({invites.length})
            </span>
          </div>
          <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
            You have pending team invitations
          </h3>
          <p className="text-xs text-slate-400">
            Accepting an invite grants you immediate access to the organization's workspaces, applications, and assigned branches.
          </p>
        </div>

        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300">
          <MailCheck className="w-4 h-4 text-[#FDB02F]" />
          <span>Real-time Sync</span>
        </div>
      </div>

      {/* Invites Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {invites.map((invite) => {
          const isBusy = processingId === invite.id;

          return (
            <div
              key={invite.id}
              className="group p-4 rounded-xl bg-black/40 hover:bg-black/60 border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between gap-4"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-lg bg-gradient-to-tr from-[#714B67] to-[#FDB02F] flex items-center justify-center font-bold text-white text-sm shadow-md shrink-0">
                  {invite.organizationName.charAt(0).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-bold text-white truncate max-w-[200px]">
                      {invite.organizationName}
                    </h4>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#714B67]/30 text-[#e0a8d3] border border-[#714B67]/40 uppercase tracking-wider">
                      {invite.role}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 mt-1">
                    Invited by <span className="text-slate-200 font-medium">{invite.inviterName}</span>
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5 pt-2 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => handleAccept(invite)}
                  disabled={isBusy}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg bg-[#714B67] hover:bg-[#85587a] text-white shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  {isBusy && actionType === 'accept' ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Accepting...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Accept Invite</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleDecline(invite)}
                  disabled={isBusy}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition disabled:opacity-50 cursor-pointer"
                >
                  {isBusy && actionType === 'decline' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
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
