import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { buildApp } from '../src/app.js';
import { dataService, type UserRecord } from '../src/services/dataService.js';
import { oauthService, type VerifiedSocialProfile } from '../src/services/oauth.js';
import { ERROR_CODES, AUDIT_EVENTS } from '../src/config/constants.js';

describe('Authentication Lifecycle & Security Hardening Test Suite', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  // In-memory mock database
  let usersDb = new Map<string, UserRecord>();
  let sessionsDb = new Map<string, any>();
  let oauthFlowsDb = new Map<string, any>();
  let idempotencyDb = new Map<string, any>();
  let auditLogs: any[] = [];
  let authEvents: any[] = [];

  // Backup original dataService & oauthService methods
  const originals = {
    createUser: dataService.createUser,
    getUserById: dataService.getUserById,
    getUserByEmail: dataService.getUserByEmail,
    verifyPassword: dataService.verifyPassword,
    requestPasswordReset: dataService.requestPasswordReset,
    resetPassword: dataService.resetPassword,
    createSession: dataService.createSession,
    getSessionById: dataService.getSessionById,
    revokeSession: dataService.revokeSession,
    invalidateUserSessions: dataService.invalidateUserSessions,
    createOAuthFlow: dataService.createOAuthFlow,
    getOAuthFlowByStateHash: dataService.getOAuthFlowByStateHash,
    markOAuthFlowCompleted: dataService.markOAuthFlowCompleted,
    markOAuthFlowReplayed: dataService.markOAuthFlowReplayed,
    exchangeGoogleCode: oauthService.exchangeGoogleCode,
    handleSocialAuth: dataService.handleSocialAuth,
    getUserMemberships: dataService.getUserMemberships,
    getOnboardingStatus: dataService.getOnboardingStatus,
    getUserIdentities: dataService.getUserIdentities,
    linkOAuthIdentity: dataService.linkOAuthIdentity,
    unlinkIdentity: dataService.unlinkIdentity,
    acquireIdempotencyKey: dataService.acquireIdempotencyKey,
    completeIdempotencyKey: dataService.completeIdempotencyKey,
    failIdempotencyKey: dataService.failIdempotencyKey,
    logAudit: dataService.logAudit,
    logAuthEvent: dataService.logAuthEvent,
  };

  beforeEach(async () => {
    usersDb = new Map<string, UserRecord>();
    sessionsDb = new Map<string, any>();
    oauthFlowsDb = new Map<string, any>();
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
      const passwordHash = await bcrypt.hash(data.password, 4);

      const record: UserRecord = {
        id,
        email,
        emailNormalized: email,
        name: data.name || 'Test User',
        country: 'Nigeria',
        passwordHash,
        emailVerified: data.emailVerified ?? true,
        status: data.emailVerified === false ? 'pending_email_verification' : 'active',
        tokenVersion: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      usersDb.set(id, record);
      return { user: record, token: 'mock-token' };
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

    dataService.getUserMemberships = async () => [];
    dataService.getOnboardingStatus = async () => ({ currentStep: 'ORGANIZATION_CREATION', status: 'IN_PROGRESS' });

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
        lastVisitedUrl: metadata.lastVisitedUrl,
        lastVisitedSubdomain: metadata.lastVisitedSubdomain,
      };
      sessionsDb.set(sessionId, session);
      return session;
    };

    dataService.getSessionById = async (sessionId: string) => {
      return sessionsDb.get(sessionId) || null;
    };

    dataService.revokeSession = async (sessionId: string) => {
      const s = sessionsDb.get(sessionId);
      if (s) s.revoked = true;
    };

    dataService.invalidateUserSessions = async (userId: string) => {
      for (const s of sessionsDb.values()) {
        if (s.userId === userId) s.revoked = true;
      }
      const user = usersDb.get(userId);
      if (user) {
        user.tokenVersion = (user.tokenVersion ?? 1) + 1;
      }
    };

    // Password reset mocks
    dataService.requestPasswordReset = async (email: string, _options: any = {}) => {
      const norm = email.toLowerCase().trim();
      let user: UserRecord | null = null;
      for (const u of usersDb.values()) {
        if (u.email === norm || u.emailNormalized === norm) {
          user = u;
          break;
        }
      }
      if (!user) {
        return { success: true, deduplicated: false };
      }

      const now = Date.now();
      const cooldownMs = 60 * 1000;
      if (user.passwordResetRequestedAt && now - user.passwordResetRequestedAt < cooldownMs) {
        return {
          success: true,
          deduplicated: true,
          reason: 'cooldown_active',
        };
      }

      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      user.passwordResetTokenHash = tokenHash;
      user.passwordResetTokenUsed = false;
      user.passwordResetRequestedAt = now;
      user.passwordResetExpiresAt = now + 60 * 60 * 1000;

      return {
        success: true,
        token: rawToken,
        deduplicated: false,
      };
    };

    dataService.resetPassword = async (token: string, newPassword: string) => {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      let foundUser: UserRecord | null = null;
      for (const u of usersDb.values()) {
        if (u.passwordResetTokenHash === tokenHash) {
          foundUser = u;
          break;
        }
      }

      if (!foundUser) {
        const err: any = new Error('Invalid or expired reset token');
        err.code = 'INVALID_TOKEN';
        throw err;
      }

      if (foundUser.passwordResetTokenUsed) {
        const err: any = new Error('This password reset link has already been used.');
        err.code = 'TOKEN_ALREADY_USED';
        throw err;
      }

      if (foundUser.passwordResetExpiresAt && foundUser.passwordResetExpiresAt < Date.now()) {
        const err: any = new Error('This password reset link has expired.');
        err.code = 'TOKEN_EXPIRED';
        throw err;
      }

      const passwordHash = await bcrypt.hash(newPassword, 4);
      foundUser.passwordHash = passwordHash;
      foundUser.passwordResetTokenUsed = true;
      // Keep passwordResetTokenHash so subsequent reuse attempts can be detected as TOKEN_ALREADY_USED
      foundUser.tokenVersion = (foundUser.tokenVersion ?? 1) + 1;
      foundUser.updatedAt = Date.now();

      // Revoke all existing sessions
      for (const s of sessionsDb.values()) {
        if (s.userId === foundUser.id) s.revoked = true;
      }

      return { user: foundUser };
    };

    // Idempotency mocks
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

    dataService.failIdempotencyKey = async (key: string, _error: any) => {
      idempotencyDb.delete(key);
    };

    // OAuth flow mocks
    dataService.createOAuthFlow = async (data: any) => {
      const flowId = data.flowId || `flow_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const record = { ...data, flowId, completed: false, replayedCount: 0 };
      oauthFlowsDb.set(data.stateHash, record);
      return flowId;
    };

    dataService.getOAuthFlowByStateHash = async (stateHash: string) => {
      return oauthFlowsDb.get(stateHash) || null;
    };

    dataService.markOAuthFlowCompleted = async (stateHash: string, userId?: string) => {
      const flow = oauthFlowsDb.get(stateHash);
      if (flow) {
        flow.status = 'completed';
        flow.completed = true;
        flow.usedAt = Date.now();
        if (userId) flow.userId = userId;
      }
    };

    dataService.markOAuthFlowReplayed = async (stateHash: string) => {
      const flow = oauthFlowsDb.get(stateHash);
      if (flow) {
        flow.status = 'replayed';
        flow.replayedCount = (flow.replayedCount || 0) + 1;
        flow.lastReplayedAt = Date.now();
        return flow;
      }
      return null;
    };

    oauthService.exchangeGoogleCode = async (code: string, _verifier?: string): Promise<VerifiedSocialProfile> => {
      if (code === 'invalid_code') throw new Error('Invalid code');
      return {
        provider: 'google',
        providerUserId: 'google_user_12345',
        email: 'oauth_user@example.com',
        emailVerified: true,
        name: 'OAuth Test User',
        picture: 'https://example.com/avatar.jpg',
      };
    };

    dataService.handleSocialAuth = async (profile: VerifiedSocialProfile) => {
      let user = await dataService.getUserByEmail(profile.email);
      if (!user) {
        const id = `user_oauth_${Date.now()}`;
        user = {
          id,
          email: profile.email,
          emailNormalized: profile.email.toLowerCase(),
          name: profile.name,
          emailVerified: profile.emailVerified ?? true,
          status: 'active',
          tokenVersion: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          authProvider: profile.provider,
          googleId: profile.provider === 'google' ? profile.providerUserId : undefined,
        };
        usersDb.set(id, user);
      }
      return { user, isNew: false };
    };

    // Identity mocks
    dataService.getUserIdentities = async (userId: string) => {
      const user = usersDb.get(userId);
      if (!user) return [];
      const list: any[] = [];
      if (user.passwordHash) {
        list.push({ id: 'ident_password', provider: 'password', identifier: user.email, isPrimary: true, createdAt: user.createdAt });
      }
      if (user.googleId) {
        list.push({ id: 'ident_google', provider: 'google', identifier: user.email, isPrimary: !user.passwordHash, createdAt: user.createdAt });
      }
      return list;
    };

    dataService.unlinkIdentity = async (userId: string, identityId: string) => {
      const identities = await dataService.getUserIdentities(userId);
      if (identities.length <= 1) {
        const err: any = new Error('Cannot remove the sole login method for this account.');
        err.code = 'SOLE_LOGIN_METHOD';
        throw err;
      }
      const user = usersDb.get(userId);
      if (!user) return;
      if (identityId === 'ident_google') {
        user.googleId = undefined;
      } else if (identityId === 'ident_password') {
        user.passwordHash = undefined;
      }
    };

    app = await buildApp();
  });

  afterEach(async () => {
    Object.assign(dataService, originals);
    if (app) {
      await app.close();
    }
  });

  // ==========================================
  // 1. Safe Login Retry & Same-Browser Reuse
  // ==========================================
  test('1. First login creates a session and returns 200 with tokens and cookies', async () => {
    await dataService.createUser({
      email: 'user1@example.com',
      password: 'StrongPassword123!',
      name: 'User One',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: {
        email: 'user1@example.com',
        password: 'StrongPassword123!',
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.equal(body.data.status, 'authenticated');
    assert.ok(body.data.token);
    assert.ok(body.data.refreshToken);

    const cookies = res.cookies;
    assert.ok(cookies.some((c) => c.name === 'session' || c.name === 'orvio_session'));
    assert.ok(cookies.some((c) => c.name === 'refresh_token' || c.name === 'orvio_refresh_token'));
    assert.equal(sessionsDb.size, 1);
  });

  test('2. Duplicate login in same browser returns status: already_authenticated and does not create new session', async () => {
    await dataService.createUser({
      email: 'user2@example.com',
      password: 'StrongPassword123!',
      name: 'User Two',
    });

    // 1st login
    const login1 = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: {
        email: 'user2@example.com',
        password: 'StrongPassword123!',
      },
    });
    assert.equal(login1.statusCode, 200);
    assert.equal(sessionsDb.size, 1);

    const tokenCookie = login1.cookies.find((c) => c.name === 'session' || c.name === 'orvio_session')?.value;

    // 2nd login with cookie passed
    const login2 = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      cookies: {
        session: tokenCookie!,
      },
      payload: {
        email: 'user2@example.com',
        password: 'StrongPassword123!',
      },
    });

    assert.equal(login2.statusCode, 200);
    const body2 = JSON.parse(login2.payload);
    assert.equal(body2.success, true);
    assert.equal(body2.data.status, 'already_authenticated');
    assert.equal(body2.data.user.email, 'user2@example.com');
    // Still exactly 1 session in database (no duplicate row)
    assert.equal(sessionsDb.size, 1);

    // Verify session_reused was logged
    const reusedEvent = authEvents.find((e) => e.eventType === 'session_reused');
    assert.ok(reusedEvent, 'Should log session_reused event');
  });

  test('3. Login from a different device creates a concurrent active session', async () => {
    await dataService.createUser({
      email: 'user3@example.com',
      password: 'StrongPassword123!',
      name: 'User Three',
    });

    // Device A
    const resA = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      headers: { 'user-agent': 'DeviceA-Browser' },
      payload: { email: 'user3@example.com', password: 'StrongPassword123!' },
    });
    assert.equal(resA.statusCode, 200);

    // Device B (no cookies from Device A)
    const resB = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      headers: { 'user-agent': 'DeviceB-Browser' },
      payload: { email: 'user3@example.com', password: 'StrongPassword123!' },
    });
    assert.equal(resB.statusCode, 200);

    const bodyA = JSON.parse(resA.payload);
    const bodyB = JSON.parse(resB.payload);
    assert.equal(bodyA.data.status, 'authenticated');
    assert.equal(bodyB.data.status, 'authenticated');
    // Both sessions exist concurrently
    assert.equal(sessionsDb.size, 2);
  });

  // ==========================================
  // 2. Password Reset Deduplication & Security
  // ==========================================
  test('4. Repeated forgot-password requests with Idempotency-Key return cached response', async () => {
    await dataService.createUser({
      email: 'reset1@example.com',
      password: 'StrongPassword123!',
    });

    const idemKey = 'idem-pwd-reset-123';
    const res1 = await app.inject({
      method: 'POST',
      url: '/v1/auth/forgot-password',
      headers: { 'idempotency-key': idemKey },
      payload: { email: 'reset1@example.com' },
    });
    assert.equal(res1.statusCode, 200);
    const body1 = JSON.parse(res1.payload);
    assert.equal(body1.success, true);

    const res2 = await app.inject({
      method: 'POST',
      url: '/v1/auth/forgot-password',
      headers: { 'idempotency-key': idemKey },
      payload: { email: 'reset1@example.com' },
    });
    assert.equal(res2.statusCode, 200);
    const body2 = JSON.parse(res2.payload);
    assert.deepEqual(body1.data, body2.data);

    const dedupAudit = auditLogs.find((l) => l.eventType === AUDIT_EVENTS.AUTH_PASSWORD_RESET_REQUEST_DEDUPLICATED);
    assert.ok(dedupAudit, 'Should log deduplication audit event');
  });

  test('5. Repeated forgot-password request within 60s cooldown is deduplicated', async () => {
    await dataService.createUser({
      email: 'reset2@example.com',
      password: 'StrongPassword123!',
    });

    const res1 = await app.inject({
      method: 'POST',
      url: '/v1/auth/forgot-password',
      payload: { email: 'reset2@example.com' },
    });
    assert.equal(res1.statusCode, 200);

    const res2 = await app.inject({
      method: 'POST',
      url: '/v1/auth/forgot-password',
      payload: { email: 'reset2@example.com' },
    });
    assert.equal(res2.statusCode, 200);
    const body2 = JSON.parse(res2.payload);
    assert.equal(body2.success, true);

    const dedupAudit = auditLogs.find((l) => l.eventType === AUDIT_EVENTS.AUTH_PASSWORD_RESET_REQUEST_DEDUPLICATED);
    assert.ok(dedupAudit, 'Cooldown should trigger password reset deduplicated audit');
  });

  test('6. Reset password completes, invalidates existing sessions, and prevents token reuse', async () => {
    const { user } = await dataService.createUser({
      email: 'reset3@example.com',
      password: 'OldPassword123!',
    });

    // Create an active session
    const session = await dataService.createSession(user.id);
    assert.equal(session.revoked, false);

    // Request reset token
    const resetReq = await dataService.requestPasswordReset('reset3@example.com');
    const rawToken = resetReq.token!;
    assert.ok(rawToken);

    // Reset password
    const resetRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/reset-password',
      payload: {
        token: rawToken,
        password: 'NewStrongPassword456!',
      },
    });
    assert.equal(resetRes.statusCode, 200);

    // Old session should be revoked
    const sessAfter = sessionsDb.get(session.id);
    assert.equal(sessAfter.revoked, true);

    // Token reuse attempt must fail
    const reuseRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/reset-password',
      payload: {
        token: rawToken,
        password: 'AnotherPassword789!',
      },
    });
    assert.equal(reuseRes.statusCode, 400);
    const reuseBody = JSON.parse(reuseRes.payload);
    assert.ok(
      reuseBody.error.code === 'TOKEN_ALREADY_USED' || reuseBody.error.code === 'PASSWORD_RESET_TOKEN_USED',
      `Expected TOKEN_ALREADY_USED or PASSWORD_RESET_TOKEN_USED but got ${reuseBody.error.code}`
    );
  });

  // ==========================================
  // 3. OAuth Flow Initiation & Replay Defense
  // ==========================================
  test('7. Initiating OAuth generates state, PKCE challenge, and stores durable flow', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/auth/providers/google/start',
    });

    assert.equal(res.statusCode, 302);
    const location = res.headers.location!;
    assert.ok(location.includes('accounts.google.com'));
    assert.ok(location.includes('code_challenge='));
    assert.ok(location.includes('code_challenge_method=S256'));
    assert.ok(location.includes('state='));

    // Durable oauthFlow record exists
    assert.equal(oauthFlowsDb.size, 1);
    const flow = Array.from(oauthFlowsDb.values())[0];
    assert.equal(flow.provider, 'google');
    assert.equal(flow.completed, false);
    assert.ok(flow.pkceVerifier);
  });

  test('8. OAuth callback succeeds with HttpOnly cookies and no tokens in query string', async () => {
    // Initiate first
    const initRes = await app.inject({
      method: 'GET',
      url: '/v1/auth/providers/google/start',
    });
    const location = initRes.headers.location!;
    const stateMatch = location.match(/state=([^&]+)/);
    const rawState = decodeURIComponent(stateMatch![1]);

    // Callback
    const cbRes = await app.inject({
      method: 'GET',
      url: `/v1/auth/providers/google/callback?code=mock_google_code_valid&state=${encodeURIComponent(rawState)}`,
    });

    assert.equal(cbRes.statusCode, 302);
    const redirectUrl = cbRes.headers.location!;
    // Redirect MUST NOT contain token or refreshToken in query params
    assert.ok(!redirectUrl.includes('token='));
    assert.ok(!redirectUrl.includes('refreshToken='));

    // HttpOnly auth cookies must be present
    assert.ok(cbRes.cookies.some((c) => c.name === 'session' || c.name === 'orvio_session'));
    assert.ok(cbRes.cookies.some((c) => c.name === 'refresh_token' || c.name === 'orvio_refresh_token'));

    // Flow marked completed
    const flow = Array.from(oauthFlowsDb.values())[0];
    assert.equal(flow.completed, true);
  });

  test('9. Replaying completed OAuth callback triggers replay defense without duplicate session', async () => {
    // Initiate
    const initRes = await app.inject({
      method: 'GET',
      url: '/v1/auth/providers/google/start',
    });
    const location = initRes.headers.location!;
    const rawState = decodeURIComponent(location.match(/state=([^&]+)/)![1]);

    // 1st Callback: completes
    const cb1 = await app.inject({
      method: 'GET',
      url: `/v1/auth/providers/google/callback?code=mock_google_code_valid&state=${encodeURIComponent(rawState)}`,
    });
    assert.equal(cb1.statusCode, 302);
    const sessionCountAfterFirst = sessionsDb.size;

    // 2nd Callback: replayed with same state
    const cb2 = await app.inject({
      method: 'GET',
      url: `/v1/auth/providers/google/callback?code=mock_google_code_valid&state=${encodeURIComponent(rawState)}`,
    });

    assert.equal(cb2.statusCode, 302);
    // Did NOT create an additional session row
    assert.equal(sessionsDb.size, sessionCountAfterFirst);

    // Verify replay audit event was recorded
    const replayAudit = auditLogs.find((l) => l.eventType === AUDIT_EVENTS.AUTH_OAUTH_CALLBACK_REPLAYED);
    assert.ok(replayAudit, 'Should log oauth callback replayed audit event');
  });

  // ==========================================
  // 4. Strictly Read-Only Session Inspection
  // ==========================================
  test('10. GET /v1/auth/session returns session context without mutations', async () => {
    const { user } = await dataService.createUser({
      email: 'session_test@example.com',
      password: 'StrongPassword123!',
      name: 'Session Inspector',
    });

    const loginRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'session_test@example.com', password: 'StrongPassword123!' },
    });
    const token = JSON.parse(loginRes.payload).data.token;

    const res1 = await app.inject({
      method: 'GET',
      url: '/v1/auth/session',
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(res1.statusCode, 200);
    const body1 = JSON.parse(res1.payload);
    assert.equal(body1.success, true);
    assert.equal(body1.data.authenticated, true);
    assert.equal(body1.data.user.email, 'session_test@example.com');
    assert.equal(body1.data.access.level, 'full');

    // Repeated call returns identical state without side effects
    const res2 = await app.inject({
      method: 'GET',
      url: '/v1/auth/session',
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(res2.statusCode, 200);
    assert.deepEqual(JSON.parse(res1.payload).data, JSON.parse(res2.payload).data);
  });

  test('11. Revoked session returns 401 UNAUTHENTICATED on GET /v1/auth/session', async () => {
    const { user } = await dataService.createUser({
      email: 'revoked_test@example.com',
      password: 'StrongPassword123!',
    });

    const loginRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'revoked_test@example.com', password: 'StrongPassword123!' },
    });
    const body = JSON.parse(loginRes.payload);
    const token = body.data.token;

    // Invalidate user sessions
    await dataService.invalidateUserSessions(user.id);

    const res = await app.inject({
      method: 'GET',
      url: '/v1/auth/session',
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(res.statusCode, 401);
  });

  // ==========================================
  // 5. Account Identity Management & Protections
  // ==========================================
  test('12. GET /v1/auth/identities lists linked providers', async () => {
    const { user } = await dataService.createUser({
      email: 'ident_user@example.com',
      password: 'StrongPassword123!',
    });

    const loginRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'ident_user@example.com', password: 'StrongPassword123!' },
    });
    const token = JSON.parse(loginRes.payload).data.token;

    const res = await app.inject({
      method: 'GET',
      url: '/v1/auth/identities',
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.equal(body.data.identities.length, 1);
    assert.equal(body.data.identities[0].provider, 'password');
  });

  test('13. Unlinking sole login method returns 400 SOLE_LOGIN_METHOD error', async () => {
    const { user } = await dataService.createUser({
      email: 'sole_ident@example.com',
      password: 'StrongPassword123!',
    });

    const loginRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'sole_ident@example.com', password: 'StrongPassword123!' },
    });
    const token = JSON.parse(loginRes.payload).data.token;

    const res = await app.inject({
      method: 'DELETE',
      url: '/v1/auth/identities/ident_password',
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.payload);
    assert.equal(body.error.code, 'SOLE_LOGIN_METHOD');
  });
});
