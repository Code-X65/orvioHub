import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { handleApiError } from '@/lib/error-handler';
import { createQueryKey } from '@/lib/react-query-adapter';

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

export const DEFAULT_ELIGIBILITY: OrganizationCreationEligibility = {
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

export const ORG_ELIGIBILITY_QUERY_KEY = createQueryKey('/users/me/organization-creation-eligibility');

export async function fetchOrganizationEligibility(): Promise<OrganizationCreationEligibility> {
  try {
    const res = await api.get<any>('/users/me/organization-creation-eligibility');
  const data = res?.data || res;
  if (!data) return DEFAULT_ELIGIBILITY;

  const currentOwned = data.currentOwned ?? data.currentOwnedOrganizations ?? 0;
  const maximumOwned = data.maximumOwned ?? data.maximumOwnedOrganizations ?? 3;
  const remainingOwned = data.remainingOwned ?? data.remainingOwnedOrganizations ?? Math.max(maximumOwned - currentOwned, 0);
  const canCreate = data.canCreate ?? data.allowed ?? (currentOwned < maximumOwned);

  const freeTrial = data.freeTrial || {
    used: 0,
    maximum: 1,
    available: true,
  };

  return {
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
  } catch (err) {
    handleApiError(err, 'fetch organization creation eligibility', { showError: false });
    return DEFAULT_ELIGIBILITY;
  }
}

export function useOrganizationEligibility() {
  const query = useQuery({
    queryKey: ORG_ELIGIBILITY_QUERY_KEY,
    queryFn: fetchOrganizationEligibility,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  const eligibility = query.data || DEFAULT_ELIGIBILITY;

  return {
    eligibility,
    isLoading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    refreshEligibility: query.refetch,
    isLimitReached: !eligibility.canCreate || !eligibility.allowed,
    isFreeTrialAvailable: eligibility.freeTrial.available,
  };
}
