import { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { HostContext, resolveHostContext } from '../config/domain.js';

declare module 'fastify' {
  interface FastifyRequest {
    hostContext: HostContext;
  }
}

const hostContextPluginAsync: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // onRequest Hook to resolve and attach hostContext
  fastify.addHook('onRequest', async (request: FastifyRequest, reply) => {
    const rawHost =
      (request.headers['x-forwarded-host'] as string) ||
      (request.headers['host'] as string) ||
      '';

    try {
      request.hostContext = resolveHostContext(rawHost);
    } catch (err: any) {
      fastify.log.warn({ rawHost, error: err.message }, 'Unauthorized or unknown host context');
      return reply.code(400).send({
        error: 'Bad Request',
        message: err.message || 'Unknown or rejected host domain',
        statusCode: 400,
      });
    }
  });

  // Host context endpoint for diagnostics and health verification
  fastify.get('/v1/host-context', async (request: FastifyRequest) => {
    return {
      status: 'ok',
      hostContext: request.hostContext,
      timestamp: new Date().toISOString(),
    };
  });

  // System Readiness & Version Endpoints
  fastify.get('/ready', async () => {
    return {
      status: 'ready',
      timestamp: new Date().toISOString(),
    };
  });

  fastify.get('/version', async () => {
    return {
      version: '1.0.0',
      name: 'orviohub-api',
      nodeEnv: process.env.NODE_ENV || 'development',
    };
  });
};

export const hostContextPlugin = fp(hostContextPluginAsync, {
  name: 'hostContextPlugin',
});
