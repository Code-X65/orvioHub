import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

export interface OrganizationCreationEligibility {
  canCreate: boolean;
  allowed: boolean;
  currentOwned: number;
  currentOwnedOrganizations: number;
  maximumOwned: number;
  maximumOwnedOrganizations: number;
  remainingOwned: number;
  remainingOwnedOrganizations: number;
  freeTrial: {
    used: number;
    maximum: number;
    available: boolean;
    organizationId?: string;
    organizationName?: string;
    trialEndsAt?: number;
  };
  reasons: string[];
  recommendedPlan?: 'standard' | 'free_trial' | 'premium';
  override?: {
    active: boolean;
    grantedBy: string;
    reason: string;
    expiresAt: number | null;
    overrideLimit?: number;
  };
  code?: string;
  message?: string;
}

const DEFAULT_ELIGIBILITY: OrganizationCreationEligibility = {
  canCreate: true,
  allowed: true,
  currentOwned: 0,
  currentOwnedOrganizations: 0,
  maximumOwned: 3,
  maximumOwnedOrganizations: 3,
  remainingOwned: 3,
  remainingOwnedOrganizations: 3,
  freeTrial: {
    used: 0,
    maximum: 1,
    available: true,
  },
  reasons: [],
  recommendedPlan: 'free_trial',
};

let cachedEligibility: OrganizationCreationEligibility | null = null;
let inFlightPromise: Promise<OrganizationCreationEligibility | null> | null = null;
const listeners = new Set<(val: OrganizationCreationEligibility) => void>();

function notifyListeners(val: OrganizationCreationEligibility) {
  cachedEligibility = val;
  listeners.forEach((listener) => listener(val));
}

export async function prefetchOrganizationEligibility(): Promise<OrganizationCreationEligibility | null> {
  if (inFlightPromise) return inFlightPromise;

  inFlightPromise = (async () => {
    try {
      const res = await api.get<any>('/users/me/organization-creation-eligibility');
      const data = res?.data || res;
      if (data) {
        const currentOwned = data.currentOwned ?? data.currentOwnedOrganizations ?? 0;
        const maximumOwned = data.maximumOwned ?? data.maximumOwnedOrganizations ?? 3;
        const remainingOwned = data.remainingOwned ?? data.remainingOwnedOrganizations ?? Math.max(maximumOwned - currentOwned, 0);
        const canCreate = data.canCreate ?? data.allowed ?? (currentOwned < maximumOwned);

        const freeTrial = data.freeTrial || {
          used: 0,
          maximum: 1,
          available: true,
        };

        const result: OrganizationCreationEligibility = {
          canCreate,
          allowed: canCreate,
          currentOwned,
          currentOwnedOrganizations: currentOwned,
          maximumOwned,
          maximumOwnedOrganizations: maximumOwned,
          remainingOwned,
          remainingOwnedOrganizations: remainingOwned,
          freeTrial: {
            used: freeTrial.used ?? (freeTrial.available ? 0 : 1),
            maximum: freeTrial.maximum ?? 1,
            available: freeTrial.available ?? (freeTrial.used === 0),
            organizationId: freeTrial.organizationId,
            organizationName: freeTrial.organizationName,
            trialEndsAt: freeTrial.trialEndsAt,
          },
          reasons: data.reasons || (canCreate ? [] : ['organization_limit_reached']),
          recommendedPlan: data.recommendedPlan || (freeTrial.available ? 'free_trial' : 'standard'),
          override: data.override,
          code: data.code,
          message: data.message,
        };

        notifyListeners(result);
        return result;
      }
      return cachedEligibility;
    } catch {
      return cachedEligibility;
    } finally {
      inFlightPromise = null;
    }
  })();

  return inFlightPromise;
}

export function useOrganizationEligibility() {
  const [eligibility, setEligibility] = useState<OrganizationCreationEligibility>(
    () => cachedEligibility || DEFAULT_ELIGIBILITY
  );
  const [isLoading, setIsLoading] = useState<boolean>(!cachedEligibility);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const listener = (val: OrganizationCreationEligibility) => {
      setEligibility(val);
      setIsLoading(false);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const fetchEligibility = useCallback(async () => {
    if (!cachedEligibility) {
      setIsLoading(true);
    }
    setError(null);
    try {
      const res = await prefetchOrganizationEligibility();
      if (res) {
        setEligibility(res);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to check organization creation eligibility');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEligibility();
  }, [fetchEligibility]);

  const isLimitReached = !eligibility.canCreate || !eligibility.allowed || eligibility.currentOwned >= eligibility.maximumOwned;
  const isApproachingLimit = !isLimitReached && eligibility.remainingOwned <= 1;

  return {
    eligibility,
    isLoading: isLoading && !cachedEligibility,
    error,
    refreshEligibility: fetchEligibility,
    isLimitReached,
    isApproachingLimit,
    isFreeTrialAvailable: eligibility.freeTrial.available,
  };
}
