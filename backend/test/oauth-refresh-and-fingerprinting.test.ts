import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { dataService, parseDeviceFingerprint } from '../src/services/dataService.js';
import { oauthService } from '../src/services/oauth.js';
import { AUTH_COOKIE_NAME, REFRESH_COOKIE_NAME } from '../src/utils/cookies.js';

describe('Items 3.5 & 3.6: OAuth Refresh Token Rotation and Device Fingerprinting Test Suite', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  const originalGetUserById = dataService.getUserById;
  const originalGetUserByEmail = dataService.getUserByEmail;
  const originalCreateSession = dataService.createSession;
  const originalRotateSession = dataService.rotateSession;
  const originalGetSessionById = dataService.getSessionById;
  const originalCreateUser = dataService.createUser;

  const mockUser = {
    id: 'user_oauth_device_1',
    email: 'oauth_device_user@orviohub.com',
    name: 'OAuth Device Tester',
    emailVerified: true,
    tokenVersion: 1,
    status: 'ACTIVE',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  beforeEach(async () => {
    app = await buildApp();
    dataService.getUserById = async (id: string) => {
      if (id === mockUser.id) return { ...mockUser } as any;
      return null;
    };
    dataService.getUserByEmail = async (email: string) => {
      if (email === mockUser.email || email.includes('oauth')) return { ...mockUser } as any;
      return null;
    };
    dataService.createUser = async (data: any) => ({
      user: {
        id: mockUser.id,
        status: 'ACTIVE',
        tokenVersion: 1,
        ...data,
      } as any,
    });
  });

  afterEach(() => {
    dataService.getUserById = originalGetUserById;
    dataService.getUserByEmail = originalGetUserByEmail;
    dataService.createSession = originalCreateSession;
    dataService.rotateSession = originalRotateSession;
    dataService.getSessionById = originalGetSessionById;
    dataService.createUser = originalCreateUser;
  });

  test('3.5 OAuth callback issues HttpOnly refresh cookies and enables silent token rotation', async () => {
    // 1. Initialize OAuth flow to get valid state and PKCE verifier
    const flow = await oauthService.initiateOAuthFlow('google', '/dashboard');

    dataService.createSession = async (_userId: string, _opts: any) => ({
      sessionId: 'sess_oauth_refresh_1',
      refreshToken: 'refr_oauth_cookie_12345',
      expiresAt: Date.now() + 7 * 86_400_000,
    });

    // 2. Simulate Google callback
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/auth/google/callback?code=mock_google_code_oauth_device_user&state=${flow.state}`,
    });

    assert.equal(res.statusCode, 302, 'Callback must redirect user');
    const location = res.headers.location as string;
    assert.ok(location.includes('/auth/callback?code=hnd_'), 'Redirect must use ephemeral handoff code');
    assert.ok(!location.includes('token='), 'Redirect must NOT expose raw token in URL');
    assert.ok(!location.includes('refreshToken='), 'Redirect must NOT expose raw refreshToken in URL');

    // Check Set-Cookie headers
    const setCookies = res.headers['set-cookie'];
    assert.ok(setCookies);
    const cookieStrings = Array.isArray(setCookies) ? setCookies : [setCookies];
    const refreshCookie = cookieStrings.find((c) => c.startsWith(`${REFRESH_COOKIE_NAME}=`));
    const sessionCookie = cookieStrings.find((c) => c.startsWith(`${AUTH_COOKIE_NAME}=`));

    assert.ok(refreshCookie, 'Must set HttpOnly refresh cookie for OAuth session');
    assert.ok(sessionCookie, 'Must set HttpOnly session cookie for OAuth session');
    assert.ok(refreshCookie.toLowerCase().includes('httponly'));

    // 3. Test silent rotation via /api/v1/auth/refresh
    dataService.rotateSession = async (token: string) => {
      assert.equal(token, 'refr_oauth_cookie_12345');
      return {
        user: { ...mockUser, tokenVersion: 2 } as any,
        sessionId: 'sess_oauth_rotated_999',
        refreshToken: 'refr_oauth_cookie_rotated_67890',
        expiresAt: Date.now() + 7 * 86_400_000,
      };
    };

    const refreshRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: {
        cookie: `${REFRESH_COOKIE_NAME}=refr_oauth_cookie_12345`,
      },
      payload: {},
    });

    assert.equal(refreshRes.statusCode, 200);
    const refreshBody = JSON.parse(refreshRes.payload);
    assert.equal(refreshBody.success, true);
    assert.ok(refreshBody.data.token);
  });

  test('3.6 Device Fingerprinting: parse device metadata and evaluate session risk', async () => {
    // 1. Test parseDeviceFingerprint for desktop, mobile, tablet
    const desktopWindows = parseDeviceFingerprint(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      '192.168.1.100'
    );
    assert.equal(desktopWindows.browser, 'Chrome');
    assert.equal(desktopWindows.os, 'Windows');
    assert.equal(desktopWindows.deviceType, 'desktop');
    assert.ok(desktopWindows.fingerprintHash);

    const mobileIos = parseDeviceFingerprint(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
      '192.168.1.200'
    );
    assert.equal(mobileIos.browser, 'Safari');
    assert.equal(mobileIos.os, 'iOS');
    assert.equal(mobileIos.deviceType, 'mobile');

    // 2. Test createSession includes device fingerprint
    let savedSessionOpts: any = null;
    dataService.mutate = async (_action: string, data: any) => {
      savedSessionOpts = data;
      return 'sess_fp_123';
    };

    const created = await dataService.createSession(mockUser.id, {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ipAddress: '192.168.1.100',
    });

    assert.ok(created.fingerprint);
    assert.equal(created.fingerprint.browser, 'Chrome');
    assert.equal(created.fingerprint.os, 'Windows');
    assert.equal(savedSessionOpts.deviceFingerprint, created.fingerprint.fingerprintHash);
    assert.equal(savedSessionOpts.browser, 'Chrome');
    assert.equal(savedSessionOpts.os, 'Windows');

    // 3. Test risk evaluation engine
    const sessionRecord = {
      sessionId: 'sess_fp_123',
      os: 'Windows',
      browser: 'Chrome',
      deviceType: 'desktop',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };

    // Same device: low risk
    const lowRisk = dataService.evaluateSessionRisk(
      sessionRecord,
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      '192.168.1.100'
    );
    assert.equal(lowRisk.anomalous, false);
    assert.equal(lowRisk.riskScore, 'low');

    // Drastic OS switch (Windows -> iOS): high risk
    const highRisk = dataService.evaluateSessionRisk(
      sessionRecord,
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
      '10.0.0.5'
    );
    assert.equal(highRisk.anomalous, true);
    assert.equal(highRisk.riskScore, 'high');
    assert.ok(highRisk.reason?.includes('Drastic OS change'));
  });
});
