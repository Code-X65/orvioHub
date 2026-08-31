import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { dataService } from '../services/dataService.js';
import { entitlementService } from '../services/entitlementService.js';
import { ERROR_CODES, AUDIT_EVENTS } from '../config/constants.js';

const createProductSchema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  name: z.string().min(1, 'Product name is required'),
  category: z.string().default('General'),
  description: z.string().optional(),
  costPrice: z.number().nonnegative(),
  sellingPrice: z.number().positive(),
  stockQuantity: z.number().int().nonnegative().default(0),
  minStockLevel: z.number().int().nonnegative().default(5),
  unit: z.string().default('pcs'),
  imageUrl: z.string().url().optional().or(z.literal('')),
});

const seedSampleSchema = z.object({
  sector: z.enum(['retail', 'groceries', 'fashion', 'electronics']).default('retail'),
});

const recordSaleSchema = z.object({
  items: z.array(
    z.object({
      productId: z.string(),
      quantity: z.number().int().positive(),
    })
  ).min(1, 'At least one item is required for a sale'),
  paymentMethod: z.enum(['CASH', 'CARD', 'TRANSFER', 'SPLIT']).default('CASH'),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  notes: z.string().optional(),
});

export const inventoryRoutes: FastifyPluginAsync = async (fastify) => {
  // All routes require authentication & workspace membership & product entitlement
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.addHook('preHandler', fastify.requireWorkspaceMembership);
  fastify.addHook('preHandler', fastify.requireProductEntitlement('inventory'));

  // GET /api/v1/inventory/products
  fastify.get(
    '/products',
    {
      schema: {
        tags: ['Inventory'],
        summary: 'List products in current workspace inventory',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            category: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const workspaceId = request.workspace!.id;
      const category = (request.query as any)?.category;
      const products = await dataService.getInventoryProducts(workspaceId, category);
      return reply.send({
        success: true,
        data: { products },
      });
    }
  );

  // POST /api/v1/inventory/products
  fastify.post(
    '/products',
    {
      schema: {
        tags: ['Inventory'],
        summary: 'Create a new inventory product',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['sku', 'name', 'costPrice', 'sellingPrice'],
          properties: {
            sku: { type: 'string' },
            name: { type: 'string' },
            category: { type: 'string' },
            description: { type: 'string' },
            costPrice: { type: 'number' },
            sellingPrice: { type: 'number' },
            stockQuantity: { type: 'number' },
            minStockLevel: { type: 'number' },
            unit: { type: 'string' },
            imageUrl: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = createProductSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Invalid product payload.',
            details: parsed.error.format(),
          },
        });
      }

      // Check Plan Limit for Inventory Products
      const entitlement = await entitlementService.checkProductCreationEntitlement(request.workspace!.id, 1);
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

      try {
        const productId = await dataService.createInventoryProduct({
          workspaceId: request.workspace!.id,
          ...parsed.data,
          actorUserId: request.user.id,
        });

        await dataService.logAudit({
          actorUserId: request.user.id,
          workspaceId: request.workspace!.id,
          productKey: 'inventory',
          eventType: 'inventory.product_created',
          resource: 'inventoryProducts',
          entityId: productId,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          metadata: { name: parsed.data.name, sku: parsed.data.sku },
        });

        return reply.status(201).send({
          success: true,
          data: { productId },
          message: 'Product created successfully.',
        });
      } catch (err: any) {
        if (err.message?.includes('PRODUCT_SKU_ALREADY_EXISTS')) {
          return reply.status(409).send({
            success: false,
            error: {
              code: 'SKU_EXISTS',
              message: err.message,
            },
          });
        }
        throw err;
      }
    }
  );

  // POST /api/v1/inventory/products/seed-samples (1-Click Sample Catalog Seeder)
  fastify.post(
    '/products/seed-samples',
    {
      schema: {
        tags: ['Inventory'],
        summary: 'Seed a pre-populated product catalog for testing and quick onboarding',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            sector: { type: 'string', enum: ['retail', 'groceries', 'fashion', 'electronics'] },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = seedSampleSchema.safeParse(request.body || {});
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Invalid sector selection.',
          },
        });
      }

      const result = (await dataService.seedInventorySampleProducts({
        workspaceId: request.workspace!.id,
        sector: parsed.data.sector,
        actorUserId: request.user.id,
      })) as any;

      await dataService.logAudit({
        actorUserId: request.user.id,
        workspaceId: request.workspace!.id,
        productKey: 'inventory',
        eventType: 'inventory.samples_seeded',
        resource: 'inventoryProducts',
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: { sector: parsed.data.sector, count: result.createdCount },
      });

      return reply.send({
        success: true,
        data: result,
        message: `Successfully seeded ${result.createdCount} sample products for ${parsed.data.sector}.`,
      });
    }
  );

  // POST /api/v1/inventory/sales (Process Sale / Guided First Sale POS)
  fastify.post(
    '/sales',
    {
      schema: {
        tags: ['Inventory'],
        summary: 'Process checkout sale with atomic stock deduction and receipt generation',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['items'],
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                required: ['productId', 'quantity'],
                properties: {
                  productId: { type: 'string' },
                  quantity: { type: 'number' },
                },
              },
            },
            paymentMethod: { type: 'string', enum: ['CASH', 'CARD', 'TRANSFER', 'SPLIT'] },
            customerName: { type: 'string' },
            customerPhone: { type: 'string' },
            notes: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = recordSaleSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Invalid sale payload.',
            details: parsed.error.format(),
          },
        });
      }

      try {
        const sale = (await dataService.recordInventorySale({
          workspaceId: request.workspace!.id,
          items: parsed.data.items,
          paymentMethod: parsed.data.paymentMethod,
          customerName: parsed.data.customerName,
          customerPhone: parsed.data.customerPhone,
          notes: parsed.data.notes,
          cashierUserId: request.user.id,
        })) as any;

        await dataService.logAudit({
          actorUserId: request.user.id,
          workspaceId: request.workspace!.id,
          productKey: 'inventory',
          eventType: 'inventory.sale_recorded',
          resource: 'inventorySales',
          entityId: sale.saleId,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          metadata: {
            saleNumber: sale.saleNumber,
            totalAmount: sale.totalAmount,
            itemCount: sale.itemCount,
          },
        });

        return reply.status(201).send({
          success: true,
          data: { sale },
          message: 'Sale recorded and stock adjusted successfully.',
        });
      } catch (err: any) {
        if (err.message?.includes('INSUFFICIENT_STOCK')) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'INSUFFICIENT_STOCK',
              message: err.message,
            },
          });
        }
        throw err;
      }
    }
  );

  // GET /api/v1/inventory/dashboard
  fastify.get(
    '/dashboard',
    {
      schema: {
        tags: ['Inventory'],
        summary: 'Get live inventory telemetry metrics and recent sales stream',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const metrics = await dataService.getInventoryDashboardMetrics(request.workspace!.id);
      return reply.send({
        success: true,
        data: { metrics },
      });
    }
  );
};
