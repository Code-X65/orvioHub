import { convex } from "./convex";
import { anyApi } from "convex/server";

export const adminConfigApi = {
  async getSystemConfig(sessionToken: string) {
    return await convex.query(anyApi.adminConfig.getSystemConfig, { sessionToken });
  },

  async updateSystemConfig(sessionToken: string, key: string, value: any) {
    return await convex.mutation(anyApi.adminConfig.updateSystemConfig, {
      sessionToken,
      key,
      value,
    });
  },

  async getFeatureFlags(sessionToken: string) {
    return await convex.query(anyApi.adminConfig.getFeatureFlags, { sessionToken });
  },

  async updateFeatureFlag(
    sessionToken: string,
    flagKey: string,
    enabled: boolean,
    rolloutPercentage?: number,
    description?: string
  ) {
    return await convex.mutation(anyApi.adminConfig.updateFeatureFlag, {
      sessionToken,
      flagKey,
      enabled,
      rolloutPercentage,
      description,
    });
  },
};
