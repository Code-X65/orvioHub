import { API_ORIGIN, API_BASE_URL } from "./config";
import { authManager } from "./auth-manager";
import { LRUCache } from "./lru-cache";

export { API_ORIGIN, API_BASE_URL };

export class ApiError extends Error {
  public code: string;
  public fields?: Record<string, string>;
  public details?: any;
  public status?: number;

  constructor(message: string, code = "UNKNOWN_ERROR", fields?: Record<string, string>, details?: any, status?: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.fields = fields;
    this.details = details;
    this.status = status;
  }
}

export async function toApiError(res: Response): Promise<ApiError> {
  try {
    const data = await res.json();
    const message = data.error?.message || data.message || `Request failed with status ${res.status}`;
    const code = data.error?.code || data.code || `HTTP_${res.status}`;
    return new ApiError(message, code, data.error?.fields || data.fields, data.error?.details || data.details, res.status);
  } catch {
    return new ApiError(`Request failed with status ${res.status}`, `HTTP_${res.status}`, undefined, undefined, res.status);
  }
}

let queryInvalidator: ((pattern?: string | RegExp) => void) | null = null;

export function registerQueryInvalidator(fn: (pattern?: string | RegExp) => void) {
  queryInvalidator = fn;
}

export interface ApiRequestOptions extends RequestInit {
  bypassCache?: boolean;
  cacheTtlMs?: number;
  /** Explicit tenancy context wins over persisted UI selection. */
  workspaceId?: string;
  branchId?: string;
  timeoutMs?: number;
  retries?: number;
}

const inFlightGetRequests = new LRUCache<string, Promise<any>>(200, 30_000);
const getResponseCache = new Map<string, { data: any; expiresAt: number }>();
const MAX_CACHE_ENTRIES = 200;

export type ApiTelemetryEvent = {
  endpoint: string; method: string; status?: number; durationMs: number;
  outcome: 'success' | 'error' | 'aborted' | 'retry';
};
let telemetryHandler: ((event: ApiTelemetryEvent) => void) | null = null;

/** Attach Sentry/Logtail instrumentation without coupling the transport to a vendor. */
export function setApiTelemetryHandler(handler: ((event: ApiTelemetryEvent) => void) | null) {
  telemetryHandler = handler;
}

function emitTelemetry(event: ApiTelemetryEvent) {
  telemetryHandler?.(event);
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent<ApiTelemetryEvent>('orvio:api', { detail: event }));
}

function cacheResponse(key: string, data: any, ttl: number) {
  getResponseCache.delete(key); // Map insertion order gives us a tiny LRU.
  getResponseCache.set(key, { data, expiresAt: Date.now() + ttl });
  while (getResponseCache.size > MAX_CACHE_ENTRIES) {
    const oldest = getResponseCache.keys().next().value;
    if (!oldest) break;
    getResponseCache.delete(oldest);
  }
}

export function invalidateApiCache(pattern?: string | RegExp) {
  if (!pattern) {
    getResponseCache.clear();
    queryInvalidator?.();
    return;
  }
  for (const key of getResponseCache.keys()) {
    if (typeof pattern === 'string' && key.includes(pattern)) {
      getResponseCache.delete(key);
    } else if (pattern instanceof RegExp && pattern.test(key)) {
      getResponseCache.delete(key);
    }
  }
  queryInvalidator?.(pattern);
}

/** Invalidate only data for the affected tenant/context after a successful mutation. */
export function invalidateApiContextCache(workspaceId?: string | null, branchId?: string | null) {
  if (!workspaceId && !branchId) return;
  for (const key of getResponseCache.keys()) {
    const [, cachedWorkspace, cachedBranch] = key.split('::');
    if (workspaceId && cachedWorkspace !== workspaceId) continue;
    if (branchId && cachedBranch !== branchId) continue;
    getResponseCache.delete(key);
  }
}

function requestedBranchFromEndpoint(endpoint: string): string | undefined {
  try {
    return new URL(endpoint, 'https://api.local').searchParams.get('branchId') || undefined;
  } catch { return undefined; }
}

function createRequestSignal(parent: AbortSignal | null | undefined, timeoutMs: number) {
  const controller = new AbortController();
  const onAbort = () => controller.abort(parent?.reason);
  if (parent?.aborted) controller.abort(parent.reason);
  else if (parent) parent.addEventListener('abort', onAbort, { once: true });
  const timer = globalThis.setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), timeoutMs);
  return { signal: controller.signal, dispose: () => { globalThis.clearTimeout(timer); parent?.removeEventListener('abort', onAbort); } };
}

async function fetcher<T>(
  endpoint: string,
  options: ApiRequestOptions = {},
  isRetry = false
): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const activeWorkspaceId = options.workspaceId || localStorage.getItem("orvio_active_workspace_id");
  // A branch in the URL is an explicit user request and must never be
  // overridden by the persisted active-branch header.
  const endpointBranchId = requestedBranchFromEndpoint(endpoint);
  const explicitBranchId = options.branchId || endpointBranchId;
  const activeBranchId = explicitBranchId || localStorage.getItem("orvio_active_branch_id");

  // Format endpoint
  const cleanEndpoint = endpoint.startsWith("/v1")
    ? `/api${endpoint}`
    : endpoint.startsWith("/api")
    ? endpoint
    : `/api/v1${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  // Deduplicate and cache GET requests
  const isGet = method === "GET";
  const optionHeaders = new Headers(options.headers);
  const requestWorkspaceId = optionHeaders.get('x-workspace-id') || activeWorkspaceId || '';
  const requestBranchId = optionHeaders.get('x-branch-id') || activeBranchId || '';
  const cacheKey = `session::${requestWorkspaceId}::${requestBranchId}::${cleanEndpoint}`;

  if (isGet && !options.bypassCache) {
    const cached = getResponseCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data as T;
    }

    if (inFlightGetRequests.has(cacheKey)) {
      return inFlightGetRequests.get(cacheKey) as Promise<T>;
    }
  }

  const executeFetch = async (): Promise<T> => {
    const headers = new Headers(options.headers);

    if (options.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    // Mutating requests are authenticated by the HttpOnly session cookie and
    // carry a session-bound CSRF header.  A missing token is valid for public
    // endpoints such as login/signup.
    if (!isGet && !headers.has('X-CSRF-Token')) {
      const csrfToken = await authManager.getCsrfToken();
      if (csrfToken) headers.set('X-CSRF-Token', csrfToken);
    }

    if (requestWorkspaceId && !headers.has("x-workspace-id")) {
      headers.set("x-workspace-id", requestWorkspaceId);
    }
    if (requestBranchId && !headers.has("x-branch-id") && !endpointBranchId) {
      headers.set("x-branch-id", requestBranchId);
    }

    const fullUrl = `${API_ORIGIN}${cleanEndpoint}`;
    const retries = isGet ? Math.max(0, options.retries ?? 2) : 0;
    let response: Response | undefined;
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const startedAt = performance.now();
      const controlled = createRequestSignal(options.signal, options.timeoutMs ?? 15_000);
      try {
        response = await fetch(fullUrl, { ...options, credentials: "include", headers, signal: controlled.signal });
        const retryable = response.status >= 500 || response.status === 429;
        if (retryable && attempt < retries) {
          emitTelemetry({ endpoint: cleanEndpoint, method, status: response.status, durationMs: performance.now() - startedAt, outcome: 'retry' });
          await new Promise((resolve) => globalThis.setTimeout(resolve, 250 * 2 ** attempt + Math.random() * 100));
          continue;
        }
        emitTelemetry({ endpoint: cleanEndpoint, method, status: response.status, durationMs: performance.now() - startedAt, outcome: response.ok ? 'success' : 'error' });
        break;
      } catch (error: any) {
        lastError = error;
        const aborted = error?.name === 'AbortError' || error?.name === 'TimeoutError';
        emitTelemetry({ endpoint: cleanEndpoint, method, durationMs: performance.now() - startedAt, outcome: aborted ? 'aborted' : 'error' });
        if (aborted || attempt === retries) throw error;
        emitTelemetry({ endpoint: cleanEndpoint, method, durationMs: 0, outcome: 'retry' });
        await new Promise((resolve) => globalThis.setTimeout(resolve, 250 * 2 ** attempt + Math.random() * 100));
      } finally {
        controlled.dispose();
      }
    }
    if (!response) throw lastError || new ApiError('Request failed', 'NETWORK_ERROR');

    let data: any;
    if (response.status === 204 || response.headers.get('content-length') === '0') {
      data = {};
    } else {
      try { data = await response.json(); }
      catch { throw new ApiError("Failed to parse API response", "PARSE_ERROR", undefined, undefined, response.status); }
    }

    if (!response.ok || (data && typeof data.success === "boolean" && !data.success)) {
      const isAuthProbeEndpoint =
        endpoint.includes("/auth/login") ||
        endpoint.includes("/auth/refresh") ||
        endpoint.includes("/auth/logout") ||
        endpoint.includes("/auth/me") ||
        endpoint.includes("/auth/verify-email") ||
        endpoint.includes("/invitations/");

      const code = data?.error?.code || data?.code;
      if (response.status === 401 && !isAuthProbeEndpoint) {
        authManager.logoutAndRedirect();
      } else if (response.status === 403) {
        if (code === 'ACCOUNT_SUSPENDED' || code === 'SESSION_INVALIDATED' || code === 'UNAUTHENTICATED') {
          authManager.logoutAndRedirect();
        }
      }

      const errorMessage = data?.error?.message || data?.message || "An unexpected error occurred.";
      throw new ApiError(
        errorMessage,
        data?.error?.code || data?.code || "UNKNOWN_ERROR",
        data?.error?.fields || data?.fields,
        data?.error?.details || data?.details,
        response.status
      );
    }

    const result = (data && "data" in data ? data.data : data) as T;

    if (isGet && !options.bypassCache) {
      const ttl = typeof options.cacheTtlMs === "number" ? options.cacheTtlMs : 5000;
      if (ttl > 0) {
        cacheResponse(cacheKey, result, ttl);
      }
    }

    if (!isGet) {
      invalidateApiContextCache(requestWorkspaceId || undefined, explicitBranchId || undefined);
      // Workspace-level mutations also change workspace-list/entitlement views.
      if (cleanEndpoint.includes('/workspaces/')) invalidateApiCache('/workspaces');
      if (cleanEndpoint.includes('/organizations/')) invalidateApiCache('/organizations');
      queryInvalidator?.(cleanEndpoint);
    }

    return result;
  };

  if (isGet && !options.bypassCache) {
    const promise = executeFetch().finally(() => {
      inFlightGetRequests.delete(cacheKey);
    });
    inFlightGetRequests.set(cacheKey, promise);
    return promise;
  }

  return executeFetch();
}

export const api = {
  get: <T>(endpoint: string, options?: ApiRequestOptions) =>
    fetcher<T>(endpoint, { ...options, method: "GET" }),

  post: <T>(endpoint: string, body?: any, options?: ApiRequestOptions) =>
    fetcher<T>(endpoint, {
      ...options,
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(endpoint: string, body?: any, options?: ApiRequestOptions) =>
    fetcher<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T>(endpoint: string, body?: any, options?: ApiRequestOptions) =>
    fetcher<T>(endpoint, {
      ...options,
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(endpoint: string, body?: any, options?: ApiRequestOptions) =>
    fetcher<T>(endpoint, {
      ...options,
      method: "DELETE",
      body: body ? JSON.stringify(body) : undefined,
    }),

  invalidateCache: invalidateApiCache,
};
