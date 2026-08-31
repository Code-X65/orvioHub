import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { dataService, hashSessionToken, type UserRecord } from '../src/services/dataService.js';
import { ERROR_CODES, AUDIT_EVENTS } from '../src/config/constants.js';

describe('Phase 1 Identity Foundation Test Suite', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  const originalCreateUser = dataService.createUser;
  const originalGetUserById = dataService.getUserById;
  const originalGetUserByEmail = dataService.getUserByEmail;
  const originalVerifyPassword = dataService.verifyPassword;
  const originalCreateSession = dataService.createSession;
  const originalRotateSession = dataService.rotateSession;
  const originalRevokeSession = dataService.revokeSession;
  const originalRevokeSessionById = dataService.revokeSessionById;
  const originalLogoutAllSessions = dataService.logoutAllSessions;
  const originalGetUserSessions = dataService.getUserSessions;
  const originalGetUserIdentities = dataService.getUserIdentities;
  const originalUnlinkIdentity = dataService.unlinkIdentity;
  const originalUpdateProfile = dataService.updateProfile;
  const originalLogAudit = dataService.logAudit;

  beforeEach(async () => {
    app = await buildApp();
  });

  afterEach(() => {
    dataService.createUser = originalCreateUser;
    dataService.getUserById = originalGetUserById;
    dataService.getUserByEmail = originalGetUserByEmail;
    dataService.verifyPassword = originalVerifyPassword;
    dataService.createSession = originalCreateSession;
    dataService.rotateSession = originalRotateSession;
    dataService.revokeSession = originalRevokeSession;
    dataService.revokeSessionById = originalRevokeSessionById;
    dataService.logoutAllSessions = originalLogoutAllSessions;
    dataService.getUserSessions = originalGetUserSessions;
    dataService.getUserIdentities = originalGetUserIdentities;
    dataService.unlinkIdentity = originalUnlinkIdentity;
    dataService.updateProfile = originalUpdateProfile;
    dataService.logAudit = originalLogAudit;
  });

  test('1. HashSessionToken computes consistent SHA-256 hash', () => {
    const token = 'sample-refresh-token-12345';
    const hash1 = hashSessionToken(token);
    const hash2 = hashSessionToken(token);
    assert.equal(hash1, hash2);
    assert.equal(hash1.length, 64); // SHA-256 in hex
    assert.notEqual(hash1, token);
  });

  test('2. Signup with firstName and lastName creates user, session, and audit event', async () => {
    let capturedAudit: any = null;
    dataService.logAudit = async (data) => {
      capturedAudit = data;
    };

    dataService.createUser = async (data) => {
      return {
        user: {
          id: 'user_new_1',
          email: data.email.toLowerCase(),
          emailNormalized: data.email.toLowerCase(),
          name: `${data.firstName} ${data.lastName}`,
          firstName: data.firstName,
          lastName: data.lastName,
          displayName: `${data.firstName} ${data.lastName}`,
          country: data.country,
          emailVerified: false,
          tokenVersion: 1,
          status: 'ACTIVE',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      };
    };

    dataService.createSession = async (userId) => {
      return {
        sessionId: 'session_123',
        refreshToken: 'refresh_tok_123',
        expiresAt: Date.now() + 7 * 86_400_000,
      };
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: {
        email: 'Adebayo.K@Orviohub.com',
        firstName: 'Adebayo',
        lastName: 'Kareem',
        country: 'NG',
        password: 'Password123!',
        acceptTerms: true,
      },
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.equal(body.data.user.firstName, 'Adebayo');
    assert.equal(body.data.user.lastName, 'Kareem');
    assert.equal(body.data.user.country, 'NG');
    assert.ok(body.data.token);
    assert.equal(body.data.refreshToken, 'refresh_tok_123');
    assert.equal(capturedAudit?.eventType, AUDIT_EVENTS.AUTH_SIGNUP_COMPLETED);
    assert.equal(capturedAudit?.actorUserId, 'user_new_1');
  });

  test('3. Login generates valid JWT, session, and logs AUTH_LOGIN_SUCCESS', async () => {
    let capturedAudit: any = null;
    dataService.logAudit = async (data) => {
      capturedAudit = data;
    };

    const mockUser: UserRecord = {
      id: 'user_456',
      email: 'owner@business.ng',
      emailNormalized: 'owner@business.ng',
      name: 'Chioma Okeke',
      firstName: 'Chioma',
      lastName: 'Okeke',
      displayName: 'Chioma Okeke',
      country: 'NG',
      emailVerified: true,
      tokenVersion: 1,
      status: 'ACTIVE',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    dataService.getUserByEmail = async () => mockUser;
    dataService.verifyPassword = async () => true;
    dataService.createSession = async () => ({
      sessionId: 'session_456',
      refreshToken: 'refresh_456',
      expiresAt: Date.now() + 7 * 86_400_000,
    });
    dataService.getOnboardingStatus = async () => ({
      status: 'COMPLETED',
      currentStep: 'COMPLETED',
      completedSteps: ['ACCOUNT_CREATED', 'EMAIL_VERIFIED'],
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'owner@business.ng',
        password: 'SecurePassword123!',
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.equal(body.data.user.displayName, 'Chioma Okeke');
    assert.equal(body.data.refreshToken, 'refresh_456');
    assert.equal(capturedAudit?.eventType, AUDIT_EVENTS.AUTH_LOGIN_SUCCESS);
    assert.equal(capturedAudit?.actorUserId, 'user_456');
  });

  test('4. GET /api/v1/auth/session returns authenticated session context', async () => {
    dataService.getUserById = async (id) => ({
      id,
      email: 'user@orvio.ng',
      name: 'Emeka Obi',
      firstName: 'Emeka',
      lastName: 'Obi',
      displayName: 'Emeka Obi',
      country: 'NG',
      timezone: 'Africa/Lagos',
      emailVerified: true,
      tokenVersion: 1,
      status: 'ACTIVE',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const token = app.jwt.sign({
      userId: 'user_emeka',
      email: 'user@orvio.ng',
      sessionId: 'sess_emeka_1',
      tokenVersion: 1,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/session',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.equal(body.data.user.firstName, 'Emeka');
    assert.equal(body.data.session.id, 'sess_emeka_1');
    assert.equal(body.data.session.tokenVersion, 1);
  });

  test('5. POST /api/v1/auth/logout-all revokes all sessions and emits audit event', async () => {
    let logoutAllCalled = false;
    let capturedAudit: any = null;

    dataService.getUserById = async (id) => ({
      id,
      email: 'test@orvio.ng',
      name: 'Test User',
      emailVerified: true,
      tokenVersion: 1,
      status: 'ACTIVE',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    dataService.logoutAllSessions = async (userId) => {
      logoutAllCalled = true;
      assert.equal(userId, 'user_test_1');
      return { success: true };
    };

    dataService.logAudit = async (data) => {
      capturedAudit = data;
    };

    const token = app.jwt.sign({ userId: 'user_test_1', email: 'test@orvio.ng', tokenVersion: 1 });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout-all',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.equal(logoutAllCalled, true);
    assert.equal(capturedAudit?.eventType, AUDIT_EVENTS.AUTH_LOGOUT_ALL);
  });

  test('6. GET /api/v1/users/me/sessions lists active devices and DELETE revokes session', async () => {
    let revokedSessionId: string | undefined;

    dataService.getUserById = async (id) => ({
      id,
      email: 'test@orvio.ng',
      name: 'Test User',
      emailVerified: true,
      tokenVersion: 1,
      status: 'ACTIVE',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    dataService.getUserSessions = async (userId) => [
      {
        id: 'sess_device_1',
        deviceName: 'MacBook Pro',
        userAgent: 'Mozilla/5.0...',
        ipAddress: '197.210.50.1',
        authenticationMethod: 'password',
        createdAt: Date.now() - 10000,
        lastActiveAt: Date.now(),
        expiresAt: Date.now() + 600000,
        isRevoked: false,
        isExpired: false,
      },
      {
        id: 'sess_device_2',
        deviceName: 'Android Mobile',
        userAgent: 'Mozilla/5.0 Android',
        ipAddress: '197.210.50.2',
        authenticationMethod: 'google',
        createdAt: Date.now() - 20000,
        lastActiveAt: Date.now() - 5000,
        expiresAt: Date.now() + 600000,
        isRevoked: false,
        isExpired: false,
      },
    ];

    dataService.revokeSessionById = async (sessionId, userId) => {
      revokedSessionId = sessionId;
      assert.equal(userId, 'user_test_1');
      return { success: true };
    };

    const token = app.jwt.sign({ userId: 'user_test_1', email: 'test@orvio.ng', tokenVersion: 1 });

    // 1. List sessions
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me/sessions',
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(listRes.statusCode, 200);
    const listBody = JSON.parse(listRes.payload);
    assert.equal(listBody.data.sessions.length, 2);
    assert.equal(listBody.data.sessions[0].id, 'sess_device_1');

    // 2. Revoke remote session
    const delRes = await app.inject({
      method: 'DELETE',
      url: '/api/v1/users/me/sessions/sess_device_2',
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(delRes.statusCode, 200);
    assert.equal(revokedSessionId, 'sess_device_2');
  });

  test('7. Identity unlinking: rejects removing last remaining login method', async () => {
    dataService.getUserById = async (id) => ({
      id,
      email: 'test@orvio.ng',
      name: 'Test User',
      emailVerified: true,
      tokenVersion: 1,
      status: 'ACTIVE',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    dataService.unlinkIdentity = async () => {
      const err: Error & { code?: string } = new Error('CANNOT_REMOVE_ONLY_LOGIN_METHOD');
      err.code = 'CANNOT_REMOVE_ONLY_LOGIN_METHOD';
      throw err;
    };

    const token = app.jwt.sign({ userId: 'user_test_1', email: 'test@orvio.ng', tokenVersion: 1 });

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/v1/users/me/identities/ident_only_one',
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, false);
    assert.equal(body.error.code, ERROR_CODES.CANNOT_REMOVE_ONLY_LOGIN_METHOD);
    assert.ok(body.error.message.includes('cannot remove your only login method'));
  });

  test('8. PATCH /api/v1/users/me updates profile fields and emits audit event', async () => {
    let capturedAudit: any = null;
    dataService.logAudit = async (data) => {
      capturedAudit = data;
    };

    dataService.getUserById = async (id) => ({
      id,
      email: 'test@orvio.ng',
      name: 'Old Name',
      firstName: 'Old',
      lastName: 'Name',
      emailVerified: true,
      tokenVersion: 1,
      status: 'ACTIVE',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    dataService.updateProfile = async (userId, data) => ({
      id: userId,
      email: 'test@orvio.ng',
      name: `${data.firstName} ${data.lastName}`,
      firstName: data.firstName,
      lastName: data.lastName,
      displayName: data.displayName || `${data.firstName} ${data.lastName}`,
      phone: data.phone,
      country: data.country,
      timezone: data.timezone,
      locale: data.locale,
      emailVerified: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const token = app.jwt.sign({ userId: 'user_test_1', email: 'test@orvio.ng', tokenVersion: 1 });

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/users/me',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        firstName: 'Folake',
        lastName: 'Adeleke',
        displayName: 'Folake Adeleke',
        phone: '+2348012345678',
        country: 'NG',
        timezone: 'Africa/Lagos',
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.equal(body.data.user.firstName, 'Folake');
    assert.equal(body.data.user.phone, '+2348012345678');
    assert.equal(capturedAudit?.eventType, AUDIT_EVENTS.USER_PROFILE_UPDATED);
  });
});
