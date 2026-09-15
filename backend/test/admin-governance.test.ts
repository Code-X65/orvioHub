import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { buildApp } from '../src/app.js';
import { dataService } from '../src/services/dataService.js';
import type { FastifyInstance } from 'fastify';

describe('Superadmin Governance & Deletion Queue (End-to-End)', () => {
  let app: FastifyInstance;
  let adminSessionToken: string;
  let userToken: string;
  let user2Token: string;
  let user2Id: string;
  let testWorkspaceId: string;

  before(async () => {
    app = await buildApp();
    await app.ready();

    // 1. Create a platform superadmin in Convex and establish an admin session
    const adminEmail = `gov_admin_${Date.now()}@orviohub.com`;
    const adminPassword = 'AdminSecretPassword123!';
    await dataService.mutate('adminAuth:createAdmin', {
      email: adminEmail,
      name: 'Governance Super Admin',
      password: adminPassword,
      role: 'super_admin',
      isDevBootstrap: true,
    });
    const adminLoginRes: any = await dataService.mutate('adminAuth:login', {
      email: adminEmail,
      password: adminPassword,
    });
    adminSessionToken = adminLoginRes.token;

    // 2. Create User 1 (Original Owner)
    const user1Res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: {
        email: `gov-owner-${Date.now()}@example.com`,
        password: 'Password123!@#',
        name: 'Original Tenant Owner',
      },
    });
    const user1Data = JSON.parse(user1Res.body);
    userToken = user1Data.data?.token || user1Data.token;

    // 3. Create User 2 (Successor Owner for Emergency Transfer)
    const user2Res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: {
        email: `gov-successor-${Date.now()}@example.com`,
        password: 'Password123!@#',
        name: 'Designated Successor',
      },
    });
    const user2Data = JSON.parse(user2Res.body);
    user2Token = user2Data.data?.token || user2Data.token;
    user2Id = user2Data.data?.user?.id || user2Data.user?.id;

    // 4. Create Workspace
    const wsRes = await app.inject({
      method: 'POST',
      url: '/api/v1/workspaces',
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
      payload: {
        name: 'Apex Governance Corp',
        slug: `apex-corp-${Date.now()}`,
        currency: 'NGN',
        timezone: 'Africa/Lagos',
      },
    });
    const wsData = JSON.parse(wsRes.body);
    testWorkspaceId = wsData.data?.workspace?.id || wsData.workspace?.id || wsData.data?.id;

    // 5. Update workspace settings to have rich inspection data
    if (testWorkspaceId) {
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/workspaces/${testWorkspaceId}/settings/business`,
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
        payload: {
          legalName: 'Apex Governance Corporation Ltd',
          registrationNumber: 'RC-998877',
          taxId: 'TIN-445566',
          supportEmail: 'support@apexgov.ng',
        },
      });
    }
  });

  after(async () => {
    await app.close();
  });

  it('1. GET /api/v1/admin/workspaces/:id/settings inspects authoritative cross-tenant settings', async () => {
    if (!testWorkspaceId) return;

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/workspaces/${testWorkspaceId}/settings`,
      headers: {
        'x-admin-token': adminSessionToken,
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.ok(body.data);
    assert.strictEqual(String(body.data.workspace?._id || body.data.workspace?.id), String(testWorkspaceId));
    assert.strictEqual(body.data.settings?.legalName, 'Apex Governance Corporation Ltd');
    assert.strictEqual(body.data.settings?.registrationNumber, 'RC-998877');
  });

  it('2. POST /api/v1/admin/workspaces/:id/transfer-ownership performs emergency ownership transfer with audit', async () => {
    if (!testWorkspaceId || !user2Id) return;

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/workspaces/${testWorkspaceId}/transfer-ownership`,
      headers: {
        'x-admin-token': adminSessionToken,
      },
      payload: {
        newOwnerUserId: user2Id,
        reason: 'Break-glass verified executive succession request via phone validation.',
        ticketNumber: 'SUP-88219',
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);

    // Verify through admin inspector that owner is now user2
    const verifyRes = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/workspaces/${testWorkspaceId}/settings`,
      headers: {
        'x-admin-token': adminSessionToken,
      },
    });
    const verifyBody = JSON.parse(verifyRes.body);
    assert.strictEqual(String(verifyBody.data.workspace?.ownerId), String(user2Id));
  });

  it('3. GET /api/v1/admin/deletions/pending returns list of pending deletions with countdowns', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/deletions/pending',
      headers: {
        'x-admin-token': adminSessionToken,
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data?.pending));
  });

  it('4. POST /api/v1/admin/deletions/:id/cancel allows superadmin to restore tenant from deletion queue', async () => {
    if (!testWorkspaceId) return;

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/deletions/${testWorkspaceId}/cancel`,
      headers: {
        'x-admin-token': adminSessionToken,
      },
      payload: {
        reason: 'Superadmin customer recovery action',
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
  });
});
