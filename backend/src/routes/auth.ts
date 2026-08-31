import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { dataService } from '../services/dataService.js';
import { oauthService } from '../services/oauth.js';
import { env } from '../config/env.js';
import { getAccountsUrl } from '@orviohub/shared';
import { ERROR_CODES, AUDIT_EVENTS, PRODUCT_CATALOG, type ProductKey } from '../config/constants.js';
import { setAuthCookies, clearAuthCookies } from '../utils/cookies.js';
import { toPublicUser } from '../utils/userSerializer.js';

const accountsBaseUrl = () => {
  try {
    return getAccountsUrl(env.NODE_ENV === 'production' ? 'production' : 'development');
  } catch {
    return env.APP_URL;
  }
};

const COMMON_WEAK_PASSWORDS = new Set([
  'password',
  'password123',
  '12345678',
  'qwerty123',
  'admin123',
  'welcome123',
  'letmein123',
  '123456789',
]);

export const strongPasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character')
  .refine((val) => !COMMON_WEAK_PASSWORDS.has(val.toLowerCase()), {
    message: 'Password is too common or easily guessable',
  });

const signupSchema = z
  .object({
    email: z.string().email('Invalid email address'),
    name: z.string().min(2, 'Name must be at least 2 characters').optional(),
    firstName: z.string().min(1, 'First name must be at least 1 character').optional(),
    lastName: z.string().min(1, 'Last name must be at least 1 character').optional(),
    displayName: z.string().optional(),
    country: z.string().optional(),
    timezone: z.string().optional(),
    locale: z.string().optional(),
    phone: z.string().optional(),
    password: strongPasswordSchema,
    passwordConfirmation: z.string().optional(),
    acceptTerms: z.boolean().optional(),
    acceptPrivacy: z.boolean().optional(),
    marketingConsent: z.boolean().optional(),
  })
  .refine(
    (data) => Boolean(data.name || (data.firstName && data.lastName) || data.firstName),
    {
      message: 'Name or first name is required',
      path: ['name'],
    }
  );

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const resendVerificationSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: strongPasswordSchema,
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: strongPasswordSchema,
});

export const updateProfileSchema = z.object({
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
  phoneVisibility: z.enum(['private', 'workspace']).optional(),
  country: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  timezone: z.string().optional(),
  language: z.string().optional(),
  locale: z.string().optional(),
  dateFormat: z.string().optional(),
  numberFormat: z.string().optional(),
  currencyPreference: z.string().optional(),
  firstDayOfWeek: z.enum(['monday', 'sunday']).optional(),
  theme: z.enum(['dark', 'light', 'system']).optional(),
  layoutDensity: z.enum(['compact', 'comfortable']).optional(),
});

const requestEmailChangeSchema = z.object({
  newEmail: z.string().email('Invalid email address'),
});

const confirmEmailChangeSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const verifyTwoFactorSchema = z.object({
  code: z.string().min(1, 'Verification code is required'),
});

const disableTwoFactorSchema = z.object({
  password: z.string().optional(),
});

const loginTwoFactorSchema = z.object({
  tempToken: z.string().min(1, 'Temporary token is required'),
  code: z.string().min(1, 'Verification code or backup code is required'),
});

const oauthAuthorizeSchema = z.object({
  product: z.string().optional(),
  productKey: z.string().optional(),
  redirect_uri: z.string().url('Invalid redirect_uri format'),
  response_type: z.literal('code'),
  state: z.string().optional(),
  code_challenge: z.string().optional(),
  code_challenge_method: z.enum(['S256', 'plain']).optional(),
});

const oauthTokenSchema = z.object({
  grant_type: z.literal('authorization_code'),
  code: z.string().min(1, 'Authorization code is required'),
  redirect_uri: z.string().url('Invalid redirect_uri format'),
  code_verifier: z.string().optional(),
});

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/v1/auth/refresh
  fastify.post(
    '/refresh',
    {
      config: {
        rateLimit: { max: 15, timeWindow: '1 minute' },
      },
      schema: {
        tags: ['Auth'],
        summary: 'Refresh short-lived access token using rotating refresh token',
        body: {
          type: 'object',
          // refreshToken is optional in body — can also be provided via orvio_refresh_token cookie
          properties: {
            refreshToken: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      // Accept refresh token from body (primary) or wildcard cookie (cross-subdomain fallback).
      // The orvio_refresh_token cookie is shared across all *.orviohub.* subdomains, so any
      // surface (e.g. marketing root domain, where localStorage is isolated) can silently refresh.
      const bodyToken = (request.body as any)?.refreshToken as string | undefined;
      const cookieToken = request.cookies?.orvio_refresh_token;
      const refreshTokenValue = bodyToken || cookieToken;

      if (!refreshTokenValue) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Refresh token is required (body or cookie).',
          },
        });
      }

      try {
        const userAgent = request.headers['user-agent'];
        const ipAddress = request.ip;
        const result = await dataService.rotateSession(refreshTokenValue, userAgent, ipAddress);

        const accessToken = fastify.jwt.sign({
          userId: result.user.id,
          email: result.user.email,
          tokenVersion: result.user.tokenVersion ?? 0,
        });

        setAuthCookies(reply, { token: accessToken, refreshToken: result.refreshToken });

        return reply.send({
          success: true,
          data: {
            token: accessToken,
            refreshToken: result.refreshToken,
            user: {
              id: result.user.id,
              email: result.user.email,
              name: result.user.name,
              emailVerified: result.user.emailVerified,
            },
          },
        });
      } catch (err: any) {
        if (err.code === 'INVALID_TOKEN' || err.code === 'SESSION_INVALIDATED' || err.code === 'USER_NOT_ACTIVE') {
          return reply.status(401).send({
            success: false,
            error: {
              code: ERROR_CODES.UNAUTHENTICATED,
              message: 'Invalid or expired session. Please sign in again.',
            },
          });
        }
        if (err.code === 'TOKEN_EXPIRED') {
          return reply.status(401).send({
            success: false,
            error: {
              code: ERROR_CODES.TOKEN_EXPIRED,
              message: 'Refresh token has expired. Please sign in again.',
            },
          });
        }
        if (err.code === 'SESSION_REVOKED') {
          return reply.status(401).send({
            success: false,
            error: {
              code: ERROR_CODES.UNAUTHENTICATED,
              message: 'Security alert: Session was already revoked. Please sign in again.',
            },
          });
        }
        throw err;
      }
    }
  );

  // POST /api/v1/auth/signup
  fastify.post(
    '/signup',
    {
      config: {
        rateLimit: { max: 10, timeWindow: '1 minute' },
      },
      schema: {
        tags: ['Auth'],
        summary: 'Create a new user account',
        description: 'Registers a new user and initializes the onboarding lifecycle at EMAIL_VERIFICATION.',
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            name: { type: 'string' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            displayName: { type: 'string' },
            country: { type: 'string' },
            phone: { type: 'string' },
            password: { type: 'string', minLength: 8 },
            acceptTerms: { type: 'boolean' },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = signupSchema.safeParse(request.body);
      if (!parsed.success) {
        const fields: Record<string, string> = {};
        parsed.error.errors.forEach((err) => {
          if (err.path[0]) fields[String(err.path[0])] = err.message;
        });
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Please correct the highlighted fields.',
            fields,
          },
        });
      }

      try {
        const { user } = await dataService.createUser(parsed.data);
        const session = await dataService.createSession(user.id, {
          userAgent: request.headers['user-agent'],
          ipAddress: request.ip,
          authenticationMethod: 'password',
          tokenVersion: user.tokenVersion ?? 1,
        });
        const jwtToken = fastify.jwt.sign(
          {
            userId: user.id,
            email: user.email,
            sessionId: session.sessionId,
            tokenVersion: user.tokenVersion ?? 1,
          },
          { expiresIn: '15m' }
        );

        await dataService.logAudit({
          actorUserId: user.id,
          eventType: AUDIT_EVENTS.AUTH_SIGNUP_COMPLETED,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        });

        setAuthCookies(reply, { token: jwtToken, refreshToken: session.refreshToken });

        return reply.status(201).send({
          success: true,
          data: {
            user: toPublicUser(user),
            token: jwtToken,
            refreshToken: session.refreshToken,
            onboarding: {
              status: 'IN_PROGRESS',
              currentStep: 'EMAIL_VERIFICATION',
            },
          },
        });
      } catch (err: any) {
        if (err.code === 'USER_ALREADY_EXISTS') {
          return reply.status(409).send({
            success: false,
            error: {
              code: ERROR_CODES.CONFLICT,
              message: 'An account with this email address already exists.',
            },
          });
        }
        throw err;
      }
    }
  );

  // POST /api/v1/auth/login
  fastify.post(
    '/login',
    {
      config: {
        rateLimit: { max: 5, timeWindow: '15 minutes' },
      },
      schema: {
        tags: ['Auth'],
        summary: 'Authenticate with email and password',
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string' },
            password: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = loginSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Invalid email or password format.',
          },
        });
      }

      const user = await dataService.getUserByEmail(parsed.data.email);
      if (!user) {
        await dataService.logAudit({
          eventType: AUDIT_EVENTS.AUTH_LOGIN_FAILED,
          severity: 'warning',
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          metadata: { email: parsed.data.email },
        });
        return reply.status(401).send({
          success: false,
          error: {
            code: ERROR_CODES.UNAUTHENTICATED,
            message: 'Invalid email or password.',
          },
        });
      }

      // Check if account is temporarily locked
      if (user.lockedUntil && user.lockedUntil > Date.now()) {
        const remainingMinutes = Math.ceil((user.lockedUntil - Date.now()) / (60 * 1000));
        return reply.status(429).send({
          success: false,
          error: {
            code: 'ACCOUNT_LOCKED',
            message: `Account is temporarily locked due to 5 consecutive failed login attempts. Please try again in ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}, or reset your password.`,
            lockedUntil: user.lockedUntil,
            remainingMinutes,
          },
        });
      }

      const isMatch = await dataService.verifyPassword(user, parsed.data.password);
      if (!isMatch) {
        const failedResult = await dataService.recordFailedLogin(user.id);
        if (failedResult.isLocked) {
          await dataService.logAudit({
            actorUserId: user.id,
            eventType: AUDIT_EVENTS.AUTH_LOGIN_FAILED,
            severity: 'critical',
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
            metadata: { email: parsed.data.email, accountLocked: true, lockedUntil: failedResult.lockedUntil },
          });
          return reply.status(429).send({
            success: false,
            error: {
              code: 'ACCOUNT_LOCKED',
              message: 'Account locked due to 5 consecutive failed attempts. Please try again in 15 minutes or reset your password.',
              lockedUntil: failedResult.lockedUntil,
              remainingMinutes: 15,
            },
          });
        }

        await dataService.logAudit({
          actorUserId: user.id,
          eventType: AUDIT_EVENTS.AUTH_LOGIN_FAILED,
          severity: 'warning',
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          metadata: { email: parsed.data.email, failedAttempts: failedResult.failedAttempts },
        });
        return reply.status(401).send({
          success: false,
          error: {
            code: ERROR_CODES.UNAUTHENTICATED,
            message: 'Invalid email or password.',
          },
        });
      }

      // Successful password verification: reset failure counters
      await dataService.resetFailedLogins(user.id);

      if (user.twoFactorEnabled) {
        const tempToken = fastify.jwt.sign(
          { userId: user.id, email: user.email, is2faPending: true },
          { expiresIn: '5m' }
        );
        return reply.send({
          success: true,
          data: {
            twoFactorRequired: true,
            tempToken,
          },
        });
      }

      await dataService.touchLastLogin(user.id);
      const session = await dataService.createSession(user.id, {
        userAgent: request.headers['user-agent'],
        ipAddress: request.ip,
        authenticationMethod: 'password',
        tokenVersion: user.tokenVersion ?? 1,
      });
      const jwtToken = fastify.jwt.sign(
        {
          userId: user.id,
          email: user.email,
          sessionId: session.sessionId,
          tokenVersion: user.tokenVersion ?? 1,
        },
        { expiresIn: '15m' }
      );
      const status = await dataService.getOnboardingStatus(user.id);

      await dataService.logAudit({
        actorUserId: user.id,
        eventType: AUDIT_EVENTS.AUTH_LOGIN_SUCCESS,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });

      setAuthCookies(reply, { token: jwtToken, refreshToken: session.refreshToken });

      return reply.send({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            firstName: user.firstName,
            lastName: user.lastName,
            displayName: user.displayName || user.name,
            country: user.country,
            emailVerified: user.emailVerified,
            twoFactorEnabled: user.twoFactorEnabled,
          },
          token: jwtToken,
          refreshToken: session.refreshToken,
          onboarding: status,
        },
      });
    }
  );

  // POST /api/v1/auth/2fa/enable (and alias /2fa/enable-start)
  const enableTwoFactorHandler = async (request: any, reply: any) => {
    const data = await dataService.enableTwoFactorStart(request.user.id);
    return reply.send({
      success: true,
      data,
    });
  };
  fastify.post('/2fa/enable', { preHandler: [fastify.authenticate] }, enableTwoFactorHandler);
  fastify.post('/2fa/enable-start', { preHandler: [fastify.authenticate] }, enableTwoFactorHandler);

  // POST /api/v1/auth/2fa/verify (and alias /2fa/enable-verify)
  const verifyTwoFactorHandler = async (request: any, reply: any) => {
    const parsed = verifyTwoFactorSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: '6-digit verification code is required.',
        },
      });
    }

    try {
      const result = await dataService.verifyAndActivateTwoFactor(request.user.id, parsed.data.code);
      return reply.send({
        success: true,
        data: {
          backupCodes: result.backupCodes,
        },
        message: 'Two-factor authentication successfully enabled.',
      });
    } catch (err: any) {
      if (err.code === 'INVALID_2FA_CODE') {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.INVALID_2FA_CODE,
            message: 'Invalid verification code. Please check your authenticator app and try again.',
          },
        });
      }
      throw err;
    }
  };
  fastify.post('/2fa/verify', { preHandler: [fastify.authenticate] }, verifyTwoFactorHandler);
  fastify.post('/2fa/enable-verify', { preHandler: [fastify.authenticate] }, verifyTwoFactorHandler);

  // POST /api/v1/auth/2fa/disable
  fastify.post(
    '/2fa/disable',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Auth'],
        summary: 'Disable two-factor authentication with password verification',
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
      const parsed = disableTwoFactorSchema.safeParse(request.body);
      try {
        await dataService.disableTwoFactor(request.user.id, parsed.success ? parsed.data.password : undefined);
        return reply.send({
          success: true,
          message: 'Two-factor authentication successfully disabled.',
        });
      } catch (err: any) {
        if (err.code === 'INVALID_CREDENTIALS') {
          return reply.status(401).send({
            success: false,
            error: {
              code: ERROR_CODES.INVALID_CREDENTIALS,
              message: 'Incorrect password.',
            },
          });
        }
        throw err;
      }
    }
  );

  // POST /api/v1/auth/2fa/login-verify
  fastify.post(
    '/2fa/login-verify',
    {
      config: {
        rateLimit: { max: 10, timeWindow: '15 minutes' },
      },
      schema: {
        tags: ['Auth'],
        summary: 'Verify 2FA TOTP or backup code during login challenge',
        body: {
          type: 'object',
          required: ['tempToken', 'code'],
          properties: {
            tempToken: { type: 'string' },
            code: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = loginTwoFactorSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Temporary token and verification code are required.',
          },
        });
      }

      let decoded: { userId: string; email: string; is2faPending?: boolean };
      try {
        decoded = fastify.jwt.verify(parsed.data.tempToken);
        if (!decoded.is2faPending || !decoded.userId) {
          throw new Error('Invalid temporary token.');
        }
      } catch {
        return reply.status(401).send({
          success: false,
          error: {
            code: ERROR_CODES.INVALID_TOKEN,
            message: 'Invalid or expired 2FA session token. Please sign in again.',
          },
        });
      }

      try {
        const { user, usedBackupCode } = await dataService.verifyTwoFactorLogin(decoded.userId, parsed.data.code);

        const accessToken = fastify.jwt.sign({
          userId: user.id,
          email: user.email,
          tokenVersion: user.tokenVersion ?? 0,
        });
        const session = await dataService.createSession(
          user.id,
          request.headers['user-agent'],
          request.ip,
          user.tokenVersion ?? 0
        );
        const status = await dataService.getOnboardingStatus(user.id);

        setAuthCookies(reply, { token: accessToken, refreshToken: session.refreshToken });

        return reply.send({
          success: true,
          data: {
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              emailVerified: user.emailVerified,
              twoFactorEnabled: user.twoFactorEnabled,
            },
            token: accessToken,
            refreshToken: session.refreshToken,
            onboarding: status,
            usedBackupCode: !!usedBackupCode,
          },
        });
      } catch (err: any) {
        if (err.code === 'INVALID_2FA_CODE') {
          return reply.status(400).send({
            success: false,
            error: {
              code: ERROR_CODES.INVALID_2FA_CODE,
              message: 'Invalid verification code or backup code. Please try again.',
            },
          });
        }
        throw err;
      }
    }
  );

  // POST /api/v1/auth/resend-verification
  fastify.post(
    '/resend-verification',
    {
      config: {
        rateLimit: { max: 5, timeWindow: '1 minute' },
      },
      schema: {
        tags: ['Auth'],
        summary: 'Resend email verification link',
        body: {
          type: 'object',
          required: ['email'],
          properties: {
            email: { type: 'string', format: 'email' },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = resendVerificationSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'A valid email address is required.',
          },
        });
      }

      try {
        await dataService.resendVerificationEmail(parsed.data.email);
        return reply.send({
          success: true,
          message: 'If an account exists with this email, a new verification link has been sent.',
        });
      } catch {
        return reply.send({
          success: true,
          message: 'If an account exists with this email, a new verification link has been sent.',
        });
      }
    }
  );

  // POST /api/v1/auth/verify-email
  fastify.post(
    '/verify-email',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Verify user email address using token',
        body: {
          type: 'object',
          required: ['token'],
          properties: {
            token: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = verifyEmailSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Verification token is required.',
          },
        });
      }

      try {
        const { user } = await dataService.verifyEmail(parsed.data.token);
        const jwtToken = fastify.jwt.sign({ userId: user.id, email: user.email, tokenVersion: user.tokenVersion ?? 0 });
        const session = await dataService.createSession(user.id, request.headers['user-agent'], request.ip);

        setAuthCookies(reply, { token: jwtToken, refreshToken: session.refreshToken });

        return reply.send({
          success: true,
          data: {
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              emailVerified: user.emailVerified,
            },
            token: jwtToken,
            refreshToken: session.refreshToken,
            onboarding: {
              currentStep: 'ORGANIZATION_CREATION',
              status: 'IN_PROGRESS',
            },
          },
          message: 'Email successfully verified. You can now create your organization.',
        });
      } catch (err: any) {
        const msg = err.message || '';
        if (err.code === 'INVALID_TOKEN' || msg.includes('INVALID_TOKEN')) {
          return reply.status(400).send({
            success: false,
            error: {
              code: ERROR_CODES.VALIDATION_ERROR,
              message: 'Invalid or already used verification token.',
            },
          });
        }
        if (err.code === 'TOKEN_EXPIRED' || msg.includes('TOKEN_EXPIRED')) {
          return reply.status(400).send({
            success: false,
            error: {
              code: ERROR_CODES.VALIDATION_ERROR,
              message: 'Verification token has expired. Please request a new one.',
            },
          });
        }
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: msg || 'Failed to verify email.',
          },
        });
      }
    }
  );

  // GET /api/v1/auth/me
  fastify.get(
    '/me',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Auth'],
        summary: 'Get current authenticated user session',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const freshUser = await dataService.getUserById(request.user.id);
      const userToSerialize = freshUser || request.user;
      const memberships = await dataService.getUserMemberships(request.user.id);
      const status = await dataService.getOnboardingStatus(request.user.id);

      const jwtToken = fastify.jwt.sign({
        userId: request.user.id,
        email: request.user.email,
        sessionId: request.sessionId,
        tokenVersion: userToSerialize.tokenVersion ?? 0,
      });
      setAuthCookies(reply, { token: jwtToken });

      return reply.send({
        success: true,
        data: {
          token: jwtToken,
          user: toPublicUser(userToSerialize),
          memberships: memberships.map((m) => ({
            organization: {
              id: m.organization.id,
              name: m.organization.name,
              slug: m.organization.slug,
            },
            role: m.membership.role,
            status: m.membership.status,
          })),
          onboarding: status,
        },
      });
    }
  );

  // GET /api/v1/auth/session
  fastify.get(
    '/session',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Auth'],
        summary: 'Get active session details and authentication context',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      return reply.send({
        success: true,
        data: {
          user: {
            id: request.user.id,
            email: request.user.email,
            name: request.user.name,
            displayName: request.user.displayName || request.user.name,
            firstName: request.user.firstName,
            lastName: request.user.lastName,
            country: request.user.country,
            timezone: request.user.timezone,
            emailVerified: request.user.emailVerified,
            avatarUrl: request.user.avatarUrl || request.user.avatar,
            twoFactorEnabled: request.user.twoFactorEnabled,
          },
          session: {
            id: request.sessionId,
            tokenVersion: request.user.tokenVersion ?? 1,
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
          },
        },
      });
    }
  );

  // POST /api/v1/auth/logout
  fastify.post(
    '/logout',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Auth'],
        summary: 'Log out current user and invalidate active session tokens',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          nullable: true,
          properties: {
            refreshToken: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const body = (request.body as { refreshToken?: string } | undefined) || {};
      const userId = request.user?.id;
      
      if (userId) {
        await dataService.logoutUser(userId, body.refreshToken);
        await dataService.logAudit({
          actorUserId: userId,
          eventType: AUDIT_EVENTS.AUTH_LOGOUT,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        });
      }

      clearAuthCookies(reply);
      return reply.send({
        success: true,
        message: 'Successfully logged out.',
      });
    }
  );

  // POST /api/v1/auth/logout-all
  fastify.post(
    '/logout-all',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Auth'],
        summary: 'Log out from all devices and revoke all active sessions',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      await dataService.logoutAllSessions(request.user.id);
      await dataService.logAudit({
        actorUserId: request.user.id,
        eventType: AUDIT_EVENTS.AUTH_LOGOUT_ALL,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });
      clearAuthCookies(reply);
      return reply.send({
        success: true,
        message: 'Successfully logged out from all devices.',
      });
    }
  );

  // POST /api/v1/auth/revoke-session
  fastify.post(
    '/revoke-session',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Auth'],
        summary: 'Revoke a specific session',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            sessionId: { type: 'string' },
            refreshToken: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const body = (request.body as { sessionId?: string; refreshToken?: string }) || {};
      if (body.sessionId) {
        await dataService.revokeSessionById(body.sessionId, request.user.id);
      } else if (body.refreshToken) {
        await dataService.revokeSession(body.refreshToken);
      } else {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Either sessionId or refreshToken is required.',
          },
        });
      }
      await dataService.logAudit({
        actorUserId: request.user.id,
        eventType: AUDIT_EVENTS.AUTH_SESSION_REVOKED,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: { sessionId: body.sessionId },
      });
      return reply.send({
        success: true,
        message: 'Session revoked successfully.',
      });
    }
  );

  // PATCH /api/v1/auth/profile
  fastify.patch(
    '/profile',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Auth'],
        summary: 'Update current user profile information',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            avatar: { type: 'string' },
            timezone: { type: 'string' },
            locale: { type: 'string' },
          },
        },
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
            message: 'Please correct the highlighted fields.',
            fields,
          },
        });
      }

      const user = await dataService.updateProfile(request.user.id, parsed.data);
      return reply.send({
        success: true,
        data: { user: toPublicUser(user) },
        message: 'Profile updated successfully.',
      });
    }
  );

  // POST /api/v1/auth/email/change-request
  fastify.post(
    '/email/change-request',
    {
      preHandler: [fastify.authenticate],
      config: {
        rateLimit: { max: 5, timeWindow: '15 minutes' },
      },
      schema: {
        tags: ['Auth'],
        summary: 'Initiate email change verification request',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['newEmail'],
          properties: {
            newEmail: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = requestEmailChangeSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'A valid new email address is required.',
          },
        });
      }

      if (parsed.data.newEmail.toLowerCase().trim() === request.user.email.toLowerCase()) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'New email address must be different from your current email.',
          },
        });
      }

      try {
        await dataService.requestEmailChange(request.user.id, parsed.data.newEmail);
        return reply.send({
          success: true,
          message: 'Confirmation link sent to your new email address.',
        });
      } catch (err: any) {
        if (err.code === 'CONFLICT' || err.code === 'EMAIL_ALREADY_IN_USE') {
          return reply.status(409).send({
            success: false,
            error: {
              code: ERROR_CODES.CONFLICT,
              message: 'This email address is already in use by another account.',
            },
          });
        }
        throw err;
      }
    }
  );

  // POST /api/v1/auth/email/confirm-change
  fastify.post(
    '/email/confirm-change',
    {
      schema: {
        tags: ['Auth'],
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
    async (request, reply) => {
      const parsed = confirmEmailChangeSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Email change token is required.',
          },
        });
      }

      try {
        const { user } = await dataService.confirmEmailChange(parsed.data.token);
        const jwtToken = fastify.jwt.sign({ userId: user.id, email: user.email, tokenVersion: user.tokenVersion ?? 0 });
        const session = await dataService.createSession(user.id, request.headers['user-agent'], request.ip, user.tokenVersion ?? 0);
        return reply.send({
          success: true,
          data: {
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              emailVerified: user.emailVerified,
            },
            token: jwtToken,
            refreshToken: session.refreshToken,
          },
          message: 'Email address updated successfully.',
        });
      } catch (err: any) {
        if (err.code === 'INVALID_TOKEN') {
          return reply.status(400).send({
            success: false,
            error: {
              code: ERROR_CODES.INVALID_TOKEN,
              message: 'Invalid or already used email change token.',
            },
          });
        }
        if (err.code === 'TOKEN_EXPIRED') {
          return reply.status(400).send({
            success: false,
            error: {
              code: ERROR_CODES.TOKEN_EXPIRED,
              message: 'Email change token has expired. Please initiate a new request.',
            },
          });
        }
        if (err.code === 'CONFLICT' || err.code === 'EMAIL_ALREADY_IN_USE') {
          return reply.status(409).send({
            success: false,
            error: {
              code: ERROR_CODES.CONFLICT,
              message: 'This email address is already in use by another account.',
            },
          });
        }
        throw err;
      }
    }
  );

  // GET /api/v1/auth/account/export
  fastify.get(
    '/account/export',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Auth'],
        summary: 'Export personal account data (GDPR)',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const data = await dataService.exportUserData(request.user.id);
      reply.header('Content-Disposition', 'attachment; filename="orvio-user-data.json"');
      return reply.send({
        success: true,
        data,
      });
    }
  );

  // DELETE /api/v1/auth/account
  fastify.delete(
    '/account',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Auth'],
        summary: 'Delete user account and personal data (GDPR)',
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
        return reply.send({
          success: true,
          message: 'Account and associated personal data successfully deleted.',
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
        if (err.code === 'USER_NOT_FOUND') {
          return reply.status(404).send({
            success: false,
            error: {
              code: ERROR_CODES.NOT_FOUND,
              message: 'User account not found.',
            },
          });
        }
        throw err;
      }
    }
  );

  // POST /api/v1/auth/forgot-password
  fastify.post(
    '/forgot-password',
    {
      config: {
        rateLimit: { max: 5, timeWindow: '1 minute' },
      },
      schema: {
        tags: ['Auth'],
        summary: 'Request a password reset link',
        body: {
          type: 'object',
          required: ['email'],
          properties: {
            email: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = forgotPasswordSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'A valid email address is required.',
          },
        });
      }

      await dataService.requestPasswordReset(parsed.data.email);

      return reply.send({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent.',
      });
    }
  );

  // POST /api/v1/auth/reset-password
  fastify.post(
    '/reset-password',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Reset password using token',
        body: {
          type: 'object',
          required: ['token', 'password'],
          properties: {
            token: { type: 'string' },
            password: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = resetPasswordSchema.safeParse(request.body);
      if (!parsed.success) {
        const fields: Record<string, string> = {};
        parsed.error.errors.forEach((err) => {
          if (err.path[0]) fields[String(err.path[0])] = err.message;
        });
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Please correct the highlighted fields.',
            fields,
          },
        });
      }

      try {
        const { user } = await dataService.resetPassword(parsed.data.token, parsed.data.password);
        return reply.send({
          success: true,
          data: {
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              emailVerified: user.emailVerified,
            },
          },
          message: 'Password successfully reset. You can now log in with your new password.',
        });
      } catch (err: any) {
        if (err.code === 'INVALID_TOKEN') {
          return reply.status(400).send({
            success: false,
            error: {
              code: ERROR_CODES.INVALID_TOKEN,
              message: 'Invalid or already used password reset token.',
            },
          });
        }
        if (err.code === 'TOKEN_EXPIRED') {
          return reply.status(400).send({
            success: false,
            error: {
              code: ERROR_CODES.TOKEN_EXPIRED,
              message: 'Password reset token has expired. Please request a new one.',
            },
          });
        }
        throw err;
      }
    }
  );

  // POST /api/v1/auth/change-password
  fastify.post(
    '/change-password',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Auth'],
        summary: 'Change password for authenticated user',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['currentPassword', 'newPassword'],
          properties: {
            currentPassword: { type: 'string' },
            newPassword: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = changePasswordSchema.safeParse(request.body);
      if (!parsed.success) {
        const fields: Record<string, string> = {};
        parsed.error.errors.forEach((err) => {
          if (err.path[0]) fields[String(err.path[0])] = err.message;
        });
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Please correct the highlighted fields.',
            fields,
          },
        });
      }

      try {
        await dataService.changePassword(request.user.id, parsed.data.currentPassword, parsed.data.newPassword);
        return reply.send({
          success: true,
          message: 'Password successfully updated.',
        });
      } catch (err: any) {
        if (err.code === 'INVALID_CREDENTIALS') {
          return reply.status(400).send({
            success: false,
            error: {
              code: ERROR_CODES.INVALID_CREDENTIALS,
              message: 'Current password does not match.',
            },
          });
        }
        if (err.code === 'UNAUTHENTICATED') {
          return reply.status(401).send({
            success: false,
            error: {
              code: ERROR_CODES.UNAUTHENTICATED,
              message: 'User authentication required.',
            },
          });
        }
        throw err;
      }
    }
  );

  // --- Google OAuth ---

  // GET /api/v1/auth/google
  fastify.get(
    '/google',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Initiate Google OAuth 2.0 authorization',
        querystring: {
          type: 'object',
          properties: {
            returnTo: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { returnTo } = request.query as { returnTo?: string };

      if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
        if (request.headers.accept?.includes('application/json')) {
          return reply.status(400).send({
            success: false,
            error: {
              code: ERROR_CODES.OAUTH_NOT_CONFIGURED,
              message: 'Google OAuth credentials (GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET) are not configured in api/.env.',
            },
          });
        }
        return reply.redirect(`${accountsBaseUrl()}/auth/callback?error=${ERROR_CODES.OAUTH_NOT_CONFIGURED}`);
      }

      // Validate internal returnTo URL if provided to prevent open redirects
      const safeReturnTo = returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : undefined;
      const state = oauthService.generateState('google', safeReturnTo);
      const authUrl = oauthService.getGoogleAuthUrl(state);

      if (request.headers.accept?.includes('application/json')) {
        return reply.send({ success: true, data: { url: authUrl, state } });
      }

      return reply.redirect(authUrl);
    }
  );

  // GET /api/v1/auth/google/callback
  fastify.get(
    '/google/callback',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Google OAuth 2.0 callback',
        querystring: {
          type: 'object',
          properties: {
            code: { type: 'string' },
            state: { type: 'string' },
            error: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { code, state, error } = request.query as {
        code?: string;
        state?: string;
        error?: string;
      };

      if (error) {
        return reply.redirect(`${accountsBaseUrl()}/auth/callback?error=${ERROR_CODES.OAUTH_ACCESS_DENIED}`);
      }

      if (!state) {
        return reply.redirect(`${accountsBaseUrl()}/auth/callback?error=${ERROR_CODES.OAUTH_STATE_INVALID}`);
      }

      try {
        oauthService.validateAndConsumeState(state, 'google');

        if (!code) {
          return reply.redirect(`${accountsBaseUrl()}/auth/callback?error=${ERROR_CODES.OAUTH_CODE_INVALID}`);
        }

        const profile = await oauthService.exchangeGoogleCode(code);
        const { user } = await dataService.handleSocialAuth(profile);
        const session = await dataService.createSession(user.id, {
          userAgent: request.headers['user-agent'],
          ipAddress: request.ip,
          authenticationMethod: 'oauth',
          tokenVersion: user.tokenVersion ?? 1,
        });
        const jwtToken = fastify.jwt.sign(
          {
            userId: user.id,
            email: user.email,
            sessionId: session.sessionId,
            tokenVersion: user.tokenVersion ?? 1,
          },
          { expiresIn: '15m' }
        );

        setAuthCookies(reply, { token: jwtToken, refreshToken: session.refreshToken });
        return reply.redirect(`${accountsBaseUrl()}/auth/callback?token=${jwtToken}&refreshToken=${session.refreshToken}`);
      } catch (err: any) {
        console.error('[Google OAuth Error]:', err?.message || err, err?.stack);
        const errorCode = err.code || (err.message?.includes('OAUTH_') ? err.message : ERROR_CODES.OAUTH_PROVIDER_ERROR);
        return reply.redirect(`${accountsBaseUrl()}/auth/callback?error=${errorCode}`);
      }
    }
  );

  // --- Facebook OAuth ---

  // GET /api/v1/auth/facebook
  fastify.get(
    '/facebook',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Initiate Facebook OAuth authorization',
        querystring: {
          type: 'object',
          properties: {
            returnTo: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { returnTo } = request.query as { returnTo?: string };

      if (!env.FACEBOOK_APP_ID || !env.FACEBOOK_APP_SECRET) {
        if (request.headers.accept?.includes('application/json')) {
          return reply.status(400).send({
            success: false,
            error: {
              code: ERROR_CODES.OAUTH_NOT_CONFIGURED,
              message: 'Facebook OAuth credentials (FACEBOOK_APP_ID & FACEBOOK_APP_SECRET) are not configured in api/.env.',
            },
          });
        }
        return reply.redirect(`${accountsBaseUrl()}/auth/callback?error=${ERROR_CODES.OAUTH_NOT_CONFIGURED}`);
      }

      const safeReturnTo = returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : undefined;
      const state = oauthService.generateState('facebook', safeReturnTo);
      const authUrl = oauthService.getFacebookAuthUrl(state);

      if (request.headers.accept?.includes('application/json')) {
        return reply.send({ success: true, data: { url: authUrl, state } });
      }

      return reply.redirect(authUrl);
    }
  );

  // GET /api/v1/auth/facebook/callback
  fastify.get(
    '/facebook/callback',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Facebook OAuth callback',
        querystring: {
          type: 'object',
          properties: {
            code: { type: 'string' },
            state: { type: 'string' },
            error: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { code, state, error } = request.query as {
        code?: string;
        state?: string;
        error?: string;
      };

      if (error) {
        return reply.redirect(`${accountsBaseUrl()}/auth/callback?error=${ERROR_CODES.OAUTH_ACCESS_DENIED}`);
      }

      if (!state) {
        return reply.redirect(`${accountsBaseUrl()}/auth/callback?error=${ERROR_CODES.OAUTH_STATE_INVALID}`);
      }

      try {
        oauthService.validateAndConsumeState(state, 'facebook');

        if (!code) {
          return reply.redirect(`${accountsBaseUrl()}/auth/callback?error=${ERROR_CODES.OAUTH_CODE_INVALID}`);
        }

        const profile = await oauthService.exchangeFacebookCode(code);
        const { user } = await dataService.handleSocialAuth(profile);
        const session = await dataService.createSession(user.id, {
          userAgent: request.headers['user-agent'],
          ipAddress: request.ip,
          authenticationMethod: 'oauth',
          tokenVersion: user.tokenVersion ?? 1,
        });
        const jwtToken = fastify.jwt.sign(
          {
            userId: user.id,
            email: user.email,
            sessionId: session.sessionId,
            tokenVersion: user.tokenVersion ?? 1,
          },
          { expiresIn: '15m' }
        );

        setAuthCookies(reply, { token: jwtToken, refreshToken: session.refreshToken });
        return reply.redirect(`${accountsBaseUrl()}/auth/callback?token=${jwtToken}&refreshToken=${session.refreshToken}`);
      } catch (err: any) {
        console.error('[Facebook OAuth Error]:', err?.message || err, err?.stack);
        const errorCode = err.code || (err.message?.includes('OAUTH_') ? err.message : ERROR_CODES.OAUTH_PROVIDER_ERROR);
        return reply.redirect(`${accountsBaseUrl()}/auth/callback?error=${errorCode}`);
      }
    }
  );

  // --- SSO Ecosystem Authorization Code Flow ---

  // GET /api/v1/auth/oauth/authorize
  fastify.get(
    '/oauth/authorize',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Initiate ecosystem SSO authorization code flow',
        querystring: {
          type: 'object',
          required: ['redirect_uri', 'response_type'],
          properties: {
            product: { type: 'string' },
            productKey: { type: 'string' },
            redirect_uri: { type: 'string' },
            response_type: { type: 'string' },
            state: { type: 'string' },
            code_challenge: { type: 'string' },
            code_challenge_method: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = oauthAuthorizeSchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Invalid authorization request parameters.',
            details: parsed.error.format(),
          },
        });
      }

      const productKey = (parsed.data.productKey || parsed.data.product || 'hub') as ProductKey;
      const redirectUri = parsed.data.redirect_uri;

      // Validate redirect URI against product catalog
      const productInfo = PRODUCT_CATALOG[productKey] || PRODUCT_CATALOG.hub;
      const isAllowedUri = productInfo.allowedRedirectUris.some((allowed) =>
        redirectUri.startsWith(allowed)
      );

      if (!isAllowedUri) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.REDIRECT_URI_MISMATCH,
            message: `The provided redirect_uri is not authorized for product '${productKey}'.`,
          },
        });
      }

      // Check if user is authenticated via Bearer token
      let authenticatedUser: any = null;
      let authenticatedSessionId: string | undefined;
      const authHeader = request.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        try {
          const decoded = fastify.jwt.verify<{ userId: string; email: string; tokenVersion?: number; sessionId?: string }>(token);
          if (decoded && decoded.userId) {
            const user = await dataService.getUserById(decoded.userId);
            if (user && user.status === 'ACTIVE' && (decoded.tokenVersion === undefined || decoded.tokenVersion === user.tokenVersion)) {
              authenticatedUser = user;
              authenticatedSessionId = decoded.sessionId;
            }
          }
        } catch {
          // Token invalid / expired, fall through to login redirect
        }
      }

      if (authenticatedUser) {
        const { code } = await dataService.generateSSOAuthorizationCode({
          userId: authenticatedUser.id,
          sessionId: authenticatedSessionId,
          productKey,
          redirectUri,
          codeChallenge: parsed.data.code_challenge,
          codeChallengeMethod: parsed.data.code_challenge_method,
        });

        await dataService.logAudit({
          actorUserId: authenticatedUser.id,
          eventType: AUDIT_EVENTS.AUTH_OAUTH_CODE_ISSUED,
          productKey,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          metadata: { redirectUri, productKey },
        });

        const targetUrl = new URL(redirectUri);
        targetUrl.searchParams.set('code', code);
        if (parsed.data.state) {
          targetUrl.searchParams.set('state', parsed.data.state);
        }

        if (request.headers.accept?.includes('application/json')) {
          return reply.send({
            success: true,
            data: {
              code,
              redirectUrl: targetUrl.toString(),
              state: parsed.data.state,
            },
          });
        }

        return reply.redirect(targetUrl.toString());
      }

      // If unauthenticated, redirect to Central Auth Login Portal with return context
      const loginUrl = new URL(`${env.APP_URL}/login`);
      loginUrl.searchParams.set('product', productKey);
      loginUrl.searchParams.set('return_to', redirectUri);
      if (parsed.data.state) loginUrl.searchParams.set('state', parsed.data.state);
      if (parsed.data.code_challenge) loginUrl.searchParams.set('code_challenge', parsed.data.code_challenge);
      if (parsed.data.code_challenge_method) loginUrl.searchParams.set('code_challenge_method', parsed.data.code_challenge_method);

      if (request.headers.accept?.includes('application/json')) {
        return reply.send({
          success: false,
          error: {
            code: ERROR_CODES.UNAUTHENTICATED,
            message: 'User authentication required.',
          },
          data: {
            loginUrl: loginUrl.toString(),
          },
        });
      }

      return reply.redirect(loginUrl.toString());
    }
  );

  // POST /api/v1/auth/oauth/token
  fastify.post(
    '/oauth/token',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Exchange ecosystem SSO authorization code for tokens',
        body: {
          type: 'object',
          required: ['grant_type', 'code', 'redirect_uri'],
          properties: {
            grant_type: { type: 'string', enum: ['authorization_code'] },
            code: { type: 'string' },
            redirect_uri: { type: 'string' },
            code_verifier: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = oauthTokenSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Invalid token exchange parameters.',
            details: parsed.error.format(),
          },
        });
      }

      try {
        const result = await dataService.exchangeSSOAuthorizationCode({
          code: parsed.data.code,
          redirectUri: parsed.data.redirect_uri,
          codeVerifier: parsed.data.code_verifier,
          userAgent: request.headers['user-agent'],
          ipAddress: request.ip,
        });

        const accessToken = fastify.jwt.sign({
          userId: result.user.id,
          email: result.user.email,
          tokenVersion: result.user.tokenVersion ?? 0,
          sessionId: result.sessionId,
          productKey: result.productKey,
        });

        await dataService.logAudit({
          actorUserId: result.user.id,
          eventType: AUDIT_EVENTS.AUTH_OAUTH_TOKEN_EXCHANGED,
          productKey: result.productKey,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          metadata: { productKey: result.productKey },
        });

        const onboarding = await dataService.getOnboardingStatus(result.user.id);
        const memberships = await dataService.getUserMemberships(result.user.id);

        return reply.send({
          success: true,
          data: {
            access_token: accessToken,
            token_type: 'Bearer',
            expires_in: 900, // 15 mins
            refresh_token: result.refreshToken,
            product: result.productKey,
            user: {
              id: result.user.id,
              email: result.user.email,
              name: result.user.name,
              firstName: result.user.firstName,
              lastName: result.user.lastName,
              displayName: result.user.displayName,
              country: result.user.country,
              phone: result.user.phone,
              emailVerified: result.user.emailVerified,
            },
            onboarding,
            memberships,
          },
        });
      } catch (err: any) {
        const msg = String(err.message || err.code || '');
        if (msg.includes('AUTHORIZATION_CODE_EXPIRED')) {
          return reply.status(400).send({
            success: false,
            error: {
              code: ERROR_CODES.AUTHORIZATION_CODE_EXPIRED,
              message: 'Authorization code has expired. Please sign in again.',
            },
          });
        }
        if (msg.includes('AUTHORIZATION_CODE_ALREADY_USED')) {
          return reply.status(400).send({
            success: false,
            error: {
              code: ERROR_CODES.AUTHORIZATION_CODE_ALREADY_USED,
              message: 'Authorization code was already used.',
            },
          });
        }
        if (msg.includes('REDIRECT_URI_MISMATCH')) {
          return reply.status(400).send({
            success: false,
            error: {
              code: ERROR_CODES.REDIRECT_URI_MISMATCH,
              message: 'Redirect URI mismatch.',
            },
          });
        }
        if (msg.includes('INVALID_CODE_VERIFIER')) {
          return reply.status(400).send({
            success: false,
            error: {
              code: ERROR_CODES.INVALID_CODE_VERIFIER,
              message: 'PKCE code verifier verification failed.',
            },
          });
        }
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.INVALID_GRANT,
            message: 'Invalid or expired authorization code.',
          },
        });
      }
    }
  );
};
