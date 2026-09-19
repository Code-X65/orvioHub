import type { FastifyPluginAsync } from 'fastify';
import { dataService } from '../../services/dataService.js';
import { entitlementService } from '../../services/entitlementService.js';
import { ERROR_CODES } from '../../config/constants.js';
import { requireAdmin } from '../../middleware/adminAuth.js';

export const adminOrganizationLimitRoutes: FastifyPluginAsync = async (fastify) => {

  // GET /api/v1/admin/users/:userId/organization-eligibility
  fastify.get(
    '/users/:userId/organization-eligibility',
    {
      preHandler: [requireAdmin({ permission: 'admin.organizations.view' })],
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
      preHandler: [requireAdmin({ permission: 'admin.organizations.view' })],
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
      preHandler: [requireAdmin({ permission: 'admin.analytics.view' })],
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
      preHandler: [requireAdmin({ permission: 'admin.audit.view' })],
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
      preHandler: [requireAdmin({ permission: 'admin.entitlements.override', sensitivity: 'sensitive' })],
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
      preHandler: [requireAdmin({ permission: 'admin.entitlements.override', sensitivity: 'sensitive' })],
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

  // GET /api/v1/admin/workspaces/:workspaceId/entitlements
  fastify.get(
    '/workspaces/:workspaceId/entitlements',
    {
      preHandler: [requireAdmin({ permission: 'admin.entitlements.view' })],
      schema: {
        tags: ['Admin Organization Limits', 'Entitlements'],
        summary: 'Inspect organization entitlement context for superadmin',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const ctx = await entitlementService.getEntitlementContext(workspaceId);
      return reply.send({
        success: true,
        data: ctx,
      });
    }
  );

  // GET /api/v1/admin/workspaces/:workspaceId/entitlements/history
  fastify.get(
    '/workspaces/:workspaceId/entitlements/history',
    {
      preHandler: [requireAdmin({ permission: 'admin.entitlements.view' })],
      schema: {
        tags: ['Admin Organization Limits', 'Entitlements'],
        summary: 'Get entitlement event history for a workspace',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      try {
        const events = await dataService.query('entitlements:getEntitlementEvents', { workspaceId });
        return reply.send({ success: true, data: { events: events || [] } });
      } catch {
        return reply.send({ success: true, data: { events: [] } });
      }
    }
  );

  // GET /api/v1/admin/workspaces/:workspaceId/entitlements/mismatches
  fastify.get(
    '/workspaces/:workspaceId/entitlements/mismatches',
    {
      preHandler: [requireAdmin({ permission: 'admin.entitlements.view' })],
      schema: {
        tags: ['Admin Organization Limits', 'Entitlements'],
        summary: 'Detect entitlement mismatches for a workspace',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      try {
        const res = await dataService.query('entitlements:detectEntitlementMismatches', { workspaceId });
        return reply.send({ success: true, data: res });
      } catch {
        return reply.send({ success: true, data: { mismatchesCount: 0, mismatches: [] } });
      }
    }
  );

  // POST /api/v1/admin/workspaces/:workspaceId/entitlements/recalculate
  fastify.post(
    '/workspaces/:workspaceId/entitlements/recalculate',
    {
      preHandler: [requireAdmin({ permission: 'admin.entitlements.recalculate', sensitivity: 'sensitive' })],
      schema: {
        tags: ['Admin Organization Limits', 'Entitlements'],
        summary: 'Superadmin recalculation of workspace entitlements',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
        body: {
          type: 'object',
          properties: { reason: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const body = (request.body || {}) as any;
      const res = await entitlementService.recalculate(workspaceId, request.user.id, body.reason || 'Superadmin recalculation');
      return reply.send({
        success: true,
        data: res,
      });
    }
  );

  // POST /api/v1/admin/workspaces/:workspaceId/entitlement-overrides
  fastify.post(
    '/workspaces/:workspaceId/entitlement-overrides',
    {
      preHandler: [requireAdmin({ permission: 'admin.entitlements.override', sensitivity: 'sensitive' })],
      schema: {
        tags: ['Admin Organization Limits', 'Entitlements'],
        summary: 'Create custom entitlement override for workspace',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
        body: {
          type: 'object',
          required: ['featureKey', 'reason'],
          properties: {
            featureKey: { type: 'string' },
            productKey: { type: 'string' },
            overrideType: { type: 'string', enum: ['grant', 'increase', 'disable', 'restrict'] },
            limitType: { type: 'string', enum: ['boolean', 'fixed', 'unlimited'] },
            limitValue: { type: 'number' },
            reason: { type: 'string' },
            expiresAt: { type: 'number' },
          },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const body = request.body as any;
      const res = await entitlementService.applyOverride(workspaceId, {
        featureKey: body.featureKey,
        productKey: body.productKey,
        overrideType: body.overrideType || 'increase',
        limitType: body.limitType || 'fixed',
        limitValue: body.limitValue,
        reason: body.reason,
        createdByAdminId: request.user.id,
        expiresAt: body.expiresAt,
      });
      return reply.send({
        success: true,
        data: res,
      });
    }
  );

  // PATCH /api/v1/admin/entitlement-overrides/:overrideId
  fastify.patch(
    '/entitlement-overrides/:overrideId',
    {
      preHandler: [requireAdmin({ permission: 'admin.entitlements.override', sensitivity: 'sensitive' })],
      schema: {
        tags: ['Admin Organization Limits', 'Entitlements'],
        summary: 'Update entitlement override',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['overrideId'],
          properties: { overrideId: { type: 'string' } },
        },
        body: {
          type: 'object',
          properties: {
            limitValue: { type: 'number' },
            expiresAt: { type: 'number' },
            reason: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { overrideId } = request.params as { overrideId: string };
      const body = (request.body || {}) as any;
      try {
        const res = await dataService.mutate('entitlements:updateEntitlementOverride', {
          overrideId: overrideId as any,
          limitValue: body.limitValue,
          expiresAt: body.expiresAt,
          reason: body.reason,
        });
        return reply.send({ success: true, data: res });
      } catch (err: any) {
        return reply.status(500).send({ success: false, error: { code: 'UPDATE_FAILED', message: err.message } });
      }
    }
  );

  // POST /api/v1/admin/entitlement-overrides/:overrideId/revoke
  fastify.post(
    '/entitlement-overrides/:overrideId/revoke',
    {
      preHandler: [requireAdmin({ permission: 'admin.entitlements.override', sensitivity: 'sensitive' })],
      schema: {
        tags: ['Admin Organization Limits', 'Entitlements'],
        summary: 'Revoke an administrative entitlement override',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['overrideId'],
          properties: { overrideId: { type: 'string' } },
        },
        body: {
          type: 'object',
          properties: {
            reason: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { overrideId } = request.params as { overrideId: string };
      const body = (request.body || {}) as any;
      const res = await entitlementService.removeOverride('', overrideId, request.user.id, body.reason || 'Admin revoked');
      return reply.send({
        success: true,
        data: res,
      });
    }
  );
};
