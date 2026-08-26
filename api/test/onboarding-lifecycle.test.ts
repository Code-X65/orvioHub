import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { dataService } from '../src/services/dataService.js';
import type { FastifyInstance } from 'fastify';

describe('Phase 4: Reusable Onboarding & Resumability Test Suite', () => {
  let app: FastifyInstance;
  let userToken: string;
  let userEmail: string;
  let userId: string;
  let orgId: string;

  before(async () => {
    app = await buildApp();
    await app.ready();

    const timestamp = Date.now();
    userEmail = `onboard_user_${timestamp}@onboarding-test.com`;

    // Create verified test user
    const { user } = await dataService.createUser({
      name: 'Onboarding Tester',
      email: userEmail,
      password: 'Password123!',
      emailVerified: true,
    });
    userId = user.id;

    const session = await dataService.createSession(user.id, {
      userAgent: 'test-agent',
      ipAddress: '127.0.0.1',
      authenticationMethod: 'password',
      tokenVersion: user.tokenVersion ?? 1,
    });

    userToken = app.jwt.sign({
      userId: user.id,
      email: user.email,
      sessionId: session.sessionId,
      tokenVersion: user.tokenVersion ?? 1,
    });
  });

  after(async () => {
    await app.close();
  });

  test('1. Initial Onboarding State: Brand new user starts at ORGANIZATION_CREATION', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/onboarding/status',
      headers: { authorization: `Bearer ${userToken}` },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.currentStep, 'ORGANIZATION_CREATION');
    assert.strictEqual(body.data.status, 'IN_PROGRESS');
    assert.strictEqual(body.data.canSkipCurrentStep, false);
  });

  test('2. Step 1: POST /api/v1/organizations creates org and advances state to MODULE_SELECTION', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/organizations',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        name: 'Prime Logistics Nigeria',
        industry: 'Manufacturing & Logistics',
        country: 'NG',
        currency: 'NGN',
        timezone: 'Africa/Lagos',
      },
    });

    assert.strictEqual(res.statusCode, 201);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.success, true);
    assert.ok(body.data.organization.id);
    orgId = body.data.organization.id;

    // Check updated onboarding status
    const statusRes = await app.inject({
      method: 'GET',
      url: '/api/v1/onboarding/status',
      headers: { authorization: `Bearer ${userToken}` },
    });

    assert.strictEqual(statusRes.statusCode, 200);
    const statusBody = JSON.parse(statusRes.payload);
    assert.strictEqual(statusBody.data.currentStep, 'MODULE_SELECTION');
    assert.strictEqual(statusBody.data.organization.name, 'Prime Logistics Nigeria');
  });

  test('3. Resumability: User reconnecting preserves active step and previously entered data', async () => {
    // Simulate user reloading or re-authenticating
    const resumeRes = await app.inject({
      method: 'GET',
      url: '/api/v1/onboarding/status',
      headers: { authorization: `Bearer ${userToken}` },
    });

    assert.strictEqual(resumeRes.statusCode, 200);
    const resumeBody = JSON.parse(resumeRes.payload);
    assert.strictEqual(resumeBody.data.currentStep, 'MODULE_SELECTION');
    assert.strictEqual(resumeBody.data.organization.id, orgId);
    assert.ok(resumeBody.data.completedSteps.includes('ORGANIZATION_CREATION'));
  });

  test('4. Step 2: POST /api/v1/onboarding/modules activates selected apps & advances to WORKSPACE_INITIALIZATION', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/onboarding/modules',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        organizationId: orgId,
        modules: ['customers', 'sales', 'inventory'],
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.success, true);
    assert.deepStrictEqual(body.data.enabledModules, ['customers', 'sales', 'inventory']);

    // Check status
    const statusRes = await app.inject({
      method: 'GET',
      url: '/api/v1/onboarding/status',
      headers: { authorization: `Bearer ${userToken}` },
    });
    const statusBody = JSON.parse(statusRes.payload);
    assert.strictEqual(statusBody.data.currentStep, 'WORKSPACE_INITIALIZATION');
  });

  test('5. Step 3: POST /api/v1/onboarding/workspace initializes workspace and advances to WORKSPACE_READY', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/onboarding/workspace',
      headers: { authorization: `Bearer ${userToken}` },
      payload: { organizationId: orgId },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.workspace.status, 'READY');

    // Check status
    const statusRes = await app.inject({
      method: 'GET',
      url: '/api/v1/onboarding/status',
      headers: { authorization: `Bearer ${userToken}` },
    });
    const statusBody = JSON.parse(statusRes.payload);
    assert.ok(statusBody.data.currentStep === 'WORKSPACE_READY' || statusBody.data.currentStep === 'TEAM_INVITATION');
  });

  test('6. Step 4: POST /api/v1/onboarding/share-link generates shareable team invite link', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/onboarding/share-link',
      headers: { authorization: `Bearer ${userToken}` },
      payload: { role: 'MEMBER' },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.success, true);
    assert.ok(body.data.inviteUrl.includes('/invitations/'));
    assert.ok(body.data.token);
    assert.ok(body.data.expiresAt > Date.now());
  });

  test('7. Step 4: POST /api/v1/onboarding/skip skips optional team invite step safely', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/onboarding/skip',
      headers: { authorization: `Bearer ${userToken}` },
      payload: { step: 'TEAM_INVITATION' },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.success, true);
    assert.ok(body.data.completedSteps.includes('TEAM_INVITATION'));
  });

  test('8. Step 5: POST /api/v1/onboarding/complete transitions onboarding to COMPLETED', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/onboarding/complete',
      headers: { authorization: `Bearer ${userToken}` },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.status, 'COMPLETED');
    assert.strictEqual(body.data.currentStep, 'COMPLETED');

    // Verify status query now confirms COMPLETED
    const finalRes = await app.inject({
      method: 'GET',
      url: '/api/v1/onboarding/status',
      headers: { authorization: `Bearer ${userToken}` },
    });
    const finalBody = JSON.parse(finalRes.payload);
    assert.strictEqual(finalBody.data.status, 'COMPLETED');
  });
});
