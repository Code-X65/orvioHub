import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { dataService } from '../services/dataService.js';
import { ERROR_CODES } from '../config/constants.js';
import { hasPermission, getProductRoleDefaultPermissions } from '../config/permissions.js';

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

declare module 'fastify' {
  interface FastifyInstance {
    resolveWorkspace: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireWorkspaceMembership: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireWorkspaceRole: (roles: string[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireProductEntitlement: (productKey: string) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireProductPermission: (
      productKey: string,
      permission: string,
      options?: { branchIdHeader?: string; requireBranchAccess?: boolean }
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    workspace?: WorkspaceContext;
    workspaceMembership?: WorkspaceMembershipContext;
    productMembership?: ProductMembershipContext;
    userPermissions?: string[];
    branchScope?: string[];
  }
}

const plugin: FastifyPluginAsync = async (fastify) => {
  // Resolve workspace without requiring active membership
  fastify.decorate(
    'resolveWorkspace',
    async function (request: FastifyRequest, reply: FastifyReply) {
      const workspaceId =
        (request.headers['x-workspace-id'] as string) ||
        (request.params as any)?.workspaceId ||
        (request.params as any)?.id;

      if (!workspaceId) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Workspace identifier required via x-workspace-id header or route parameter.',
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
      };
    }
  );

  // Require active workspace membership
  fastify.decorate(
    'requireWorkspaceMembership',
    async function (request: FastifyRequest, reply: FastifyReply) {
      if (!request.workspace) {
        await fastify.resolveWorkspace(request, reply);
        if (reply.sent) return;
      }

      const workspaceId = request.workspace!.id;
      const membership = (await dataService.getWorkspaceMembership(workspaceId, request.user.id)) as any;
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

  // Require product entitlement (e.g. "inventory", "taskmanagement")
  fastify.decorate('requireProductEntitlement', function (productKey: string) {
    return async function (request: FastifyRequest, reply: FastifyReply) {
      if (!request.workspace) {
        await fastify.requireWorkspaceMembership(request, reply);
        if (reply.sent) return;
      }

      const products = (await dataService.getWorkspaceProducts(request.workspace!.id)) as any[];
      const product = products.find(
        (p: any) => p.productKey?.toLowerCase() === productKey.toLowerCase()
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
};

export const authorizationPlugin = fp(plugin, {
  name: 'authorization-plugin',
  dependencies: ['auth-plugin'],
});
