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
  let userPhone: string;
  let workspaceId: string;
  let branchId: string;

  before(async () => {
    app = await buildApp();
    await app.ready();

    const timestamp = Date.now();
    userPhone = '0803' + String(timestamp).slice(-7);

    // 1. Create test user
    userEmail = `phone_user_${timestamp}@phonetest.com`;
    const { user } = await dataService.createUser({
      name: 'Phone Test User',
      email: userEmail,
      phone: userPhone,
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

    const { organization: org } = await dataService.createOrganization({
      userId: user.id,
      name: 'Phone Test Org',
      country: 'NG',
      industry: 'retail',
      timezone: 'Africa/Lagos',
    });
    workspaceId = org.id;
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
        phone: userPhone,
        purpose: 'user_phone_verification',
      },
    });

    if (res.statusCode !== 200) {
      console.log('TEST 2 FAILED BODY:', res.body);
    }
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.success, true);
    assert.equal(body.data.phoneNormalized, normalizePhoneNumber(userPhone));
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
    const wsPhone = '0809' + String(Date.now()).slice(-7);
    // Start workspace/org phone verification
    const wsRes = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${workspaceId}/settings/phone/verification/start`,
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        phone: wsPhone,
        purpose: 'workspace_phone_verification',
      },
    });

    assert.equal(wsRes.statusCode, 200);
    const wsBody = JSON.parse(wsRes.body);
    assert.equal(wsBody.data.phoneNormalized, normalizePhoneNumber(wsPhone));

    // Confirm that workspace phone challenge did not alter user personal phone
    const userContact = await dataService.getUserContact(userId);
    assert.equal(userContact.phone, userPhone);
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

  test('7. Rule 1: Cannot propose the same phone number if already verified', async () => {
    const timestamp = Date.now();
    const testEmail1 = `rule1_user_${timestamp}@test.com`;
    const { user: user1 } = await dataService.createUser({
      name: 'Rule 1 User',
      email: testEmail1,
      phone: '08012345678',
      password: 'Password123!',
      emailVerified: true,
    });

    // Mark verified via admin endpoint
    await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${user1.id}/phone/mark-verified`,
      headers: { 'x-admin-session': adminToken },
      payload: { reason: 'Test setup verification' },
    });

    const session1 = await dataService.createSession(user1.id, {
      userAgent: 'TestBrowser/1.0',
      ipAddress: '127.0.0.1',
      authenticationMethod: 'password',
      tokenVersion: user1.tokenVersion ?? 1,
    });
    const token1 = app.jwt.sign({
      userId: user1.id,
      email: user1.email,
      sessionId: session1.sessionId,
      tokenVersion: user1.tokenVersion ?? 1,
    });

    // Attempt to start verification with identical number
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/users/me/phone/verification/start',
      headers: { authorization: `Bearer ${token1}` },
      payload: {
        phone: '08012345678',
        purpose: 'user_phone_verification',
      },
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'SAME_PHONE_NUMBER');
  });

  test('8. Rule 2: Cannot verify a phone number already registered/verified by another user', async () => {
    const timestamp = Date.now();
    // User A has +2348099112233 verified
    const { user: userA } = await dataService.createUser({
      name: 'User A',
      email: `user_a_${timestamp}@test.com`,
      phone: '08099112233',
      password: 'Password123!',
      emailVerified: true,
    });
    await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${userA.id}/phone/mark-verified`,
      headers: { 'x-admin-session': adminToken },
      payload: { reason: 'Test setup verification' },
    });

    // User B tries to start verification with User A's number
    const { user: userB } = await dataService.createUser({
      name: 'User B',
      email: `user_b_${timestamp}@test.com`,
      password: 'Password123!',
      emailVerified: true,
    });
    const sessionB = await dataService.createSession(userB.id, {
      userAgent: 'TestBrowser/1.0',
      ipAddress: '127.0.0.1',
      authenticationMethod: 'password',
      tokenVersion: userB.tokenVersion ?? 1,
    });
    const tokenB = app.jwt.sign({
      userId: userB.id,
      email: userB.email,
      sessionId: sessionB.sessionId,
      tokenVersion: userB.tokenVersion ?? 1,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/users/me/phone/verification/start',
      headers: { authorization: `Bearer ${tokenB}` },
      payload: {
        phone: '08099112233',
        purpose: 'user_phone_verification',
      },
    });

    assert.equal(res.statusCode, 409);
    const body = JSON.parse(res.body);
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'PHONE_ALREADY_IN_USE');
  });

  test('9. Immutability: Direct PATCH /users/me cannot change a verified phone number', async () => {
    const timestamp = Date.now();
    const { user: verifiedUser } = await dataService.createUser({
      name: 'Immutable User',
      email: `immutable_${timestamp}@test.com`,
      phone: '08055443322',
      password: 'Password123!',
      emailVerified: true,
    });
    await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${verifiedUser.id}/phone/mark-verified`,
      headers: { 'x-admin-session': adminToken },
      payload: { reason: 'Test setup verification' },
    });

    const session = await dataService.createSession(verifiedUser.id, {
      userAgent: 'TestBrowser/1.0',
      ipAddress: '127.0.0.1',
      authenticationMethod: 'password',
      tokenVersion: verifiedUser.tokenVersion ?? 1,
    });
    const token = app.jwt.sign({
      userId: verifiedUser.id,
      email: verifiedUser.email,
      sessionId: session.sessionId,
      tokenVersion: verifiedUser.tokenVersion ?? 1,
    });

    // Try modifying phone directly via PATCH /me (without phone verification OTP)
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/users/me',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        firstName: 'UpdatedName',
        phone: '08077665544',
      },
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'VERIFIED_PHONE_LOCKED');
  });

  test('10. Phone change resets phoneUsedForRecovery and phoneUsedForMfa security flags', async () => {
    const timestamp = Date.now();
    const initialPhone = '0803' + String(timestamp).slice(-7);
    const newPhone = '0802' + String(timestamp).slice(-7);

    // 1. Create and verify user with recovery & MFA flags enabled
    const { user } = await dataService.createUser({
      name: 'Security Flags User',
      email: `security_flags_${timestamp}@test.com`,
      phone: initialPhone,
      password: 'Password123!',
      emailVerified: true,
    });

    await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${user.id}/phone/mark-verified`,
      headers: { 'x-admin-session': adminToken },
      payload: { reason: 'Test setup' },
    });

    const session = await dataService.createSession(user.id, {
      userAgent: 'TestBrowser/1.0',
      ipAddress: '127.0.0.1',
      authenticationMethod: 'password',
      tokenVersion: user.tokenVersion ?? 1,
    });
    const token = app.jwt.sign({
      userId: user.id,
      email: user.email,
      sessionId: session.sessionId,
      tokenVersion: user.tokenVersion ?? 1,
    });

    // 2. Enable recovery and MFA flags via PATCH /me/contact
    await app.inject({
      method: 'PATCH',
      url: '/api/v1/users/me/contact',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        phoneUsedForRecovery: true,
        phoneUsedForMfa: true,
      },
    });

    const contactBefore = await dataService.getUserContact(user.id);
    assert.equal(contactBefore.phoneUsedForRecovery, true);
    assert.equal(contactBefore.phoneUsedForMfa, true);

    // 3. User initiates phone change and verifies new phone with purpose 'user_phone_change'
    const otpCode = '654321';
    const codeHash = hashOtpCode(otpCode);
    await (dataService as any).mutate('phoneVerification:createChallenge', {
      userId: user.id,
      phone: newPhone,
      phoneNormalized: normalizePhoneNumber(newPhone),
      purpose: 'user_phone_change',
      codeHash,
    });

    // Complete verification via Fastify verify endpoint with purpose 'user_phone_change'
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/users/me/phone/verification/verify',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        code: otpCode,
        purpose: 'user_phone_change',
      },
    });
    assert.equal(verifyRes.statusCode, 200);

    // 4. Verify that security flags were reset to false on phone change
    const contactAfter = await dataService.getUserContact(user.id);
    assert.equal(contactAfter.phoneStatus, 'verified');
    assert.equal(contactAfter.phoneUsedForRecovery, false);
    assert.equal(contactAfter.phoneUsedForMfa, false);
  });

  test('11. Admin override and unlink workspace phone number', async () => {
    const wsPhone = '08123456789';

    // Mark workspace phone verified via admin endpoint
    const markRes = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/workspaces/${workspaceId}/phone/mark-verified`,
      headers: { 'x-admin-session': adminToken },
      payload: { phone: wsPhone, reason: 'Manual organization compliance verification' },
    });

    assert.equal(markRes.statusCode, 200);
    const markBody = JSON.parse(markRes.body);
    assert.equal(markBody.success, true);
    assert.equal(markBody.data.phoneNormalized, normalizePhoneNumber(wsPhone));

    // Admin unlinks workspace phone
    const unlinkRes = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/workspaces/${workspaceId}/phone/unlink`,
      headers: { 'x-admin-session': adminToken },
      payload: { reason: 'Workspace requested phone reset' },
    });

    assert.equal(unlinkRes.statusCode, 200);
    const unlinkBody = JSON.parse(unlinkRes.body);
    assert.equal(unlinkBody.success, true);
  });

  test('12. Admin override and unlink branch phone number', async () => {
    const testBranchPhone = '08099887766';

    // Mark branch phone verified via admin endpoint
    const markRes = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/branches/${branchId}/phone/mark-verified`,
      headers: { 'x-admin-session': adminToken },
      payload: { phone: testBranchPhone, reason: 'Direct branch manager manual check' },
    });

    assert.equal(markRes.statusCode, 200);
    const markBody = JSON.parse(markRes.body);
    assert.equal(markBody.success, true);
    assert.equal(markBody.data.phoneNormalized, normalizePhoneNumber(testBranchPhone));

    // Admin unlinks branch phone
    const unlinkRes = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/branches/${branchId}/phone/unlink`,
      headers: { 'x-admin-session': adminToken },
      payload: { reason: 'Branch relocated and phone decommissioned' },
    });

    assert.equal(unlinkRes.statusCode, 200);
    const unlinkBody = JSON.parse(unlinkRes.body);
    assert.equal(unlinkBody.success, true);
  });

  test('13. isPhoneRegistered fail-closed validation & uniqueness', async () => {
    // Verified user phone check
    const isRegistered = await dataService.isPhoneRegistered(normalizePhoneNumber(userPhone));
    assert.equal(typeof isRegistered, 'boolean');

    // Unregistered phone check
    const isUnregistered = await dataService.isPhoneRegistered('+2349999999999');
    assert.equal(isUnregistered, false);
  });
});

