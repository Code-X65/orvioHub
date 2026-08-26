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

const REMEMBERED_ACCOUNTS_KEY = 'orvio_remembered_accounts';

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
  logout: () => Promise<void>;
  logoutAllAccounts: () => Promise<void>;
  refreshSession: () => Promise<void>;
  setOnboardingStatus: (status: OnboardingState) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isInitialized: false,
  isAuthenticated: !!localStorage.getItem('orvio_auth_token'),
  user: null,
  token: localStorage.getItem('orvio_auth_token'),
  onboardingStatus: null,
  memberships: [],
  activeOrganizationId: localStorage.getItem('orvio_active_org_id'),
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

    const memberships = ('memberships' in data && data.memberships) ? data.memberships : get().memberships;
    const storedActiveOrgId = localStorage.getItem('orvio_active_org_id');
    const validActiveOrgId = memberships.some((m) => m.organization.id === storedActiveOrgId)
      ? storedActiveOrgId
      : memberships[0]?.organization.id || data.onboarding?.organization?.id || null;

    if (validActiveOrgId) {
      localStorage.setItem('orvio_active_org_id', validActiveOrgId);
    }

    // Update remembered accounts list
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
          token: token || undefined,
          refreshToken,
          lastLoginAt: Date.now(),
        },
        ...currentList,
      ].slice(0, 5); // Keep up to 5 remembered profiles

      saveRememberedAccounts(updatedList);
      set({ rememberedAccounts: updatedList });
    }

    set({
      isAuthenticated: true,
      user: data.user,
      onboardingStatus: data.onboarding,
      memberships,
      activeOrganizationId: validActiveOrgId,
      isInitialized: true,
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

    set({
      token: target.token,
      isAuthenticated: true,
      user: {
        id: target.id,
        email: target.email,
        name: target.name,
        displayName: target.displayName,
        avatarUrl: target.avatarUrl,
        emailVerified: true,
      },
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

  logout: async () => {
    const currentUser = get().user;
    try {
      const refreshToken = localStorage.getItem('orvio_refresh_token');
      if (localStorage.getItem('orvio_auth_token')) {
        await api.post('/auth/logout', { refreshToken: refreshToken || undefined });
      }
    } catch {
      // Ignore network / token expiration errors during logout
    } finally {
      localStorage.removeItem('orvio_auth_token');
      localStorage.removeItem('orvio_refresh_token');

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
        isInitialized: true,
      });
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
      localStorage.removeItem(REMEMBERED_ACCOUNTS_KEY);
      set({
        isAuthenticated: false,
        user: null,
        token: null,
        onboardingStatus: null,
        rememberedAccounts: [],
        isInitialized: true,
      });
    }
  },

  refreshSession: async () => {
    const { token } = get();
    if (!token) {
      set({ isInitialized: true, isAuthenticated: false });
      return;
    }

    try {
      const meData = await api.get<MeResponse>('/auth/me');
      get().setAuthData(meData, true);
    } catch {
      get().logout();
    }
  },

  setOnboardingStatus: (status) => {
    set({ onboardingStatus: status });
  },
}));

// Listen for global unauthorized events
if (typeof window !== 'undefined') {
  window.addEventListener('auth:unauthorized', () => {
    useAuthStore.getState().logout();
  });
}
