import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import Fastify, { type FastifyInstance } from 'fastify';
import { auditService, type EventContext } from '../src/services/auditService.js';
import { notificationService } from '../src/services/notificationService.js';
import { notificationRoutes } from '../src/routes/notifications.js';
import { workspaceRoutes } from '../src/routes/workspaces.js';

describe('Phase 7: Canonical Audit Logs, Notifications & Event Consistency Suite', () => {
  let app: FastifyInstance;

  const mockUsers: Record<string, any> = {
    user_owner_a: { id: 'user_owner_a', name: 'Owner Alpha', email: 'owner.a@example.com', role: 'owner' },
    user_staff_a: { id: 'user_staff_a', name: 'Staff Alpha', email: 'staff.a@example.com', role: 'staff' },
    user_owner_b: { id: 'user_owner_b', name: 'Owner Beta', email: 'owner.b@example.com', role: 'owner' },
  };

  let currentAuthUser: any = mockUsers.user_owner_a;

  before(async () => {
    app = Fastify({ logger: false });

    // Authentication decorator
    app.decorate('authenticate', async (req: any, reply: any) => {
      if (!currentAuthUser) {
        return reply.status(401).send({ error: 'UNAUTHORIZED' });
      }
      req.user = currentAuthUser;
    });

    // Workspace role decorator
    app.decorate('requireWorkspaceRole', (roles: string[]) => async (req: any, reply: any) => {
      const { workspaceId } = req.params;
      if (workspaceId === 'org_alpha' && req.user.id.includes('b')) {
        return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Cross-tenant access denied' } });
      }
      if (workspaceId === 'org_beta' && req.user.id.includes('a')) {
        return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Cross-tenant access denied' } });
      }
    });

    await app.register(notificationRoutes, { prefix: '/api/v1/notifications' });
    await app.register(workspaceRoutes, { prefix: '/api/v1/workspaces' });
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  describe('1. Audit Logging & Secret Masking Engine', () => {
    it('Canonical EventContext records valid event with unique eventId', async () => {
      const event: EventContext = {
        eventType: 'branch.created',
        actorUserId: 'user_owner_a',
        organizationId: 'org_alpha',
        productKey: 'inventory',
        branchId: 'branch_ikeja',
        severity: 'medium',
        metadata: {
          name: 'Ikeja Branch',
          code: 'IKJ-MAIN',
          state: 'Lagos',
        },
      };

      const eventId = await auditService.record(event);
      assert.ok(eventId, 'Audit service must return a generated eventId');
      assert.strictEqual(typeof eventId, 'string');
    });

    it('Secret sanitization engine strips passwords, tokens, API keys, and OTPs', () => {
      const dirtyPayload = {
        organizationName: 'Alpha Retail',
        adminPassword: 'SuperSecretPassword123!',
        paystackSecretKey: 'sk_live_1234567890abcdef',
        sessionToken: 'jwt.token.abc.xyz',
        totpCode: '123456',
        cvv: '999',
        cardNumber: '4111111111111111',
        nested: {
          invitationToken: 'secret-invite-link-123',
          normalField: 'safeValue',
        },
      };

      const sanitized = auditService.sanitizeMetadata(dirtyPayload);

      assert.strictEqual(sanitized.organizationName, 'Alpha Retail');
      assert.strictEqual(sanitized.adminPassword, '[REDACTED]');
      assert.strictEqual(sanitized.paystackSecretKey, '[REDACTED]');
      assert.strictEqual(sanitized.sessionToken, '[REDACTED]');
      assert.strictEqual(sanitized.totpCode, '[REDACTED]');
      assert.strictEqual(sanitized.cvv, '[REDACTED]');
      assert.strictEqual(sanitized.cardNumber, '[REDACTED]');
      assert.strictEqual(sanitized.nested.invitationToken, '[REDACTED]');
      assert.strictEqual(sanitized.nested.normalField, 'safeValue');
    });

    it('Audit logs are append-only and retrieve organization-scoped trail', async () => {
      const result = await auditService.getOrganizationAuditLogs('org_alpha', {
        page: 1,
        limit: 10,
      });

      assert.ok(result.pagination, 'Pagination metadata must be returned');
      assert.strictEqual(typeof result.pagination.total, 'number');
      assert.strictEqual(result.pagination.page, 1);
    });
  });

  describe('2. Notification Event Matrix & Deduplication', () => {
    it('Creates notification for branch.created and routes to recipient', async () => {
      const notifs = await notificationService.createFromEvent({
        eventType: 'branch.created',
        actorUserId: 'user_owner_a',
        organizationId: 'org_alpha',
        branchId: 'branch_lekki',
        metadata: { name: 'Lekki Flagship' },
      });

      assert.strictEqual(notifs.length, 1);
      assert.strictEqual(notifs[0].category, 'inventory');
      assert.strictEqual(notifs[0].recipientUserId, 'user_owner_a');
      assert.ok(notifs[0].dedupeKey.includes('branch.created'));
    });

    it('Duplicate events with the same dedupeKey do not create duplicate notifications', async () => {
      const fixedEvent: EventContext = {
        eventId: 'fixed-event-id-12345',
        eventType: 'billing.trial_started',
        actorUserId: 'user_owner_a',
        organizationId: 'org_alpha',
      };

      const firstPass = await notificationService.createFromEvent(fixedEvent);
      assert.strictEqual(firstPass.length, 1, 'First pass must create 1 notification');

      const secondPass = await notificationService.createFromEvent(fixedEvent);
      assert.strictEqual(secondPass.length, 0, 'Duplicate delivery pass must be deduplicated (0 created)');
    });

    it('Notification read state and unread count update accurately', async () => {
      currentAuthUser = mockUsers.user_owner_a;

      const unreadRes = await app.inject({
        method: 'GET',
        url: '/api/v1/notifications/unread-count',
      });
      assert.strictEqual(unreadRes.statusCode, 200);

      const readAllRes = await app.inject({
        method: 'POST',
        url: '/api/v1/notifications/read-all',
      });
      assert.strictEqual(readAllRes.statusCode, 200);
      const readAllJson = readAllRes.json();
      assert.strictEqual(readAllJson.success, true);
    });

    it('Notification preferences endpoint maintains security alerts always enabled', async () => {
      currentAuthUser = mockUsers.user_owner_a;

      const prefRes = await app.inject({
        method: 'PATCH',
        url: '/api/v1/notifications/preferences',
        payload: {
          emailNotifications: false,
          securityAlertsAlwaysOn: false, // Attempt to disable security alerts
        },
      });

      assert.strictEqual(prefRes.statusCode, 200);
      const json = prefRes.json();
      assert.strictEqual(json.data.securityAlertsAlwaysOn, true, 'Security alerts must remain non-overridably enabled');
    });
  });

  describe('3. Tenant-Scoped Audit Isolation', () => {
    it('User from Org A cannot read Org B audit logs (403 Forbidden)', async () => {
      currentAuthUser = mockUsers.user_owner_a;

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/workspaces/org_beta/audit',
      });

      assert.strictEqual(res.statusCode, 403);
    });

    it('User from Org A can read Org A audit logs (200 OK)', async () => {
      currentAuthUser = mockUsers.user_owner_a;

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/workspaces/org_alpha/audit',
      });

      assert.strictEqual(res.statusCode, 200);
      const json = res.json();
      assert.strictEqual(json.success, true);
      assert.ok(Array.isArray(json.data.logs));
    });
  });
});
