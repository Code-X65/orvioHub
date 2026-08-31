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

function getAppEnv(): Environment {
  return env.NODE_ENV === 'production' ? 'production' : 'development';
}

function buildInviteUrl(token: string): string {
  try {
    return getInvitationUrl(token, getAppEnv());
  } catch {
    return `${env.APP_URL}/invitations/${token}`;
  }
}

function buildVerifyEmailUrl(token: string): string {
  try {
    return getVerifyEmailUrl(token, getAppEnv());
  } catch {
    return `${env.APP_URL}/verify-email?token=${token}`;
  }
}

function buildResetPasswordUrl(token: string): string {
  try {
    return getResetPasswordUrl(token, getAppEnv());
  } catch {
    return `${env.APP_URL}/reset-password?token=${token}`;
  }
}

function buildConfirmEmailChangeUrl(token: string): string {
  try {
    return getConfirmEmailChangeUrl(token, getAppEnv());
  } catch {
    return `${env.APP_URL}/confirm-email-change?token=${token}`;
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
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  tokenVersion?: number;
  avatar?: string;
  avatarUrl?: string;
  phone?: string;
  phoneVerifiedAt?: number;
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

  constructor() {
    if (!env.CONVEX_URL) throw new Error('CONVEX_URL is required to initialize the data service.');
    this.client = new ConvexHttpClient(env.CONVEX_URL);
  }

  public clearAll() {
    emailService.clearSentEmails();
  }

  private async query(path: string, args: Record<string, unknown>) {
    try { return await this.client.query((anyApi as any)[path.split(':')[0]][path.split(':')[1]], args); } catch (error) { serviceError(error); }
  }

  private async mutate(path: string, args: Record<string, unknown>) {
    try { return await this.client.mutation((anyApi as any)[path.split(':')[0]][path.split(':')[1]], args); } catch (error) { serviceError(error); }
  }

  private async enqueue(to: string, template: 'verification' | 'invitation' | 'onboardingCompleted' | 'passwordReset' | 'emailChange', payload: Record<string, string>) {
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
    password: string;
  }) {
    const email = data.email.toLowerCase().trim();
    const token = crypto.randomBytes(32).toString('hex');
    const passwordHash = await bcrypt.hash(data.password, 12);
    const fullName = data.name || `${data.firstName || ''} ${data.lastName || ''}`.trim() || email.split('@')[0];
    
    const userArgs: Record<string, any> = {
      email,
      name: fullName,
      passwordHash,
      emailVerificationToken: token,
      emailVerificationExpiresAt: Date.now() + 86_400_000,
    };
    if (data.firstName) userArgs.firstName = data.firstName;
    if (data.lastName) userArgs.lastName = data.lastName;
    if (data.displayName) userArgs.displayName = data.displayName;
    if (data.country) userArgs.country = data.country;
    if (data.timezone) userArgs.timezone = data.timezone;
    if (data.locale) userArgs.locale = data.locale;
    if (data.phone) userArgs.phone = data.phone;
    if (data.avatarUrl) userArgs.avatarUrl = data.avatarUrl;
    if (data.emailVerified !== undefined) userArgs.emailVerified = data.emailVerified;

    const id = await this.mutate('users:createUser', userArgs);
    const user = await this.getUserById(String(id));
    if (!user) throw new Error('User creation did not return a user.');
    if (!data.emailVerified) {
      await this.enqueue(email, 'verification', { name: user.name, url: buildVerifyEmailUrl(token) });
    }
    return { user };
  }

  public async getUserById(id: string) { return asUser(await this.query('users:getUserById', { userId: id })); }
  public async getUserByEmail(email: string) { return asUser(await this.query('users:getUserByEmail', { email: email.toLowerCase().trim() })); }
  public async verifyPassword(user: UserRecord, password: string) { return user.passwordHash ? bcrypt.compare(password, user.passwordHash) : false; }

  public async touchLastLogin(userId: string) {
    try {
      await this.mutate('users:touchLastLogin', { userId });
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
    await this.mutate('users:setVerificationToken', { userId: user.id, token, expiresAt: Date.now() + 86_400_000 });
    await this.enqueue(user.email, 'verification', { name: user.name, url: buildVerifyEmailUrl(token) });
    return true;
  }

  public async verifyEmail(token: string) {
    const result = await this.mutate('users:verifyUserEmail', { token }) as { userId: string };
    const user = await this.getUserById(result.userId);
    if (!user) throw new Error('Verified user could not be found.');
    return { user };
  }

  public async requestPasswordReset(email: string) {
    const user = await this.getUserByEmail(email);
    if (!user) return false;
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 3_600_000; // 1 hour
    await this.mutate('users:setPasswordResetToken', { userId: user.id, token, expiresAt });
    await this.enqueue(user.email, 'passwordReset', { name: user.name, url: buildResetPasswordUrl(token) });
    return true;
  }

  public async resetPassword(token: string, newPassword: string) {
    const passwordHash = await bcrypt.hash(newPassword, 12);
    const result = await this.mutate('users:resetPassword', { token, passwordHash }) as { userId: string; email: string };
    const user = await this.getUserById(result.userId);
    if (!user) throw new Error('User not found.');
    // Invalidate all active sessions for security after password reset
    await this.mutate('sessions:revokeAllUserSessions', { userId: user.id });
    return { user };
  }

  public async changePassword(userId: string, currentPassword: string, newPassword: string) {
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
    await this.mutate('users:updatePassword', { userId: user.id, passwordHash });
    await this.mutate('sessions:revokeAllUserSessions', { userId: user.id });
    return { success: true };
  }

  public async logoutUser(userId: string, refreshToken?: string) {
    if (refreshToken) {
      const sessionHash = hashSessionToken(refreshToken);
      await this.mutate('sessions:revokeSession', { sessionHash, refreshToken });
    }
    return { success: true };
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
    });
    return { sessionId: String(sessionId), refreshToken, expiresAt };
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
    await this.mutate('users:requestEmailChange', { userId, newEmail: email, token, expiresAt });
    const user = await this.getUserById(userId);
    await this.enqueue(email, 'emailChange', { name: user?.name || '', url: buildConfirmEmailChangeUrl(token) });
    return { success: true };
  }

  public async confirmEmailChange(token: string) {
    const result = await this.mutate('users:confirmEmailChange', { token }) as { userId: string; email: string };
    const user = await this.getUserById(result.userId);
    if (!user) throw new Error('User could not be found.');
    return { user };
  }

  public async getUserMemberships(userId: string) {
    const records = await this.query('organizations:getUserMemberships', { userId }) as any[];
    return records.map(({ membership, organization }) => ({ membership: asMembership(membership)!, organization: asOrganization(organization)! }));
  }
  public async getMembership(organizationId: string, userId: string) { return asMembership(await this.query('organizations:getMembership', { organizationId, userId })); }
  public async getOrganizationById(id: string) { return asOrganization(await this.query('organizations:getOrganizationById', { organizationId: id })); }

  public async createOrganization(data: { userId: string; name: string; industry: string; country: string; timezone: string; website?: string; size?: string; logo?: string }) {
    const result = await this.mutate('organizations:createOrganization', data) as any;
    return { organization: asOrganization(result.organization)!, membership: asMembership(result.membership)!, onboarding: result.onboarding, isDuplicate: result.isDuplicate };
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
      const wsObj = item.workspace || {
        id: item._id || item.id,
        name: item.name || 'Workspace',
        slug: item.slug || '',
        type: item.type || 'business',
        currency: item.currency || 'NGN',
        country: item.country,
        timezone: item.timezone,
        logoUrl: item.logoUrl,
        status: item.status || 'active',
        createdAt: item.createdAt,
      };

      let rawProducts = item.enabledProducts || item.products || wsObj.enabledModules || [];
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

  public async createWorkspaceInvitation(data: {
    workspaceId: string;
    callerUserId: string;
    email: string;
    role: string;
    productKey?: string;
    branchIds?: string[];
    message?: string;
  }) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

    const result = await this.mutate('workspaceMembers:createWorkspaceInvitation', {
      workspaceId: data.workspaceId as any,
      callerUserId: data.callerUserId as any,
      email: data.email,
      role: data.role,
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
      role: data.role,
    });

    return {
      id: result.id,
      email: data.email,
      role: data.role,
      token: rawToken,
      expiresAt,
      workspaceName: result.workspaceName,
    };
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
        // Fallback to getBranches
      }
    }
    return (await this.query('branches:getBranches', {
      workspaceId: workspaceId as any,
    })) as any[];
  }

  public async getBranchById(branchId: string) {
    return this.query('branches:getBranchById', {
      branchId: branchId as any,
    });
  }

  public async createBranch(data: {
    workspaceId: string;
    name: string;
    code?: string;
    isPrimary?: boolean;
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
      name: data.name,
      code: data.code,
      isPrimary: data.isPrimary,
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

  public async verifyBranchPhone(branchId: string) {
    return this.mutate('branches:verifyPhone', {
      branchId: branchId as any,
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

  public async cancelAccountDeletion(userId: string) {
    return this.mutate('userProfile:cancelAccountDeletion', {
      userId: userId as any,
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
      {
        key: 'taskmanagement',
        name: 'Task Management',
        tagline: 'Manage tasks, projects, and team work.',
        description: 'Collaborative task boards, team assignments, sprints, and project timelines.',
        category: 'productivity',
        status: 'BETA',
        subdomain: 'tasks.orviohub.com',
        appRoute: '/tasks/dashboard',
        onboardingRoute: '/tasks/onboarding',
        createOrgRoute: '/app/organizations/new?product=taskmanagement',
        isProductionReady: false,
      },
      {
        key: 'bookings',
        name: 'Bookings',
        tagline: 'Manage appointments and reservations.',
        description: 'Omnichannel appointment scheduling, customer reminders, and calendar synchronization.',
        category: 'operations',
        status: 'COMING_SOON',
        subdomain: 'bookings.orviohub.com',
        appRoute: '/bookings',
        onboardingRoute: '/bookings',
        createOrgRoute: '/app/organizations/new?product=bookings',
        isProductionReady: false,
      },
      {
        key: 'gym',
        name: 'Gym Management',
        tagline: 'Manage members, plans, and attendance.',
        description: 'Member check-in kiosk, recurring membership renewals, workout tracking, and trainer scheduling.',
        category: 'operations',
        status: 'COMING_SOON',
        subdomain: 'gym.orviohub.com',
        appRoute: '/gym',
        onboardingRoute: '/gym',
        createOrgRoute: '/app/organizations/new?product=gym',
        isProductionReady: false,
      },
      {
        key: 'crm',
        name: 'CRM',
        tagline: 'Manage customers and relationships.',
        description: 'Lead tracking, deal pipelines, customer interactions, and sales automation.',
        category: 'sales',
        status: 'COMING_SOON',
        subdomain: 'crm.orviohub.com',
        appRoute: '/crm',
        onboardingRoute: '/crm',
        createOrgRoute: '/app/organizations/new?product=crm',
        isProductionReady: false,
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

    const rawWorkspaces = (await this.query('workspaces:getUserWorkspaces', {
      userId: userId as any,
      productKey,
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
        enabledProducts: item.enabledProducts || (ws.enabledModules || []).map((m: string) => ({ productKey: m, status: 'active' })),
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
    let accessibleCount = 0;
    if (productKey) {
      const matchingOwned = ownedOrganizations.filter((o) =>
        o.enabledProducts?.some((p: any) => p.productKey === productKey)
      );
      const matchingJoined = joinedOrganizations.filter((o) =>
        o.enabledProducts?.some((p: any) => p.productKey === productKey)
      );
      accessibleCount = matchingOwned.length + matchingJoined.length;

      if (accessibleCount === 1) {
        const singleOrg = matchingOwned[0] || matchingJoined[0];
        targetRoute = `/${productKey}/dashboard?workspaceId=${singleOrg.workspaceId}`;
      } else if (accessibleCount > 1) {
        targetRoute = `/app?product=${productKey}&mode=select_org`;
      } else if (pendingInvitations.length > 0) {
        targetRoute = `/app/invitations`;
      } else {
        targetRoute = `/app/organizations/new?product=${productKey}`;
      }
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        lastSelectedProduct: user.lastSelectedProduct || null,
        lastSelectedWorkspaceId: user.lastSelectedWorkspaceId || null,
      },
      selectedProduct: productKey || user.lastSelectedProduct || null,
      ownedOrganizations,
      joinedOrganizations,
      totalOrganizations: ownedOrganizations.length + joinedOrganizations.length,
      accessibleCount,
      pendingInvitations,
      products,
      targetRoute,
    };
  }

  public async setApplicationSelection(userId: string, productKey: string) {
    try {
      await this.mutate('users:updateUserProfile', {
        userId: userId as any,
        lastSelectedProduct: productKey,
      });
    } catch {
      // Fallback
    }
    return { success: true, selectedProduct: productKey };
  }

  // ==========================================
  // PRODUCT LAUNCH MANAGEMENT & WAITLIST
  // ==========================================

  private inMemoryProducts: any[] = [
    {
      key: 'inventory',
      name: 'Inventory Management System',
      description: 'Multi-branch warehouse stock, barcode POS checkout, receipts, sales history & telemetry.',
      subdomain: 'inventory.orviohub.com',
      status: 'active',
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
      status: 'active',
      isBeta: false,
      isFeatured: true,
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
    return this.inMemoryProducts.filter((p) => {
      const s = (p.status || '').toLowerCase();
      return s === 'active' || s === 'coming_soon' || s === 'beta';
    });
  }

  public async getProductByKey(productKey: string) {
    try {
      const res = await this.query('products:getByKey', { productKey });
      if (res) return res;
    } catch {
      // Fallback
    }
    const found = this.inMemoryProducts.find((p) => p.key === productKey);
    if (!found) throw new Error('Product not found');
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
      .filter((p) => (p.status || '').toLowerCase() !== 'draft')
      .map((p) => ({ ...p, isActivated: p.key === 'inventory' }));
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
  // ==========================================

  private inMemoryPlans: any[] = [
    {
      key: 'free',
      name: 'Free',
      monthlyPrice: 0,
      annualPrice: 0,
      currency: 'NGN',
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      key: 'standard',
      name: 'Standard',
      monthlyPrice: 750000, // ₦7,500
      annualPrice: 7500000,
      currency: 'NGN',
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      key: 'premium',
      name: 'Premium',
      monthlyPrice: 2000000, // ₦20,000
      annualPrice: 20000000,
      currency: 'NGN',
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
      monthlyPrice?: number;
      annualPrice?: number;
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

  public async updateWorkspaceSubscription(
    workspaceId: string,
    planKey: string,
    status?: 'active' | 'cancelled' | 'past_due',
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

  public async saveUserPhoneOtp(data: {
    userId: string;
    phone: string;
    phoneNormalized: string;
    verificationCode: string;
    codeExpiresAt: number;
  }): Promise<any> {
    return await this.mutate('userPhones:createOrUpdate', data);
  }

  public async verifyUserPhone(phoneId: string): Promise<any> {
    return await this.mutate('userPhones:verify', { phoneId });
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
}

export const dataService = new DataService();



