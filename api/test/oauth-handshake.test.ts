import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { buildApp } from '../src/app.js';
import { dataService } from '../src/services/dataService.js';
import { hashSessionToken } from '../src/services/totp.js';

test('SSO Authorization Code Handshake & PKCE Test Suite', async (t) => {
  const app = await buildApp();
  const testId = `sso_${Date.now()}`;
  const userEmail = `${testId}@example.com`;
  const password = 'Password123!';

  // 1. Create a test user
  const { user } = await dataService.createUser({
    email: userEmail,
    name: 'SSO Test User',
    firstName: 'SSO',
    lastName: 'Tester',
    password,
  });

  const session = await dataService.createSession(user.id, {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    ipAddress: '127.0.0.1',
    authenticationMethod: 'password',
    tokenVersion: user.tokenVersion ?? 1,
  });

  const jwtToken = app.jwt.sign({
    userId: user.id,
    email: user.email,
    sessionId: session.sessionId,
    tokenVersion: user.tokenVersion ?? 1,
  });

  await t.test('1. GET /api/v1/auth/oauth/authorize redirects to login when unauthenticated', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/oauth/authorize?product=finance&redirect_uri=https://finance.orvio.com/callback&response_type=code&state=xyz123',
      headers: { accept: 'application/json' },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, false);
    assert.ok(body.data.loginUrl.includes('/login?product=finance'));
    assert.ok(body.data.loginUrl.includes('return_to=https%3A%2F%2Ffinance.orvio.com%2Fcallback'));
  });

  await t.test('2. GET /api/v1/auth/oauth/authorize rejects unauthorized redirect_uri', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/oauth/authorize?product=finance&redirect_uri=https://evil-site.com/callback&response_type=code',
      headers: { authorization: `Bearer ${jwtToken}` },
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.payload);
    assert.equal(body.error.code, 'REDIRECT_URI_MISMATCH');
  });

  await t.test('3. GET /api/v1/auth/oauth/authorize issues valid authorization code for authenticated user', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/oauth/authorize?product=finance&redirect_uri=https://finance.orvio.com/callback&response_type=code&state=statetest1',
      headers: {
        authorization: `Bearer ${jwtToken}`,
        accept: 'application/json',
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.ok(body.data.code);
    assert.ok(body.data.redirectUrl.includes(`code=${body.data.code}`));
    assert.ok(body.data.redirectUrl.includes('state=statetest1'));
  });

  await t.test('4. POST /api/v1/auth/oauth/token exchanges code for access token and session', async () => {
    const authRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/oauth/authorize?product=finance&redirect_uri=https://finance.orvio.com/callback&response_type=code&state=statetest2',
      headers: {
        authorization: `Bearer ${jwtToken}`,
        accept: 'application/json',
      },
    });
    const code = JSON.parse(authRes.payload).data.code;

    const tokenRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/oauth/token',
      payload: {
        grant_type: 'authorization_code',
        code,
        redirect_uri: 'https://finance.orvio.com/callback',
      },
    });

    assert.equal(tokenRes.statusCode, 200);
    const tokenBody = JSON.parse(tokenRes.payload);
    assert.equal(tokenBody.success, true);
    assert.ok(tokenBody.data.access_token);
    assert.ok(tokenBody.data.refresh_token);
    assert.equal(tokenBody.data.product, 'finance');
    assert.equal(tokenBody.data.user.email, userEmail);

    // Verify token can be verified and contains productKey
    const decoded = app.jwt.verify<{ userId: string; productKey: string }>(tokenBody.data.access_token);
    assert.equal(decoded.userId, user.id);
    assert.equal(decoded.productKey, 'finance');
  });

  await t.test('5. POST /api/v1/auth/oauth/token prevents code reuse (single-use invariant)', async () => {
    const authRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/oauth/authorize?product=finance&redirect_uri=https://finance.orvio.com/callback&response_type=code',
      headers: {
        authorization: `Bearer ${jwtToken}`,
        accept: 'application/json',
      },
    });
    const code = JSON.parse(authRes.payload).data.code;

    // First exchange succeeds
    const firstRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/oauth/token',
      payload: {
        grant_type: 'authorization_code',
        code,
        redirect_uri: 'https://finance.orvio.com/callback',
      },
    });
    assert.equal(firstRes.statusCode, 200);

    // Replay attempt must fail
    const replayRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/oauth/token',
      payload: {
        grant_type: 'authorization_code',
        code,
        redirect_uri: 'https://finance.orvio.com/callback',
      },
    });
    assert.equal(replayRes.statusCode, 400);
    const replayBody = JSON.parse(replayRes.payload);
    assert.equal(replayBody.error.code, 'AUTHORIZATION_CODE_ALREADY_USED');
  });

  await t.test('6. POST /api/v1/auth/oauth/token supports PKCE code challenge & verifier validation', async () => {
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

    const authRes = await app.inject({
      method: 'GET',
      url: `/api/v1/auth/oauth/authorize?product=hub&redirect_uri=https://hub.orvio.com/callback&response_type=code&code_challenge=${codeChallenge}&code_challenge_method=S256`,
      headers: {
        authorization: `Bearer ${jwtToken}`,
        accept: 'application/json',
      },
    });
    const code = JSON.parse(authRes.payload).data.code;

    // Exchange without verifier or with wrong verifier fails
    const failRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/oauth/token',
      payload: {
        grant_type: 'authorization_code',
        code,
        redirect_uri: 'https://hub.orvio.com/callback',
        code_verifier: 'wrong_code_verifier_12345678901234567890',
      },
    });
    assert.equal(failRes.statusCode, 400);

    // Exchange with correct verifier succeeds
    const authRes2 = await app.inject({
      method: 'GET',
      url: `/api/v1/auth/oauth/authorize?product=hub&redirect_uri=https://hub.orvio.com/callback&response_type=code&code_challenge=${codeChallenge}&code_challenge_method=S256`,
      headers: {
        authorization: `Bearer ${jwtToken}`,
        accept: 'application/json',
      },
    });
    const code2 = JSON.parse(authRes2.payload).data.code;

    const successRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/oauth/token',
      payload: {
        grant_type: 'authorization_code',
        code: code2,
        redirect_uri: 'https://hub.orvio.com/callback',
        code_verifier: codeVerifier,
      },
    });
    assert.equal(successRes.statusCode, 200);
    const body = JSON.parse(successRes.payload);
    assert.equal(body.success, true);
    assert.equal(body.data.product, 'hub');
  });

  await app.close();
});
