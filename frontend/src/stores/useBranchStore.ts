import { create } from 'zustand';
import { api } from '@/lib/api';
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
  phoneVerifiedAt?: number;
  email?: string;
  managerId?: string;
  status: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface CreateBranchInput {
  workspaceId?: string;
  organizationId?: string;
  applicationId?: string;
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
  managerId?: string;
}

export interface UpdateBranchInput {
  name?: string;
  code?: string;
  isPrimary?: boolean;
  isActive?: boolean;
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
  managerId?: string;
  status?: string;
}

interface BranchState {
  activeBranch: Branch | null;
  branches: Branch[];
  branchesByOrgAndApp: Record<string, Branch[]>;
  isLoading: boolean;
  isSendingPhoneOtp: boolean;
  isVerifyingPhoneOtp: boolean;
  error: string | null;

  setActiveBranch: (branch: Branch | null) => void;
  loadBranches: (workspaceOrOrgId: string, productKey?: string, forceReload?: boolean) => Promise<Branch[]>;
  createBranch: (data: CreateBranchInput) => Promise<Branch>;
  updateBranch: (branchId: string, data: UpdateBranchInput) => Promise<Branch>;
  deactivateBranch: (branchId: string, orgId?: string) => Promise<void>;
  sendBranchPhoneOtp: (workspaceId: string, branchId: string, phone: string) => Promise<{ success: boolean; expiresInSeconds?: number }>;
  verifyBranchPhoneOtp: (workspaceId: string, branchId: string, otp: string) => Promise<{ success: boolean }>;
  clearBranches: () => void;
}

let inFlightBranchFetches = new Map<string, Promise<Branch[]>>();
let lastFetchedBranches = new Map<string, number>();

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

  loadBranches: async (workspaceOrOrgId: string, productKey?: string, forceReload = false) => {
    if (!workspaceOrOrgId) return [];
    const cacheKey = `${workspaceOrOrgId}::${(productKey || '').toLowerCase()}`;
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
        const orgEndpoint = productKey
          ? `/organizations/${workspaceOrOrgId}/branches?app=${encodeURIComponent(productKey)}`
          : `/organizations/${workspaceOrOrgId}/branches`;

        try {
          const orgRes = await api.get<{ branches?: Branch[]; data?: { branches: Branch[] } }>(orgEndpoint);
          list = orgRes.branches || orgRes.data?.branches || [];
        } catch {
          const wsEndpoint = productKey
            ? `/workspaces/${workspaceOrOrgId}/branches?productKey=${encodeURIComponent(productKey)}`
            : `/workspaces/${workspaceOrOrgId}/branches`;
          const wsRes = await api.get<{ branches?: Branch[]; data?: { branches: Branch[] } }>(wsEndpoint);
          list = wsRes.branches || wsRes.data?.branches || [];
        }

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
      const targetId = data.organizationId || data.workspaceId;
      let newBranch: Branch;

      try {
        const res = await api.post<{ branch?: Branch; data?: { branch: Branch } }>(
          `/organizations/${targetId}/branches`,
          data
        );
        newBranch = (res.branch || res.data?.branch) as Branch;
      } catch (err: any) {
        if (err?.code === 'BRANCH_LIMIT_REACHED' || err?.message?.includes('Free Trial')) {
          throw err;
        }
        const res = await api.post<{ branch: Branch }>(`/workspaces/${data.workspaceId || targetId}/branches`, data);
        newBranch = res.branch;
      }

      // Invalidate cache
      if (targetId) {
        lastFetchedBranches.delete(`${targetId}::inventory`);
        lastFetchedBranches.delete(`${targetId}::`);
      }

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
        (currentBranch as any)?.organizationId ||
        currentBranch?.workspaceId ||
        getCrossSubdomainItem('orvio_active_workspace_id');

      let updated: Branch;
      try {
        const res = await api.patch<{ branch?: Branch; data?: { branch: Branch } }>(
          `/organizations/${targetId}/branches/${branchId}`,
          data
        );
        updated = res.branch || res.data?.branch || ({ id: branchId, ...data } as any);
      } catch {
        const res = await api.patch<{ branch: Branch }>(
          `/workspaces/${targetId}/branches/${branchId}`,
          data
        );
        updated = res.branch;
      }

      // Invalidate cache
      if (targetId) {
        lastFetchedBranches.delete(`${targetId}::inventory`);
        lastFetchedBranches.delete(`${targetId}::`);
      }

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
        (currentBranch as any)?.organizationId ||
        currentBranch?.workspaceId ||
        getCrossSubdomainItem('orvio_active_workspace_id');

      try {
        await api.delete(`/organizations/${targetId}/branches/${branchId}`);
      } catch {
        await api.delete(`/workspaces/${targetId}/branches/${branchId}`);
      }

      // Invalidate cache
      if (targetId) {
        lastFetchedBranches.delete(`${targetId}::inventory`);
        lastFetchedBranches.delete(`${targetId}::`);
      }

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
      const res = await api.post<{ success: boolean; data?: { expiresInSeconds: number } }>(
        `/workspaces/${workspaceId}/branches/${branchId}/phone/send-otp`,
        { phone }
      );
      set({ isSendingPhoneOtp: false });
      return { success: true, expiresInSeconds: res.data?.expiresInSeconds || 600 };
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
