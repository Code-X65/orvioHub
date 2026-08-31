import type { FastifyPluginAsync } from 'fastify';
import { dataService } from '../services/dataService.js';
import { entitlementService } from '../services/entitlementService.js';
import { ERROR_CODES } from '../config/constants.js';

export const productsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/products - List visible products (active + coming_soon, no draft)
  fastify.get(
    '',
    {
      schema: {
        tags: ['Products'],
        summary: 'List all visible platform applications (active and coming soon)',
      },
    },
    async (request, reply) => {
      try {
        const products = await dataService.listVisibleProducts();
        return reply.send({
          success: true,
          data: { products: products || [] },
        });
      } catch (err: any) {
        request.log.error({ err }, 'Failed to list visible products');
        return reply.status(500).send({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Failed to list products.',
          },
        });
      }
    }
  );

  // POST /api/v1/products/:productKey/notify - Join waitlist for coming soon product
  fastify.post(
    '/:productKey/notify',
    {
      schema: {
        tags: ['Products'],
        summary: 'Join waitlist for a coming soon application',
        params: {
          type: 'object',
          required: ['productKey'],
          properties: {
            productKey: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
          },
        },
      },
    },
    async (request, reply) => {
      const { productKey } = request.params as { productKey: string };
      const body = (request.body as { email?: string }) || {};

      // Resolve email from user session if authenticated, or payload
      let email = body.email;
      let userId: string | undefined;

      if (!email) {
        try {
          await fastify.authenticate(request, reply);
          if (request.user) {
            email = request.user.email;
            userId = request.user.id;
          }
        } catch {
          // Unauthenticated
        }
      }

      if (!email) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'A valid email address is required to join the waitlist.',
          },
        });
      }

      try {
        const result = (await dataService.addToNotifyList(productKey, email, userId)) as any;
        return reply.send({
          success: true,
          data: {
            alreadySubscribed: Boolean(result?.alreadySubscribed),
            productKey,
            email,
          },
          message: result?.alreadySubscribed
            ? 'You are already on the waitlist for this product.'
            : 'You have been added to the waitlist. We will notify you upon launch!',
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Failed to join waitlist.',
          },
        });
      }
    }
  );

  // GET /api/v1/workspaces/:workspaceId/available-products
  fastify.get(
    '/workspaces/:workspaceId/available-products',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Products'],
        summary: 'List visible products with workspace activation status',
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
        const products = await dataService.getAvailableProductsForWorkspace(workspaceId);
        return reply.send({
          success: true,
          data: { products: products || [] },
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.NOT_FOUND,
            message: err.message || 'Workspace not found.',
          },
        });
      }
    }
  );

  // POST /api/v1/workspaces/:workspaceId/products/:productKey/activate
  fastify.post(
    '/workspaces/:workspaceId/products/:productKey/activate',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Products'],
        summary: 'Activate a product for a workspace',
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
          properties: {
            planId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { workspaceId, productKey } = request.params as {
        workspaceId: string;
        productKey: string;
      };
      const body = (request.body as { planId?: string }) || {};

      try {
        const product: any = await dataService.getProductByKey(productKey);
        const s = (product?.status || '').toLowerCase();
        if (s !== 'active') {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'PRODUCT_NOT_ACTIVE',
              message: 'This product is not yet available for activation.',
            },
          });
        }

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

        const result = (await dataService.activateProductForWorkspace(
          workspaceId,
          productKey,
          request.user.id,
          body.planId
        )) as any;

        return reply.send({
          success: true,
          message: `Product ${product.name || productKey} activated successfully.`,
          data: result,
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: err.message || 'Failed to activate product.',
          },
        });
      }
    }
  );
};
