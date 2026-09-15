import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { dataService } from '../../services/dataService.js';
import { ERROR_CODES } from '../../config/constants.js';

const cancelDeletionSchema = z.object({
  reason: z.string().optional(),
});

const purgeImmediateSchema = z.object({
  confirmationPhrase: z.string(),
});

export const adminDeletionRoutes: FastifyPluginAsync = async (fastify) => {
  const getAdminToken = (request: FastifyRequest) => {
    return (
      (request.headers['x-admin-session'] as string) ||
      (request.headers['x-admin-token'] as string) ||
      request.headers['authorization']?.replace(/^Bearer\s+/i, '') ||
      ''
    );
  };

  // 1. GET /api/v1/admin/deletions/pending
  fastify.get('/deletions/pending', async (request, reply) => {
    try {
      const sessionToken = getAdminToken(request);
      const pending = await dataService.query('adminDeletions:listPendingOrganizationDeletions', {
        sessionToken,
      });
      return reply.send({ success: true, data: { pending: pending || [] } });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: { code: ERROR_CODES.INTERNAL_SERVER_ERROR, message: err.message },
      });
    }
  });

  // 2. POST /api/v1/admin/deletions/:workspaceId/cancel
  fastify.post('/deletions/:workspaceId/cancel', async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const parsed = cancelDeletionSchema.safeParse(request.body || {});
    try {
      const sessionToken = getAdminToken(request);
      await dataService.mutate('adminDeletions:cancelOrganizationDeletion', {
        workspaceId: workspaceId as any,
        sessionToken,
        reason: parsed.data?.reason,
      });
      return reply.send({ success: true, message: 'Organization deletion request aborted successfully.' });
    } catch (err: any) {
      return reply.status(400).send({
        success: false,
        error: { code: 'ACTION_FAILED', message: err.message },
      });
    }
  });

  // 3. POST /api/v1/admin/deletions/:workspaceId/purge
  fastify.post('/deletions/:workspaceId/purge', async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const parsed = purgeImmediateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Confirmation phrase required' },
      });
    }
    try {
      const sessionToken = getAdminToken(request);
      await dataService.mutate('adminDeletions:purgeOrganizationImmediate', {
        workspaceId: workspaceId as any,
        sessionToken,
        confirmationPhrase: parsed.data.confirmationPhrase,
      });
      return reply.send({ success: true, message: 'Organization purged immediately.' });
    } catch (err: any) {
      return reply.status(400).send({
        success: false,
        error: { code: 'PURGE_FAILED', message: err.message },
      });
    }
  });
};
