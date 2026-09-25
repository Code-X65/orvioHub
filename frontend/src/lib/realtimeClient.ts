import { useNotificationStore } from '@/stores/useNotificationStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useBranchStore } from '@/stores/useBranchStore';

export type RealtimeEventHandler<T = any> = (payload: T) => void;

class RealtimeClient {
  private eventSource: EventSource | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_DELAY_MS = 30000;
  private listeners = new Map<string, Set<RealtimeEventHandler>>();
  private isConnected = false;

  public connect(options?: { userId?: string; workspaceId?: string }) {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;
    if (this.eventSource && (this.eventSource.readyState === EventSource.OPEN || this.eventSource.readyState === EventSource.CONNECTING)) {
      return;
    }

    const token = localStorage.getItem('token') || '';
    const query = new URLSearchParams();
    if (options?.userId) query.set('userId', options.userId);
    if (options?.workspaceId) query.set('workspaceId', options.workspaceId);
    if (token) query.set('token', token);

    const streamUrl = `/api/v1/realtime/stream?${query.toString()}`;

    try {
      this.eventSource = new EventSource(streamUrl, { withCredentials: true });

      this.eventSource.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emit('connection.open', { connectedAt: Date.now() });
      };

      this.eventSource.onerror = (err) => {
        this.isConnected = false;
        this.eventSource?.close();
        this.eventSource = null;
        this.scheduleReconnect(options);
      };

      // Register standard system event handlers
      const eventTypes = [
        'notification.created',
        'notification.read',
        'notification.archived',
        'workspace.updated',
        'workspace.member_joined',
        'workspace.member_left',
        'branch.created',
        'branch.updated',
        'branch.deactivated',
        'inventory.stock_updated',
        'job.progress',
        'job.completed',
        'job.failed',
      ];

      eventTypes.forEach((type) => {
        this.eventSource?.addEventListener(type, (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            this.handleIncomingEvent(type, data);
          } catch (parseErr) {
            console.warn('[Realtime] Failed to parse event data:', parseErr);
          }
        });
      });
    } catch (err) {
      this.scheduleReconnect(options);
    }
  }

  public disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.isConnected = false;
  }

  public subscribe<T = any>(eventType: string, handler: RealtimeEventHandler<T>): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(handler);

    return () => {
      this.listeners.get(eventType)?.delete(handler);
    };
  }

  private emit(eventType: string, payload: any) {
    const handlers = this.listeners.get(eventType);
    if (handlers) {
      handlers.forEach((h) => {
        try {
          h(payload);
        } catch (err) {
          console.error(`[Realtime] Handler error for ${eventType}:`, err);
        }
      });
    }
  }

  private handleIncomingEvent(type: string, data: any) {
    const payload = data.payload || data;

    // 1. Notify store listeners
    switch (type) {
      case 'notification.created':
        useNotificationStore.getState().fetchUnreadCount();
        useNotificationStore.getState().fetchNotifications();
        break;

      case 'notification.read':
      case 'notification.archived':
        useNotificationStore.getState().fetchUnreadCount();
        break;

      case 'workspace.updated':
      case 'workspace.member_joined':
      case 'workspace.member_left':
        useWorkspaceStore.getState().fetchWorkspaces(true);
        break;

      case 'branch.created':
      case 'branch.updated':
      case 'branch.deactivated':
        useBranchStore.getState().fetchBranches(undefined, undefined, true);
        break;
    }

    // 2. Notify custom subscribers
    this.emit(type, payload);
    this.emit('*', { type, payload });
  }

  private scheduleReconnect(options?: { userId?: string; workspaceId?: string }) {
    if (this.reconnectTimer) return;

    this.reconnectAttempts++;
    const delay = Math.min(
      this.MAX_RECONNECT_DELAY_MS,
      1000 * Math.pow(2, this.reconnectAttempts) + Math.random() * 1000
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect(options);
    }, delay);
  }
}

export const realtimeClient = new RealtimeClient();
