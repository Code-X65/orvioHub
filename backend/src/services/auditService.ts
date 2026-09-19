import { randomUUID } from 'crypto';
import { dataService } from './dataService.js';
import { env } from '../config/env.js';

export type EventSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface EventContext {
  eventId?: string;
  eventType: string;
  actorUserId?: string;
  actorAdminId?: string;
  actorType?: 'user' | 'admin' | 'system';
  organizationId: string;
  workspaceId?: string;
  productKey?: 'inventory' | string;
  branchId?: string;
  entityType?: string;
  entityId?: string;
  severity?: EventSeverity;
  reason?: string;
  beforeMetadata?: Record<string, unknown>;
  afterMetadata?: Record<string, unknown>;
  safeMetadata?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
  occurredAt?: number;
}

// Sensitive keys that must NEVER be stored in audit logs
const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /authorization/i,
  /api[-_]?key/i,
  /paystack/i,
  /card[-_]?number/i,
  /cvv/i,
  /cvc/i,
  /pin/i,
  /totp/i,
  /otp/i,
  /credential/i,
  /cookie/i,
  /private[-_]?key/i,
  /invitation[-_]?token/i,
];

const inMemoryAuditLogs: any[] = [];

export class AuditService {
  /**
   * Deeply sanitizes an object by removing or masking sensitive fields
   */
  public sanitizeMetadata(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeMetadata(item));
    }

    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      // Check if key is sensitive
      const isSensitive = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
      if (isSensitive) {
        cleaned[key] = '[REDACTED]';
        continue;
      }

      // Check nested objects
      if (typeof value === 'object' && value !== null) {
        cleaned[key] = this.sanitizeMetadata(value);
      } else if (typeof value === 'string' && value.length > 500) {
        // Prevent oversized payload storage
        cleaned[key] = value.slice(0, 500) + '...[TRUNCATED]';
      } else {
        cleaned[key] = value;
      }
    }
    return cleaned;
  }

  /**
   * Records a canonical audit event
   */
  public async record(event: EventContext): Promise<string> {
    const eventId = event.eventId || randomUUID();
    const occurredAt = event.occurredAt || Date.now();
    const actorType = event.actorType || (event.actorAdminId ? 'admin' : event.actorUserId ? 'user' : 'system');
    const severity = event.severity || 'low';

    const safeMetadata = this.sanitizeMetadata({
      ...(event.metadata || {}),
      ...(event.safeMetadata || {}),
      before: event.beforeMetadata ? this.sanitizeMetadata(event.beforeMetadata) : undefined,
      after: event.afterMetadata ? this.sanitizeMetadata(event.afterMetadata) : undefined,
      reason: event.reason,
    });

    // Store in-memory
    inMemoryAuditLogs.unshift({
      id: eventId,
      actorId: event.actorUserId || event.actorAdminId,
      organizationId: event.organizationId,
      workspaceId: event.workspaceId || event.organizationId,
      eventType: event.eventType,
      action: event.eventType,
      severity,
      timestamp: occurredAt,
      createdAt: occurredAt,
      metadata: {
        ...safeMetadata,
        eventId,
        actorType,
        actorAdminId: event.actorAdminId,
        branchId: event.branchId,
        occurredAt,
      },
    });

    try {
      await dataService.logAudit({
        actorUserId: event.actorUserId,
        workspaceId: event.workspaceId || event.organizationId,
        productKey: event.productKey || 'inventory',
        eventType: event.eventType,
        action: event.eventType,
        entityType: event.entityType,
        entityId: event.entityId,
        resource: event.productKey || 'workspace',
        severity: severity === 'critical' ? 'critical' : severity === 'high' ? 'warning' : 'info',
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        requestId: event.requestId,
        metadata: {
          ...safeMetadata,
          eventId,
          actorType,
          actorAdminId: event.actorAdminId,
          branchId: event.branchId,
          occurredAt,
        },
      });
    } catch (err: any) {
      if (env.NODE_ENV !== 'test') {
        console.warn(`[AuditService] Failed to record audit log: ${err.message || err}`);
      }
    }

    return eventId;
  }

  /**
   * Helper to retrieve organization audit trail with pagination and filtering
   */
  public async getOrganizationAuditLogs(
    organizationId: string,
    options?: {
      branchId?: string;
      eventType?: string;
      severity?: string;
      page?: number;
      limit?: number;
    }
  ) {
    const page = options?.page || 1;
    const limit = options?.limit || 20;

    let rawLogs: any[] = [];
    try {
      rawLogs = await dataService.getWorkspaceAuditLogs(organizationId);
    } catch {
      rawLogs = inMemoryAuditLogs.filter(
        (l) => l.organizationId === organizationId || l.workspaceId === organizationId
      );
    }

    if (!Array.isArray(rawLogs) || rawLogs.length === 0) {
      rawLogs = inMemoryAuditLogs.filter(
        (l) => l.organizationId === organizationId || l.workspaceId === organizationId
      );
    }

    let filtered = rawLogs;

    if (options?.branchId) {
      filtered = filtered.filter((l: any) => l.metadata?.branchId === options.branchId);
    }
    if (options?.eventType) {
      const et = options.eventType.toLowerCase();
      filtered = filtered.filter((l: any) => (l.eventType || l.action || '').toLowerCase().includes(et));
    }
    if (options?.severity) {
      filtered = filtered.filter((l: any) => l.severity === options.severity);
    }

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginated = filtered.slice(startIndex, startIndex + limit);

    return {
      logs: paginated,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }
}

export const auditService = new AuditService();
