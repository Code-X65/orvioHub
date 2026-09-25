import { EventEmitter } from 'node:events';

export type RealtimeEventType =
  | 'notification.created'
  | 'notification.read'
  | 'notification.archived'
  | 'workspace.updated'
  | 'workspace.member_joined'
  | 'workspace.member_left'
  | 'branch.created'
  | 'branch.updated'
  | 'branch.deactivated'
  | 'inventory.stock_updated'
  | 'job.progress'
  | 'job.completed'
  | 'job.failed'
  | 'usage.updated';

export interface RealtimeEvent<T = any> {
  id: string;
  type: RealtimeEventType;
  payload: T;
  timestamp: number;
  targetUserId?: string;
  targetWorkspaceId?: string;
}

class RealtimeEventBus extends EventEmitter {
  private static instance: RealtimeEventBus;

  private constructor() {
    super();
    this.setMaxListeners(100);
  }

  public static getInstance(): RealtimeEventBus {
    if (!RealtimeEventBus.instance) {
      RealtimeEventBus.instance = new RealtimeEventBus();
    }
    return RealtimeEventBus.instance;
  }

  public publish<T = any>(
    type: RealtimeEventType,
    payload: T,
    options?: { targetUserId?: string; targetWorkspaceId?: string; eventId?: string }
  ): RealtimeEvent<T> {
    const event: RealtimeEvent<T> = {
      id: options?.eventId || `evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      type,
      payload,
      timestamp: Date.now(),
      targetUserId: options?.targetUserId,
      targetWorkspaceId: options?.targetWorkspaceId,
    };

    // Emit global and scoped events
    this.emit('event', event);
    this.emit(type, event);

    if (event.targetUserId) {
      this.emit(`user:${event.targetUserId}`, event);
    }
    if (event.targetWorkspaceId) {
      this.emit(`workspace:${event.targetWorkspaceId}`, event);
    }

    return event;
  }

  public subscribeUser(userId: string, callback: (event: RealtimeEvent) => void): () => void {
    const userChannel = `user:${userId}`;
    const globalHandler = (event: RealtimeEvent) => {
      // Forward global broadcast events that have no user target
      if (!event.targetUserId && !event.targetWorkspaceId) {
        callback(event);
      }
    };

    this.on(userChannel, callback);
    this.on('event', globalHandler);

    return () => {
      this.off(userChannel, callback);
      this.off('event', globalHandler);
    };
  }

  public subscribeWorkspace(workspaceId: string, callback: (event: RealtimeEvent) => void): () => void {
    const wsChannel = `workspace:${workspaceId}`;
    this.on(wsChannel, callback);
    return () => {
      this.off(wsChannel, callback);
    };
  }
}

export const realtimeEventBus = RealtimeEventBus.getInstance();
