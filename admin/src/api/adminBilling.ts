import { convex } from "./convex";
import { anyApi } from "convex/server";

export interface PlanRecord {
  _id?: string;
  id?: string;
  key: string;
  name: string;
  monthlyPrice: number; // kobo
  annualPrice?: number; // kobo
  currency: string;
  isActive: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export interface SubscriptionRecord {
  _id?: string;
  id?: string;
  workspaceId: string;
  planKey: string;
  status: "active" | "cancelled" | "past_due";
  currentPeriodStart: number;
  currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean;
  workspaceName?: string;
  workspaceSlug?: string;
  ownerName?: string;
  ownerEmail?: string;
}

export interface ManualPaymentRecord {
  _id?: string;
  workspaceId: string;
  planKey: string;
  amount: number; // kobo
  currency: string;
  billingCycle: string;
  paymentReference: string;
  paymentMethod: string;
  paidAt: number;
  recordedBy: string;
  recordedByName?: string;
  recordedByEmail?: string;
  notes?: string;
  createdAt: number;
}

export interface SubscriptionStats {
  totalSubscriptions: number;
  totalMRRKobo: number;
  totalMRRNaira: number;
  expiringSoonCount: number;
  countsByPlan: {
    free: number;
    standard: number;
    premium: number;
  };
}

export const adminBillingApi = {
  async listPlans() {
    try {
      const plans = await convex.query(anyApi.plans.list, {});
      if (plans && plans.length > 0) return plans;
    } catch {
      // Fallback default plans
    }
    return [
      {
        key: "free",
        name: "Free",
        monthlyPrice: 0,
        annualPrice: 0,
        currency: "NGN",
        isActive: true,
      },
      {
        key: "standard",
        name: "Standard",
        monthlyPrice: 750000,
        annualPrice: 7500000,
        currency: "NGN",
        isActive: true,
      },
      {
        key: "premium",
        name: "Premium",
        monthlyPrice: 2000000,
        annualPrice: 20000000,
        currency: "NGN",
        isActive: true,
      },
    ];
  },

  async updatePlan(
    planKey: string,
    updates: {
      name?: string;
      monthlyPrice?: number;
      annualPrice?: number;
      isActive?: boolean;
    }
  ) {
    return await convex.mutation(anyApi.plans.update, { planKey, updates });
  },

  async seedDefaultPlans() {
    return await convex.mutation(anyApi.plans.seedDefaultPlans, {});
  },

  async getWorkspaceSubscription(workspaceId: string) {
    try {
      return await convex.query(anyApi.subscriptions.getByWorkspace, {
        workspaceId: workspaceId as any,
      });
    } catch {
      return {
        workspaceId,
        planKey: "free",
        status: "active",
        currentPeriodStart: Date.now(),
        currentPeriodEnd: Date.now() + 365 * 86_400_000,
        cancelAtPeriodEnd: false,
      };
    }
  },

  async changeWorkspacePlan(
    workspaceId: string,
    planKey: string,
    status?: "active" | "cancelled" | "past_due",
    currentPeriodEnd?: number,
    cancelAtPeriodEnd?: boolean
  ) {
    return await convex.mutation(anyApi.subscriptions.updatePlan, {
      workspaceId: workspaceId as any,
      planKey,
      status,
      currentPeriodEnd,
      cancelAtPeriodEnd,
    });
  },

  async getWorkspaceUsage(workspaceId: string) {
    try {
      return await convex.query(anyApi.usageCounters.getByWorkspace, {
        workspaceId: workspaceId as any,
      });
    } catch {
      return {
        workspaceId,
        counters: {
          membersCount: 1,
          appsCount: 1,
          productsCount: 0,
          transactionsCount: 0,
        },
        records: [],
      };
    }
  },

  async listAllSubscriptions(filters?: {
    planKey?: string;
    status?: string;
    search?: string;
  }) {
    try {
      const subs = await convex.query(anyApi.subscriptions.listAll, {
        planKey: filters?.planKey,
        status: filters?.status,
        search: filters?.search,
      });
      if (Array.isArray(subs)) return subs as SubscriptionRecord[];
    } catch {
      // Fallback
    }
    return [] as SubscriptionRecord[];
  },

  async getSubscriptionOverviewStats(): Promise<SubscriptionStats> {
    try {
      const stats = await convex.query(anyApi.subscriptions.getOverviewStats, {});
      if (stats) return stats as SubscriptionStats;
    } catch {
      // Fallback
    }
    return {
      totalSubscriptions: 0,
      totalMRRKobo: 0,
      totalMRRNaira: 0,
      expiringSoonCount: 0,
      countsByPlan: {
        free: 0,
        standard: 0,
        premium: 0,
      },
    };
  },

  async recordManualPayment(data: {
    workspaceId: string;
    planKey: string;
    amount: number; // in kobo
    currency?: string;
    billingCycle: string;
    paymentReference: string;
    paymentMethod: string;
    paidAt?: number;
    recordedBy: string;
    notes?: string;
    extensionDays?: number;
  }) {
    return await convex.mutation(anyApi.manualPayments.recordPayment, {
      workspaceId: data.workspaceId as any,
      planKey: data.planKey,
      amount: data.amount,
      currency: data.currency || "NGN",
      billingCycle: data.billingCycle,
      paymentReference: data.paymentReference,
      paymentMethod: data.paymentMethod,
      paidAt: data.paidAt,
      recordedBy: data.recordedBy as any,
      notes: data.notes,
      extensionDays: data.extensionDays,
    });
  },

  async listManualPayments(workspaceId: string): Promise<ManualPaymentRecord[]> {
    try {
      const payments = await convex.query(anyApi.manualPayments.listByWorkspace, {
        workspaceId: workspaceId as any,
      });
      if (Array.isArray(payments)) return payments as ManualPaymentRecord[];
    } catch {
      // Fallback
    }
    return [];
  },
};
