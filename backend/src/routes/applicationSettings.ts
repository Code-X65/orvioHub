import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { dataService } from '../services/dataService.js';
import { ERROR_CODES } from '../config/constants.js';

const updateAppSettingSchema = z.object({
  displayName: z.string().optional(),
  settings: z.record(z.any()),
});

const orgAppParamSchema = z.object({
  organizationId: z.string().min(1, 'Organization ID is required'),
  productKey: z.string().min(1, 'Product key is required'),
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

  // Organization Aliases
  fastify.get(
    '/organizations/:organizationId/applications/:productKey/settings',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: {
          type: 'object',
          required: ['organizationId', 'productKey'],
          properties: {
            organizationId: { type: 'string' },
            productKey: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const parsedParams = orgAppParamSchema.safeParse(request.params);
      if (!parsedParams.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: parsedParams.error.errors[0]?.message || 'Invalid parameters',
          },
        });
      }
      const { organizationId, productKey } = parsedParams.data;

      // Verify caller belongs to this organization
      const belongs = await dataService.userBelongsToOrganization(request.user.id, organizationId);
      if (!belongs) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Access denied: You do not belong to this organization.' },
        });
      }

      try {
        const appSettings = await dataService.getApplicationSettings(organizationId, productKey);
        return reply.send({ success: true, data: { application: appSettings } });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: { code: ERROR_CODES.INTERNAL_SERVER_ERROR, message: err.message },
        });
      }
    }
  );

  fastify.patch(
    '/organizations/:organizationId/applications/:productKey/settings',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: {
          type: 'object',
          required: ['organizationId', 'productKey'],
          properties: {
            organizationId: { type: 'string' },
            productKey: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const parsedParams = orgAppParamSchema.safeParse(request.params);
      if (!parsedParams.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: parsedParams.error.errors[0]?.message || 'Invalid parameters',
          },
        });
      }
      const { organizationId, productKey } = parsedParams.data;

      // Verify caller belongs to this organization
      const belongs = await dataService.userBelongsToOrganization(request.user.id, organizationId);
      if (!belongs) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Access denied: You do not belong to this organization.' },
        });
      }

      const parsedBody = updateAppSettingSchema.safeParse(request.body);
      if (!parsedBody.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: parsedBody.error.errors[0]?.message || 'Invalid settings payload',
          },
        });
      }

      try {
        await dataService.updateApplicationSettings(
          organizationId,
          productKey,
          parsedBody.data.settings,
          request.user.id
        );
        const updated = await dataService.getApplicationSettings(organizationId, productKey);
        return reply.send({ success: true, data: { application: updated } });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: { code: ERROR_CODES.INTERNAL_SERVER_ERROR, message: err.message },
        });
      }
    }
  );
};
