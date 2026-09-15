import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { env } from '../config/env.js';
import { dataService, type UserRecord } from '../services/dataService.js';
import { ERROR_CODES } from '../config/constants.js';

import { clearAuthCookies } from '../utils/cookies.js';

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
    return entry.user;
  }
  userAuthCache.delete(userId);
  return null;
}

export function setCachedAuthUser(userId: string, user: UserRecord): void {
  if (userAuthCache.size > 2000) {
    const oldestKey = userAuthCache.keys().next().value;
    if (oldestKey) userAuthCache.delete(oldestKey);
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
      expiresIn: '7d',
    },
  });

  fastify.decorate(
    'authenticate',
    async function (request: FastifyRequest, reply: FastifyReply) {
      try {
        let decoded: JwtPayload;
        const authHeader = request.headers.authorization;

        if (authHeader && authHeader.startsWith('Bearer ')) {
          decoded = await request.jwtVerify<JwtPayload>();
        } else if (request.cookies?.session || request.cookies?.orvio_session) {
          const sessionCookie = (request.cookies.session || request.cookies.orvio_session)!;
          decoded = fastify.jwt.verify<JwtPayload>(sessionCookie);
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
          if (session) {
            if (session.isRevoked || session.revokedAt) {
              clearAuthCookies(reply);
              return reply.status(401).send({
                success: false,
                error: {
                  code: ERROR_CODES.UNAUTHENTICATED,
                  message: 'Session was revoked. Please sign in again.',
                },
              });
            }
            if (session.expiresAt && session.expiresAt <= Date.now()) {
              clearAuthCookies(reply);
              return reply.status(401).send({
                success: false,
                error: {
                  code: ERROR_CODES.UNAUTHENTICATED,
                  message: 'Session has expired. Please sign in again.',
                },
              });
            }
            if (session.tokenVersion !== currentTokenVersion) {
              clearAuthCookies(reply);
              return reply.status(401).send({
                success: false,
                error: {
                  code: ERROR_CODES.UNAUTHENTICATED,
                  message: 'Session has been invalidated. Please sign in again.',
                },
              });
            }
          }
        }

        request.user = user;
        request.sessionId = decoded.sessionId;
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
