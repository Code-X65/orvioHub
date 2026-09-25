import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { dataService } from '../src/services/dataService.js';
import { setAuthCookies, clearAuthCookies, AUTH_COOKIE_NAME, REFRESH_COOKIE_NAME } from '../src/utils/cookies.js';
import { ERROR_CODES } from '../src/config/constants.js';

describe('Section 4 Improvement Gaps Test Suite (4.1 - 4.4)', () => {
  let app: any;

  before(async () => {
    app = await buildApp({ logger: false });
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  // Gap 4.2: SameSite=Strict Option for Sensitive Operations
  describe('4.2 Configurable SameSite Cookie Mode', () => {
    test('default setAuthCookies issues SameSite=Lax cookies', async () => {
      const mockReply: any = {
        cookies: [] as any[],
        setCookie(name: string, value: string, options: any) {
          this.cookies.push({ name, value, options });
        },
      };

      setAuthCookies(mockReply, { token: 'jwt.token.1', refreshToken: 'refresh.token.1' });
      assert.ok(mockReply.cookies.length >= 2);
      for (const c of mockReply.cookies) {
        assert.equal(c.options.sameSite, 'lax');
      }
    });

    test('setAuthCookies supports sameSite: "strict" for heightened security preference', async () => {
      const mockReply: any = {
        cookies: [] as any[],
        setCookie(name: string, value: string, options: any) {
          this.cookies.push({ name, value, options });
        },
      };

      setAuthCookies(mockReply, { token: 'jwt.token.1', refreshToken: 'refresh.token.1' }, { sameSite: 'strict' });
      assert.ok(mockReply.cookies.length >= 2);
      for (const c of mockReply.cookies) {
        assert.equal(c.options.sameSite, 'strict');
      }
    });
  });

  // Gap 4.3: Session Analytics & Debugging Endpoint
  describe('4.3 Session Analytics Endpoint (GET /api/v1/auth/sessions/stats)', () => {
    test('rejects unauthenticated requests with 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/sessions/stats',
      });
      assert.equal(res.statusCode, 401);
    });

    test('rejects non-admin authenticated users with 403 FORBIDDEN', async () => {
      const originalGetUser = dataService.getUserById;
      dataService.getUserById = async (id: string) => ({
        id,
        email: 'regular_user@example.com',
        name: 'Regular Member',
        role: 'MEMBER',
        emailVerified: true,
        tokenVersion: 1,
        status: 'ACTIVE',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const memberToken = app.jwt.sign({
        userId: 'user_member_1',
        email: 'regular_user@example.com',
        role: 'MEMBER',
        tokenVersion: 1,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/sessions/stats',
        headers: {
          authorization: `Bearer ${memberToken}`,
        },
      });

      assert.equal(res.statusCode, 403);
      const body = JSON.parse(res.payload);
      assert.equal(body.success, false);
      assert.equal(body.error.code, ERROR_CODES.FORBIDDEN);

      dataService.getUserById = originalGetUser;
    });

    test('allows system admin users and returns aggregated session statistics', async () => {
      const originalGetUser = dataService.getUserById;
      const originalGetSessionStats = dataService.getSessionStats;

      dataService.getUserById = async (id: string) => ({
        id,
        email: 'admin@orviohub.com',
        name: 'Admin User',
        role: 'ADMIN',
        emailVerified: true,
        tokenVersion: 1,
        status: 'ACTIVE',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      dataService.getSessionStats = async () => ({
        totalActiveSessions: 42,
        sessionsByDeviceType: { desktop: 30, mobile: 12 },
        sessionsByApplication: { home: 20, accounts: 15, inventory: 7 },
        averageSessionAgeMinutes: 45,
        staleSessionsCount: 3,
        generatedAt: Date.now(),
      });

      const adminToken = app.jwt.sign({
        userId: 'user_admin_1',
        email: 'admin@orviohub.com',
        role: 'ADMIN',
        tokenVersion: 1,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/sessions/stats',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.equal(body.success, true);
      assert.equal(body.data.totalActiveSessions, 42);
      assert.equal(body.data.sessionsByDeviceType.desktop, 30);
      assert.equal(body.data.sessionsByApplication.inventory, 7);
      assert.equal(body.data.staleSessionsCount, 3);

      dataService.getUserById = originalGetUser;
      dataService.getSessionStats = originalGetSessionStats;
    });
  });

  // Gap 4.4: User-Friendly Token Version Invalidation
  describe('4.4 Structured Token Version Invalidation', () => {
    test('returns TOKEN_VERSION_MISMATCH and reauthenticateRequired: true when tokenVersion is incremented', async () => {
      const originalGetUser = dataService.getUserById;

      // User has tokenVersion: 2 (e.g. following password change)
      dataService.getUserById = async (id: string) => ({
        id,
        email: 'user_bumped@example.com',
        name: 'Bumped User',
        role: 'MEMBER',
        emailVerified: true,
        tokenVersion: 2,
        status: 'ACTIVE',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Token carries old tokenVersion: 1
      const staleToken = app.jwt.sign({
        userId: 'user_bumped_1',
        email: 'user_bumped@example.com',
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
      assert.equal(body.error.code, 'TOKEN_VERSION_MISMATCH');
      assert.equal(body.error.reason, 'PASSWORD_OR_SECURITY_RESET');
      assert.equal(body.error.reauthenticateRequired, true);
      assert.ok(body.error.message.includes('password or security credentials'));

      dataService.getUserById = originalGetUser;
    });
  });
});
