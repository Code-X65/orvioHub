import { convex } from "./convex";
import { anyApi } from "convex/server";

export const adminInvitationsApi = {
  async listInvitations(params: {
    sessionToken: string;
    search?: string;
    statusFilter?: string;
    page?: number;
    pageSize?: number;
  }) {
    return await convex.query(anyApi.adminInvitations.listInvitations, params);
  },

  async resendInvitation(sessionToken: string, invitationId: string) {
    return await convex.mutation(anyApi.adminInvitations.resendInvitation, {
      sessionToken,
      invitationId: invitationId as any,
    });
  },

  async revokeInvitation(sessionToken: string, invitationId: string) {
    return await convex.mutation(anyApi.adminInvitations.revokeInvitation, {
      sessionToken,
      invitationId: invitationId as any,
    });
  },

  async extendInvitationExpiry(sessionToken: string, invitationId: string, days?: number) {
    return await convex.mutation(anyApi.adminInvitations.extendInvitationExpiry, {
      sessionToken,
      invitationId: invitationId as any,
      days,
    });
  },

  async acceptInvitationManually(sessionToken: string, invitationId: string) {
    return await convex.mutation(anyApi.adminInvitations.acceptInvitationManually, {
      sessionToken,
      invitationId: invitationId as any,
    });
  },

  async getInvitationStats(sessionToken: string) {
    return await convex.query(anyApi.adminInvitations.getInvitationStats, { sessionToken });
  },
};
