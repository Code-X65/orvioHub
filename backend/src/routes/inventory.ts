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

  const requireBodyOrQueryBranch = async (request: any, reply: any) => {
    const branchId = request.body?.branchId || request.query?.branchId;
    if (!branchId) return;
    await fastify.requireBranchAccess('inventory')(request, reply);
  };

  // No branch parameter aggregates only the resolved explicit scope. This is
  // intentionally stricter than treating an omitted branch as workspace-wide.
  const inventoryBranchScope = async (request: any) => fastify.resolveBranchScope(request, 'inventory');

  const catalogScopeFor = async (request: any): Promise<string[] | undefined> => {
    const workspaceRole = String(request.workspaceMembership?.role || '').toLowerCase();
    if (workspaceRole === 'owner' || workspaceRole === 'admin') return undefined;
    const membership: any = await dataService.getProductMembership(request.workspace!.id, request.user.id, 'inventory');
    const scope = membership?.catalogScope;
    return !scope || scope.includes('all') ? undefined : scope;
  };

  // GET /api/v1/inventory/products
  fastify.get(
    '/products',
    {
      preHandler: [requireBodyOrQueryBranch],
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
      const branchScope = await inventoryBranchScope(request);
      if (branchScope.type === 'explicit' && branchScope.branchIds.length === 0) {
        return reply.status(403).send({ success: false, error: { code: 'BRANCH_ACCESS_DENIED', message: 'You do not have access to an inventory branch.' } });
      }
      const products = await dataService.getInventoryProducts(workspaceId, category);
      const catalogScope = await catalogScopeFor(request);
      return reply.send({
        success: true,
        data: { products: catalogScope ? products.filter((product: any) => catalogScope.includes(product.category)) : products },
      });
    }
  );

  // POST /api/v1/inventory/products
  fastify.post(
    '/products',
    {
      preHandler: [requireBodyOrQueryBranch],
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
      preHandler: [requireBodyOrQueryBranch],
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

  // POST /api/v1/inventory/products/import-csv (Bulk Product Catalog Importer)
  fastify.post(
    '/products/import-csv',
    {
      schema: {
        tags: ['Inventory'],
        summary: 'Bulk import products from CSV/Excel data with plan limit check',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['items'],
          properties: {
            items: {
              type: 'array',
              items: {
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
        },
      },
    },
    async (request, reply) => {
      const body = (request.body as { items: any[] }) || { items: [] };
      if (!Array.isArray(body.items) || body.items.length === 0) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'No product rows provided for import.',
          },
        });
      }

      // Check plan limits
      const entitlement = await entitlementService.checkProductCreationEntitlement(
        request.workspace!.id,
        body.items.length
      );
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

      const createdIds: string[] = [];
      const errors: { row: number; sku: string; error: string }[] = [];

      for (let i = 0; i < body.items.length; i++) {
        const item = body.items[i];
        try {
          const parsed = createProductSchema.safeParse(item);
          if (!parsed.success) {
            errors.push({
              row: i + 1,
              sku: item.sku || `Row ${i + 1}`,
              error: 'Missing or invalid fields: ' + Object.keys(parsed.error.format()).join(', '),
            });
            continue;
          }

          const productId = await dataService.createInventoryProduct({
            workspaceId: request.workspace!.id,
            ...parsed.data,
            actorUserId: request.user.id,
          });
          createdIds.push(productId as string);
        } catch (err: any) {
          errors.push({
            row: i + 1,
            sku: item.sku || `Row ${i + 1}`,
            error: err.message || 'Failed to create item',
          });
        }
      }

      await dataService.logAudit({
        actorUserId: request.user.id,
        workspaceId: request.workspace!.id,
        productKey: 'inventory',
        eventType: 'inventory.products_imported',
        resource: 'inventoryProducts',
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: {
          totalRows: body.items.length,
          importedCount: createdIds.length,
          errorCount: errors.length,
        },
      });

      return reply.status(200).send({
        success: true,
        data: {
          importedCount: createdIds.length,
          errorCount: errors.length,
          errors,
          productIds: createdIds,
        },
        message: `Successfully imported ${createdIds.length} of ${body.items.length} products.`,
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
        const catalogScope = await catalogScopeFor(request);
        if (catalogScope) {
          const products = await dataService.getInventoryProducts(request.workspace!.id);
          const restricted = products.filter((product: any) => parsed.data.items.some((item: any) => item.productId === product._id || item.productId === product.id) && !catalogScope.includes(product.category));
          if (restricted.length) {
            return reply.status(403).send({ success: false, error: { code: 'CATALOG_ACCESS_DENIED', message: 'You are not authorized to sell products outside your assigned categories.' } });
          }
        }
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
        querystring: { type: 'object', properties: { branchId: { type: 'string' } } },
      },
    },
    async (request, reply) => {
      const branchId = (request.query as any)?.branchId;
      if (branchId) await fastify.requireBranchAccess('inventory')(request, reply);
      if (reply.sent) return;
      const scope = await inventoryBranchScope(request);
      const metrics = await dataService.getInventoryDashboardMetrics(request.workspace!.id, branchId, scope.type === 'explicit' ? scope.branchIds : undefined);
      return reply.send({
        success: true,
        data: { metrics },
      });
    }
  );

  // POST /api/v1/inventory/opening-stock (Standalone Opening Stock Entry)
  fastify.post(
    '/opening-stock',
    {
      preHandler: [requireBodyOrQueryBranch],
      schema: {
        tags: ['Inventory'],
        summary: 'Record standalone opening stock quantities and cost valuations in stock movement ledger',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['entries'],
          properties: {
            branchId: { type: 'string' },
            entries: {
              type: 'array',
              items: {
                type: 'object',
                required: ['productId', 'quantity'],
                properties: {
                  productId: { type: 'string' },
                  quantity: { type: 'number' },
                  unitCost: { type: 'number' },
                  totalCost: { type: 'number' },
                  notes: { type: 'string' },
                },
              },
            },
            notes: { type: 'string' },
            flowId: { type: 'string' },
            referenceId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as {
        branchId?: string;
        entries: Array<{
          productId: string;
          quantity: number;
          unitCost?: number;
          totalCost?: number;
          notes?: string;
        }>;
        notes?: string;
        flowId?: string;
        referenceId?: string;
      };

      if (!Array.isArray(body?.entries) || body.entries.length === 0) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'At least one product opening stock entry is required.',
          },
        });
      }

      const workspaceId = request.workspace!.id;
      const result = await dataService.recordOpeningStock({
        workspaceId,
        branchId: body.branchId,
        entries: body.entries,
        notes: body.notes,
        referenceType: 'onboarding',
        referenceId: body.referenceId || body.flowId,
        actorUserId: request.user.id,
      }) as any;

      // Audit Log
      await dataService.logAudit({
        actorUserId: request.user.id,
        workspaceId,
        productKey: 'inventory',
        eventType: 'inventory.opening_stock_recorded',
        resource: 'stockMovements',
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: {
          productsCount: result?.recordedCount || body.entries.length,
          totalQuantity: result?.totalQuantity,
          totalValuation: result?.totalValuation,
          branchId: body.branchId,
        },
      }).catch(() => {});

      // Onboarding Flow Synchronization
      try {
        const flow = await dataService.getOnboardingFlow(request.user.id, workspaceId, 'inventory');
        if (flow) {
          await dataService.completeOnboardingStep(
            (flow as any)._id || (flow as any).id,
            'opening_stock_entry',
            'staff_invitation',
            {
              productsCount: result?.recordedCount || body.entries.length,
              totalQuantity: result?.totalQuantity,
              totalValuation: result?.totalValuation,
              branchId: body.branchId,
            }
          ).catch(() => {});
        }
      } catch {}

      return reply.status(201).send({
        success: true,
        data: result,
        message: `Successfully recorded opening stock for ${result?.recordedCount || body.entries.length} products.`,
      });
    }
  );

  // GET /api/v1/inventory/opening-stock (Get Opening Stock status and prefill data)
  fastify.get(
    '/opening-stock',
    {
      preHandler: [requireBodyOrQueryBranch],
      schema: {
        tags: ['Inventory'],
        summary: 'Get products and current opening stock status for active workspace/branch',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            branchId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const workspaceId = request.workspace!.id;
      const branchId = (request.query as any)?.branchId;
      const scope = await inventoryBranchScope(request);
      const data = await dataService.getOpeningStock(workspaceId, branchId, scope.type === 'explicit' ? scope.branchIds : undefined);
      return reply.send({
        success: true,
        data,
      });
    }
  );

  // GET /api/v1/inventory/stock-movements (List stock movements with filters)
  fastify.get(
    '/stock-movements',
    {
      preHandler: [requireBodyOrQueryBranch],
      schema: {
        tags: ['Inventory'],
        summary: 'List stock movements filtered by branch, product, or movement type',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            branchId: { type: 'string' },
            productId: { type: 'string' },
            movementType: { type: 'string' },
            limit: { type: 'number' },
          },
        },
      },
    },
    async (request, reply) => {
      const workspaceId = request.workspace!.id;
      const query = (request.query || {}) as {
        branchId?: string;
        productId?: string;
        movementType?: string;
        limit?: number;
      };

      const scope = await inventoryBranchScope(request);
      const movements = await dataService.getStockMovements({
        workspaceId,
        branchId: query.branchId,
        productId: query.productId,
        movementType: query.movementType,
        limit: query.limit ? Number(query.limit) : undefined,
        allowedBranchIds: scope.type === 'explicit' ? scope.branchIds : undefined,
      });

      return reply.send({
        success: true,
        data: { movements },
      });
    }
  );
};
