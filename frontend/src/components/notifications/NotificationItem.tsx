import React, { useState } from 'react';
import {
  Check,
  X,
  Clock,
  Info,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Loader2,
  ExternalLink,
  Layers,
} from 'lucide-react';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { type NotificationData } from '@/stores/useNotificationStore';
import { resolveTargetSubdomainUrl } from '@/hooks/useRealtimeNotifications';
import { cn } from '@/lib/utils';

export type { NotificationData };

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

  const notifId = notification._id || notification.id || '';
  const isInvite =
    notification.type === 'org_invite' ||
    notification.type === 'workspace_invite' ||
    notification.type === 'application_invite' ||
    notification.type === 'branch_invite' ||
    Boolean(notification.data?.inviteId);
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
      // handled by caller
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
      // handled by caller
    } finally {
      setIsDeclining(false);
    }
  };

  const handleClick = () => {
    if (isUnread && onMarkRead && notifId) {
      onMarkRead(notifId);
    }
    if (notification.actionUrl && !isInvite) {
      const targetUrl = resolveTargetSubdomainUrl(notification.actionUrl);
      if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
        window.location.href = targetUrl;
      }
    }
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        'group relative p-3.5 rounded-xl border transition-all duration-200 cursor-pointer text-left',
        isUnread
          ? 'bg-slate-900/90 hover:bg-slate-800/90 border-slate-700/80 shadow-sm'
          : 'bg-slate-950/40 hover:bg-slate-900/50 border-slate-800/50 opacity-80 hover:opacity-100'
      )}
    >
      {/* Unread indicator dot */}
      {isUnread && !isResolved && (
        <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#10B981]" />
      )}

      <div className="flex items-start gap-3">
        {/* Avatar or Type Icon */}
        {isInvite ? (
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-700 to-emerald-600 flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-md">
            {orgName.charAt(0).toUpperCase()}
          </div>
        ) : (
          <div
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs shadow-inner',
              notification.severity === 'SUCCESS' && 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30',
              notification.severity === 'WARNING' && 'bg-amber-500/10 text-amber-400 border border-amber-500/30',
              notification.severity === 'ERROR' && 'bg-rose-500/10 text-rose-400 border border-rose-500/30',
              notification.severity === 'INFO' && 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
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

            {notification.priority === 'URGENT' && (
              <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-red-500/20 text-red-400 border border-red-500/30 uppercase">
                Urgent
              </span>
            )}

            {notification.category && (
              <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-slate-800 text-slate-400 border border-slate-700 uppercase">
                {notification.category}
              </span>
            )}

            {isInvite && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase tracking-wider">
                {roleName}
              </span>
            )}
          </div>

          <p className="text-[11px] text-slate-300 leading-relaxed break-words">
            {notification.body || notification.message}
          </p>

          <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-400">
            <Clock className="w-3 h-3" />
            <span>{formatRelativeTime(notification.createdAt)}</span>
            {isInvite && inviter && <span>• from {inviter}</span>}
            {notification.batchCount && notification.batchCount > 1 && (
              <span className="flex items-center gap-1 text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                <Layers className="w-2.5 h-2.5" />
                {notification.batchCount} batched
              </span>
            )}
          </div>

          {/* Action Button if actionUrl present */}
          {notification.actionUrl && !isInvite && (
            <div className="mt-2.5">
              <a
                href={resolveTargetSubdomainUrl(notification.actionUrl)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isUnread && onMarkRead && notifId) onMarkRead(notifId);
                }}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 hover:underline"
              >
                <span>{notification.actionLabel || 'View Details'}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          {/* Accept / Decline Action Buttons for Invites */}
          {isInvite && !actionDone && !isResolved && (
            <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={handleAccept}
                disabled={isAccepting || isDeclining}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition disabled:opacity-50 cursor-pointer"
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
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition disabled:opacity-50 cursor-pointer"
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
            <div className="mt-2.5 pt-2 border-t border-slate-800 text-[11px] font-medium text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Invitation accepted • Active member</span>
            </div>
          )}

          {(actionDone === 'declined' || (isInvite && isCancelled && !alreadyMember)) && (
            <div className="mt-2.5 pt-2 border-t border-slate-800 text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
              <X className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>Invitation no longer active</span>
            </div>
          )}

          {isInvite && isExpired && !alreadyMember && !actionDone && (
            <div className="mt-2.5 pt-2 border-t border-slate-800 text-[11px] font-medium text-amber-400/80 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Invitation expired</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationItem;
