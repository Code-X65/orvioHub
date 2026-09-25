import { useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/useAuthStore';
import { useNotificationStore, NotificationData } from '@/stores/useNotificationStore';
import { api } from '@/lib/api';

const BROADCAST_CHANNEL_NAME = 'orvio_realtime_notifications_bus';

/**
 * Synthesize a soft, pleasant 2-note chime using Web Audio API (Zero external mp3 files)
 */
function playSynthesizedChime() {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // First Tone: D5 (587.33 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.08, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Second Tone: A5 (880.00 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880.0, now + 0.12);
    gain2.gain.setValueAtTime(0.09, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.55);

    // Vibrate device briefly if mobile supported
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate([40, 60, 40]);
      } catch {}
    }
  } catch {
    // AudioContext blocked by browser policy prior to user interaction
  }
}

/**
 * Determine the appropriate target subdomain and construct clean deep link
 */
export function resolveTargetSubdomainUrl(actionUrl?: string): string {
  if (!actionUrl) return '/';
  if (actionUrl.startsWith('http://') || actionUrl.startsWith('https://')) {
    return actionUrl;
  }

  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'orviohub.localhost';
  const port = typeof window !== 'undefined' && window.location.port ? `:${window.location.port}` : '';
  const isLocalhost = hostname.includes('localhost') || hostname.includes('127.0.0.1');

  // Route inventory links to inventory subdomain if on a multi-subdomain setup
  if (actionUrl.startsWith('/inventory') || actionUrl.startsWith('/stock') || actionUrl.startsWith('/sales') || actionUrl.startsWith('/products')) {
    if (isLocalhost) {
      return `http://inventory.orviohub.localhost${port}${actionUrl}`;
    }
    return `https://inventory.orviohub.com${actionUrl}`;
  }

  if (actionUrl.startsWith('/workspaces') || actionUrl.startsWith('/dashboard')) {
    if (isLocalhost) {
      return `http://home.orviohub.localhost${port}${actionUrl}`;
    }
    return `https://home.orviohub.com${actionUrl}`;
  }

  if (actionUrl.startsWith('/profile') || actionUrl.startsWith('/settings')) {
    if (isLocalhost) {
      return `http://accounts.orviohub.localhost${port}${actionUrl}`;
    }
    return `https://accounts.orviohub.com${actionUrl}`;
  }

  return actionUrl;
}

export function useRealtimeNotifications() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const userId = useAuthStore(s => s.user?.id);
  const notifications = useNotificationStore(s => s.notifications);
  const unreadCount = useNotificationStore(s => s.unreadCount);
  const soundEnabled = useNotificationStore(s => s.soundEnabled);
  const fetchNotifications = useNotificationStore(s => s.fetchNotifications);
  const fetchUnreadCount = useNotificationStore(s => s.fetchUnreadCount);
  const markAsRead = useNotificationStore(s => s.markAsRead);
  const acceptInvite = useNotificationStore(s => s.acceptInvite);
  const declineInvite = useNotificationStore(s => s.declineInvite);

  const location = useLocation();
  const navigate = useNavigate();
  const channelRef = useRef<BroadcastChannel | null>(null);
  const knownNotificationIds = useRef<Set<string>>(new Set());
  const lastActiveReportTime = useRef<number>(0);

  // 1. Report user active page to backend (for smart active-screen toast suppression)
  useEffect(() => {
    if (!isAuthenticated || !userId) return;
    const isAuthRoute =
      location.pathname === '/login' ||
      location.pathname === '/signup' ||
      location.pathname === '/verify-email' ||
      location.pathname.startsWith('/verify-email') ||
      location.pathname === '/forgot-password' ||
      location.pathname === '/reset-password' ||
      location.pathname.startsWith('/auth/') ||
      location.pathname.startsWith('/onboard') ||
      location.pathname.startsWith('/onboarding');
    if (isAuthRoute) return;

    const now = Date.now();
    if (now - lastActiveReportTime.current > 15000) {
      lastActiveReportTime.current = now;
      api.post('/notifications/activity', { page: location.pathname }).catch(() => {});
    }
  }, [isAuthenticated, userId, location.pathname]);

  // 2. Setup BroadcastChannel for cross-tab coordination
  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;

    const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    channelRef.current = channel;

    channel.onmessage = (event) => {
      const data = event.data;
      if (data?.type === 'NOTIFICATION_TOAST_FIRED') {
        // Record as known in this tab so we don't duplicate audio/toast
        if (data.id) knownNotificationIds.current.add(data.id);
        fetchUnreadCount();
      } else if (data?.type === 'UNREAD_COUNT_CHANGED') {
        fetchUnreadCount();
      }
    };

    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [fetchUnreadCount]);

  // 3. Process new incoming notification items and trigger rich Sonner toast
  const handleNewNotification = useCallback(
    (notif: NotificationData) => {
      const notifId = notif._id || notif.id;
      if (!notifId || knownNotificationIds.current.has(notifId)) return;
      knownNotificationIds.current.add(notifId);

      // Check toast suppression (e.g. user was active on relevant page)
      if (notif.data?.suppressToast) {
        return;
      }

      // Check if this browser tab is currently active/visible
      const isTabActive = typeof document !== 'undefined' && !document.hidden;

      // Broadcast to other tabs that this active tab handled the toast
      if (channelRef.current) {
        channelRef.current.postMessage({
          type: 'NOTIFICATION_TOAST_FIRED',
          id: notifId,
          timestamp: Date.now(),
        });
      }

      // Play soft chime if sound enabled and tab is active
      if (soundEnabled && isTabActive) {
        playSynthesizedChime();
      }

      // Is it an invitation?
      const isInvite =
        notif.type === 'org_invite' ||
        notif.type === 'workspace_invite' ||
        notif.type === 'branch_invite' ||
        Boolean(notif.data?.inviteId);

      const inviteId = notif.data?.inviteId;

      if (isInvite && inviteId && !notif.data?.isResolved) {
        toast.custom(
          (t) => (
            <div className="w-full max-w-md bg-slate-900 border border-emerald-500/40 text-white rounded-xl p-4 shadow-2xl space-y-3 animate-in slide-in-from-top-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <h4 className="text-sm font-bold text-white">{notif.title}</h4>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">{notif.body || notif.message}</p>
                </div>
                <button
                  onClick={() => toast.dismiss(t)}
                  className="text-slate-400 hover:text-white text-xs px-1.5 py-0.5 rounded hover:bg-slate-800"
                >
                  ✕
                </button>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={async () => {
                    toast.dismiss(t);
                    await acceptInvite(inviteId, notifId);
                  }}
                  className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md"
                >
                  Accept & Join
                </button>
                <button
                  onClick={async () => {
                    toast.dismiss(t);
                    await declineInvite(inviteId, notifId);
                  }}
                  className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Decline
                </button>
              </div>
            </div>
          ),
          { duration: 8000 }
        );
      } else {
        // Standard interactive Toast
        const toastFn =
          notif.severity === 'ERROR'
            ? toast.error
            : notif.severity === 'WARNING'
            ? toast.warning
            : notif.severity === 'SUCCESS'
            ? toast.success
            : toast.info;

        toastFn(notif.title, {
          description: notif.body || notif.message,
          action: notif.actionUrl
            ? {
                label: notif.actionLabel || 'View',
                onClick: () => {
                  markAsRead(notifId);
                  const targetUrl = resolveTargetSubdomainUrl(notif.actionUrl);
                  if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
                    window.location.href = targetUrl;
                  } else {
                    navigate(targetUrl);
                  }
                },
              }
            : undefined,
          duration: 5000,
        });
      }
    },
    [soundEnabled, markAsRead, acceptInvite, declineInvite, navigate]
  );

  // 4. Initial Load & Reactive Polling Stream with visibility optimization
  useEffect(() => {
    if (!isAuthenticated) return;

    const isOnboarding = location.pathname.startsWith('/onboard') || location.pathname.startsWith('/onboarding');
    if (isOnboarding) return;

    let isMounted = true;
    let inFlightFetch = false;

    const fetchLatest = async () => {
      if (!isMounted || inFlightFetch) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

      inFlightFetch = true;
      try {
        const prevList = useNotificationStore.getState().notifications;
        await fetchUnreadCount();
        await fetchNotifications(25);

        const currentList = useNotificationStore.getState().notifications;
        // Check for newly arrived unread notifications
        for (const item of currentList) {
          const id = item._id || item.id;
          if (id && item.status === 'UNREAD' && !knownNotificationIds.current.has(id)) {
            if (prevList.length > 0) {
              handleNewNotification(item);
            } else {
              knownNotificationIds.current.add(id);
            }
          }
        }
      } catch {
        // Silently ignore background polling error
      } finally {
        inFlightFetch = false;
      }
    };

    // Schedule initial load when browser main thread is idle
    const idleHandle = typeof window !== 'undefined' && 'requestIdleCallback' in window
      ? (window as any).requestIdleCallback(() => fetchLatest(), { timeout: 2500 })
      : setTimeout(fetchLatest, 1000);

    // Adaptive visibility-aware background polling (30s active / 60s background)
    const getPollInterval = () => {
      if (typeof document !== 'undefined' && (document.visibilityState === 'hidden' || (document as any).hidden)) {
        return 60000; // 1 minute when tab is hidden
      }
      return 30000; // 30 seconds when active
    };

    let interval = setInterval(fetchLatest, getPollInterval());

    const onVisibilityChange = () => {
      clearInterval(interval);
      if (document.visibilityState === 'visible') {
        fetchLatest();
      }
      interval = setInterval(fetchLatest, getPollInterval());
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      isMounted = false;
      if (typeof window !== 'undefined' && 'cancelIdleCallback' in window && typeof idleHandle === 'number') {
        (window as any).cancelIdleCallback(idleHandle);
      } else {
        clearTimeout(idleHandle);
      }
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [isAuthenticated, location.pathname, fetchNotifications, fetchUnreadCount, handleNewNotification]);

  return {
    notifications,
    unreadCount,
  };
}
