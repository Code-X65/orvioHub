import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { dataService } from '../src/services/dataService.js';

describe('Section 4: Edge Cases Test Suite', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  const originalGetUserById = dataService.getUserById;
  const originalGetUserByEmail = dataService.getUserByEmail;
  const originalGetSessionById = dataService.getSessionById;
  const originalCreateSession = dataService.createSession;
  const originalRotateSession = dataService.rotateSession;

  const mockUser = {
    id: 'user_edge_4',
    email: 'edge_case_user@orviohub.com',
    name: 'Edge Case Tester',
    emailVerified: true,
    twoFactorEnabled: true,
    tokenVersion: 1,
    status: 'ACTIVE',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const mockSession = {
    sessionId: 'session_edge_4',
    userId: mockUser.id,
    refreshToken: 'mock_refresh_token_edge_4',
    tokenVersion: 1,
    isRevoked: false,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    createdAt: Date.now(),
  };

  beforeEach(async () => {
    app = await buildApp();
    dataService.getUserById = async (id: string) => {
      if (id === mockUser.id) return { ...mockUser } as any;
      return null;
    };
    dataService.getUserByEmail = async (email: string) => {
      if (email === mockUser.email) return { ...mockUser } as any;
      return null;
    };
    dataService.getSessionById = async (sessionId: string) => {
      if (sessionId === mockSession.sessionId) return { ...mockSession } as any;
      return null;
    };
    dataService.createSession = async () => ({ ...mockSession } as any);
    dataService.rotateSession = async (token: string) => {
      if (token === mockSession.refreshToken) {
        return {
          session: { ...mockSession, sessionId: 'session_edge_rotated' },
          refreshToken: 'mock_new_refresh_token_edge_4',
          user: { ...mockUser },
        } as any;
      }
      const err: any = new Error('INVALID_TOKEN');
      err.code = 'INVALID_TOKEN';
      throw err;
    };
  });

  afterEach(async () => {
    dataService.getUserById = originalGetUserById;
    dataService.getUserByEmail = originalGetUserByEmail;
    dataService.getSessionById = originalGetSessionById;
    dataService.createSession = originalCreateSession;
    dataService.rotateSession = originalRotateSession;
    if (app) await app.close();
  });

  test('4.1 Token Refresh reads strictly from HttpOnly cookies without request body', async () => {
    // Call POST /api/v1/auth/refresh with HttpOnly cookie and empty body
    const refreshRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: {
        cookie: `orvio_refresh=${mockSession.refreshToken}`,
      },
      payload: {},
    });

    assert.equal(refreshRes.statusCode, 200, 'Refresh should succeed using only HttpOnly cookie');
    const body = JSON.parse(refreshRes.body);
    assert.equal(body.success, true);
    assert.ok(body.data.token, 'Should return new access token');

    // Verify Set-Cookie headers contain new rotated orvio_session and orvio_refresh
    const setCookieHeader = refreshRes.headers['set-cookie'];
    assert.ok(setCookieHeader, 'Should issue Set-Cookie headers');
    const cookiesStr = Array.isArray(setCookieHeader) ? setCookieHeader.join('; ') : String(setCookieHeader);
    assert.ok(cookiesStr.includes('orvio_session='), 'Should issue updated orvio_session cookie');
    assert.ok(cookiesStr.includes('orvio_refresh='), 'Should issue updated orvio_refresh cookie');
    assert.ok(cookiesStr.includes('HttpOnly'), 'Cookies must be HttpOnly');

    // 4.7 Session Cookie MaxAge aligned with access token (900 seconds / 15 minutes)
    assert.ok(
      cookiesStr.includes('Max-Age=900') || cookiesStr.includes('max-age=900'),
      'Session cookie Max-Age must be 900 seconds (15 minutes), aligned with JWT token expiry'
    );
    assert.ok(
      cookiesStr.includes('Max-Age=2592000') || cookiesStr.includes('max-age=2592000'),
      'Refresh cookie Max-Age must be 2592000 seconds (30 days)'
    );
  });

  test('4.2 Initial session validation: GET /api/v1/auth/session probes active session without errors', async () => {
    // 1. Unauthenticated probe returns authenticated: false with 200 OK
    const anonRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/session',
    });

    assert.equal(anonRes.statusCode, 200);
    const anonBody = JSON.parse(anonRes.body);
    assert.equal(anonBody.success, true);
    assert.equal(anonBody.data.authenticated, false);
    assert.equal(anonBody.data.user, null);

    // 2. Authenticated probe with active session cookie returns full user & session
    const token = app.jwt.sign({
      userId: mockUser.id,
      email: mockUser.email,
      sessionId: mockSession.sessionId,
      tokenVersion: mockUser.tokenVersion,
    });

    const authRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/session',
      headers: {
        cookie: `orvio_session=${token}`,
      },
    });

    assert.equal(authRes.statusCode, 200);
    const authBody = JSON.parse(authRes.body);
    assert.equal(authBody.success, true);
    assert.equal(authBody.data.authenticated, true);
    assert.equal(authBody.data.user.email, mockUser.email);
    assert.equal(authBody.data.session.id, mockSession.sessionId);
    assert.ok(authBody.data.access.level);
  });

  test('4.5 Expired 2FA TempToken recovery: POST /api/v1/auth/2fa/resend-challenge renews 2FA session token', async () => {
    // Generate a valid 2FA temp token
    const initialTempToken = app.jwt.sign(
      { userId: mockUser.id, email: mockUser.email, is2faPending: true },
      { expiresIn: '15m' }
    );

    const resendRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/2fa/resend-challenge',
      payload: {
        tempToken: initialTempToken,
        email: mockUser.email,
      },
    });

    assert.equal(resendRes.statusCode, 200);
    const resendBody = JSON.parse(resendRes.body);
    assert.equal(resendBody.success, true);
    assert.equal(resendBody.data.twoFactorRequired, true);
    assert.ok(resendBody.data.tempToken, 'Must return a fresh tempToken');

    // Verify newly issued tempToken verifies correctly
    const decoded = app.jwt.verify<any>(resendBody.data.tempToken);
    assert.equal(decoded.userId, mockUser.id);
    assert.equal(decoded.is2faPending, true);
  });
});
