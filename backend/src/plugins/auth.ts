import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { env } from '../config/env.js';
import { dataService, type UserRecord } from '../services/dataService.js';
import { ERROR_CODES } from '../config/constants.js';

import { clearAuthCookies, SESSION_COOKIE_NAME } from '../utils/cookies.js';
import { createRefreshRecoveryTicket } from '../utils/refreshRecovery.js';
import { resolveBrowserSession } from '../services/identity/sessionService.js';

export interface JwtPayload {
  userId: string;
  email: string;
  sessionId?: string;
  productKey?: string;
  tokenVersion?: number;
  is2faPending?: boolean;
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    sessionId?: string;
    authSource?: 'session-cookie' | 'bearer-jwt';
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    user: UserRecord;
  }
}

interface CachedUserEntry {
  user: UserRecord;
  expiresAt: number;
}
const userAuthCache = new Map<string, CachedUserEntry>();

function pruneExpiredAuthUsers() {
  const now = Date.now();
  for (const [key, entry] of userAuthCache.entries()) {
    if (now > entry.expiresAt) {
      userAuthCache.delete(key);
    }
  }
}

// Periodic cleanup every 60 seconds (unref prevents blocking process exit)
if (typeof setInterval !== 'undefined') {
  const timer = setInterval(pruneExpiredAuthUsers, 60_000);
  if (typeof timer.unref === 'function') {
    timer.unref();
  }
}

export function getCachedAuthUser(userId: string): UserRecord | null {
  if (
    process.env.NODE_ENV === 'test' ||
    env.NODE_ENV === 'test' ||
    process.env.npm_lifecycle_event === 'test' ||
    process.argv.includes('--test') ||
    process.execArgv.includes('--test') ||
    process.argv.some((arg) => arg.includes('.test.ts'))
  ) {
    return null;
  }
  const entry = userAuthCache.get(userId);
  if (entry && entry.expiresAt > Date.now()) {
    // True LRU: move to end (most recently used) by deleting and re-inserting
    userAuthCache.delete(userId);
    userAuthCache.set(userId, entry);
    return entry.user;
  }
  userAuthCache.delete(userId);
  return null;
}

export function setCachedAuthUser(userId: string, user: UserRecord): void {
  // If key already exists, delete first so re-insertion places it at the end (MRU)
  if (userAuthCache.has(userId)) {
    userAuthCache.delete(userId);
  }
  if (userAuthCache.size >= 1500) {
    pruneExpiredAuthUsers();
  }
  while (userAuthCache.size >= 2000) {
    const oldestKey = userAuthCache.keys().next().value;
    if (oldestKey) userAuthCache.delete(oldestKey);
    else break;
  }
  userAuthCache.set(userId, { user, expiresAt: Date.now() + 15_000 });
}

export function invalidateAuthUserCache(userId: string): void {
  userAuthCache.delete(userId);
}

const plugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    sign: {
      // 7 days — matches the orvio_session cookie maxAge so the wildcard
      // cookie remains valid across all subdomains for the full session lifetime.
      expiresIn: '15m',
    },
  });

  fastify.decorate(
    'authenticate',
    async function (request: FastifyRequest, reply: FastifyReply) {
      try {
        // Cookie sessions are the primary architecture.  A single stable
        // secret is shared by tabs/subdomains; no refresh rotation is needed.
        const sessionSecret = request.cookies?.[SESSION_COOKIE_NAME];
        if (sessionSecret) {
          const resolved = await resolveBrowserSession(sessionSecret);
          if (!resolved) {
            clearAuthCookies(reply);
            return reply.status(401).send({
              success: false,
              error: { code: ERROR_CODES.UNAUTHENTICATED, message: 'Authentication session is invalid or expired.' },
            });
          }
          request.user = resolved.user;
          request.sessionId = String(resolved.session.id || resolved.session._id);
          request.authSource = 'session-cookie';
          void dataService.touchSessionActivity(request.sessionId);
          return;
        }

        // Compatibility path for existing browser deployments and external
        // callers.  It is removed only after the cookie-session rollout.
        let decoded: JwtPayload;
        const authHeader = request.headers.authorization;

        if (authHeader && authHeader.startsWith('Bearer ')) {
          decoded = await request.jwtVerify<JwtPayload>();
        } else {
          clearAuthCookies(reply);
          return reply.status(401).send({
            success: false,
            error: {
              code: ERROR_CODES.UNAUTHENTICATED,
              message: 'Authentication required. Please provide a valid session.',
            },
          });
        }

        if (decoded.is2faPending) {
          clearAuthCookies(reply);
          return reply.status(401).send({
            success: false,
            error: {
              code: ERROR_CODES.UNAUTHENTICATED,
              message: 'Two-factor authentication challenge pending. Please complete 2FA verification.',
            },
          });
        }
        let user = getCachedAuthUser(decoded.userId);
        if (!user) {
          user = await dataService.getUserById(decoded.userId);
          if (user) {
            setCachedAuthUser(decoded.userId, user);
          }
        }
        if (!user) {
          invalidateAuthUserCache(decoded.userId);
          clearAuthCookies(reply);
          return reply.status(401).send({
            success: false,
            error: {
              code: ERROR_CODES.UNAUTHENTICATED,
              message: 'Authentication session is invalid or user was deleted.',
            },
          });
        }
        if (user.status === 'SUSPENDED' || user.status === 'INACTIVE') {
          invalidateAuthUserCache(decoded.userId);
          clearAuthCookies(reply);
          return reply.status(401).send({
            success: false,
            error: {
              code: ERROR_CODES.UNAUTHENTICATED,
              message: 'Account is inactive or suspended.',
            },
          });
        }
        const currentTokenVersion = user.tokenVersion ?? 0;
        const tokenVersionInJwt = decoded.tokenVersion ?? 0;
        if (tokenVersionInJwt !== currentTokenVersion) {
          clearAuthCookies(reply);
          return reply.status(401).send({
            success: false,
            error: {
              code: ERROR_CODES.UNAUTHENTICATED,
              message: 'Session has been invalidated. Please sign in again.',
            },
          });
        }

        // Validate server-side session status if sessionId is present
        if (decoded.sessionId) {
          const session = await dataService.getSessionById(decoded.sessionId);
          if (!session) {
            clearAuthCookies(reply);
            return reply.status(401).send({ success: false, error: { code: ERROR_CODES.UNAUTHENTICATED, message: 'Authentication session is unavailable or no longer valid. Please sign in again.' } });
          }
          if (session.revocationReason === 'REPLACED_BY_ROTATION' && session.replacedBySessionId) {
            // Another tab rotated this browser's shared refresh credential.
            // The old access JWT is no longer accepted, but clearing cookies
            // here would delete the successor's cookie for every subdomain.
            return reply.status(409).send({
              success: false,
              error: {
                code: 'SESSION_REPLACED_BY_ROTATION',
                message: 'Session was replaced by a refresh in another tab.',
              },
              data: { recoveryTicket: createRefreshRecoveryTicket(String(session.replacedBySessionId)) },
            });
          }
          if (session.isRevoked || session.revokedAt) {
            clearAuthCookies(reply);
            return reply.status(401).send({ success: false, error: { code: ERROR_CODES.UNAUTHENTICATED, message: 'Session was revoked. Please sign in again.' } });
          }
          const now = Date.now();
          const idleTimeoutMs = 30 * 60 * 1000;
          if (session.expiresAt && session.expiresAt <= now) {
            clearAuthCookies(reply);
            return reply.status(401).send({ success: false, error: { code: ERROR_CODES.UNAUTHENTICATED, message: 'Session has expired. Please sign in again.' } });
          }
          if (session.absoluteExpiresAt && session.absoluteExpiresAt <= now) {
            clearAuthCookies(reply);
            return reply.status(401).send({ success: false, error: { code: ERROR_CODES.UNAUTHENTICATED, message: 'Session has reached its maximum lifetime. Please sign in again.' } });
          }
          if (session.lastActiveAt && now - session.lastActiveAt > idleTimeoutMs) {
            await dataService.revokeSessionById(decoded.sessionId, decoded.userId);
            clearAuthCookies(reply);
            return reply.status(401).send({ success: false, error: { code: ERROR_CODES.UNAUTHENTICATED, message: 'Session expired due to inactivity. Please sign in again.' } });
          }
          if (session.tokenVersion !== currentTokenVersion) {
            clearAuthCookies(reply);
            return reply.status(401).send({ success: false, error: { code: ERROR_CODES.UNAUTHENTICATED, message: 'Session has been invalidated. Please sign in again.' } });
          }
        }

        request.user = user;
        request.sessionId = decoded.sessionId;
        request.authSource = 'bearer-jwt';
        if (decoded.sessionId) {
          void dataService.touchSessionActivity(decoded.sessionId);
        }
      } catch {
        clearAuthCookies(reply);
        return reply.status(401).send({
          success: false,
          error: {
            code: ERROR_CODES.UNAUTHENTICATED,
            message: 'Authentication required. Please provide a valid session token.',
          },
        });
      }
    }
  );
};

export const authPlugin = fp(plugin, {
  name: 'auth-plugin',
});
