import { convex } from "./convex";
import { anyApi } from "convex/server";

export const adminUsersApi = {
  // 1. User search and list
  async listUsers(params: {
    sessionToken: string;
    search?: string;
    verifiedFilter?: "all" | "verified" | "unverified";
    statusFilter?: string;
    userTypeFilter?: string;
    orgFilter?: string;
    billingFilter?: string;
    onboardingFilter?: string;
    roleFilter?: string;
    startDate?: number;
    endDate?: number;
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortOrder?: string;
  }) {
    return await convex.query(anyApi.adminUsers.listUsers, params);
  },

  // 2. User Overview
  async getUserOverview(sessionToken: string, userId: string) {
    return await convex.query(anyApi.adminUsers.getUserOverview, { sessionToken, userId: userId as any });
  },

  // 3. User Profile
  async getUserProfile(sessionToken: string, userId: string) {
    return await convex.query(anyApi.adminUsers.getUserProfile, { sessionToken, userId: userId as any });
  },

  // 4. User Onboarding
  async getUserOnboarding(sessionToken: string, userId: string) {
    return await convex.query(anyApi.adminUsers.getUserOnboarding, { sessionToken, userId: userId as any });
  },

  // 5. User Authentication Summary
  async getUserAuthenticationSummary(sessionToken: string, userId: string) {
    return await convex.query(anyApi.adminUsers.getUserAuthenticationSummary, { sessionToken, userId: userId as any });
  },

  // 6. User Security Summary
  async getUserSecuritySummary(sessionToken: string, userId: string) {
    return await convex.query(anyApi.adminUsers.getUserSecuritySummary, { sessionToken, userId: userId as any });
  },

  // 7. User Organizations
  async getUserOrganizations(sessionToken: string, userId: string) {
    return await convex.query(anyApi.adminUsers.getUserOrganizations, { sessionToken, userId: userId as any });
  },

  // 8. User Access & Branches
  async getUserAccess(sessionToken: string, userId: string) {
    return await convex.query(anyApi.adminUsers.getUserAccess, { sessionToken, userId: userId as any });
  },

  // 9. User Billing
  async getUserBilling(sessionToken: string, userId: string) {
    return await convex.query(anyApi.adminUsers.getUserBilling, { sessionToken, userId: userId as any });
  },

  // 10. User Usage & Limits
  async getUserUsage(sessionToken: string, userId: string) {
    return await convex.query(anyApi.adminUsers.getUserUsage, { sessionToken, userId: userId as any });
  },

  // 11. User Notifications
  async getUserNotifications(sessionToken: string, userId: string) {
    return await convex.query(anyApi.adminUsers.getUserNotifications, { sessionToken, userId: userId as any });
  },

  // 12. User Activity & Audit Logs
  async getUserActivity(params: {
    sessionToken: string;
    userId: string;
    category?: string;
    severity?: string;
    startDate?: number;
    endDate?: number;
    limit?: number;
  }) {
    return await convex.query(anyApi.adminUsers.getUserActivity, {
      ...params,
      userId: params.userId as any,
    });
  },

  // 13. Support Notes
  async getUserSupportNotes(sessionToken: string, userId: string) {
    return await convex.query(anyApi.adminUsers.getUserSupportNotes, { sessionToken, userId: userId as any });
  },

  async addSupportNote(
    sessionToken: string,
    userId: string,
    category: "support" | "billing" | "security" | "onboarding" | "general",
    note: string,
    organizationId?: string
  ) {
    return await convex.mutation(anyApi.adminUsers.addSupportNote, {
      sessionToken,
      userId: userId as any,
      category,
      note,
      organizationId,
    });
  },

  async deleteSupportNote(sessionToken: string, noteId: string) {
    return await convex.mutation(anyApi.adminUsers.deleteSupportNote, {
      sessionToken,
      noteId: noteId as any,
    });
  },

  // 14. Administrative Actions
  async suspendUser(sessionToken: string, userId: string, reason?: string, notes?: string) {
    return await convex.mutation(anyApi.adminUsers.suspendUser, {
      sessionToken,
      userId: userId as any,
      reason,
      notes,
    });
  },

  async activateUser(sessionToken: string, userId: string) {
    return await convex.mutation(anyApi.adminUsers.activateUser, { sessionToken, userId: userId as any });
  },

  async restoreUser(sessionToken: string, userId: string) {
    return await convex.mutation(anyApi.adminUsers.activateUser, { sessionToken, userId: userId as any });
  },

  async verifyUserEmail(sessionToken: string, userId: string) {
    return await convex.mutation(anyApi.adminUsers.verifyUserEmail, { sessionToken, userId: userId as any });
  },

  async revokeSpecificSession(sessionToken: string, userId: string, sessionId: string, reason?: string) {
    return await convex.mutation(anyApi.adminUsers.revokeSpecificSession, {
      sessionToken,
      userId: userId as any,
      sessionId: sessionId as any,
      reason,
    });
  },

  async revokeUserSessions(sessionToken: string, userId: string, reason?: string) {
    return await convex.mutation(anyApi.adminUsers.revokeUserSessions, {
      sessionToken,
      userId: userId as any,
      reason,
    });
  },

  async deleteUser(
    sessionToken: string,
    userId: string,
    options?: {
      reason?: string;
      notes?: string;
      transferWorkspaceOwnership?: boolean;
      newOwnerId?: string;
      cancelSubscriptions?: boolean;
      adminForceDelete?: boolean;
    }
  ) {
    return await convex.mutation(anyApi.adminUsers.deleteUser, {
      sessionToken,
      userId: userId as any,
      ...options,
    });
  },

  async getSuspensionHistory(sessionToken: string, userId: string) {
    return await convex.query(anyApi.adminUsers.getSuspensionHistory, {
      sessionToken,
      userId: userId as any,
    });
  },

  async unlinkUserPhone(sessionToken: string, userId: string, reason?: string) {
    return await convex.mutation(anyApi.adminUsers.unlinkUserPhone, {
      sessionToken,
      userId: userId as any,
      reason,
    });
  },

  async overrideUserPhoneVerified(sessionToken: string, userId: string, reason?: string) {
    return await convex.mutation(anyApi.adminUsers.overrideUserPhoneVerified, {
      sessionToken,
      userId: userId as any,
      reason,
    });
  },
};
