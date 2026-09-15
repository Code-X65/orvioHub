import { ConvexHttpClient } from 'convex/browser';
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
      await this.auditRepo.logAudit({
        workspaceId,
        actorUserId,
        productKey: 'inventory',
        eventType: 'inventory.product_created',
        resource: 'inventoryProducts',
        entityId: productId,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        metadata: { name: data.name, sku: data.sku, sellingPrice: data.sellingPrice },
      }).catch(() => {});
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
      await this.auditRepo.logAudit({
        workspaceId,
        actorUserId,
        productKey: 'inventory',
        eventType: 'inventory.sale_recorded',
        resource: 'inventorySales',
        entityId: result?.saleId || workspaceId,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        metadata: { itemCount: items.length, paymentMethod },
      }).catch(() => {});
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
      await this.auditRepo.logAudit({
        workspaceId,
        actorUserId,
        productKey: 'inventory',
        eventType: 'inventory.sample_seeded',
        resource: 'inventoryProducts',
        entityId: workspaceId,
        metadata: { sector },
      }).catch(() => {});
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
}

export const inventoryDomainService = new InventoryDomainService();
