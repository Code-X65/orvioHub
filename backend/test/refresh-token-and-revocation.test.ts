import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { buildApp } from '../src/app.js';
import { dataService, hashSessionToken } from '../src/services/dataService.js';
import { ERROR_CODES } from '../src/config/constants.js';

describe('Legacy refresh compatibility and server-side session revocation', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  const originalGetUserById = dataService.getUserById;
  const originalGetUserByEmail = dataService.getUserByEmail;
  const originalVerifyPassword = dataService.verifyPassword;
  const originalCreateSession = dataService.createSession;
  const originalRotateSession = dataService.rotateSession;
  const originalGetSessionById = dataService.getSessionById;
  const originalGetUserMemberships = dataService.getUserMemberships;
  const originalMutate = dataService.mutate;
  const originalLogoutUser = dataService.logoutUser;
  const originalGetOnboardingStatus = dataService.getOnboardingStatus;

  beforeEach(async () => {
    app = await buildApp();
  });

  afterEach(() => {
    dataService.getUserById = originalGetUserById;
    dataService.getUserByEmail = originalGetUserByEmail;
    dataService.verifyPassword = originalVerifyPassword;
    dataService.createSession = originalCreateSession;
    dataService.rotateSession = originalRotateSession;
    dataService.getSessionById = originalGetSessionById;
    dataService.getUserMemberships = originalGetUserMemberships;
    dataService.mutate = originalMutate;
    dataService.logoutUser = originalLogoutUser;
    dataService.getOnboardingStatus = originalGetOnboardingStatus;
  });

  test('1. Login generates an opaque server-side session cookie without an access token', async () => {
    dataService.getUserByEmail = async () => ({
      id: 'user_123',
      email: 'alex@example.com',
      name: 'Alex Vance',
      emailVerified: true,
      tokenVersion: 1,
      status: 'ACTIVE',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    dataService.verifyPassword = async () => true;

    dataService.createSession = async () => ({
      refreshToken: 'sample_refresh_token_abc123',
      expiresAt: Date.now() + 7 * 86_400_000,
    });

    dataService.getOnboardingStatus = async () => ({
      status: 'COMPLETED' as const,
      currentStep: 'COMPLETED' as const,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'alex@example.com',
        password: 'Password123!',
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.equal(body.data.token, undefined, 'Login must not return an access token');
    assert.equal(body.data.refreshToken, undefined, 'Refresh token must remain HttpOnly-cookie only');
    const setCookies = res.headers['set-cookie'];
    const cookies = Array.isArray(setCookies) ? setCookies : [setCookies];
    const sessionCookie = cookies.find((cookie) => cookie.startsWith('orvio_session='));
    assert.ok(sessionCookie, 'Login must set the session cookie');
    assert.ok(sessionCookie.includes('Domain=.orviohub.localhost'), 'Session cookie must be shared with workspace subdomains');
    assert.ok(sessionCookie.includes('Path=/api'), 'Session cookie must be sent to protected API routes');

    const csrfResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/csrf',
      headers: {
        host: 'home.orviohub.localhost:4000',
        origin: 'http://home.orviohub.localhost:3000',
        cookie: sessionCookie.split(';')[0],
      },
    });
    assert.equal(csrfResponse.statusCode, 200, 'The shared refresh cookie must bootstrap CSRF on the home subdomain');

  });

  const csrfFor = (refreshToken: string) => createHmac('sha256', 'orvio-hub-super-secret-key-change-in-production-min32chars').update(refreshToken).digest('base64url');

  test('2. POST /api/v1/auth/refresh rotates a cookie-held refresh credential with CSRF protection', async () => {
    let rotatedOldToken: string | undefined;

    dataService.rotateSession = async (oldToken: string) => {
      rotatedOldToken = oldToken;
      return {
        user: {
          id: 'user_123',
          email: 'alex@example.com',
          name: 'Alex Vance',
          emailVerified: true,
          tokenVersion: 1,
          status: 'ACTIVE' as const,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        refreshToken: 'new_rotated_refresh_token_xyz789',
        expiresAt: Date.now() + 7 * 86_400_000,
      };
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: {
        cookie: 'orvio_refresh_token=sample_refresh_token_abc123',
        'x-csrf-token': csrfFor('sample_refresh_token_abc123'),
        origin: 'http://localhost:5173',
      },
      payload: {},
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.equal(rotatedOldToken, 'sample_refresh_token_abc123');
    assert.equal(body.data.refreshToken, undefined, 'Refresh token must remain HttpOnly-cookie only');
    assert.ok(body.data.token);
  });

  test('2c. Concurrent refresh reuse preserves the replacement cookie and recovers a JWT without another rotation', async () => {
    dataService.rotateSession = async () => ({ concurrentRefresh: true as const, replacementSessionId: 'replacement_session_123' });

    const concurrent = await app.inject({
      method: 'POST', url: '/api/v1/auth/refresh',
      headers: { cookie: 'orvio_refresh_token=old_refresh_token', 'x-csrf-token': csrfFor('old_refresh_token'), origin: 'http://localhost:5173' }, payload: {},
    });
    assert.equal(concurrent.statusCode, 409);
    assert.equal(JSON.parse(concurrent.payload).error.code, 'REFRESH_CONCURRENTLY_ROTATED');
    assert.ok(!concurrent.headers['set-cookie'], 'A concurrent loser must not clear the shared replacement cookie');

    const ticket = JSON.parse(concurrent.payload).data.recoveryTicket;
    dataService.getSessionById = async () => ({
      id: 'replacement_session_123', userId: 'user_123', sessionHash: hashSessionToken('replacement_refresh_token'),
      tokenVersion: 1, expiresAt: Date.now() + 60_000, absoluteExpiresAt: Date.now() + 60_000,
    } as any);
    dataService.getUserById = async () => ({ id: 'user_123', email: 'alex@example.com', name: 'Alex Vance', emailVerified: true, tokenVersion: 1, status: 'ACTIVE', createdAt: Date.now(), updatedAt: Date.now() });

    const recovered = await app.inject({
      method: 'POST', url: '/api/v1/auth/refresh',
      headers: { cookie: 'orvio_refresh_token=replacement_refresh_token', 'x-csrf-token': csrfFor('replacement_refresh_token'), origin: 'http://localhost:5173' },
      payload: { recoveryTicket: ticket },
    });
    assert.equal(recovered.statusCode, 200);
    assert.ok(JSON.parse(recovered.payload).data.token);
    assert.ok(!recovered.headers['set-cookie'], 'Recovery mints only an access JWT and does not rotate/delete the replacement cookie');
  });

  test('2d. A JWT for a rotation-replaced session recovers through R1 without clearing it', async () => {
    const now = Date.now();
    dataService.getUserById = async () => ({
      id: 'user_123', email: 'alex@example.com', name: 'Alex Vance', emailVerified: true,
      tokenVersion: 1, status: 'ACTIVE', createdAt: now, updatedAt: now,
    });
    dataService.getSessionById = async (sessionId: string) => {
      if (sessionId === 'session_s0') {
        return {
          id: 'session_s0', userId: 'user_123', tokenVersion: 1,
          isRevoked: true, revokedAt: now, revocationReason: 'REPLACED_BY_ROTATION',
          replacedBySessionId: 'session_s1', expiresAt: now + 60_000, absoluteExpiresAt: now + 60_000,
        } as any;
      }
      if (sessionId === 'session_s1') {
        return {
          id: 'session_s1', userId: 'user_123', sessionHash: hashSessionToken('replacement_refresh_r1'), tokenVersion: 1,
          expiresAt: now + 60_000, absoluteExpiresAt: now + 60_000,
        } as any;
      }
      return null;
    };
    dataService.getUserMemberships = async () => [];
    dataService.getOnboardingStatus = async () => ({ status: 'COMPLETED' as const, currentStep: 'COMPLETED' as const });

    const oldAccessToken = app.jwt.sign({ userId: 'user_123', email: 'alex@example.com', sessionId: 'session_s0', tokenVersion: 1 });
    const predecessorRequest = await app.inject({
      method: 'GET', url: '/api/v1/auth/me', headers: { authorization: `Bearer ${oldAccessToken}` },
    });
    assert.equal(predecessorRequest.statusCode, 409);
    const predecessorBody = JSON.parse(predecessorRequest.payload);
    assert.equal(predecessorBody.error.code, 'SESSION_REPLACED_BY_ROTATION');
    assert.ok(predecessorBody.data.recoveryTicket);
    assert.ok(!predecessorRequest.headers['set-cookie'], 'A rotation-replaced JWT must never clear R1');

    const recovered = await app.inject({
      method: 'POST', url: '/api/v1/auth/refresh',
      headers: {
        cookie: 'orvio_refresh_token=replacement_refresh_r1',
        'x-csrf-token': csrfFor('replacement_refresh_r1'),
        origin: 'http://localhost:5173',
      },
      payload: { recoveryTicket: predecessorBody.data.recoveryTicket },
    });
    assert.equal(recovered.statusCode, 200);
    const recoveredToken = JSON.parse(recovered.payload).data.token;
    assert.ok(recoveredToken);
    assert.ok(!recovered.headers['set-cookie'], 'Recovery must preserve the replacement cookie');

    const currentMe = await app.inject({
      method: 'GET', url: '/api/v1/auth/me', headers: { authorization: `Bearer ${recoveredToken}` },
    });
    assert.equal(currentMe.statusCode, 200, 'The successor access JWT must authenticate normally');
  });

  test('2a. Session rotation rejects a schema mismatch without a legacy retry', async () => {
    const attempts: Record<string, unknown>[] = [];
    dataService.mutate = async (_path, args) => {
      attempts.push(args);
      throw new Error('ArgumentValidationError: Object contains an extra field `newExpiresAt`.');
    };
    dataService.getUserById = async () => ({
      id: 'user_123', email: 'alex@example.com', name: 'Alex Vance', emailVerified: true,
      tokenVersion: 1, status: 'ACTIVE' as const, createdAt: Date.now(), updatedAt: Date.now(),
    });

    await assert.rejects(() => dataService.rotateSession('sample_refresh_token_abc123'));

    assert.equal(attempts.length, 1);
    assert.ok(attempts[0].newExpiresAt);
  });

  test('2b. Session rotation does not remove newExpiresAt when the deployment requires it', async () => {
    const attempts: Record<string, unknown>[] = [];
    dataService.mutate = async (_path, args) => {
      attempts.push(args);
      throw new Error('ArgumentValidationError: Object is missing the required field `newExpiresAt`.');
    };

    await assert.rejects(() => dataService.rotateSession('sample_refresh_token_abc123'));

    assert.equal(attempts.length, 1);
    assert.ok(attempts[0].newExpiresAt);
  });

  test('3. POST /api/v1/auth/refresh rejects expired refresh token', async () => {
    dataService.rotateSession = async () => {
      const err: Error & { code?: string } = new Error('Token expired');
      err.code = 'TOKEN_EXPIRED';
      throw err;
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: {
        cookie: 'orvio_refresh_token=expired_refresh_token',
        'x-csrf-token': csrfFor('expired_refresh_token'),
        origin: 'http://localhost:5173',
      },
      payload: {},
    });

    assert.equal(res.statusCode, 401);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, false);
    assert.equal(body.error.code, ERROR_CODES.TOKEN_EXPIRED);
  });

  test('4. POST /api/v1/auth/refresh rejects revoked/invalidated token', async () => {
    dataService.rotateSession = async () => {
      const err: Error & { code?: string } = new Error('Session revoked');
      err.code = 'SESSION_REVOKED';
      throw err;
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: {
        cookie: 'orvio_refresh_token=already_used_refresh_token',
        'x-csrf-token': csrfFor('already_used_refresh_token'),
        origin: 'http://localhost:5173',
      },
      payload: {},
    });

    assert.equal(res.statusCode, 401);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'SESSION_REVOKED');
  });

  test('4a. POST /api/v1/auth/refresh clears cookies for a genuinely invalid token', async () => {
    dataService.rotateSession = async () => {
      const err: Error & { code?: string } = new Error('Invalid token');
      err.code = 'INVALID_TOKEN';
      throw err;
    };
    const res = await app.inject({
      method: 'POST', url: '/api/v1/auth/refresh',
      headers: { cookie: 'orvio_refresh_token=invalid_refresh_token', 'x-csrf-token': csrfFor('invalid_refresh_token'), origin: 'http://localhost:5173' }, payload: {},
    });
    assert.equal(res.statusCode, 401);
    assert.equal(JSON.parse(res.payload).error.code, 'INVALID_TOKEN');
    assert.match(String(res.headers['set-cookie']), /Max-Age=0/i);
  });

  test('5. Authenticate rejects JWT when user tokenVersion was bumped', async () => {
    // User has tokenVersion: 2 in DB, but JWT was signed with tokenVersion: 1
    dataService.getUserById = async (id: string) => ({
      id,
      email: 'alex@example.com',
      name: 'Alex Vance',
      emailVerified: true,
      tokenVersion: 2,
      status: 'ACTIVE',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const staleToken = app.jwt.sign({
      userId: 'user_123',
      email: 'alex@example.com',
      tokenVersion: 1,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: {
        authorization: `Bearer ${staleToken}`,
      },
    });

    assert.equal(res.statusCode, 401);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, false);
    assert.equal(body.error.code, ERROR_CODES.UNAUTHENTICATED);
    assert.ok(body.error.message.includes('Session has been invalidated'));
  });

  test('6. POST /api/v1/auth/logout revokes the bearer-token session without accepting a refresh token', async () => {
    let loggedOutUserId: string | undefined;
    let revokedRefreshToken: string | undefined;

    dataService.getUserById = async (id: string) => ({
      id,
      email: 'alex@example.com',
      name: 'Alex Vance',
      emailVerified: true,
      tokenVersion: 1,
      status: 'ACTIVE',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    dataService.logoutUser = async (userId: string, refreshToken?: string) => {
      loggedOutUserId = userId;
      revokedRefreshToken = refreshToken;
      return { success: true };
    };

    const token = app.jwt.sign({
      userId: 'user_logout_123',
      email: 'alex@example.com',
      sessionId: 'session_logout_123',
      tokenVersion: 1,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.equal(loggedOutUserId, 'user_logout_123');
    assert.equal(revokedRefreshToken, undefined);
  });
});
