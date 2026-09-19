import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { dataService } from '../services/dataService.js';
import { entitlementService } from '../services/entitlementService.js';
import { ERROR_CODES, AUDIT_EVENTS } from '../config/constants.js';
import { INVENTORY_ROLE_PERMISSIONS, type InventoryRole } from '../config/inventoryRbac.js';

const createBranchSchema = z.object({
  name: z.string().min(1, 'Branch name is required').transform((s) => s.trim()),
  code: z
    .string()
    .optional()
    .transform((s) => (s ? s.trim().toUpperCase() : undefined)),
  description: z.string().optional(),
  logoUrl: z.string().url().optional().or(z.literal('')),
  country: z.string().default('Nigeria'),
  state: z.string().optional(),
  stateCode: z.string().optional(),
  lga: z.string().optional(),
  city: z.string().optional(),
  street: z.string().optional(),
  blockNumber: z.string().optional(),
  area: z.string().optional(),
  landmark: z.string().optional(),
  postalCode: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  managerId: z.string().optional(),
  isPrimary: z.boolean().optional().default(false),
  openingHours: z.record(z.any()).optional(),
});

const updateBranchSchema = z.object({
  name: z.string().min(1).transform((s) => s.trim()).optional(),
  code: z
    .string()
    .optional()
    .transform((s) => (s ? s.trim().toUpperCase() : undefined)),
  description: z.string().optional(),
  logoUrl: z.string().url().optional().or(z.literal('')),
  country: z.string().optional(),
  state: z.string().optional(),
  stateCode: z.string().optional(),
  lga: z.string().optional(),
  city: z.string().optional(),
  street: z.string().optional(),
  blockNumber: z.string().optional(),
  area: z.string().optional(),
  landmark: z.string().optional(),
  postalCode: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  managerId: z.string().optional(),
  isPrimary: z.boolean().optional(),
  status: z.enum(['active', 'suspended', 'archived', 'setup_incomplete', 'creating']).optional(),
  openingHours: z.record(z.any()).optional(),
  receiptFooter: z.string().optional(),
  negativeStockAllowed: z.boolean().optional(),
  lowStockThreshold: z.number().optional(),
});

const assignBranchMemberSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  role: z
    .enum([
      'inventory_owner',
      'inventory_manager',
      'branch_manager',
      'cashier',
      'sales_attendant',
      'stock_manager',
      'accountant',
      'inventory_staff',
      'inventory_viewer',
      'viewer',
    ])
    .default('inventory_viewer'),
  roleOverride: z.string().optional(),
  permissions: z.array(z.string()).optional(),
});

const updateBranchMemberSchema = z.object({
  role: z
    .enum([
      'inventory_owner',
      'inventory_manager',
      'branch_manager',
      'cashier',
      'sales_attendant',
      'stock_manager',
      'accountant',
      'inventory_staff',
      'inventory_viewer',
      'viewer',
    ])
    .optional(),
  roleOverride: z.string().optional(),
  permissions: z.array(z.string()).optional(),
  status: z.enum(['active', 'suspended', 'removed']).optional(),
});

export const branchSettingsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate);

  // Helper to extract workspace or organization ID
  const getTenantId = (req: any): string => {
    return (
      req.params?.workspaceId ||
      req.params?.organizationId ||
      req.body?.workspaceId ||
      req.body?.organizationId ||
      req.query?.workspaceId ||
      req.query?.organizationId ||
      req.headers?.['x-workspace-id'] ||
      req.headers?.['x-organization-id'] ||
      req.tenantContext?.workspaceId ||
      req.tenantContext?.organizationId ||
      ''
    );
  };

  // Helper for audit logging
  const logBranchAudit = async (
    req: any,
    action: string,
    eventType: string,
    branchId: string,
    metadata?: any
  ) => {
    try {
      const tenantId = getTenantId(req);
      await dataService.logAudit({
        actorUserId: req.user.id,
        workspaceId: tenantId,
        productKey: 'inventory',
        eventType,
        action,
        resource: 'branches',
        entityId: branchId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: {
          ...metadata,
          requestId: req.id,
        },
      });
    } catch (err) {
      req.log.warn({ err, action, branchId }, 'Failed to log branch audit event');
    }
  };

  // -------------------------------------------------------------
  // 1. LIST BRANCHES FOR TENANT
  // -------------------------------------------------------------
  const listBranchesHandler = async (request: any, reply: any) => {
    const tenantId = getTenantId(request);
    try {
      const branches = await dataService.getBranches(tenantId, request.user.id);
      const branchesList = Array.isArray(branches) ? branches : (branches as any)?.branches || [];
      return reply.send({
        success: true,
        data: branchesList,
        branches: branchesList,
        requestId: request.id,
      });
    } catch (err: any) {
      request.log.error({ err, tenantId }, 'Failed to list branches');
      return reply.status(500).send({
        success: false,
        error: { code: ERROR_CODES.INTERNAL_SERVER_ERROR, message: err.message || 'Failed to list branches' },
      });
    }
  };

  // -------------------------------------------------------------
  // 2. CREATE BRANCH
  // -------------------------------------------------------------
  const createBranchHandler = async (request: any, reply: any) => {
    const tenantId = getTenantId(request);
    const parsed = createBranchSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Invalid branch creation payload',
          details: parsed.error.format(),
        },
      });
    }

    // Entitlement limit check (1 for Free Trial, 3 for Standard, 10 for Premium)
    const entitlement = await entitlementService.checkBranchCreationEntitlement(
      tenantId,
      request.user.id,
      'inventory'
    );
    if (!entitlement.allowed) {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'BRANCH_LIMIT_REACHED',
          message: entitlement.message || 'You have reached the maximum branches allowed by your plan.',
          current: entitlement.currentUsage ?? entitlement.current ?? 1,
          limit: entitlement.limit,
          max: entitlement.limit,
          planKey: entitlement.planKey,
          upgradeRequired: true,
        },
      });
    }

    try {
      const branchId = await dataService.createBranch({
        workspaceId: tenantId,
        actorUserId: request.user.id,
        ...parsed.data,
      });

      const branch = await dataService.getBranchById(branchId as string);

      await logBranchAudit(request, 'branch.created', (AUDIT_EVENTS as any).BRANCH_CREATED || 'branch.created', branchId as string, {
        name: parsed.data.name,
        code: parsed.data.code,
        isPrimary: parsed.data.isPrimary,
      });

      return reply.status(201).send({
        success: true,
        data: { branch: branch || { id: branchId, ...parsed.data } },
        message: 'Branch created successfully.',
        requestId: request.id,
      });
    } catch (err: any) {
      if (err.message && (err.message.includes('already used') || err.message.includes('DUPLICATE') || err.message.includes('already exists'))) {
        return reply.status(400).send({
          success: false,
          error: { code: 'DUPLICATE_BRANCH_CODE', message: err.message },
        });
      }
      return reply.status(400).send({
        success: false,
        error: { code: 'BRANCH_CREATION_FAILED', message: err.message || 'Failed to create branch' },
      });
    }
  };

  // -------------------------------------------------------------
  // 3. GET BRANCH DETAILS
  // -------------------------------------------------------------
  const getBranchHandler = async (request: any, reply: any) => {
    const { branchId } = request.params as { branchId: string };
    const tenantId = getTenantId(request);
    try {
      let branch = await dataService.getFullBranchSettings(branchId, request.user.id, tenantId).catch(() => null);
      if (!branch) {
        branch = await dataService.getBranchById(branchId).catch(() => null);
      }
      if (!branch) {
        return reply.status(404).send({
          success: false,
          error: { code: 'BRANCH_NOT_FOUND', message: 'Branch not found' },
        });
      }
      return reply.send({ success: true, data: { branch }, requestId: request.id });
    } catch (err: any) {
      request.log.error({ err, branchId }, 'Failed to fetch branch details');
      if (err.message === 'BRANCH_NOT_FOUND' || err.message?.includes('NOT_FOUND')) {
        return reply.status(404).send({
          success: false,
          error: { code: 'BRANCH_NOT_FOUND', message: 'Branch not found' },
        });
      }
      return reply.status(500).send({
        success: false,
        error: { code: ERROR_CODES.INTERNAL_SERVER_ERROR, message: err.message || 'Failed to fetch branch settings' },
      });
    }
  };

  // -------------------------------------------------------------
  // 4. UPDATE BRANCH SETTINGS / METADATA
  // -------------------------------------------------------------
  const updateBranchHandler = async (request: any, reply: any) => {
    const { branchId } = request.params as { branchId: string };
    const tenantId = getTenantId(request);
    const parsed = updateBranchSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Invalid branch update payload',
          details: parsed.error.format(),
        },
      });
    }

    try {
      // 1. Update operational settings if included
      if (
        parsed.data.openingHours !== undefined ||
        parsed.data.receiptFooter !== undefined ||
        parsed.data.negativeStockAllowed !== undefined ||
        parsed.data.lowStockThreshold !== undefined
      ) {
        await dataService.updateBranchOperationalSettings(
          branchId,
          {
            openingHours: parsed.data.openingHours,
            receiptFooter: parsed.data.receiptFooter,
            negativeStockAllowed: parsed.data.negativeStockAllowed,
            lowStockThreshold: parsed.data.lowStockThreshold,
          },
          request.user.id,
          tenantId
        );
      }

      // 2. Update core branch metadata
      const { openingHours, receiptFooter, negativeStockAllowed, lowStockThreshold, ...metaPatch } = parsed.data;
      if (Object.keys(metaPatch).length > 0) {
        await dataService.updateBranch(branchId, {
          ...metaPatch,
          callerUserId: request.user.id,
        });
      }

      const updated = await dataService.getFullBranchSettings(branchId, request.user.id, tenantId);

      await logBranchAudit(request, 'branch.updated', (AUDIT_EVENTS as any).BRANCH_UPDATED || 'branch.updated', branchId, {
        updatedFields: Object.keys(parsed.data),
      });

      return reply.send({
        success: true,
        data: { branch: updated },
        message: 'Branch settings updated successfully.',
        requestId: request.id,
      });
    } catch (err: any) {
      if (err.message && (err.message.includes('already used') || err.message.includes('DUPLICATE'))) {
        return reply.status(400).send({
          success: false,
          error: { code: 'DUPLICATE_BRANCH_CODE', message: err.message },
        });
      }
      return reply.status(400).send({
        success: false,
        error: { code: 'UPDATE_FAILED', message: err.message || 'Failed to update branch' },
      });
    }
  };

  // -------------------------------------------------------------
  // 5. SET PRIMARY BRANCH
  // -------------------------------------------------------------
  const setPrimaryHandler = async (request: any, reply: any) => {
    const { branchId } = request.params as { branchId: string };
    const tenantId = getTenantId(request);
    try {
      await dataService.setPrimaryBranch(branchId, request.user.id, tenantId);
      await logBranchAudit(request, 'branch.set_primary', 'branch.set_primary', branchId);
      return reply.send({
        success: true,
        message: 'Branch set as primary successfully.',
        requestId: request.id,
      });
    } catch (err: any) {
      return reply.status(400).send({
        success: false,
        error: { code: 'ACTION_FAILED', message: err.message },
      });
    }
  };

  // -------------------------------------------------------------
  // 6. SUSPEND BRANCH
  // -------------------------------------------------------------
  const suspendBranchHandler = async (request: any, reply: any) => {
    const { branchId } = request.params as { branchId: string };
    const tenantId = getTenantId(request);
    const reason = request.body?.reason || 'Suspended by administrator';
    try {
      await dataService.suspendBranch(branchId, request.user.id, tenantId);
      await logBranchAudit(request, 'branch.suspended', 'branch.suspended', branchId, { reason });
      return reply.send({
        success: true,
        message: 'Branch suspended successfully.',
        requestId: request.id,
      });
    } catch (err: any) {
      return reply.status(400).send({
        success: false,
        error: { code: 'ACTION_FAILED', message: err.message },
      });
    }
  };

  // -------------------------------------------------------------
  // 7. RESTORE BRANCH
  // -------------------------------------------------------------
  const restoreBranchHandler = async (request: any, reply: any) => {
    const { branchId } = request.params as { branchId: string };
    const tenantId = getTenantId(request);
    try {
      await dataService.restoreBranch(branchId, request.user.id, tenantId);
      await logBranchAudit(request, 'branch.restored', 'branch.restored', branchId);
      return reply.send({
        success: true,
        message: 'Branch restored successfully.',
        requestId: request.id,
      });
    } catch (err: any) {
      return reply.status(400).send({
        success: false,
        error: { code: 'ACTION_FAILED', message: err.message },
      });
    }
  };

  // -------------------------------------------------------------
  // 8. ARCHIVE BRANCH
  // -------------------------------------------------------------
  const archiveBranchHandler = async (request: any, reply: any) => {
    const { branchId } = request.params as { branchId: string };
    const tenantId = getTenantId(request);
    if (request.branch?.isPrimary) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'CANNOT_ARCHIVE_PRIMARY_BRANCH',
          message: 'Cannot archive the primary branch. Set another active branch as primary first.',
        },
      });
    }
    try {
      await dataService.archiveBranch(branchId, request.user.id, tenantId);
      await logBranchAudit(request, 'branch.archived', 'branch.archived', branchId);
      return reply.send({
        success: true,
        message: 'Branch archived successfully.',
        requestId: request.id,
      });
    } catch (err: any) {
      return reply.status(400).send({
        success: false,
        error: { code: 'ARCHIVE_FAILED', message: err.message },
      });
    }
  };

  // -------------------------------------------------------------
  // 9. BRANCH MEMBERS: LIST
  // -------------------------------------------------------------
  const listBranchMembersHandler = async (request: any, reply: any) => {
    const { branchId } = request.params as { branchId: string };
    const tenantId = getTenantId(request);
    try {
      const members = await dataService.listBranchMembers(tenantId, {
        applicationKey: 'inventory',
        branchId,
      });
      return reply.send({
        success: true,
        data: { members },
        requestId: request.id,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: { code: ERROR_CODES.INTERNAL_SERVER_ERROR, message: err.message },
      });
    }
  };

  // -------------------------------------------------------------
  // 10. BRANCH MEMBERS: ADD / ASSIGN
  // -------------------------------------------------------------
  const addBranchMemberHandler = async (request: any, reply: any) => {
    const { branchId } = request.params as { branchId: string };
    const tenantId = getTenantId(request);
    const parsed = assignBranchMemberSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Invalid branch member payload',
          details: parsed.error.format(),
        },
      });
    }

    try {
      const result = await dataService.addBranchAccess({
        workspaceId: tenantId,
        userId: parsed.data.userId,
        branchId,
        roleOverride: parsed.data.roleOverride || parsed.data.role,
        permissions: parsed.data.permissions || INVENTORY_ROLE_PERMISSIONS[parsed.data.role as InventoryRole] || [],
        assignedByUserId: request.user.id,
      });

      await logBranchAudit(request, 'branch.member_added', 'branch.member_added', branchId, {
        assignedUserId: parsed.data.userId,
        role: parsed.data.role,
      });

      return reply.status(201).send({
        success: true,
        data: result,
        message: 'Member assigned to branch successfully.',
        requestId: request.id,
      });
    } catch (err: any) {
      return reply.status(400).send({
        success: false,
        error: { code: 'ASSIGN_MEMBER_FAILED', message: err.message },
      });
    }
  };

  // -------------------------------------------------------------
  // 11. BRANCH MEMBERS: UPDATE ROLE / STATUS
  // -------------------------------------------------------------
  const updateBranchMemberHandler = async (request: any, reply: any) => {
    const { branchId, membershipId } = request.params as { branchId: string; membershipId: string };
    const tenantId = getTenantId(request);
    const parsed = updateBranchMemberSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Invalid member update payload' },
      });
    }

    try {
      let updated: any = null;
      if (parsed.data.role) {
        updated = await dataService.updateBranchMemberRole({
          workspaceId: tenantId,
          membershipId,
          role: parsed.data.role,
          permissions: parsed.data.permissions || (INVENTORY_ROLE_PERMISSIONS as any)[parsed.data.role] || [],
          updatedBy: request.user.id,
        });
      }

      if (parsed.data.status) {
        updated = await dataService.setBranchMemberStatus({
          workspaceId: tenantId,
          membershipId,
          status: parsed.data.status,
          actingUserId: request.user.id,
        });
      }

      await logBranchAudit(request, 'branch.member_updated', 'branch.member_updated', branchId, {
        membershipId,
        updates: parsed.data,
      });

      return reply.send({
        success: true,
        data: { member: updated },
        message: 'Branch member updated successfully.',
        requestId: request.id,
      });
    } catch (err: any) {
      return reply.status(400).send({
        success: false,
        error: { code: 'UPDATE_MEMBER_FAILED', message: err.message },
      });
    }
  };

  // -------------------------------------------------------------
  // 12. BRANCH MEMBERS: REMOVE
  // -------------------------------------------------------------
  const removeBranchMemberHandler = async (request: any, reply: any) => {
    const { branchId, membershipId } = request.params as { branchId: string; membershipId: string };
    const tenantId = getTenantId(request);
    const reason = request.body?.reason || 'Removed by administrator';
    try {
      const result = await dataService.removeBranchMember({
        workspaceId: tenantId,
        membershipId,
        reason,
        actingUserId: request.user.id,
      });

      await logBranchAudit(request, 'branch.member_removed', 'branch.member_removed', branchId, {
        membershipId,
        reason,
      });

      return reply.send({
        success: true,
        data: result,
        message: 'Member removed from branch.',
        requestId: request.id,
      });
    } catch (err: any) {
      return reply.status(400).send({
        success: false,
        error: { code: 'REMOVE_MEMBER_FAILED', message: err.message },
      });
    }
  };

  // -------------------------------------------------------------
  // 13. DEMO INVENTORY CONTEXT (Secure & Isolated)
  // -------------------------------------------------------------
  const demoContextHandler = async (request: any, reply: any) => {
    const tenantId = getTenantId(request);
    const branchId = request.body?.branchId || request.query?.branchId;
    const userId = request.user.id;

    try {
      // 1. Resolve fine-grained context from dataService / Convex
      const invCtx = await dataService.resolveInventoryContext({
        workspaceId: tenantId,
        userId,
        branchId,
      });

      // 2. Fetch active branch details
      let targetBranch: any = null;
      if (branchId) {
        targetBranch = await dataService.getBranchById(branchId);
      } else {
        const branches = await dataService.getBranches(tenantId, userId);
        if (Array.isArray(branches) && branches.length > 0) {
          targetBranch = branches.find((b: any) => b.isPrimary && b.status === 'active') || branches[0];
        }
      }

      // 3. Persisted setup status
      const wsProducts = await dataService.getWorkspaceProducts(tenantId).catch(() => []);
      const wsProduct = Array.isArray(wsProducts) ? wsProducts.find((p: any) => (p.productKey || p.key || p.applicationKey) === 'inventory') : null;
      const isSetupComplete = wsProduct?.status === 'active' || wsProduct?.status === 'ACTIVE';

      return reply.send({
        success: true,
        data: {
          organization: {
            id: request.tenantContext?.organizationId || tenantId,
            name: request.tenantContext?.workspaceName || request.workspace?.name || 'Organization',
          },
          application: {
            key: 'inventory',
            status: wsProduct?.status || 'active',
          },
          branch: targetBranch
            ? {
                id: targetBranch._id || targetBranch.id,
                name: targetBranch.name,
                code: targetBranch.code,
                isPrimary: Boolean(targetBranch.isPrimary),
                status: targetBranch.status || 'active',
              }
            : null,
          permissions: invCtx.permissions || [
            'inventory.view',
            'branch.view',
            'branch.update',
          ],
          setup: {
            inventorySetupStatus: isSetupComplete ? 'complete' : 'setup_incomplete',
            branchSetupStatus: targetBranch ? 'complete' : 'pending',
          },
          demoMetrics: {
            totalProducts: 12,
            lowStockCount: 2,
            outOfStockCount: 0,
            todaySalesCount: 5,
            todayRevenue: 45000,
            isStaticDemo: true,
          },
        },
        requestId: request.id,
      });
    } catch (err: any) {
      request.log.error({ err, tenantId }, 'Failed to resolve demo context');
      return reply.status(500).send({
        success: false,
        error: { code: ERROR_CODES.INTERNAL_SERVER_ERROR, message: 'Failed to resolve demo context' },
      });
    }
  };

  // -------------------------------------------------------------
  // ROUTE REGISTRATIONS WITH GUARDS & SYMMETRIC PREFIXES
  // -------------------------------------------------------------
  const basePreHandlers = [
    fastify.resolveWorkspace,
    fastify.requireWorkspaceMembership,
    fastify.requireApplicationAccess('inventory'),
  ];

  const branchPreHandlers = [
    ...basePreHandlers,
    fastify.resolveBranch,
    fastify.requireBranchOwnership,
  ];

  const branchActivePreHandlers = [
    ...branchPreHandlers,
    fastify.requireActiveBranch,
  ];

  const prefixes = [
    '/workspaces/:workspaceId',
    '/organizations/:organizationId',
  ];

  for (const prefix of prefixes) {
    // 1. List inventory branches
    fastify.get(`${prefix}/inventory/branches`, { preHandler: basePreHandlers }, listBranchesHandler);

    // 2. Create branch (requires workspace owner or admin)
    fastify.post(
      `${prefix}/inventory/branches`,
      { preHandler: [...basePreHandlers, fastify.requireWorkspaceRole(['owner', 'admin'])] },
      createBranchHandler
    );

    // 3. Get branch settings / detail
    fastify.get(
      `${prefix}/inventory/branches/:branchId`,
      { preHandler: [...branchPreHandlers, fastify.requireBranchPermission('branch.view')] },
      getBranchHandler
    );
    fastify.get(
      `${prefix}/branches/:branchId/settings`,
      { preHandler: [...branchPreHandlers, fastify.requireBranchPermission('branch.view')] },
      getBranchHandler
    );

    // 4. Update branch settings / metadata
    fastify.patch(
      `${prefix}/inventory/branches/:branchId`,
      { preHandler: [...branchActivePreHandlers, fastify.requireBranchPermission('branch.update')] },
      updateBranchHandler
    );
    fastify.patch(
      `${prefix}/branches/:branchId/settings`,
      { preHandler: [...branchActivePreHandlers, fastify.requireBranchPermission('branch.update')] },
      updateBranchHandler
    );

    // 5. Set Primary
    fastify.post(
      `${prefix}/inventory/branches/:branchId/set-primary`,
      { preHandler: [...branchActivePreHandlers, fastify.requireBranchPermission('branch.set_primary')] },
      setPrimaryHandler
    );
    fastify.post(
      `${prefix}/branches/:branchId/set-primary`,
      { preHandler: [...branchActivePreHandlers, fastify.requireBranchPermission('branch.set_primary')] },
      setPrimaryHandler
    );

    // 6. Suspend
    fastify.post(
      `${prefix}/inventory/branches/:branchId/suspend`,
      { preHandler: [...branchPreHandlers, fastify.requireBranchPermission('branch.suspend')] },
      suspendBranchHandler
    );
    fastify.post(
      `${prefix}/branches/:branchId/suspend`,
      { preHandler: [...branchPreHandlers, fastify.requireBranchPermission('branch.suspend')] },
      suspendBranchHandler
    );

    // 7. Restore
    fastify.post(
      `${prefix}/inventory/branches/:branchId/restore`,
      { preHandler: [...branchPreHandlers, fastify.requireBranchPermission('branch.restore')] },
      restoreBranchHandler
    );
    fastify.post(
      `${prefix}/branches/:branchId/restore`,
      { preHandler: [...branchPreHandlers, fastify.requireBranchPermission('branch.restore')] },
      restoreBranchHandler
    );

    // 8. Archive
    fastify.post(
      `${prefix}/inventory/branches/:branchId/archive`,
      { preHandler: [...branchPreHandlers, fastify.requireBranchPermission('branch.archive')] },
      archiveBranchHandler
    );
    fastify.post(
      `${prefix}/branches/:branchId/archive`,
      { preHandler: [...branchPreHandlers, fastify.requireBranchPermission('branch.archive')] },
      archiveBranchHandler
    );

    // 9. Branch Members: List
    fastify.get(
      `${prefix}/inventory/branches/:branchId/members`,
      { preHandler: [...branchPreHandlers, fastify.requireBranchPermission('branch.view')] },
      listBranchMembersHandler
    );

    // 10. Branch Members: Add/Assign
    fastify.post(
      `${prefix}/inventory/branches/:branchId/members`,
      { preHandler: [...branchActivePreHandlers, fastify.requireBranchPermission('branch.manage_staff')] },
      addBranchMemberHandler
    );

    // 11. Branch Members: Update
    fastify.patch(
      `${prefix}/inventory/branches/:branchId/members/:membershipId`,
      { preHandler: [...branchActivePreHandlers, fastify.requireBranchPermission('branch.manage_staff')] },
      updateBranchMemberHandler
    );

    // 12. Branch Members: Remove
    fastify.delete(
      `${prefix}/inventory/branches/:branchId/members/:membershipId`,
      { preHandler: [...branchActivePreHandlers, fastify.requireBranchPermission('branch.manage_staff')] },
      removeBranchMemberHandler
    );

    // 13. Demo Context
    fastify.post(`${prefix}/inventory/demo-context`, { preHandler: basePreHandlers }, demoContextHandler);
    fastify.get(`${prefix}/inventory/demo-context`, { preHandler: basePreHandlers }, demoContextHandler);
    fastify.get(`${prefix}/inventory/context`, { preHandler: basePreHandlers }, demoContextHandler);
  }

  // Top-level direct demo-context & context routes
  fastify.post('/inventory/demo-context', { preHandler: [fastify.resolveWorkspace] }, demoContextHandler);
  fastify.get('/inventory/demo-context', { preHandler: [fastify.resolveWorkspace] }, demoContextHandler);
  fastify.get('/inventory/context', { preHandler: [fastify.resolveWorkspace] }, demoContextHandler);

  // Top-level dashboard opened audit logger
  fastify.post('/inventory/log-dashboard-opened', async (request: any, reply: any) => {
    const tenantId = getTenantId(request);
    const branchId = request.body?.branchId || request.query?.branchId;
    try {
      if (tenantId) {
        await dataService.logAudit({
          actorUserId: request.user?.id || 'system',
          workspaceId: tenantId,
          productKey: 'inventory',
          eventType: 'inventory.dashboard_opened',
          action: 'dashboard.opened',
          resource: 'dashboard',
          entityId: branchId || tenantId,
          ipAddress: request.ip,
          userAgent: request.headers?.['user-agent'],
          metadata: {
            requestId: request.id,
            branchId,
          },
        });
      }
      return reply.send({ success: true });
    } catch (err: any) {
      request.log.warn({ err, tenantId }, 'Failed to log dashboard opened');
      return reply.send({ success: false });
    }
  });
};
