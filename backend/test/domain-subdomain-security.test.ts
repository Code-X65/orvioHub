import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';
import { AUTH_COOKIE_NAME, REFRESH_COOKIE_NAME } from '../src/utils/cookies.js';
import { dataService } from '../src/services/dataService.js';

describe('Domain & Subdomain Architecture Security Remediation', () => {
  let app: FastifyInstance;

  before(async () => {
    app = await buildApp();
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  describe('1. Cookie Name Consistency & Minimal Surface (Gap 2.1)', () => {
    it('only issues canonical orvio_session and orvio_refresh cookies upon authentication', async () => {
      // Register or login a test user
      const email = `cookie_test_${Date.now()}@example.com`;
      const regRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        headers: {
          'content-type': 'application/json',
          origin: 'http://account.orviohub.localhost:3000',
        },
        payload: {
          email,
          password: 'Password123!',
          name: 'Cookie Test User',
          acceptTerms: true,
        },
      });

      assert.equal(regRes.statusCode, 201);
      const setCookieHeaders = regRes.cookies;

      // Extract all cookie names set by response
      const cookieNames = setCookieHeaders.map((c) => c.name);

      // Verify canonical cookies exist
      assert.ok(cookieNames.includes(AUTH_COOKIE_NAME), `Expected ${AUTH_COOKIE_NAME} in cookies`);
      assert.ok(cookieNames.includes(REFRESH_COOKIE_NAME), `Expected ${REFRESH_COOKIE_NAME} in cookies`);

      // Verify legacy cookie names are NEVER set
      assert.ok(!cookieNames.includes('orvio_refresh_token'), 'orvio_refresh_token should not be set');
      assert.ok(!cookieNames.includes('refresh_token'), 'refresh_token should not be set');
      assert.ok(!cookieNames.includes('session'), 'session should not be set');

      // Verify HttpOnly, SameSite, and domain options
      const authCookie = setCookieHeaders.find((c) => c.name === AUTH_COOKIE_NAME);
      assert.equal(authCookie?.httpOnly, true);
      assert.equal(authCookie?.sameSite?.toLowerCase(), 'lax');

      const refreshCookie = setCookieHeaders.find((c) => c.name === REFRESH_COOKIE_NAME);
      assert.equal(refreshCookie?.httpOnly, true);
      assert.equal(refreshCookie?.sameSite?.toLowerCase(), 'lax');
    });

    it('clearAuthCookies scrubs canonical and legacy cookie names across all domains on logout', async () => {
      // Create user and get session
      const email = `logout_scrub_${Date.now()}@example.com`;
      const regRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        headers: {
          'content-type': 'application/json',
          origin: 'http://account.orviohub.localhost:3000',
        },
        payload: {
          email,
          password: 'Password123!',
          name: 'Logout Scrub User',
          acceptTerms: true,
        },
      });

      const sessionCookie = regRes.cookies.find((c) => c.name === AUTH_COOKIE_NAME)?.value;
      const refreshCookie = regRes.cookies.find((c) => c.name === REFRESH_COOKIE_NAME)?.value;

      const logoutRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        headers: {
          'content-type': 'application/json',
          origin: 'http://account.orviohub.localhost:3000',
          cookie: `${AUTH_COOKIE_NAME}=${sessionCookie}; ${REFRESH_COOKIE_NAME}=${refreshCookie}`,
        },
        payload: {},
      });

      assert.equal(logoutRes.statusCode, 200);

      // Verify clearing cookies expire immediately
      const clearedCookieNames = logoutRes.cookies.map((c) => c.name);
      assert.ok(clearedCookieNames.includes(AUTH_COOKIE_NAME));
      assert.ok(clearedCookieNames.includes(REFRESH_COOKIE_NAME));
      assert.ok(clearedCookieNames.includes('orvio_refresh_token'));
      assert.ok(clearedCookieNames.includes('refresh_token'));
      assert.ok(clearedCookieNames.includes('session'));

      // All maxAge/expires should be 0 or in the past
      for (const c of logoutRes.cookies) {
        assert.equal(c.maxAge, 0);
      }
    });
  });

  describe('2. Pure Cookie-Based Token Refresh (Gap 2.2)', () => {
    it('successfully refreshes token with only HttpOnly orvio_refresh cookie (no body token required)', async () => {
      const email = `refresh_cookie_${Date.now()}@example.com`;
      const regRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        headers: {
          'content-type': 'application/json',
          origin: 'http://account.orviohub.localhost:3000',
        },
        payload: {
          email,
          password: 'Password123!',
          name: 'Refresh Cookie User',
          acceptTerms: true,
        },
      });

      const refreshCookie = regRes.cookies.find((c) => c.name === REFRESH_COOKIE_NAME)?.value;
      assert.ok(refreshCookie, 'Expected refresh cookie from register');

      // Refresh with empty body and refresh cookie
      const refreshRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        headers: {
          'content-type': 'application/json',
          origin: 'http://account.orviohub.localhost:3000',
          cookie: `${REFRESH_COOKIE_NAME}=${refreshCookie}`,
        },
        payload: {},
      });

      assert.equal(refreshRes.statusCode, 200);
      const json = refreshRes.json();
      assert.equal(json.success, true);
      assert.ok(json.data.token, 'Expected new access token in response');

      // Verify new canonical cookies are issued
      const newCookieNames = refreshRes.cookies.map((c) => c.name);
      assert.ok(newCookieNames.includes(AUTH_COOKIE_NAME));
      assert.ok(newCookieNames.includes(REFRESH_COOKIE_NAME));
      assert.ok(!newCookieNames.includes('orvio_refresh_token'));
    });
  });

  describe('3. CORS Origin Allowlist Strict Domain Validation (Gap 2.3)', () => {
    it('allows registered application origins', async () => {
      const allowedOrigins = [
        'http://account.orviohub.localhost:3000',
        'http://home.orviohub.localhost:3000',
        'http://inventory.orviohub.localhost:3000',
        'http://billing.orviohub.localhost:3000',
        'http://taskmanagement.orviohub.localhost:3000',
      ];

      for (const origin of allowedOrigins) {
        const res = await app.inject({
          method: 'OPTIONS',
          url: '/api/v1/auth/session',
          headers: {
            origin,
            'access-control-request-method': 'GET',
          },
        });

        assert.equal(res.statusCode, 204);
        assert.equal(res.headers['access-control-allow-origin'], origin);
        assert.equal(res.headers['access-control-allow-credentials'], 'true');
      }
    });

    it('rejects lookalike, attacker, and unregistered subdomains with 403 CORS_NOT_ALLOWED', async () => {
      const rejectedOrigins = [
        'https://evil-orviohub.com',
        'https://orviohub.com.attacker.com',
        'http://localhost.attacker.com',
        'https://admin.orviohub.localhost',
        'https://unknown.orviohub.com',
      ];

      for (const origin of rejectedOrigins) {
        const res = await app.inject({
          method: 'GET',
          url: '/api/v1/auth/session',
          headers: {
            origin,
          },
        });

        assert.equal(res.statusCode, 403, `Origin ${origin} should be blocked`);
        const json = res.json();
        assert.equal(json.success, false);
      }
    });
  });

  describe('4. Host Resolution & Direct Backend Hardening (Gap 2.4)', () => {
    it('resolves surface context from Origin header when direct backend access occurs', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/host-context',
        headers: {
          host: '127.0.0.1:4000',
          origin: 'http://inventory.orviohub.localhost:3000',
        },
      });

      assert.equal(res.statusCode, 200);
      const json = res.json();
      assert.equal(json.hostContext.application, 'inventory');
      assert.equal(json.hostContext.environment, 'development');
    });

    it('allows health and readiness endpoints without Origin/Referer headers', async () => {
      const endpoints = ['/health', '/ready', '/version', '/'];
      for (const url of endpoints) {
        const res = await app.inject({
          method: 'GET',
          url,
          headers: {
            host: '127.0.0.1:4000',
          },
        });
        assert.equal(res.statusCode, 200);
      }
    });
  });

  describe('5. Security Headers, CSP & CSRF Protection (Section 4 Gaps)', () => {
    it('enforces CSRF validation: blocks state mutation with auth cookie when both Origin and Referer are missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        headers: {
          cookie: `${AUTH_COOKIE_NAME}=mock_session_token`,
        },
        payload: {},
      });

      assert.equal(res.statusCode, 403);
      const json = res.json();
      assert.equal(json.error.code, 'CSRF_ORIGIN_REQUIRED');
    });

    it('enforces CSRF validation: accepts valid Referer fallback when Origin header is absent', async () => {
      const token = app.jwt.sign({ userId: 'u1', email: 'u1@example.com', tokenVersion: 1 });
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        headers: {
          referer: 'http://account.orviohub.localhost:3000/settings',
          cookie: `${AUTH_COOKIE_NAME}=${token}`,
        },
        payload: {},
      });

      // Valid Referer allowed it past the CSRF hook
      assert.notEqual(res.statusCode, 403);
    });

    it('enforces CSRF validation: rejects malicious Referer domain with 403 CSRF_ORIGIN_INVALID', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        headers: {
          referer: 'http://evil-attacker.com/csrf-attack',
          cookie: `${AUTH_COOKIE_NAME}=mock_token`,
        },
        payload: {},
      });

      assert.equal(res.statusCode, 403);
      const json = res.json();
      assert.equal(json.error.code, 'CSRF_ORIGIN_INVALID');
    });

    it('sets HSTS header when running in production environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        const res = await app.inject({
          method: 'GET',
          url: '/health',
        });
        assert.equal(
          res.headers['strict-transport-security'],
          'max-age=31536000; includeSubDomains; preload'
        );
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('restricts CSP connect-src to specific subdomains and removes redundant X-Frame-Options', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/health',
      });

      const csp = res.headers['content-security-policy'] as string;
      assert.ok(csp, 'CSP header should exist');
      assert.ok(csp.includes("frame-ancestors 'none'"), 'CSP should include frame-ancestors none');
      assert.ok(csp.includes('https://api.orviohub.com'), 'CSP should list specific API subdomain');
      assert.ok(csp.includes('https://accounts.orviohub.com'), 'CSP should list specific accounts subdomain');
      assert.ok(csp.includes('https://inventory.orviohub.com'), 'CSP should list specific inventory subdomain');
      assert.ok(!csp.includes('https://*.orviohub.com'), 'CSP should not use overly broad wildcard https://*.orviohub.com');

      // Verify redundant X-Frame-Options is removed
      assert.equal(res.headers['x-frame-options'], undefined);
    });
  });
});
