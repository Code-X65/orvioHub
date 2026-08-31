import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';
import type { FastifyPluginAsync } from 'fastify';
import { env } from '../config/env.js';
import { ERROR_CODES } from '../config/constants.js';

const plugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    allowList: (req) => {
      if (env.NODE_ENV === 'test' && (req.ip === '127.0.0.1' || req.ip === 'localhost')) {
        return true;
      }
      return false;
    },
    errorResponseBuilder: () => {
      return {
        statusCode: 429,
        success: false,
        error: {
          code: ERROR_CODES.RATE_LIMITED,
          message: 'Too many requests. Please slow down and try again later.',
        },
      };
    },
  });
};

export const rateLimitPlugin = fp(plugin, {
  name: 'rate-limit-plugin',
});
