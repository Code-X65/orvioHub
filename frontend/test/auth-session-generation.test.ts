import assert from 'node:assert/strict';
import { afterEach, before, beforeEach, describe, test } from 'node:test';

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
  removeItem(key: string) { this.values.delete(key); }
  clear() { this.values.clear(); }
}

const storage = new MemoryStorage();
const testWindow = new EventTarget() as EventTarget & { location: { href: string } };
testWindow.location = { href: 'http://orviohub.localhost:3000/' };

let useAuthStore: typeof import('../src/stores/useAuthStore.ts').useAuthStore;
let authManager: typeof import('../src/lib/auth-manager.ts').authManager;
let originalValidateSession: typeof import('../src/lib/auth-manager.ts').authManager.validateSession;

const identity = {
  user: { id: 'user_123', email: 'alex@example.com', name: 'Alex', emailVerified: true },
  memberships: [], onboarding: { status: 'COMPLETED', currentStep: 'COMPLETED' },
} as any;

before(async () => {
  Object.assign(globalThis as any, { window: testWindow, localStorage: storage });
  ({ useAuthStore } = await import('../src/stores/useAuthStore.ts'));
  ({ authManager } = await import('../src/lib/auth-manager.ts'));
  originalValidateSession = authManager.validateSession;
});

beforeEach(() => {
  storage.clear(); authManager.clearTokens();
  useAuthStore.setState({ isInitialized: false, isAuthenticated: false, user: null, token: null, onboardingStatus: null, memberships: [], activeOrganizationId: null, rememberedAccounts: [] });
  authManager.validateSession = originalValidateSession;
});

afterEach(() => { authManager.validateSession = originalValidateSession; });

describe('cookie-session identity bootstrap', () => {
  test('establishes Zustand identity from /auth/me without an access token', async () => {
    authManager.validateSession = async () => identity;
    await useAuthStore.getState().refreshSession();
    const state = useAuthStore.getState();
    assert.equal(state.isAuthenticated, true);
    assert.equal(state.token, null);
    assert.equal(state.user?.id, identity.user.id);
  });

  test('does not let a stale startup failure overwrite a newly established session', async () => {
    let resolve!: (value: any) => void;
    authManager.validateSession = async () => new Promise((done) => { resolve = done; });
    const pending = useAuthStore.getState().refreshSession();
    useAuthStore.getState().setAuthData(identity, false);
    resolve(null);
    await pending;
    assert.equal(useAuthStore.getState().isAuthenticated, true);
    assert.equal(useAuthStore.getState().user?.id, identity.user.id);
  });

  test('keeps established UI identity during a temporary /auth/me failure', async () => {
    useAuthStore.getState().setAuthData(identity, false);
    authManager.validateSession = async () => { throw new Error('gateway timeout'); };
    await useAuthStore.getState().refreshSession();
    assert.equal(useAuthStore.getState().isAuthenticated, true);
    assert.equal(useAuthStore.getState().user?.id, identity.user.id);
  });
});
