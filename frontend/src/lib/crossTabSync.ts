export type CrossTabSyncMessageType =
  | 'WORKSPACE_CHANGED'
  | 'BRANCH_CHANGED'
  | 'AUTH_STATE_CHANGED'
  | 'NOTIFICATIONS_SYNC'
  | 'USER_PROFILE_UPDATED'
  | 'USAGE_SYNC';

export interface CrossTabSyncMessage<T = any> {
  id: string;
  type: CrossTabSyncMessageType;
  payload: T;
  sourceTabId: string;
  timestamp: number;
}

export type CrossTabSyncHandler<T = any> = (message: CrossTabSyncMessage<T>) => void;

class CrossTabSyncManager {
  private channel: BroadcastChannel | null = null;
  private tabId: string;
  private handlers = new Map<string, Set<CrossTabSyncHandler>>();
  private readonly CHANNEL_NAME = 'orvio_cross_tab_sync_bus';
  private isListening = false;

  constructor() {
    this.tabId = `tab_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.init();
  }

  public getTabId(): string {
    return this.tabId;
  }

  private init() {
    if (typeof window === 'undefined') return;

    if ('BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel(this.CHANNEL_NAME);
        this.channel.onmessage = (event) => {
          this.handleIncomingMessage(event.data);
        };
        this.isListening = true;
      } catch (err) {
        console.warn('[CrossTabSync] BroadcastChannel unavailable, using localStorage fallback');
      }
    }

    // Storage event fallback for older browsers or cross-context scenarios
    window.addEventListener('storage', (event) => {
      if (event.key === 'orvio_cross_tab_sync_event' && event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue);
          this.handleIncomingMessage(parsed);
        } catch {}
      }
    });
  }

  public broadcast<T = any>(type: CrossTabSyncMessageType, payload: T) {
    if (typeof window === 'undefined') return;

    const message: CrossTabSyncMessage<T> = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type,
      payload,
      sourceTabId: this.tabId,
      timestamp: Date.now(),
    };

    if (this.channel) {
      try {
        this.channel.postMessage(message);
      } catch (err) {
        console.warn('[CrossTabSync] Failed to post via BroadcastChannel:', err);
      }
    }

    try {
      localStorage.setItem('orvio_cross_tab_sync_event', JSON.stringify(message));
    } catch {}
  }

  public subscribe<T = any>(type: CrossTabSyncMessageType | '*', handler: CrossTabSyncHandler<T>): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler as CrossTabSyncHandler);

    return () => {
      this.handlers.get(type)?.delete(handler as CrossTabSyncHandler);
    };
  }

  private handleIncomingMessage(message: CrossTabSyncMessage) {
    if (!message || message.sourceTabId === this.tabId) {
      return; // Ignore messages originating from this same tab
    }

    const specificHandlers = this.handlers.get(message.type);
    if (specificHandlers) {
      specificHandlers.forEach((h) => h(message));
    }

    const wildcardHandlers = this.handlers.get('*');
    if (wildcardHandlers) {
      wildcardHandlers.forEach((h) => h(message));
    }
  }

  // Convenience methods
  public broadcastWorkspaceChange(workspaceId: string, workspaceName?: string) {
    this.broadcast('WORKSPACE_CHANGED', { workspaceId, workspaceName });
  }

  public broadcastBranchChange(branchId: string, branchName?: string) {
    this.broadcast('BRANCH_CHANGED', { branchId, branchName });
  }

  public broadcastAuthChange(type: 'LOGIN' | 'LOGOUT' | 'TOKEN_REFRESHED', user?: any) {
    this.broadcast('AUTH_STATE_CHANGED', { type, user });
  }

  public broadcastNotificationsSync(unreadCount: number, readId?: string) {
    this.broadcast('NOTIFICATIONS_SYNC', { unreadCount, readId });
  }
}

export const crossTabSync = new CrossTabSyncManager();
