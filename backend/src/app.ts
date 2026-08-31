import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import sensible from '@fastify/sensible';
import { env } from './config/env.js';
import { getAllowedOrigins, isAllowedOrigin, type Environment } from '@orviohub/shared';
import { hostContextPlugin } from './plugins/host-context.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { organizationRoutes } from './routes/organizations.js';
import { onboardingRoutes } from './routes/onboarding.js';
import { invitationRoutes } from './routes/invitations.js';
import { locationRoutes } from './routes/locations.js';
import { userRoutes } from './routes/users.js';
import { workspaceRoutes } from './routes/workspaces.js';
import { inventoryRoutes } from './routes/inventory.js';
import { productsRoutes } from './routes/products.js';
import { adminProductsRoutes } from './routes/admin/products.js';
import { billingRoutes } from './routes/billing.js';
import { adminBillingRoutes } from './routes/admin/billing.js';
import { webhookRoutes } from './routes/webhooks.js';
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

  // 1. Explicit CORS configuration (Registered FIRST so OPTIONS preflights get CORS headers)
  await fastify.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
      if (!origin) return cb(null, true);

      const currentEnv: Environment =
        (process.env.NODE_ENV as Environment) === 'production' ? 'production' : 'development';

      if (isAllowedOrigin(origin, currentEnv) || getAllowedOrigins(currentEnv).includes(origin)) {
        return cb(null, true);
      }

      cb(new Error(`Origin ${origin} not allowed by CORS policy`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Orviohub-Application'],
  });

  // 2. Cookie Support (Required for cross-subdomain session cookies)
  await fastify.register(cookie);

  // 3. Host Context & Subdomain Resolution
  await fastify.register(hostContextPlugin);

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
  await fastify.register(productsRoutes, { prefix: '/api/v1/products' });
  await fastify.register(adminProductsRoutes, { prefix: '/api/v1/admin/products' });
  await fastify.register(billingRoutes, { prefix: '/api/v1' });
  await fastify.register(adminBillingRoutes, { prefix: '/api/v1/admin' });
  await fastify.register(webhookRoutes, { prefix: '/api/v1' });
  await fastify.register(onboardingRoutes, { prefix: '/api/v1/onboarding' });
  await fastify.register(invitationRoutes, { prefix: '/api/v1/invitations' });
  await fastify.register(locationRoutes, { prefix: '/api/v1/locations' });

  return fastify;
}
