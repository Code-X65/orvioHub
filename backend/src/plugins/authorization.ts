import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { dataService } from '../services/dataService.js';
import { ERROR_CODES } from '../config/constants.js';
import { hasPermission, getProductRoleDefaultPermissions } from '../config/permissions.js';

export interface TenantContext {
  organizationId: string;
  workspaceId?: string;
  userId: string;
  membershipId: string;
  organizationRole?: string;
  workspaceRole?: string;
  productKey?: string;
  branchId?: string;
  permissions: string[];
}

export interface WorkspaceContext {
  id: string;
  name: string;
  slug: string;
  type?: string;
  currency?: string;
  country?: string;
  timezone?: string;
  status: string;
  ownerId?: string;
  organizationId?: string;
}

export interface WorkspaceMembershipContext {
  id: string;
  role: string;
  status: string;
}

export interface ProductMembershipContext {
  id?: string;
  productKey: string;
  role: string;
  permissions: string[];
  branchIds?: string[];
  status: string;
}

export interface BranchContext {
  id: string;
  name: string;
  code?: string;
  workspaceId?: string;
  organizationId?: string;
  productKey?: string;
  applicationId?: string;
  isPrimary?: boolean;
  isActive?: boolean;
  status: string;
}

declare module 'fastify' {
  interface FastifyInstance {
    resolveTenantContext: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    resolveOrganizationContext: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    resolveWorkspaceContext: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    resolveApplicationContext: (productKey?: string) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    resolveBranchContext: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    resolveWorkspace: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireWorkspaceMembership: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireWorkspaceRole: (roles: string[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireProductEntitlement: (productKey: string) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireApplicationAccess: (productKey?: string) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireProductPermission: (
      productKey: string,
      permission: string,
      options?: { branchIdHeader?: string; requireBranchAccess?: boolean }
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    resolveBranch: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireBranchOwnership: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireBranchPermission: (permission: string) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireActiveBranch: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    tenantContext?: TenantContext;
    workspace?: WorkspaceContext;
    workspaceMembership?: WorkspaceMembershipContext;
    productMembership?: ProductMembershipContext;
    userPermissions?: string[];
    branchScope?: string[];
    branch?: BranchContext;
  }
}

const plugin: FastifyPluginAsync = async (fastify) => {
  // Centralized application-access guard
  fastify.decorate('requireApplicationAccess', function (requiredProductKey = 'inventory') {
    return async function (request: FastifyRequest, reply: FastifyReply) {
      const productKey = ((request.params as any)?.productKey || (request.query as any)?.productKey || requiredProductKey).toLowerCase();

      if (productKey !== 'inventory') {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'APPLICATION_NOT_AVAILABLE',
            message: 'This application is not available.',
          },
        });
      }

      if (!request.user) {
        return reply.status(401).send({
          success: false,
          error: {
            code: ERROR_CODES.UNAUTHENTICATED,
            message: 'Authentication required.',
          },
        });
      }

      if (!request.workspace) {
        await fastify.requireWorkspaceMembership(request, reply);
        if (reply.sent) return;
      }

      await fastify.requireProductEntitlement('inventory')(request, reply);
    };
  });

  // Resolve workspace with cross-tenant identifier mismatch verification
  fastify.decorate(
    'resolveWorkspace',
    async function (request: FastifyRequest, reply: FastifyReply) {
      const headerWsId = request.headers['x-workspace-id'] as string | undefined;
      const headerOrgId = request.headers['x-organization-id'] as string | undefined;
      const paramWsId = (request.params as any)?.workspaceId || (request.params as any)?.id;
      const paramOrgId = (request.params as any)?.organizationId;

      const workspaceId = headerWsId || paramWsId || paramOrgId;

      if (!workspaceId) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Workspace identifier required via x-workspace-id header or route parameter.',
          },
        });
      }

      // Check header vs param mismatch if both provided
      if (headerWsId && paramWsId && headerWsId !== paramWsId) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'TENANT_ID_MISMATCH',
            message: 'Header x-workspace-id does not match route workspaceId parameter.',
          },
        });
      }

      const workspace = (await dataService.getWorkspaceById(workspaceId)) as any;
      if (!workspace) {
        return reply.status(404).send({
          success: false,
          error: {
            code: ERROR_CODES.NOT_FOUND,
            message: 'Workspace not found.',
          },
        });
      }

      // Verify header x-organization-id against persisted relationship
      if (headerOrgId && workspace.organizationId && headerOrgId !== workspace.organizationId && headerOrgId !== workspace._id) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'TENANT_ID_MISMATCH',
            message: 'Header x-organization-id does not match the target workspace organization.',
          },
        });
      }

      const status = workspace.status?.toLowerCase() || 'active';
      if (status === 'deleted' || status === 'archived') {
        return reply.status(403).send({
          success: false,
          error: {
            code: ERROR_CODES.WORKSPACE_ACCESS_DENIED,
            message: `Workspace is ${status}.`,
          },
        });
      }

      request.workspace = {
        id: workspace._id || workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        type: workspace.type,
        currency: workspace.currency,
        country: workspace.country,
        timezone: workspace.timezone,
        status: workspace.status,
        ownerId: workspace.ownerId,
        organizationId: workspace.organizationId,
      };
    }
  );

  // Canonical Tenant Context Resolver
  fastify.decorate(
    'resolveTenantContext',
    async function (request: FastifyRequest, reply: FastifyReply) {
      if (!request.user) {
        return reply.status(401).send({
          success: false,
          error: {
            code: ERROR_CODES.UNAUTHENTICATED,
            message: 'Authentication required to resolve tenant context.',
          },
        });
      }

      if (!request.workspace) {
        await fastify.resolveWorkspace(request, reply);
        if (reply.sent) return;
      }

      if (!request.workspaceMembership) {
        await fastify.requireWorkspaceMembership(request, reply);
        if (reply.sent) return;
      }

      const orgId = request.workspace!.organizationId || request.workspace!.id;
      const wsId = request.workspace!.id;
      const role = request.workspaceMembership!.role;
      const isOwnerOrAdmin = role.toLowerCase() === 'owner' || role.toLowerCase() === 'admin';
      const defaultPermissions = getProductRoleDefaultPermissions('inventory', role);

      request.tenantContext = {
        organizationId: orgId,
        workspaceId: wsId,
        userId: request.user.id,
        membershipId: request.workspaceMembership!.id,
        organizationRole: role,
        workspaceRole: role,
        productKey: 'inventory',
        branchId: request.branch?.id,
        permissions: defaultPermissions,
      };
    }
  );

  fastify.decorate('resolveOrganizationContext', function (request: FastifyRequest, reply: FastifyReply) {
    return fastify.resolveTenantContext(request, reply);
  });

  fastify.decorate('resolveWorkspaceContext', function (request: FastifyRequest, reply: FastifyReply) {
    return fastify.resolveTenantContext(request, reply);
  });

  fastify.decorate('resolveApplicationContext', function (productKey = 'inventory') {
    return async function (request: FastifyRequest, reply: FastifyReply) {
      await fastify.resolveTenantContext(request, reply);
      if (reply.sent) return;
      await fastify.requireApplicationAccess(productKey)(request, reply);
    };
  });

  fastify.decorate('resolveBranchContext', function (request: FastifyRequest, reply: FastifyReply) {
    return fastify.resolveBranch(request, reply);
  });

  // Require active workspace membership
  fastify.decorate(
    'requireWorkspaceMembership',
    async function (request: FastifyRequest, reply: FastifyReply) {
      if (!request.workspace) {
        await fastify.resolveWorkspace(request, reply);
        if (reply.sent) return;
      }

      if (request.workspace?.ownerId && String(request.workspace.ownerId) === String(request.user?.id)) {
        request.workspaceMembership = {
          id: 'owner_membership',
          role: 'owner',
          status: 'active',
        };
        return;
      }

      const workspaceId = request.workspace!.id;
      const membership = (await dataService.getWorkspaceMembership(workspaceId, request.user.id).catch(() => null)) as any;
      const memStatus = membership?.status?.toLowerCase();

      if (!membership || memStatus !== 'active') {
        return reply.status(403).send({
          success: false,
          error: {
            code: ERROR_CODES.ORGANIZATION_ACCESS_DENIED,
            message: 'You do not have active access to this workspace.',
          },
        });
      }

      request.workspaceMembership = {
        id: membership._id || membership.id,
        role: membership.role || membership.defaultRole || 'member',
        status: membership.status,
      };
    }
  );

  // Require specific workspace platform role
  fastify.decorate('requireWorkspaceRole', function (allowedRoles: string[]) {
    return async function (request: FastifyRequest, reply: FastifyReply) {
      if (!request.workspaceMembership) {
        await fastify.requireWorkspaceMembership(request, reply);
        if (reply.sent) return;
      }

      const userRole = (request.workspaceMembership?.role || 'member').toLowerCase();
      const normalizedAllowed = allowedRoles.map((r) => r.toLowerCase());

      if (!normalizedAllowed.includes(userRole) && userRole !== 'owner') {
        return reply.status(403).send({
          success: false,
          error: {
            code: ERROR_CODES.ORGANIZATION_ACCESS_DENIED,
            message: `Action requires one of the following roles: ${allowedRoles.join(', ')}.`,
          },
        });
      }
    };
  });

  // Require product entitlement (e.g. "inventory")
  fastify.decorate('requireProductEntitlement', function (productKey: string) {
    return async function (request: FastifyRequest, reply: FastifyReply) {
      const normKey = productKey.toLowerCase();
      if (normKey !== 'inventory') {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'APPLICATION_NOT_AVAILABLE',
            message: `Product '${productKey}' is not available.`,
          },
        });
      }

      if (!request.workspace) {
        await fastify.requireWorkspaceMembership(request, reply);
        if (reply.sent) return;
      }

      const products = (await dataService.getWorkspaceProducts(request.workspace!.id)) as any[];
      const product = products.find(
        (p: any) => p.productKey?.toLowerCase() === normKey
      );

      const prodStatus = product?.status?.toLowerCase();
      const isEntitled = product && (prodStatus === 'active' || prodStatus === 'trial');

      if (!isEntitled) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'PRODUCT_NOT_ENTITLED',
            message: `Product '${productKey}' is not active or enabled for this workspace.`,
          },
        });
      }
    };
  });

  // Require product-level permission with role fallback and branch scoping
  fastify.decorate('requireProductPermission', function (
    productKey: string,
    permission: string,
    options?: { branchIdHeader?: string; requireBranchAccess?: boolean }
  ) {
    return async function (request: FastifyRequest, reply: FastifyReply) {
      // 1. Verify workspace membership
      if (!request.workspaceMembership) {
        await fastify.requireWorkspaceMembership(request, reply);
        if (reply.sent) return;
      }

      // 2. Verify product entitlement
      await fastify.requireProductEntitlement(productKey)(request, reply);
      if (reply.sent) return;

      const wsRole = (request.workspaceMembership?.role || '').toLowerCase();
      const isOwnerOrAdmin = wsRole === 'owner' || wsRole === 'admin';

      // 3. Resolve product membership
      const productMem = (await dataService.getProductMembership(
        request.workspace!.id,
        request.user.id,
        productKey
      )) as any;

      const permissions: string[] = productMem?.permissions || [];
      const role = productMem?.role || (isOwnerOrAdmin ? 'owner' : 'viewer');

      // Populate default permissions if role has defaults and explicit permissions are empty
      if (permissions.length === 0) {
        permissions.push(...getProductRoleDefaultPermissions(productKey, role));
      }

      request.productMembership = {
        id: productMem?._id,
        productKey,
        role,
        permissions,
        branchIds: productMem?.branchIds,
        status: productMem?.status || (isOwnerOrAdmin ? 'active' : 'inactive'),
      };

      request.userPermissions = permissions;

      // 4. Check permission evaluation
      if (!hasPermission(permissions, permission, isOwnerOrAdmin)) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'PERMISSION_DENIED',
            message: `You do not have permission '${permission}' for product '${productKey}'.`,
          },
        });
      }

      // 5. Branch scoping check if requested
      if (options?.requireBranchAccess) {
        const branchHeader = options.branchIdHeader || 'x-branch-id';
        const requestedBranchId = (request.headers[branchHeader] as string) || (request.query as any)?.branchId;

        if (requestedBranchId && productMem?.branchIds && productMem.branchIds.length > 0) {
          if (!productMem.branchIds.includes(requestedBranchId) && !isOwnerOrAdmin) {
            return reply.status(403).send({
              success: false,
              error: {
                code: 'BRANCH_ACCESS_DENIED',
                message: `You do not have access to branch '${requestedBranchId}'.`,
              },
            });
          }
        }
      }
    };
  });

  // Resolve branch from request params or headers
  fastify.decorate(
    'resolveBranch',
    async function (request: FastifyRequest, reply: FastifyReply) {
      const branchId =
        (request.params as any)?.branchId ||
        (request.params as any)?.id ||
        (request.headers['x-branch-id'] as string) ||
        (request.query as any)?.branchId;

      if (!branchId) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Branch identifier required via route parameter or x-branch-id header.',
          },
        });
      }

      let branch: any = null;
      try {
        branch = await dataService.getBranchById(branchId);
        if (!branch) {
          branch = await dataService.getFullBranchSettings(branchId);
        }
      } catch (err) {
        fastify.log.warn({ err, branchId }, 'Failed to resolve branch');
      }

      if (!branch || branch.status === 'deleted' || branch.deletedAt) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'BRANCH_NOT_FOUND',
            message: 'Branch not found.',
          },
        });
      }

      request.branch = {
        id: branch._id || branch.id || branch.branchId || branchId,
        name: branch.name || '',
        code: branch.code,
        workspaceId: branch.workspaceId ? String(branch.workspaceId) : undefined,
        organizationId: branch.organizationId ? String(branch.organizationId) : undefined,
        productKey: branch.productKey || 'inventory',
        applicationId: branch.applicationId ? String(branch.applicationId) : undefined,
        isPrimary: Boolean(branch.isPrimary),
        isActive: branch.isActive ?? (branch.status === 'active'),
        status: branch.status || 'active',
      };
    }
  );

  // Validate branch ownership against workspace/organization
  fastify.decorate(
    'requireBranchOwnership',
    async function (request: FastifyRequest, reply: FastifyReply) {
      if (!request.workspace) {
        await fastify.resolveWorkspace(request, reply);
        if (reply.sent) return;
      }
      if (!request.branch) {
        await fastify.resolveBranch(request, reply);
        if (reply.sent) return;
      }

      const reqWsId = request.workspace!.id;
      const reqOrgId = (request.params as any)?.organizationId || (request.workspace as any)?.organizationId;
      const branchWsId = request.branch!.workspaceId;
      const branchOrgId = request.branch!.organizationId;

      let matches = false;
      if (branchWsId && (branchWsId === reqWsId || branchWsId === reqOrgId)) {
        matches = true;
      }
      if (branchOrgId && (branchOrgId === reqWsId || branchOrgId === reqOrgId)) {
        matches = true;
      }

      if (!matches && request.workspace?.ownerId && String(request.workspace.ownerId) === String(request.user?.id)) {
        matches = true;
      }

      if (!matches) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'BRANCH_NOT_FOUND',
            message: 'Branch not found in this organization.',
          },
        });
      }

      if (request.branch!.productKey && request.branch!.productKey !== 'inventory') {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'APPLICATION_NOT_AVAILABLE',
            message: 'This application is not available.',
          },
        });
      }
    }
  );

  // Require specific branch permission
  fastify.decorate('requireBranchPermission', function (permission: string) {
    return async function (request: FastifyRequest, reply: FastifyReply) {
      if (!request.user) {
        return reply.status(401).send({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication is required.',
          },
        });
      }

      if (!request.workspaceMembership) {
        await fastify.requireWorkspaceMembership(request, reply);
        if (reply.sent) return;
      }

      await fastify.requireBranchOwnership(request, reply);
      if (reply.sent) return;

      const wsRole = (request.workspaceMembership?.role || 'member').toLowerCase();
      const isOwner = wsRole === 'owner';
      const isAdmin = wsRole === 'admin';

      if (isOwner || isAdmin) {
        return;
      }

      const productMem = (await dataService.getProductMembership(
        request.workspace!.id,
        request.user.id,
        'inventory'
      )) as any;

      const permissions: string[] = productMem?.permissions || [];
      const prodRole = (productMem?.role || wsRole).toLowerCase();

      if (permissions.length === 0) {
        permissions.push(...getProductRoleDefaultPermissions('inventory', prodRole));
      }

      if (productMem?.branchIds && productMem.branchIds.length > 0 && request.branch) {
        if (!productMem.branchIds.includes(request.branch.id)) {
          return reply.status(403).send({
            success: false,
            error: {
              code: 'BRANCH_PERMISSION_REQUIRED',
              message: 'You do not have access to this branch.',
            },
          });
        }
      }

      if (!hasPermission(permissions, permission, isOwner || isAdmin)) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'BRANCH_PERMISSION_REQUIRED',
            message: 'You do not have permission to perform this action.',
          },
        });
      }
    };
  });

  // Verify branch is active
  fastify.decorate(
    'requireActiveBranch',
    async function (request: FastifyRequest, reply: FastifyReply) {
      if (!request.branch) {
        await fastify.resolveBranch(request, reply);
        if (reply.sent) return;
      }

      const status = request.branch!.status?.toLowerCase();
      if (status === 'archived' || status === 'deleted') {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'BRANCH_NOT_ACTIVE',
            message: 'Branch is archived or deleted.',
          },
        });
      }
    }
  );
};

export const authorizationPlugin = fp(plugin, {
  name: 'authorization-plugin',
  dependencies: ['auth-plugin'],
});
