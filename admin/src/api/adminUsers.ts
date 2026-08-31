import { convex } from "./convex";
import { anyApi } from "convex/server";

export const adminUsersApi = {
  async listUsers(params: {
    sessionToken: string;
    search?: string;
    verifiedFilter?: "all" | "verified" | "unverified";
    statusFilter?: string;
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortOrder?: string;
  }) {
    return await convex.query(anyApi.adminUsers.listUsers, params);
  },

  async getUserDetails(sessionToken: string, userId: string) {
    return await convex.query(anyApi.adminUsers.getUserDetails, { sessionToken, userId: userId as any });
  },

  async suspendUser(sessionToken: string, userId: string, reason?: string) {
    return await convex.mutation(anyApi.adminUsers.suspendUser, { sessionToken, userId: userId as any, reason });
  },

  async activateUser(sessionToken: string, userId: string) {
    return await convex.mutation(anyApi.adminUsers.activateUser, { sessionToken, userId: userId as any });
  },

  async verifyUserEmail(sessionToken: string, userId: string) {
    return await convex.mutation(anyApi.adminUsers.verifyUserEmail, { sessionToken, userId: userId as any });
  },

  async revokeUserSessions(sessionToken: string, userId: string) {
    return await convex.mutation(anyApi.adminUsers.revokeUserSessions, { sessionToken, userId: userId as any });
  },

  async deleteUser(sessionToken: string, userId: string) {
    return await convex.mutation(anyApi.adminUsers.deleteUser, { sessionToken, userId: userId as any });
  },

  async impersonateUser(sessionToken: string, userId: string, reason?: string) {
    return await convex.mutation(anyApi.adminUsers.impersonateUser, { sessionToken, userId: userId as any, reason });
  },
};
