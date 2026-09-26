import { create } from 'zustand';
import { api } from '@/lib/api';
import { LRUCache } from '@/lib/lru-cache';
import { invalidateApiQueries } from '@/lib/react-query-adapter';
import {
  getCrossSubdomainItem,
  setCrossSubdomainItem,
  removeCrossSubdomainItem,
} from '@/lib/cookieStorage';

export interface Branch {
  _id?: string;
  id?: string;
  workspaceId: string;
  name: string;
  code?: string;
  isPrimary?: boolean;
  country?: string;
  state?: string;
  stateCode?: string;
  lga?: string;
  city?: string;
  street?: string;
  blockNumber?: string;
  area?: string;
  landmark?: string;
  postalCode?: string;
  address?: string;
  formattedAddress?: string;
  phone?: string;
  phoneNormalized?: string;
  phoneVerified?: boolean;
  phoneOtpExpiresAt?: number;
  phoneVerificationAttempts?: number;
  email?: string;
  status: string;
  isHeadquarters?: boolean;
  taxIdentificationNumber?: string;
  notes?: string;
}

export interface CreateBranchInput {
  workspaceId: string;
  organizationId?: string;
  applicationKey?: string;
  name: string;
  code?: string;
  isPrimary?: boolean;
  country?: string;
  state?: string;
  stateCode?: string;
  lga?: string;
  city?: string;
  street?: string;
  blockNumber?: string;
  area?: string;
  landmark?: string;
  postalCode?: string;
  address?: string;
  formattedAddress?: string;
  phone?: string;
  email?: string;
  isHeadquarters?: boolean;
  taxIdentificationNumber?: string;
  notes?: string;
}

export interface UpdateBranchInput {
  name?: string;
  code?: string;
  isPrimary?: boolean;
  country?: string;
  state?: string;
  stateCode?: string;
  lga?: string;
  city?: string;
  street?: string;
  blockNumber?: string;
  area?: string;
  landmark?: string;
  postalCode?: string;
  address?: string;
  formattedAddress?: string;
  phone?: string;
  email?: string;
  status?: string;
  applicationKey?: string;
  organizationId?: string;
  isHeadquarters?: boolean;
  taxIdentificationNumber?: string;
  notes?: string;
}

interface BranchState {
  activeBranch: Branch | null;
  branches: Branch[];
  branchesByOrgAndApp: Record<string, Branch[]>;
  isLoading: boolean;
  isSendingPhoneOtp: boolean;
  isVerifyingPhoneOtp: boolean;
  error: string | null;

  // Actions
  setActiveBranch: (branch: Branch | null) => void;
  loadBranches: (
    workspaceId: string,
    productKey?: string,
    forceReload?: boolean,
    options?: { signal?: AbortSignal }
  ) => Promise<Branch[]>;
  createBranch: (data: CreateBranchInput) => Promise<Branch>;
  updateBranch: (branchId: string, data: UpdateBranchInput) => Promise<Branch>;
  deactivateBranch: (branchId: string, orgId?: string) => Promise<void>;
  sendBranchPhoneOtp: (workspaceId: string, branchId: string, phone: string) => Promise<{ success: boolean; expiresInSeconds?: number }>;
  verifyBranchPhoneOtp: (workspaceId: string, branchId: string, otp: string) => Promise<{ success: boolean }>;
  clearBranches: () => void;
}

const inFlightBranchFetches = new LRUCache<string, Promise<Branch[]>>(100, 30_000);
const lastFetchedBranches = new LRUCache<string, number>(100, 300_000);

export const useBranchStore = create<BranchState>((set, get) => ({
  activeBranch: null,
  branches: [],
  branchesByOrgAndApp: {},
  isLoading: false,
  isSendingPhoneOtp: false,
  isVerifyingPhoneOtp: false,
  error: null,

  setActiveBranch: (branch) => {
    if (branch) {
      const branchId = branch.id || branch._id;
      if (branchId) {
        setCrossSubdomainItem('orvio_active_branch_id', branchId);
      }
    } else {
      removeCrossSubdomainItem('orvio_active_branch_id');
    }
    set({ activeBranch: branch });
  },

  loadBranches: async (workspaceId: string, productKey?: string, forceReload = false, options?: { signal?: AbortSignal }) => {
    if (!workspaceId) return [];
    const cacheKey = `${workspaceId}::${(productKey || '').toLowerCase()}`;
    const cached = get().branchesByOrgAndApp[cacheKey];

    // Return in-flight promise if currently loading this exact key and not force reloading
    if (!forceReload && inFlightBranchFetches.has(cacheKey)) {
      return inFlightBranchFetches.get(cacheKey)!;
    }

    const lastFetchedAt = lastFetchedBranches.get(cacheKey) || 0;
    if (!forceReload && cached && cached.length > 0 && Date.now() - lastFetchedAt < 15000) {
      set({ branches: cached, isLoading: false, error: null });
      return cached;
    }

    if (!forceReload && cached && cached.length > 0) {
      set({ branches: cached, isLoading: false, error: null });
    } else if (get().branches.length === 0) {
      set({ isLoading: true, error: null });
    }

    const fetchPromise = (async () => {
      try {
        let list: Branch[] = [];
        const endpoint = productKey
          ? `/workspaces/${workspaceId}/branches?productKey=${encodeURIComponent(productKey)}`
          : `/workspaces/${workspaceId}/branches`;
        const wsRes = await api.get<{ branches?: Branch[] }>(endpoint, {
          workspaceId,
          signal: options?.signal,
        });
        list = wsRes.branches || [];

        // Sort: primary branch first, then alphabetically
        const sorted = [...list].sort((a, b) => {
          if (a.isPrimary && !b.isPrimary) return -1;
          if (!a.isPrimary && b.isPrimary) return 1;
          return a.name.localeCompare(b.name);
        });

        const currentActive = get().activeBranch;
        const storedBranchId = getCrossSubdomainItem('orvio_active_branch_id');

        let targetBranch: Branch | null = null;
        if (storedBranchId) {
          targetBranch = sorted.find((b) => (b.id || b._id) === storedBranchId) || null;
        }

        if (!targetBranch && currentActive) {
          targetBranch = sorted.find((b) => (b.id || b._id) === (currentActive.id || currentActive._id)) || null;
        }

        // Auto-select primary or first branch if none selected
        if (!targetBranch && sorted.length > 0) {
          targetBranch = sorted.find((b) => b.isPrimary) || sorted[0];
        }

        if (targetBranch) {
          const branchId = targetBranch.id || targetBranch._id;
          if (branchId) {
            setCrossSubdomainItem('orvio_active_branch_id', branchId);
          }
        }

        lastFetchedBranches.set(cacheKey, Date.now());
        set((state) => ({
          branches: sorted,
          branchesByOrgAndApp: {
            ...state.branchesByOrgAndApp,
            [cacheKey]: sorted,
          },
          activeBranch: targetBranch,
          isLoading: false,
        }));

        return sorted;
      } catch (err: any) {
        if (err?.name === 'AbortError' || options?.signal?.aborted) {
          return [];
        }
        set({ error: err.message || 'Failed to load branches', isLoading: false });
        return [];
      } finally {
        inFlightBranchFetches.delete(cacheKey);
      }
    })();

    inFlightBranchFetches.set(cacheKey, fetchPromise);
    return fetchPromise;
  },

  createBranch: async (data: CreateBranchInput) => {
    set({ isLoading: true, error: null });
    try {
      const targetId = data.workspaceId || data.organizationId;
      if (!targetId) throw new Error('workspaceId is required to create a branch');
      const res = await api.post<{ branch: Branch }>(`/workspaces/${targetId}/branches`, data, { workspaceId: targetId });
      const newBranch = res.branch;

      // Invalidate cache
      if (targetId) {
        lastFetchedBranches.delete(`${targetId}::inventory`);
        lastFetchedBranches.delete(`${targetId}::`);
      }
      invalidateApiQueries('/organizations/usage/summary');
      invalidateApiQueries(`/workspaces/${targetId}/branches`);

      set((state) => {
        const updated = [...state.branches, newBranch].sort((a, b) => {
          if (a.isPrimary && !b.isPrimary) return -1;
          if (!a.isPrimary && b.isPrimary) return 1;
          return a.name.localeCompare(b.name);
        });

        // Set as active branch
        const branchId = newBranch.id || newBranch._id;
        if (branchId) {
          setCrossSubdomainItem('orvio_active_branch_id', branchId);
        }

        return {
          branches: updated,
          activeBranch: newBranch,
          isLoading: false,
        };
      });

      return newBranch;
    } catch (err: any) {
      set({ isLoading: false, error: err.message || 'Failed to create branch' });
      throw err;
    }
  },

  updateBranch: async (branchId: string, data: UpdateBranchInput) => {
    set({ isLoading: true, error: null });
    try {
      const currentBranch = get().activeBranch;
      const targetId =
        currentBranch?.workspaceId ||
        getCrossSubdomainItem('orvio_active_workspace_id');

      if (!targetId) throw new Error('workspaceId is required to update a branch');
      const res = await api.patch<{ branch: Branch }>(`/workspaces/${targetId}/branches/${branchId}`, data, { workspaceId: targetId, branchId });
      const updated = res.branch;

      // Invalidate cache
      if (targetId) {
        lastFetchedBranches.delete(`${targetId}::inventory`);
        lastFetchedBranches.delete(`${targetId}::`);
      }
      invalidateApiQueries(`/workspaces/${targetId}/branches`);

      set((state) => {
        const branches = state.branches
          .map((b) =>
            (b.id || b._id) === branchId ? { ...b, ...updated } : data.isPrimary ? { ...b, isPrimary: false } : b
          )
          .sort((a, b) => {
            if (a.isPrimary && !b.isPrimary) return -1;
            if (!a.isPrimary && b.isPrimary) return 1;
            return a.name.localeCompare(b.name);
          });

        const activeBranch =
          (state.activeBranch?.id || state.activeBranch?._id) === branchId
            ? { ...state.activeBranch, ...updated }
            : state.activeBranch || updated || branches[0] || null;

        const effectiveBranchId = activeBranch?.id || activeBranch?._id || branchId;
        if (effectiveBranchId) {
          setCrossSubdomainItem('orvio_active_branch_id', effectiveBranchId);
        }

        return {
          branches,
          activeBranch,
          isLoading: false,
        };
      });

      return updated;
    } catch (err: any) {
      set({ isLoading: false, error: err.message || 'Failed to update branch' });
      throw err;
    }
  },

  deactivateBranch: async (branchId: string, orgId?: string) => {
    set({ isLoading: true, error: null });
    try {
      const currentBranch = get().activeBranch;
      const targetId =
        orgId ||
        currentBranch?.workspaceId ||
        getCrossSubdomainItem('orvio_active_workspace_id');

      if (!targetId) throw new Error('workspaceId is required to deactivate a branch');
      await api.delete(`/workspaces/${targetId}/branches/${branchId}`, undefined, { workspaceId: targetId, branchId });

      // Invalidate cache
      if (targetId) {
        lastFetchedBranches.delete(`${targetId}::inventory`);
        lastFetchedBranches.delete(`${targetId}::`);
      }
      invalidateApiQueries('/organizations/usage/summary');
      invalidateApiQueries(`/workspaces/${targetId}/branches`);

      set((state) => {
        const filtered = state.branches.filter((b) => (b.id || b._id) !== branchId);
        const nextActive =
          (state.activeBranch?.id || state.activeBranch?._id) === branchId
            ? filtered[0] || null
            : state.activeBranch;

        if (nextActive) {
          const nextId = nextActive.id || nextActive._id;
          if (nextId) setCrossSubdomainItem('orvio_active_branch_id', nextId);
        } else {
          removeCrossSubdomainItem('orvio_active_branch_id');
        }

        return {
          branches: filtered,
          activeBranch: nextActive,
          isLoading: false,
        };
      });
    } catch (err: any) {
      set({ isLoading: false, error: err.message || 'Failed to deactivate branch' });
      throw err;
    }
  },

  sendBranchPhoneOtp: async (workspaceId: string, branchId: string, phone: string) => {
    set({ isSendingPhoneOtp: true });
    try {
      const res = await api.post<{ expiresInSeconds?: number }>(
        `/workspaces/${workspaceId}/branches/${branchId}/phone/send-otp`,
        { phone }
      );
      set({ isSendingPhoneOtp: false });
      return { success: true, expiresInSeconds: res.expiresInSeconds || 600 };
    } catch (err: any) {
      set({ isSendingPhoneOtp: false });
      throw err;
    }
  },

  verifyBranchPhoneOtp: async (workspaceId: string, branchId: string, otp: string) => {
    set({ isVerifyingPhoneOtp: true });
    try {
      await api.post<{ success: boolean }>(
        `/workspaces/${workspaceId}/branches/${branchId}/phone/verify-otp`,
        { otp }
      );
      set({ isVerifyingPhoneOtp: false });
      await get().loadBranches(workspaceId, undefined, true);
      return { success: true };
    } catch (err: any) {
      set({ isVerifyingPhoneOtp: false });
      throw err;
    }
  },

  clearBranches: () => {
    removeCrossSubdomainItem('orvio_active_branch_id');
    set({ activeBranch: null, branches: [], error: null });
  },
}));
