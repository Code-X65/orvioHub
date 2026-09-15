import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { dataService } from '../services/dataService.js';
import { ERROR_CODES, AUDIT_EVENTS } from '../config/constants.js';
import { INVENTORY_ROLE_PERMISSIONS, type InventoryRole } from '../config/inventoryRbac.js';


const inviteBranchMemberSchema = z.object({
  email: z.string().email('Valid email address is required'),
  role: z.enum([
    'inventory_owner',
    'inventory_manager',
    'cashier',
    'sales_attendant',
    'stock_manager',
    'accountant',
    'inventory_viewer',
  ]),
  branchId: z.string().min(1, 'Branch ID is required'),
  message: z.string().max(500).optional(),
  permissions: z.array(z.string()).optional(),
});

const updateRoleSchema = z.object({
  role: z.enum([
    'inventory_owner',
    'inventory_manager',
    'cashier',
    'sales_attendant',
    'stock_manager',
    'accountant',
    'inventory_viewer',
  ]),
  permissions: z.array(z.string()).optional(),
});

const transferStaffSchema = z.object({
  targetBranchId: z.string().min(1, 'Target branch ID is required'),
  newRole: z
    .enum([
      'inventory_owner',
      'inventory_manager',
      'cashier',
      'sales_attendant',
      'stock_manager',
      'accountant',
      'inventory_viewer',
    ])
    .optional(),
  message: z.string().max(500).optional(),
  effectiveDate: z.number().optional(),
});

export const branchTeamRoutes: FastifyPluginAsync = async (fastify) => {
  // All team management routes require authentication
  fastify.addHook('preHandler', fastify.authenticate);

  // Helper to extract workspace/organization ID from request params
  const getContextId = (req: any): string => {
    return (
      req.params.workspaceId ||
      req.params.organizationId ||
      req.params.orgId ||
      req.params.id ||
      req.headers['x-workspace-id'] ||
      req.headers['x-organization-id'] ||
      ''
    );
  };

  // 1. GET /workspaces/:workspaceId/applications/inventory/members
  const listMembersHandler = async (request: any, reply: any) => {
    const workspaceId = getContextId(request);
    if (!workspaceId) {
      return reply.status(400).send({
        success: false,
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Workspace ID is required' },
      });
    }

    const { branchId, status } = (request.query || {}) as { branchId?: string; status?: string };
    try {
      const members = await dataService.listBranchMembers(workspaceId, {
        applicationKey: 'inventory',
        branchId: branchId || request.params.branchId,
        status,
      });

      return reply.send({
        success: true,
        data: { members },
      });
    } catch (err: any) {
      request.log.error({ err, workspaceId }, 'Failed to list branch team members');
      return reply.status(500).send({
        success: false,
        error: { code: ERROR_CODES.INTERNAL_SERVER_ERROR, message: 'Failed to retrieve team members' },
      });
    }
  };

  // 2. POST /workspaces/:workspaceId/applications/inventory/invitations
  const createInvitationHandler = async (request: any, reply: any) => {
    const workspaceId = getContextId(request);
    if (!workspaceId) {
      return reply.status(400).send({
        success: false,
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Workspace ID is required' },
      });
    }

    const parsed = inviteBranchMemberSchema.safeParse(request.body);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      parsed.error.errors.forEach((e) => {
        if (e.path[0]) fields[String(e.path[0])] = e.message;
      });
      return reply.status(400).send({
        success: false,
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Invalid invitation payload', fields },
      });
    }

    const { email, role, branchId, message } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    try {
      // 1. Fetch branch details for name/code
      let branchName = 'Main Store';
      try {
        const branch = await dataService.getBranchById(branchId);
        if (branch?.name) branchName = branch.name;
      } catch {}

      // 2. Create invitation record via dataService
      const invitation = await dataService.createWorkspaceInvitation({
        workspaceId,
        callerUserId: request.user.id,
        productKey: 'inventory',
        email: normalizedEmail,
        role: 'member',
        organizationRole: 'MEMBER',
        appAccess: [
          {
            productKey: 'inventory',
            appRole: role,
            branchIds: [branchId],
          },
        ],
        branchIds: [branchId],
        message,
      });

      // 3. Audit log
      await dataService.logAudit({
        actorUserId: request.user.id,
        workspaceId,
        productKey: 'inventory',
        eventType: AUDIT_EVENTS.WORKSPACE_MEMBER_INVITED || 'inventory.member_invited',
        action: 'inventory.member_invited',
        resource: 'branch_invitations',
        entityId: (invitation as any)?.id || (invitation as any)?._id || normalizedEmail,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: {
          email: normalizedEmail,
          role,
          branchId,
          branchName,
        },
      });

      return reply.status(201).send({
        success: true,
        data: {
          invitation: {
            id: (invitation as any)?.id || (invitation as any)?._id,
            email: normalizedEmail,
            role,
            branchId,
            branchName,
            status: 'pending',
            expiresAt: invitation.expiresAt,
            token: invitation.token, // Single-use token returned for instant modal preview/copy if desired
          },
        },
        message: `Invitation sent to ${normalizedEmail} for ${branchName}.`,
      });
    } catch (err: any) {
      request.log.error({ err, workspaceId, email }, 'Failed to send branch invitation');
      return reply.status(500).send({
        success: false,
        error: { code: ERROR_CODES.INTERNAL_SERVER_ERROR, message: err.message || 'Failed to send invitation' },
      });
    }
  };

  // 3. POST /workspaces/:workspaceId/applications/inventory/invitations/:id/resend
  const resendInvitationHandler = async (request: any, reply: any) => {
    const workspaceId = getContextId(request);
    const invitationId = request.params.id || request.params.invitationId;

    try {
      const updated = await dataService.resendWorkspaceInvitation(invitationId, request.user.id);

      await dataService.logAudit({
        actorUserId: request.user.id,
        workspaceId,
        productKey: 'inventory',
        eventType: 'inventory.invitation_resent',
        action: 'inventory.invitation_resent',
        resource: 'branch_invitations',
        entityId: invitationId,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });

      return reply.send({
        success: true,
        data: { invitation: updated, token: (updated as any)?.token },
        message: 'Invitation resent successfully.',
      });
    } catch (err: any) {
      request.log.error({ err, invitationId }, 'Failed to resend invitation');
      return reply.status(500).send({
        success: false,
        error: { code: ERROR_CODES.INTERNAL_SERVER_ERROR, message: 'Failed to resend invitation' },
      });
    }
  };

  // 4. POST /workspaces/:workspaceId/applications/inventory/invitations/:id/revoke
  const revokeInvitationHandler = async (request: any, reply: any) => {
    const workspaceId = getContextId(request);
    const invitationId = request.params.id || request.params.invitationId;

    try {
      await dataService.revokeWorkspaceInvitation(invitationId, request.user.id);

      await dataService.logAudit({
        actorUserId: request.user.id,
        workspaceId,
        productKey: 'inventory',
        eventType: 'inventory.invitation_revoked',
        action: 'inventory.invitation_revoked',
        resource: 'branch_invitations',
        entityId: invitationId,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });

      return reply.send({
        success: true,
        message: 'Invitation has been revoked.',
      });
    } catch (err: any) {
      request.log.error({ err, invitationId }, 'Failed to revoke invitation');
      return reply.status(500).send({
        success: false,
        error: { code: ERROR_CODES.INTERNAL_SERVER_ERROR, message: 'Failed to revoke invitation' },
      });
    }
  };


  // 5. PATCH /workspaces/:workspaceId/applications/inventory/members/:membershipId/role
  const updateRoleHandler = async (request: any, reply: any) => {
    const workspaceId = getContextId(request);
    const membershipId = request.params.membershipId || request.params.id;

    const parsed = updateRoleSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Invalid role payload' },
      });
    }

    try {
      const updated = await dataService.updateBranchMemberRole({
        workspaceId,
        membershipId,
        role: parsed.data.role,
        permissions: parsed.data.permissions || INVENTORY_ROLE_PERMISSIONS[parsed.data.role as InventoryRole],
        updatedBy: request.user.id,
      });

      await dataService.logAudit({
        actorUserId: request.user.id,
        workspaceId,
        productKey: 'inventory',
        eventType: 'inventory.member_role_changed',
        action: 'inventory.member_role_changed',
        resource: 'branch_memberships',
        entityId: membershipId,
        metadata: { newRole: parsed.data.role },
      });

      return reply.send({
        success: true,
        data: { member: updated },
        message: 'Staff role updated successfully.',
      });
    } catch (err: any) {
      request.log.error({ err, membershipId }, 'Failed to update member role');
      return reply.status(500).send({
        success: false,
        error: { code: ERROR_CODES.INTERNAL_SERVER_ERROR, message: err.message || 'Failed to update member role' },
      });
    }
  };

  // 6. Suspend member handler: POST /members/:membershipId/suspend or /branch-memberships/:membershipId/suspend
  const suspendMemberHandler = async (request: any, reply: any) => {
    const workspaceId = getContextId(request);
    const membershipId = request.params.membershipId || request.params.id;
    const { reason, suspendAllBranches } = (request.body || {}) as {
      reason?: string;
      suspendAllBranches?: boolean;
    };

    try {
      const result = await dataService.suspendBranchMember({
        workspaceId,
        membershipId,
        reason,
        suspendAllBranches: Boolean(suspendAllBranches),
        actingUserId: request.user.id,
      });

      return reply.send({
        success: true,
        data: result,
        message: 'Member access suspended successfully.',
      });
    } catch (err: any) {
      request.log.error({ err, membershipId }, 'Failed to suspend branch member');
      return reply.status(500).send({
        success: false,
        error: { code: ERROR_CODES.INTERNAL_SERVER_ERROR, message: err.message || 'Failed to suspend member' },
      });
    }
  };

  // 7. Restore member handler: POST /members/:membershipId/restore or /branch-memberships/:membershipId/restore
  const restoreMemberHandler = async (request: any, reply: any) => {
    const workspaceId = getContextId(request);
    const membershipId = request.params.membershipId || request.params.id;

    try {
      const result = await dataService.restoreBranchMember({
        workspaceId,
        membershipId,
        actingUserId: request.user.id,
      });

      return reply.send({
        success: true,
        data: result,
        message: 'Member access restored successfully.',
      });
    } catch (err: any) {
      request.log.error({ err, membershipId }, 'Failed to restore branch member');
      return reply.status(500).send({
        success: false,
        error: { code: ERROR_CODES.INTERNAL_SERVER_ERROR, message: err.message || 'Failed to restore member' },
      });
    }
  };

  // 8. Remove member handler (from branch or inventory)
  const removeMemberHandler = async (request: any, reply: any) => {
    const workspaceId = getContextId(request);
    const membershipId = request.params.membershipId || request.params.id;
    const { reason, removeFromInventory, scope } = (request.body || request.query || {}) as {
      reason?: string;
      removeFromInventory?: boolean;
      scope?: string;
    };

    try {
      if (removeFromInventory || scope === 'inventory') {
        const result = await dataService.removeInventoryMember({
          workspaceId,
          membershipId,
          reason,
          actingUserId: request.user.id,
        });
        return reply.send({
          success: true,
          data: result,
          message: 'Member removed from Inventory application.',
        });
      }

      const result = await dataService.removeBranchMember({
        workspaceId,
        membershipId,
        reason,
        actingUserId: request.user.id,
      });

      return reply.send({
        success: true,
        data: result,
        message: 'Member removed from branch.',
      });
    } catch (err: any) {
      request.log.error({ err, membershipId }, 'Failed to remove member');
      return reply.status(500).send({
        success: false,
        error: { code: ERROR_CODES.INTERNAL_SERVER_ERROR, message: err.message || 'Failed to remove member' },
      });
    }
  };

  // 8b. Remove completely from Inventory: DELETE /members/:membershipId/inventory
  const removeInventoryMemberHandler = async (request: any, reply: any) => {
    const workspaceId = getContextId(request);
    const membershipId = request.params.membershipId || request.params.id;
    const { reason, userId } = (request.body || request.query || {}) as {
      reason?: string;
      userId?: string;
    };

    try {
      const result = await dataService.removeInventoryMember({
        workspaceId,
        membershipId,
        userId,
        reason,
        actingUserId: request.user.id,
      });

      return reply.send({
        success: true,
        data: result,
        message: 'Member removed from Inventory application while preserving workspace membership.',
      });
    } catch (err: any) {
      request.log.error({ err, membershipId }, 'Failed to remove member from inventory');
      return reply.status(500).send({
        success: false,
        error: { code: ERROR_CODES.INTERNAL_SERVER_ERROR, message: err.message || 'Failed to remove member from inventory' },
      });
    }
  };

  // 9. Transfer staff member handler
  const transferStaffHandler = async (request: any, reply: any) => {
    const workspaceId = getContextId(request);
    const membershipId = request.params.membershipId || request.params.id || request.body?.membershipId;

    const targetBranchId = request.body?.targetBranchId || request.body?.toBranchId;
    if (!targetBranchId) {
      return reply.status(400).send({
        success: false,
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Target branch ID is required' },
      });
    }

    try {
      const result = await dataService.transferBranchMember({
        workspaceId,
        membershipId,
        targetBranchId,
        toBranchId: targetBranchId,
        newRole: request.body?.newRole || request.body?.toRole,
        toRole: request.body?.newRole || request.body?.toRole,
        reason: request.body?.reason || request.body?.message,
        message: request.body?.message || request.body?.reason,
        transferredBy: request.user.id,
        effectiveDate: request.body?.effectiveDate || request.body?.effectiveAt,
        effectiveAt: request.body?.effectiveAt || request.body?.effectiveDate,
      });

      return reply.send({
        success: true,
        data: result,
        message: 'Staff member transferred successfully.',
      });
    } catch (err: any) {
      request.log.error({ err, membershipId }, 'Failed to transfer staff member');
      return reply.status(500).send({
        success: false,
        error: { code: ERROR_CODES.INTERNAL_SERVER_ERROR, message: err.message || 'Failed to transfer staff' },
      });
    }
  };

  // 10. Add branch access handler: POST /members/:membershipId/branches or POST /branch-memberships
  const addBranchAccessHandler = async (request: any, reply: any) => {
    const workspaceId = getContextId(request);
    const membershipId = request.params.membershipId || request.params.id || request.body?.membershipId;
    const { branchId, role, roleOverride, permissions, userId } = (request.body || {}) as {
      branchId?: string;
      role?: string;
      roleOverride?: string;
      permissions?: string[];
      userId?: string;
    };

    if (!branchId) {
      return reply.status(400).send({
        success: false,
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Branch ID is required' },
      });
    }

    try {
      const result = await dataService.addBranchAccess({
        workspaceId,
        membershipId,
        userId,
        branchId,
        roleOverride: roleOverride || role,
        permissions,
        assignedByUserId: request.user.id,
      });

      return reply.send({
        success: true,
        data: result,
        message: 'Branch access granted successfully.',
      });
    } catch (err: any) {
      request.log.error({ err, membershipId, branchId }, 'Failed to add branch access');
      return reply.status(500).send({
        success: false,
        error: { code: ERROR_CODES.INTERNAL_SERVER_ERROR, message: err.message || 'Failed to add branch access' },
      });
    }
  };

  // 11. Staff Access Summary handler: GET /members/:membershipId/access
  const getStaffAccessSummaryHandler = async (request: any, reply: any) => {
    const workspaceId = getContextId(request);
    const membershipId = request.params.membershipId || request.params.id;
    const userId = request.params.userId || request.query?.userId;

    try {
      const summary = await dataService.getStaffAccessSummary({
        workspaceId,
        membershipId,
        userId,
      });

      return reply.send({
        success: true,
        data: summary,
      });
    } catch (err: any) {
      request.log.error({ err, membershipId, userId }, 'Failed to retrieve staff access summary');
      return reply.status(500).send({
        success: false,
        error: { code: ERROR_CODES.INTERNAL_SERVER_ERROR, message: err.message || 'Failed to get access summary' },
      });
    }
  };

  // 12. GET /workspaces/:workspaceId/applications/inventory/transfers
  const listTransfersHandler = async (request: any, reply: any) => {
    const workspaceId = getContextId(request);
    try {
      const transfers = await dataService.listBranchTransfers(workspaceId, request.query?.userId);
      return reply.send({
        success: true,
        data: { transfers },
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: { code: ERROR_CODES.INTERNAL_SERVER_ERROR, message: 'Failed to retrieve transfer history' },
      });
    }
  };

  // 13. Safe user search: GET /api/v1/users/search?email=...
  fastify.get('/users/search', async (request: any, reply: any) => {
    const email = request.query?.email;
    if (!email || typeof email !== 'string') {
      return reply.status(400).send({
        success: false,
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Email parameter is required' },
      });
    }

    try {
      const profile = await dataService.searchSafeUsersByEmail(email);
      return reply.send({
        success: true,
        data: { user: profile },
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: { code: ERROR_CODES.INTERNAL_SERVER_ERROR, message: 'Search failed' },
      });
    }
  });

  // Handler for /status (active, suspended, removed)
  const updateStatusHandler = async (request: any, reply: any) => {
    const workspaceId = getContextId(request);
    const membershipId = request.params.membershipId || request.params.id;
    const status = (request.body?.status || 'active') as 'active' | 'suspended' | 'removed';

    try {
      const updated = await dataService.setBranchMemberStatus({
        workspaceId,
        membershipId,
        status,
        actingUserId: request.user.id,
      });

      return reply.send({
        success: true,
        data: { member: updated },
        message: `Member status updated to ${status}.`,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: { code: ERROR_CODES.INTERNAL_SERVER_ERROR, message: err.message || 'Failed to update member status' },
      });
    }
  };

  // Register symmetric routes for workspaces and organizations
  const prefixes = [
    '/workspaces/:workspaceId/applications/inventory',
    '/organizations/:organizationId/applications/inventory',
    '/orgs/:orgId/applications/inventory',
  ];

  prefixes.forEach((prefix) => {
    fastify.get(`${prefix}/members`, listMembersHandler);
    fastify.get(`${prefix}/team`, listMembersHandler);
    fastify.get(`${prefix}/branch-memberships`, listMembersHandler);
    fastify.get(`${prefix}/branches/:branchId/members`, listMembersHandler);
    fastify.get(`${prefix}/branches/:branchId/team`, listMembersHandler);

    fastify.post(`${prefix}/invitations`, createInvitationHandler);
    fastify.post(`${prefix}/team/invite`, createInvitationHandler);
    fastify.post(`${prefix}/invitations/:id/resend`, resendInvitationHandler);
    fastify.post(`${prefix}/invitations/:id/revoke`, revokeInvitationHandler);

    fastify.patch(`${prefix}/members/:membershipId/role`, updateRoleHandler);
    fastify.patch(`${prefix}/team/members/:membershipId/role`, updateRoleHandler);
    fastify.patch(`${prefix}/branch-memberships/:membershipId/role`, updateRoleHandler);

    fastify.patch(`${prefix}/members/:membershipId/status`, updateStatusHandler);
    fastify.patch(`${prefix}/team/members/:membershipId/status`, updateStatusHandler);
    fastify.patch(`${prefix}/branch-memberships/:membershipId/status`, updateStatusHandler);

    fastify.post(`${prefix}/members/:membershipId/suspend`, suspendMemberHandler);
    fastify.post(`${prefix}/team/members/:membershipId/suspend`, suspendMemberHandler);
    fastify.post(`${prefix}/branch-memberships/:membershipId/suspend`, suspendMemberHandler);

    fastify.post(`${prefix}/members/:membershipId/restore`, restoreMemberHandler);
    fastify.post(`${prefix}/team/members/:membershipId/restore`, restoreMemberHandler);
    fastify.post(`${prefix}/branch-memberships/:membershipId/restore`, restoreMemberHandler);

    fastify.delete(`${prefix}/members/:membershipId`, removeMemberHandler);
    fastify.delete(`${prefix}/team/members/:membershipId`, removeMemberHandler);
    fastify.delete(`${prefix}/branch-memberships/:membershipId`, removeMemberHandler);
    fastify.delete(`${prefix}/members/:membershipId/inventory`, removeInventoryMemberHandler);
    fastify.delete(`${prefix}/application-memberships/:membershipId`, removeInventoryMemberHandler);

    fastify.post(`${prefix}/members/:membershipId/branches`, addBranchAccessHandler);
    fastify.post(`${prefix}/branch-memberships`, addBranchAccessHandler);

    fastify.get(`${prefix}/members/:membershipId/access`, getStaffAccessSummaryHandler);
    fastify.get(`${prefix}/branch-memberships/:membershipId/access`, getStaffAccessSummaryHandler);

    fastify.post(`${prefix}/members/:membershipId/transfer`, transferStaffHandler);
    fastify.post(`${prefix}/team/transfer`, transferStaffHandler);
    fastify.post(`${prefix}/branch-memberships/:membershipId/transfer`, transferStaffHandler);

    fastify.get(`${prefix}/transfers`, listTransfersHandler);
    fastify.get(`${prefix}/team/transfers`, listTransfersHandler);
    fastify.get(`${prefix}/members/:membershipId/transfers`, listTransfersHandler);

    // Inventory context for current user in workspace/branch
    fastify.get(`${prefix}/context`, async (request: any, reply: any) => {
      const workspaceId = getContextId(request);
      const branchId = request.query?.branchId;
      const userId = request.user?.id || request.user?._id;
      try {
        const context = await dataService.resolveInventoryContext({
          workspaceId,
          userId,
          branchId,
        });
        return reply.send({ success: true, data: context });
      } catch (err: any) {
        request.log.error({ err, workspaceId, userId }, 'Failed to resolve inventory context');
        return reply.status(500).send({
          success: false,
          error: { code: ERROR_CODES.INTERNAL_SERVER_ERROR, message: 'Failed to resolve context' },
        });
      }
    });
  });

  // Global /me access-context endpoint for product launcher and dashboard
  fastify.get('/me/access-context', async (request: any, reply: any) => {
    const userId = request.user?.id || request.user?._id;
    try {
      const context = await dataService.getAccessContext(userId);
      return reply.send({ success: true, data: context });
    } catch (err: any) {
      request.log.error({ err, userId }, 'Failed to resolve user access context');
      return reply.status(500).send({
        success: false,
        error: { code: ERROR_CODES.INTERNAL_SERVER_ERROR, message: 'Failed to resolve access context' },
      });
    }
  });

  // Single workspace access-context
  fastify.get('/workspaces/:workspaceId/access-context', async (request: any, reply: any) => {
    const workspaceId = getContextId(request);
    const userId = request.user?.id || request.user?._id;
    try {
      const context = await dataService.getAccessContext(userId, workspaceId);
      return reply.send({ success: true, data: context });
    } catch (err: any) {
      request.log.error({ err, workspaceId, userId }, 'Failed to resolve workspace access context');
      return reply.status(500).send({
        success: false,
        error: { code: ERROR_CODES.INTERNAL_SERVER_ERROR, message: 'Failed to resolve workspace access context' },
      });
    }
  });
};

