import { z } from 'zod';
/**
 * Standardized session error codes.
 */
export const SESSION_ERROR_CODES = {
    INVALID_TOKEN: 'INVALID_TOKEN',
    SESSION_REVOKED: 'SESSION_REVOKED',
    TOKEN_EXPIRED: 'TOKEN_EXPIRED',
    SESSION_INVALIDATED: 'SESSION_INVALIDATED',
    ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
    USER_NOT_ACTIVE: 'USER_NOT_ACTIVE',
    SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
};
export const SessionErrorCodeSchema = z.enum([
    'INVALID_TOKEN',
    'SESSION_REVOKED',
    'TOKEN_EXPIRED',
    'SESSION_INVALIDATED',
    'ACCOUNT_SUSPENDED',
    'USER_NOT_ACTIVE',
    'SESSION_NOT_FOUND',
]);
/**
 * Standardized reasons for session invalidation or revocation.
 */
export const SESSION_REVOCATION_REASONS = {
    REPLACED_BY_ROTATION: 'REPLACED_BY_ROTATION',
    USER_LOGOUT: 'USER_LOGOUT',
    EXPLICIT_REVOCATION: 'EXPLICIT_REVOCATION',
    TOKEN_REUSE_DETECTED: 'TOKEN_REUSE_DETECTED',
    SECURITY_POLICY: 'SECURITY_POLICY',
    ACCOUNT_DELETED: 'ACCOUNT_DELETED',
    ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
    TOKEN_VERSION_BUMP: 'TOKEN_VERSION_BUMP',
    PASSWORD_RESET: 'PASSWORD_RESET',
    SESSION_EXPIRED: 'SESSION_EXPIRED',
};
export const SessionRevocationReasonSchema = z.enum([
    'REPLACED_BY_ROTATION',
    'USER_LOGOUT',
    'EXPLICIT_REVOCATION',
    'TOKEN_REUSE_DETECTED',
    'SECURITY_POLICY',
    'ACCOUNT_DELETED',
    'ACCOUNT_SUSPENDED',
    'TOKEN_VERSION_BUMP',
    'PASSWORD_RESET',
    'SESSION_EXPIRED',
]);
/**
 * Standard session lifetimes.
 */
export const SESSION_LIFETIMES = {
    NORMAL_DAYS: 7,
    REMEMBER_ME_DAYS: 30,
    NORMAL_MS: 7 * 24 * 60 * 60 * 1000,
    REMEMBER_ME_MS: 30 * 24 * 60 * 60 * 1000,
    ACCESS_TOKEN_SECONDS: 15 * 60, // 15 minutes
    ACCESS_TOKEN_MS: 15 * 60 * 1000,
};
/**
 * Device and client environment metadata schema.
 */
export const DeviceMetadataSchema = z.object({
    deviceId: z.string().optional(),
    deviceName: z.string().optional(),
    browser: z.string().optional(),
    os: z.string().optional(),
    deviceType: z.enum(['desktop', 'mobile', 'tablet', 'unknown']).optional(),
    userAgent: z.string().optional(),
    ipAddress: z.string().optional(),
});
/**
 * Session creation contract schema (used between Fastify and Convex).
 */
export const CreateSessionContractSchema = z.object({
    userId: z.string().min(1, 'userId is required'),
    sessionHash: z.string().min(1, 'sessionHash is required'),
    deviceId: z.string().optional(),
    deviceName: z.string().optional(),
    authenticationMethod: z.string().default('password'),
    mfaVerified: z.boolean().default(false),
    rememberMe: z.boolean().default(false),
    tokenVersion: z.number().int().nonnegative().default(0),
    expiresAt: z.number().positive(),
    absoluteExpiresAt: z.number().positive(),
    userAgent: z.string().optional(),
    ipAddress: z.string().optional(),
    lastVisitedUrl: z.string().optional(),
    lastVisitedSubdomain: z.string().optional(),
    lastVisitedAt: z.number().optional(),
}).strict().refine(({ expiresAt, absoluteExpiresAt }) => absoluteExpiresAt >= expiresAt, { message: 'absoluteExpiresAt must not be before expiresAt' });
/**
 * Session rotation contract schema.
 * Replaces the old session hash with a newly generated session hash,
 * linking the replacement and preserving the fixed absolute expiry.
 */
export const RotateSessionContractSchema = z.object({
    oldSessionHash: z.string().min(1, 'oldSessionHash is required'),
    newSessionHash: z.string().min(1, 'newSessionHash is required'),
    newExpiresAt: z.number().positive(),
    userAgent: z.string().optional(),
    ipAddress: z.string().optional(),
    deviceName: z.string().optional(),
}).strict();
/**
 * Session validation contract schema.
 */
export const ValidateSessionContractSchema = z.object({
    sessionId: z.string().min(1).optional(),
    sessionHash: z.string().min(1, 'sessionHash is required'),
}).partial({ sessionHash: true }).strict().refine(({ sessionId, sessionHash }) => Boolean(sessionId || sessionHash), { message: 'Either sessionId or sessionHash is required' });
/**
 * Session revocation contract schema for single session.
 */
export const RevokeSessionContractSchema = z
    .object({
    sessionId: z.string().optional(),
    sessionHash: z.string().optional(),
    reason: SessionRevocationReasonSchema.default('EXPLICIT_REVOCATION'),
    revokedByUserId: z.string().optional(),
})
    .strict()
    .refine((data) => Boolean(data.sessionId || data.sessionHash), {
    message: 'Either sessionId or sessionHash must be provided to revoke a session',
});
/**
 * Session revocation contract schema for all sessions of a user.
 */
export const RevokeAllUserSessionsContractSchema = z.object({
    userId: z.string().min(1, 'userId is required'),
    exceptSessionId: z.string().optional(),
    exceptSessionHash: z.string().optional(),
    reason: SessionRevocationReasonSchema.default('USER_LOGOUT'),
}).strict();
/**
 * Serialized public session metadata returned to user / API callers.
 */
export const PublicSessionMetadataSchema = z.object({
    id: z.string(),
    deviceId: z.string().optional(),
    deviceName: z.string().optional(),
    browser: z.string().optional(),
    operatingSystem: z.string().optional(),
    approximateLocation: z.string().optional(),
    ipAddress: z.string().optional(),
    lastActiveAt: z.number(),
    createdAt: z.number(),
    expiresAt: z.number(),
    absoluteExpiresAt: z.number(),
    isCurrent: z.boolean().default(false),
    authenticationMethod: z.string().optional(),
    mfaVerified: z.boolean().optional(),
    isRevoked: z.boolean().optional(),
    isExpired: z.boolean().optional(),
    revocationReason: z.string().optional(),
}).strict();
/**
 * Response schema for GET /users/me/sessions.
 */
export const ActiveSessionsResponseSchema = z.object({
    sessions: z.array(PublicSessionMetadataSchema),
    currentSessionId: z.string().nullable().default(null),
}).strict();
//# sourceMappingURL=session.js.map