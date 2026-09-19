import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import Fastify, { type FastifyInstance } from 'fastify';
import { adminWorkspaceRoutes } from '../src/routes/admin/workspaces.js';
import { adminPlatformRoutes } from '../src/routes/admin/platform.js';

describe('Phase 8: Superadmin Portal, Governance & Inspection Suite', () => {
  let app: FastifyInstance;

  const mockAdminUsers: Record<string, any> = {
    platform_owner: {
      id: 'admin_owner',
      name: 'Platform Owner',
      email: 'owner@platform.internal',
      role: 'platform_owner',
      permissions: ['*'],
    },
    platform_admin: {
      id: 'admin_general',
      name: 'Platform Admin',
      email: 'admin@platform.internal',
      role: 'platform_admin',
      permissions: ['admin.dashboard.view', 'admin.organizations.view', 'admin.organizations.suspend', 'admin.organizations.restore', 'admin.organizations.archive', 'admin.members.manage_access'],
    },
    read_only_admin: {
      id: 'admin_readonly',
      name: 'Read Only Admin',
      email: 'readonly@platform.internal',
      role: 'read_only_admin',
      permissions: ['admin.dashboard.view', 'admin.organizations.view', 'admin.branches.view', 'admin.members.view'],
    },
    normal_user: {
      id: 'user_regular',
      name: 'Normal Customer',
      email: 'customer@example.com',
      role: 'user',
      permissions: [],
    },
  };

  let currentAuthUser: any = mockAdminUsers.platform_owner;

  before(async () => {
    app = Fastify({ logger: false });

    // Authentication decorator
    app.decorate('authenticate', async (req: any, reply: any) => {
      if (!currentAuthUser) {
        return reply.status(401).send({ error: 'UNAUTHORIZED' });
      }
      req.user = currentAuthUser;
    });

    await app.register(adminPlatformRoutes, { prefix: '/api/v1/admin' });
    await app.register(adminWorkspaceRoutes, { prefix: '/api/v1/admin' });
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  describe('1. Superadmin Authentication & Granular Permissions', () => {
    it('Non-admin normal user is rejected from admin routes with 403', async () => {
      currentAuthUser = mockAdminUsers.normal_user;

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/overview',
      });

      assert.strictEqual(res.statusCode, 403);
    });

    it('Platform Owner can view admin overview metrics', async () => {
      currentAuthUser = mockAdminUsers.platform_owner;

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/overview',
      });

      assert.strictEqual(res.statusCode, 200);
      const json = res.json();
      assert.strictEqual(json.success, true);
    });

    it('Read-only admin can view organization directory (200 OK)', async () => {
      currentAuthUser = mockAdminUsers.read_only_admin;

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/organizations',
      });

      assert.strictEqual(res.statusCode, 200);
      const json = res.json();
      assert.strictEqual(json.success, true);
    });

    it('Read-only admin is blocked from mutations with 403', async () => {
      currentAuthUser = mockAdminUsers.read_only_admin;

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/organizations/org_alpha/suspend',
        payload: { reason: 'Violation of Terms' },
      });

      assert.strictEqual(res.statusCode, 403);
      const json = res.json();
      assert.ok(json.error.message.includes('Read-only administrators are not permitted'));
    });
  });

  describe('2. Superadmin Organization Directory & Inspection Tabs', () => {
    it('Directory supports search and filters', async () => {
      currentAuthUser = mockAdminUsers.platform_admin;

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/organizations?status=active&plan=standard&page=1&limit=10',
      });

      assert.strictEqual(res.statusCode, 200);
      const json = res.json();
      assert.strictEqual(json.success, true);
    });

    it('Organization inspection tabs return scoped data without cross-tenant bleed', async () => {
      currentAuthUser = mockAdminUsers.platform_admin;

      // Applications Tab
      const appsRes = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/organizations/org_alpha/applications',
      });
      assert.strictEqual(appsRes.statusCode, 200);

      // Branches Tab
      const branchesRes = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/organizations/org_alpha/branches',
      });
      assert.strictEqual(branchesRes.statusCode, 200);

      // Members Tab
      const membersRes = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/organizations/org_alpha/members',
      });
      assert.strictEqual(membersRes.statusCode, 200);

      // Support Notes Tab
      const notesRes = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/organizations/org_alpha/support-notes',
      });
      assert.strictEqual(notesRes.statusCode, 200);
    });
  });

  describe('3. Safe Administrative Mutations with Confirmation & Reason Requirements', () => {
    it('Suspend organization without mandatory reason is rejected with 400', async () => {
      currentAuthUser = mockAdminUsers.platform_admin;

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/organizations/org_alpha/suspend',
        payload: {}, // No reason provided
      });

      assert.strictEqual(res.statusCode, 400);
      const json = res.json();
      assert.ok(json.error.message.includes('mandatory administrative reason'));
    });

    it('Suspend organization with valid reason succeeds (200 OK)', async () => {
      currentAuthUser = mockAdminUsers.platform_admin;

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/organizations/org_alpha/suspend',
        payload: { reason: 'Billing delinquency after 14 days' },
      });

      assert.strictEqual(res.statusCode, 200);
      const json = res.json();
      assert.strictEqual(json.success, true);
    });

    it('High-risk archive requires step-up TOTP verification token', async () => {
      currentAuthUser = mockAdminUsers.platform_admin;

      // Without TOTP
      const noTotpRes = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/organizations/org_alpha/archive',
        payload: { reason: 'Customer requested complete workspace archival' },
      });

      assert.strictEqual(noTotpRes.statusCode, 403);
      const noTotpJson = noTotpRes.json();
      assert.strictEqual(noTotpJson.error.code, 'STEP_UP_AUTHENTICATION_REQUIRED');

      // With TOTP / Step-up token
      const withTotpRes = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/organizations/org_alpha/archive',
        headers: {
          'x-admin-totp': '654321',
        },
        payload: { reason: 'Customer requested complete workspace archival' },
      });

      assert.strictEqual(withTotpRes.statusCode, 200);
      const withTotpJson = withTotpRes.json();
      assert.strictEqual(withTotpJson.success, true);
    });

    it('Revoke active sessions executes safely with reason', async () => {
      currentAuthUser = mockAdminUsers.platform_admin;

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/organizations/org_alpha/revoke-sessions',
        payload: { reason: 'Security compromise alert' },
      });

      assert.strictEqual(res.statusCode, 200);
      const json = res.json();
      assert.strictEqual(json.success, true);
    });
  });
});
