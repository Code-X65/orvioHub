import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import Fastify, { type FastifyInstance } from 'fastify';
import { authorizationPlugin } from '../src/plugins/authorization.js';
import { authPlugin } from '../src/plugins/auth.js';
import { dataService } from '../src/services/dataService.js';

describe('Phase 4: Canonical Tenant Identity & Request Context Suite', () => {
  let app: FastifyInstance;
  const origGetUser = dataService.getUserById;

  before(async () => {
    app = Fastify();

    // Mock dataService.getUserById for fast offline unit execution
    (dataService as any).getUserById = async (id: string) => ({
      _id: id,
      id,
      email: `${id}@test.com`,
      status: 'ACTIVE',
    });

    await app.register(authPlugin);
    await app.register(authorizationPlugin);

    // Test route using resolveTenantContext
    app.get(
      '/api/v1/workspaces/:workspaceId/tenant-test',
      {
        preHandler: [app.authenticate, app.resolveTenantContext],
      },
      async (request: any, reply) => {
        return reply.send({
          success: true,
          tenantContext: request.tenantContext,
          workspace: request.workspace,
          workspaceMembership: request.workspaceMembership,
        });
      }
    );

    await app.ready();
  });

  after(async () => {
    dataService.getUserById = origGetUser;
    await app.close();
  });

  describe('1. Header vs URL Parameter Mismatch Rejection', () => {
    test('Reject request when x-workspace-id header conflicts with URL workspaceId', async () => {
      const user = { id: 'test_user_p4_1', email: 'user1@test.com', status: 'ACTIVE' };
      const token = app.jwt.sign({ userId: user.id, email: user.email, status: user.status });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/workspaces/ws_route_id_123/tenant-test',
        headers: {
          authorization: `Bearer ${token}`,
          'x-workspace-id': 'ws_header_conflicting_id_456',
        },
      });

      assert.equal(res.statusCode, 400);
      const body = JSON.parse(res.body);
      assert.equal(body.error?.code, 'TENANT_ID_MISMATCH');
    });

    test('Reject request when x-organization-id header conflicts with workspace organization', async () => {
      const user = { id: 'test_user_p4_2', email: 'user2@test.com', status: 'ACTIVE' };
      const token = app.jwt.sign({ userId: user.id, email: user.email, status: user.status });

      // Mock dataService getWorkspaceById
      const origGetWs = dataService.getWorkspaceById;
      (dataService as any).getWorkspaceById = async (id: string) => ({
        _id: id,
        id,
        name: 'Test Org Workspace',
        organizationId: 'org_real_owner_999',
        status: 'active',
      });

      try {
        const res = await app.inject({
          method: 'GET',
          url: '/api/v1/workspaces/ws_valid_123/tenant-test',
          headers: {
            authorization: `Bearer ${token}`,
            'x-organization-id': 'org_forged_cross_tenant_777',
          },
        });

        assert.equal(res.statusCode, 400);
        const body = JSON.parse(res.body);
        assert.equal(body.error?.code, 'TENANT_ID_MISMATCH');
      } finally {
        dataService.getWorkspaceById = origGetWs;
      }
    });
  });

  describe('2. Tenant Lifecycle Status Guards', () => {
    test('Reject access to deleted or archived workspace with 403', async () => {
      const user = { id: 'test_user_p4_3', email: 'user3@test.com', status: 'ACTIVE' };
      const token = app.jwt.sign({ userId: user.id, email: user.email, status: user.status });

      const origGetWs = dataService.getWorkspaceById;
      (dataService as any).getWorkspaceById = async (id: string) => ({
        _id: id,
        id,
        name: 'Archived Workspace',
        organizationId: 'org_archived_111',
        status: 'archived',
      });

      try {
        const res = await app.inject({
          method: 'GET',
          url: '/api/v1/workspaces/ws_archived/tenant-test',
          headers: {
            authorization: `Bearer ${token}`,
          },
        });

        assert.equal(res.statusCode, 403);
        const body = JSON.parse(res.body);
        assert.equal(body.error?.code, 'WORKSPACE_ACCESS_DENIED');
      } finally {
        dataService.getWorkspaceById = origGetWs;
      }
    });
  });

  describe('3. Canonical TenantContext Structure Resolution', () => {
    test('Successfully populates unified TenantContext for authorized user', async () => {
      const user = { id: 'test_user_p4_4', email: 'user4@test.com', status: 'ACTIVE' };
      const token = app.jwt.sign({ userId: user.id, email: user.email, status: user.status });

      const origGetWs = dataService.getWorkspaceById;
      const origGetMem = dataService.getWorkspaceMembership;

      (dataService as any).getWorkspaceById = async (id: string) => ({
        _id: id,
        id,
        name: 'Main Business Org',
        organizationId: 'org_main_555',
        status: 'active',
      });

      (dataService as any).getWorkspaceMembership = async (wsId: string, userId: string) => ({
        _id: 'mem_123',
        id: 'mem_123',
        workspaceId: wsId,
        userId,
        role: 'owner',
        status: 'active',
      });

      try {
        const res = await app.inject({
          method: 'GET',
          url: '/api/v1/workspaces/ws_main/tenant-test',
          headers: {
            authorization: `Bearer ${token}`,
            'x-organization-id': 'org_main_555',
          },
        });

        assert.equal(res.statusCode, 200);
        const body = JSON.parse(res.body);
        assert.equal(body.success, true);
        assert.ok(body.tenantContext);
        assert.equal(body.tenantContext.organizationId, 'org_main_555');
        assert.equal(body.tenantContext.workspaceId, 'ws_main');
        assert.equal(body.tenantContext.userId, user.id);
        assert.equal(body.tenantContext.organizationRole, 'owner');
        assert.equal(body.tenantContext.productKey, 'inventory');
        assert.ok(Array.isArray(body.tenantContext.permissions));
      } finally {
        dataService.getWorkspaceById = origGetWs;
        dataService.getWorkspaceMembership = origGetMem;
      }
    });
  });
});
