import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';

const ENCRYPTED_PREFIX = 'v1';

function getKey() {
  // Hashing yields the 32 bytes required by AES-256 while accepting a key from
  // the deployment secret manager in either base64, hex, or passphrase form.
  return createHash('sha256').update(env.TOTP_ENCRYPTION_KEY || env.JWT_SECRET).digest();
}

export function encryptTotpSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [ENCRYPTED_PREFIX, iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join('.');
}

export function decryptTotpSecret(value: string) {
  const [version, ivValue, tagValue, ciphertext] = value.split('.');
  if (version !== ENCRYPTED_PREFIX || !ivValue || !tagValue || !ciphertext) {
    // Existing records are plaintext. Keeping this compatibility path lets
    // current users sign in; they are re-encrypted on their next 2FA update.
    return value;
  }
  const decipher = createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivValue, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8');
}

