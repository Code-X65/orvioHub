import { BaseRepository } from './baseRepository.js';
import { emailService } from '../services/email.js';
import { env } from '../config/env.js';
import crypto from 'node:crypto';
import { fireAndForget } from '../utils/asyncUtils.js';

const WEBHOOK_EVENT_MAP: Record<string, string> = {
  'workspace.member_invited': 'member.invited', 'workspace.member_joined': 'member.joined',
  'workspace.member_role_changed': 'member.role_changed', 'workspace.member_suspended': 'member.suspended',
  'workspace.member_removed': 'member.removed', 'workspace.member_transferred': 'member.transferred', 'workspace.branch_created': 'branch.created',
  'workspace.branch_updated': 'branch.updated', 'workspace.branch_archived': 'branch.archived',
  'branch.manager_changed': 'branch.manager_changed',
  'workspace.created': 'workspace.created', 'workspace.updated': 'workspace.settings_updated',
  'workspace.deleted': 'workspace.deleted', 'workspace.plan_changed': 'workspace.plan_changed', 'onboarding.completed': 'onboarding.completed',
  'onboarding.step_completed': 'onboarding.step_completed', 'receipt.generated': 'receipt.generated',
  'receipt.voided': 'receipt.voided', 'fiscal_day_closed': 'fiscal_day_closed',
  'subscription.renewed': 'subscription.renewed', 'subscription.cancelled': 'subscription.cancelled',
  'onboarding.abandoned': 'onboarding.abandoned', 'subscription.downgraded': 'subscription.downgraded', 'payment.failed': 'payment.failed', 'invoice.generated': 'invoice.generated',
};

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
      if (data.workspaceId) fireAndForget(this.dispatchWebhookEvent(data), `webhook:${data.eventType}`);
    } catch (err) {
      console.warn('[AuditNotificationRepository] Failed to write audit log:', err);
    }
  }

  /** Delivers only subscribed lifecycle events with an HMAC-SHA256 signature. */
  private async dispatchWebhookEvent(data: { workspaceId?: string; eventType: string; [key: string]: any }) {
    const eventType = WEBHOOK_EVENT_MAP[data.eventType] || data.eventType;
    if (!WEBHOOK_EVENT_MAP[data.eventType]) return;
    const endpoints: any[] = await this.query('outboundWebhooks:listEndpoints', { workspaceId: data.workspaceId as any });
    const eventId = crypto.randomUUID();
    const payload = { id: eventId, type: eventType, version: '2026-01-01', createdAt: new Date().toISOString(), data: { workspaceId: data.workspaceId, actorUserId: data.actorUserId, targetUserId: data.targetUserId, entityId: data.entityId, metadata: data.metadata || {} } };
    const body = JSON.stringify(payload);
    await Promise.all(endpoints.filter((endpoint) => endpoint.status === 'active' && endpoint.eventTypes.includes(eventType)).map(async (endpoint) => {
      let status: 'delivered' | 'failed' = 'failed'; let responseStatus: number | undefined; let lastError: string | undefined;
      try {
        const signature = crypto.createHmac('sha256', endpoint.secret).update(`${eventId}.${body}`).digest('hex');
        const response = await fetch(endpoint.url, { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': 'OrvioHub-Webhooks/1.0', 'x-orvio-event-id': eventId, 'x-orvio-event-type': eventType, 'x-orvio-webhook-signature': `sha256=${signature}` }, body, signal: AbortSignal.timeout(10_000) });
        responseStatus = response.status; status = response.ok ? 'delivered' : 'failed';
        if (!response.ok) lastError = `HTTP ${response.status}`;
      } catch (error: any) { lastError = error?.message || 'Delivery failed'; }
      await this.mutate('outboundWebhooks:recordDelivery', { endpointId: endpoint._id, workspaceId: data.workspaceId as any, eventId, eventType, payload, status, attemptCount: 1, responseStatus, lastError, deliveredAt: status === 'delivered' ? Date.now() : undefined });
    }));
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
