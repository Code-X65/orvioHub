import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { BaseRepository } from './baseRepository.js';
import { INVITATION_EXPIRY_DAYS, type Role } from '../config/constants.js';
import { getInvitationUrl, type Environment } from '@orviohub/shared';
import { env } from '../config/env.js';
import type { AuditNotificationRepository } from './auditNotificationRepository.js';

export interface OrganizationRecord {
  id: string;
  name: string;
  slug: string;
  industry: string;
  country: string;
  timezone: string;
  website?: string;
  size?: string;
  logo?: string;
  createdAt: number;
  updatedAt: number;
}

export interface OrganizationMembershipRecord {
  id: string;
  organizationId: string;
  userId: string;
  role: Role;
  status: 'ACTIVE' | 'INACTIVE' | 'INVITED';
  joinedAt: number;
  updatedAt: number;
}

export function asOrganization(value: any): OrganizationRecord | null {
  return value ? { ...value, id: value._id } : null;
}

export function asMembership(value: any): OrganizationMembershipRecord | null {
  return value ? { ...value, id: value._id } : null;
}

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

export class OrganizationRepository extends BaseRepository {
  private auditRepo?: AuditNotificationRepository;

  public setAuditRepo(auditRepo: AuditNotificationRepository) {
    this.auditRepo = auditRepo;
  }

  public async getUserMemberships(userId: string) {
    const records = (await this.query('organizations:getUserMemberships', { userId })) as any[];
    return records.map(({ membership, organization }) => ({
      membership: asMembership(membership)!,
      organization: asOrganization(organization)!,
    }));
  }

  public async getMembership(organizationId: string, userId: string) {
    return asMembership(await this.query('organizations:getMembership', { organizationId, userId }));
  }

  public async getOrganizationById(id: string) {
    return asOrganization(await this.query('organizations:getOrganizationById', { organizationId: id }));
  }

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
    const result = (await this.mutate('organizations:createOrganization', data)) as any;
    return {
      organization: asOrganization(result.organization)!,
      membership: asMembership(result.membership)!,
      onboarding: result.onboarding,
      isDuplicate: result.isDuplicate,
    };
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

  public async getUserAppPermissions(organizationId: string, userId: string) {
    try {
      return await this.query('organizations:getUserAppPermissions', {
        organizationId: organizationId as any,
        userId: userId as any,
      });
    } catch {
      return {
        role: 'MEMBER',
        isFullAdmin: false,
        allowedApplications: [],
        allowedBranches: [],
        primaryBranchId: null,
      };
    }
  }

  public async checkUserAppAccess(organizationId: string, userId: string, applicationKey: string) {
    try {
      return await this.query('organizations:checkUserAppAccess', {
        organizationId: organizationId as any,
        userId: userId as any,
        applicationKey,
      });
    } catch {
      return { allowed: true, role: 'MEMBER', isFullAdmin: false };
    }
  }

  public async checkUserBranchAccess(organizationId: string, userId: string, branchId: string) {
    try {
      return await this.query('organizations:checkUserBranchAccess', {
        organizationId: organizationId as any,
        userId: userId as any,
        branchId: branchId as any,
      });
    } catch {
      return { allowed: true, role: 'MEMBER', isFullAdmin: false };
    }
  }

  public async updateMemberAppPermissions(data: {
    organizationId: string;
    callerUserId: string;
    targetUserId: string;
    allowedApplications?: string[];
    allowedBranches?: string[];
    primaryBranchId?: string;
  }) {
    return await this.mutate('organizations:updateMemberAppPermissions', data as any);
  }

  public async updateOrganization(organizationId: string, userId: string, updates: Record<string, unknown>) {
    return asOrganization(
      await this.mutate('organizations:updateOrganization', { organizationId, userId, ...updates })
    );
  }

  public async leaveOrganization(organizationId: string, userId: string) {
    return this.mutate('organizations:leaveOrganization', { organizationId, userId });
  }

  public async deleteOrganization(organizationId: string, userId: string) {
    return this.mutate('organizations:deleteOrganization', { organizationId, userId });
  }

  public async createInvitations(
    organizationId: string,
    userId: string,
    invitations: Array<{
      email: string;
      role: Role;
      allowedApplications?: string[];
      allowedBranches?: string[];
      primaryBranchId?: string;
    }>,
    inviterName?: string
  ) {
    const organization = await this.getOrganizationById(organizationId);
    const expiresAt = Date.now() + INVITATION_EXPIRY_DAYS * 86_400_000;
    const payload = invitations.map((invite) => ({
      ...invite,
      email: invite.email.toLowerCase().trim(),
      token: crypto.randomBytes(32).toString('hex'),
      expiresAt,
    }));
    const created = (await this.mutate('invitations:createInvitations', {
      organizationId,
      userId,
      invitations: payload,
    })) as any[];

    if (this.auditRepo) {
      await Promise.all(
        created.map((invite) =>
          this.auditRepo!.enqueue(invite.email, 'invitation', {
            organizationName: organization?.name || 'your organization',
            inviterName: inviterName || 'A teammate',
            role: invite.role,
            url: buildInviteUrl(invite.token),
          })
        )
      );
    }
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

  public async getInvitationByToken(token: string) {
    return this.query('invitations:getInvitationByToken', { token });
  }

  public async getOrganizationInvitations(organizationId: string, userId: string) {
    return this.query('invitations:getOrganizationInvitations', { organizationId, userId });
  }

  public async acceptInvitation(token: string, userId: string) {
    const invite: any = await this.getInvitationByToken(token);
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

    if (this.auditRepo) {
      await this.auditRepo.enqueue(result.email, 'invitation', {
        organizationName: result.organizationName,
        inviterName: result.inviterName,
        role: result.role,
        url: buildInviteUrl(token),
      });
    }

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
      ...query,
    });
  }
}
