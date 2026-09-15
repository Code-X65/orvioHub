import React, { useState } from 'react';
import { Check, X, Clock, Info, CheckCircle2, AlertTriangle, AlertCircle, Loader2 } from 'lucide-react';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { cn } from '@/lib/utils';

export interface NotificationData {
  _id: string;
  userId: string;
  workspaceId?: string;
  productKey?: string;
  type: string;
  title: string;
  body: string;
  data?: {
    inviteId?: string;
    inviteType?: 'organization' | 'workspace';
    organizationId?: string;
    organizationName?: string;
    workspaceId?: string;
    workspaceName?: string;
    role?: string;
    inviterName?: string;
    tokenHash?: string;
    isResolved?: boolean;
    inviteStatus?: string;
    isAlreadyMember?: boolean;
    [key: string]: any;
  };
  severity: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  channel: string;
  status: 'UNREAD' | 'READ' | 'ARCHIVED';
  createdAt: number;
}

interface NotificationItemProps {
  notification: NotificationData;
  onAccept?: (notification: NotificationData) => Promise<void>;
  onDecline?: (notification: NotificationData) => Promise<void>;
  onMarkRead?: (id: string) => Promise<void>;
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onAccept,
  onDecline,
  onMarkRead,
}) => {
  const { workspaces } = useWorkspaceStore();
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [actionDone, setActionDone] = useState<'accepted' | 'declined' | null>(null);

  const isInvite =
    notification.type === 'org_invite' ||
    notification.type === 'workspace_invite' ||
    notification.type === 'application_invite' ||
    notification.type === 'branch_invite';
  const isUnread = notification.status === 'UNREAD';

  const orgId =
    notification.data?.organizationId ||
    notification.data?.workspaceId ||
    notification.workspaceId;
  const orgName =
    notification.data?.organizationName ||
    notification.data?.workspaceName ||
    'an organization';
  const roleName = notification.data?.role || 'Member';
  const inviter = notification.data?.inviterName || 'A teammate';

  // Cross-reference against local workspace list and backend resolution data
  const alreadyMember =
    Boolean(notification.data?.isAlreadyMember) ||
    Boolean(notification.data?.isResolved && notification.data?.inviteStatus === 'ACCEPTED') ||
    notification.data?.inviteStatus === 'ACCEPTED' ||
    workspaces.some((entry) => {
      const wsId = entry.workspace?.id || entry.workspaceId || entry.organizationId;
      const wsName = entry.workspace?.name || '';
      return (
        (orgId && wsId === orgId) ||
        (wsName && orgName && wsName.trim().toLowerCase() === orgName.trim().toLowerCase())
      );
    });

  const isCancelled =
    notification.data?.inviteStatus === 'CANCELLED' ||
    notification.data?.inviteStatus === 'cancelled' ||
    notification.data?.inviteStatus === 'declined' ||
    notification.data?.inviteStatus === 'revoked';

  const isExpired =
    notification.data?.inviteStatus === 'EXPIRED' ||
    notification.data?.inviteStatus === 'expired';

  const isResolved =
    alreadyMember ||
    isCancelled ||
    isExpired ||
    Boolean(notification.data?.isResolved);

  const handleAccept = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onAccept || isAccepting || isDeclining) return;
    setIsAccepting(true);
    try {
      await onAccept(notification);
      setActionDone('accepted');
    } catch {
      // error handled by parent toast
    } finally {
      setIsAccepting(false);
    }
  };

  const handleDecline = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onDecline || isAccepting || isDeclining) return;
    setIsDeclining(true);
    try {
      await onDecline(notification);
      setActionDone('declined');
    } catch {
      // error handled by parent toast
    } finally {
      setIsDeclining(false);
    }
  };

  const handleClick = () => {
    if (isUnread && onMarkRead) {
      onMarkRead(notification._id);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        'group relative p-3.5 rounded-lg border transition-all duration-200 cursor-pointer',
        isUnread
          ? 'bg-white/[0.04] hover:bg-white/[0.07] border-white/10'
          : 'bg-transparent hover:bg-white/[0.02] border-transparent opacity-80 hover:opacity-100'
      )}
    >
      {/* Unread indicator dot */}
      {isUnread && !isResolved && (
        <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-[#FDB02F] shadow-[0_0_8px_#FDB02F]" />
      )}

      <div className="flex items-start gap-3">
        {/* Avatar or Type Icon */}
        {isInvite ? (
          <div className="w-9 h-9 rounded-md bg-gradient-to-tr from-[#714B67] to-[#FDB02F] flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-md">
            {orgName.charAt(0).toUpperCase()}
          </div>
        ) : (
          <div
            className={cn(
              'w-8 h-8 rounded-md flex items-center justify-center shrink-0 text-xs',
              notification.severity === 'SUCCESS' && 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
              notification.severity === 'WARNING' && 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
              notification.severity === 'ERROR' && 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
              notification.severity === 'INFO' && 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
            )}
          >
            {notification.severity === 'SUCCESS' && <CheckCircle2 className="w-4 h-4" />}
            {notification.severity === 'WARNING' && <AlertTriangle className="w-4 h-4" />}
            {notification.severity === 'ERROR' && <AlertCircle className="w-4 h-4" />}
            {notification.severity === 'INFO' && <Info className="w-4 h-4" />}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <h4 className={cn('text-xs font-semibold truncate', isUnread ? 'text-white' : 'text-slate-300')}>
              {notification.title}
            </h4>
            {isInvite && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#714B67]/30 text-[#e0a8d3] border border-[#714B67]/40 uppercase tracking-wider">
                {roleName}
              </span>
            )}
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed break-words">
            {notification.body}
          </p>

          <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-500">
            <Clock className="w-3 h-3" />
            <span>{formatRelativeTime(notification.createdAt)}</span>
            {isInvite && inviter && <span>• by {inviter}</span>}
          </div>

          {/* Accept / Decline Action Buttons for Invites (only if active & unresolved) */}
          {isInvite && !actionDone && !isResolved && (
            <div className="flex items-center gap-2 mt-3 pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={handleAccept}
                disabled={isAccepting || isDeclining}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-[#714B67] hover:bg-[#85587a] text-white shadow-sm transition disabled:opacity-50 cursor-pointer"
              >
                {isAccepting ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Joining...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Accept</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleDecline}
                disabled={isAccepting || isDeclining}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition disabled:opacity-50 cursor-pointer"
              >
                {isDeclining ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Declining...</span>
                  </>
                ) : (
                  <>
                    <X className="w-3.5 h-3.5" />
                    <span>Decline</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Resolved State Indicators */}
          {(actionDone === 'accepted' || (isInvite && alreadyMember)) && (
            <div className="mt-2.5 pt-2 border-t border-white/5 text-[11px] font-medium text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Invitation accepted • You are an active member</span>
            </div>
          )}

          {(actionDone === 'declined' || (isInvite && isCancelled && !alreadyMember)) && (
            <div className="mt-2.5 pt-2 border-t border-white/5 text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
              <X className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>Invitation no longer active</span>
            </div>
          )}

          {isInvite && isExpired && !alreadyMember && !actionDone && (
            <div className="mt-2.5 pt-2 border-t border-white/5 text-[11px] font-medium text-amber-400/80 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Invitation expired</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
