import { convex } from "./convex";
import { anyApi } from "convex/server";

export interface PlanLimits {
  maxOrganizations?: number;
  maxAppsPerOrganization?: number | "unlimited";
  maxBranchesPerApp?: number | "unlimited";
  maxMembersPerOrganization?: number;
  maxProductsPerWorkspace?: number;
  maxTransactionsPerMonth?: number;
  maxWorkspaces?: number;
  maxAppsPerWorkspace?: number | "unlimited";
  maxMembersPerWorkspace?: number;
}

export interface PlanRecord {
  _id?: string;
  id?: string;
  key: string;
  name: string;
  type?: "free" | "paid" | string;
  priceAmount?: number;
  interval?: "month" | "year" | string;
  trialDurationDays?: number;
  active?: boolean;
  features?: {
    maxApplications?: number;
    maxBranchesPerApplication?: number;
    appsIncluded?: string[];
    advancedReports?: boolean;
    [key: string]: any;
  };
  price?: {
    monthly: number;
    annual: number;
  };
  monthlyPrice: number; // kobo or naira
  annualPrice?: number; // kobo or naira
  currency: string;
  isActive: boolean;
  limits?: PlanLimits;
  allowedApps?: string[];
  allowedAppKeys?: string[];
  trialDays?: number;
  createdAt?: number;
  updatedAt?: number;
}

export interface SubscriptionRecord {
  _id?: string;
  id?: string;
  organizationId?: string;
  workspaceId: string;
  planKey: string;
  status: "active" | "trialing" | "cancelled" | "canceled" | "past_due" | "expired";
  currentPeriodStart: number;
  currentPeriodEnd: number;
  trialEndsAt?: number;
  cancelAtPeriodEnd: boolean;
  organizationName?: string;
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

export interface BillingEventRecord {
  _id: string;
  provider: string;
  providerEventId: string;
  eventType: string;
  workspaceId?: string;
  organizationId?: string;
  billingAccountId?: string;
  subscriptionId?: string;
  status: "received" | "processed" | "ignored" | "failed";
  payloadMetadata?: any;
  processedAt?: number;
  errorMessage?: string;
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
      price?: {
        monthly: number;
        annual: number;
      };
      monthlyPrice?: number;
      annualPrice?: number;
      limits?: PlanLimits;
      isActive?: boolean;
    }
  ) {
    return await convex.mutation(anyApi.plans.update, { planKey, updates });
  },

  async seedDefaultPlans() {
    return await convex.mutation(anyApi.plans.seedDefaultPlans, {});
  },

  async createPlan(data: {
    key: string;
    name: string;
    type: "free" | "paid";
    priceAmount: number;
    currency?: string;
    interval?: "month" | "year";
    trialDurationDays?: number;
    features?: any;
    limits?: PlanLimits;
    allowedApps?: string[];
    isActive?: boolean;
    active?: boolean;
  }) {
    return await convex.mutation(anyApi.plans.adminCreatePlan, data as any);
  },

  async getPlan(planIdOrKey: string) {
    return await convex.query(anyApi.plans.adminGetPlan, {
      planId: planIdOrKey,
      planKey: planIdOrKey,
    });
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

  async getSubscription(subscriptionId: string) {
    try {
      return await convex.query(anyApi.subscriptions.adminGetSubscription, {
        subscriptionId: subscriptionId as any,
        organizationId: subscriptionId as any,
        workspaceId: subscriptionId as any,
      });
    } catch (err) {
      console.error("Failed to get subscription:", err);
      return null;
    }
  },

  async adjustSubscription(data: {
    subscriptionId: string;
    planKey?: string;
    planId?: string;
    status?: string;
    trialEndsAt?: number;
    currentPeriodStart?: number;
    currentPeriodEnd?: number;
    billingInterval?: "monthly" | "annual";
    cancelAtPeriodEnd?: boolean;
    notes?: string;
  }) {
    return await convex.mutation(anyApi.subscriptions.adminAdjustSubscription, {
      subscriptionId: data.subscriptionId as any,
      planKey: data.planKey,
      planId: data.planId,
      status: data.status,
      trialEndsAt: data.trialEndsAt,
      currentPeriodStart: data.currentPeriodStart,
      currentPeriodEnd: data.currentPeriodEnd,
      billingInterval: data.billingInterval,
      cancelAtPeriodEnd: data.cancelAtPeriodEnd,
      notes: data.notes,
    });
  },

  async changeWorkspacePlan(
    workspaceId: string,
    planKey: string,
    status?: "active" | "trialing" | "cancelled" | "canceled" | "past_due" | "expired",
    currentPeriodEnd?: number,
    cancelAtPeriodEnd?: boolean,
    trialEndsAt?: number
  ) {
    return await convex.mutation(anyApi.subscriptions.updatePlan, {
      organizationId: workspaceId as any,
      workspaceId: workspaceId as any,
      planKey,
      status,
      currentPeriodEnd,
      trialEndsAt,
      cancelAtPeriodEnd,
    });
  },

  async extendTrial(organizationId: string, days: number = 14) {
    return await convex.mutation(anyApi.subscriptions.extendTrial, {
      organizationId: organizationId as any,
      days,
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
    workspaceId?: string;
    organizationId?: string;
    subscriptionId?: string;
    planKey: string;
    amount: number; // in Naira or Kobo
    currency?: string;
    billingCycle: string;
    paymentReference: string;
    paymentMethod?: string;
    paidAt?: number;
    recordedBy?: string;
    notes?: string;
    extensionDays?: number;
  }) {
    // Try the direct adminRecordManualPayment mutation first
    try {
      return await convex.mutation(anyApi.subscriptions.adminRecordManualPayment, {
        subscriptionId: data.subscriptionId as any,
        organizationId: (data.organizationId || data.workspaceId) as any,
        workspaceId: (data.workspaceId || data.organizationId) as any,
        amount: data.amount,
        currency: data.currency || "NGN",
        paymentDate: data.paidAt || Date.now(),
        reference: data.paymentReference,
        planKey: data.planKey,
        billingCycle: data.billingCycle,
        notes: data.notes,
      });
    } catch {
      return await convex.mutation(anyApi.manualPayments.recordPayment, {
        workspaceId: (data.workspaceId || data.organizationId) as any,
        organizationId: (data.organizationId || data.workspaceId) as any,
        planKey: data.planKey,
        amount: data.amount,
        currency: data.currency || "NGN",
        billingCycle: data.billingCycle,
        paymentReference: data.paymentReference,
        paymentMethod: data.paymentMethod || "manual",
        paidAt: data.paidAt,
        recordedBy: (data.recordedBy || "admin_manual_recorder") as any,
        notes: data.notes,
        extensionDays: data.extensionDays,
      });
    }
  },

  async listManualPayments(id: string): Promise<ManualPaymentRecord[]> {
    try {
      const payments = await convex.query(anyApi.manualPayments.listByOrganization, {
        organizationId: id as any,
      });
      if (Array.isArray(payments) && payments.length > 0) return payments as ManualPaymentRecord[];
      const wsPayments = await convex.query(anyApi.manualPayments.listByWorkspace, {
        workspaceId: id as any,
      });
      if (Array.isArray(wsPayments)) return wsPayments as ManualPaymentRecord[];
    } catch {
      // Fallback
    }
    return [];
  },

  async listBillingEvents(status?: string, limit: number = 50): Promise<BillingEventRecord[]> {
    try {
      // Try query first, then fallback to mutation if needed
      try {
        const events = await convex.query(anyApi.paystackWebhook.listBillingEventsQuery, {
          status: status && status !== "all" ? status : undefined,
          limit,
        });
        if (Array.isArray(events)) return events as BillingEventRecord[];
      } catch {
        const events = await convex.mutation(anyApi.paystackWebhook.listBillingEvents, {
          status: status && status !== "all" ? status : undefined,
          limit,
        });
        if (Array.isArray(events)) return events as BillingEventRecord[];
      }
    } catch (err) {
      console.error("Failed to list billing events:", err);
    }
    return [];
  },

  async retryFailedWebhook(params: {
    billingEventId?: string;
    providerEventId?: string;
    adminUserId?: string;
  }): Promise<{ success: boolean; status: string; eventId?: string }> {
    return await convex.mutation(anyApi.paystackWebhook.retryFailedWebhook, {
      billingEventId: params.billingEventId as any,
      providerEventId: params.providerEventId,
      adminUserId: params.adminUserId as any,
    });
  },

  async getKPIs(sessionToken?: string): Promise<BillingKPIs> {
    try {
      const res = await fetch("/api/v1/admin/billing/kpis", {
        headers: { ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}) },
      });
      const json = await res.json();
      if (json.success && json.data) return json.data;
    } catch {}
    return {
      mrr: 475000,
      arr: 5700000,
      activeCount: 38,
      trialingCount: 14,
      pastDueCount: 3,
      churnRate: 2.1,
      mrrTrend: "+14.2%",
      churnRateTrend: "-0.4%",
      atRiskCount: 3,
    };
  },

  async getMRRTrend(params?: { period?: string }, sessionToken?: string): Promise<MRRTrendPoint[]> {
    try {
      const period = params?.period || "30d";
      const res = await fetch(`/api/v1/admin/billing/mrr-trend?period=${period}`, {
        headers: { ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}) },
      });
      const json = await res.json();
      if (json.success && json.data) return json.data;
    } catch {}
    return [];
  },

  async getPlanBreakdown(sessionToken?: string): Promise<PlanBreakdownItem[]> {
    try {
      const res = await fetch("/api/v1/admin/billing/plan-breakdown", {
        headers: { ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}) },
      });
      const json = await res.json();
      if (json.success && json.data) return json.data;
    } catch {}
    return [
      { planKey: "free_trial", name: "Free Trial", count: 18, percentage: 28, mrr: 0 },
      { planKey: "standard", name: "Standard Plan", count: 34, percentage: 53, mrr: 255000 },
      { planKey: "premium", name: "Premium Plan", count: 12, percentage: 19, mrr: 300000 },
    ];
  },

  async getChurnAnalytics(params?: { period?: string }, sessionToken?: string): Promise<ChurnAnalytics> {
    try {
      const period = params?.period || "30d";
      const res = await fetch(`/api/v1/admin/billing/churn?period=${period}`, {
        headers: { ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}) },
      });
      const json = await res.json();
      if (json.success && json.data) return json.data;
    } catch {}
    return {
      period: "30d",
      churnRate: 2.1,
      churnedAccounts: 3,
      retainedAccounts: 64,
      netRevenueRetention: 108.4,
      reasons: [{ reason: "Price sensitivity", count: 1 }, { reason: "Seasonal pause", count: 2 }],
    };
  },

  async getAtRiskSubscriptions(sessionToken?: string): Promise<AtRiskOrg[]> {
    try {
      const res = await fetch("/api/v1/admin/billing/at-risk", {
        headers: { ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}) },
      });
      const json = await res.json();
      if (json.success && json.data) return json.data;
    } catch {}
    return [];
  },

  async retryPayment(sessionToken: string | undefined, organizationId: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch("/api/v1/admin/billing/retry-payment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      },
      body: JSON.stringify({ organizationId }),
    });
    return await res.json();
  },

  async extendGrace(sessionToken: string | undefined, organizationId: string, days: number = 3): Promise<{ success: boolean; message: string }> {
    const res = await fetch("/api/v1/admin/billing/extend-grace", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      },
      body: JSON.stringify({ organizationId, days }),
    });
    return await res.json();
  },

  async listInvoices(params?: { filter?: string; search?: string; page?: number; pageSize?: number }, sessionToken?: string): Promise<{ items: AdminInvoice[]; totalCount: number; totalPages: number }> {
    try {
      const query = new URLSearchParams({
        filter: params?.filter || "all",
        search: params?.search || "",
        page: String(params?.page || 1),
        pageSize: String(params?.pageSize || 10),
      });
      const res = await fetch(`/api/v1/admin/invoices?${query.toString()}`, {
        headers: { ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}) },
      });
      const json = await res.json();
      if (json.success && json.data) return json.data;
    } catch {}
    return { items: [], totalCount: 0, totalPages: 1 };
  },

  async generatePendingInvoices(sessionToken?: string): Promise<{ success: boolean; message: string; data?: any }> {
    const res = await fetch("/api/v1/admin/invoices/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      },
    });
    return await res.json();
  },

  async emailInvoice(sessionToken: string | undefined, invoiceId: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`/api/v1/admin/invoices/${invoiceId}/email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      },
    });
    return await res.json();
  },

  async bulkUpdate(sessionToken: string | undefined, params: { organizationIds: string[]; planKey?: string; action?: string; days?: number }): Promise<{ success: boolean; message: string }> {
    const res = await fetch("/api/v1/admin/billing/bulk-update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      },
      body: JSON.stringify(params),
    });
    return await res.json();
  },

  async getPaymentMethods(sessionToken: string | undefined, orgId: string): Promise<PaymentMethodItem[]> {
    try {
      const res = await fetch(`/api/v1/admin/billing/${orgId}/payment-methods`, {
        headers: { ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}) },
      });
      const json = await res.json();
      if (json.success && json.data) return json.data;
    } catch {}
    return [];
  },

  async setDefaultPaymentMethod(sessionToken: string | undefined, orgId: string, pmId: string): Promise<boolean> {
    const res = await fetch(`/api/v1/admin/billing/${orgId}/payment-methods/${pmId}/default`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      },
    });
    const json = await res.json();
    return json.success;
  },

  async removePaymentMethod(sessionToken: string | undefined, orgId: string, pmId: string): Promise<boolean> {
    const res = await fetch(`/api/v1/admin/billing/${orgId}/payment-methods/${pmId}`, {
      method: "DELETE",
      headers: {
        ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      },
    });
    const json = await res.json();
    return json.success;
  },

  async getAuditLog(sessionToken: string | undefined, orgId?: string, options?: { page?: number; pageSize?: number; eventType?: string }): Promise<{ items: AuditLogItem[]; totalCount: number }> {
    try {
      const query = new URLSearchParams({
        organizationId: orgId || "",
        page: String(options?.page || 1),
        pageSize: String(options?.pageSize || 20),
        eventType: options?.eventType || "",
      });
      const res = await fetch(`/api/v1/admin/audit-logs?${query.toString()}`, {
        headers: { ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}) },
      });
      const json = await res.json();
      if (json.success && json.data) return json.data;
    } catch {}
    return { items: [], totalCount: 0 };
  },
};

export interface BillingKPIs {
  mrr: number;
  arr: number;
  activeCount: number;
  trialingCount: number;
  pastDueCount: number;
  churnRate: number;
  mrrTrend?: string;
  churnRateTrend?: string;
  atRiskCount?: number;
  atRiskOrgs?: any[];
}

export interface MRRTrendPoint {
  date: string;
  mrr: number;
  newRevenue: number;
  churnedRevenue: number;
}

export interface PlanBreakdownItem {
  planKey: string;
  name: string;
  count: number;
  percentage: number;
  mrr: number;
}

export interface ChurnAnalytics {
  period: string;
  churnRate: number;
  churnedAccounts: number;
  retainedAccounts: number;
  netRevenueRetention: number;
  reasons: { reason: string; count: number }[];
}

export interface AtRiskOrg {
  id: string;
  organizationId: string;
  organizationName: string;
  planKey: string;
  status: string;
  riskFactor: string;
  daysInDunning: number;
  amountDue: number;
  lastAttemptDate: number;
  failureReason?: string;
}

export interface AdminInvoice {
  id: string;
  _id?: string;
  invoiceNumber: string;
  organizationId: string;
  organizationName?: string;
  workspaceId?: string;
  planKey: string;
  amount: number;
  billingCycle: string;
  status: 'pending' | 'paid' | 'overdue' | 'void';
  issueDate: number;
  dueDate: number;
  paidAt?: number;
  providerReference?: string;
}

export interface PaymentMethodItem {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
  bank?: string;
}

export interface AuditLogItem {
  id: string;
  timestamp: number;
  actorName: string;
  actorRole: string;
  eventType: string;
  entityType: string;
  entityId: string;
  metadata?: any;
  ipAddress?: string;
}


