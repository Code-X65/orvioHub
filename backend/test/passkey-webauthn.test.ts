import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { dataService } from '../src/services/dataService.js';
import { AUTH_COOKIE_NAME, REFRESH_COOKIE_NAME } from '../src/utils/cookies.js';

describe('WebAuthn / Passkey Authentication Test Suite', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  const originalGetUserById = dataService.getUserById;
  const originalGetUserByEmail = dataService.getUserByEmail;
  const originalCreateSession = dataService.createSession;

  const mockUser = {
    id: 'user_passkey_test_1',
    email: 'passkey_tester@orviohub.com',
    name: 'Passkey Tester',
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
      if (email === mockUser.email) return { ...mockUser } as any;
      return null;
    };
  });

  afterEach(() => {
    dataService.getUserById = originalGetUserById;
    dataService.getUserByEmail = originalGetUserByEmail;
    dataService.createSession = originalCreateSession;
  });

  test('1. Passkey Registration: generate options and verify credential', async () => {
    const userToken = app.jwt.sign({
      userId: mockUser.id,
      email: mockUser.email,
      sessionId: 'sess_initial',
      tokenVersion: mockUser.tokenVersion,
    });

    // Step A: Request registration options
    const optionsRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/passkey/register/options',
      headers: {
        authorization: `Bearer ${userToken}`,
      },
    });

    assert.equal(optionsRes.statusCode, 200);
    const optionsBody = JSON.parse(optionsRes.payload);
    assert.equal(optionsBody.success, true);
    assert.ok(optionsBody.data.challenge);
    assert.equal(optionsBody.data.rp.name, 'orvioHub');

    // Step B: Submit verified registration response
    const credentialId = 'cred_test_webauthn_12345';
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/passkey/register/verify',
      headers: {
        authorization: `Bearer ${userToken}`,
      },
      payload: {
        id: credentialId,
        rawId: credentialId,
        deviceName: 'MacBook TouchID',
        response: {
          clientDataJSON: 'test_client_data',
          publicKey: 'mock_public_key_pem',
        },
      },
    });

    assert.equal(verifyRes.statusCode, 200);
    const verifyBody = JSON.parse(verifyRes.payload);
    assert.equal(verifyBody.success, true);
    assert.equal(verifyBody.data.credential.id, credentialId);
    assert.equal(verifyBody.data.credential.deviceName, 'MacBook TouchID');

    // Step C: List credentials
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/passkey/credentials',
      headers: {
        authorization: `Bearer ${userToken}`,
      },
    });

    assert.equal(listRes.statusCode, 200);
    const listBody = JSON.parse(listRes.payload);
    assert.equal(listBody.success, true);
    assert.ok(Array.isArray(listBody.data));
    const found = listBody.data.find((c: any) => c.id === credentialId);
    assert.ok(found, 'Saved passkey credential must be in the list');
  });

  test('2. Passkey Authentication: generate login options and complete biometric sign-in', async () => {
    const credentialId = 'cred_test_login_555';
    await dataService.savePasskeyCredential(mockUser.id, {
      id: credentialId,
      deviceName: 'iPhone FaceID',
    });

    // Step A: Request login options
    const optionsRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/passkey/login/options',
      payload: {
        email: mockUser.email,
      },
    });

    assert.equal(optionsRes.statusCode, 200);
    const optionsBody = JSON.parse(optionsRes.payload);
    assert.equal(optionsBody.success, true);
    assert.ok(optionsBody.data.challenge);
    assert.ok(Array.isArray(optionsBody.data.allowCredentials));

    // Step B: Submit assertion verification
    dataService.createSession = async () => ({
      sessionId: 'sess_passkey_login_1',
      refreshToken: 'refr_passkey_token_abc',
      expiresAt: Date.now() + 30 * 86_400_000,
    });

    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/passkey/login/verify',
      payload: {
        id: credentialId,
        rawId: credentialId,
        response: {
          clientDataJSON: 'test_client_data',
          authenticatorData: 'test_auth_data',
          signature: 'test_sig',
        },
      },
    });

    assert.equal(verifyRes.statusCode, 200);
    const verifyBody = JSON.parse(verifyRes.payload);
    assert.equal(verifyBody.success, true);
    assert.equal(verifyBody.data.user.email, mockUser.email);
    assert.ok(verifyBody.data.token);

    // Verify JWT Standard claims
    const decoded = app.jwt.decode<{ iss?: string; aud?: string }>(verifyBody.data.token);
    assert.equal(decoded.iss, 'orviohub');
    assert.equal(decoded.aud, 'orviohub-app');

    // Verify Cookies
    const setCookies = verifyRes.headers['set-cookie'];
    assert.ok(setCookies);
    const cookieStrings = Array.isArray(setCookies) ? setCookies : [setCookies];
    assert.ok(cookieStrings.some((c) => c.startsWith(`${AUTH_COOKIE_NAME}=`)));
    assert.ok(cookieStrings.some((c) => c.startsWith(`${REFRESH_COOKIE_NAME}=`)));
  });

  test('3. Passkey Authentication: reject unknown credential with 401 UNAUTHENTICATED', async () => {
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/passkey/login/verify',
      payload: {
        id: 'cred_non_existent_99999',
      },
    });

    assert.equal(verifyRes.statusCode, 401);
    const verifyBody = JSON.parse(verifyRes.payload);
    assert.equal(verifyBody.success, false);
    assert.equal(verifyBody.error.code, 'UNAUTHENTICATED');
  });
});
