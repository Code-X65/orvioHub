import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { dataService, type UserRecord } from '../src/services/dataService.js';
import { totpService } from '../src/services/totp.js';
import { ERROR_CODES } from '../src/config/constants.js';

describe('Password Strength & 2FA (TOTP) Test Suite', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  const originalCreateUser = dataService.createUser;
  const originalGetUserByEmail = dataService.getUserByEmail;
  const originalGetUserById = dataService.getUserById;
  const originalVerifyPassword = dataService.verifyPassword;
  const originalResetPassword = dataService.resetPassword;
  const originalCreateSession = dataService.createSession;
  const originalGetOnboardingStatus = dataService.getOnboardingStatus;
  const originalEnableTwoFactorStart = dataService.enableTwoFactorStart;
  const originalVerifyAndActivateTwoFactor = dataService.verifyAndActivateTwoFactor;
  const originalDisableTwoFactor = dataService.disableTwoFactor;
  const originalVerifyTwoFactorLogin = dataService.verifyTwoFactorLogin;

  const mockUser: UserRecord = {
    id: 'user_2fa_1',
    email: '2fa@example.com',
    name: '2FA User',
    emailVerified: true,
    status: 'ACTIVE',
    tokenVersion: 0,
    twoFactorEnabled: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  beforeEach(async () => {
    app = await buildApp();
    dataService.getUserById = async (id: string) => {
      return { ...mockUser, id };
    };
  });

  afterEach(() => {
    dataService.createUser = originalCreateUser;
    dataService.getUserByEmail = originalGetUserByEmail;
    dataService.getUserById = originalGetUserById;
    dataService.verifyPassword = originalVerifyPassword;
    dataService.resetPassword = originalResetPassword;
    dataService.createSession = originalCreateSession;
    dataService.getOnboardingStatus = originalGetOnboardingStatus;
    dataService.enableTwoFactorStart = originalEnableTwoFactorStart;
    dataService.verifyAndActivateTwoFactor = originalVerifyAndActivateTwoFactor;
    dataService.disableTwoFactor = originalDisableTwoFactor;
    dataService.verifyTwoFactorLogin = originalVerifyTwoFactorLogin;
  });

  describe('1. Password Strength and Complexity Enforcement', () => {
    test('Rejects passwords shorter than 8 characters', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: {
          email: 'short@example.com',
          name: 'Short Pass',
          password: 'Aa1!',
        },
      });

      assert.equal(res.statusCode, 400);
    });

    test('Rejects passwords missing uppercase letters', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: {
          email: 'noupper@example.com',
          name: 'No Upper',
          password: 'password123!',
        },
      });

      assert.equal(res.statusCode, 400);
      const body = JSON.parse(res.payload);
      assert.equal(body.success, false);
      assert.equal(body.error.code, ERROR_CODES.VALIDATION_ERROR);
    });

    test('Rejects passwords missing lowercase letters', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: {
          email: 'nolower@example.com',
          name: 'No Lower',
          password: 'PASSWORD123!',
        },
      });

      assert.equal(res.statusCode, 400);
      const body = JSON.parse(res.payload);
      assert.equal(body.success, false);
      assert.equal(body.error.code, ERROR_CODES.VALIDATION_ERROR);
    });

    test('Rejects passwords missing numbers', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: {
          email: 'nonum@example.com',
          name: 'No Number',
          password: 'PasswordSecret!',
        },
      });

      assert.equal(res.statusCode, 400);
      const body = JSON.parse(res.payload);
      assert.equal(body.success, false);
      assert.equal(body.error.code, ERROR_CODES.VALIDATION_ERROR);
    });

    test('Rejects passwords missing special characters', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: {
          email: 'nosymbol@example.com',
          name: 'No Symbol',
          password: 'Password12345',
        },
      });

      assert.equal(res.statusCode, 400);
      const body = JSON.parse(res.payload);
      assert.equal(body.success, false);
      assert.equal(body.error.code, ERROR_CODES.VALIDATION_ERROR);
    });

    test('Rejects common weak passwords even if length is met', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: {
          email: 'weak@example.com',
          name: 'Weak Pass',
          password: 'password123',
        },
      });

      assert.equal(res.statusCode, 400);
      const body = JSON.parse(res.payload);
      assert.equal(body.success, false);
      assert.equal(body.error.code, ERROR_CODES.VALIDATION_ERROR);
    });

    test('Accepts compliant complex password on signup', async () => {
      dataService.createUser = async (data) => ({
        user: {
          id: 'user_strong_1',
          email: data.email,
          name: data.name,
          emailVerified: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      });
      dataService.createSession = async () => ({
        refreshToken: 'refresh_strong_1',
        expiresAt: Date.now() + 604800000,
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: {
          email: 'strong@example.com',
          name: 'Strong Pass',
          password: 'Secure#P@ssw0rd2026!',
        },
      });

      assert.equal(res.statusCode, 201);
      const body = JSON.parse(res.payload);
      assert.equal(body.success, true);
      assert.equal(body.data.user.email, 'strong@example.com');
      assert.ok(body.data.token);
    });
  });

  describe('2. TOTP Service Core Functionality', () => {
    test('Generates valid Base32 secret', () => {
      const secret = totpService.generateBase32Secret(20);
      assert.ok(secret);
      assert.equal(typeof secret, 'string');
      assert.ok(/^[A-Z2-7]+$/.test(secret));
    });

    test('Generates and verifies matching 6-digit TOTP code', () => {
      const secret = totpService.generateBase32Secret(20);
      const now = Date.now();
      const code = totpService.generateTotpCode(secret, now);
      assert.equal(code.length, 6);
      assert.ok(/^\d{6}$/.test(code));

      const isValid = totpService.verifyTotpCode(code, secret, now);
      assert.equal(isValid, true);
    });

    test('Rejects incorrect TOTP code', () => {
      const secret = totpService.generateBase32Secret(20);
      const isValid = totpService.verifyTotpCode('000000', secret, Date.now());
      assert.equal(isValid, false);
    });

    test('Generates 8 single-use formatted backup codes', () => {
      const codes = totpService.generateBackupCodes(8);
      assert.equal(codes.length, 8);
      codes.forEach((code) => {
        assert.ok(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code));
      });
    });
  });

  describe('3. 2FA Enable & Setup Flow Endpoints', () => {
    test('POST /api/v1/auth/2fa/enable returns secret and otpauth URI for authenticated user', async () => {
      const token = app.jwt.sign({ userId: 'user_2fa_1', email: '2fa@example.com' });
      dataService.enableTwoFactorStart = async (userId: string) => {
        assert.equal(userId, 'user_2fa_1');
        return {
          secret: 'JBSWY3DPEHPK3PXP',
          otpauthUrl: 'otpauth://totp/OrvioHub:2fa%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=OrvioHub',
        };
      };

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/2fa/enable',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.equal(body.success, true);
      assert.equal(body.data.secret, 'JBSWY3DPEHPK3PXP');
      assert.ok(body.data.otpauthUrl.includes('otpauth://totp/'));
    });

    test('POST /api/v1/auth/2fa/verify validates TOTP code and returns recovery backup codes', async () => {
      const token = app.jwt.sign({ userId: 'user_2fa_1', email: '2fa@example.com' });
      dataService.verifyAndActivateTwoFactor = async (userId: string, code: string) => {
        assert.equal(userId, 'user_2fa_1');
        assert.equal(code, '123456');
        return {
          success: true,
          backupCodes: ['ABCD-1234', 'EFGH-5678', 'JKLM-9012'],
        };
      };

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/2fa/verify',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          code: '123456',
        },
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.equal(body.success, true);
      assert.equal(body.data.backupCodes.length, 3);
    });

    test('POST /api/v1/auth/2fa/verify returns 400 with INVALID_2FA_CODE on wrong code', async () => {
      const token = app.jwt.sign({ userId: 'user_2fa_1', email: '2fa@example.com' });
      dataService.verifyAndActivateTwoFactor = async () => {
        const err: Error & { code?: string } = new Error('Invalid verification code.');
        err.code = 'INVALID_2FA_CODE';
        throw err;
      };

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/2fa/verify',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          code: '000000',
        },
      });

      assert.equal(res.statusCode, 400);
      const body = JSON.parse(res.payload);
      assert.equal(body.success, false);
      assert.equal(body.error.code, ERROR_CODES.INVALID_2FA_CODE);
    });
  });

  describe('4. 2FA Login Challenge & Resolution', () => {
    test('POST /api/v1/auth/login returns twoFactorRequired: true and tempToken when 2FA is active', async () => {
      dataService.getUserByEmail = async () => ({
        id: 'user_2fa_active',
        email: 'active2fa@example.com',
        name: '2FA User',
        emailVerified: true,
        twoFactorEnabled: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      dataService.verifyPassword = async () => true;

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'active2fa@example.com',
          password: 'Password123!',
        },
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.equal(body.success, true);
      assert.equal(body.data.twoFactorRequired, true);
      assert.ok(body.data.tempToken);

      const decoded = app.jwt.verify(body.data.tempToken) as any;
      assert.equal(decoded.userId, 'user_2fa_active');
      assert.equal(decoded.is2faPending, true);
    });

    test('POST /api/v1/auth/2fa/login-verify completes login with valid TOTP code', async () => {
      const tempToken = app.jwt.sign({
        userId: 'user_2fa_active',
        email: 'active2fa@example.com',
        is2faPending: true,
      });

      dataService.verifyTwoFactorLogin = async (userId, code) => {
        assert.equal(userId, 'user_2fa_active');
        assert.equal(code, '654321');
        return {
          user: {
            id: 'user_2fa_active',
            email: 'active2fa@example.com',
            name: '2FA User',
            emailVerified: true,
            twoFactorEnabled: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        };
      };

      dataService.createSession = async () => ({
        refreshToken: 'refresh_after_2fa',
        expiresAt: Date.now() + 604800000,
      });

      dataService.getOnboardingStatus = async () => ({
        status: 'COMPLETED',
        currentStep: 'COMPLETED',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/2fa/login-verify',
        payload: {
          tempToken,
          code: '654321',
        },
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.equal(body.success, true);
      assert.equal(body.data.user.email, 'active2fa@example.com');
      assert.ok(body.data.token);
      assert.equal(body.data.refreshToken, 'refresh_after_2fa');
      assert.equal(body.data.usedBackupCode, false);
    });

    test('POST /api/v1/auth/2fa/login-verify completes login using backup recovery code', async () => {
      const tempToken = app.jwt.sign({
        userId: 'user_2fa_active',
        email: 'active2fa@example.com',
        is2faPending: true,
      });

      dataService.verifyTwoFactorLogin = async (userId, code) => {
        assert.equal(userId, 'user_2fa_active');
        assert.equal(code, 'RECV-1234');
        return {
          user: {
            id: 'user_2fa_active',
            email: 'active2fa@example.com',
            name: '2FA User',
            emailVerified: true,
            twoFactorEnabled: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
          usedBackupCode: true,
        };
      };

      dataService.createSession = async () => ({
        refreshToken: 'refresh_after_backup_code',
        expiresAt: Date.now() + 604800000,
      });

      dataService.getOnboardingStatus = async () => ({
        status: 'COMPLETED',
        currentStep: 'COMPLETED',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/2fa/login-verify',
        payload: {
          tempToken,
          code: 'RECV-1234',
        },
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.equal(body.success, true);
      assert.equal(body.data.usedBackupCode, true);
      assert.ok(body.data.token);
    });

    test('POST /api/v1/auth/2fa/login-verify rejects expired or invalid tempToken', async () => {
      const invalidToken = app.jwt.sign({ userId: 'user_2fa_active' }); // missing is2faPending

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/2fa/login-verify',
        payload: {
          tempToken: invalidToken,
          code: '123456',
        },
      });

      assert.equal(res.statusCode, 401);
      const body = JSON.parse(res.payload);
      assert.equal(body.success, false);
      assert.equal(body.error.code, ERROR_CODES.INVALID_TOKEN);
    });
  });

  describe('5. 2FA Disable Endpoint', () => {
    test('POST /api/v1/auth/2fa/disable successfully disables 2FA with password verification', async () => {
      const token = app.jwt.sign({ userId: 'user_disable_2fa', email: 'disable@example.com' });
      let disableCalled = false;

      dataService.disableTwoFactor = async (userId, password) => {
        assert.equal(userId, 'user_disable_2fa');
        assert.equal(password, 'ValidPassword123!');
        disableCalled = true;
        return { success: true };
      };

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/2fa/disable',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          password: 'ValidPassword123!',
        },
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.equal(body.success, true);
      assert.equal(disableCalled, true);
    });

    test('POST /api/v1/auth/2fa/disable returns 401 on incorrect password', async () => {
      const token = app.jwt.sign({ userId: 'user_disable_2fa', email: 'disable@example.com' });

      dataService.disableTwoFactor = async () => {
        const err: Error & { code?: string } = new Error('Incorrect password.');
        err.code = 'INVALID_CREDENTIALS';
        throw err;
      };

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/2fa/disable',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          password: 'WrongPassword!',
        },
      });

      assert.equal(res.statusCode, 401);
      const body = JSON.parse(res.payload);
      assert.equal(body.success, false);
      assert.equal(body.error.code, ERROR_CODES.INVALID_CREDENTIALS);
    });
  });
});
