import { create } from 'zustand';
import { api } from '@/lib/api';
import {
  getCrossSubdomainItem,
  setCrossSubdomainItem,
  removeCrossSubdomainItem,
} from '@/lib/cookieStorage';
import { useBranchStore } from './useBranchStore';
import { getErrorMessage } from '@/lib/errorMapper';
import { crossTabSync } from '@/lib/crossTabSync';

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
  phone?: string;
  phoneNormalized?: string;
  phoneVerified?: boolean;
  phoneVerifiedAt?: number;
  phoneStatus?: 'unverified' | 'pending' | 'verified';
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
  hasFetchedWorkspaces: boolean;
  error: string | null;

  fetchWorkspaces: (productKey?: string, search?: string, forceRefresh?: boolean) => Promise<UserWorkspaceEntry[]>;
  invalidateCache: () => void;
  selectWorkspace: (workspaceId: string, productKey?: string) => Promise<WorkspaceContextResponse>;
  loadWorkspaceContext: (workspaceId: string) => Promise<void>;
  hasPermission: (permission: string) => boolean;
  clearWorkspace: () => void;
}

const ACTIVE_WS_STORAGE_KEY = 'orvio_active_workspace_id';
const ACTIVE_WS_DATA_KEY = 'orvio_active_workspace_data';
const ACTIVE_ROLE_KEY = 'orvio_active_role';

function getStoredActiveWorkspace(): WorkspaceItem | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = getCrossSubdomainItem(ACTIVE_WS_DATA_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveStoredActiveWorkspace(ws: WorkspaceItem | null) {
  if (typeof window === 'undefined') return;
  try {
    if (ws) {
      setCrossSubdomainItem(ACTIVE_WS_DATA_KEY, JSON.stringify({
        id: ws.id,
        workspaceId: ws.workspaceId || ws.id,
        organizationId: ws.organizationId || ws.id,
        name: ws.name,
        slug: ws.slug,
        enabledModules: ws.enabledModules || ['inventory', 'pos'],
        planKey: ws.planKey || ws.planId || 'standard',
        status: ws.status || 'active',
      }));
    } else {
      removeCrossSubdomainItem(ACTIVE_WS_DATA_KEY);
    }
  } catch {}
}

let inFlightFetch: Promise<UserWorkspaceEntry[]> | null = null;
let inFlightKey: string = '';
let lastFetchedAt: number = 0;
let workspaceSelectionSequence = 0;

const initialStoredWs = getStoredActiveWorkspace();
const initialStoredRole = typeof window !== 'undefined' ? (getCrossSubdomainItem(ACTIVE_ROLE_KEY) || 'owner') : null;

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  currentWorkspace: initialStoredWs,
  currentOrganization: initialStoredWs,
  currentRole: initialStoredRole,
  permissions: [],
  products: [],
  workspaces: [],
  isLoading: false,
  isSwitching: false,
  hasFetchedWorkspaces: false,
  error: null,

  invalidateCache: () => {
    lastFetchedAt = 0;
    inFlightFetch = null;
    inFlightKey = '';
  },

  fetchWorkspaces: async (productKey?: string, search?: string, forceRefresh?: boolean) => {
    const key = `${productKey || ''}::${search || ''}`;
    const wasInitialFetch = !get().hasFetchedWorkspaces;
    if (!forceRefresh && inFlightFetch && inFlightKey === key) {
      return inFlightFetch;
    }

    // Cache-first: if workspaces exist and were fetched in last 30s without search filter (and not forced), return cached list
    const existing = get().workspaces;
    if (!forceRefresh && existing.length > 0 && !search && Date.now() - lastFetchedAt < 30000) {
      return existing;
    }

    // A persisted active workspace does not mean the organization list has been
    // fetched. Keep the initial page in a loading state until that request settles.
    if (forceRefresh || !get().hasFetchedWorkspaces) {
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
        set({ workspaces, hasFetchedWorkspaces: true, error: null });

        // Validate persisted context against the server-owned membership list on
        // cold boot. Persisted workspace/role data is only a display cache.
        if (wasInitialFetch || !get().currentWorkspace) {
          const active = get().currentWorkspace;
          const savedId = getCrossSubdomainItem(ACTIVE_WS_STORAGE_KEY) || active?.id;
          const target = workspaces.find(
            (w) =>
              w.workspace.id === savedId ||
              w.workspace.workspaceId === savedId ||
              w.workspace.organizationId === savedId
          ) || workspaces[0];

          if (target) {
            await get().selectWorkspace(target.workspace.id, productKey).catch(() => {
              // The membership list is server-validated. Use its non-expanded
              // context without retaining a stale persisted role.
              set({
                currentWorkspace: target.workspace,
                currentOrganization: target.workspace,
                currentRole: target.role || 'member',
                permissions: [],
                products: target.enabledProducts || [],
              });
            });
          } else {
            removeCrossSubdomainItem(ACTIVE_WS_STORAGE_KEY);
            removeCrossSubdomainItem(ACTIVE_WS_DATA_KEY);
            removeCrossSubdomainItem(ACTIVE_ROLE_KEY);
            useBranchStore.getState().clearBranches();
            set({
              currentWorkspace: null,
              currentOrganization: null,
              currentRole: null,
              permissions: [],
              products: [],
            });
          }
        }

        set({ isLoading: false });
        return workspaces;
      } catch (err: any) {
        set({
          isLoading: false,
          hasFetchedWorkspaces: true,
          error: getErrorMessage(err, 'Failed to fetch workspaces'),
        });
        return [];
      } finally {
        inFlightFetch = null;
        inFlightKey = '';
      }
    })();

    return inFlightFetch;
  },

  selectWorkspace: async (workspaceId: string, productKey?: string) => {
    const selectionSequence = ++workspaceSelectionSequence;
    const isAlreadyActive = get().currentWorkspace?.id === workspaceId || get().currentWorkspace?.workspaceId === workspaceId;
    if (!isAlreadyActive) {
      set({ isSwitching: true, error: null });
    }
    try {
      const response = await api.post<WorkspaceContextResponse>(
        `/workspaces/${workspaceId}/select`,
        { productKey }
      );

      // A later selection won the race. Do not let this older response replace it.
      if (selectionSequence !== workspaceSelectionSequence) {
        return response;
      }

      const context = response;
      setCrossSubdomainItem(ACTIVE_WS_STORAGE_KEY, workspaceId);

      const ws = context.workspace
        ? {
            ...context.workspace,
            workspaceId: context.workspace.workspaceId || context.workspace.id,
          }
        : null;

      saveStoredActiveWorkspace(ws);
      if (context.membership?.role) {
        setCrossSubdomainItem(ACTIVE_ROLE_KEY, context.membership.role);
      }

      if (!isAlreadyActive) {
        useBranchStore.getState().clearBranches();
      }

      set({
        currentWorkspace: ws,
        currentOrganization: ws,
        currentRole: context.membership?.role || 'member',
        permissions: context.permissions || [],
        products: context.products || [],
        isSwitching: false,
      });

      crossTabSync.broadcastWorkspaceChange(workspaceId, ws?.name);

      return context;
    } catch (err: any) {
      if (selectionSequence === workspaceSelectionSequence) {
        set({ isSwitching: false, error: getErrorMessage(err, 'Failed to switch workspace') });
      }
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
      saveStoredActiveWorkspace(ws);
      if (context.membership?.role) {
        setCrossSubdomainItem(ACTIVE_ROLE_KEY, context.membership.role);
      }
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
    workspaceSelectionSequence++;
    removeCrossSubdomainItem(ACTIVE_WS_STORAGE_KEY);
    removeCrossSubdomainItem(ACTIVE_WS_DATA_KEY);
    removeCrossSubdomainItem(ACTIVE_ROLE_KEY);
    useBranchStore.getState().clearBranches();
    set({
      currentWorkspace: null,
      currentOrganization: null,
      currentRole: null,
      permissions: [],
      products: [],
      workspaces: [],
      hasFetchedWorkspaces: false,
    });
  },
}));
