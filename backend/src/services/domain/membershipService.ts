import { ConvexHttpClient } from 'convex/browser';
import { BaseRepository } from '../../repositories/baseRepository.js';
import { OrganizationRepository } from '../../repositories/organizationRepository.js';
import { AuditNotificationRepository } from '../../repositories/auditNotificationRepository.js';
import { entitlementService } from '../entitlementService.js';
import { AUDIT_EVENTS, ERROR_CODES, type Role } from '../../config/constants.js';

export interface InviteMemberParams {
  organizationId: string;
  email: string;
  role: Role;
  allowedApplications?: string[];
  allowedBranches?: string[];
  primaryBranchId?: string;
  invitedBy: string;
}

export interface UpdateMemberRoleParams {
  organizationId: string;
  targetUserId: string;
  newRole: Role;
  actingUserId: string;
}

export interface UpdatePermissionsParams {
  organizationId: string;
  targetUserId: string;
  allowedApplications?: string[];
  allowedBranches?: string[];
  primaryBranchId?: string;
  actingUserId: string;
}

/**
 * Domain Service: MembershipService
 * Encapsulates team invitations, membership role invariants, and application/branch RBAC permissions.
 */
export class MembershipService extends BaseRepository {
  constructor(
    client?: ConvexHttpClient,
    private readonly orgRepo?: OrganizationRepository,
    private readonly auditRepo?: AuditNotificationRepository
  ) {
    super(client);
  }

  /**
   * Invite a new team member, verifying seat limit quotas and role invariants
   */
  public async inviteMember(params: InviteMemberParams): Promise<any> {
    const { organizationId, email, role, invitedBy } = params;

    // 1. Quota check: Ensure organization has available member seats
    const usage = await entitlementService.getOrganizationUsageSummary(organizationId, invitedBy);
    if (usage && usage.metrics.members.isReached) {
      const err: any = new Error('Member seat limit reached for organization.');
      err.code = ERROR_CODES.PLAN_LIMIT_REACHED;
      err.statusCode = 403;
      err.details = usage.metrics.members;
      throw err;
    }

    // 2. Delegate invitation creation
    let invitation: any;
    if (this.orgRepo) {
      const invites = await this.orgRepo.createInvitations(
        organizationId,
        invitedBy,
        [{ email, role, allowedApplications: params.allowedApplications, allowedBranches: params.allowedBranches, primaryBranchId: params.primaryBranchId }]
      );
      invitation = invites[0];
    } else {
      invitation = await this.mutate('invitations:create', {
        organizationId: organizationId as any,
        email: email.toLowerCase().trim(),
        role,
        invitedBy: invitedBy as any,
        allowedApplications: params.allowedApplications,
        allowedBranches: params.allowedBranches,
        primaryBranchId: params.primaryBranchId as any,
      });
    }

    // 3. Audit log
    if (this.auditRepo) {
      await this.auditRepo.logAudit({
        organizationId,
        actorUserId: invitedBy,
        eventType: AUDIT_EVENTS.WORKSPACE_MEMBER_INVITED,
        resource: 'invitations',
        entityId: invitation?.id || invitation?._id || email,
        metadata: { email, role },
      }).catch(() => {});
    }

    return invitation;
  }

  /**
   * Update member role with last-owner protection invariant
   */
  public async updateMemberRole(params: UpdateMemberRoleParams): Promise<any> {
    const { organizationId, targetUserId, newRole, actingUserId } = params;

    // Invariant rule: If demoting an OWNER, verify there is at least one other active OWNER
    if (newRole !== 'OWNER') {
      const members: any[] = (await this.query('organizations:getMembers', { organizationId: organizationId as any })) || [];
      const activeOwners = members.filter(
        (m: any) => m.role === 'OWNER' && (m.status || 'ACTIVE').toUpperCase() === 'ACTIVE'
      );

      const isCurrentTargetOwner = activeOwners.some((m: any) => m.userId === targetUserId);
      if (isCurrentTargetOwner && activeOwners.length <= 1) {
        const err: any = new Error('Cannot demote the only owner of this organization.');
        err.code = 'CANNOT_DEMOTE_LAST_OWNER';
        err.statusCode = 400;
        throw err;
      }
    }

    const updated = await this.mutate('organizations:updateMemberRole', {
      organizationId: organizationId as any,
      targetUserId: targetUserId as any,
      role: newRole,
    });

    if (this.auditRepo) {
      await this.auditRepo.logAudit({
        organizationId,
        actorUserId: actingUserId,
        eventType: AUDIT_EVENTS.WORKSPACE_MEMBER_ROLE_CHANGED,
        resource: 'organizationMemberships',
        entityId: targetUserId,
        metadata: { targetUserId, newRole },
      }).catch(() => {});
    }

    return updated;
  }

  /**
   * Remove member from organization with last-owner protection invariant
   */
  public async removeMember(organizationId: string, targetUserId: string, actingUserId: string): Promise<any> {
    const members: any[] = (await this.query('organizations:getMembers', { organizationId: organizationId as any })) || [];
    const activeOwners = members.filter(
      (m: any) => m.role === 'OWNER' && (m.status || 'ACTIVE').toUpperCase() === 'ACTIVE'
    );

    const isTargetOwner = activeOwners.some((m: any) => m.userId === targetUserId);
    if (isTargetOwner && activeOwners.length <= 1) {
      const err: any = new Error('Cannot remove the only owner of this organization.');
      err.code = 'CANNOT_REMOVE_LAST_OWNER';
      err.statusCode = 400;
      throw err;
    }

    const result = await this.mutate('organizations:removeMember', {
      organizationId: organizationId as any,
      targetUserId: targetUserId as any,
    });

    if (this.auditRepo) {
      await this.auditRepo.logAudit({
        organizationId,
        actorUserId: actingUserId,
        eventType: AUDIT_EVENTS.WORKSPACE_MEMBER_REMOVED,
        resource: 'organizationMemberships',
        entityId: targetUserId,
        metadata: { targetUserId },
      }).catch(() => {});
    }

    return result;
  }

  /**
   * Update granular application and branch permissions
   */
  public async updateMemberPermissions(params: UpdatePermissionsParams): Promise<any> {
    const { organizationId, targetUserId, allowedApplications, allowedBranches, primaryBranchId, actingUserId } = params;

    let result: any;
    if (this.orgRepo) {
      result = await this.orgRepo.updateMemberAppPermissions({
        organizationId,
        callerUserId: actingUserId,
        targetUserId,
        allowedApplications,
        allowedBranches,
        primaryBranchId,
      });
    } else {
      result = await this.mutate('applications:updateMemberAppPermissions', {
        organizationId: organizationId as any,
        targetUserId: targetUserId as any,
        allowedApplications,
        allowedBranches: allowedBranches as any,
        primaryBranchId: primaryBranchId as any,
      });
    }

    if (this.auditRepo) {
      await this.auditRepo.logAudit({
        organizationId,
        actorUserId: actingUserId,
        eventType: 'organization.member_permissions_updated',
        resource: 'organizationMemberships',
        entityId: targetUserId,
        metadata: { allowedApplications, allowedBranches, primaryBranchId },
      }).catch(() => {});
    }

    return result;
  }

  /**
   * Check if a member has access to an application
   */
  public async checkAppAccess(organizationId: string, userId: string, applicationKey: string): Promise<{ allowed: boolean; role: string; reason?: string }> {
    if (this.orgRepo) {
      return await this.orgRepo.checkUserAppAccess(organizationId, userId, applicationKey);
    }
    return (await this.query('applications:checkUserAppAccess', {
      organizationId: organizationId as any,
      userId: userId as any,
      applicationKey,
    })) as any;
  }

  /**
   * Check if a member has access to a branch
   */
  public async checkBranchAccess(organizationId: string, userId: string, branchId: string): Promise<{ allowed: boolean; role: string; reason?: string }> {
    if (this.orgRepo) {
      return await this.orgRepo.checkUserBranchAccess(organizationId, userId, branchId);
    }
    return (await this.query('applications:checkUserBranchAccess', {
      organizationId: organizationId as any,
      userId: userId as any,
      branchId: branchId as any,
    })) as any;
  }
}

export const membershipService = new MembershipService();
