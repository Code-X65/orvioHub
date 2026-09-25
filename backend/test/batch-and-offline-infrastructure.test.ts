import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';

// Import frontend normalized cache and offline queue directly
import { normalizedCache } from '../../frontend/src/lib/normalizedCache.js';
import { offlineQueue } from '../../frontend/src/lib/offlineQueue.js';

describe('Operational Improvements 2.5 - 2.6 (Batch API, Normalized Cache, Offline Queue)', () => {
  let app: FastifyInstance;

  before(async () => {
    app = await buildApp();
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  describe('2.5 Request Batching API (/api/v1/batch)', () => {
    it('executes multiple sub-requests in a single HTTP round-trip', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/batch',
        headers: { 'content-type': 'application/json' },
        payload: {
          requests: [
            { id: 'req_ready', method: 'GET', path: '/ready' },
            { id: 'req_version', method: 'GET', path: '/version' },
            { id: 'req_health', method: 'GET', path: '/health' },
          ],
        },
      });

      assert.strictEqual(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.strictEqual(data.success, true);
      assert.strictEqual(Array.isArray(data.responses), true);
      assert.strictEqual(data.responses.length, 3);

      const readyRes = data.responses.find((r: any) => r.id === 'req_ready');
      assert.strictEqual(readyRes?.status, 200);
      assert.strictEqual(readyRes?.data?.status, 'ready');

      const versionRes = data.responses.find((r: any) => r.id === 'req_version');
      assert.strictEqual(versionRes?.status, 200);
      assert.strictEqual(versionRes?.data?.version, '1.0.0');
    });

    it('propagates authentication headers to subrequests', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/batch',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer invalid_test_token',
        },
        payload: {
          requests: [
            { id: 'req_workspaces', method: 'GET', path: '/api/v1/workspaces' },
          ],
        },
      });

      assert.strictEqual(res.statusCode, 200);
      const data = JSON.parse(res.body);
      const wsRes = data.responses.find((r: any) => r.id === 'req_workspaces');
      // Sub-request should return 401 Unauthorized because the token is invalid
      assert.strictEqual(wsRes?.status, 401);
    });

    it('rejects recursive nested batch calls', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/batch',
        headers: { 'content-type': 'application/json' },
        payload: {
          requests: [
            { id: 'nested_batch', method: 'POST', path: '/api/v1/batch' },
          ],
        },
      });

      assert.strictEqual(res.statusCode, 200);
      const data = JSON.parse(res.body);
      const nestedRes = data.responses.find((r: any) => r.id === 'nested_batch');
      assert.strictEqual(nestedRes?.status, 400);
      assert.strictEqual(nestedRes?.data?.error?.code, 'RECURSIVE_BATCH_NOT_ALLOWED');
    });

    it('rejects batch requests exceeding maximum size (20 items)', async () => {
      const oversized = Array.from({ length: 25 }, (_, i) => ({
        id: `req_${i}`,
        method: 'GET',
        path: '/ready',
      }));

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/batch',
        headers: { 'content-type': 'application/json' },
        payload: { requests: oversized },
      });

      assert.strictEqual(res.statusCode, 400);
      const data = JSON.parse(res.body);
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error.code, 'INVALID_BATCH_REQUEST');
    });
  });

  describe('2.5 Normalized Entity Cache', () => {
    it('normalizes nested workspaces, organizations, and branches from API payloads', () => {
      normalizedCache.clear();

      const apiPayload = {
        workspaces: [
          { id: 'ws_101', name: 'Alpha Retail', slug: 'alpha' },
          { id: 'ws_102', name: 'Beta Groceries', slug: 'beta' },
        ],
        organization: { id: 'org_501', name: 'Alpha Holding', country: 'Nigeria' },
        branches: [
          { id: 'br_901', name: 'Lagos Main Branch', isPrimary: true },
          { id: 'br_902', name: 'Abuja Branch', isPrimary: false },
        ],
      };

      normalizedCache.normalize(apiPayload);

      const ws1 = normalizedCache.getEntity('workspaces', 'ws_101');
      assert.strictEqual(ws1?.name, 'Alpha Retail');

      const org = normalizedCache.getEntity('organizations', 'org_501');
      assert.strictEqual(org?.name, 'Alpha Holding');

      const branches = normalizedCache.getAll('branches');
      assert.strictEqual(branches.length, 2);
    });

    it('notifies subscribers when entities update', () => {
      normalizedCache.clear();
      let notifiedEntity: any = null;

      const unsub = normalizedCache.subscribe('workspaces', 'ws_sub', (e) => {
        notifiedEntity = e;
      });

      normalizedCache.setEntity('workspaces', 'ws_sub', { id: 'ws_sub', name: 'Subscribed Workspace' });
      assert.strictEqual(notifiedEntity?.name, 'Subscribed Workspace');

      normalizedCache.setEntity('workspaces', 'ws_sub', { name: 'Renamed Workspace' });
      assert.strictEqual(notifiedEntity?.name, 'Renamed Workspace');

      unsub();
      normalizedCache.setEntity('workspaces', 'ws_sub', { name: 'No Notification' });
      assert.strictEqual(notifiedEntity?.name, 'Renamed Workspace');
    });
  });

  describe('2.6 Offline Mutation Queue & Replay', () => {
    it('enqueues mutations with idempotency keys and tracks pending count', () => {
      offlineQueue.clear();

      const m1 = offlineQueue.enqueue('/api/v1/branches', 'POST', { name: 'New Branch' });
      const m2 = offlineQueue.enqueue('/api/v1/products', 'POST', { name: 'Product A' });

      assert.strictEqual(offlineQueue.getCount(), 2);
      assert.ok(m1.idempotencyKey);
      assert.ok(m2.idempotencyKey);
      assert.strictEqual(m1.method, 'POST');
    });

    it('flushes and replays mutations in order via executor', async () => {
      offlineQueue.clear();
      offlineQueue.enqueue('/api/v1/workspaces/ws_1/settings', 'PATCH', { currency: 'NGN' });
      offlineQueue.enqueue('/api/v1/inventory/items', 'POST', { sku: 'SKU123' });

      const executed: string[] = [];
      const result = await offlineQueue.flush(async (item) => {
        executed.push(item.endpoint);
        return { success: true, status: 200 };
      });

      assert.strictEqual(result.processed, 2);
      assert.strictEqual(result.succeeded, 2);
      assert.strictEqual(offlineQueue.getCount(), 0);
      assert.deepStrictEqual(executed, [
        '/api/v1/workspaces/ws_1/settings',
        '/api/v1/inventory/items',
      ]);
    });
  });
});
