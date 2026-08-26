import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { env } from '../config/env.js';
import { dataService, type UserRecord } from '../services/dataService.js';
import { ERROR_CODES } from '../config/constants.js';

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

const plugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    sign: {
      expiresIn: '15m',
    },
  });

  fastify.decorate(
    'authenticate',
    async function (request: FastifyRequest, reply: FastifyReply) {
      try {
        const decoded = await request.jwtVerify<JwtPayload>();
        if (decoded.is2faPending) {
          return reply.status(401).send({
            success: false,
            error: {
              code: ERROR_CODES.UNAUTHENTICATED,
              message: 'Two-factor authentication challenge pending. Please complete 2FA verification.',
            },
          });
        }
        const user = await dataService.getUserById(decoded.userId);
        if (!user) {
          return reply.status(401).send({
            success: false,
            error: {
              code: ERROR_CODES.UNAUTHENTICATED,
              message: 'Authentication session is invalid or user was deleted.',
            },
          });
        }
        if (user.status === 'SUSPENDED' || user.status === 'INACTIVE') {
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
          return reply.status(401).send({
            success: false,
            error: {
              code: ERROR_CODES.UNAUTHENTICATED,
              message: 'Session has been invalidated. Please sign in again.',
            },
          });
        }
        request.user = user;
        request.sessionId = decoded.sessionId;
      } catch {
        return reply.status(401).send({
          success: false,
          error: {
            code: ERROR_CODES.UNAUTHENTICATED,
            message: 'Authentication required. Please provide a valid Bearer token.',
          },
        });
      }
    }
  );
};

export const authPlugin = fp(plugin, {
  name: 'auth-plugin',
});
