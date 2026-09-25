import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface PlanLimits {
  branches: number;
  members: number;
  products: number;
  monthly_transactions: number;
  inventory?: boolean;
  [key: string]: any;
}

export interface PlanConfigItem {
  key: string;
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  priceMonthly?: number;
  priceAnnual?: number;
  price?: {
    monthly: number;
    annual: number;
  };
  currency: string;
  trialDays: number;
  isActive: boolean;
  features: string[];
  limits: PlanLimits;
}

export interface PlanConfigResponse {
  plans: PlanConfigItem[];
  gateways?: {
    paystackPublicKey?: string;
    flutterwavePublicKey?: string;
  };
}

export const AUTHORITATIVE_DEFAULT_PLANS: PlanConfigItem[] = [
  {
    key: 'free_trial',
    name: 'Free Trial',
    monthlyPrice: 0,
    annualPrice: 0,
    priceMonthly: 0,
    priceAnnual: 0,
    price: { monthly: 0, annual: 0 },
    currency: 'NGN',
    trialDays: 30,
    isActive: true,
    features: [
      'Full Inventory App Access',
      '1 Branch / Warehouse',
      'Up to 2 Team Members',
      'Up to 500 Products & Stock Items',
      'Up to 300 Monthly Transactions',
      '30-Day Temporary Access',
    ],
    limits: {
      branches: 1,
      members: 2,
      products: 500,
      monthly_transactions: 300,
      inventory: true,
    },
  },
  {
    key: 'standard',
    name: 'Standard',
    monthlyPrice: 7500,
    annualPrice: 75000,
    priceMonthly: 7500,
    priceAnnual: 75000,
    price: { monthly: 7500, annual: 75000 },
    currency: 'NGN',
    trialDays: 0,
    isActive: true,
    features: [
      'Full Inventory App Access',
      'Up to 3 Branches / Warehouses',
      'Up to 10 Team Members',
      'Up to 5,000 Products & Stock Items',
      'Up to 5,000 Monthly Transactions',
      'Standard Email Support',
    ],
    limits: {
      branches: 3,
      members: 10,
      products: 5000,
      monthly_transactions: 5000,
      inventory: true,
    },
  },
  {
    key: 'premium',
    name: 'Premium',
    monthlyPrice: 25000,
    annualPrice: 250000,
    priceMonthly: 25000,
    priceAnnual: 250000,
    price: { monthly: 25000, annual: 250000 },
    currency: 'NGN',
    trialDays: 0,
    isActive: true,
    features: [
      'Full Inventory App Access',
      'Up to 10 Branches / Warehouses',
      'Up to 50 Team Members',
      'Up to 25,000 Products & Stock Items',
      'Up to 25,000 Monthly Transactions',
      'Priority 24/7 Support',
    ],
    limits: {
      branches: 10,
      members: 50,
      products: 25000,
      monthly_transactions: 25000,
      inventory: true,
    },
  },
];

export const AUTHORITATIVE_PRICES: Record<string, { monthly: number; annual: number }> = {
  free_trial: { monthly: 0, annual: 0 },
  standard: { monthly: 7500, annual: 75000 },
  premium: { monthly: 25000, annual: 250000 },
};

export const AUTHORITATIVE_LIMITS: Record<string, PlanLimits> = {
  free_trial: {
    branches: 1,
    members: 2,
    products: 500,
    monthly_transactions: 300,
    inventory: true,
  },
  standard: {
    branches: 3,
    members: 10,
    products: 5000,
    monthly_transactions: 5000,
    inventory: true,
  },
  premium: {
    branches: 10,
    members: 50,
    products: 25000,
    monthly_transactions: 25000,
    inventory: true,
  },
};

export function usePlanConfig() {
  const query = useQuery({
    queryKey: ['plan-config'],
    queryFn: async (): Promise<PlanConfigResponse> => {
      try {
        const res: any = await api.get('/billing/plan-config');
        if (res?.data?.plans) {
          return res.data;
        }
        if (Array.isArray(res?.data)) {
          return { plans: res.data };
        }
      } catch {
        // Fallback to /plans
        try {
          const fallbackRes: any = await api.get('/plans');
          if (Array.isArray(fallbackRes?.data)) {
            return { plans: fallbackRes.data };
          }
        } catch {}
      }
      return { plans: AUTHORITATIVE_DEFAULT_PLANS };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  const rawPlans = query.data?.plans || AUTHORITATIVE_DEFAULT_PLANS;
  const plans: PlanConfigItem[] = rawPlans.map((p) => {
    const monthly = p.monthlyPrice ?? p.priceMonthly ?? p.price?.monthly ?? AUTHORITATIVE_PRICES[p.key]?.monthly ?? 0;
    const annual = p.annualPrice ?? p.priceAnnual ?? p.price?.annual ?? AUTHORITATIVE_PRICES[p.key]?.annual ?? 0;
    return {
      ...p,
      monthlyPrice: monthly,
      annualPrice: annual,
      priceMonthly: monthly,
      priceAnnual: annual,
      price: { monthly, annual },
      limits: p.limits || AUTHORITATIVE_LIMITS[p.key] || AUTHORITATIVE_LIMITS.free_trial,
    };
  });

  const planMap = plans.reduce<Record<string, PlanConfigItem>>((acc, plan) => {
    acc[plan.key] = plan;
    return acc;
  }, {});

  const prices = plans.reduce<Record<string, { monthly: number; annual: number }>>((acc, plan) => {
    acc[plan.key] = {
      monthly: plan.monthlyPrice,
      annual: plan.annualPrice,
    };
    return acc;
  }, {});

  const getPlanPrice = (planKey: string, interval: 'monthly' | 'annual' = 'monthly') => {
    const normalizedKey = planKey.toLowerCase();
    const plan = planMap[normalizedKey];
    if (plan) {
      return interval === 'annual' ? plan.annualPrice : plan.monthlyPrice;
    }
    return AUTHORITATIVE_PRICES[normalizedKey]?.[interval] ?? 0;
  };

  const getPlanLimits = (planKey: string): PlanLimits => {
    const normalizedKey = planKey.toLowerCase();
    return planMap[normalizedKey]?.limits || AUTHORITATIVE_LIMITS[normalizedKey] || AUTHORITATIVE_LIMITS.free_trial;
  };

  const getPlanFeatures = (planKey: string): string[] => {
    const normalizedKey = planKey.toLowerCase();
    return planMap[normalizedKey]?.features || planMap.free_trial?.features || [];
  };

  return {
    ...query,
    plans,
    planMap,
    prices,
    getPlanPrice,
    getPlanLimits,
    getPlanFeatures,
  };
}
