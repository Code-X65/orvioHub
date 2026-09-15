import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { dataService } from '../services/dataService.js';
import { ERROR_CODES } from '../config/constants.js';

const updateGeneralSchema = z.object({
  name: z.string().min(1).optional(),
  displayName: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  type: z.string().optional(),
  slug: z.string().regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens').optional(),
});

const updateBusinessSchema = z.object({
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  legalName: z.string().optional(),
  registrationNumber: z.string().optional(),
  taxId: z.string().optional(),
  supportEmail: z.string().email().optional().or(z.literal('')),
  supportPhone: z.string().optional(),
});

const updateAddressSchema = z.object({
  country: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  lga: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  postalCode: z.string().optional(),
});

const updateBrandingSchema = z.object({
  logoUrl: z.string().url().optional().or(z.literal('')),
  logoStorageId: z.string().optional(),
  faviconUrl: z.string().url().optional().or(z.literal('')),
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  receiptHeader: z.string().optional(),
  receiptFooter: z.string().optional(),
});

const updateLocalizationSchema = z.object({
  currency: z.string().min(3).max(4).optional(),
  timezone: z.string().optional(),
  country: z.string().optional(),
  defaultLanguage: z.string().optional(),
  dateFormat: z.string().optional(),
  numberFormat: z.string().optional(),
  weekStartsOn: z.enum(['monday', 'sunday']).optional(),
});

const updateNotificationsSchema = z.object({
  defaultNotificationMode: z.string().optional(),
});

export const workspaceSettingsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate);

  // 1. GET Full settings
  fastify.get('/workspaces/:workspaceId/settings', async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    try {
      const settings = await dataService.getFullWorkspaceSettings(workspaceId, request.user.id);
      if (!settings) {
        return reply.status(404).send({
          success: false,
          error: { code: ERROR_CODES.WORKSPACE_NOT_FOUND, message: 'Workspace not found' },
        });
      }
      return reply.send({ success: true, data: { settings } });
    } catch (err: any) {
      fastify.log.error({ err, workspaceId }, 'Failed to fetch full workspace settings');
      return reply.status(500).send({
        success: false,
        error: { code: ERROR_CODES.INTERNAL_SERVER_ERROR, message: err.message },
      });
    }
  });

  // 2. General Settings
  fastify.get('/workspaces/:workspaceId/settings/general', async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const settings = await dataService.getFullWorkspaceSettings(workspaceId, request.user.id);
    if (!settings) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Workspace not found' } });
    return reply.send({
      success: true,
      data: {
        name: settings.name,
        displayName: settings.displayName,
        slug: settings.slug,
        type: settings.type,
        category: settings.category,
        description: settings.description,
      },
    });
  });

  fastify.patch('/workspaces/:workspaceId/settings/general', async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const parsed = updateGeneralSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Invalid payload', details: parsed.error.format() },
      });
    }
    try {
      await dataService.updateWorkspaceGeneralSettings(workspaceId, parsed.data, request.user.id);
      const updated = await dataService.getFullWorkspaceSettings(workspaceId, request.user.id);
      return reply.send({ success: true, data: { settings: updated }, message: 'General settings updated successfully.' });
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: { code: 'UPDATE_FAILED', message: err.message } });
    }
  });

  // 3. Business Settings
  fastify.get('/workspaces/:workspaceId/settings/business', async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const settings = await dataService.getFullWorkspaceSettings(workspaceId, request.user.id);
    if (!settings) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Workspace not found' } });
    return reply.send({
      success: true,
      data: {
        email: settings.email,
        phone: settings.phone,
        category: settings.category,
        description: settings.description,
      },
    });
  });

  fastify.patch('/workspaces/:workspaceId/settings/business', async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const parsed = updateBusinessSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Invalid payload' } });
    }
    try {
      await dataService.updateWorkspaceBusinessSettings(workspaceId, parsed.data, request.user.id);
      const updated = await dataService.getFullWorkspaceSettings(workspaceId, request.user.id);
      return reply.send({ success: true, data: { settings: updated }, message: 'Business settings updated.' });
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: { code: 'UPDATE_FAILED', message: err.message } });
    }
  });

  // 4. Address Settings
  fastify.get('/workspaces/:workspaceId/settings/address', async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const settings = await dataService.getFullWorkspaceSettings(workspaceId, request.user.id);
    if (!settings) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Workspace not found' } });
    return reply.send({
      success: true,
      data: {
        country: settings.country,
        state: settings.state,
        city: settings.city,
        addressLine1: settings.addressLine1,
        addressLine2: settings.addressLine2,
        postalCode: settings.postalCode,
      },
    });
  });

  fastify.patch('/workspaces/:workspaceId/settings/address', async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const parsed = updateAddressSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Invalid payload' } });
    }
    try {
      await dataService.updateWorkspaceAddressSettings(workspaceId, parsed.data, request.user.id);
      const updated = await dataService.getFullWorkspaceSettings(workspaceId, request.user.id);
      return reply.send({ success: true, data: { settings: updated }, message: 'Address updated.' });
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: { code: 'UPDATE_FAILED', message: err.message } });
    }
  });

  // 5. Branding Settings
  fastify.get('/workspaces/:workspaceId/settings/branding', async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const settings = await dataService.getFullWorkspaceSettings(workspaceId, request.user.id);
    if (!settings) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Workspace not found' } });
    return reply.send({
      success: true,
      data: {
        logoUrl: settings.logoUrl,
        logoStorageId: settings.logoStorageId,
        faviconUrl: settings.faviconUrl,
        primaryColor: settings.primaryColor,
        secondaryColor: settings.secondaryColor,
      },
    });
  });

  fastify.patch('/workspaces/:workspaceId/settings/branding', async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const parsed = updateBrandingSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Invalid payload' } });
    }
    try {
      await dataService.updateWorkspaceBrandingSettings(workspaceId, parsed.data, request.user.id);
      const updated = await dataService.getFullWorkspaceSettings(workspaceId, request.user.id);
      return reply.send({ success: true, data: { settings: updated }, message: 'Branding updated.' });
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: { code: 'UPDATE_FAILED', message: err.message } });
    }
  });

  fastify.post('/workspaces/:workspaceId/settings/branding/upload-url', async (_request, reply) => {
    try {
      const uploadUrl = await dataService.generateSettingsUploadUrl();
      return reply.send({ success: true, data: { uploadUrl } });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: { code: 'STORAGE_ERROR', message: err.message } });
    }
  });

  fastify.delete('/workspaces/:workspaceId/settings/branding/logo', async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    try {
      await dataService.removeWorkspaceLogo(workspaceId, request.user.id);
      return reply.send({ success: true, message: 'Logo removed successfully.' });
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: { code: 'DELETE_FAILED', message: err.message } });
    }
  });

  // 6. Localization Settings
  fastify.get('/workspaces/:workspaceId/settings/localization', async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const settings = await dataService.getFullWorkspaceSettings(workspaceId, request.user.id);
    if (!settings) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Workspace not found' } });
    return reply.send({
      success: true,
      data: {
        currency: settings.currency,
        timezone: settings.timezone,
        country: settings.country,
        defaultLanguage: settings.defaultLanguage,
        dateFormat: settings.dateFormat,
        numberFormat: settings.numberFormat,
        weekStartsOn: settings.weekStartsOn,
      },
    });
  });

  fastify.patch('/workspaces/:workspaceId/settings/localization', async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const parsed = updateLocalizationSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Invalid payload' } });
    }
    try {
      await dataService.updateWorkspaceLocalizationSettings(workspaceId, parsed.data, request.user.id);
      const updated = await dataService.getFullWorkspaceSettings(workspaceId, request.user.id);
      return reply.send({ success: true, data: { settings: updated }, message: 'Localization settings updated.' });
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: { code: 'UPDATE_FAILED', message: err.message } });
    }
  });

  // 7. Notification Settings
  fastify.get('/workspaces/:workspaceId/settings/notifications', async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const settings = await dataService.getFullWorkspaceSettings(workspaceId, request.user.id);
    if (!settings) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Workspace not found' } });
    return reply.send({
      success: true,
      data: {
        defaultNotificationMode: settings.defaultNotificationMode,
      },
    });
  });

  fastify.patch('/workspaces/:workspaceId/settings/notifications', async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const parsed = updateNotificationsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Invalid payload' } });
    }
    try {
      await dataService.updateWorkspaceNotificationSettings(workspaceId, parsed.data, request.user.id);
      return reply.send({ success: true, message: 'Notification preferences updated.' });
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: { code: 'UPDATE_FAILED', message: err.message } });
    }
  });

  // 8. Organization & Workspace Contact & Phone Verification APIs
  fastify.get('/workspaces/:workspaceId/settings/contact', async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const ws = await dataService.getWorkspaceById(workspaceId);
    if (!ws) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Workspace not found' } });
    return reply.send({
      success: true,
      data: {
        phone: ws.phone || null,
        phoneNormalized: ws.phoneNormalized || null,
        phoneStatus: ws.phoneStatus || (ws.phoneVerifiedAt ? 'verified' : ws.phone ? 'unverified' : 'unverified'),
        phoneVerifiedAt: ws.phoneVerifiedAt || null,
        email: ws.email || null,
        country: ws.country || null,
        state: ws.state || null,
        city: ws.city || null,
      },
    });
  });

  fastify.patch('/workspaces/:workspaceId/settings/contact', async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const body = request.body as any;
    try {
      await dataService.updateWorkspaceBusinessSettings(workspaceId, { phone: body.phone, email: body.email }, request.user.id);
      return reply.send({ success: true, message: 'Contact settings updated.' });
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: { code: 'UPDATE_FAILED', message: err.message } });
    }
  });

  fastify.post('/workspaces/:workspaceId/settings/phone/verification/start', async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const body = (request.body as { phone?: string; purpose?: string }) || {};
    const ws = await dataService.getWorkspaceById(workspaceId);
    const phoneToVerify = body.phone || ws?.phone;
    if (!phoneToVerify) {
      return reply.status(400).send({ success: false, error: { code: 'PHONE_REQUIRED', message: 'Phone number is required.' } });
    }
    try {
      const challenge = await dataService.startWorkspacePhoneVerification(
        workspaceId,
        request.user.id,
        phoneToVerify,
        body.purpose || 'workspace_phone_verification',
        request.ip,
        request.headers['user-agent']
      );
      return reply.send({
        success: true,
        message: `Verification code sent to ${challenge.phoneNormalized}.`,
        data: challenge,
      });
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: { code: 'VERIFICATION_START_FAILED', message: err.message } });
    }
  });

  fastify.post('/workspaces/:workspaceId/settings/phone/verification/verify', async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const body = request.body as { code: string; purpose?: string };
    try {
      const res = await dataService.verifyWorkspacePhone(
        workspaceId,
        request.user.id,
        body.code,
        body.purpose || 'workspace_phone_verification',
        request.ip,
        request.headers['user-agent']
      );
      if (!res.success) {
        return reply.status(400).send({ success: false, error: { code: res.error || 'INVALID_CODE', message: 'Invalid verification code.' } });
      }
      return reply.send({ success: true, message: 'Workspace phone verified successfully!', data: res });
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: { code: 'VERIFICATION_FAILED', message: err.message } });
    }
  });

  fastify.post('/workspaces/:workspaceId/settings/phone/verification/resend', async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const body = (request.body as { purpose?: string }) || {};
    try {
      const res = await dataService.resendWorkspacePhoneVerification(
        workspaceId,
        request.user.id,
        body.purpose || 'workspace_phone_verification',
        request.ip,
        request.headers['user-agent']
      );
      return reply.send({ success: true, message: 'Verification code resent.', data: res });
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: { code: 'RESEND_FAILED', message: err.message } });
    }
  });

  // Branch Phone Verification APIs
  fastify.post('/workspaces/:workspaceId/branches/:branchId/phone/verification/start', async (request, reply) => {
    const { workspaceId, branchId } = request.params as { workspaceId: string; branchId: string };
    const body = (request.body as { phone?: string; purpose?: string }) || {};
    const branch = await dataService.getBranchById(branchId);
    const phoneToVerify = body.phone || branch?.phone;
    if (!phoneToVerify) {
      return reply.status(400).send({ success: false, error: { code: 'PHONE_REQUIRED', message: 'Phone number is required.' } });
    }
    try {
      const challenge = await dataService.startBranchPhoneVerification(
        branchId,
        workspaceId,
        request.user.id,
        phoneToVerify,
        body.purpose || 'branch_phone_verification',
        request.ip,
        request.headers['user-agent']
      );
      return reply.send({ success: true, message: `Verification code sent to ${challenge.phoneNormalized}.`, data: challenge });
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: { code: 'VERIFICATION_START_FAILED', message: err.message } });
    }
  });

  fastify.post('/workspaces/:workspaceId/branches/:branchId/phone/verification/verify', async (request, reply) => {
    const { workspaceId, branchId } = request.params as { workspaceId: string; branchId: string };
    const body = request.body as { code: string; purpose?: string };
    try {
      const res = await dataService.verifyBranchPhone(
        branchId,
        workspaceId,
        request.user.id,
        body.code,
        body.purpose || 'branch_phone_verification',
        request.ip,
        request.headers['user-agent']
      );
      if (!res.success) {
        return reply.status(400).send({ success: false, error: { code: res.error || 'INVALID_CODE', message: 'Invalid verification code.' } });
      }
      return reply.send({ success: true, message: 'Branch phone verified successfully!', data: res });
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: { code: 'VERIFICATION_FAILED', message: err.message } });
    }
  });

  fastify.post('/workspaces/:workspaceId/branches/:branchId/phone/verification/resend', async (request, reply) => {
    const { workspaceId, branchId } = request.params as { workspaceId: string; branchId: string };
    const body = (request.body as { purpose?: string }) || {};
    try {
      const res = await dataService.resendBranchPhoneVerification(
        branchId,
        workspaceId,
        request.user.id,
        body.purpose || 'branch_phone_verification',
        request.ip,
        request.headers['user-agent']
      );
      return reply.send({ success: true, message: 'Verification code resent.', data: res });
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: { code: 'RESEND_FAILED', message: err.message } });
    }
  });

  // 9. Organization Alias Routes
  fastify.get('/organizations/:organizationId/settings', async (request, reply) => {
    const { organizationId } = request.params as { organizationId: string };
    const settings = await dataService.getFullWorkspaceSettings(organizationId, request.user.id);
    return reply.send({ success: true, data: { settings } });
  });
};
