import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { anyApi } from 'convex/server';
import { ConvexHttpClient } from 'convex/browser';
import { env } from '../config/env.js';
import { INVITATION_EXPIRY_DAYS, type Role } from '../config/constants.js';
import type { VerifiedSocialProfile } from './oauth.js';
import { totpService } from './totp.js';
import { emailService } from './email.js';

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
  pendingEmail?: string;
  twoFactorEnabled?: boolean;
  twoFactorSecret?: string;
  twoFactorPendingSecret?: string;
  twoFactorBackupCodes?: string[];
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
    emailService.recordSentEmail(to, template, payload);
    // Attempt direct dispatch immediately for sub-second delivery
    void emailService.sendDirect(to, template, payload);

    try {
      await this.mutate('emailOutbox:enqueue', { to, template, payload });
    } catch (err: any) {
      if (env.NODE_ENV !== 'test') {
        console.warn(`[DataService] Email enqueue skipped (ensure 'npx convex dev' is running): ${err.message || err}`);
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
      await this.enqueue(email, 'verification', { name: user.name, url: `${env.APP_URL}/verify-email?token=${token}` });
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

  public async resendVerificationEmail(email: string) {
    const user = await this.getUserByEmail(email);
    if (!user || user.emailVerified) return false;
    const token = crypto.randomBytes(32).toString('hex');
    await this.mutate('users:setVerificationToken', { userId: user.id, token, expiresAt: Date.now() + 86_400_000 });
    await this.enqueue(user.email, 'verification', { name: user.name, url: `${env.APP_URL}/verify-email?token=${token}` });
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
    await this.enqueue(user.email, 'passwordReset', { name: user.name, url: `${env.APP_URL}/reset-password?token=${token}` });
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

  public async revokeSessionById(sessionId: string, userId: string) {
    return this.mutate('sessions:revokeSessionById', { sessionId, userId });
  }

  public async revokeAllOtherSessions(userId: string, exceptSessionId?: string) {
    return this.mutate('sessions:revokeAllOtherSessions', { userId, exceptSessionId });
  }

  public async getUserSessions(userId: string) {
    return (await this.query('sessions:getUserSessions', { userId })) as any[];
  }

  public async getUserIdentities(userId: string) {
    return (await this.query('users:getIdentitiesByUserId', { userId })) as any[];
  }

  public async getIdentitiesByUserId(userId: string) {
    return this.getUserIdentities(userId);
  }

  public async unlinkIdentity(identityId: string, userId: string) {
    return this.mutate('users:unlinkIdentity', { identityId, userId });
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

  public async disconnectIdentity(userId: string, provider: 'google' | 'facebook' | 'password') {
    const identities = await this.getUserIdentities(userId);
    const target = identities.find((i) => i.provider === provider);
    if (!target) {
      const err: Error & { code?: string } = new Error('Identity not found.');
      err.code = 'NOT_FOUND';
      throw err;
    }
    try {
      return await this.unlinkIdentity(target.id, userId);
    } catch (err: any) {
      if (err.message === 'CANNOT_REMOVE_ONLY_LOGIN_METHOD' || err.code === 'CANNOT_REMOVE_ONLY_LOGIN_METHOD') {
        const wrapped: Error & { code?: string } = new Error('Cannot disconnect your only authentication method.');
        wrapped.code = 'CANNOT_REMOVE_ONLY_LOGIN_METHOD';
        throw wrapped;
      }
      throw err;
    }
  }

  public async updateProfile(
    userId: string,
    data: {
      name?: string;
      firstName?: string;
      lastName?: string;
      displayName?: string;
      avatar?: string;
      avatarUrl?: string;
      phone?: string;
      country?: string;
      timezone?: string;
      locale?: string;
    }
  ) {
    const updated = await this.mutate('users:updateUserProfile', { userId, ...data });
    return asUser(updated);
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
    await this.enqueue(email, 'emailChange', { name: user?.name || '', url: `${env.APP_URL}/confirm-email-change?token=${token}` });
    return { success: true };
  }

  public async confirmEmailChange(token: string) {
    const result = await this.mutate('users:confirmEmailChange', { token }) as { userId: string; email: string };
    const user = await this.getUserById(result.userId);
    if (!user) throw new Error('User could not be found.');
    return { user };
  }

  public async handleSocialAuth(profile: VerifiedSocialProfile) {
    const email = profile.email.toLowerCase().trim();
    const identity = await this.query('users:getIdentityByProvider', { provider: profile.provider, providerUserId: profile.providerUserId }) as any;
    if (identity) {
      const user = await this.getUserById(identity.userId);
      if (user) return { user, isNewUser: false };
    }
    const existing = await this.getUserByEmail(email);
    if (existing) {
      if (!profile.emailVerified) {
        const error: Error & { code?: string } = new Error('OAuth provider email is not verified.');
        error.code = 'OAUTH_EMAIL_UNVERIFIED';
        throw error;
      }
      await this.mutate('users:linkSocialIdentity', { userId: existing.id, provider: profile.provider, providerUserId: profile.providerUserId, providerEmail: email });
      return { user: existing, isNewUser: false };
    }
    const id = await this.mutate('users:createSocialUser', { email, name: profile.name.trim(), emailVerified: profile.emailVerified, provider: profile.provider, providerUserId: profile.providerUserId, providerEmail: email });
    const user = await this.getUserById(String(id));
    if (!user) throw new Error('Social user creation did not return a user.');
    return { user, isNewUser: true };
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

  public async deleteUserAccount(userId: string, password?: string) {
    const user = await this.getUserById(userId);
    if (!user) {
      const err: Error & { code?: string } = new Error('User not found.');
      err.code = 'USER_NOT_FOUND';
      throw err;
    }

    if (user.passwordHash) {
      if (!password) {
        const err: Error & { code?: string } = new Error('Password confirmation is required to delete your account.');
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

    await this.mutate('users:deleteUserAccount', { userId });
    return { success: true };
  }

  public async exportUserData(userId: string) {
    return this.query('users:exportUserData', { userId });
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
          url: `${env.APP_URL}/invite/${invite.token}`,
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
      inviteUrl: `${env.APP_URL}/invitations/${token}`,
      token,
      expiresAt,
    };
  }

  public async getInvitationByToken(token: string) { return this.query('invitations:getInvitationByToken', { token }); }
  public async getOrganizationInvitations(organizationId: string, userId: string) { return this.query('invitations:getOrganizationInvitations', { organizationId, userId }); }
  public async acceptInvitation(token: string, userId: string) { return this.mutate('invitations:acceptInvitation', { token, userId }); }

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
      url: `${env.APP_URL}/invite/${token}`,
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
          planId: 'standard',
        });
      } catch {
        // May already be activated
      }
    }

    return workspaceId;
  }

  public async selectWorkspace(workspaceId: string, userId: string, productKey?: string) {
    return this.mutate('workspaces:selectWorkspace', {
      workspaceId: workspaceId as any,
      userId: userId as any,
      productKey,
    });
  }

  public async getWorkspaceContext(workspaceId: string, userId: string) {
    return this.query('workspaces:getWorkspaceContext', {
      workspaceId: workspaceId as any,
      userId: userId as any,
    });
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

    const inviteUrl = `${env.APP_URL}/invitations/${rawToken}`;
    emailService.recordSentEmail(data.email, 'invitation', {
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
    const byHash = await this.query('workspaceMembers:getWorkspaceInvitationByToken', { tokenHash });
    if (byHash) return byHash;
    // Fallback lookup if raw token was passed
    return this.query('workspaceMembers:getWorkspaceInvitationByToken', { tokenHash: token });
  }

  public async acceptWorkspaceInvitation(token: string, userId: string) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    try {
      return await this.mutate('workspaceMembers:acceptWorkspaceInvitation', {
        tokenHash,
        userId: userId as any,
      });
    } catch (err: any) {
      if (err.message?.includes('INVITATION_NOT_FOUND')) {
        // Fallback for unhashed token
        return await this.mutate('workspaceMembers:acceptWorkspaceInvitation', {
          tokenHash: token,
          userId: userId as any,
        });
      }
      throw err;
    }
  }

  public async declineWorkspaceInvitation(token: string, userId?: string) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    return this.mutate('workspaceMembers:declineWorkspaceInvitation', {
      tokenHash,
      userId: userId as any,
    });
  }

  public async resendWorkspaceInvitation(invitationId: string, callerUserId: string) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

    const result = await this.mutate('workspaceMembers:resendWorkspaceInvitation', {
      invitationId: invitationId as any,
      callerUserId: callerUserId as any,
      newTokenHash: tokenHash,
      newExpiresAt: expiresAt,
    });

    const inviteUrl = `${env.APP_URL}/invitations/${rawToken}`;
    emailService.recordSentEmail(result.email, 'invitation', {
      inviterName: result.inviterName || 'A team member',
      organizationName: result.workspaceName || 'Your Workspace',
      url: inviteUrl,
      role: 'Team Member',
    });

    return {
      id: result.id,
      token: rawToken,
      expiresAt,
    };
  }

  public async revokeWorkspaceInvitation(invitationId: string, callerUserId: string) {
    return this.mutate('workspaceMembers:revokeWorkspaceInvitation', {
      invitationId: invitationId as any,
      callerUserId: callerUserId as any,
    });
  }

  public async getBranches(workspaceId: string) {
    return this.query('branches:getBranches', {
      workspaceId: workspaceId as any,
    });
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
    address?: string;
    phone?: string;
  }) {
    return this.mutate('branches:createBranch', {
      workspaceId: data.workspaceId as any,
      name: data.name,
      code: data.code,
      address: data.address,
      phone: data.phone,
    });
  }

  public async updateBranch(branchId: string, updates: {
    name?: string;
    code?: string;
    address?: string;
    phone?: string;
    status?: string;
  }) {
    return this.mutate('branches:updateBranch', {
      branchId: branchId as any,
      ...updates,
    });
  }

  public async getWorkspaceAuditLogs(workspaceId: string, limit?: number) {
    return this.query('workspaces:getWorkspaceAuditLogs', {
      workspaceId: workspaceId as any,
      limit,
    });
  }

  // Schema-Driven Dynamic Onboarding Flow
  public async getOnboardingFlow(userId: string, workspaceId: string, productKey: string) {
    return this.query('onboardingFlows:getOnboardingFlow', {
      userId: userId as any,
      workspaceId: workspaceId as any,
      productKey,
    });
  }

  public async startOnboardingFlow(userId: string, workspaceId: string, productKey: string, initialStep: string, flowVersion?: string) {
    return this.mutate('onboardingFlows:startOnboardingFlow', {
      userId: userId as any,
      workspaceId: workspaceId as any,
      productKey,
      initialStep,
      flowVersion,
    });
  }

  public async updateStepProgress(flowId: string, currentStep: string, stepData?: any) {
    return this.mutate('onboardingFlows:updateStepProgress', {
      flowId: flowId as any,
      currentStep,
      stepData,
    });
  }

  public async completeOnboardingStep(flowId: string, completedStepKey: string, nextStepKey: string, stepData?: any) {
    return this.mutate('onboardingFlows:completeStep', {
      flowId: flowId as any,
      completedStepKey,
      nextStepKey,
      stepData,
    });
  }

  public async skipOnboardingStep(flowId: string, skippedStepKey: string, nextStepKey: string) {
    return this.mutate('onboardingFlows:skipStep', {
      flowId: flowId as any,
      skippedStepKey,
      nextStepKey,
    });
  }

  public async completeOnboardingFlow(flowId: string, finalData?: any) {
    return this.mutate('onboardingFlows:completeFlow', {
      flowId: flowId as any,
      finalData,
    });
  }

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
      avatar?: string;
      avatarUrl?: string;
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
    const identities = (await this.query('users:getUserIdentities', { userId: userId as any })) || [];
    return identities;
  }

  public async unlinkIdentity(identityId: string, userId: string) {
    return this.mutate('users:unlinkIdentity', {
      identityId: identityId as any,
      userId: userId as any,
    });
  }

  public async getUserPreferences(userId: string) {
    return this.query('userProfile:getUserPreferences', { userId: userId as any });
  }

  public async updateUserPreferences(userId: string, prefs: Record<string, any>) {
    return this.mutate('userProfile:updateUserPreferences', {
      userId: userId as any,
      ...prefs,
    });
  }

  public async getUserSecurityActivity(
    userId: string,
    options?: { limit?: number; eventType?: string }
  ) {
    return this.query('userProfile:getUserActivityLogs', {
      userId: userId as any,
      limit: options?.limit,
      eventType: options?.eventType,
    });
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

    const exportPayload = {
      exportedAt: new Date().toISOString(),
      personalProfile: {
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
      },
      preferences,
      sessions: sessions.map((s: any) => ({
        deviceName: s.deviceName,
        browser: s.browser,
        ipAddressMasked: s.ipAddress ? s.ipAddress.replace(/\.\d+$/, '.***') : undefined,
        lastActiveAt: s.lastActiveAt,
        createdAt: s.createdAt,
      })),
      linkedIdentities: identities.map((id: any) => ({
        provider: id.provider,
        providerEmail: id.providerEmail,
        createdAt: id.createdAt,
      })),
      workspaceMemberships: workspaces.map((w: any) => ({
        workspaceId: w.workspaceId,
        workspaceName: w.workspace?.name,
        role: w.role,
        joinedAt: w.joinedAt,
      })),
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
}

export const dataService = new DataService();
