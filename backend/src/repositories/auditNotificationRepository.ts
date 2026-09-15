import { BaseRepository } from './baseRepository.js';
import { emailService } from '../services/email.js';
import { env } from '../config/env.js';

export class AuditNotificationRepository extends BaseRepository {
  public clearAll() {
    emailService.clearSentEmails();
  }

  public async enqueue(
    to: string,
    template: 'verification' | 'invitation' | 'onboardingCompleted' | 'passwordReset' | 'emailChange',
    payload: Record<string, string>
  ) {
    // Dispatch directly once via configured provider (Brevo / Resend)
    const directResult = await emailService.sendDirect(to, template, payload);

    // Only enqueue into outbox as a retry queue if direct dispatch failed
    if (!directResult.success) {
      try {
        await this.mutate('emailOutbox:enqueue', { to, template, payload });
      } catch (err: any) {
        if (env.NODE_ENV !== 'test') {
          console.warn(`[AuditNotificationRepository] Email enqueue fallback skipped: ${err.message || err}`);
        }
      }
    }
  }

  public async logAudit(data: {
    actorUserId?: string;
    targetUserId?: string;
    workspaceId?: string;
    organizationId?: string;
    productKey?: string;
    eventType: string;
    action?: string;
    entityType?: string;
    entityId?: string;
    resource?: string;
    severity?: 'info' | 'warning' | 'critical';
    ipAddress?: string;
    userAgent?: string;
    requestId?: string;
    metadata?: Record<string, unknown>;
  }) {
    try {
      await this.mutate('audit:logAuditEvent', {
        actorId: data.actorUserId,
        actorUserId: data.actorUserId,
        targetUserId: data.targetUserId,
        workspaceId: data.workspaceId,
        organizationId: data.organizationId,
        productKey: data.productKey,
        eventType: data.eventType,
        action: data.action || data.eventType,
        entityType: data.entityType,
        entityId: data.entityId,
        resource: data.resource || 'auth',
        severity: data.severity || 'info',
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        requestId: data.requestId,
        metadata: data.metadata,
      });
    } catch (err) {
      console.warn('[AuditNotificationRepository] Failed to write audit log:', err);
    }
  }

  public async logAuthEvent(data: {
    eventType: string;
    userId?: string;
    sessionId?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
  }) {
    try {
      await this.mutate('authEvents:logAuthEvent', {
        eventType: data.eventType,
        userId: data.userId ? (data.userId as any) : undefined,
        sessionId: data.sessionId ? (data.sessionId as any) : undefined,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        metadata: data.metadata,
      });
    } catch (err) {
      console.warn('[AuditNotificationRepository] Failed to log auth event:', err);
    }
  }

  public async getUserAuthEvents(userId: string, limit?: number) {
    try {
      return (await this.query('authEvents:getUserAuthEvents', {
        userId: userId as any,
        limit,
      })) as any[];
    } catch {
      return [];
    }
  }
}
