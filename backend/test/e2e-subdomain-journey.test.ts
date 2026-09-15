import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import {
  getMarketingUrl,
  getAccountsUrl,
  getHomeUrl,
  getInventoryUrl,
  getLoginUrl,
  getSignupUrl,
  getVerifyEmailUrl,
  getResetPasswordUrl,
  getInvitationUrl,
  getPostVerificationUrl,
  isAllowedReturnTo,
  resolveHost,
  UnknownHostError,
} from '@orviohub/shared';

describe('Local Subdomain Architecture & User Journey Test Suite', () => {
  let app: any;

  test.before(async () => {
    process.env.COOKIE_DOMAIN = '.orviohub.localhost';
    process.env.BASE_URL_MARKETING = 'http://orviohub.localhost:3000';
    process.env.BASE_URL_ACCOUNT = 'http://account.orviohub.localhost:3000';
    process.env.BASE_URL_HOME = 'http://home.orviohub.localhost:3000';
    process.env.BASE_URL_INVENTORY = 'http://inventory.orviohub.localhost:3000';
    app = await buildApp();
  });

  test.after(async () => {
    if (app) await app.close();
  });

  describe('1. Subdomain Target Map (.localhost)', () => {
    it('resolves marketing, account, home, and inventory subdomains', () => {
      assert.equal(resolveHost('orviohub.localhost:3000').application, 'marketing');
      assert.equal(resolveHost('account.orviohub.localhost:3000').application, 'accounts');
      assert.equal(resolveHost('accounts.orviohub.localhost:3000').application, 'accounts');
      assert.equal(resolveHost('home.orviohub.localhost:3000').application, 'home');
      assert.equal(resolveHost('app.orviohub.localhost:3000').application, 'home');
      assert.equal(resolveHost('inventory.orviohub.localhost:3000').application, 'inventory');
      assert.equal(resolveHost('pos.orviohub.localhost:3000').application, 'inventory');
    });

    it('explicitly excludes and rejects admin.orviohub.localhost', () => {
      assert.throws(() => resolveHost('admin.orviohub.localhost:3000'), UnknownHostError);
      assert.equal(isAllowedReturnTo('http://admin.orviohub.localhost:3000/dashboard'), false);
    });
  });

  describe('2. URL Builders & Email Flow Formats', () => {
    it('builds correct email verification link with token and email on account subdomain', () => {
      const token = 'verify-token-123';
      const email = 'user@example.com';
      const url = getVerifyEmailUrl(token, 'development', email);
      assert.equal(
        url,
        'http://account.orviohub.localhost:3000/verify-email?token=verify-token-123&email=user%40example.com'
      );
    });

    it('builds correct password reset link with token and email on account subdomain', () => {
      const token = 'reset-token-456';
      const email = 'user@example.com';
      const url = getResetPasswordUrl(token, 'development', email);
      assert.equal(
        url,
        'http://account.orviohub.localhost:3000/reset-password?token=reset-token-456&email=user%40example.com'
      );
    });

    it('builds correct invitation link on account subdomain', () => {
      const token = 'invite-token-789';
      const url = getInvitationUrl(token, 'development');
      assert.equal(url, 'http://account.orviohub.localhost:3000/invite?token=invite-token-789');
    });

    it('directs post-verification to personal onboarding', () => {
      const postVerifyUrl = getPostVerificationUrl('development');
      assert.equal(postVerifyUrl, 'http://home.orviohub.localhost:3000/onboard/personal');
    });

    it('builds login URL with redirect parameter to inventory app', () => {
      const targetApp = 'http://inventory.orviohub.localhost:3000/dashboard';
      const loginUrl = getLoginUrl(targetApp, 'development');
      assert.equal(
        loginUrl,
        `http://account.orviohub.localhost:3000/login?redirect=${encodeURIComponent(targetApp)}`
      );
    });
  });

  describe('3. Wildcard Cross-Subdomain Session Cookies', () => {
    it('sets wildcard session cookies for .orviohub.localhost on signup/login with HttpOnly and Lax', async () => {
      const unique = Date.now();
      const signupRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        headers: {
          host: 'account.orviohub.localhost:4000',
        },
        payload: {
          name: 'Subdomain Test User',
          email: `subdomain_user_${unique}@example.com`,
          password: 'Password123!',
        },
      });

      assert.equal(signupRes.statusCode, 201);
      const setCookieHeaders = signupRes.headers['set-cookie'];
      assert.ok(setCookieHeaders, 'Set-Cookie header must be present');

      const cookies = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];

      // Check session cookie
      const sessionCookie = cookies.find((c: string) => c.startsWith('session='));
      assert.ok(sessionCookie, 'session cookie must be set');
      assert.ok(sessionCookie.includes('Domain=.orviohub.localhost'), 'Cookie must have Domain=.orviohub.localhost');
      assert.ok(sessionCookie.includes('HttpOnly'), 'Cookie must be HttpOnly');
      assert.ok(sessionCookie.includes('SameSite=Lax'), 'Cookie must be SameSite=Lax');
      assert.ok(sessionCookie.includes('Path=/'), 'Cookie must have Path=/');
      // In dev HTTP mode, must NOT enforce Secure: true
      assert.ok(!sessionCookie.includes('Secure;'), 'Cookie must not enforce Secure in local dev HTTP');

      // Check legacy/fallback orvio_session cookie
      const orvioSessionCookie = cookies.find((c: string) => c.startsWith('orvio_session='));
      assert.ok(orvioSessionCookie, 'orvio_session cookie must be set');
      assert.ok(orvioSessionCookie.includes('Domain=.orviohub.localhost'), 'orvio_session must have Domain=.orviohub.localhost');
    });

    let sessionVal: string | undefined;

    it('authenticates user on inventory subdomain using wildcard session cookie', async () => {
      const unique = Date.now();
      const signupRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        headers: { host: 'account.orviohub.localhost:4000' },
        payload: {
          name: 'Inventory Cross User',
          email: `inventory_user_${unique}@example.com`,
          password: 'Password123!',
        },
      });
      assert.equal(signupRes.statusCode, 201);

      // Extract session cookie
      const setCookies = signupRes.headers['set-cookie'];
      const cookieArray = Array.isArray(setCookies) ? setCookies : [setCookies];
      const sessionMatch = cookieArray.find((c: string) => c.startsWith('session='));
      sessionVal = sessionMatch?.split(';')[0];

      // Visit user profile / me endpoint simulating request from inventory.orviohub.localhost
      const authCheckRes = await app.inject({
        method: 'GET',
        url: '/api/v1/users/me',
        headers: {
          host: 'inventory.orviohub.localhost:4000',
          cookie: sessionVal,
        },
      });

      assert.equal(authCheckRes.statusCode, 200);
      const resData = authCheckRes.json();
      assert.equal(resData.data?.user?.email, `inventory_user_${unique}@example.com`);
    });

    it('clears wildcard cookies for .orviohub.localhost on logout', async () => {
      const logoutRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        headers: {
          host: 'account.orviohub.localhost:4000',
          cookie: sessionVal,
        },
      });

      assert.equal(logoutRes.statusCode, 200);
      const setCookies = logoutRes.headers['set-cookie'];
      const cookieArray = Array.isArray(setCookies) ? setCookies : [setCookies];
      const sessionCookie = cookieArray.find((c: string) => c.startsWith('session='));
      assert.ok(sessionCookie, 'session cookie must be cleared');
      assert.ok(sessionCookie.includes('Domain=.orviohub.localhost'), 'Cleared cookie must include wildcard domain');
      assert.ok(sessionCookie.includes('Max-Age=0') || sessionCookie.includes('Expires='), 'Cookie must be expired');
    });
  });

  describe('4. Security & Admin Isolation', () => {
    it('rejects requests claiming admin.orviohub.localhost host on user API', async () => {
      const adminRes = await app.inject({
        method: 'GET',
        url: '/v1/host-context',
        headers: { host: 'admin.orviohub.localhost:4000' },
      });

      assert.equal(adminRes.statusCode, 400);
      const body = adminRes.json();
      const errText = body.message || body.error || '';
      assert.ok(errText.includes('Unrecognized Orviohub host') || errText.includes('admin'));
    });

    it('rejects open redirects pointing to admin or unknown external domains', () => {
      assert.equal(isAllowedReturnTo('http://admin.orviohub.localhost/onboard'), false);
      assert.equal(isAllowedReturnTo('http://malicious-site.com'), false);
      assert.equal(isAllowedReturnTo('http://inventory.orviohub.localhost:3000/dashboard'), true);
      assert.equal(isAllowedReturnTo('http://home.orviohub.localhost:3000/onboard'), true);
    });
  });
});
