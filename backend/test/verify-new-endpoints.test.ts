import assert from 'node:assert';
import { test } from 'node:test';
import { buildApp } from '../src/app.js';

test('Verify newly added Pre-Inventory checklist endpoints', async (t) => {
  const app = await buildApp();

  await t.test('POST /api/v1/auth/send-otp validation works', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/send-otp',
      payload: {},
    });
    assert.strictEqual(res.statusCode, 400);
    const body = JSON.parse(res.payload);
    assert.ok(body.message?.includes('email') || body.error?.message?.includes('email'));
  });

  await t.test('GET /api/v1/entitlements/can-invite-member requires authentication', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/entitlements/can-invite-member?workspaceId=ws_test',
    });
    assert.strictEqual(res.statusCode, 401);
  });

  await app.close();
});
