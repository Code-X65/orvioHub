import { convex } from "./convex";
import { anyApi } from "convex/server";

export const adminOrganizationsApi = {
  async listOrganizations(params: {
    sessionToken: string;
    search?: string;
    statusFilter?: string;
    typeFilter?: string;
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortOrder?: string;
  }) {
    return await convex.query(anyApi.adminOrganizations.listOrganizations, params);
  },

  async getOrganizationDetails(sessionToken: string, workspaceId: string) {
    return await convex.query(anyApi.adminOrganizations.getOrganizationDetails, {
      sessionToken,
      workspaceId: workspaceId as any,
    });
  },

  async suspendOrganization(sessionToken: string, workspaceId: string, reason?: string) {
    return await convex.mutation(anyApi.adminOrganizations.suspendOrganization, {
      sessionToken,
      workspaceId: workspaceId as any,
      reason,
    });
  },

  async activateOrganization(sessionToken: string, workspaceId: string) {
    return await convex.mutation(anyApi.adminOrganizations.activateOrganization, {
      sessionToken,
      workspaceId: workspaceId as any,
    });
  },

  async transferOwnership(sessionToken: string, workspaceId: string, newOwnerUserId: string) {
    return await convex.mutation(anyApi.adminOrganizations.transferOwnership, {
      sessionToken,
      workspaceId: workspaceId as any,
      newOwnerUserId: newOwnerUserId as any,
    });
  },

  async enableProduct(sessionToken: string, workspaceId: string, productKey: string) {
    return await convex.mutation(anyApi.adminOrganizations.enableProduct, {
      sessionToken,
      workspaceId: workspaceId as any,
      productKey,
    });
  },

  async disableProduct(sessionToken: string, workspaceId: string, productKey: string) {
    return await convex.mutation(anyApi.adminOrganizations.disableProduct, {
      sessionToken,
      workspaceId: workspaceId as any,
      productKey,
    });
  },

  async resetOnboarding(sessionToken: string, workspaceId: string) {
    return await convex.mutation(anyApi.adminOrganizations.resetOnboarding, {
      sessionToken,
      workspaceId: workspaceId as any,
    });
  },

  async deleteOrganization(sessionToken: string, workspaceId: string) {
    return await convex.mutation(anyApi.adminOrganizations.deleteOrganization, {
      sessionToken,
      workspaceId: workspaceId as any,
    });
  },
};
