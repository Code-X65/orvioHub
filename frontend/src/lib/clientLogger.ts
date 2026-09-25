/**
 * Orviohub Centralized Client Error Logging Service
 * Batches and forwards frontend and API errors to the backend /api/v1/client-logs endpoint.
 */

import { getApiUrl, type Environment } from '@orviohub/shared';

const defaultEnv: Environment = import.meta.env?.PROD ? 'production' : 'development';
const rawApiUrl =
  (import.meta.env?.VITE_API_URL as string) ||
  (import.meta.env?.PROD ? getApiUrl(defaultEnv) : '');
const API_ORIGIN = rawApiUrl.replace(/\/$/, '');

export interface ClientErrorLogItem {
  message: string;
  code?: string;
  endpoint?: string;
  method?: string;
  status?: number;
  stack?: string;
  context?: {
    userId?: string | null;
    workspaceId?: string | null;
    branchId?: string | null;
    url?: string;
    userAgent?: string;
    os?: string;
    browser?: string;
    [key: string]: any;
  };
  payload?: any;
  timestamp?: string;
}

const OFFLINE_STORAGE_KEY = 'orvio_offline_client_logs';
const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'refreshtoken',
  'secret',
  'authorization',
  'cardnumber',
  'cvv',
  'cvc',
  'pin',
  'cookie',
  'cookieheader',
  'session',
]);

function sanitizeData(data: any, depth = 0): any {
  if (depth > 4 || data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeData(item, depth + 1));
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    const lower = key.toLowerCase().replace(/[-_]/g, '');
    if (SENSITIVE_KEYS.has(lower) || lower.includes('password') || lower.includes('secret')) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeData(value, depth + 1);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function detectOS(): string {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (ua.includes('Win')) return 'Windows';
  if (ua.includes('Mac')) return 'macOS';
  if (ua.includes('Linux')) return 'Linux';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
  return 'Unknown OS';
}

function detectBrowser(): string {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
  if (ua.includes('Edg')) return 'Edge';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
  if (ua.includes('Firefox')) return 'Firefox';
  return 'Unknown Browser';
}

class ClientLogger {
  private queue: ClientErrorLogItem[] = [];
  private flushTimer: any = null;
  private isFlushing = false;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.flushOfflineLogs());
      window.addEventListener('beforeunload', () => this.flushImmediate());
    }
  }

  public reportError(
    error: unknown,
    options: {
      endpoint?: string;
      method?: string;
      status?: number;
      code?: string;
      context?: Record<string, any>;
      payload?: any;
    } = {}
  ) {
    if (typeof window === 'undefined') return;

    // Do not recursively log errors from the client-logs endpoint itself
    if (options.endpoint && options.endpoint.includes('/client-logs')) {
      return;
    }

    const message = error instanceof Error ? error.message : String(error || 'Unknown error');
    const stack = error instanceof Error ? error.stack : undefined;
    const code =
      options.code ||
      (error && typeof error === 'object' && 'code' in error ? String((error as any).code) : 'CLIENT_ERROR');
    const status =
      options.status ||
      (error && typeof error === 'object' && 'status' in error ? Number((error as any).status) : undefined);

    const userId = localStorage.getItem('orvio_user_id') || undefined;
    const workspaceId = localStorage.getItem('orvio_active_workspace_id') || undefined;
    const branchId = localStorage.getItem('orvio_active_branch_id') || undefined;

    const logEntry: ClientErrorLogItem = {
      message,
      code,
      endpoint: options.endpoint,
      method: options.method,
      status,
      stack,
      context: {
        userId,
        workspaceId,
        branchId,
        url: window.location.href,
        userAgent: navigator.userAgent,
        os: detectOS(),
        browser: detectBrowser(),
        ...options.context,
      },
      payload: sanitizeData(options.payload),
      timestamp: new Date().toISOString(),
    };

    this.queue.push(logEntry);

    if (this.queue.length >= 10) {
      this.flushImmediate();
    } else {
      this.scheduleFlush();
    }
  }

  private scheduleFlush() {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flushImmediate();
    }, 2000);
  }

  public async flushImmediate(): Promise<void> {
    if (this.queue.length === 0 || this.isFlushing) return;

    const batch = [...this.queue];
    this.queue = [];
    this.isFlushing = true;

    try {
      if (!navigator.onLine) {
        this.saveOffline(batch);
        return;
      }

      const res = await fetch(`${API_ORIGIN}/api/v1/client-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ logs: batch }),
        keepalive: true,
      });

      if (!res.ok) {
        this.saveOffline(batch);
      }
    } catch {
      this.saveOffline(batch);
    } finally {
      this.isFlushing = false;
    }
  }

  private saveOffline(logs: ClientErrorLogItem[]) {
    try {
      const existingRaw = localStorage.getItem(OFFLINE_STORAGE_KEY);
      const existing: ClientErrorLogItem[] = existingRaw ? JSON.parse(existingRaw) : [];
      const updated = [...existing, ...logs].slice(-50); // Keep last 50
      localStorage.setItem(OFFLINE_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  }

  public async flushOfflineLogs() {
    try {
      const raw = localStorage.getItem(OFFLINE_STORAGE_KEY);
      if (!raw) return;
      const logs: ClientErrorLogItem[] = JSON.parse(raw);
      if (!Array.isArray(logs) || logs.length === 0) return;

      const res = await fetch(`${API_ORIGIN}/api/v1/client-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ logs }),
      });

      if (res.ok) {
        localStorage.removeItem(OFFLINE_STORAGE_KEY);
      }
    } catch {}
  }
}

export const clientLogger = new ClientLogger();
export const reportClientError = (
  error: unknown,
  options?: Parameters<ClientLogger['reportError']>[1]
) => clientLogger.reportError(error, options);
