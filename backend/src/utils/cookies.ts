import type { FastifyReply } from 'fastify';

/**
 * Attaches wildcard cross-subdomain session cookies to the HTTP response.
 */
export function setAuthCookies(
  reply: FastifyReply,
  tokens: { token: string; refreshToken?: string }
) {
  const isProduction = process.env.NODE_ENV === 'production';
  // In development *.orviohub.localhost, domain .orviohub.localhost allows all subdomains
  const cookieDomain = isProduction ? '.orviohub.com' : '.orviohub.localhost';

  // 1. Session Access Cookie (JWT)
  reply.setCookie('orvio_session', tokens.token, {
    path: '/',
    domain: cookieDomain,
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  // 2. Refresh Token Cookie
  if (tokens.refreshToken) {
    reply.setCookie('orvio_refresh_token', tokens.refreshToken, {
      path: '/',
      domain: cookieDomain,
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
  }
}

/**
 * Clears wildcard session cookies across all surfaces upon logout.
 */
export function clearAuthCookies(reply: FastifyReply) {
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieDomain = isProduction ? '.orviohub.com' : '.orviohub.localhost';

  reply.clearCookie('orvio_session', {
    path: '/',
    domain: cookieDomain,
  });
  reply.clearCookie('orvio_refresh_token', {
    path: '/',
    domain: cookieDomain,
  });
}
