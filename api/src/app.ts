import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { env } from './config/env.js';
import { ALLOWED_CORS_ORIGINS } from './config/domain.js';
import { hostContextPlugin } from './plugins/host-context.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { organizationRoutes } from './routes/organizations.js';
import { onboardingRoutes } from './routes/onboarding.js';
import { invitationRoutes } from './routes/invitations.js';
import { userRoutes } from './routes/users.js';
import { workspaceRoutes } from './routes/workspaces.js';
import { inventoryRoutes } from './routes/inventory.js';
import { convexPlugin } from './plugins/convex.js';
import { observabilityPlugin } from './plugins/observability.js';
import { authPlugin } from './plugins/auth.js';
import { authorizationPlugin } from './plugins/authorization.js';
import { swaggerPlugin } from './plugins/swagger.js';
import { rateLimitPlugin } from './plugins/rateLimit.js';

export async function buildApp() {
  const fastify = Fastify({
    logger: {
      level: env.LOG_LEVEL,
    },
  });

  // Host Context & Subdomain Resolution (Registered first to validate incoming host)
  await fastify.register(hostContextPlugin);

  // Explicit CORS configuration (No wildcard with credentials)
  await fastify.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
      if (!origin) return cb(null, true);

      // Check against allowed domains allowlist
      if (ALLOWED_CORS_ORIGINS.includes(origin) || origin.endsWith('.localhost:5173') || origin.endsWith('.localhost:3000')) {
        return cb(null, true);
      }

      cb(new Error(`Origin ${origin} not allowed by CORS policy`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Orviohub-Application'],
  });

  await fastify.register(sensible);
  await fastify.register(rateLimitPlugin);
  await fastify.register(observabilityPlugin);
  await fastify.register(swaggerPlugin);
  await fastify.register(authPlugin);
  await fastify.register(authorizationPlugin);
  await fastify.register(convexPlugin);

  // Root route
  fastify.get('/', async (request) => {
    return {
      name: 'orvioHub API',
      version: '1.0.0',
      status: 'running',
      hostContext: request.hostContext,
      convexConfigured: Boolean(fastify.convex),
      observabilityActive: Boolean(env.SENTRY_DSN || env.BETTERSTACK_LOGTAIL_TOKEN),
      docs: '/docs',
    };
  });

  // API Routes
  await fastify.register(healthRoutes);
  await fastify.register(authRoutes, { prefix: '/api/v1/auth' });
  await fastify.register(userRoutes, { prefix: '/api/v1/users' });
  await fastify.register(organizationRoutes, { prefix: '/api/v1/organizations' });
  await fastify.register(workspaceRoutes, { prefix: '/api/v1/workspaces' });
  await fastify.register(inventoryRoutes, { prefix: '/api/v1/inventory' });
  await fastify.register(onboardingRoutes, { prefix: '/api/v1/onboarding' });
  await fastify.register(invitationRoutes, { prefix: '/api/v1/invitations' });

  return fastify;
}
