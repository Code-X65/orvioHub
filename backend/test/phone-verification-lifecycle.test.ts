import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { dataService } from '../src/services/dataService.js';
import { normalizePhoneNumber, isValidPhoneNumber, maskPhoneNumber, hashOtpCode } from '../src/utils/phoneUtils.js';
import type { FastifyInstance } from 'fastify';

describe('Phone Verification & Governance Lifecycle Test Suite', () => {
  let app: FastifyInstance;
  let userToken: string;
  let userEmail: string;
  let userId: string;
  let adminToken: string;
  let workspaceId: string;
  let branchId: string;

  before(async () => {
    app = await buildApp();
    await app.ready();

    const timestamp = Date.now();

    // 1. Create verified test user
    userEmail = `phone_user_${timestamp}@phonetest.com`;
    const { user } = await dataService.createUser({
      name: 'Phone Test User',
      email: userEmail,
      phone: '08031234567',
      password: 'Password123!',
      emailVerified: true,
    });
    userId = user.id;

    const session = await dataService.createSession(user.id, {
      userAgent: 'TestBrowser/1.0',
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

    workspaceId = `ws_test_${timestamp}`;
    branchId = `branch_test_${timestamp}`;

    // 3. Create Superadmin session
    const adminEmail = `phone_admin_${timestamp}@orviohub.com`;
    const adminPassword = 'AdminSecretPassword123!';
    await dataService.mutate('adminAuth:createAdmin', {
      email: adminEmail,
      name: 'Phone Super Admin',
      password: adminPassword,
      role: 'super_admin',
      isDevBootstrap: true,
    });
    const adminLoginRes: any = await dataService.mutate('adminAuth:login', {
      email: adminEmail,
      password: adminPassword,
    });
    adminToken = adminLoginRes.token;
  });

  after(async () => {
    if (app) await app.close();
  });

  test('1. Phone utility normalization, validation, and masking', () => {
    // Nigerian local formats
    assert.equal(normalizePhoneNumber('08031234567'), '+2348031234567');
    assert.equal(normalizePhoneNumber('07012345678'), '+2347012345678');
    assert.equal(normalizePhoneNumber('09098765432'), '+2349098765432');
    assert.equal(normalizePhoneNumber('2348031234567'), '+2348031234567');
    assert.equal(normalizePhoneNumber('+2348031234567'), '+2348031234567');

    // Validation
    assert.equal(isValidPhoneNumber('08031234567'), true);
    assert.equal(isValidPhoneNumber('+14155552671'), true);
    assert.equal(isValidPhoneNumber('123'), false);
    assert.equal(isValidPhoneNumber('invalid_phone'), false);

    // Masking
    const masked = maskPhoneNumber('+2348031234567');
    assert.ok(masked.startsWith('+234'));
    assert.ok(masked.endsWith('4567'));
    assert.ok(masked.includes('••••'));

    // Hashing
    const hash1 = hashOtpCode('123456');
    const hash2 = hashOtpCode('123456');
    const hash3 = hashOtpCode('654321');
    assert.equal(hash1, hash2);
    assert.notEqual(hash1, hash3);
  });

  test('2. Start Personal Phone verification challenge', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/users/me/phone/verification/start',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        phone: '08031234567',
        purpose: 'user_phone_verification',
      },
    });

    if (res.statusCode !== 200) {
      console.log('TEST 2 FAILED BODY:', res.body);
    }
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.success, true);
    assert.equal(body.data.phoneNormalized, '+2348031234567');
    assert.ok(body.data.challengeId);
  });

  test('3. Verify User Phone with invalid OTP code returns error and decrements attempts', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/users/me/phone/verification/verify',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        code: '000000',
        purpose: 'user_phone_verification',
      },
    });

    if (res.statusCode !== 400) {
      console.log('TEST 3 BODY:', res.body);
    }
    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'INVALID_CODE');
    assert.equal(typeof body.error.attemptsRemaining, 'number');
  });

  test('4. Workspace phone verification challenge creation and segregation', async () => {
    // Start workspace phone verification
    const wsRes = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${workspaceId}/settings/phone/verification/start`,
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        phone: '08099887766',
        purpose: 'workspace_phone_verification',
      },
    });

    assert.equal(wsRes.statusCode, 200);
    const wsBody = JSON.parse(wsRes.body);
    assert.equal(wsBody.data.phoneNormalized, '+2348099887766');

    // Confirm that workspace phone challenge did not alter user personal phone
    const userContact = await dataService.getUserContact(userId);
    assert.equal(userContact.phone, '08031234567');
  });

  test('5. Superadmin override phone verification and unlink', async () => {
    // Admin marks user phone as verified
    const markRes = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${userId}/phone/mark-verified`,
      headers: { 'x-admin-session': adminToken },
      payload: { reason: 'Verified via customer support manual check' },
    });

    assert.equal(markRes.statusCode, 200);
    const markBody = JSON.parse(markRes.body);
    assert.equal(markBody.success, true);

    // Verify user contact now reflects verified
    const verifiedContact = await dataService.getUserContact(userId);
    assert.equal(verifiedContact.phoneStatus, 'verified');

    // Admin unlinks phone number
    const unlinkRes = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${userId}/phone/unlink`,
      headers: { 'x-admin-session': adminToken },
      payload: { reason: 'User requested administrative unlinking' },
    });

    assert.equal(unlinkRes.statusCode, 200);
    const unlinkBody = JSON.parse(unlinkRes.body);
    assert.equal(unlinkBody.success, true);

    // Verify user contact now reflects not set
    const unlinkedContact = await dataService.getUserContact(userId);
    assert.equal(unlinkedContact.phone, null);
    assert.equal(unlinkedContact.phoneStatus, 'not_set');
  });

  test('6. Superadmin query phone verification challenges and stats', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/phone-challenges?page=1&pageSize=10',
      headers: { 'x-admin-session': adminToken },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data.challenges));
    assert.ok(body.data.stats);
    assert.equal(typeof body.data.stats.totalChallenges24h, 'number');
    assert.equal(typeof body.data.stats.successRatePercent, 'number');
  });
});
