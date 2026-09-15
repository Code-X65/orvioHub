import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { dataService } from '../src/services/dataService.js';
import type { FastifyInstance } from 'fastify';

describe('Login Tracking, Continuity & Analytics Test Suite', () => {
  let app: FastifyInstance;
  const timestamp = Date.now();
  const testEmail = `login_tracking_${timestamp}@orviohub.localhost`;
  const testPassword = 'Password123!';
  let userId: string;
  let userToken: string;
  let userRefreshToken: string;
  let sessionId: string;

  before(async () => {
    app = await buildApp();
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  test('1. Failed login logs login_failed event for non-existent and wrong-password attempts', async () => {
    // Attempt login with non-existent user
    const unknownRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: `unknown_${timestamp}@orviohub.localhost`,
        password: 'WrongPassword123!',
      },
    });
    assert.strictEqual(unknownRes.statusCode, 401);

    // Signup user
    const signupRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: {
        name: 'Tracking User',
        email: testEmail,
        password: testPassword,
      },
    });
    assert.strictEqual(signupRes.statusCode, 201);
    const signupBody = JSON.parse(signupRes.payload);
    userId = signupBody.data.user.id;

    // Verify email to enable full active session
    const rawUser = await dataService.getUserByEmail(testEmail);
    assert.ok(rawUser?.emailVerificationToken);
    const verifyRes = await app.inject({
      method: 'GET',
      url: `/api/v1/auth/verify-email?token=${rawUser.emailVerificationToken}&email=${encodeURIComponent(testEmail)}`,
    });
    assert.strictEqual(verifyRes.statusCode, 200);

    // Verify email_verified event was recorded
    const eventsAfterVerify = await dataService.getUserAuthEvents(userId);
    const verifiedEvent = eventsAfterVerify.find((e) => e.eventType === 'email_verified');
    assert.ok(verifiedEvent, 'email_verified event must be recorded');

    // Attempt login with WRONG password
    const wrongPassRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: testEmail,
        password: 'WrongPassword!',
      },
    });
    assert.strictEqual(wrongPassRes.statusCode, 401);

    // Verify login_failed event was recorded for this user
    const eventsAfterFail = await dataService.getUserAuthEvents(userId);
    const failedEvent = eventsAfterFail.find((e) => e.eventType === 'login_failed');
    assert.ok(failedEvent, 'login_failed event must be recorded');
    assert.strictEqual(failedEvent?.metadata?.reason, 'INVALID_CREDENTIALS');
  });

  test('2. Successful login logs login_success, updates lastLoginAt, lastLoginIp, and increments totalLoginCount', async () => {
    const userBefore = await dataService.getUserById(userId);
    const initialCount = userBefore?.totalLoginCount || 0;

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: testEmail,
        password: testPassword,
      },
    });
    assert.strictEqual(loginRes.statusCode, 200);
    const loginBody = JSON.parse(loginRes.payload);
    userToken = loginBody.data.token;
    userRefreshToken = loginBody.data.refreshToken;
    sessionId = loginBody.data.session?.id;

    assert.ok(userToken);
    assert.ok(userRefreshToken);
    assert.ok(sessionId);

    // Verify user metrics updated
    const userAfter = await dataService.getUserById(userId);
    assert.ok(userAfter?.lastLoginAt, 'lastLoginAt must be populated');
    assert.ok(userAfter?.lastLoginIp, 'lastLoginIp must be populated');
    assert.strictEqual(userAfter?.totalLoginCount, initialCount + 1);

    // Verify login_success event was recorded
    const events = await dataService.getUserAuthEvents(userId);
    const successEvent = events.find((e) => e.eventType === 'login_success');
    assert.ok(successEvent, 'login_success event must be recorded');
    assert.strictEqual(String(successEvent?.sessionId), String(sessionId));
  });

  test('3. POST /api/v1/auth/session/context updates lastVisitedUrl and lastVisitedSubdomain', async () => {
    const contextRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/session/context',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        lastVisitedUrl: '/inventory/products?tab=stock',
        lastVisitedSubdomain: 'inventory',
      },
    });

    assert.strictEqual(contextRes.statusCode, 200);
    const contextBody = JSON.parse(contextRes.payload);
    assert.strictEqual(contextBody.success, true);
    assert.strictEqual(contextBody.data.lastVisitedUrl, '/inventory/products?tab=stock');
    assert.strictEqual(contextBody.data.lastVisitedSubdomain, 'inventory');

    // Query session directly via GET /api/v1/auth/session
    const sessionRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/session',
      headers: { authorization: `Bearer ${userToken}` },
    });
    assert.strictEqual(sessionRes.statusCode, 200);
    const sessionBody = JSON.parse(sessionRes.payload);
    assert.strictEqual(sessionBody.data.session.lastVisitedUrl, '/inventory/products?tab=stock');
    assert.strictEqual(sessionBody.data.session.lastVisitedSubdomain, 'inventory');
    assert.ok(sessionBody.data.session.lastVisitedAt);

    // Query GET /api/v1/auth/me reflects active session continuity
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${userToken}` },
    });
    assert.strictEqual(meRes.statusCode, 200);
    const meBody = JSON.parse(meRes.payload);
    assert.strictEqual(meBody.data.session.lastVisitedUrl, '/inventory/products?tab=stock');
    assert.strictEqual(meBody.data.session.lastVisitedSubdomain, 'inventory');
  });

  test('4. Password change logs password_changed authEvent', async () => {
    const newPassword = 'NewPassword456!';
    const changeRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/change-password',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        currentPassword: testPassword,
        newPassword,
      },
    });
    assert.strictEqual(changeRes.statusCode, 200);

    const events = await dataService.getUserAuthEvents(userId);
    const changedEvent = events.find((e) => e.eventType === 'password_changed');
    assert.ok(changedEvent, 'password_changed event must be recorded');

    // Login with new password to re-obtain active token
    const reLoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: testEmail,
        password: newPassword,
      },
    });
    assert.strictEqual(reLoginRes.statusCode, 200);
    const reLoginBody = JSON.parse(reLoginRes.payload);
    userToken = reLoginBody.data.token;
    userRefreshToken = reLoginBody.data.refreshToken;
    sessionId = reLoginBody.data.session?.id;
  });

  test('5. Session revocation logs session_revoked authEvent', async () => {
    const revokeRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/revoke-session',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        sessionId,
      },
    });
    assert.strictEqual(revokeRes.statusCode, 200);

    const events = await dataService.getUserAuthEvents(userId);
    const revokeEvent = events.find((e) => e.eventType === 'session_revoked');
    assert.ok(revokeEvent, 'session_revoked event must be recorded');
  });

  test('6. Logout logs logout authEvent', async () => {
    // Login fresh to get active session
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: testEmail,
        password: 'NewPassword456!',
      },
    });
    assert.strictEqual(loginRes.statusCode, 200);
    const loginBody = JSON.parse(loginRes.payload);
    const token = loginBody.data.token;
    const refreshToken = loginBody.data.refreshToken;

    const logoutRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: { authorization: `Bearer ${token}` },
      payload: { refreshToken },
    });
    assert.strictEqual(logoutRes.statusCode, 200);

    const events = await dataService.getUserAuthEvents(userId);
    const logoutEvent = events.find((e) => e.eventType === 'logout');
    assert.ok(logoutEvent, 'logout event must be recorded');
  });
});
