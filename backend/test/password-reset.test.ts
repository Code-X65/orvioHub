import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { dataService } from '../src/services/dataService.js';
import { ERROR_CODES } from '../src/config/constants.js';

describe('Password Reset and Change Password Flow Test Suite', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  const originalRequestReset = dataService.requestPasswordReset;
  const originalResetPassword = dataService.resetPassword;
  const originalChangePassword = dataService.changePassword;
  const originalGetUserById = dataService.getUserById;

  beforeEach(async () => {
    app = await buildApp();
  });

  afterEach(() => {
    dataService.requestPasswordReset = originalRequestReset;
    dataService.resetPassword = originalResetPassword;
    dataService.changePassword = originalChangePassword;
    dataService.getUserById = originalGetUserById;
  });

  test('1. Forgot password endpoint returns generic success to avoid enumeration', async () => {
    let calledWithEmail: string | undefined;
    dataService.requestPasswordReset = async (email: string) => {
      calledWithEmail = email;
      return true;
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/forgot-password',
      payload: {
        email: 'user@example.com',
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.ok(body.message.includes('If an account exists with this email'));
    assert.equal(calledWithEmail, 'user@example.com');
  });

  test('2. Forgot password rejects invalid email format', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/forgot-password',
      payload: {
        email: 'not-an-email',
      },
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, false);
    assert.equal(body.error.code, ERROR_CODES.VALIDATION_ERROR);
  });

  test('3. Reset password handles valid token and resets password', async () => {
    let resetArgs: { token: string; password: string } | undefined;
    dataService.resetPassword = async (token: string, password: string) => {
      resetArgs = { token, password };
      return {
        user: {
          id: 'user_123',
          email: 'user@example.com',
          name: 'Test User',
          emailVerified: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      };
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/reset-password',
      payload: {
        token: 'valid-reset-token-12345',
        password: 'NewSecurePassword123!',
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.equal(body.data.user.email, 'user@example.com');
    assert.equal(resetArgs?.token, 'valid-reset-token-12345');
    assert.equal(resetArgs?.password, 'NewSecurePassword123!');
  });

  test('4. Reset password rejects invalid / non-existent token', async () => {
    dataService.resetPassword = async () => {
      const err: Error & { code?: string } = new Error('INVALID_TOKEN');
      err.code = 'INVALID_TOKEN';
      throw err;
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/reset-password',
      payload: {
        token: 'invalid-token-12345',
        password: 'NewSecurePassword123!',
      },
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, false);
    assert.equal(body.error.code, ERROR_CODES.INVALID_TOKEN);
  });

  test('5. Reset password rejects expired token', async () => {
    dataService.resetPassword = async () => {
      const err: Error & { code?: string } = new Error('TOKEN_EXPIRED');
      err.code = 'TOKEN_EXPIRED';
      throw err;
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/reset-password',
      payload: {
        token: 'expired-token-12345',
        password: 'NewSecurePassword123!',
      },
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, false);
    assert.equal(body.error.code, ERROR_CODES.TOKEN_EXPIRED);
  });

  test('6. Reset password rejects short password (< 8 chars)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/reset-password',
      payload: {
        token: 'some-token',
        password: 'short',
      },
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, false);
    assert.equal(body.error.code, ERROR_CODES.VALIDATION_ERROR);
    assert.ok(body.error.fields.password);
  });

  test('7. Change password requires authentication', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/change-password',
      payload: {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword123!',
      },
    });

    assert.equal(res.statusCode, 401);
  });

  test('8. Change password updates password when authenticated and current password matches', async () => {
    dataService.getUserById = async (id: string) => ({
      id,
      email: 'user@example.com',
      name: 'Test User',
      emailVerified: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    let changeArgs: { userId: string; current: string; newPass: string } | undefined;
    dataService.changePassword = async (userId: string, currentPassword: string, newPassword: string) => {
      changeArgs = { userId, current: currentPassword, newPass: newPassword };
      return { success: true };
    };

    // Sign a mock JWT for the test
    const token = app.jwt.sign({ userId: 'user_mock_123', email: 'user@example.com' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/change-password',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        currentPassword: 'CorrectCurrentPassword123!',
        newPassword: 'BrandNewSecurePassword123!',
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.equal(changeArgs?.userId, 'user_mock_123');
    assert.equal(changeArgs?.current, 'CorrectCurrentPassword123!');
    assert.equal(changeArgs?.newPass, 'BrandNewSecurePassword123!');
  });

  test('9. Change password returns 400 when current password does not match', async () => {
    dataService.getUserById = async (id: string) => ({
      id,
      email: 'user@example.com',
      name: 'Test User',
      emailVerified: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    dataService.changePassword = async () => {
      const err: Error & { code?: string } = new Error('Current password does not match.');
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    };

    const token = app.jwt.sign({ userId: 'user_mock_123', email: 'user@example.com' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/change-password',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        currentPassword: 'WrongCurrentPassword123!',
        newPassword: 'BrandNewSecurePassword123!',
      },
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, false);
    assert.equal(body.error.code, ERROR_CODES.INVALID_CREDENTIALS);
  });
});
