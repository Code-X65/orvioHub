import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { dataService } from '../../services/dataService.js';
import { ERROR_CODES } from '../../config/constants.js';

export const adminUserRoutes: FastifyPluginAsync = async (fastify) => {
  const getAdminToken = (request: FastifyRequest) => {
    return (
      (request.headers['x-admin-session'] as string) ||
      (request.headers['x-admin-token'] as string) ||
      request.headers['authorization']?.replace(/^Bearer\s+/i, '') ||
      ''
    );
  };

  // POST /api/v1/admin/users/:userId/suspend
  fastify.post(
    '/users/:userId/suspend',
    {
      schema: {
        tags: ['Superadmin Users'],
        summary: 'Suspend a user account and immediately revoke sessions',
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
            reason: {
              type: 'string',
              enum: [
                'payment_failure',
                'policy_violation',
                'security_concern',
                'fraud_suspected',
                'other',
              ],
            },
            notes: { type: 'string' },
            revokeAllSessions: { type: 'boolean' },
          },
        },
      },
    },
    async (request, reply) => {
      const { userId } = request.params as { userId: string };
      const body = (request.body as any) || {};
      const token = getAdminToken(request);

      try {
        const result = await dataService.adminSuspendUser(
          token,
          userId,
          body.reason,
          body.notes
        );
        return reply.send({
          success: true,
          message: 'User account has been suspended and active sessions revoked.',
          data: result,
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: err.message || 'Failed to suspend user.',
          },
        });
      }
    }
  );

  // POST /api/v1/admin/users/:userId/restore
  fastify.post(
    '/users/:userId/restore',
    {
      schema: {
        tags: ['Superadmin Users'],
        summary: 'Restore a suspended user account',
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
      const token = getAdminToken(request);

      try {
        const result = await dataService.adminRestoreUser(token, userId);
        return reply.send({
          success: true,
          message: 'User account has been reactivated successfully.',
          data: result,
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: err.message || 'Failed to restore user.',
          },
        });
      }
    }
  );

  // GET /api/v1/admin/users/:userId/suspension-history
  fastify.get(
    '/users/:userId/suspension-history',
    {
      schema: {
        tags: ['Superadmin Users'],
        summary: 'Get historical audit logs of user suspension and restoration',
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
      const token = getAdminToken(request);

      try {
        const history = await dataService.adminGetUserSuspensionHistory(token, userId);
        return reply.send({
          success: true,
          data: { history },
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: err.message || 'Failed to retrieve suspension history.',
          },
        });
      }
    }
  );

  // POST /api/v1/admin/users/:userId/delete
  fastify.post(
    '/users/:userId/delete',
    {
      schema: {
        tags: ['Superadmin Users'],
        summary: 'Delete user account with pre-checks and optional 7-day grace period',
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
            reason: { type: 'string' },
            notes: { type: 'string' },
            transferWorkspaceOwnership: { type: 'boolean' },
            newOwnerId: { type: 'string' },
            cancelSubscriptions: { type: 'boolean' },
            adminForceDelete: { type: 'boolean' },
          },
        },
      },
    },
    async (request, reply) => {
      const { userId } = request.params as { userId: string };
      const body = (request.body as any) || {};
      const token = getAdminToken(request);

      try {
        const result = await dataService.adminDeleteUser(token, userId, {
          reason: body.reason,
          notes: body.notes,
          transferWorkspaceOwnership: body.transferWorkspaceOwnership,
          newOwnerId: body.newOwnerId,
          cancelSubscriptions: body.cancelSubscriptions,
          adminForceDelete: body.adminForceDelete ?? false,
        });

        return reply.send({
          success: true,
          message: body.adminForceDelete
            ? 'User permanently force-deleted per NDPA policy.'
            : 'User deletion scheduled with 7-day grace period.',
          data: result,
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: err.message || 'Failed to delete user.',
          },
        });
      }
    }
  );

  // POST /api/v1/admin/users/:userId/delete/force
  fastify.post(
    '/users/:userId/delete/force',
    {
      schema: {
        tags: ['Superadmin Users'],
        summary: 'Immediately force-delete user account (bypasses grace period)',
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
            reason: { type: 'string' },
            notes: { type: 'string' },
            transferWorkspaceOwnership: { type: 'boolean' },
            newOwnerId: { type: 'string' },
            cancelSubscriptions: { type: 'boolean' },
          },
        },
      },
    },
    async (request, reply) => {
      const { userId } = request.params as { userId: string };
      const body = (request.body as any) || {};
      const token = getAdminToken(request);

      try {
        const result = await dataService.adminDeleteUser(token, userId, {
          reason: body.reason || 'Emergency administrative deletion',
          notes: body.notes,
          transferWorkspaceOwnership: body.transferWorkspaceOwnership,
          newOwnerId: body.newOwnerId,
          cancelSubscriptions: body.cancelSubscriptions,
          adminForceDelete: true,
        });

        return reply.send({
          success: true,
          message: 'User permanently force-deleted immediately.',
          data: result,
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: err.message || 'Failed to force-delete user.',
          },
        });
      }
    }
  );

  // POST /api/v1/admin/users/:userId/phone/unlink
  fastify.post(
    '/users/:userId/phone/unlink',
    {
      schema: {
        tags: ['Superadmin Users'],
        summary: 'Administratively unlink/reset user phone number',
        params: {
          type: 'object',
          required: ['userId'],
          properties: {
            userId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['reason'],
          properties: {
            reason: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { userId } = request.params as { userId: string };
      const body = (request.body as { reason: string }) || { reason: 'Admin phone reset' };
      const token = getAdminToken(request);

      try {
        const result = await dataService.adminUnlinkUserPhone(token, userId, body.reason);
        return reply.send({
          success: true,
          message: 'User phone unlinked successfully.',
          data: result,
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: err.message || 'Failed to unlink user phone.',
          },
        });
      }
    }
  );

  // POST /api/v1/admin/users/:userId/phone/mark-verified
  fastify.post(
    '/users/:userId/phone/mark-verified',
    {
      schema: {
        tags: ['Superadmin Users'],
        summary: 'Administratively mark a user phone as verified',
        params: {
          type: 'object',
          required: ['userId'],
          properties: {
            userId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['reason'],
          properties: {
            reason: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { userId } = request.params as { userId: string };
      const body = (request.body as { reason: string }) || { reason: 'Administrative verification override' };
      const token = getAdminToken(request);

      try {
        const result = await dataService.adminOverrideUserPhoneVerified(token, userId, body.reason);
        return reply.send({
          success: true,
          message: 'User phone marked as verified.',
          data: result,
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: err.message || 'Failed to mark user phone as verified.',
          },
        });
      }
    }
  );
};

export default adminUserRoutes;
