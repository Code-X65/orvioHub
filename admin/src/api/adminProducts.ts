import { convex } from "./convex";
import { anyApi } from "convex/server";

export interface PlatformProduct {
  _id?: string;
  id?: string;
  key: string;
  name: string;
  description: string;
  subdomain?: string;
  status: "active" | "coming_soon" | "draft" | "ACTIVE" | "BETA" | "COMING_SOON";
  iconUrl?: string;
  isBeta?: boolean;
  isFeatured?: boolean;
  displayOrder?: number;
  documentationUrl?: string;
  supportEmail?: string;
  activationCount?: number;
  createdAt?: number;
  updatedAt?: number;
}

export const adminProductsApi = {
  async listProducts(sessionToken: string) {
    try {
      const prods = await convex.query(anyApi.products.listAll, {});
      if (prods && prods.length > 0) {
        return prods;
      }
    } catch {
      // Fallback to adminProducts.listProducts
    }
    return await convex.query(anyApi.adminProducts.listProducts, { sessionToken });
  },

  async listAll(sessionToken?: string) {
    try {
      return await convex.query(anyApi.products.listAll, {});
    } catch {
      if (sessionToken) {
        return await convex.query(anyApi.adminProducts.listProducts, { sessionToken });
      }
      return [];
    }
  },

  async getByKey(productKey: string) {
    return await convex.query(anyApi.products.getByKey, { productKey });
  },

  async getUsageStats(productKey: string) {
    return await convex.query(anyApi.products.getUsageStats, { productKey });
  },

  async createProduct(data: {
    name: string;
    description: string;
    status: "active" | "coming_soon" | "draft";
    displayOrder: number;
    isBeta?: boolean;
    isFeatured?: boolean;
    iconUrl?: string;
    documentationUrl?: string;
    supportEmail?: string;
    key?: string;
    subdomain?: string;
  }) {
    return await convex.mutation(anyApi.products.create, data);
  },

  async updateProduct(
    productKey: string,
    updates: {
      name?: string;
      description?: string;
      status?: "active" | "coming_soon" | "draft" | "ACTIVE" | "BETA" | "COMING_SOON";
      isBeta?: boolean;
      isFeatured?: boolean;
      displayOrder?: number;
      iconUrl?: string;
      documentationUrl?: string;
      supportEmail?: string;
      subdomain?: string;
    }
  ) {
    return await convex.mutation(anyApi.products.update, { productKey, updates });
  },

  async archiveProduct(productKey: string) {
    return await convex.mutation(anyApi.products.archive, { productKey });
  },

  async deleteProduct(productKey: string) {
    return await convex.mutation(anyApi.products.deleteProduct, { productKey });
  },

  async getNotifyList(productKey: string) {
    return await convex.query(anyApi.notifyList.getByProduct, { productKey });
  },

  async notifyAllOnLaunch(productKey: string) {
    return await convex.mutation(anyApi.notifyList.notifyAllOnLaunch, { productKey });
  },

  async seedDefaultProducts() {
    return await convex.mutation(anyApi.products.seedDefaultProducts, {});
  },

  async enableProductGlobally(sessionToken: string, productId: string) {
    return await convex.mutation(anyApi.adminProducts.enableProductGlobally, {
      sessionToken,
      productId: productId as any,
    });
  },

  async disableProductGlobally(sessionToken: string, productId: string, newStatus: "BETA" | "COMING_SOON") {
    return await convex.mutation(anyApi.adminProducts.disableProductGlobally, {
      sessionToken,
      productId: productId as any,
      newStatus,
    });
  },

  async grantExtendedTrial(sessionToken: string, workspaceId: string, productKey: string, additionalDays: number) {
    return await convex.mutation(anyApi.adminProducts.grantExtendedTrial, {
      sessionToken,
      workspaceId: workspaceId as any,
      productKey,
      additionalDays,
    });
  },
};
