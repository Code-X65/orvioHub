import type { FastifyPluginAsync } from 'fastify';
import { entitlementService } from '../services/entitlementService.js';
import { dataService } from '../services/dataService.js';
import { ERROR_CODES } from '../config/constants.js';

async function requireWorkspaceAccess(request: any, reply: any, workspaceId: string): Promise<boolean> {
  const userId = request.user?.id;
  if (!userId) {
    await reply.status(401).send({
      success: false,
      error: { code: ERROR_CODES.UNAUTHENTICATED, message: 'Authentication required.' },
    });
    return false;
  }

  const ws: any = await dataService.getWorkspaceById(workspaceId);
  if (!ws) {
    await reply.status(404).send({
      success: false,
      error: { code: ERROR_CODES.WORKSPACE_NOT_FOUND, message: 'Workspace not found.' },
    });
    return false;
  }

  const membership: any = await dataService.getWorkspaceMembership(workspaceId, userId);
  const memStatus = membership?.status?.toLowerCase();

  if (!membership || memStatus !== 'active') {
    await reply.status(403).send({
      success: false,
      error: { code: ERROR_CODES.WORKSPACE_ACCESS_DENIED, message: 'You do not have active access to this workspace.' },
    });
    return false;
  }

  return true;
}

export const entitlementRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate);

  // GET /v1/entitlements/can-create-workspace
  fastify.get(
    '/can-create-workspace',
    {
      schema: {
        tags: ['Entitlements'],
        summary: 'Check if current user can create another workspace',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const eligibility = await entitlementService.getOrganizationCreationEligibility(request.user.id);
      return reply.send({
        success: true,
        data: eligibility,
      });
    }
  );

  // GET /v1/entitlements/free-trial-eligibility
  fastify.get(
    '/free-trial-eligibility',
    {
      schema: {
        tags: ['Entitlements'],
        summary: 'Check if user is eligible for a Free Trial organization',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const eligibility = await entitlementService.getOrganizationCreationEligibility(request.user.id);
      return reply.send({
        success: true,
        data: {
          allowed: eligibility.freeTrial?.available ?? true,
          freeTrial: eligibility.freeTrial,
        },
      });
    }
  );

  // GET /v1/entitlements/user
  fastify.get(
    '/user',
    {
      schema: {
        tags: ['Entitlements'],
        summary: 'Get all user-level entitlements',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const eligibility = await entitlementService.getOrganizationCreationEligibility(request.user.id);
      return reply.send({
        success: true,
        data: eligibility,
      });
    }
  );

  // GET /v1/entitlements/workspace/:workspaceId
  fastify.get(
    '/workspace/:workspaceId',
    {
      schema: {
        tags: ['Entitlements'],
        summary: 'Get workspace entitlement context and limits',
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
      const allowed = await requireWorkspaceAccess(request, reply, workspaceId);
      if (!allowed) return;
      const summary = await entitlementService.getEntitlementContext(workspaceId, request.user.id);
      return reply.send({
        success: true,
        data: summary,
      });
    }
  );

  // GET /v1/entitlements/workspace/:workspaceId/usage
  fastify.get(
    '/workspace/:workspaceId/usage',
    {
      schema: {
        tags: ['Entitlements'],
        summary: 'Get workspace resource usage counters',
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
      const allowed = await requireWorkspaceAccess(request, reply, workspaceId);
      if (!allowed) return;
      const usage = await entitlementService.getUsage(workspaceId);
      return reply.send({
        success: true,
        data: usage,
      });
    }
  );

  // GET /v1/entitlements/workspace/:workspaceId/conflicts
  fastify.get(
    '/workspace/:workspaceId/conflicts',
    {
      schema: {
        tags: ['Entitlements'],
        summary: 'Get entitlement conflicts for target downgrade plan',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: {
            workspaceId: { type: 'string' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            targetPlan: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const allowed = await requireWorkspaceAccess(request, reply, workspaceId);
      if (!allowed) return;
      const { targetPlan } = request.query as { targetPlan?: string };
      const conflicts = await entitlementService.getConflicts(workspaceId, targetPlan || 'standard');
      return reply.send({
        success: true,
        data: conflicts,
      });
    }
  );

  // POST /v1/entitlements/workspace/:workspaceId/recalculate
  fastify.post(
    '/workspace/:workspaceId/recalculate',
    {
      schema: {
        tags: ['Entitlements'],
        summary: 'Recalculate workspace entitlements',
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
      const allowed = await requireWorkspaceAccess(request, reply, workspaceId);
      if (!allowed) return;
      const res = await entitlementService.recalculate(workspaceId, request.user.id, 'User initiated recalculation');
      return reply.send({
        success: true,
        data: res,
      });
    }
  );
};
