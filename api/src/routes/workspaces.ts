import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { dataService } from '../services/dataService.js';
import { ERROR_CODES, AUDIT_EVENTS } from '../config/constants.js';

const createWorkspaceSchema = z.object({
  name: z.string().min(2, 'Workspace name must be at least 2 characters'),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'Slug must only contain lowercase alphanumeric characters and hyphens').optional(),
  type: z.string().optional(),
  typeConfig: z.record(z.any()).optional(),
  country: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  timezone: z.string().optional(),
  currency: z.string().optional(),
  phone: z.string().optional(),
  logoUrl: z.string().url().optional().or(z.literal('')),
  initialProduct: z.string().optional(),
});

const updateWorkspaceSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.string().optional(),
  country: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  timezone: z.string().optional(),
  currency: z.string().optional(),
  phone: z.string().optional(),
  logoUrl: z.string().url().optional().or(z.literal('')),
  enabledModules: z.array(z.string()).optional(),
  settings: z.record(z.any()).optional(),
});

export const workspaceRoutes: FastifyPluginAsync = async (fastify) => {
  // All workspace routes require authentication
  fastify.addHook('preHandler', fastify.authenticate);

  // GET /api/v1/workspaces
  fastify.get(
    '',
    {
      schema: {
        tags: ['Workspaces'],
        summary: 'List workspaces for current user with enabled products and roles',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            product: { type: 'string' },
            search: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const query = (request.query as { product?: string; search?: string }) || {};
      try {
        const workspaces = await dataService.getUserWorkspaces(request.user.id, query.product, query.search);
        return reply.send({
          success: true,
          data: { workspaces: workspaces || [] },
        });
      } catch (err: any) {
        request.log.error({ err, userId: request.user.id, query }, 'Failed to fetch user workspaces');
        return reply.send({
          success: true,
          data: { workspaces: [] },
        });
      }
    }
  );

  // POST /api/v1/workspaces
  fastify.post(
    '',
    {
      schema: {
        tags: ['Workspaces'],
        summary: 'Create a new workspace (No subdomain)',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string' },
            slug: { type: 'string' },
            type: { type: 'string' },
            typeConfig: { type: 'object' },
            country: { type: 'string' },
            state: { type: 'string' },
            city: { type: 'string' },
            timezone: { type: 'string' },
            currency: { type: 'string' },
            phone: { type: 'string' },
            logoUrl: { type: 'string' },
            initialProduct: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = createWorkspaceSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Invalid workspace parameters.',
            details: parsed.error.format(),
          },
        });
      }

      const generatedSlug = (parsed.data.slug || parsed.data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')) + `-${Date.now().toString(36).slice(-4)}`;

      try {
        const workspaceId = (await dataService.createWorkspaceStandalone({
          name: parsed.data.name,
          slug: generatedSlug,
          type: parsed.data.type || 'business',
          typeConfig: parsed.data.typeConfig,
          ownerId: request.user.id,
          country: parsed.data.country || request.user.country || 'NG',
          state: parsed.data.state,
          city: parsed.data.city,
          timezone: parsed.data.timezone || request.user.timezone || 'Africa/Lagos',
          currency: parsed.data.currency || 'NGN',
          phone: parsed.data.phone || request.user.phone,
          logoUrl: parsed.data.logoUrl,
          initialProduct: parsed.data.initialProduct || 'inventory',
        })) as string;

        let context: any = null;
        try {
          context = (await dataService.getWorkspaceContext(workspaceId, request.user.id)) as any;
        } catch {
          // Fallback if getWorkspaceContext is not yet deployed on remote Convex
        }

        return reply.status(201).send({
          success: true,
          message: 'Workspace created successfully.',
          data: {
            workspace: {
              ...(context?.workspace || {}),
              id: workspaceId,
              name: parsed.data.name,
              slug: context?.workspace?.slug || generatedSlug,
              role: (context?.membership?.role || 'OWNER').toUpperCase(),
            },
            membership: context?.membership || {
              role: 'OWNER',
              status: 'active',
            },
            products: context?.products || [{ key: parsed.data.initialProduct || 'inventory', status: 'active' }],
            permissions: context?.permissions || ['*'],
          },
        });
      } catch (err: any) {
        if (err.message?.includes('WORKSPACE_SLUG_ALREADY_EXISTS')) {
          return reply.status(409).send({
            success: false,
            error: {
              code: 'SLUG_TAKEN',
              message: 'Workspace slug is already in use.',
            },
          });
        }
        throw err;
      }
    }
  );

  // POST /api/v1/workspaces/:workspaceId/select
  fastify.post(
    '/:workspaceId/select',
    {
      schema: {
        tags: ['Workspaces'],
        summary: 'Switch active workspace and receive verified authorization context',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: {
            workspaceId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          properties: {
            productKey: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const body = (request.body as { productKey?: string }) || {};

      try {
        const context = await dataService.selectWorkspace(workspaceId, request.user.id, body.productKey);
        return reply.send({
          success: true,
          message: 'Workspace selected successfully.',
          data: context,
        });
      } catch (err: any) {
        if (err.message?.includes('WORKSPACE_ACCESS_DENIED')) {
          return reply.status(403).send({
            success: false,
            error: {
              code: ERROR_CODES.WORKSPACE_ACCESS_DENIED,
              message: 'You do not have access to this workspace.',
            },
          });
        }
        if (err.message?.includes('PRODUCT_NOT_ENTITLED')) {
          return reply.status(403).send({
            success: false,
            error: {
              code: 'PRODUCT_NOT_ENTITLED',
              message: `Product '${body.productKey}' is not enabled or active for this workspace.`,
            },
          });
        }
        if (err.message?.includes('WORKSPACE_NOT_FOUND')) {
          return reply.status(404).send({
            success: false,
            error: {
              code: ERROR_CODES.WORKSPACE_NOT_FOUND,
              message: 'Workspace not found.',
            },
          });
        }
        throw err;
      }
    }
  );

  // GET /api/v1/workspaces/:workspaceId/context
  fastify.get(
    '/:workspaceId/context',
    {
      schema: {
        tags: ['Workspaces'],
        summary: 'Get workspace active context including roles and permissions',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: {
            workspaceId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const context = await dataService.getWorkspaceContext(workspaceId, request.user.id);
      if (!context) {
        return reply.status(404).send({
          success: false,
          error: {
            code: ERROR_CODES.WORKSPACE_NOT_FOUND,
            message: 'Workspace not found or access denied.',
          },
        });
      }

      return reply.send({
        success: true,
        data: context,
      });
    }
  );

  // GET /api/v1/workspaces/:workspaceId
  fastify.get(
    '/:workspaceId',
    {
      schema: {
        tags: ['Workspaces'],
        summary: 'Get workspace by ID',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: {
            workspaceId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const workspace = (await dataService.getWorkspaceById(workspaceId)) as any;
      if (!workspace) {
        return reply.status(404).send({
          success: false,
          error: {
            code: ERROR_CODES.WORKSPACE_NOT_FOUND,
            message: 'Workspace not found.',
          },
        });
      }

      // Verify access to workspace
      let hasAccess = false;
      if (workspace.organizationId) {
        const orgMem = await dataService.getMembership(workspace.organizationId, request.user.id);
        if (orgMem && orgMem.status === 'ACTIVE') hasAccess = true;
      }
      if (!hasAccess) {
        const wsMem = (await dataService.getWorkspaceMembership(workspaceId, request.user.id)) as any;
        if (wsMem && (wsMem.status === 'ACTIVE' || wsMem.status === 'active')) hasAccess = true;
      }
      if (!hasAccess && (workspace.ownerId === request.user.id || workspace.ownerId === (request.user.id as any))) {
        hasAccess = true;
      }

      if (!hasAccess) {
        return reply.status(403).send({
          success: false,
          error: {
            code: ERROR_CODES.WORKSPACE_ACCESS_DENIED,
            message: 'You do not have access to this workspace.',
          },
        });
      }

      const products = await dataService.getWorkspaceProducts(workspaceId);

      return reply.send({
        success: true,
        data: {
          workspace: {
            id: workspace._id || workspace.id,
            name: workspace.name,
            slug: workspace.slug,
            type: workspace.type,
            currency: workspace.currency,
            country: workspace.country,
            state: workspace.state,
            city: workspace.city,
            timezone: workspace.timezone,
            logoUrl: workspace.logoUrl,
            status: workspace.status,
            enabledModules: workspace.enabledModules || [],
            enabledProducts: products,
          },
        },
      });
    }
  );

  // PATCH /api/v1/workspaces/:workspaceId
  fastify.patch(
    '/:workspaceId',
    {
      schema: {
        tags: ['Workspaces'],
        summary: 'Update workspace details',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: {
            workspaceId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const parsed = updateWorkspaceSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Invalid workspace update payload.',
          },
        });
      }

      await dataService.updateWorkspaceSettings(workspaceId, parsed.data);
      return reply.send({
        success: true,
        message: 'Workspace updated successfully.',
      });
    }
  );

  // POST /api/v1/workspaces/:workspaceId/products (Product Entitlement Activation)
  fastify.post(
    '/:workspaceId/products',
    {
      schema: {
        tags: ['Workspaces'],
        summary: 'Activate a product entitlement for the workspace (e.g. inventory, taskmanagement)',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: {
            workspaceId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['productKey'],
          properties: {
            productKey: { type: 'string' },
            planId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const body = request.body as { productKey: string; planId?: string };

      await dataService.activateWorkspaceProduct({
        workspaceId,
        productKey: body.productKey,
        planId: body.planId || 'standard',
        userId: request.user.id,
      });

      return reply.send({
        success: true,
        message: `Product '${body.productKey}' activated for workspace.`,
        data: {
          productKey: body.productKey,
          status: 'ACTIVE',
        },
      });
    }
  );

  // GET /api/v1/workspaces/:workspaceId/products
  fastify.get(
    '/:workspaceId/products',
    {
      schema: {
        tags: ['Workspaces'],
        summary: 'List activated product entitlements for workspace',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const products = await dataService.getWorkspaceProducts(workspaceId);
      return reply.send({
        success: true,
        data: { products },
      });
    }
  );

  // ==========================================
  // WORKSPACE MEMBERSHIP ROUTES
  // ==========================================

  // GET /api/v1/workspaces/:workspaceId/members
  fastify.get(
    '/:workspaceId/members',
    {
      schema: {
        tags: ['Workspaces'],
        summary: 'List workspace members with platform and product roles',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const members = await dataService.getWorkspaceMembers(workspaceId, request.user.id);
      return reply.send({
        success: true,
        data: { members },
      });
    }
  );

  // GET /api/v1/workspaces/:workspaceId/members/:membershipId
  fastify.get(
    '/:workspaceId/members/:membershipId',
    {
      schema: {
        tags: ['Workspaces'],
        summary: 'Get member details by membership ID',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId', 'membershipId'],
          properties: {
            workspaceId: { type: 'string' },
            membershipId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId, membershipId } = request.params as { workspaceId: string; membershipId: string };
      const member = await dataService.getWorkspaceMemberById(workspaceId, membershipId, request.user.id);
      return reply.send({
        success: true,
        data: { member },
      });
    }
  );

  // PATCH /api/v1/workspaces/:workspaceId/members/:membershipId
  fastify.patch(
    '/:workspaceId/members/:membershipId',
    {
      schema: {
        tags: ['Workspaces'],
        summary: 'Update member platform/product role or branch assignments',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId', 'membershipId'],
          properties: {
            workspaceId: { type: 'string' },
            membershipId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['role'],
          properties: {
            role: { type: 'string' },
            productRole: { type: 'string' },
            productKey: { type: 'string' },
            branchIds: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId, membershipId } = request.params as { workspaceId: string; membershipId: string };
      const body = request.body as {
        role: string;
        productRole?: string;
        productKey?: string;
        branchIds?: string[];
      };

      await dataService.updateWorkspaceMemberRole({
        workspaceId,
        membershipId,
        callerUserId: request.user.id,
        role: body.role,
        productRole: body.productRole,
        productKey: body.productKey,
        branchIds: body.branchIds,
      });

      return reply.send({
        success: true,
        message: 'Member updated successfully.',
      });
    }
  );

  // POST /api/v1/workspaces/:workspaceId/members/:membershipId/suspend
  fastify.post(
    '/:workspaceId/members/:membershipId/suspend',
    {
      schema: {
        tags: ['Workspaces'],
        summary: 'Suspend a workspace member',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId', 'membershipId'],
          properties: {
            workspaceId: { type: 'string' },
            membershipId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          properties: { reason: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId, membershipId } = request.params as { workspaceId: string; membershipId: string };
      const body = (request.body as { reason?: string }) || {};

      await dataService.suspendWorkspaceMember(workspaceId, membershipId, request.user.id, body.reason);
      return reply.send({
        success: true,
        message: 'Member has been suspended.',
      });
    }
  );

  // POST /api/v1/workspaces/:workspaceId/members/:membershipId/restore
  fastify.post(
    '/:workspaceId/members/:membershipId/restore',
    {
      schema: {
        tags: ['Workspaces'],
        summary: 'Restore a suspended workspace member',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId', 'membershipId'],
          properties: {
            workspaceId: { type: 'string' },
            membershipId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId, membershipId } = request.params as { workspaceId: string; membershipId: string };
      await dataService.restoreWorkspaceMember(workspaceId, membershipId, request.user.id);
      return reply.send({
        success: true,
        message: 'Member has been restored.',
      });
    }
  );

  // DELETE /api/v1/workspaces/:workspaceId/members/:membershipId
  fastify.delete(
    '/:workspaceId/members/:membershipId',
    {
      schema: {
        tags: ['Workspaces'],
        summary: 'Remove a member from the workspace',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId', 'membershipId'],
          properties: {
            workspaceId: { type: 'string' },
            membershipId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          properties: { reason: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId, membershipId } = request.params as { workspaceId: string; membershipId: string };
      const body = (request.body as { reason?: string }) || {};

      await dataService.removeWorkspaceMember(workspaceId, membershipId, request.user.id, body.reason);
      return reply.send({
        success: true,
        message: 'Member removed from workspace.',
      });
    }
  );

  // ==========================================
  // WORKSPACE INVITATION ROUTES
  // ==========================================

  // GET /api/v1/workspaces/:workspaceId/invitations
  fastify.get(
    '/:workspaceId/invitations',
    {
      schema: {
        tags: ['Workspaces'],
        summary: 'List pending and past invitations for workspace',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const invitations = await dataService.getWorkspaceInvitations(workspaceId, request.user.id);
      return reply.send({
        success: true,
        data: { invitations },
      });
    }
  );

  // POST /api/v1/workspaces/:workspaceId/invitations
  fastify.post(
    '/:workspaceId/invitations',
    {
      schema: {
        tags: ['Workspaces'],
        summary: 'Create and send a workspace invitation with product/branch access',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
        body: {
          type: 'object',
          required: ['email', 'role'],
          properties: {
            email: { type: 'string', format: 'email' },
            role: { type: 'string' },
            productKey: { type: 'string' },
            branchIds: { type: 'array', items: { type: 'string' } },
            message: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const body = request.body as {
        email: string;
        role: string;
        productKey?: string;
        branchIds?: string[];
        message?: string;
      };

      const result = await dataService.createWorkspaceInvitation({
        workspaceId,
        callerUserId: request.user.id,
        email: body.email,
        role: body.role,
        productKey: body.productKey,
        branchIds: body.branchIds,
        message: body.message,
      });

      return reply.send({
        success: true,
        message: `Invitation sent to ${body.email}.`,
        data: result,
      });
    }
  );

  // POST /api/v1/workspaces/:workspaceId/invitations/:id/resend
  fastify.post(
    '/:workspaceId/invitations/:id/resend',
    {
      schema: {
        tags: ['Workspaces'],
        summary: 'Resend a workspace invitation with renewed token and expiry',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId', 'id'],
          properties: {
            workspaceId: { type: 'string' },
            id: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { workspaceId: string; id: string };
      const result = await dataService.resendWorkspaceInvitation(id, request.user.id);
      return reply.send({
        success: true,
        message: 'Invitation resent successfully.',
        data: result,
      });
    }
  );

  // POST /api/v1/workspaces/:workspaceId/invitations/:id/revoke
  fastify.post(
    '/:workspaceId/invitations/:id/revoke',
    {
      schema: {
        tags: ['Workspaces'],
        summary: 'Revoke a pending workspace invitation',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId', 'id'],
          properties: {
            workspaceId: { type: 'string' },
            id: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { workspaceId: string; id: string };
      await dataService.revokeWorkspaceInvitation(id, request.user.id);
      return reply.send({
        success: true,
        message: 'Invitation revoked.',
      });
    }
  );
};
