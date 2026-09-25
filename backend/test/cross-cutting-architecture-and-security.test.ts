import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { dataService } from '../src/services/dataService.js';
import { ERROR_CODES, AUDIT_EVENTS } from '../src/config/constants.js';
import { checkBreachedPassword, clearBreachedPasswordCache } from '../src/utils/breachedPassword.js';

describe('Cross-Cutting Architecture and Security Test Suite', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  const originalGetUserById = dataService.getUserById;
  const originalGetUserByEmail = dataService.getUserByEmail;
  const originalGetUserSessions = dataService.getUserSessions;
  const originalCreateUser = dataService.createUser;
  const originalResetPassword = dataService.resetPassword;
  const originalChangePassword = dataService.changePassword;
  const originalVerifyPassword = dataService.verifyPassword;
  const originalCreateSession = dataService.createSession;
  const originalLogAuthEvent = dataService.logAuthEvent;
  const originalLogAudit = dataService.logAudit;

  beforeEach(async () => {
    clearBreachedPasswordCache();
    app = await buildApp();
  });

  afterEach(() => {
    dataService.getUserById = originalGetUserById;
    dataService.getUserByEmail = originalGetUserByEmail;
    dataService.getUserSessions = originalGetUserSessions;
    dataService.createUser = originalCreateUser;
    dataService.resetPassword = originalResetPassword;
    dataService.changePassword = originalChangePassword;
    dataService.verifyPassword = originalVerifyPassword;
    dataService.createSession = originalCreateSession;
    dataService.logAuthEvent = originalLogAuthEvent;
    dataService.logAudit = originalLogAudit;
  });

  describe('1. HaveIBeenPwned k-Anonymity Breached Password Service', () => {
    test('Identifies known compromised passwords (e.g. P@ssword123!) via HIBP range API', async () => {
      const result = await checkBreachedPassword('P@ssword123!');
      assert.equal(result.isBreached, true, 'Known compromised password should be detected');
      assert.ok(result.count > 0, 'Breach count should be positive');
      assert.equal(result.checked, true);
    });

    test('Passes unique high-entropy passwords that have not been exposed in breaches', async () => {
      const uniquePass = `X9#mQ2$zL8!vW4@jP7&bT3^nC5*${Date.now()}`;
      const result = await checkBreachedPassword(uniquePass);
      assert.equal(result.isBreached, false, 'Unique random password should not be flagged as breached');
      assert.equal(result.count, 0);
      assert.equal(result.checked, true);
    });

    test('Leverages in-memory cache on subsequent checks with identical prefix', async () => {
      const pass = 'P@ssword123!';
      const res1 = await checkBreachedPassword(pass);
      const res2 = await checkBreachedPassword(pass);
      assert.equal(res1.isBreached, res2.isBreached);
      assert.equal(res1.count, res2.count);
    });

    test('Fails open gracefully when timeout expires without throwing', async () => {
      // 1ms timeout will trigger abort/fail-open
      const result = await checkBreachedPassword('AnyPassword123!', 1);
      assert.equal(result.isBreached, false, 'Should fail open on network timeout');
      assert.equal(result.checked, false);
    });
  });

  describe('2. Endpoint Enforcement for Breached Passwords', () => {
    test('POST /api/v1/auth/signup rejects breached passwords with PASSWORD_BREACHED', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: {
          email: 'breachtest@example.com',
          name: 'Breach Tester',
          password: 'Password123!', // Known breached password
        },
      });

      assert.equal(res.statusCode, 400);
      const body = JSON.parse(res.payload);
      assert.equal(body.success, false);
      assert.equal(body.error.code, ERROR_CODES.PASSWORD_BREACHED);
      assert.ok(body.error.message.includes('public data breach'));
    });

    test('POST /api/v1/auth/reset-password rejects breached passwords with PASSWORD_BREACHED', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/reset-password',
        payload: {
          token: 'some_valid_or_dummy_token',
          password: 'Password123!', // Known breached password
        },
      });

      assert.equal(res.statusCode, 400);
      const body = JSON.parse(res.payload);
      assert.equal(body.success, false);
      assert.equal(body.error.code, ERROR_CODES.PASSWORD_BREACHED);
      assert.ok(body.error.message.includes('public data breach'));
    });

    test('POST /api/v1/auth/change-password rejects breached passwords with PASSWORD_BREACHED', async () => {
      dataService.getUserById = async (id: string) => ({
        id,
        email: 'user@example.com',
        name: 'Test User',
        emailVerified: true,
        tokenVersion: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const token = app.jwt.sign({
        userId: 'user_change_1',
        email: 'user@example.com',
        sessionId: 'sess_1',
        tokenVersion: 1,
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/change-password',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          currentPassword: 'CurrentPassword123!',
          newPassword: 'Password123!', // Known breached password
        },
      });

      assert.equal(res.statusCode, 400);
      const body = JSON.parse(res.payload);
      assert.equal(body.success, false);
      assert.equal(body.error.code, ERROR_CODES.PASSWORD_BREACHED);
      assert.ok(body.error.message.includes('public data breach'));
    });
  });

  describe('3. Geo and Device Anomaly Detection on Login', () => {
    test('Flags unrecognized IP & device as anomaly and emits security audit event', async () => {
      const loggedAuthEvents: any[] = [];
      const loggedAuditEvents: any[] = [];

      dataService.getUserByEmail = async (email: string) => ({
        id: 'user_anomaly_1',
        email,
        name: 'Anomaly Test User',
        emailVerified: true,
        tokenVersion: 1,
        status: 'ACTIVE',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      dataService.verifyPassword = async () => true;

      // Existing sessions from a completely different device and IP
      dataService.getUserSessions = async () => [
        {
          id: 'sess_old_1',
          deviceId: 'dev_original_macbook',
          ipAddress: '192.168.1.50',
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        },
      ];

      dataService.createSession = async (_userId, opts: any) => ({
        sessionId: 'sess_new_anomaly_device',
        refreshToken: 'refr_abc_123',
        expiresAt: Date.now() + 7 * 86_400_000,
        ...opts,
      });

      dataService.getOnboardingStatus = async () => ({
        status: 'COMPLETED' as const,
        currentStep: 'COMPLETED' as const,
      });

      dataService.getUserMemberships = async () => [];

      dataService.logAuthEvent = async (event: any) => {
        loggedAuthEvents.push(event);
      };
      dataService.logAudit = async (audit: any) => {
        loggedAuditEvents.push(audit);
      };

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: {
          'x-forwarded-for': '203.0.113.195', // Brand new foreign IP
          'user-agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 8)', // Brand new mobile device
        },
        payload: {
          email: 'user@example.com',
          password: 'ValidPassword123!',
          deviceId: 'dev_brand_new_phone',
        },
      });

      assert.equal(res.statusCode, 200);

      // Verify that login anomaly and new device audit events were logged
      const anomalyAuthEvent = loggedAuthEvents.find((e) => e.eventType === 'login_anomaly_detected');
      assert.ok(anomalyAuthEvent, 'Should log login_anomaly_detected auth event');
      assert.equal(anomalyAuthEvent.metadata?.reason, 'UNRECOGNIZED_DEVICE_AND_IP');

      const newDeviceAudit = loggedAuditEvents.find(
        (a) => a.eventType === AUDIT_EVENTS.AUTH_NEW_DEVICE_DETECTED
      );
      assert.ok(newDeviceAudit, 'Should log AUTH_NEW_DEVICE_DETECTED audit event');
    });

    test('Does NOT flag anomaly when login is from a recognized device or IP', async () => {
      const loggedAuthEvents: any[] = [];
      const loggedAuditEvents: any[] = [];

      dataService.getUserByEmail = async (email: string) => ({
        id: 'user_anomaly_2',
        email,
        name: 'Regular User',
        emailVerified: true,
        tokenVersion: 1,
        status: 'ACTIVE',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      dataService.verifyPassword = async () => true;

      // Existing session with known device ID and IP
      dataService.getUserSessions = async () => [
        {
          id: 'sess_known_1',
          deviceId: 'dev_known_workstation',
          ipAddress: '127.0.0.1',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
      ];

      dataService.createSession = async (_userId, opts: any) => ({
        sessionId: 'sess_regular_login',
        refreshToken: 'refr_def_456',
        expiresAt: Date.now() + 7 * 86_400_000,
        ...opts,
      });

      dataService.getOnboardingStatus = async () => ({
        status: 'COMPLETED' as const,
        currentStep: 'COMPLETED' as const,
      });

      dataService.getUserMemberships = async () => [];

      dataService.logAuthEvent = async (event: any) => {
        loggedAuthEvents.push(event);
      };
      dataService.logAudit = async (audit: any) => {
        loggedAuditEvents.push(audit);
      };

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
        payload: {
          email: 'user@example.com',
          password: 'ValidPassword123!',
          deviceId: 'dev_known_workstation', // Same recognized device
        },
      });

      assert.equal(res.statusCode, 200);

      // Verify that NO anomaly was logged
      const anomalyAuthEvent = loggedAuthEvents.find((e) => e.eventType === 'login_anomaly_detected');
      assert.equal(anomalyAuthEvent, undefined, 'Should not log anomaly for recognized device');

      const newDeviceAudit = loggedAuditEvents.find(
        (a) => a.eventType === AUDIT_EVENTS.AUTH_NEW_DEVICE_DETECTED
      );
      assert.equal(newDeviceAudit, undefined, 'Should not log new device audit for recognized device');
    });
  });
});
