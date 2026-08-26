import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { dataService } from '../src/services/dataService.js';
import { oauthService } from '../src/services/oauth.js';
import { ERROR_CODES, ONBOARDING_STEPS, ONBOARDING_STATUS } from '../src/config/constants.js';

describe('Google and Facebook Social Authentication Test Suite', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    dataService.clearAll();
    app = await buildApp();
  });

  // --- Google OAuth Tests ---

  test('1. Google OAuth initiation generates secure state and redirect URL', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/google',
      headers: { accept: 'application/json' },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.ok(body.data.state);
    assert.ok(body.data.url.includes('accounts.google.com'));
    assert.ok(body.data.url.includes(body.data.state));
  });

  test('2. Google OAuth callback: new user sign-up initializes onboarding at ORGANIZATION_CREATION', async () => {
    const id = `new${Date.now()}`;
    const email = `${id}@example.com`;
    const state = oauthService.generateState('google');

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/auth/google/callback?code=mock_google_code_${id}_verified&state=${state}`,
    });

    // Expect redirect to frontend with token
    assert.equal(res.statusCode, 302);
    const location = res.headers.location as string;
    assert.ok(location.includes('/auth/callback?token='));

    // Verify user in database
    const user = await dataService.getUserByEmail(email);
    assert.ok(user);
    assert.equal(user.email, email);
    assert.equal(user.emailVerified, true);

    // Verify onboarding status
    const status = await dataService.getOnboardingStatus(user.id);
    assert.equal(status.status, ONBOARDING_STATUS.IN_PROGRESS);
    assert.equal(status.currentStep, ONBOARDING_STEPS.ORGANIZATION_CREATION);

    // Verify identity was stored
    const identities = await dataService.getIdentitiesByUserId(user.id);
    assert.equal(identities.length, 1);
    assert.equal(identities[0].provider, 'google');
  });

  test('3. Google OAuth callback: existing Google user sign-in maintains state and creates valid session', async () => {
    const id = `exist${Date.now()}`;
    const email = `${id}@example.com`;

    // 1st sign-in
    const state1 = oauthService.generateState('google');
    await app.inject({
      method: 'GET',
      url: `/api/v1/auth/google/callback?code=mock_google_code_${id}_verified&state=${state1}`,
    });

    const user = await dataService.getUserByEmail(email);
    assert.ok(user);

    // Advance user onboarding to completed
    const progress = await dataService.getOnboardingStatus(user.id);
    assert.equal(progress.currentStep, ONBOARDING_STEPS.ORGANIZATION_CREATION);

    // 2nd sign-in
    const state2 = oauthService.generateState('google');
    const res2 = await app.inject({
      method: 'GET',
      url: `/api/v1/auth/google/callback?code=mock_google_code_${id}_verified&state=${state2}`,
    });

    assert.equal(res2.statusCode, 302);
    const location = res2.headers.location as string;
    assert.ok(location.includes('/auth/callback?token='));

    // Ensure no duplicate users created
    const allUsers = [await dataService.getUserByEmail(email)];
    assert.equal(allUsers.length, 1);
  });

  test('4. Google OAuth callback: safely links to existing password-created verified user', async () => {
    const id = `link${Date.now()}`;
    const email = `${id}@example.com`;

    // Create password user first
    const { user: pwdUser } = await dataService.createUser({
      email,
      name: 'Link User',
      password: 'Password123!',
    });
    // Verify email manually
    await dataService.verifyEmail(pwdUser.emailVerificationToken!);

    // Sign in with Google with matching email
    const state = oauthService.generateState('google');
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/auth/google/callback?code=mock_google_code_${id}_verified&state=${state}`,
    });

    assert.equal(res.statusCode, 302);
    const location = res.headers.location as string;
    assert.ok(location.includes('/auth/callback?token='));

    // Check identity linked to same user ID
    const identities = await dataService.getIdentitiesByUserId(pwdUser.id);
    assert.ok(identities.length >= 1);
    assert.ok(identities.some((i) => i.provider === 'google'));
  });

  test('5. Security: invalid or forged OAuth state is rejected', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/auth/google/callback?code=mock_google_code_hacker_verified&state=forged_unregistered_state`,
    });

    assert.equal(res.statusCode, 302);
    const location = res.headers.location as string;
    assert.ok(location.includes(`error=${ERROR_CODES.OAUTH_STATE_INVALID}`));
  });

  test('6. Security: OAuth state cannot be reused', async () => {
    const id = `reuse${Date.now()}`;
    const state = oauthService.generateState('google');

    // First use: success
    const res1 = await app.inject({
      method: 'GET',
      url: `/api/v1/auth/google/callback?code=mock_google_code_${id}_verified&state=${state}`,
    });
    assert.equal(res1.statusCode, 302);
    assert.ok(res1.headers.location?.includes('/auth/callback?token='));

    // Second use with same state: rejected
    const res2 = await app.inject({
      method: 'GET',
      url: `/api/v1/auth/google/callback?code=mock_google_code_${id}_verified&state=${state}`,
    });
    assert.equal(res2.statusCode, 302);
    assert.ok(res2.headers.location?.includes(`error=${ERROR_CODES.OAUTH_STATE_INVALID}`));
  });

  test('7. Google OAuth provider denial redirects with OAUTH_ACCESS_DENIED', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/auth/google/callback?error=access_denied`,
    });

    assert.equal(res.statusCode, 302);
    const location = res.headers.location as string;
    assert.ok(location.includes(`error=${ERROR_CODES.OAUTH_ACCESS_DENIED}`));
  });

  // --- Facebook OAuth Tests ---

  test('8. Facebook OAuth initiation generates secure state and redirect URL', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/facebook',
      headers: { accept: 'application/json' },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.ok(body.data.state);
    assert.ok(body.data.url.includes('facebook.com'));
    assert.ok(body.data.url.includes(body.data.state));
  });

  test('9. Facebook OAuth callback: new user sign-up initializes onboarding at ORGANIZATION_CREATION', async () => {
    const id = `fbuser${Date.now()}`;
    const email = `${id}@example.com`;
    const state = oauthService.generateState('facebook');

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/auth/facebook/callback?code=mock_facebook_code_${id}_verified&state=${state}`,
    });

    assert.equal(res.statusCode, 302);
    const location = res.headers.location as string;
    assert.ok(location.includes('/auth/callback?token='));

    const user = await dataService.getUserByEmail(email);
    assert.ok(user);
    assert.equal(user.emailVerified, true);

    const identities = await dataService.getIdentitiesByUserId(user.id);
    assert.ok(identities.length >= 1);
    assert.ok(identities.some((i) => i.provider === 'facebook'));
  });

  test('10. Facebook OAuth callback: existing user login restores session', async () => {
    const id = `fbexist${Date.now()}`;

    // 1st sign-in
    const state1 = oauthService.generateState('facebook');
    await app.inject({
      method: 'GET',
      url: `/api/v1/auth/facebook/callback?code=mock_facebook_code_${id}_verified&state=${state1}`,
    });

    // 2nd sign-in
    const state2 = oauthService.generateState('facebook');
    const res2 = await app.inject({
      method: 'GET',
      url: `/api/v1/auth/facebook/callback?code=mock_facebook_code_${id}_verified&state=${state2}`,
    });

    assert.equal(res2.statusCode, 302);
    assert.ok(res2.headers.location?.includes('/auth/callback?token='));
  });

  test('11. Account Disconnect: rejects disconnecting user sole authentication method', async () => {
    const id = `onlyg${Date.now()}`;
    const email = `${id}@example.com`;
    const state = oauthService.generateState('google');
    await app.inject({
      method: 'GET',
      url: `/api/v1/auth/google/callback?code=mock_google_code_${id}_verified&state=${state}`,
    });

    const user = await dataService.getUserByEmail(email);
    assert.ok(user);

    // Attempt to disconnect only auth method
    await assert.rejects(
      async () => await dataService.disconnectIdentity(user.id, 'google'),
      /Cannot disconnect your only authentication method/
    );
  });
});
