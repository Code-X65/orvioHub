import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { dataService } from '../services/dataService.js';
import { ERROR_CODES, AUDIT_EVENTS } from '../config/constants.js';

const updateReceiptSettingsSchema = z.object({
  storeName: z.string().min(1).optional(),
  tagline: z.string().optional(),
  headerText: z.string().optional(),
  footerText: z.string().optional(),
  returnPolicy: z.string().optional(),
  tin: z.string().optional(),
  vatRate: z.number().min(0).max(100).optional(),
  enableVat: z.boolean().optional(),
  showCashier: z.boolean().optional(),
  showCustomer: z.boolean().optional(),
  showBarcode: z.boolean().optional(),
  paperWidth: z.enum(['58mm', '80mm']).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  logoUrl: z.string().url().optional().or(z.literal('')),
});

export const receiptSettingsRoutes: FastifyPluginAsync = async (fastify) => {
  // All receipt settings routes require authentication
  fastify.addHook('preHandler', fastify.authenticate);

  // 1. GET receipt settings for workspace
  const getHandler = async (request: any, reply: any) => {
    const workspaceId = request.params.workspaceId || request.params.organizationId || request.params.orgId || request.params.id;
    if (!workspaceId) {
      return reply.status(400).send({
        success: false,
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Workspace or Organization ID is required' },
      });
    }

    try {
      const settings = await dataService.getReceiptSettings(workspaceId);
      return reply.send({
        success: true,
        data: { settings },
      });
    } catch (err: any) {
      fastify.log.error({ err, workspaceId }, 'Failed to fetch receipt settings');
      return reply.status(500).send({
        success: false,
        error: { code: ERROR_CODES.INTERNAL_SERVER_ERROR, message: 'Failed to retrieve receipt settings' },
      });
    }
  };

  // 2. PATCH receipt settings for workspace
  const updateHandler = async (request: any, reply: any) => {
    const workspaceId = request.params.workspaceId || request.params.organizationId || request.params.orgId || request.params.id;
    if (!workspaceId) {
      return reply.status(400).send({
        success: false,
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Workspace or Organization ID is required' },
      });
    }

    const parsed = updateReceiptSettingsSchema.safeParse(request.body);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      parsed.error.errors.forEach((e) => {
        if (e.path[0]) fields[String(e.path[0])] = e.message;
      });
      return reply.status(400).send({
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Invalid receipt settings payload',
          fields,
        },
      });
    }

    try {
      const updated = await dataService.updateReceiptSettings(workspaceId, parsed.data);

      await dataService.logAudit({
        actorUserId: request.user?.id,
        eventType: AUDIT_EVENTS.WORKSPACE_UPDATED || 'workspace.updated',
        workspaceId,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: {
          action: 'receipt_settings_updated',
          updatedFields: Object.keys(parsed.data),
        },
      });

      return reply.send({
        success: true,
        data: { settings: updated },
        message: 'Receipt settings saved successfully.',
      });
    } catch (err: any) {
      fastify.log.error({ err, workspaceId }, 'Failed to update receipt settings');
      return reply.status(500).send({
        success: false,
        error: { code: ERROR_CODES.INTERNAL_SERVER_ERROR, message: 'Failed to save receipt settings' },
      });
    }
  };

  // Register on both workspace and organization routes
  fastify.get('/workspaces/:workspaceId/settings/receipt', getHandler);
  fastify.patch('/workspaces/:workspaceId/settings/receipt', updateHandler);

  fastify.get('/organizations/:organizationId/settings/receipt', getHandler);
  fastify.patch('/organizations/:organizationId/settings/receipt', updateHandler);

  fastify.get('/orgs/:orgId/settings/receipt', getHandler);
  fastify.patch('/orgs/:orgId/settings/receipt', updateHandler);
};
