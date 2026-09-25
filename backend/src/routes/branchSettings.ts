import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { dataService } from '../services/dataService.js';
import { entitlementService } from '../services/entitlementService.js';
import { ERROR_CODES, AUDIT_EVENTS } from '../config/constants.js';

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
  isPrimary: z.boolean().optional(),
  status: z.enum(['active', 'suspended', 'archived', 'setup_incomplete', 'creating']).optional(),
  openingHours: z.record(z.any()).optional(),
  receiptFooter: z.string().optional(),
  paperWidth: z.string().optional(),
  tin: z.string().optional(),
  vatRate: z.number().optional(),
  enableVat: z.boolean().optional(),
  showCashier: z.boolean().optional(),
  showCustomer: z.boolean().optional(),
  showBarcode: z.boolean().optional(),
  headerText: z.string().optional(),
  footerMessage: z.string().optional(),
  returnPolicy: z.string().optional(),
  receiptPrefix: z.string().optional(),
  tagline: z.string().optional(),
  negativeStockAllowed: z.boolean().optional(),
  lowStockThreshold: z.number().optional(),
  stockAdjustmentApprovalRequired: z.boolean().optional(),
  discrepancyApprovalThreshold: z.number().optional(),
  enforceStockCountApproval: z.boolean().optional(),
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
        callerUserId: request.user.id,
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
      const operationalKeys = [
        'openingHours',
        'receiptFooter',
        'paperWidth',
        'tin',
        'vatRate',
        'enableVat',
        'showCashier',
        'showCustomer',
        'showBarcode',
        'headerText',
        'footerMessage',
        'returnPolicy',
        'receiptPrefix',
        'tagline',
        'negativeStockAllowed',
        'lowStockThreshold',
        'stockAdjustmentApprovalRequired',
        'discrepancyApprovalThreshold',
        'enforceStockCountApproval',
      ];

      const operationalUpdates: Record<string, any> = {};
      let hasOperationalUpdates = false;

      for (const k of operationalKeys) {
        if ((parsed.data as any)[k] !== undefined) {
          operationalUpdates[k] = (parsed.data as any)[k];
          hasOperationalUpdates = true;
        }
      }

      if (hasOperationalUpdates) {
        await dataService.updateBranchOperationalSettings(
          branchId,
          operationalUpdates,
          request.user.id,
          tenantId
        );
      }

      // 2. Update core branch metadata
      const metaPatch: Record<string, any> = { ...parsed.data };
      for (const k of operationalKeys) {
        delete metaPatch[k];
      }

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
  // 12b. BRANCH PHONE VERIFICATION HANDLERS
  // -------------------------------------------------------------
  const startBranchPhoneVerificationHandler = async (request: any, reply: any) => {
    const { branchId } = request.params as { branchId: string };
    const tenantId = getTenantId(request);
    const body = (request.body as { phone?: string; purpose?: string }) || {};
    const branch = await dataService.getBranchById(branchId);
    const phoneToVerify = body.phone || branch?.phone;
    if (!phoneToVerify) {
      return reply.status(400).send({ success: false, error: { code: 'PHONE_REQUIRED', message: 'Phone number is required.' } });
    }
    try {
      const challenge = await dataService.startBranchPhoneVerification(
        branchId,
        tenantId,
        request.user.id,
        phoneToVerify,
        body.purpose || 'branch_phone_verification',
        request.ip,
        request.headers['user-agent']
      );
      return reply.send({ success: true, message: `Verification code sent to ${challenge.phoneNormalized}.`, data: challenge });
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: { code: 'VERIFICATION_START_FAILED', message: err.message } });
    }
  };

  const verifyBranchPhoneVerificationHandler = async (request: any, reply: any) => {
    const { branchId } = request.params as { branchId: string };
    const tenantId = getTenantId(request);
    const body = request.body as { code: string; purpose?: string };
    try {
      const res = await dataService.verifyBranchPhone(
        branchId,
        tenantId,
        request.user.id,
        body.code,
        body.purpose || 'branch_phone_verification',
        request.ip,
        request.headers['user-agent']
      );
      if (!res.success) {
        return reply.status(400).send({ success: false, error: { code: res.error || 'INVALID_CODE', message: 'Invalid verification code.' } });
      }
      return reply.send({ success: true, message: 'Branch phone verified successfully!', data: res });
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: { code: 'VERIFICATION_FAILED', message: err.message } });
    }
  };

  const resendBranchPhoneVerificationHandler = async (request: any, reply: any) => {
    const { branchId } = request.params as { branchId: string };
    const tenantId = getTenantId(request);
    const body = (request.body as { purpose?: string }) || {};
    try {
      const res = await dataService.resendBranchPhoneVerification(
        branchId,
        tenantId,
        request.user.id,
        body.purpose || 'branch_phone_verification',
        request.ip,
        request.headers['user-agent']
      );
      return reply.send({ success: true, message: 'Verification code resent.', data: res });
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: { code: 'RESEND_FAILED', message: err.message } });
    }
  };

  // -------------------------------------------------------------
  // 13. DEMO INVENTORY CONTEXT (Secure & Isolated)
  // -------------------------------------------------------------
  const demoContextHandler = async (request: any, reply: any) => {
    const tenantId = getTenantId(request);
    const branchId = request.body?.branchId || request.query?.branchId;
    const userId = request.user?.id || request.body?.userId;

    try {
      const invCtx = {
        permissions: ['inventory.view', 'branch.view', 'branch.update'],
      };

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

      // 4. Stateful first-visit check
      const resolvedBranchId = targetBranch?._id || targetBranch?.id || branchId;
      const visit = userId
        ? await dataService.getDashboardVisitStatus({
            userId,
            organizationId: request.tenantContext?.organizationId || tenantId,
            workspaceId: tenantId,
            branchId: resolvedBranchId,
            productKey: 'inventory',
          })
        : {
            isFirstVisit: true,
            visitCount: 0,
            firstVisitedAt: null,
          };

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
          visit: {
            isFirstVisit: visit.isFirstVisit,
            visitCount: visit.visitCount,
            firstVisitedAt: visit.firstVisitedAt,
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

  const listBranchMembersHandler = async (request: any, reply: any) => {
    const { branchId } = request.params as { branchId: string };
    try {
      const members = await dataService.getBranchMembers(getTenantId(request), branchId, 'inventory');
      return reply.send({ success: true, members, data: { members }, requestId: request.id });
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: { code: 'BRANCH_MEMBERS_LIST_FAILED', message: err.message || 'Unable to load branch staff.' } });
    }
  };

  const upsertBranchMemberHandler = async (request: any, reply: any) => {
    const { branchId } = request.params as { branchId: string };
    const body = z.object({ userId: z.string().min(1), role: z.enum(['branch_manager', 'sales_attendant', 'stock_manager', 'viewer']) }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Invalid branch staff assignment.' } });
    try {
      await dataService.upsertBranchMember({ workspaceId: getTenantId(request), branchId, userId: body.data.userId, callerUserId: request.user.id, role: body.data.role });
      await logBranchAudit(request, 'branch.member_assigned', 'branch.member_assigned', branchId, body.data);
      return reply.send({ success: true, message: 'Branch staff assignment saved.', requestId: request.id });
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: { code: err.message || 'BRANCH_MEMBER_ASSIGNMENT_FAILED', message: err.message || 'Unable to save branch staff assignment.' } });
    }
  };

  const removeBranchMemberHandler = async (request: any, reply: any) => {
    const { branchId, userId } = request.params as { branchId: string; userId: string };
    try {
      await dataService.removeBranchMember({ workspaceId: getTenantId(request), branchId, userId, callerUserId: request.user.id });
      await logBranchAudit(request, 'branch.member_removed', 'branch.member_removed', branchId, { userId });
      return reply.send({ success: true, requestId: request.id });
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: { code: err.message || 'BRANCH_MEMBER_REMOVE_FAILED', message: err.message || 'Unable to remove branch staff assignment.' } });
    }
  };

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

    // 9. Branch Phone Verification
    fastify.post(
      `${prefix}/inventory/branches/:branchId/phone/verification/start`,
      { preHandler: [...branchActivePreHandlers, fastify.requireBranchPermission('branch.update')] },
      startBranchPhoneVerificationHandler
    );
    fastify.post(
      `${prefix}/inventory/branches/:branchId/phone/verification/verify`,
      { preHandler: [...branchActivePreHandlers, fastify.requireBranchPermission('branch.update')] },
      verifyBranchPhoneVerificationHandler
    );
    fastify.post(
      `${prefix}/inventory/branches/:branchId/phone/verification/resend`,
      { preHandler: [...branchActivePreHandlers, fastify.requireBranchPermission('branch.update')] },
      resendBranchPhoneVerificationHandler
    );

    // 10. Branch team assignment is a first-class, tenant-scoped lifecycle.
    fastify.get(`${prefix}/inventory/branches/:branchId/members`, { preHandler: [...branchPreHandlers, fastify.requireBranchPermission('branch.view')] }, listBranchMembersHandler);
    fastify.post(`${prefix}/inventory/branches/:branchId/members`, { preHandler: [...branchActivePreHandlers, fastify.requireWorkspaceRole(['owner', 'admin'])] }, upsertBranchMemberHandler);
    fastify.patch(`${prefix}/inventory/branches/:branchId/members/:userId`, { preHandler: [...branchActivePreHandlers, fastify.requireWorkspaceRole(['owner', 'admin'])] }, upsertBranchMemberHandler);
    fastify.delete(`${prefix}/inventory/branches/:branchId/members/:userId`, { preHandler: [...branchActivePreHandlers, fastify.requireWorkspaceRole(['owner', 'admin'])] }, removeBranchMemberHandler);

    // 13. Demo Context
    fastify.post(`${prefix}/inventory/demo-context`, { preHandler: basePreHandlers }, demoContextHandler);
    fastify.get(`${prefix}/inventory/demo-context`, { preHandler: basePreHandlers }, demoContextHandler);
    fastify.get(`${prefix}/inventory/context`, { preHandler: basePreHandlers }, demoContextHandler);
  }

  // Dashboard activity is scoped to the same tenant guard chain as inventory context.
  const logDashboardOpenedHandler = async (request: any, reply: any) => {
    const tenantId = getTenantId(request);
    const branchId = request.body?.branchId || request.query?.branchId;
    const userId = request.user?.id || request.body?.actorUserId || request.body?.userId;

    try {
      if (tenantId) {
        await dataService.logAudit({
          actorUserId: userId || 'system',
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

        if (userId) {
          await dataService.recordDashboardVisit({
            userId,
            organizationId: request.tenantContext?.organizationId || tenantId,
            workspaceId: tenantId,
            branchId,
            productKey: 'inventory',
          });
        }
      }
      return reply.send({ success: true });
    } catch (err: any) {
      request.log.warn({ err, tenantId }, 'Failed to log dashboard opened');
      return reply.send({ success: false });
    }
  };
  for (const prefix of prefixes) {
    fastify.post(`${prefix}/inventory/log-dashboard-opened`, { preHandler: basePreHandlers }, logDashboardOpenedHandler);
  }

  // Top-level dashboard welcome acknowledgment (deprecated no-op)
  fastify.post('/inventory/acknowledge-welcome', async (_request: any, reply: any) => {
    return reply.send({ success: true });
  });
};
