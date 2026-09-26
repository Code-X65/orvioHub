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
import {
  authManager,
  saveStoredUser,
} from '../lib/auth-manager';

const REMEMBERED_ACCOUNTS_KEY = 'orvio_remembered_accounts';



function getStoredRememberedAccounts(): RememberedAccount[] {
  try {
    const raw = localStorage.getItem(REMEMBERED_ACCOUNTS_KEY);
    const accounts = raw ? JSON.parse(raw) : [];
    return Array.isArray(accounts)
      ? accounts.map(({ token: _token, refreshToken: _refreshToken, ...account }) => account)
      : [];
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
  logout: (redirectToLogin?: boolean) => Promise<void>;
  logoutAllAccounts: () => Promise<void>;
  initializeAuth: () => Promise<void>;
  refreshSession: () => Promise<void>;
  setOnboardingStatus: (status: OnboardingState) => void;
}

let inFlightRefreshPromise: Promise<void> | null = null;
// Every login or logout advances this value. A session check captures it before
// awaiting I/O so an older result cannot overwrite newer authentication state.
let authSessionGeneration = 0;

function invalidateInFlightAuthOperations() {
  authSessionGeneration += 1;
  return authSessionGeneration;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  // Stored identity is presentation-only.  Authentication is established by
  // the startup /auth/me request, never by localStorage.
  isInitialized: false,
  isAuthenticated: false,
  user: null,
  token: null,
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
    // A newly established session is newer than every pending startup/focus
    // validation. Make those results no-ops when they complete.
    invalidateInFlightAuthOperations();
    authManager.setTokens();

    const memberships = data.memberships || [];
    const storedActiveOrgId = typeof window !== 'undefined' ? localStorage.getItem('orvio_active_org_id') : null;
    const validActiveOrgId = memberships.some((m) => m.organization.id === storedActiveOrgId)
      ? storedActiveOrgId
      : memberships[0]?.organization.id || data.onboarding?.organization?.id || null;

    if (validActiveOrgId && typeof window !== 'undefined') {
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
          lastLoginAt: Date.now(),
        },
        ...currentList,
      ].slice(0, 5); // Keep up to 5 remembered profiles

      saveRememberedAccounts(updatedList);
      set({ rememberedAccounts: updatedList });
    }

    set({
      user: data.user,
      onboardingStatus: data.onboarding,
      memberships,
      activeOrganizationId: validActiveOrgId,
      isAuthenticated: true,
      isInitialized: true,
    });
  },

  updateUser: (updates) => {
    const currentUser = get().user;
    if (!currentUser) return;
    const updatedUser = { ...currentUser, ...updates };
    saveStoredUser(updatedUser);
    set({ user: updatedUser });
  },

  setMemberships: (memberships) => {
    set({ memberships });
  },

  setActiveOrganizationId: (orgId) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('orvio_active_org_id', orgId);
    }
    set({ activeOrganizationId: orgId });
  },

  addRememberedAccount: (account) => {
    const list = get().rememberedAccounts.filter(
      (a) => a.email.toLowerCase() !== account.email.toLowerCase()
    );
    const { token: _token, refreshToken: _refreshToken, ...safeAccount } = account;
    const updated = [safeAccount, ...list].slice(0, 5);
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

  switchAccount: (_email) => {
    // Credentials are never persisted for remembered profiles. Selecting one
    // must go through the normal login flow rather than restoring a token.
    return false;
  },

  logout: async (redirectToLogin: boolean = false) => {
    // Invalidate before awaiting the backend so an older refresh cannot restore
    // auth state while logout is in progress.
    invalidateInFlightAuthOperations();
    const currentUser = get().user;
    try {
      // Always invoke /auth/logout so the backend invalidates Convex session and sends Set-Cookie clearing headers
      await api.post('/auth/logout', {});
    } catch {
      // Ignore network / token expiration errors during logout
    } finally {
      authManager.clearTokens();
      api.invalidateCache();
      if (typeof window !== 'undefined') {
        localStorage.removeItem('orvio_active_org_id');
        localStorage.removeItem('orvio_active_workspace_id');
      }
      saveStoredUser(null);

      // Trigger cross-tab logout synchronization via localStorage event
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('orvio_logout_sync', String(Date.now()));
          new BroadcastChannel('orvio-auth').postMessage({ type: 'logout' });
        }
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
    invalidateInFlightAuthOperations();
    try {
      await api.post('/auth/logout-all');
    } catch {
      // Ignore errors
    } finally {
      authManager.clearTokens();
      api.invalidateCache();
      if (typeof window !== 'undefined') {
        localStorage.removeItem('orvio_active_org_id');
        localStorage.removeItem('orvio_active_workspace_id');
        localStorage.removeItem(REMEMBERED_ACCOUNTS_KEY);
        localStorage.setItem('orvio_logout_sync', String(Date.now()));
        new BroadcastChannel('orvio-auth').postMessage({ type: 'logout' });
      }
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

  initializeAuth: async () => {
    return get().refreshSession();
  },

  refreshSession: async () => {
    if (inFlightRefreshPromise) {
      return inFlightRefreshPromise;
    }

    const requestGeneration = authSessionGeneration;
    const isCurrentRequest = () => requestGeneration === authSessionGeneration;

    inFlightRefreshPromise = (async () => {
      try {
        const meData = await authManager.validateSession(isCurrentRequest);
        if (!isCurrentRequest()) return;
        if (meData && meData.user) {
          get().setAuthData(meData, true);
          return;
        }

        // Silent refresh and /auth/me both failed — session is invalidated/logged out.
        // Purge all stale local tokens on this subdomain
        authManager.clearTokens();
        if (typeof window !== 'undefined') {
          localStorage.removeItem('orvio_active_org_id');
          localStorage.removeItem('orvio_active_workspace_id');
        }
        saveStoredUser(null);
        try {
          useWorkspaceStore.getState().clearWorkspace();
        } catch {
          // Safe fallback
        }
        set({
          isInitialized: true,
          isAuthenticated: false,
          user: null,
          token: null,
          memberships: [],
          activeOrganizationId: null,
          onboardingStatus: null,
        });
      } catch {
        if (!isCurrentRequest()) return;
        // A failed /auth/me or refresh request can be a temporary network,
        // deployment, or gateway failure. Keep an already authenticated local
        // session intact; only the explicit null path above represents a
        // confirmed invalid session.
        if (get().isAuthenticated && get().user) {
          set({ isInitialized: true });
          return;
        }
        authManager.clearTokens();
        if (typeof window !== 'undefined') {
          localStorage.removeItem('orvio_active_org_id');
          localStorage.removeItem('orvio_active_workspace_id');
        }
        saveStoredUser(null);
        try {
          useWorkspaceStore.getState().clearWorkspace();
        } catch {
          // Safe fallback
        }
        set({
          isInitialized: true,
          isAuthenticated: false,
          user: null,
          token: null,
          memberships: [],
          activeOrganizationId: null,
          onboardingStatus: null,
        });
      } finally {
        inFlightRefreshPromise = null;
      }
    })();

    return inFlightRefreshPromise;
  },

  setOnboardingStatus: (status) => {
    set({ onboardingStatus: status });
  },
}));

// Synchronize token changes from AuthTokenManager with useAuthStore
authManager.subscribeToTokenUpdates((token) => {
  if (token) {
    useAuthStore.setState({ token, isAuthenticated: true });
  } else {
    useAuthStore.setState({ token: null, isAuthenticated: false });
  }
});

// Listen for global unauthorized events and cross-tab logout synchronization
if (typeof window !== 'undefined') {
  window.addEventListener('auth:unauthorized', () => {
    useAuthStore.getState().logout(true);
  });

  window.addEventListener('storage', (event) => {
    if (event.key === 'orvio_logout_sync') {
      invalidateInFlightAuthOperations();
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

  try {
    const authChannel = new BroadcastChannel('orvio-auth');
    authChannel.addEventListener('message', (event) => {
      if (event.data?.type !== 'logout') return;
      invalidateInFlightAuthOperations();
      authManager.clearTokens();
      api.invalidateCache();
      useAuthStore.setState({
        isAuthenticated: false,
        user: null,
        token: null,
        onboardingStatus: null,
        memberships: [],
        activeOrganizationId: null,
        isInitialized: true,
      });
    });
  } catch {
    // BroadcastChannel is optional; server revocation and focus validation remain authoritative.
  }
}
