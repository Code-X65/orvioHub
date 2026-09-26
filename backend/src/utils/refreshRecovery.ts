import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';

const REFRESH_RECOVERY_TTL_MS = 10_000;

/**
 * A short-lived, signed pointer to the session created by a refresh rotation.
 * It never contains a refresh credential and is only usable while the browser
 * also presents the replacement HttpOnly cookie to the recovery endpoint.
 */
export function createRefreshRecoveryTicket(sessionId: string): string {
  const payload = Buffer.from(JSON.stringify({ sessionId, exp: Date.now() + REFRESH_RECOVERY_TTL_MS })).toString('base64url');
  const signature = createHmac('sha256', env.JWT_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function readRefreshRecoveryTicket(ticket: unknown): { sessionId: string; exp: number } | null {
  if (typeof ticket !== 'string') return null;
  const [payload, suppliedSignature] = ticket.split('.');
  if (!payload || !suppliedSignature) return null;
  const expectedSignature = createHmac('sha256', env.JWT_SECRET).update(payload).digest('base64url');
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { sessionId?: string; exp?: number };
    return typeof parsed.sessionId === 'string' && typeof parsed.exp === 'number' && parsed.exp >= Date.now() ? parsed as { sessionId: string; exp: number } : null;
  } catch {
    return null;
  }
}
