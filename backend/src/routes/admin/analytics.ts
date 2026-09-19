import type { FastifyPluginAsync } from 'fastify';
import { dataService } from '../../services/dataService.js';
import { AnalyticsService } from '../../services/analyticsService.js';
import { ERROR_CODES } from '../../config/constants.js';
import { requireAdmin } from '../../middleware/adminAuth.js';

export const adminAnalyticsRoutes: FastifyPluginAsync = async (fastify) => {
  // 1. GET /overview - Platform Overview Analytics
  fastify.get(
    '/overview',
    {
      preHandler: [requireAdmin({ permission: 'admin.analytics.view' })],
      schema: {
        tags: ['Superadmin Analytics'],
        summary: 'Platform-wide overview analytics and KPI summaries',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      try {
        const sessionToken = (request as any).adminSession?.sessionToken;
        const stats = await dataService.getPlatformOverviewAnalytics(sessionToken);

        // Audit sensitive view
        await dataService.logAdminAction({
          adminId: (request as any).adminUser?._id,
          action: 'analytics.overview_viewed',
          resourceType: 'analytics',
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'] as string,
          details: { endpoint: '/overview', computedAt: stats?.freshness?.computedAt },
        });

        return reply.send({
          success: true,
          data: AnalyticsService.sanitizeAnalyticsPayload(stats),
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Failed to fetch platform overview analytics.',
          },
        });
      }
    }
  );

  // 2. GET /revenue - MRR, ARR, and Revenue Analytics
  fastify.get(
    '/revenue',
    {
      preHandler: [requireAdmin({ permission: 'admin.revenue.view' })],
      schema: {
        tags: ['Superadmin Analytics'],
        summary: 'MRR, ARR, and financial subscription revenue metrics',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            startDate: { type: 'string' },
            endDate: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const sessionToken = (request as any).adminSession?.sessionToken;
        const { startDate, endDate } = (request.query || {}) as { startDate?: string; endDate?: string };
        const revenueData = await dataService.getRevenueAnalytics({ sessionToken, startDate, endDate });

        // Audit sensitive revenue view
        await dataService.logAdminAction({
          adminId: (request as any).adminUser?._id,
          action: 'analytics.revenue_viewed',
          resourceType: 'analytics',
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'] as string,
          details: { endpoint: '/revenue', startDate, endDate },
        });

        return reply.send({
          success: true,
          data: AnalyticsService.sanitizeAnalyticsPayload(revenueData),
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Failed to fetch revenue analytics.',
          },
        });
      }
    }
  );

  // 3. GET /subscriptions - Subscription Lifecycle & Churn Analytics
  fastify.get(
    '/subscriptions',
    {
      preHandler: [requireAdmin({ permission: 'admin.analytics.view' })],
      schema: {
        tags: ['Superadmin Analytics'],
        summary: 'Subscription statuses, billing intervals, and churn rates',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      try {
        const sessionToken = (request as any).adminSession?.sessionToken;
        const subData = await dataService.getSubscriptionAnalytics(sessionToken);

        await dataService.logAdminAction({
          adminId: (request as any).adminUser?._id,
          action: 'analytics.subscriptions_viewed',
          resourceType: 'analytics',
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'] as string,
          details: { endpoint: '/subscriptions' },
        });

        return reply.send({
          success: true,
          data: AnalyticsService.sanitizeAnalyticsPayload(subData),
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Failed to fetch subscription analytics.',
          },
        });
      }
    }
  );

  // 4. GET /trials - Free Trial Lifecycle & Conversion Metrics
  fastify.get(
    '/trials',
    {
      preHandler: [requireAdmin({ permission: 'admin.analytics.view' })],
      schema: {
        tags: ['Superadmin Analytics'],
        summary: 'Free trial conversion, cohort tracking, and extensions',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      try {
        const sessionToken = (request as any).adminSession?.sessionToken;
        const trialData = await dataService.getTrialAnalytics(sessionToken);

        await dataService.logAdminAction({
          adminId: (request as any).adminUser?._id,
          action: 'analytics.trials_viewed',
          resourceType: 'analytics',
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'] as string,
          details: { endpoint: '/trials' },
        });

        return reply.send({
          success: true,
          data: AnalyticsService.sanitizeAnalyticsPayload(trialData),
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Failed to fetch trial analytics.',
          },
        });
      }
    }
  );

  // 5. GET /payments - Payment Success & Failure Analytics
  fastify.get(
    '/payments',
    {
      preHandler: [requireAdmin({ permission: 'admin.analytics.view' })],
      schema: {
        tags: ['Superadmin Analytics'],
        summary: 'Payment transaction volume, success rates, and webhook telemetry',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      try {
        const sessionToken = (request as any).adminSession?.sessionToken;
        const paymentData = await dataService.getPaymentAnalytics(sessionToken);

        await dataService.logAdminAction({
          adminId: (request as any).adminUser?._id,
          action: 'analytics.payments_viewed',
          resourceType: 'analytics',
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'] as string,
          details: { endpoint: '/payments' },
        });

        return reply.send({
          success: true,
          data: AnalyticsService.sanitizeAnalyticsPayload(paymentData),
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Failed to fetch payment analytics.',
          },
        });
      }
    }
  );

  // 6. GET /entitlements - Entitlement & Limit Analytics
  fastify.get(
    '/entitlements',
    {
      preHandler: [requireAdmin({ permission: 'admin.analytics.view' })],
      schema: {
        tags: ['Superadmin Analytics'],
        summary: 'Usage thresholds, limit reached events, and active overrides',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      try {
        const sessionToken = (request as any).adminSession?.sessionToken;
        const entitlementData = await dataService.getEntitlementAnalytics(sessionToken);

        await dataService.logAdminAction({
          adminId: (request as any).adminUser?._id,
          action: 'analytics.entitlements_viewed',
          resourceType: 'analytics',
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'] as string,
          details: { endpoint: '/entitlements' },
        });

        return reply.send({
          success: true,
          data: AnalyticsService.sanitizeAnalyticsPayload(entitlementData),
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Failed to fetch entitlement analytics.',
          },
        });
      }
    }
  );

  // 7. GET /freshness - Metric Freshness Health Check
  fastify.get(
    '/freshness',
    {
      preHandler: [requireAdmin({ permission: 'admin.analytics.view' })],
      schema: {
        tags: ['Superadmin Analytics'],
        summary: 'Data freshness timestamp, timezone, and sync status',
        security: [{ bearerAuth: [] }],
      },
    },
    async (_request, reply) => {
      const freshness = AnalyticsService.evaluateFreshness(Date.now());
      return reply.send({
        success: true,
        data: freshness,
      });
    }
  );

  // 8. POST /rebuild - Idempotent Daily Aggregate Rebuild
  fastify.post(
    '/rebuild',
    {
      preHandler: [requireAdmin({ permission: 'admin.analytics.rebuild' })],
      schema: {
        tags: ['Superadmin Analytics'],
        summary: 'Rebuild daily aggregate analytics for a given date in Africa/Lagos',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { date, reason } = (request.body || {}) as { date?: string; reason?: string };
      try {
        const sessionToken = (request as any).adminSession?.sessionToken;
        const result = await dataService.rebuildDailyAnalytics({ date, sessionToken });

        await dataService.logAdminAction({
          adminId: (request as any).adminUser?._id,
          action: 'analytics.rebuild_completed',
          resourceType: 'analytics',
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'] as string,
          details: { date: result?.date, action: result?.action, reason },
        });

        return reply.send({
          success: true,
          message: `Daily analytics rebuilt successfully for ${result?.date}.`,
          data: result,
        });
      } catch (err: any) {
        await dataService.logAdminAction({
          adminId: (request as any).adminUser?._id,
          action: 'analytics.rebuild_failed',
          resourceType: 'analytics',
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'] as string,
          details: { date, error: err.message },
        });

        return reply.status(500).send({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Failed to rebuild daily analytics.',
          },
        });
      }
    }
  );

  // 9. POST /reconcile-revenue - Reconcile MRR against active paid subscriptions
  fastify.post(
    '/reconcile-revenue',
    {
      preHandler: [requireAdmin({ permission: 'admin.analytics.rebuild' })],
      schema: {
        tags: ['Superadmin Analytics'],
        summary: 'Reconcile platform MRR/ARR against subscription records',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      try {
        const sessionToken = (request as any).adminSession?.sessionToken;
        const result = await dataService.reconcileRevenueMetrics(sessionToken);

        await dataService.logAdminAction({
          adminId: (request as any).adminUser?._id,
          action: 'analytics.reconciliation_completed',
          resourceType: 'analytics',
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'] as string,
          details: { type: 'revenue', reconciledAt: result?.reconciledAt, mrr: result?.mrr },
        });

        return reply.send({
          success: true,
          message: 'Revenue metrics reconciled successfully.',
          data: result,
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Failed to reconcile revenue metrics.',
          },
        });
      }
    }
  );

  // 10. POST /export - Request Analytics Export
  fastify.post(
    '/export',
    {
      preHandler: [requireAdmin({ permission: 'admin.analytics.export' })],
      schema: {
        tags: ['Superadmin Analytics'],
        summary: 'Request export of aggregate analytics data',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['scope', 'format'],
          properties: {
            scope: { type: 'string', enum: ['platform', 'revenue', 'subscriptions', 'organization'] },
            format: { type: 'string', enum: ['csv', 'json'] },
            dateRange: {
              type: 'object',
              properties: {
                startDate: { type: 'string' },
                endDate: { type: 'string' },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { scope, format, dateRange } = request.body as {
        scope: 'platform' | 'revenue' | 'subscriptions' | 'organization';
        format: 'csv' | 'json';
        dateRange?: { startDate?: string; endDate?: string };
      };

      try {
        const exportId = `exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24-hour TTL

        await dataService.logAdminAction({
          adminId: (request as any).adminUser?._id,
          action: 'analytics.export_requested',
          resourceType: 'analytics',
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'] as string,
          details: { exportId, scope, format, dateRange },
        });

        return reply.send({
          success: true,
          data: {
            exportId,
            scope,
            format,
            status: 'completed',
            downloadUrl: `/api/v1/admin/analytics/exports/${exportId}`,
            expiresAt,
            timezone: 'Africa/Lagos',
            currency: 'NGN',
            freshness: AnalyticsService.evaluateFreshness(Date.now()),
          },
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Failed to generate analytics export.',
          },
        });
      }
    }
  );
};
