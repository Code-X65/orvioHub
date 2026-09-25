import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { dataService } from '../services/dataService.js';
import { entitlementService } from '../services/entitlementService.js';
import { smsService } from '../services/smsService.js';
import { validateNigerianPhone } from '../utils/phoneValidation.js';
import { ERROR_CODES, AUDIT_EVENTS } from '../config/constants.js';
import { toPublicUser } from '../utils/userSerializer.js';
import { parseUserAgent } from '../utils/userAgentParser.js';

const updateProfileSchema = z.object({
  name: z.string().trim().optional(),
  firstName: z.string().trim().min(1, 'First name is required').max(100, 'First name must be under 100 characters').optional(),
  lastName: z.string().trim().min(1, 'Last name is required').max(100, 'Last name must be under 100 characters').optional(),
  displayName: z.string().trim().max(100, 'Display name must be under 100 characters').optional().nullable(),
  preferredName: z.string().trim().optional().nullable(),
  jobTitle: z.string().trim().max(100, 'Job title must be under 100 characters').optional().nullable(),
  department: z.string().trim().max(100, 'Department must be under 100 characters').optional().nullable(),
  bio: z.string().trim().max(500, 'Bio must be under 500 characters').optional().nullable(),
  avatar: z.string().optional().nullable(),
  avatarUrl: z.string().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  country: z.string().trim().optional().nullable(),
  state: z.string().trim().optional().nullable(),
  stateCode: z.string().trim().optional().nullable(),
  lga: z.string().trim().optional().nullable(),
  city: z.string().trim().optional().nullable(),
  timezone: z.string().trim().optional().nullable(),
  locale: z.string().trim().optional().nullable(),
});

const updateContactSchema = z.object({
  phone: z.string().optional(),
  phoneVisibility: z.enum(['private', 'workspace']).optional(),
  country: z.string().optional(),
  state: z.string().optional(),
  stateCode: z.string().optional(),
  lga: z.string().optional(),
  city: z.string().optional(),
  timezone: z.string().optional(),
});

const preferencesSchema = z.object({
  theme: z.enum(['dark', 'light', 'system']).optional(),
  language: z.string().optional(),
  timezone: z.string().optional(),
  country: z.string().optional(),
  dateFormat: z.string().optional(),
  numberFormat: z.string().optional(),
  currencyPreference: z.string().optional(),
  firstDayOfWeek: z.enum(['monday', 'sunday']).optional(),
  layoutDensity: z.enum(['compact', 'comfortable']).optional(),
});

const notificationPreferencesSchema = z.object({
  marketingEmailEnabled: z.boolean().optional(),
  productEmailEnabled: z.boolean().optional(),
  securityEmailEnabled: z.boolean().optional(),
  inventoryAlertsEnabled: z.boolean().optional(),
  taskRemindersEnabled: z.boolean().optional(),
  billingAlertsEnabled: z.boolean().optional(),
});

export const userRoutes: FastifyPluginAsync = async (fastify) => {
  // 1. GET /api/v1/users/me
  fastify.get(
    '/me',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Users'],
        summary: 'Get current user profile, preferences, and account status',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const freshUser = await dataService.getUserById(request.user.id);
      const user = freshUser || request.user;
      const profileData = await dataService.getProfile(user.id);

      return reply.send({
        success: true,
        data: {
          user: toPublicUser(user),
          preferences: profileData?.preferences || null,
          consents: profileData?.consents || [],
          activeDeletionRequest: profileData?.activeDeletionRequest || null,
        },
        requestId: request.id,
      });
    }
  );

  // 1b. GET /api/v1/users/me/application-access
  fastify.get(
    '/me/application-access',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Users', 'Applications'],
        summary: 'Resolve accessible organizations, pending invitations, and target route for selected application',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            product: { type: 'string' },
            productKey: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const query = (request.query as { product?: string; productKey?: string }) || {};
      const productKey = query.productKey || query.product;
      const result = await dataService.getApplicationAccess(request.user.id, productKey);
      return reply.send({
        success: true,
        data: result,
      });
    }
  );

  // 1c. POST /api/v1/users/me/application-selection
  fastify.post(
    '/me/application-selection',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Users', 'Applications'],
        summary: 'Record user chosen product preference',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['productKey'],
          properties: {
            productKey: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as { productKey: string };
      if (!body.productKey) {
        return reply.status(400).send({
          success: false,
          error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'productKey is required.' },
        });
      }
      const result = await dataService.setApplicationSelection(request.user.id, body.productKey);
      return reply.send({
        success: true,
        data: result,
      });
    }
  );

  // 1d. GET /api/v1/users/products
  fastify.get(
    '/products',
    {
      schema: {
        tags: ['Applications'],
        summary: 'List available applications catalog',
      },
    },
    async (_request, reply) => {
      const products = dataService.getProductsCatalog();
      return reply.send({
        success: true,
        data: { products },
      });
    }
  );

  // 1e. GET /api/v1/users/products/:productKey
  fastify.get(
    '/products/:productKey',
    {
      schema: {
        tags: ['Applications'],
        summary: 'Get details for a specific application',
        params: {
          type: 'object',
          required: ['productKey'],
          properties: {
            productKey: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { productKey: string };
      const product = dataService.getProductDetails(params.productKey);
      if (!product) {
        return reply.status(404).send({
          success: false,
          error: { code: ERROR_CODES.NOT_FOUND, message: 'Product not found.' },
        });
      }
      return reply.send({
        success: true,
        data: { product },
      });
    }
  );

  // 2. PATCH /api/v1/users/me (Personal Info)
  fastify.patch(
    '/me',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Users'],
        summary: 'Update current user personal profile details',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      // 1. Regional validation checks
      const rawBody = (request.body && typeof request.body === 'object') ? (request.body as Record<string, any>) : {};

      if (rawBody.country !== undefined && rawBody.country !== null && String(rawBody.country).trim() !== '') {
        const c = String(rawBody.country).trim().toUpperCase();
        if (c !== 'NG' && c !== 'NIGERIA') {
          return reply.status(400).send({
            success: false,
            error: {
              code: ERROR_CODES.PROFILE_REGIONAL_VALUE_NOT_SUPPORTED,
              message: 'Only Nigeria and West Africa Time are currently supported.',
            },
            requestId: request.id,
          });
        }
      }

      if (rawBody.timezone !== undefined && rawBody.timezone !== null && String(rawBody.timezone).trim() !== '') {
        const tz = String(rawBody.timezone).trim();
        if (tz !== 'Africa/Lagos' && tz !== 'West Africa Time (WAT)' && tz !== 'WAT') {
          return reply.status(400).send({
            success: false,
            error: {
              code: ERROR_CODES.PROFILE_REGIONAL_VALUE_NOT_SUPPORTED,
              message: 'Only Nigeria and West Africa Time are currently supported.',
            },
            requestId: request.id,
          });
        }
      }

      // 2. Schema validation
      const parsed = updateProfileSchema.safeParse(request.body);
      if (!parsed.success) {
        const fields: Record<string, string> = {};
        parsed.error.errors.forEach((err) => {
          if (err.path[0]) fields[String(err.path[0])] = err.message;
        });
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Validation failed for profile updates.',
            fields,
          },
          requestId: request.id,
        });
      }

      // 3. Nigerian phone validation and normalization
      let normalizedPhone: string | null | undefined = undefined;
      let phoneNormalizedDigits: string | undefined = undefined;
      if (parsed.data.phone !== undefined) {
        if (parsed.data.phone === null || parsed.data.phone.trim() === '') {
          normalizedPhone = null;
          phoneNormalizedDigits = '';
        } else {
          const phoneRes = validateNigerianPhone(parsed.data.phone);
          if (!phoneRes.valid || !phoneRes.normalized) {
            return reply.status(400).send({
              success: false,
              error: {
                code: ERROR_CODES.VALIDATION_ERROR,
                message: phoneRes.error || 'Invalid Nigerian phone number format.',
                fields: { phone: phoneRes.error || 'Invalid Nigerian phone number.' },
              },
              requestId: request.id,
            });
          }
          normalizedPhone = `+${phoneRes.normalized}`;
          phoneNormalizedDigits = phoneRes.normalized;
        }
      }

      // 4. Fetch current user to compute exact diff for audit logging
      const currentUser = await dataService.getUserById(request.user.id);
      if (!currentUser) {
        return reply.status(404).send({
          success: false,
          error: {
            code: ERROR_CODES.USER_NOT_FOUND,
            message: 'User account not found.',
          },
          requestId: request.id,
        });
      }

      // 4b. Guard: Verified phone numbers cannot be changed directly via profile update
      const isPhoneVerified = Boolean(currentUser.phoneVerifiedAt) || currentUser.phoneStatus === 'verified';
      if (isPhoneVerified && normalizedPhone !== undefined) {
        const currentDigits = (currentUser.phone || currentUser.phoneNormalized || '').replace(/\D/g, '');
        const incomingDigits = (phoneNormalizedDigits || '').replace(/\D/g, '');

        if (normalizedPhone === null || (incomingDigits && incomingDigits !== currentDigits)) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'VERIFIED_PHONE_LOCKED',
              message: 'Verified phone numbers cannot be edited directly. Please use the Change Phone Number verification process.',
              fields: { phone: 'Verified phone number is locked.' },
            },
            requestId: request.id,
          });
        }
      }

      // 5. Compute actual changed fields
      const changedFields: string[] = [];
      const specificAuditEvents: string[] = [];

      let nameChanged = false;
      if (parsed.data.firstName !== undefined && parsed.data.firstName !== (currentUser.firstName || '')) {
        changedFields.push('firstName');
        nameChanged = true;
      }
      if (parsed.data.lastName !== undefined && parsed.data.lastName !== (currentUser.lastName || '')) {
        changedFields.push('lastName');
        nameChanged = true;
      }
      if (nameChanged) {
        specificAuditEvents.push(AUDIT_EVENTS.PROFILE_NAME_UPDATED);
      }

      if (parsed.data.displayName !== undefined && (parsed.data.displayName || '') !== (currentUser.displayName || '')) {
        changedFields.push('displayName');
        specificAuditEvents.push(AUDIT_EVENTS.PROFILE_DISPLAY_NAME_UPDATED);
      }

      if (parsed.data.jobTitle !== undefined && (parsed.data.jobTitle || '') !== (currentUser.jobTitle || '')) {
        changedFields.push('jobTitle');
        specificAuditEvents.push(AUDIT_EVENTS.PROFILE_JOB_TITLE_UPDATED);
      }

      if (parsed.data.department !== undefined && (parsed.data.department || '') !== (currentUser.department || '')) {
        changedFields.push('department');
        specificAuditEvents.push(AUDIT_EVENTS.PROFILE_DEPARTMENT_UPDATED);
      }

      if (normalizedPhone !== undefined) {
        const currentPhone = currentUser.phone || null;
        if (normalizedPhone === null) {
          if (currentPhone) {
            changedFields.push('phone');
            specificAuditEvents.push(AUDIT_EVENTS.PROFILE_PHONE_REMOVED);
          }
        } else if (!currentPhone) {
          changedFields.push('phone');
          specificAuditEvents.push(AUDIT_EVENTS.PROFILE_PHONE_ADDED);
        } else if (currentPhone !== normalizedPhone && currentUser.phoneNormalized !== phoneNormalizedDigits) {
          changedFields.push('phone');
          specificAuditEvents.push(AUDIT_EVENTS.PROFILE_PHONE_UPDATED);
        }
      }

      const targetAvatar = parsed.data.avatarUrl ?? parsed.data.avatar;
      if (targetAvatar !== undefined) {
        const currentAvatar = currentUser.avatarUrl || currentUser.avatar || null;
        if (!targetAvatar && currentAvatar) {
          changedFields.push('avatar');
          specificAuditEvents.push(AUDIT_EVENTS.PROFILE_AVATAR_REMOVED);
        } else if (targetAvatar && targetAvatar !== currentAvatar) {
          changedFields.push('avatar');
          specificAuditEvents.push(AUDIT_EVENTS.PROFILE_AVATAR_UPLOADED);
        }
      }

      // 6. Handle no-op update: if nothing changed, do not emit audit events
      if (changedFields.length === 0) {
        return reply.send({
          success: true,
          data: { user: toPublicUser(currentUser) },
          message: 'Personal profile is already up to date.',
          requestId: request.id,
        });
      }

      // 7. Apply updates
      const updateData: any = {
        ...parsed.data,
        country: 'NG',
        timezone: 'Africa/Lagos',
      };
      if (normalizedPhone !== undefined) {
        updateData.phone = normalizedPhone === null ? '' : normalizedPhone;
        updateData.phoneNormalized = phoneNormalizedDigits || '';
      }

      const updatedUser = await dataService.updateProfile(request.user.id, updateData);

      // 8. Log audit events for actual changes only
      const auditMeta = {
        userId: request.user.id,
        changedFields,
        requestId: request.id,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        createdAt: Date.now(),
      };

      for (const eventType of specificAuditEvents) {
        await dataService.logAudit({
          actorUserId: request.user.id,
          eventType,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          metadata: auditMeta,
        });
      }

      await dataService.logAudit({
        actorUserId: request.user.id,
        eventType: AUDIT_EVENTS.PROFILE_UPDATED,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: auditMeta,
      });

      return reply.send({
        success: true,
        data: { user: toPublicUser(updatedUser) },
        message: 'Personal profile updated successfully.',
        requestId: request.id,
      });
    }
  );

  // 3. POST /api/v1/users/me/avatar
  fastify.post(
    '/me/avatar',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Users'],
        summary: 'Upload or update avatar URL',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['avatarUrl'],
          properties: {
            avatarUrl: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as { avatarUrl: string };
      const updatedUser = await dataService.updateAvatar(request.user.id, body.avatarUrl);
      await dataService.logAudit({
        actorUserId: request.user.id,
        eventType: AUDIT_EVENTS.USER_PROFILE_UPDATED,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: { action: 'avatar_updated' },
      });
      return reply.send({
        success: true,
        data: { user: toPublicUser(updatedUser) },
        message: 'Avatar updated successfully.',
      });
    }
  );

  // 4. DELETE /api/v1/users/me/avatar
  fastify.delete(
    '/me/avatar',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Users'],
        summary: 'Remove avatar profile image',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const updatedUser = await dataService.updateAvatar(request.user.id, undefined);
      await dataService.logAudit({
        actorUserId: request.user.id,
        eventType: AUDIT_EVENTS.USER_PROFILE_UPDATED,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: { action: 'avatar_removed' },
      });
      return reply.send({
        success: true,
        data: { user: toPublicUser(updatedUser) },
        message: 'Avatar removed.',
      });
    }
  );

  // 6b. POST /api/v1/users/me/email/change (and alias /me/email-change/request)
  const handleEmailChangeRequest = async (request: any, reply: any) => {
    const body = request.body as { newEmail: string; password?: string };
    if (!body.newEmail) {
      return reply.status(400).send({
        success: false,
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'New email address is required.' },
      });
    }

    const user = await dataService.getUserById(request.user.id);
    if (!user) {
      return reply.status(401).send({
        success: false,
        error: { code: ERROR_CODES.UNAUTHENTICATED, message: 'User not found.' },
      });
    }

    if (user.passwordHash && body.password) {
      const isMatch = await dataService.verifyPassword(user, body.password);
      if (!isMatch) {
        return reply.status(401).send({
          success: false,
          error: { code: ERROR_CODES.INVALID_CREDENTIALS, message: 'Incorrect password.' },
        });
      }
    }

    try {
      await dataService.requestEmailChange(request.user.id, body.newEmail);
      await dataService.logAudit({
        actorUserId: request.user.id,
        eventType: AUDIT_EVENTS.USER_EMAIL_CHANGE_REQUESTED,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: { newEmail: body.newEmail },
      });

      return reply.send({
        success: true,
        message: `Verification link sent to ${body.newEmail}. Please confirm via the link in your inbox.`,
      });
    } catch (err: any) {
      if (err.code === 'CONFLICT' || err.message?.includes('already in use')) {
        return reply.status(409).send({
          success: false,
          error: { code: ERROR_CODES.CONFLICT, message: 'This email is already in use by another account.' },
        });
      }
      throw err;
    }
  };

  fastify.post(
    '/me/email/change',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Users', 'Email'],
        summary: 'Request email address change with verification link',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['newEmail'],
          properties: {
            newEmail: { type: 'string', format: 'email' },
            password: { type: 'string' },
          },
        },
      },
    },
    handleEmailChangeRequest
  );

  fastify.post(
    '/me/email-change/request',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Users', 'Email'],
        summary: 'Alias request email change endpoint',
        security: [{ bearerAuth: [] }],
      },
    },
    handleEmailChangeRequest
  );

  // 6c. POST /api/v1/users/me/email/verify & Public POST /api/v1/users/email/verify
  const handleEmailVerify = async (request: any, reply: any) => {
    const token = (request.body as any)?.token || (request.query as any)?.token;
    if (!token) {
      return reply.status(400).send({
        success: false,
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Verification token is required.' },
      });
    }

    try {
      const { user } = await dataService.confirmEmailChange(token);
      await dataService.logAudit({
        actorUserId: user.id,
        eventType: AUDIT_EVENTS.USER_EMAIL_CHANGED,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: { newEmail: user.email },
      });

      return reply.send({
        success: true,
        message: 'Email address updated and verified successfully.',
        data: { user: toPublicUser(user) },
      });
    } catch (err: any) {
      if (err.message === 'INVALID_TOKEN' || err.message === 'TOKEN_EXPIRED') {
        return reply.status(400).send({
          success: false,
          error: {
            code: err.message,
            message: 'Invalid or expired email change token. Please request a new one.',
          },
        });
      }
      if (err.message === 'EMAIL_ALREADY_IN_USE' || err.code === 'CONFLICT') {
        return reply.status(409).send({
          success: false,
          error: {
            code: ERROR_CODES.CONFLICT,
            message: 'Email address is already in use by another account.',
          },
        });
      }
      throw err;
    }
  };

  fastify.post(
    '/me/email/verify',
    {
      schema: {
        tags: ['Users', 'Email'],
        summary: 'Confirm email change using token',
        body: {
          type: 'object',
          required: ['token'],
          properties: {
            token: { type: 'string' },
          },
        },
      },
    },
    handleEmailVerify
  );

  fastify.post('/email/verify', { schema: { tags: ['Users', 'Email'], summary: 'Confirm email change public endpoint' } }, handleEmailVerify);
  fastify.get('/email/verify', { schema: { tags: ['Users', 'Email'], summary: 'Confirm email change public GET endpoint' } }, handleEmailVerify);

  // 6d. 2FA Security Endpoints under /me/security/2fa/* and /me/2fa/*
  const handle2faStatus = async (request: any, reply: any) => {
    const status = await dataService.getTwoFactorStatus(request.user.id);
    return reply.send({
      success: true,
      data: status,
    });
  };
  fastify.get('/me/security/2fa/status', { preHandler: [fastify.authenticate] }, handle2faStatus);
  fastify.get('/me/2fa/status', { preHandler: [fastify.authenticate] }, handle2faStatus);

  const handle2faStart = async (request: any, reply: any) => {
    const data = await dataService.enableTwoFactorStart(request.user.id);
    return reply.send({
      success: true,
      data,
    });
  };
  fastify.post('/me/security/2fa/start', { preHandler: [fastify.authenticate] }, handle2faStart);
  fastify.post('/me/2fa/start', { preHandler: [fastify.authenticate] }, handle2faStart);
  fastify.post('/me/security/2fa/setup', { preHandler: [fastify.authenticate] }, handle2faStart);

  const handle2faVerify = async (request: any, reply: any) => {
    const body = request.body as { code?: string };
    if (!body?.code) {
      return reply.status(400).send({
        success: false,
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: '6-digit verification code is required.' },
      });
    }
    try {
      const result = await dataService.verifyAndActivateTwoFactor(request.user.id, body.code);
      await dataService.logAudit({
        actorUserId: request.user.id,
        eventType: AUDIT_EVENTS.USER_2FA_ENABLED,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });
      return reply.send({
        success: true,
        data: { backupCodes: result.backupCodes },
        message: 'Two-factor authentication successfully enabled.',
      });
    } catch (err: any) {
      return reply.status(400).send({
        success: false,
        error: { code: ERROR_CODES.INVALID_2FA_CODE, message: 'Invalid verification code. Please check your authenticator app.' },
      });
    }
  };
  fastify.post('/me/security/2fa/verify', { preHandler: [fastify.authenticate] }, handle2faVerify);
  fastify.post('/me/2fa/verify', { preHandler: [fastify.authenticate] }, handle2faVerify);

  const handle2faDisable = async (request: any, reply: any) => {
    const body = (request.body as { password?: string }) || {};
    try {
      await dataService.disableTwoFactor(request.user.id, body.password);
      await dataService.logAudit({
        actorUserId: request.user.id,
        eventType: AUDIT_EVENTS.USER_2FA_DISABLED,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });
      return reply.send({
        success: true,
        message: 'Two-factor authentication successfully disabled.',
      });
    } catch (err: any) {
      if (err.code === 'INVALID_CREDENTIALS') {
        return reply.status(401).send({
          success: false,
          error: { code: ERROR_CODES.INVALID_CREDENTIALS, message: 'Incorrect password.' },
        });
      }
      throw err;
    }
  };
  fastify.post('/me/security/2fa/disable', { preHandler: [fastify.authenticate] }, handle2faDisable);
  fastify.post('/me/2fa/disable', { preHandler: [fastify.authenticate] }, handle2faDisable);

  const handle2faRegenerateBackupCodes = async (request: any, reply: any) => {
    const body = (request.body as { password?: string }) || {};
    try {
      const result = await dataService.regenerateBackupCodes(request.user.id, body.password);
      await dataService.logAudit({
        actorUserId: request.user.id,
        eventType: 'USER_2FA_BACKUP_CODES_REGENERATED',
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });
      return reply.send({
        success: true,
        data: { backupCodes: result.backupCodes },
        message: 'Backup codes regenerated successfully.',
      });
    } catch (err: any) {
      if (err.code === 'INVALID_CREDENTIALS') {
        return reply.status(401).send({
          success: false,
          error: { code: ERROR_CODES.INVALID_CREDENTIALS, message: 'Incorrect password.' },
        });
      }
      return reply.status(400).send({
        success: false,
        error: { code: err.code || 'REGENERATE_FAILED', message: err.message || 'Failed to regenerate backup codes.' },
      });
    }
  };
  fastify.post('/me/security/2fa/backup-codes/regenerate', { preHandler: [fastify.authenticate] }, handle2faRegenerateBackupCodes);
  fastify.post('/me/security/2fa/regenerate-backup-codes', { preHandler: [fastify.authenticate] }, handle2faRegenerateBackupCodes);

  // 7. POST /api/v1/users/me/password/change
  fastify.post(
    '/me/password/change',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Users'],
        summary: 'Change password with current password verification',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['currentPassword', 'newPassword'],
          properties: {
            currentPassword: { type: 'string' },
            newPassword: { type: 'string', minLength: 8 },
            revokeOtherSessions: { type: 'boolean' },
            twoFactorCode: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as {
        currentPassword: string;
        newPassword: string;
        revokeOtherSessions?: boolean;
        twoFactorCode?: string;
      };

      try {
        const currentSessionId = request.sessionId || (request.user as any)?.sessionId;
        await dataService.changePassword(
          request.user.id,
          body.currentPassword,
          body.newPassword,
          currentSessionId,
          body.twoFactorCode
        );
        
        if (body.revokeOtherSessions) {
          await dataService.revokeAllOtherSessions(request.user.id, currentSessionId);
        }

        await dataService.logAuthEvent({
          eventType: 'password_changed',
          userId: request.user.id,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        });

        const freshUser = await dataService.getUserById(request.user.id);
        const newToken = fastify.jwt.sign({
          userId: request.user.id,
          email: request.user.email,
          sessionId: currentSessionId,
          tokenVersion: freshUser?.tokenVersion ?? 1,
        });

        return reply.send({
          success: true,
          message: 'Password changed successfully.',
          data: {
            token: newToken,
          },
        });
      } catch (err: any) {
        if (err.code === 'PASSWORD_REUSED') {
          return reply.status(400).send({
            success: false,
            error: {
              code: ERROR_CODES.PASSWORD_REUSED,
              message: 'Your new password cannot be the same as your current password.',
            },
          });
        }
        if (err.code === 'STEP_UP_AUTH_REQUIRED') {
          return reply.status(400).send({
            success: false,
            error: {
              code: ERROR_CODES.STEP_UP_AUTH_REQUIRED,
              message: 'Two-factor verification code is required to change password.',
            },
          });
        }
        if (err.code === 'INVALID_2FA_CODE') {
          return reply.status(400).send({
            success: false,
            error: {
              code: ERROR_CODES.INVALID_2FA_CODE,
              message: 'Invalid two-factor authentication code.',
            },
          });
        }
        if (err.code === 'INVALID_CREDENTIALS') {
          return reply.status(401).send({
            success: false,
            error: {
              code: ERROR_CODES.INVALID_CREDENTIALS,
              message: 'Current password is incorrect.',
            },
          });
        }
        throw err;
      }
    }
  );

  // 8. GET /api/v1/users/me/sessions
  fastify.get(
    '/me/sessions',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Users'],
        summary: 'List active sessions and devices for current user',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const currentSessionId = request.sessionId || (request.user as any)?.sessionId;
      const rawSessions = await dataService.getUserSessions(request.user.id);
      const sessions = rawSessions.map((s: any) => {
        const id = s.id || s._id;
        const parsedUa = parseUserAgent(s.userAgent, s.ipAddress);
        return {
          ...s,
          id,
          deviceName: s.deviceName || parsedUa.deviceName,
          browser: parsedUa.browser,
          operatingSystem: parsedUa.operatingSystem,
          approximateLocation: parsedUa.approximateLocation,
          isCurrent: Boolean(
            currentSessionId &&
              (String(id) === String(currentSessionId) ||
                String(s._id) === String(currentSessionId))
          ),
        };
      });
      return reply.send({
        success: true,
        data: { sessions },
      });
    }
  );

  // 9. DELETE /api/v1/users/me/sessions/:sessionId
  fastify.delete(
    '/me/sessions/:sessionId',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Users'],
        summary: 'Revoke a specific remote session',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['sessionId'],
          properties: {
            sessionId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { sessionId: string };
      try {
        await dataService.revokeSessionById(params.sessionId, request.user.id);
        await dataService.logAudit({
          actorUserId: request.user.id,
          eventType: AUDIT_EVENTS.AUTH_SESSION_REVOKED,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          metadata: { sessionId: params.sessionId },
        });
        return reply.send({
          success: true,
          message: 'Session revoked successfully.',
        });
      } catch (err: any) {
        if (err.message === 'SESSION_NOT_FOUND' || err.code === 'SESSION_NOT_FOUND') {
          return reply.status(404).send({
            success: false,
            error: {
              code: ERROR_CODES.NOT_FOUND,
              message: 'Session not found.',
            },
          });
        }
        throw err;
      }
    }
  );

  fastify.post(
    '/me/sessions/:sessionId/revoke',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Users'],
        summary: 'Revoke a specific remote session via POST',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const params = request.params as { sessionId: string };
      try {
        await dataService.revokeSessionById(params.sessionId, request.user.id);
        await dataService.logAudit({
          actorUserId: request.user.id,
          eventType: AUDIT_EVENTS.AUTH_SESSION_REVOKED,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          metadata: { sessionId: params.sessionId },
        });
        return reply.send({
          success: true,
          message: 'Session revoked successfully.',
        });
      } catch (err: any) {
        if (err.message === 'SESSION_NOT_FOUND' || err.code === 'SESSION_NOT_FOUND') {
          return reply.status(404).send({
            success: false,
            error: {
              code: ERROR_CODES.NOT_FOUND,
              message: 'Session not found.',
            },
          });
        }
        throw err;
      }
    }
  );

  // 10. POST /api/v1/users/me/sessions/revoke-all
  fastify.post(
    '/me/sessions/revoke-all',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Users'],
        summary: 'Revoke all other active sessions except current',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const currentSessionId = request.sessionId || (request.user as any)?.sessionId;
      await dataService.revokeAllOtherSessions(request.user.id, currentSessionId);
      await dataService.logAudit({
        actorUserId: request.user.id,
        eventType: AUDIT_EVENTS.AUTH_SESSION_REVOKED,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: { scope: 'all_other_sessions' },
      });
      return reply.send({
        success: true,
        message: 'All other sessions revoked successfully.',
      });
    }
  );

  // 10b. DELETE /api/v1/users/me/sessions (alias to revoke all other sessions)
  fastify.delete(
    '/me/sessions',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Users'],
        summary: 'Revoke all other active sessions except current',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const currentSessionId = request.sessionId || (request.user as any)?.sessionId;
      await dataService.revokeAllOtherSessions(request.user.id, currentSessionId);
      await dataService.logAudit({
        actorUserId: request.user.id,
        eventType: AUDIT_EVENTS.AUTH_SESSION_REVOKED,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: { scope: 'all_other_sessions' },
      });
      return reply.send({
        success: true,
        message: 'All other sessions revoked successfully.',
      });
    }
  );

  // 11. GET /api/v1/users/me/security-activity
  fastify.get(
    '/me/security-activity',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Users'],
        summary: 'Get security audit logs and login activity',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            eventType: { type: 'string' },
            limit: { type: 'number' },
          },
        },
      },
    },
    async (request, reply) => {
      const query = request.query as { eventType?: string; limit?: number };
      const logs = await dataService.getUserSecurityActivity(request.user.id, {
        eventType: query.eventType,
        limit: query.limit,
      });
      return reply.send({
        success: true,
        data: { activities: logs },
      });
    }
  );

  // 12. POST /api/v1/users/me/security-activity/:activityId/suspicious
  fastify.post(
    '/me/security-activity/:activityId/suspicious',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Users'],
        summary: 'Report a security activity event as suspicious',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['activityId'],
          properties: {
            activityId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          properties: {
            reason: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { activityId: string };
      const body = (request.body as { reason?: string }) || {};

      try {
        await dataService.reportSuspiciousActivity(
          request.user.id,
          params.activityId,
          body.reason || 'Unrecognized activity reported by user'
        );
        return reply.send({
          success: true,
          message: 'Security event marked as suspicious. Our team has been notified.',
        });
      } catch (err: any) {
        return reply.status(404).send({
          success: false,
          error: { code: ERROR_CODES.NOT_FOUND, message: 'Activity not found' },
        });
      }
    }
  );

  // 13. GET /api/v1/users/me/identities
  fastify.get(
    '/me/identities',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Users'],
        summary: 'List connected identity providers for current user',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const identities = await dataService.getUserIdentities(request.user.id);
      return reply.send({
        success: true,
        data: { identities },
      });
    }
  );

  // 14. DELETE /api/v1/users/me/identities/:provider
  fastify.delete(
    '/me/identities/:provider',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Users'],
        summary: 'Unlink a connected authentication identity provider',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['provider'],
          properties: {
            provider: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { provider: string };
      try {
        await dataService.unlinkIdentity(params.provider, request.user.id);
        await dataService.logAudit({
          actorUserId: request.user.id,
          eventType: AUDIT_EVENTS.AUTH_PROVIDER_UNLINKED,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          metadata: { provider: params.provider },
        });
        return reply.send({
          success: true,
          message: 'Identity unlinked successfully.',
        });
      } catch (err: any) {
        if (err.message === 'CANNOT_REMOVE_ONLY_LOGIN_METHOD' || err.code === 'CANNOT_REMOVE_ONLY_LOGIN_METHOD') {
          return reply.status(400).send({
            success: false,
            error: {
              code: ERROR_CODES.CANNOT_REMOVE_ONLY_LOGIN_METHOD,
              message: 'You cannot remove your only login method.',
            },
          });
        }
        return reply.status(404).send({
          success: false,
          error: { code: ERROR_CODES.NOT_FOUND, message: 'Identity not found.' },
        });
      }
    }
  );

  // 15. GET /api/v1/users/me/preferences
  fastify.get(
    '/me/preferences',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Users'],
        summary: 'Get user personal preferences and regional settings',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const prefs = await dataService.getUserPreferences(request.user.id);
      return reply.send({
        success: true,
        data: { preferences: prefs },
      });
    }
  );

  // 16. PATCH /api/v1/users/me/preferences
  fastify.patch(
    '/me/preferences',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Users'],
        summary: 'Update user personal preferences and regional settings',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const parsed = preferencesSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Invalid preferences format.' },
        });
      }

      const updated = await dataService.updateUserPreferences(request.user.id, parsed.data);
      await dataService.logAudit({
        actorUserId: request.user.id,
        eventType: AUDIT_EVENTS.USER_PREFERENCES_UPDATED,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: { updatedKeys: Object.keys(parsed.data) },
      });

      return reply.send({
        success: true,
        data: { preferences: updated },
        message: 'Preferences updated successfully.',
      });
    }
  );

  // 17. GET /api/v1/users/me/notifications/preferences
  fastify.get(
    '/me/notifications/preferences',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Users'],
        summary: 'Get notification preferences',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const prefs = await dataService.getUserPreferences(request.user.id);
      return reply.send({
        success: true,
        data: {
          notificationPreferences: {
            securityEmailEnabled: true, // Security is always enabled
            marketingEmailEnabled: prefs?.marketingEmailEnabled ?? true,
            productEmailEnabled: prefs?.productEmailEnabled ?? true,
            inventoryAlertsEnabled: prefs?.inventoryAlertsEnabled ?? true,
            taskRemindersEnabled: prefs?.taskRemindersEnabled ?? true,
            billingAlertsEnabled: prefs?.billingAlertsEnabled ?? true,
          },
        },
      });
    }
  );

  // 18. PATCH /api/v1/users/me/notifications/preferences
  fastify.patch(
    '/me/notifications/preferences',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Users'],
        summary: 'Update notification preferences',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const parsed = notificationPreferencesSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Invalid notification preferences' },
        });
      }

      // Security cannot be disabled
      const cleanData = { ...parsed.data, securityEmailEnabled: true };
      const updated = await dataService.updateUserPreferences(request.user.id, cleanData);

      return reply.send({
        success: true,
        data: { notificationPreferences: updated },
        message: 'Notification preferences updated.',
      });
    }
  );

  // 19. GET /api/v1/users/me/data-summary (NDPA/GDPR personal summary)
  fastify.get(
    '/me/data-summary',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Users'],
        summary: 'Summary of personal data stored per NDPA/GDPR requirements',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const user = request.user;
      const workspaces = (await dataService.getUserWorkspaces(user.id)) || [];
      const sessions = (await dataService.getUserSessions(user.id)) || [];
      const identities = (await dataService.getUserIdentities(user.id)) || [];

      return reply.send({
        success: true,
        data: {
          summary: {
            userId: user.id,
            email: user.email,
            name: user.name,
            totalWorkspaces: workspaces.length,
            activeSessionsCount: sessions.filter((s: any) => !s.revokedAt).length,
            linkedProvidersCount: identities.length,
            accountCreated: user.createdAt,
            rights: [
              'Right to Access (Download copy of all data)',
              'Right to Rectification (Correct inaccurate records)',
              'Right to Erasure (Delete account & personal data)',
              'Right to Data Portability (JSON structured export)',
              'Right to Object to Processing & Marketing Consent',
            ],
          },
        },
      });
    }
  );

  // 20. POST /api/v1/users/me/data-export (Initiate Data Export)
  fastify.post(
    '/me/data-export',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Users'],
        summary: 'Generate downloadable GDPR personal data export',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const exportResult = await dataService.exportUserData(request.user.id);
      await dataService.logAudit({
        actorUserId: request.user.id,
        eventType: AUDIT_EVENTS.USER_DATA_EXPORT_REQUESTED,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });

      return reply.send({
        success: true,
        data: exportResult,
        message: 'Personal data archive generated successfully.',
      });
    }
  );

  // 21. POST /api/v1/users/me/deletion/request & legacy /me/deletion-request
  const handleDeletionRequest = async (request: any, reply: any) => {
    const body =
      (request.body as { reason?: string; password?: string; coolingOffDays?: number }) || {};

    // Verify password if user has password authentication
    const user = await dataService.getUserById(request.user.id);
    if (user?.passwordHash && body.password) {
      const isValid = await dataService.verifyPassword(user, body.password);
      if (!isValid) {
        return reply.status(401).send({
          success: false,
          error: { code: ERROR_CODES.INVALID_CREDENTIALS, message: 'Incorrect password.' },
        });
      }
    }

    try {
      const deletionReq = await dataService.requestAccountDeletion(
        request.user.id,
        body.reason,
        body.coolingOffDays ?? 7
      );

      await dataService.logAudit({
        actorUserId: request.user.id,
        eventType: AUDIT_EVENTS.USER_ACCOUNT_DELETION_REQUESTED,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: { scheduledDeletionAt: deletionReq?.scheduledDeletionAt },
      });

      return reply.send({
        success: true,
        deletionRequestId: deletionReq?.deletionRequestId || deletionReq?._id || 'del_' + Date.now(),
        scheduledDeletionAt: deletionReq?.scheduledDeletionAt,
        gracePeriodDays: deletionReq?.gracePeriodDays ?? 7,
        data: { deletionRequest: deletionReq },
        message: 'Account deletion scheduled. Check email for cancellation link.',
      });
    } catch (err: any) {
      if (err.code === 'SOLE_OWNER_CANNOT_LEAVE_WORKSPACE') {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.SOLE_OWNER_CANNOT_LEAVE_WORKSPACE,
            message: err.message,
            ownedWorkspaces: err.ownedWorkspaces,
          },
        });
      }
      return reply.status(400).send({
        success: false,
        error: {
          code: err.code || 'DELETION_FAILED',
          message: err.message || 'Failed to request account deletion.',
        },
      });
    }
  };

  fastify.post(
    '/me/deletion/request',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Users'],
        summary: 'Request account deletion with 7-day grace period per NDPA',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            reason: { type: 'string' },
            confirmPassword: { type: 'string' },
            password: { type: 'string' },
            coolingOffDays: { type: 'number' },
          },
        },
      },
    },
    handleDeletionRequest
  );

  fastify.post(
    '/me/deletion-request',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Users'],
        summary: 'Legacy request account deletion endpoint',
        security: [{ bearerAuth: [] }],
      },
    },
    handleDeletionRequest
  );

  // 22. Cancellation endpoints: DELETE /me/deletion/cancel, POST /me/deletion/cancel, POST /me/deletion-request/cancel
  const handleDeletionCancel = async (request: any, reply: any) => {
    try {
      await dataService.cancelAccountDeletion(request.user.id);
      await dataService.logAudit({
        actorUserId: request.user.id,
        eventType: AUDIT_EVENTS.USER_ACCOUNT_DELETION_CANCELLED,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });
      return reply.send({
        success: true,
        message: 'Account deletion request has been cancelled.',
      });
    } catch (err: any) {
      return reply.status(400).send({
        success: false,
        error: {
          code: ERROR_CODES.NO_ACTIVE_DELETION_REQUEST,
          message: 'No active deletion request found.',
        },
      });
    }
  };

  fastify.delete(
    '/me/deletion/cancel',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Users'],
        summary: 'Cancel pending account deletion request via DELETE',
        security: [{ bearerAuth: [] }],
      },
    },
    handleDeletionCancel
  );

  fastify.post(
    '/me/deletion/cancel',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Users'],
        summary: 'Cancel pending account deletion request via POST',
        security: [{ bearerAuth: [] }],
      },
    },
    handleDeletionCancel
  );

  fastify.post(
    '/me/deletion-request/cancel',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Users'],
        summary: 'Legacy cancel pending account deletion request',
        security: [{ bearerAuth: [] }],
      },
    },
    handleDeletionCancel
  );

  // 23. GET /api/v1/users/me/deletion/status
  fastify.get(
    '/me/deletion/status',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Users'],
        summary: 'Get active account deletion status and cooling off countdown',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      try {
        const status = await dataService.getAccountDeletionStatus(request.user.id);
        return reply.send({
          success: true,
          data: status,
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Failed to retrieve deletion status.',
          },
        });
      }
    }
  );

  // 24. Public 1-Click Email Deletion Cancellation: POST & GET /api/v1/users/deletion/cancel
  const handlePublicCancellationByToken = async (request: any, reply: any) => {
    const token = (request.body as any)?.token || (request.query as any)?.token;
    if (!token) {
      return reply.status(400).send({
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Cancellation token is required.',
        },
      });
    }

    try {
      await dataService.cancelAccountDeletion(undefined, token);
      return reply.send({
        success: true,
        message: 'Your account deletion request has been cancelled successfully.',
      });
    } catch (err: any) {
      return reply.status(400).send({
        success: false,
        error: {
          code: ERROR_CODES.NO_ACTIVE_DELETION_REQUEST,
          message: 'Invalid or expired cancellation link.',
        },
      });
    }
  };

  fastify.post(
    '/deletion/cancel',
    {
      schema: {
        tags: ['Users'],
        summary: 'Cancel account deletion using email link token',
        body: {
          type: 'object',
          required: ['token'],
          properties: {
            token: { type: 'string' },
          },
        },
      },
    },
    handlePublicCancellationByToken
  );

  fastify.get(
    '/deletion/cancel',
    {
      schema: {
        tags: ['Users'],
        summary: 'Cancel account deletion using email link query param',
        querystring: {
          type: 'object',
          required: ['token'],
          properties: {
            token: { type: 'string' },
          },
        },
      },
    },
    handlePublicCancellationByToken
  );

  // 23. GET /api/v1/users/me/workspaces
  fastify.get(
    '/me/workspaces',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Users'],
        summary: 'List all workspace memberships and roles for current user',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const workspaces = await dataService.getUserWorkspaces(request.user.id);
      return reply.send({
        success: true,
        data: { workspaces: workspaces || [] },
      });
    }
  );

  // 23b. GET /api/v1/users/me/organization-creation-eligibility
  fastify.get(
    '/me/organization-creation-eligibility',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Users', 'Organizations'],
        summary: 'Check if current user can create an organization (Max 3 owned)',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const eligibility = await entitlementService.getOrganizationCreationEligibility(request.user.id);
      return reply.send({
        success: true,
        allowed: eligibility.allowed,
        canCreate: eligibility.canCreate ?? eligibility.allowed,
        currentOwned: eligibility.currentOwned ?? eligibility.currentOwnedOrganizations,
        currentOwnedOrganizations: eligibility.currentOwnedOrganizations,
        maximumOwned: eligibility.maximumOwned ?? eligibility.maximumOwnedOrganizations,
        maximumOwnedOrganizations: eligibility.maximumOwnedOrganizations,
        remainingOwned: eligibility.remainingOwned ?? eligibility.remainingOwnedOrganizations,
        remainingOwnedOrganizations: eligibility.remainingOwnedOrganizations,
        freeTrial: eligibility.freeTrial || {
          used: 0,
          maximum: 1,
          available: true,
        },
        reasons: eligibility.reasons || (eligibility.allowed ? [] : ['organization_limit_reached']),
        recommendedPlan: eligibility.recommendedPlan || 'free_trial',
        override: eligibility.override,
        ...(eligibility.code ? { code: eligibility.code } : {}),
        ...(eligibility.message ? { message: eligibility.message } : {}),
        data: {
          allowed: eligibility.allowed,
          canCreate: eligibility.canCreate ?? eligibility.allowed,
          currentOwned: eligibility.currentOwned ?? eligibility.currentOwnedOrganizations,
          currentOwnedOrganizations: eligibility.currentOwnedOrganizations,
          maximumOwned: eligibility.maximumOwned ?? eligibility.maximumOwnedOrganizations,
          maximumOwnedOrganizations: eligibility.maximumOwnedOrganizations,
          remainingOwned: eligibility.remainingOwned ?? eligibility.remainingOwnedOrganizations,
          remainingOwnedOrganizations: eligibility.remainingOwnedOrganizations,
          freeTrial: eligibility.freeTrial || {
            used: 0,
            maximum: 1,
            available: true,
          },
          reasons: eligibility.reasons || (eligibility.allowed ? [] : ['organization_limit_reached']),
          recommendedPlan: eligibility.recommendedPlan || 'free_trial',
          override: eligibility.override,
          ...(eligibility.code ? { code: eligibility.code } : {}),
          ...(eligibility.message ? { message: eligibility.message } : {}),
        },
      });
    }
  );

  // 23c. GET /api/v1/users/me/organizations
  fastify.get(
    '/me/organizations',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Users', 'Organizations'],
        summary: 'Get categorized organizations (owned, joined, archived) and creation limit for user',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const result = await dataService.getUserOrganizationsCategorized(request.user.id);
      return reply.send({
        success: true,
        data: result,
        owned: result?.owned || [],
        joined: result?.joined || [],
        archived: result?.archived || [],
        creationLimit: result?.creationLimit || {
          currentOwned: 0,
          maximumOwned: 3,
          remaining: 3,
          canCreate: true,
        },
      });
    }
  );

  // 24. POST /api/v1/users/me/workspaces/:workspaceId/leave
  fastify.post(
    '/me/workspaces/:workspaceId/leave',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Users'],
        summary: 'Leave a workspace',
        security: [{ bearerAuth: [] }],
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
      const params = request.params as { workspaceId: string };
      try {
        await dataService.leaveWorkspace(request.user.id, params.workspaceId);
        await dataService.logAudit({
          actorUserId: request.user.id,
          workspaceId: params.workspaceId,
          eventType: AUDIT_EVENTS.USER_WORKSPACE_LEFT,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        });
        return reply.send({
          success: true,
          message: 'You have left the workspace successfully.',
        });
      } catch (err: any) {
        if (err.code === 'SOLE_OWNER_CANNOT_LEAVE_WORKSPACE') {
          return reply.status(400).send({
            success: false,
            error: {
              code: ERROR_CODES.SOLE_OWNER_CANNOT_LEAVE_WORKSPACE,
              message: err.message,
            },
          });
        }
        return reply.status(404).send({
          success: false,
          error: { code: ERROR_CODES.NOT_FOUND, message: err.message || 'Workspace not found.' },
        });
      }
    }
  );

  // Backward compatibility alias for GET /export
  fastify.get(
    '/me/export',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Users'],
        summary: 'Export complete user account and activity data (NDPR/GDPR)',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const result = await dataService.exportUserData(request.user.id);
      return reply.send({
        success: true,
        data: result.data,
      });
    }
  );

  // Backward compatibility alias for DELETE /me
  fastify.delete(
    '/me',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Users'],
        summary: 'Delete current user account and data (Immediate)',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            password: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const body = (request.body as { password?: string }) || {};
      try {
        await dataService.deleteUserAccount(request.user.id, body.password);
        await dataService.logAudit({
          actorUserId: request.user.id,
          eventType: AUDIT_EVENTS.USER_ACCOUNT_DELETED,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        });
        return reply.send({
          success: true,
          message: 'Account and associated data successfully deleted.',
        });
      } catch (err: any) {
        if (err.code === 'INVALID_CREDENTIALS') {
          return reply.status(401).send({
            success: false,
            error: {
              code: ERROR_CODES.INVALID_CREDENTIALS,
              message: err.message || 'Incorrect password.',
            },
          });
        }
        throw err;
      }
    }
  );

  // ==========================================
  // Official Phone Verification & Contact APIs
  // ==========================================

  // 1. GET /api/v1/users/me/contact
  fastify.get(
    '/me/contact',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Users', 'Contact'],
        summary: 'Get current user contact details and phone verification status',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      try {
        const contact = await dataService.getUserContact(request.user.id);
        return reply.send({
          success: true,
          data: contact,
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'FETCH_CONTACT_FAILED',
            message: err.message || 'Failed to fetch contact details.',
          },
        });
      }
    }
  );

  // 2. PATCH /api/v1/users/me/contact
  fastify.patch(
    '/me/contact',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Users', 'Contact'],
        summary: 'Update user contact details (phone, country, state, city, security preferences)',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            phone: { type: 'string' },
            phoneVisibility: { type: 'string', enum: ['private', 'workspace'] },
            country: { type: 'string' },
            state: { type: 'string' },
            stateCode: { type: 'string' },
            lga: { type: 'string' },
            city: { type: 'string' },
            timezone: { type: 'string' },
            phoneUsedForRecovery: { type: 'boolean' },
            phoneUsedForMfa: { type: 'boolean' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const body = request.body as any;
        await dataService.updateUserContact(request.user.id, body, request.ip, request.headers['user-agent']);
        const updated = await dataService.getUserContact(request.user.id);
        const freshUser = await dataService.getUserById(request.user.id);
        return reply.send({
          success: true,
          message: 'Contact details updated successfully.',
          data: updated,
          user: toPublicUser(freshUser),
        });
      } catch (err: any) {
        const status = err.message?.includes('PHONE_NOT_VERIFIED') ? 403 : 400;
        return reply.status(status).send({
          success: false,
          error: {
            code: err.message?.includes('PHONE_NOT_VERIFIED') ? 'PHONE_NOT_VERIFIED' : 'UPDATE_CONTACT_FAILED',
            message: err.message || 'Failed to update contact details.',
          },
        });
      }
    }
  );

  // 3. POST /api/v1/users/me/phone/verification/start
  fastify.post(
    '/me/phone/verification/start',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Users', 'Phone Verification'],
        summary: 'Start phone verification and send 6-digit OTP code',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            phone: { type: 'string' },
            purpose: { type: 'string', default: 'user_phone_verification' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const body = (request.body as { phone?: string; purpose?: string }) || {};
        const challenge = await dataService.startUserPhoneVerification(
          request.user.id,
          body.phone,
          body.purpose || 'user_phone_verification',
          request.ip,
          request.headers['user-agent']
        );
        return reply.send({
          success: true,
          message: `Verification code sent to ${challenge.phoneNormalized}.`,
          data: {
            challengeId: challenge.challengeId,
            phoneNormalized: challenge.phoneNormalized,
            expiresAt: challenge.expiresAt,
            isDevMock: challenge.isDevMock,
            provider: challenge.provider,
          },
        });
      } catch (err: any) {
        const msg = err.message || '';
        const isRateLimit = msg.includes('RATE_LIMIT_EXCEEDED');
        const isSamePhone = msg.includes('SAME_PHONE_NUMBER');
        const isPhoneInUse = msg.includes('PHONE_ALREADY_IN_USE');

        let statusCode = 400;
        let errorCode = 'VERIFICATION_START_FAILED';
        let userMessage = msg || 'Failed to start phone verification.';

        if (isRateLimit) {
          statusCode = 429;
          errorCode = 'RATE_LIMIT_EXCEEDED';
        } else if (isSamePhone) {
          statusCode = 400;
          errorCode = 'SAME_PHONE_NUMBER';
          userMessage = 'New phone number cannot be the same as your current verified number.';
        } else if (isPhoneInUse) {
          statusCode = 409;
          errorCode = 'PHONE_ALREADY_IN_USE';
          userMessage = 'This phone number is already associated with another account.';
        }

        return reply.status(statusCode).send({
          success: false,
          error: {
            code: errorCode,
            message: userMessage,
          },
        });
      }
    }
  );

  // 4. POST /api/v1/users/me/phone/verification/verify
  fastify.post(
    '/me/phone/verification/verify',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Users', 'Phone Verification'],
        summary: 'Verify 6-digit OTP code',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['code'],
          properties: {
            code: { type: 'string', minLength: 6, maxLength: 6 },
            purpose: { type: 'string', default: 'user_phone_verification' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const body = request.body as { code: string; purpose?: string };
        const result = await dataService.verifyUserPhone(
          request.user.id,
          body.code,
          body.purpose || 'user_phone_verification',
          request.ip,
          request.headers['user-agent']
        );

        if (!result.success) {
          return reply.status(400).send({
            success: false,
            error: {
              code: result.error || 'INVALID_CODE',
              message: 'Invalid verification code.',
              attemptsRemaining: result.attemptsRemaining,
            },
          });
        }

        const freshUser = await dataService.getUserById(request.user.id);
        return reply.send({
          success: true,
          message: 'Phone number verified successfully!',
          data: {
            ...result,
            user: freshUser ? toPublicUser(freshUser) : undefined,
          },
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VERIFICATION_FAILED',
            message: err.message || 'Failed to verify phone code.',
          },
        });
      }
    }
  );

  // 5. POST /api/v1/users/me/phone/verification/resend
  fastify.post(
    '/me/phone/verification/resend',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Users', 'Phone Verification'],
        summary: 'Resend phone verification OTP code with cooldown and rate limit checks',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            purpose: { type: 'string', default: 'user_phone_verification' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const body = (request.body as { purpose?: string }) || {};
        const result = await dataService.resendUserPhoneVerification(
          request.user.id,
          body.purpose || 'user_phone_verification',
          request.ip,
          request.headers['user-agent']
        );
        return reply.send({
          success: true,
          message: `New verification code sent to ${result.phoneNormalized}.`,
          data: result,
        });
      } catch (err: any) {
        const isCooldown = err.message?.includes('COOLDOWN_ACTIVE');
        const isLimit = err.message?.includes('RESEND_LIMIT_EXCEEDED');
        const status = isCooldown ? 429 : isLimit ? 429 : 400;
        return reply.status(status).send({
          success: false,
          error: {
            code: isCooldown ? 'COOLDOWN_ACTIVE' : isLimit ? 'RESEND_LIMIT_EXCEEDED' : 'RESEND_FAILED',
            message: err.message || 'Failed to resend verification code.',
          },
        });
      }
    }
  );

  // 6. DELETE /api/v1/users/me/phone
  fastify.delete(
    '/me/phone',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Users', 'Phone'],
        summary: 'Remove personal phone number and unlink from recovery/MFA',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      try {
        await dataService.removeUserPhone(request.user.id, request.ip, request.headers['user-agent']);
        return reply.send({
          success: true,
          message: 'Phone number removed successfully.',
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'REMOVE_PHONE_FAILED',
            message: err.message || 'Failed to remove phone number.',
          },
        });
      }
    }
  );
};


