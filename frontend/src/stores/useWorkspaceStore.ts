import { create } from 'zustand';
import { api } from '@/lib/api';
import {
  getCrossSubdomainItem,
  setCrossSubdomainItem,
  removeCrossSubdomainItem,
} from '@/lib/cookieStorage';

export interface WorkspaceItem {
  id: string;
  workspaceId?: string;
  organizationId?: string | null;
  name: string;
  slug: string;
  type?: string;
  currency?: string;
  country?: string;
  state?: string;
  city?: string;
  timezone?: string;
  logoUrl?: string;
  planId?: string;
  planKey?: string;
  planName?: string;
  subscriptionStatus?: string;
  subscription?: any;
  enabledModules?: string[];
  status: string;
  createdAt: number;
}

export interface UserWorkspaceEntry {
  workspace: WorkspaceItem;
  role: string;
  membershipId: string;
  workspaceId?: string;
  organizationId?: string | null;
  enabledProducts: Array<{
    productKey: string;
    status: string;
    planId?: string;
  }>;
}

export interface WorkspaceContextResponse {
  workspace: WorkspaceItem;
  membership: {
    id: string;
    role: string;
    status: string;
  } | null;
  products: Array<{
    key: string;
    status: string;
    planId?: string;
  }>;
  permissions: string[];
}

interface WorkspaceState {
  currentWorkspace: WorkspaceItem | null;
  currentOrganization: WorkspaceItem | null;
  currentRole: string | null;
  permissions: string[];
  products: Array<{ key: string; status: string; planId?: string }>;
  workspaces: UserWorkspaceEntry[];
  isLoading: boolean;
  isSwitching: boolean;
  error: string | null;

  fetchWorkspaces: (productKey?: string, search?: string, forceRefresh?: boolean) => Promise<UserWorkspaceEntry[]>;
  invalidateCache: () => void;
  selectWorkspace: (workspaceId: string, productKey?: string) => Promise<WorkspaceContextResponse>;
  loadWorkspaceContext: (workspaceId: string) => Promise<void>;
  hasPermission: (permission: string) => boolean;
  clearWorkspace: () => void;
}

const ACTIVE_WS_STORAGE_KEY = 'orvio_active_workspace_id';
let inFlightFetch: Promise<UserWorkspaceEntry[]> | null = null;
let inFlightKey: string = '';
let lastFetchedAt: number = 0;

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  currentWorkspace: null,
  currentOrganization: null,
  currentRole: null,
  permissions: [],
  products: [],
  workspaces: [],
  isLoading: false,
  isSwitching: false,
  error: null,

  invalidateCache: () => {
    lastFetchedAt = 0;
    inFlightFetch = null;
    inFlightKey = '';
  },

  fetchWorkspaces: async (productKey?: string, search?: string, forceRefresh?: boolean) => {
    const key = `${productKey || ''}::${search || ''}`;
    if (!forceRefresh && inFlightFetch && inFlightKey === key) {
      return inFlightFetch;
    }

    // Cache-first: if workspaces exist and were fetched in last 30s without search filter (and not forced), return cached list
    const existing = get().workspaces;
    if (!forceRefresh && existing.length > 0 && !search && Date.now() - lastFetchedAt < 30000) {
      return existing;
    }

    // Only set full isLoading state if we don't have any workspaces in memory yet
    if (existing.length === 0) {
      set({ isLoading: true, error: null });
    }

    inFlightKey = key;
    inFlightFetch = (async () => {
      try {
        const params = new URLSearchParams();
        if (productKey) params.append('product', productKey);
        if (search) params.append('search', search);

        const qs = params.toString() ? `?${params.toString()}` : '';
        const response = await api.get<{ workspaces?: UserWorkspaceEntry[]; data?: { workspaces: UserWorkspaceEntry[] } }>(`/workspaces${qs}`);
        const workspaces = response.workspaces || response.data?.workspaces || [];
        lastFetchedAt = Date.now();
        set({ workspaces });

        // If no active workspace is selected, try restoring from cross-subdomain storage or select first
        if (!get().currentWorkspace && workspaces.length > 0) {
          const savedId = getCrossSubdomainItem(ACTIVE_WS_STORAGE_KEY);
          const target = workspaces.find((w) => w.workspace.id === savedId || w.workspace.workspaceId === savedId || w.workspace.organizationId === savedId) || workspaces[0];
          if (target) {
            await get().selectWorkspace(target.workspace.id, productKey).catch(() => {});
          }
        }

        set({ isLoading: false });
        return workspaces;
      } catch (err: any) {
        set({ isLoading: false, error: err.message || 'Failed to fetch workspaces' });
        return [];
      } finally {
        inFlightFetch = null;
        inFlightKey = '';
      }
    })();

    return inFlightFetch;
  },

  selectWorkspace: async (workspaceId: string, productKey?: string) => {
    const isAlreadyActive = get().currentWorkspace?.id === workspaceId || get().currentWorkspace?.workspaceId === workspaceId;
    if (!isAlreadyActive) {
      set({ isSwitching: true, error: null });
    }
    try {
      const response = await api.post<WorkspaceContextResponse>(
        `/workspaces/${workspaceId}/select`,
        { productKey }
      );

      const context = response;
      setCrossSubdomainItem(ACTIVE_WS_STORAGE_KEY, workspaceId);

      const ws = context.workspace
        ? {
            ...context.workspace,
            workspaceId: context.workspace.workspaceId || context.workspace.id,
          }
        : null;

      set({
        currentWorkspace: ws,
        currentOrganization: ws,
        currentRole: context.membership?.role || 'member',
        permissions: context.permissions || [],
        products: context.products || [],
        isSwitching: false,
      });

      return context;
    } catch (err: any) {
      set({ isSwitching: false, error: err.message || 'Failed to switch workspace' });
      throw err;
    }
  },

  loadWorkspaceContext: async (workspaceId: string) => {
    try {
      const context = await api.get<WorkspaceContextResponse>(`/workspaces/${workspaceId}/context`);
      setCrossSubdomainItem(ACTIVE_WS_STORAGE_KEY, workspaceId);
      const ws = context.workspace
        ? {
            ...context.workspace,
            workspaceId: context.workspace.workspaceId || context.workspace.id,
          }
        : null;
      set({
        currentWorkspace: ws,
        currentOrganization: ws,
        currentRole: context.membership?.role || 'member',
        permissions: context.permissions || [],
        products: context.products || [],
      });
    } catch (err: any) {
      console.warn('[WorkspaceStore] Failed to load context:', err);
    }
  },

  hasPermission: (permission: string) => {
    const { permissions, currentRole } = get();
    if (currentRole?.toLowerCase() === 'owner' || currentRole?.toLowerCase() === 'admin') {
      return true;
    }
    if (permissions.includes('*')) return true;
    return permissions.includes(permission);
  },

  clearWorkspace: () => {
    removeCrossSubdomainItem(ACTIVE_WS_STORAGE_KEY);
    set({
      currentWorkspace: null,
      currentOrganization: null,
      currentRole: null,
      permissions: [],
      products: [],
      workspaces: [],
    });
  },
}));
