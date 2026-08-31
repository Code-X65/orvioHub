import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { dataService } from '../services/dataService.js';
import { entitlementService } from '../services/entitlementService.js';
import { smsService } from '../services/smsService.js';
import { validateNigerianPhone } from '../utils/phoneValidation.js';
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

      // Check Plan Limit for Workspace Creation
      const entitlement = await entitlementService.checkWorkspaceCreationEntitlement(request.user.id);
      if (!entitlement.allowed) {
        return reply.status(403).send({
          success: false,
          error: {
            code: ERROR_CODES.PLAN_LIMIT_REACHED,
            message: entitlement.error,
            current: entitlement.current,
            limit: entitlement.limit,
            planKey: entitlement.planKey,
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
        if (err.message?.includes('PLAN_LIMIT_REACHED')) {
          return reply.status(403).send({
            success: false,
            error: {
              code: 'PLAN_LIMIT_REACHED',
              message: 'You have reached the maximum number of organizations allowed for your current plan.',
            },
          });
        }
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

  // DELETE /api/v1/workspaces/:workspaceId
  fastify.delete(
    '/:workspaceId',
    {
      schema: {
        tags: ['Workspaces'],
        summary: 'Soft-delete a workspace (Owner only)',
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
      try {
        await dataService.deleteWorkspace(workspaceId, request.user.id);
        return reply.send({
          success: true,
          message: 'Workspace deleted successfully.',
        });
      } catch (err: any) {
        if (err.message?.includes('WORKSPACE_ACCESS_DENIED')) {
          return reply.status(403).send({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'Only the workspace owner can delete this organization.',
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

  // POST /api/v1/workspaces/:workspaceId/products/:productKey/activate
  fastify.post(
    '/:workspaceId/products/:productKey/activate',
    {
      schema: {
        tags: ['Workspaces'],
        summary: 'Activate a specific product for the workspace',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId', 'productKey'],
          properties: {
            workspaceId: { type: 'string' },
            productKey: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId, productKey } = request.params as { workspaceId: string; productKey: string };

      // Check Plan Limit for App Activations
      const entitlement = await entitlementService.checkAppActivationEntitlement(workspaceId, productKey);
      if (!entitlement.allowed) {
        return reply.status(403).send({
          success: false,
          error: {
            code: ERROR_CODES.PLAN_LIMIT_REACHED,
            message: entitlement.error,
            current: entitlement.current,
            limit: entitlement.limit,
            planKey: entitlement.planKey,
          },
        });
      }

      await dataService.activateWorkspaceProduct({
        workspaceId,
        productKey,
        planId: 'standard',
        userId: request.user.id,
      });
      return reply.send({
        success: true,
        message: `Product '${productKey}' activated successfully.`,
        data: { productKey, status: 'ACTIVE' },
      });
    }
  );

  // GET /api/v1/workspaces/:workspaceId/products/:productKey/access
  fastify.get(
    '/:workspaceId/products/:productKey/access',
    {
      schema: {
        tags: ['Workspaces'],
        summary: 'Get caller access, role, permissions, and assigned branches for product',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId', 'productKey'],
          properties: {
            workspaceId: { type: 'string' },
            productKey: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId, productKey } = request.params as { workspaceId: string; productKey: string };
      const access = await dataService.getProductAccess(workspaceId, productKey, request.user.id);
      return reply.send({
        success: true,
        data: access,
      });
    }
  );

  // GET /api/v1/workspaces/:workspaceId/products/:productKey/members
  fastify.get(
    '/:workspaceId/products/:productKey/members',
    {
      schema: {
        tags: ['Workspaces'],
        summary: 'List members assigned to a specific product within the workspace',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId', 'productKey'],
          properties: {
            workspaceId: { type: 'string' },
            productKey: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId, productKey } = request.params as { workspaceId: string; productKey: string };
      const members = await dataService.getProductMembers(workspaceId, productKey);
      return reply.send({
        success: true,
        data: { members },
      });
    }
  );

  // ==========================================
  // WORKSPACE BRANCH ROUTES
  // ==========================================

  // GET /api/v1/workspaces/:workspaceId/branches
  fastify.get(
    '/:workspaceId/branches',
    {
      schema: {
        tags: ['Workspaces', 'Branches'],
        summary: 'List branches accessible to caller within workspace',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
        querystring: {
          type: 'object',
          properties: { productKey: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const query = (request.query as { productKey?: string }) || {};
      const branches = await dataService.getBranches(workspaceId, request.user.id, query.productKey);
      return reply.send({
        success: true,
        data: { branches: branches || [] },
        branches: branches || [],
      });
    }
  );

  // POST /api/v1/workspaces/:workspaceId/branches
  fastify.post(
    '/:workspaceId/branches',
    {
      schema: {
        tags: ['Workspaces', 'Branches'],
        summary: 'Create a new branch in workspace',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string' },
            code: { type: 'string' },
            isPrimary: { type: 'boolean' },
            country: { type: 'string' },
            state: { type: 'string' },
            stateCode: { type: 'string' },
            lga: { type: 'string' },
            city: { type: 'string' },
            street: { type: 'string' },
            blockNumber: { type: 'string' },
            area: { type: 'string' },
            landmark: { type: 'string' },
            postalCode: { type: 'string' },
            address: { type: 'string' },
            formattedAddress: { type: 'string' },
            phone: { type: 'string' },
            email: { type: 'string' },
            managerId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const body = request.body as {
        name: string;
        code?: string;
        isPrimary?: boolean;
        country?: string;
        state?: string;
        stateCode?: string;
        lga?: string;
        city?: string;
        street?: string;
        blockNumber?: string;
        area?: string;
        landmark?: string;
        postalCode?: string;
        address?: string;
        formattedAddress?: string;
        phone?: string;
        email?: string;
        managerId?: string;
      };

      let normalizedPhone: string | undefined;
      let formattedPhone: string | undefined;
      if (body.phone) {
        const val = validateNigerianPhone(body.phone);
        if (val.valid && val.normalized) {
          normalizedPhone = val.normalized;
          formattedPhone = val.formatted || body.phone;
        }
      }

      try {
        const branchId = await dataService.createBranch({
          workspaceId,
          name: body.name,
          code: body.code,
          isPrimary: body.isPrimary,
          country: body.country || 'Nigeria',
          state: body.state,
          stateCode: body.stateCode,
          lga: body.lga,
          city: body.city,
          street: body.street,
          blockNumber: body.blockNumber,
          area: body.area,
          landmark: body.landmark,
          postalCode: body.postalCode,
          address: body.address,
          formattedAddress: body.formattedAddress,
          phone: formattedPhone || body.phone,
          phoneNormalized: normalizedPhone,
          email: body.email,
          managerId: body.managerId,
          callerUserId: request.user.id,
        });

        const branch = await dataService.getBranchById(branchId);

        return reply.status(201).send({
          success: true,
          message: `Branch '${body.name}' created successfully.`,
          data: { branch },
          branch,
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'BRANCH_CREATION_FAILED',
            message: err.message || 'Failed to create branch.',
          },
        });
      }
    }
  );

  // GET /api/v1/workspaces/:workspaceId/branches/:branchId
  fastify.get(
    '/:workspaceId/branches/:branchId',
    {
      schema: {
        tags: ['Workspaces', 'Branches'],
        summary: 'Get branch details by ID',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId', 'branchId'],
          properties: {
            workspaceId: { type: 'string' },
            branchId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId, branchId } = request.params as { workspaceId: string; branchId: string };
      const branch = await dataService.getBranchById(branchId);

      if (!branch || (branch as any).workspaceId !== workspaceId) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'BRANCH_NOT_FOUND',
            message: 'Branch not found in this workspace.',
          },
        });
      }

      return reply.send({
        success: true,
        data: { branch },
        branch,
      });
    }
  );

  // PATCH /api/v1/workspaces/:workspaceId/branches/:branchId
  fastify.patch(
    '/:workspaceId/branches/:branchId',
    {
      schema: {
        tags: ['Workspaces', 'Branches'],
        summary: 'Update branch details or status',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId', 'branchId'],
          properties: {
            workspaceId: { type: 'string' },
            branchId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            code: { type: 'string' },
            isPrimary: { type: 'boolean' },
            country: { type: 'string' },
            state: { type: 'string' },
            stateCode: { type: 'string' },
            lga: { type: 'string' },
            city: { type: 'string' },
            street: { type: 'string' },
            blockNumber: { type: 'string' },
            area: { type: 'string' },
            landmark: { type: 'string' },
            postalCode: { type: 'string' },
            address: { type: 'string' },
            formattedAddress: { type: 'string' },
            phone: { type: 'string' },
            email: { type: 'string' },
            managerId: { type: 'string' },
            status: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId, branchId } = request.params as { workspaceId: string; branchId: string };
      const body = request.body as {
        name?: string;
        code?: string;
        isPrimary?: boolean;
        country?: string;
        state?: string;
        stateCode?: string;
        lga?: string;
        city?: string;
        street?: string;
        blockNumber?: string;
        area?: string;
        landmark?: string;
        postalCode?: string;
        address?: string;
        formattedAddress?: string;
        phone?: string;
        email?: string;
        managerId?: string;
        status?: string;
      };

      const existing = await dataService.getBranchById(branchId);
      if (!existing || (existing as any).workspaceId !== workspaceId) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'BRANCH_NOT_FOUND',
            message: 'Branch not found in this workspace.',
          },
        });
      }

      let normalizedPhone: string | undefined;
      let formattedPhone: string | undefined;
      if (body.phone) {
        const val = validateNigerianPhone(body.phone);
        if (val.valid && val.normalized) {
          normalizedPhone = val.normalized;
          formattedPhone = val.formatted || body.phone;
        }
      }

      try {
        const updated = await dataService.updateBranch(branchId, {
          ...body,
          phone: formattedPhone || body.phone,
          phoneNormalized: normalizedPhone,
          callerUserId: request.user.id,
        });

        return reply.send({
          success: true,
          message: 'Branch updated successfully.',
          data: { branch: updated },
          branch: updated,
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'BRANCH_UPDATE_FAILED',
            message: err.message || 'Failed to update branch.',
          },
        });
      }
    }
  );

  // POST /api/v1/workspaces/:workspaceId/branches/:branchId/phone/send-otp
  fastify.post(
    '/:workspaceId/branches/:branchId/phone/send-otp',
    {
      schema: {
        tags: ['Workspaces', 'Branches'],
        summary: 'Send OTP verification code to branch contact phone number',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId', 'branchId'],
          properties: {
            workspaceId: { type: 'string' },
            branchId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['phone'],
          properties: {
            phone: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId, branchId } = request.params as { workspaceId: string; branchId: string };
      const body = request.body as { phone: string };

      const branch = await dataService.getBranchById(branchId);
      if (!branch || (branch as any).workspaceId !== workspaceId) {
        return reply.status(404).send({
          success: false,
          error: { code: 'BRANCH_NOT_FOUND', message: 'Branch not found.' },
        });
      }

      const validation = validateNigerianPhone(body.phone);
      if (!validation.valid || !validation.normalized) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_PHONE_NUMBER', message: validation.error || 'Invalid phone number.' },
        });
      }

      // Generate 6-digit OTP code
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpHash = await bcrypt.hash(otp, 10);
      const codeExpiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

      await dataService.saveBranchPhoneOtp({
        branchId,
        phone: validation.formatted || body.phone,
        phoneNormalized: validation.normalized,
        verificationCode: otpHash,
        codeExpiresAt,
      });

      // Dispatch SMS
      await smsService.sendOtp(validation.normalized, otp);

      return reply.send({
        success: true,
        message: `Verification code sent to branch contact ${validation.formatted || validation.normalized}.`,
        data: {
          branchId,
          expiresInSeconds: 600,
        },
      });
    }
  );

  // POST /api/v1/workspaces/:workspaceId/branches/:branchId/phone/verify-otp
  fastify.post(
    '/:workspaceId/branches/:branchId/phone/verify-otp',
    {
      schema: {
        tags: ['Workspaces', 'Branches'],
        summary: 'Verify OTP code for branch contact phone number',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId', 'branchId'],
          properties: {
            workspaceId: { type: 'string' },
            branchId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['otp'],
          properties: {
            otp: { type: 'string', minLength: 6, maxLength: 6 },
          },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId, branchId } = request.params as { workspaceId: string; branchId: string };
      const body = request.body as { otp: string };

      const branch = await dataService.getBranchById(branchId);
      if (!branch || (branch as any).workspaceId !== workspaceId) {
        return reply.status(404).send({
          success: false,
          error: { code: 'BRANCH_NOT_FOUND', message: 'Branch not found.' },
        });
      }

      if ((branch as any).codeExpiresAt && Date.now() > (branch as any).codeExpiresAt) {
        return reply.status(400).send({
          success: false,
          error: { code: 'OTP_EXPIRED', message: 'Verification code has expired. Please request a new one.' },
        });
      }

      if (!(branch as any).verificationCode) {
        return reply.status(400).send({
          success: false,
          error: { code: 'OTP_INVALID', message: 'No active verification code found.' },
        });
      }

      const isMatch = await bcrypt.compare(body.otp.trim(), (branch as any).verificationCode);
      if (!isMatch) {
        return reply.status(400).send({
          success: false,
          error: { code: 'OTP_INVALID', message: 'Incorrect verification code.' },
        });
      }

      await dataService.verifyBranchPhone(branchId);

      return reply.send({
        success: true,
        message: 'Branch contact phone number verified successfully!',
        data: { branchId, phoneVerified: true },
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
