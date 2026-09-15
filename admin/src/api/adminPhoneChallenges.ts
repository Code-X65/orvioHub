import { convex } from "./convex";
import { anyApi } from "convex/server";

export interface PhoneChallengeFilterParams {
  sessionToken: string;
  search?: string;
  statusFilter?: string;
  purposeFilter?: string;
  page?: number;
  pageSize?: number;
}

export const adminPhoneChallengesApi = {
  async getPhoneChallenges(params: PhoneChallengeFilterParams) {
    return await convex.query(anyApi.adminPhoneChallenges.getPhoneChallenges, params);
  },
};
