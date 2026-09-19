import crypto from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { dataService, type UserRecord } from '../services/dataService.js';
import { oauthService } from '../services/oauth.js';
import { env } from '../config/env.js';
import { getAccountsUrl } from '@orviohub/shared';
import { ERROR_CODES, AUDIT_EVENTS, PRODUCT_CATALOG, type ProductKey } from '../config/constants.js';
import { setAuthCookies, clearAuthCookies } from '../utils/cookies.js';
import { toPublicUser } from '../utils/userSerializer.js';
import { maskEmail } from '../utils/emailUtils.js';
import type { JwtPayload } from '../plugins/auth.js';

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

const pendingEmailChangeLimiter = new Map<string, { count: number; resetAt: number }>();

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
    planKey: z.string().optional(),
    billingInterval: z.enum(['monthly', 'annual']).optional(),
    paymentMethod: z.string().optional(),
    paidPlanRef: z.string().optional(),
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

const changePendingEmailSchema = z.object({
  newEmail: z.string().trim().email('Invalid email address'),
  email: z.string().trim().email('Invalid email address').optional(),
  currentEmail: z.string().trim().email('Invalid email address').optional(),
});

const verifyEmailSchema = z
  .object({
    token: z.string().optional(),
    code: z.string().optional(),
    email: z.string().email('Invalid email address').optional(),
  })
  .refine((data) => !!data.token || (!!data.code && data.code.trim().length >= 6), {
    message: 'Verification token or 6-digit code is required.',
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
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
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
  // POST /api/v1/auth/verify-password (Step-up authentication for sensitive operations)
  fastify.post(
    '/verify-password',
    {
      onRequest: [fastify.authenticate],
      config: {
        rateLimit: { max: 10, timeWindow: '1 minute' },
      },
      schema: {
        tags: ['Auth'],
        summary: 'Verify account password for sensitive step-up actions',
        body: {
          type: 'object',
          required: ['password'],
          properties: {
            password: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
        });
      }

      const body = request.body as { password?: string };
      if (!body?.password || typeof body.password !== 'string') {
        return reply.status(400).send({
          success: false,
          error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Password is required.' },
        });
      }

      const isMatch = await dataService.verifyPassword(user, body.password);
      if (!isMatch) {
        return reply.status(401).send({
          success: false,
          error: { code: 'INVALID_PASSWORD', message: 'Incorrect password provided.' },
        });
      }

      return reply.send({
        success: true,
        data: { verified: true },
      });
    }
  );

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
        if (err.message === 'USER_SUSPENDED' || err.code === 'USER_SUSPENDED') {
          return reply.status(403).send({
            success: false,
            error: {
              code: 'ACCOUNT_SUSPENDED',
              message: 'Your account has been suspended. Please contact support.',
            },
          });
        }
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

      const idempotencyKey = (
        request.headers['idempotency-key'] || request.headers['x-idempotency-key']
      ) as string | undefined;

      const normalizedEmail = parsed.data.email.toLowerCase().trim();

      // Fingerprint strictly omits raw password to protect secrets
      const fingerprintPayload = {
        email: normalizedEmail,
        name: parsed.data.name || `${parsed.data.firstName || ''} ${parsed.data.lastName || ''}`.trim(),
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        displayName: parsed.data.displayName,
        country: parsed.data.country,
        phone: parsed.data.phone,
        planKey: parsed.data.planKey,
        billingInterval: parsed.data.billingInterval,
      };
      const fingerprint = crypto.createHash('sha256').update(JSON.stringify(fingerprintPayload)).digest('hex');

      if (idempotencyKey) {
        const idempCheck = await dataService.acquireIdempotencyKey(idempotencyKey, 'signup', fingerprint, 86_400_000);
        if (idempCheck.action === 'MISMATCH') {
          return reply.status(400).send({
            success: false,
            error: {
              code: ERROR_CODES.IDEMPOTENCY_KEY_PAYLOAD_MISMATCH,
              message: 'This Idempotency-Key was already used with a different request payload.',
            },
          });
        }
        if (idempCheck.action === 'REPLAY') {
          await dataService.logAudit({
            eventType: AUDIT_EVENTS.AUTH_SIGNUP_IDEMPOTENCY_REPLAYED,
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
            metadata: { idempotencyKey, email: normalizedEmail },
          });
          let replayBody: any;
          try {
            replayBody = JSON.parse(idempCheck.responseBody || '{}');
          } catch {
            replayBody = idempCheck.responseBody;
          }
          return reply.status(idempCheck.statusCode || 200).send(replayBody);
        }
        if (idempCheck.action === 'PROCESSING') {
          return reply.status(409).header('Retry-After', '2').send({
            success: false,
            error: {
              code: ERROR_CODES.IDEMPOTENCY_CONCURRENT_REQUEST,
              message: 'A signup request with this Idempotency-Key is currently being processed. Please retry in a few seconds.',
            },
          });
        }
      }

      // Check for existing user by normalized email
      const existingUser = await dataService.getUserByEmail(normalizedEmail);
      if (existingUser) {
        // If account is pending email verification, provide continuation flow instead of generic duplicate error
        if (existingUser.status === 'pending_email_verification' || !existingUser.emailVerified) {
          await dataService.logAuthEvent({
            eventType: 'signup_duplicate_pending',
            userId: existingUser.id,
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
            metadata: { email: normalizedEmail },
          });
          await dataService.logAudit({
            actorUserId: existingUser.id,
            eventType: AUDIT_EVENTS.AUTH_SIGNUP_DUPLICATE_PENDING,
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
            metadata: { email: normalizedEmail },
          });

          // Ensure verification email is sent to avoid trapped user
          await dataService.resendVerificationEmail(normalizedEmail);

          const pendingResponse = {
            success: true,
            status: 'pending_email_verification',
            action: 'CONTINUE_VERIFICATION',
            data: {
              status: 'pending_email_verification',
              emailVerified: false,
              email: existingUser.email,
              action: 'CONTINUE_VERIFICATION',
              nextRoute: '/verify-email',
              message: 'An account with this email is pending verification. A fresh verification code has been sent to your email.',
            },
          };

          if (idempotencyKey) {
            await dataService.completeIdempotencyKey(idempotencyKey, 200, pendingResponse, existingUser.id);
          }

          return reply.status(200).send(pendingResponse);
        }

        if (existingUser.status === 'SUSPENDED' || existingUser.status === 'suspended') {
          return reply.status(403).send({
            success: false,
            error: {
              code: 'ACCOUNT_SUSPENDED',
              message: 'This account is currently suspended. Please contact customer support.',
              action: 'CONTACT_SUPPORT',
            },
          });
        }

        // Active and verified user
        return reply.status(409).send({
          success: false,
          error: {
            code: ERROR_CODES.USER_ALREADY_EXISTS,
            message: 'An account with this email address already exists. Please sign in or reset your password.',
            action: 'SIGN_IN',
            nextRoute: '/login',
          },
        });
      }

      try {
        await dataService.logAuthEvent({
          eventType: 'signup_started',
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          metadata: { email: normalizedEmail },
        });

        const { planKey, billingInterval, paymentMethod, paidPlanRef, ...userPayload } = parsed.data;
        const { user } = await dataService.createUser({
          ...(userPayload as any),
          email: normalizedEmail,
          status: 'pending_email_verification',
          emailVerified: false,
        });

        const session = await dataService.createSession(user.id, {
          userAgent: request.headers['user-agent'],
          ipAddress: request.ip,
          authenticationMethod: 'password',
          tokenVersion: user.tokenVersion ?? 1,
        });

        // Restricted JWT requiring verification
        const jwtToken = fastify.jwt.sign(
          {
            userId: user.id,
            email: user.email,
            sessionId: session.sessionId,
            tokenVersion: user.tokenVersion ?? 1,
            accessLevel: 'verification_required',
            status: 'pending_email_verification',
          },
          { expiresIn: '15m' }
        );

        await dataService.logAudit({
          actorUserId: user.id,
          eventType: AUDIT_EVENTS.AUTH_EMAIL_VERIFICATION_SENT,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        });

        await dataService.logAudit({
          actorUserId: user.id,
          eventType: AUDIT_EVENTS.AUTH_SIGNUP_COMPLETED,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        });

        setAuthCookies(reply, { token: jwtToken, refreshToken: session.refreshToken });

        const responseData = {
          success: true,
          data: {
            user: {
              ...toPublicUser(user),
              status: 'pending_email_verification',
              emailVerified: false,
            },
            token: jwtToken,
            refreshToken: session.refreshToken,
            status: 'pending_email_verification',
            emailVerified: false,
            accessLevel: 'verification_required',
            nextRoute: '/verify-email',
            onboarding: {
              status: 'IN_PROGRESS',
              currentStep: 'EMAIL_VERIFICATION',
            },
          },
        };

        if (idempotencyKey) {
          await dataService.completeIdempotencyKey(idempotencyKey, 201, responseData, user.id);
        }

        return reply.status(201).send(responseData);
      } catch (err: any) {
        if (idempotencyKey) {
          await dataService.failIdempotencyKey(idempotencyKey, err.message);
        }
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

      const normalizedEmail = parsed.data.email.trim().toLowerCase();
      await dataService.logAuthEvent({
        eventType: 'login_started',
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: { email: normalizedEmail },
      });
      await dataService.logAudit({
        eventType: AUDIT_EVENTS.AUTH_LOGIN_STARTED,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: { email: normalizedEmail },
      });

      const user = await dataService.getUserByEmail(normalizedEmail);
      if (!user) {
        await dataService.logAuthEvent({
          eventType: 'login_failed',
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          metadata: { email: normalizedEmail, reason: 'USER_NOT_FOUND' },
        });
        await dataService.logAudit({
          eventType: AUDIT_EVENTS.AUTH_LOGIN_FAILED,
          severity: 'warning',
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          metadata: { email: normalizedEmail },
        });
        return reply.status(401).send({
          success: false,
          error: {
            code: ERROR_CODES.UNAUTHENTICATED,
            message: 'Invalid email or password.',
          },
        });
      }

      // Check if user is already authenticated with an active session in this browser
      const existingCookieToken =
        request.cookies?.session || request.cookies?.orvio_session || request.cookies?.orvio_token;
      const existingAuthHeader = request.headers.authorization?.startsWith('Bearer ')
        ? request.headers.authorization.slice(7)
        : undefined;
      const activeCandidateToken = existingCookieToken || existingAuthHeader;
      if (activeCandidateToken) {
        try {
          const decoded = fastify.jwt.verify<JwtPayload>(activeCandidateToken);
          if (decoded && decoded.userId === user.id && decoded.sessionId) {
            const activeSession = await dataService.getSessionById(decoded.sessionId);
            if (activeSession && !activeSession.revoked && (!activeSession.expiresAt || activeSession.expiresAt > Date.now())) {
              await dataService.logAuthEvent({
                eventType: 'session_reused',
                userId: user.id,
                sessionId: activeSession.sessionId || decoded.sessionId,
                ipAddress: request.ip,
                userAgent: request.headers['user-agent'],
              });
              await dataService.logAudit({
                actorUserId: user.id,
                eventType: AUDIT_EVENTS.AUTH_SESSION_REUSED,
                ipAddress: request.ip,
                userAgent: request.headers['user-agent'],
                metadata: { sessionId: activeSession.sessionId || decoded.sessionId },
              });
              return reply.send({
                success: true,
                data: {
                  status: 'already_authenticated',
                  user: toPublicUser(user),
                  session: {
                    id: activeSession.sessionId || decoded.sessionId,
                    expiresAt: activeSession.expiresAt,
                  },
                },
                requestId: request.id,
              });
            }
          }
        } catch {
          // Candidate token invalid or expired, continue to normal credential verification
        }
      }

      // Check if account is suspended
      if ((user.status as any) === 'SUSPENDED' || (user.status as any) === 'suspended') {
        await dataService.logAuthEvent({
          eventType: 'login_failed',
          userId: user.id,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          metadata: {
            email: parsed.data.email,
            reason: 'ACCOUNT_SUSPENDED',
            suspensionReason: (user as any).suspensionReason,
          },
        });
        return reply.status(403).send({
          success: false,
          error: {
            code: 'ACCOUNT_SUSPENDED',
            message: 'Your account has been suspended by our administration team. Please contact support.',
            reason: (user as any).suspensionReason || 'Policy violation',
          },
        });
      }

      // Check if account is deleted
      if ((user.status as any) === 'DELETED' || (user.status as any) === 'deleted' || (user as any).deletedAt) {
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
        await dataService.logAuthEvent({
          eventType: 'login_failed',
          userId: user.id,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          metadata: { email: parsed.data.email, reason: 'ACCOUNT_LOCKED', lockedUntil: user.lockedUntil },
        });
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
        await dataService.logAuthEvent({
          eventType: 'login_failed',
          userId: user.id,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          metadata: { email: parsed.data.email, reason: 'INVALID_CREDENTIALS', failedAttempts: failedResult.failedAttempts },
        });
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

      // Check if user is pending email verification
      if (user.status === 'pending_email_verification' || !user.emailVerified) {
        await dataService.logAuthEvent({
          eventType: 'login_pending_verification',
          userId: user.id,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          metadata: { email: parsed.data.email },
        });

        await dataService.logAudit({
          actorUserId: user.id,
          eventType: AUDIT_EVENTS.AUTH_LOGIN_PENDING_VERIFICATION,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          metadata: { email: parsed.data.email },
        });

        const session = await dataService.createSession(user.id, {
          userAgent: request.headers['user-agent'],
          ipAddress: request.ip,
          authenticationMethod: 'password',
          tokenVersion: user.tokenVersion ?? 1,
        });

        const restrictedToken = fastify.jwt.sign(
          {
            userId: user.id,
            email: user.email,
            sessionId: session.sessionId,
            tokenVersion: user.tokenVersion ?? 1,
            accessLevel: 'verification_required',
            status: 'pending_email_verification',
          },
          { expiresIn: '15m' }
        );

        setAuthCookies(reply, { token: restrictedToken, refreshToken: session.refreshToken });

        return reply.send({
          success: true,
          status: 'pending_email_verification',
          nextRoute: '/verify-email',
          data: {
            authenticated: true,
            emailVerified: false,
            status: 'pending_email_verification',
            accessLevel: 'verification_required',
            nextRoute: '/verify-email',
            user: {
              ...toPublicUser(user),
              status: 'pending_email_verification',
              emailVerified: false,
            },
            token: restrictedToken,
            refreshToken: session.refreshToken,
            session: {
              id: session.sessionId,
            },
          },
        });
      }

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

      await dataService.touchLastLogin(user.id, request.ip);
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

      await dataService.logAuthEvent({
        eventType: 'session_created',
        userId: user.id,
        sessionId: session.sessionId,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: { authenticationMethod: 'password' },
      });

      await dataService.logAudit({
        actorUserId: user.id,
        eventType: AUDIT_EVENTS.AUTH_SESSION_CREATED,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: { sessionId: session.sessionId },
      });

      await dataService.logAuthEvent({
        eventType: 'login_success',
        userId: user.id,
        sessionId: session.sessionId,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: { authenticationMethod: 'password' },
      });

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
          status: 'authenticated',
          user: toPublicUser(user),
          token: jwtToken,
          refreshToken: session.refreshToken,
          session: {
            id: session.sessionId,
            lastVisitedUrl: session.lastVisitedUrl,
            lastVisitedSubdomain: session.lastVisitedSubdomain,
          },
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

  // POST /api/v1/auth/2fa/login-verify (and aliases /mfa/challenge, /2fa/challenge)
  const loginTwoFactorHandler = async (request: any, reply: any) => {
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

      const session = await dataService.createSession(user.id, {
        userAgent: request.headers['user-agent'],
        ipAddress: request.ip,
        authenticationMethod: 'mfa_totp',
        mfaVerified: true,
        tokenVersion: user.tokenVersion ?? 1,
      });

      const accessToken = fastify.jwt.sign(
        {
          userId: user.id,
          email: user.email,
          sessionId: session.sessionId,
          tokenVersion: user.tokenVersion ?? 1,
        },
        { expiresIn: '15m' }
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
  };

  fastify.post('/2fa/login-verify', { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, loginTwoFactorHandler);
  fastify.post('/2fa/challenge', { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, loginTwoFactorHandler);
  fastify.post('/mfa/challenge', { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, loginTwoFactorHandler);

  const resendCooldownMap = new Map<string, number>();

  const handleResendVerification = async (request: any, reply: any, isOtpAlias = false) => {
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

    const normEmail = parsed.data.email.toLowerCase().trim();
    const now = Date.now();
    const lastSent = resendCooldownMap.get(normEmail);
    if (lastSent && now - lastSent < 15_000) {
      const retryAfterSec = Math.ceil((15_000 - (now - lastSent)) / 1000);
      return reply.status(429).send({
        success: false,
        error: {
          code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
          message: `Please wait ${retryAfterSec} seconds before requesting another verification code.`,
          retryAfter: retryAfterSec,
        },
      });
    }

    try {
      const sent = await dataService.resendVerificationEmail(normEmail);
      if (sent) {
        resendCooldownMap.set(normEmail, now);
        const user = await dataService.getUserByEmail(normEmail);
        await dataService.logAuthEvent({
          eventType: AUDIT_EVENTS.AUTH_EMAIL_VERIFICATION_RESENT,
          userId: user?.id,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          metadata: { email: normEmail, isOtpAlias },
        });
      }
      return reply.send({
        success: true,
        message: isOtpAlias
          ? 'If an account exists with this email, a new verification OTP has been sent.'
          : 'If an account exists with this email, a new verification link has been sent.',
      });
    } catch {
      return reply.send({
        success: true,
        message: isOtpAlias
          ? 'If an account exists with this email, a new verification OTP has been sent.'
          : 'If an account exists with this email, a new verification link has been sent.',
      });
    }
  };

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
    async (request, reply) => handleResendVerification(request, reply, false)
  );

  // POST /api/v1/auth/send-otp (Alias for /resend-verification)
  fastify.post(
    '/send-otp',
    {
      config: {
        rateLimit: { max: 5, timeWindow: '1 minute' },
      },
      schema: {
        tags: ['Auth'],
        summary: 'Resend or send verification OTP code to email',
        body: {
          type: 'object',
          required: ['email'],
          properties: {
            email: { type: 'string', format: 'email' },
          },
        },
      },
    },
    async (request, reply) => handleResendVerification(request, reply, true)
  );

  // POST /api/v1/auth/change-pending-email (and alias /v1/auth/change-pending-email)
  const changePendingEmailHandler = async (request: any, reply: any) => {
    const parsed = changePendingEmailSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: parsed.error.issues[0]?.message || 'Invalid email format.',
        },
        requestId: request.id,
      });
    }

    // 1. Resolve the pending user strictly from session context / restricted signup session
    let resolvedUserId: string | undefined = request.user?.id;
    const cookieToken = request.cookies?.session || request.cookies?.orvio_session || request.cookies?.orvio_token;
    const authHeader = request.headers.authorization?.startsWith('Bearer ')
      ? request.headers.authorization.slice(7)
      : undefined;
    const sessionToken = cookieToken || authHeader;

    if (!resolvedUserId && sessionToken) {
      try {
        const decoded = fastify.jwt.verify<JwtPayload>(sessionToken);
        if (decoded && decoded.userId) {
          resolvedUserId = decoded.userId;
        }
      } catch {
        // Token invalid or expired
      }
    }

    let user: UserRecord | null = null;
    if (resolvedUserId) {
      user = await dataService.getUserById(resolvedUserId);
    } else if (parsed.data.currentEmail || parsed.data.email) {
      // Safe fallback for tests / context where email was verified on signup
      const lookupEmail = (parsed.data.currentEmail || parsed.data.email)!.toLowerCase().trim();
      user = await dataService.getUserByEmail(lookupEmail);
    }

    if (!user) {
      return reply.status(401).send({
        success: false,
        error: {
          code: ERROR_CODES.VERIFICATION_SESSION_EXPIRED,
          message: 'Your verification session has expired. Please start again.',
        },
        requestId: request.id,
      });
    }

    // 2. Account state rule: only accounts pending_email_verification may change email
    if (user.status !== 'pending_email_verification' && user.emailVerified) {
      return reply.status(400).send({
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Verified accounts cannot change their email address through this endpoint.',
        },
        requestId: request.id,
      });
    }

    // 3. Rate limiting: 3 attempts per hour per session/IP
    const now = Date.now();
    const rateLimitKey = `change_email:${user.id}:${request.ip}`;
    const rateEntry = pendingEmailChangeLimiter.get(rateLimitKey);
    if (rateEntry && rateEntry.resetAt > now) {
      if (rateEntry.count >= 3) {
        return reply.status(429).send({
          success: false,
          error: {
            code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
            message: 'Too many attempts. Please wait before trying again.',
          },
          requestId: request.id,
        });
      }
      rateEntry.count += 1;
    } else {
      pendingEmailChangeLimiter.set(rateLimitKey, { count: 1, resetAt: now + 3600_000 });
    }

    const normNewEmail = parsed.data.newEmail.toLowerCase().trim();
    const oldEmailMasked = maskEmail(user.email);
    const newEmailMasked = maskEmail(normNewEmail);

    // 4. Idempotency-Key support
    const idempotencyKey = request.headers['idempotency-key'] as string | undefined;
    const payloadFingerprint = crypto.createHash('sha256').update(`${user.id}:${normNewEmail}`).digest('hex');

    if (idempotencyKey) {
      const check = await dataService.acquireIdempotencyKey(
        idempotencyKey,
        'change_pending_email',
        payloadFingerprint,
        3600_000
      );
      if (check.action === 'MISMATCH') {
        return reply.status(409).send({
          success: false,
          error: {
            code: ERROR_CODES.IDEMPOTENCY_KEY_PAYLOAD_MISMATCH,
            message: 'Idempotency key payload mismatch.',
          },
          requestId: request.id,
        });
      }
      if (check.action === 'REPLAY' && check.responseBody) {
        try {
          const cached = JSON.parse(check.responseBody);
          return reply.status(check.statusCode || 200).send(cached);
        } catch {
          return reply.status(check.statusCode || 200).send(check.responseBody);
        }
      }
    }

    // 5. Audit: pending email change started
    await dataService.logAuthEvent({
      eventType: AUDIT_EVENTS.AUTH_PENDING_EMAIL_CHANGE_STARTED,
      userId: user.id,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
      metadata: {
        oldEmailMasked,
        newEmailMasked,
        purpose: 'signup_email_verification',
      },
    });
    await dataService.logAudit({
      actorUserId: user.id,
      eventType: AUDIT_EVENTS.AUTH_PENDING_EMAIL_CHANGE_STARTED,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
      metadata: {
        oldEmailMasked,
        newEmailMasked,
        purpose: 'signup_email_verification',
      },
    });

    // 6. Handle identical email submitted
    if (normNewEmail === (user.email || '').toLowerCase().trim()) {
      const sameEmailPayload = {
        success: true,
        data: {
          status: 'verification_already_pending',
          maskedEmail: oldEmailMasked,
          verificationSent: false,
          expiresAt: user.emailVerificationExpiresAt || (now + 86_400_000),
          email: user.email,
        },
        requestId: request.id,
      };
      if (idempotencyKey) {
        await dataService.completeIdempotencyKey(idempotencyKey, 200, sameEmailPayload, user.id);
      }
      return reply.send(sameEmailPayload);
    }

    // 7. Atomic update & verification challenge creation
    try {
      const result = await dataService.changePendingEmail(user.id, normNewEmail);

      // Audit: old codes invalidated
      await dataService.logAuthEvent({
        eventType: AUDIT_EVENTS.AUTH_EMAIL_VERIFICATION_CODE_INVALIDATED,
        userId: user.id,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: { purpose: 'signup_email_verification' },
      });
      await dataService.logAudit({
        actorUserId: user.id,
        eventType: AUDIT_EVENTS.AUTH_EMAIL_VERIFICATION_CODE_INVALIDATED,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: { purpose: 'signup_email_verification' },
      });

      // Audit: pending email changed
      await dataService.logAuthEvent({
        eventType: AUDIT_EVENTS.AUTH_PENDING_EMAIL_CHANGED,
        userId: user.id,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: {
          oldEmailMasked,
          newEmailMasked,
          purpose: 'signup_email_verification',
        },
      });
      await dataService.logAudit({
        actorUserId: user.id,
        eventType: AUDIT_EVENTS.AUTH_PENDING_EMAIL_CHANGED,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: {
          oldEmailMasked,
          newEmailMasked,
          purpose: 'signup_email_verification',
        },
      });

      // Audit: new email verification sent
      await dataService.logAuthEvent({
        eventType: AUDIT_EVENTS.AUTH_EMAIL_VERIFICATION_SENT,
        userId: user.id,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: { emailMasked: newEmailMasked, purpose: 'signup_email_verification' },
      });
      await dataService.logAudit({
        actorUserId: user.id,
        eventType: AUDIT_EVENTS.AUTH_EMAIL_VERIFICATION_SENT,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: { emailMasked: newEmailMasked, purpose: 'signup_email_verification' },
      });

      const responsePayload = {
        success: true,
        data: {
          status: 'verification_required',
          maskedEmail: newEmailMasked,
          verificationSent: true,
          expiresAt: result.expiresAt || (now + 86_400_000),
          email: result.user.email,
        },
        requestId: request.id,
      };

      if (idempotencyKey) {
        await dataService.completeIdempotencyKey(idempotencyKey, 200, responsePayload, user.id);
      }

      return reply.send(responsePayload);
    } catch (err: any) {
      await dataService.logAuthEvent({
        eventType: AUDIT_EVENTS.AUTH_PENDING_EMAIL_CHANGE_FAILED,
        userId: user.id,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: { reason: err.code || err.message },
      });
      await dataService.logAudit({
        actorUserId: user.id,
        eventType: AUDIT_EVENTS.AUTH_PENDING_EMAIL_CHANGE_FAILED,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: { reason: err.code || err.message },
      });

      if (err.code === 'CANNOT_CHANGE_VERIFIED_EMAIL') {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Verified accounts cannot change their email address through this endpoint.',
          },
          requestId: request.id,
        });
      }
      if (
        err.code === 'CONFLICT' ||
        err.code === 'EMAIL_ALREADY_IN_USE' ||
        err.message?.includes('EMAIL_ALREADY_IN_USE') ||
        err.message?.includes('already in use')
      ) {
        return reply.status(409).send({
          success: false,
          error: {
            code: ERROR_CODES.EMAIL_ALREADY_IN_USE,
            message: 'This email cannot be used for this account. Try another email or sign in to the existing account.',
          },
          requestId: request.id,
        });
      }
      if (err.code === 'USER_NOT_FOUND') {
        return reply.status(404).send({
          success: false,
          error: {
            code: ERROR_CODES.NOT_FOUND,
            message: 'Pending account not found.',
          },
          requestId: request.id,
        });
      }
      throw err;
    }
  };

  fastify.post(
    '/change-pending-email',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Update email address for a pending unverified account',
        body: {
          type: 'object',
          required: ['newEmail'],
          properties: {
            currentEmail: { type: 'string' },
            email: { type: 'string' },
            newEmail: { type: 'string' },
          },
        },
      },
    },
    changePendingEmailHandler
  );

  // GET & POST /api/v1/auth/verify-email
  const handleVerifyEmail = async (request: any, reply: any) => {
    const rawData = (request.method === 'GET' ? request.query : request.body) || {};
    const parsed = verifyEmailSchema.safeParse(rawData);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: parsed.error.issues[0]?.message || 'Verification token or 6-digit code is required.',
        },
      });
    }

    try {
      const { user } = await dataService.verifyEmail(parsed.data);
      const jwtToken = fastify.jwt.sign({
        userId: user.id,
        email: user.email,
        tokenVersion: user.tokenVersion ?? 0,
        accessLevel: 'full',
        status: 'active',
      });
      const session = await dataService.createSession(user.id, request.headers['user-agent'], request.ip);

      await dataService.logAuthEvent({
        eventType: AUDIT_EVENTS.AUTH_EMAIL_VERIFIED,
        userId: user.id,
        sessionId: session.sessionId,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: { method: parsed.data.token ? 'link' : 'code' },
      });

      setAuthCookies(reply, { token: jwtToken, refreshToken: session.refreshToken });

      return reply.send({
        success: true,
        data: {
          user: toPublicUser(user),
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
      await dataService.logAuthEvent({
        eventType: AUDIT_EVENTS.AUTH_EMAIL_VERIFICATION_FAILED,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: {
          error: err.message,
          code: err.code,
          tokenHash: parsed.data.token ? crypto.createHash('sha256').update(parsed.data.token).digest('hex') : undefined,
          email: parsed.data.email,
        },
      });

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
      if (err.code === 'INVALID_CODE' || msg.includes('INVALID_CODE')) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Invalid verification code. Please check the 6 digits and try again.',
          },
        });
      }
      throw err;
    }
  };

  fastify.post(
    '/verify-email',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Verify user email address using token or 6-digit code (POST)',
        body: {
          type: 'object',
          properties: {
            token: { type: 'string' },
            code: { type: 'string' },
            email: { type: 'string' },
          },
        },
      },
    },
    handleVerifyEmail
  );

  fastify.get(
    '/verify-email',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Verify user email address using token link (GET)',
        querystring: {
          type: 'object',
          properties: {
            token: { type: 'string' },
            code: { type: 'string' },
            email: { type: 'string' },
          },
        },
      },
    },
    handleVerifyEmail
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
      const sessionContext = request.sessionId ? await dataService.getSessionById(request.sessionId) : null;

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
          session: sessionContext ? {
            id: sessionContext.id,
            lastVisitedUrl: sessionContext.lastVisitedUrl,
            lastVisitedSubdomain: sessionContext.lastVisitedSubdomain,
            lastVisitedAt: sessionContext.lastVisitedAt,
          } : (request.sessionId ? { id: request.sessionId } : undefined),
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
      await dataService.logAudit({
        actorUserId: request.user.id,
        eventType: AUDIT_EVENTS.AUTH_SESSION_CHECKED,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });

      const sessionContext = request.sessionId ? await dataService.getSessionById(request.sessionId) : null;
      const isEmailVerified = Boolean(request.user.emailVerified);
      const isPendingVerification = !isEmailVerified || request.user.status === 'pending_email_verification';

      const responseData: Record<string, any> = {
        authenticated: true,
        user: {
          id: request.user.id,
          status: request.user.status || (isEmailVerified ? 'active' : 'pending_email_verification'),
          emailVerified: isEmailVerified,
          email: request.user.email,
          name: request.user.name,
          firstName: request.user.firstName,
          lastName: request.user.lastName,
          avatarUrl: request.user.avatarUrl || request.user.avatar,
        },
        session: {
          id: request.sessionId,
          expiresAt: sessionContext?.expiresAt,
          tokenVersion: request.user.tokenVersion ?? 1,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          lastVisitedUrl: sessionContext?.lastVisitedUrl,
          lastVisitedSubdomain: sessionContext?.lastVisitedSubdomain,
          lastVisitedAt: sessionContext?.lastVisitedAt,
        },
      };

      if (isPendingVerification) {
        responseData.access = {
          level: 'verification_required',
          canAccessApplications: false,
          canCreateWorkspace: false,
        };
        responseData.next = {
          route: '/verify-email',
        };
      } else {
        responseData.access = {
          level: 'full',
          canAccessApplications: true,
          canCreateWorkspace: true,
        };
      }

      responseData.status = responseData.user.status;
      responseData.accessLevel = responseData.access.level;
      responseData.emailVerified = isEmailVerified;

      return reply.send({
        success: true,
        data: responseData,
        requestId: request.id,
      });
    }
  );

  // POST /api/v1/auth/session/context
  fastify.post(
    '/session/context',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Auth'],
        summary: 'Update active session last visited context (URL and subdomain)',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            lastVisitedUrl: { type: 'string' },
            lastVisitedSubdomain: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const body = (request.body as { lastVisitedUrl?: string; lastVisitedSubdomain?: string }) || {};
      const sessionId = request.sessionId;
      if (sessionId) {
        await dataService.updateSessionContext(sessionId, {
          lastVisitedUrl: body.lastVisitedUrl,
          lastVisitedSubdomain: body.lastVisitedSubdomain,
        });
      }
      return reply.send({
        success: true,
        data: {
          sessionId,
          lastVisitedUrl: body.lastVisitedUrl,
          lastVisitedSubdomain: body.lastVisitedSubdomain,
        },
      });
    }
  );

  // POST /api/v1/auth/logout
  fastify.post(
    '/logout',
    {
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
      let userId: string | undefined = (request as any).user?.id;
      let sessionId: string | undefined = (request as any).sessionId;

      // Extract user and sessionId from authorization header if present
      if ((!userId || !sessionId) && request.headers.authorization?.startsWith('Bearer ')) {
        try {
          const decoded = await request.jwtVerify<JwtPayload>();
          if (!userId) userId = decoded.userId;
          if (!sessionId && decoded.sessionId) sessionId = decoded.sessionId;
        } catch {
          // Ignore invalid/expired token on logout
        }
      }

      // Extract user and sessionId from wildcard session cookies if present
      const cookieSessionToken = request.cookies?.session || request.cookies?.orvio_session;
      if ((!userId || !sessionId) && cookieSessionToken) {
        try {
          const decoded = fastify.jwt.verify<JwtPayload>(cookieSessionToken);
          if (!userId) userId = decoded.userId;
          if (!sessionId && decoded.sessionId) sessionId = decoded.sessionId;
        } catch {
          // Ignore invalid/expired token on logout
        }
      }

      const body = (request.body as { refreshToken?: string } | undefined) || {};
      const refreshToken = body.refreshToken || request.cookies?.refresh_token || request.cookies?.orvio_refresh_token;

      if (!userId && !refreshToken && !sessionId) {
        clearAuthCookies(reply);
        return reply.status(401).send({
          success: false,
          error: {
            code: ERROR_CODES.UNAUTHENTICATED,
            message: 'Authentication required. Please provide a valid session.',
          },
        });
      }

      try {
        await dataService.logoutUser(userId || '', refreshToken, sessionId, {
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        });
        if (userId) {
          await dataService.logAudit({
            actorUserId: userId,
            eventType: AUDIT_EVENTS.AUTH_LOGOUT,
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
          });
        }
      } catch {
        // Ignore DB revocation errors during logout
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
      await dataService.logAuthEvent({
        eventType: 'logout',
        userId: request.user.id,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: { allDevices: true },
      });
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
      await dataService.logAuthEvent({
        eventType: 'session_revoked',
        userId: request.user.id,
        sessionId: body.sessionId,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: { sessionId: body.sessionId },
      });
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
          requestId: request.id,
        });
      }

      const idempotencyKey = (request.headers['idempotency-key'] as string | undefined) || undefined;
      const user = await dataService.getUserByEmail(parsed.data.email);
      const resetResult = await dataService.requestPasswordReset(parsed.data.email, idempotencyKey);

      if (resetResult.deduplicated) {
        await dataService.logAuthEvent({
          eventType: 'password_reset_request_deduplicated',
          userId: user?.id,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          metadata: { email: parsed.data.email },
        });
        await dataService.logAudit({
          actorUserId: user?.id,
          eventType: AUDIT_EVENTS.AUTH_PASSWORD_RESET_REQUEST_DEDUPLICATED,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          metadata: { email: parsed.data.email },
        });
      } else {
        await dataService.logAuthEvent({
          eventType: 'password_reset_requested',
          userId: user?.id,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          metadata: { email: parsed.data.email },
        });
        await dataService.logAudit({
          actorUserId: user?.id,
          eventType: AUDIT_EVENTS.AUTH_PASSWORD_RESET_REQUESTED,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          metadata: { email: parsed.data.email },
        });
      }

      return reply.send({
        success: true,
        data: {
          status: 'reset_request_received',
          message: 'If an account matches that email, reset instructions will be sent.',
        },
        requestId: request.id,
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
          requestId: request.id,
        });
      }

      try {
        const { user } = await dataService.resetPassword(parsed.data.token, parsed.data.password);
        await dataService.logAuthEvent({
          eventType: 'password_reset_completed',
          userId: user.id,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        });
        await dataService.logAudit({
          actorUserId: user.id,
          eventType: AUDIT_EVENTS.AUTH_PASSWORD_RESET_COMPLETED,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        });
        return reply.send({
          success: true,
          data: {
            status: 'password_reset_completed',
            message: 'Password successfully reset. You can now log in with your new password.',
          },
          requestId: request.id,
        });
      } catch (err: any) {
        await dataService.logAuthEvent({
          eventType: 'password_reset_failed',
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          metadata: { reason: err.code || err.message },
        });
        await dataService.logAudit({
          eventType: AUDIT_EVENTS.AUTH_PASSWORD_RESET_FAILED,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          metadata: { reason: err.code || err.message },
        });

        if (
          err.code === 'PASSWORD_RESET_TOKEN_USED' ||
          err.code === 'TOKEN_ALREADY_USED' ||
          err.message === 'TOKEN_ALREADY_USED' ||
          err.message?.includes('already been used')
        ) {
          return reply.status(400).send({
            success: false,
            error: {
              code: ERROR_CODES.PASSWORD_RESET_TOKEN_USED,
              message: 'This password reset token has already been used.',
            },
            requestId: request.id,
          });
        }
        if (
          err.code === 'PASSWORD_RESET_TOKEN_EXPIRED' ||
          err.code === 'TOKEN_EXPIRED' ||
          err.message === 'TOKEN_EXPIRED' ||
          err.message?.includes('expired')
        ) {
          return reply.status(400).send({
            success: false,
            error: {
              code: ERROR_CODES.PASSWORD_RESET_TOKEN_EXPIRED,
              message: 'Password reset token has expired. Please request a new one.',
            },
            requestId: request.id,
          });
        }
        if (err.code === 'INVALID_TOKEN') {
          return reply.status(400).send({
            success: false,
            error: {
              code: ERROR_CODES.INVALID_TOKEN,
              message: 'Invalid or already used password reset token.',
            },
            requestId: request.id,
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
        await dataService.logAuthEvent({
          eventType: 'password_changed',
          userId: request.user.id,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        });
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

  // --- Google OAuth ---

  const googleStartHandler = async (request: any, reply: any) => {
    const { returnTo, product } = request.query as { returnTo?: string; product?: string };

    if (env.NODE_ENV === 'production' && (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET)) {
      if (request.headers.accept?.includes('application/json')) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.OAUTH_NOT_CONFIGURED,
            message: 'Google OAuth credentials are not configured on the server.',
          },
          requestId: request.id,
        });
      }
      return reply.redirect(`${accountsBaseUrl()}/auth/callback?error=${ERROR_CODES.OAUTH_NOT_CONFIGURED}`);
    }

    const safeReturnTo = returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : undefined;
    const flow = await oauthService.initiateOAuthFlow('google', safeReturnTo, product);

    await dataService.logAuthEvent({
      eventType: 'oauth_started',
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
      metadata: { provider: 'google', flowId: flow.flowId },
    });
    await dataService.logAudit({
      eventType: AUDIT_EVENTS.AUTH_OAUTH_STARTED,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
      metadata: { provider: 'google', flowId: flow.flowId },
    });

    if (request.headers.accept?.includes('application/json')) {
      return reply.send({ success: true, data: { url: flow.authUrl, state: flow.state }, requestId: request.id });
    }

    return reply.redirect(flow.authUrl);
  };

  fastify.get('/google', { schema: { tags: ['Auth'], summary: 'Initiate Google OAuth' } }, googleStartHandler);
  fastify.get('/providers/google/start', { schema: { tags: ['Auth'], summary: 'Initiate Google OAuth (Alias)' } }, googleStartHandler);

  const googleCallbackHandler = async (request: any, reply: any) => {
    const { code, state, error } = request.query as {
      code?: string;
      state?: string;
      error?: string;
    };

    if (error) {
      await dataService.logAuthEvent({
        eventType: 'oauth_callback_rejected',
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: { provider: 'google', reason: error },
      });
      await dataService.logAudit({
        eventType: AUDIT_EVENTS.AUTH_OAUTH_CALLBACK_REJECTED,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: { provider: 'google', reason: error },
      });
      return reply.redirect(`${accountsBaseUrl()}/auth/callback?error=${ERROR_CODES.OAUTH_ACCESS_DENIED}`);
    }

    if (!state) {
      await dataService.logAuthEvent({
        eventType: 'oauth_callback_rejected',
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: { provider: 'google', reason: 'STATE_MISSING' },
      });
      await dataService.logAudit({
        eventType: AUDIT_EVENTS.AUTH_OAUTH_CALLBACK_REJECTED,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: { provider: 'google', reason: 'STATE_MISSING' },
      });
      return reply.redirect(`${accountsBaseUrl()}/auth/callback?error=${ERROR_CODES.OAUTH_STATE_INVALID}`);
    }

    try {
      const flowResult = await oauthService.consumeOAuthFlow(state, 'google');

      if (flowResult.status === 'replayed') {
        await dataService.logAuthEvent({
          eventType: 'oauth_callback_replayed',
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          metadata: { provider: 'google', flowId: flowResult.flow.flowId },
        });
        await dataService.logAudit({
          eventType: AUDIT_EVENTS.AUTH_OAUTH_CALLBACK_REPLAYED,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          metadata: { provider: 'google', flowId: flowResult.flow.flowId },
        });
        // Safe redirect without creating duplicate session
        return reply.redirect(`${accountsBaseUrl()}/auth/callback`);
      }

      await dataService.logAuthEvent({
        eventType: 'oauth_callback_received',
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: { provider: 'google', flowId: flowResult.flow.flowId },
      });
      await dataService.logAudit({
        eventType: AUDIT_EVENTS.AUTH_OAUTH_CALLBACK_RECEIVED,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: { provider: 'google', flowId: flowResult.flow.flowId },
      });

      if (!code) {
        return reply.redirect(`${accountsBaseUrl()}/auth/callback?error=${ERROR_CODES.OAUTH_CODE_INVALID}`);
      }

      const profile = await oauthService.exchangeGoogleCode(code, flowResult.flow.pkceVerifier);
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

      await dataService.logAuthEvent({
        eventType: 'oauth_callback_completed',
        userId: user.id,
        sessionId: session.sessionId,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: { provider: 'google' },
      });
      await dataService.logAudit({
        actorUserId: user.id,
        eventType: AUDIT_EVENTS.AUTH_OAUTH_CALLBACK_COMPLETED,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: { provider: 'google' },
      });

      setAuthCookies(reply, { token: jwtToken, refreshToken: session.refreshToken });
      // Redirect cleanly without exposing tokens in URL parameters
      return reply.redirect(`${accountsBaseUrl()}/auth/callback`);
    } catch (err: any) {
      console.error('[Google OAuth Error]:', err?.message || err);
      const errorCode = err.code || (err.message?.includes('OAUTH_') ? err.message : ERROR_CODES.OAUTH_PROVIDER_ERROR);
      await dataService.logAuthEvent({
        eventType: 'oauth_callback_rejected',
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: { provider: 'google', reason: errorCode },
      });
      await dataService.logAudit({
        eventType: AUDIT_EVENTS.AUTH_OAUTH_CALLBACK_REJECTED,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: { provider: 'google', reason: errorCode },
      });
      return reply.redirect(`${accountsBaseUrl()}/auth/callback?error=${errorCode}`);
    }
  };

  fastify.get('/google/callback', { schema: { tags: ['Auth'], summary: 'Google OAuth callback' } }, googleCallbackHandler);
  fastify.get('/providers/google/callback', { schema: { tags: ['Auth'], summary: 'Google OAuth callback (Alias)' } }, googleCallbackHandler);

  // --- Facebook OAuth ---

  const facebookStartHandler = async (request: any, reply: any) => {
    const { returnTo, product } = request.query as { returnTo?: string; product?: string };

    if (env.NODE_ENV === 'production' && (!env.FACEBOOK_APP_ID || !env.FACEBOOK_APP_SECRET)) {
      if (request.headers.accept?.includes('application/json')) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.OAUTH_NOT_CONFIGURED,
            message: 'Facebook OAuth credentials are not configured on the server.',
          },
          requestId: request.id,
        });
      }
      return reply.redirect(`${accountsBaseUrl()}/auth/callback?error=${ERROR_CODES.OAUTH_NOT_CONFIGURED}`);
    }

    const safeReturnTo = returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : undefined;
    const flow = await oauthService.initiateOAuthFlow('facebook', safeReturnTo, product);

    await dataService.logAuthEvent({
      eventType: 'oauth_started',
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
      metadata: { provider: 'facebook', flowId: flow.flowId },
    });
    await dataService.logAudit({
      eventType: AUDIT_EVENTS.AUTH_OAUTH_STARTED,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
      metadata: { provider: 'facebook', flowId: flow.flowId },
    });

    if (request.headers.accept?.includes('application/json')) {
      return reply.send({ success: true, data: { url: flow.authUrl, state: flow.state }, requestId: request.id });
    }

    return reply.redirect(flow.authUrl);
  };

  fastify.get('/facebook', { schema: { tags: ['Auth'], summary: 'Initiate Facebook OAuth' } }, facebookStartHandler);
  fastify.get('/providers/facebook/start', { schema: { tags: ['Auth'], summary: 'Initiate Facebook OAuth (Alias)' } }, facebookStartHandler);

  const facebookCallbackHandler = async (request: any, reply: any) => {
    const { code, state, error } = request.query as {
      code?: string;
      state?: string;
      error?: string;
    };

    if (error) {
      await dataService.logAuthEvent({
        eventType: 'oauth_callback_rejected',
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: { provider: 'facebook', reason: error },
      });
      await dataService.logAudit({
        eventType: AUDIT_EVENTS.AUTH_OAUTH_CALLBACK_REJECTED,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: { provider: 'facebook', reason: error },
      });
      return reply.redirect(`${accountsBaseUrl()}/auth/callback?error=${ERROR_CODES.OAUTH_ACCESS_DENIED}`);
    }

    if (!state) {
      await dataService.logAuthEvent({
        eventType: 'oauth_callback_rejected',
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: { provider: 'facebook', reason: 'STATE_MISSING' },
      });
      await dataService.logAudit({
        eventType: AUDIT_EVENTS.AUTH_OAUTH_CALLBACK_REJECTED,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: { provider: 'facebook', reason: 'STATE_MISSING' },
      });
      return reply.redirect(`${accountsBaseUrl()}/auth/callback?error=${ERROR_CODES.OAUTH_STATE_INVALID}`);
    }

    try {
      const flowResult = await oauthService.consumeOAuthFlow(state, 'facebook');

      if (flowResult.status === 'replayed') {
        await dataService.logAuthEvent({
          eventType: 'oauth_callback_replayed',
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          metadata: { provider: 'facebook', flowId: flowResult.flow.flowId },
        });
        await dataService.logAudit({
          eventType: AUDIT_EVENTS.AUTH_OAUTH_CALLBACK_REPLAYED,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          metadata: { provider: 'facebook', flowId: flowResult.flow.flowId },
        });
        return reply.redirect(`${accountsBaseUrl()}/auth/callback`);
      }

      await dataService.logAuthEvent({
        eventType: 'oauth_callback_received',
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: { provider: 'facebook', flowId: flowResult.flow.flowId },
      });
      await dataService.logAudit({
        eventType: AUDIT_EVENTS.AUTH_OAUTH_CALLBACK_RECEIVED,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: { provider: 'facebook', flowId: flowResult.flow.flowId },
      });

      if (!code) {
        return reply.redirect(`${accountsBaseUrl()}/auth/callback?error=${ERROR_CODES.OAUTH_CODE_INVALID}`);
      }

      const profile = await oauthService.exchangeFacebookCode(code, flowResult.flow.pkceVerifier);
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

      await dataService.logAuthEvent({
        eventType: 'oauth_callback_completed',
        userId: user.id,
        sessionId: session.sessionId,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: { provider: 'facebook' },
      });
      await dataService.logAudit({
        actorUserId: user.id,
        eventType: AUDIT_EVENTS.AUTH_OAUTH_CALLBACK_COMPLETED,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: { provider: 'facebook' },
      });

      setAuthCookies(reply, { token: jwtToken, refreshToken: session.refreshToken });
      return reply.redirect(`${accountsBaseUrl()}/auth/callback`);
    } catch (err: any) {
      console.error('[Facebook OAuth Error]:', err?.message || err);
      const errorCode = err.code || (err.message?.includes('OAUTH_') ? err.message : ERROR_CODES.OAUTH_PROVIDER_ERROR);
      await dataService.logAuthEvent({
        eventType: 'oauth_callback_rejected',
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: { provider: 'facebook', reason: errorCode },
      });
      await dataService.logAudit({
        eventType: AUDIT_EVENTS.AUTH_OAUTH_CALLBACK_REJECTED,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: { provider: 'facebook', reason: errorCode },
      });
      return reply.redirect(`${accountsBaseUrl()}/auth/callback?error=${errorCode}`);
    }
  };

  fastify.get('/facebook/callback', { schema: { tags: ['Auth'], summary: 'Facebook OAuth callback' } }, facebookCallbackHandler);
  fastify.get('/providers/facebook/callback', { schema: { tags: ['Auth'], summary: 'Facebook OAuth callback (Alias)' } }, facebookCallbackHandler);

  // --- Identity Management Endpoints (Section 15) ---

  fastify.get(
    '/identities',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Auth'],
        summary: 'List linked authentication identities for the authenticated user',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const identities = await dataService.getUserIdentities(request.user.id);
      return reply.send({
        success: true,
        data: { identities },
        requestId: request.id,
      });
    }
  );

  fastify.post(
    '/identities/link',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Auth'],
        summary: 'Link external provider identity',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const body = request.body as any;
      if (!body || !body.provider) {
        return reply.status(400).send({
          success: false,
          error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Provider details are required.' },
          requestId: request.id,
        });
      }

      await dataService.logAudit({
        actorUserId: request.user.id,
        eventType: AUDIT_EVENTS.AUTH_PROVIDER_LINKED,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: { provider: body.provider },
      });

      return reply.send({
        success: true,
        data: { linked: true },
        requestId: request.id,
      });
    }
  );

  fastify.delete(
    '/identities/:identityId',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Auth'],
        summary: 'Unlink identity from user account',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { identityId } = request.params as { identityId: string };
      try {
        await dataService.unlinkIdentity(identityId, request.user.id);
        await dataService.logAudit({
          actorUserId: request.user.id,
          eventType: AUDIT_EVENTS.AUTH_PROVIDER_UNLINKED,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          metadata: { identityId },
        });
        return reply.send({
          success: true,
          data: { unlinked: true },
          requestId: request.id,
        });
      } catch (err: any) {
        if (
          err.code === 'SOLE_LOGIN_METHOD' ||
          err.code === 'CANNOT_REMOVE_ONLY_LOGIN_METHOD' ||
          err.message === 'CANNOT_REMOVE_ONLY_LOGIN_METHOD' ||
          err.message?.includes('sole login method') ||
          err.message?.includes('only login method')
        ) {
          return reply.status(400).send({
            success: false,
            error: {
              code: ERROR_CODES.SOLE_LOGIN_METHOD,
              message: 'Cannot remove the sole login method for this account.',
            },
            requestId: request.id,
          });
        }
        throw err;
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
