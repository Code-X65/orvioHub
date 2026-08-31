import { convex } from "./convex";
import { anyApi } from "convex/server";

export const adminDashboardApi = {
  async getDashboardOverview(sessionToken: string) {
    return await convex.query(anyApi.adminDashboard.getDashboardOverview, { sessionToken });
  },

  async getUserStats(sessionToken: string) {
    return await convex.query(anyApi.adminDashboard.getUserStats, { sessionToken });
  },

  async getOrganizationStats(sessionToken: string) {
    return await convex.query(anyApi.adminDashboard.getOrganizationStats, { sessionToken });
  },

  async getProductStats(sessionToken: string) {
    return await convex.query(anyApi.adminDashboard.getProductStats, { sessionToken });
  },
};
