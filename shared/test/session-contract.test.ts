import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SESSION_ERROR_CODES,
  SESSION_REVOCATION_REASONS,
  SESSION_LIFETIMES,
  CreateSessionContractSchema,
  RotateSessionContractSchema,
  ValidateSessionContractSchema,
  RevokeSessionContractSchema,
  RevokeAllUserSessionsContractSchema,
  ActiveSessionsResponseSchema,
  PublicSessionMetadataSchema,
} from '../src/session.js';

describe('Shared Session Contract Schemas', () => {
  it('validates a correct CreateSessionContractInput', () => {
    const input = {
      userId: 'user_123',
      sessionHash: 'sha256_hash_abc',
      deviceId: 'dev_456',
      deviceName: 'Chrome on macOS',
      authenticationMethod: 'password',
      mfaVerified: false,
      rememberMe: true,
      tokenVersion: 1,
      expiresAt: Date.now() + SESSION_LIFETIMES.REMEMBER_ME_MS,
      absoluteExpiresAt: Date.now() + SESSION_LIFETIMES.REMEMBER_ME_MS,
      userAgent: 'Mozilla/5.0...',
      ipAddress: '127.0.0.1',
    };

    const parsed = CreateSessionContractSchema.parse(input);
    assert.equal(parsed.userId, 'user_123');
    assert.equal(parsed.sessionHash, 'sha256_hash_abc');
    assert.equal(parsed.rememberMe, true);
  });

  it('rejects CreateSessionContractInput when required fields are missing', () => {
    const input = {
      // missing userId & sessionHash
      expiresAt: Date.now() + 1000,
      absoluteExpiresAt: Date.now() + 1000,
    };

    assert.throws(() => {
      CreateSessionContractSchema.parse(input);
    });
  });

  it('rejects a session whose absolute expiry is before its expiry', () => {
    assert.throws(() => {
      CreateSessionContractSchema.parse({
        userId: 'user_123',
        sessionHash: 'sha256_hash_abc',
        expiresAt: 2_000,
        absoluteExpiresAt: 1_999,
      });
    });
  });

  it('rejects unknown session-contract fields', () => {
    assert.throws(() => {
      CreateSessionContractSchema.parse({
        userId: 'user_123',
        sessionHash: 'sha256_hash_abc',
        expiresAt: Date.now() + 1_000,
        absoluteExpiresAt: Date.now() + 1_000,
        unexpected: true,
      });
    });
  });

  it('validates a correct RotateSessionContractInput', () => {
    const input = {
      oldSessionHash: 'hash_old_123',
      newSessionHash: 'hash_new_456',
      newExpiresAt: Date.now() + SESSION_LIFETIMES.NORMAL_MS,
      userAgent: 'Mozilla/5.0...',
      ipAddress: '127.0.0.1',
    };

    const parsed = RotateSessionContractSchema.parse(input);
    assert.equal(parsed.oldSessionHash, 'hash_old_123');
    assert.equal(parsed.newSessionHash, 'hash_new_456');
  });

  it('rejects RotateSessionContractInput when old or new sessionHash is empty', () => {
    assert.throws(() => {
      RotateSessionContractSchema.parse({
        oldSessionHash: '',
        newSessionHash: 'hash_123',
        newExpiresAt: 1234567,
      });
    });
  });

  it('validates session lookup by either ID or hash and rejects empty lookups', () => {
    assert.equal(ValidateSessionContractSchema.safeParse({ sessionId: 'session_123' }).success, true);
    assert.equal(ValidateSessionContractSchema.safeParse({ sessionHash: 'hash_123' }).success, true);
    assert.equal(ValidateSessionContractSchema.safeParse({}).success, false);
  });

  it('validates RevokeSessionContractInput with either sessionId or sessionHash', () => {
    const withId = RevokeSessionContractSchema.parse({
      sessionId: 'sess_123',
      reason: 'USER_LOGOUT',
    });
    assert.equal(withId.sessionId, 'sess_123');
    assert.equal(withId.reason, SESSION_REVOCATION_REASONS.USER_LOGOUT);

    const withHash = RevokeSessionContractSchema.parse({
      sessionHash: 'hash_456',
      reason: 'TOKEN_REUSE_DETECTED',
    });
    assert.equal(withHash.sessionHash, 'hash_456');
    assert.equal(withHash.reason, 'TOKEN_REUSE_DETECTED');

    // Missing both
    assert.throws(() => {
      RevokeSessionContractSchema.parse({
        reason: 'USER_LOGOUT',
      });
    });
  });

  it('validates ActiveSessionsResponseSchema with sanitized metadata and currentSessionId', () => {
    const response = {
      sessions: [
        {
          id: 'sess_1',
          deviceId: 'dev_1',
          deviceName: 'Chrome on Windows',
          browser: 'Chrome 130',
          operatingSystem: 'Windows 11',
          ipAddress: '192.168.1.1',
          lastActiveAt: Date.now() - 5000,
          createdAt: Date.now() - 3600000,
          expiresAt: Date.now() + 86400000,
          absoluteExpiresAt: Date.now() + 86400000,
          isCurrent: true,
        },
      ],
      currentSessionId: 'sess_1',
    };

    const parsed = ActiveSessionsResponseSchema.parse(response);
    assert.equal(parsed.sessions.length, 1);
    assert.equal(parsed.currentSessionId, 'sess_1');
    assert.equal(parsed.sessions[0].isCurrent, true);
  });

  it('has stable error code constants matching plan', () => {
    assert.equal(SESSION_ERROR_CODES.INVALID_TOKEN, 'INVALID_TOKEN');
    assert.equal(SESSION_ERROR_CODES.SESSION_REVOKED, 'SESSION_REVOKED');
    assert.equal(SESSION_ERROR_CODES.TOKEN_EXPIRED, 'TOKEN_EXPIRED');
    assert.equal(SESSION_ERROR_CODES.SESSION_INVALIDATED, 'SESSION_INVALIDATED');
    assert.equal(SESSION_ERROR_CODES.ACCOUNT_SUSPENDED, 'ACCOUNT_SUSPENDED');
  });
});
