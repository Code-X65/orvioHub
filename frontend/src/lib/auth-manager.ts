import { API_ORIGIN } from './config';
import type { MeResponse, User } from './types';

export const AUTH_TOKEN_KEY = 'orvio_auth_token';
export const REFRESH_TOKEN_KEY = 'orvio_refresh_token';
export const ACTIVE_ORG_KEY = 'orvio_active_org_id';
export const ACTIVE_WORKSPACE_KEY = 'orvio_active_workspace_id';
export const STORED_USER_KEY = 'orvio_user';

export function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null;
  try { const raw = localStorage.getItem(STORED_USER_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

export function saveStoredUser(user: User | null) {
  if (typeof window === 'undefined') return;
  try { if (user) localStorage.setItem(STORED_USER_KEY, JSON.stringify(user)); else localStorage.removeItem(STORED_USER_KEY); } catch {}
}

/**
 * Browser identity bootstrap.  The authentication credential is deliberately
 * inaccessible to JavaScript; this class only fetches identity and a CSRF
 * header token bound to that HttpOnly credential.
 */
export class AuthTokenManager {
  private csrfToken: string | null = null;

  getAccessToken(): string | null { return null; }
  getRefreshToken(): string | null { return null; }
  setTokens(_token?: string, _refreshToken?: string | null) { this.removeLegacyTokens(); }
  subscribeToTokenUpdates(_cb: (token: string | null) => void): () => void { return () => {}; }

  private removeLegacyTokens() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  }

  clearTokens() { this.csrfToken = null; this.removeLegacyTokens(); }

  async getCsrfToken(force = false): Promise<string | null> {
    if (!force && this.csrfToken) return this.csrfToken;
    const response = await fetch(`${API_ORIGIN}/api/v1/auth/csrf`, {
      method: 'GET', credentials: 'include', headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      if (response.status === 401) this.clearTokens();
      return null;
    }
    const payload = await response.json();
    this.csrfToken = payload?.data?.csrfToken || null;
    return this.csrfToken;
  }

  async validateSession(isCurrent: () => boolean = () => true): Promise<MeResponse | null> {
    const response = await fetch(`${API_ORIGIN}/api/v1/auth/me`, {
      credentials: 'include', headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10_000),
    });
    if (!isCurrent()) return null;
    if (response.status === 401) return null;
    if (!response.ok) throw new Error(`Failed to validate session: ${response.status}`);
    const payload = await response.json();
    const data = payload?.data || payload;
    if (data?.user) saveStoredUser(data.user);
    return data?.user ? data as MeResponse : null;
  }

  // Compatibility no-ops prevent stale consumers from reviving JWT refresh.
  async refreshToken(): Promise<string | null> { return null; }
  async recoverReplacedSession(_ticket: string): Promise<string | null> { return null; }

  logoutAndRedirect() {
    this.clearTokens();
    if (typeof window === 'undefined') return;
    localStorage.removeItem(ACTIVE_ORG_KEY);
    localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
    saveStoredUser(null);
    window.dispatchEvent(new Event('auth:unauthorized'));
  }
}

export const authManager = new AuthTokenManager();
