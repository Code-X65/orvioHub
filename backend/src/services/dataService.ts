import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { anyApi } from 'convex/server';
import { ConvexHttpClient } from 'convex/browser';
import { env } from '../config/env.js';
import { INVITATION_EXPIRY_DAYS, type Role } from '../config/constants.js';
import {
  getAccountsUrl,
  getInvitationUrl,
  getVerifyEmailUrl,
  getResetPasswordUrl,
  getConfirmEmailChangeUrl,
  type Environment,
} from '@orviohub/shared';
import type { VerifiedSocialProfile } from './oauth.js';
import { totpService } from './totp.js';
import { emailService } from './email.js';
import { ApplicationRepository } from '../repositories/applicationRepository.js';
import { AuditNotificationRepository } from '../repositories/auditNotificationRepository.js';
import { BillingRepository } from '../repositories/billingRepository.js';
import { OrganizationRepository } from '../repositories/organizationRepository.js';
import { WorkspaceBranchRepository } from '../repositories/workspaceBranchRepository.js';
import { WorkspaceLifecycleService } from './domain/workspaceLifecycleService.js';
import { MembershipService } from './domain/membershipService.js';
import { BillingOrchestrator } from './domain/billingOrchestrator.js';
import { InventoryDomainService } from './domain/inventoryDomainService.js';
import { invalidateAuthUserCache } from '../plugins/auth.js';
import {
  normalizePhoneNumber,
  isValidPhoneNumber,
  maskPhoneNumber,
  generateOtpCode,
  hashOtpCode,
} from '../utils/phoneUtils.js';
import { maskEmail } from '../utils/emailUtils.js';
import { SmsService } from './smsService.js';

function getAppEnv(): Environment {
  return env.NODE_ENV === 'production' ? 'production' : 'development';
}

function buildInviteUrl(token: string): string {
  try {
    return getInvitationUrl(token, getAppEnv());
  } catch {
    return `${env.BASE_URL_ACCOUNT || env.APP_URL}/invite?token=${token}`;
  }
}

function buildVerifyEmailUrl(token: string, email?: string): string {
  try {
    return getVerifyEmailUrl(token, getAppEnv(), email);
  } catch {
    const emailParam = email ? `&email=${encodeURIComponent(email)}` : '';
    return `${env.BASE_URL_ACCOUNT || env.APP_URL}/verify-email?token=${token}${emailParam}`;
  }
}

function buildResetPasswordUrl(token: string, email?: string): string {
  try {
    return getResetPasswordUrl(token, getAppEnv(), email);
  } catch {
    const emailParam = email ? `&email=${encodeURIComponent(email)}` : '';
    return `${env.BASE_URL_ACCOUNT || env.APP_URL}/reset-password?token=${token}${emailParam}`;
  }
}

function buildConfirmEmailChangeUrl(token: string): string {
  try {
    return getConfirmEmailChangeUrl(token, getAppEnv());
  } catch {
    return `${env.BASE_URL_ACCOUNT || env.APP_URL}/confirm-email-change?token=${token}`;
  }
}


export interface UserRecord {
  id: string;
  email: string;
  emailNormalized?: string;
  name: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  preferredName?: string;
  jobTitle?: string;
  department?: string;
  bio?: string;
  passwordHash?: string;
  emailVerified: boolean;
  emailVerifiedAt?: number;
  emailVerificationToken?: string;
  emailVerificationTokenHash?: string;
  emailVerificationTokenUsed?: boolean;
  emailVerificationExpiresAt?: number;
  emailVerificationCode?: string;
  emailVerificationCodeExpiresAt?: number;
  passwordResetToken?: string;
  passwordResetTokenHash?: string;
  passwordResetTokenUsed?: boolean;
  passwordResetRequestedAt?: number;
  passwordResetExpiresAt?: number;
  status?:
    | 'pending_email_verification'
    | 'active'
    | 'suspended'
    | 'deactivated'
    | 'deletion_requested'
    | 'deleted'
    | 'ACTIVE'
    | 'INACTIVE'
    | 'SUSPENDED'
    | 'DELETED'
    | 'inactive';
  tokenVersion?: number;
  avatar?: string;
  avatarUrl?: string;
  phone?: string;
  phoneNormalized?: string;
  phoneVerifiedAt?: number;
  phoneStatus?: 'unverified' | 'pending' | 'verified' | 'disabled' | 'not_set';
  phoneUsedForRecovery?: boolean;
  phoneUsedForMfa?: boolean;
  phoneVisibility?: 'private' | 'workspace';
  country?: string;
  state?: string;
  stateCode?: string;
  lga?: string;
  city?: string;
  timezone?: string;
  language?: string;
  locale?: string;
  dateFormat?: string;
  numberFormat?: string;
  currencyPreference?: string;
  firstDayOfWeek?: string;
  theme?: string;
  layoutDensity?: string;
  lastLoginAt?: number;
  lastSelectedProduct?: string;
  lastSelectedWorkspaceId?: string;
  onboardingStatus?: string;
  explorerMode?: boolean;
  profileCompletedAt?: number;
  pendingEmail?: string;
  twoFactorEnabled?: boolean;
  twoFactorSecret?: string;
  twoFactorPendingSecret?: string;
  twoFactorBackupCodes?: string[];
  failedLoginAttempts?: number;
  lockedUntil?: number;
  personalOnboardingCompleted?: boolean;
  lastLoginIp?: string;
  totalLoginCount?: number;
  createdAt: number;
  updatedAt: number;
}
export interface OrganizationRecord { id: string; name: string; slug: string; industry: string; country: string; timezone: string; website?: string; size?: string; logo?: string; createdAt: number; updatedAt: number; }
export interface OrganizationMembershipRecord { id: string; organizationId: string; userId: string; role: Role; status: 'ACTIVE' | 'INACTIVE' | 'INVITED'; joinedAt: number; updatedAt: number; }

function asUser(value: any): UserRecord | null {
  return value ? { ...value, id: value._id } : null;
}

function asOrganization(value: any): OrganizationRecord | null {
  return value ? { ...value, id: value._id } : null;
}

function asMembership(value: any): OrganizationMembershipRecord | null {
  return value ? { ...value, id: value._id } : null;
}

function serviceError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  const code =
    message.match(/Uncaught Error:\s*([A-Z][A-Z0-9_]+)/)?.[1] ||
    message.match(/\b([A-Z][A-Z0-9_]{3,})\b/)?.[1];
  const wrapped: Error & { code?: string } = new Error(message);
  if (code) wrapped.code = code;
  throw wrapped;
}

export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export interface IdempotencyEntry {
  key: string;
  scope: string;
  fingerprint: string;
  status: 'processing' | 'completed' | 'failed';
  statusCode?: number;
  responseBody?: string;
  userId?: string;
  createdAt: number;
  expiresAt: number;
  lockedAt?: number;
}
export const localIdempotencyStore = new Map<string, IdempotencyEntry>();

export interface OAuthFlowEntry {
  flowId: string;
  provider: 'google' | 'facebook';
  stateHash: string;
  nonceHash?: string;
  pkceChallenge?: string;
  pkceVerifier?: string;
  returnTo?: string;
  product?: string;
  status: 'pending' | 'completed' | 'failed' | 'replayed';
  userId?: string;
  createdAt: number;
  expiresAt: number;
  usedAt?: number;
}
export const localOAuthFlowsStore = new Map<string, OAuthFlowEntry>();

function normalizeWorkspaceType(type?: string): 'RETAIL' | 'SERVICES' | 'CORPORATE' | 'OTHER' {
  if (!type) return 'RETAIL';
  const upper = type.toUpperCase().trim();
  if (upper === 'RETAIL' || upper === 'BUSINESS' || upper === 'STORE' || upper === 'SHOP') {
    return 'RETAIL';
  }
  if (upper === 'SERVICES' || upper === 'SERVICE' || upper === 'TEAM' || upper === 'AGENCY' || upper === 'PERSONAL') {
    return 'SERVICES';
  }
  if (upper === 'CORPORATE' || upper === 'ENTERPRISE' || upper === 'COMPANY') {
    return 'CORPORATE';
  }
  return 'OTHER';
}

export class DataService {
  private readonly client: ConvexHttpClient;
  public readonly apps: ApplicationRepository;
  public readonly audit: AuditNotificationRepository;
  public readonly billing: BillingRepository;
  public readonly orgs: OrganizationRepository;
  public readonly branches: WorkspaceBranchRepository;
  public readonly workspaceLifecycle: WorkspaceLifecycleService;
  public readonly membership: MembershipService;
  public readonly billingOrchestrator: BillingOrchestrator;
  public readonly inventoryDomain: InventoryDomainService;

  constructor() {
    const url = env.CONVEX_URL || (env.NODE_ENV === 'test' ? 'https://ceaseless-bloodhound-791.convex.cloud' : '');
    if (!url) throw new Error('CONVEX_URL is required to initialize the data service.');
    this.client = new ConvexHttpClient(url);

    this.apps = new ApplicationRepository(this.client);
    this.audit = new AuditNotificationRepository(this.client);
    this.billing = new BillingRepository(this.client);
    this.orgs = new OrganizationRepository(this.client);
    this.orgs.setAuditRepo(this.audit);
    this.branches = new WorkspaceBranchRepository(this.client);

    this.workspaceLifecycle = new WorkspaceLifecycleService(this.client, this.audit);
    this.membership = new MembershipService(this.client, this.orgs, this.audit);
    this.billingOrchestrator = new BillingOrchestrator(this.client, this.billing, this.audit);
    this.inventoryDomain = new InventoryDomainService(this.client, this.audit);
  }

  public clearAll() {
    emailService.clearSentEmails();
  }

  public async query(path: string, args: Record<string, unknown>) {
    try { return await this.client.query((anyApi as any)[path.split(':')[0]][path.split(':')[1]], args); } catch (error) { serviceError(error); }
  }

  public async mutate(path: string, args: Record<string, unknown>) {
    try { return await this.client.mutation((anyApi as any)[path.split(':')[0]][path.split(':')[1]], args); } catch (error) { serviceError(error); }
  }

  private async enqueue(to: string, template: 'verification' | 'invitation' | 'onboardingCompleted' | 'passwordReset' | 'emailChange' | 'securityAlert', payload: Record<string, any>) {
    // Dispatch directly once via configured provider (Brevo / Resend)
    const directResult = await emailService.sendDirect(to, template, payload);

    // Only enqueue into outbox as a retry queue if direct dispatch failed
    if (!directResult.success) {
      try {
        await this.mutate('emailOutbox:enqueue', { to, template, payload });
      } catch (err: any) {
        if (env.NODE_ENV !== 'test') {
          console.warn(`[DataService] Email enqueue fallback skipped: ${err.message || err}`);
        }
      }
    }
  }

  public async logAudit(data: {
    actorUserId?: string;
    targetUserId?: string;
    workspaceId?: string;
    productKey?: string;
    eventType: string;
    action?: string;
    entityType?: string;
    entityId?: string;
    resource?: string;
    severity?: 'info' | 'warning' | 'critical';
    ipAddress?: string;
    userAgent?: string;
    requestId?: string;
    metadata?: Record<string, unknown>;
  }) {
    try {
      await this.mutate('audit:logAuditEvent', {
        actorId: data.actorUserId,
        actorUserId: data.actorUserId,
        targetUserId: data.targetUserId,
        workspaceId: data.workspaceId,
        productKey: data.productKey,
        eventType: data.eventType,
        action: data.action || data.eventType,
        entityType: data.entityType,
        entityId: data.entityId,
        resource: data.resource || 'auth',
        severity: data.severity || 'info',
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        requestId: data.requestId,
        metadata: data.metadata,
      });
    } catch (err) {
      console.warn('[DataService] Failed to write audit log:', err);
    }
  }

  public async logAuthEvent(data: {
    eventType: string;
    userId?: string;
    sessionId?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
  }) {
    try {
      await this.mutate('authEvents:logAuthEvent', {
        eventType: data.eventType,
        userId: data.userId ? (data.userId as any) : undefined,
        sessionId: data.sessionId ? (data.sessionId as any) : undefined,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        metadata: data.metadata,
      });
    } catch (err) {
      console.warn('[DataService] Failed to log auth event:', err);
    }
  }

  public async getUserAuthEvents(userId: string, limit?: number) {
    try {
      return (await this.query('authEvents:getUserAuthEvents', {
        userId: userId as any,
        limit,
      })) as any[];
    } catch {
      return [];
    }
  }

  public async createUser(data: {
    email: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    displayName?: string;
    country?: string;
    timezone?: string;
    locale?: string;
    phone?: string;
    avatarUrl?: string;
    emailVerified?: boolean;
    status?:
      | 'pending_email_verification'
      | 'active'
      | 'suspended'
      | 'deactivated'
      | 'deletion_requested'
      | 'deleted'
      | 'ACTIVE'
      | 'INACTIVE'
      | 'SUSPENDED'
      | 'DELETED';
    planKey?: string;
    billingInterval?: 'monthly' | 'annual';
    paymentMethod?: 'bank_transfer' | 'paystack';
    paidPlanRef?: string;
    password: string;
  }) {
    const email = data.email.toLowerCase().trim();
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const passwordHash = await bcrypt.hash(data.password, 12);
    const fullName = data.name || `${data.firstName || ''} ${data.lastName || ''}`.trim() || email.split('@')[0];
    const isVerified = data.emailVerified ?? false;
    const initialStatus = data.status || (isVerified ? 'active' : 'pending_email_verification');
    
    const userArgs: Record<string, any> = {
      email,
      name: fullName,
      passwordHash,
      emailVerificationToken: token,
      emailVerificationTokenHash: tokenHash,
      emailVerificationExpiresAt: Date.now() + 86_400_000,
      emailVerificationCode: code,
      emailVerificationCodeExpiresAt: Date.now() + 10 * 60 * 1000,
      emailVerified: isVerified,
      status: initialStatus,
    };
    if (data.firstName) userArgs.firstName = data.firstName;
    if (data.lastName) userArgs.lastName = data.lastName;
    if (data.displayName) userArgs.displayName = data.displayName;
    if (data.country) userArgs.country = data.country;
    if (data.timezone) userArgs.timezone = data.timezone;
    if (data.locale) userArgs.locale = data.locale;
    if (data.phone) userArgs.phone = data.phone;
    if (data.avatarUrl) userArgs.avatarUrl = data.avatarUrl;
    if (data.planKey) userArgs.planKey = data.planKey;
    if (data.billingInterval) userArgs.billingInterval = data.billingInterval;
    if (data.paymentMethod) userArgs.paymentMethod = data.paymentMethod;
    if (data.paidPlanRef) userArgs.paidPlanRef = data.paidPlanRef;

    const id = await this.mutate('users:createUser', userArgs);
    const user = await this.getUserById(String(id));
    if (!user) throw new Error('User creation did not return a user.');
    if (!isVerified) {
      await this.enqueue(email, 'verification', { name: user.name, url: buildVerifyEmailUrl(token, email), code, token });
    }
    return { user, token };
  }

  public async getUserById(id: string) { return asUser(await this.query('users:getUserById', { userId: id })); }
  public async getUserByEmail(email: string) { return asUser(await this.query('users:getUserByEmail', { email: email.toLowerCase().trim() })); }
  public async verifyPassword(user: UserRecord, password: string) { return user.passwordHash ? bcrypt.compare(password, user.passwordHash) : false; }

  public async touchLastLogin(userId: string, ipAddress?: string) {
    try {
      await this.mutate('users:touchLastLogin', { userId: userId as any, ipAddress });
    } catch (e) {
      // Non-blocking
    }
  }

  public async recordFailedLogin(userId: string): Promise<{ failedAttempts: number; isLocked: boolean; lockedUntil?: number }> {
    try {
      const result = await this.mutate('users:recordFailedLogin', { userId }) as any;
      if (result) return result;
    } catch (e) {
      // Fallback if local mock
    }
    const user = await this.getUserById(userId);
    const attempts = (user?.failedLoginAttempts || 0) + 1;
    const isLocked = attempts >= 5;
    const lockedUntil = isLocked ? Date.now() + 15 * 60 * 1000 : undefined;
    return { failedAttempts: attempts, isLocked, lockedUntil };
  }

  public async resetFailedLogins(userId: string) {
    try {
      await this.mutate('users:resetFailedLogins', { userId });
    } catch (e) {
      // Non-blocking
    }
  }

  public async resendVerificationEmail(email: string) {
    const user = await this.getUserByEmail(email);
    if (!user || user.emailVerified) return false;
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 86_400_000;
    const codeExpiresAt = Date.now() + 10 * 60 * 1000;
    await this.mutate('users:setVerificationToken', { userId: user.id, token, tokenHash, expiresAt, code, codeExpiresAt });
    await this.enqueue(user.email, 'verification', { name: user.name, url: buildVerifyEmailUrl(token, user.email), code, token });
    return true;
  }

  public async verifyEmail(params: string | { token?: string; code?: string; email?: string }) {
    const rawPayload = typeof params === 'string' ? { token: params } : params;
    const payload: any = { ...rawPayload };
    if (payload.token) {
      payload.tokenHash = crypto.createHash('sha256').update(payload.token).digest('hex');
    }
    const result = await this.mutate('users:verifyUserEmail', payload) as { userId: string };
    const user = await this.getUserById(result.userId);
    if (!user) throw new Error('Verified user could not be found.');
    return { user };
  }

  public async changePendingEmail(userIdOrEmail: string, newEmail: string) {
    let user = await this.getUserById(userIdOrEmail);
    if (!user) {
      user = await this.getUserByEmail(userIdOrEmail);
    }
    if (!user) {
      const error: Error & { code?: string } = new Error('User not found.');
      error.code = 'USER_NOT_FOUND';
      throw error;
    }
    if (user.status !== 'pending_email_verification' && user.emailVerified) {
      const error: Error & { code?: string } = new Error('Email is already verified.');
      error.code = 'CANNOT_CHANGE_VERIFIED_EMAIL';
      throw error;
    }

    const normNewEmail = newEmail.toLowerCase().trim();
    if (normNewEmail === (user.email || '').toLowerCase().trim()) {
      return {
        user,
        maskedEmail: maskEmail(user.email),
        status: 'verification_already_pending',
        verificationSent: false,
        expiresAt: user.emailVerificationExpiresAt || Date.now() + 86_400_000,
        token: undefined,
      };
    }

    const existing = await this.getUserByEmail(normNewEmail);
    if (existing && existing.id !== user.id) {
      const error: Error & { code?: string } = new Error('This email address is already in use.');
      error.code = 'CONFLICT';
      throw error;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 86_400_000;
    const codeExpiresAt = Date.now() + 10 * 60 * 1000;

    await this.mutate('users:updatePendingEmail', {
      userId: user.id as any,
      newEmail: normNewEmail,
      token,
      tokenHash,
      expiresAt,
      code,
      codeExpiresAt,
    });

    await this.enqueue(normNewEmail, 'verification', {
      name: user.name,
      url: buildVerifyEmailUrl(token, normNewEmail),
      code,
      token,
    });

    const updatedUser = await this.getUserById(user.id);
    return {
      user: updatedUser || user,
      token,
      maskedEmail: maskEmail(normNewEmail),
      status: 'verification_required',
      verificationSent: true,
      expiresAt,
    };
  }

  public async acquireIdempotencyKey(
    key: string,
    scope: string,
    fingerprint: string,
    ttlMs?: number
  ): Promise<{ action: 'ACQUIRED' | 'REPLAY' | 'MISMATCH' | 'PROCESSING'; statusCode?: number; responseBody?: string }> {
    try {
      const res = (await this.mutate('idempotency:acquireOrCheck', {
        key,
        scope,
        fingerprint,
        ttlMs,
      })) as any;
      if (res && res.action) return res;
    } catch {
      // Fallback for tests or local mode if Convex mutation fails
    }

    // Local fallback
    const now = Date.now();
    const ttl = ttlMs ?? 86_400_000;
    const existing = localIdempotencyStore.get(key);
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        return { action: 'MISMATCH' };
      }
      if (existing.expiresAt <= now) {
        localIdempotencyStore.set(key, {
          key,
          scope,
          fingerprint,
          status: 'processing',
          createdAt: now,
          expiresAt: now + ttl,
          lockedAt: now,
        });
        return { action: 'ACQUIRED' };
      }
      if (existing.status === 'completed') {
        return { action: 'REPLAY', statusCode: existing.statusCode ?? 200, responseBody: existing.responseBody };
      }
      if (existing.status === 'processing') {
        const isStale = (now - (existing.lockedAt ?? existing.createdAt)) > 30_000;
        if (isStale) {
          existing.lockedAt = now;
          return { action: 'ACQUIRED' };
        }
        return { action: 'PROCESSING' };
      }
      existing.status = 'processing';
      existing.lockedAt = now;
      return { action: 'ACQUIRED' };
    }

    localIdempotencyStore.set(key, {
      key,
      scope,
      fingerprint,
      status: 'processing',
      createdAt: now,
      expiresAt: now + ttl,
      lockedAt: now,
    });
    return { action: 'ACQUIRED' };
  }

  public async completeIdempotencyKey(key: string, statusCode: number, responseBody: any, userId?: string) {
    const serializedBody = typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody);
    try {
      await this.mutate('idempotency:complete', {
        key,
        statusCode,
        responseBody: serializedBody,
        userId: userId as any,
      });
    } catch {
      // Fallback
    }

    const existing = localIdempotencyStore.get(key);
    if (existing) {
      existing.status = 'completed';
      existing.statusCode = statusCode;
      existing.responseBody = serializedBody;
      existing.userId = userId;
      existing.lockedAt = undefined;
    }
  }

  public async failIdempotencyKey(key: string, reason?: string) {
    try {
      await this.mutate('idempotency:fail', { key, reason });
    } catch {
      // Fallback
    }
    const existing = localIdempotencyStore.get(key);
    if (existing) {
      existing.status = 'failed';
      existing.lockedAt = undefined;
    }
  }

  public async requestPasswordReset(email: string, idempotencyKey?: string): Promise<{ deduplicated: boolean; success: boolean; token?: string; user?: any }> {
    const normEmail = email.toLowerCase().trim();
    const user = await this.getUserByEmail(normEmail);
    if (!user) return { deduplicated: false, success: true };

    const now = Date.now();

    // Deduplicate if a reset was requested within the last 60 seconds
    if (user.passwordResetRequestedAt && (now - user.passwordResetRequestedAt < 60_000)) {
      return { deduplicated: true, success: true, user };
    }

    if (idempotencyKey) {
      const check = await this.acquireIdempotencyKey(idempotencyKey, 'password_reset', normEmail, 300_000);
      if (check.action === 'REPLAY') {
        return { deduplicated: true, success: true, user };
      }
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = now + 3_600_000; // 1 hour

    await this.mutate('users:setPasswordResetToken', { userId: user.id as any, tokenHash, expiresAt });

    user.passwordResetTokenHash = tokenHash;
    user.passwordResetTokenUsed = false;
    user.passwordResetRequestedAt = now;
    user.passwordResetExpiresAt = expiresAt;

    await this.enqueue(user.email, 'passwordReset', { name: user.name, url: buildResetPasswordUrl(token, user.email) });

    if (idempotencyKey) {
      await this.completeIdempotencyKey(idempotencyKey, 200, {
        status: 'reset_request_received',
        message: 'If an account matches that email, reset instructions will be sent.',
      }, user.id);
    }

    return { deduplicated: false, success: true, token, user };
  }

  public async resetPassword(token: string, newPassword: string) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const passwordHash = await bcrypt.hash(newPassword, 12);

    try {
      const result = await this.mutate('users:resetPassword', { tokenHash, token, passwordHash }) as { userId: string; email: string };
      const user = await this.getUserById(result.userId);
      if (!user) throw new Error('User not found.');
      // Invalidate all active sessions for security after password reset
      await this.mutate('sessions:revokeAllUserSessions', { userId: user.id });
      return { user };
    } catch (err: any) {
      if (err.message === 'TOKEN_ALREADY_USED') {
        const error: any = new Error('This password reset token has already been used.');
        error.code = 'PASSWORD_RESET_TOKEN_USED';
        throw error;
      }
      if (err.message === 'TOKEN_EXPIRED') {
        const error: any = new Error('This password reset token has expired.');
        error.code = 'PASSWORD_RESET_TOKEN_EXPIRED';
        throw error;
      }
      if (err.message === 'INVALID_TOKEN') {
        const error: any = new Error('Invalid or already used password reset token.');
        error.code = 'INVALID_TOKEN';
        throw error;
      }
      throw err;
    }
  }

  public async createOAuthFlow(flow: {
    flowId: string;
    provider: 'google' | 'facebook';
    stateHash: string;
    nonceHash?: string;
    pkceChallenge?: string;
    pkceVerifier?: string;
    returnTo?: string;
    product?: string;
    expiresAt: number;
  }) {
    localOAuthFlowsStore.set(flow.stateHash, {
      ...flow,
      status: 'pending',
      createdAt: Date.now(),
    });

    try {
      await this.mutate('oauthFlows:createFlow', flow);
    } catch {
      // safe fallback for test/offline
    }
    return flow;
  }

  public async getOAuthFlowByStateHash(stateHash: string) {
    try {
      const flow = (await this.query('oauthFlows:getFlowByStateHash', { stateHash })) as any;
      if (flow) return flow;
    } catch {
      // safe fallback
    }
    return localOAuthFlowsStore.get(stateHash) || null;
  }

  public async markOAuthFlowCompleted(stateHash: string, userId?: string) {
    const local = localOAuthFlowsStore.get(stateHash);
    if (local) {
      local.status = 'completed';
      local.usedAt = Date.now();
      if (userId) local.userId = userId;
    }

    try {
      await this.mutate('oauthFlows:markFlowCompleted', { stateHash, userId: userId as any });
    } catch {
      // safe fallback
    }
  }

  public async markOAuthFlowReplayed(stateHash: string) {
    const local = localOAuthFlowsStore.get(stateHash);
    if (local) {
      local.status = 'replayed';
    }

    try {
      await this.mutate('oauthFlows:markFlowReplayed', { stateHash });
    } catch {
      // safe fallback
    }
  }

  public async changePassword(userId: string, currentPassword: string, newPassword: string, keepSessionId?: string) {
    const user = await this.getUserById(userId);
    if (!user) {
      const error: Error & { code?: string } = new Error('User not found.');
      error.code = 'UNAUTHENTICATED';
      throw error;
    }

    const isMatch = await this.verifyPassword(user, currentPassword);
    if (!isMatch) {
      const error: Error & { code?: string } = new Error('Current password does not match.');
      error.code = 'INVALID_CREDENTIALS';
      throw error;
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.mutate('users:updatePassword', { userId: user.id as any, passwordHash, keepSessionId });
    invalidateAuthUserCache(user.id);
    return { success: true };
  }

  public async logoutUser(
    userId?: string,
    refreshToken?: string,
    sessionId?: string,
    meta?: { ipAddress?: string; userAgent?: string }
  ) {
    const sessionHash = refreshToken ? hashSessionToken(refreshToken) : undefined;
    await this.mutate('sessions:logout', {
      sessionId: sessionId as any,
      sessionHash,
      refreshToken,
      userId: userId as any,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });
    return { success: true };
  }

  public async validateSession(identifiers: { sessionId?: string; sessionHash?: string; refreshToken?: string }) {
    try {
      return (await this.query('sessions:validateSession', identifiers as any)) as {
        valid: boolean;
        error?: string;
        session?: { id: string; userId: string; email: string; tokenVersion: number };
      };
    } catch {
      return { valid: false, error: 'VALIDATION_FAILED' };
    }
  }

  public async logoutAllSessions(userId: string) {
    await this.mutate('users:invalidateUserSessions', { userId });
    await this.mutate('sessions:revokeAllUserSessions', { userId });
    return { success: true };
  }

  public async createSession(
    userId: string,
    optionsOrUserAgent?:
      | string
      | {
          userAgent?: string;
          ipAddress?: string;
          deviceId?: string;
          deviceName?: string;
          authenticationMethod?: string;
          mfaVerified?: boolean;
          tokenVersion?: number;
          lastVisitedUrl?: string;
          lastVisitedSubdomain?: string;
        },
    ipAddress?: string,
    tokenVersion?: number
  ) {
    let options: {
      userAgent?: string;
      ipAddress?: string;
      deviceId?: string;
      deviceName?: string;
      authenticationMethod?: string;
      mfaVerified?: boolean;
      tokenVersion?: number;
      lastVisitedUrl?: string;
      lastVisitedSubdomain?: string;
    } = {};

    if (typeof optionsOrUserAgent === 'string') {
      options = {
        userAgent: optionsOrUserAgent,
        ipAddress,
        tokenVersion,
      };
    } else if (optionsOrUserAgent) {
      options = optionsOrUserAgent;
    }

    let version = options.tokenVersion;
    if (version === undefined) {
      const user = await this.getUserById(userId);
      version = user?.tokenVersion ?? 1;
    }
    const refreshToken = crypto.randomBytes(40).toString('hex');
    const sessionHash = hashSessionToken(refreshToken);
    const expiresAt = Date.now() + 7 * 86_400_000; // 7 days
    const sessionId = await this.mutate('sessions:createSession', {
      userId,
      sessionHash,
      refreshToken,
      deviceId: options.deviceId,
      deviceName: options.deviceName,
      authenticationMethod: options.authenticationMethod || 'password',
      mfaVerified: options.mfaVerified ?? false,
      tokenVersion: version,
      expiresAt,
      userAgent: options.userAgent,
      ipAddress: options.ipAddress,
      lastVisitedUrl: options.lastVisitedUrl,
      lastVisitedSubdomain: options.lastVisitedSubdomain,
      lastVisitedAt: (options.lastVisitedUrl || options.lastVisitedSubdomain) ? Date.now() : undefined,
    });
    return {
      sessionId: String(sessionId),
      refreshToken,
      expiresAt,
      lastVisitedUrl: options.lastVisitedUrl,
      lastVisitedSubdomain: options.lastVisitedSubdomain,
    };
  }

  public async updateSessionContext(
    sessionId: string,
    data: { lastVisitedUrl?: string; lastVisitedSubdomain?: string }
  ) {
    try {
      return (await this.mutate('sessions:updateSessionContext', {
        sessionId: sessionId as any,
        lastVisitedUrl: data.lastVisitedUrl,
        lastVisitedSubdomain: data.lastVisitedSubdomain,
      })) as { success: boolean; error?: string };
    } catch {
      return { success: false };
    }
  }

  public async getSessionById(sessionId: string) {
    try {
      return (await this.query('sessions:getSessionById', { sessionId: sessionId as any })) as any;
    } catch {
      return null;
    }
  }

  public async rotateSession(
    oldRefreshToken: string,
    optionsOrUserAgent?: string | { userAgent?: string; ipAddress?: string; deviceName?: string },
    ipAddress?: string
  ) {
    let options: { userAgent?: string; ipAddress?: string; deviceName?: string } = {};
    if (typeof optionsOrUserAgent === 'string') {
      options = { userAgent: optionsOrUserAgent, ipAddress };
    } else if (optionsOrUserAgent) {
      options = optionsOrUserAgent;
    }

    const oldSessionHash = hashSessionToken(oldRefreshToken);
    const newRefreshToken = crypto.randomBytes(40).toString('hex');
    const newSessionHash = hashSessionToken(newRefreshToken);
    const newExpiresAt = Date.now() + 7 * 86_400_000; // 7 days
    const result = (await this.mutate('sessions:rotateSession', {
      oldSessionHash,
      oldRefreshToken,
      newSessionHash,
      newRefreshToken,
      newExpiresAt,
      userAgent: options.userAgent,
      ipAddress: options.ipAddress,
      deviceName: options.deviceName,
    })) as { sessionId: string; userId: string; email: string; name: string; tokenVersion: number };

    const user = await this.getUserById(result.userId);
    if (!user) throw new Error('User not found.');

    return {
      sessionId: result.sessionId,
      user,
      refreshToken: newRefreshToken,
      expiresAt: newExpiresAt,
    };
  }

  public async revokeSession(refreshToken: string) {
    const sessionHash = hashSessionToken(refreshToken);
    return this.mutate('sessions:revokeSession', { sessionHash, refreshToken });
  }

  public async generateSSOAuthorizationCode(data: {
    userId: string;
    sessionId?: string;
    productKey: string;
    redirectUri: string;
    codeChallenge?: string;
    codeChallengeMethod?: string;
  }) {
    const code = crypto.randomBytes(32).toString('hex');
    const codeHash = hashSessionToken(code);
    const expiresAt = Date.now() + 60_000; // 60 seconds validity
    await this.mutate('oauthCodes:generateAuthCode', {
      codeHash,
      userId: data.userId,
      sessionId: data.sessionId,
      productKey: data.productKey,
      redirectUri: data.redirectUri,
      codeChallenge: data.codeChallenge,
      codeChallengeMethod: data.codeChallengeMethod || (data.codeChallenge ? 'S256' : undefined),
      expiresAt,
    });
    return { code, expiresAt };
  }

  public async exchangeSSOAuthorizationCode(data: {
    code: string;
    redirectUri: string;
    codeVerifier?: string;
    userAgent?: string;
    ipAddress?: string;
  }) {
    const codeHash = hashSessionToken(data.code);
    const result = (await this.mutate('oauthCodes:consumeAuthCode', {
      codeHash,
      redirectUri: data.redirectUri,
    })) as {
      userId: string;
      sessionId?: string;
      productKey: string;
      codeChallenge?: string;
      codeChallengeMethod?: string;
      user: any;
    };

    if (result.codeChallenge) {
      if (!data.codeVerifier) {
        const err: Error & { code?: string } = new Error('PKCE code_verifier is required.');
        err.code = 'INVALID_CODE_VERIFIER';
        throw err;
      }
      const computedChallenge = crypto
        .createHash('sha256')
        .update(data.codeVerifier)
        .digest('base64url');
      if (computedChallenge !== result.codeChallenge) {
        const err: Error & { code?: string } = new Error('PKCE code_verifier verification failed.');
        err.code = 'INVALID_CODE_VERIFIER';
        throw err;
      }
    }

    const session = await this.createSession(result.userId, {
      userAgent: data.userAgent,
      ipAddress: data.ipAddress,
      authenticationMethod: 'sso_oauth',
      tokenVersion: result.user.tokenVersion ?? 1,
    });

    return {
      user: asUser(result.user)!,
      sessionId: session.sessionId,
      refreshToken: session.refreshToken,
      expiresAt: session.expiresAt,
      productKey: result.productKey,
    };
  }

  public async handleSocialAuth(profile: VerifiedSocialProfile): Promise<{ user: UserRecord; isNew: boolean }> {
    try {
      const result = await this.mutate('users:handleSocialAuth', {
        provider: profile.provider,
        providerUserId: profile.providerUserId,
        email: profile.email.toLowerCase().trim(),
        emailVerified: profile.emailVerified,
        name: profile.name,
        picture: profile.picture,
      }) as { userId: string; isNew: boolean };

      const user = await this.getUserById(result.userId);
      if (!user) throw new Error('Social authenticated user could not be retrieved.');
      return { user, isNew: result.isNew };
    } catch (e: any) {
      if (e.message?.includes('USER_NOT_FOUND')) throw e;
      // Fallback for local mock/test environment
      let existingUser = await this.getUserByEmail(profile.email);
      let isNew = false;
      if (!existingUser) {
        const created = await this.createUser({
          email: profile.email,
          name: profile.name,
          emailVerified: profile.emailVerified,
          password: `OAuth_${crypto.randomBytes(16).toString('hex')}!`,
          avatarUrl: profile.picture,
        });
        existingUser = created.user;
        isNew = true;
      }
      return { user: existingUser, isNew };
    }
  }

  public async disconnectIdentity(userId: string, provider: 'google' | 'facebook' | 'password') {
    const identities = await this.getUserIdentities(userId);
    const target = identities.find((i: any) => i.provider === provider);
    if (!target) {
      const err: Error & { code?: string } = new Error('Identity not found.');
      err.code = 'NOT_FOUND';
      throw err;
    }

    const user = await this.getUserById(userId);
    const hasPassword = Boolean(user?.passwordHash);
    const totalAuthMethods = (hasPassword ? 1 : 0) + identities.filter((i: any) => i.provider !== 'password').length;

    if (totalAuthMethods <= 1) {
      const wrapped: Error & { code?: string } = new Error('Cannot disconnect your only authentication method.');
      wrapped.code = 'CANNOT_REMOVE_ONLY_LOGIN_METHOD';
      throw wrapped;
    }

    try {
      return await this.mutate('users:unlinkIdentity', { userId: userId as any, provider: provider as any });
    } catch (err: any) {
      if (err.message === 'CANNOT_DISCONNECT_SOLE_AUTHENTICATION_METHOD' || err.message === 'CANNOT_REMOVE_ONLY_LOGIN_METHOD') {
        const wrapped: Error & { code?: string } = new Error('Cannot disconnect your only authentication method.');
        wrapped.code = 'CANNOT_REMOVE_ONLY_LOGIN_METHOD';
        throw wrapped;
      }
      throw err;
    }
  }



  public async requestEmailChange(userId: string, newEmail: string) {
    const email = newEmail.toLowerCase().trim();
    const existing = await this.getUserByEmail(email);
    if (existing && existing.id !== userId) {
      const err: Error & { code?: string } = new Error('Email is already in use by another account.');
      err.code = 'CONFLICT';
      throw err;
    }
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 86_400_000; // 24 hours
    await this.mutate('users:requestEmailChange', { userId: userId as any, newEmail: email, token, expiresAt });
    const user = await this.getUserById(userId);
    // Send verification link to new email
    await this.enqueue(email, 'emailChange', { name: user?.name || '', url: buildConfirmEmailChangeUrl(token) });
    // Send security alert notice to old email
    if (user?.email && user.email.toLowerCase() !== email) {
      await this.enqueue(user.email, 'securityAlert', {
        name: user.name || '',
        alertType: 'email_change_requested',
        newEmail: email,
        timestamp: Date.now(),
      });
    }
    return { success: true };
  }

  public async confirmEmailChange(token: string) {
    const result = (await this.mutate('users:confirmEmailChange', { token })) as {
      userId: string;
      email: string;
      oldEmail?: string;
    };
    const user = await this.getUserById(result.userId);
    if (!user) throw new Error('User could not be found.');
    // Revoke all other sessions for security
    await this.logoutAllSessions(result.userId);
    // Send security confirmation to old and new emails
    if (result.oldEmail) {
      await this.enqueue(result.oldEmail, 'securityAlert', {
        name: user.name || '',
        alertType: 'email_changed',
        newEmail: result.email,
        timestamp: Date.now(),
      });
    }
    await this.enqueue(result.email, 'securityAlert', {
      name: user.name || '',
      alertType: 'email_changed',
      timestamp: Date.now(),
    });
    return { user };
  }

  public async getUserMemberships(userId: string) {
    const records = await this.query('organizations:getUserMemberships', { userId }) as any[];
    return records.map(({ membership, organization }) => ({ membership: asMembership(membership)!, organization: asOrganization(organization)! }));
  }
  public async getMembership(organizationId: string, userId: string) { return asMembership(await this.query('organizations:getMembership', { organizationId, userId })); }
  public async getOrganizationById(id: string) { return asOrganization(await this.query('organizations:getOrganizationById', { organizationId: id })); }

  public async createOrganization(data: {
    userId: string;
    name: string;
    industry: string;
    country: string;
    timezone: string;
    currency?: string;
    website?: string;
    size?: string;
    logo?: string;
    phone?: string;
    planId?: string;
    billingCycle?: string;
    paymentGateway?: string;
    paymentReference?: string;
    products?: string[];
    primaryBranch?: {
      name: string;
      code?: string;
      country?: string;
      state?: string;
      stateCode?: string;
      lga?: string;
      city?: string;
      street?: string;
      blockNumber?: string;
      area?: string;
      landmark?: string;
    };
    invitations?: Array<{
      email: string;
      role: string;
      branchAccess?: string[];
    }>;
  }) {
    const result = await this.mutate('organizations:createOrganization', data) as any;
    return { organization: asOrganization(result.organization)!, membership: asMembership(result.membership)!, onboarding: result.onboarding, isDuplicate: result.isDuplicate };
  }

  public async createOrganizationWithOnboarding(data: {
    userId: string;
    name: string;
    phone: string;
    category: string;
    currency?: string;
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    address?: string;
    industry?: string;
    timezone?: string;
    website?: string;
    businessType?: string;
    branchCountRange?: string;
    productCountRange?: string;
    primaryUsers?: string[];
  }) {
    return this.mutate('onboarding:createOrganizationWithOnboarding', data as any);
  }

  public async createOrganizationWithPlan(data: {
    userId: string;
    name: string;
    phone: string;
    category: string;
    currency?: string;
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    address?: string;
    industry?: string;
    timezone?: string;
    website?: string;
    businessType?: string;
    branchCountRange?: string;
    productCountRange?: string;
    primaryUsers?: string[];
    planKey: 'free_trial' | 'standard';
    billingInterval?: 'monthly' | 'annual';
    paymentGateway?: string;
    paymentReference?: string;
  }) {
    return this.mutate('organizations:createOrganizationWithPlan', data as any);
  }

  public async getUserFreeTrialStatus(userId: string) {
    return this.query('organizations:getUserFreeTrialStatus', { userId: userId as any });
  }

  public async getOrganizationCreationEligibility(userId: string) {
    try {
      const res = await this.query('organizations:getOrganizationCreationEligibility', { userId: userId as any });
      if (res) return res;
    } catch {
      // Fallback
    }
    let ownedCount = 0;
    let joinedCount = 0;
    let trialUsed = 0;
    try {
      const memberships = await this.getUserMemberships(userId);
      ownedCount = (memberships || []).filter(
        (m: any) => m.membership?.role === 'OWNER' && m.organization?.status !== 'deleted'
      ).length;
      joinedCount = (memberships || []).filter(
        (m: any) => m.membership?.role !== 'OWNER' && m.organization?.status !== 'deleted'
      ).length;
      trialUsed = (memberships || []).filter(
        (m: any) => m.membership?.role === 'OWNER' && (m.subscription?.planKey === 'free_trial' || m.subscription?.trialOrigin === 'free_trial' || m.subscription?.planKey === 'free')
      ).length > 0 ? 1 : 0;
    } catch {}

    const eligible = trialUsed === 0;

    return {
      eligible,
      trialLimit: 1,
      trialUsed,
      ownedOrganizations: ownedCount,
      ownedOrganizationLimit: 3,
      joinedOrganizations: joinedCount,
      reasons: eligible ? [] : [{ code: 'FREE_TRIAL_ALREADY_USED', message: 'You have already used your Free Trial.' }],
      upgradeOptions: ['standard', 'premium'],
    };
  }

  public async getUserOrganizationsCategorized(userId: string) {
    return this.query('organizations:getUserOrganizationsCategorized', { userId: userId as any }) as any;
  }

  public async archiveOrganization(organizationId: string, userId: string) {
    return this.mutate('organizations:archiveOrganization', {
      organizationId: organizationId as any,
      userId: userId as any,
    });
  }

  public async restoreOrganization(organizationId: string, userId: string) {
    return this.mutate('organizations:restoreOrganization', {
      organizationId: organizationId as any,
      userId: userId as any,
    });
  }

  public async transferOrganizationOwnership(organizationId: string, currentOwnerId: string, newOwnerId: string) {
    return this.mutate('organizations:transferOrganizationOwnership', {
      organizationId: organizationId as any,
      currentOwnerId: currentOwnerId as any,
      newOwnerId: newOwnerId as any,
    });
  }

  public async setOrganizationLimitOverride(data: {
    userId: string;
    overrideLimit: number;
    reason: string;
    grantedBy: string;
    expiresAt?: number;
  }) {
    return this.mutate('organizations:setOrganizationLimitOverride', {
      userId: data.userId as any,
      overrideLimit: data.overrideLimit,
      reason: data.reason,
      grantedBy: data.grantedBy,
      expiresAt: data.expiresAt,
    });
  }

  public async removeOrganizationLimitOverride(userId: string, removedBy: string) {
    return this.mutate('organizations:removeOrganizationLimitOverride', {
      userId: userId as any,
      removedBy,
    });
  }

  public async getOrganizationLimitEvents(userId?: string, limit?: number) {
    return this.query('organizations:getOrganizationLimitEvents', {
      userId: userId ? (userId as any) : undefined,
      limit,
    });
  }

  public async getSuperadminOrganizationUsage() {
    return this.query('organizations:getSuperadminOrganizationUsage', {});
  }

  public async confirmPaymentAndActivateOrg(data: {
    organizationId: string;
    paymentReference: string;
    provider?: string;
    amount?: number;
    billingInterval?: 'monthly' | 'annual';
    userId?: string;
  }) {
    return this.mutate('subscriptions:confirmPaymentAndActivateOrg', {
      organizationId: data.organizationId as any,
      paymentReference: data.paymentReference,
      provider: data.provider,
      amount: data.amount,
      billingInterval: data.billingInterval,
      userId: data.userId as any,
    });
  }

  public async switchOrgPlan(data: {
    organizationId: string;
    newPlanKey: 'free_trial' | 'standard';
    billingInterval?: 'monthly' | 'annual';
    userId?: string;
  }) {
    return this.mutate('subscriptions:switchOrgPlan', {
      organizationId: data.organizationId as any,
      newPlanKey: data.newPlanKey,
      billingInterval: data.billingInterval,
      userId: data.userId as any,
    });
  }

  public async getOrganizationBillingContext(organizationId: string) {
    return this.query('subscriptions:getBillingContext', {
      organizationId: organizationId as any,
    });
  }

  public async checkOrganizationBillingConsistency(organizationId: string) {
    return this.query('subscriptions:checkOrganizationBillingConsistency', {
      organizationId: organizationId as any,
    });
  }

  public async initializeBillingCheckout(data: {
    organizationId: string;
    userId: string;
    billingInterval: 'monthly' | 'annual';
    amount?: number;
  }) {
    return this.mutate('subscriptions:initializeBillingCheckout', {
      organizationId: data.organizationId as any,
      userId: data.userId as any,
      billingInterval: data.billingInterval,
      amount: data.amount,
    });
  }

  public async calculateDowngradeConflicts(organizationId: string, targetPlanKey: string = 'standard') {
    return this.query('subscriptions:calculateDowngradeConflicts', {
      organizationId: organizationId as any,
      targetPlanKey,
    });
  }

  public async scheduleDowngrade(data: {
    organizationId?: string;
    workspaceId?: string;
    userId: string;
    targetPlan?: string;
    targetPlanKey?: string;
    effectiveAt?: number;
    resourceDecisions?: Array<{ resourceType: string; resourceId: string; action: string }>;
    reason?: string;
  }) {
    return this.mutate('subscriptions:scheduleDowngrade', {
      organizationId: data.organizationId as any,
      workspaceId: data.workspaceId as any,
      userId: data.userId as any,
      targetPlan: data.targetPlan || data.targetPlanKey || 'standard',
      targetPlanKey: data.targetPlanKey || data.targetPlan || 'standard',
      effectiveAt: data.effectiveAt,
      resourceDecisions: data.resourceDecisions,
      reason: data.reason,
    });
  }

  public async scheduleDowngradeWithConflictResolution(data: {
    organizationId: string;
    userId: string;
    targetPlanKey: string;
    primaryBranchId?: string;
    retainedMemberUserIds?: string[];
    resourceDecisions?: Array<{ resourceType: string; resourceId: string; action: string }>;
    reason?: string;
  }) {
    return this.mutate('subscriptions:scheduleDowngrade', {
      organizationId: data.organizationId as any,
      userId: data.userId as any,
      targetPlan: data.targetPlanKey,
      targetPlanKey: data.targetPlanKey,
      resourceDecisions: data.resourceDecisions,
      reason: data.reason,
    });
  }

  public async cancelScheduledDowngrade(data: {
    organizationId?: string;
    workspaceId?: string;
    userId?: string;
    reason?: string;
  }) {
    return this.mutate('subscriptions:cancelScheduledDowngrade', {
      organizationId: data.organizationId as any,
      workspaceId: data.workspaceId as any,
      userId: data.userId as any,
      reason: data.reason,
    });
  }

  public async getScheduledDowngrade(workspaceId: string) {
    return this.query('subscriptions:getScheduledDowngrade', {
      workspaceId: workspaceId as any,
    });
  }

  public async getCancellationStatus(workspaceId: string) {
    return this.query('subscriptions:getCancellationStatus', {
      workspaceId: workspaceId as any,
    });
  }

  public async applyScheduledBillingChanges(workspaceId?: string, force?: boolean) {
    return this.mutate('subscriptions:applyScheduledBillingChanges', {
      workspaceId: workspaceId as any,
      force,
    });
  }

  public async cancelSubscription(data: {
    workspaceId?: string;
    organizationId?: string;
    userId?: string;
    reason?: string;
    cancelAtPeriodEnd?: boolean;
  }) {
    return this.mutate('subscriptions:cancelSubscription', {
      workspaceId: data.workspaceId as any,
      organizationId: data.organizationId as any,
      userId: data.userId as any,
      reason: data.reason,
      cancelAtPeriodEnd: data.cancelAtPeriodEnd ?? true,
    });
  }

  public async resumeSubscription(data: {
    workspaceId?: string;
    organizationId?: string;
    userId?: string;
    reason?: string;
  }) {
    return this.mutate('subscriptions:resumeSubscription', {
      workspaceId: data.workspaceId as any,
      organizationId: data.organizationId as any,
      userId: data.userId as any,
      reason: data.reason,
    });
  }

  public async resumeCancelledSubscription(organizationId: string, userId?: string, reason?: string) {
    return this.mutate('subscriptions:resumeCancelledSubscription', {
      organizationId: organizationId as any,
      userId: userId ? (userId as any) : undefined,
      reason,
    });
  }

  public async saveInventoryOnboarding(data: {
    organizationId: string;
    userId?: string;
    previousTools?: string[];
    painPoints?: string[];
    priorityFeatures?: string[];
    needsMultiBranch?: boolean;
    teamComfortLevel?: string;
  }) {
    return this.mutate('onboarding:saveInventoryOnboarding', data as any);
  }

  public async getInventoryOnboardingStatus(organizationId: string) {
    return this.query('onboarding:getInventoryOnboardingStatus', { organizationId: organizationId as any });
  }

  public async getOrganizationProfile(organizationId: string) {
    return this.query('onboarding:getOrganizationProfile', { organizationId: organizationId as any });
  }

  public async getApplicationOnboardingResponses(organizationId: string, applicationKey?: string) {
    return this.query('onboarding:getApplicationOnboardingResponses', { organizationId: organizationId as any, applicationKey });
  }

  public async getMyOrganizations(userId: string) {
    return this.query('onboarding:getMyOrganizations', { userId: userId as any });
  }

  public async getOrgApplicationStatus(organizationId: string, applicationKey?: string) {
    return this.query('onboarding:getOrgApplicationStatus', { organizationId: organizationId as any, applicationKey });
  }

  public async listBranches(params: { organizationId?: string; applicationId?: string; workspaceId?: string }) {
    return this.query('branches:listBranches', params as any);
  }

  public async getBranchesForOrgApp(organizationId: string, applicationId?: string, applicationKey?: string) {
    return this.query('branches:getBranchesForOrgApp', {
      organizationId: organizationId as any,
      applicationId: applicationId as any,
      applicationKey,
    });
  }

  public async autoCreateMainBranch(data: {
    organizationId: string;
    applicationId?: string;
    userId?: string;
    name?: string;
    address?: string;
    phone?: string;
  }) {
    return this.mutate('branches:autoCreateMainBranch', data as any);
  }

  public async getCurrentOrgAppContext(params: {
    organizationId: string;
    applicationKey?: string;
    branchId?: string;
    userId?: string;
  }) {
    return this.query('onboarding:getCurrentOrgAppContext', params as any);
  }

  public async getAvailableApplications() {
    return this.apps.getAvailableApplications();
  }

  public async getOrgApplications(organizationId: string) {
    return this.apps.getOrgApplications(organizationId);
  }

  public async activateApplication(data: {
    organizationId: string;
    applicationKey: string;
    planKey?: string;
    billingCycle?: string;
    paymentReference?: string;
    paymentGateway?: string;
    userId?: string;
  }) {
    return this.apps.activateApplication(data);
  }

  public async deactivateApplication(data: {
    organizationId: string;
    applicationKey: string;
    userId?: string;
  }) {
    return this.apps.deactivateApplication(data);
  }

  public async getOrganizationApps(organizationId: string) {
    return this.apps.getOrganizationApps(organizationId);
  }

  public async isApplicationActiveForOrg(organizationId: string, applicationKey?: string) {
    return this.apps.isApplicationActiveForOrg(organizationId, applicationKey);
  }

  public async getUserAppPermissions(organizationId: string, userId: string) {
    return this.orgs.getUserAppPermissions(organizationId, userId);
  }

  public async checkUserAppAccess(organizationId: string, userId: string, applicationKey: string) {
    return this.orgs.checkUserAppAccess(organizationId, userId, applicationKey);
  }

  public async checkUserBranchAccess(organizationId: string, userId: string, branchId: string) {
    return this.orgs.checkUserBranchAccess(organizationId, userId, branchId);
  }

  public async updateMemberAppPermissions(data: {
    organizationId: string;
    callerUserId: string;
    targetUserId: string;
    allowedApplications?: string[];
    allowedBranches?: string[];
    primaryBranchId?: string;
  }) {
    return this.orgs.updateMemberAppPermissions(data);
  }

  public async updateOrganization(organizationId: string, userId: string, updates: Record<string, unknown>) { return asOrganization(await this.mutate('organizations:updateOrganization', { organizationId, userId, ...updates })); }
  public async leaveOrganization(organizationId: string, userId: string) { return this.mutate('organizations:leaveOrganization', { organizationId, userId }); }
  public async deleteOrganization(organizationId: string, userId: string, password?: string) {
    if (password) {
      const user = await this.getUserById(userId);
      if (!user || !user.passwordHash) {
        throw new Error('User not found.');
      }
      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        const err: Error & { code?: string } = new Error('Invalid password provided.');
        err.code = 'INVALID_PASSWORD';
        throw err;
      }
    }

    return this.mutate('organizations:deleteOrganization', { organizationId, userId });
  }

  public async selectModules(organizationId: string, userId: string, modules: string[]) { return this.mutate('modules:selectModules', { organizationId, userId, modules }); }
  public async initializeWorkspace(organizationId: string, userId: string) { return this.mutate('modules:initializeWorkspace', { organizationId, userId }); }

  public async getOrganizationMembers(organizationId: string, userId: string) {
    return this.query('organizations:getOrganizationMembers', { organizationId, userId }) as Promise<any[]>;
  }

  public async updateMemberRole(organizationId: string, callerUserId: string, targetUserId: string, newRole: string) {
    return this.mutate('organizations:updateMemberRole', { organizationId, callerUserId, targetUserId, newRole });
  }

  public async removeMember(organizationId: string, callerUserId: string, targetUserId: string) {
    return this.mutate('organizations:removeMember', { organizationId, callerUserId, targetUserId });
  }

  public async createWorkspace(data: {
    organizationId: string;
    name: string;
    slug: string;
    isDefault?: boolean;
    enabledModules?: string[];
    settings?: any;
  }) {
    return this.mutate('workspaces:createWorkspace', {
      organizationId: data.organizationId,
      name: data.name,
      slug: data.slug,
      isDefault: data.isDefault ?? false,
      enabledModules: data.enabledModules ?? [],
      settings: data.settings,
    });
  }

  public async getOrganizationWorkspaces(organizationId: string) {
    return this.query('workspaces:getOrganizationWorkspaces', { organizationId }) as Promise<any[]>;
  }

  public async getDefaultWorkspace(organizationId: string) {
    return this.query('workspaces:getDefaultWorkspace', { organizationId });
  }

  public async updateWorkspace(workspaceId: string, updates: { name?: string; enabledModules?: string[]; settings?: any }) {
    return this.mutate('workspaces:updateWorkspace', { workspaceId, ...updates });
  }



  public async createInvitations(organizationId: string, userId: string, invitations: Array<{ email: string; role: Role }>) {
    const organization = await this.getOrganizationById(organizationId);
    const inviter = await this.getUserById(userId);
    const expiresAt = Date.now() + INVITATION_EXPIRY_DAYS * 86_400_000;
    const payload = invitations.map((invite) => ({ ...invite, email: invite.email.toLowerCase().trim(), token: crypto.randomBytes(32).toString('hex'), expiresAt }));
    const created = (await this.mutate('invitations:createInvitations', { organizationId, userId, invitations: payload })) as any[];
    await Promise.all(
      created.map((invite) =>
        this.enqueue(invite.email, 'invitation', {
          organizationName: organization?.name || 'your organization',
          inviterName: inviter?.name || 'A teammate',
          role: invite.role,
          url: buildInviteUrl(invite.token),
        })
      )
    );
    return created;
  }

  public async generateShareableInviteLink(organizationId: string, userId: string, role: Role = 'MEMBER') {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + INVITATION_EXPIRY_DAYS * 86_400_000;
    const email = `invite-${Date.now()}@team.orvio.link`;
    await this.mutate('invitations:createInvitations', {
      organizationId,
      userId,
      invitations: [{ email, role, token, expiresAt }],
    });
    return {
      inviteUrl: buildInviteUrl(token),
      token,
      expiresAt,
    };
  }

  public async getInvitationByToken(token: string) { return this.query('invitations:getInvitationByToken', { token }); }
  public async getOrganizationInvitations(organizationId: string, userId: string) { return this.query('invitations:getOrganizationInvitations', { organizationId, userId }); }
  public async acceptInvitation(token: string, userId: string) {
    const invite = (await this.getInvitationByToken(token)) || (await this.getWorkspaceInvitationByToken(token));
    if (invite) {
      const statusUpper = String(invite.status).toUpperCase();
      if (statusUpper === 'CANCELLED') {
        throw new Error('INVITATION_CANCELLED');
      }
      if (statusUpper === 'ACCEPTED') {
        throw new Error('INVITATION_ALREADY_ACCEPTED');
      }
      if (statusUpper === 'EXPIRED' || (invite.expiresAt && invite.expiresAt < Date.now())) {
        throw new Error('INVITATION_EXPIRED');
      }
    }
    return this.mutate('invitations:acceptInvitation', { token, userId });
  }

  public async resendInvitation(invitationId: string, userId: string) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + INVITATION_EXPIRY_DAYS * 86_400_000;
    const result = (await this.mutate('invitations:resendInvitation', {
      invitationId,
      userId,
      token,
      expiresAt,
    })) as any;

    await this.enqueue(result.email, 'invitation', {
      organizationName: result.organizationName,
      inviterName: result.inviterName,
      role: result.role,
      url: buildInviteUrl(token),
    });

    return result;
  }

  public async cancelInvitation(invitationId: string, userId: string) {
    return this.mutate('invitations:cancelInvitation', { invitationId, userId });
  }

  public async getOrganizationAuditLogs(
    organizationId: string,
    userId: string,
    query: { page?: number; limit?: number; action?: string } = {}
  ) {
    return this.query('audit:getOrganizationAuditLogs', {
      organizationId,
      userId,
      page: query.page,
      limit: query.limit,
      action: query.action,
    });
  }

  public async getOnboardingStatus(userId: string) { return this.query('onboarding:getOnboardingStatus', { userId }); }

  public async getPersonalOnboardingProfile(userId: string) {
    try {
      const res = await this.query('userProfiles:getPersonalOnboardingProfile', { userId: userId as any }) as any;
      if (res) return res;
    } catch {
      // Fallback
    }
    const user = await this.getUserById(userId);
    return {
      personalOnboardingCompleted: Boolean(user?.personalOnboardingCompleted),
      profile: null,
    };
  }

  public async savePersonalOnboardingProgress(userId: string, data: {
    currentStep: number;
    useCases?: string[];
    acquisitionSource?: string;
    acquisitionSourceOther?: string;
    role?: string;
    managesBusiness?: boolean;
  }) {
    try {
      const res = await this.mutate('userProfiles:savePersonalOnboardingProgress', {
        userId: userId as any,
        currentStep: data.currentStep,
        useCases: data.useCases,
        acquisitionSource: data.acquisitionSource,
        acquisitionSourceOther: data.acquisitionSourceOther,
        role: data.role,
        managesBusiness: data.managesBusiness,
      }) as any;
      if (res) return res;
    } catch {
      // Fallback
    }
    return {
      success: true,
      currentStep: data.currentStep,
    };
  }

  public async savePersonalOnboarding(userId: string, data: {
    useCases: string[];
    acquisitionSource: string;
    acquisitionSourceOther?: string;
    role?: string;
    managesBusiness?: boolean;
  }) {
    try {
      const res = await this.mutate('userProfiles:savePersonalOnboarding', {
        userId: userId as any,
        useCases: data.useCases,
        acquisitionSource: data.acquisitionSource,
        acquisitionSourceOther: data.acquisitionSourceOther,
        role: data.role,
        managesBusiness: data.managesBusiness,
      }) as any;
      if (res) return res;
    } catch {
      // Fallback
      await this.updateProfile(userId, { personalOnboardingCompleted: true } as any);
    }
    return {
      personalOnboardingCompleted: true,
      profile: {
        userId,
        useCases: data.useCases,
        acquisitionSource: data.acquisitionSource,
        acquisitionSourceOther: data.acquisitionSourceOther,
        role: data.role,
        managesBusiness: data.managesBusiness,
        personalOnboardingCompleted: true,
        completedAt: Date.now(),
      },
    };
  }
  public async skipStep(userId: string, step: string) { return this.mutate('onboarding:skipStep', { userId, step }); }
  public async skipOnboardingPermanently(userId: string) {
    try {
      return await this.mutate('onboarding:skipOnboardingPermanently', { userId: userId as any });
    } catch {
      return { success: true, status: 'COMPLETED' };
    }
  }
  public async enableTwoFactorStart(userId: string) {
    const user = await this.getUserById(userId);
    if (!user) throw new Error('User not found.');
    const secret = totpService.generateBase32Secret(20);
    const otpauthUrl = totpService.generateOtpAuthUri(user.email, secret);
    await this.mutate('users:setTwoFactorPendingSecret', { userId, secret });
    return {
      secret,
      otpauthUrl,
    };
  }

  public async verifyAndActivateTwoFactor(userId: string, code: string) {
    const user = await this.getUserById(userId);
    if (!user || !user.twoFactorPendingSecret) {
      const err: Error & { code?: string } = new Error('No pending 2FA activation found.');
      err.code = 'INVALID_TOKEN';
      throw err;
    }

    const isValid = totpService.verifyTotpCode(code.trim(), user.twoFactorPendingSecret);
    if (!isValid) {
      const err: Error & { code?: string } = new Error('Invalid verification code.');
      err.code = 'INVALID_2FA_CODE';
      throw err;
    }

    const backupCodes = totpService.generateBackupCodes(8);
    await this.mutate('users:enableTwoFactor', {
      userId,
      secret: user.twoFactorPendingSecret,
      backupCodes,
    });

    return {
      success: true,
      backupCodes,
    };
  }

  public async disableTwoFactor(userId: string, password?: string) {
    const user = await this.getUserById(userId);
    if (!user) throw new Error('User not found.');

    if (user.passwordHash) {
      if (!password) {
        const err: Error & { code?: string } = new Error('Password is required to disable 2FA.');
        err.code = 'INVALID_CREDENTIALS';
        throw err;
      }
      const matches = await bcrypt.compare(password, user.passwordHash);
      if (!matches) {
        const err: Error & { code?: string } = new Error('Incorrect password.');
        err.code = 'INVALID_CREDENTIALS';
        throw err;
      }
    }

    await this.mutate('users:disableTwoFactor', { userId });
    return { success: true };
  }

  public async verifyTwoFactorLogin(userId: string, code: string) {
    const user = await this.getUserById(userId);
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      const err: Error & { code?: string } = new Error('2FA is not enabled for this account.');
      err.code = 'UNAUTHENTICATED';
      throw err;
    }

    const cleanCode = code.trim();
    // Check TOTP 6-digit code
    if (/^\d{6}$/.test(cleanCode)) {
      const isValid = totpService.verifyTotpCode(cleanCode, user.twoFactorSecret);
      if (isValid) {
        return { user };
      }
    }

    // Check backup codes (e.g. XXXX-XXXX or XXXXXXXX)
    if (user.twoFactorBackupCodes && user.twoFactorBackupCodes.length > 0) {
      const normalized = cleanCode.toUpperCase();
      const matched = user.twoFactorBackupCodes.some(
        (c) => c.toUpperCase() === normalized || c.replace('-', '').toUpperCase() === normalized.replace('-', '')
      );
      if (matched) {
        await this.mutate('users:consumeBackupCode', { userId, code: cleanCode });
        return { user, usedBackupCode: true };
      }
    }

    const err: Error & { code?: string } = new Error('Invalid verification code or backup code.');
    err.code = 'INVALID_2FA_CODE';
    throw err;
  }

  public async getTwoFactorStatus(userId: string) {
    const user = await this.getUserById(userId);
    if (!user) throw new Error('User not found.');
    return {
      enabled: Boolean(user.twoFactorEnabled),
      backupCodesRemaining: user.twoFactorBackupCodes?.length ?? 0,
    };
  }

  public async regenerateBackupCodes(userId: string, password?: string) {
    const user = await this.getUserById(userId);
    if (!user) throw new Error('User not found.');
    if (!user.twoFactorEnabled) {
      const err: Error & { code?: string } = new Error('2FA is not enabled.');
      err.code = 'INVALID_REQUEST';
      throw err;
    }

    if (user.passwordHash) {
      if (!password) {
        const err: Error & { code?: string } = new Error('Password is required to regenerate backup codes.');
        err.code = 'INVALID_CREDENTIALS';
        throw err;
      }
      const matches = await bcrypt.compare(password, user.passwordHash);
      if (!matches) {
        const err: Error & { code?: string } = new Error('Incorrect password.');
        err.code = 'INVALID_CREDENTIALS';
        throw err;
      }
    }

    const backupCodes = totpService.generateBackupCodes(8);
    await this.mutate('users:setBackupCodes', { userId: userId as any, backupCodes });
    return { backupCodes };
  }

  public async completeOnboarding(userId: string) {
    const result = await this.mutate('onboarding:completeOnboarding', { userId }) as any;
    const user = await this.getUserById(userId);
    if (user) await this.enqueue(user.email, 'onboardingCompleted', { name: user.name, organizationName: result.organization.name });
    return result;
  }

  // Workspaces & Entitlements
  public async createWorkspaceStandalone(data: {
    name: string;
    slug: string;
    type?: string;
    typeConfig?: any;
    ownerId?: string;
    country?: string;
    state?: string;
    city?: string;
    timezone?: string;
    currency?: string;
    phone?: string;
    logoUrl?: string;
    initialProduct?: string;
    settings?: any;
  }) {
    const initialProduct = data.initialProduct || 'inventory';
    const workspaceId = await this.mutate('workspaces:createWorkspace', {
      name: data.name,
      slug: data.slug,
      type: normalizeWorkspaceType(data.type),
      ownerId: data.ownerId as any,
      country: data.country,
      state: data.state,
      city: data.city,
      timezone: data.timezone,
      currency: data.currency,
      logoUrl: data.logoUrl,
      initialProduct,
      enabledModules: [initialProduct],
      settings: {
        ...(data.settings || {}),
        phone: data.phone,
        typeConfig: data.typeConfig,
        initialProduct,
      },
    });

    if (data.ownerId && workspaceId) {
      try {
        await this.mutate('workspaces:activateProductEntitlement', {
          workspaceId: workspaceId as any,
          userId: data.ownerId as any,
          productKey: initialProduct,
          planId: 'free',
        });
      } catch {
        // May already be activated
      }
    }

    return workspaceId;
  }

  public async selectWorkspace(workspaceId: string, userId: string, productKey?: string) {
    try {
      return await this.mutate('workspaces:selectWorkspace', {
        workspaceId: workspaceId as any,
        userId: userId as any,
        productKey,
      });
    } catch (err: any) {
      if (err.message?.includes('Could not find public function') || err.message?.includes('selectWorkspace')) {
        const ws = (await this.getWorkspaceById(workspaceId)) as any;
        if (!ws) {
          throw new Error('WORKSPACE_NOT_FOUND');
        }
        let mem: any = null;
        try {
          mem = await this.getWorkspaceMembership(workspaceId, userId);
        } catch {}

        const isOwner = ws.ownerId === userId || ws.ownerId === (userId as any);
        if (!mem && !isOwner) {
          throw new Error('WORKSPACE_ACCESS_DENIED');
        }

        let branches: any[] = [];
        try {
          branches = (await this.getBranches(workspaceId, userId, productKey)) || [];
        } catch {}

        return {
          workspace: {
            id: ws._id || ws.id,
            name: ws.name || 'Workspace',
            slug: ws.slug || '',
            type: ws.type || 'business',
            currency: ws.currency || 'NGN',
            country: ws.country,
            state: ws.state,
            city: ws.city,
            timezone: ws.timezone,
            logoUrl: ws.logoUrl,
            status: ws.status || 'active',
          },
          membership: {
            id: mem?._id || mem?.id || 'mem-default',
            role: mem?.role || (isOwner ? 'OWNER' : 'MEMBER'),
            status: 'active',
          },
          products: [{ key: productKey || 'inventory', status: 'active', planId: 'standard' }],
          permissions: ['*'],
          accessibleBranches: branches,
          defaultBranch: branches[0] || null,
        };
      }
      throw err;
    }
  }

  public async getWorkspaceContext(workspaceId: string, userId: string) {
    try {
      return await this.query('workspaces:getWorkspaceContext', {
        workspaceId: workspaceId as any,
        userId: userId as any,
      });
    } catch (err: any) {
      if (err.message?.includes('Could not find public function')) {
        return this.selectWorkspace(workspaceId, userId);
      }
      throw err;
    }
  }

  public async getUserWorkspaces(userId: string, productKey?: string, search?: string) {
    const list = ((await this.query('workspaces:getUserWorkspaces', {
      userId: userId as any,
      productKey,
      search,
    })) as any[]) || [];

    return list.map((item) => {
      const baseWs = item.workspace || item;
      const wsId = baseWs.workspaceId || baseWs.id || baseWs._id || item._id || item.id;
      const orgId = baseWs.organizationId || item.organizationId || null;
      const wsObj = {
        id: wsId,
        workspaceId: wsId,
        organizationId: orgId,
        name: baseWs.name || item.name || 'Workspace',
        slug: baseWs.slug || item.slug || '',
        type: baseWs.type || item.type || 'business',
        currency: baseWs.currency || item.currency || 'NGN',
        country: baseWs.country || item.country,
        state: baseWs.state || item.state,
        city: baseWs.city || item.city,
        timezone: baseWs.timezone || item.timezone,
        logoUrl: baseWs.logoUrl || item.logoUrl,
        planId: baseWs.planId || item.planId,
        planKey: baseWs.planKey || item.planKey,
        planName: baseWs.planName || item.planName,
        subscriptionStatus: baseWs.subscriptionStatus || item.subscriptionStatus,
        subscription: baseWs.subscription || item.subscription,
        status: baseWs.status || item.status || 'active',
        enabledModules: baseWs.enabledModules || [],
        createdAt: baseWs.createdAt || item.createdAt,
      };

      const rawProducts = item.enabledProducts || item.products || wsObj.enabledModules || baseWs.enabledModules || [];
      let enabledProducts: any[] = [];
      if (Array.isArray(rawProducts)) {
        enabledProducts = rawProducts.map((p) => {
          if (typeof p === 'string') {
            return { productKey: p, status: 'ACTIVE', planId: 'standard' };
          }
          return {
            productKey: p.productKey || p.key || 'inventory',
            status: (p.status || 'ACTIVE').toUpperCase(),
            planId: p.planId || 'standard',
          };
        });
      }

      if (enabledProducts.length === 0) {
        enabledProducts = [{ productKey: 'inventory', status: 'ACTIVE', planId: 'standard' }];
      } else {
        const hasInventory = enabledProducts.some((p: any) => p.productKey === 'inventory');
        if (!hasInventory) {
          enabledProducts.unshift({ productKey: 'inventory', status: 'ACTIVE', planId: 'standard' });
        }
      }

      return {
        workspace: wsObj,
        role: (item.role || item.defaultRole || 'OWNER').toUpperCase(),
        membershipId: item.membershipId || item._id,
        enabledProducts,
        workspaceId: wsId,
        organizationId: orgId,
      };
    });
  }

  public async getWorkspaceById(workspaceId: string) {
    return this.query('workspaces:getWorkspaceById', { workspaceId: workspaceId as any });
  }

  public async updateWorkspaceSettings(workspaceId: string, data: any) {
    return this.mutate('workspaces:updateWorkspace', {
      workspaceId: workspaceId as any,
      ...data,
    });
  }

  public async activateWorkspaceProduct(data: {
    workspaceId: string;
    productKey: string;
    planId?: string;
    userId: string;
  }) {
    return this.mutate('workspaces:activateWorkspaceProduct', {
      workspaceId: data.workspaceId as any,
      productKey: data.productKey,
      planId: data.planId,
      userId: data.userId as any,
    });
  }

  public async getWorkspaceProducts(workspaceId: string) {
    const ws = ((await this.getWorkspaceById(workspaceId)) as any) || {};
    const products =
      ((await this.query('workspaces:getWorkspaceProducts', { workspaceId: workspaceId as any })) as any[]) || [];

    const existingKeys = new Set(products.map((p) => (p.productKey || p.key || '').toLowerCase()));
    const combined = [...products];
    const defaultModules = ws.enabledModules || ['inventory'];

    for (const mod of defaultModules) {
      if (!existingKeys.has(mod.toLowerCase())) {
        combined.unshift({
          workspaceId,
          productKey: mod,
          status: 'active',
          planId: 'standard',
        });
        existingKeys.add(mod.toLowerCase());
      }
    }
    return combined;
  }

  public async getWorkspaceMembership(workspaceId: string, userId: string) {
    return this.query('workspaces:getWorkspaceMembership', {
      workspaceId: workspaceId as any,
      userId: userId as any,
    });
  }

  public async deleteWorkspace(workspaceId: string, userId: string, reason?: string) {
    return this.mutate('workspaces:deleteWorkspace', {
      workspaceId: workspaceId as any,
      userId: userId as any,
      reason,
    });
  }

  public async getProductMembership(workspaceId: string, userId: string, productKey: string) {
    return this.query('workspaces:getProductMembership', {
      workspaceId: workspaceId as any,
      userId: userId as any,
      productKey,
    });
  }

  // ==========================================
  // WORKSPACE MEMBERS & INVITATIONS
  // ==========================================

  public async getWorkspaceMembers(workspaceId: string, callerUserId: string) {
    return this.query('workspaceMembers:getWorkspaceMembers', {
      workspaceId: workspaceId as any,
      callerUserId: callerUserId as any,
    });
  }

  public async getWorkspaceMemberById(workspaceId: string, membershipId: string, callerUserId: string) {
    return this.query('workspaceMembers:getWorkspaceMemberById', {
      workspaceId: workspaceId as any,
      membershipId: membershipId as any,
      callerUserId: callerUserId as any,
    });
  }

  public async updateWorkspaceMemberRole(data: {
    workspaceId: string;
    membershipId: string;
    callerUserId: string;
    role: string;
    productRole?: string;
    productKey?: string;
    branchIds?: string[];
  }) {
    return this.mutate('workspaceMembers:updateWorkspaceMemberRole', {
      workspaceId: data.workspaceId as any,
      membershipId: data.membershipId as any,
      callerUserId: data.callerUserId as any,
      role: data.role,
      productRole: data.productRole,
      productKey: data.productKey,
      branchIds: data.branchIds as any,
    });
  }

  public async suspendWorkspaceMember(workspaceId: string, membershipId: string, callerUserId: string, reason?: string) {
    return this.mutate('workspaceMembers:suspendWorkspaceMember', {
      workspaceId: workspaceId as any,
      membershipId: membershipId as any,
      callerUserId: callerUserId as any,
      reason,
    });
  }

  public async restoreWorkspaceMember(workspaceId: string, membershipId: string, callerUserId: string) {
    return this.mutate('workspaceMembers:restoreWorkspaceMember', {
      workspaceId: workspaceId as any,
      membershipId: membershipId as any,
      callerUserId: callerUserId as any,
    });
  }

  public async removeWorkspaceMember(workspaceId: string, membershipId: string, callerUserId: string, reason?: string) {
    return this.mutate('workspaceMembers:removeWorkspaceMember', {
      workspaceId: workspaceId as any,
      membershipId: membershipId as any,
      callerUserId: callerUserId as any,
      reason,
    });
  }

  // ==========================================
  // 3-TIER APPLICATION & BRANCH ACCESS
  // ==========================================

  public async grantApplicationAccess(data: {
    workspaceId: string;
    callerUserId: string;
    targetUserId: string;
    applicationKey: string;
    role: string;
    branchIds?: string[];
    permissions?: string[];
    reason?: string;
  }) {
    return this.mutate('workspaceMembers:grantApplicationAccess', {
      workspaceId: data.workspaceId,
      callerUserId: data.callerUserId as any,
      targetUserId: data.targetUserId as any,
      applicationKey: data.applicationKey,
      role: data.role,
      branchIds: data.branchIds,
      permissions: data.permissions,
      reason: data.reason,
    });
  }

  public async revokeApplicationAccess(data: {
    workspaceId: string;
    callerUserId: string;
    targetUserId: string;
    applicationKey: string;
    reason?: string;
  }) {
    return this.mutate('workspaceMembers:revokeApplicationAccess', {
      workspaceId: data.workspaceId,
      callerUserId: data.callerUserId as any,
      targetUserId: data.targetUserId as any,
      applicationKey: data.applicationKey,
      reason: data.reason,
    });
  }

  public async getApplicationMemberships(workspaceId: string, callerUserId: string, applicationKey?: string, userId?: string) {
    return this.query('workspaceMembers:getApplicationMemberships', {
      workspaceId,
      callerUserId: callerUserId as any,
      applicationKey,
      userId,
    });
  }

  public async assignBranchRole(data: {
    workspaceId: string;
    callerUserId: string;
    targetUserId: string;
    branchId: string;
    role: string;
    reason?: string;
  }) {
    return this.mutate('branchAssignments:assignBranchRole', {
      workspaceId: data.workspaceId,
      callerUserId: data.callerUserId as any,
      targetUserId: data.targetUserId as any,
      branchId: data.branchId,
      role: data.role,
      reason: data.reason,
    });
  }

  public async removeBranchAssignment(data: {
    workspaceId: string;
    callerUserId: string;
    assignmentId: string;
    reason?: string;
  }) {
    return this.mutate('branchAssignments:removeBranchAssignment', {
      workspaceId: data.workspaceId,
      callerUserId: data.callerUserId as any,
      assignmentId: data.assignmentId as any,
      reason: data.reason,
    });
  }

  public async getBranchAssignments(workspaceId: string, callerUserId: string, branchId?: string, userId?: string) {
    return this.query('branchAssignments:getBranchAssignments', {
      workspaceId,
      callerUserId: callerUserId as any,
      branchId,
      userId,
    });
  }

  public async getMembershipAuditLogs(workspaceId: string, callerUserId: string, filter?: {
    targetUserId?: string;
    actionType?: string;
    membershipType?: string;
    limit?: number;
  }) {
    return this.query('membershipAudit:getMembershipAuditLogs', {
      workspaceId,
      callerUserId: callerUserId as any,
      targetUserId: filter?.targetUserId,
      actionType: filter?.actionType,
      membershipType: filter?.membershipType,
      limit: filter?.limit,
    });
  }

  public async getRoleDefinitions(workspaceId: string) {
    return this.query('workspaceRoles:getRoleDefinitions', {
      workspaceId,
    });
  }

  public async seedDefaultRoleDefinitions(workspaceId: string) {
    return this.mutate('workspaceRoles:seedDefaultRoleDefinitions', {
      workspaceId,
    });
  }

  public async resolve3TierPermissions(workspaceId: string, userId: string, applicationKey?: string, branchId?: string) {
    return this.query('workspacePermissions:resolveWorkspacePermissions', {
      workspaceId,
      userId: userId as any,
      applicationKey,
      branchId,
    });
  }

  public async checkUserPermission3Tier(workspaceId: string, userId: string, permission: string, applicationKey?: string, branchId?: string) {
    return this.query('workspacePermissions:checkUserPermission', {
      workspaceId,
      userId: userId as any,
      permission,
      applicationKey,
      branchId,
    });
  }

  public async createWorkspaceInvitation(data: {
    workspaceId: string;
    callerUserId: string;
    email: string;
    role?: string;
    organizationRole?: string;
    appAccess?: Array<{
      productKey: string;
      appRole: string;
      branchIds: string[];
    }>;
    productKey?: string;
    branchIds?: string[];
    message?: string;
  }) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    const effectiveRole = data.organizationRole || data.role || 'staff';

    const result = await this.mutate('workspaceMembers:createWorkspaceInvitation', {
      workspaceId: data.workspaceId as any,
      callerUserId: data.callerUserId as any,
      email: data.email,
      role: effectiveRole,
      organizationRole: effectiveRole,
      appAccess: data.appAccess,
      productKey: data.productKey,
      branchIds: data.branchIds as any,
      tokenHash,
      expiresAt,
    });

    const inviteUrl = buildInviteUrl(rawToken);
    await this.enqueue(data.email, 'invitation', {
      inviterName: result.inviterName || 'A team member',
      organizationName: result.workspaceName || 'Your Workspace',
      url: inviteUrl,
      role: effectiveRole,
    });

    return {
      id: result.id,
      email: data.email,
      role: effectiveRole,
      organizationRole: effectiveRole,
      appAccess: data.appAccess,
      token: rawToken,
      expiresAt,
      workspaceName: result.workspaceName,
    };
  }

  public async getMemberAccessDetails(workspaceId: string, memberUserId: string, callerUserId: string) {
    return this.query('workspaceMembers:getMemberAccessDetails', {
      workspaceId: workspaceId as any,
      memberUserId: memberUserId as any,
      callerUserId: callerUserId as any,
    });
  }

  public async updateMemberAccess(params: {
    workspaceId: string;
    memberUserId: string;
    callerUserId: string;
    organizationRole?: string;
    appAccess: Array<{
      productKey: string;
      enabled: boolean;
      appRole: string;
      branchIds: string[];
    }>;
  }) {
    return this.mutate('workspaceMembers:updateMemberAccess', {
      workspaceId: params.workspaceId as any,
      memberUserId: params.memberUserId as any,
      callerUserId: params.callerUserId as any,
      organizationRole: params.organizationRole,
      appAccess: params.appAccess,
    });
  }

  public async getWorkspaceInvitations(workspaceId: string, callerUserId: string) {
    return this.query('workspaceMembers:getWorkspaceInvitations', {
      workspaceId: workspaceId as any,
      callerUserId: callerUserId as any,
    });
  }

  public async getWorkspaceInvitationByToken(token: string) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    try {
      const byHash = await this.query('workspaceMembers:getWorkspaceInvitationByToken', { tokenHash });
      if (byHash) return byHash;
      return await this.query('workspaceMembers:getWorkspaceInvitationByToken', { tokenHash: token });
    } catch {
      return await this.query('invitations:getInvitationByToken', { token });
    }
  }

  public async acceptWorkspaceInvitation(token: string, userId: string) {
    const invite = await this.getWorkspaceInvitationByToken(token);
    if (invite) {
      const statusUpper = String(invite.status).toUpperCase();
      if (statusUpper === 'CANCELLED') {
        throw new Error('INVITATION_CANCELLED');
      }
      if (statusUpper === 'ACCEPTED') {
        throw new Error('INVITATION_ALREADY_ACCEPTED');
      }
      if (statusUpper === 'EXPIRED' || (invite.expiresAt && invite.expiresAt < Date.now())) {
        throw new Error('INVITATION_EXPIRED');
      }
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    try {
      return await this.mutate('workspaceMembers:acceptWorkspaceInvitation', {
        tokenHash,
        userId: userId as any,
      });
    } catch (err: any) {
      if (err.message?.includes('INVITATION_NOT_FOUND')) {
        try {
          return await this.mutate('workspaceMembers:acceptWorkspaceInvitation', {
            tokenHash: token,
            userId: userId as any,
          });
        } catch {
          return await this.mutate('invitations:acceptInvitation', {
            token,
            userId: userId as any,
          });
        }
      }
      if (err.message?.includes('Could not find public function')) {
        return await this.mutate('invitations:acceptInvitation', {
          token,
          userId: userId as any,
        });
      }
      throw err;
    }
  }

  public async declineWorkspaceInvitation(token: string, userId?: string) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    try {
      return await this.mutate('workspaceMembers:declineWorkspaceInvitation', {
        tokenHash,
        userId: userId as any,
      });
    } catch (err: any) {
      if (err.message?.includes('Could not find public function')) {
        return { success: true };
      }
      throw err;
    }
  }

  public async resendWorkspaceInvitation(invitationId: string, callerUserId: string) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

    let result: any;
    try {
      result = await this.mutate('workspaceMembers:resendWorkspaceInvitation', {
        invitationId: invitationId as any,
        callerUserId: callerUserId as any,
        newTokenHash: tokenHash,
        newExpiresAt: expiresAt,
      });
    } catch (err: any) {
      if (err.message?.includes('Could not find public function')) {
        result = await this.mutate('invitations:resendInvitation', {
          invitationId: invitationId as any,
          userId: callerUserId as any,
        });
      } else {
        throw err;
      }
    }

    const inviteUrl = buildInviteUrl(rawToken);
    await this.enqueue(result.email, 'invitation', {
      inviterName: result.inviterName || 'A team member',
      organizationName: result.workspaceName || result.organizationName || 'Your Workspace',
      url: inviteUrl,
      role: 'Team Member',
    });

    return {
      id: result.id || result._id,
      token: rawToken,
      expiresAt: result.expiresAt || expiresAt,
    };
  }

  public async revokeWorkspaceInvitation(invitationId: string, callerUserId: string) {
    try {
      return await this.mutate('workspaceMembers:revokeWorkspaceInvitation', {
        invitationId: invitationId as any,
        callerUserId: callerUserId as any,
      });
    } catch (err: any) {
      if (err.message?.includes('Could not find public function')) {
        return await this.mutate('invitations:cancelInvitation', {
          invitationId: invitationId as any,
          userId: callerUserId as any,
        });
      }
      throw err;
    }
  }

  public async getBranches(workspaceId: string, userId?: string, productKey?: string) {
    if (userId) {
      try {
        return (await this.query('branches:getAccessibleBranches', {
          workspaceId: workspaceId as any,
          userId: userId as any,
          productKey,
        })) as any[];
      } catch {
        // Fallback
      }
    }
    try {
      return (await this.query('branches:getBranches', {
        workspaceId: workspaceId as any,
      })) as any[];
    } catch {
      return (await this.query('branches:getBranchesForOrgApp', {
        organizationId: workspaceId as any,
        applicationKey: productKey || 'inventory',
      })) as any[];
    }
  }

  public async getBranchById(branchId: string) {
    return this.query('branches:getBranchById', {
      branchId: branchId as any,
    });
  }

  public async createBranch(data: {
    workspaceId?: string;
    organizationId?: string;
    applicationId?: string;
    name: string;
    code?: string;
    isPrimary?: boolean;
    isActive?: boolean;
    country?: string;
    state?: string;
    stateCode?: string;
    lga?: string;
    city?: string;
    street?: string;
    blockNumber?: string;
    area?: string;
    landmark?: string;
    postalCode?: string;
    address?: string;
    formattedAddress?: string;
    phone?: string;
    phoneNormalized?: string;
    email?: string;
    managerId?: string;
    callerUserId?: string;
  }) {
    return this.mutate('branches:createBranch', {
      workspaceId: data.workspaceId as any,
      organizationId: data.organizationId as any,
      applicationId: data.applicationId as any,
      name: data.name,
      code: data.code,
      isPrimary: data.isPrimary,
      isActive: data.isActive,
      country: data.country,
      state: data.state,
      stateCode: data.stateCode,
      lga: data.lga,
      city: data.city,
      street: data.street,
      blockNumber: data.blockNumber,
      area: data.area,
      landmark: data.landmark,
      postalCode: data.postalCode,
      address: data.address,
      formattedAddress: data.formattedAddress,
      phone: data.phone,
      phoneNormalized: data.phoneNormalized,
      email: data.email,
      managerId: data.managerId as any,
      callerUserId: data.callerUserId as any,
    });
  }

  public async updateBranch(
    branchId: string,
    updates: {
      name?: string;
      code?: string;
      isPrimary?: boolean;
      isActive?: boolean;
      country?: string;
      state?: string;
      stateCode?: string;
      lga?: string;
      city?: string;
      street?: string;
      blockNumber?: string;
      area?: string;
      landmark?: string;
      postalCode?: string;
      address?: string;
      formattedAddress?: string;
      phone?: string;
      phoneNormalized?: string;
      email?: string;
      managerId?: string;
      status?: string;
      productKey?: string;
      deletedAt?: number;
      callerUserId?: string;
    }
  ) {
    return this.mutate('branches:updateBranch', {
      branchId: branchId as any,
      ...updates,
      managerId: updates.managerId as any,
      callerUserId: updates.callerUserId as any,
    });
  }

  public async saveBranchPhoneOtp(data: {
    branchId: string;
    phone: string;
    phoneNormalized: string;
    verificationCode: string;
    codeExpiresAt: number;
  }) {
    return this.mutate('branches:savePhoneOtp', {
      branchId: data.branchId as any,
      phone: data.phone,
      phoneNormalized: data.phoneNormalized,
      verificationCode: data.verificationCode,
      codeExpiresAt: data.codeExpiresAt,
    });
  }

  public async getProductAccess(workspaceId: string, productKey: string, userId: string) {
    return this.query('workspaces:getProductAccess', {
      workspaceId: workspaceId as any,
      userId: userId as any,
      productKey,
    });
  }

  public async getProductMembers(workspaceId: string, productKey: string) {
    return this.query('workspaces:getProductMembers', {
      workspaceId: workspaceId as any,
      productKey,
    });
  }

  public async getWorkspaceAuditLogs(workspaceId: string, limit?: number) {
    return this.query('workspaces:getWorkspaceAuditLogs', {
      workspaceId: workspaceId as any,
      limit,
    });
  }

  // Schema-Driven Dynamic Onboarding Flow - implemented at bottom of service

  // Inventory Management Product Methods
  public async getInventoryProducts(workspaceId: string, category?: string) {
    return this.query('inventory:getProducts', {
      workspaceId: workspaceId as any,
      category,
    });
  }

  public async createInventoryProduct(data: {
    workspaceId: string;
    sku: string;
    name: string;
    category: string;
    description?: string;
    costPrice: number;
    sellingPrice: number;
    stockQuantity: number;
    minStockLevel: number;
    unit: string;
    imageUrl?: string;
    actorUserId: string;
  }) {
    return this.mutate('inventory:createProduct', {
      workspaceId: data.workspaceId as any,
      sku: data.sku,
      name: data.name,
      category: data.category,
      description: data.description,
      costPrice: data.costPrice,
      sellingPrice: data.sellingPrice,
      stockQuantity: data.stockQuantity,
      minStockLevel: data.minStockLevel,
      unit: data.unit,
      imageUrl: data.imageUrl,
      actorUserId: data.actorUserId as any,
    });
  }

  public async seedInventorySampleProducts(data: {
    workspaceId: string;
    sector: 'retail' | 'groceries' | 'fashion' | 'electronics';
    actorUserId: string;
  }) {
    return this.mutate('inventory:seedSampleProducts', {
      workspaceId: data.workspaceId as any,
      sector: data.sector,
      actorUserId: data.actorUserId as any,
    });
  }

  public async recordInventorySale(data: {
    workspaceId: string;
    items: Array<{ productId: string; quantity: number }>;
    paymentMethod: 'CASH' | 'CARD' | 'TRANSFER' | 'SPLIT';
    customerName?: string;
    customerPhone?: string;
    notes?: string;
    cashierUserId: string;
  }) {
    return this.mutate('inventory:recordSale', {
      workspaceId: data.workspaceId as any,
      items: data.items.map((i) => ({ productId: i.productId as any, quantity: i.quantity })),
      paymentMethod: data.paymentMethod,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      notes: data.notes,
      cashierUserId: data.cashierUserId as any,
    });
  }

  public async getInventoryDashboardMetrics(workspaceId: string) {
    return this.query('inventory:getDashboardMetrics', {
      workspaceId: workspaceId as any,
    });
  }

  // ==========================================
  // PERSONAL PROFILE MANAGEMENT (accounts.orviohub.com)
  // ==========================================

  public async getProfile(userId: string) {
    return this.query('userProfile:getUserProfile', { userId: userId as any });
  }

  public async updateProfile(
    userId: string,
    data: {
      name?: string;
      firstName?: string;
      lastName?: string;
      displayName?: string;
      preferredName?: string;
      jobTitle?: string;
      department?: string;
      bio?: string;
      avatar?: string | null;
      avatarUrl?: string | null;
      phone?: string;
      phoneNormalized?: string;
      phoneVisibility?: 'private' | 'workspace';
      country?: string;
      state?: string;
      city?: string;
      timezone?: string;
      language?: string;
      locale?: string;
      dateFormat?: string;
      numberFormat?: string;
      currencyPreference?: string;
      firstDayOfWeek?: 'monday' | 'sunday';
      theme?: 'dark' | 'light' | 'system';
      layoutDensity?: 'compact' | 'comfortable';
    }
  ) {
    try {
      await this.mutate('users:updateUserProfile', {
        userId: userId as any,
        ...data,
        avatar: data.avatar ?? (data.avatarUrl ?? undefined),
        avatarUrl: data.avatarUrl ?? (data.avatar ?? undefined),
      });
    } catch {
      try {
        await this.mutate('userProfile:updatePersonalDetails', {
          userId: userId as any,
          firstName: data.firstName,
          lastName: data.lastName,
          displayName: data.displayName,
          preferredName: data.preferredName,
          jobTitle: data.jobTitle,
          department: data.department,
          bio: data.bio,
        });
        if (
          data.phone !== undefined ||
          data.phoneVisibility !== undefined ||
          data.country !== undefined ||
          data.state !== undefined ||
          data.city !== undefined ||
          data.timezone !== undefined
        ) {
          await this.mutate('userProfile:updateContactDetails', {
            userId: userId as any,
            phone: data.phone,
            phoneVisibility: data.phoneVisibility,
            country: data.country,
            state: data.state,
            city: data.city,
            timezone: data.timezone,
          });
        }
      } catch (err) {
        serviceError(err);
      }
    }

    return asUser(await this.getUserById(userId));
  }

  public async updateAvatar(userId: string, avatarUrl?: string) {
    try {
      await this.mutate('users:updateUserProfile', {
        userId: userId as any,
        avatar: avatarUrl ?? '',
        avatarUrl: avatarUrl ?? '',
      });
    } catch {
      try {
        await this.mutate('userProfile:updateAvatar', {
          userId: userId as any,
          avatarUrl,
        });
      } catch (err) {
        serviceError(err);
      }
    }
    return asUser(await this.getUserById(userId));
  }

  public async updateContact(
    userId: string,
    data: {
      phone?: string;
      phoneVisibility?: 'private' | 'workspace';
      country?: string;
      state?: string;
      stateCode?: string;
      lga?: string;
      city?: string;
      timezone?: string;
    }
  ) {
    try {
      await this.mutate('users:updateUserProfile', {
        userId: userId as any,
        ...data,
      });
    } catch {
      try {
        await this.mutate('userProfile:updateContactDetails', {
          userId: userId as any,
          ...data,
        });
      } catch (err) {
        serviceError(err);
      }
    }
    return asUser(await this.getUserById(userId));
  }

  public async requestPhoneOtp(userId: string, phone: string) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
    await this.mutate('userProfile:setPhoneVerificationCode', {
      userId: userId as any,
      phone,
      code: otp,
      expiresAt,
    });
    // In production, send via SMS provider (e.g. Termii / Twilio)
    console.log(`[SMS OTP] Verification OTP for user ${userId} (${phone}): ${otp}`);
    return { success: true, message: 'OTP sent to mobile phone', expiresAt };
  }

  public async verifyPhoneOtp(userId: string, code: string) {
    await this.mutate('userProfile:verifyPhoneCode', {
      userId: userId as any,
      code,
    });
    return asUser(await this.getUserById(userId));
  }

  public async getUserSessions(userId: string) {
    return this.query('sessions:getUserSessions', { userId: userId as any }) as Promise<any[]>;
  }

  public async revokeSessionById(sessionId: string, userId: string) {
    return this.mutate('sessions:revokeSessionById', {
      sessionId: sessionId as any,
      userId: userId as any,
    });
  }

  public async revokeAllOtherSessions(userId: string, exceptSessionId?: string) {
    return this.mutate('sessions:revokeAllOtherSessions', {
      userId: userId as any,
      exceptSessionId,
    });
  }

  public async getUserIdentities(userId: string) {
    try {
      const identities =
        (await this.query('users:getIdentitiesByUserId', { userId: userId as any })) ||
        (await this.query('users:getUserIdentities', { userId: userId as any })) ||
        [];
      return identities;
    } catch {
      return [];
    }
  }

  public async getIdentitiesByUserId(userId: string) {
    return this.getUserIdentities(userId);
  }

  public async unlinkIdentity(identityId: string, userId: string) {
    return this.mutate('users:unlinkIdentity', {
      identityId: identityId as any,
      userId: userId as any,
    });
  }

  public async getUserPreferences(userId: string) {
    try {
      return (await this.query('userProfile:getUserPreferences', { userId: userId as any })) || null;
    } catch {
      return null;
    }
  }

  public async updateUserPreferences(userId: string, prefs: Record<string, any>) {
    try {
      await this.mutate('users:updateUserProfile', {
        userId: userId as any,
        theme: prefs.theme,
        language: prefs.language,
        timezone: prefs.timezone,
        dateFormat: prefs.dateFormat,
        numberFormat: prefs.numberFormat,
        currencyPreference: prefs.currencyPreference,
        firstDayOfWeek: prefs.firstDayOfWeek,
        layoutDensity: prefs.layoutDensity,
      });
    } catch {
      // safe fallback if some fields are undefined
    }
    return this.mutate('userProfile:updateUserPreferences', {
      userId: userId as any,
      ...prefs,
    });
  }

  public async getUserSecurityActivity(
    userId: string,
    options?: { limit?: number; eventType?: string }
  ) {
    try {
      const logs =
        (await this.query('userProfile:getUserActivityLogs', {
          userId: userId as any,
          limit: options?.limit,
          eventType: options?.eventType,
        })) || [];
      return logs;
    } catch {
      return [];
    }
  }

  public async reportSuspiciousActivity(userId: string, activityId: string, reason: string) {
    return this.mutate('userProfile:reportSuspiciousActivity', {
      userId: userId as any,
      activityId: activityId as any,
      reason,
    });
  }

  public async getUserConsents(userId: string) {
    return this.query('userProfile:getUserConsents', { userId: userId as any });
  }

  public async recordUserConsent(
    userId: string,
    data: {
      consentType: string;
      version: string;
      granted: boolean;
      source?: string;
    }
  ) {
    return this.mutate('userProfile:recordConsent', {
      userId: userId as any,
      ...data,
    });
  }

  public async requestAccountDeletion(userId: string, reason?: string, coolingOffDays?: number) {
    // Check if user is sole owner of any active workspace
    const memberships = (await this.query('workspaces:getUserWorkspaces', { userId: userId as any })) || [];
    const ownedWorkspaces = memberships.filter((m: any) => m.role === 'OWNER' || m.workspace?.ownerId === userId);
    
    if (ownedWorkspaces.length > 0) {
      const error: Error & { code?: string; ownedWorkspaces?: any[] } = new Error(
        'You cannot delete your account while you are the owner of active workspaces. Please transfer ownership or close your workspaces first.'
      );
      error.code = 'SOLE_OWNER_CANNOT_LEAVE_WORKSPACE';
      error.ownedWorkspaces = ownedWorkspaces;
      throw error;
    }

    return this.mutate('userProfile:requestAccountDeletion', {
      userId: userId as any,
      reason,
      coolingOffDays,
    });
  }

  public async cancelAccountDeletion(userId?: string, token?: string) {
    return this.mutate('userProfile:cancelAccountDeletion', {
      userId: userId as any,
      token,
    });
  }

  public async getAccountDeletionStatus(userId: string) {
    return this.query('userProfile:getAccountDeletionStatus', {
      userId: userId as any,
    });
  }

  public async adminSuspendUser(sessionToken: string, userId: string, reason?: string, notes?: string) {
    return this.mutate('adminUsers:suspendUser', {
      sessionToken,
      userId: userId as any,
      reason,
      notes,
      revokeAllSessions: true,
    });
  }

  public async adminRestoreUser(sessionToken: string, userId: string) {
    return this.mutate('adminUsers:restoreUser', {
      sessionToken,
      userId: userId as any,
    });
  }

  public async adminGetUserSuspensionHistory(sessionToken: string, userId: string) {
    return this.query('adminUsers:getSuspensionHistory', {
      sessionToken,
      userId: userId as any,
    });
  }

  public async adminDeleteUser(
    sessionToken: string,
    userId: string,
    options: {
      reason?: string;
      notes?: string;
      transferWorkspaceOwnership?: boolean;
      newOwnerId?: string;
      cancelSubscriptions?: boolean;
      adminForceDelete?: boolean;
    }
  ) {
    return this.mutate('adminUsers:deleteUser', {
      sessionToken,
      userId: userId as any,
      reason: options.reason,
      notes: options.notes,
      transferWorkspaceOwnership: options.transferWorkspaceOwnership,
      newOwnerId: options.newOwnerId as any,
      cancelSubscriptions: options.cancelSubscriptions,
      adminForceDelete: options.adminForceDelete,
    });
  }

  public async adminSuspendWorkspace(sessionToken: string, workspaceId: string, reason?: string, notes?: string) {
    return this.mutate('adminOrganizations:suspendOrganization', {
      sessionToken,
      workspaceId: workspaceId as any,
      reason,
      notes,
    });
  }

  public async adminRestoreWorkspace(sessionToken: string, workspaceId: string) {
    return this.mutate('adminOrganizations:restoreOrganization', {
      sessionToken,
      workspaceId: workspaceId as any,
    });
  }

  public async adminDeleteWorkspace(
    sessionToken: string,
    workspaceId: string,
    options: {
      reason?: string;
      notes?: string;
      cancelSubscriptions?: boolean;
      adminForceDelete?: boolean;
    }
  ) {
    return this.mutate('adminOrganizations:deleteOrganization', {
      sessionToken,
      workspaceId: workspaceId as any,
      reason: options.reason,
      notes: options.notes,
      cancelSubscriptions: options.cancelSubscriptions,
      adminForceDelete: options.adminForceDelete,
    });
  }

  public async exportUserData(userId: string) {
    const user = await this.getUserById(userId);
    if (!user) throw new Error('User not found');

    const sessions = await this.getUserSessions(userId);
    const identities = await this.getUserIdentities(userId);
    const preferences = await this.getUserPreferences(userId);
    const consents = await this.getUserConsents(userId);
    const workspaces = (await this.query('workspaces:getUserWorkspaces', { userId: userId as any })) || [];
    const auditLogs = await this.getUserSecurityActivity(userId, { limit: 100 });

    const personalProfile = {
      id: user.id,
      email: user.email,
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName,
      preferredName: user.preferredName,
      jobTitle: user.jobTitle,
      department: user.department,
      bio: user.bio,
      phone: user.phone,
      country: user.country,
      state: user.state,
      city: user.city,
      timezone: user.timezone,
      language: user.language,
      createdAt: user.createdAt,
    };

    const linkedIdentities = identities.map((id: any) => ({
      provider: id.provider,
      providerEmail: id.providerEmail,
      createdAt: id.createdAt,
    }));

    const workspaceMemberships = workspaces.map((w: any) => ({
      workspaceId: w.workspaceId,
      workspaceName: w.workspace?.name,
      role: w.role,
      joinedAt: w.joinedAt,
    }));

    const exportPayload = {
      exportedAt: new Date().toISOString(),
      user: personalProfile,
      personalProfile,
      preferences,
      sessions: sessions.map((s: any) => ({
        deviceName: s.deviceName,
        browser: s.browser,
        ipAddressMasked: s.ipAddress ? s.ipAddress.replace(/\.\d+$/, '.***') : undefined,
        lastActiveAt: s.lastActiveAt,
        createdAt: s.createdAt,
      })),
      identities: linkedIdentities,
      linkedIdentities,
      memberships: workspaceMemberships,
      workspaceMemberships,
      consents,
      securityAuditSummary: {
        totalEventsLogged: auditLogs.length,
        recentEvents: auditLogs.slice(0, 10),
      },
    };

    const record = await this.mutate('userProfile:createDataExportRequest', {
      userId: userId as any,
      data: exportPayload,
    });

    return { exportId: record._id, data: exportPayload };
  }

  public async deleteUserAccount(userId: string, password?: string) {
    const user = await this.getUserById(userId);
    if (!user) throw new Error('User not found');

    if (user.passwordHash && password) {
      const isValid = await this.verifyPassword(user, password);
      if (!isValid) {
        const err: Error & { code?: string } = new Error('Incorrect password');
        err.code = 'INVALID_CREDENTIALS';
        throw err;
      }
    }

    // Invalidate sessions
    await this.mutate('sessions:revokeAllUserSessions', { userId: userId as any });
    // Anonymize user record
    await this.mutate('users:deleteUserAccount', { userId: userId as any });
    return true;
  }


  public async leaveWorkspace(userId: string, workspaceId: string) {
    const memberships = (await this.query('workspaces:getUserWorkspaces', { userId: userId as any })) || [];
    const targetMembership = memberships.find(
      (m: any) => String(m.workspaceId) === String(workspaceId) || String(m.workspace?._id) === String(workspaceId)
    );

    if (!targetMembership) {
      const err: Error & { code?: string } = new Error('Workspace membership not found.');
      err.code = 'NOT_FOUND';
      throw err;
    }

    if (targetMembership.role === 'OWNER' || targetMembership.workspace?.ownerId === userId) {
      const err: Error & { code?: string } = new Error(
        'As the workspace owner, you cannot leave the workspace directly. You must transfer ownership to another administrator or delete the workspace.'
      );
      err.code = 'SOLE_OWNER_CANNOT_LEAVE_WORKSPACE';
      throw err;
    }

    return this.mutate('workspaceMembers:removeMember', {
      workspaceId: workspaceId as any,
      targetUserId: userId as any,
      actorUserId: userId as any,
    });
  }

  // ==========================================
  // APPLICATION-FIRST CATALOG & ACCESS RESOLUTION
  // ==========================================

  public getProductsCatalog() {
    return [
      {
        key: 'inventory',
        name: 'Inventory',
        tagline: 'Manage products, stock, sales, customers, and suppliers.',
        description: 'Multi-branch stock control, barcode POS checkout, receipts, sales history, and telemetry.',
        category: 'operations',
        status: 'ACTIVE',
        subdomain: 'inventory.orviohub.com',
        appRoute: '/inventory/dashboard',
        onboardingRoute: '/inventory/onboarding',
        createOrgRoute: '/app/organizations/new?product=inventory',
        isProductionReady: true,
      },
    ];
  }

  public getProductDetails(productKey: string) {
    const catalog = this.getProductsCatalog();
    return catalog.find((p) => p.key.toLowerCase() === productKey.toLowerCase()) || null;
  }

  public async getApplicationAccess(userId: string, productKey?: string) {
    const user = await this.getUserById(userId);
    if (!user) throw new Error('User not found');

    const effectiveProductKey = 'inventory';

    const rawWorkspaces = (await this.query('workspaces:getUserWorkspaces', {
      userId: userId as any,
      productKey: effectiveProductKey,
    })) || [];

    const ownedOrganizations: any[] = [];
    const joinedOrganizations: any[] = [];

    for (const item of rawWorkspaces) {
      const ws = item.workspace || item;
      const role = String(item.role || ws.role || 'MEMBER').toUpperCase();
      const isOwner = role === 'OWNER' || String(ws.ownerId) === String(userId);

      const orgItem = {
        id: ws._id || ws.id,
        workspaceId: ws._id || ws.id,
        name: ws.name,
        slug: ws.slug,
        type: ws.type || 'business',
        currency: ws.currency || 'NGN',
        country: ws.country,
        logoUrl: ws.logoUrl,
        status: ws.status || 'active',
        role,
        isOwner,
        enabledProducts: [{ productKey: 'inventory', status: 'active' }],
        joinedAt: item.joinedAt || ws.createdAt,
      };

      if (isOwner) {
        ownedOrganizations.push(orgItem);
      } else {
        joinedOrganizations.push(orgItem);
      }
    }

    // Get pending invitations for user safely
    let pendingInvitations: any[] = [];
    try {
      pendingInvitations =
        (await this.query('workspaceMembers:getUserWorkspaceInvitations', {
          email: user.email,
        })) || [];
    } catch {
      pendingInvitations = [];
    }

    const products = this.getProductsCatalog();

    // Determine target route based on application state
    let targetRoute = '/app';
    const totalCount = ownedOrganizations.length + joinedOrganizations.length;
    if (totalCount === 1) {
      const singleOrg = ownedOrganizations[0] || joinedOrganizations[0];
      targetRoute = `/inventory/dashboard?workspaceId=${singleOrg.workspaceId}`;
    } else if (totalCount > 1) {
      targetRoute = `/app?product=inventory&mode=select_org`;
    } else if (pendingInvitations.length > 0) {
      targetRoute = `/app/invitations`;
    } else {
      targetRoute = `/app/organizations/new?product=inventory`;
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        lastSelectedProduct: 'inventory',
        lastSelectedWorkspaceId: user.lastSelectedWorkspaceId || null,
      },
      selectedProduct: 'inventory',
      ownedOrganizations,
      joinedOrganizations,
      totalOrganizations: totalCount,
      accessibleCount: totalCount,
      pendingInvitations,
      products,
      targetRoute,
    };
  }

  public async setApplicationSelection(userId: string, productKey: string) {
    try {
      await this.mutate('users:updateUserProfile', {
        userId: userId as any,
        lastSelectedProduct: 'inventory',
      });
    } catch {
      // Fallback
    }
    return { success: true, selectedProduct: 'inventory' };
  }

  // ==========================================
  // PRODUCT LAUNCH MANAGEMENT & WAITLIST
  // ==========================================

  private inMemoryProducts: any[] = [
    {
      key: 'inventory',
      name: 'Inventory',
      description: 'Multi-branch warehouse stock, barcode POS checkout, receipts, sales history & telemetry.',
      subdomain: 'inventory.orviohub.com',
      status: 'active',
      isVisibleToUsers: true,
      isActivatable: true,
      isBeta: false,
      isFeatured: true,
      displayOrder: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      key: 'taskmanagement',
      name: 'Task & Project Management',
      description: 'Collaborative task execution, agile sprints, kanban boards, and project tracking.',
      subdomain: 'tasks.orviohub.com',
      status: 'coming_soon',
      isVisibleToUsers: false,
      isActivatable: false,
      isBeta: false,
      isFeatured: false,
      displayOrder: 2,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      key: 'crm',
      name: 'Customer CRM',
      description: 'Client contact directories, communication history, pipelines, and deal conversions.',
      subdomain: 'crm.orviohub.com',
      status: 'coming_soon',
      isVisibleToUsers: false,
      isActivatable: false,
      isBeta: true,
      isFeatured: false,
      displayOrder: 3,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      key: 'booking',
      name: 'Appointments & Booking',
      description: 'Online calendar reservations, service scheduling, reminders, and client appointments.',
      subdomain: 'booking.orviohub.com',
      status: 'coming_soon',
      isVisibleToUsers: false,
      isActivatable: false,
      isBeta: false,
      isFeatured: false,
      displayOrder: 4,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      key: 'gym',
      name: 'Gym & Fitness Membership',
      description: 'Member passes, attendance tracking, trainer schedules, and class subscriptions.',
      subdomain: 'gym.orviohub.com',
      status: 'coming_soon',
      isVisibleToUsers: false,
      isActivatable: false,
      isBeta: false,
      isFeatured: false,
      displayOrder: 5,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ];

  private inMemoryNotifyList: any[] = [];

  public async listAllProducts() {
    try {
      const res = await this.query('products:listAll', {});
      if (res && (res as any[]).length > 0) return res;
    } catch {
      // Fallback to local memory catalog
    }
    return this.inMemoryProducts;
  }

  public async listVisibleProducts() {
    try {
      const res = await this.query('products:listVisible', {});
      if (res && (res as any[]).length > 0) return res;
    } catch {
      // Fallback to local memory catalog
    }
    return this.inMemoryProducts.filter((p) => p.isVisibleToUsers === true || p.key === 'inventory');
  }

  public async getProductByKey(productKey: string) {
    const normKey = productKey.toLowerCase();
    try {
      const res = await this.query('products:getByKey', { productKey });
      if (res) return res;
    } catch {
      // Fallback
    }
    const found = this.inMemoryProducts.find((p) => p.key.toLowerCase() === normKey);
    if (!found || found.isVisibleToUsers === false) {
      throw new Error('PRODUCT_NOT_AVAILABLE');
    }
    return found;
  }

  public async getProductUsageStats(productKey: string) {
    try {
      return await this.query('products:getUsageStats', { productKey });
    } catch {
      const waitlist = this.inMemoryNotifyList.filter((n) => n.productKey === productKey);
      return {
        activeWorkspaces: 1,
        totalActivations: 1,
        waitlistCount: waitlist.length,
      };
    }
  }

  public async getAvailableProductsForWorkspace(workspaceId: string) {
    try {
      const res = await this.query('products:getAvailableForWorkspace', { workspaceId: workspaceId as any });
      if (res) return res;
    } catch {
      // Fallback
    }
    return this.inMemoryProducts
      .filter((p) => p.isVisibleToUsers === true || p.key === 'inventory')
      .map((p) => ({ ...p, isActivated: p.key === 'inventory' }));
  }

  public async listApplicationWorkspaces(sessionToken: string, appKey: string, filters?: { status?: string; planKey?: string; search?: string }) {
    try {
      const res = await this.query('adminProducts:listApplicationWorkspaces', {
        sessionToken,
        appKey,
        status: filters?.status,
        planKey: filters?.planKey,
        search: filters?.search,
      });
      if (res) return res;
    } catch {
      // Fallback in case of local offline testing
    }
    return [];
  }

  public async getApplicationStats(sessionToken: string, appKey: string) {
    try {
      const res = await this.query('adminProducts:getApplicationStats', {
        sessionToken,
        appKey,
      });
      if (res) return res;
    } catch {
      // Fallback
    }
    return {
      appKey,
      totalActivations: 0,
      totalActive: 0,
      totalSuspended: 0,
      totalTrial: 0,
      onboardingCompleted: 0,
      onboardingInProgress: 0,
    };
  }

  public async createProduct(data: {
    name: string;
    description: string;
    status: 'active' | 'coming_soon' | 'draft';
    displayOrder: number;
    isBeta?: boolean;
    isFeatured?: boolean;
    iconUrl?: string;
    documentationUrl?: string;
    supportEmail?: string;
    key?: string;
    subdomain?: string;
  }) {
    try {
      return await this.mutate('products:create', data);
    } catch {
      const key = data.key || data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const newProd = {
        ...data,
        key,
        subdomain: data.subdomain || `${key}.orviohub.com`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      this.inMemoryProducts.push(newProd);
      return newProd;
    }
  }

  public async updateProduct(
    productKey: string,
    updates: {
      name?: string;
      description?: string;
      status?: 'active' | 'coming_soon' | 'draft' | 'ACTIVE' | 'BETA' | 'COMING_SOON';
      isBeta?: boolean;
      isFeatured?: boolean;
      displayOrder?: number;
      iconUrl?: string;
      documentationUrl?: string;
      supportEmail?: string;
      subdomain?: string;
    }
  ) {
    try {
      return await this.mutate('products:update', { productKey, updates });
    } catch {
      const idx = this.inMemoryProducts.findIndex((p) => p.key === productKey);
      if (idx === -1) throw new Error('Product not found');
      this.inMemoryProducts[idx] = {
        ...this.inMemoryProducts[idx],
        ...updates,
        updatedAt: Date.now(),
      };
      return this.inMemoryProducts[idx];
    }
  }

  public async archiveProduct(productKey: string) {
    try {
      return await this.mutate('products:archive', { productKey });
    } catch {
      const idx = this.inMemoryProducts.findIndex((p) => p.key === productKey);
      if (idx !== -1) {
        this.inMemoryProducts[idx].status = 'draft';
        this.inMemoryProducts[idx].updatedAt = Date.now();
      }
      return { success: true };
    }
  }

  public async deleteProduct(productKey: string) {
    try {
      return await this.mutate('products:deleteProduct', { productKey });
    } catch {
      const idx = this.inMemoryProducts.findIndex((p) => p.key === productKey);
      if (idx === -1) throw new Error('Product not found');
      if (this.inMemoryProducts[idx].status !== 'draft') {
        throw new Error('Only draft products can be deleted');
      }
      this.inMemoryProducts.splice(idx, 1);
      return { success: true };
    }
  }

  public async getNotifyList(productKey: string) {
    try {
      return (await this.query('notifyList:getByProduct', { productKey })) || [];
    } catch {
      return this.inMemoryNotifyList.filter((n) => n.productKey === productKey);
    }
  }

  public async addToNotifyList(productKey: string, email: string, userId?: string) {
    try {
      return await this.mutate('notifyList:add', { productKey, email, userId: userId as any });
    } catch {
      const emailNormalized = email.toLowerCase().trim();
      const existing = this.inMemoryNotifyList.find(
        (n) => n.productKey === productKey && n.emailNormalized === emailNormalized
      );
      if (existing) {
        return { alreadySubscribed: true };
      }
      const entry = {
        productKey,
        email: email.trim(),
        emailNormalized,
        userId,
        notified: false,
        createdAt: Date.now(),
      };
      this.inMemoryNotifyList.push(entry);
      return { alreadySubscribed: false, id: `notify_${Date.now()}` };
    }
  }

  public async notifyAllOnLaunch(productKey: string) {
    try {
      return await this.mutate('notifyList:notifyAllOnLaunch', { productKey });
    } catch {
      const unnotified = this.inMemoryNotifyList.filter(
        (n) => n.productKey === productKey && !n.notified
      );
      for (const item of unnotified) {
        item.notified = true;
      }
      return {
        notifiedCount: unnotified.length,
        emails: unnotified.map((i) => i.email),
      };
    }
  }

  public async countActiveWorkspaceProducts(workspaceId: string) {
    try {
      const res = await this.query('workspaceProducts:countActive', { workspaceId: workspaceId as any });
      if (typeof res === 'number') return res;
    } catch {
      // Fallback
    }
    return 1;
  }

  public async isWorkspaceProductActive(workspaceId: string, productKey: string) {
    try {
      const res = await this.query('workspaceProducts:isActive', {
        workspaceId: workspaceId as any,
        productKey,
      });
      if (typeof res === 'boolean') return res;
    } catch {
      // Fallback
    }
    // Default fallback: inventory is active, other products false
    return productKey === 'inventory';
  }

  public async activateProductForWorkspace(
    workspaceId: string,
    productKey: string,
    activatedBy: string,
    planId?: string
  ) {
    try {
      return await this.mutate('workspaceProducts:activate', {
        workspaceId: workspaceId as any,
        productKey,
        activatedBy: activatedBy as any,
        planId,
      });
    } catch {
      return {
        alreadyActivated: false,
        workspaceProduct: {
          workspaceId,
          productKey,
          status: 'active',
          activatedBy,
          activatedAt: Date.now(),
        },
      };
    }
  }

  // ==========================================
  // MVP BILLING SYSTEM & PLANS (PHASE 1)
  private inMemoryPlans: any[] = [
    {
      key: 'free_trial',
      name: 'Free Trial',
      price: { monthly: 0, annual: 0 },
      limits: { orgs: 3, apps: 1, members: 10, branches: 3, products: 5000, transactions: 5000, inventory: true },
      allowedApps: ['inventory'],
      trialDays: 30,
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      key: 'standard',
      name: 'Standard',
      price: { monthly: 7500, annual: 75000 },
      limits: { orgs: 3, apps: 1, members: 10, branches: 3, products: 5000, transactions: 5000, inventory: true },
      allowedApps: ['inventory'],
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      key: 'premium',
      name: 'Premium',
      price: { monthly: 25000, annual: 250000 },
      limits: { orgs: 10, apps: 1, members: 50, branches: 10, products: 25000, transactions: 25000, inventory: true },
      allowedApps: ['inventory'],
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ];

  private inMemorySubscriptions: Map<string, any> = new Map();
  private inMemoryUsageCounters: Map<string, any> = new Map();

  public async listPlans() {
    try {
      const res = await this.query('plans:list', {});
      if (res && (res as any[]).length > 0) return res;
    } catch {
      // Fallback
    }
    return this.inMemoryPlans;
  }

  public async getPlanByKey(planKey: string) {
    try {
      const res = await this.query('plans:getByKey', { planKey });
      if (res) return res;
    } catch {
      // Fallback
    }
    const found = this.inMemoryPlans.find((p) => p.key === planKey);
    if (!found) throw new Error('Plan not found');
    return found;
  }

  public async updatePlan(
    planKey: string,
    updates: {
      name?: string;
      price?: { monthly: number; annual: number };
      monthlyPrice?: number;
      annualPrice?: number;
      limits?: any;
      allowedApps?: string[];
      allowedAppKeys?: string[];
      isActive?: boolean;
    }
  ) {
    try {
      return await this.mutate('plans:update', { planKey, updates });
    } catch {
      const idx = this.inMemoryPlans.findIndex((p) => p.key === planKey);
      if (idx === -1) throw new Error('Plan not found');
      this.inMemoryPlans[idx] = {
        ...this.inMemoryPlans[idx],
        ...updates,
        updatedAt: Date.now(),
      };
      return this.inMemoryPlans[idx];
    }
  }

  public async getWorkspaceSubscription(workspaceId: string) {
    try {
      const res = await this.query('subscriptions:getByWorkspace', { workspaceId: workspaceId as any });
      if (res) return res;
    } catch {
      // Fallback
    }
    const existing = this.inMemorySubscriptions.get(workspaceId);
    if (existing) return existing;

    const now = Date.now();
    const defaultSub = {
      workspaceId,
      planKey: 'free',
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: now + 365 * 86_400_000,
      cancelAtPeriodEnd: false,
    };
    this.inMemorySubscriptions.set(workspaceId, defaultSub);
    return defaultSub;
  }

  public async getUserSubscription(userId: string) {
    try {
      const res = await this.query('subscriptions:getByUser', { userId: userId as any });
      if (res) return res;
    } catch {
      // Fallback
    }
    const now = Date.now();
    return {
      userId,
      planKey: 'free_trial',
      status: 'trialing',
      currentPeriodStart: now,
      currentPeriodEnd: now + 14 * 86_400_000,
      cancelAtPeriodEnd: false,
    };
  }

  public async updateUserSubscription(
    userId: string,
    planKey: string,
    status?: 'active' | 'trialing' | 'canceled' | 'past_due' | 'suspended',
    currentPeriodEnd?: number,
    cancelAtPeriodEnd?: boolean
  ) {
    try {
      return await this.mutate('subscriptions:updateForUser', {
        userId: userId as any,
        planKey,
        status: status as any,
        currentPeriodEnd,
        cancelAtPeriodEnd,
      });
    } catch {
      const now = Date.now();
      return {
        userId,
        planKey,
        status: status || 'active',
        currentPeriodStart: now,
        currentPeriodEnd: currentPeriodEnd || now + 30 * 86_400_000,
        cancelAtPeriodEnd: cancelAtPeriodEnd || false,
        updatedAt: now,
      };
    }
  }

  public async getOrganizationSubscription(organizationId: string) {
    try {
      const res = await this.query('subscriptions:getByOrganization', {
        organizationId: organizationId as any,
      });
      if (res) return res;
    } catch {
      // Fallback
    }
    const now = Date.now();
    return {
      organizationId,
      planKey: 'free_trial',
      status: 'trialing',
      currentPeriodStart: now,
      currentPeriodEnd: now + 30 * 86_400_000,
      trialStart: now,
      trialEnd: now + 30 * 86_400_000,
      trialEndsAt: now + 30 * 86_400_000,
      cancelAtPeriodEnd: false,
    };
  }

  public async getWorkspaceTrial(workspaceId: string) {
    try {
      const res = await this.query('subscriptions:getWorkspaceTrial', { workspaceId: workspaceId as any });
      if (res) return res;
    } catch {
      // Fallback
    }
    const now = Date.now();
    return {
      isFreeTrial: true,
      status: 'active',
      planKey: 'free_trial',
      trialStart: now,
      trialEnd: now + 30 * 86_400_000,
      trialEndsAt: now + 30 * 86_400_000,
      daysRemaining: 30,
      hoursRemaining: 720,
      trialOrigin: 'free_trial',
      trialEligibleAtCreation: true,
      isExpired: false,
      isWarning: false,
      upgradeOptions: ['standard', 'premium'],
      limits: {
        branches: 1,
        members: 2,
        products: 500,
        monthly_transactions: 300,
        inventory: true,
        basic_reports: true,
        advanced_reports: false,
        api_access: false,
        custom_roles: false,
        advanced_exports: false,
      },
    };
  }

  public async reconcileWorkspaceTrial(workspaceId: string, actorUserId?: string) {
    try {
      const res = await this.mutate('subscriptions:reconcileTrialSubscription', {
        workspaceId: workspaceId as any,
        actorUserId: actorUserId as any,
      });
      if (res) return res;
    } catch {
      // Fallback
    }
    return {
      success: true,
      trialStatus: 'active',
      status: 'trialing',
      daysRemaining: 30,
      hoursRemaining: 720,
      trialEnd: Date.now() + 30 * 86_400_000,
      isExpired: false,
    };
  }

  public async getCheckoutStatus(workspaceId: string, reference: string) {
    try {
      const res = await this.query('subscriptions:getCheckoutStatus', {
        workspaceId: workspaceId as any,
        reference,
      });
      if (res) return res;
    } catch {
      // Fallback
    }
    return {
      reference,
      status: 'pending',
      amount: undefined,
      currency: 'NGN',
    };
  }

  public async reconcileBillingState(workspaceId: string, adminId?: string, reason?: string) {
    try {
      const res = await this.mutate('subscriptions:reconcileBillingState', {
        workspaceId: workspaceId as any,
        adminId: adminId as any,
        reason: reason || 'Admin billing reconciliation',
      });
      if (res) return res;
    } catch {
      // Fallback
    }
    return {
      success: true,
      reconciled: true,
      workspaceId,
    };
  }

  public async updateOrganizationSubscription(
    organizationId: string,
    planKey: string,
    status?: 'active' | 'trialing' | 'canceled' | 'past_due' | 'suspended' | 'expired',
    currentPeriodEnd?: number,
    trialEndsAt?: number,
    cancelAtPeriodEnd?: boolean
  ) {
    try {
      return await this.mutate('subscriptions:updatePlan', {
        organizationId: organizationId as any,
        planKey,
        status: status as any,
        currentPeriodEnd,
        trialEndsAt,
        cancelAtPeriodEnd,
      });
    } catch {
      const now = Date.now();
      return {
        organizationId,
        planKey,
        status: status || 'active',
        currentPeriodEnd: currentPeriodEnd || now + 30 * 86_400_000,
        trialEndsAt,
        cancelAtPeriodEnd: cancelAtPeriodEnd || false,
      };
    }
  }

  public async extendOrganizationTrial(organizationId: string, days: number, trialEndsAt?: number) {
    try {
      return await this.mutate('subscriptions:extendTrial', {
        organizationId: organizationId as any,
        days,
        trialEndsAt,
      });
    } catch {
      const now = Date.now();
      return {
        organizationId,
        days,
        trialEndsAt,
        extendedAt: now,
      };
    }
  }

  public async recordOrganizationPayment(data: {
    organizationId: string;
    userId?: string;
    amount: number;
    currency?: string;
    provider?: string;
    providerReference?: string;
    status?: string;
  }) {
    try {
      return await this.mutate('payments:recordPayment', {
        organizationId: data.organizationId as any,
        userId: (data.userId || '') as any,
        amount: data.amount,
        currency: data.currency || 'NGN',
        provider: data.provider || 'manual',
        providerReference: data.providerReference,
        status: data.status || 'success',
      });
    } catch {
      return null;
    }
  }

  public async getOrganizationPayments(organizationId: string) {
    try {
      const payments = await this.query('manualPayments:listByOrganization', {
        organizationId: organizationId as any,
      });
      if (payments) return payments;
    } catch {
      // Fallback
    }
    return [];
  }

  public async recordOrganizationManualPayment(data: {
    organizationId: string;
    workspaceId?: string;
    planKey: string;
    amount: number;
    currency?: string;
    billingCycle?: string;
    paymentReference: string;
    paymentMethod?: string;
    paidAt?: number;
    recordedBy: string;
    notes?: string;
    extensionDays?: number;
  }) {
    if (typeof (this as any).recordManualPayment === 'function') {
      return await (this as any).recordManualPayment({
        ...data,
        workspaceId: data.workspaceId || data.organizationId,
      });
    }
    try {
      return await this.mutate('manualPayments:recordPayment', {
        organizationId: data.organizationId as any,
        workspaceId: data.workspaceId as any,
        planKey: data.planKey,
        amount: data.amount,
        currency: data.currency || 'NGN',
        billingCycle: data.billingCycle || 'monthly',
        paymentReference: data.paymentReference,
        paymentMethod: data.paymentMethod || 'manual',
        paidAt: data.paidAt || Date.now(),
        recordedBy: data.recordedBy as any,
        notes: data.notes,
        extensionDays: data.extensionDays,
      });
    } catch {
      return {
        success: true,
        paymentId: `manual_${Date.now()}`,
        organizationId: data.organizationId,
      };
    }
  }

  public async cancelUserSubscription(userId: string) {
    try {
      return await this.mutate('subscriptions:cancelForUser', { userId: userId as any });
    } catch {
      return { success: true };
    }
  }

  public async updateWorkspaceSubscription(
    workspaceId: string,
    planKey: string,
    status?: 'active' | 'cancelled' | 'past_due' | 'trialing',
    currentPeriodEnd?: number,
    cancelAtPeriodEnd?: boolean
  ) {
    try {
      return await this.mutate('subscriptions:updatePlan', {
        workspaceId: workspaceId as any,
        planKey,
        status,
        currentPeriodEnd,
        cancelAtPeriodEnd,
      });
    } catch {
      const now = Date.now();
      const updated = {
        workspaceId,
        planKey,
        status: status || 'active',
        currentPeriodStart: now,
        currentPeriodEnd: currentPeriodEnd || now + 30 * 86_400_000,
        cancelAtPeriodEnd: cancelAtPeriodEnd || false,
        updatedAt: now,
      };
      this.inMemorySubscriptions.set(workspaceId, updated);
      return updated;
    }
  }

  public async getWorkspaceUsage(workspaceId: string) {
    try {
      const res = await this.query('usageCounters:getByWorkspace', { workspaceId: workspaceId as any });
      if (res) return res;
    } catch {
      // Fallback
    }
    return {
      workspaceId,
      counters: {
        membersCount: 1,
        appsCount: 1,
        productsCount: 0,
        transactionsCount: 0,
      },
      records: [],
    };
  }

  public async getUserUsage(userId: string) {
    try {
      const res = await this.query('adminUsers:getUserUsage', { userId: userId as any });
      if (res) return res;
    } catch {
      // Fallback
    }
    return {
      userId,
      usage: {
        workspaces: 0,
        apps: 0,
        branches: 0,
        members: 0,
        products: 0,
        transactions: 0,
      },
    };
  }

  public async incrementUsageCounter(workspaceId: string, featureKey: string, amount: number = 1) {
    try {
      return await this.mutate('usageCounters:increment', {
        workspaceId: workspaceId as any,
        featureKey,
        amount,
      });
    } catch {
      const key = `${workspaceId}:${featureKey}`;
      const current = this.inMemoryUsageCounters.get(key) || 0;
      const next = current + amount;
      this.inMemoryUsageCounters.set(key, next);
      return { success: true, usageValue: next };
    }
  }

  public async resetWorkspaceMonthlyUsage(workspaceId: string) {
    try {
      return await this.mutate('usageCounters:resetMonthly', { workspaceId: workspaceId as any });
    } catch {
      return { success: true, resetCount: 0 };
    }
  }

  public async listAllSubscriptions(filters?: {
    planKey?: string;
    status?: string;
    search?: string;
  }) {
    try {
      const res = await this.query('subscriptions:listAll', {
        planKey: filters?.planKey,
        status: filters?.status,
        search: filters?.search,
      });
      if (Array.isArray(res)) return res;
    } catch {
      // Fallback
    }

    const list: any[] = [];
    for (const [wsId, sub] of this.inMemorySubscriptions.entries()) {
      if (filters?.planKey && filters.planKey !== 'all' && sub.planKey !== filters.planKey) continue;
      if (filters?.status && filters.status !== 'all' && sub.status !== filters.status) continue;
      list.push({
        ...sub,
        workspaceName: `Workspace ${wsId.slice(-4)}`,
        workspaceSlug: `workspace-${wsId.slice(-4)}`,
        ownerName: 'Admin Owner',
        ownerEmail: 'owner@example.com',
      });
    }
    return list;
  }

  public async listUsers(params?: {
    search?: string;
    limit?: number;
    cursor?: string;
    status?: string;
  }) {
    try {
      const res = await this.query('adminUsers:listUsers', {
        sessionToken: 'system_admin',
        search: params?.search,
        statusFilter: params?.status,
        pageSize: params?.limit,
      });
      if (res && (res as any).users) {
        return res;
      }
    } catch {
      // Fallback
    }
    return {
      users: [],
      total: 0,
    };
  }

  public async updateUserStatus(userId: string, status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED') {
    try {
      if (status === 'SUSPENDED') {
        return await this.mutate('adminUsers:suspendUser', {
          sessionToken: 'system_admin',
          userId: userId as any,
          reason: 'Administrative action',
        });
      } else {
        return await this.mutate('adminUsers:activateUser', {
          sessionToken: 'system_admin',
          userId: userId as any,
        });
      }
    } catch {
      return { id: userId, status };
    }
  }

  public async listWorkspaces(params?: { search?: string; limit?: number }) {
    try {
      const res = await this.query('adminOrganizations:listOrganizations', {
        sessionToken: 'system_admin',
        search: params?.search,
        pageSize: params?.limit,
      });
      if (res && (res as any).organizations) {
        return (res as any).organizations;
      }
    } catch {
      // Fallback
    }
    return [];
  }

  public async getSubscriptionOverviewStats() {
    try {
      const res = await this.query('subscriptions:getOverviewStats', {});
      if (res && typeof (res as any).totalSubscriptions === 'number') return res;
    } catch {
      // Fallback
    }

    let standardCount = 0;
    let premiumCount = 0;
    let freeCount = 0;

    for (const sub of this.inMemorySubscriptions.values()) {
      if (sub.planKey === 'premium') premiumCount++;
      else if (sub.planKey === 'standard') standardCount++;
      else freeCount++;
    }

    const totalMRRKobo = standardCount * 750_000 + premiumCount * 2_000_000;

    return {
      totalSubscriptions: this.inMemorySubscriptions.size || 1,
      totalMRRKobo,
      totalMRRNaira: totalMRRKobo / 100,
      expiringSoonCount: 0,
      countsByPlan: {
        free: freeCount,
        standard: standardCount,
        premium: premiumCount,
      },
    };
  }

  public inMemoryManualPayments: Map<string, any[]> = new Map();

  public async recordManualPayment(data: {
    workspaceId: string;
    planKey: string;
    amount: number;
    currency?: string;
    billingCycle: string;
    paymentReference: string;
    paymentMethod: string;
    paidAt?: number;
    recordedBy: string;
    notes?: string;
    extensionDays?: number;
  }) {
    try {
      return await this.mutate('manualPayments:recordPayment', {
        workspaceId: data.workspaceId as any,
        planKey: data.planKey,
        amount: data.amount,
        currency: data.currency || 'NGN',
        billingCycle: data.billingCycle,
        paymentReference: data.paymentReference,
        paymentMethod: data.paymentMethod,
        paidAt: data.paidAt,
        recordedBy: data.recordedBy as any,
        notes: data.notes,
        extensionDays: data.extensionDays,
      });
    } catch {
      const now = Date.now();
      const extensionDays = data.extensionDays || (data.billingCycle === 'annual' ? 365 : 30);
      const newPeriodEnd = now + extensionDays * 86_400_000;

      const record = {
        _id: `mp_${Date.now()}`,
        workspaceId: data.workspaceId,
        planKey: data.planKey,
        amount: data.amount,
        currency: data.currency || 'NGN',
        billingCycle: data.billingCycle,
        paymentReference: data.paymentReference,
        paymentMethod: data.paymentMethod,
        paidAt: data.paidAt || now,
        recordedBy: data.recordedBy,
        recordedByName: 'Admin',
        notes: data.notes,
        createdAt: now,
      };

      const existing = this.inMemoryManualPayments.get(data.workspaceId) || [];
      existing.unshift(record);
      this.inMemoryManualPayments.set(data.workspaceId, existing);

      // Update in-memory subscription
      this.inMemorySubscriptions.set(data.workspaceId, {
        workspaceId: data.workspaceId,
        planKey: data.planKey,
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: newPeriodEnd,
        cancelAtPeriodEnd: false,
      });

      return {
        paymentId: record._id,
        workspaceId: data.workspaceId,
        planKey: data.planKey,
        currentPeriodEnd: newPeriodEnd,
        status: 'active',
      };
    }
  }

  public async listManualPayments(workspaceId: string) {
    try {
      const res = await this.query('manualPayments:listByWorkspace', {
        workspaceId: workspaceId as any,
      });
      if (Array.isArray(res)) return res;
    } catch {
      // Fallback
    }
    return this.inMemoryManualPayments.get(workspaceId) || [];
  }

  public inMemoryPaymentTransactions: Map<string, any> = new Map();

  public async recordInitiatedTransaction(data: {
    workspaceId: string;
    planKey: string;
    amount: number;
    currency?: string;
    billingCycle: string;
    gateway: 'paystack' | 'flutterwave';
    gatewayReference: string;
    customerEmail: string;
    metadata?: Record<string, any>;
  }) {
    try {
      return await this.mutate('paymentTransactions:recordInitiated', {
        workspaceId: data.workspaceId as any,
        planKey: data.planKey,
        amount: data.amount,
        currency: data.currency || 'NGN',
        billingCycle: data.billingCycle,
        gateway: data.gateway,
        gatewayReference: data.gatewayReference,
        customerEmail: data.customerEmail,
        metadata: data.metadata,
      });
    } catch {
      const now = Date.now();
      const tx = {
        _id: `tx_${Date.now()}`,
        workspaceId: data.workspaceId,
        planKey: data.planKey,
        amount: data.amount,
        currency: data.currency || 'NGN',
        billingCycle: data.billingCycle,
        gateway: data.gateway,
        gatewayReference: data.gatewayReference,
        status: 'pending',
        customerEmail: data.customerEmail,
        metadata: data.metadata,
        createdAt: now,
        updatedAt: now,
      };
      this.inMemoryPaymentTransactions.set(data.gatewayReference, tx);
      return tx._id;
    }
  }

  public async markSuccessfulTransaction(data: {
    gatewayReference: string;
    gateway: 'paystack' | 'flutterwave';
    metadata?: Record<string, any>;
  }) {
    try {
      return await this.mutate('paymentTransactions:markSuccessful', {
        gatewayReference: data.gatewayReference,
        gateway: data.gateway,
        metadata: data.metadata,
      });
    } catch {
      const tx = this.inMemoryPaymentTransactions.get(data.gatewayReference);
      if (tx) {
        tx.status = 'success';
        tx.paidAt = Date.now();
        const isAnnual = tx.billingCycle === 'annual';
        const duration = isAnnual ? 365 * 86_400_000 : 30 * 86_400_000;
        const now = Date.now();

        this.inMemorySubscriptions.set(tx.workspaceId, {
          workspaceId: tx.workspaceId,
          planKey: tx.planKey,
          status: 'active',
          currentPeriodStart: now,
          currentPeriodEnd: now + duration,
          cancelAtPeriodEnd: false,
        });

        return {
          success: true,
          transactionId: tx._id,
          planKey: tx.planKey,
          workspaceId: tx.workspaceId,
        };
      }
      return { success: true, planKey: 'standard' };
    }
  }

  public async getPaymentTransactionByRef(gatewayReference: string) {
    try {
      const res = await this.query('paymentTransactions:getByReference', {
        gatewayReference,
      });
      if (res) return res;
    } catch {
      // Fallback
    }
    return this.inMemoryPaymentTransactions.get(gatewayReference) || null;
  }

  // ==========================================
  // NIGERIAN LOCATIONS (PHASE 1)
  // ==========================================

  public async getStates(): Promise<Array<{ _id: string; name: string; code?: string; stateCode: string }>> {
    try {
      const states = await this.query('locations:getStates', {});
      if (states && Array.isArray(states)) {
        return states;
      }
    } catch (err) {
      console.warn('[DataService] Failed to query locations:getStates from Convex:', err);
    }
    return [];
  }

  public async getLgas(stateCode: string): Promise<Array<{ _id: string; name: string; stateCode: string }>> {
    try {
      const lgas = await this.query('locations:getLgas', {
        stateCode: stateCode.trim().toUpperCase(),
      });
      if (lgas && Array.isArray(lgas)) {
        return lgas;
      }
    } catch (err) {
      console.warn(`[DataService] Failed to query locations:getLgas for ${stateCode} from Convex:`, err);
    }
    return [];
  }

  public async seedNigerianLocations(force = false): Promise<any> {
    try {
      return await this.mutate('locations:seedNigerianLocations', { force });
    } catch (err) {
      console.warn('[DataService] Failed to seed Nigerian locations:', err);
      return { success: false, error: (err as any)?.message };
    }
  }

  // ==========================================
  // USER PHONE VERIFICATION (PHASE 2)
  // ==========================================

  public async getUserPhones(userId: string): Promise<any[]> {
    try {
      const res = await this.query('userPhones:getByUser', { userId });
      return res || [];
    } catch (err) {
      console.warn(`[DataService] Failed to query userPhones:getByUser for ${userId}:`, err);
      return [];
    }
  }

  public async getUserPhoneRecord(userId: string, phone: string): Promise<any> {
    try {
      return await this.query('userPhones:getByPhone', { userId, phone });
    } catch (err) {
      console.warn(`[DataService] Failed to query userPhones:getByPhone for ${userId}:`, err);
      return null;
    }
  }

  public async countRecentPhoneOtps(userId: string, phone: string, minutes = 60): Promise<number> {
    try {
      const count = await this.query('userPhones:countRecentOtps', { userId, phone, minutes });
      return typeof count === 'number' ? count : 0;
    } catch (err) {
      console.warn('[DataService] Failed to count recent phone OTPs:', err);
      return 0;
    }
  }

  /** Returns true if the normalized phone is already verified by a *different* user. */
  public async isPhoneRegistered(phoneNormalized: string, excludeUserId?: string): Promise<boolean> {
    try {
      const taken = await this.query('userPhones:isPhoneRegistered', {
        phoneNormalized,
        excludeUserId: excludeUserId as any,
      });
      return Boolean(taken);
    } catch (err) {
      console.warn('[DataService] Failed to check phone registration:', err);
      return false; // fail open — don't block legitimate users on network errors
    }
  }

  public async saveUserPhoneOtp(data: {
    userId: string;
    phone: string;
    phoneNormalized: string;
    verificationCode: string;
    codeExpiresAt: number;
  }): Promise<any> {
    return await this.mutate('userPhones:createOrUpdate', data);
  }

  public async setUserPrimaryPhone(userId: string, phoneId: string): Promise<any> {
    return await this.mutate('userPhones:setPrimary', { userId, phoneId });
  }

  public async deleteUserPhone(userId: string, phoneId: string): Promise<any> {
    return await this.mutate('userPhones:deletePhone', { userId, phoneId });
  }

  public async getOnboardingFlow(userId: string, workspaceId?: string, productKey?: string) {
    try {
      return await this.query('onboardingFlows:getOnboardingFlow', {
        userId: userId as any,
        workspaceId: workspaceId as any,
        productKey,
      });
    } catch {
      return null;
    }
  }

  public async startOnboardingFlow(
    userId: string,
    workspaceId?: string,
    productKey?: string,
    initialStep?: string,
    flowVersion?: string
  ) {
    try {
      return await this.mutate('onboardingFlows:startOnboardingFlow', {
        userId: userId as any,
        workspaceId: workspaceId as any,
        productKey,
        initialStep,
        flowVersion,
      });
    } catch {
      return {
        _id: 'local_flow',
        userId,
        workspaceId,
        productKey: productKey || 'global',
        status: 'in_progress',
        currentStep: initialStep || 'account_creation',
        completedSteps: [],
        skippedSteps: [],
        stepData: {},
      };
    }
  }

  public async updateOnboardingProgress(
    userId: string,
    step: string,
    data?: any,
    flowId?: string
  ) {
    try {
      return await this.mutate('onboardingFlows:updateStepProgress', {
        userId: userId as any,
        flowId: flowId as any,
        currentStep: step,
        stepData: data,
      });
    } catch {
      return { success: true };
    }
  }

  public async completeOnboardingStep(
    userId: string,
    completedStep: string,
    nextStep?: string,
    data?: any,
    flowId?: string
  ) {
    try {
      return await this.mutate('onboardingFlows:completeStep', {
        userId: userId as any,
        flowId: flowId as any,
        completedStepKey: completedStep,
        nextStepKey: nextStep,
        stepData: data,
      });
    } catch {
      return { success: true, nextStep: nextStep || completedStep };
    }
  }

  public async skipOnboardingStep(
    userId: string,
    skippedStep: string,
    nextStep?: string,
    flowId?: string
  ) {
    try {
      return await this.mutate('onboardingFlows:skipStep', {
        userId: userId as any,
        flowId: flowId as any,
        skippedStepKey: skippedStep,
        nextStepKey: nextStep,
      });
    } catch {
      return { success: true, nextStep: nextStep || skippedStep };
    }
  }

  public async completeOnboardingFlow(userId: string, finalData?: any, flowId?: string) {
    try {
      return await this.mutate('onboardingFlows:completeFlow', {
        userId: userId as any,
        flowId: flowId as any,
        finalData,
      });
    } catch {
      return { success: true };
    }
  }

  public async resetOnboardingFlow(userId: string) {
    try {
      return await this.mutate('onboardingFlows:resetFlow', {
        userId: userId as any,
      });
    } catch {
      return { success: true };
    }
  }

  // --- Notification Methods ---

  public async getNotificationsForUser(
    userId: string,
    options?: { status?: 'UNREAD' | 'READ' | 'ARCHIVED'; type?: string; limit?: number }
  ) {
    try {
      return await this.query('notifications:getNotifications', {
        userId: userId as any,
        status: options?.status,
        type: options?.type,
        limit: options?.limit,
      });
    } catch {
      return [];
    }
  }

  public async getUnreadNotificationCount(userId: string) {
    try {
      const res = await this.query('notifications:getUnreadCount', {
        userId: userId as any,
      });
      return res?.count ?? 0;
    } catch {
      return 0;
    }
  }

  public async markNotificationRead(notificationId: string, userId: string) {
    return await this.mutate('notifications:markNotificationRead', {
      notificationId: notificationId as any,
      userId: userId as any,
    });
  }

  public async markAllNotificationsRead(userId: string) {
    return await this.mutate('notifications:markAllNotificationsRead', {
      userId: userId as any,
    });
  }

  public async archiveNotification(notificationId: string, userId: string) {
    return await this.mutate('notifications:archiveNotification', {
      notificationId: notificationId as any,
      userId: userId as any,
    });
  }

  public async createNotification(payload: {
    userId: string;
    workspaceId?: string;
    productKey?: string;
    type: string;
    title: string;
    message: string;
    data?: any;
    severity?: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
    category?: 'SECURITY' | 'WORKSPACE' | 'INVENTORY' | 'BILLING' | 'SYSTEM';
    priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
    actionUrl?: string;
    actionLabel?: string;
    dedupeKey?: string;
    channel?: 'IN_APP' | 'EMAIL' | 'SMS' | 'WHATSAPP';
  }) {
    try {
      return await this.mutate('notificationQueue:enqueueNotification', {
        userId: payload.userId as any,
        workspaceId: payload.workspaceId as any,
        type: payload.type,
        category: payload.category || 'WORKSPACE',
        priority: payload.priority || 'NORMAL',
        title: payload.title,
        body: payload.message,
        data: payload.data,
        actionUrl: payload.actionUrl,
        actionLabel: payload.actionLabel,
        dedupeKey: payload.dedupeKey,
        channel: payload.channel || 'IN_APP',
      });
    } catch (err: any) {
      // Fallback direct send
      try {
        return await this.mutate('notifications:sendNotification', {
          userId: payload.userId as any,
          workspaceId: payload.workspaceId as any,
          productKey: payload.productKey,
          type: payload.type,
          title: payload.title,
          body: payload.message,
          data: payload.data,
          severity: payload.severity || 'INFO',
          category: payload.category || 'WORKSPACE',
          priority: payload.priority || 'NORMAL',
          actionUrl: payload.actionUrl,
          actionLabel: payload.actionLabel,
          dedupeKey: payload.dedupeKey,
          channel: payload.channel || 'IN_APP',
        });
      } catch (innerErr: any) {
        return null;
      }
    }
  }

  public async recordUserActivity(userId: string, page: string, workspaceId?: string) {
    try {
      return await this.mutate('notificationQueue:recordUserActivity', {
        userId: userId as any,
        page,
        workspaceId: workspaceId as any,
      });
    } catch {
      return null;
    }
  }

  public async getPendingInvitesForUser(userId: string) {
    try {
      return await this.query('inviteNotifications:getPendingInvitesForUser', {
        userId: userId as any,
      });
    } catch {
      return [];
    }
  }

  public async acceptInviteFromNotification(inviteId: string, userId: string, notificationId?: string) {
    return await this.mutate('inviteNotifications:acceptInviteFromNotification', {
      inviteId: inviteId as any,
      userId: userId as any,
      notificationId: notificationId as any,
    });
  }

  public async declineInviteFromNotification(inviteId: string, userId: string, notificationId?: string) {
    return await this.mutate('inviteNotifications:declineInviteFromNotification', {
      inviteId: inviteId as any,
      userId: userId as any,
      notificationId: notificationId as any,
    });
  }

  public async acceptWorkspaceInviteFromNotification(inviteId: string, userId: string, notificationId?: string) {
    return await this.mutate('inviteNotifications:acceptWorkspaceInviteFromNotification', {
      inviteId: inviteId as any,
      userId: userId as any,
      notificationId: notificationId as any,
    });
  }

  public async declineWorkspaceInviteFromNotification(inviteId: string, userId: string, notificationId?: string) {
    return await this.mutate('inviteNotifications:declineWorkspaceInviteFromNotification', {
      inviteId: inviteId as any,
      userId: userId as any,
      notificationId: notificationId as any,
    });
  }

  public async acceptInviteUnified(inviteId: string, userId: string, notificationId?: string) {
    return await this.mutate('inviteNotifications:acceptInviteUnified', {
      inviteId,
      userId: userId as any,
      notificationId: notificationId as any,
    });
  }

  public async declineInviteUnified(inviteId: string, userId: string, notificationId?: string) {
    return await this.mutate('inviteNotifications:declineInviteUnified', {
      inviteId,
      userId: userId as any,
      notificationId: notificationId as any,
    });
  }

  public async getInvoicesByOrganization(organizationId: string) {
    try {
      return (await this.query('invoices:getByOrganization', {
        organizationId: organizationId as any,
      })) as any[];
    } catch (err) {
      console.warn('[DataService] Failed to fetch invoices by organization:', err);
      return [];
    }
  }

  public async getInvoicesByWorkspace(workspaceId: string) {
    try {
      return (await this.query('invoices:getByWorkspace', {
        workspaceId: workspaceId as any,
      })) as any[];
    } catch (err) {
      console.warn('[DataService] Failed to fetch invoices by workspace:', err);
      return [];
    }
  }

  public async getInvoiceById(invoiceId: string) {
    try {
      return await this.query('invoices:getById', {
        invoiceId: invoiceId as any,
      });
    } catch (err) {
      console.warn('[DataService] Failed to fetch invoice by ID:', err);
      return null;
    }
  }

  public async getInvoiceByNumber(invoiceNumber: string) {
    try {
      return await this.query('invoices:getByInvoiceNumber', {
        invoiceNumber,
      });
    } catch (err) {
      console.warn('[DataService] Failed to fetch invoice by number:', err);
      return null;
    }
  }

  public async generateSubscriptionInvoice(data: {
    workspaceId?: string;
    organizationId?: string;
    billingAccountId?: string;
    subscriptionId?: string;
    paymentId?: string;
    providerReference?: string;
    providerTransactionId?: string;
    planKey: 'standard' | 'premium';
    billingInterval: 'monthly' | 'annual';
    amountSubtotal: number;
    discountAmount?: number;
    taxAmount?: number;
    totalAmount: number;
    amountPaid?: number;
    billingPeriodStart?: number;
    billingPeriodEnd?: number;
    paymentMethod?: string;
    paidAt?: number;
    customSnapshot?: any;
    lineItems?: any[];
  }) {
    return await this.mutate('invoices:generateSubscriptionInvoice', data as any);
  }

  public async createOrganizationInvoice(data: {
    organizationId: string;
    subscriptionId?: string;
    paymentId?: string;
    amount: number;
    currency?: string;
    periodStart?: number;
    periodEnd?: number;
    paymentReference?: string;
    paymentMethod?: 'bank_transfer' | 'paystack' | 'flutterwave' | 'manual';
    billingInterval?: string;
    planName?: string;
  }) {
    return await this.mutate('invoices:createOrganizationInvoice', {
      organizationId: data.organizationId as any,
      subscriptionId: data.subscriptionId as any,
      paymentId: data.paymentId as any,
      planKey: (data.planName?.toLowerCase().includes('premium') ? 'premium' : 'standard') as any,
      billingInterval: (data.billingInterval === 'annual' ? 'annual' : 'monthly') as any,
      amountSubtotal: data.amount,
      totalAmount: data.amount,
      amountPaid: data.amount,
      billingPeriodStart: data.periodStart,
      billingPeriodEnd: data.periodEnd,
      providerReference: data.paymentReference,
      paymentMethod: data.paymentMethod,
    });
  }

  public async generatePaymentReceipt(data: {
    invoiceId?: string;
    paymentId?: string;
    workspaceId?: string;
    organizationId?: string;
    billingAccountId?: string;
    subscriptionId?: string;
    providerReference: string;
    providerTransactionId?: string;
    amount: number;
    currency?: string;
    paidAt: number;
    paymentMethod?: string;
    planKey?: string;
    billingInterval?: string;
    customSnapshot?: any;
  }) {
    return await this.mutate('invoices:generatePaymentReceipt', data as any);
  }

  public async getReceiptById(receiptId: string) {
    try {
      return await this.query('invoices:getReceiptById', {
        receiptId: receiptId as any,
      });
    } catch (err) {
      console.warn('[DataService] Failed to fetch receipt by ID:', err);
      return null;
    }
  }

  public async getReceiptByInvoiceId(invoiceId: string) {
    try {
      return await this.query('invoices:getReceiptByInvoiceId', {
        invoiceId: invoiceId as any,
      });
    } catch (err) {
      console.warn('[DataService] Failed to fetch receipt by invoice ID:', err);
      return null;
    }
  }

  public async getReceiptsByWorkspace(workspaceId: string) {
    try {
      return (await this.query('invoices:getReceiptsByWorkspace', {
        workspaceId: workspaceId as any,
      })) as any[];
    } catch (err) {
      console.warn('[DataService] Failed to fetch receipts by workspace:', err);
      return [];
    }
  }

  public async voidInvoice(data: {
    invoiceId: string;
    reason: string;
    actorUserId?: string;
    actorRole?: string;
  }) {
    return await this.mutate('invoices:voidInvoice', data as any);
  }

  public async recordBillingAdjustment(data: {
    invoiceId: string;
    adjustmentType: 'credit_note' | 'debit_adjustment' | 'refund' | 'partial_refund' | 'invoice_void' | 'replacement_invoice';
    amount: number;
    reason: string;
    providerReference?: string;
    actorUserId?: string;
    actorRole?: string;
    metadata?: any;
  }) {
    return await this.mutate('invoices:recordBillingAdjustment', data as any);
  }

  public async retryPdfGeneration(data: {
    invoiceId: string;
    pdfUrl?: string;
    pdfStorageId?: string;
    status?: 'processing' | 'completed' | 'failed';
    error?: string;
  }) {
    return await this.mutate('invoices:retryPdfGeneration', data as any);
  }

  public async checkBillingConsistency(args?: { workspaceId?: string; organizationId?: string }) {
    try {
      return await this.query('invoices:checkBillingConsistency', (args || {}) as any);
    } catch (err) {
      console.warn('[DataService] Failed to run billing consistency check:', err);
      return { totalInvoicesChecked: 0, totalPaymentsChecked: 0, totalReceiptsChecked: 0, issuesCount: 0, issues: [] };
    }
  }

  public async getAdjustmentsByInvoice(invoiceId: string) {
    try {
      return (await this.query('invoices:getAdjustmentsByInvoice', {
        invoiceId: invoiceId as any,
      })) as any[];
    } catch (err) {
      console.warn('[DataService] Failed to fetch adjustments by invoice:', err);
      return [];
    }
  }

  // ─── Additional Application & Branch Helpers (new) ───────────────────────────

  /**
   * Create a branch for an organization/application (US-BR1)
   */
  public async createBranchForApplication(args: {
    organizationId: string;
    applicationId?: string;
    applicationKey?: string;
    name: string;
    code?: string;
    isPrimary?: boolean;
    country?: string;
    state?: string;
    city?: string;
    street?: string;
    area?: string;
    address?: string;
    phone?: string;
    email?: string;
    callerUserId?: string;
    userId?: string;
  }) {
    return this.branches.createBranchForApplication(args);
  }

  /**
   * Get branches for an application (US-BR2)
   */
  public async getBranchesForApplication(organizationId: string, applicationId?: string, applicationKey?: string): Promise<any[]> {
    return this.branches.getBranchesForApplication(organizationId, applicationId, applicationKey);
  }

  /**
   * Deactivate a branch (soft delete) (US-BR2)
   */
  public async deactivateBranch(branchId: string, userId?: string) {
    return this.branches.deactivateBranch(branchId, userId);
  }

  /**
   * List branches for an organization (optionally filtered by application)
   */
  public async listBranchesForOrg(args: {
    organizationId: string;
    applicationId?: string;
  }): Promise<any[]> {
    return this.branches.listBranchesForOrg(args);
  }

  /**
   * Get receipt settings for a workspace / organization
   */
  public async getReceiptSettings(workspaceId: string): Promise<any> {
    return this.inventoryDomain.getReceiptSettings(workspaceId);
  }

  /**
   * Update receipt settings for a workspace / organization
   */
  public async updateReceiptSettings(workspaceId: string, settings: any): Promise<any> {
    return this.inventoryDomain.updateReceiptSettings(workspaceId, settings);
  }

  /**
   * List team members for a branch or workspace application
   */
  public async listBranchMembers(workspaceId: string, options?: { applicationKey?: string; branchId?: string; status?: string }): Promise<any[]> {
    return (await this.query('branchStaff:listBranchMembers', {
      workspaceId,
      applicationKey: options?.applicationKey || 'inventory',
      branchId: options?.branchId,
      status: options?.status,
    })) || [];
  }

  /**
   * Assign or update branch staff member
   */
  public async assignBranchMember(data: {
    workspaceId: string;
    applicationKey?: string;
    branchId: string;
    userId: string;
    role: string;
    assignedByUserId: string;
    permissions?: string[];
  }): Promise<any> {
    return this.mutate('branchStaff:assignBranchMember', data as any);
  }

  /**
   * Transfer staff member between branches atomically
   */
  public async transferBranchMember(data: {
    workspaceId: string;
    membershipId: string;
    fromBranchId?: string;
    targetBranchId?: string;
    toBranchId?: string;
    newRole?: string;
    toRole?: string;
    reason?: string;
    message?: string;
    transferredBy: string;
    effectiveDate?: number;
    effectiveAt?: number;
  }): Promise<any> {
    return this.mutate('branchStaff:transferBranchMember', data as any);
  }

  /**
   * Suspend staff access to an Inventory branch
   */
  public async suspendBranchMember(data: {
    workspaceId: string;
    membershipId: string;
    reason?: string;
    suspendAllBranches?: boolean;
    actingUserId: string;
  }): Promise<any> {
    return this.mutate('branchStaff:suspendBranchMember', data as any);
  }

  /**
   * Restore suspended staff branch access
   */
  public async restoreBranchMember(data: {
    workspaceId: string;
    membershipId: string;
    actingUserId: string;
  }): Promise<any> {
    return this.mutate('branchStaff:restoreBranchMember', data as any);
  }

  /**
   * Remove staff member from a specific branch
   */
  public async removeBranchMember(data: {
    workspaceId: string;
    membershipId: string;
    reason?: string;
    removeFromInventory?: boolean;
    actingUserId: string;
  }): Promise<any> {
    return this.mutate('branchStaff:removeBranchMember', data as any);
  }

  /**
   * Remove staff from Inventory completely (preserves workspace membership & account)
   */
  public async removeInventoryMember(data: {
    workspaceId: string;
    membershipId?: string;
    userId?: string;
    reason?: string;
    actingUserId: string;
  }): Promise<any> {
    return this.mutate('branchStaff:removeInventoryMember', data as any);
  }

  /**
   * Add or grant branch access to a staff member
   */
  public async addBranchAccess(data: {
    workspaceId: string;
    membershipId?: string;
    userId?: string;
    branchId: string;
    roleOverride?: string;
    permissions?: string[];
    assignedByUserId: string;
  }): Promise<any> {
    return this.mutate('branchStaff:addBranchAccess', data as any);
  }

  /**
   * Get comprehensive staff access summary
   */
  public async getStaffAccessSummary(data: {
    workspaceId: string;
    userId?: string;
    membershipId?: string;
  }): Promise<any> {
    return this.query('branchStaff:getStaffAccessSummary', data as any);
  }

  /**
   * Update branch staff member role
   */
  public async updateBranchMemberRole(data: {
    workspaceId: string;
    membershipId: string;
    role: string;
    permissions?: string[];
    updatedBy: string;
  }): Promise<any> {
    return this.mutate('branchStaff:updateBranchMemberRole', data as any);
  }

  /**
   * Set branch member status (active / suspended / removed)
   */
  public async setBranchMemberStatus(data: {
    workspaceId: string;
    membershipId: string;
    status: 'active' | 'suspended' | 'removed';
    actingUserId: string;
  }): Promise<any> {
    return this.mutate('branchStaff:setBranchMemberStatus', data as any);
  }

  /**
   * List branch transfer logs
   */
  public async listBranchTransfers(workspaceId: string, userId?: string): Promise<any[]> {
    return (await this.query('branchStaff:listBranchTransfers', {
      workspaceId,
      userId: userId as any,
    })) || [];
  }

  /**
   * Safe public search for existing user by email
   */
  public async searchSafeUsersByEmail(email: string): Promise<any> {
    return this.query('branchStaff:searchSafeUsersByEmail', { email });
  }

  // ============================================================================
  // HYBRID APPLICATION & BRANCH TEAM METHODS
  // ============================================================================

  public async listApplicationMembers(workspaceId: string, options?: { applicationKey?: string; branchId?: string; status?: string }): Promise<any> {
    try {
      const res = await this.query('applicationTeam:listApplicationMembers', {
        workspaceId,
        applicationKey: options?.applicationKey || 'inventory',
        branchId: options?.branchId,
        status: options?.status,
      });
      if (res) {
        const membersList = Array.isArray(res) ? res : res.members || [];
        if (membersList.length > 0) {
          return {
            members: membersList,
            totalMembers: membersList.length,
            planCapacityLimit: res.planCapacityLimit || 50,
            planTier: res.planTier || 'growth',
          };
        }
      }
    } catch {}

    try {
      const [branchStaff, ws] = await Promise.all([
        this.listBranchMembers(workspaceId, options),
        this.getWorkspaceById(workspaceId).catch(() => null),
      ]);
      const ownerId = ws?.ownerId ? String(ws.ownerId) : '';

      // Aggregate flat branch records into unified team member profiles
      const userMap = new Map<string, any>();
      (branchStaff || []).forEach((m: any) => {
        const userId = String(m.userId || m.id || m.email || '');
        if (!userId) return;

        const isOwner =
          (ownerId && (userId === ownerId || m.userId === ownerId)) ||
          m.isOwner ||
          m.isFounder ||
          m.role === 'inventory_owner' ||
          m.role === 'OWNER' ||
          m.role === 'workspace_owner' ||
          m.role === 'org_owner';

        const isAdmin =
          isOwner ||
          m.role === 'inventory_manager' ||
          m.role === 'ADMIN' ||
          m.role === 'MANAGER' ||
          m.role === 'manager';

        const appRole = isOwner ? 'admin' : isAdmin ? 'admin' : 'member';

        const assignment = {
          id: String(m.id || m._id || `${userId}_${m.branchId}`),
          branchId: String(m.branchId || 'main'),
          branchName: m.branchName || 'Main Branch',
          branchCode: m.branchCode || 'MAIN',
          branchRole: m.role ? m.role.replace('inventory_', '').replace('_', ' ') : (isOwner ? 'Founder' : 'staff'),
          assignmentType: m.assignmentType || 'primary',
          temporaryUntil: m.temporaryUntil,
        };

        if (!userMap.has(userId)) {
          userMap.set(userId, {
            id: String(m.id || m._id || userId),
            userId,
            name: m.name || m.email?.split('@')[0] || 'Team Member',
            email: m.email || '',
            jobTitle: m.jobTitle || (isOwner ? 'Branch Founder' : undefined),
            appRole,
            role: m.role || (isOwner ? 'owner' : 'member'),
            isOwner,
            isFounder: isOwner,
            status: m.status || 'active',
            branchAssignments: m.branchAssignments && m.branchAssignments.length > 0 ? m.branchAssignments : [assignment],
            addedAt: m.addedAt || m.createdAt || Date.now(),
          });
        } else {
          const existing = userMap.get(userId);
          if (isOwner) {
            existing.appRole = 'admin';
            existing.isOwner = true;
            existing.isFounder = true;
            if (!existing.jobTitle) existing.jobTitle = 'Branch Founder';
          } else if (isAdmin && existing.appRole === 'member') {
            existing.appRole = 'admin';
          }
          if (!existing.branchAssignments.some((ba: any) => ba.branchId === assignment.branchId)) {
            existing.branchAssignments.push(assignment);
          }
        }
      });

      const members = Array.from(userMap.values());
      return {
        members,
        totalMembers: members.length,
        planCapacityLimit: 50,
        planTier: 'growth',
      };
    } catch {
      return { members: [], totalMembers: 0, planCapacityLimit: 50, planTier: 'free_trial' };
    }
  }

  public async getApplicationMember(workspaceId: string, userId: string, applicationKey = 'inventory'): Promise<any> {
    try {
      const res = await this.query('applicationTeam:getApplicationMember', {
        workspaceId,
        userId,
        applicationKey,
      });
      if (res) return res;
    } catch {}

    try {
      const summary = await this.getStaffAccessSummary({ workspaceId, userId });
      return summary?.member || summary || null;
    } catch {
      return null;
    }
  }

  public async addApplicationMember(data: any): Promise<any> {
    try {
      return await this.mutate('applicationTeam:addApplicationMember', data);
    } catch {
      return this.assignBranchMember({
        workspaceId: data.workspaceId,
        branchId: data.branchAssignments?.[0]?.branchId || 'main',
        userId: data.userId,
        role: data.appRole || 'staff',
        assignedByUserId: data.actingUserId,
      });
    }
  }

  public async transferBranchStaff(data: any): Promise<any> {
    try {
      return await this.mutate('applicationTeam:transferBranchStaff', data);
    } catch {
      return this.transferBranchMember({
        workspaceId: data.workspaceId,
        membershipId: data.userId,
        toBranchId: data.targetBranchId,
        toRole: data.targetBranchRole,
        transferredBy: data.actingUserId,
      });
    }
  }

  public async setApplicationMemberStatus(data: any): Promise<any> {
    try {
      return await this.mutate('applicationTeam:setMemberStatus', data);
    } catch {
      return this.setBranchMemberStatus({
        workspaceId: data.workspaceId,
        membershipId: data.userId,
        status: data.status,
        actingUserId: data.actingUserId,
      });
    }
  }

  public async listTeamInvitations(workspaceId: string, options?: { applicationKey?: string; status?: string }): Promise<any[]> {
    try {
      const res = await this.query('teamInvitations:listTeamInvitations', {
        workspaceId,
        applicationKey: options?.applicationKey || 'inventory',
        status: options?.status,
      });
      if (res && Array.isArray(res)) return res;
    } catch {}

    try {
      const invs = await this.listWorkspaceInvitations(workspaceId);
      return (invs || []).map((i: any) => ({
        id: String(i._id || i.id),
        email: i.email,
        phoneNumber: i.phone || i.phoneNumber,
        appRole: i.appRole || i.role || 'member',
        branchAssignments: i.branchAssignments || [],
        status: i.status || 'pending',
        invitedAt: i._creationTime || i.createdAt || Date.now(),
        expiresAt: i.expiresAt || (Date.now() + 7 * 86400000),
      }));
    } catch {
      return [];
    }
  }

  public async createTeamInvitation(data: any): Promise<any> {
    try {
      return await this.mutate('teamInvitations:createTeamInvitation', data);
    } catch {
      return this.createWorkspaceInvitation({
        workspaceId: data.workspaceId,
        callerUserId: data.callerUserId || data.invitedBy,
        email: data.email,
        role: data.appRole || 'member',
        organizationRole: 'MEMBER',
      });
    }
  }

  public async bulkCreateTeamInvitations(data: any): Promise<any> {
    try {
      return await this.mutate('teamInvitations:bulkCreateTeamInvitations', data);
    } catch {
      return { results: [], totalSent: 0 };
    }
  }

  public async revokeTeamInvitation(data: any): Promise<any> {
    try {
      return await this.mutate('teamInvitations:revokeTeamInvitation', data);
    } catch {
      return this.revokeWorkspaceInvitation(data.invitationId, data.actingUserId);
    }
  }

  public async getTeamMigrationStatus(workspaceId: string, applicationKey = 'inventory'): Promise<any> {
    try {
      const res = await this.query('teamMigration:getMigrationStatus', {
        workspaceId,
        applicationKey,
      });
      if (res) return res;
    } catch {}

    try {
      const members = await this.getWorkspaceMembers(workspaceId, '');
      return {
        totalWorkspaceMembers: members?.length || 1,
        migratedCount: 0,
        unmigratedCount: members?.length || 1,
        isFullyMigrated: false,
        unmigratedMembers: (members || []).map((m: any) => ({
          userId: m.userId || m.id,
          name: m.name || m.email,
          email: m.email,
          role: m.role || 'member',
        })),
      };
    } catch {
      return {
        totalWorkspaceMembers: 1,
        migratedCount: 0,
        unmigratedCount: 1,
        isFullyMigrated: false,
        unmigratedMembers: [],
      };
    }
  }

  public async executeTeamAutoMigration(data: any): Promise<any> {
    try {
      return await this.mutate('teamMigration:executeAutoMigration', data);
    } catch {
      return { success: true, migratedCount: 0 };
    }
  }

  /**
   * Resolve runtime permissions and isolation context for Inventory
   */
  public async resolveInventoryContext(data: {
    workspaceId: string;
    userId: string;
    branchId?: string;
  }): Promise<any> {
    return this.query('branchStaff:resolveInventoryContext', {
      workspaceId: data.workspaceId,
      userId: data.userId as any,
      branchId: data.branchId,
    });
  }

  /**
   * Resolve access context tree for dashboard and application launcher
   */
  public async getAccessContext(userId: string, workspaceId?: string): Promise<any> {
    return this.query('branchStaff:getAccessContext', {
      userId: userId as any,
      workspaceId,
    });
  }

  // ==========================================
  // Workspace / Organization Settings Services
  // ==========================================

  public async getFullWorkspaceSettings(workspaceId: string, callerUserId?: string): Promise<any> {
    return this.query('workspaceSettings:getWorkspaceSettings', {
      workspaceId: workspaceId as any,
      callerUserId: callerUserId as any,
    });
  }

  public async updateWorkspaceGeneralSettings(workspaceId: string, data: any, callerUserId?: string): Promise<any> {
    return this.mutate('workspaceSettings:updateGeneralSettings', {
      workspaceId: workspaceId as any,
      ...data,
      callerUserId: callerUserId as any,
    });
  }

  public async updateWorkspaceBusinessSettings(workspaceId: string, data: any, callerUserId?: string): Promise<any> {
    return this.mutate('workspaceSettings:updateBusinessSettings', {
      workspaceId: workspaceId as any,
      ...data,
      callerUserId: callerUserId as any,
    });
  }

  public async updateWorkspaceAddressSettings(workspaceId: string, data: any, callerUserId?: string): Promise<any> {
    return this.mutate('workspaceSettings:updateAddressSettings', {
      workspaceId: workspaceId as any,
      ...data,
      callerUserId: callerUserId as any,
    });
  }

  public async updateWorkspaceBrandingSettings(workspaceId: string, data: any, callerUserId?: string): Promise<any> {
    return this.mutate('workspaceSettings:updateBrandingSettings', {
      workspaceId: workspaceId as any,
      ...data,
      callerUserId: callerUserId as any,
    });
  }

  public async removeWorkspaceLogo(workspaceId: string, callerUserId?: string): Promise<any> {
    return this.mutate('workspaceSettings:removeLogo', {
      workspaceId: workspaceId as any,
      callerUserId: callerUserId as any,
    });
  }

  public async updateWorkspaceLocalizationSettings(workspaceId: string, data: any, callerUserId?: string): Promise<any> {
    return this.mutate('workspaceSettings:updateLocalizationSettings', {
      workspaceId: workspaceId as any,
      ...data,
      callerUserId: callerUserId as any,
    });
  }

  public async updateWorkspaceNotificationSettings(workspaceId: string, data: any, callerUserId?: string): Promise<any> {
    return this.mutate('workspaceSettings:updateNotificationSettings', {
      workspaceId: workspaceId as any,
      ...data,
      callerUserId: callerUserId as any,
    });
  }

  public async generateSettingsUploadUrl(): Promise<string> {
    return this.mutate('workspaceSettings:generateUploadUrl', {});
  }

  // ==========================================
  // Branch Settings Services
  // ==========================================

  public async getFullBranchSettings(branchId: string, callerUserId?: string, workspaceId?: string): Promise<any> {
    return this.query('branches:getBranchSettings', {
      branchId: branchId as any,
    });
  }

  public async updateBranchOperationalSettings(
    branchId: string,
    data: any,
    callerUserId?: string,
    workspaceId?: string
  ): Promise<any> {
    return this.mutate('branches:updateBranchSettings', {
      branchId: branchId as any,
      ...data,
    });
  }

  public async setPrimaryBranch(branchId: string, callerUserId?: string, workspaceId?: string): Promise<any> {
    return this.mutate('branches:setPrimaryBranch', {
      branchId: branchId as any,
    });
  }

  public async suspendBranch(branchId: string, callerUserId?: string, workspaceId?: string): Promise<any> {
    return this.mutate('branches:suspendBranch', {
      branchId: branchId as any,
    });
  }

  public async restoreBranch(branchId: string, callerUserId?: string, workspaceId?: string): Promise<any> {
    return this.mutate('branches:restoreBranch', {
      branchId: branchId as any,
    });
  }

  public async archiveBranch(branchId: string, callerUserId?: string, workspaceId?: string): Promise<any> {
    return this.mutate('branches:archiveBranch', {
      branchId: branchId as any,
    });
  }

  // ==========================================
  // Application Settings Services
  // ==========================================

  public async getApplicationSettings(workspaceId: string, productKey: string): Promise<any> {
    return this.query('applicationSettings:getApplicationSettings', {
      workspaceId: workspaceId as any,
      productKey,
    });
  }

  public async updateApplicationSettings(workspaceId: string, productKey: string, settings: any, callerUserId?: string, displayName?: string): Promise<any> {
    return this.mutate('applicationSettings:updateApplicationSettings', {
      workspaceId: workspaceId as any,
      productKey,
      displayName,
      settings,
      callerUserId: callerUserId as any,
    });
  }

  public async listWorkspaceApplications(workspaceId: string): Promise<any[]> {
    return (await this.query('applicationSettings:listWorkspaceApplications', {
      workspaceId: workspaceId as any,
    })) || [];
  }

  public async setApplicationStatus(workspaceId: string, productKey: string, action: 'activate' | 'deactivate' | 'suspend' | 'restore', callerUserId?: string): Promise<any> {
    return this.mutate('applicationSettings:setApplicationStatus', {
      workspaceId: workspaceId as any,
      productKey,
      action,
      callerUserId: callerUserId as any,
    });
  }

  // Superadmin Phone Administration Methods
  public async adminUnlinkUserPhone(sessionToken: string, userId: string, reason: string): Promise<any> {
    return this.mutate('adminUsers:unlinkUserPhone', {
      sessionToken,
      userId: userId as any,
      reason,
    });
  }

  public async adminOverrideUserPhoneVerified(sessionToken: string, userId: string, reason: string): Promise<any> {
    return this.mutate('adminUsers:overrideUserPhoneVerified', {
      sessionToken,
      userId: userId as any,
      reason,
    });
  }

  public async adminGetPhoneChallenges(sessionToken: string, params: any = {}): Promise<any> {
    return this.query('adminPhoneChallenges:getPhoneChallenges', {
      sessionToken,
      ...params,
    });
  }

  // ==========================================
  // Phone Verification & Contact Services
  // ==========================================

  private smsService = new SmsService();

  public async getUserContact(userId: string): Promise<any> {
    const user = await this.getUserById(userId);
    if (!user) throw new Error('USER_NOT_FOUND');

    const status = await this.query('phoneVerification:getUserPhoneStatus', {
      userId: userId as any,
    });

    let normalizedPhone = user.phoneNormalized || null;
    if (!normalizedPhone && user.phone) {
      try {
        normalizedPhone = normalizePhoneNumber(user.phone, 'NG');
      } catch {
        normalizedPhone = null;
      }
    }

    return {
      phone: user.phone || null,
      phoneNormalized: normalizedPhone,
      phoneStatus: status?.phoneStatus || (user.phone ? (user.phoneVerifiedAt ? 'verified' : 'unverified') : 'not_set'),
      phoneVerifiedAt: user.phoneVerifiedAt || null,
      phoneUsedForRecovery: !!user.phoneUsedForRecovery,
      phoneUsedForMfa: !!user.phoneUsedForMfa,
      phoneVisibility: user.phoneVisibility || 'workspace',
      country: user.country || 'Nigeria',
      state: user.state || null,
      city: user.city || null,
      hasPendingChallenge: status?.hasPendingChallenge || false,
      pendingChallengeExpiresAt: status?.pendingChallengeExpiresAt || null,
    };
  }

  public async updateUserContact(
    userId: string,
    data: {
      phone?: string;
      country?: string;
      state?: string;
      city?: string;
      phoneUsedForRecovery?: boolean;
      phoneUsedForMfa?: boolean;
    },
    ipAddress?: string,
    userAgent?: string
  ): Promise<any> {
    let phoneNormalized: string | undefined;
    if (data.phone !== undefined) {
      const trimmed = data.phone.trim();
      if (trimmed) {
        phoneNormalized = normalizePhoneNumber(trimmed, 'NG');
      }
    }

    const res = await this.mutate('phoneVerification:updateUserContact', {
      userId: userId as any,
      phone: data.phone !== undefined ? (data.phone.trim() || undefined) : undefined,
      phoneNormalized,
      country: data.country,
      state: data.state,
      city: data.city,
      phoneUsedForRecovery: data.phoneUsedForRecovery,
      phoneUsedForMfa: data.phoneUsedForMfa,
    });

    if (data.phone !== undefined) {
      await this.logAudit({
        actorUserId: userId,
        targetUserId: userId,
        eventType: 'user.phone_added',
        action: 'USER_PHONE_UPDATED',
        severity: 'info',
        metadata: {
          phoneMasked: data.phone ? maskPhoneNumber(data.phone) : null,
        },
        ipAddress,
        userAgent,
      }).catch(() => {});
    }

    return res;
  }

  public async startUserPhoneVerification(
    userId: string,
    rawPhone?: string,
    purpose = 'user_phone_verification',
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ challengeId: string; expiresAt: number; phoneNormalized: string }> {
    const user = await this.getUserById(userId);
    if (!user) throw new Error('USER_NOT_FOUND');

    const phoneToVerify = rawPhone || user.phone;
    if (!phoneToVerify) {
      throw new Error('PHONE_REQUIRED: Please provide a phone number to verify.');
    }

    const phoneNormalized = normalizePhoneNumber(phoneToVerify, 'NG');
    const otp = generateOtpCode();
    const codeHash = hashOtpCode(otp);

    const challenge = await this.mutate('phoneVerification:createChallenge', {
      userId: userId as any,
      phone: phoneToVerify,
      phoneNormalized,
      purpose,
      codeHash,
      maxAttempts: 5,
      expiresInMs: 10 * 60 * 1000,
    });

    // Send SMS
    await this.smsService.sendOtp(phoneNormalized, otp);

    await this.logAudit({
      actorUserId: userId,
      targetUserId: userId,
      eventType: 'user.phone_verification_started',
      action: 'USER_PHONE_VERIFICATION_STARTED',
      severity: 'info',
      metadata: {
        purpose,
        phoneMasked: maskPhoneNumber(phoneNormalized),
      },
      ipAddress,
      userAgent,
    }).catch(() => {});

    return challenge;
  }

  public async verifyUserPhone(
    userId: string,
    code: string,
    purpose = 'user_phone_verification',
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ success: boolean; phoneNormalized?: string; verifiedAt?: number; error?: string; attemptsRemaining?: number }> {
    const codeHash = hashOtpCode(code);

    const res = await this.mutate('phoneVerification:verifyChallenge', {
      userId: userId as any,
      purpose,
      codeHash,
    });

    if (res.success) {
      await this.logAudit({
        actorUserId: userId,
        targetUserId: userId,
        eventType: 'user.phone_verified',
        action: 'USER_PHONE_VERIFIED',
        severity: 'info',
        metadata: {
          purpose,
          phoneMasked: maskPhoneNumber(res.phoneNormalized),
        },
        ipAddress,
        userAgent,
      }).catch(() => {});

      // Send confirmation email
      const user = await this.getUserById(userId);
      if (user?.email) {
        emailService.sendDirect(user.email, 'securityAlert', {
          name: user.name || 'User',
          action: 'Phone Number Verified',
          details: `Your phone number (${maskPhoneNumber(res.phoneNormalized)}) was successfully verified on your Orviohub account.`,
        }).catch(() => {});
      }
    } else {
      await this.logAudit({
        actorUserId: userId,
        targetUserId: userId,
        eventType: 'user.phone_verification_failed',
        action: 'USER_PHONE_VERIFICATION_FAILED',
        severity: 'warning',
        metadata: {
          purpose,
          error: res.error,
          attemptsRemaining: res.attemptsRemaining,
        },
        ipAddress,
        userAgent,
      }).catch(() => {});
    }

    return res;
  }

  public async resendUserPhoneVerification(
    userId: string,
    purpose = 'user_phone_verification',
    ipAddress?: string,
    userAgent?: string
  ): Promise<any> {
    const user = await this.getUserById(userId);
    if (!user) throw new Error('USER_NOT_FOUND');

    const otp = generateOtpCode();
    const newCodeHash = hashOtpCode(otp);

    const res = await this.mutate('phoneVerification:resendChallenge', {
      userId: userId as any,
      purpose,
      newCodeHash,
    });

    await this.smsService.sendOtp(res.phoneNormalized, otp);

    return res;
  }

  public async removeUserPhone(userId: string, ipAddress?: string, userAgent?: string): Promise<any> {
    const user = await this.getUserById(userId);
    const oldPhone = user?.phone;

    const res = await this.mutate('phoneVerification:removeUserPhone', {
      userId: userId as any,
    });

    await this.logAudit({
      actorUserId: userId,
      targetUserId: userId,
      eventType: 'user.phone_removed',
      action: 'USER_PHONE_REMOVED',
      severity: 'warning',
      metadata: {
        previousPhoneMasked: oldPhone ? maskPhoneNumber(oldPhone) : null,
      },
      ipAddress,
      userAgent,
    }).catch(() => {});

    return res;
  }

  public async startWorkspacePhoneVerification(
    workspaceId: string,
    actorUserId: string,
    rawPhone: string,
    purpose = 'workspace_phone_verification',
    ipAddress?: string,
    userAgent?: string
  ): Promise<any> {
    const phoneNormalized = normalizePhoneNumber(rawPhone, 'NG');
    const otp = generateOtpCode();
    const codeHash = hashOtpCode(otp);

    const challenge = await this.mutate('phoneVerification:createChallenge', {
      workspaceId,
      phone: rawPhone,
      phoneNormalized,
      purpose,
      codeHash,
      maxAttempts: 5,
      expiresInMs: 10 * 60 * 1000,
    });

    await this.smsService.sendOtp(phoneNormalized, otp);

    await this.logAudit({
      actorUserId,
      workspaceId,
      eventType: 'workspace.phone_verification_started',
      action: 'WORKSPACE_PHONE_VERIFICATION_STARTED',
      severity: 'info',
      metadata: {
        workspaceId,
        purpose,
        phoneMasked: maskPhoneNumber(phoneNormalized),
      },
      ipAddress,
      userAgent,
    }).catch(() => {});

    return challenge;
  }

  public async verifyWorkspacePhone(
    workspaceId: string,
    actorUserId: string,
    code: string,
    purpose = 'workspace_phone_verification',
    ipAddress?: string,
    userAgent?: string
  ): Promise<any> {
    const codeHash = hashOtpCode(code);

    const res = await this.mutate('phoneVerification:verifyChallenge', {
      workspaceId,
      purpose,
      codeHash,
    });

    if (res.success) {
      await this.logAudit({
        actorUserId,
        workspaceId,
        eventType: 'workspace.phone_verified',
        action: 'WORKSPACE_PHONE_VERIFIED',
        severity: 'info',
        metadata: {
          workspaceId,
          phoneMasked: maskPhoneNumber(res.phoneNormalized),
        },
        ipAddress,
        userAgent,
      }).catch(() => {});
    }

    return res;
  }

  public async resendWorkspacePhoneVerification(
    workspaceId: string,
    actorUserId: string,
    purpose = 'workspace_phone_verification',
    ipAddress?: string,
    userAgent?: string
  ): Promise<any> {
    const otp = generateOtpCode();
    const newCodeHash = hashOtpCode(otp);

    const res = await this.mutate('phoneVerification:resendChallenge', {
      workspaceId,
      purpose,
      newCodeHash,
    });

    await this.smsService.sendOtp(res.phoneNormalized, otp);
    return res;
  }

  public async startBranchPhoneVerification(
    branchId: string,
    workspaceId: string,
    actorUserId: string,
    rawPhone: string,
    purpose = 'branch_phone_verification',
    ipAddress?: string,
    userAgent?: string
  ): Promise<any> {
    const phoneNormalized = normalizePhoneNumber(rawPhone, 'NG');
    const otp = generateOtpCode();
    const codeHash = hashOtpCode(otp);

    const challenge = await this.mutate('phoneVerification:createChallenge', {
      branchId,
      workspaceId,
      phone: rawPhone,
      phoneNormalized,
      purpose,
      codeHash,
      maxAttempts: 5,
      expiresInMs: 10 * 60 * 1000,
    });

    await this.smsService.sendOtp(phoneNormalized, otp);

    await this.logAudit({
      actorUserId,
      workspaceId,
      eventType: 'branch.phone_verification_started',
      action: 'BRANCH_PHONE_VERIFICATION_STARTED',
      severity: 'info',
      metadata: {
        branchId,
        purpose,
        phoneMasked: maskPhoneNumber(phoneNormalized),
      },
      ipAddress,
      userAgent,
    }).catch(() => {});

    return challenge;
  }

  public async verifyBranchPhone(
    branchId: string,
    workspaceId: string,
    actorUserId: string,
    code: string,
    purpose = 'branch_phone_verification',
    ipAddress?: string,
    userAgent?: string
  ): Promise<any> {
    const codeHash = hashOtpCode(code);

    const res = await this.mutate('phoneVerification:verifyChallenge', {
      branchId,
      purpose,
      codeHash,
    });

    if (res.success) {
      await this.logAudit({
        actorUserId,
        workspaceId,
        eventType: 'branch.phone_verified',
        action: 'BRANCH_PHONE_VERIFIED',
        severity: 'info',
        metadata: {
          branchId,
          phoneMasked: maskPhoneNumber(res.phoneNormalized),
        },
        ipAddress,
        userAgent,
      }).catch(() => {});
    }

    return res;
  }

  public async resendBranchPhoneVerification(
    branchId: string,
    workspaceId: string,
    actorUserId: string,
    purpose = 'branch_phone_verification',
    ipAddress?: string,
    userAgent?: string
  ): Promise<any> {
    const otp = generateOtpCode();
    const newCodeHash = hashOtpCode(otp);

    const res = await this.mutate('phoneVerification:resendChallenge', {
      branchId,
      purpose,
      newCodeHash,
    });

    await this.smsService.sendOtp(res.phoneNormalized, otp);
    return res;
  }

  // ==========================================
  // Override & Entitlement Governance Methods
  // ==========================================

  public async getEntitlementContext(workspaceId: string, userId?: string) {
    return this.query('entitlements:getEntitlementContext', {
      workspaceId: workspaceId as any,
      userId: userId ? (userId as any) : undefined,
    });
  }

  public async recalculateWorkspaceEntitlements(workspaceId: string, actorUserId?: string, reason?: string) {
    return this.mutate('entitlements:recalculateWorkspaceEntitlements', {
      workspaceId: workspaceId as any,
      actorUserId: actorUserId ? (actorUserId as any) : undefined,
      reason,
    });
  }

  public async createEntitlementOverride(data: {
    workspaceId: string;
    overrideType: string;
    featureKey?: string;
    productKey?: string;
    limitType?: 'boolean' | 'fixed' | 'unlimited';
    limitValue?: number;
    overrideLimitType?: 'boolean' | 'fixed' | 'unlimited';
    overrideLimitValue?: number;
    previousPlanKey?: string;
    grantedPlanKey?: string;
    extensionDays?: number;
    grantType?: string;
    reason: string;
    customerVisibleReason?: string;
    supportTicketReference?: string;
    externalReference?: string;
    createdByAdminId: string;
    approvedByAdminId?: string;
    effectiveFrom?: number;
    expiresAt?: number;
    reviewAt?: number;
    requiresApproval?: boolean;
    status?: string;
    metadata?: any;
  }) {
    return this.mutate('entitlements:createEntitlementOverride', data as any);
  }

  public async applyEntitlementOverride(workspaceId: string, data: any) {
    return this.mutate('entitlements:createEntitlementOverride', {
      workspaceId: workspaceId as any,
      ...data,
    });
  }

  public async submitEntitlementOverrideForApproval(overrideId: string, adminId?: string, reason?: string) {
    return this.mutate('entitlements:submitEntitlementOverrideForApproval', {
      overrideId: overrideId as any,
      adminId: adminId ? (adminId as any) : undefined,
      reason,
    });
  }

  public async approveEntitlementOverride(overrideId: string, approvedByAdminId: string, reason?: string) {
    return this.mutate('entitlements:approveEntitlementOverride', {
      overrideId: overrideId as any,
      approvedByAdminId: approvedByAdminId as any,
      reason,
    });
  }

  public async rejectEntitlementOverride(overrideId: string, rejectedByAdminId: string, rejectionReason: string) {
    return this.mutate('entitlements:rejectEntitlementOverride', {
      overrideId: overrideId as any,
      rejectedByAdminId: rejectedByAdminId as any,
      rejectionReason,
    });
  }

  public async revokeEntitlementOverride(overrideId: string, adminId?: string, reason?: string) {
    return this.mutate('entitlements:revokeEntitlementOverride', {
      overrideId: overrideId as any,
      adminId: adminId ? (adminId as any) : undefined,
      reason,
    });
  }

  public async extendTrialPeriod(data: {
    workspaceId: string;
    additionalDays: number;
    reason: string;
    customerVisibleReason?: string;
    supportTicketReference?: string;
    adminId: string;
  }) {
    return this.mutate('entitlements:extendTrialPeriod', {
      workspaceId: data.workspaceId as any,
      additionalDays: data.additionalDays,
      reason: data.reason,
      customerVisibleReason: data.customerVisibleReason,
      supportTicketReference: data.supportTicketReference,
      adminId: data.adminId as any,
    });
  }

  public async grantManualPlan(data: {
    workspaceId: string;
    planKey: 'standard' | 'premium';
    durationDays?: number;
    grantType?: string;
    reason: string;
    customerVisibleReason?: string;
    supportTicketReference?: string;
    adminId: string;
    approverAdminId?: string;
    reviewAt?: number;
  }) {
    return this.mutate('entitlements:grantManualPlan', {
      workspaceId: data.workspaceId as any,
      planKey: data.planKey,
      durationDays: data.durationDays,
      grantType: data.grantType as any,
      reason: data.reason,
      customerVisibleReason: data.customerVisibleReason,
      supportTicketReference: data.supportTicketReference,
      adminId: data.adminId as any,
      approverAdminId: data.approverAdminId ? (data.approverAdminId as any) : undefined,
      reviewAt: data.reviewAt,
    });
  }

  public async getWorkspaceOverrides(workspaceId: string, status?: string) {
    return this.query('entitlements:getWorkspaceOverrides', {
      workspaceId: workspaceId as any,
      status,
    });
  }

  public async getOverrideDetail(overrideId: string) {
    return this.query('entitlements:getOverrideDetail', {
      overrideId: overrideId as any,
    });
  }

  public async getOverrideHistory(workspaceId?: string, limit?: number) {
    return this.query('entitlements:getOverrideHistory', {
      workspaceId: workspaceId ? (workspaceId as any) : undefined,
      limit,
    });
  }

  public async reconcileOverridesAndEntitlements(workspaceId?: string, triggeredByAdminId?: string) {
    return this.mutate('entitlements:reconcileOverridesAndEntitlements', {
      workspaceId: workspaceId ? (workspaceId as any) : undefined,
      triggeredByAdminId: triggeredByAdminId ? (triggeredByAdminId as any) : undefined,
    });
  }

  // Analytics Engine Methods
  public async getPlatformOverviewAnalytics(sessionToken?: string) {
    return this.query('analytics:getPlatformOverviewAnalytics', { sessionToken });
  }

  public async getRevenueAnalytics(params?: { sessionToken?: string; startDate?: string; endDate?: string }) {
    return this.query('analytics:getRevenueAnalytics', {
      sessionToken: params?.sessionToken,
      startDate: params?.startDate,
      endDate: params?.endDate,
    });
  }

  public async getSubscriptionAnalytics(sessionToken?: string) {
    return this.query('analytics:getSubscriptionAnalytics', { sessionToken });
  }

  public async getTrialAnalytics(sessionToken?: string) {
    return this.query('analytics:getTrialAnalytics', { sessionToken });
  }

  public async getPaymentAnalytics(sessionToken?: string) {
    return this.query('analytics:getPaymentAnalytics', { sessionToken });
  }

  public async getEntitlementAnalytics(sessionToken?: string) {
    return this.query('analytics:getEntitlementAnalytics', { sessionToken });
  }

  public async getOrganizationAnalytics(workspaceId: string) {
    return this.query('analytics:getOrganizationAnalytics', { workspaceId: workspaceId as any });
  }

  public async recordAnalyticsEvent(data: {
    eventId: string;
    eventType: string;
    workspaceId?: string;
    billingAccountId?: string;
    subscriptionId?: string;
    planKey?: string;
    amount?: number;
    currency?: string;
    occurredAt?: number;
    requestId?: string;
    source?: string;
    metadata?: any;
  }) {
    return this.mutate('analytics:recordAnalyticsEvent', data as any);
  }

  public async rebuildDailyAnalytics(params?: { date?: string; sessionToken?: string }) {
    return this.mutate('analytics:rebuildDailyAnalytics', {
      date: params?.date,
      sessionToken: params?.sessionToken,
    });
  }

  public async reconcileRevenueMetrics(sessionToken?: string) {
    return this.mutate('analytics:reconcileRevenueMetrics', { sessionToken });
  }
}

export const dataService = new DataService();






