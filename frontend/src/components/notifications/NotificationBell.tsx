import React, { useState, useEffect, useRef } from 'react';
import { Bell, CheckCheck, Loader2, Mail, ExternalLink, X, Filter } from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useNotificationStore, type NotificationData } from '@/stores/useNotificationStore';
import { NotificationItem } from './NotificationItem';
import { NotificationCenterDrawer } from './NotificationCenterDrawer';
import { cn } from '@/lib/utils';

export const NotificationBell: React.FC = () => {
  const { isAuthenticated } = useAuthStore();
  const {
    notifications,
    unreadCount,
    activeFilter,
    isLoading,
    setActiveFilter,
    toggleDrawer,
    markAsRead,
    markAllAsRead,
    acceptInvite,
    declineInvite,
  } = useNotificationStore();

  const [isOpen, setIsOpen] = useState(false);
  const [isPingActive, setIsPingActive] = useState(false);
  const prevCountRef = useRef(unreadCount);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Trigger pulse animation when unread count increases
  useEffect(() => {
    if (unreadCount > prevCountRef.current) {
      setIsPingActive(true);
      const timer = setTimeout(() => setIsPingActive(false), 3000);
      prevCountRef.current = unreadCount;
      return () => clearTimeout(timer);
    }
    prevCountRef.current = unreadCount;
  }, [unreadCount]);

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

  if (!isAuthenticated) return null;

  // Filtered notifications for the dropdown
  const displayedNotifications = notifications.filter((notif) => {
    if (activeFilter === 'unread') return notif.status === 'UNREAD';
    if (activeFilter === 'invites') {
      return (
        notif.type === 'org_invite' ||
        notif.type === 'workspace_invite' ||
        notif.type === 'branch_invite' ||
        Boolean(notif.data?.inviteId)
      );
    }
    return true;
  });

  return (
    <>
      <div className="relative inline-block" ref={dropdownRef}>
        {/* Bell Trigger Button */}
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={cn(
            'relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 border border-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50',
            isOpen && 'bg-slate-900 text-white border-slate-700'
          )}
          aria-label="Open notifications menu"
        >
          <Bell className="w-5 h-5 transition-transform group-hover:scale-105" />

          {/* Unread Badge Counter */}
          {unreadCount > 0 && (
            <span
              className={cn(
                'absolute -top-1 -right-1 flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-black text-slate-950 shadow-md transition-all',
                isPingActive && 'animate-bounce bg-emerald-400'
              )}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}

          {/* Glowing Ping effect on new notification */}
          {isPingActive && (
            <span className="absolute -top-1 -right-1 flex h-4.5 w-4.5 rounded-full bg-emerald-400 opacity-75 animate-ping" />
          )}
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl z-50 overflow-hidden text-left animate-in fade-in-50 zoom-in-95">
            {/* Header */}
            <div className="p-4 border-b border-slate-800/80 bg-slate-900/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">Notifications</span>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    {unreadCount} new
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    className="text-[11px] text-slate-400 hover:text-emerald-400 flex items-center gap-1 transition-colors"
                    title="Mark all as read"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Mark read</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    toggleDrawer(true);
                  }}
                  className="text-[11px] text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors"
                  title="Open full Notification Center"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Quick Filter Tabs */}
            <div className="px-3 py-2 border-b border-slate-800/60 bg-slate-950 flex items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setActiveFilter('all')}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors',
                  activeFilter === 'all'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-white'
                )}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('unread')}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors',
                  activeFilter === 'unread'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-white'
                )}
              >
                Unread
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('invites')}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors',
                  activeFilter === 'invites'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-white'
                )}
              >
                Invites
              </button>
            </div>

            {/* Notifications List */}
            <div className="max-h-96 overflow-y-auto p-3 space-y-2 divide-y divide-slate-900">
              {isLoading && displayedNotifications.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                  <span>Loading alerts...</span>
                </div>
              ) : displayedNotifications.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500 space-y-1">
                  <Mail className="w-8 h-8 mx-auto text-slate-700" />
                  <p className="font-semibold text-slate-400">No notifications</p>
                  <p className="text-[10px] text-slate-500">You're all caught up!</p>
                </div>
              ) : (
                displayedNotifications.slice(0, 15).map((notif) => (
                  <NotificationItem
                    key={notif._id || notif.id}
                    notification={notif}
                    onMarkRead={markAsRead}
                    onAccept={async (n) => {
                      const invId = n.data?.inviteId;
                      if (invId) await acceptInvite(invId, n._id || n.id);
                    }}
                    onDecline={async (n) => {
                      const invId = n.data?.inviteId;
                      if (invId) await declineInvite(invId, n._id || n.id);
                    }}
                  />
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-2.5 border-t border-slate-800/80 bg-slate-900/60 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  toggleDrawer(true);
                }}
                className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 hover:underline w-full py-1"
              >
                View all notifications in center →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Global Slide-over Notification Center Drawer */}
      <NotificationCenterDrawer />
    </>
  );
};

export default NotificationBell;
