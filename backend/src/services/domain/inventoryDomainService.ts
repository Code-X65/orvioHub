import { ConvexHttpClient } from 'convex/browser';
import { fireAndForget } from '../../utils/asyncUtils.js';
import { BaseRepository } from '../../repositories/baseRepository.js';
import { AuditNotificationRepository } from '../../repositories/auditNotificationRepository.js';
import { entitlementService } from '../entitlementService.js';
import { ERROR_CODES } from '../../config/constants.js';

export interface CreateInventoryProductParams {
  workspaceId: string;
  sku: string;
  name: string;
  category?: string;
  description?: string;
  costPrice: number;
  sellingPrice: number;
  stockQuantity?: number;
  minStockLevel?: number;
  unit?: string;
  imageUrl?: string;
  actorUserId: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface RecordSaleParams {
  workspaceId: string;
  items: Array<{ productId: string; quantity: number }>;
  paymentMethod: 'CASH' | 'CARD' | 'TRANSFER' | 'SPLIT';
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  actorUserId: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Domain Service: InventoryDomainService
 * Encapsulates inventory catalog creation, item quota checks, sale tracking,
 * and stock level invariants.
 */
export class InventoryDomainService extends BaseRepository {
  constructor(
    client?: ConvexHttpClient,
    private readonly auditRepo?: AuditNotificationRepository
  ) {
    super(client);
  }

  /**
   * Get receipt settings for a workspace
   */
  public async getReceiptSettings(workspaceId: string): Promise<any> {
    return this.query('inventory:getReceiptSettings', {
      workspaceId: workspaceId as any,
    });
  }

  /**
   * Update receipt settings for a workspace
   */
  public async updateReceiptSettings(workspaceId: string, settings: any): Promise<any> {
    return this.mutate('inventory:updateReceiptSettings', {
      workspaceId: workspaceId as any,
      storeName: settings.storeName,
      tagline: settings.tagline,
      headerText: settings.headerText,
      footerText: settings.footerText,
      returnPolicy: settings.returnPolicy,
      tin: settings.tin,
      vatRate: settings.vatRate !== undefined ? Number(settings.vatRate) : undefined,
      enableVat: settings.enableVat,
      showCashier: settings.showCashier,
      showCustomer: settings.showCustomer,
      showBarcode: settings.showBarcode,
      paperWidth: settings.paperWidth,
      phone: settings.phone,
      email: settings.email,
      address: settings.address,
      logoUrl: settings.logoUrl,
    });
  }

  /**
   * Get products with optional category filter
   */
  public async getProducts(workspaceId: string, category?: string): Promise<any[]> {
    return (await this.query('inventory:getProducts', {
      workspaceId: workspaceId as any,
      category,
    })) || [];
  }

  /**
   * Create product with entitlement quota verification and audit tracking
   */
  public async createProduct(params: CreateInventoryProductParams): Promise<string> {
    const { workspaceId, actorUserId, ...data } = params;

    // 1. Quota check: Verify catalog size limit
    const entitlement = await entitlementService.checkProductCreationEntitlement(workspaceId, 1);
    if (!entitlement.allowed) {
      const err: any = new Error(entitlement.error || 'Inventory product limit reached for current plan.');
      err.code = ERROR_CODES.PLAN_LIMIT_REACHED;
      err.statusCode = 403;
      err.details = {
        current: entitlement.current,
        limit: entitlement.limit,
        planKey: entitlement.planKey,
      };
      throw err;
    }

    // 2. Persist product via Convex mutation
    const productId = await this.mutate('inventory:createProduct', {
      workspaceId: workspaceId as any,
      ...data,
    });

    // 3. Audit trail
    if (this.auditRepo) {
      fireAndForget(
        this.auditRepo.logAudit({
          workspaceId,
          actorUserId,
          productKey: 'inventory',
          eventType: 'inventory.product_created',
          resource: 'inventoryProducts',
          entityId: productId,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
          metadata: { name: data.name, sku: data.sku, sellingPrice: data.sellingPrice },
        }),
        'Audit log for inventory product creation'
      );
    }

    return productId;
  }

  /**
   * Record a sale, updating stock quantities and tracking transactions
   */
  public async recordSale(params: RecordSaleParams): Promise<any> {
    const { workspaceId, actorUserId, items, paymentMethod, customerName, customerPhone, notes } = params;

    const result = await this.mutate('inventory:recordSale', {
      workspaceId: workspaceId as any,
      items: items as any,
      paymentMethod,
      customerName,
      customerPhone,
      notes,
    });

    if (this.auditRepo) {
      fireAndForget(
        this.auditRepo.logAudit({
          workspaceId,
          actorUserId,
          productKey: 'inventory',
          eventType: 'inventory.sale_recorded',
          resource: 'inventorySales',
          entityId: result?.saleId || workspaceId,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
          metadata: { itemCount: items.length, paymentMethod },
        }),
        'Audit log for inventory sale'
      );
    }

    return result;
  }

  /**
   * Seed industry-specific sample catalog
   */
  public async seedSampleProducts(workspaceId: string, sector: string, actorUserId: string): Promise<any> {
    const result = await this.mutate('inventory:seedSampleProducts', {
      workspaceId: workspaceId as any,
      sector: sector as any,
    });

    if (this.auditRepo) {
      fireAndForget(
        this.auditRepo.logAudit({
          workspaceId,
          actorUserId,
          productKey: 'inventory',
          eventType: 'inventory.sample_seeded',
          resource: 'inventoryProducts',
          entityId: workspaceId,
          metadata: { sector },
        }),
        'Audit log for inventory sample seeding'
      );
    }

    return result;
  }

  /**
   * Get dashboard metrics
   */
  public async getDashboardMetrics(workspaceId: string): Promise<any> {
    return await this.query('inventory:getDashboardMetrics', {
      workspaceId: workspaceId as any,
    });
  }

  /**
   * Record opening stock ledger entries
   */
  public async recordOpeningStock(params: {
    workspaceId: string;
    branchId?: string;
    entries: Array<{
      productId: string;
      quantity: number;
      unitCost?: number;
      totalCost?: number;
      notes?: string;
    }>;
    notes?: string;
    referenceType?: string;
    referenceId?: string;
    actorUserId: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<any> {
    const { workspaceId, actorUserId, ...rest } = params;
    const result = await this.mutate('inventory:recordOpeningStock', {
      workspaceId: workspaceId as any,
      branchId: rest.branchId as any,
      entries: rest.entries as any,
      notes: rest.notes,
      referenceType: rest.referenceType || 'onboarding',
      referenceId: rest.referenceId,
      actorUserId: actorUserId as any,
      userId: actorUserId as any,
    });

    if (this.auditRepo) {
      fireAndForget(
        this.auditRepo.logAudit({
          workspaceId,
          actorUserId,
          productKey: 'inventory',
          eventType: 'inventory.opening_stock_recorded',
          resource: 'stockMovements',
          entityId: workspaceId,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
          metadata: {
            productsCount: result?.recordedCount || rest.entries.length,
            totalQuantity: result?.totalQuantity,
            totalValuation: result?.totalValuation,
            branchId: rest.branchId,
          },
        }),
        'Audit log for opening stock recording'
      );
    }

    return result;
  }

  /**
   * Get stock movements filtered by movementType, branch, or product
   */
  public async getStockMovements(params: {
    workspaceId: string;
    branchId?: string;
    productId?: string;
    movementType?: string;
    limit?: number;
  }): Promise<any[]> {
    return (await this.query('inventory:getStockMovements', {
      workspaceId: params.workspaceId as any,
      branchId: params.branchId as any,
      productId: params.productId as any,
      movementType: params.movementType,
      limit: params.limit,
    })) || [];
  }

  /**
   * Get current opening stock status for workspace & branch
   */
  public async getOpeningStock(workspaceId: string, branchId?: string): Promise<any> {
    return await this.query('inventory:getOpeningStock', {
      workspaceId: workspaceId as any,
      branchId: branchId as any,
    });
  }
}

export const inventoryDomainService = new InventoryDomainService();

