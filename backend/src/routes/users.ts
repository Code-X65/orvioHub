import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { dataService } from '../services/dataService.js';
import { smsService } from '../services/smsService.js';
import { validateNigerianPhone } from '../utils/phoneValidation.js';
import { ERROR_CODES, AUDIT_EVENTS } from '../config/constants.js';
import { toPublicUser } from '../utils/userSerializer.js';
import { parseUserAgent } from '../utils/userAgentParser.js';

const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  firstName: z.string().min(1, 'First name is required').optional(),
  lastName: z.string().min(1, 'Last name is required').optional(),
  displayName: z.string().optional(),
  preferredName: z.string().optional(),
  jobTitle: z.string().optional(),
  department: z.string().optional(),
  bio: z.string().max(500, 'Bio must be under 500 characters').optional(),
  avatar: z.string().optional().nullable(),
  avatarUrl: z.string().optional().nullable(),
  phone: z.string().optional(),
  country: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  timezone: z.string().optional(),
  locale: z.string().optional(),
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
        });
      }

      const updatedUser = await dataService.updateProfile(request.user.id, parsed.data);
      await dataService.logAudit({
        actorUserId: request.user.id,
        eventType: AUDIT_EVENTS.USER_PROFILE_UPDATED,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: { updatedFields: Object.keys(parsed.data) },
      });

      return reply.send({
        success: true,
        data: { user: toPublicUser(updatedUser) },
        message: 'Personal profile updated successfully.',
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

  // 5. PATCH /api/v1/users/me/contact
  fastify.patch(
    '/me/contact',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Users'],
        summary: 'Update contact info and regional location',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const parsed = updateContactSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Invalid contact parameters',
          },
        });
      }

      const updatedUser = await dataService.updateContact(request.user.id, parsed.data);
      await dataService.logAudit({
        actorUserId: request.user.id,
        eventType: AUDIT_EVENTS.USER_PROFILE_UPDATED,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: { updatedContact: Object.keys(parsed.data) },
      });

      return reply.send({
        success: true,
        data: { user: toPublicUser(updatedUser) },
        message: 'Contact details updated successfully.',
      });
    }
  );

  // 6. POST /api/v1/users/me/phone/verify (Send OTP or verify OTP)
  fastify.post(
    '/me/phone/verify',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Users'],
        summary: 'Request phone verification OTP or confirm code',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['request_otp', 'verify_code'] },
            phone: { type: 'string' },
            code: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as { action?: 'request_otp' | 'verify_code'; phone?: string; code?: string };

      if (body.action === 'request_otp' || (!body.code && body.phone)) {
        if (!body.phone) {
          return reply.status(400).send({
            success: false,
            error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Phone number is required.' },
          });
        }
        const res = await dataService.requestPhoneOtp(request.user.id, body.phone);
        return reply.send({
          success: true,
          message: 'Verification OTP sent.',
          data: res,
        });
      }

      if (body.action === 'verify_code' || body.code) {
        if (!body.code) {
          return reply.status(400).send({
            success: false,
            error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Verification code is required.' },
          });
        }
        try {
          const user = await dataService.verifyPhoneOtp(request.user.id, body.code.trim());
          await dataService.logAudit({
            actorUserId: request.user.id,
            eventType: AUDIT_EVENTS.USER_PHONE_CHANGED,
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
            metadata: { phone: user?.phone, verified: true },
          });
          return reply.send({
            success: true,
            message: 'Phone number verified successfully.',
            data: { user },
          });
        } catch (err: any) {
          return reply.status(400).send({
            success: false,
            error: {
              code: ERROR_CODES.INVALID_PHONE_VERIFICATION_CODE,
              message: 'Invalid or expired phone verification code.',
            },
          });
        }
      }

      return reply.status(400).send({
        success: false,
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Invalid action specified.' },
      });
    }
  );

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
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as {
        currentPassword: string;
        newPassword: string;
        revokeOtherSessions?: boolean;
      };

      try {
        await dataService.changePassword(request.user.id, body.currentPassword, body.newPassword);
        
        if (body.revokeOtherSessions) {
          const currentSessionId = request.sessionId || (request.user as any)?.sessionId;
          await dataService.revokeAllOtherSessions(request.user.id, currentSessionId);
        }

        await dataService.logAudit({
          actorUserId: request.user.id,
          eventType: AUDIT_EVENTS.USER_PASSWORD_CHANGED,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        });

        return reply.send({
          success: true,
          message: 'Password changed successfully.',
        });
      } catch (err: any) {
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

  // 21. POST /api/v1/users/me/deletion-request
  fastify.post(
    '/me/deletion-request',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Users'],
        summary: 'Request account deletion with optional cooling off period',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            reason: { type: 'string' },
            password: { type: 'string' },
            coolingOffDays: { type: 'number' },
          },
        },
      },
    },
    async (request, reply) => {
      const body = (request.body as { reason?: string; password?: string; coolingOffDays?: number }) || {};

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
          body.coolingOffDays ?? 14
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
          data: { deletionRequest: deletionReq },
          message: 'Account deletion scheduled. You may cancel it during the cooling-off period.',
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
        throw err;
      }
    }
  );

  // 22. POST /api/v1/users/me/deletion-request/cancel
  fastify.post(
    '/me/deletion-request/cancel',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Users'],
        summary: 'Cancel pending account deletion request',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
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
    }
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
  // USER PHONE VERIFICATION (PHASE 2)
  // ==========================================

  // 17. GET /api/v1/users/me/phones
  fastify.get(
    '/me/phones',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Users', 'Phone'],
        summary: 'List all phone numbers for current user',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const phones = await dataService.getUserPhones(request.user.id);
      return reply.send({
        success: true,
        data: { phones },
        phones,
      });
    }
  );

  // 18. POST /api/v1/users/me/phones/send-otp
  fastify.post(
    '/me/phones/send-otp',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Users', 'Phone'],
        summary: 'Send a 6-digit verification code to a Nigerian phone number',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['phone'],
          properties: {
            phone: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as { phone: string };
      const validation = validateNigerianPhone(body.phone);

      if (!validation.valid || !validation.normalized) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_PHONE_NUMBER',
            message: validation.error || 'Invalid Nigerian phone number format.',
          },
        });
      }

      // Check rate limit (max 3 OTPs per hour per phone)
      const recentCount = await dataService.countRecentPhoneOtps(
        request.user.id,
        validation.normalized,
        60
      );

      if (recentCount >= 3) {
        return reply.status(429).send({
          success: false,
          error: {
            code: 'TOO_MANY_REQUESTS',
            message: 'Too many OTP requests for this phone number. Please wait 1 hour before trying again.',
          },
        });
      }

      // Generate 6-digit numeric OTP code
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpHash = await bcrypt.hash(otp, 10);
      const codeExpiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes expiry

      // Save / update phone record
      const result = await dataService.saveUserPhoneOtp({
        userId: request.user.id,
        phone: validation.formatted || body.phone,
        phoneNormalized: validation.normalized,
        verificationCode: otpHash,
        codeExpiresAt,
      });

      // Send SMS
      await smsService.sendOtp(validation.normalized, otp);

      await dataService.logAudit({
        actorUserId: request.user.id,
        eventType: AUDIT_EVENTS.USER_PHONE_ADDED,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: { phone: validation.formatted },
      });

      return reply.send({
        success: true,
        message: `Verification code sent to ${validation.formatted || validation.normalized}.`,
        data: {
          phoneId: result.phoneId,
          normalizedPhone: validation.normalized,
          expiresInSeconds: 600,
        },
      });
    }
  );

  // 19. POST /api/v1/users/me/phones/verify-otp
  fastify.post(
    '/me/phones/verify-otp',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Users', 'Phone'],
        summary: 'Verify OTP code and mark phone number as verified',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['phone', 'otp'],
          properties: {
            phone: { type: 'string' },
            otp: { type: 'string', minLength: 6, maxLength: 6 },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as { phone: string; otp: string };
      const validation = validateNigerianPhone(body.phone);

      if (!validation.valid || !validation.normalized) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_PHONE_NUMBER',
            message: validation.error || 'Invalid phone number format.',
          },
        });
      }

      const phoneRecord = await dataService.getUserPhoneRecord(request.user.id, validation.normalized);

      if (!phoneRecord) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'PHONE_NOT_FOUND',
            message: 'Phone record not found. Please request a new verification code first.',
          },
        });
      }

      // Check code expiration
      if (phoneRecord.codeExpiresAt && Date.now() > phoneRecord.codeExpiresAt) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'OTP_EXPIRED',
            message: 'The verification code has expired. Please request a new code.',
          },
        });
      }

      // Verify OTP hash
      if (!phoneRecord.verificationCode) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'OTP_INVALID',
            message: 'No active verification code found for this phone.',
          },
        });
      }

      const isMatch = await bcrypt.compare(body.otp.trim(), phoneRecord.verificationCode);
      if (!isMatch) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'OTP_INVALID',
            message: 'Incorrect verification code. Please check and try again.',
          },
        });
      }

      // Mark verified
      const verifiedResult = await dataService.verifyUserPhone(phoneRecord._id);

      await dataService.logAudit({
        actorUserId: request.user.id,
        eventType: AUDIT_EVENTS.USER_PHONE_VERIFIED,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: { phoneId: phoneRecord._id, phone: validation.formatted },
      });

      return reply.send({
        success: true,
        message: 'Phone number verified successfully!',
        data: verifiedResult,
      });
    }
  );

  // 20. POST /api/v1/users/me/phones/:phoneId/set-primary
  fastify.post(
    '/me/phones/:phoneId/set-primary',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Users', 'Phone'],
        summary: 'Set a verified phone as primary',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['phoneId'],
          properties: {
            phoneId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { phoneId } = request.params as { phoneId: string };
      try {
        const result = await dataService.setUserPrimaryPhone(request.user.id, phoneId);
        return reply.send({
          success: true,
          message: 'Primary phone updated successfully.',
          data: result,
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'SET_PRIMARY_FAILED',
            message: err.message || 'Failed to set phone as primary.',
          },
        });
      }
    }
  );

  // 21. DELETE /api/v1/users/me/phones/:phoneId
  fastify.delete(
    '/me/phones/:phoneId',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Users', 'Phone'],
        summary: 'Delete a phone number',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['phoneId'],
          properties: {
            phoneId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { phoneId } = request.params as { phoneId: string };
      try {
        const result = await dataService.deleteUserPhone(request.user.id, phoneId);
        await dataService.logAudit({
          actorUserId: request.user.id,
          eventType: AUDIT_EVENTS.USER_PHONE_REMOVED,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          metadata: { phoneId },
        });
        return reply.send({
          success: true,
          message: 'Phone number removed successfully.',
          data: result,
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'DELETE_PHONE_FAILED',
            message: err.message || 'Failed to delete phone number.',
          },
        });
      }
    }
  );
};
