import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { dataService } from '../../services/dataService.js';
import { ERROR_CODES } from '../../config/constants.js';
import { env } from '../../config/env.js';

export const adminProductsRoutes: FastifyPluginAsync = async (fastify) => {
  const requireSingleAdmin = async (request: FastifyRequest, reply: FastifyReply) => {
    await fastify.authenticate(request, reply);
    if (reply.sent) return;

    // AC-8: Single Admin Security - restrict to ADMIN_USER_ID if configured
    if (env.ADMIN_USER_ID && request.user?.id !== env.ADMIN_USER_ID) {
      return reply.status(403).send({
        success: false,
        error: {
          code: ERROR_CODES.PERMISSION_DENIED,
          message: 'Access forbidden. Platform administrator privileges required.',
        },
      });
    }
  };

  // GET /api/v1/admin/products - List all products (including draft)
  fastify.get(
    '',
    {
      preHandler: [requireSingleAdmin],
      schema: {
        tags: ['Admin Products'],
        summary: 'List all platform catalog products (including draft)',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      try {
        const products = await dataService.listAllProducts();
        return reply.send({
          success: true,
          data: { products: products || [] },
        });
      } catch (err: any) {
        request.log.error({ err }, 'Failed to list admin products');
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

  // GET /api/v1/admin/products/:productKey - Get single product with usage stats
  fastify.get(
    '/:productKey',
    {
      preHandler: [requireSingleAdmin],
      schema: {
        tags: ['Admin Products'],
        summary: 'Get single product with live tenant usage statistics',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['productKey'],
          properties: {
            productKey: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { productKey } = request.params as { productKey: string };
      try {
        const product = await dataService.getProductByKey(productKey);
        const stats = await dataService.getProductUsageStats(productKey);
        return reply.send({
          success: true,
          data: { product, stats },
        });
      } catch (err: any) {
        return reply.status(404).send({
          success: false,
          error: {
            code: ERROR_CODES.NOT_FOUND,
            message: err.message || 'Product not found.',
          },
        });
      }
    }
  );

  // POST /api/v1/admin/products - Create new product
  fastify.post(
    '',
    {
      preHandler: [requireSingleAdmin],
      schema: {
        tags: ['Admin Products'],
        summary: 'Create a new modular product in platform registry',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['name', 'description', 'status', 'displayOrder'],
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            status: { type: 'string', enum: ['active', 'coming_soon', 'draft'] },
            displayOrder: { type: 'number' },
            isBeta: { type: 'boolean' },
            isFeatured: { type: 'boolean' },
            iconUrl: { type: 'string' },
            documentationUrl: { type: 'string' },
            supportEmail: { type: 'string' },
            key: { type: 'string' },
            subdomain: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as {
        name: string;
        description: string;
        status: 'active' | 'coming_soon' | 'draft';
        displayOrder: number;
        isBeta?: boolean;
        isFeatured?: boolean;
        iconUrl?: string;
        documentationUrl?: string;
        supportEmail?: string;
        key?: string;
        subdomain?: string;
      };

      try {
        const product = await dataService.createProduct(body);
        return reply.status(201).send({
          success: true,
          message: 'Product created successfully.',
          data: { product },
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: err.message || 'Failed to create product.',
          },
        });
      }
    }
  );

  // PATCH /api/v1/admin/products/:productKey - Update product
  fastify.patch(
    '/:productKey',
    {
      preHandler: [requireSingleAdmin],
      schema: {
        tags: ['Admin Products'],
        summary: 'Update product properties and visibility status',
        security: [{ bearerAuth: [] }],
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
            name: { type: 'string' },
            description: { type: 'string' },
            status: { type: 'string', enum: ['active', 'coming_soon', 'draft', 'ACTIVE', 'BETA', 'COMING_SOON'] },
            isBeta: { type: 'boolean' },
            isFeatured: { type: 'boolean' },
            displayOrder: { type: 'number' },
            iconUrl: { type: 'string' },
            documentationUrl: { type: 'string' },
            supportEmail: { type: 'string' },
            subdomain: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { productKey } = request.params as { productKey: string };
      const body = request.body as any;

      try {
        const product = await dataService.updateProduct(productKey, body);
        return reply.send({
          success: true,
          message: 'Product updated successfully.',
          data: { product },
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: err.message || 'Failed to update product.',
          },
        });
      }
    }
  );

  // POST /api/v1/admin/products/:productKey/archive - Archive product
  fastify.post(
    '/:productKey/archive',
    {
      preHandler: [requireSingleAdmin],
      schema: {
        tags: ['Admin Products'],
        summary: 'Archive product to draft status',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['productKey'],
          properties: {
            productKey: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { productKey } = request.params as { productKey: string };
      try {
        await dataService.archiveProduct(productKey);
        return reply.send({
          success: true,
          message: 'Product archived successfully.',
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Failed to archive product.',
          },
        });
      }
    }
  );

  // DELETE /api/v1/admin/products/:productKey - Delete draft product (hard delete)
  fastify.delete(
    '/:productKey',
    {
      preHandler: [requireSingleAdmin],
      schema: {
        tags: ['Admin Products'],
        summary: 'Permanently delete draft product from registry',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['productKey'],
          properties: {
            productKey: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { productKey } = request.params as { productKey: string };
      try {
        const product: any = await dataService.getProductByKey(productKey);
        const s = (product?.status || '').toLowerCase();
        if (s !== 'draft') {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'NOT_DRAFT',
              message: 'Only draft products can be deleted.',
            },
          });
        }

        await dataService.deleteProduct(productKey);
        return reply.send({
          success: true,
          message: 'Draft product deleted successfully.',
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Failed to delete product.',
          },
        });
      }
    }
  );

  // GET /api/v1/admin/products/:productKey/notify-list - Get waitlist
  fastify.get(
    '/:productKey/notify-list',
    {
      preHandler: [requireSingleAdmin],
      schema: {
        tags: ['Admin Products'],
        summary: 'Get waitlist subscribers for coming soon product',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['productKey'],
          properties: {
            productKey: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { productKey } = request.params as { productKey: string };
      try {
        const notifyList = (await dataService.getNotifyList(productKey)) || [];
        return reply.send({
          success: true,
          data: {
            notifyList,
            count: notifyList.length,
          },
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Failed to fetch waitlist.',
          },
        });
      }
    }
  );

  // GET /api/v1/admin/products/:productKey/notify-list/export - Export waitlist
  fastify.get(
    '/:productKey/notify-list/export',
    {
      preHandler: [requireSingleAdmin],
      schema: {
        tags: ['Admin Products'],
        summary: 'Export waitlist emails as plain text download',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['productKey'],
          properties: {
            productKey: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { productKey } = request.params as { productKey: string };
      try {
        const notifyList = (await dataService.getNotifyList(productKey)) || [];
        const emails = notifyList.map((item: any) => item.email).join('\n');

        reply.header('Content-Type', 'text/plain; charset=utf-8');
        reply.header('Content-Disposition', `attachment; filename="${productKey}-waitlist.txt"`);
        return reply.send(emails || '# No waitlist subscribers registered yet.\n');
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: err.message || 'Failed to export waitlist.',
          },
        });
      }
    }
  );
};
