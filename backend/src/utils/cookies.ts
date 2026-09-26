import type { FastifyReply } from 'fastify';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { SESSION_LIFETIMES } from '@orviohub/shared';

// Refresh is the shared browser session credential. It must be scoped to the
// OrvioHub parent domain so a session created on accounts can be refreshed by
// home and product subdomains after a redirect.
export const REFRESH_COOKIE_NAME = process.env.NODE_ENV === 'production'
  ? '__Secure-orvio_refresh'
  : 'orvio_refresh_token';
/**
 * The browser's primary Orvio identity credential.  Its value is an opaque
 * random secret; the database stores only its hash.  Keep the legacy refresh
 * name during the migration so a rollback never strands an existing browser.
 */
export const SESSION_COOKIE_NAME = process.env.NODE_ENV === 'production'
  ? '__Secure-orvio_session'
  : 'orvio_session';
export const LEGACY_REFRESH_COOKIE_NAMES = ['orvio_refresh_token', 'refresh_token', '__Secure-orvio_refresh'];
const REFRESH_COOKIE_PATH = '/api/v1/auth/';

function refreshCookieDomain(isProduction: boolean) {
  return process.env.COOKIE_DOMAIN || (isProduction ? '.orviohub.com' : '.orviohub.localhost');
}

export function validateRefreshCookieConfiguration() {
  if (process.env.NODE_ENV !== 'production') return;
  const domain = refreshCookieDomain(true);
  if (!domain.startsWith('.') || domain.includes('localhost')) {
    throw new Error('COOKIE_DOMAIN must be a shared production parent domain such as .orviohub.com.');
  }
}

export function setAuthCookies(
  reply: FastifyReply,
  tokens: { refreshToken?: string },
  rememberMe = false
) {
  if (!tokens.refreshToken) return;
  const isProduction = process.env.NODE_ENV === 'production';
  reply.setCookie(REFRESH_COOKIE_NAME, tokens.refreshToken, {
    domain: refreshCookieDomain(isProduction),
    path: REFRESH_COOKIE_PATH,
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: Math.floor(
      (rememberMe ? SESSION_LIFETIMES.REMEMBER_ME_MS : SESSION_LIFETIMES.NORMAL_MS) / 1000
    ),
  });
}

export function setSessionCookie(
  reply: FastifyReply,
  sessionSecret: string,
  rememberMe = false
) {
  const isProduction = process.env.NODE_ENV === 'production';
  reply.setCookie(SESSION_COOKIE_NAME, sessionSecret, {
    domain: refreshCookieDomain(isProduction),
    // All API endpoints, not only /auth, authenticate from this cookie.
    path: '/api',
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: Math.floor(
      (rememberMe ? SESSION_LIFETIMES.REMEMBER_ME_MS : SESSION_LIFETIMES.NORMAL_MS) / 1000
    ),
  });
}

/** A header token bound to the HttpOnly session secret for cookie-auth CSRF. */
export function createSessionCsrfToken(sessionSecret: string): string {
  return createHmac('sha256', process.env.JWT_SECRET || '').update(sessionSecret).digest('base64url');
}

export function hasValidSessionCsrfToken(supplied: unknown, sessionSecret: string): boolean {
  if (typeof supplied !== 'string') return false;
  const expected = Buffer.from(createSessionCsrfToken(sessionSecret));
  const actual = Buffer.from(supplied);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Clear both shared-domain and historical host-only refresh cookies. */
export function clearAuthCookies(reply: FastifyReply) {
  const isProduction = process.env.NODE_ENV === 'production';
  const options = {
    path: REFRESH_COOKIE_PATH,
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    maxAge: 0,
    expires: new Date(0),
  };
  const sharedDomainOptions = { ...options, domain: refreshCookieDomain(isProduction) };
  for (const name of new Set([SESSION_COOKIE_NAME, REFRESH_COOKIE_NAME, ...LEGACY_REFRESH_COOKIE_NAMES])) {
    reply.clearCookie(name, options);
    reply.clearCookie(name, sharedDomainOptions);
    reply.clearCookie(name, { ...options, path: '/api/v1/auth/' });
    reply.clearCookie(name, { ...sharedDomainOptions, path: '/api/v1/auth/' });
    reply.clearCookie(name, { ...options, path: '/api' });
    reply.clearCookie(name, { ...sharedDomainOptions, path: '/api' });
  }

  // Clear historical session-cookie names at both their old host-only scope
  // and the shared parent-domain scope.
  for (const name of ['session', 'orvio_session', 'refresh_token', 'orvio_refresh_token']) {
    reply.clearCookie(name, { ...options, path: '/' });
    reply.clearCookie(name, { ...sharedDomainOptions, path: '/' });
  }
}
