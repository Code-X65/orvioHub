import { create } from 'zustand';
import { api } from '../lib/api';

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
      const response = await api.get<{ states?: NigerianState[]; data?: { states: NigerianState[] } }>(
        '/locations/states'
      );
      const states = response.data?.states || response.states || [];
      const sorted = [...states].sort((a, b) => a.name.localeCompare(b.name));
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
      const response = await api.get<{ lgas?: NigerianLga[]; data?: { lgas: NigerianLga[] } }>(
        `/locations/states/${normalized}/lgas`
      );
      const lgas = response.data?.lgas || response.lgas || [];
      const sorted = [...lgas].sort((a, b) => a.name.localeCompare(b.name));

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
