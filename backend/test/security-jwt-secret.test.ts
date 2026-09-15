import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Security: Production JWT_SECRET Validation', () => {
  it('detects insecure default JWT_SECRET in production simulation', () => {
    const validateJwtSecret = (nodeEnv: string, secret?: string) => {
      if (nodeEnv === 'production') {
        if (!secret || secret === 'orvio-hub-super-secret-key-change-in-production-min32chars') {
          throw new Error('JWT_SECRET must be set to a secure, random string in production (cannot use default).');
        }
        if (secret.length < 32) {
          throw new Error('JWT_SECRET must be at least 32 characters in production.');
        }
      }
      return true;
    };

    // 1. In production with default secret -> throws
    assert.throws(
      () => validateJwtSecret('production', 'orvio-hub-super-secret-key-change-in-production-min32chars'),
      /cannot use default/
    );

    // 2. In production with short secret -> throws
    assert.throws(
      () => validateJwtSecret('production', 'too-short-secret'),
      /at least 32 characters/
    );

    // 3. In production with valid strong secret -> succeeds
    assert.doesNotThrow(() =>
      validateJwtSecret('production', 'a-very-strong-cryptographically-secure-random-token-min-32-chars')
    );

    // 4. In development with default secret -> succeeds
    assert.doesNotThrow(() =>
      validateJwtSecret('development', 'orvio-hub-super-secret-key-change-in-production-min32chars')
    );
  });
});
