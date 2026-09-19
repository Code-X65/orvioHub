import React, { useState, useMemo } from 'react';
import {
  X,
  Bell,
  CheckCheck,
  Search,
  Volume2,
  VolumeX,
  Mail,
  Shield,
  Boxes,
  CreditCard,
  Building2,
  Inbox,
  Filter,
} from 'lucide-react';
import { useNotificationStore, NotificationCategory } from '@/stores/useNotificationStore';
import { NotificationItem } from './NotificationItem';

export const NotificationCenterDrawer: React.FC = () => {
  const {
    notifications,
    unreadCount,
    activeFilter,
    soundEnabled,
    isDrawerOpen,
    isLoading,
    setActiveFilter,
    setSoundEnabled,
    toggleDrawer,
    markAsRead,
    markAllAsRead,
    acceptInvite,
    declineInvite,
  } = useNotificationStore();

  const [searchQuery, setSearchQuery] = useState('');

  // Filter & Search computation
  const filteredNotifications = useMemo(() => {
    return notifications.filter((notif) => {
      // 1. Filter match
      if (activeFilter === 'unread' && notif.status !== 'UNREAD') return false;
      if (activeFilter === 'invites') {
        const isInvite =
          notif.type === 'org_invite' ||
          notif.type === 'workspace_invite' ||
          notif.type === 'branch_invite' ||
          Boolean(notif.data?.inviteId);
        if (!isInvite) return false;
      }
      if (activeFilter === 'inventory' && notif.category !== 'INVENTORY') return false;
      if (activeFilter === 'billing' && notif.category !== 'BILLING') return false;
      if (activeFilter === 'security' && notif.category !== 'SECURITY') return false;

      // 2. Search match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = notif.title.toLowerCase().includes(q);
        const matchBody = (notif.body || notif.message || '').toLowerCase().includes(q);
        return matchTitle || matchBody;
      }

      return true;
    });
  }, [notifications, activeFilter, searchQuery]);

  if (!isDrawerOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={() => toggleDrawer(false)}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-slate-950 border-l border-slate-800 shadow-2xl flex flex-col text-slate-100">
          {/* Header */}
          <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Notification Center</h3>
                <p className="text-[11px] text-slate-400">
                  {unreadCount > 0 ? `${unreadCount} unread alerts` : 'All caught up'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Sound Toggle */}
              <button
                type="button"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`p-2 rounded-lg border text-xs transition-colors ${
                  soundEnabled
                    ? 'bg-slate-800 border-slate-700 text-emerald-400'
                    : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
                }`}
                title={soundEnabled ? 'Audio Chime Enabled' : 'Audio Chime Muted'}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>

              {/* Close button */}
              <button
                type="button"
                onClick={() => toggleDrawer(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="p-3 border-b border-slate-800/80 bg-slate-900/30">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter notifications..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8.5 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="px-4 py-2.5 border-b border-slate-800/60 flex items-center gap-1.5 overflow-x-auto text-xs scrollbar-none bg-slate-950">
            {[
              { id: 'all', label: 'All' },
              { id: 'unread', label: `Unread (${unreadCount})` },
              { id: 'invites', label: 'Invites' },
              { id: 'inventory', label: 'Inventory' },
              { id: 'billing', label: 'Billing' },
              { id: 'security', label: 'Security' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors ${
                  activeFilter === tab.id
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Actions bar (Mark all as read) */}
          <div className="px-4 py-2 bg-slate-900/40 border-b border-slate-800/60 flex items-center justify-between text-xs">
            <span className="text-slate-400">{filteredNotifications.length} items</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all as read
              </button>
            )}
          </div>

          {/* Notification List Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
            {isLoading ? (
              <div className="py-16 text-center text-xs text-slate-500">
                Loading notifications...
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="py-20 text-center text-slate-500 space-y-3">
                <Inbox className="w-10 h-10 mx-auto text-slate-700" />
                <div>
                  <p className="text-xs font-semibold text-slate-300">No notifications found</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {searchQuery ? 'Try clearing your search query' : "You're completely up to date!"}
                  </p>
                </div>
              </div>
            ) : (
              filteredNotifications.map((notif) => (
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
        </div>
      </div>
    </div>
  );
};

export default NotificationCenterDrawer;
