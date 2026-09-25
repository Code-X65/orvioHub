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
      const apps = await dataService.query('workspaceApplications:getWorkspaceApplications', {
        workspaceId,
        userId: request.user.id as any,
      });

      if (!apps || (Array.isArray(apps) && apps.length === 0)) {
        return reply.status(403).send({
          success: false,
          error: {
            code: ERROR_CODES.FORBIDDEN,
            message: 'You do not have permission to view applications in this workspace.',
          },
        });
      }

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
  const updateSettingsHandler = async (request: any, reply: any) => {
    const { workspaceId, productKey } = request.params as { workspaceId: string; productKey: string };
    const body = request.body || {};
    const settingsPayload = body.settings ? body.settings : body;

    // Filter scoped application settings
    const cleanSettings: Record<string, any> = {};
    if (settingsPayload.productConfig) cleanSettings.productConfig = settingsPayload.productConfig;
    if (settingsPayload.stockRules) {
      const { negativeStockAllowed, lowStockThreshold, ...appStockRules } = settingsPayload.stockRules;
      cleanSettings.stockRules = appStockRules;
    }
    if (settingsPayload.salesRules) cleanSettings.salesRules = settingsPayload.salesRules;
    if (settingsPayload.roleTemplates) cleanSettings.roleTemplates = settingsPayload.roleTemplates;

    // Preserve any custom cross-branch app keys
    for (const [k, v] of Object.entries(settingsPayload)) {
      if (k !== 'receiptSettings' && k !== 'negativeStockAllowed' && k !== 'lowStockThreshold' && !cleanSettings[k]) {
        cleanSettings[k] = v;
      }
    }

    try {
      // Data migration: if receiptSettings or branch-scoped stock rules were sent, migrate to primary branch
      if (settingsPayload.receiptSettings || settingsPayload.stockRules?.negativeStockAllowed !== undefined || settingsPayload.stockRules?.lowStockThreshold !== undefined) {
        try {
          const branches = await dataService.getBranches(workspaceId, request.user.id).catch(() => []);
          const primaryBranch = Array.isArray(branches) ? branches.find((b: any) => b.isPrimary) || branches[0] : null;
          if (primaryBranch) {
            const branchId = primaryBranch._id || primaryBranch.id;
            const branchMigrateUpdates: Record<string, any> = {};
            if (settingsPayload.receiptSettings) {
              const r = settingsPayload.receiptSettings;
              if (r.paperWidth) branchMigrateUpdates.paperWidth = r.paperWidth;
              if (r.tin) branchMigrateUpdates.tin = r.tin;
              if (r.vatRate !== undefined) branchMigrateUpdates.vatRate = r.vatRate;
              if (r.enableVat !== undefined) branchMigrateUpdates.enableVat = r.enableVat;
              if (r.showCashier !== undefined) branchMigrateUpdates.showCashier = r.showCashier;
              if (r.showCustomer !== undefined) branchMigrateUpdates.showCustomer = r.showCustomer;
              if (r.showBarcode !== undefined) branchMigrateUpdates.showBarcode = r.showBarcode;
              if (r.headerText) branchMigrateUpdates.headerText = r.headerText;
              if (r.footerMessage || r.receiptFooter) branchMigrateUpdates.footerMessage = r.footerMessage || r.receiptFooter;
              if (r.returnPolicy) branchMigrateUpdates.returnPolicy = r.returnPolicy;
              if (r.receiptPrefix) branchMigrateUpdates.receiptPrefix = r.receiptPrefix;
              if (r.tagline) branchMigrateUpdates.tagline = r.tagline;
            }
            if (settingsPayload.stockRules?.negativeStockAllowed !== undefined) {
              branchMigrateUpdates.negativeStockAllowed = settingsPayload.stockRules.negativeStockAllowed;
            }
            if (settingsPayload.stockRules?.lowStockThreshold !== undefined) {
              branchMigrateUpdates.lowStockThreshold = settingsPayload.stockRules.lowStockThreshold;
            }

            if (Object.keys(branchMigrateUpdates).length > 0) {
              await dataService.updateBranchOperationalSettings(branchId, branchMigrateUpdates, request.user.id, workspaceId).catch(() => null);
            }
          }
        } catch {}
      }

      await dataService.updateApplicationSettings(
        workspaceId,
        productKey,
        cleanSettings,
        request.user.id,
        body.displayName
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
  };

  fastify.patch('/workspaces/:workspaceId/applications/:productKey/settings', updateSettingsHandler);
  fastify.patch('/organizations/:workspaceId/applications/:productKey/settings', updateSettingsHandler);
  fastify.get('/organizations/:workspaceId/applications/:productKey/settings', async (request, reply) => {
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
    const app = await dataService.getPlatformApplication(productKey);
    if (app?.isCore) {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'CORE_APP_PROTECTED',
          message: `${app.name} is a core application and cannot be deactivated.`,
        },
      });
    }
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
};

