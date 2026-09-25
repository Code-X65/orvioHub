import Fastify, { type FastifyError } from 'fastify';
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
import { notificationRoutes } from './routes/notifications.js';
import { locationRoutes } from './routes/locations.js';
import { userRoutes } from './routes/users.js';
import { workspaceRoutes } from './routes/workspaces.js';
import { inventoryRoutes } from './routes/inventory.js';
import { productsRoutes } from './routes/products.js';
import { platformRoutes } from './routes/platform.js';
import { adminProductsRoutes } from './routes/admin/products.js';
import { billingRoutes } from './routes/billing.js';
import { adminBillingRoutes } from './routes/admin/billing.js';
import { adminOrganizationLimitRoutes } from './routes/admin/organizationLimits.js';
import { adminPlatformRoutes } from './routes/admin/platform.js';
import { adminUserRoutes } from './routes/admin/users.js';
import { adminWorkspaceRoutes } from './routes/admin/workspaces.js';
import { adminPhoneChallengeRoutes } from './routes/admin/phoneChallenges.js';
import { adminDeletionRoutes } from './routes/admin/deletions.js';
import { adminOverrideRoutes } from './routes/admin/overrides.js';
import { adminAnalyticsRoutes } from './routes/admin/analytics.js';
import { workspaceAnalyticsRoutes } from './routes/workspaceAnalytics.js';
import { receiptSettingsRoutes } from './routes/receiptSettings.js';
import { workspaceSettingsRoutes } from './routes/workspaceSettings.js';
import { branchSettingsRoutes } from './routes/branchSettings.js';
import { applicationSettingsRoutes } from './routes/applicationSettings.js';
import { entitlementRoutes } from './routes/entitlements.js';
import { clientLogsRoutes } from './routes/clientLogs.js';
import { batchRoutes } from './routes/batch.js';
import { realtimeRoutes } from './routes/realtime.js';
import { jobRoutes } from './routes/jobs.js';
import { webhookRoutes } from './routes/webhooks.js';
import tenantContextRoute from './routes/tenantContext.js';
import inventoryStatusRoute from './routes/inventoryStatus.js';
import { convexPlugin } from './plugins/convex.js';
import { observabilityPlugin } from './plugins/observability.js';
import { authPlugin } from './plugins/auth.js';
import { authorizationPlugin } from './plugins/authorization.js';
import { swaggerPlugin } from './plugins/swagger.js';
import { rateLimitPlugin } from './plugins/rateLimit.js';

import { AppError } from './errors/AppError.js';
import { ERROR_CODES } from './config/constants.js';

export async function buildApp() {
  const fastify = Fastify({
    trustProxy: true,
    logger: {
      level: env.LOG_LEVEL,
    },
  });

  // Centralized Error Handler
  fastify.setErrorHandler((error: FastifyError | Error | any, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      });
    }

    // Fastify schema validation errors
    if ((error as any).validation) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message,
          details: { validation: (error as any).validation },
        },
      });
    }

    if (error.statusCode === 429 || error.code === 'FST_ERR_RATE_LIMIT') {
      return reply.status(429).send({
        success: false,
        error: {
          code: ERROR_CODES.RATE_LIMITED,
          message: error.message || 'Too many requests. Please slow down and try again later.',
        },
      });
    }

    if (error.statusCode === 403 || error.code === 'CORS_NOT_ALLOWED' || error.message?.includes('not allowed by CORS policy')) {
      return reply.status(403).send({
        success: false,
        error: {
          code: error.code || 'CORS_NOT_ALLOWED',
          message: error.message,
        },
      });
    }

    const statusCode =
      typeof error.statusCode === 'number' && error.statusCode >= 400 ? error.statusCode : 500;

    request.log.error(error);

    const isProd = process.env.NODE_ENV === 'production';
    return reply.status(statusCode).send({
      success: false,
      error: {
        code: statusCode === 500 ? 'INTERNAL_SERVER_ERROR' : (error.name || 'ERROR'),
        message: statusCode === 500 && isProd ? 'An internal server error occurred' : error.message,
        ...(isProd ? {} : { stack: error.stack }),
      },
    });
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

      const corsError: any = new Error(`Origin ${origin} not allowed by CORS policy`);
      corsError.statusCode = 403;
      corsError.code = 'CORS_NOT_ALLOWED';
      cb(corsError, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Orviohub-Application',
      'Idempotency-Key',
      'idempotency-key',
      'x-workspace-id',
      'x-branch-id',
    ],
    exposedHeaders: ['Cache-Invalidate', 'x-cache-invalidate'],
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

  // Canonical redirect for legacy /v1/* routes to /api/v1/* (without exceptions)
  fastify.addHook('onRequest', async (request, reply) => {
    const rawUrl = request.raw.url || request.url;
    if (rawUrl && rawUrl.startsWith('/v1/')) {
      const targetUrl = `/api${rawUrl}`;
      const statusCode = request.method === 'GET' || request.method === 'HEAD' ? 301 : 308;
      return reply.code(statusCode).redirect(targetUrl);
    }
  });

  // Enforce Security Headers & Content Security Policy (CSP)
  fastify.addHook('onSend', async (_request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

    // Strict-Transport-Security (HSTS) in production
    const isProd = process.env.NODE_ENV === 'production';
    if (isProd) {
      reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }

    const connectSrcDirectives = [
      "'self'",
      "https://*.convex.cloud",
      "wss://*.convex.cloud",
      "https://api.orviohub.com",
      "https://accounts.orviohub.com",
      "https://account.orviohub.com",
      "https://home.orviohub.com",
      "https://app.orviohub.com",
      "https://inventory.orviohub.com",
      "https://billing.orviohub.com",
      "https://taskmanagement.orviohub.com",
      "https://api.preprod.orviohub.com",
      "https://accounts.preprod.orviohub.com",
      "https://account.preprod.orviohub.com",
      "https://home.preprod.orviohub.com",
      "https://app.preprod.orviohub.com",
      "https://inventory.preprod.orviohub.com",
      "https://billing.preprod.orviohub.com",
      "https://taskmanagement.preprod.orviohub.com",
      "http://*.orviohub.localhost:*",
      "ws://*.orviohub.localhost:*",
      "http://localhost:*",
      "ws://localhost:*",
      "http://127.0.0.1:*",
      "ws://127.0.0.1:*",
    ].join(' ');

    reply.header(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.paystack.co https://checkout.paystack.com https://*.paystack.co https://*.paystack.com https://checkout.flutterwave.com https://*.flutterwave.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://paystack.com https://*.paystack.co https://*.paystack.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self' data: blob: https:",
        `connect-src ${connectSrcDirectives} https://api.paystack.co https://*.paystack.co https://*.flutterwave.com https://api.flutterwave.com`,
        "frame-src https://js.paystack.co https://checkout.paystack.com https://*.paystack.co https://*.paystack.com https://checkout.flutterwave.com https://*.flutterwave.com",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; ')
    );
  });

  // CSRF Protection Hook: Validate Origin / Referer on state-changing requests when authenticated via cookies
  fastify.addHook('preHandler', async (request, reply) => {
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method);
    const hasAuthCookie = Boolean(request.cookies?.orvio_session || request.cookies?.session);
    const authHeader = request.headers.authorization;

    // If using cookie auth for a state mutation (and no explicit Bearer auth), enforce origin/referer verification
    if (isMutation && hasAuthCookie && !authHeader) {
      let origin = request.headers.origin;
      if (!origin && request.headers.referer) {
        try {
          origin = new URL(request.headers.referer).origin;
        } catch {
          // Invalid Referer format
        }
      }

      if (!origin) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'CSRF_ORIGIN_REQUIRED',
            message: 'Cross-site request forgery protection: Origin or Referer header required for state mutations.',
          },
        });
      }

      const currentEnv: Environment =
        (process.env.NODE_ENV as Environment) === 'production' ? 'production' : 'development';
      if (!isAllowedOrigin(origin, currentEnv) && !getAllowedOrigins(currentEnv).includes(origin)) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'CSRF_ORIGIN_INVALID',
            message: 'Cross-site request forgery protection: Invalid request origin.',
          },
        });
      }
    }
  });

  // API Routes (Canonical /api/v1 Prefix)
  await fastify.register(healthRoutes);
  await fastify.register(authRoutes, { prefix: '/api/v1/auth' });
  await fastify.register(userRoutes, { prefix: '/api/v1/users' });
  await fastify.register(organizationRoutes, { prefix: '/api/v1/organizations' });
  await fastify.register(organizationRoutes, { prefix: '/api/v1/orgs' });
  await fastify.register(workspaceRoutes, { prefix: '/api/v1/workspaces' });
  await fastify.register(inventoryRoutes, { prefix: '/api/v1/inventory' });
  await fastify.register(productsRoutes, { prefix: '/api/v1/products' });
  await fastify.register(platformRoutes, { prefix: '/api/v1/platform' });
  await fastify.register(platformRoutes, { prefix: '/v1/platform' });
  await fastify.register(adminProductsRoutes, { prefix: '/api/v1/admin/products' });
  await fastify.register(billingRoutes, { prefix: '/api/v1' });
  await fastify.register(adminBillingRoutes, { prefix: '/api/v1/admin' });
  await fastify.register(adminOrganizationLimitRoutes, { prefix: '/api/v1/admin' });
  await fastify.register(adminPlatformRoutes, { prefix: '/api/v1/admin' });
  await fastify.register(adminUserRoutes, { prefix: '/api/v1/admin' });
  await fastify.register(adminWorkspaceRoutes, { prefix: '/api/v1/admin' });
  await fastify.register(adminPhoneChallengeRoutes, { prefix: '/api/v1/admin' });
  await fastify.register(adminDeletionRoutes, { prefix: '/api/v1/admin' });
  await fastify.register(adminOverrideRoutes, { prefix: '/api/v1/admin' });
  await fastify.register(adminAnalyticsRoutes, { prefix: '/api/v1/admin/analytics' });
  await fastify.register(workspaceAnalyticsRoutes, { prefix: '/api/v1' });
  await fastify.register(webhookRoutes, { prefix: '/api/v1' });
  await fastify.register(onboardingRoutes, { prefix: '/api/v1/onboarding' });
  await fastify.register(onboardingRoutes, { prefix: '/v1/onboarding' });
  await fastify.register(invitationRoutes, { prefix: '/api/v1/invitations' });
  await fastify.register(invitationRoutes, { prefix: '/api/v1/invite' });
  await fastify.register(notificationRoutes, { prefix: '/api/v1/notifications' });
  await fastify.register(locationRoutes, { prefix: '/api/v1/locations' });
  await fastify.register(receiptSettingsRoutes, { prefix: '/api/v1' });
  await fastify.register(workspaceSettingsRoutes, { prefix: '/api/v1' });
  await fastify.register(branchSettingsRoutes, { prefix: '/api/v1' });
  await fastify.register(applicationSettingsRoutes, { prefix: '/api/v1' });
  await fastify.register(entitlementRoutes, { prefix: '/api/v1/entitlements' });
  await fastify.register(clientLogsRoutes, { prefix: '/api/v1' });
  await fastify.register(batchRoutes, { prefix: '/api/v1' });
  await fastify.register(realtimeRoutes, { prefix: '/api/v1' });
  await fastify.register(jobRoutes, { prefix: '/api/v1' });
  await fastify.register(tenantContextRoute, { prefix: '/api/v1' });
  await fastify.register(inventoryStatusRoute, { prefix: '/api/v1' });

  return fastify;
}
