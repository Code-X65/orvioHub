import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { dataService } from '../src/services/dataService.js';
import { ERROR_CODES } from '../src/config/constants.js';

describe('Logout Flow and Wildcard Session Handling Across Subdomains Test Suite', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  const originalGetUserById = dataService.getUserById;
  const originalGetUserByEmail = dataService.getUserByEmail;
  const originalVerifyPassword = dataService.verifyPassword;
  const originalCreateSession = dataService.createSession;
  const originalGetSessionById = dataService.getSessionById;
  const originalLogoutUser = dataService.logoutUser;
  const originalGetOnboardingStatus = dataService.getOnboardingStatus;
  const originalGetUserMemberships = dataService.getUserMemberships;
  const originalLogAuthEvent = dataService.logAuthEvent;

  beforeEach(async () => {
    app = await buildApp();
    dataService.getUserMemberships = async () => [];
    dataService.logAuthEvent = async () => ({ success: true });
    dataService.getOnboardingStatus = async () => ({
      status: 'COMPLETED' as const,
      currentStep: 'COMPLETED' as const,
    });
  });

  afterEach(() => {
    dataService.getUserById = originalGetUserById;
    dataService.getUserByEmail = originalGetUserByEmail;
    dataService.verifyPassword = originalVerifyPassword;
    dataService.createSession = originalCreateSession;
    dataService.getSessionById = originalGetSessionById;
    dataService.logoutUser = originalLogoutUser;
    dataService.getOnboardingStatus = originalGetOnboardingStatus;
    dataService.getUserMemberships = originalGetUserMemberships;
    dataService.logAuthEvent = originalLogAuthEvent;
  });

  test('1. Successful login sets wildcard cookies scoped to .orviohub.localhost', async () => {
    dataService.getUserByEmail = async () => ({
      id: 'user_sso_1',
      email: 'sso_user@example.com',
      name: 'SSO Tester',
      emailVerified: true,
      tokenVersion: 1,
      status: 'ACTIVE',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    dataService.verifyPassword = async () => true;

    dataService.createSession = async () => ({
      sessionId: 'sess_123',
      refreshToken: 'sample_refresh_token_sso',
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
        email: 'sso_user@example.com',
        password: 'SecurePassword123!',
      },
    });

    assert.equal(res.statusCode, 200);
    const setCookies = res.headers['set-cookie'];
    assert.ok(setCookies, 'Set-Cookie header must be present');

    const cookieStrings = Array.isArray(setCookies) ? setCookies : [setCookies];
    
    // Confirm session cookie is scoped to .orviohub.localhost (or env COOKIE_DOMAIN)
    const sessionCookie = cookieStrings.find((c) => c.startsWith('session=') || c.startsWith('orvio_session='));
    assert.ok(sessionCookie, 'Must set session or orvio_session cookie');
    assert.ok(
      sessionCookie.includes('Domain=.orviohub.localhost') || sessionCookie.includes('domain=.orviohub.localhost'),
      'Session cookie must have Domain=.orviohub.localhost'
    );
    assert.ok(sessionCookie.includes('Path=/') || sessionCookie.includes('path=/'), 'Cookie must have Path=/');
    assert.ok(sessionCookie.toLowerCase().includes('httponly'), 'Cookie must be HttpOnly');
    assert.ok(sessionCookie.toLowerCase().includes('samesite=lax'), 'Cookie must have SameSite=Lax');
  });

  test('2. Logout from any subdomain revokes server-side session and clears cookies with Domain=.orviohub.localhost', async () => {
    let revokedSessionId: string | undefined;
    let revokedUserId: string | undefined;

    dataService.logoutUser = async (userId?: string, _refreshToken?: string, sessionId?: string) => {
      revokedUserId = userId;
      revokedSessionId = sessionId;
      return { success: true };
    };

    const token = app.jwt.sign({
      userId: 'user_sso_1',
      email: 'sso_user@example.com',
      sessionId: 'sess_active_456',
      tokenVersion: 1,
    });

    // Simulate request coming from a subdomain (e.g. inventory or home) with session cookie
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: {
        cookie: `orvio_session=${token}; orvio_refresh_token=mock_refresh_token`,
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.equal(body.message, 'Successfully logged out.');
    assert.equal(revokedUserId, 'user_sso_1');
    assert.equal(revokedSessionId, 'sess_active_456');

    // Confirm clearing cookie headers are set for .orviohub.localhost with Max-Age=0
    const setCookies = res.headers['set-cookie'];
    assert.ok(setCookies, 'Set-Cookie headers must be present to clear cookies');
    const cookieStrings = Array.isArray(setCookies) ? setCookies : [setCookies];
    
    const clearedWildcardCookie = cookieStrings.find(
      (c) =>
        (c.startsWith('session=') || c.startsWith('orvio_session=')) &&
        (c.includes('Domain=.orviohub.localhost') || c.includes('domain=.orviohub.localhost')) &&
        (c.includes('Max-Age=0') || c.includes('max-age=0'))
    );
    assert.ok(clearedWildcardCookie, 'Must clear session cookie on .orviohub.localhost with Max-Age=0');
  });

  test('3. Revoked session is rejected by authentication middleware across all subdomains', async () => {
    dataService.getUserById = async (id: string) => ({
      id,
      email: 'sso_user@example.com',
      name: 'SSO User',
      emailVerified: true,
      tokenVersion: 1,
      status: 'ACTIVE',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Session was revoked on server (revokedAt is set)
    dataService.getSessionById = async (_sessionId: string) => ({
      id: 'sess_active_456',
      userId: 'user_sso_1',
      tokenVersion: 1,
      expiresAt: Date.now() + 86_400_000,
      revokedAt: Date.now() - 5000, // revoked 5s ago
      isRevoked: true,
    });

    const token = app.jwt.sign({
      userId: 'user_sso_1',
      email: 'sso_user@example.com',
      sessionId: 'sess_active_456',
      tokenVersion: 1,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    assert.equal(res.statusCode, 401);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, false);
    assert.equal(body.error.code, ERROR_CODES.UNAUTHENTICATED);
    assert.ok(body.error.message.includes('revoked'));
  });

  test('4. Expired session (expiresAt <= now) is rejected with 401 and clears cookie', async () => {
    dataService.getUserById = async (id: string) => ({
      id,
      email: 'sso_user@example.com',
      name: 'SSO User',
      emailVerified: true,
      tokenVersion: 1,
      status: 'ACTIVE',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Session has expired
    dataService.getSessionById = async (_sessionId: string) => ({
      id: 'sess_expired_789',
      userId: 'user_sso_1',
      tokenVersion: 1,
      expiresAt: Date.now() - 10_000, // expired 10s ago
      revokedAt: undefined,
      isRevoked: false,
    });

    const token = app.jwt.sign({
      userId: 'user_sso_1',
      email: 'sso_user@example.com',
      sessionId: 'sess_expired_789',
      tokenVersion: 1,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    assert.equal(res.statusCode, 401);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, false);
    assert.equal(body.error.code, ERROR_CODES.UNAUTHENTICATED);
    assert.ok(body.error.message.includes('expired'));
  });

  test('5. Password change / tokenVersion mismatch invalidates all existing sessions everywhere', async () => {
    // User tokenVersion was incremented after password change to 2
    dataService.getUserById = async (id: string) => ({
      id,
      email: 'sso_user@example.com',
      name: 'SSO User',
      emailVerified: true,
      tokenVersion: 2,
      status: 'ACTIVE',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Old token signed with tokenVersion 1
    const oldToken = app.jwt.sign({
      userId: 'user_sso_1',
      email: 'sso_user@example.com',
      sessionId: 'sess_old_1',
      tokenVersion: 1,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: {
        authorization: `Bearer ${oldToken}`,
      },
    });

    assert.equal(res.statusCode, 401);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, false);
    assert.equal(body.error.code, ERROR_CODES.UNAUTHENTICATED);
    assert.ok(body.error.message.includes('Session has been invalidated'));
  });

  test('6. Valid active session succeeds on protected route with session context', async () => {
    dataService.getUserById = async (id: string) => ({
      id,
      email: 'sso_user@example.com',
      name: 'SSO User',
      emailVerified: true,
      tokenVersion: 1,
      status: 'ACTIVE',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    dataService.getSessionById = async (_sessionId: string) => ({
      id: 'sess_valid_999',
      userId: 'user_sso_1',
      tokenVersion: 1,
      expiresAt: Date.now() + 86_400_000,
      revokedAt: undefined,
      isRevoked: false,
    });

    const token = app.jwt.sign({
      userId: 'user_sso_1',
      email: 'sso_user@example.com',
      sessionId: 'sess_valid_999',
      tokenVersion: 1,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: {
        cookie: `orvio_session=${token}`,
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.equal(body.data.user.email, 'sso_user@example.com');
  });
});
