import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { dataService } from '../src/services/dataService.js';
import { ERROR_CODES } from '../src/config/constants.js';

describe('Audit Log Viewer & Invitation Resend/Cancel Test Suite', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  const originalGetUserById = dataService.getUserById;
  const originalGetOrganizationAuditLogs = dataService.getOrganizationAuditLogs;
  const originalResendInvitation = dataService.resendInvitation;
  const originalCancelInvitation = dataService.cancelInvitation;
  const originalAcceptInvitation = dataService.acceptInvitation;

  beforeEach(async () => {
    app = await buildApp();
  });

  afterEach(() => {
    dataService.getUserById = originalGetUserById;
    dataService.getOrganizationAuditLogs = originalGetOrganizationAuditLogs;
    dataService.resendInvitation = originalResendInvitation;
    dataService.cancelInvitation = originalCancelInvitation;
    dataService.acceptInvitation = originalAcceptInvitation;
  });

  describe('1. Audit Log Viewer (GET /api/v1/organizations/:id/audit-log)', () => {
    test('GET /api/v1/organizations/:id/audit-log returns paginated logs for authenticated admin', async () => {
      dataService.getUserById = async (id: string) => ({
        id,
        email: 'admin@acme.com',
        name: 'Admin User',
        emailVerified: true,
        tokenVersion: 0,
        status: 'ACTIVE',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      dataService.getOrganizationAuditLogs = async (orgId, userId, query) => {
        assert.equal(orgId, 'org_123');
        assert.equal(userId, 'user_admin');
        assert.equal(query.page, 1);
        assert.equal(query.limit, 20);

        return {
          logs: [
            {
              id: 'audit_1',
              actorId: 'user_admin',
              actor: {
                id: 'user_admin',
                name: 'Admin User',
                email: 'admin@acme.com',
              },
              organizationId: 'org_123',
              action: 'invitation.created',
              resource: 'invitation:inv_1',
              metadata: { email: 'dev@acme.com', role: 'MEMBER' },
              timestamp: 1787300000000,
            },
            {
              id: 'audit_2',
              actorId: 'user_admin',
              actor: {
                id: 'user_admin',
                name: 'Admin User',
                email: 'admin@acme.com',
              },
              organizationId: 'org_123',
              action: 'organization.updated',
              resource: 'organization:org_123',
              metadata: { timezone: 'America/New_York' },
              timestamp: 1787290000000,
            },
          ],
          pagination: {
            total: 2,
            page: 1,
            limit: 20,
            totalPages: 1,
          },
        };
      };

      const token = app.jwt.sign({ userId: 'user_admin', email: 'admin@acme.com' });
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/organizations/org_123/audit-log?page=1&limit=20',
        headers: { authorization: `Bearer ${token}` },
      });

      assert.equal(response.statusCode, 200);
      const body = JSON.parse(response.body);
      assert.equal(body.success, true);
      assert.equal(body.data.logs.length, 2);
      assert.equal(body.data.logs[0].action, 'invitation.created');
      assert.equal(body.data.pagination.total, 2);
    });

    test('GET /api/v1/organizations/:id/audit-log filters by action parameter', async () => {
      dataService.getUserById = async (id: string) => ({
        id,
        email: 'admin@acme.com',
        name: 'Admin User',
        emailVerified: true,
        tokenVersion: 0,
        status: 'ACTIVE',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      dataService.getOrganizationAuditLogs = async (orgId, userId, query) => {
        assert.equal(query.action, 'invitation');
        return {
          logs: [
            {
              id: 'audit_1',
              actorId: 'user_admin',
              actor: { id: 'user_admin', name: 'Admin', email: 'admin@acme.com' },
              organizationId: 'org_123',
              action: 'invitation.created',
              resource: 'invitation:inv_1',
              metadata: {},
              timestamp: 1787300000000,
            },
          ],
          pagination: { total: 1, page: 1, limit: 10, totalPages: 1 },
        };
      };

      const token = app.jwt.sign({ userId: 'user_admin', email: 'admin@acme.com' });
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/organizations/org_123/audit-log?action=invitation&limit=10',
        headers: { authorization: `Bearer ${token}` },
      });

      assert.equal(response.statusCode, 200);
      const body = JSON.parse(response.body);
      assert.equal(body.data.logs.length, 1);
      assert.equal(body.data.logs[0].action, 'invitation.created');
    });

    test('GET /api/v1/organizations/:id/audit-log returns 403 when user lacks permissions', async () => {
      dataService.getUserById = async (id: string) => ({
        id,
        email: 'member@acme.com',
        name: 'Standard Member',
        emailVerified: true,
        tokenVersion: 0,
        status: 'ACTIVE',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      dataService.getOrganizationAuditLogs = async () => {
        const err = new Error('ORGANIZATION_ACCESS_DENIED') as any;
        err.code = 'ORGANIZATION_ACCESS_DENIED';
        throw err;
      };

      const token = app.jwt.sign({ userId: 'user_member', email: 'member@acme.com' });
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/organizations/org_123/audit-log',
        headers: { authorization: `Bearer ${token}` },
      });

      assert.equal(response.statusCode, 403);
      const body = JSON.parse(response.body);
      assert.equal(body.success, false);
      assert.equal(body.error.code, ERROR_CODES.ORGANIZATION_ACCESS_DENIED);
    });
  });

  describe('2. Invitation Resend (POST /api/v1/invitations/:id/resend)', () => {
    test('POST /api/v1/invitations/:id/resend successfully updates expiration and returns updated invitation', async () => {
      dataService.getUserById = async (id: string) => ({
        id,
        email: 'owner@acme.com',
        name: 'Owner User',
        emailVerified: true,
        tokenVersion: 0,
        status: 'ACTIVE',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      dataService.resendInvitation = async (invId, userId) => {
        assert.equal(invId, 'inv_123');
        assert.equal(userId, 'user_owner');
        return {
          id: 'inv_123',
          email: 'teammate@example.com',
          role: 'MANAGER' as const,
          status: 'PENDING' as const,
          token: 'new_fresh_token_12345',
          expiresAt: Date.now() + 7 * 86_400_000,
          organizationId: 'org_123',
          organizationName: 'Acme Corp',
          inviterName: 'Owner User',
        };
      };

      const token = app.jwt.sign({ userId: 'user_owner', email: 'owner@acme.com' });
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/invitations/inv_123/resend',
        headers: { authorization: `Bearer ${token}` },
      });

      assert.equal(response.statusCode, 200);
      const body = JSON.parse(response.body);
      assert.equal(body.success, true);
      assert.equal(body.data.invitation.id, 'inv_123');
      assert.equal(body.data.invitation.status, 'PENDING');
      assert.match(body.message, /Invitation resent to teammate@example\.com/);
    });

    test('POST /api/v1/invitations/:id/resend returns 404 for unknown invitation', async () => {
      dataService.getUserById = async (id: string) => ({
        id,
        email: 'owner@acme.com',
        name: 'Owner',
        emailVerified: true,
        tokenVersion: 0,
        status: 'ACTIVE',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      dataService.resendInvitation = async () => {
        const err = new Error('INVITATION_NOT_FOUND') as any;
        err.code = 'INVITATION_NOT_FOUND';
        throw err;
      };

      const token = app.jwt.sign({ userId: 'user_owner', email: 'owner@acme.com' });
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/invitations/inv_missing/resend',
        headers: { authorization: `Bearer ${token}` },
      });

      assert.equal(response.statusCode, 404);
      const body = JSON.parse(response.body);
      assert.equal(body.success, false);
      assert.equal(body.error.code, ERROR_CODES.INVITATION_NOT_FOUND);
    });

    test('POST /api/v1/invitations/:id/resend returns 409 for already accepted invitation', async () => {
      dataService.getUserById = async (id: string) => ({
        id,
        email: 'owner@acme.com',
        name: 'Owner',
        emailVerified: true,
        tokenVersion: 0,
        status: 'ACTIVE',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      dataService.resendInvitation = async () => {
        const err = new Error('INVITATION_ALREADY_ACCEPTED') as any;
        err.code = 'INVITATION_ALREADY_ACCEPTED';
        throw err;
      };

      const token = app.jwt.sign({ userId: 'user_owner', email: 'owner@acme.com' });
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/invitations/inv_accepted/resend',
        headers: { authorization: `Bearer ${token}` },
      });

      assert.equal(response.statusCode, 409);
      const body = JSON.parse(response.body);
      assert.equal(body.success, false);
      assert.equal(body.error.code, ERROR_CODES.INVITATION_ALREADY_ACCEPTED);
    });
  });

  describe('3. Invitation Cancel (DELETE /api/v1/invitations/:id)', () => {
    test('DELETE /api/v1/invitations/:id successfully cancels pending invitation', async () => {
      dataService.getUserById = async (id: string) => ({
        id,
        email: 'admin@acme.com',
        name: 'Admin User',
        emailVerified: true,
        tokenVersion: 0,
        status: 'ACTIVE',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      dataService.cancelInvitation = async (invId, userId) => {
        assert.equal(invId, 'inv_123');
        assert.equal(userId, 'user_admin');
        return { success: true };
      };

      const token = app.jwt.sign({ userId: 'user_admin', email: 'admin@acme.com' });
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/invitations/inv_123',
        headers: { authorization: `Bearer ${token}` },
      });

      assert.equal(response.statusCode, 200);
      const body = JSON.parse(response.body);
      assert.equal(body.success, true);
      assert.match(body.message, /Invitation successfully cancelled/);
    });

    test('DELETE /api/v1/invitations/:id returns 403 when caller lacks admin/owner permissions', async () => {
      dataService.getUserById = async (id: string) => ({
        id,
        email: 'member@acme.com',
        name: 'Member',
        emailVerified: true,
        tokenVersion: 0,
        status: 'ACTIVE',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      dataService.cancelInvitation = async () => {
        const err = new Error('ORGANIZATION_ACCESS_DENIED') as any;
        err.code = 'ORGANIZATION_ACCESS_DENIED';
        throw err;
      };

      const token = app.jwt.sign({ userId: 'user_member', email: 'member@acme.com' });
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/invitations/inv_123',
        headers: { authorization: `Bearer ${token}` },
      });

      assert.equal(response.statusCode, 403);
      const body = JSON.parse(response.body);
      assert.equal(body.success, false);
      assert.equal(body.error.code, ERROR_CODES.ORGANIZATION_ACCESS_DENIED);
    });

    test('POST /api/v1/invitations/:token/accept rejects cancelled invitations with 400', async () => {
      dataService.getUserById = async (id: string) => ({
        id,
        email: 'invited@acme.com',
        name: 'Invited User',
        emailVerified: true,
        tokenVersion: 0,
        status: 'ACTIVE',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      dataService.acceptInvitation = async () => {
        const err = new Error('INVITATION_CANCELLED') as any;
        err.code = 'INVITATION_CANCELLED';
        throw err;
      };

      const token = app.jwt.sign({ userId: 'user_invited', email: 'invited@acme.com' });
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/invitations/token_cancelled/accept',
        headers: { authorization: `Bearer ${token}` },
      });

      assert.equal(response.statusCode, 400);
      const body = JSON.parse(response.body);
      assert.equal(body.success, false);
      assert.match(body.error.message, /cancelled by an organization administrator/);
    });
  });
});
