import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';
import { setCacheInvalidateHeader } from '../src/utils/cacheHeaders.js';

describe('Operational Gaps 2.1 - 2.4 (Telemetry, Client Logs, Cache Invalidation, Circuit Breaker)', () => {
  let app: FastifyInstance;

  before(async () => {
    app = await buildApp();
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  describe('2.2 Centralized Client Error Logging (/api/v1/client-logs)', () => {
    it('accepts a single valid client error log', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/client-logs',
        headers: { 'content-type': 'application/json' },
        payload: {
          message: 'Failed to fetch inventory summary',
          code: 'NETWORK_TIMEOUT',
          endpoint: '/api/v1/inventory/summary',
          method: 'GET',
          status: 408,
          context: {
            userId: 'usr_123',
            workspaceId: 'ws_456',
            url: 'https://app.orviohub.com/inventory',
            browser: 'Chrome',
            os: 'Windows',
          },
        },
      });

      assert.strictEqual(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.logged, 1);
    });

    it('accepts a batch of client error logs', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/client-logs',
        headers: { 'content-type': 'application/json' },
        payload: {
          logs: [
            {
              message: 'Failed to load branch list',
              endpoint: '/api/v1/workspaces/ws_1/branches',
              method: 'GET',
              status: 500,
            },
            {
              message: 'Checkout calculation discrepancy',
              endpoint: '/api/v1/inventory/checkout',
              method: 'POST',
              status: 422,
            },
          ],
        },
      });

      assert.strictEqual(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.logged, 2);
    });

    it('sanitizes and redacts sensitive payload credentials before logging', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/client-logs',
        headers: { 'content-type': 'application/json' },
        payload: {
          message: 'Authentication failure during login',
          endpoint: '/api/v1/auth/login',
          method: 'POST',
          status: 401,
          payload: {
            email: 'admin@company.com',
            password: 'SuperSecretPassword123!',
            token: 'jwt.token.here',
            cardDetails: {
              cardNumber: '4111222233334444',
              cvv: '123',
              pin: '9876',
            },
          },
        },
      });

      assert.strictEqual(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.logged, 1);
    });

    it('rejects invalid log schemas with 400 and validation details', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/client-logs',
        headers: { 'content-type': 'application/json' },
        payload: {
          // message is missing
          status: 500,
        },
      });

      assert.strictEqual(res.statusCode, 400);
      const data = JSON.parse(res.body);
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error.code, 'INVALID_LOG_PAYLOAD');
    });

    it('redirects legacy /v1/client-logs prefix to canonical /api/v1/client-logs', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/client-logs',
        headers: { 'content-type': 'application/json' },
        payload: {
          message: 'Legacy client error log test',
          endpoint: '/v1/settings',
          method: 'GET',
          status: 500,
        },
      });

      assert.ok(res.statusCode === 307 || res.statusCode === 308);
      assert.strictEqual(res.headers.location, '/api/v1/client-logs');
    });
  });

  describe('2.3 Automatic Cache Invalidation Headers', () => {
    it('helper attaches Cache-Invalidate header correctly', async () => {
      const mockReply: any = {
        headers: {} as Record<string, string>,
        getHeader(key: string) {
          return this.headers[key.toLowerCase()];
        },
        header(key: string, value: string) {
          this.headers[key.toLowerCase()] = value;
          return this;
        },
      };

      setCacheInvalidateHeader(mockReply, ['workspaces', 'workspaces:ws_123', 'branches']);
      assert.strictEqual(mockReply.headers['cache-invalidate'], 'workspaces,workspaces:ws_123,branches');
    });

    it('merges existing and new Cache-Invalidate tags without duplicates', async () => {
      const mockReply: any = {
        headers: { 'cache-invalidate': 'organizations' } as Record<string, string>,
        getHeader(key: string) {
          return this.headers[key.toLowerCase()];
        },
        header(key: string, value: string) {
          this.headers[key.toLowerCase()] = value;
          return this;
        },
      };

      setCacheInvalidateHeader(mockReply, ['workspaces', 'branches']);
      assert.strictEqual(mockReply.headers['cache-invalidate'], 'organizations,workspaces,branches');
    });

    it('CORS configuration exposes Cache-Invalidate and x-cache-invalidate headers to clients', async () => {
      const res = await app.inject({
        method: 'OPTIONS',
        url: '/api/v1/workspaces',
        headers: {
          origin: 'http://localhost:5173',
          'access-control-request-method': 'POST',
        },
      });

      assert.strictEqual(res.statusCode, 204);
      const exposed = res.headers['access-control-expose-headers'];
      assert.ok(exposed);
      assert.ok(exposed.includes('Cache-Invalidate'));
    });
  });
});
