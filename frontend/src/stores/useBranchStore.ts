import { create } from 'zustand';
import { api } from '@/lib/api';
import {
  getCrossSubdomainItem,
  setCrossSubdomainItem,
  removeCrossSubdomainItem,
} from '@/lib/cookieStorage';
import { getErrorMessage } from '@/lib/errorMapper';
import { crossTabSync } from '@/lib/crossTabSync';

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
  phoneStatus?: 'unverified' | 'pending' | 'verified';
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
  loadingByOrgAndApp: Record<string, boolean>;
  errorsByOrgAndApp: Record<string, string | null>;
  isLoading: boolean;
  isSendingPhoneOtp: boolean;
  isVerifyingPhoneOtp: boolean;
  error: string | null;

  setActiveBranch: (branch: Branch | null) => void;
  setNavigating: (isNavigating: boolean) => void;
  getPrimaryBranch: () => Branch | null;
  loadBranches: (workspaceOrOrgId: string, productKey?: string, forceReload?: boolean) => Promise<Branch[]>;
  fetchBranches: (workspaceOrOrgId?: string, productKey?: string, forceReload?: boolean) => Promise<Branch[]>;
  createBranch: (data: CreateBranchInput) => Promise<Branch>;
  updateBranch: (branchId: string, data: UpdateBranchInput, organizationId?: string) => Promise<Branch>;
  deactivateBranch: (branchId: string, orgId?: string) => Promise<void>;
  sendBranchPhoneOtp: (workspaceId: string, branchId: string, phone: string) => Promise<{ success: boolean; expiresInSeconds?: number }>;
  verifyBranchPhoneOtp: (workspaceId: string, branchId: string, otp: string) => Promise<{ success: boolean }>;
  clearBranches: () => void;
}

let inFlightBranchFetches = new Map<string, Promise<Branch[]>>();
let lastFetchedBranches = new Map<string, number>();
let latestVisibleBranchRequest = 0;

function getStoredActiveBranch(): Branch | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = getCrossSubdomainItem('orvio_active_branch_data');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const initialStoredBranch = getStoredActiveBranch();

export const useBranchStore = create<BranchState>((set, get) => ({
  activeBranch: initialStoredBranch,
  branches: [],
  branchesByOrgAndApp: {},
  loadingByOrgAndApp: {},
  errorsByOrgAndApp: {},
  isLoading: false,
  isSendingPhoneOtp: false,
  isVerifyingPhoneOtp: false,
  error: null,

  /** True while the user is intentionally navigating (e.g. via BranchSwitcher).
   *  Programmatic reloads should not overwrite activeBranch when this is true. */
  setNavigating: (isNavigating) => set({ isLoading: isNavigating }),

  setActiveBranch: (branch) => {
    if (branch) {
      const branchId = branch.id || branch._id;
      if (branchId) {
        setCrossSubdomainItem('orvio_active_branch_id', branchId);
      }
      setCrossSubdomainItem('orvio_active_branch_data', JSON.stringify({
        id: branchId,
        _id: branchId,
        workspaceId: branch.workspaceId,
        name: branch.name,
        code: branch.code,
        isPrimary: branch.isPrimary,
        status: branch.status,
      }));
      if (branchId) {
        crossTabSync.broadcastBranchChange(branchId, branch.name);
      }
    } else {
      removeCrossSubdomainItem('orvio_active_branch_id');
      removeCrossSubdomainItem('orvio_active_branch_data');
    }
    set({ activeBranch: branch });
  },

  getPrimaryBranch: () => {
    const list = get().branches;
    return list.find((b) => b.isPrimary) || (list.length === 1 ? list[0] : null);
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
    if (!forceReload && cached && Date.now() - lastFetchedAt < 15000) {
      latestVisibleBranchRequest++;
      set({ branches: cached, isLoading: false, error: null });
      return cached;
    }

    const requestSequence = ++latestVisibleBranchRequest;

    set((state) => ({
      loadingByOrgAndApp: { ...state.loadingByOrgAndApp, [cacheKey]: true },
      errorsByOrgAndApp: { ...state.errorsByOrgAndApp, [cacheKey]: null },
    }));

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

        // Filter active branches to exclude suspended/archived/soft-deleted
        const activeOnly = list.filter(
          (b) => b.status !== 'archived' && b.status !== 'suspended' && b.status !== 'deleted' && b.status !== 'inactive'
        );

        // Sort: primary branch first, then alphabetically
        const sorted = [...activeOnly].sort((a, b) => {
          if (a.isPrimary && !b.isPrimary) return -1;
          if (!a.isPrimary && b.isPrimary) return 1;
          return a.name.localeCompare(b.name);
        });

        const currentActive = get().activeBranch;
        const storedBranchId = getCrossSubdomainItem('orvio_active_branch_id');

        // ── Impl 26: Non-aggressive auto-selection ───────────────────────────────
        // Priority order:
        //  1. Previously stored branch ID in cookie (cross-tab persistence)
        //  2. Currently active branch in Zustand state (navigation continuity)
        //  3. Auto-select primary/first ONLY when branches was previously empty
        //     (i.e., first load or after clearBranches()) or when neither above resolves.
        // We NEVER overwrite a valid active branch on a reload/cache-invalidation cycle.
        // ────────────────────────────────────────────────────────────────────────
        let targetBranch: Branch | null = null;
        let forcedSwitchName: string | null = null;

        // 1. Resolve from stored cookie
        if (storedBranchId) {
          targetBranch = sorted.find((b) => (b.id || b._id) === storedBranchId) || null;
        }

        // 2. Resolve from Zustand state (takes precedence over cookie when still valid)
        if (currentActive) {
          const currentId = currentActive.id || currentActive._id;
          const stillExists = sorted.find((b) => (b.id || b._id) === currentId) || null;
          if (stillExists) {
            // Branch still valid — keep it. This prevents reload from silently switching.
            targetBranch = stillExists;
          } else if (targetBranch === null) {
            // The user's active branch was removed from this org/app combo.
            // Fall through to auto-select below and surface a toast notification.
            const primaryOrFirst = sorted.find((b) => b.isPrimary) || sorted[0] || null;
            if (primaryOrFirst) {
              forcedSwitchName = primaryOrFirst.name;
              targetBranch = primaryOrFirst;
            }
          }
        }

        // 3. Auto-select primary/first only when no active branch exists at all
        if (!targetBranch && sorted.length > 0) {
          targetBranch = sorted.find((b) => b.isPrimary) || sorted[0];
        }

        if (requestSequence === latestVisibleBranchRequest) {
          if (targetBranch) {
            const branchId = targetBranch.id || targetBranch._id;
            if (branchId) {
              setCrossSubdomainItem('orvio_active_branch_id', branchId);
            }
          } else {
            removeCrossSubdomainItem('orvio_active_branch_id');
          }
        }

        lastFetchedBranches.set(cacheKey, Date.now());
        set((state) => ({
          branches: requestSequence === latestVisibleBranchRequest ? sorted : state.branches,
          branchesByOrgAndApp: {
            ...state.branchesByOrgAndApp,
            [cacheKey]: sorted,
          },
          activeBranch: requestSequence === latestVisibleBranchRequest ? targetBranch : state.activeBranch,
          isLoading: false,
          loadingByOrgAndApp: { ...state.loadingByOrgAndApp, [cacheKey]: false },
          errorsByOrgAndApp: { ...state.errorsByOrgAndApp, [cacheKey]: null },
        }));

        // Notify after state is committed so toast is visible
        if (forcedSwitchName && requestSequence === latestVisibleBranchRequest) {
          // Dynamically import toast to avoid circular deps — BranchStore has no UI dependency
          import('sonner').then(({ toast }) => {
            toast.warning(
              `Active branch was removed. Switched to "${forcedSwitchName}".`,
              { duration: 5000, id: 'branch-forced-switch' }
            );
          }).catch(() => {});
        }

        return sorted;
      } catch (err: any) {
        const message = getErrorMessage(err, 'Failed to load branches');
        if (requestSequence === latestVisibleBranchRequest) {
          removeCrossSubdomainItem('orvio_active_branch_id');
        }
        set((state) => ({
          activeBranch: requestSequence === latestVisibleBranchRequest ? null : state.activeBranch,
          branches: requestSequence === latestVisibleBranchRequest ? [] : state.branches,
          error: requestSequence === latestVisibleBranchRequest ? message : state.error,
          isLoading: false,
          loadingByOrgAndApp: { ...state.loadingByOrgAndApp, [cacheKey]: false },
          errorsByOrgAndApp: { ...state.errorsByOrgAndApp, [cacheKey]: message },
        }));
        return [];
      } finally {
        inFlightBranchFetches.delete(cacheKey);
      }
    })();

    inFlightBranchFetches.set(cacheKey, fetchPromise);
    return fetchPromise;
  },

  fetchBranches: async (workspaceOrOrgId?: string, productKey?: string, forceReload = false) => {
    const id = workspaceOrOrgId || getCrossSubdomainItem('orvio_active_workspace_id') || '';
    if (!id) return get().branches;
    return get().loadBranches(id, productKey, forceReload);
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
        api.invalidateByTag(['branches', 'workspaces', `workspaces:${targetId}`]);
      }

      set((state) => {
        const isSoleBranch = state.branches.length === 0;
        const normalizedBranch: Branch = isSoleBranch ? { ...newBranch, isPrimary: true } : newBranch;

        const updated = [...state.branches, normalizedBranch].sort((a, b) => {
          if (a.isPrimary && !b.isPrimary) return -1;
          if (!a.isPrimary && b.isPrimary) return 1;
          return a.name.localeCompare(b.name);
        });

        // Decouple active branch from primary branch:
        // 1. If only 1 branch exists in total, auto-set it as both active and primary
        // 2. If the user explicitly designated this new branch as primary, or had no active branch, set it as active
        // 3. Otherwise, keep the user's existing operational activeBranch so adding branches doesn't unexpectedly switch views
        let nextActiveBranch = state.activeBranch;
        if (updated.length === 1 || normalizedBranch.isPrimary || !state.activeBranch) {
          nextActiveBranch = normalizedBranch;
          const branchId = normalizedBranch.id || normalizedBranch._id;
          if (branchId) {
            setCrossSubdomainItem('orvio_active_branch_id', branchId);
          }
        }

        return {
          branches: updated,
          activeBranch: nextActiveBranch,
          isLoading: false,
        };
      });

      return newBranch;
    } catch (err: any) {
      set({ isLoading: false, error: getErrorMessage(err, 'Failed to create branch') });
      throw err;
    }
  },

  updateBranch: async (branchId: string, data: UpdateBranchInput, organizationId?: string) => {
    set({ isLoading: true, error: null });
    try {
      const currentBranch = get().activeBranch;
      const targetId =
        organizationId ||
        (data as any)?.organizationId ||
        (data as any)?.workspaceId ||
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
        api.invalidateByTag(['branches', 'workspaces', `workspaces:${targetId}`]);
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
      set({ isLoading: false, error: getErrorMessage(err, 'Failed to update branch') });
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
        api.invalidateByTag(['branches', 'workspaces', `workspaces:${targetId}`]);
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
      set({ isLoading: false, error: getErrorMessage(err, 'Failed to deactivate branch') });
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
    latestVisibleBranchRequest++;
    removeCrossSubdomainItem('orvio_active_branch_id');
    removeCrossSubdomainItem('orvio_active_branch_data');
    set({
      activeBranch: null,
      branches: [],
      branchesByOrgAndApp: {},
      loadingByOrgAndApp: {},
      errorsByOrgAndApp: {},
      error: null,
    });
  },
}));
