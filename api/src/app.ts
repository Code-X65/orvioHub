import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { env } from './config/env.js';
import { healthRoutes } from './routes/health.js';
import { convexPlugin } from './plugins/convex.js';
import { observabilityPlugin } from './plugins/observability.js';

export async function buildApp() {
  const fastify = Fastify({
    logger: {
      level: env.LOG_LEVEL,
    },
  });

  // Plugins
  await fastify.register(cors, { origin: true });
  await fastify.register(sensible);
  await fastify.register(observabilityPlugin);
  await fastify.register(convexPlugin);

  // Root route
  fastify.get('/', async () => {
    return {
      name: 'orvioHub API',
      version: '1.0.0',
      status: 'running',
      convexConfigured: Boolean(fastify.convex),
      observabilityActive: Boolean(env.SENTRY_DSN || env.BETTERSTACK_LOGTAIL_TOKEN),
    };
  });

  // Routes
  await fastify.register(healthRoutes);

  return fastify;
}
