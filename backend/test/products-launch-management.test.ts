import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';
import { env } from '../src/config/env.js';
import { dataService } from '../src/services/dataService.js';

describe('Product Launch Management & Single Admin Security Suite', () => {
  let app: FastifyInstance;
  const originalGetUserById = dataService.getUserById;

  before(async () => {
    app = await buildApp();
    await app.ready();

    dataService.getUserById = async (id: string) => {
      return {
        id,
        email: id === 'super_admin_owner_1' ? 'owner@orviohub.com' : 'regular@example.com',
        name: id === 'super_admin_owner_1' ? 'Super Admin' : 'Regular User',
        emailVerified: true,
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as any;
    };
  });

  after(async () => {
    dataService.getUserById = originalGetUserById;
    await app.close();
  });

  test('AC-1 & AC-4: GET /api/v1/products lists visible products (omits drafts)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/products',
    });

    assert.strictEqual(res.statusCode, 200);
    const body = res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data.products));

    // Ensure no draft products are returned to public catalog
    for (const p of body.data.products) {
      const s = (p.status || '').toLowerCase();
      assert.notStrictEqual(s, 'draft', 'Draft products should never be returned to public API');
    }
  });

  test('AC-5: POST /api/v1/products/:productKey/notify handles waitlist and prevents duplicates', async () => {
    const testEmail = `waitlist_${Date.now()}@example.com`;
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/products/crm/notify',
      payload: { email: testEmail },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.alreadySubscribed, false);

    // Duplicate join returns alreadySubscribed: true
    const duplicateRes = await app.inject({
      method: 'POST',
      url: '/api/v1/products/crm/notify',
      payload: { email: testEmail },
    });

    assert.strictEqual(duplicateRes.statusCode, 200);
    const duplicateBody = duplicateRes.json();
    assert.strictEqual(duplicateBody.data.alreadySubscribed, true);
  });

  test('AC-8: Single Admin Security: Unauthenticated request to /api/v1/admin/products is rejected with 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/products',
    });

    assert.strictEqual(res.statusCode, 401);
  });

  test('AC-8: Single Admin Security: Non-admin user gets 403 when ADMIN_USER_ID is configured', async () => {
    const originalAdminId = env.ADMIN_USER_ID;
    try {
      (env as any).ADMIN_USER_ID = 'super_admin_owner_1';
      const nonAdminToken = app.jwt.sign({ userId: 'regular_user_99', email: 'regular@example.com' });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/products',
        headers: {
          authorization: `Bearer ${nonAdminToken}`,
        },
      });

      assert.strictEqual(res.statusCode, 403);
    } finally {
      (env as any).ADMIN_USER_ID = originalAdminId;
    }
  });

  test('AC-2, AC-3 & AC-7: Single Admin can list, create, update, and archive products', async () => {
    const originalAdminId = env.ADMIN_USER_ID;
    try {
      const adminUserId = 'super_admin_owner_1';
      (env as any).ADMIN_USER_ID = adminUserId;
      const adminToken = app.jwt.sign({ userId: adminUserId, email: 'owner@orviohub.com' });

      // 1. List all products (including drafts)
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/products',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(listRes.statusCode, 200);

      // 2. Create a new draft product
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/products',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'AI Analytics Copilot',
          description: 'Automated sales insights and natural language reporting.',
          status: 'draft',
          displayOrder: 10,
          isBeta: true,
          isFeatured: false,
        },
      });
      assert.strictEqual(createRes.statusCode, 201);
      const createdKey = createRes.json().data.product.key;

      // 3. Update product status to coming_soon
      const patchRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/products/${createdKey}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          status: 'coming_soon',
          isFeatured: true,
        },
      });
      assert.strictEqual(patchRes.statusCode, 200);

      // 4. Archive product back to draft
      const archiveRes = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/products/${createdKey}/archive`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(archiveRes.statusCode, 200);

      // 5. Hard delete draft product
      const deleteRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/admin/products/${createdKey}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(deleteRes.statusCode, 200);
    } finally {
      (env as any).ADMIN_USER_ID = originalAdminId;
    }
  });

  test('AC-6: Product activation endpoint requires authentication', async () => {
    const unauthRes = await app.inject({
      method: 'POST',
      url: '/api/v1/workspaces/ws_123/products/crm/activate',
      payload: {},
    });

    assert.strictEqual(unauthRes.statusCode, 401);
  });
});
