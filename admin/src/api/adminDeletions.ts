import { convex } from "./convex";
import { anyApi } from "convex/server";

export const adminDeletionsApi = {
  async listPendingDeletions(sessionToken?: string | null) {
    return await convex.query(anyApi.adminDeletions.listPendingOrganizationDeletions, {
      sessionToken: sessionToken || undefined,
    });
  },

  async cancelDeletion(sessionToken: string | null | undefined, workspaceId: string, reason?: string) {
    return await convex.mutation(anyApi.adminDeletions.cancelOrganizationDeletion, {
      workspaceId: workspaceId as any,
      sessionToken: sessionToken || undefined,
      reason,
    });
  },

  async purgeImmediate(
    sessionToken: string | null | undefined,
    workspaceId: string,
    confirmationPhrase: string,
    reason?: string
  ) {
    return await convex.mutation(anyApi.adminDeletions.purgeOrganizationImmediate, {
      workspaceId: workspaceId as any,
      confirmationPhrase,
      sessionToken: sessionToken || undefined,
      reason,
    });
  },
};
