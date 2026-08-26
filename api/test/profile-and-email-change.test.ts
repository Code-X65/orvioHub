import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { dataService } from '../src/services/dataService.js';
import { ERROR_CODES } from '../src/config/constants.js';

describe('User Profile and Email Change Flow Test Suite', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  const originalGetUserById = dataService.getUserById;
  const originalGetUserByEmail = dataService.getUserByEmail;
  const originalUpdateProfile = dataService.updateProfile;
  const originalRequestEmailChange = dataService.requestEmailChange;
  const originalConfirmEmailChange = dataService.confirmEmailChange;
  const originalCreateSession = dataService.createSession;

  beforeEach(async () => {
    app = await buildApp();
    dataService.createSession = async () => ({
      refreshToken: 'mock_refresh_token_abc',
      expiresAt: Date.now() + 7 * 86_400_000,
    });
  });

  afterEach(() => {
    dataService.getUserById = originalGetUserById;
    dataService.getUserByEmail = originalGetUserByEmail;
    dataService.updateProfile = originalUpdateProfile;
    dataService.requestEmailChange = originalRequestEmailChange;
    dataService.confirmEmailChange = originalConfirmEmailChange;
    dataService.createSession = originalCreateSession;
  });

  test('1. Profile update requires authentication', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/auth/profile',
      payload: {
        name: 'New Name',
      },
    });

    assert.equal(res.statusCode, 401);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, false);
    assert.equal(body.error.code, ERROR_CODES.UNAUTHENTICATED);
  });

  test('2. Profile update updates name and timezone for authenticated user', async () => {
    let updatedUserId: string | undefined;
    let updatedData: any;

    dataService.getUserById = async (id: string) => ({
      id,
      email: 'user@example.com',
      name: 'Original Name',
      emailVerified: true,
      tokenVersion: 0,
      status: 'ACTIVE',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    dataService.updateProfile = async (userId: string, data: any) => {
      updatedUserId = userId;
      updatedData = data;
      return {
        id: userId,
        email: 'user@example.com',
        name: data.name ?? 'Original Name',
        timezone: data.timezone,
        emailVerified: true,
        status: 'ACTIVE',
        tokenVersion: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    };

    const token = app.jwt.sign({ userId: 'user_profile_1', email: 'user@example.com', tokenVersion: 0 });

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/auth/profile',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        name: 'Jane Doe',
        timezone: 'America/New_York',
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.equal(body.data.user.name, 'Jane Doe');
    assert.equal(body.data.user.timezone, 'America/New_York');
    assert.equal(updatedUserId, 'user_profile_1');
    assert.equal(updatedData.name, 'Jane Doe');
  });

  test('3. Profile update rejects invalid input (name < 2 chars)', async () => {
    dataService.getUserById = async (id: string) => ({
      id,
      email: 'user@example.com',
      name: 'Original Name',
      emailVerified: true,
      tokenVersion: 0,
      status: 'ACTIVE',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const token = app.jwt.sign({ userId: 'user_profile_1', email: 'user@example.com', tokenVersion: 0 });

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/auth/profile',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        name: 'A',
      },
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, false);
    assert.equal(body.error.code, ERROR_CODES.VALIDATION_ERROR);
    assert.ok(body.error.fields?.name);
  });

  test('4. Email change request requires authentication', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/email/change-request',
      payload: {
        newEmail: 'newemail@example.com',
      },
    });

    assert.equal(res.statusCode, 401);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, false);
    assert.equal(body.error.code, ERROR_CODES.UNAUTHENTICATED);
  });

  test('5. Email change request rejects same email address as current', async () => {
    dataService.getUserById = async (id: string) => ({
      id,
      email: 'current@example.com',
      name: 'Test User',
      emailVerified: true,
      tokenVersion: 0,
      status: 'ACTIVE',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const token = app.jwt.sign({ userId: 'user_email_1', email: 'current@example.com', tokenVersion: 0 });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/email/change-request',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        newEmail: 'current@example.com',
      },
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, false);
    assert.equal(body.error.code, ERROR_CODES.VALIDATION_ERROR);
    assert.ok(body.error.message.includes('different'));
  });

  test('6. Email change request successfully initiates verification flow', async () => {
    let requestedUserId: string | undefined;
    let requestedNewEmail: string | undefined;

    dataService.getUserById = async (id: string) => ({
      id,
      email: 'current@example.com',
      name: 'Test User',
      emailVerified: true,
      tokenVersion: 0,
      status: 'ACTIVE',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    dataService.requestEmailChange = async (userId: string, newEmail: string) => {
      requestedUserId = userId;
      requestedNewEmail = newEmail;
      return { success: true };
    };

    const token = app.jwt.sign({ userId: 'user_email_1', email: 'current@example.com', tokenVersion: 0 });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/email/change-request',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        newEmail: 'newemail@example.com',
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.equal(requestedUserId, 'user_email_1');
    assert.equal(requestedNewEmail, 'newemail@example.com');
  });

  test('7. Email change request returns 409 when new email is already in use', async () => {
    dataService.getUserById = async (id: string) => ({
      id,
      email: 'current@example.com',
      name: 'Test User',
      emailVerified: true,
      tokenVersion: 0,
      status: 'ACTIVE',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    dataService.requestEmailChange = async () => {
      const err: Error & { code?: string } = new Error('Email is already in use by another account.');
      err.code = 'CONFLICT';
      throw err;
    };

    const token = app.jwt.sign({ userId: 'user_email_1', email: 'current@example.com', tokenVersion: 0 });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/email/change-request',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        newEmail: 'taken@example.com',
      },
    });

    assert.equal(res.statusCode, 409);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, false);
    assert.equal(body.error.code, ERROR_CODES.CONFLICT);
  });

  test('8. Confirm email change updates email and returns new authenticated JWT', async () => {
    let confirmedToken: string | undefined;

    dataService.confirmEmailChange = async (token: string) => {
      confirmedToken = token;
      return {
        user: {
          id: 'user_email_1',
          email: 'brandnew@example.com',
          name: 'Test User',
          emailVerified: true,
          tokenVersion: 0,
          status: 'ACTIVE' as const,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      };
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/email/confirm-change',
      payload: {
        token: 'valid_email_change_token_123',
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.equal(confirmedToken, 'valid_email_change_token_123');
    assert.equal(body.data.user.email, 'brandnew@example.com');
    assert.ok(body.data.token);

    // Verify the returned JWT contains updated email
    const decoded = app.jwt.verify(body.data.token) as any;
    assert.equal(decoded.email, 'brandnew@example.com');
    assert.equal(decoded.userId, 'user_email_1');
  });

  test('9. Confirm email change returns 400 for invalid/expired token', async () => {
    dataService.confirmEmailChange = async () => {
      const err: Error & { code?: string } = new Error('Token has expired.');
      err.code = 'TOKEN_EXPIRED';
      throw err;
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/email/confirm-change',
      payload: {
        token: 'expired_token_123',
      },
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, false);
    assert.equal(body.error.code, ERROR_CODES.TOKEN_EXPIRED);
  });
});
