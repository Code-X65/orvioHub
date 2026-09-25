import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { dataService } from '../src/services/dataService.js';
import { oauthService } from '../src/services/oauth.js';
import { AUTH_COOKIE_NAME, REFRESH_COOKIE_NAME } from '../src/utils/cookies.js';

describe('Section 3: Professional Standards Test Suite', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  const originalGetUserById = dataService.getUserById;
  const originalGetUserByEmail = dataService.getUserByEmail;
  const originalCreateSession = dataService.createSession;
  const originalCreateUser = dataService.createUser;
  const originalGetOnboardingStatus = dataService.getOnboardingStatus;

  const mockUser = {
    id: 'user_standards_1',
    email: 'standards_user@orviohub.com',
    name: 'Standards Tester',
    passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890', // mock hash
    emailVerified: true,
    tokenVersion: 1,
    twoFactorEnabled: true,
    twoFactorSecret: 'JBSWY3DPEHPK3PXP',
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
      if (email === mockUser.email) return { ...mockUser } as any;
      return null;
    };
    dataService.verifyPassword = async (_user: any, password: string) => {
      return password === 'CorrectPassword123!';
    };
    dataService.createUser = async (data: any) => ({
      user: {
        id: `user_created_${Date.now()}`,
        status: 'ACTIVE',
        tokenVersion: 1,
        ...data,
      } as any,
    });
    dataService.getOnboardingStatus = async () => ({
      status: 'COMPLETED' as const,
      currentStep: 'COMPLETED' as const,
    });
  });

  afterEach(() => {
    dataService.getUserById = originalGetUserById;
    dataService.getUserByEmail = originalGetUserByEmail;
    dataService.createSession = originalCreateSession;
    dataService.createUser = originalCreateUser;
    dataService.getOnboardingStatus = originalGetOnboardingStatus;
  });

  test('3.1 Facebook OAuth implements RFC 7636 PKCE (S256 code_challenge and code_verifier)', async () => {
    const flow = await oauthService.initiateOAuthFlow('facebook');
    assert.ok(flow.pkceVerifier, 'OAuth flow must generate PKCE verifier');
    assert.ok(flow.authUrl, 'OAuth flow must generate Facebook auth URL');

    const parsedUrl = new URL(flow.authUrl, 'http://localhost');
    const challenge = parsedUrl.searchParams.get('code_challenge');
    const challengeMethod = parsedUrl.searchParams.get('code_challenge_method');

    assert.ok(challenge, 'Facebook auth URL must contain code_challenge parameter');
    assert.equal(challengeMethod, 'S256', 'Facebook auth URL must use S256 code_challenge_method');

    // Test direct getFacebookAuthUrl with explicit PKCE challenge
    const directUrl = oauthService.getFacebookAuthUrl({
      state: 'state_test_pkce',
      pkceChallenge: 'test_pkce_challenge_abc123',
    });
    const parsedDirect = new URL(directUrl, 'http://localhost');
    assert.equal(parsedDirect.searchParams.get('code_challenge'), 'test_pkce_challenge_abc123');
    assert.equal(parsedDirect.searchParams.get('code_challenge_method'), 'S256');

    // Test exchange with codeVerifier
    const profile = await oauthService.exchangeFacebookCode('mock_facebook_code_fbuser', flow.pkceVerifier);
    assert.equal(profile.provider, 'facebook');
    assert.ok(profile.email);
  });

  test('3.2 OpenID Connect standard claims (given_name, family_name, locale, timezone) in social auth', async () => {
    // Google OIDC claims
    const googleProfile = await oauthService.exchangeGoogleCode('mock_google_code_alex');
    assert.equal(googleProfile.provider, 'google');
    assert.equal(googleProfile.firstName, 'Alex');
    assert.ok(googleProfile.lastName);
    assert.equal(googleProfile.locale, 'en-US');
    assert.equal(googleProfile.timezone, 'UTC');

    // Facebook OIDC claims
    const fbProfile = await oauthService.exchangeFacebookCode('mock_facebook_code_clara');
    assert.equal(fbProfile.provider, 'facebook');
    assert.equal(fbProfile.firstName, 'Clara');
    assert.ok(fbProfile.lastName);
    assert.equal(fbProfile.locale, 'en-US');

    // Test dataService.handleSocialAuth propagates OIDC preferences
    const authResult = await dataService.handleSocialAuth(googleProfile);
    assert.ok(authResult.user);
    assert.equal(authResult.user.locale, 'en-US');
    assert.equal(authResult.user.timezone, 'UTC');
  });

  test('3.3 WebAuthn / FIDO2 security key as a Second-Factor (2FA / MFA) alternative', async () => {
    const userToken = app.jwt.sign({
      userId: mockUser.id,
      email: mockUser.email,
      sessionId: 'sess_sec3_1',
      tokenVersion: mockUser.tokenVersion,
    });

    // Step A: Request 2FA WebAuthn registration options
    const optionsRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/2fa/webauthn/register-options',
      headers: {
        authorization: `Bearer ${userToken}`,
      },
    });
    assert.equal(optionsRes.statusCode, 200);
    const optionsBody = JSON.parse(optionsRes.payload);
    assert.ok(optionsBody.data.challenge);

    // Step B: Register WebAuthn 2FA credential
    const credentialId = 'cred_mfa_sec_key_777';
    const regVerifyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/2fa/webauthn/register-verify',
      headers: {
        authorization: `Bearer ${userToken}`,
      },
      payload: {
        id: credentialId,
        deviceName: 'YubiKey 5C NFC',
      },
    });
    assert.equal(regVerifyRes.statusCode, 200);

    // Step C: Complete MFA challenge using WebAuthn credential and tempToken
    const tempToken = app.jwt.sign(
      { userId: mockUser.id, email: mockUser.email, is2faPending: true },
      { expiresIn: '5m' }
    );

    dataService.createSession = async () => ({
      sessionId: 'sess_mfa_webauthn_complete',
      refreshToken: 'refr_mfa_webauthn_token',
      expiresAt: Date.now() + 30 * 86_400_000,
    });

    const mfaRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/2fa/webauthn/challenge',
      payload: {
        tempToken,
        credentialId,
      },
    });

    assert.equal(mfaRes.statusCode, 200);
    const mfaBody = JSON.parse(mfaRes.payload);
    assert.equal(mfaBody.success, true);
    assert.equal(mfaBody.data.user.email, mockUser.email);
    assert.ok(mfaBody.data.token);

    // Check Set-Cookie headers
    const setCookies = mfaRes.headers['set-cookie'];
    assert.ok(setCookies);
    const cookieStrings = Array.isArray(setCookies) ? setCookies : [setCookies];
    assert.ok(cookieStrings.some((c) => c.startsWith(`${AUTH_COOKIE_NAME}=`)));
    assert.ok(cookieStrings.some((c) => c.startsWith(`${REFRESH_COOKIE_NAME}=`)));
  });

  test('3.4 Step-Up Authentication: POST /api/v1/auth/verify-password and sensitive operation gating', async () => {
    const userToken = app.jwt.sign({
      userId: mockUser.id,
      email: mockUser.email,
      sessionId: 'sess_sec3_stepup',
      tokenVersion: mockUser.tokenVersion,
    });

    // Step A: Attempt verify-password with wrong password
    const failRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-password',
      headers: { authorization: `Bearer ${userToken}` },
      payload: { password: 'WrongPassword!' },
    });
    assert.equal(failRes.statusCode, 401);

    // Step B: Successful verify-password generates stepUpToken
    const stepUpRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-password',
      headers: { authorization: `Bearer ${userToken}` },
      payload: { password: 'CorrectPassword123!' },
    });
    assert.equal(stepUpRes.statusCode, 200);
    const stepUpBody = JSON.parse(stepUpRes.payload);
    assert.equal(stepUpBody.success, true);
    assert.ok(stepUpBody.data.stepUpToken);

    const stepUpToken = stepUpBody.data.stepUpToken;

    // Step C: Sensitive operation (POST /2fa/disable) fails without password or stepUpToken
    const disableFailRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/2fa/disable',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {},
    });
    assert.equal(disableFailRes.statusCode, 401);

    // Step D: Sensitive operation succeeds with x-step-up-token header
    dataService.disableTwoFactor = async () => ({ success: true });

    const disableSuccessRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/2fa/disable',
      headers: {
        authorization: `Bearer ${userToken}`,
        'x-step-up-token': stepUpToken,
      },
      payload: {},
    });
    assert.equal(disableSuccessRes.statusCode, 200);
    const disableSuccessBody = JSON.parse(disableSuccessRes.payload);
    assert.equal(disableSuccessBody.success, true);
  });
});
