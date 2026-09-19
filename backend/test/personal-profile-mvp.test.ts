import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { dataService, type UserRecord } from '../src/services/dataService.js';
import { ERROR_CODES, AUDIT_EVENTS } from '../src/config/constants.js';

describe('Nigerian MVP Personal Profile Test Suite', () => {
  let app: FastifyInstance;
  let userToken: string;
  let userId: string;
  let userEmail: string;
  let sessionId: string;
  let auditLogs: any[] = [];

  before(async () => {
    app = await buildApp();
    await app.ready();

    userEmail = `nigerian_mvp_${Date.now()}@example.com`;
    const { user } = await dataService.createUser({
      email: userEmail,
      name: 'Chinedu Okafor',
      firstName: 'Chinedu',
      lastName: 'Okafor',
      emailVerified: true,
      password: 'StrongPassword123!',
      country: 'NG',
      timezone: 'Africa/Lagos',
    });
    userId = user.id;

    const sessionRes = await dataService.createSession(userId, {
      deviceName: 'Chrome on macOS',
      userAgent: 'Mozilla/5.0',
      ipAddress: '102.89.23.10',
    });
    sessionId = sessionRes.sessionId;

    userToken = app.jwt.sign({
      userId,
      email: userEmail,
      sessionId,
      tokenVersion: user.tokenVersion ?? 1,
    });
  });

  after(async () => {
    await app.close();
  });

  beforeEach(() => {
    auditLogs = [];
    const origLogAudit = dataService.logAudit.bind(dataService);
    dataService.logAudit = async (data: any) => {
      auditLogs.push(data);
      return origLogAudit(data);
    };
  });

  // 1. Profile retrieval
  test('1. Authenticated user can fetch profile via /api/v1/users/me with Nigerian defaults and requestId', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me',
      headers: { authorization: `Bearer ${userToken}` },
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.user.id, userId);
    assert.equal(body.data.user.firstName, 'Chinedu');
    assert.equal(body.data.user.lastName, 'Okafor');
    assert.equal(body.data.user.country, 'NG');
    assert.equal(body.data.user.timezone, 'Africa/Lagos');
    assert.equal(body.data.user.timezoneLabel, 'West Africa Time (WAT)');
    assert.ok(body.requestId);
  });

  test('2. Direct GET /v1/users/me succeeds without redirect', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/users/me',
      headers: { authorization: `Bearer ${userToken}` },
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.user.id, userId);
  });

  test('3. Unauthenticated request to GET /v1/users/me is rejected with 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/users/me',
    });

    assert.equal(res.statusCode, 401);
  });

  // 2. Profile updating
  test('4. Updating required fields (firstName, lastName) and optional fields succeeds', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/users/me',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        firstName: 'Emeka',
        lastName: 'Nnamdi',
        displayName: 'Emeka N.',
        jobTitle: 'Store Manager',
        department: 'Operations',
        country: 'NG',
        timezone: 'Africa/Lagos',
      },
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.user.firstName, 'Emeka');
    assert.equal(body.data.user.lastName, 'Nnamdi');
    assert.equal(body.data.user.displayName, 'Emeka N.');
    assert.equal(body.data.user.jobTitle, 'Store Manager');
    assert.equal(body.data.user.department, 'Operations');
    assert.equal(body.data.user.country, 'NG');
    assert.equal(body.data.user.timezone, 'Africa/Lagos');
    assert.equal(body.data.user.timezoneLabel, 'West Africa Time (WAT)');
  });

  test('5. Empty or whitespace-only firstName fails with 400 validation error', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/users/me',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        firstName: '   ',
      },
    });

    assert.equal(res.statusCode, 400);
    const body = res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, ERROR_CODES.VALIDATION_ERROR);
  });

  test('6. Submitting country other than NG is rejected with 400 PROFILE_REGIONAL_VALUE_NOT_SUPPORTED', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/users/me',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        country: 'US',
      },
    });

    assert.equal(res.statusCode, 400);
    const body = res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, ERROR_CODES.PROFILE_REGIONAL_VALUE_NOT_SUPPORTED);
    assert.match(body.error.message, /Only Nigeria and West Africa Time are currently supported/i);
  });

  test('7. Submitting timezone other than Africa/Lagos is rejected with 400 PROFILE_REGIONAL_VALUE_NOT_SUPPORTED', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/users/me',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        timezone: 'America/New_York',
      },
    });

    assert.equal(res.statusCode, 400);
    const body = res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, ERROR_CODES.PROFILE_REGIONAL_VALUE_NOT_SUPPORTED);
  });

  test('8. Valid Nigerian phone numbers are normalized to international format (+234...)', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/users/me',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        phone: '0803 123 4567',
      },
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.user.phone, '+2348031234567');
  });

  test('9. Invalid Nigerian phone is rejected with 400 validation error', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/users/me',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        phone: '1234567',
      },
    });

    assert.equal(res.statusCode, 400);
    const body = res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, ERROR_CODES.VALIDATION_ERROR);
  });

  test('10. Phone can be removed by submitting empty string or null', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/users/me',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        phone: '',
      },
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.success, true);
    assert.ok(!body.data.user.phone || body.data.user.phone === '');
  });

  test('11. Security fields (email, password, twoFactorEnabled) cannot be changed through profile endpoint', async () => {
    const originalUser = await dataService.getUserById(userId);
    const originalPasswordHash = originalUser?.passwordHash;
    const originalEmail = originalUser?.email;

    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/users/me',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        email: 'hacked_email@attacker.com',
        password: 'HackedPassword999!',
        passwordHash: 'fake_hash',
        twoFactorEnabled: true,
        status: 'suspended',
      },
    });

    assert.equal(res.statusCode, 200);
    const freshUser = await dataService.getUserById(userId);
    assert.equal(freshUser?.email, originalEmail);
    assert.equal(freshUser?.passwordHash, originalPasswordHash);
    assert.equal(Boolean(freshUser?.twoFactorEnabled), false);
    assert.equal(freshUser?.status, 'active');
  });

  test('12. Arbitrary userId in body is ignored and cannot modify another user', async () => {
    const victim = await dataService.createUser({
      email: `victim_${Date.now()}@example.com`,
      name: 'Victim User',
      firstName: 'Victim',
      lastName: 'User',
      emailVerified: true,
      password: 'Password123!',
    });

    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/users/me',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        userId: victim.user.id,
        firstName: 'HackedFirst',
      },
    });

    assert.equal(res.statusCode, 200);
    const victimAfter = await dataService.getUserById(victim.user.id);
    assert.equal(victimAfter?.firstName, 'Victim');
  });

  test('13. Audit events are created only for actual changes with safe metadata', async () => {
    auditLogs = [];

    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/users/me',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        jobTitle: 'Chief Logistics Officer',
      },
    });

    assert.equal(res.statusCode, 200);
    assert.ok(auditLogs.length > 0);

    const jobTitleEvent = auditLogs.find((e) => e.eventType === AUDIT_EVENTS.PROFILE_JOB_TITLE_UPDATED);
    assert.ok(jobTitleEvent, 'PROFILE_JOB_TITLE_UPDATED event should be emitted');
    assert.equal(jobTitleEvent.actorUserId, userId);
    assert.ok(jobTitleEvent.metadata?.changedFields?.includes('jobTitle'));
    assert.ok(!jobTitleEvent.metadata?.password);
    assert.ok(!jobTitleEvent.metadata?.token);
  });

  test('14. No audit event is created when saving without changing anything (no-op)', async () => {
    // Sync current values first
    await app.inject({
      method: 'PATCH',
      url: '/v1/users/me',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        firstName: 'Emeka',
        lastName: 'Nnamdi',
        jobTitle: 'Store Director',
      },
    });

    auditLogs = [];

    // Submit identical values
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/users/me',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        firstName: 'Emeka',
        lastName: 'Nnamdi',
        jobTitle: 'Store Director',
      },
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.success, true);
    assert.equal(body.message, 'Personal profile is already up to date.');
    assert.equal(auditLogs.length, 0, 'No audit events should be emitted for a no-op update');
  });
});
