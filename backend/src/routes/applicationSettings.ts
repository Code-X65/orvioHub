import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { dataService } from '../services/dataService.js';
import { ERROR_CODES } from '../config/constants.js';

const updateAppSettingSchema = z.object({
  displayName: z.string().optional(),
  settings: z.record(z.any()),
});

export const applicationSettingsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate);

  // 1. List Workspace Applications
  fastify.get('/workspaces/:workspaceId/applications', async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    try {
      const apps = await dataService.listWorkspaceApplications(workspaceId);
      return reply.send({ success: true, data: { applications: apps } });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: { code: ERROR_CODES.INTERNAL_SERVER_ERROR, message: err.message },
      });
    }
  });

  // 2. Get Application Settings
  fastify.get('/workspaces/:workspaceId/applications/:productKey/settings', async (request, reply) => {
    const { workspaceId, productKey } = request.params as { workspaceId: string; productKey: string };
    try {
      const appSettings = await dataService.getApplicationSettings(workspaceId, productKey);
      return reply.send({ success: true, data: { application: appSettings } });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: { code: ERROR_CODES.INTERNAL_SERVER_ERROR, message: err.message },
      });
    }
  });

  // 3. Update Application Settings
  fastify.patch('/workspaces/:workspaceId/applications/:productKey/settings', async (request, reply) => {
    const { workspaceId, productKey } = request.params as { workspaceId: string; productKey: string };
    const parsed = updateAppSettingSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Invalid payload' },
      });
    }
    try {
      await dataService.updateApplicationSettings(
        workspaceId,
        productKey,
        parsed.data.settings,
        request.user.id,
        parsed.data.displayName
      );
      const updated = await dataService.getApplicationSettings(workspaceId, productKey);
      return reply.send({
        success: true,
        data: { application: updated },
        message: 'Application settings saved successfully.',
      });
    } catch (err: any) {
      return reply.status(400).send({
        success: false,
        error: { code: 'UPDATE_FAILED', message: err.message },
      });
    }
  });

  // 4. Activate Application
  fastify.post('/workspaces/:workspaceId/applications/:productKey/activate', async (request, reply) => {
    const { workspaceId, productKey } = request.params as { workspaceId: string; productKey: string };
    try {
      const result = await dataService.setApplicationStatus(workspaceId, productKey, 'activate', request.user.id);
      return reply.send({ success: true, data: result, message: `${productKey} activated successfully.` });
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: { code: 'ACTION_FAILED', message: err.message } });
    }
  });

  // 5. Deactivate Application
  fastify.post('/workspaces/:workspaceId/applications/:productKey/deactivate', async (request, reply) => {
    const { workspaceId, productKey } = request.params as { workspaceId: string; productKey: string };
    try {
      const result = await dataService.setApplicationStatus(workspaceId, productKey, 'deactivate', request.user.id);
      return reply.send({ success: true, data: result, message: `${productKey} deactivated.` });
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: { code: 'ACTION_FAILED', message: err.message } });
    }
  });

  // 6. Suspend Application
  fastify.post('/workspaces/:workspaceId/applications/:productKey/suspend', async (request, reply) => {
    const { workspaceId, productKey } = request.params as { workspaceId: string; productKey: string };
    try {
      const result = await dataService.setApplicationStatus(workspaceId, productKey, 'suspend', request.user.id);
      return reply.send({ success: true, data: result, message: `${productKey} access suspended.` });
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: { code: 'ACTION_FAILED', message: err.message } });
    }
  });

  // 7. Restore Application
  fastify.post('/workspaces/:workspaceId/applications/:productKey/restore', async (request, reply) => {
    const { workspaceId, productKey } = request.params as { workspaceId: string; productKey: string };
    try {
      const result = await dataService.setApplicationStatus(workspaceId, productKey, 'restore', request.user.id);
      return reply.send({ success: true, data: result, message: `${productKey} access restored.` });
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: { code: 'ACTION_FAILED', message: err.message } });
    }
  });

  // Organization Aliases
  fastify.get('/organizations/:organizationId/applications/:productKey/settings', async (request, reply) => {
    const { organizationId, productKey } = request.params as { organizationId: string; productKey: string };
    const appSettings = await dataService.getApplicationSettings(organizationId, productKey);
    return reply.send({ success: true, data: { application: appSettings } });
  });

  fastify.patch('/organizations/:organizationId/applications/:productKey/settings', async (request, reply) => {
    const { organizationId, productKey } = request.params as { organizationId: string; productKey: string };
    await dataService.updateApplicationSettings(organizationId, productKey, (request.body as any)?.settings, request.user.id);
    const updated = await dataService.getApplicationSettings(organizationId, productKey);
    return reply.send({ success: true, data: { application: updated } });
  });
};
