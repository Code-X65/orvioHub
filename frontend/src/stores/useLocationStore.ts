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

export const DEFAULT_NIGERIAN_STATES: NigerianState[] = [
  { name: 'Abia', code: 'AB', stateCode: 'AB' },
  { name: 'Adamawa', code: 'AD', stateCode: 'AD' },
  { name: 'Akwa Ibom', code: 'AK', stateCode: 'AK' },
  { name: 'Anambra', code: 'AN', stateCode: 'AN' },
  { name: 'Bauchi', code: 'BA', stateCode: 'BA' },
  { name: 'Bayelsa', code: 'BY', stateCode: 'BY' },
  { name: 'Benue', code: 'BE', stateCode: 'BE' },
  { name: 'Borno', code: 'BO', stateCode: 'BO' },
  { name: 'Cross River', code: 'CR', stateCode: 'CR' },
  { name: 'Delta', code: 'DE', stateCode: 'DE' },
  { name: 'Ebonyi', code: 'EB', stateCode: 'EB' },
  { name: 'Edo', code: 'ED', stateCode: 'ED' },
  { name: 'Ekiti', code: 'EK', stateCode: 'EK' },
  { name: 'Enugu', code: 'EN', stateCode: 'EN' },
  { name: 'FCT (Abuja)', code: 'FC', stateCode: 'FC' },
  { name: 'Gombe', code: 'GO', stateCode: 'GO' },
  { name: 'Imo', code: 'IM', stateCode: 'IM' },
  { name: 'Jigawa', code: 'JI', stateCode: 'JI' },
  { name: 'Kaduna', code: 'KD', stateCode: 'KD' },
  { name: 'Kano', code: 'KN', stateCode: 'KN' },
  { name: 'Katsina', code: 'KT', stateCode: 'KT' },
  { name: 'Kebbi', code: 'KE', stateCode: 'KE' },
  { name: 'Kogi', code: 'KO', stateCode: 'KO' },
  { name: 'Kwara', code: 'KW', stateCode: 'KW' },
  { name: 'Lagos', code: 'LA', stateCode: 'LA' },
  { name: 'Nasarawa', code: 'NA', stateCode: 'NA' },
  { name: 'Niger', code: 'NI', stateCode: 'NI' },
  { name: 'Ogun', code: 'OG', stateCode: 'OG' },
  { name: 'Ondo', code: 'ON', stateCode: 'ON' },
  { name: 'Osun', code: 'OS', stateCode: 'OS' },
  { name: 'Oyo', code: 'OY', stateCode: 'OY' },
  { name: 'Plateau', code: 'PL', stateCode: 'PL' },
  { name: 'Rivers', code: 'RI', stateCode: 'RI' },
  { name: 'Sokoto', code: 'SO', stateCode: 'SO' },
  { name: 'Taraba', code: 'TA', stateCode: 'TA' },
  { name: 'Yobe', code: 'YO', stateCode: 'YO' },
  { name: 'Zamfara', code: 'ZA', stateCode: 'ZA' },
];

interface LocationStoreState {
  states: NigerianState[];
  lgasByState: Record<string, NigerianLga[]>;
  isLoadingStates: boolean;
  isLoadingLgas: Record<string, boolean>;
  hasLoadedStatesFromApi: boolean;
  error: string | null;

  // Actions
  fetchStates: () => Promise<NigerianState[]>;
  fetchLgas: (stateCode: string) => Promise<NigerianLga[]>;
}

let inFlightStatesPromise: Promise<NigerianState[]> | null = null;

export const useLocationStore = create<LocationStoreState>((set, get) => ({
  states: DEFAULT_NIGERIAN_STATES,
  lgasByState: {},
  isLoadingStates: false,
  isLoadingLgas: {},
  hasLoadedStatesFromApi: false,
  error: null,

  fetchStates: async () => {
    if (get().hasLoadedStatesFromApi && get().states.length > 0) {
      return get().states;
    }

    if (inFlightStatesPromise) {
      return inFlightStatesPromise;
    }

    set({ isLoadingStates: true, error: null });

    inFlightStatesPromise = (async () => {
      try {
        const response = await api.get<{ states?: NigerianState[]; data?: { states: NigerianState[] } }>(
          '/locations/states'
        );
        const fetchedStates = response.data?.states || response.states || [];
        if (fetchedStates.length > 0) {
          const sorted = [...fetchedStates].sort((a, b) => a.name.localeCompare(b.name));
          set({ states: sorted, isLoadingStates: false, hasLoadedStatesFromApi: true });
          return sorted;
        }
        set({ isLoadingStates: false, hasLoadedStatesFromApi: true });
        return get().states;
      } catch (err: any) {
        const msg = err.message || 'Failed to load Nigerian states from server.';
        // Retain DEFAULT_NIGERIAN_STATES so the application never breaks
        set({ error: msg, isLoadingStates: false });
        return get().states;
      } finally {
        inFlightStatesPromise = null;
      }
    })();

    return inFlightStatesPromise;
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

// Eagerly pre-fetch states at app initialization
if (typeof window !== 'undefined') {
  useLocationStore.getState().fetchStates().catch(() => {});
}
