import type { FastifyPluginAsync } from 'fastify';
import { entitlementService } from '../../services/entitlementService.js';
import { dataService } from '../../services/dataService.js';
import { ERROR_CODES } from '../../config/constants.js';
import { requireAdmin } from '../../middleware/adminAuth.js';

export const adminOverrideRoutes: FastifyPluginAsync = async (fastify) => {

  // 1. GET /api/v1/admin/workspaces/:workspaceId/overrides
  fastify.get(
    '/workspaces/:workspaceId/overrides',
    {
      preHandler: [requireAdmin({ permission: 'admin.overrides.view' })],
      schema: {
        tags: ['Admin Overrides'],
        summary: 'List overrides for an organization / workspace',
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
            status: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const { status } = request.query as { status?: string };

      const overrides = await entitlementService.getOverrides(workspaceId, status);
      return reply.send({
        success: true,
        data: overrides,
      });
    }
  );

  // 2. POST /api/v1/admin/workspaces/:workspaceId/overrides
  fastify.post(
    '/workspaces/:workspaceId/overrides',
    {
      preHandler: [requireAdmin({ permission: 'admin.overrides.create', sensitivity: 'sensitive' })],
      schema: {
        tags: ['Admin Overrides'],
        summary: 'Create custom entitlement/billing override',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: {
            workspaceId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['overrideType', 'reason'],
          properties: {
            overrideType: { type: 'string' },
            featureKey: { type: 'string' },
            productKey: { type: 'string' },
            limitType: { type: 'string', enum: ['boolean', 'fixed', 'unlimited'] },
            limitValue: { type: 'number' },
            overrideLimitType: { type: 'string', enum: ['boolean', 'fixed', 'unlimited'] },
            overrideLimitValue: { type: 'number' },
            grantedPlanKey: { type: 'string', enum: ['standard', 'premium'] },
            extensionDays: { type: 'number' },
            grantType: { type: 'string' },
            reason: { type: 'string' },
            customerVisibleReason: { type: 'string' },
            supportTicketReference: { type: 'string' },
            externalReference: { type: 'string' },
            effectiveFrom: { type: 'number' },
            expiresAt: { type: 'number' },
            reviewAt: { type: 'number' },
            requiresApproval: { type: 'boolean' },
            status: { type: 'string', enum: ['draft', 'pending_approval', 'active'] },
            metadata: { type: 'object' },
          },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const user = request.user as any;
      const body = request.body as any;

      try {
        const result = await entitlementService.createOverride(workspaceId, {
          ...body,
          createdByAdminId: user.id || user._id,
        });

        return reply.status(201).send({
          success: true,
          data: result,
          message: result.isPendingApproval
            ? 'Override created and submitted for dual-admin approval.'
            : 'Override successfully activated.',
        });
      } catch (err: any) {
        if (err.message && err.message.includes('INVALID_EXPIRATION')) {
          return reply.status(400).send({
            success: false,
            error: {
              code: ERROR_CODES.VALIDATION_ERROR,
              message: err.message,
            },
          });
        }
        throw err;
      }
    }
  );

  // 3. POST /api/v1/admin/overrides/:overrideId/submit
  fastify.post(
    '/overrides/:overrideId/submit',
    {
      preHandler: [requireAdmin({ permission: 'admin.overrides.update' })],
      schema: {
        tags: ['Admin Overrides'],
        summary: 'Submit draft override for dual-admin approval',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['overrideId'],
          properties: {
            overrideId: { type: 'string' },
          },
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
      const user = request.user as any;
      const body = (request.body || {}) as any;

      const result = await entitlementService.submitForApproval(overrideId, user.id || user._id, body.reason);
      return reply.send({
        success: true,
        data: result,
      });
    }
  );

  // 4. POST /api/v1/admin/overrides/:overrideId/approve
  fastify.post(
    '/overrides/:overrideId/approve',
    {
      preHandler: [requireAdmin({ permission: 'admin.overrides.approve', sensitivity: 'high_risk' })],
      schema: {
        tags: ['Admin Overrides'],
        summary: 'Approve pending override (dual-admin check enforced)',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['overrideId'],
          properties: {
            overrideId: { type: 'string' },
          },
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
      const user = request.user as any;
      const body = (request.body || {}) as any;

      try {
        const result = await entitlementService.approveOverride(overrideId, user.id || user._id, body.reason);
        return reply.send({
          success: true,
          data: result,
        });
      } catch (err: any) {
        if (err.message && err.message.includes('DUAL_ADMIN_APPROVAL_REQUIRED')) {
          return reply.status(403).send({
            success: false,
            error: {
              code: 'DUAL_ADMIN_APPROVAL_REQUIRED',
              message: 'Self-approval is strictly prohibited. A distinct administrator must approve this override.',
            },
          });
        }
        throw err;
      }
    }
  );

  // 5. POST /api/v1/admin/overrides/:overrideId/reject
  fastify.post(
    '/overrides/:overrideId/reject',
    {
      preHandler: [requireAdmin({ permission: 'admin.overrides.approve' })],
      schema: {
        tags: ['Admin Overrides'],
        summary: 'Reject pending override',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['overrideId'],
          properties: {
            overrideId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['rejectionReason'],
          properties: {
            rejectionReason: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { overrideId } = request.params as { overrideId: string };
      const user = request.user as any;
      const body = request.body as { rejectionReason: string };

      const result = await entitlementService.rejectOverride(overrideId, user.id || user._id, body.rejectionReason);
      return reply.send({
        success: true,
        data: result,
      });
    }
  );

  // 6. POST /api/v1/admin/overrides/:overrideId/revoke
  fastify.post(
    '/overrides/:overrideId/revoke',
    {
      preHandler: [requireAdmin({ permission: 'admin.overrides.revoke', sensitivity: 'sensitive' })],
      schema: {
        tags: ['Admin Overrides'],
        summary: 'Revoke active override',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['overrideId'],
          properties: {
            overrideId: { type: 'string' },
          },
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
      const user = request.user as any;
      const body = (request.body || {}) as any;

      const result = await entitlementService.removeOverride('', overrideId, user.id || user._id, body.reason);
      return reply.send({
        success: true,
        data: result,
      });
    }
  );

  // 7. POST /api/v1/admin/workspaces/:workspaceId/trial-extension
  fastify.post(
    '/workspaces/:workspaceId/trial-extension',
    {
      preHandler: [requireAdmin({ permission: 'admin.trial_extensions.create', sensitivity: 'sensitive' })],
      schema: {
        tags: ['Admin Overrides'],
        summary: 'Extend organization free trial duration',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: {
            workspaceId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['additionalDays', 'reason'],
          properties: {
            additionalDays: { type: 'number', minimum: 1, maximum: 90 },
            reason: { type: 'string' },
            customerVisibleReason: { type: 'string' },
            supportTicketReference: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const user = request.user as any;
      const body = request.body as any;

      const result = await entitlementService.extendTrial({
        workspaceId,
        additionalDays: body.additionalDays,
        reason: body.reason,
        customerVisibleReason: body.customerVisibleReason,
        supportTicketReference: body.supportTicketReference,
        adminId: user.id || user._id,
      });

      return reply.send({
        success: true,
        data: result,
      });
    }
  );

  // 8. POST /api/v1/admin/workspaces/:workspaceId/manual-plan-grant
  fastify.post(
    '/workspaces/:workspaceId/manual-plan-grant',
    {
      preHandler: [requireAdmin({ permission: 'admin.manual_plan_grants.create', sensitivity: 'high_risk' })],
      schema: {
        tags: ['Admin Overrides'],
        summary: 'Grant manual plan access (e.g. pilot / support exception)',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: {
            workspaceId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['planKey', 'reason'],
          properties: {
            planKey: { type: 'string', enum: ['standard', 'premium'] },
            durationDays: { type: 'number' },
            grantType: { type: 'string' },
            reason: { type: 'string' },
            customerVisibleReason: { type: 'string' },
            supportTicketReference: { type: 'string' },
            approverAdminId: { type: 'string' },
            reviewAt: { type: 'number' },
          },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const user = request.user as any;
      const body = request.body as any;

      const result = await entitlementService.grantManualPlan({
        workspaceId,
        planKey: body.planKey,
        durationDays: body.durationDays,
        grantType: body.grantType,
        reason: body.reason,
        customerVisibleReason: body.customerVisibleReason,
        supportTicketReference: body.supportTicketReference,
        adminId: user.id || user._id,
        approverAdminId: body.approverAdminId,
        reviewAt: body.reviewAt,
      });

      return reply.status(201).send({
        success: true,
        data: result,
        message: result.isPendingApproval
          ? 'Manual plan grant submitted for dual-admin approval.'
          : 'Manual plan grant successfully activated.',
      });
    }
  );

  // 9. POST /api/v1/admin/workspaces/:workspaceId/reconcile-entitlements
  fastify.post(
    '/workspaces/:workspaceId/reconcile-entitlements',
    {
      preHandler: [requireAdmin({ permission: 'admin.entitlement_reconciliation.run' })],
      schema: {
        tags: ['Admin Overrides'],
        summary: 'Reconcile workspace overrides and recompute effective entitlements',
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
      const user = request.user as any;

      const reconcileRes = await entitlementService.reconcile(workspaceId, user.id || user._id);
      const recalculateRes = await entitlementService.recalculate(workspaceId, user.id || user._id, 'Manual admin reconciliation');

      return reply.send({
        success: true,
        data: {
          reconciled: reconcileRes,
          recalculated: recalculateRes,
        },
      });
    }
  );

  // 10. GET /api/v1/admin/overrides/history
  fastify.get(
    '/overrides/history',
    {
      preHandler: [requireAdmin({ permission: 'admin.override_history.view' })],
      schema: {
        tags: ['Admin Overrides'],
        summary: 'Get system-wide or organization override lifecycle audit history',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string' },
            limit: { type: 'number' },
          },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId, limit } = request.query as { workspaceId?: string; limit?: number };
      const history = await entitlementService.getOverrideHistory(workspaceId, limit);
      return reply.send({
        success: true,
        data: history,
      });
    }
  );

  // 11. GET /api/v1/admin/overrides/:overrideId
  fastify.get(
    '/overrides/:overrideId',
    {
      preHandler: [requireAdmin({ permission: 'admin.overrides.view' })],
      schema: {
        tags: ['Admin Overrides'],
        summary: 'Get override detail and audit trail',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['overrideId'],
          properties: {
            overrideId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { overrideId } = request.params as { overrideId: string };
      const detail = await entitlementService.getOverrideDetail(overrideId);
      if (!detail) {
        return reply.status(404).send({
          success: false,
          error: {
            code: ERROR_CODES.NOT_FOUND,
            message: 'Override not found.',
          },
        });
      }
      return reply.send({
        success: true,
        data: detail,
      });
    }
  );
};
