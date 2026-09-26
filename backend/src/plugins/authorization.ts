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
  branchIds?: string[];
}

export interface ProductMembershipContext {
  id?: string;
  productKey: string;
  role: string;
  permissions: string[];
  branchIds?: string[];
  status: string;
}


/** Explicit route data always wins over the persisted branch-header fallback. */
export function resolveRequestedBranchId(request: FastifyRequest, branchIdHeader = 'x-branch-id'): string | undefined {
  return (request.params as any)?.branchId || (request.body as any)?.branchId || (request.query as any)?.branchId || (request.headers[branchIdHeader] as string | undefined);
}

declare module 'fastify' {
  interface FastifyInstance {
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
    resolveBranchScope: (request: FastifyRequest, productKey?: string) => Promise<{ type: 'all' | 'explicit'; branchIds: string[] }>;
    requireBranchAccess: (productKey?: string, branchIdHeader?: string) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    workspace?: WorkspaceContext;
    workspaceMembership?: WorkspaceMembershipContext;
    productMembership?: ProductMembershipContext;
    workspaceProduct?: { id?: string; productKey: string; status: string };
    userPermissions?: string[];
    branchScope?: { type: 'all' | 'explicit'; branchIds: string[] };
  }
}

const plugin: FastifyPluginAsync = async (fastify) => {
  /**
   * The sole branch-scope resolver. An active product scope overrides a
   * workspace scope; omitted scope is all branches only for workspace owners
   * and admins, never for ordinary members.
   */
  fastify.decorate('resolveBranchScope', async function (request: FastifyRequest, productKey = 'inventory') {
    if (!request.workspaceMembership) {
      await fastify.requireWorkspaceMembership(request, {} as FastifyReply);
    }
    const productMem: any = await dataService.getProductMembership(request.workspace!.id, request.user.id, productKey);
    const workspaceIds = request.workspaceMembership?.branchIds || [];
    const productIds = productMem?.status?.toLowerCase() === 'active' ? productMem.branchIds : undefined;
    const ids = productIds && productIds.length > 0 ? productIds : workspaceIds;
    const role = String(request.workspaceMembership?.role || '').toLowerCase();
    const scope = ids.length ? { type: 'explicit' as const, branchIds: ids.map(String) }
      : (role === 'owner' || role === 'admin') ? { type: 'all' as const, branchIds: [] }
      : { type: 'explicit' as const, branchIds: [] };
    request.branchScope = scope;
    return scope;
  });
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

  // Resolve workspace without requiring active membership
  fastify.decorate(
    'resolveWorkspace',
    async function (request: FastifyRequest, reply: FastifyReply) {
      const workspaceId =
        (request.params as any)?.workspaceId ||
        (request.params as any)?.id ||
        (request.headers['x-workspace-id'] as string);

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
        branchIds: membership.branchIds,
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

  // Product routes still declare their product key for permission checks, but MVP
  // access is not gated by a per-workspace activation record.
  fastify.decorate('requireProductEntitlement', function (productKey: string) {
    return async function (request: FastifyRequest, reply: FastifyReply) {
      const normKey = productKey.toLowerCase();
      if (!request.workspace) {
        await fastify.requireWorkspaceMembership(request, reply);
        if (reply.sent) return;
      }
      request.workspaceProduct = { productKey: normKey, status: 'available' };
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

      // Product scopes take precedence. If a product membership has no explicit
      // branches, fall back to workspace scope; non-admins with no scope get no
      // branches, never implicit access to every branch.
      const branchScope = await fastify.resolveBranchScope(request, productKey);

      request.productMembership = {
        id: productMem?._id,
        productKey,
        role,
        permissions,
        branchIds: productMem?.branchIds,
        status: productMem?.status || (isOwnerOrAdmin ? 'active' : 'inactive'),
      };

      request.userPermissions = permissions;
      request.branchScope = branchScope;

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
        // Route/query/body scope is an explicit request and must win over the
        // UI's persisted x-branch-id fallback header.
        const requestedBranchId = resolveRequestedBranchId(request, branchHeader);

        if (requestedBranchId && branchScope.type !== 'all' && !branchScope.branchIds.includes(requestedBranchId)) {
          await dataService.logAudit({ actorUserId: request.user.id, workspaceId: request.workspace!.id, productKey, eventType: 'branch.access_denied', resource: 'branches', entityId: requestedBranchId, metadata: { reason: 'branch_scope_mismatch' } });
          return reply.status(403).send({ success: false, error: { code: 'branch_access_denied', message: 'You do not have access to this branch.' } });
        }
      }
    };
  });

  fastify.decorate('requireBranchAccess', function (productKey = 'inventory', branchIdHeader = 'x-branch-id') {
    return async function (request: FastifyRequest, reply: FastifyReply) {
      if (!request.workspaceMembership) {
        await fastify.requireWorkspaceMembership(request, reply);
        if (reply.sent) return;
      }
      const requestedBranchId = resolveRequestedBranchId(request, branchIdHeader);
      if (!requestedBranchId) return reply.status(400).send({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Branch ID is required.' } });
      const branch: any = await dataService.getBranchById(String(requestedBranchId));
      if (!branch || String(branch.workspaceId) !== String(request.workspace!.id)) {
        return reply.status(404).send({ success: false, error: { code: 'not_found', message: 'Branch not found in this workspace.' } });
      }
      const scope = await fastify.resolveBranchScope(request, productKey);
      if (scope.type !== 'all' && !scope.branchIds.includes(String(requestedBranchId))) {
        await dataService.logAudit({ actorUserId: request.user.id, workspaceId: request.workspace!.id, productKey, eventType: 'branch.access_denied', resource: 'branches', entityId: String(requestedBranchId), metadata: { reason: 'branch_scope_mismatch' } });
        return reply.status(403).send({ success: false, error: { code: 'branch_access_denied', message: 'You do not have access to this branch.' } });
      }
    };
  });
};

export const authorizationPlugin = fp(plugin, {
  name: 'authorization-plugin',
  dependencies: ['auth-plugin'],
});
