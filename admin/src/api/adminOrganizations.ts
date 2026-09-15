import { convex } from "./convex";
import { anyApi } from "convex/server";

export const adminOrganizationsApi = {
  async listOrganizations(params: {
    sessionToken: string;
    search?: string;
    statusFilter?: string;
    typeFilter?: string;
    planFilter?: string;
    branchFilter?: string;
    onboardingFilter?: string;
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

  async suspendOrganization(sessionToken: string, workspaceId: string, reason?: string, notes?: string) {
    return await convex.mutation(anyApi.adminOrganizations.suspendOrganization, {
      sessionToken,
      workspaceId: workspaceId as any,
      reason,
      notes,
    });
  },

  async activateOrganization(sessionToken: string, workspaceId: string) {
    return await convex.mutation(anyApi.adminOrganizations.activateOrganization, {
      sessionToken,
      workspaceId: workspaceId as any,
    });
  },

  async restoreOrganization(sessionToken: string, workspaceId: string) {
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

  async deleteOrganization(
    sessionToken: string,
    workspaceId: string,
    options?: {
      reason?: string;
      notes?: string;
      cancelSubscriptions?: boolean;
      adminForceDelete?: boolean;
    }
  ) {
    return await convex.mutation(anyApi.adminOrganizations.deleteOrganization, {
      sessionToken,
      workspaceId: workspaceId as any,
      ...options,
    });
  },

  async extendTrial(sessionToken: string, workspaceId: string, days: number = 14) {
    return await convex.mutation(anyApi.adminOrganizations.extendTrial, {
      sessionToken,
      workspaceId: workspaceId as any,
      days,
    });
  },

  async updateOrganizationPlan(sessionToken: string, workspaceId: string, planKey: string, status?: string) {
    return await convex.mutation(anyApi.adminOrganizations.updateOrganizationPlan, {
      sessionToken,
      workspaceId: workspaceId as any,
      planKey,
      status,
    });
  },

  async getFullSettings(sessionToken: string | null | undefined, workspaceId: string) {
    return await convex.query(anyApi.adminOrganizations.getAdminOrganizationFullSettings, {
      sessionToken: sessionToken || undefined,
      workspaceId: workspaceId as any,
    });
  },

  async emergencyTransferOwnership(
    sessionToken: string | null | undefined,
    workspaceId: string,
    newOwnerUserId: string,
    reason: string,
    ticketNumber?: string
  ) {
    return await convex.mutation(anyApi.adminOrganizations.adminTransferOrganizationOwnership, {
      sessionToken: sessionToken || undefined,
      workspaceId: workspaceId as any,
      newOwnerUserId: newOwnerUserId as any,
      reason,
      ticketNumber,
    });
  },
};
