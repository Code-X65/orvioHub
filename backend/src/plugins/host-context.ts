import { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { HostContext, resolveHost } from '@orviohub/shared';

declare module 'fastify' {
  interface FastifyRequest {
    hostContext: HostContext;
  }
}

const hostContextPluginAsync: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // onRequest Hook to resolve and attach hostContext
  fastify.addHook('onRequest', async (request: FastifyRequest, reply) => {
    // 1. CORS preflight OPTIONS requests are handled by @fastify/cors
    if (request.method === 'OPTIONS') {
      return;
    }

    // 2. Health and readiness endpoints are exempt
    const isHealthOrReadiness =
      request.url === '/ready' ||
      request.url === '/version' ||
      request.url === '/health' ||
      request.url.startsWith('/health');

    const rawHost =
      (request.headers['x-forwarded-host'] as string) ||
      (request.headers['host'] as string) ||
      '';

    const origin = (request.headers['origin'] as string) || '';
    const referer = (request.headers['referer'] as string) || '';

    try {
      request.hostContext = resolveHost(rawHost);
      fastify.log.debug(
        { rawHost, application: request.hostContext.application, environment: request.hostContext.environment },
        'Resolved incoming host context'
      );
    } catch (err: any) {
      if (isHealthOrReadiness) {
        request.hostContext = {
          environment: 'development',
          application: 'marketing',
          hostname: rawHost || 'localhost',
        };
        return;
      }

      // Direct development backend access on localhost / 127.0.0.1
      const isDirectLocalBackend =
        rawHost.startsWith('localhost') ||
        rawHost.startsWith('127.0.0.1') ||
        rawHost === 'localhost:80' ||
        !rawHost;

      if (isDirectLocalBackend) {
        // Resolve surface context from the calling frontend origin or referer if available
        let callingHost = '';
        if (origin) {
          try {
            callingHost = new URL(origin).host;
          } catch {}
        } else if (referer) {
          try {
            callingHost = new URL(referer).host;
          } catch {}
        }

        if (callingHost) {
          try {
            request.hostContext = resolveHost(callingHost);
            return;
          } catch {}
        }

        // Default local development fallback
        request.hostContext = {
          environment: (process.env.NODE_ENV as any) === 'production' ? 'production' : 'development',
          application: 'accounts',
          hostname: 'accounts.orviohub.localhost',
        };
        return;
      }

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
