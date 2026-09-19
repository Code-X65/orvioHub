import { randomUUID } from 'crypto';
import { dataService } from './dataService.js';
import { type EventContext, auditService } from './auditService.js';
import { env } from '../config/env.js';

export interface NotificationRecord {
  id: string;
  eventId: string;
  eventType: string;
  recipientUserId: string;
  organizationId?: string;
  workspaceId?: string;
  productKey?: string;
  branchId?: string;
  category: 'security' | 'workspace' | 'inventory' | 'billing' | 'system';
  title: string;
  body: string;
  actionUrl?: string;
  channel: 'in_app' | 'email' | 'sms' | 'whatsapp';
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'read';
  dedupeKey: string;
  readAt?: number;
  sentAt?: number;
  deliveredAt?: number;
  failedAt?: number;
  errorMessage?: string;
  createdAt: number;
  updatedAt: number;
}

// In-memory or database-backed notification delivery tracking
const inMemoryNotifications = new Map<string, NotificationRecord>();

export class NotificationService {
  /**
   * Generates a deterministic deduplication key for notifications
   */
  public generateDedupeKey(eventId: string, recipientUserId: string, channel: string, eventType?: string): string {
    return `${eventId}:${eventType || 'event'}:${recipientUserId}:${channel}`;
  }

  /**
   * Resolves notification recipients and content from a canonical domain/audit event
   */
  public async createFromEvent(
    event: EventContext,
    options?: {
      recipients?: string[];
      title?: string;
      body?: string;
      actionUrl?: string;
      channel?: 'in_app' | 'email' | 'sms' | 'whatsapp';
    }
  ): Promise<NotificationRecord[]> {
    const eventId = event.eventId || randomUUID();
    const eventType = event.eventType;
    const now = Date.now();
    const channel = options?.channel || 'in_app';

    // 1. Determine Category
    let category: NotificationRecord['category'] = 'workspace';
    if (eventType.startsWith('security.') || eventType.includes('sessions_revoked') || eventType.includes('suspended')) {
      category = 'security';
    } else if (eventType.startsWith('billing.') || eventType.startsWith('subscription.') || eventType.startsWith('payment.')) {
      category = 'billing';
    } else if (eventType.startsWith('branch.') || eventType.startsWith('application.inventory')) {
      category = 'inventory';
    } else if (eventType.startsWith('system.') || eventType.startsWith('admin.')) {
      category = 'system';
    }

    // 2. Resolve Recipients
    const recipients: string[] = [];
    if (options?.recipients && options.recipients.length > 0) {
      recipients.push(...options.recipients);
    } else if (event.actorUserId) {
      // Default to actor if no recipients specified
      recipients.push(event.actorUserId);
    }

    const createdNotifications: NotificationRecord[] = [];

    for (const recipientId of recipients) {
      const dedupeKey = this.generateDedupeKey(eventId, recipientId, channel, eventType);

      // Check deduplication
      if (inMemoryNotifications.has(dedupeKey)) {
        continue;
      }

      // Default Title & Body templates
      const title = options?.title || this.formatDefaultTitle(eventType);
      const body = options?.body || this.formatDefaultBody(eventType, event);
      const actionUrl = options?.actionUrl || (event.organizationId ? `/workspaces/${event.organizationId}` : '/workspaces');

      const notif: NotificationRecord = {
        id: randomUUID(),
        eventId,
        eventType,
        recipientUserId: recipientId,
        organizationId: event.organizationId,
        workspaceId: event.workspaceId || event.organizationId,
        productKey: event.productKey || 'inventory',
        branchId: event.branchId,
        category,
        title,
        body,
        actionUrl,
        channel,
        status: 'delivered',
        dedupeKey,
        sentAt: now,
        deliveredAt: now,
        createdAt: now,
        updatedAt: now,
      };

      inMemoryNotifications.set(dedupeKey, notif);
      createdNotifications.push(notif);

      // Also persist to Convex database notifications table if available
      try {
        await dataService.createNotification({
          userId: recipientId as any,
          workspaceId: event.workspaceId || event.organizationId,
          type: eventType,
          title,
          message: body,
          data: {
            eventId,
            actionUrl,
            organizationId: event.organizationId,
            branchId: event.branchId,
            category,
          },
        });
      } catch (err: any) {
        if (env.NODE_ENV !== 'test') {
          console.warn(`[NotificationService] Fallback DB insert skipped: ${err.message || err}`);
        }
      }
    }

    return createdNotifications;
  }

  /**
   * Retrieves notifications for a given user with optional status and category filtering
   */
  public async getNotifications(
    userId: string,
    options?: {
      status?: 'UNREAD' | 'READ' | 'ARCHIVED';
      category?: string;
      limit?: number;
    }
  ) {
    // 1. Fetch from database
    const dbNotifs = await dataService.getNotificationsForUser(userId, {
      status: options?.status,
      limit: options?.limit || 50,
    });

    // 2. Fetch from in-memory tracking
    const memNotifs = Array.from(inMemoryNotifications.values()).filter(
      (n) => n.recipientUserId === userId
    );

    // Merge and deduplicate
    const combined = [...dbNotifs];
    for (const mem of memNotifs) {
      if (!combined.some((c: any) => c.id === mem.id || c.message === mem.body)) {
        combined.push({
          id: mem.id,
          userId: mem.recipientUserId,
          type: mem.eventType,
          title: mem.title,
          message: mem.body,
          status: mem.readAt ? 'READ' : 'UNREAD',
          createdAt: mem.createdAt,
          data: {
            eventId: mem.eventId,
            actionUrl: mem.actionUrl,
            category: mem.category,
            branchId: mem.branchId,
          },
        });
      }
    }

    return combined.slice(0, options?.limit || 50);
  }

  /**
   * Gets unread notification count
   */
  public async getUnreadCount(userId: string): Promise<number> {
    const list = await this.getNotifications(userId, { status: 'UNREAD' });
    return list.length;
  }

  /**
   * Marks a notification as read
   */
  public async markRead(notificationId: string): Promise<void> {
    for (const notif of inMemoryNotifications.values()) {
      if (notif.id === notificationId) {
        notif.status = 'read';
        notif.readAt = Date.now();
        notif.updatedAt = Date.now();
      }
    }
    try {
      if (typeof (dataService as any).markNotificationRead === 'function') {
        await (dataService as any).markNotificationRead(notificationId);
      }
    } catch {}
  }

  /**
   * Marks all notifications as read for a user
   */
  public async markAllRead(userId: string): Promise<void> {
    for (const notif of inMemoryNotifications.values()) {
      if (notif.recipientUserId === userId) {
        notif.status = 'read';
        notif.readAt = Date.now();
        notif.updatedAt = Date.now();
      }
    }
    try {
      if (typeof (dataService as any).markAllNotificationsRead === 'function') {
        await (dataService as any).markAllNotificationsRead(userId);
      }
    } catch {}
  }

  private formatDefaultTitle(eventType: string): string {
    return eventType
      .split('.')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  private formatDefaultBody(eventType: string, event: EventContext): string {
    switch (eventType) {
      case 'organization.created':
        return 'Organization was successfully created and provisioned with a 30-day Free Trial.';
      case 'branch.created':
        return `New Nigerian branch "${event.metadata?.name || 'Store'}" was created.`;
      case 'branch.set_primary':
        return `Branch "${event.metadata?.name || event.branchId}" has been set as the primary branch.`;
      case 'branch.suspended':
        return `Branch operations were suspended: ${event.reason || 'No reason provided'}.`;
      case 'branch.restored':
        return 'Branch operations have been restored.';
      case 'branch.archived':
        return 'Branch has been archived.';
      case 'membership.invited':
        return `Invitation sent for organization access.`;
      case 'billing.trial_started':
        return 'Welcome to your 30-day Free Trial of Orviohub Inventory.';
      default:
        return `Action ${eventType} completed successfully.`;
    }
  }
}

export const notificationService = new NotificationService();
