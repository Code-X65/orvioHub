import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { dataService } from '../../services/dataService.js';
import { ERROR_CODES } from '../../config/constants.js';
import { env } from '../../config/env.js';

export const adminPlatformRoutes: FastifyPluginAsync = async (fastify) => {
  const requireAdminAuth = async (request: FastifyRequest, reply: FastifyReply) => {
    await fastify.authenticate(request, reply);
    if (reply.sent) return;

    if (env.ADMIN_USER_ID && request.user?.id !== env.ADMIN_USER_ID) {
      return reply.status(403).send({
        success: false,
        error: {
          code: ERROR_CODES.PERMISSION_DENIED,
          message: 'Access forbidden. Administrator credentials required.',
        },
      });
    }
  };

  // GET /api/v1/admin/stats - High-level platform statistics
  fastify.get(
    '/stats',
    {
      preHandler: [requireAdminAuth],
      schema: {
        tags: ['Superadmin'],
        summary: 'Platform-wide statistics and metrics',
        security: [{ bearerAuth: [] }],
      },
    },
    async (_request, reply) => {
      try {
        const users = (await dataService.listUsers({ limit: 1000 })) || { users: [], total: 0 };
        const subscriptions = (await dataService.listAllSubscriptions()) || [];
        const plans = (await dataService.listPlans()) || [];

        const totalUsers = users.total || (users.users ? users.users.length : 0);
        const totalSubscriptions = subscriptions.length;
        const activeSubscriptions = subscriptions.filter((s: any) => s.status === 'active');
        
        let mrr = 0;
        for (const sub of activeSubscriptions) {
          const plan = plans.find((p: any) => p.key === sub.planKey);
          if (plan && plan.price) {
            mrr += sub.billingInterval === 'annual' ? Math.round(plan.price.annual / 12) : plan.price.monthly;
          } else if (sub.amount) {
            mrr += sub.billingInterval === 'annual' ? Math.round(sub.amount / 12) : sub.amount;
          }
        }

        return reply.send({
          success: true,
          data: {
            totalUsers,
            totalSubscriptions,
            activeSubscriptions: activeSubscriptions.length,
            trialingSubscriptions: subscriptions.filter((s: any) => s.status === 'trialing').length,
            mrr,
            currency: 'NGN',
          },
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Failed to calculate platform statistics.',
          },
        });
      }
    }
  );

  // GET /api/v1/admin/users - List users with pagination and filters
  fastify.get(
    '/users',
    {
      preHandler: [requireAdminAuth],
      schema: {
        tags: ['Superadmin'],
        summary: 'List users with search and pagination',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            search: { type: 'string' },
            limit: { type: 'number' },
            cursor: { type: 'string' },
            status: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const query = request.query as any;
      try {
        const users = await dataService.listUsers({
          search: query.search,
          limit: query.limit ? Number(query.limit) : 50,
          cursor: query.cursor,
          status: query.status,
        });

        return reply.send({
          success: true,
          data: users,
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Failed to list users.',
          },
        });
      }
    }
  );

  // PATCH /api/v1/admin/users/:userId - Suspend, activate, or update user
  fastify.patch(
    '/users/:userId',
    {
      preHandler: [requireAdminAuth],
      schema: {
        tags: ['Superadmin'],
        summary: 'Update user account status or role',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['userId'],
          properties: {
            userId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'] },
            role: { type: 'string', enum: ['user', 'superadmin', 'admin'] },
          },
        },
      },
    },
    async (request, reply) => {
      const { userId } = request.params as { userId: string };
      const body = request.body as { status?: string; role?: string };

      try {
        const updated = await dataService.updateUserStatus(userId, body.status as any);
        return reply.send({
          success: true,
          message: `User status updated to ${body.status || 'updated'}.`,
          data: { user: updated },
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: err.message || 'Failed to update user status.',
          },
        });
      }
    }
  );

  // GET /api/v1/admin/workspaces - List all workspaces across platform
  fastify.get(
    '/workspaces',
    {
      preHandler: [requireAdminAuth],
      schema: {
        tags: ['Superadmin'],
        summary: 'List workspaces across the platform',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            search: { type: 'string' },
            limit: { type: 'number' },
          },
        },
      },
    },
    async (_request, reply) => {
      try {
        const workspaces = (await dataService.listWorkspaces({})) || [];
        return reply.send({
          success: true,
          data: { workspaces },
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Failed to list workspaces.',
          },
        });
      }
    }
  );
};
export default adminPlatformRoutes;
