import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { createQueryKey } from '@/lib/react-query-adapter';

export interface NigerianState {
  _id?: string;
  name: string;
  code: string;
  stateCode: string;
}

export interface NigerianLga {
  _id?: string;
  name: string;
  stateCode: string;
}

export const STATES_QUERY_KEY = createQueryKey('/locations/states');
export const createLgasQueryKey = (stateCode: string) =>
  createQueryKey(`/locations/states/${stateCode.trim().toUpperCase()}/lgas`);

export async function fetchNigerianStates(): Promise<NigerianState[]> {
  const response = await api.get<{ states?: NigerianState[]; data?: { states: NigerianState[] } }>(
    '/locations/states'
  );
  const states = response.states || response.data?.states || [];
  return [...states].sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchNigerianLgas(stateCode: string): Promise<NigerianLga[]> {
  if (!stateCode) return [];
  const normalized = stateCode.trim().toUpperCase();
  const response = await api.get<{ lgas?: NigerianLga[]; data?: { lgas: NigerianLga[] } }>(
    `/locations/states/${normalized}/lgas`
  );
  const lgas = response.lgas || response.data?.lgas || [];
  return [...lgas].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * React Query hook for loading Nigerian States.
 * Includes 24h stale time for static geographical data.
 */
export function useNigerianStates() {
  const query = useQuery({
    queryKey: STATES_QUERY_KEY,
    queryFn: fetchNigerianStates,
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
  });

  return {
    states: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error ? (query.error as Error).message : null,
    refetch: query.refetch,
  };
}

/**
 * React Query hook for loading LGAs for a given Nigerian State code.
 * Includes 24h stale time and automatic dependency on stateCode.
 */
export function useNigerianLgas(stateCode?: string) {
  const normalized = stateCode ? stateCode.trim().toUpperCase() : '';
  const query = useQuery({
    queryKey: createLgasQueryKey(normalized),
    queryFn: () => fetchNigerianLgas(normalized),
    enabled: Boolean(normalized),
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
  });

  return {
    lgas: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error ? (query.error as Error).message : null,
    refetch: query.refetch,
  };
}
