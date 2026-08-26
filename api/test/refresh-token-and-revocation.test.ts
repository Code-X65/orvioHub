import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { dataService } from '../src/services/dataService.js';
import { ERROR_CODES } from '../src/config/constants.js';

describe('Short-Lived Access Tokens, Refresh Token Rotation, and Revocation Test Suite', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  const originalGetUserById = dataService.getUserById;
  const originalGetUserByEmail = dataService.getUserByEmail;
  const originalVerifyPassword = dataService.verifyPassword;
  const originalCreateSession = dataService.createSession;
  const originalRotateSession = dataService.rotateSession;
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
    dataService.logoutUser = originalLogoutUser;
    dataService.getOnboardingStatus = originalGetOnboardingStatus;
  });

  test('1. Login generates 15m access token and rotating refresh token', async () => {
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
    assert.ok(body.data.token, 'Must return access token');
    assert.equal(body.data.refreshToken, 'sample_refresh_token_abc123');

    // Verify JWT payload decoded expires in ~15m
    const decoded = app.jwt.decode<{ exp: number; iat: number; tokenVersion: number }>(body.data.token);
    assert.ok(decoded);
    assert.equal(decoded.tokenVersion, 1);
    assert.ok(decoded.exp - decoded.iat <= 15 * 60 + 5, 'Access token exp should be 15 minutes');
  });

  test('2. POST /api/v1/auth/refresh rotates the session and issues a new access token and refresh token', async () => {
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
      payload: {
        refreshToken: 'sample_refresh_token_abc123',
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.equal(rotatedOldToken, 'sample_refresh_token_abc123');
    assert.equal(body.data.refreshToken, 'new_rotated_refresh_token_xyz789');
    assert.ok(body.data.token);
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
      payload: {
        refreshToken: 'expired_refresh_token',
      },
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
      payload: {
        refreshToken: 'already_used_refresh_token',
      },
    });

    assert.equal(res.statusCode, 401);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, false);
    assert.equal(body.error.code, ERROR_CODES.UNAUTHENTICATED);
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

  test('6. POST /api/v1/auth/logout passes refreshToken and revokes user sessions', async () => {
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
      tokenVersion: 1,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        refreshToken: 'refresh_to_revoke',
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.equal(loggedOutUserId, 'user_logout_123');
    assert.equal(revokedRefreshToken, 'refresh_to_revoke');
  });
});
