import type { FastifyReply } from 'fastify';

export const AUTH_COOKIE_NAME = 'orvio_session';
export const REFRESH_COOKIE_NAME = 'orvio_refresh';

export interface SetAuthCookiesOptions {
  sameSite?: 'lax' | 'strict';
}

/**
 * Attaches wildcard cross-subdomain session cookies to the HTTP response.
 * Supports configurable sameSite policy ('lax' by default, or 'strict' for heightened security preference).
 */
export function setAuthCookies(
  reply: FastifyReply,
  tokens: { token: string; refreshToken?: string },
  options?: SetAuthCookiesOptions
) {
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieDomain = isProduction ? '.orviohub.com' : (process.env.COOKIE_DOMAIN || '.orviohub.localhost');
  const sameSite = options?.sameSite || 'lax';

  const baseOptions = {
    path: '/',
    httpOnly: true,
    secure: isProduction,
    sameSite: sameSite as 'lax' | 'strict',
    maxAge: 60 * 15, // 15 minutes (aligned with JWT access token validity)
  };

  const domainOptions = {
    ...baseOptions,
    domain: cookieDomain,
  };

  // 1. Wildcard Session Cookies (for cross-subdomain access in .orviohub.localhost / .orviohub.com)
  reply.setCookie(AUTH_COOKIE_NAME, tokens.token, domainOptions);

  // 2. Host-only Session Cookies (accepted on localhost / 127.0.0.1)
  reply.setCookie(AUTH_COOKIE_NAME, tokens.token, baseOptions);

  // 3. Refresh Token Cookies
  if (tokens.refreshToken) {
    const refreshBase = {
      ...baseOptions,
      maxAge: 60 * 60 * 24 * 30, // 30 days
    };
    const refreshDomain = {
      ...domainOptions,
      maxAge: 60 * 60 * 24 * 30, // 30 days
    };
    // Set canonical refresh cookie (wildcard cross-subdomain + host-only)
    reply.setCookie(REFRESH_COOKIE_NAME, tokens.refreshToken, refreshDomain);
    reply.setCookie(REFRESH_COOKIE_NAME, tokens.refreshToken, refreshBase);
  }
}

/**
 * Clears wildcard session cookies across all surfaces upon logout.
 */
export function clearAuthCookies(reply: FastifyReply) {
  const isProduction = process.env.NODE_ENV === 'production';
  const defaultDomain = isProduction ? '.orviohub.com' : (process.env.COOKIE_DOMAIN || '.orviohub.localhost');
  const domains = Array.from(
    new Set(
      isProduction
        ? [defaultDomain, '.orviohub.com', 'orviohub.com']
        : [defaultDomain, '.orviohub.localhost', 'orviohub.localhost', 'localhost']
    )
  );

  const cookieNames = ['session', 'orvio_session', 'refresh_token', 'orvio_refresh', 'orvio_refresh_token'];

  const clearOptions = {
    path: '/',
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    maxAge: 0,
    expires: new Date(0),
  };

  for (const domain of domains) {
    for (const name of cookieNames) {
      reply.clearCookie(name, {
        ...clearOptions,
        domain,
      });
    }
  }

  // Also clear host-only cookie (no domain attribute)
  for (const name of cookieNames) {
    reply.clearCookie(name, clearOptions);
  }
}


