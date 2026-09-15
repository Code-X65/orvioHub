import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { dataService } from '../services/dataService.js';
import { ERROR_CODES } from '../config/constants.js';

const updateBranchSettingsSchema = z.object({
  openingHours: z.record(z.any()).optional(),
  receiptFooter: z.string().optional(),
  negativeStockAllowed: z.boolean().optional(),
  lowStockThreshold: z.number().optional(),
});

export const branchSettingsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate);

  // 1. GET Branch Details with Operational Settings
  fastify.get('/workspaces/:workspaceId/branches/:branchId/settings', async (request, reply) => {
    const { branchId } = request.params as { workspaceId: string; branchId: string };
    try {
      const branchSettings = await dataService.getFullBranchSettings(branchId);
      if (!branchSettings) {
        return reply.status(404).send({
          success: false,
          error: { code: 'BRANCH_NOT_FOUND', message: 'Branch not found' },
        });
      }
      return reply.send({ success: true, data: { branch: branchSettings } });
    } catch (err: any) {
      fastify.log.error({ err, branchId }, 'Failed to fetch branch settings');
      return reply.status(500).send({
        success: false,
        error: { code: ERROR_CODES.INTERNAL_SERVER_ERROR, message: err.message },
      });
    }
  });

  // 2. PATCH Branch Operational Settings
  fastify.patch('/workspaces/:workspaceId/branches/:branchId/settings', async (request, reply) => {
    const { branchId } = request.params as { workspaceId: string; branchId: string };
    const parsed = updateBranchSettingsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Invalid branch settings payload' },
      });
    }
    try {
      await dataService.updateBranchOperationalSettings(branchId, parsed.data, request.user.id);
      const updated = await dataService.getFullBranchSettings(branchId);
      return reply.send({
        success: true,
        data: { branch: updated },
        message: 'Branch operational settings updated successfully.',
      });
    } catch (err: any) {
      return reply.status(400).send({
        success: false,
        error: { code: 'UPDATE_FAILED', message: err.message },
      });
    }
  });

  // 3. Set Primary Branch
  fastify.post('/workspaces/:workspaceId/branches/:branchId/set-primary', async (request, reply) => {
    const { branchId } = request.params as { workspaceId: string; branchId: string };
    try {
      await dataService.setPrimaryBranch(branchId, request.user.id);
      return reply.send({ success: true, message: 'Branch set as primary successfully.' });
    } catch (err: any) {
      return reply.status(400).send({
        success: false,
        error: { code: 'ACTION_FAILED', message: err.message },
      });
    }
  });

  // 4. Suspend Branch
  fastify.post('/workspaces/:workspaceId/branches/:branchId/suspend', async (request, reply) => {
    const { branchId } = request.params as { workspaceId: string; branchId: string };
    try {
      await dataService.suspendBranch(branchId, request.user.id);
      return reply.send({ success: true, message: 'Branch suspended successfully.' });
    } catch (err: any) {
      return reply.status(400).send({
        success: false,
        error: { code: 'ACTION_FAILED', message: err.message },
      });
    }
  });

  // 5. Restore Branch
  fastify.post('/workspaces/:workspaceId/branches/:branchId/restore', async (request, reply) => {
    const { branchId } = request.params as { workspaceId: string; branchId: string };
    try {
      await dataService.restoreBranch(branchId, request.user.id);
      return reply.send({ success: true, message: 'Branch restored successfully.' });
    } catch (err: any) {
      return reply.status(400).send({
        success: false,
        error: { code: 'ACTION_FAILED', message: err.message },
      });
    }
  });

  // 6. Archive Branch
  fastify.post('/workspaces/:workspaceId/branches/:branchId/archive', async (request, reply) => {
    const { branchId } = request.params as { workspaceId: string; branchId: string };
    try {
      await dataService.archiveBranch(branchId, request.user.id);
      return reply.send({ success: true, message: 'Branch archived successfully.' });
    } catch (err: any) {
      return reply.status(400).send({
        success: false,
        error: { code: 'ARCHIVE_FAILED', message: err.message },
      });
    }
  });

  // Organization Aliases
  fastify.get('/organizations/:organizationId/branches/:branchId/settings', async (request, reply) => {
    const { branchId } = request.params as { organizationId: string; branchId: string };
    const branchSettings = await dataService.getFullBranchSettings(branchId);
    return reply.send({ success: true, data: { branch: branchSettings } });
  });

  fastify.patch('/organizations/:organizationId/branches/:branchId/settings', async (request, reply) => {
    const { branchId } = request.params as { organizationId: string; branchId: string };
    await dataService.updateBranchOperationalSettings(branchId, request.body, request.user.id);
    const updated = await dataService.getFullBranchSettings(branchId);
    return reply.send({ success: true, data: { branch: updated } });
  });
};
