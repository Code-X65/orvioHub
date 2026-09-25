import { create } from 'zustand';
import { api, setMemoryAuthToken, refreshAccessToken, API_ORIGIN } from '../lib/api';
import {
  User,
  OnboardingState,
  AuthResponse,
  MeResponse,
  Membership,
  RememberedAccount,
  ProductKey,
} from '../lib/types';
import { getOrCreateDeviceId, rotateDeviceId } from '../lib/device';
import { useWorkspaceStore } from './useWorkspaceStore';
import { getLoginUrl } from '@orviohub/shared';
import {
  getCrossSubdomainItem,
  setCrossSubdomainItem,
  removeCrossSubdomainItem,
} from '../lib/cookieStorage';

const REMEMBERED_ACCOUNTS_KEY = 'orvio_remembered_accounts';

// Safe Cross-Subdomain Single-Use Handoff Handler
async function handleHandoffCodeFromUrl() {
  if (typeof window === 'undefined') return;
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const handoffCode = urlParams.get('handoff_code');
    if (handoffCode) {
      urlParams.delete('handoff_code');
      const cleanSearch = urlParams.toString() ? `?${urlParams.toString()}` : '';
      const cleanUrl = `${window.location.pathname}${cleanSearch}${window.location.hash}`;
      window.history.replaceState({}, document.title, cleanUrl);

      const res = await fetch(`/api/v1/auth/handoff/exchange`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: handoffCode }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.data) {
          useAuthStore.getState().setAuthData(data.data, true);
        }
      }
    }
  } catch {
    // Ignore handoff exchange errors
  }
}

// Run immediately upon script execution
handleHandoffCodeFromUrl();

function getStoredRememberedAccounts(): RememberedAccount[] {
  try {
    const raw = localStorage.getItem(REMEMBERED_ACCOUNTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRememberedAccounts(accounts: RememberedAccount[]) {
  try {
    localStorage.setItem(REMEMBERED_ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch {
    // Ignore quota errors
  }
}

interface AuthState {
  isInitialized: boolean;
  isAuthenticated: boolean;
  user: User | null;
  session: { id?: string; expiresAt?: number } | null;
  isLoading: boolean;
  isRefreshingToken: boolean;
  isEmailVerified: boolean;
  accountStatus: string;
  accessLevel: string;
  token: string | null;
  onboardingStatus: OnboardingState | null;
  memberships: Membership[];
  activeOrganizationId: string | null;
  rememberedAccounts: RememberedAccount[];
  activeProduct: ProductKey;
  deviceId: string;
  
  // Actions
  setAuthData: (data: AuthResponse | MeResponse, rememberAccount?: boolean) => void;
  updateUser: (updates: Partial<User>) => void;
  setMemberships: (memberships: Membership[]) => void;
  setActiveOrganizationId: (orgId: string) => void;
  setActiveProduct: (product: ProductKey) => void;
  addRememberedAccount: (account: RememberedAccount) => void;
  removeRememberedAccount: (email: string) => void;
  switchAccount: (email: string) => boolean;
  login: (credentials: { email: string; password: string }) => Promise<any>;
  logout: (redirectToLogin?: boolean) => Promise<void>;
  logoutAllAccounts: () => Promise<void>;
  refreshSession: () => Promise<void>;
  extendSession: () => Promise<{ id?: string; expiresAt?: number }>;
  rotateDevice: () => string;
  clearAuthState: () => void;
  setOnboardingStatus: (status: OnboardingState) => void;
}

let inFlightRefreshPromise: Promise<void> | null = null;
let authBootstrapping = false;
let authBootstrapPromise: Promise<void> | null = null;
let sessionCache: { data: any; fetchedAt: number } | null = null;
const SESSION_CACHE_TTL = 30_000; // 30 seconds

export function bootstrapAuth(): Promise<void> {
  if (authBootstrapping && authBootstrapPromise) {
    return authBootstrapPromise;
  }
  authBootstrapping = true;
  authBootstrapPromise = useAuthStore.getState().refreshSession().finally(() => {
    authBootstrapping = false;
    authBootstrapPromise = null;
  });
  return authBootstrapPromise;
}

export function isAuthBootstrapping(): boolean {
  return authBootstrapping;
}

export function invalidateSessionCache(): void {
  sessionCache = null;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isInitialized: false,
  isAuthenticated: false,
  user: null,
  session: null,
  isLoading: true,
  isRefreshingToken: false,
  isEmailVerified: false,
  accountStatus: 'unauthenticated',
  accessLevel: 'none',
  token: null,
  onboardingStatus: null,
  memberships: [],
  activeOrganizationId: typeof window !== 'undefined' ? (getCrossSubdomainItem('orvio_active_org_id') || getCrossSubdomainItem('orvio_active_workspace_id')) : null,
  rememberedAccounts: getStoredRememberedAccounts(),
  activeProduct: 'hub',
  deviceId: getOrCreateDeviceId(),

  setActiveProduct: (product) => {
    set({ activeProduct: product });
  },

  setAuthData: (data, rememberAccount = true) => {
    if ('token' in data && data.token) {
      setMemoryAuthToken(data.token);
      set({ token: data.token });
    }

    const memberships = data.memberships || [];
    const storedActiveOrgId = getCrossSubdomainItem('orvio_active_org_id') || getCrossSubdomainItem('orvio_active_workspace_id');
    const validActiveOrgId = memberships.some((m) => m.organization.id === storedActiveOrgId)
      ? storedActiveOrgId
      : memberships[0]?.organization.id || data.onboarding?.organization?.id || null;

    if (validActiveOrgId) {
      setCrossSubdomainItem('orvio_active_org_id', validActiveOrgId);
      setCrossSubdomainItem('orvio_active_workspace_id', validActiveOrgId);
    }

    // Update remembered accounts list (storing identity metadata only)
    if (rememberAccount && data.user) {
      const currentList = get().rememberedAccounts.filter(
        (acc) => acc.email.toLowerCase() !== data.user.email.toLowerCase()
      );
      const updatedList: RememberedAccount[] = [
        {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          displayName: data.user.displayName || data.user.name,
          avatarUrl: data.user.avatarUrl || data.user.avatar,
          lastLoginAt: Date.now(),
        },
        ...currentList,
      ].slice(0, 5); // Keep up to 5 remembered profiles

      saveRememberedAccounts(updatedList);
      set({ rememberedAccounts: updatedList });
    }

    const isEmailVerified = Boolean(data.user?.emailVerified);
    set({
      isAuthenticated: true,
      user: data.user,
      session: (data as any).session || get().session,
      isEmailVerified,
      accountStatus: data.user?.status || 'active',
      accessLevel: (data as any).accessLevel || (isEmailVerified ? 'full' : 'verification_required'),
      onboardingStatus: data.onboarding,
      memberships,
      activeOrganizationId: validActiveOrgId,
      isInitialized: true,
      isLoading: false,
    });

    // Multi-tab login broadcast: notify other tabs to synchronize session
    try {
      localStorage.setItem('orvio_login_sync', String(Date.now()));
    } catch {}
  },

  addRememberedAccount: (account) => {
    const list = get().rememberedAccounts.filter(
      (a) => a.email.toLowerCase() !== account.email.toLowerCase()
    );
    const updated = [account, ...list].slice(0, 5);
    saveRememberedAccounts(updated);
    set({ rememberedAccounts: updated });
  },

  removeRememberedAccount: (email) => {
    const updated = get().rememberedAccounts.filter(
      (a) => a.email.toLowerCase() !== email.toLowerCase()
    );
    saveRememberedAccounts(updated);
    set({ rememberedAccounts: updated });
  },

  switchAccount: (email) => {
    const target = get().rememberedAccounts.find(
      (a) => a.email.toLowerCase() === email.toLowerCase()
    );
    if (!target) return false;

    const targetUser: User = {
      id: target.id,
      email: target.email,
      name: target.name,
      displayName: target.displayName,
      avatarUrl: target.avatarUrl,
      emailVerified: true,
    };

    set({
      isAuthenticated: true,
      user: targetUser,
    });

    // Refresh session for full verified server data
    get().refreshSession();
    return true;
  },

  setMemberships: (memberships) => {
    const currentActiveId = get().activeOrganizationId;
    const nextActiveId = memberships.some((m) => m.organization.id === currentActiveId)
      ? currentActiveId
      : memberships[0]?.organization.id || null;

    if (nextActiveId) {
      setCrossSubdomainItem('orvio_active_org_id', nextActiveId);
      setCrossSubdomainItem('orvio_active_workspace_id', nextActiveId);
    }
    set({ memberships, activeOrganizationId: nextActiveId });
  },

  setActiveOrganizationId: (orgId) => {
    setCrossSubdomainItem('orvio_active_org_id', orgId);
    setCrossSubdomainItem('orvio_active_workspace_id', orgId);
    set({ activeOrganizationId: orgId });
  },

  updateUser: (updates) => {
    const { user } = get();
    if (user) {
      const updatedUser = { ...user, ...updates };
      set({ user: updatedUser });

      // Update remembered account info as well
      const updatedAccounts = get().rememberedAccounts.map((acc) =>
        acc.email.toLowerCase() === user.email.toLowerCase()
          ? {
              ...acc,
              name: updatedUser.name || acc.name,
              displayName: updatedUser.displayName || acc.displayName,
              avatarUrl: updatedUser.avatarUrl || acc.avatarUrl,
            }
          : acc
      );
      saveRememberedAccounts(updatedAccounts);
      set({ rememberedAccounts: updatedAccounts });
    }
  },

  logout: async (redirectToLogin: boolean = false) => {
    try {
      // Always invoke /auth/logout so the backend invalidates session and sends Set-Cookie clearing headers
      await api.post('/auth/logout');
    } catch {
      // Ignore network / token expiration errors during logout
    } finally {
      sessionCache = null;
      setMemoryAuthToken(null);
      removeCrossSubdomainItem('orvio_active_org_id');
      removeCrossSubdomainItem('orvio_active_workspace_id');
      removeCrossSubdomainItem('orvio_active_workspace_data');
      removeCrossSubdomainItem('orvio_active_branch_id');
      removeCrossSubdomainItem('orvio_active_branch_data');

      // Trigger cross-tab logout synchronization via localStorage event
      try {
        localStorage.setItem('orvio_logout_sync', String(Date.now()));
      } catch {
        // Safe fallback
      }

      // Fully purge active workspace store
      try {
        useWorkspaceStore.getState().clearWorkspace();
      } catch {
        // Safe fallback
      }

      set({
        isAuthenticated: false,
        user: null,
        token: null,
        session: null,
        onboardingStatus: null,
        memberships: [],
        activeOrganizationId: null,
        isInitialized: true,
      });

      if (redirectToLogin && typeof window !== 'undefined') {
        const loginUrl = `${getLoginUrl()}?logged_out=true`;
        window.location.href = loginUrl;
      }
    }
  },

  logoutAllAccounts: async () => {
    try {
      await api.post('/auth/logout-all');
    } catch {
      // Ignore errors
    } finally {
      sessionCache = null;
      setMemoryAuthToken(null);
      removeCrossSubdomainItem('orvio_active_org_id');
      removeCrossSubdomainItem('orvio_active_workspace_id');
      removeCrossSubdomainItem('orvio_active_workspace_data');
      removeCrossSubdomainItem('orvio_active_branch_id');
      removeCrossSubdomainItem('orvio_active_branch_data');
      localStorage.removeItem(REMEMBERED_ACCOUNTS_KEY);

      try {
        useWorkspaceStore.getState().clearWorkspace();
      } catch {
        // Safe fallback
      }

      set({
        isAuthenticated: false,
        user: null,
        token: null,
        session: null,
        onboardingStatus: null,
        memberships: [],
        activeOrganizationId: null,
        rememberedAccounts: [],
        isInitialized: true,
      });
    }
  },

  clearAuthState: () => {
    sessionCache = null;
    setMemoryAuthToken(null);
    removeCrossSubdomainItem('orvio_active_org_id');
    removeCrossSubdomainItem('orvio_active_workspace_id');
    removeCrossSubdomainItem('orvio_active_workspace_data');
    removeCrossSubdomainItem('orvio_active_branch_id');
    removeCrossSubdomainItem('orvio_active_branch_data');
    try {
      useWorkspaceStore.getState().clearWorkspace();
    } catch {
      // Safe fallback
    }
    set({
      isAuthenticated: false,
      user: null,
      session: null,
      isLoading: false,
      isEmailVerified: false,
      accountStatus: 'unauthenticated',
      accessLevel: 'none',
      token: null,
      onboardingStatus: null,
      memberships: [],
      activeOrganizationId: null,
      isInitialized: true,
    });
  },

  login: async (payload: { email: string; password: string }) => {
    set({ isLoading: true });
    try {
      const { API_ORIGIN } = await import('../lib/api');
      const res = await fetch(`${API_ORIGIN}/v1/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Login failed');
      }

      if (json.data?.status === 'already_authenticated') {
        const user = json.data.user;
        const session = json.data.session;
        set({
          isAuthenticated: true,
          user,
          session,
          isEmailVerified: Boolean(user?.emailVerified),
          accountStatus: user?.status || 'active',
          accessLevel: user?.emailVerified ? 'full' : 'verification_required',
          isLoading: false,
          isInitialized: true,
        });
        return json.data;
      }

      if (json.data) {
        get().setAuthData(json.data, true);
        set({
          session: json.data.session || null,
          isEmailVerified: Boolean(json.data.user?.emailVerified),
          accountStatus: json.data.user?.status || 'active',
          accessLevel: json.data.accessLevel || (json.data.user?.emailVerified ? 'full' : 'verification_required'),
          isLoading: false,
        });
      }
      return json.data;
    } finally {
      set({ isLoading: false });
    }
  },

  rotateDevice: () => {
    const newId = rotateDeviceId();
    set({ deviceId: newId });
    return newId;
  },

  refreshSession: async () => {
    if (inFlightRefreshPromise) {
      return inFlightRefreshPromise;
    }

    // Serve from cache if fresh enough
    if (sessionCache && Date.now() - sessionCache.fetchedAt < SESSION_CACHE_TTL) {
      // Still update store with cached data to avoid loading state
      const wasInitialized = get().isInitialized;
      if (wasInitialized) {
        set({ isRefreshingToken: false });
      }
      return;
    }

    inFlightRefreshPromise = (async () => {
      // Non-blocking refresh if already initialized; only block on cold boot
      const wasInitialized = get().isInitialized;
      if (!wasInitialized) {
        set({ isLoading: true });
      }
      set({ isRefreshingToken: true });

      try {
        const { API_ORIGIN } = await import('../lib/api');
        const res = await fetch(`${API_ORIGIN}/api/v1/auth/session`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            const data = json.data;
            const user = data.user;
            const session = data.session;
            const access = data.access;
            const isEmailVerified = Boolean(user?.emailVerified);

            // After successful fetch, cache the result:
            sessionCache = { data: json.data, fetchedAt: Date.now() };

            set({
              isInitialized: true,
              isAuthenticated: Boolean(data.authenticated),
              user: user || null,
              session: session || null,
              isEmailVerified,
              accountStatus: user?.status || 'active',
              accessLevel: access?.level || (isEmailVerified ? 'full' : 'verification_required'),
              isLoading: false,
              isRefreshingToken: false,
            });
            return;
          }
        }

        sessionCache = null;
        get().clearAuthState();
      } catch {
        // Network error
      } finally {
        set({ isLoading: false, isRefreshingToken: false });
        inFlightRefreshPromise = null;
      }
    })();

    return inFlightRefreshPromise;
  },

  extendSession: async () => {
    const token = await refreshAccessToken();
    if (!token) {
      throw new Error('Your refresh session is no longer valid. Please sign in again.');
    }

    const res = await fetch(`${API_ORIGIN}/api/v1/auth/session`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error('The renewed session could not be verified. Please sign in again.');
    }

    const json = await res.json();
    const data = json?.data;
    if (!json?.success || !data?.authenticated || !data?.user) {
      throw new Error('The renewed session is not authenticated. Please sign in again.');
    }

    const isEmailVerified = Boolean(data.user.emailVerified);
    const resolvedSession = data.session || {
      id: data.user.id,
      expiresAt: Date.now() + 7 * 86_400_000,
    };
    if (!resolvedSession.expiresAt) {
      resolvedSession.expiresAt = Date.now() + 7 * 86_400_000;
    }

    sessionCache = { data, fetchedAt: Date.now() };

    set({
      isInitialized: true,
      isAuthenticated: true,
      user: data.user,
      session: resolvedSession,
      token,
      isEmailVerified,
      accountStatus: data.user.status || 'active',
      accessLevel: data.access?.level || (isEmailVerified ? 'full' : 'verification_required'),
      isLoading: false,
      isRefreshingToken: false,
    });

    try {
      localStorage.setItem('orvio_login_sync', String(Date.now()));
    } catch {}

    return resolvedSession;
  },

  setOnboardingStatus: (status) => {
    set({ onboardingStatus: status });
  },
}));

// Listen for global unauthorized events and cross-tab logout synchronization
if (typeof window !== 'undefined') {
  window.addEventListener('auth:unauthorized', () => {
    const isAuth = useAuthStore.getState().isAuthenticated;
    if (isAuth) {
      window.dispatchEvent(
        new CustomEvent('auth:session-expiring', {
          detail: { secondsRemaining: 120, canExtend: true },
        })
      );
    } else {
      useAuthStore.getState().logout(false);
    }
  });

  window.addEventListener('auth:token-refreshing', (event: any) => {
    useAuthStore.setState({ isRefreshingToken: Boolean(event.detail?.refreshing) });
  });

  window.addEventListener('storage', (event) => {
    if (event.key === 'orvio_logout_sync') {
      useAuthStore.setState({
        isAuthenticated: false,
        user: null,
        token: null,
        onboardingStatus: null,
        memberships: [],
        activeOrganizationId: null,
        isInitialized: true,
      });
      // Immediately redirect to login
      const loginUrl = `${getLoginUrl(window.location.href)}?logged_out=true`;
      window.location.href = loginUrl;
    } else if (event.key === 'orvio_login_sync') {
      // Another tab successfully logged in — refresh session to pick up the active auth state
      useAuthStore.getState().refreshSession();
    }
  });
}
