import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { dataService } from '../src/services/dataService.js';
import { ERROR_CODES } from '../src/config/constants.js';

describe('Server-Side Logout and Login Rate Limiting Test Suite', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  const originalGetUserById = dataService.getUserById;
  const originalGetUserByEmail = dataService.getUserByEmail;
  const originalLogoutUser = dataService.logoutUser;

  beforeEach(async () => {
    app = await buildApp();
  });

  afterEach(() => {
    dataService.getUserById = originalGetUserById;
    dataService.getUserByEmail = originalGetUserByEmail;
    dataService.logoutUser = originalLogoutUser;
  });

  test('1. Logout endpoint requires authentication', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
    });

    assert.equal(res.statusCode, 401);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, false);
    assert.equal(body.error.code, ERROR_CODES.UNAUTHENTICATED);
  });

  test('2. Logout endpoint successfully revokes session and invokes logoutUser', async () => {
    let loggedOutUserId: string | undefined;
    dataService.getUserById = async (id: string) => ({
      id,
      email: 'user@example.com',
      name: 'Active User',
      emailVerified: true,
      tokenVersion: 0,
      status: 'ACTIVE',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    dataService.logoutUser = async (userId: string) => {
      loggedOutUserId = userId;
      return { success: true };
    };

    const token = app.jwt.sign({ userId: 'user_123', email: 'user@example.com', tokenVersion: 0 });

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
    assert.equal(loggedOutUserId, 'user_123');
    assert.equal(body.message, 'Successfully logged out.');
  });

  test('3. Token version mismatch (after session revocation) rejects authentication', async () => {
    // User tokenVersion has been incremented to 1 on server
    dataService.getUserById = async (id: string) => ({
      id,
      email: 'user@example.com',
      name: 'Active User',
      emailVerified: true,
      tokenVersion: 1,
      status: 'ACTIVE',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Old token signed with tokenVersion: 0
    const oldToken = app.jwt.sign({ userId: 'user_123', email: 'user@example.com', tokenVersion: 0 });

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

  test('4. Suspended or inactive account is rejected by authentication middleware', async () => {
    dataService.getUserById = async (id: string) => ({
      id,
      email: 'suspended@example.com',
      name: 'Suspended User',
      emailVerified: true,
      tokenVersion: 0,
      status: 'SUSPENDED',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const token = app.jwt.sign({ userId: 'user_suspended', email: 'suspended@example.com', tokenVersion: 0 });

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
    assert.ok(body.error.message.includes('Account is inactive or suspended'));
  });

  test('5. Login endpoint rate limiting: blocks after 5 attempts', async () => {
    dataService.getUserByEmail = async () => null;

    // Send 5 login requests from the same client IP
    for (let i = 0; i < 5; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        remoteAddress: '192.168.1.50',
        payload: {
          email: 'test@example.com',
          password: 'WrongPassword123!',
        },
      });
      assert.equal(res.statusCode, 401);
    }

    // 6th attempt should be blocked by rate limiter
    const rateLimitedRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      remoteAddress: '192.168.1.50',
      payload: {
        email: 'test@example.com',
        password: 'WrongPassword123!',
      },
    });

    assert.equal(rateLimitedRes.statusCode, 429);
    const body = JSON.parse(rateLimitedRes.payload);
    assert.equal(body.statusCode, 429);
  });

  test('6. User account lockout: locks account after 5 consecutive failed passwords', async () => {
    let failedAttempts = 0;
    let lockedUntil: number | undefined;

    const mockUser = {
      id: 'usr_lockout_test',
      email: 'lockout@example.com',
      name: 'Lockout Target',
      passwordHash: '$2a$12$invalidhashfortesting',
      emailVerified: true,
      tokenVersion: 1,
      status: 'ACTIVE' as const,
      failedLoginAttempts: 0,
      lockedUntil: undefined as number | undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    dataService.getUserByEmail = async (email: string) => {
      if (email === 'lockout@example.com') {
        return { ...mockUser, failedLoginAttempts: failedAttempts, lockedUntil };
      }
      return null;
    };

    dataService.recordFailedLogin = async () => {
      failedAttempts++;
      const isLocked = failedAttempts >= 5;
      if (isLocked) {
        lockedUntil = Date.now() + 15 * 60 * 1000;
      }
      return { failedAttempts, isLocked, lockedUntil };
    };

    // 4 failed attempts from unique IPs -> returns 401
    for (let i = 1; i <= 4; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        remoteAddress: `10.0.0.${i}`,
        payload: {
          email: 'lockout@example.com',
          password: 'WrongPassword!',
        },
      });
      assert.equal(res.statusCode, 401);
      const body = JSON.parse(res.payload);
      assert.equal(body.success, false);
    }

    // 5th failed attempt -> locks account and returns 429 ACCOUNT_LOCKED
    const fifthRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      remoteAddress: '10.0.0.5',
      payload: {
        email: 'lockout@example.com',
        password: 'WrongPassword!',
      },
    });

    assert.equal(fifthRes.statusCode, 429);
    const fifthBody = JSON.parse(fifthRes.payload);
    assert.equal(fifthBody.success, false);
    assert.equal(fifthBody.error.code, 'ACCOUNT_LOCKED');
    assert.ok(fifthBody.error.message.includes('15 minutes'));

    // Subsequent attempt while locked returns 429 ACCOUNT_LOCKED
    const lockedRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      remoteAddress: '10.0.0.6',
      payload: {
        email: 'lockout@example.com',
        password: 'WrongPassword!',
      },
    });

    assert.equal(lockedRes.statusCode, 429);
    const lockedBody = JSON.parse(lockedRes.payload);
    assert.equal(lockedBody.error.code, 'ACCOUNT_LOCKED');
  });
});
