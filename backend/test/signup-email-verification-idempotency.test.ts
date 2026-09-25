import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { buildApp } from '../src/app.js';
import { dataService, type UserRecord } from '../src/services/dataService.js';
import { ERROR_CODES, AUDIT_EVENTS } from '../src/config/constants.js';

describe('Signup & Email Verification Flow with Idempotency Test Suite', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  // In-memory test state
  let usersDb = new Map<string, UserRecord>();
  let idempotencyDb = new Map<string, any>();
  let auditLogs: any[] = [];
  let authEvents: any[] = [];

  // Original methods
  const originals = {
    createUser: dataService.createUser,
    getUserById: dataService.getUserById,
    getUserByEmail: dataService.getUserByEmail,
    verifyPassword: dataService.verifyPassword,
    verifyEmail: dataService.verifyEmail,
    resendVerificationEmail: dataService.resendVerificationEmail,
    changePendingEmail: dataService.changePendingEmail,
    acquireIdempotencyKey: dataService.acquireIdempotencyKey,
    completeIdempotencyKey: dataService.completeIdempotencyKey,
    failIdempotencyKey: dataService.failIdempotencyKey,
    logAudit: dataService.logAudit,
    logAuthEvent: dataService.logAuthEvent,
    createSession: dataService.createSession,
    getSessionById: dataService.getSessionById,
    getUserMemberships: dataService.getUserMemberships,
    getOnboardingStatus: dataService.getOnboardingStatus,
  };

  beforeEach(async () => {
    usersDb = new Map<string, UserRecord>();
    idempotencyDb = new Map<string, any>();
    auditLogs = [];
    authEvents = [];

    dataService.logAudit = async (data) => {
      auditLogs.push(data);
    };

    dataService.logAuthEvent = async (data) => {
      authEvents.push(data);
    };

    dataService.createUser = async (data) => {
      const email = data.email.toLowerCase().trim();
      const id = `user_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const code = '123456';
      const passwordHash = await bcrypt.hash(data.password, 4);

      const record: UserRecord = {
        id,
        email,
        emailNormalized: email,
        name: data.name || `${data.firstName || ''} ${data.lastName || ''}`.trim(),
        firstName: data.firstName,
        lastName: data.lastName,
        displayName: data.displayName || data.name,
        country: data.country || 'Nigeria',
        phone: data.phone,
        passwordHash,
        emailVerified: data.emailVerified ?? false,
        emailVerificationTokenHash: tokenHash,
        emailVerificationTokenUsed: false,
        status: data.status || 'pending_email_verification',
        tokenVersion: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      usersDb.set(id, record);
      return { user: record, token };
    };

    dataService.getUserById = async (id: string) => {
      return usersDb.get(id) || null;
    };

    dataService.getUserByEmail = async (email: string) => {
      const norm = email.toLowerCase().trim();
      for (const user of usersDb.values()) {
        if (user.email === norm || user.emailNormalized === norm) return user;
      }
      return null;
    };

    dataService.verifyPassword = async (user: UserRecord, password: string) => {
      if (!user.passwordHash) return false;
      return bcrypt.compare(password, user.passwordHash);
    };

    dataService.verifyEmail = async (params: string | { token?: string; code?: string; email?: string }) => {
      const payload: any = typeof params === 'string' ? { token: params } : params;
      let user: UserRecord | null = null;

      if (payload.token) {
        const tokenHash = crypto.createHash('sha256').update(payload.token).digest('hex');
        for (const u of usersDb.values()) {
          if (u.emailVerificationTokenHash === tokenHash) {
            user = u;
            break;
          }
        }
      } else if (payload.code && payload.email) {
        user = await dataService.getUserByEmail(payload.email);
        if (user && payload.code !== '123456') {
          const err: any = new Error('Invalid verification code.');
          err.code = 'INVALID_CODE';
          throw err;
        }
      }

      if (!user) {
        const err: any = new Error('Invalid or already used verification token.');
        err.code = 'INVALID_TOKEN';
        throw err;
      }

      if (user.emailVerificationTokenUsed) {
        const err: any = new Error('Invalid or already used verification token.');
        err.code = 'INVALID_TOKEN';
        throw err;
      }

      user.emailVerified = true;
      user.emailVerifiedAt = Date.now();
      user.emailVerificationTokenUsed = true;
      user.status = 'active';
      return { user };
    };

    dataService.resendVerificationEmail = async (email: string) => {
      const user = await dataService.getUserByEmail(email);
      if (!user || user.emailVerified) return false;
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      user.emailVerificationTokenHash = tokenHash;
      user.emailVerificationTokenUsed = false;
      return true;
    };

    dataService.changePendingEmail = async (userIdOrEmail: string, newEmail: string) => {
      let user = await dataService.getUserById(userIdOrEmail);
      if (!user) user = await dataService.getUserByEmail(userIdOrEmail);
      if (!user) {
        const err: any = new Error('User not found.');
        err.code = 'USER_NOT_FOUND';
        throw err;
      }
      if (user.status !== 'pending_email_verification' && user.emailVerified) {
        const err: any = new Error('Cannot change verified email.');
        err.code = 'CANNOT_CHANGE_VERIFIED_EMAIL';
        throw err;
      }
      const normNew = newEmail.toLowerCase().trim();
      const existing = await dataService.getUserByEmail(normNew);
      if (existing && existing.id !== user.id) {
        const err: any = new Error('Email already in use.');
        err.code = 'CONFLICT';
        throw err;
      }
      user.email = normNew;
      user.emailNormalized = normNew;
      const token = crypto.randomBytes(32).toString('hex');
      user.emailVerificationTokenHash = crypto.createHash('sha256').update(token).digest('hex');
      user.emailVerificationTokenUsed = false;
      return { user, token };
    };

    dataService.acquireIdempotencyKey = async (key: string, scope: string, fingerprint: string, ttlMs?: number) => {
      const now = Date.now();
      const existing = idempotencyDb.get(key);
      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          return { action: 'MISMATCH' };
        }
        if (existing.status === 'completed') {
          return { action: 'REPLAY', statusCode: existing.statusCode, responseBody: existing.responseBody };
        }
        if (existing.status === 'processing') {
          return { action: 'PROCESSING' };
        }
      }
      idempotencyDb.set(key, {
        key,
        scope,
        fingerprint,
        status: 'processing',
        createdAt: now,
        expiresAt: now + (ttlMs || 86_400_000),
      });
      return { action: 'ACQUIRED' };
    };

    dataService.completeIdempotencyKey = async (key: string, statusCode: number, responseBody: any, userId?: string) => {
      const existing = idempotencyDb.get(key);
      if (existing) {
        existing.status = 'completed';
        existing.statusCode = statusCode;
        existing.responseBody = typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody);
        existing.userId = userId;
      }
    };

    dataService.failIdempotencyKey = async (key: string) => {
      const existing = idempotencyDb.get(key);
      if (existing) existing.status = 'failed';
    };

    dataService.createSession = async (userId: string) => {
      return {
        sessionId: `sess_${Date.now()}`,
        refreshToken: `refresh_${Date.now()}`,
        expiresAt: Date.now() + 7 * 86_400_000,
      };
    };

    dataService.getSessionById = async (sessionId: string) => {
      return {
        id: sessionId,
        tokenVersion: 1,
        expiresAt: Date.now() + 7 * 86_400_000,
      } as any;
    };

    dataService.getUserMemberships = async () => [];
    dataService.getOnboardingStatus = async () => ({ currentStep: 'ORGANIZATION_CREATION', status: 'IN_PROGRESS' });

    app = await buildApp();
  });

  afterEach(() => {
    Object.assign(dataService, originals);
  });

  // Test 1: First signup attempt creates pending user and issues token
  test('1. First signup attempt creates pending user, sets status pending_email_verification, and issues token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: {
        email: 'user1@example.com',
        firstName: 'John',
        lastName: 'Doe',
        password: 'Password123!',
        country: 'Nigeria',
      },
      headers: {
        'idempotency-key': 'test-key-1',
      },
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.equal(body.data.user.email, 'user1@example.com');
    assert.equal(body.data.user.status, 'pending_email_verification');
    assert.equal(body.data.user.emailVerified, false);
    assert.ok(body.data.token);
  });

  // Test 2: Identical retry with same Idempotency-Key returns same signup payload (replayed 201)
  test('2. Identical retry with same Idempotency-Key returns same signup payload (replayed 201)', async () => {
    const payload = {
      email: 'user2@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
      password: 'Password123!',
      country: 'Nigeria',
    };
    const headers = { 'idempotency-key': 'test-key-2' };

    const firstRes = await app.inject({ method: 'POST', url: '/api/v1/auth/signup', payload, headers });
    assert.equal(firstRes.statusCode, 201);

    const secondRes = await app.inject({ method: 'POST', url: '/api/v1/auth/signup', payload, headers });
    assert.equal(secondRes.statusCode, 201);
    const body1 = JSON.parse(firstRes.payload);
    const body2 = JSON.parse(secondRes.payload);
    assert.equal(body1.data.user.email, body2.data.user.email);
    assert.equal(body1.data.user.id, body2.data.user.id);
  });

  // Test 3: Concurrent requests with same Idempotency-Key return 409 or clean serialization
  test('3. Concurrent request with same Idempotency-Key returns 409 IDEMPOTENCY_CONCURRENT_REQUEST', async () => {
    idempotencyDb.set('test-key-3', {
      key: 'test-key-3',
      scope: 'auth:signup',
      fingerprint: crypto.createHash('sha256').update(JSON.stringify({ email: 'concurrent@example.com' })).digest('hex'),
      status: 'processing',
      createdAt: Date.now(),
      expiresAt: Date.now() + 60000,
    });

    // Mock acquire to return PROCESSING
    dataService.acquireIdempotencyKey = async () => ({ action: 'PROCESSING' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: {
        email: 'concurrent@example.com',
        firstName: 'Alex',
        lastName: 'Concurrent',
        password: 'Password123!',
      },
      headers: { 'idempotency-key': 'test-key-3' },
    });

    assert.equal(res.statusCode, 409);
    const body = JSON.parse(res.payload);
    assert.equal(body.error.code, ERROR_CODES.IDEMPOTENCY_CONCURRENT_REQUEST);
  });

  // Test 4: Retry with same Idempotency-Key but modified email or details returns 400 IDEMPOTENCY_KEY_PAYLOAD_MISMATCH
  test('4. Retry with same Idempotency-Key but modified email returns 400 IDEMPOTENCY_KEY_PAYLOAD_MISMATCH', async () => {
    const key = 'test-key-4';
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: { email: 'original@example.com', firstName: 'First', lastName: 'User', password: 'Password123!' },
      headers: { 'idempotency-key': key },
    });

    const mismatchRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: { email: 'different@example.com', firstName: 'First', lastName: 'User', password: 'Password123!' },
      headers: { 'idempotency-key': key },
    });

    assert.equal(mismatchRes.statusCode, 400);
    const body = JSON.parse(mismatchRes.payload);
    assert.equal(body.error.code, ERROR_CODES.IDEMPOTENCY_KEY_PAYLOAD_MISMATCH);
  });

  // Test 5: Signup retry after failure/network-drop with same unverified email continues verification
  test('5. Signup retry with same unverified email returns 200 CONTINUE_VERIFICATION instead of 409 error', async () => {
    // First attempt creates account
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: { email: 'retry@example.com', firstName: 'Drop', lastName: 'Network', password: 'Password123!' },
      headers: { 'idempotency-key': 'key-drop-1' },
    });

    // User refreshes page, new form submission with a different or missing idempotency key
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: { email: 'retry@example.com', firstName: 'Drop', lastName: 'Network', password: 'Password123!' },
      headers: { 'idempotency-key': 'key-drop-2' },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.action, 'CONTINUE_VERIFICATION');
    assert.equal(body.status, 'pending_email_verification');
    assert.equal(body.data.nextRoute, '/verify-email');
  });

  // Test 6: Signup attempt with existing VERIFIED email returns 409 USER_ALREADY_EXISTS
  test('6. Signup attempt with existing VERIFIED email returns 409 USER_ALREADY_EXISTS', async () => {
    // Create an active verified user
    const user = await dataService.createUser({
      email: 'verified@example.com',
      password: 'Password123!',
      name: 'Active User',
      emailVerified: true,
      status: 'active',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: { email: 'verified@example.com', firstName: 'Active', lastName: 'User', password: 'Password123!' },
    });

    assert.equal(res.statusCode, 409);
    const body = JSON.parse(res.payload);
    assert.equal(body.error.code, ERROR_CODES.USER_ALREADY_EXISTS);
  });

  // Test 7: Verification token is hashed using SHA-256 before storage; raw token is not stored in users table
  test('7. Verification token is stored as SHA-256 hash in database', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: { email: 'hashcheck@example.com', firstName: 'Hash', lastName: 'Check', password: 'Password123!' },
    });
    assert.equal(res.statusCode, 201);
    const user = await dataService.getUserByEmail('hashcheck@example.com');
    assert.ok(user?.emailVerificationTokenHash);
    assert.equal(user?.emailVerificationTokenHash?.length, 64);
  });

  // Test 8: Email verification with valid 64-char token activates user account
  test('8. Email verification with valid token activates account (status: active, emailVerified: true)', async () => {
    let createdToken: string = '';
    const originalCreateUser = dataService.createUser;
    dataService.createUser = async (data) => {
      const res = await originalCreateUser.call(dataService, data);
      createdToken = res.token;
      return res;
    };

    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: { email: 'tokentest@example.com', firstName: 'Token', lastName: 'Test', password: 'Password123!' },
    });

    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: { token: createdToken },
    });

    assert.equal(verifyRes.statusCode, 200);
    const body = JSON.parse(verifyRes.payload);
    assert.equal(body.success, true);
    assert.equal(body.data.user.emailVerified, true);
    assert.equal(body.data.user.status, 'active');
  });

  // Test 9: Email verification with valid 6-digit numeric code activates user account
  test('9. Email verification with valid 6-digit code activates user account', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: { email: 'codeverify@example.com', firstName: 'Code', lastName: 'Verify', password: 'Password123!' },
    });

    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: { code: '123456', email: 'codeverify@example.com' },
    });

    assert.equal(verifyRes.statusCode, 200);
    const body = JSON.parse(verifyRes.payload);
    assert.equal(body.data.user.emailVerified, true);
    assert.equal(body.data.user.status, 'active');
  });

  // Test 10: Reusing already-used verification token returns 400 error
  test('10. Reusing already-used verification token returns 400 error', async () => {
    let rawToken = '';
    dataService.createUser = async (data) => {
      const token = 'token_test_unique_10';
      const user: UserRecord = {
        id: 'u10',
        email: data.email.toLowerCase(),
        name: 'User 10',
        emailVerified: false,
        emailVerificationTokenHash: crypto.createHash('sha256').update(token).digest('hex'),
        emailVerificationTokenUsed: false,
        status: 'pending_email_verification',
        tokenVersion: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      usersDb.set('u10', user);
      rawToken = token;
      return { user, token };
    };

    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: { email: 'u10@example.com', firstName: 'Ten', lastName: 'User', password: 'Password123!' },
    });

    // First use: success
    const firstVerify = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: { token: rawToken },
    });
    assert.equal(firstVerify.statusCode, 200);

    // Second use: error
    const secondVerify = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: { token: rawToken },
    });
    assert.equal(secondVerify.statusCode, 400);
    const body = JSON.parse(secondVerify.payload);
    assert.equal(body.error.code, ERROR_CODES.VALIDATION_ERROR);
  });

  // Test 11: Expired verification token returns 400 error
  test('11. Expired verification token returns 400 error', async () => {
    dataService.verifyEmail = async () => {
      const err: any = new Error('Verification token has expired.');
      err.code = 'TOKEN_EXPIRED';
      throw err;
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: { token: 'expired-token' },
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.payload);
    assert.match(body.error.message, /expired/i);
  });

  // Test 12: Invalid verification code returns 400 error
  test('12. Invalid verification code returns 400 error', async () => {
    const user = await dataService.createUser({
      email: 'badcode@example.com',
      password: 'Password123!',
      name: 'Bad Code',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: { email: 'badcode@example.com', code: '999999' },
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.payload);
    assert.match(body.error.message, /invalid/i);
  });

  // Test 13: Resend verification issues a fresh code and updates hash
  test('13. Resend verification issues a fresh code and updates hash', async () => {
    await dataService.createUser({
      email: 'resendtest@example.com',
      password: 'Password123!',
      name: 'Resend Test',
    });
    const beforeUser = await dataService.getUserByEmail('resendtest@example.com');
    const oldHash = beforeUser?.emailVerificationTokenHash;

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/resend-verification',
      payload: { email: 'resendtest@example.com' },
    });

    assert.equal(res.statusCode, 200);
    const afterUser = await dataService.getUserByEmail('resendtest@example.com');
    assert.notEqual(afterUser?.emailVerificationTokenHash, oldHash);
  });

  // Test 14: Resend verification cooldown enforced (429)
  test('14. Resend verification cooldown enforced within 15 seconds', async () => {
    await dataService.createUser({
      email: 'cooldowntest@example.com',
      password: 'Password123!',
      name: 'Cooldown Test',
    });

    // First request succeeds
    const firstRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/resend-verification',
      payload: { email: 'cooldowntest@example.com' },
    });
    assert.equal(firstRes.statusCode, 200);

    // Immediate second request is rate-limited / cooldown enforced
    const secondRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/resend-verification',
      payload: { email: 'cooldowntest@example.com' },
    });
    assert.equal(secondRes.statusCode, 429);
    const body = JSON.parse(secondRes.payload);
    assert.equal(body.error.code, ERROR_CODES.RATE_LIMIT_EXCEEDED);
  });

  // Test 15: Updating pending email with valid new email succeeds and sends code to new email
  test('15. Updating pending email with valid new email succeeds', async () => {
    await dataService.createUser({
      email: 'oldemail@example.com',
      password: 'Password123!',
      name: 'Change Email',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/change-pending-email',
      payload: {
        currentEmail: 'oldemail@example.com',
        newEmail: 'newemail@example.com',
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.equal(body.data.email, 'newemail@example.com');
    assert.ok(
      body.data.status === 'pending_email_verification' ||
        body.data.status === 'verification_required'
    );

    const updatedUser = await dataService.getUserByEmail('newemail@example.com');
    assert.ok(updatedUser);
  });

  // Test 16: Updating pending email with existing email in use returns 409 conflict
  test('16. Updating pending email with existing email in use returns 409 conflict', async () => {
    await dataService.createUser({
      email: 'pendinguser@example.com',
      password: 'Password123!',
      name: 'Pending User',
    });
    await dataService.createUser({
      email: 'alreadytaken@example.com',
      password: 'Password123!',
      name: 'Already Taken',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/change-pending-email',
      payload: {
        currentEmail: 'pendinguser@example.com',
        newEmail: 'alreadytaken@example.com',
      },
    });

    assert.equal(res.statusCode, 409);
    const body = JSON.parse(res.payload);
    assert.ok(
      body.error.code === ERROR_CODES.USER_ALREADY_EXISTS ||
        body.error.code === ERROR_CODES.EMAIL_ALREADY_IN_USE
    );
  });

  // Test 17: Attempting to update pending email on an already-verified user fails with 400
  test('17. Attempting to update pending email on an already-verified user fails with 400', async () => {
    await dataService.createUser({
      email: 'verifieduser@example.com',
      password: 'Password123!',
      name: 'Verified User',
      emailVerified: true,
      status: 'active',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/change-pending-email',
      payload: {
        currentEmail: 'verifieduser@example.com',
        newEmail: 'newemail2@example.com',
      },
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.payload);
    assert.equal(body.error.code, ERROR_CODES.VALIDATION_ERROR);
  });

  // Test 18: Pending unverified user logging in with correct credentials receives 200 with status: pending_email_verification and nextRoute: /verify-email
  test('18. Pending unverified user logging in receives 200 with status: pending_email_verification and nextRoute: /verify-email', async () => {
    await dataService.createUser({
      email: 'pendinglogin@example.com',
      password: 'Password123!',
      name: 'Pending Login',
      status: 'pending_email_verification',
      emailVerified: false,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'pendinglogin@example.com',
        password: 'Password123!',
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.status, 'pending_email_verification');
    assert.equal(body.nextRoute, '/verify-email');
    assert.ok(body.data.token);
  });

  // Test 19: Pending user JWT has accessLevel: verification_required
  test('19. Pending user JWT has accessLevel: verification_required', async () => {
    await dataService.createUser({
      email: 'jwtcheck@example.com',
      password: 'Password123!',
      name: 'JWT Check',
      status: 'pending_email_verification',
      emailVerified: false,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'jwtcheck@example.com',
        password: 'Password123!',
      },
    });

    const body = JSON.parse(res.payload);
    const token = body.data.token;
    const decoded = app.jwt.decode<any>(token);
    assert.equal(decoded.accessLevel, 'verification_required');
    assert.equal(decoded.status, 'pending_email_verification');
  });

  // Test 20: Pending user is blocked (403 EMAIL_NOT_VERIFIED) from accessing /api/v1/organizations
  test('20. Pending user is blocked (403 EMAIL_NOT_VERIFIED) from /api/v1/organizations', async () => {
    const signupRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: { email: 'orgblock@example.com', firstName: 'Org', lastName: 'Block', password: 'Password123!' },
    });
    const { token } = JSON.parse(signupRes.payload).data;

    const orgRes = await app.inject({
      method: 'GET',
      url: '/api/v1/organizations',
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(orgRes.statusCode, 403);
    const body = JSON.parse(orgRes.payload);
    assert.equal(body.error.code, ERROR_CODES.EMAIL_NOT_VERIFIED);
    assert.equal(body.error.nextRoute, '/verify-email');
  });

  // Test 21: Pending user is blocked (403 EMAIL_NOT_VERIFIED) from accessing /api/v1/workspaces
  test('21. Pending user is blocked (403 EMAIL_NOT_VERIFIED) from /api/v1/workspaces', async () => {
    const signupRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: { email: 'wsblock@example.com', firstName: 'Ws', lastName: 'Block', password: 'Password123!' },
    });
    const { token } = JSON.parse(signupRes.payload).data;

    const wsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/workspaces',
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(wsRes.statusCode, 403);
    const body = JSON.parse(wsRes.payload);
    assert.equal(body.error.code, ERROR_CODES.EMAIL_NOT_VERIFIED);
  });

  // Test 22: Pending user is blocked (403 EMAIL_NOT_VERIFIED) from accessing inventory endpoints
  test('22. Pending user is blocked (403 EMAIL_NOT_VERIFIED) from /api/v1/inventory', async () => {
    const signupRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: { email: 'invblock@example.com', firstName: 'Inv', lastName: 'Block', password: 'Password123!' },
    });
    const { token } = JSON.parse(signupRes.payload).data;

    const invRes = await app.inject({
      method: 'GET',
      url: '/api/v1/inventory/products',
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(invRes.statusCode, 403);
    const body = JSON.parse(invRes.payload);
    assert.equal(body.error.code, ERROR_CODES.EMAIL_NOT_VERIFIED);
  });

  // Test 23: Pending user is permitted to access /session, /verify-email, /resend-verification, /change-pending-email
  test('23. Pending user is permitted to access auth session and verification utility endpoints', async () => {
    const signupRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: { email: 'allowedroute@example.com', firstName: 'Allowed', lastName: 'User', password: 'Password123!' },
    });
    const { token } = JSON.parse(signupRes.payload).data;

    const sessionRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/session',
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(sessionRes.statusCode, 200);
    const body = JSON.parse(sessionRes.payload);
    assert.equal(body.data.status, 'pending_email_verification');
    assert.equal(body.data.accessLevel, 'verification_required');
  });

  // Test 24: After successful verification, user receives active session and can access protected endpoints
  test('24. After successful verification, user receives full access and can access /api/v1/organizations', async () => {
    let rawToken = '';
    dataService.createUser = async (data) => {
      const token = 'token_active_24';
      const user: UserRecord = {
        id: 'u24',
        email: data.email.toLowerCase(),
        name: 'User 24',
        emailVerified: false,
        emailVerificationTokenHash: crypto.createHash('sha256').update(token).digest('hex'),
        emailVerificationTokenUsed: false,
        status: 'pending_email_verification',
        tokenVersion: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      usersDb.set('u24', user);
      rawToken = token;
      return { user, token };
    };

    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: { email: 'verifiedaccess@example.com', firstName: 'Active', lastName: 'User', password: 'Password123!' },
    });

    // Verify email
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: { token: rawToken },
    });
    assert.equal(verifyRes.statusCode, 200);
    const activeToken = JSON.parse(verifyRes.payload).data.token;

    // Now access organizations
    const orgRes = await app.inject({
      method: 'GET',
      url: '/api/v1/organizations',
      headers: { authorization: `Bearer ${activeToken}` },
    });

    assert.equal(orgRes.statusCode, 200);
  });

  // Test 25: Audit events logged for key flow actions
  test('25. Audit events logged for signup, retry, email verification, and pending login', async () => {
    // 1. Signup
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: { email: 'audittest@example.com', firstName: 'Audit', lastName: 'Test', password: 'Password123!' },
      headers: { 'idempotency-key': 'audit-key-1' },
    });
    assert.ok(auditLogs.some((l) => l.eventType === AUDIT_EVENTS.AUTH_SIGNUP_COMPLETED));

    // 2. Signup retry
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: { email: 'audittest@example.com', firstName: 'Audit', lastName: 'Test', password: 'Password123!' },
      headers: { 'idempotency-key': 'audit-key-1' },
    });
    assert.ok(auditLogs.some((l) => l.eventType === AUDIT_EVENTS.AUTH_SIGNUP_IDEMPOTENCY_REPLAYED));

    // 3. Pending login
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'audittest@example.com', password: 'Password123!' },
    });
    assert.ok(auditLogs.some((l) => l.eventType === AUDIT_EVENTS.AUTH_LOGIN_PENDING_VERIFICATION));

    // 4. Verify email
    const user = await dataService.getUserByEmail('audittest@example.com');
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: { code: '123456', email: 'audittest@example.com' },
    });
    assert.ok(authEvents.some((e) => e.eventType === AUDIT_EVENTS.AUTH_EMAIL_VERIFIED));
  });

  // Test 26: Check-email endpoint checks available, registered, and pending_verification emails
  test('26. Check-email endpoint returns availability and status correctly', async () => {
    // 1. Available email
    const availRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/check-email?email=brandnewuser@example.com',
    });
    assert.equal(availRes.statusCode, 200);
    const availBody = JSON.parse(availRes.payload);
    assert.equal(availBody.available, true);

    // 2. Pending verification email
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: { email: 'pendingcheck@example.com', firstName: 'Pending', lastName: 'Check', password: 'Password123!' },
    });
    const pendingRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/check-email?email=pendingcheck@example.com',
    });
    assert.equal(pendingRes.statusCode, 200);
    const pendingBody = JSON.parse(pendingRes.payload);
    assert.equal(pendingBody.available, false);
    assert.equal(pendingBody.status, 'pending_verification');

    // 3. Invalid email format
    const invalidRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/check-email?email=notanemail',
    });
    assert.equal(invalidRes.statusCode, 400);
  });

  // Test 27: Idempotency-key endpoint issues UUID
  test('27. Idempotency-key endpoint returns server-issued UUID', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/idempotency-key',
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.ok(body.idempotencyKey);
    assert.match(
      body.idempotencyKey,
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });
});

