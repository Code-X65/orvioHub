import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { dataService } from '../services/dataService.js';
import { auditService } from '../services/auditService.js';
import { entitlementService } from '../services/entitlementService.js';
import { smsService } from '../services/smsService.js';
import { validateNigerianPhone } from '../utils/phoneValidation.js';
import { ERROR_CODES, AUDIT_EVENTS } from '../config/constants.js';
import { getPlanLimits } from '../config/planLimits.js';

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

  // GET /api/v1/workspaces/eligibility - Workspace / Free Trial Eligibility
  fastify.get(
    '/eligibility',
    {
      schema: {
        tags: ['Workspaces'],
        summary: 'Check workspace & free trial creation eligibility',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      try {
        const eligibility = await dataService.getOrganizationCreationEligibility(request.user.id);
        return reply.send({
          success: true,
          data: eligibility,
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Failed to check workspace eligibility.',
          },
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
            max: entitlement.limit,
            planKey: entitlement.planKey,
            upgradeRequired: true,
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
          ...context,
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
            workspaceId: workspace._id || workspace.id,
            organizationId: workspace.organizationId || null,
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
            max: entitlement.limit,
            planKey: entitlement.planKey,
            upgradeRequired: true,
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

  // GET /api/v1/workspaces/:workspaceId/products/:productKey/is-active
  fastify.get(
    '/:workspaceId/products/:productKey/is-active',
    {
      schema: {
        tags: ['Workspaces'],
        summary: 'Check if a product is active for a workspace',
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
      const { workspaceId, productKey } = request.params as {
        workspaceId: string;
        productKey: string;
      };
      try {
        const isActive = await dataService.isWorkspaceProductActive(workspaceId, productKey);
        return reply.send({
          success: true,
          data: { isActive, workspaceId, productKey },
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Failed to check product activation status.',
          },
        });
      }
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

      // Check branch creation entitlement
      const entitlement = await entitlementService.checkBranchCreationEntitlement(workspaceId, request.user.id);
      if (!entitlement.allowed) {
        return reply.status(403).send({
          success: false,
          error: {
            code: ERROR_CODES.BRANCH_LIMIT_REACHED,
            message: entitlement.error || `You have reached the maximum branches allowed by your plan.`,
            current: entitlement.current,
            limit: entitlement.limit,
            max: entitlement.limit,
            planKey: entitlement.planKey,
            upgradeRequired: true,
          },
        });
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

  // DELETE /api/v1/workspaces/:workspaceId/branches/:branchId - Archive/delete branch
  fastify.delete(
    '/:workspaceId/branches/:branchId',
    {
      schema: {
        tags: ['Workspaces', 'Branches'],
        summary: 'Archive or remove a branch from workspace',
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

      if (existing.isPrimary) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'CANNOT_DELETE_PRIMARY_BRANCH',
            message: 'Cannot delete the primary branch of a workspace.',
          },
        });
      }

      try {
        await dataService.updateBranch(branchId, {
          status: 'archived',
          deletedAt: Date.now(),
          callerUserId: request.user.id,
        });

        return reply.send({
          success: true,
          message: 'Branch successfully archived.',
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'BRANCH_DELETE_FAILED',
            message: err.message || 'Failed to archive branch.',
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

      await dataService.verifyBranchPhone(branchId, workspaceId, request.user.id, body.otp.trim());

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
        data: members,
        members,
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
        summary: 'Create and send a workspace invitation with hybrid organization, app, and branch access',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
        body: {
          type: 'object',
          required: ['email'],
          properties: {
            email: { type: 'string', format: 'email' },
            role: { type: 'string' },
            organizationRole: { type: 'string' },
            appAccess: {
              type: 'array',
              items: {
                type: 'object',
                required: ['productKey', 'appRole', 'branchIds'],
                properties: {
                  productKey: { type: 'string' },
                  appRole: { type: 'string' },
                  branchIds: { type: 'array', items: { type: 'string' } },
                },
              },
            },
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
        role?: string;
        organizationRole?: string;
        appAccess?: Array<{
          productKey: string;
          appRole: string;
          branchIds: string[];
        }>;
        productKey?: string;
        branchIds?: string[];
        message?: string;
      };

      try {
        const result = await dataService.createWorkspaceInvitation({
          workspaceId,
          callerUserId: request.user.id,
          email: body.email,
          role: body.organizationRole || body.role || 'staff',
          organizationRole: body.organizationRole || body.role || 'staff',
          appAccess: body.appAccess,
          productKey: body.productKey,
          branchIds: body.branchIds,
          message: body.message,
        });

        return reply.send({
          success: true,
          message: `Invitation sent to ${body.email}.`,
          data: result,
        });
      } catch (err: any) {
        if (err.message?.includes('ACTIVE_INVITATION_EXISTS')) {
          return reply.status(409).send({
            success: false,
            error: {
              code: 'ACTIVE_INVITATION_EXISTS',
              message: 'An active invitation already exists for this email address.',
            },
          });
        }
        if (err.message?.includes('PLAN_MEMBER_LIMIT_REACHED')) {
          return reply.status(403).send({
            success: false,
            error: {
              code: 'PLAN_MEMBER_LIMIT_REACHED',
              message: err.message.replace('PLAN_MEMBER_LIMIT_REACHED:', '').trim(),
            },
          });
        }
        if (err.message?.includes('SUBSCRIPTION_SUSPENDED')) {
          return reply.status(403).send({
            success: false,
            error: {
              code: 'SUBSCRIPTION_SUSPENDED',
              message: err.message.replace('SUBSCRIPTION_SUSPENDED:', '').trim(),
            },
          });
        }
        throw err;
      }
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

  // ==========================================
  // GRANULAR MEMBER ACCESS & PERMISSIONS
  // ==========================================

  // GET /api/v1/workspaces/:workspaceId/members/:userId/access
  fastify.get(
    '/:workspaceId/members/:userId/access',
    {
      schema: {
        tags: ['Workspaces', 'Members'],
        summary: 'Get granular access matrix for a member (org role, app roles, branch access)',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId', 'userId'],
          properties: {
            workspaceId: { type: 'string' },
            userId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId, userId } = request.params as { workspaceId: string; userId: string };
      const access = await dataService.getMemberAccessDetails(workspaceId, userId, request.user.id);
      return reply.send({
        success: true,
        data: access,
      });
    }
  );

  // PATCH /api/v1/workspaces/:workspaceId/members/:userId/access
  fastify.patch(
    '/:workspaceId/members/:userId/access',
    {
      schema: {
        tags: ['Workspaces', 'Members'],
        summary: 'Update member organization role, app roles, and branch assignments',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId', 'userId'],
          properties: {
            workspaceId: { type: 'string' },
            userId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          properties: {
            organizationRole: { type: 'string' },
            appAccess: {
              type: 'array',
              items: {
                type: 'object',
                required: ['productKey', 'enabled', 'appRole', 'branchIds'],
                properties: {
                  productKey: { type: 'string' },
                  enabled: { type: 'boolean' },
                  appRole: { type: 'string' },
                  branchIds: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId, userId } = request.params as { workspaceId: string; userId: string };
      const body = request.body as {
        organizationRole?: string;
        appAccess?: Array<{
          productKey: string;
          enabled: boolean;
          appRole: string;
          branchIds: string[];
        }>;
      };

      await dataService.updateMemberAccess({
        workspaceId,
        memberUserId: userId,
        callerUserId: request.user.id,
        organizationRole: body.organizationRole,
        appAccess: body.appAccess || [],
      });

      return reply.send({
        success: true,
        message: 'Member access permissions updated.',
      });
    }
  );

  // POST /api/v1/workspaces/:workspaceId/members/:userId/apps
  fastify.post(
    '/:workspaceId/members/:userId/apps',
    {
      schema: {
        tags: ['Workspaces', 'Members'],
        summary: 'Grant or update application access for member',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId', 'userId'],
          properties: {
            workspaceId: { type: 'string' },
            userId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['productKey', 'role'],
          properties: {
            productKey: { type: 'string' },
            role: { type: 'string' },
            branchIds: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId, userId } = request.params as { workspaceId: string; userId: string };
      const body = request.body as { productKey: string; role: string; branchIds?: string[] };

      await dataService.updateMemberAccess({
        workspaceId,
        memberUserId: userId,
        callerUserId: request.user.id,
        appAccess: [
          {
            productKey: body.productKey,
            enabled: true,
            appRole: body.role,
            branchIds: body.branchIds || [],
          },
        ],
      });

      return reply.send({
        success: true,
        message: `App access for ${body.productKey} granted.`,
      });
    }
  );

  // DELETE /api/v1/workspaces/:workspaceId/members/:userId/apps/:productKey
  fastify.delete(
    '/:workspaceId/members/:userId/apps/:productKey',
    {
      schema: {
        tags: ['Workspaces', 'Members'],
        summary: 'Revoke application access from member',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId', 'userId', 'productKey'],
          properties: {
            workspaceId: { type: 'string' },
            userId: { type: 'string' },
            productKey: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId, userId, productKey } = request.params as {
        workspaceId: string;
        userId: string;
        productKey: string;
      };

      await dataService.updateMemberAccess({
        workspaceId,
        memberUserId: userId,
        callerUserId: request.user.id,
        appAccess: [
          {
            productKey,
            enabled: false,
            appRole: 'staff',
            branchIds: [],
          },
        ],
      });

      return reply.send({
        success: true,
        message: `App access for ${productKey} revoked.`,
      });
    }
  );

  // POST /api/v1/workspaces/:workspaceId/members/:userId/branches
  fastify.post(
    '/:workspaceId/members/:userId/branches',
    {
      schema: {
        tags: ['Workspaces', 'Members'],
        summary: 'Grant branch access to member for an application',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId', 'userId'],
          properties: {
            workspaceId: { type: 'string' },
            userId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['productKey', 'branchId'],
          properties: {
            productKey: { type: 'string' },
            branchId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId, userId } = request.params as { workspaceId: string; userId: string };
      const body = request.body as { productKey: string; branchId: string };

      const currentAccess: any = await dataService.getMemberAccessDetails(workspaceId, userId, request.user.id);
      const app = currentAccess.apps.find((a: any) => a.productKey === body.productKey);
      const currentBranches = app ? [...app.branchIds] : [];
      if (!currentBranches.includes(body.branchId)) {
        currentBranches.push(body.branchId);
      }

      await dataService.updateMemberAccess({
        workspaceId,
        memberUserId: userId,
        callerUserId: request.user.id,
        appAccess: [
          {
            productKey: body.productKey,
            enabled: true,
            appRole: app?.role || 'staff',
            branchIds: currentBranches,
          },
        ],
      });

      return reply.send({
        success: true,
        message: 'Branch access granted.',
      });
    }
  );

  // DELETE /api/v1/workspaces/:workspaceId/members/:userId/branches/:branchId
  fastify.delete(
    '/:workspaceId/members/:userId/branches/:branchId',
    {
      schema: {
        tags: ['Workspaces', 'Members'],
        summary: 'Revoke branch access from member',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId', 'userId', 'branchId'],
          properties: {
            workspaceId: { type: 'string' },
            userId: { type: 'string' },
            branchId: { type: 'string' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            productKey: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId, userId, branchId } = request.params as {
        workspaceId: string;
        userId: string;
        branchId: string;
      };
      const query = (request.query as { productKey?: string }) || {};

      const currentAccess: any = await dataService.getMemberAccessDetails(workspaceId, userId, request.user.id);
      const appsToUpdate = query.productKey
        ? currentAccess.apps.filter((a: any) => a.productKey === query.productKey)
        : currentAccess.apps;

      for (const app of appsToUpdate) {
        const remainingBranches = app.branchIds.filter((bId: string) => bId !== branchId);
        await dataService.updateMemberAccess({
          workspaceId,
          memberUserId: userId,
          callerUserId: request.user.id,
          appAccess: [
            {
              productKey: app.productKey,
              enabled: true,
              appRole: app.role,
              branchIds: remainingBranches,
            },
          ],
        });
      }

      return reply.send({
        success: true,
        message: 'Branch access revoked.',
      });
    }
  );

  // ==========================================
  // 3-TIER ROLES, PERMISSIONS & AUDIT LOGS
  // ==========================================

  // GET /api/v1/workspaces/:workspaceId/roles
  fastify.get(
    '/:workspaceId/roles',
    {
      schema: {
        tags: ['Workspaces', 'Roles'],
        summary: 'Get workspace and application role definitions with their permissions',
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
      const roles = await dataService.getRoleDefinitions(workspaceId);
      return reply.send({
        success: true,
        data: roles,
      });
    }
  );

  // POST /api/v1/workspaces/:workspaceId/roles/seed
  fastify.post(
    '/:workspaceId/roles/seed',
    {
      schema: {
        tags: ['Workspaces', 'Roles'],
        summary: 'Seed default role definitions for workspace and applications',
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
      await dataService.seedDefaultRoleDefinitions(workspaceId);
      return reply.send({
        success: true,
        message: 'Default roles seeded successfully.',
      });
    }
  );

  // GET /api/v1/workspaces/:workspaceId/permissions/evaluate
  fastify.get(
    '/:workspaceId/permissions/evaluate',
    {
      schema: {
        tags: ['Workspaces', 'Permissions'],
        summary: 'Evaluate 3-tier user permissions for workspace, application, and branch',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
        querystring: {
          type: 'object',
          properties: {
            applicationKey: { type: 'string' },
            branchId: { type: 'string' },
            userId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const query = request.query as { applicationKey?: string; branchId?: string; userId?: string };
      const targetUserId = query.userId || request.user.id;

      const evaluation = await dataService.resolve3TierPermissions(
        workspaceId,
        targetUserId,
        query.applicationKey,
        query.branchId
      );

      return reply.send({
        success: true,
        data: evaluation,
      });
    }
  );

  // POST /api/v1/workspaces/:workspaceId/permissions/check
  fastify.post(
    '/:workspaceId/permissions/check',
    {
      schema: {
        tags: ['Workspaces', 'Permissions'],
        summary: 'Check if user has a specific permission in workspace context',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
        body: {
          type: 'object',
          required: ['permission'],
          properties: {
            permission: { type: 'string' },
            applicationKey: { type: 'string' },
            branchId: { type: 'string' },
            userId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const body = request.body as { permission: string; applicationKey?: string; branchId?: string; userId?: string };
      const targetUserId = body.userId || request.user.id;

      const result = await dataService.checkUserPermission3Tier(
        workspaceId,
        targetUserId,
        body.permission,
        body.applicationKey,
        body.branchId
      );

      return reply.send({
        success: true,
        data: result,
      });
    }
  );

  // GET /api/v1/workspaces/:workspaceId/audit-logs/memberships
  fastify.get(
    '/:workspaceId/audit-logs/memberships',
    {
      schema: {
        tags: ['Workspaces', 'Audit'],
        summary: 'Query membership audit logs for workspace',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
        querystring: {
          type: 'object',
          properties: {
            targetUserId: { type: 'string' },
            actionType: { type: 'string' },
            membershipType: { type: 'string' },
            limit: { type: 'number' },
          },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const query = request.query as {
        targetUserId?: string;
        actionType?: string;
        membershipType?: string;
        limit?: number;
      };

      const logs = await dataService.getMembershipAuditLogs(workspaceId, request.user.id, query);
      return reply.send({
        success: true,
        data: { logs: logs || [] },
      });
    }
  );

  // GET /api/v1/workspaces/:workspaceId/branch-assignments
  fastify.get(
    '/:workspaceId/branch-assignments',
    {
      schema: {
        tags: ['Workspaces', 'Branches'],
        summary: 'List branch assignments for workspace',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
        querystring: {
          type: 'object',
          properties: {
            branchId: { type: 'string' },
            userId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const query = request.query as { branchId?: string; userId?: string };

      const assignments = await dataService.getBranchAssignments(
        workspaceId,
        request.user.id,
        query.branchId,
        query.userId
      );

      return reply.send({
        success: true,
        data: { assignments: assignments || [] },
      });
    }
  );

  // POST /api/v1/workspaces/:workspaceId/branch-assignments
  fastify.post(
    '/:workspaceId/branch-assignments',
    {
      schema: {
        tags: ['Workspaces', 'Branches'],
        summary: 'Assign a user to a branch with a role (manager, staff, viewer)',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
        body: {
          type: 'object',
          required: ['userId', 'branchId', 'role'],
          properties: {
            userId: { type: 'string' },
            branchId: { type: 'string' },
            role: { type: 'string' },
            reason: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const body = request.body as { userId: string; branchId: string; role: string; reason?: string };

      const result = await dataService.assignBranchRole({
        workspaceId,
        callerUserId: request.user.id,
        targetUserId: body.userId,
        branchId: body.branchId,
        role: body.role,
        reason: body.reason,
      });

      return reply.send({
        success: true,
        message: 'Branch assignment updated.',
        data: result,
      });
    }
  );

  // DELETE /api/v1/workspaces/:workspaceId/branch-assignments/:assignmentId
  fastify.delete(
    '/:workspaceId/branch-assignments/:assignmentId',
    {
      schema: {
        tags: ['Workspaces', 'Branches'],
        summary: 'Remove branch assignment',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId', 'assignmentId'],
          properties: {
            workspaceId: { type: 'string' },
            assignmentId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          properties: {
            reason: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId, assignmentId } = request.params as { workspaceId: string; assignmentId: string };
      const body = (request.body as { reason?: string }) || {};

      await dataService.removeBranchAssignment({
        workspaceId,
        callerUserId: request.user.id,
        assignmentId,
        reason: body.reason,
      });

      return reply.send({
        success: true,
        message: 'Branch assignment removed.',
      });
    }
  );



  // ==========================================
  // APP-SPECIFIC BRANCHES ROUTES
  // ==========================================

  // GET /api/v1/workspaces/:workspaceId/apps/:productKey/branches
  fastify.get(
    '/:workspaceId/apps/:productKey/branches',
    {
      schema: {
        tags: ['Workspaces', 'App Branches'],
        summary: 'List branches for a specific application in workspace',
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
      const { workspaceId, productKey } = request.params as {
        workspaceId: string;
        productKey: string;
      };

      const branches = await dataService.getBranches(workspaceId, request.user.id, productKey);
      const scopedBranches = (branches || []).filter(
        (b: any) => !b.productKey || b.productKey === productKey
      );

      return reply.send({
        success: true,
        data: { branches: scopedBranches },
      });
    }
  );

  // POST /api/v1/workspaces/:workspaceId/apps/:productKey/branches
  fastify.post(
    '/:workspaceId/apps/:productKey/branches',
    {
      schema: {
        tags: ['Workspaces', 'App Branches'],
        summary: 'Create a new branch for a specific application in workspace',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId', 'productKey'],
          properties: {
            workspaceId: { type: 'string' },
            productKey: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string' },
            code: { type: 'string' },
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
            phone: { type: 'string' },
            email: { type: 'string' },
            isPrimary: { type: 'boolean' },
          },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId, productKey } = request.params as {
        workspaceId: string;
        productKey: string;
      };
      const body = request.body as any;

      // Entitlement check
      const entitlement = await entitlementService.checkBranchCreationEntitlement(workspaceId, request.user.id, productKey);
      if (!entitlement.allowed) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'BRANCH_LIMIT_REACHED',
            message: entitlement.error || 'You have reached the maximum branches allowed by your plan.',
            current: entitlement.current,
            limit: entitlement.limit,
            max: entitlement.limit,
            planKey: entitlement.planKey,
            upgradeRequired: true,
          },
        });
      }

      const branch = await dataService.createBranch({
        workspaceId,
        productKey,
        ...body,
      });

      return reply.status(201).send({
        success: true,
        message: 'Branch created successfully.',
        data: { branch },
      });
    }
  );

  // GET /api/v1/workspaces/:workspaceId/entitlements
  fastify.get(
    '/:workspaceId/entitlements',
    {
      schema: {
        tags: ['Workspaces', 'Entitlements'],
        summary: 'Get workspace subscription entitlements and usage limits',
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
      const ctx = await entitlementService.getEntitlementContext(workspaceId, request.user.id);
      return reply.send({
        success: true,
        data: ctx,
      });
    }
  );

  // GET /api/v1/workspaces/:workspaceId/entitlements/usage
  fastify.get(
    '/:workspaceId/entitlements/usage',
    {
      schema: {
        tags: ['Workspaces', 'Entitlements'],
        summary: 'Get workspace resource usage counters',
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
      const usage = await entitlementService.getUsage(workspaceId);
      return reply.send({
        success: true,
        data: usage,
      });
    }
  );

  // GET /api/v1/workspaces/:workspaceId/entitlements/conflicts
  fastify.get(
    '/:workspaceId/entitlements/conflicts',
    {
      schema: {
        tags: ['Workspaces', 'Entitlements'],
        summary: 'Get entitlement conflicts for target downgrade plan',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
        querystring: {
          type: 'object',
          properties: { targetPlan: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const { targetPlan } = request.query as { targetPlan?: string };
      const conflicts = await entitlementService.getConflicts(workspaceId, targetPlan || 'standard');
      return reply.send({
        success: true,
        data: conflicts,
      });
    }
  );

  // POST /api/v1/workspaces/:workspaceId/entitlements/recalculate
  fastify.post(
    '/:workspaceId/entitlements/recalculate',
    {
      schema: {
        tags: ['Workspaces', 'Entitlements'],
        summary: 'Recalculate workspace entitlements',
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
      const res = await entitlementService.recalculate(workspaceId, request.user.id, 'User recalculation');
      return reply.send({
        success: true,
        data: res,
      });
    }
  );

  // GET /api/v1/workspaces/:workspaceId/inventory/entitlements
  fastify.get(
    '/:workspaceId/inventory/entitlements',
    {
      schema: {
        tags: ['Workspaces', 'Entitlements'],
        summary: 'Get inventory application entitlements for workspace',
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
      const ctx = await entitlementService.getEntitlementContext(workspaceId, request.user.id);
      return reply.send({
        success: true,
        data: {
          workspaceId,
          applicationKey: 'inventory',
          enabled: true,
          planKey: ctx.planKey,
          features: ctx.features,
          usage: ctx.usage,
        },
      });
    }
  );

  // GET /api/v1/workspaces/:workspaceId/inventory/branches/eligibility
  fastify.get(
    '/:workspaceId/inventory/branches/eligibility',
    {
      schema: {
        tags: ['Workspaces', 'Entitlements'],
        summary: 'Check branch creation eligibility under inventory entitlements',
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
      const res = await entitlementService.checkBranchCreationEntitlement(workspaceId, request.user.id, 'inventory');
      return reply.send({
        success: true,
        data: res,
      });
    }
  );

  // POST /api/v1/workspaces/:workspaceId/archive
  fastify.post(
    '/:workspaceId/archive',
    {
      schema: {
        tags: ['Workspaces', 'Lifecycle'],
        summary: 'Archive a workspace (Owner only)',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
        body: {
          type: 'object',
          properties: { reason: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const body = (request.body as any) || {};

      try {
        const result = await dataService.workspaceLifecycle.archiveWorkspace(
          workspaceId,
          request.user.id,
          body.reason
        );
        return reply.send({
          success: true,
          message: 'Workspace archived successfully.',
          data: result,
        });
      } catch (err: any) {
        if (err.message?.includes('ONLY_OWNER')) {
          return reply.status(403).send({
            success: false,
            error: { code: 'FORBIDDEN', message: 'Only the workspace owner can archive this workspace.' },
          });
        }
        throw err;
      }
    }
  );

  // POST /api/v1/workspaces/:workspaceId/restore
  fastify.post(
    '/:workspaceId/restore',
    {
      schema: {
        tags: ['Workspaces', 'Lifecycle'],
        summary: 'Restore an archived workspace (Owner only)',
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

      try {
        const result = await dataService.workspaceLifecycle.restoreWorkspace(
          workspaceId,
          request.user.id
        );
        return reply.send({
          success: true,
          message: 'Workspace restored successfully.',
          data: result,
        });
      } catch (err: any) {
        if (err.message?.includes('ONLY_OWNER')) {
          return reply.status(403).send({
            success: false,
            error: { code: 'FORBIDDEN', message: 'Only the workspace owner can restore this workspace.' },
          });
        }
        throw err;
      }
    }
  );

  // POST /api/v1/workspaces/:workspaceId/suspend
  fastify.post(
    '/:workspaceId/suspend',
    {
      schema: {
        tags: ['Workspaces', 'Lifecycle'],
        summary: 'Suspend a workspace (Owner or Admin)',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
        body: {
          type: 'object',
          properties: {
            reason: { type: 'string' },
            notes: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const body = (request.body as any) || {};

      const result = await dataService.workspaceLifecycle.suspendWorkspace(
        workspaceId,
        request.user.id,
        body.reason,
        body.notes
      );
      return reply.send({
        success: true,
        message: 'Workspace suspended successfully.',
        data: result,
      });
    }
  );

  // POST /api/v1/workspaces/:workspaceId/deletion/request
  fastify.post(
    '/:workspaceId/deletion/request',
    {
      schema: {
        tags: ['Workspaces', 'Danger Zone'],
        summary: 'Request workspace deletion with cooling-off period (Owner only)',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
        body: {
          type: 'object',
          properties: { reason: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const body = (request.body as any) || {};

      const result = await dataService.workspaceLifecycle.requestDeletion(
        workspaceId,
        request.user.id,
        body.reason
      );
      return reply.send({
        success: true,
        message: 'Workspace deletion scheduled. You have a 30-day cooling-off period to cancel.',
        data: result,
      });
    }
  );

  // POST /api/v1/workspaces/:workspaceId/deletion/cancel
  fastify.post(
    '/:workspaceId/deletion/cancel',
    {
      schema: {
        tags: ['Workspaces', 'Danger Zone'],
        summary: 'Cancel pending workspace deletion (Owner only)',
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

      const result = await dataService.workspaceLifecycle.cancelDeletion(
        workspaceId,
        request.user.id
      );
      return reply.send({
        success: true,
        message: 'Workspace deletion cancelled.',
        data: result,
      });
    }
  );

  // POST /api/v1/workspaces/:workspaceId/transfer-ownership
  fastify.post(
    '/:workspaceId/transfer-ownership',
    {
      schema: {
        tags: ['Workspaces', 'Danger Zone'],
        summary: 'Transfer workspace ownership to another active member (Owner only)',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
        body: {
          type: 'object',
          required: ['newOwnerUserId'],
          properties: {
            newOwnerUserId: { type: 'string' },
            password: { type: 'string' },
            reason: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const body = request.body as { newOwnerUserId: string; password?: string; reason?: string };

      // Optional step-up password verification
      if (body.password) {
        const caller = await dataService.getUserById(request.user.id);
        if (caller && caller.passwordHash) {
          const isValid = await bcrypt.compare(body.password, caller.passwordHash);
          if (!isValid) {
            return reply.status(401).send({
              success: false,
              error: { code: 'INVALID_PASSWORD', message: 'The confirmation password entered is incorrect.' },
            });
          }
        }
      }

      try {
        const result = await dataService.workspaceLifecycle.transferOwnership(
          workspaceId,
          request.user.id,
          body.newOwnerUserId,
          body.password,
          body.reason
        );
        return reply.send({
          success: true,
          message: 'Workspace ownership transferred successfully.',
          data: result,
        });
      } catch (err: any) {
        if (err.message?.includes('ONLY_OWNER')) {
          return reply.status(403).send({
            success: false,
            error: { code: 'FORBIDDEN', message: 'Only the workspace owner can transfer ownership.' },
          });
        }
        if (err.message?.includes('TARGET_USER_WORKSPACE_LIMIT_REACHED')) {
          return reply.status(400).send({
            success: false,
            error: { code: 'PLAN_LIMIT_REACHED', message: 'The selected user has already reached their workspace ownership limit.' },
          });
        }
        throw err;
      }
    }
  );

  // POST /api/v1/workspaces/:workspaceId/applications/inventory/activate
  fastify.post(
    '/:workspaceId/applications/inventory/activate',
    {
      schema: {
        tags: ['Workspaces', 'Applications'],
        summary: 'Activate Inventory application in workspace',
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
      const result = await dataService.mutate('workspaceApplications:activateInventory', {
        workspaceId: workspaceId as any,
        callerUserId: request.user.id as any,
      });

      return reply.send({
        success: true,
        message: 'Inventory application activated successfully.',
        data: result,
      });
    }
  );



  // GET /api/v1/workspaces/:workspaceId/trial
  fastify.get(
    '/:workspaceId/trial',
    {
      schema: {
        tags: ['Workspaces', 'Billing', 'Trial'],
        summary: 'Get workspace trial status and lifecycle details',
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
      try {
        const trial = await dataService.getWorkspaceTrial(workspaceId);
        if (!trial) {
          return reply.status(404).send({
            success: false,
            error: {
              code: ERROR_CODES.NOT_FOUND,
              message: 'Trial details not found for this workspace.',
            },
          });
        }
        return reply.send({
          success: true,
          data: trial,
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Failed to fetch trial details.',
          },
        });
      }
    }
  );

  // POST /api/v1/workspaces/:workspaceId/trial/reconcile
  fastify.post(
    '/:workspaceId/trial/reconcile',
    {
      schema: {
        tags: ['Workspaces', 'Billing', 'Trial'],
        summary: 'Reconcile trial status based on authoritative server clock',
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
      try {
        const result = await dataService.reconcileWorkspaceTrial(workspaceId, request.user?.id);
        return reply.send({
          success: true,
          message: 'Trial state reconciled successfully.',
          data: result,
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Failed to reconcile trial.',
          },
        });
      }
    }
  );

  // GET /api/v1/workspaces/:workspaceId/audit - Paginated workspace audit trail
  fastify.get(
    '/:workspaceId/audit',
    {
      preHandler: [fastify.requireWorkspaceRole(['owner', 'admin'])],
      schema: {
        tags: ['Workspaces', 'Audit'],
        summary: 'Get workspace audit trail',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
        querystring: {
          type: 'object',
          properties: {
            branchId: { type: 'string' },
            eventType: { type: 'string' },
            severity: { type: 'string' },
            page: { type: 'number' },
            limit: { type: 'number' },
          },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const q = (request.query as any) || {};
      const result = await auditService.getOrganizationAuditLogs(workspaceId, {
        branchId: q.branchId,
        eventType: q.eventType,
        severity: q.severity,
        page: q.page ? Number(q.page) : 1,
        limit: q.limit ? Number(q.limit) : 20,
      });

      return reply.send({
        success: true,
        data: result,
      });
    }
  );

  // GET /api/v1/workspaces/:workspaceId/branches/:branchId/audit - Branch-scoped audit trail
  fastify.get(
    '/:workspaceId/branches/:branchId/audit',
    {
      preHandler: [fastify.requireWorkspaceRole(['owner', 'admin'])],
      schema: {
        tags: ['Workspaces', 'Audit', 'Branches'],
        summary: 'Get branch-scoped audit trail',
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
      const q = (request.query as any) || {};
      const result = await auditService.getOrganizationAuditLogs(workspaceId, {
        branchId,
        eventType: q.eventType,
        severity: q.severity,
        page: q.page ? Number(q.page) : 1,
        limit: q.limit ? Number(q.limit) : 20,
      });

      return reply.send({
        success: true,
        data: result,
      });
    }
  );
};


