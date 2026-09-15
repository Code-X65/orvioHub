import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { dataService } from '../../services/dataService.js';
import { ERROR_CODES } from '../../config/constants.js';

export const adminWorkspaceRoutes: FastifyPluginAsync = async (fastify) => {
  const getAdminToken = (request: FastifyRequest) => {
    return (
      (request.headers['x-admin-session'] as string) ||
      (request.headers['x-admin-token'] as string) ||
      request.headers['authorization']?.replace(/^Bearer\s+/i, '') ||
      ''
    );
  };

  // POST /api/v1/admin/workspaces/:workspaceId/suspend
  fastify.post(
    '/workspaces/:workspaceId/suspend',
    {
      schema: {
        tags: ['Superadmin Workspaces'],
        summary: 'Suspend workspace and pause all product access/billing',
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: {
            workspaceId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          properties: {
            reason: {
              type: 'string',
              enum: ['payment_failure', 'policy_violation', 'fraud', 'other'],
            },
            notes: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const body = (request.body as any) || {};
      const token = getAdminToken(request);

      try {
        const result = await dataService.adminSuspendWorkspace(
          token,
          workspaceId,
          body.reason,
          body.notes
        );
        return reply.send({
          success: true,
          message: 'Workspace suspended successfully. Members have been notified.',
          data: result,
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: err.message || 'Failed to suspend workspace.',
          },
        });
      }
    }
  );

  // POST /api/v1/admin/workspaces/:workspaceId/restore
  fastify.post(
    '/workspaces/:workspaceId/restore',
    {
      schema: {
        tags: ['Superadmin Workspaces'],
        summary: 'Restore a suspended workspace',
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
      const token = getAdminToken(request);

      try {
        const result = await dataService.adminRestoreWorkspace(token, workspaceId);
        return reply.send({
          success: true,
          message: 'Workspace restored and access reactivated successfully.',
          data: result,
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: err.message || 'Failed to restore workspace.',
          },
        });
      }
    }
  );

  // POST /api/v1/admin/workspaces/:workspaceId/delete
  fastify.post(
    '/workspaces/:workspaceId/delete',
    {
      schema: {
        tags: ['Superadmin Workspaces'],
        summary: 'Delete workspace with optional 7-day grace period or immediate force delete',
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: {
            workspaceId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          properties: {
            reason: { type: 'string' },
            notes: { type: 'string' },
            cancelSubscriptions: { type: 'boolean' },
            adminForceDelete: { type: 'boolean' },
          },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const body = (request.body as any) || {};
      const token = getAdminToken(request);

      try {
        const result = await dataService.adminDeleteWorkspace(token, workspaceId, {
          reason: body.reason,
          notes: body.notes,
          cancelSubscriptions: body.cancelSubscriptions,
          adminForceDelete: body.adminForceDelete ?? false,
        });

        return reply.send({
          success: true,
          message: body.adminForceDelete
            ? 'Workspace deleted immediately per retention policy.'
            : 'Workspace deletion scheduled with 7-day grace period.',
          data: result,
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: err.message || 'Failed to delete workspace.',
          },
        });
      }
    }
  );

  // POST /api/v1/admin/workspaces/:workspaceId/delete/force
  fastify.post(
    '/workspaces/:workspaceId/delete/force',
    {
      schema: {
        tags: ['Superadmin Workspaces'],
        summary: 'Immediately force delete workspace',
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: {
            workspaceId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          properties: {
            reason: { type: 'string' },
            notes: { type: 'string' },
            cancelSubscriptions: { type: 'boolean' },
          },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const body = (request.body as any) || {};
      const token = getAdminToken(request);

      try {
        const result = await dataService.adminDeleteWorkspace(token, workspaceId, {
          reason: body.reason || 'Emergency administrative workspace deletion',
          notes: body.notes,
          cancelSubscriptions: body.cancelSubscriptions ?? true,
          adminForceDelete: true,
        });

        return reply.send({
          success: true,
          message: 'Workspace force deleted immediately.',
          data: result,
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: err.message || 'Failed to force delete workspace.',
          },
        });
      }
    }
  );

  // GET /api/v1/admin/workspaces/:workspaceId/settings
  fastify.get('/workspaces/:workspaceId/settings', async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const token = getAdminToken(request);
    try {
      const details = await dataService.query('adminOrganizations:getAdminOrganizationFullSettings', {
        workspaceId: workspaceId as any,
        sessionToken: token,
      });
      return reply.send({ success: true, data: details });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: { code: ERROR_CODES.INTERNAL_SERVER_ERROR, message: err.message },
      });
    }
  });

  // POST /api/v1/admin/workspaces/:workspaceId/transfer-ownership
  fastify.post('/workspaces/:workspaceId/transfer-ownership', async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const body = (request.body as any) || {};
    const token = getAdminToken(request);

    if (!body.newOwnerUserId || !body.reason) {
      return reply.status(400).send({
        success: false,
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'newOwnerUserId and reason are required' },
      });
    }

    try {
      await dataService.mutate('adminOrganizations:adminTransferOrganizationOwnership', {
        workspaceId: workspaceId as any,
        newOwnerUserId: body.newOwnerUserId as any,
        reason: body.reason,
        ticketNumber: body.ticketNumber,
        sessionToken: token,
      });
      return reply.send({ success: true, message: 'Organization ownership transferred successfully.' });
    } catch (err: any) {
      return reply.status(400).send({
        success: false,
        error: { code: 'TRANSFER_FAILED', message: err.message },
      });
    }
  });
};

export default adminWorkspaceRoutes;

