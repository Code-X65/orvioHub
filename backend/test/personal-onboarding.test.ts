import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { dataService } from '../src/services/dataService.js';
import type { FastifyInstance } from 'fastify';

describe('Personal Onboarding Before Organization Creation Suite', () => {
  let app: FastifyInstance;
  const timestamp = Date.now();
  const userEmail = `personal_user_${timestamp}@orviohub.localhost`;
  const userPassword = 'Password123!';
  let userToken: string;
  let userId: string;

  before(async () => {
    app = await buildApp();
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  test('1. User signup and email verification leaves personalOnboardingCompleted as false', async () => {
    // Signup
    const signupRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: {
        name: 'Personal Human User',
        email: userEmail,
        password: userPassword,
      },
    });

    assert.strictEqual(signupRes.statusCode, 201);
    const signupBody = JSON.parse(signupRes.payload);
    assert.strictEqual(signupBody.success, true);
    userId = signupBody.data.user.id;

    // Verify email
    const rawUser = await dataService.getUserByEmail(userEmail);
    assert.ok(rawUser?.emailVerificationToken);

    const verifyRes = await app.inject({
      method: 'GET',
      url: `/api/v1/auth/verify-email?token=${rawUser.emailVerificationToken}&email=${encodeURIComponent(userEmail)}`,
    });
    assert.strictEqual(verifyRes.statusCode, 200);

    // Login
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: userEmail,
        password: userPassword,
      },
    });
    assert.strictEqual(loginRes.statusCode, 200);
    const loginBody = JSON.parse(loginRes.payload);
    userToken = loginBody.data.token;

    // Verify personalOnboardingCompleted is false initially
    assert.strictEqual(loginBody.data.user.personalOnboardingCompleted, false);
  });

  test('2. GET /api/v1/onboarding/personal returns personalOnboardingCompleted: false', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/onboarding/personal',
      headers: { authorization: `Bearer ${userToken}` },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.personalOnboardingCompleted, false);
  });

  test('3. POST /api/v1/onboarding/personal saves intent answers and completes personal setup', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/onboarding/personal',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        use_cases: ['inventory', 'pos'],
        acquisition_source: 'friend',
        role: 'Owner',
        manages_business: true,
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.personalOnboardingCompleted, true);
    assert.ok(body.data.profile);
    assert.deepStrictEqual(body.data.profile.useCases, ['inventory', 'pos']);
    assert.strictEqual(body.data.profile.acquisitionSource, 'friend');
    assert.strictEqual(body.data.profile.role, 'Owner');
    assert.strictEqual(body.data.profile.managesBusiness, true);
  });

  test('4. GET /api/v1/onboarding/personal and GET /api/v1/auth/me reflect completed personal onboarding', async () => {
    const personalRes = await app.inject({
      method: 'GET',
      url: '/api/v1/onboarding/personal',
      headers: { authorization: `Bearer ${userToken}` },
    });

    assert.strictEqual(personalRes.statusCode, 200);
    const personalBody = JSON.parse(personalRes.payload);
    assert.strictEqual(personalBody.data.personalOnboardingCompleted, true);

    const meRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${userToken}` },
    });

    assert.strictEqual(meRes.statusCode, 200);
    const meBody = JSON.parse(meRes.payload);
    assert.strictEqual(meBody.data.user.personalOnboardingCompleted, true);
  });

  test('5. User has a valid personal account with 0 organizations without errors', async () => {
    const orgsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/organizations',
      headers: { authorization: `Bearer ${userToken}` },
    });

    assert.strictEqual(orgsRes.statusCode, 200);
    const orgsBody = JSON.parse(orgsRes.payload);
    assert.strictEqual(orgsBody.success, true);
    assert.strictEqual(orgsBody.data.organizations.length, 0);
  });

  test('6. User can later create an organization after personal onboarding', async () => {
    const createOrgRes = await app.inject({
      method: 'POST',
      url: '/api/v1/orgs',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        name: 'Late Created Business',
        businessPhone: '+2348011223344',
        address: '15 Broad Street, Lagos',
        category: 'Supermarket & Groceries',
        currency: 'NGN',
        planId: 'free_trial',
      },
    });

    assert.strictEqual(createOrgRes.statusCode, 201);
    const createOrgBody = JSON.parse(createOrgRes.payload);
    assert.strictEqual(createOrgBody.success, true);
    assert.ok(createOrgBody.data.organization.id);

    // Verify user now has 1 organization
    const orgsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/organizations',
      headers: { authorization: `Bearer ${userToken}` },
    });
    assert.strictEqual(orgsRes.statusCode, 200);
    const orgsBody = JSON.parse(orgsRes.payload);
    assert.strictEqual(orgsBody.data.organizations.length, 1);
  });
});
