import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, CheckCheck, Loader2, Mail, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/useAuthStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { NotificationItem, type NotificationData } from './NotificationItem';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export const NotificationBell: React.FC = () => {
  const { isAuthenticated } = useAuthStore();
  const { fetchWorkspaces } = useWorkspaceStore();

  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'invites'>('all');

  const dropdownRef = useRef<HTMLDivElement>(null);

  // 1. Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await api.get<{ count: number }>('/notifications/unread-count');
      setUnreadCount(res?.count ?? 0);
    } catch {
      // ignore network errors in background poll
    }
  }, [isAuthenticated]);

  // 2. Fetch notifications list
  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    try {
      const res = await api.get<{ notifications: NotificationData[] }>('/notifications?limit=30');
      setNotifications(res?.notifications || []);
    } catch (err: any) {
      console.warn('Failed to load notifications:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  // Initial load and polling every 25 seconds
  useEffect(() => {
    if (!isAuthenticated) return;

    fetchUnreadCount();

    const interval = setInterval(() => {
      fetchUnreadCount();
      if (isOpen) {
        fetchNotifications();
      }
    }, 25000);

    const handleFocus = () => {
      fetchUnreadCount();
      if (isOpen) fetchNotifications();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isAuthenticated, isOpen, fetchUnreadCount, fetchNotifications]);

  // Fetch notifications when opening dropdown
  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

  // Close dropdown on click outside or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Mark all as read
  const handleMarkAllRead = async () => {
    setIsMarkingAll(true);
    try {
      await api.post('/notifications/read-all');
      setUnreadCount(0);
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, status: 'READ' as const }))
      );
      toast.success('All notifications marked as read');
    } catch {
      toast.error('Failed to mark notifications as read');
    } finally {
      setIsMarkingAll(false);
    }
  };

  // Mark single as read
  const handleMarkRead = async (id: string) => {
    try {
      await api.post(`/notifications/${id}/read`);
      setUnreadCount((c) => Math.max(0, c - 1));
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, status: 'READ' as const } : n))
      );
    } catch {
      // silent
    }
  };

  // Accept invite handler
  const handleAcceptInvite = async (notification: NotificationData) => {
    const inviteId = notification.data?.inviteId;
    const inviteType = notification.data?.inviteType || 'organization';
    const orgName =
      notification.data?.organizationName ||
      notification.data?.workspaceName ||
      'the organization';

    if (!inviteId) {
      toast.error('Invitation ID not found');
      return;
    }

    try {
      await api.post('/notifications/accept-invite', {
        inviteId,
        inviteType,
        notificationId: notification._id,
      });

      toast.success(`Joined ${orgName}! Welcome aboard.`);

      // Update local state
      setUnreadCount((c) => Math.max(0, c - 1));
      setNotifications((prev) =>
        prev.map((n) => (n._id === notification._id ? { ...n, status: 'READ' as const } : n))
      );

      // Refresh workspaces store so the dashboard updates immediately
      await fetchWorkspaces();
    } catch (err: any) {
      const msg = err.message || 'Failed to accept invitation.';
      toast.error(msg);
      throw err;
    }
  };

  // Decline invite handler
  const handleDeclineInvite = async (notification: NotificationData) => {
    const inviteId = notification.data?.inviteId;
    const inviteType = notification.data?.inviteType || 'organization';

    if (!inviteId) {
      toast.error('Invitation ID not found');
      return;
    }

    try {
      await api.post('/notifications/decline-invite', {
        inviteId,
        inviteType,
        notificationId: notification._id,
      });

      toast.info('Invitation declined.');

      setUnreadCount((c) => Math.max(0, c - 1));
      setNotifications((prev) =>
        prev.map((n) => (n._id === notification._id ? { ...n, status: 'READ' as const } : n))
      );
    } catch (err: any) {
      const msg = err.message || 'Failed to decline invitation.';
      toast.error(msg);
      throw err;
    }
  };

  if (!isAuthenticated) return null;

  const filteredNotifications = notifications.filter((n) => {
    if (activeFilter === 'invites') {
      return n.type === 'org_invite' || n.type === 'workspace_invite';
    }
    return true;
  });

  const inviteCount = notifications.filter(
    (n) => (n.type === 'org_invite' || n.type === 'workspace_invite') && n.status === 'UNREAD'
  ).length;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="View notifications"
        className={cn(
          'relative p-2 rounded-md text-slate-300 hover:text-white transition-colors cursor-pointer',
          isOpen ? 'bg-white/10 text-white' : 'hover:bg-white/5'
        )}
      >
        <Bell className="w-4 h-4" />

        {/* Pulsing Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FDB02F] opacity-75" />
            <span className="relative min-w-[16px] h-4 px-1 rounded-full bg-gradient-to-tr from-[#714B67] to-[#FDB02F] text-[10px] font-bold text-white flex items-center justify-center shadow-sm">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-[#0e0e12]/95 border border-white/10 shadow-2xl backdrop-blur-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-150 overflow-hidden flex flex-col max-h-[520px]">
          {/* Header */}
          <div className="p-3.5 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-white">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#FDB02F]/20 text-[#FDB02F] border border-[#FDB02F]/30">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  disabled={isMarkingAll}
                  className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 px-2 py-1 rounded hover:bg-white/5 transition disabled:opacity-50 cursor-pointer"
                  title="Mark all as read"
                >
                  {isMarkingAll ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <CheckCheck className="w-3.5 h-3.5 text-slate-400" />
                  )}
                  <span>Mark all read</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-white/5 cursor-pointer"
                aria-label="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="px-3 py-2 border-b border-white/5 flex items-center gap-1.5 bg-black/20 text-xs">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={cn(
                'px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer',
                activeFilter === 'all'
                  ? 'bg-white/10 text-white font-semibold'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              )}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('invites')}
              className={cn(
                'px-2.5 py-1 rounded-md text-[11px] font-medium transition flex items-center gap-1.5 cursor-pointer',
                activeFilter === 'invites'
                  ? 'bg-white/10 text-white font-semibold'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              )}
            >
              <span>Invites</span>
              {inviteCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-[#714B67] text-white text-[9px] flex items-center justify-center font-bold">
                  {inviteCount}
                </span>
              )}
            </button>
          </div>

          {/* Notifications Scroll Area */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 divide-y divide-white/5">
            {isLoading ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-2 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin text-[#714B67]" />
                <span className="text-xs">Loading notifications...</span>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="py-12 px-4 flex flex-col items-center justify-center text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400">
                  <Mail className="w-5 h-5 opacity-60" />
                </div>
                <p className="text-xs font-medium text-slate-300">
                  {activeFilter === 'invites' ? 'No invitations right now' : 'All caught up!'}
                </p>
                <p className="text-[11px] text-slate-500 max-w-[220px]">
                  {activeFilter === 'invites'
                    ? 'When a teammate invites you to join an organization, it will appear here.'
                    : 'You will receive in-dashboard notifications when you get invited or have system updates.'}
                </p>
              </div>
            ) : (
              filteredNotifications.map((notif) => (
                <NotificationItem
                  key={notif._id}
                  notification={notif}
                  onAccept={handleAcceptInvite}
                  onDecline={handleDeclineInvite}
                  onMarkRead={handleMarkRead}
                />
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 border-t border-white/10 bg-white/[0.01] text-center">
            <span className="text-[10px] text-slate-500">
              Real-time invite updates are synced with your personal account
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
