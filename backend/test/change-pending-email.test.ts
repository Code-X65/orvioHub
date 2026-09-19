import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { buildApp } from '../src/app.js';
import { dataService, type UserRecord } from '../src/services/dataService.js';
import { ERROR_CODES, AUDIT_EVENTS } from '../src/config/constants.js';
import { maskEmail } from '../src/utils/emailUtils.js';

describe('Change Pending Email Address Feature Test Suite', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  // In-memory test state
  let usersDb = new Map<string, UserRecord>();
  let sessionsDb = new Map<string, any>();
  let idempotencyDb = new Map<string, any>();
  let auditLogs: any[] = [];
  let authEvents: any[] = [];
  let enqueuedEmails: any[] = [];

  // Backup original dataService methods
  const originals = {
    createUser: dataService.createUser,
    getUserById: dataService.getUserById,
    getUserByEmail: dataService.getUserByEmail,
    verifyPassword: dataService.verifyPassword,
    verifyEmail: dataService.verifyEmail,
    changePendingEmail: dataService.changePendingEmail,
    acquireIdempotencyKey: dataService.acquireIdempotencyKey,
    completeIdempotencyKey: dataService.completeIdempotencyKey,
    failIdempotencyKey: dataService.failIdempotencyKey,
    createSession: dataService.createSession,
    getSessionById: dataService.getSessionById,
    getUserMemberships: dataService.getUserMemberships,
    getOnboardingStatus: dataService.getOnboardingStatus,
    logAudit: dataService.logAudit,
    logAuthEvent: dataService.logAuthEvent,
  };

  beforeEach(async () => {
    usersDb = new Map<string, UserRecord>();
    sessionsDb = new Map<string, any>();
    idempotencyDb = new Map<string, any>();
    auditLogs = [];
    authEvents = [];
    enqueuedEmails = [];

    dataService.logAudit = async (data) => {
      auditLogs.push(data);
    };

    dataService.logAuthEvent = async (data) => {
      authEvents.push(data);
    };

    dataService.getUserMemberships = async () => [];
    dataService.getOnboardingStatus = async () => ({ currentStep: 'ORGANIZATION_CREATION', status: 'IN_PROGRESS' });

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
        name: data.name || 'Test User',
        country: 'Nigeria',
        passwordHash,
        emailVerified: data.emailVerified ?? false,
        emailVerificationToken: token,
        emailVerificationTokenHash: tokenHash,
        emailVerificationTokenUsed: false,
        emailVerificationCode: code,
        emailVerificationCodeExpiresAt: Date.now() + 10 * 60 * 1000,
        emailVerificationExpiresAt: Date.now() + 86_400_000,
        status: data.emailVerified ? 'active' : 'pending_email_verification',
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
      for (const u of usersDb.values()) {
        if (u.email === norm || u.emailNormalized === norm) return u;
      }
      return null;
    };

    dataService.verifyPassword = async (user: UserRecord, password: string) => {
      if (!user.passwordHash) return false;
      return bcrypt.compare(password, user.passwordHash);
    };

    dataService.createSession = async (userId: string, metadata: any = {}) => {
      const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const refreshToken = `ref_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const session = {
        id: sessionId,
        sessionId,
        userId,
        refreshToken,
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
        createdAt: Date.now(),
        revoked: false,
        tokenVersion: metadata.tokenVersion ?? 1,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      };
      sessionsDb.set(sessionId, session);
      return session;
    };

    dataService.getSessionById = async (sessionId: string) => {
      return sessionsDb.get(sessionId) || null;
    };

    dataService.changePendingEmail = async (userIdOrEmail: string, newEmail: string) => {
      let user = usersDb.get(userIdOrEmail);
      if (!user) {
        for (const u of usersDb.values()) {
          if (u.email === userIdOrEmail.toLowerCase().trim()) {
            user = u;
            break;
          }
        }
      }
      if (!user) {
        const err: any = new Error('User not found.');
        err.code = 'USER_NOT_FOUND';
        throw err;
      }

      if (user.status !== 'pending_email_verification' && user.emailVerified) {
        const err: any = new Error('Email is already verified.');
        err.code = 'CANNOT_CHANGE_VERIFIED_EMAIL';
        throw err;
      }

      const normNew = newEmail.toLowerCase().trim();
      if (normNew === user.email.toLowerCase().trim()) {
        return {
          user,
          maskedEmail: maskEmail(user.email),
          status: 'verification_already_pending',
          verificationSent: false,
          expiresAt: user.emailVerificationExpiresAt || Date.now() + 86_400_000,
        };
      }

      for (const u of usersDb.values()) {
        if (u.id !== user.id && (u.email === normNew || u.emailNormalized === normNew)) {
          const err: any = new Error('This email address is already in use.');
          err.code = 'CONFLICT';
          throw err;
        }
      }

      // Invalidate old tokens & challenges
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const code = '654321'; // fresh OTP
      const expiresAt = Date.now() + 86_400_000;
      const codeExpiresAt = Date.now() + 10 * 60 * 1000;

      user.email = normNew;
      user.emailNormalized = normNew;
      user.emailVerificationToken = token;
      user.emailVerificationTokenHash = tokenHash;
      user.emailVerificationTokenUsed = false;
      user.emailVerificationCode = code;
      user.emailVerificationCodeExpiresAt = codeExpiresAt;
      user.emailVerificationExpiresAt = expiresAt;
      user.updatedAt = Date.now();

      enqueuedEmails.push({ email: normNew, code, token });

      return {
        user,
        token,
        maskedEmail: maskEmail(normNew),
        status: 'verification_required',
        verificationSent: true,
        expiresAt,
      };
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
      } else if (payload.code) {
        if (payload.email) {
          user = await dataService.getUserByEmail(payload.email);
        } else {
          for (const u of usersDb.values()) {
            if (u.emailVerificationCode === payload.code) {
              user = u;
              break;
            }
          }
        }

        if (user) {
          if (user.emailVerificationCodeExpiresAt && user.emailVerificationCodeExpiresAt < Date.now()) {
            const err: any = new Error('Verification code has expired.');
            err.code = 'TOKEN_EXPIRED';
            throw err;
          }
          if (user.emailVerificationCode !== payload.code) {
            const err: any = new Error('Invalid verification code.');
            err.code = 'INVALID_CODE';
            throw err;
          }
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

    // Idempotency mocks
    dataService.acquireIdempotencyKey = async (key: string, scope: string, fingerprint: string, ttlMs?: number) => {
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
        createdAt: Date.now(),
        expiresAt: Date.now() + (ttlMs || 86_400_000),
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
      idempotencyDb.delete(key);
    };

    app = await buildApp();
  });

  afterEach(async () => {
    Object.assign(dataService, originals);
    if (app) {
      await app.close();
    }
  });

  // Helper to create a signup session token
  async function createSignupSession(email: string) {
    const { user, token } = await dataService.createUser({
      email,
      password: 'StrongPassword123!',
      name: 'Test Signup User',
      emailVerified: false,
    });
    const session = await dataService.createSession(user.id);
    const jwtToken = app.jwt.sign({
      userId: user.id,
      email: user.email,
      sessionId: session.sessionId,
      tokenVersion: 1,
      accessLevel: 'verification_required',
    });
    return { user, rawInitialToken: token, jwtToken, session };
  }

  // ==========================================
  // Test 1: Pending user can change email & receives masked email
  // ==========================================
  test('1. Pending user can change email and receives masked email in response', async () => {
    const { user, jwtToken } = await createSignupSession('mistake@example.com');

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/change-pending-email',
      headers: { authorization: `Bearer ${jwtToken}` },
      payload: { newEmail: 'correct@example.com' },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.equal(body.data.status, 'verification_required');
    assert.equal(body.data.maskedEmail, 'c***@example.com');
    assert.equal(body.data.verificationSent, true);

    const updatedUser = await dataService.getUserById(user.id);
    assert.equal(updatedUser?.email, 'correct@example.com');
  });

  // ==========================================
  // Test 2: Active verified user cannot use pending-email endpoint
  // ==========================================
  test('2. Active verified user cannot use change-pending-email endpoint (fails with 400)', async () => {
    const { user } = await dataService.createUser({
      email: 'active@example.com',
      password: 'StrongPassword123!',
      emailVerified: true,
    });
    const session = await dataService.createSession(user.id);
    const jwtToken = app.jwt.sign({
      userId: user.id,
      email: user.email,
      sessionId: session.sessionId,
      tokenVersion: 1,
      accessLevel: 'full',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/change-pending-email',
      headers: { authorization: `Bearer ${jwtToken}` },
      payload: { newEmail: 'active_new@example.com' },
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.payload);
    assert.equal(body.error.code, ERROR_CODES.VALIDATION_ERROR);
  });

  // ==========================================
  // Test 3: New email is trimmed and lowercase normalized
  // ==========================================
  test('3. New email is trimmed and lowercase normalized', async () => {
    const { user, jwtToken } = await createSignupSession('trimtest@example.com');

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/change-pending-email',
      headers: { authorization: `Bearer ${jwtToken}` },
      payload: { newEmail: '   CleanEmail@Example.COM   ' },
    });

    assert.equal(res.statusCode, 200);
    const updatedUser = await dataService.getUserById(user.id);
    assert.equal(updatedUser?.email, 'cleanemail@example.com');
    assert.equal(updatedUser?.emailNormalized, 'cleanemail@example.com');
  });

  // ==========================================
  // Test 4: Invalid email format is rejected with 400
  // ==========================================
  test('4. Invalid email format is rejected with 400 validation error', async () => {
    const { jwtToken } = await createSignupSession('format@example.com');

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/change-pending-email',
      headers: { authorization: `Bearer ${jwtToken}` },
      payload: { newEmail: 'not-an-email' },
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.payload);
    assert.equal(body.error.code, ERROR_CODES.VALIDATION_ERROR);
  });

  // ==========================================
  // Test 5: Submitting identical email returns verification_already_pending
  // ==========================================
  test('5. Submitting identical email returns verification_already_pending without new challenge', async () => {
    const { jwtToken } = await createSignupSession('same@example.com');
    const emailsBefore = enqueuedEmails.length;

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/change-pending-email',
      headers: { authorization: `Bearer ${jwtToken}` },
      payload: { newEmail: 'same@example.com' },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.data.status, 'verification_already_pending');
    assert.equal(body.data.verificationSent, false);
    assert.equal(enqueuedEmails.length, emailsBefore);
  });

  // ==========================================
  // Test 6: Existing active email is rejected with 409 EMAIL_ALREADY_IN_USE
  // ==========================================
  test('6. Existing active email is rejected with 409 EMAIL_ALREADY_IN_USE', async () => {
    await dataService.createUser({
      email: 'activeuser@example.com',
      password: 'StrongPassword123!',
      emailVerified: true,
    });
    const { jwtToken } = await createSignupSession('pending@example.com');

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/change-pending-email',
      headers: { authorization: `Bearer ${jwtToken}` },
      payload: { newEmail: 'activeuser@example.com' },
    });

    assert.equal(res.statusCode, 409);
    const body = JSON.parse(res.payload);
    assert.equal(body.error.code, ERROR_CODES.EMAIL_ALREADY_IN_USE);
    assert.match(body.error.message, /cannot be used for this account/i);
  });

  // ==========================================
  // Test 7: Existing pending email is rejected with 409 EMAIL_ALREADY_IN_USE
  // ==========================================
  test('7. Existing pending email is rejected with 409 EMAIL_ALREADY_IN_USE', async () => {
    await dataService.createUser({
      email: 'anotherpending@example.com',
      password: 'StrongPassword123!',
      emailVerified: false,
    });
    const { jwtToken } = await createSignupSession('currentpending@example.com');

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/change-pending-email',
      headers: { authorization: `Bearer ${jwtToken}` },
      payload: { newEmail: 'anotherpending@example.com' },
    });

    assert.equal(res.statusCode, 409);
    const body = JSON.parse(res.payload);
    assert.equal(body.error.code, ERROR_CODES.EMAIL_ALREADY_IN_USE);
  });

  // ==========================================
  // Test 8: Old OTP is invalid after email change
  // ==========================================
  test('8. Old verification OTP is invalid after email change', async () => {
    const { user, jwtToken } = await createSignupSession('oldotp@example.com');
    const oldCode = user.emailVerificationCode; // '123456'

    // Change email
    await app.inject({
      method: 'POST',
      url: '/v1/auth/change-pending-email',
      headers: { authorization: `Bearer ${jwtToken}` },
      payload: { newEmail: 'newotp@example.com' },
    });

    // Attempt verify with old OTP
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: { code: oldCode, email: 'newotp@example.com' },
    });

    assert.equal(verifyRes.statusCode, 400);
  });

  // ==========================================
  // Test 9: Old verification link/token is invalid after email change
  // ==========================================
  test('9. Old verification link/token is invalid after email change', async () => {
    const { rawInitialToken, jwtToken } = await createSignupSession('oldlink@example.com');

    // Change email
    await app.inject({
      method: 'POST',
      url: '/v1/auth/change-pending-email',
      headers: { authorization: `Bearer ${jwtToken}` },
      payload: { newEmail: 'newlink@example.com' },
    });

    // Attempt verify with old link token
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: { token: rawInitialToken },
    });

    assert.equal(verifyRes.statusCode, 400);
  });

  // ==========================================
  // Test 10: New OTP verifies the new email
  // ==========================================
  test('10. New OTP successfully verifies the new email', async () => {
    const { user, jwtToken } = await createSignupSession('beforeotp@example.com');

    // Change email
    await app.inject({
      method: 'POST',
      url: '/v1/auth/change-pending-email',
      headers: { authorization: `Bearer ${jwtToken}` },
      payload: { newEmail: 'afterotp@example.com' },
    });

    const updated = await dataService.getUserById(user.id);
    const newCode = updated?.emailVerificationCode; // '654321'

    // Verify with new code
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: { code: newCode, email: 'afterotp@example.com' },
    });

    assert.equal(verifyRes.statusCode, 200);
    const verifyBody = JSON.parse(verifyRes.payload);
    assert.equal(verifyBody.success, true);
    assert.equal(verifyBody.data.user.email, 'afterotp@example.com');
    assert.equal(verifyBody.data.user.emailVerified, true);
  });

  // ==========================================
  // Test 11: New OTP cannot be reused
  // ==========================================
  test('11. New OTP cannot be reused after verification', async () => {
    const { user, jwtToken } = await createSignupSession('reuseotp@example.com');

    await app.inject({
      method: 'POST',
      url: '/v1/auth/change-pending-email',
      headers: { authorization: `Bearer ${jwtToken}` },
      payload: { newEmail: 'freshotp@example.com' },
    });

    const updated = await dataService.getUserById(user.id);
    const newCode = updated?.emailVerificationCode;

    // 1st verify: success
    const verify1 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: { code: newCode, email: 'freshotp@example.com' },
    });
    assert.equal(verify1.statusCode, 200);

    // 2nd verify: fails (cannot be reused)
    const verify2 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: { code: newCode, email: 'freshotp@example.com' },
    });
    assert.equal(verify2.statusCode, 400);
  });

  // ==========================================
  // Test 12: Idempotency-Key support: repeated request replays response
  // ==========================================
  test('12. Repeated change-email request with same Idempotency-Key replays response', async () => {
    const { jwtToken } = await createSignupSession('idemuser@example.com');
    const idemKey = 'idem-change-email-123';

    const res1 = await app.inject({
      method: 'POST',
      url: '/v1/auth/change-pending-email',
      headers: {
        authorization: `Bearer ${jwtToken}`,
        'idempotency-key': idemKey,
      },
      payload: { newEmail: 'idem_new@example.com' },
    });
    assert.equal(res1.statusCode, 200);
    const body1 = JSON.parse(res1.payload);

    const res2 = await app.inject({
      method: 'POST',
      url: '/v1/auth/change-pending-email',
      headers: {
        authorization: `Bearer ${jwtToken}`,
        'idempotency-key': idemKey,
      },
      payload: { newEmail: 'idem_new@example.com' },
    });
    assert.equal(res2.statusCode, 200);
    const body2 = JSON.parse(res2.payload);

    assert.deepEqual(body1.data, body2.data);
  });

  // ==========================================
  // Test 13: Same Idempotency-Key with different payload returns 409
  // ==========================================
  test('13. Same Idempotency-Key with different payload returns 409 conflict', async () => {
    const { jwtToken } = await createSignupSession('mismatch@example.com');
    const idemKey = 'idem-mismatch-456';

    const res1 = await app.inject({
      method: 'POST',
      url: '/v1/auth/change-pending-email',
      headers: {
        authorization: `Bearer ${jwtToken}`,
        'idempotency-key': idemKey,
      },
      payload: { newEmail: 'first_choice@example.com' },
    });
    assert.equal(res1.statusCode, 200);

    const res2 = await app.inject({
      method: 'POST',
      url: '/v1/auth/change-pending-email',
      headers: {
        authorization: `Bearer ${jwtToken}`,
        'idempotency-key': idemKey,
      },
      payload: { newEmail: 'different_choice@example.com' },
    });
    assert.equal(res2.statusCode, 409);
    const body2 = JSON.parse(res2.payload);
    assert.equal(body2.error.code, ERROR_CODES.IDEMPOTENCY_KEY_PAYLOAD_MISMATCH);
  });

  // ==========================================
  // Test 14: Rate limit enforces max 3 attempts per hour
  // ==========================================
  test('14. Rate limit enforces max 3 attempts per hour returning 429', async () => {
    const { jwtToken } = await createSignupSession('ratelimit@example.com');

    // Attempt 1
    const r1 = await app.inject({
      method: 'POST',
      url: '/v1/auth/change-pending-email',
      headers: { authorization: `Bearer ${jwtToken}` },
      payload: { newEmail: 'rl1@example.com' },
    });
    assert.equal(r1.statusCode, 200);

    // Attempt 2
    const r2 = await app.inject({
      method: 'POST',
      url: '/v1/auth/change-pending-email',
      headers: { authorization: `Bearer ${jwtToken}` },
      payload: { newEmail: 'rl2@example.com' },
    });
    assert.equal(r2.statusCode, 200);

    // Attempt 3
    const r3 = await app.inject({
      method: 'POST',
      url: '/v1/auth/change-pending-email',
      headers: { authorization: `Bearer ${jwtToken}` },
      payload: { newEmail: 'rl3@example.com' },
    });
    assert.equal(r3.statusCode, 200);

    // Attempt 4: Rate limited!
    const r4 = await app.inject({
      method: 'POST',
      url: '/v1/auth/change-pending-email',
      headers: { authorization: `Bearer ${jwtToken}` },
      payload: { newEmail: 'rl4@example.com' },
    });
    assert.equal(r4.statusCode, 429);
    const body4 = JSON.parse(r4.payload);
    assert.equal(body4.error.code, ERROR_CODES.RATE_LIMIT_EXCEEDED);
    assert.match(body4.error.message, /too many attempts/i);
  });

  // ==========================================
  // Test 15: User cannot access protected resources while pending
  // ==========================================
  test('15. Pending user cannot access protected resources (/api/v1/organizations)', async () => {
    const { jwtToken } = await createSignupSession('accessblock@example.com');

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/organizations',
      headers: { authorization: `Bearer ${jwtToken}` },
    });

    assert.equal(res.statusCode, 403);
  });

  // ==========================================
  // Test 16: Audit events logged with safe metadata
  // ==========================================
  test('16. Audit events are logged with masked email and no raw secrets', async () => {
    const { jwtToken } = await createSignupSession('audit_test@example.com');

    await app.inject({
      method: 'POST',
      url: '/v1/auth/change-pending-email',
      headers: { authorization: `Bearer ${jwtToken}` },
      payload: { newEmail: 'audit_target@example.com' },
    });

    const changedAudit = auditLogs.find((l) => l.eventType === AUDIT_EVENTS.AUTH_PENDING_EMAIL_CHANGED);
    assert.ok(changedAudit, 'Should log pending email changed audit event');
    assert.equal(changedAudit.metadata.oldEmailMasked, 'a***@example.com');
    assert.equal(changedAudit.metadata.newEmailMasked, 'a***@example.com');

    // Ensure raw secrets are not present in audit logs
    const hasRawSecret = auditLogs.some((l) => JSON.stringify(l).includes('StrongPassword123!') || JSON.stringify(l).includes('654321'));
    assert.equal(hasRawSecret, false, 'Audit logs must never contain raw passwords or raw OTP codes');
  });

  // ==========================================
  // Test 17: Missing or invalid session returns 401 VERIFICATION_SESSION_EXPIRED
  // ==========================================
  test('17. Missing session and no matching account returns 401 VERIFICATION_SESSION_EXPIRED', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/change-pending-email',
      payload: { newEmail: 'orphan@example.com' },
    });

    assert.equal(res.statusCode, 401);
    const body = JSON.parse(res.payload);
    assert.equal(body.error.code, ERROR_CODES.VERIFICATION_SESSION_EXPIRED);
  });
});
