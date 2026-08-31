import { convex } from "./convex";
import { anyApi } from "convex/server";

export const adminAuditApi = {
  async getAdminAuditLogs(params: {
    sessionToken: string;
    search?: string;
    actionFilter?: string;
    resourceTypeFilter?: string;
    page?: number;
    pageSize?: number;
  }) {
    return await convex.query(anyApi.adminAudit.getAdminAuditLogs, params);
  },

  async getSecurityEvents(sessionToken: string) {
    return await convex.query(anyApi.adminAudit.getSecurityEvents, { sessionToken });
  },

  async exportAuditLogs(sessionToken: string) {
    return await convex.mutation(anyApi.adminAudit.exportAuditLogs, { sessionToken });
  },
};
