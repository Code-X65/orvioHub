import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { dataService } from '../../services/dataService.js';
import { entitlementService } from '../../services/entitlementService.js';
import { ERROR_CODES } from '../../config/constants.js';
import { env } from '../../config/env.js';

export const adminOrganizationLimitRoutes: FastifyPluginAsync = async (fastify) => {
  const requireAdmin = async (request: FastifyRequest, reply: FastifyReply) => {
    await fastify.authenticate(request, reply);
    if (reply.sent) return;

    const role = (request.user as any)?.role;
    const isSuperadmin = role === 'superadmin' || role === 'admin';
    const isEnvAdmin = env.ADMIN_USER_ID && request.user?.id === env.ADMIN_USER_ID;

    if (!isSuperadmin && !isEnvAdmin) {
      return reply.status(403).send({
        success: false,
        error: {
          code: ERROR_CODES.PERMISSION_DENIED,
          message: 'Access forbidden. Administrator privileges required.',
        },
      });
    }
  };

  // GET /api/v1/admin/users/:userId/organization-eligibility
  fastify.get(
    '/users/:userId/organization-eligibility',
    {
      preHandler: [requireAdmin],
      schema: {
        tags: ['Admin Organization Limits'],
        summary: 'Get organization creation eligibility for a user',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['userId'],
          properties: {
            userId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { userId } = request.params as { userId: string };
      const eligibility = await entitlementService.getOrganizationCreationEligibility(userId);
      return reply.send({
        success: true,
        data: eligibility,
      });
    }
  );

  // GET /api/v1/admin/users/:userId/organizations
  fastify.get(
    '/users/:userId/organizations',
    {
      preHandler: [requireAdmin],
      schema: {
        tags: ['Admin Organization Limits'],
        summary: 'Get categorized organizations (owned, joined, archived) for a specific user',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['userId'],
          properties: {
            userId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { userId } = request.params as { userId: string };
      const result = await dataService.getUserOrganizationsCategorized(userId);
      return reply.send({
        success: true,
        data: result,
      });
    }
  );

  // GET /api/v1/admin/organization-usage
  fastify.get(
    '/organization-usage',
    {
      preHandler: [requireAdmin],
      schema: {
        tags: ['Admin Organization Limits'],
        summary: 'Get system-wide organization ownership usage metrics',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const usage = await dataService.getSuperadminOrganizationUsage();
      return reply.send({
        success: true,
        data: usage,
      });
    }
  );

  // GET /api/v1/admin/organization-limit-events
  fastify.get(
    '/organization-limit-events',
    {
      preHandler: [requireAdmin],
      schema: {
        tags: ['Admin Organization Limits'],
        summary: 'Get organization limit audit and lifecycle events',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            userId: { type: 'string' },
            limit: { type: 'number' },
          },
        },
      },
    },
    async (request, reply) => {
      const query = (request.query as { userId?: string; limit?: number }) || {};
      const events = await dataService.getOrganizationLimitEvents(query.userId, query.limit);
      return reply.send({
        success: true,
        data: { events: events || [] },
      });
    }
  );

  // POST /api/v1/admin/users/:userId/organization-limit-override
  fastify.post(
    '/users/:userId/organization-limit-override',
    {
      preHandler: [requireAdmin],
      schema: {
        tags: ['Admin Organization Limits'],
        summary: 'Grant an audited custom organization limit override for a user',
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
          required: ['overrideLimit', 'reason'],
          properties: {
            overrideLimit: { type: 'number' },
            reason: { type: 'string' },
            expiresAt: { type: 'number' },
          },
        },
      },
    },
    async (request, reply) => {
      const { userId } = request.params as { userId: string };
      const { overrideLimit, reason, expiresAt } = request.body as {
        overrideLimit: number;
        reason: string;
        expiresAt?: number;
      };

      if (!reason || typeof overrideLimit !== 'number' || overrideLimit < 1) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'A valid overrideLimit (>= 1) and reason are required.',
          },
        });
      }

      await dataService.setOrganizationLimitOverride({
        userId,
        overrideLimit,
        reason,
        grantedBy: request.user?.id || 'admin',
        expiresAt,
      });

      return reply.send({
        success: true,
        message: `Organization limit override set to ${overrideLimit} for user.`,
      });
    }
  );

  // DELETE /api/v1/admin/users/:userId/organization-limit-override
  fastify.delete(
    '/users/:userId/organization-limit-override',
    {
      preHandler: [requireAdmin],
      schema: {
        tags: ['Admin Organization Limits'],
        summary: 'Remove organization limit override for a user',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['userId'],
          properties: {
            userId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { userId } = request.params as { userId: string };
      await dataService.removeOrganizationLimitOverride(userId, request.user?.id || 'admin');

      return reply.send({
        success: true,
        message: 'Organization limit override removed successfully.',
      });
    }
  );
};
