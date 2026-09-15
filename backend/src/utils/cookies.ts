import type { FastifyReply } from 'fastify';

/**
 * Attaches wildcard cross-subdomain session cookies to the HTTP response.
 */
export function setAuthCookies(
  reply: FastifyReply,
  tokens: { token: string; refreshToken?: string }
) {
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieDomain = isProduction ? '.orviohub.com' : (process.env.COOKIE_DOMAIN || '.orviohub.localhost');

  const cookieOptions = {
    path: '/',
    domain: cookieDomain,
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 7, // 7 days
  };

  // 1. Wildcard Session Cookies (JWT): 'session' and 'orvio_session'
  reply.setCookie('session', tokens.token, cookieOptions);
  reply.setCookie('orvio_session', tokens.token, cookieOptions);

  // 2. Wildcard Refresh Token Cookies
  if (tokens.refreshToken) {
    const refreshOptions = {
      ...cookieOptions,
      maxAge: 60 * 60 * 24 * 30, // 30 days
    };
    reply.setCookie('refresh_token', tokens.refreshToken, refreshOptions);
    reply.setCookie('orvio_refresh_token', tokens.refreshToken, refreshOptions);
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

  const cookieNames = ['session', 'orvio_session', 'refresh_token', 'orvio_refresh_token'];

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


