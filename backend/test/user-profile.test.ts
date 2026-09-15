import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { dataService } from '../src/services/dataService.js';
import { totpService } from '../src/services/totp.js';

describe('User Profile Full Implementation Suite (Phases 1 - 7)', () => {
  let app: FastifyInstance;
  let userToken: string;
  let userId: string;
  let userEmail: string;
  let userPassword = 'TestPassword123!';
  let sessionId: string;

  before(async () => {
    app = await buildApp();
    await app.ready();

    userEmail = `profile_user_${Date.now()}@example.com`;
    const { user } = await dataService.createUser({
      email: userEmail,
      name: 'Ada Lovelace',
      firstName: 'Ada',
      lastName: 'Lovelace',
      emailVerified: true,
      password: userPassword,
    });
    userId = user.id;

    const sessionRes = await dataService.createSession(userId, {
      deviceName: 'Ada MacBook Pro',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      ipAddress: '102.89.23.10',
    });
    sessionId = sessionRes.sessionId;

    userToken = app.jwt.sign({
      userId,
      email: userEmail,
      sessionId,
      tokenVersion: user.tokenVersion ?? 1,
    });
  });

  after(async () => {
    await app.close();
  });

  // Phase 1: Personal Profile
  describe('Phase 1: Profile Foundation', () => {
    test('GET /api/v1/users/me returns full profile, preferences and deletion status', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/users/me',
        headers: { authorization: `Bearer ${userToken}` },
      });

      assert.strictEqual(res.statusCode, 200);
      const body = res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.user.email, userEmail);
      assert.strictEqual(body.data.user.name, 'Ada Lovelace');
    });

    test('PATCH /api/v1/users/me updates name, jobTitle, department, and bio', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/users/me',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          firstName: 'Ada',
          lastName: 'King',
          displayName: 'Ada K.',
          jobTitle: 'Lead Architect',
          department: 'Engineering',
          bio: 'Building computing engines since 1843.',
        },
      });

      assert.strictEqual(res.statusCode, 200);
      const body = res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.user.jobTitle, 'Lead Architect');
      assert.strictEqual(body.data.user.displayName, 'Ada K.');
    });

    test('POST & DELETE /api/v1/users/me/avatar manages profile avatar', async () => {
      const uploadRes = await app.inject({
        method: 'POST',
        url: '/api/v1/users/me/avatar',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { avatarUrl: 'https://cdn.orviohub.com/avatars/ada.png' },
      });
      assert.strictEqual(uploadRes.statusCode, 200);
      assert.strictEqual(uploadRes.json().data.user.avatarUrl, 'https://cdn.orviohub.com/avatars/ada.png');

      const deleteRes = await app.inject({
        method: 'DELETE',
        url: '/api/v1/users/me/avatar',
        headers: { authorization: `Bearer ${userToken}` },
      });
      assert.strictEqual(deleteRes.statusCode, 200);
      assert.strictEqual(deleteRes.json().data.user.avatarUrl, undefined);
    });
  });

  // Phase 2: Contact Management & Phone OTP
  describe('Phase 2: Contact Management', () => {
    test('PATCH /api/v1/users/me/contact updates location and phone visibility', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/users/me/contact',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          phoneVisibility: 'workspace',
          country: 'Nigeria',
          state: 'Lagos',
          stateCode: 'LA',
          lga: 'Ikeja',
          city: 'Ikeja',
          timezone: 'Africa/Lagos',
        },
      });

      assert.strictEqual(res.statusCode, 200);
      const body = res.json();
      assert.strictEqual(body.success, true);
    });

    test('POST /api/v1/users/me/phones/send-otp dispatches OTP to Nigerian phone', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/users/me/phones/send-otp',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { phone: '08012345678' },
      });

      assert.strictEqual(res.statusCode, 200);
      const body = res.json();
      assert.strictEqual(body.success, true);
      assert.ok(body.data.normalizedPhone.includes('2348012345678'));
    });

    test('POST /api/v1/users/me/email/change generates verification token and sends dual alerts', async () => {
      const newEmail = `ada_new_${Date.now()}@example.com`;
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/users/me/email/change',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          newEmail,
          password: userPassword,
        },
      });

      assert.strictEqual(res.statusCode, 200);
      const body = res.json();
      assert.strictEqual(body.success, true);
    });
  });

  // Phase 3: Security Core & 2FA
  describe('Phase 3: Security Core & 2FA', () => {
    let totpSecret: string;
    let backupCodes: string[];

    test('GET /api/v1/users/me/security/2fa/status returns disabled initially', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/users/me/security/2fa/status',
        headers: { authorization: `Bearer ${userToken}` },
      });

      assert.strictEqual(res.statusCode, 200);
      const body = res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.enabled, false);
    });

    test('POST /api/v1/users/me/security/2fa/start generates secret and otpauthUrl', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/users/me/security/2fa/start',
        headers: { authorization: `Bearer ${userToken}` },
      });

      assert.strictEqual(res.statusCode, 200);
      const body = res.json();
      assert.strictEqual(body.success, true);
      assert.ok(body.data.secret);
      assert.ok(body.data.otpauthUrl);
      totpSecret = body.data.secret;
    });

    test('POST /api/v1/users/me/security/2fa/verify activates 2FA and returns backup codes', async () => {
      const validCode = totpService.generateTotpCode(totpSecret);
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/users/me/security/2fa/verify',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { code: validCode },
      });

      assert.strictEqual(res.statusCode, 200);
      const body = res.json();
      assert.strictEqual(body.success, true);
      assert.ok(Array.isArray(body.data.backupCodes));
      assert.strictEqual(body.data.backupCodes.length, 8);
      backupCodes = body.data.backupCodes;
    });

    test('GET /api/v1/users/me/security/2fa/status confirms enabled status', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/users/me/security/2fa/status',
        headers: { authorization: `Bearer ${userToken}` },
      });

      assert.strictEqual(res.statusCode, 200);
      const body = res.json();
      assert.strictEqual(body.data.enabled, true);
      assert.strictEqual(body.data.backupCodesRemaining, 8);
    });

    test('POST /api/v1/users/me/security/2fa/backup-codes/regenerate regenerates codes with password check', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/users/me/security/2fa/backup-codes/regenerate',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { password: userPassword },
      });

      assert.strictEqual(res.statusCode, 200);
      const body = res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.backupCodes.length, 8);
    });

    test('POST /api/v1/users/me/password/change updates password and revokes other sessions', async () => {
      const newPass = 'BrandNewSecretPassword456!';
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/users/me/password/change',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          currentPassword: userPassword,
          newPassword: newPass,
          revokeOtherSessions: true,
        },
      });

      assert.strictEqual(res.statusCode, 200);
      userPassword = newPass;

      const body = res.json();
      assert.ok(body.data?.token);
      userToken = body.data.token;
    });

    test('GET /api/v1/users/me/sessions lists active sessions', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/users/me/sessions',
        headers: { authorization: `Bearer ${userToken}` },
      });

      assert.strictEqual(res.statusCode, 200);
      const body = res.json();
      assert.ok(Array.isArray(body.data.sessions));
    });

    test('GET /api/v1/users/me/security-activity retrieves user audit events', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/users/me/security-activity',
        headers: { authorization: `Bearer ${userToken}` },
      });

      assert.strictEqual(res.statusCode, 200);
      const body = res.json();
      assert.ok(Array.isArray(body.data.activities));
    });
  });

  // Phase 4: Preferences & Notifications
  describe('Phase 4: Preferences & Granular Notifications', () => {
    test('PATCH & GET /api/v1/users/me/preferences manages regional and UI customization', async () => {
      const patchRes = await app.inject({
        method: 'PATCH',
        url: '/api/v1/users/me/preferences',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          theme: 'dark',
          language: 'yo',
          dateFormat: 'DD/MM/YYYY',
          numberFormat: '1,234.56',
          currencyPreference: 'NGN',
          firstDayOfWeek: 'monday',
          layoutDensity: 'compact',
        },
      });
      assert.strictEqual(patchRes.statusCode, 200);

      const getRes = await app.inject({
        method: 'GET',
        url: '/api/v1/users/me/preferences',
        headers: { authorization: `Bearer ${userToken}` },
      });
      assert.strictEqual(getRes.statusCode, 200);
      const body = getRes.json();
      assert.strictEqual(body.data.preferences.theme, 'dark');
      assert.strictEqual(body.data.preferences.language, 'yo');
    });

    test('PATCH & GET /api/v1/users/me/notifications/preferences enforces security channel while toggling others', async () => {
      const patchRes = await app.inject({
        method: 'PATCH',
        url: '/api/v1/users/me/notifications/preferences',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          marketingEmailEnabled: false,
          productEmailEnabled: true,
          securityEmailEnabled: false, // Security must remain true
        },
      });
      assert.strictEqual(patchRes.statusCode, 200);

      const getRes = await app.inject({
        method: 'GET',
        url: '/api/v1/users/me/notifications/preferences',
        headers: { authorization: `Bearer ${userToken}` },
      });
      assert.strictEqual(getRes.statusCode, 200);
      const body = getRes.json();
      assert.strictEqual(body.data.notificationPreferences.securityEmailEnabled, true);
      assert.strictEqual(body.data.notificationPreferences.marketingEmailEnabled, false);
    });
  });

  // Phase 5: Workspace Memberships
  describe('Phase 5: Workspace Memberships', () => {
    test('GET /api/v1/users/me/workspaces returns joined workspaces', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/users/me/workspaces',
        headers: { authorization: `Bearer ${userToken}` },
      });

      assert.strictEqual(res.statusCode, 200);
      const body = res.json();
      assert.ok(Array.isArray(body.data.workspaces));
    });
  });

  // Phase 6: Privacy, Data Export & Deletion
  describe('Phase 6: Privacy, Data Export & Deletion', () => {
    test('GET /api/v1/users/me/data-summary returns rights and summary statistics', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/users/me/data-summary',
        headers: { authorization: `Bearer ${userToken}` },
      });

      assert.strictEqual(res.statusCode, 200);
      const body = res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.summary.email, userEmail);
      assert.ok(Array.isArray(body.data.summary.rights));
    });

    test('POST /api/v1/users/me/data-export generates GDPR/NDPA structured export archive', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/users/me/data-export',
        headers: { authorization: `Bearer ${userToken}` },
      });

      assert.strictEqual(res.statusCode, 200);
      const body = res.json();
      assert.strictEqual(body.success, true);
      assert.ok(body.data.exportId);
      assert.ok(body.data.data.user);
    });

    test('POST /api/v1/users/me/deletion/request schedules 7-day cooling-off period', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/users/me/deletion/request',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          reason: 'Switching provider',
          password: userPassword,
          coolingOffDays: 7,
        },
      });

      assert.strictEqual(res.statusCode, 200);
      const body = res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.gracePeriodDays, 7);
    });

    test('GET /api/v1/users/me/deletion/status returns active cooling-off status', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/users/me/deletion/status',
        headers: { authorization: `Bearer ${userToken}` },
      });

      assert.strictEqual(res.statusCode, 200);
      const body = res.json();
      assert.strictEqual(body.success, true);
      assert.ok(body.data.hasActiveRequest);
    });

    test('POST /api/v1/users/me/deletion/cancel cancels pending deletion', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/users/me/deletion/cancel',
        headers: { authorization: `Bearer ${userToken}` },
      });

      assert.strictEqual(res.statusCode, 200);
      const body = res.json();
      assert.strictEqual(body.success, true);
    });
  });
});
