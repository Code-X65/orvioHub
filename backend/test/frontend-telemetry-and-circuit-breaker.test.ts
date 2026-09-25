import { describe, it } from 'node:test';
import assert from 'node:assert';

// Import frontend logic directly into Node test runner
import { telemetry } from '../../frontend/src/lib/telemetry.js';
import { circuitBreaker, CircuitBreakerError } from '../../frontend/src/lib/circuitBreaker.js';
import { featureFlags } from '../../frontend/src/lib/featureFlags.js';

describe('Frontend Operational Infrastructure (Telemetry, Circuit Breaker, Feature Flags)', () => {
  describe('2.1 API Performance Monitoring & Telemetry', () => {
    it('records start, end, error and auth refresh events properly', () => {
      telemetry.reset();

      telemetry.recordRequestStart('/api/v1/workspaces', 'GET', false);
      telemetry.recordRequestEnd('/api/v1/workspaces', 'GET', 120, 200, false);

      telemetry.recordRequestStart('/api/v1/workspaces', 'GET', true);
      telemetry.recordRequestEnd('/api/v1/workspaces', 'GET', 5, 200, true);

      telemetry.recordRequestStart('/api/v1/inventory/items', 'POST', false);
      telemetry.recordRequestEnd('/api/v1/inventory/items', 'POST', 350, 500, false);
      telemetry.recordApiError('/api/v1/inventory/items', 'INTERNAL_SERVER_ERROR', 500, 'Database crashed');

      telemetry.recordAuthRefresh(true, 45);

      const summary = telemetry.getSummary();
      assert.strictEqual(summary.totalRequests, 3);
      assert.strictEqual(summary.cacheHitRatio, 0.33);
      assert.strictEqual(summary.overallErrorRate, 0.33);
      assert.strictEqual(summary.authRefreshes.total, 1);
      assert.strictEqual(summary.authRefreshes.successRate, 1);
      assert.strictEqual(summary.authRefreshes.meanDuration, 45);
    });

    it('calculates accurate latency percentiles (p50, p95, p99)', () => {
      telemetry.reset();

      const durations = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      for (const d of durations) {
        telemetry.recordRequestStart('/api/v1/test', 'GET', false);
        telemetry.recordRequestEnd('/api/v1/test', 'GET', d, 200, false);
      }

      const metrics = telemetry.getEndpointMetrics('/api/v1/test');
      assert.strictEqual(metrics.length, 1);
      const m = metrics[0];
      assert.strictEqual(m.totalRequests, 10);
      assert.strictEqual(m.latency.min, 10);
      assert.strictEqual(m.latency.max, 100);
      assert.strictEqual(m.latency.p50, 60);
      assert.strictEqual(m.latency.p95, 100);
    });

    it('allows subscribers to receive live telemetry events', () => {
      telemetry.reset();
      const received: any[] = [];
      const unsub = telemetry.subscribe((e) => received.push(e));

      telemetry.recordRequestStart('/api/v1/sub', 'GET', false);
      assert.strictEqual(received.length, 1);
      assert.strictEqual(received[0].endpoint, '/api/v1/sub');

      unsub();
      telemetry.recordRequestStart('/api/v1/sub2', 'GET', false);
      assert.strictEqual(received.length, 1);
    });
  });

  describe('2.4 Circuit Breaker & Feature Flags', () => {
    it('normalizes dynamic endpoint paths to prevent circuit fragmentation', () => {
      const norm1 = circuitBreaker.normalizeEndpoint('/api/v1/workspaces/ws_abc1234567890123/branches');
      const norm2 = circuitBreaker.normalizeEndpoint('/api/v1/workspaces/ws_xyz9876543210987/branches');
      assert.strictEqual(norm1, '/api/v1/workspaces/:id/branches');
      assert.strictEqual(norm2, '/api/v1/workspaces/:id/branches');
      assert.strictEqual(norm1, norm2);
    });

    it('stays CLOSED for 4xx client errors and only trips on repeated 5xx errors', () => {
      circuitBreaker.reset();
      const endpoint = '/api/v1/fragile-service';

      // 4xx client errors do not trip
      for (let i = 0; i < 10; i++) {
        circuitBreaker.recordFailure(endpoint, 400);
        circuitBreaker.recordFailure(endpoint, 404);
        circuitBreaker.recordFailure(endpoint, 422);
      }
      assert.strictEqual(circuitBreaker.getStatus(endpoint).state, 'CLOSED');

      // 5 consecutive 500 errors trip the breaker
      for (let i = 0; i < 4; i++) {
        circuitBreaker.recordFailure(endpoint, 500);
        assert.strictEqual(circuitBreaker.getStatus(endpoint).state, 'CLOSED');
      }
      circuitBreaker.recordFailure(endpoint, 500);
      assert.strictEqual(circuitBreaker.getStatus(endpoint).state, 'OPEN');

      const check = circuitBreaker.checkExecution(endpoint);
      assert.strictEqual(check.allowed, false);
      assert.strictEqual(check.state, 'OPEN');
      assert.ok(check.nextRetryInMs > 0);
    });

    it('recovers to CLOSED when a probe request succeeds', () => {
      circuitBreaker.reset();
      const endpoint = '/api/v1/recovering-service';

      for (let i = 0; i < 5; i++) {
        circuitBreaker.recordFailure(endpoint, 503);
      }
      assert.strictEqual(circuitBreaker.getStatus(endpoint).state, 'OPEN');

      // Probe request succeeds
      circuitBreaker.recordSuccess(endpoint);
      assert.strictEqual(circuitBreaker.getStatus(endpoint).state, 'CLOSED');
      assert.strictEqual(circuitBreaker.checkExecution(endpoint).allowed, true);
    });

    it('featureFlags allow toggling runtime behavior and defaults safely', () => {
      assert.strictEqual(featureFlags.isEnabled('enable-circuit-breaker'), true);
      assert.strictEqual(featureFlags.isEnabled('enable-api-telemetry'), true);

      featureFlags.setFlag('test-experiment', true);
      assert.strictEqual(featureFlags.isEnabled('test-experiment'), true);

      featureFlags.setFlag('test-experiment', false);
      assert.strictEqual(featureFlags.isEnabled('test-experiment'), false);
    });
  });
});
