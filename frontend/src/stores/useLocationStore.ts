import { create } from 'zustand';
import { queryClient } from '../lib/react-query-adapter';
import {
  fetchNigerianStates,
  fetchNigerianLgas,
  STATES_QUERY_KEY,
  createLgasQueryKey,
  type NigerianState,
  type NigerianLga,
} from '../hooks/useLocations';

export type { NigerianState, NigerianLga };

interface LocationStoreState {
  states: NigerianState[];
  lgasByState: Record<string, NigerianLga[]>;
  isLoadingStates: boolean;
  isLoadingLgas: Record<string, boolean>;
  error: string | null;

  // Actions
  fetchStates: () => Promise<NigerianState[]>;
  fetchLgas: (stateCode: string) => Promise<NigerianLga[]>;
}

export const useLocationStore = create<LocationStoreState>((set, get) => ({
  states: [],
  lgasByState: {},
  isLoadingStates: false,
  isLoadingLgas: {},
  error: null,

  fetchStates: async () => {
    const existing = get().states;
    if (existing.length > 0) {
      return existing;
    }

    set({ isLoadingStates: true, error: null });
    try {
      const sorted = await queryClient.fetchQuery({
        queryKey: STATES_QUERY_KEY,
        queryFn: fetchNigerianStates,
        staleTime: 1000 * 60 * 60 * 24,
      });
      set({ states: sorted, isLoadingStates: false });
      return sorted;
    } catch (err: any) {
      const msg = err.message || 'Failed to load Nigerian states.';
      set({ error: msg, isLoadingStates: false });
      return [];
    }
  },

  fetchLgas: async (stateCode: string) => {
    if (!stateCode) return [];
    const normalized = stateCode.trim().toUpperCase();
    const existing = get().lgasByState[normalized];
    if (existing && existing.length > 0) {
      return existing;
    }

    set((state) => ({
      isLoadingLgas: { ...state.isLoadingLgas, [normalized]: true },
    }));

    try {
      const sorted = await queryClient.fetchQuery({
        queryKey: createLgasQueryKey(normalized),
        queryFn: () => fetchNigerianLgas(normalized),
        staleTime: 1000 * 60 * 60 * 24,
      });

      set((state) => ({
        lgasByState: { ...state.lgasByState, [normalized]: sorted },
        isLoadingLgas: { ...state.isLoadingLgas, [normalized]: false },
      }));

      return sorted;
    } catch (err: any) {
      set((state) => ({
        isLoadingLgas: { ...state.isLoadingLgas, [normalized]: false },
      }));
      return [];
    }
  },
}));
