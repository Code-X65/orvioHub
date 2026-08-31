import { convex } from "./convex";
import { anyApi } from "convex/server";

export const adminOnboardingApi = {
  async getOnboardingFunnel(sessionToken: string) {
    return await convex.query(anyApi.adminOnboarding.getOnboardingFunnel, { sessionToken });
  },

  async getIncompleteOnboarding(sessionToken: string) {
    return await convex.query(anyApi.adminOnboarding.getIncompleteOnboarding, { sessionToken });
  },

  async getOnboardingStepStats(sessionToken: string) {
    return await convex.query(anyApi.adminOnboarding.getOnboardingStepStats, { sessionToken });
  },

  async resetUserOnboarding(sessionToken: string, flowId: string, targetStep?: string) {
    return await convex.mutation(anyApi.adminOnboarding.resetUserOnboarding, {
      sessionToken,
      flowId: flowId as any,
      targetStep,
    });
  },
};
