import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { dataService } from '../src/services/dataService.js';
import { AUTH_COOKIE_NAME, REFRESH_COOKIE_NAME } from '../src/utils/cookies.js';

describe('Auth Gap Analysis Remediation Test Suite', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  const originalGetUserById = dataService.getUserById;
  const originalGetUserByEmail = dataService.getUserByEmail;
  const originalCreateSession = dataService.createSession;
  const originalRotateSession = dataService.rotateSession;
  const originalGetOnboardingStatus = dataService.getOnboardingStatus;

  beforeEach(async () => {
    app = await buildApp();
  });

  afterEach(() => {
    dataService.getUserById = originalGetUserById;
    dataService.getUserByEmail = originalGetUserByEmail;
    dataService.createSession = originalCreateSession;
    dataService.rotateSession = originalRotateSession;
    dataService.getOnboardingStatus = originalGetOnboardingStatus;
  });

  test('1. Standardized cookie names (orvio_session, orvio_refresh) and standard JWT claims (iss, aud, iat)', async () => {
    dataService.getUserByEmail = async () => ({
      id: 'user_gap_1',
      email: 'gap_user@example.com',
      name: 'Security Tester',
      emailVerified: true,
      tokenVersion: 1,
      status: 'ACTIVE',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    dataService.verifyPassword = async () => true;

    dataService.createSession = async () => ({
      sessionId: 'sess_gap_1',
      refreshToken: 'refr_secret_cookie_token_123',
      expiresAt: Date.now() + 30 * 86_400_000,
    });

    dataService.getOnboardingStatus = async () => ({
      status: 'COMPLETED' as const,
      currentStep: 'COMPLETED' as const,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'gap_user@example.com',
        password: 'Password123!',
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);

    // Verify JWT claims
    const decoded = app.jwt.decode<{ iss?: string; aud?: string; iat?: number }>(body.data.token);
    assert.ok(decoded);
    assert.equal(decoded.iss, 'orviohub', 'JWT must have iss claim "orviohub"');
    assert.equal(decoded.aud, 'orviohub-app', 'JWT must have aud claim "orviohub-app"');
    assert.ok(typeof decoded.iat === 'number', 'JWT must have iat claim');

    // Verify Cookies
    const setCookies = res.headers['set-cookie'];
    assert.ok(setCookies, 'Set-Cookie header must be present');
    const cookieStrings = Array.isArray(setCookies) ? setCookies : [setCookies];

    const sessionCookie = cookieStrings.find((c) => c.startsWith(`${AUTH_COOKIE_NAME}=`));
    const refreshCookie = cookieStrings.find((c) => c.startsWith(`${REFRESH_COOKIE_NAME}=`));

    assert.ok(sessionCookie, `Must set canonical ${AUTH_COOKIE_NAME} cookie`);
    assert.ok(refreshCookie, `Must set canonical ${REFRESH_COOKIE_NAME} cookie`);
    assert.ok(sessionCookie.toLowerCase().includes('httponly'), 'Session cookie must be HttpOnly');
    assert.ok(refreshCookie.toLowerCase().includes('httponly'), 'Refresh cookie must be HttpOnly');
    assert.ok(sessionCookie.toLowerCase().includes('samesite=lax'), 'Session cookie must be SameSite=Lax');
  });

  test('2. POST /api/v1/auth/refresh rotates session reading from HttpOnly cookie without body', async () => {
    dataService.rotateSession = async (token: string) => {
      assert.equal(token, 'refr_cookie_value_xyz');
      return {
        user: {
          id: 'user_gap_1',
          email: 'gap_user@example.com',
          name: 'Security Tester',
          emailVerified: true,
          tokenVersion: 2,
          status: 'ACTIVE',
        } as any,
        sessionId: 'sess_gap_rotated',
        refreshToken: 'refr_new_cookie_value_789',
        expiresAt: Date.now() + 30 * 86_400_000,
      };
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: {
        cookie: `${REFRESH_COOKIE_NAME}=refr_cookie_value_xyz`,
      },
      payload: {}, // No refreshToken in body
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.ok(body.data.token);
    assert.equal(body.data.refreshToken, 'refr_new_cookie_value_789');

    // Verify rotated cookies returned
    const setCookies = res.headers['set-cookie'];
    assert.ok(setCookies);
    const cookieStrings = Array.isArray(setCookies) ? setCookies : [setCookies];
    assert.ok(cookieStrings.some((c) => c.startsWith(`${AUTH_COOKIE_NAME}=`)));
    assert.ok(cookieStrings.some((c) => c.startsWith(`${REFRESH_COOKIE_NAME}=refr_new_cookie_value_789`)));
  });

  test('3. Server-mediated cross-subdomain handoff: generate single-use code and exchange on target', async () => {
    dataService.getUserById = async () => ({
      id: 'user_handoff_1',
      email: 'handoff@example.com',
      name: 'Handoff User',
      emailVerified: true,
      tokenVersion: 1,
      status: 'ACTIVE',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    dataService.createSession = async (_userId, opts) => ({
      sessionId: 'sess_handoff_redeemed',
      refreshToken: 'refr_handoff_redeemed_abc',
      expiresAt: Date.now() + 30 * 86_400_000,
      ...opts,
    });

    dataService.getOnboardingStatus = async () => ({
      status: 'COMPLETED' as const,
      currentStep: 'COMPLETED' as const,
    });
    dataService.getUserMemberships = async () => [];

    const token = app.jwt.sign({
      userId: 'user_handoff_1',
      email: 'handoff@example.com',
      sessionId: 'sess_source',
      tokenVersion: 1,
    });

    // Step A: Source domain creates handoff ticket code
    const codeRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/handoff/code',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    assert.equal(codeRes.statusCode, 200);
    const codeBody = JSON.parse(codeRes.payload);
    assert.equal(codeBody.success, true);
    assert.ok(codeBody.data.code);
    assert.equal(codeBody.data.expiresIn, 30);

    const handoffCode = codeBody.data.code;

    // Step B: Target domain exchanges code
    const exchangeRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/handoff/exchange',
      payload: { code: handoffCode },
    });

    assert.equal(exchangeRes.statusCode, 200);
    const exchangeBody = JSON.parse(exchangeRes.payload);
    assert.equal(exchangeBody.success, true);
    assert.equal(exchangeBody.data.user.email, 'handoff@example.com');
    assert.ok(exchangeBody.data.token);

    // Verify Set-Cookie on target domain exchange
    const setCookies = exchangeRes.headers['set-cookie'];
    assert.ok(setCookies);
    const cookieStrings = Array.isArray(setCookies) ? setCookies : [setCookies];
    assert.ok(cookieStrings.some((c) => c.startsWith(`${AUTH_COOKIE_NAME}=`)));

    // Step C: Replaying same code fails (single-use)
    const replayRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/handoff/exchange',
      payload: { code: handoffCode },
    });

    assert.equal(replayRes.statusCode, 400);
    const replayBody = JSON.parse(replayRes.payload);
    assert.equal(replayBody.success, false);
    assert.equal(replayBody.error.code, 'INVALID_HANDOFF_CODE');
  });

  test('4. Security headers and Content Security Policy are present on HTTP responses', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.equal(res.headers['x-frame-options'], 'SAMEORIGIN');
    assert.equal(res.headers['referrer-policy'], 'strict-origin-when-cross-origin');
    assert.ok(res.headers['content-security-policy'], 'Content-Security-Policy header must be present');
    assert.ok(res.headers['content-security-policy']?.includes("default-src 'self'"));
  });

  test('5. CSRF origin protection rejects cookie-authenticated mutations from unauthorized origins', async () => {
    const token = app.jwt.sign({
      userId: 'user_gap_csrf',
      email: 'csrf@example.com',
      sessionId: 'sess_csrf_1',
      tokenVersion: 1,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/users/me',
      headers: {
        cookie: `${AUTH_COOKIE_NAME}=${token}`,
        origin: 'https://malicious-attacker-site.com',
      },
      payload: { name: 'Hacked' },
    });

    assert.equal(res.statusCode, 403);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, false);
    assert.ok(
      body.error.code === 'CORS_NOT_ALLOWED' || body.error.code === 'CSRF_ORIGIN_INVALID',
      'Must reject unauthorized mutation with 403 CORS/CSRF code'
    );
  });
});
