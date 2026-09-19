import { create } from 'zustand';
import { api } from '../lib/api';
import {
  User,
  OnboardingState,
  AuthResponse,
  MeResponse,
  Membership,
  RememberedAccount,
  ProductKey,
} from '../lib/types';
import { getOrCreateDeviceId } from '../lib/device';
import { useWorkspaceStore } from './useWorkspaceStore';
import { getLoginUrl } from '@orviohub/shared';

const REMEMBERED_ACCOUNTS_KEY = 'orvio_remembered_accounts';
const STORED_USER_KEY = 'orvio_user';

function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORED_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveStoredUser(user: User | null) {
  if (typeof window === 'undefined') return;
  try {
    if (user) {
      localStorage.setItem(STORED_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORED_USER_KEY);
    }
  } catch {
    // Ignore quota errors
  }
}

// Extract cross-subdomain handoff token from URL if present (e.g. from localhost:5173 to inventory.localhost:5173)
function extractHandoffTokensFromUrl(): { token: string | null; refreshToken: string | null; user: User | null } {
  if (typeof window === 'undefined') return { token: null, refreshToken: null, user: null };
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const authToken = urlParams.get('auth_token') || urlParams.get('token');
    const refreshToken = urlParams.get('refresh_token') || urlParams.get('refreshToken');
    const authUserRaw = urlParams.get('auth_user');

    let parsedUser: User | null = null;
    if (authUserRaw) {
      try {
        let userJson = authUserRaw;
        try {
          userJson = decodeURIComponent(authUserRaw);
        } catch {}
        parsedUser = JSON.parse(userJson);
        if (parsedUser) {
          saveStoredUser(parsedUser);
        }
      } catch {
        // Ignore parse error
      }
      urlParams.delete('auth_user');
    }

    if (authToken) {
      localStorage.setItem('orvio_auth_token', authToken);
      if (refreshToken) {
        localStorage.setItem('orvio_refresh_token', refreshToken);
      }
      urlParams.delete('auth_token');
      urlParams.delete('token');
      urlParams.delete('refresh_token');
      urlParams.delete('refreshToken');
      const cleanSearch = urlParams.toString() ? `?${urlParams.toString()}` : '';
      const cleanUrl = `${window.location.pathname}${cleanSearch}${window.location.hash}`;
      window.history.replaceState({}, document.title, cleanUrl);
      return { token: authToken, refreshToken: refreshToken || null, user: parsedUser };
    }
  } catch {
    // Ignore URL parse errors
  }
  return { token: null, refreshToken: null, user: null };
}

// Run immediately upon script execution
extractHandoffTokensFromUrl();

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
  clearAuthState: () => void;
  setOnboardingStatus: (status: OnboardingState) => void;
}

let inFlightRefreshPromise: Promise<void> | null = null;

const initialToken = typeof window !== 'undefined' ? localStorage.getItem('orvio_auth_token') : null;
const initialUser = getStoredUser();

export const useAuthStore = create<AuthState>((set, get) => ({
  isInitialized: !!initialUser,
  isAuthenticated: !!(initialToken && initialUser),
  user: initialUser,
  session: null,
  isLoading: false,
  isEmailVerified: Boolean(initialUser?.emailVerified),
  accountStatus: initialUser?.status || (initialUser ? 'active' : 'unauthenticated'),
  accessLevel: initialUser?.emailVerified ? 'full' : (initialUser ? 'verification_required' : 'none'),
  token: initialToken,
  onboardingStatus: null,
  memberships: [],
  activeOrganizationId: typeof window !== 'undefined' ? localStorage.getItem('orvio_active_org_id') : null,
  rememberedAccounts: getStoredRememberedAccounts(),
  activeProduct: 'hub',
  deviceId: getOrCreateDeviceId(),

  setActiveProduct: (product) => {
    set({ activeProduct: product });
  },

  setAuthData: (data, rememberAccount = true) => {
    let token = get().token;
    let refreshToken: string | undefined;

    if ('token' in data && data.token) {
      localStorage.setItem('orvio_auth_token', data.token);
      token = data.token;
      set({ token: data.token });
    }

    if ('refreshToken' in data && data.refreshToken) {
      localStorage.setItem('orvio_refresh_token', data.refreshToken);
      refreshToken = data.refreshToken;
    }

    const memberships = data.memberships || [];
    const storedActiveOrgId = localStorage.getItem('orvio_active_org_id');
    const validActiveOrgId = memberships.some((m) => m.organization.id === storedActiveOrgId)
      ? storedActiveOrgId
      : memberships[0]?.organization.id || data.onboarding?.organization?.id || null;

    if (validActiveOrgId) {
      localStorage.setItem('orvio_active_org_id', validActiveOrgId);
    }

    // Update remembered accounts list
    if (rememberAccount && data.user) {
      saveStoredUser(data.user);
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
          token: token || undefined,
          refreshToken,
          lastLoginAt: Date.now(),
        },
        ...currentList,
      ].slice(0, 5); // Keep up to 5 remembered profiles

      saveRememberedAccounts(updatedList);
      set({ rememberedAccounts: updatedList });
    } else if (data.user) {
      saveStoredUser(data.user);
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
    if (!target || !target.token) return false;

    localStorage.setItem('orvio_auth_token', target.token);
    if (target.refreshToken) {
      localStorage.setItem('orvio_refresh_token', target.refreshToken);
    }

    const targetUser: User = {
      id: target.id,
      email: target.email,
      name: target.name,
      displayName: target.displayName,
      avatarUrl: target.avatarUrl,
      emailVerified: true,
    };
    saveStoredUser(targetUser);

    set({
      token: target.token,
      isAuthenticated: true,
      user: targetUser,
    });

    // Refresh session for full data
    get().refreshSession();
    return true;
  },

  setMemberships: (memberships) => {
    const currentActiveId = get().activeOrganizationId;
    const nextActiveId = memberships.some((m) => m.organization.id === currentActiveId)
      ? currentActiveId
      : memberships[0]?.organization.id || null;

    if (nextActiveId) {
      localStorage.setItem('orvio_active_org_id', nextActiveId);
    }
    set({ memberships, activeOrganizationId: nextActiveId });
  },

  setActiveOrganizationId: (orgId) => {
    localStorage.setItem('orvio_active_org_id', orgId);
    set({ activeOrganizationId: orgId });
  },

  updateUser: (updates) => {
    const { user } = get();
    if (user) {
      const updatedUser = { ...user, ...updates };
      saveStoredUser(updatedUser);
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
    const currentUser = get().user;
    try {
      const refreshToken = localStorage.getItem('orvio_refresh_token');
      // Always invoke /auth/logout so the backend invalidates Convex session and sends Set-Cookie clearing headers
      await api.post('/auth/logout', { refreshToken: refreshToken || undefined });
    } catch {
      // Ignore network / token expiration errors during logout
    } finally {
      localStorage.removeItem('orvio_auth_token');
      localStorage.removeItem('orvio_refresh_token');
      localStorage.removeItem('orvio_active_org_id');
      localStorage.removeItem('orvio_active_workspace_id');
      saveStoredUser(null);

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

      // Update remembered account state to remove active token
      if (currentUser) {
        const updatedAccounts = get().rememberedAccounts.map((acc) =>
          acc.email.toLowerCase() === currentUser.email.toLowerCase()
            ? { ...acc, token: undefined, refreshToken: undefined }
            : acc
        );
        saveRememberedAccounts(updatedAccounts);
        set({ rememberedAccounts: updatedAccounts });
      }

      set({
        isAuthenticated: false,
        user: null,
        token: null,
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
      if (localStorage.getItem('orvio_auth_token')) {
        await api.post('/auth/logout-all');
      }
    } catch {
      // Ignore errors
    } finally {
      localStorage.removeItem('orvio_auth_token');
      localStorage.removeItem('orvio_refresh_token');
      localStorage.removeItem('orvio_active_org_id');
      localStorage.removeItem('orvio_active_workspace_id');
      localStorage.removeItem(REMEMBERED_ACCOUNTS_KEY);
      saveStoredUser(null);

      try {
        useWorkspaceStore.getState().clearWorkspace();
      } catch {
        // Safe fallback
      }

      set({
        isAuthenticated: false,
        user: null,
        token: null,
        onboardingStatus: null,
        memberships: [],
        activeOrganizationId: null,
        rememberedAccounts: [],
        isInitialized: true,
      });
    }
  },

  clearAuthState: () => {
    localStorage.removeItem('orvio_auth_token');
    localStorage.removeItem('orvio_refresh_token');
    localStorage.removeItem('orvio_active_org_id');
    localStorage.removeItem('orvio_active_workspace_id');
    saveStoredUser(null);
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

  refreshSession: async () => {
    if (inFlightRefreshPromise) {
      return inFlightRefreshPromise;
    }

    inFlightRefreshPromise = (async () => {
      set({ isLoading: true });
      try {
        const { API_ORIGIN } = await import('../lib/api');
        const res = await fetch(`${API_ORIGIN}/v1/auth/session`, {
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

            set({
              isInitialized: true,
              isAuthenticated: Boolean(data.authenticated),
              user: user || null,
              session: session || null,
              isEmailVerified,
              accountStatus: user?.status || 'active',
              accessLevel: access?.level || (isEmailVerified ? 'full' : 'verification_required'),
              isLoading: false,
            });

            if (user) {
              saveStoredUser(user);
            }
            return;
          }
        }

        // Secondary fallback to existing /auth/me
        try {
          const meData = await api.get<MeResponse>('/auth/me');
          get().setAuthData(meData, true);
          return;
        } catch {
          // Both failed
        }

        get().clearAuthState();
      } catch {
        // Network error
      } finally {
        set({ isLoading: false });
        inFlightRefreshPromise = null;
      }
    })();

    return inFlightRefreshPromise;
  },

  setOnboardingStatus: (status) => {
    set({ onboardingStatus: status });
  },
}));

// Listen for global unauthorized events and cross-tab logout synchronization
if (typeof window !== 'undefined') {
  window.addEventListener('auth:unauthorized', () => {
    useAuthStore.getState().logout(true);
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
    }
  });
}
