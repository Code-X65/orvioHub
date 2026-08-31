import { create } from 'zustand';
import { api } from '@/lib/api';

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
  email?: string;
  managerId?: string;
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
  managerId?: string;
  status?: string;
}

interface BranchState {
  activeBranch: Branch | null;
  branches: Branch[];
  isLoading: boolean;
  isSendingPhoneOtp: boolean;
  isVerifyingPhoneOtp: boolean;
  error: string | null;

  setActiveBranch: (branch: Branch | null) => void;
  loadBranches: (workspaceId: string, productKey?: string) => Promise<Branch[]>;
  createBranch: (data: CreateBranchInput) => Promise<Branch>;
  updateBranch: (branchId: string, data: UpdateBranchInput) => Promise<Branch>;
  sendBranchPhoneOtp: (workspaceId: string, branchId: string, phone: string) => Promise<{ success: boolean; expiresInSeconds?: number }>;
  verifyBranchPhoneOtp: (workspaceId: string, branchId: string, otp: string) => Promise<{ success: boolean }>;
  clearBranches: () => void;
}

export const useBranchStore = create<BranchState>((set, get) => ({
  activeBranch: null,
  branches: [],
  isLoading: false,
  isSendingPhoneOtp: false,
  isVerifyingPhoneOtp: false,
  error: null,

  setActiveBranch: (branch) => {
    if (branch) {
      const branchId = branch.id || branch._id;
      if (branchId) {
        localStorage.setItem('orvio_active_branch_id', branchId);
      }
    } else {
      localStorage.removeItem('orvio_active_branch_id');
    }
    set({ activeBranch: branch });
  },

  loadBranches: async (workspaceId: string, productKey?: string) => {
    if (!workspaceId) return [];
    set({ isLoading: true, error: null });

    try {
      const endpoint = productKey
        ? `/workspaces/${workspaceId}/branches?productKey=${encodeURIComponent(productKey)}`
        : `/workspaces/${workspaceId}/branches`;

      const res = await api.get<{ branches: Branch[] }>(endpoint);
      const list = res.branches || [];

      // Sort: primary branch first, then alphabetically
      const sorted = [...list].sort((a, b) => {
        if (a.isPrimary && !b.isPrimary) return -1;
        if (!a.isPrimary && b.isPrimary) return 1;
        return a.name.localeCompare(b.name);
      });

      const currentActive = get().activeBranch;
      const storedBranchId = localStorage.getItem('orvio_active_branch_id');

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
          localStorage.setItem('orvio_active_branch_id', branchId);
        }
      }

      set({
        branches: sorted,
        activeBranch: targetBranch,
        isLoading: false,
      });

      return sorted;
    } catch (err: any) {
      set({
        branches: [],
        isLoading: false,
        error: err.message || 'Failed to load branches',
      });
      return [];
    }
  },

  createBranch: async (data: CreateBranchInput) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post<{ branch: Branch }>(`/workspaces/${data.workspaceId}/branches`, data);
      const newBranch = res.branch;

      set((state) => {
        const updated = [...state.branches, newBranch].sort((a, b) => {
          if (a.isPrimary && !b.isPrimary) return -1;
          if (!a.isPrimary && b.isPrimary) return 1;
          return a.name.localeCompare(b.name);
        });

        // Set as active branch
        const branchId = newBranch.id || newBranch._id;
        if (branchId) {
          localStorage.setItem('orvio_active_branch_id', branchId);
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
      const workspaceId = currentBranch?.workspaceId || localStorage.getItem('orvio_active_workspace_id');
      const res = await api.patch<{ branch: Branch }>(
        `/workspaces/${workspaceId}/branches/${branchId}`,
        data
      );
      const updated = res.branch;

      set((state) => {
        const branches = state.branches.map((b) =>
          (b.id || b._id) === branchId ? updated : data.isPrimary ? { ...b, isPrimary: false } : b
        ).sort((a, b) => {
          if (a.isPrimary && !b.isPrimary) return -1;
          if (!a.isPrimary && b.isPrimary) return 1;
          return a.name.localeCompare(b.name);
        });

        const activeBranch =
          (state.activeBranch?.id || state.activeBranch?._id) === branchId
            ? updated
            : state.activeBranch;

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
      await get().loadBranches(workspaceId);
      return { success: true };
    } catch (err: any) {
      set({ isVerifyingPhoneOtp: false });
      throw err;
    }
  },

  clearBranches: () => {
    localStorage.removeItem('orvio_active_branch_id');
    set({ activeBranch: null, branches: [], error: null });
  },
}));
