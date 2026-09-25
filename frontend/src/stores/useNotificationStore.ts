import { create } from 'zustand';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/errorMapper';

export type NotificationCategory = 'SECURITY' | 'WORKSPACE' | 'INVENTORY' | 'BILLING' | 'SYSTEM';
export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type NotificationSeverity = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';

export interface NotificationData {
  _id: string;
  id?: string;
  userId: string;
  workspaceId?: string;
  productKey?: string;
  type: string;
  title: string;
  body?: string;
  message?: string;
  severity: NotificationSeverity;
  category?: NotificationCategory;
  priority?: NotificationPriority;
  actionUrl?: string;
  actionLabel?: string;
  batchCount?: number;
  data?: {
    inviteId?: string;
    organizationId?: string;
    organizationName?: string;
    workspaceId?: string;
    workspaceName?: string;
    branchId?: string;
    branchName?: string;
    role?: string;
    inviterName?: string;
    inviteStatus?: string;
    isResolved?: boolean;
    isAlreadyMember?: boolean;
    suppressToast?: boolean;
    [key: string]: any;
  };
  channel: string;
  status: 'UNREAD' | 'READ' | 'ARCHIVED';
  readAt?: number;
  createdAt: number;
}

interface NotificationStoreState {
  notifications: NotificationData[];
  unreadCount: number;
  activeFilter: 'all' | 'unread' | 'invites' | 'inventory' | 'billing' | 'security';
  soundEnabled: boolean;
  isLoading: boolean;
  isDrawerOpen: boolean;

  // Setters
  setNotifications: (notifications: NotificationData[]) => void;
  setUnreadCount: (count: number) => void;
  setActiveFilter: (filter: NotificationStoreState['activeFilter']) => void;
  setSoundEnabled: (enabled: boolean) => void;
  toggleDrawer: (open?: boolean) => void;

  // Async API actions
  fetchNotifications: (limit?: number) => Promise<void>;
  fetchUnreadCount: () => Promise<number>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  archiveNotification: (notificationId: string) => Promise<void>;
  acceptInvite: (inviteId: string, notificationId?: string) => Promise<boolean>;
  declineInvite: (inviteId: string, notificationId?: string) => Promise<boolean>;
}

const SOUND_PREF_KEY = 'orvio_notification_sound_enabled';

export const useNotificationStore = create<NotificationStoreState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  activeFilter: 'all',
  soundEnabled: typeof window !== 'undefined' ? localStorage.getItem(SOUND_PREF_KEY) !== 'false' : true,
  isLoading: false,
  isDrawerOpen: false,

  setNotifications: (notifications) => set({ notifications }),
  setUnreadCount: (unreadCount) => set({ unreadCount }),
  setActiveFilter: (activeFilter) => set({ activeFilter }),
  setSoundEnabled: (soundEnabled) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(SOUND_PREF_KEY, soundEnabled ? 'true' : 'false');
    }
    set({ soundEnabled });
  },
  toggleDrawer: (open) => set((state) => ({ isDrawerOpen: open !== undefined ? open : !state.isDrawerOpen })),

  fetchNotifications: async (limit = 40) => {
    try {
      set({ isLoading: true });
      const res = await api.get<{ notifications: NotificationData[]; data?: { notifications: NotificationData[] } }>(
        `/notifications?limit=${limit}`
      );
      const list = res?.notifications || res?.data?.notifications || [];
      set({ notifications: list });
    } catch {
      // ignore
    } finally {
      set({ isLoading: false });
    }
  },

  fetchUnreadCount: async () => {
    try {
      const res = await api.get<{ count: number; data?: { count: number } }>('/notifications/unread-count');
      const count = res?.count ?? res?.data?.count ?? 0;
      set({ unreadCount: count });
      return count;
    } catch {
      return 0;
    }
  },

  markAsRead: async (notificationId: string) => {
    const prevNotifications = get().notifications;
    const prevUnreadCount = get().unreadCount;

    // Optimistic UI update
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n._id === notificationId || n.id === notificationId ? { ...n, status: 'READ', readAt: Date.now() } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }));

    try {
      await api.patch(`/notifications/${notificationId}/read`, {});
    } catch (err: any) {
      // Exact snapshot rollback on failure
      set({ notifications: prevNotifications, unreadCount: prevUnreadCount });
      toast.error(getErrorMessage(err, 'Failed to mark notification as read'), {
        action: {
          label: 'Retry',
          onClick: () => get().markAsRead(notificationId),
        },
      });
    }
  },

  markAllAsRead: async () => {
    const prevNotifications = get().notifications;
    const prevCount = get().unreadCount;

    // Optimistic UI update
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, status: 'READ', readAt: Date.now() })),
      unreadCount: 0,
    }));

    try {
      await api.post('/notifications/mark-all-read', {});
      toast.success('All notifications marked as read');
    } catch (err: any) {
      set({ notifications: prevNotifications, unreadCount: prevCount });
      toast.error(getErrorMessage(err, 'Failed to mark all as read'), {
        action: {
          label: 'Retry',
          onClick: () => get().markAllAsRead(),
        },
      });
    }
  },

  archiveNotification: async (notificationId: string) => {
    const prevNotifications = get().notifications;
    const prevUnreadCount = get().unreadCount;

    // Optimistic UI update
    set((state) => ({
      notifications: state.notifications.filter((n) => n._id !== notificationId && n.id !== notificationId),
    }));

    try {
      await api.delete(`/notifications/${notificationId}`);
    } catch (err: any) {
      // Exact snapshot rollback on failure
      set({ notifications: prevNotifications, unreadCount: prevUnreadCount });
      toast.error(getErrorMessage(err, 'Failed to archive notification'), {
        action: {
          label: 'Retry',
          onClick: () => get().archiveNotification(notificationId),
        },
      });
    }
  },

  acceptInvite: async (inviteId: string, notificationId?: string) => {
    const prevNotifications = get().notifications;
    const prevUnreadCount = get().unreadCount;

    try {
      try {
        await api.post('/notifications/accept-invite', { inviteId, notificationId });
      } catch {
        await api.post(`/notifications/invites/${inviteId}/accept`, { notificationId });
      }

      // Optimistically resolve in state
      set((state) => ({
        notifications: state.notifications.map((n) => {
          if (n.data?.inviteId === inviteId || n._id === notificationId || n.id === notificationId) {
            return {
              ...n,
              status: 'READ',
              data: {
                ...n.data,
                isResolved: true,
                inviteStatus: 'ACCEPTED',
              },
            };
          }
          return n;
        }),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));

      // Broadcast to other tabs
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        try {
          const channel = new BroadcastChannel('orvio_realtime_notifications_bus');
          channel.postMessage({ type: 'INVITATION_STATUS_CHANGED', inviteId, status: 'ACCEPTED' });
          channel.close();
        } catch {}
      }

      toast.success('Invitation accepted successfully! Switching workspace...');
      return true;
    } catch (err: any) {
      set({ notifications: prevNotifications, unreadCount: prevUnreadCount });
      toast.error(getErrorMessage(err, 'Failed to accept invitation'));
      return false;
    }
  },

  declineInvite: async (inviteId: string, notificationId?: string) => {
    const prevNotifications = get().notifications;
    const prevUnreadCount = get().unreadCount;

    try {
      try {
        await api.post('/notifications/decline-invite', { inviteId, notificationId });
      } catch {
        await api.post(`/notifications/invites/${inviteId}/decline`, { notificationId });
      }

      set((state) => ({
        notifications: state.notifications.map((n) => {
          if (n.data?.inviteId === inviteId || n._id === notificationId || n.id === notificationId) {
            return {
              ...n,
              status: 'READ',
              data: {
                ...n.data,
                isResolved: true,
                inviteStatus: 'DECLINED',
              },
            };
          }
          return n;
        }),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));

      // Broadcast to other tabs
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        try {
          const channel = new BroadcastChannel('orvio_realtime_notifications_bus');
          channel.postMessage({ type: 'INVITATION_STATUS_CHANGED', inviteId, status: 'DECLINED' });
          channel.close();
        } catch {}
      }

      toast.info('Invitation declined');
      return true;
    } catch (err: any) {
      set({ notifications: prevNotifications, unreadCount: prevUnreadCount });
      toast.error(getErrorMessage(err, 'Failed to decline invitation'));
      return false;
    }
  },
}));
