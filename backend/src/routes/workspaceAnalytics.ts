import type { FastifyPluginAsync } from 'fastify';
import { dataService } from '../services/dataService.js';
import { AnalyticsService } from '../services/analyticsService.js';
import { ERROR_CODES } from '../config/constants.js';

export const workspaceAnalyticsRoutes: FastifyPluginAsync = async (fastify) => {
  // Helper to verify tenant membership and permissions
  async function verifyWorkspaceAccess(request: any, workspaceId: string, requireBillingRole: boolean = false) {
    const user = request.user;
    const userId = user?.userId || user?.id || user?.sub;
    if (!userId) {
      const err: any = new Error('Authentication required.');
      err.statusCode = 401;
      err.code = ERROR_CODES.UNAUTHORIZED;
      throw err;
    }

    const memberships = await dataService.getUserWorkspaces(userId);
    const membership = memberships.find(
      (m: any) =>
        (m.workspaceId && m.workspaceId.toString() === workspaceId) ||
        (m.workspace && (m.workspace.id?.toString() === workspaceId || m.workspace.workspaceId?.toString() === workspaceId))
    );

    if (!membership) {
      // Check if user is owner of workspace directly
      const ws: any = await dataService.getWorkspaceById(workspaceId);
      if (!ws || (ws.ownerId?.toString() !== userId.toString() && ws.ownerUserId?.toString() !== userId.toString())) {
        const err: any = new Error('Access denied to workspace.');
        err.statusCode = 403;
        err.code = ERROR_CODES.FORBIDDEN;
        throw err;
      }
      return { role: 'OWNER' };
    }

    const role = (membership.role || 'MEMBER').toUpperCase();
    if (requireBillingRole && role !== 'OWNER' && role !== 'ADMIN') {
      const err: any = new Error('Ordinary members cannot access workspace billing analytics.');
      err.statusCode = 403;
      err.code = ERROR_CODES.FORBIDDEN;
      throw err;
    }

    return { role };
  }

  // 1. GET /api/v1/workspaces/:workspaceId/analytics/usage
  fastify.get(
    '/workspaces/:workspaceId/analytics/usage',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Tenant Analytics'],
        summary: 'Organization branch, member, and app usage analytics',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: {
            workspaceId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      try {
        await verifyWorkspaceAccess(request, workspaceId, false);
        const data = await dataService.getOrganizationAnalytics(workspaceId);

        return reply.send({
          success: true,
          data: AnalyticsService.sanitizeAnalyticsPayload({
            workspaceId,
            usage: data?.usage,
            plan: {
              key: data?.plan?.key,
              trialDaysRemaining: data?.plan?.trialDaysRemaining,
              isTrial: data?.plan?.isTrial,
            },
            freshness: data?.freshness,
          }),
        });
      } catch (err: any) {
        return reply.status(err.statusCode || 500).send({
          success: false,
          error: {
            code: err.code || ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Failed to fetch organization usage analytics.',
          },
        });
      }
    }
  );

  // 2. GET /api/v1/workspaces/:workspaceId/analytics/billing
  fastify.get(
    '/workspaces/:workspaceId/analytics/billing',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Tenant Analytics'],
        summary: 'Organization plan, subscription status, and payment summary (Owner/Admin only)',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: {
            workspaceId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      try {
        await verifyWorkspaceAccess(request, workspaceId, true);
        const data = await dataService.getOrganizationAnalytics(workspaceId);

        return reply.send({
          success: true,
          data: AnalyticsService.sanitizeAnalyticsPayload({
            workspaceId,
            plan: data?.plan,
            payments: data?.payments,
            freshness: data?.freshness,
          }),
        });
      } catch (err: any) {
        return reply.status(err.statusCode || 500).send({
          success: false,
          error: {
            code: err.code || ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Failed to fetch organization billing analytics.',
          },
        });
      }
    }
  );

  // 3. GET /api/v1/workspaces/:workspaceId/analytics/setup
  fastify.get(
    '/workspaces/:workspaceId/analytics/setup',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Tenant Analytics'],
        summary: 'Demo setup completion and activation status',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: {
            workspaceId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      try {
        await verifyWorkspaceAccess(request, workspaceId, false);
        const data = await dataService.getOrganizationAnalytics(workspaceId);

        return reply.send({
          success: true,
          data: AnalyticsService.sanitizeAnalyticsPayload({
            workspaceId,
            setup: {
              inventoryActivated: data?.usage?.inventory?.activated,
              setupCompleted: data?.usage?.inventory?.setupCompleted,
              demoBranchCount: data?.usage?.branches?.current,
              memberCount: data?.usage?.members?.current,
            },
            freshness: data?.freshness,
          }),
        });
      } catch (err: any) {
        return reply.status(err.statusCode || 500).send({
          success: false,
          error: {
            code: err.code || ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Failed to fetch setup analytics.',
          },
        });
      }
    }
  );
};
