import { z } from 'zod';
/**
 * Standardized session error codes.
 */
export declare const SESSION_ERROR_CODES: {
    readonly INVALID_TOKEN: "INVALID_TOKEN";
    readonly SESSION_REVOKED: "SESSION_REVOKED";
    readonly TOKEN_EXPIRED: "TOKEN_EXPIRED";
    readonly SESSION_INVALIDATED: "SESSION_INVALIDATED";
    readonly ACCOUNT_SUSPENDED: "ACCOUNT_SUSPENDED";
    readonly USER_NOT_ACTIVE: "USER_NOT_ACTIVE";
    readonly SESSION_NOT_FOUND: "SESSION_NOT_FOUND";
};
export type SessionErrorCode = (typeof SESSION_ERROR_CODES)[keyof typeof SESSION_ERROR_CODES];
export declare const SessionErrorCodeSchema: z.ZodEnum<["INVALID_TOKEN", "SESSION_REVOKED", "TOKEN_EXPIRED", "SESSION_INVALIDATED", "ACCOUNT_SUSPENDED", "USER_NOT_ACTIVE", "SESSION_NOT_FOUND"]>;
/**
 * Standardized reasons for session invalidation or revocation.
 */
export declare const SESSION_REVOCATION_REASONS: {
    readonly REPLACED_BY_ROTATION: "REPLACED_BY_ROTATION";
    readonly USER_LOGOUT: "USER_LOGOUT";
    readonly EXPLICIT_REVOCATION: "EXPLICIT_REVOCATION";
    readonly TOKEN_REUSE_DETECTED: "TOKEN_REUSE_DETECTED";
    readonly SECURITY_POLICY: "SECURITY_POLICY";
    readonly ACCOUNT_DELETED: "ACCOUNT_DELETED";
    readonly ACCOUNT_SUSPENDED: "ACCOUNT_SUSPENDED";
    readonly TOKEN_VERSION_BUMP: "TOKEN_VERSION_BUMP";
    readonly PASSWORD_RESET: "PASSWORD_RESET";
    readonly SESSION_EXPIRED: "SESSION_EXPIRED";
};
export type SessionRevocationReason = (typeof SESSION_REVOCATION_REASONS)[keyof typeof SESSION_REVOCATION_REASONS];
export declare const SessionRevocationReasonSchema: z.ZodEnum<["REPLACED_BY_ROTATION", "USER_LOGOUT", "EXPLICIT_REVOCATION", "TOKEN_REUSE_DETECTED", "SECURITY_POLICY", "ACCOUNT_DELETED", "ACCOUNT_SUSPENDED", "TOKEN_VERSION_BUMP", "PASSWORD_RESET", "SESSION_EXPIRED"]>;
/**
 * Standard session lifetimes.
 */
export declare const SESSION_LIFETIMES: {
    readonly NORMAL_DAYS: 7;
    readonly REMEMBER_ME_DAYS: 30;
    readonly NORMAL_MS: number;
    readonly REMEMBER_ME_MS: number;
    readonly ACCESS_TOKEN_SECONDS: number;
    readonly ACCESS_TOKEN_MS: number;
};
/**
 * Device and client environment metadata schema.
 */
export declare const DeviceMetadataSchema: z.ZodObject<{
    deviceId: z.ZodOptional<z.ZodString>;
    deviceName: z.ZodOptional<z.ZodString>;
    browser: z.ZodOptional<z.ZodString>;
    os: z.ZodOptional<z.ZodString>;
    deviceType: z.ZodOptional<z.ZodEnum<["desktop", "mobile", "tablet", "unknown"]>>;
    userAgent: z.ZodOptional<z.ZodString>;
    ipAddress: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    deviceId?: string | undefined;
    deviceName?: string | undefined;
    browser?: string | undefined;
    os?: string | undefined;
    deviceType?: "desktop" | "mobile" | "tablet" | "unknown" | undefined;
    userAgent?: string | undefined;
    ipAddress?: string | undefined;
}, {
    deviceId?: string | undefined;
    deviceName?: string | undefined;
    browser?: string | undefined;
    os?: string | undefined;
    deviceType?: "desktop" | "mobile" | "tablet" | "unknown" | undefined;
    userAgent?: string | undefined;
    ipAddress?: string | undefined;
}>;
export type DeviceMetadata = z.infer<typeof DeviceMetadataSchema>;
/**
 * Session creation contract schema (used between Fastify and Convex).
 */
export declare const CreateSessionContractSchema: z.ZodEffects<z.ZodObject<{
    userId: z.ZodString;
    sessionHash: z.ZodString;
    deviceId: z.ZodOptional<z.ZodString>;
    deviceName: z.ZodOptional<z.ZodString>;
    authenticationMethod: z.ZodDefault<z.ZodString>;
    mfaVerified: z.ZodDefault<z.ZodBoolean>;
    rememberMe: z.ZodDefault<z.ZodBoolean>;
    tokenVersion: z.ZodDefault<z.ZodNumber>;
    expiresAt: z.ZodNumber;
    absoluteExpiresAt: z.ZodNumber;
    userAgent: z.ZodOptional<z.ZodString>;
    ipAddress: z.ZodOptional<z.ZodString>;
    lastVisitedUrl: z.ZodOptional<z.ZodString>;
    lastVisitedSubdomain: z.ZodOptional<z.ZodString>;
    lastVisitedAt: z.ZodOptional<z.ZodNumber>;
}, "strict", z.ZodTypeAny, {
    userId: string;
    sessionHash: string;
    authenticationMethod: string;
    mfaVerified: boolean;
    rememberMe: boolean;
    tokenVersion: number;
    expiresAt: number;
    absoluteExpiresAt: number;
    deviceId?: string | undefined;
    deviceName?: string | undefined;
    userAgent?: string | undefined;
    ipAddress?: string | undefined;
    lastVisitedUrl?: string | undefined;
    lastVisitedSubdomain?: string | undefined;
    lastVisitedAt?: number | undefined;
}, {
    userId: string;
    sessionHash: string;
    expiresAt: number;
    absoluteExpiresAt: number;
    deviceId?: string | undefined;
    deviceName?: string | undefined;
    userAgent?: string | undefined;
    ipAddress?: string | undefined;
    authenticationMethod?: string | undefined;
    mfaVerified?: boolean | undefined;
    rememberMe?: boolean | undefined;
    tokenVersion?: number | undefined;
    lastVisitedUrl?: string | undefined;
    lastVisitedSubdomain?: string | undefined;
    lastVisitedAt?: number | undefined;
}>, {
    userId: string;
    sessionHash: string;
    authenticationMethod: string;
    mfaVerified: boolean;
    rememberMe: boolean;
    tokenVersion: number;
    expiresAt: number;
    absoluteExpiresAt: number;
    deviceId?: string | undefined;
    deviceName?: string | undefined;
    userAgent?: string | undefined;
    ipAddress?: string | undefined;
    lastVisitedUrl?: string | undefined;
    lastVisitedSubdomain?: string | undefined;
    lastVisitedAt?: number | undefined;
}, {
    userId: string;
    sessionHash: string;
    expiresAt: number;
    absoluteExpiresAt: number;
    deviceId?: string | undefined;
    deviceName?: string | undefined;
    userAgent?: string | undefined;
    ipAddress?: string | undefined;
    authenticationMethod?: string | undefined;
    mfaVerified?: boolean | undefined;
    rememberMe?: boolean | undefined;
    tokenVersion?: number | undefined;
    lastVisitedUrl?: string | undefined;
    lastVisitedSubdomain?: string | undefined;
    lastVisitedAt?: number | undefined;
}>;
export type CreateSessionContractInput = z.infer<typeof CreateSessionContractSchema>;
/**
 * Session rotation contract schema.
 * Replaces the old session hash with a newly generated session hash,
 * linking the replacement and preserving the fixed absolute expiry.
 */
export declare const RotateSessionContractSchema: z.ZodObject<{
    oldSessionHash: z.ZodString;
    newSessionHash: z.ZodString;
    newExpiresAt: z.ZodNumber;
    userAgent: z.ZodOptional<z.ZodString>;
    ipAddress: z.ZodOptional<z.ZodString>;
    deviceName: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    oldSessionHash: string;
    newSessionHash: string;
    newExpiresAt: number;
    deviceName?: string | undefined;
    userAgent?: string | undefined;
    ipAddress?: string | undefined;
}, {
    oldSessionHash: string;
    newSessionHash: string;
    newExpiresAt: number;
    deviceName?: string | undefined;
    userAgent?: string | undefined;
    ipAddress?: string | undefined;
}>;
export type RotateSessionContractInput = z.infer<typeof RotateSessionContractSchema>;
/**
 * Session validation contract schema.
 */
export declare const ValidateSessionContractSchema: z.ZodEffects<z.ZodObject<{
    sessionHash: z.ZodOptional<z.ZodString>;
    sessionId: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    sessionHash?: string | undefined;
    sessionId?: string | undefined;
}, {
    sessionHash?: string | undefined;
    sessionId?: string | undefined;
}>, {
    sessionHash?: string | undefined;
    sessionId?: string | undefined;
}, {
    sessionHash?: string | undefined;
    sessionId?: string | undefined;
}>;
export type ValidateSessionContractInput = z.infer<typeof ValidateSessionContractSchema>;
/**
 * Session revocation contract schema for single session.
 */
export declare const RevokeSessionContractSchema: z.ZodEffects<z.ZodObject<{
    sessionId: z.ZodOptional<z.ZodString>;
    sessionHash: z.ZodOptional<z.ZodString>;
    reason: z.ZodDefault<z.ZodEnum<["REPLACED_BY_ROTATION", "USER_LOGOUT", "EXPLICIT_REVOCATION", "TOKEN_REUSE_DETECTED", "SECURITY_POLICY", "ACCOUNT_DELETED", "ACCOUNT_SUSPENDED", "TOKEN_VERSION_BUMP", "PASSWORD_RESET", "SESSION_EXPIRED"]>>;
    revokedByUserId: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    reason: "ACCOUNT_SUSPENDED" | "REPLACED_BY_ROTATION" | "USER_LOGOUT" | "EXPLICIT_REVOCATION" | "TOKEN_REUSE_DETECTED" | "SECURITY_POLICY" | "ACCOUNT_DELETED" | "TOKEN_VERSION_BUMP" | "PASSWORD_RESET" | "SESSION_EXPIRED";
    sessionHash?: string | undefined;
    sessionId?: string | undefined;
    revokedByUserId?: string | undefined;
}, {
    sessionHash?: string | undefined;
    sessionId?: string | undefined;
    reason?: "ACCOUNT_SUSPENDED" | "REPLACED_BY_ROTATION" | "USER_LOGOUT" | "EXPLICIT_REVOCATION" | "TOKEN_REUSE_DETECTED" | "SECURITY_POLICY" | "ACCOUNT_DELETED" | "TOKEN_VERSION_BUMP" | "PASSWORD_RESET" | "SESSION_EXPIRED" | undefined;
    revokedByUserId?: string | undefined;
}>, {
    reason: "ACCOUNT_SUSPENDED" | "REPLACED_BY_ROTATION" | "USER_LOGOUT" | "EXPLICIT_REVOCATION" | "TOKEN_REUSE_DETECTED" | "SECURITY_POLICY" | "ACCOUNT_DELETED" | "TOKEN_VERSION_BUMP" | "PASSWORD_RESET" | "SESSION_EXPIRED";
    sessionHash?: string | undefined;
    sessionId?: string | undefined;
    revokedByUserId?: string | undefined;
}, {
    sessionHash?: string | undefined;
    sessionId?: string | undefined;
    reason?: "ACCOUNT_SUSPENDED" | "REPLACED_BY_ROTATION" | "USER_LOGOUT" | "EXPLICIT_REVOCATION" | "TOKEN_REUSE_DETECTED" | "SECURITY_POLICY" | "ACCOUNT_DELETED" | "TOKEN_VERSION_BUMP" | "PASSWORD_RESET" | "SESSION_EXPIRED" | undefined;
    revokedByUserId?: string | undefined;
}>;
export type RevokeSessionContractInput = z.infer<typeof RevokeSessionContractSchema>;
/**
 * Session revocation contract schema for all sessions of a user.
 */
export declare const RevokeAllUserSessionsContractSchema: z.ZodObject<{
    userId: z.ZodString;
    exceptSessionId: z.ZodOptional<z.ZodString>;
    exceptSessionHash: z.ZodOptional<z.ZodString>;
    reason: z.ZodDefault<z.ZodEnum<["REPLACED_BY_ROTATION", "USER_LOGOUT", "EXPLICIT_REVOCATION", "TOKEN_REUSE_DETECTED", "SECURITY_POLICY", "ACCOUNT_DELETED", "ACCOUNT_SUSPENDED", "TOKEN_VERSION_BUMP", "PASSWORD_RESET", "SESSION_EXPIRED"]>>;
}, "strict", z.ZodTypeAny, {
    userId: string;
    reason: "ACCOUNT_SUSPENDED" | "REPLACED_BY_ROTATION" | "USER_LOGOUT" | "EXPLICIT_REVOCATION" | "TOKEN_REUSE_DETECTED" | "SECURITY_POLICY" | "ACCOUNT_DELETED" | "TOKEN_VERSION_BUMP" | "PASSWORD_RESET" | "SESSION_EXPIRED";
    exceptSessionId?: string | undefined;
    exceptSessionHash?: string | undefined;
}, {
    userId: string;
    reason?: "ACCOUNT_SUSPENDED" | "REPLACED_BY_ROTATION" | "USER_LOGOUT" | "EXPLICIT_REVOCATION" | "TOKEN_REUSE_DETECTED" | "SECURITY_POLICY" | "ACCOUNT_DELETED" | "TOKEN_VERSION_BUMP" | "PASSWORD_RESET" | "SESSION_EXPIRED" | undefined;
    exceptSessionId?: string | undefined;
    exceptSessionHash?: string | undefined;
}>;
export type RevokeAllUserSessionsContractInput = z.infer<typeof RevokeAllUserSessionsContractSchema>;
/**
 * Serialized public session metadata returned to user / API callers.
 */
export declare const PublicSessionMetadataSchema: z.ZodObject<{
    id: z.ZodString;
    deviceId: z.ZodOptional<z.ZodString>;
    deviceName: z.ZodOptional<z.ZodString>;
    browser: z.ZodOptional<z.ZodString>;
    operatingSystem: z.ZodOptional<z.ZodString>;
    approximateLocation: z.ZodOptional<z.ZodString>;
    ipAddress: z.ZodOptional<z.ZodString>;
    lastActiveAt: z.ZodNumber;
    createdAt: z.ZodNumber;
    expiresAt: z.ZodNumber;
    absoluteExpiresAt: z.ZodNumber;
    isCurrent: z.ZodDefault<z.ZodBoolean>;
    authenticationMethod: z.ZodOptional<z.ZodString>;
    mfaVerified: z.ZodOptional<z.ZodBoolean>;
    isRevoked: z.ZodOptional<z.ZodBoolean>;
    isExpired: z.ZodOptional<z.ZodBoolean>;
    revocationReason: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    expiresAt: number;
    absoluteExpiresAt: number;
    id: string;
    lastActiveAt: number;
    createdAt: number;
    isCurrent: boolean;
    deviceId?: string | undefined;
    deviceName?: string | undefined;
    browser?: string | undefined;
    ipAddress?: string | undefined;
    authenticationMethod?: string | undefined;
    mfaVerified?: boolean | undefined;
    operatingSystem?: string | undefined;
    approximateLocation?: string | undefined;
    isRevoked?: boolean | undefined;
    isExpired?: boolean | undefined;
    revocationReason?: string | undefined;
}, {
    expiresAt: number;
    absoluteExpiresAt: number;
    id: string;
    lastActiveAt: number;
    createdAt: number;
    deviceId?: string | undefined;
    deviceName?: string | undefined;
    browser?: string | undefined;
    ipAddress?: string | undefined;
    authenticationMethod?: string | undefined;
    mfaVerified?: boolean | undefined;
    operatingSystem?: string | undefined;
    approximateLocation?: string | undefined;
    isCurrent?: boolean | undefined;
    isRevoked?: boolean | undefined;
    isExpired?: boolean | undefined;
    revocationReason?: string | undefined;
}>;
export type PublicSessionMetadata = z.infer<typeof PublicSessionMetadataSchema>;
/**
 * Response schema for GET /users/me/sessions.
 */
export declare const ActiveSessionsResponseSchema: z.ZodObject<{
    sessions: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        deviceId: z.ZodOptional<z.ZodString>;
        deviceName: z.ZodOptional<z.ZodString>;
        browser: z.ZodOptional<z.ZodString>;
        operatingSystem: z.ZodOptional<z.ZodString>;
        approximateLocation: z.ZodOptional<z.ZodString>;
        ipAddress: z.ZodOptional<z.ZodString>;
        lastActiveAt: z.ZodNumber;
        createdAt: z.ZodNumber;
        expiresAt: z.ZodNumber;
        absoluteExpiresAt: z.ZodNumber;
        isCurrent: z.ZodDefault<z.ZodBoolean>;
        authenticationMethod: z.ZodOptional<z.ZodString>;
        mfaVerified: z.ZodOptional<z.ZodBoolean>;
        isRevoked: z.ZodOptional<z.ZodBoolean>;
        isExpired: z.ZodOptional<z.ZodBoolean>;
        revocationReason: z.ZodOptional<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        expiresAt: number;
        absoluteExpiresAt: number;
        id: string;
        lastActiveAt: number;
        createdAt: number;
        isCurrent: boolean;
        deviceId?: string | undefined;
        deviceName?: string | undefined;
        browser?: string | undefined;
        ipAddress?: string | undefined;
        authenticationMethod?: string | undefined;
        mfaVerified?: boolean | undefined;
        operatingSystem?: string | undefined;
        approximateLocation?: string | undefined;
        isRevoked?: boolean | undefined;
        isExpired?: boolean | undefined;
        revocationReason?: string | undefined;
    }, {
        expiresAt: number;
        absoluteExpiresAt: number;
        id: string;
        lastActiveAt: number;
        createdAt: number;
        deviceId?: string | undefined;
        deviceName?: string | undefined;
        browser?: string | undefined;
        ipAddress?: string | undefined;
        authenticationMethod?: string | undefined;
        mfaVerified?: boolean | undefined;
        operatingSystem?: string | undefined;
        approximateLocation?: string | undefined;
        isCurrent?: boolean | undefined;
        isRevoked?: boolean | undefined;
        isExpired?: boolean | undefined;
        revocationReason?: string | undefined;
    }>, "many">;
    currentSessionId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
}, "strict", z.ZodTypeAny, {
    sessions: {
        expiresAt: number;
        absoluteExpiresAt: number;
        id: string;
        lastActiveAt: number;
        createdAt: number;
        isCurrent: boolean;
        deviceId?: string | undefined;
        deviceName?: string | undefined;
        browser?: string | undefined;
        ipAddress?: string | undefined;
        authenticationMethod?: string | undefined;
        mfaVerified?: boolean | undefined;
        operatingSystem?: string | undefined;
        approximateLocation?: string | undefined;
        isRevoked?: boolean | undefined;
        isExpired?: boolean | undefined;
        revocationReason?: string | undefined;
    }[];
    currentSessionId: string | null;
}, {
    sessions: {
        expiresAt: number;
        absoluteExpiresAt: number;
        id: string;
        lastActiveAt: number;
        createdAt: number;
        deviceId?: string | undefined;
        deviceName?: string | undefined;
        browser?: string | undefined;
        ipAddress?: string | undefined;
        authenticationMethod?: string | undefined;
        mfaVerified?: boolean | undefined;
        operatingSystem?: string | undefined;
        approximateLocation?: string | undefined;
        isCurrent?: boolean | undefined;
        isRevoked?: boolean | undefined;
        isExpired?: boolean | undefined;
        revocationReason?: string | undefined;
    }[];
    currentSessionId?: string | null | undefined;
}>;
export type ActiveSessionsResponse = z.infer<typeof ActiveSessionsResponseSchema>;
//# sourceMappingURL=session.d.ts.map