import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { dataService } from '../services/dataService.js';
import { ERROR_CODES } from '../config/constants.js';

const getNotificationsQuerySchema = z.object({
  status: z.enum(['UNREAD', 'READ', 'ARCHIVED']).optional(),
  type: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
});

const acceptInviteSchema = z.object({
  inviteId: z.string().min(1),
  inviteType: z.enum(['organization', 'workspace']).optional().default('organization'),
  notificationId: z.string().optional(),
});

const declineInviteSchema = z.object({
  inviteId: z.string().min(1),
  inviteType: z.enum(['organization', 'workspace']).optional().default('organization'),
  notificationId: z.string().optional(),
});

export const notificationRoutes: FastifyPluginAsync = async (fastify) => {
  // All notification routes require authentication
  fastify.addHook('preHandler', fastify.authenticate);

  // GET /api/v1/notifications - List user's notifications
  fastify.get(
    '/',
    {
      schema: {
        tags: ['Notifications'],
        summary: 'Get notifications for the authenticated user',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['UNREAD', 'READ', 'ARCHIVED'] },
            type: { type: 'string' },
            limit: { type: 'number' },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = getNotificationsQuerySchema.safeParse(request.query);
      const options = parsed.success ? parsed.data : undefined;
      const notifications = await dataService.getNotificationsForUser(
        request.user.id,
        options
      );

      return reply.send({
        success: true,
        data: {
          notifications,
        },
      });
    }
  );

  // GET /api/v1/notifications/unread-count - Unread count for badge
  fastify.get(
    '/unread-count',
    {
      schema: {
        tags: ['Notifications'],
        summary: 'Get unread notification count for badge',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const count = await dataService.getUnreadNotificationCount(request.user.id);
      return reply.send({
        success: true,
        data: {
          count,
        },
      });
    }
  );

  // GET /api/v1/notifications/pending-invites - Get pending invites for current user
  fastify.get(
    '/pending-invites',
    {
      schema: {
        tags: ['Notifications'],
        summary: 'Get pending invitations for the authenticated user',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const invites = await dataService.getPendingInvitesForUser(request.user.id);
      return reply.send({
        success: true,
        data: {
          invites,
        },
      });
    }
  );

  // POST /api/v1/notifications/:id/read - Mark single notification as read
  fastify.post(
    '/:id/read',
    {
      schema: {
        tags: ['Notifications'],
        summary: 'Mark notification as read',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        await dataService.markNotificationRead(id, request.user.id);
        return reply.send({
          success: true,
          data: { message: 'Notification marked as read' },
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: {
            code: err.code || ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Failed to mark notification as read',
          },
        });
      }
    }
  );

  // POST /api/v1/notifications/read-all - Mark all notifications as read
  fastify.post(
    '/read-all',
    {
      schema: {
        tags: ['Notifications'],
        summary: 'Mark all notifications as read',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      try {
        const result = await dataService.markAllNotificationsRead(request.user.id);
        return reply.send({
          success: true,
          data: { updatedCount: result?.count ?? 0 },
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: {
            code: err.code || ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Failed to mark all notifications as read',
          },
        });
      }
    }
  );

  // POST /api/v1/notifications/:id/archive - Archive a notification
  fastify.post(
    '/:id/archive',
    {
      schema: {
        tags: ['Notifications'],
        summary: 'Archive notification',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        await dataService.archiveNotification(id, request.user.id);
        return reply.send({
          success: true,
          data: { message: 'Notification archived' },
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: {
            code: err.code || ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Failed to archive notification',
          },
        });
      }
    }
  );

  // POST /api/v1/notifications/accept-invite - Accept invite from notification
  fastify.post(
    '/accept-invite',
    {
      schema: {
        tags: ['Notifications', 'Invitations'],
        summary: 'Accept an invitation directly from dashboard notification',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['inviteId'],
          properties: {
            inviteId: { type: 'string' },
            inviteType: { type: 'string', enum: ['organization', 'workspace'] },
            notificationId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const parseResult = acceptInviteSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: parseResult.error.errors.map((e) => e.message).join(', '),
          },
        });
      }

      const { inviteId, inviteType, notificationId } = parseResult.data;

      try {
        let result: any;
        if (inviteType === 'workspace') {
          result = await dataService.acceptWorkspaceInviteFromNotification(
            inviteId,
            request.user.id,
            notificationId
          );
        } else {
          result = await dataService.acceptInviteFromNotification(
            inviteId,
            request.user.id,
            notificationId
          );
        }

        return reply.send({
          success: true,
          data: result,
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: {
            code: err.code || 'INVITATION_ACCEPT_FAILED',
            message: err.message || 'Failed to accept invitation',
          },
        });
      }
    }
  );

  // POST /api/v1/notifications/decline-invite - Decline invite from notification
  fastify.post(
    '/decline-invite',
    {
      schema: {
        tags: ['Notifications', 'Invitations'],
        summary: 'Decline an invitation directly from dashboard notification',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['inviteId'],
          properties: {
            inviteId: { type: 'string' },
            inviteType: { type: 'string', enum: ['organization', 'workspace'] },
            notificationId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const parseResult = declineInviteSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: parseResult.error.errors.map((e) => e.message).join(', '),
          },
        });
      }

      const { inviteId, inviteType, notificationId } = parseResult.data;

      try {
        let result: any;
        if (inviteType === 'workspace') {
          result = await dataService.declineWorkspaceInviteFromNotification(
            inviteId,
            request.user.id,
            notificationId
          );
        } else {
          result = await dataService.declineInviteFromNotification(
            inviteId,
            request.user.id,
            notificationId
          );
        }

        return reply.send({
          success: true,
          data: result,
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: {
            code: err.code || 'INVITATION_DECLINE_FAILED',
            message: err.message || 'Failed to decline invitation',
          },
        });
      }
    }
  );
};
