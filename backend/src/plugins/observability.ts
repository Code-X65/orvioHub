import fp from 'fastify-plugin';
import * as Sentry from '@sentry/node';
import { Logtail } from '@logtail/node';
import type { FastifyPluginAsync } from 'fastify';
import { env } from '../config/env.js';

declare module 'fastify' {
  interface FastifyInstance {
    logtail: Logtail | null;
    captureException: (err: unknown) => void;
  }
}

const plugin: FastifyPluginAsync = async (fastify) => {
  // Initialize Sentry if DSN provided
  if (env.SENTRY_DSN) {
    Sentry.init({
      dsn: env.SENTRY_DSN,
      environment: env.NODE_ENV,
      tracesSampleRate: 1.0,
    });
  }

  // Initialize Better Stack Logtail if token provided
  const logtail = env.BETTERSTACK_LOGTAIL_TOKEN
    ? new Logtail(env.BETTERSTACK_LOGTAIL_TOKEN)
    : null;

  fastify.decorate('logtail', logtail);
  fastify.decorate('captureException', (err: unknown) => {
    if (env.SENTRY_DSN) {
      Sentry.captureException(err);
    }
    if (logtail) {
      logtail.error(err instanceof Error ? err.message : String(err));
    }
  });
};

export const observabilityPlugin = fp(plugin, {
  name: 'observability-plugin',
});
