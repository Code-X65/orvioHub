import { getApiUrl, type Environment } from "@orviohub/shared";
import type { APIResponse } from "./types";
import { telemetry } from "./telemetry";
import { circuitBreaker, CircuitBreakerError } from "./circuitBreaker";
import { featureFlags } from "./featureFlags";
import { clientLogger, reportClientError } from "./clientLogger";
import { normalizedCache } from "./normalizedCache";
import { offlineQueue } from "./offlineQueue";
import { isOnline, useOnlineStatus } from "./offline";
import { getCrossSubdomainItem } from "./cookieStorage";

const defaultEnv: Environment = import.meta.env?.PROD ? "production" : "development";
const rawApiUrl =
  (import.meta.env?.VITE_API_URL as string) ||
  (import.meta.env?.PROD ? getApiUrl(defaultEnv) : "");

export const API_ORIGIN = rawApiUrl.replace(/\/$/, "");
export const API_BASE_URL = `${API_ORIGIN}/api/v1`;

export class ApiError extends Error {
  public code: string;
  public fields?: Record<string, string>;
  public details?: any;
  public status?: number;
  public attemptsRemaining?: number;
  public data?: any;
  public response?: { data?: any; status?: number };

  constructor(
    message: string,
    code = "UNKNOWN_ERROR",
    fields?: Record<string, string>,
    details?: any,
    status?: number,
    attemptsRemaining?: number,
    data?: any
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.fields = fields;
    this.details = details;
    this.status = status;
    this.attemptsRemaining = attemptsRemaining;
    this.data = data;
    this.response = data ? { data, status } : undefined;
  }
}

export async function toApiError(res: Response): Promise<ApiError> {
  try {
    const data = await res.json();
    const message = data.error?.message || data.message || `Request failed with status ${res.status}`;
    const code = data.error?.code || data.code || `HTTP_${res.status}`;
    const rawAttempts = data.error?.attemptsRemaining ?? data.attemptsRemaining ?? data.data?.attemptsRemaining;
    const attemptsRemaining = typeof rawAttempts === "number" ? rawAttempts : undefined;
    return new ApiError(
      message,
      code,
      data.error?.fields || data.fields,
      data.error?.details || data.details,
      res.status,
      attemptsRemaining,
      data
    );
  } catch {
    return new ApiError(`Request failed with status ${res.status}`, `HTTP_${res.status}`, undefined, undefined, res.status);
  }
}

/**
 * Creates an environment-aware API client.
 * Dispatches auth:unauthorized event on 401 instead of forcing a hard window reload.
 */
export function createApiClient(environment: Environment) {
  const base = getApiUrl(environment).replace(/\/$/, "");

  return async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    const fullUrl = `${base}${cleanPath.startsWith("/api") ? cleanPath : `/api/v1${cleanPath}`}`;

    const res = await fetch(fullUrl, {
      ...init,
      credentials: "include", // required for session cookies across subdomains
      headers: { "Content-Type": "application/json", ...init.headers },
    });

    if (res.status === 401) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("auth:unauthorized"));
      }
      throw await toApiError(res);
    }

    if (!res.ok) throw await toApiError(res);
    return res.json() as Promise<T>;
  };
}

let memoryAuthToken: string | null = null;

export function setMemoryAuthToken(token: string | null): void {
  memoryAuthToken = token;
}

export function getMemoryAuthToken(): string | null {
  return memoryAuthToken;
}

let refreshPromise: Promise<string | null> | null = null;

/**
 * Executes a silent refresh using HttpOnly cookies.
 * Does not store sensitive tokens in localStorage or un-HttpOnly document.cookie.
 */
async function executeTokenRefresh(): Promise<string | null> {
  const refreshStart = Date.now();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("auth:token-refreshing", { detail: { refreshing: true } }));
  }
  try {
    const res = await fetch(`${API_ORIGIN}/api/v1/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });

    const data: APIResponse<{ token: string; refreshToken?: string }> = await res.json();
    const duration = Date.now() - refreshStart;

    if (!res.ok || !data.success || !data.data) {
      if (featureFlags.isEnabled('enable-api-telemetry', true)) {
        telemetry.recordAuthRefresh(false, duration, `HTTP_${res.status}`);
      }
      return null;
    }

    if (data.data.token) {
      setMemoryAuthToken(data.data.token);
    }

    if (featureFlags.isEnabled('enable-api-telemetry', true)) {
      telemetry.recordAuthRefresh(true, duration);
    }
    return data.data.token;
  } catch (err: any) {
    if (featureFlags.isEnabled('enable-api-telemetry', true)) {
      telemetry.recordAuthRefresh(false, Date.now() - refreshStart, err?.message || 'Network error');
    }
    return null;
  } finally {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("auth:token-refreshing", { detail: { refreshing: false } }));
    }
    refreshPromise = null;
  }
}

/**
 * Explicitly renews the authenticated session using the rotating HttpOnly
 * refresh cookie. Shared with the automatic 401 recovery path so concurrent
 * manual and automatic refresh attempts rotate the token only once.
 */
export function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = executeTokenRefresh();
  }
  return refreshPromise;
}

export type RequestInterceptor = (
  endpoint: string,
  options: ApiRequestOptions
) => Promise<{ endpoint?: string; options?: ApiRequestOptions } | void> | { endpoint?: string; options?: ApiRequestOptions } | void;

export type ResponseInterceptor<T = any> = (
  data: any,
  response: Response,
  context: { endpoint: string; options: ApiRequestOptions }
) => Promise<T> | T;

export type ErrorInterceptor = (
  error: any,
  context: { endpoint: string; options: ApiRequestOptions }
) => Promise<any> | any;

const requestInterceptors: RequestInterceptor[] = [];
const responseInterceptors: ResponseInterceptor[] = [];
const errorInterceptors: ErrorInterceptor[] = [];

export const interceptors = {
  request: {
    use: (interceptor: RequestInterceptor) => {
      requestInterceptors.push(interceptor);
      return () => {
        const idx = requestInterceptors.indexOf(interceptor);
        if (idx !== -1) requestInterceptors.splice(idx, 1);
      };
    },
    eject: (interceptor: RequestInterceptor) => {
      const idx = requestInterceptors.indexOf(interceptor);
      if (idx !== -1) requestInterceptors.splice(idx, 1);
    },
  },
  response: {
    use: <T = any>(interceptor: ResponseInterceptor<T>) => {
      responseInterceptors.push(interceptor);
      return () => {
        const idx = responseInterceptors.indexOf(interceptor);
        if (idx !== -1) responseInterceptors.splice(idx, 1);
      };
    },
    eject: (interceptor: ResponseInterceptor) => {
      const idx = responseInterceptors.indexOf(interceptor);
      if (idx !== -1) responseInterceptors.splice(idx, 1);
    },
  },
  error: {
    use: (interceptor: ErrorInterceptor) => {
      errorInterceptors.push(interceptor);
      return () => {
        const idx = errorInterceptors.indexOf(interceptor);
        if (idx !== -1) errorInterceptors.splice(idx, 1);
      };
    },
    eject: (interceptor: ErrorInterceptor) => {
      const idx = errorInterceptors.indexOf(interceptor);
      if (idx !== -1) errorInterceptors.splice(idx, 1);
    },
  },
};

export interface ApiRequestOptions extends RequestInit {
  bypassCache?: boolean;
  cacheTtlMs?: number;
  swr?: boolean;
  swrMaxAgeMs?: number;
  onRevalidate?: (freshData: any) => void;
  idempotencyKey?: string;
  deduplicate?: boolean;
  retries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
  tags?: string[];
  invalidateTags?: string[];
  invalidatePaths?: string[];
  queueOffline?: boolean;
  normalizeEntities?: boolean;
}

export interface BatchSubRequest {
  id?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  headers?: Record<string, string>;
  body?: any;
}

export interface BatchSubResponse<T = any> {
  id: string;
  status: number;
  headers?: Record<string, string>;
  data: T;
}

interface CacheEntry {
  data: any;
  expiresAt: number;
  staleUntil: number;
  tags: string[];
  cleanEndpoint: string;
}

const inFlightGetRequests = new Map<string, Promise<any>>();
const inFlightMutations = new Map<string, Promise<any>>();
const getResponseCache = new Map<string, CacheEntry>();

/**
 * Fast deterministic hash for token anonymization in cache keys.
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return (hash >>> 0).toString(36);
}

/**
 * Computes a sanitized cache scope without exposing raw tokens in memory keys.
 */
function getUserCacheScope(token: string | null, endpoint: string): string {
  const publicEndpoints = ["/api/v1/auth/session", "/api/v1/pricing", "/api/v1/plans", "/api/v1/health"];
  if (publicEndpoints.some((p) => endpoint.startsWith(p))) {
    return "public";
  }
  if (!token) return "anon";
  return `u:${hashString(token)}`;
}

/**
 * Extracts sensible default tags from an API endpoint path.
 * e.g. "/api/v1/workspaces/ws_123/branches" -> ["workspaces", "workspaces:ws_123", "branches"]
 */
function inferTagsFromEndpoint(endpoint: string): string[] {
  const parts = endpoint
    .replace(/^\/api\/v\d+\//, "")
    .replace(/^\//, "")
    .split("/");
  const tags: string[] = [];

  if (parts.length > 0 && parts[0]) {
    tags.push(parts[0]);
    if (parts.length > 1 && parts[1]) {
      tags.push(`${parts[0]}:${parts[1]}`);
    }
    if (parts.length > 2 && parts[2]) {
      tags.push(parts[2]);
    }
  }
  return tags;
}

/**
 * Invalidates cache entries matching specific tags.
 */
export function invalidateApiCacheByTag(tags: string | string[]) {
  const tagList = Array.isArray(tags) ? tags : [tags];
  if (tagList.length === 0) return;

  for (const [key, entry] of getResponseCache.entries()) {
    if (entry.tags.some((t) => tagList.includes(t))) {
      getResponseCache.delete(key);
    }
  }
}

/**
 * Invalidates cache entries matching specific endpoint path prefixes.
 */
export function invalidateApiCacheByPath(pathPrefixes: string | string[]) {
  const prefixes = Array.isArray(pathPrefixes) ? pathPrefixes : [pathPrefixes];
  if (prefixes.length === 0) return;

  for (const [key, entry] of getResponseCache.entries()) {
    if (prefixes.some((p) => entry.cleanEndpoint.includes(p) || key.includes(p))) {
      getResponseCache.delete(key);
    }
  }
}

/**
 * General cache invalidation helper supporting exact string or RegExp matching, or full clear.
 */
export function invalidateApiCache(pattern?: string | RegExp) {
  if (!pattern) {
    getResponseCache.clear();
    return;
  }
  for (const key of getResponseCache.keys()) {
    if (typeof pattern === "string" && key.includes(pattern)) {
      getResponseCache.delete(key);
    } else if (pattern instanceof RegExp && pattern.test(key)) {
      getResponseCache.delete(key);
    }
  }
}

/**
 * Network fetch wrapper providing exponential backoff retry and timeout abortion.
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit & { timeoutMs?: number },
  maxRetries = 2,
  baseDelayMs = 300
): Promise<Response> {
  const method = (options.method || "GET").toUpperCase();
  const headers = options.headers instanceof Headers ? options.headers : new Headers(options.headers);
  const isIdempotent =
    method === "GET" || method === "HEAD" || headers.has("Idempotency-Key") || headers.has("idempotency-key");
  const allowedRetries = isIdempotent ? maxRetries : 0;
  const timeoutMs = options.timeoutMs ?? 30000;

  let attempt = 0;
  while (true) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort(
        new ApiError(`Request timed out after ${timeoutMs}ms`, "TIMEOUT_ERROR", undefined, undefined, 408)
      );
    }, timeoutMs);

    const externalSignal = options.signal;
    const onExternalAbort = () => controller.abort(externalSignal?.reason);
    if (externalSignal) {
      if (externalSignal.aborted) {
        clearTimeout(timeoutId);
        throw externalSignal.reason || new Error("Aborted");
      }
      externalSignal.addEventListener("abort", onExternalAbort);
    }

    try {
      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return res;
    } catch (err: any) {
      attempt++;
      if (attempt > allowedRetries || externalSignal?.aborted) {
        throw err;
      }
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    } finally {
      clearTimeout(timeoutId);
      if (externalSignal) {
        externalSignal.removeEventListener("abort", onExternalAbort);
      }
    }
  }
}

async function fetcher<T>(
  endpoint: string,
  options: ApiRequestOptions = {},
  isRetry = false
): Promise<T> {
  let resolvedEndpoint = endpoint;
  let resolvedOptions = { ...options };

  if (requestInterceptors.length > 0) {
    for (const interceptor of requestInterceptors) {
      const res = await interceptor(resolvedEndpoint, resolvedOptions);
      if (res) {
        if (res.endpoint) resolvedEndpoint = res.endpoint;
        if (res.options) resolvedOptions = res.options;
      }
    }
  }

  options = resolvedOptions;
  endpoint = resolvedEndpoint;

  const method = (options.method || "GET").toUpperCase();
  const token = getMemoryAuthToken();
  const activeWorkspaceId = getCrossSubdomainItem("orvio_active_workspace_id");
  const activeBranchId = getCrossSubdomainItem("orvio_active_branch_id");

  // Format endpoint
  const cleanEndpoint = endpoint.startsWith("/v1")
    ? `/api${endpoint}`
    : endpoint.startsWith("/api")
    ? endpoint
    : `/api/v1${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  // Invalidate targeted cache when state-mutating requests occur
  if (method !== "GET") {
    if (options.invalidateTags && options.invalidateTags.length > 0) {
      invalidateApiCacheByTag(options.invalidateTags);
    } else if (options.invalidatePaths && options.invalidatePaths.length > 0) {
      invalidateApiCacheByPath(options.invalidatePaths);
    } else {
      // Intelligently invalidate tags derived from the mutated endpoint
      const inferredTags = inferTagsFromEndpoint(cleanEndpoint);
      if (inferredTags.length > 0) {
        invalidateApiCacheByTag(inferredTags);
      } else {
        invalidateApiCache();
      }
    }
  }

  // Deduplicate and cache GET requests with SWR support
  const isGet = method === "GET";
  const userScope = getUserCacheScope(token, cleanEndpoint);
  const cacheKey = `${userScope}::${activeWorkspaceId || ""}::${activeBranchId || ""}::${cleanEndpoint}`;

  // 0. Offline Network Interceptor
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    if (isGet) {
      const cached = getResponseCache.get(cacheKey);
      if (cached) {
        console.warn(`[Offline Mode] Serving cached response for ${cleanEndpoint}`);
        if (featureFlags.isEnabled("enable-api-telemetry", true)) {
          telemetry.recordRequestStart(cleanEndpoint, method, true);
          telemetry.recordRequestEnd(cleanEndpoint, method, 0, 200, true);
        }
        return cached.data as T;
      }
      throw new ApiError(
        `Cannot fetch "${cleanEndpoint}" while offline with no cached copy available.`,
        "OFFLINE_NO_CACHE",
        undefined,
        undefined,
        0
      );
    } else if (options.queueOffline !== false) {
      const queued = offlineQueue.enqueue(
        cleanEndpoint,
        method as any,
        options.body,
        options.headers as any,
        options.idempotencyKey
      );
      return {
        _offlineQueued: true,
        queued: true,
        id: queued.id,
        success: true,
        message: "Action queued locally while offline.",
      } as any;
    }
  }

  // 1. Circuit Breaker Guard
  if (featureFlags.isEnabled("enable-circuit-breaker", true)) {
    const cbStatus = circuitBreaker.checkExecution(cleanEndpoint);
    if (!cbStatus.allowed) {
      // If GET request and cached entry exists (even stale), serve stale cache fallback with warning
      if (isGet) {
        const cachedFallback = getResponseCache.get(cacheKey);
        if (cachedFallback) {
          console.warn(`[CircuitBreaker] Endpoint "${cleanEndpoint}" is OPEN. Serving cached fallback.`);
          if (featureFlags.isEnabled("enable-api-telemetry", true)) {
            telemetry.recordRequestStart(cleanEndpoint, method, true);
            telemetry.recordRequestEnd(cleanEndpoint, method, 0, 200, true);
          }
          return cachedFallback.data as T;
        }
      }

      const cbError = new ApiError(
        `Endpoint "${cleanEndpoint}" is temporarily unavailable due to repeated failures. Next retry allowed in ${Math.ceil(
          cbStatus.nextRetryInMs / 1000
        )}s.`,
        "CIRCUIT_BREAKER_OPEN",
        undefined,
        undefined,
        503
      );

      if (featureFlags.isEnabled("enable-api-telemetry", true)) {
        telemetry.recordRequestStart(cleanEndpoint, method, false);
        telemetry.recordRequestEnd(cleanEndpoint, method, 0, 503, false);
        telemetry.recordApiError(cleanEndpoint, "CIRCUIT_BREAKER_OPEN", 503, cbError.message);
      }

      throw cbError;
    }
  }

  // Handle Mutating Request Deduplication (POST / PUT / PATCH / DELETE)
  if (!isGet && options.deduplicate !== false) {
    const rawHeaders = options.headers instanceof Headers ? options.headers : new Headers(options.headers);
    const existingIdempotency =
      options.idempotencyKey ||
      rawHeaders.get("Idempotency-Key") ||
      rawHeaders.get("idempotency-key");
    const mutationKey = `${method}::${cleanEndpoint}::${existingIdempotency || options.body || ""}`;

    if (inFlightMutations.has(mutationKey)) {
      return inFlightMutations.get(mutationKey) as Promise<T>;
    }
  }

  if (isGet && !options.bypassCache) {
    const cached = getResponseCache.get(cacheKey);
    const now = Date.now();

    if (cached) {
      // Fresh cache: serve immediately
      if (now < cached.expiresAt) {
        if (featureFlags.isEnabled("enable-api-telemetry", true)) {
          telemetry.recordRequestStart(cleanEndpoint, method, true);
          telemetry.recordRequestEnd(cleanEndpoint, method, 0, 200, true);
        }
        return cached.data as T;
      }

      // Stale-While-Revalidate: serve stale immediately and revalidate in background
      const isSwrEnabled = options.swr !== false;
      if (isSwrEnabled && now < cached.staleUntil) {
        if (featureFlags.isEnabled("enable-api-telemetry", true)) {
          telemetry.recordRequestStart(cleanEndpoint, method, true);
          telemetry.recordRequestEnd(cleanEndpoint, method, 0, 200, true);
        }

        if (!inFlightGetRequests.has(cacheKey)) {
          const bgPromise = (async () => {
            try {
              const freshData = await executeFetch();
              options.onRevalidate?.(freshData);
              return freshData;
            } catch (err) {
              console.warn(`[SWR] Background revalidation failed for ${cleanEndpoint}:`, err);
            } finally {
              inFlightGetRequests.delete(cacheKey);
            }
          })();
          inFlightGetRequests.set(cacheKey, bgPromise as Promise<any>);
        }
        return cached.data as T;
      }
    }

    if (inFlightGetRequests.has(cacheKey)) {
      return inFlightGetRequests.get(cacheKey) as Promise<T>;
    }
  }

  async function executeFetch(): Promise<T> {
    const fetchStartTime = Date.now();
    if (featureFlags.isEnabled("enable-api-telemetry", true)) {
      telemetry.recordRequestStart(cleanEndpoint, method, false);
    }

    const headers = new Headers(options.headers);

    if (options.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    if (activeWorkspaceId && !headers.has("x-workspace-id")) {
      headers.set("x-workspace-id", activeWorkspaceId);
    }
    if (activeBranchId && !headers.has("x-branch-id")) {
      headers.set("x-branch-id", activeBranchId);
    }

    // Automatically attach Idempotency-Key for mutating requests if not present
    if (!isGet && !headers.has("Idempotency-Key") && !headers.has("idempotency-key")) {
      const generatedKey =
        options.idempotencyKey ||
        (typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`);
      headers.set("Idempotency-Key", generatedKey);
    }

    const fullUrl = `${API_ORIGIN}${cleanEndpoint}`;

    let response: Response;
    try {
      response = await fetchWithRetry(
        fullUrl,
        {
          ...options,
          credentials: "include",
          headers,
        },
        options.retries ?? 2,
        options.retryDelayMs ?? 300
      );
    } catch (networkErr: any) {
      const duration = Date.now() - fetchStartTime;
      const status = networkErr?.status || (networkErr?.name === "TimeoutError" ? 408 : 0);
      const errorCode = networkErr?.code || (status === 408 ? "TIMEOUT_ERROR" : "NETWORK_ERROR");
      const errorMessage = networkErr?.message || "Network request failed";

      if (featureFlags.isEnabled("enable-circuit-breaker", true)) {
        circuitBreaker.recordFailure(cleanEndpoint, status);
      }
      if (featureFlags.isEnabled("enable-api-telemetry", true)) {
        telemetry.recordRequestEnd(cleanEndpoint, method, duration, status || 500, false);
        telemetry.recordApiError(cleanEndpoint, errorCode, status, errorMessage);
      }
      if (featureFlags.isEnabled("enable-client-error-logging", true)) {
        reportClientError(networkErr, {
          endpoint: cleanEndpoint,
          method,
          status,
          code: errorCode,
          payload: options.body,
        });
      }

      // If network failed for a mutating request, queue it offline if enabled
      if (
        !isGet &&
        options.queueOffline !== false &&
        (networkErr?.name === "TypeError" ||
          networkErr?.message?.includes("fetch") ||
          networkErr?.message?.includes("Failed to fetch") ||
          networkErr?.message?.includes("network"))
      ) {
        const queued = offlineQueue.enqueue(
          cleanEndpoint,
          method as any,
          options.body,
          options.headers as any,
          options.idempotencyKey
        );
        return {
          _offlineQueued: true,
          queued: true,
          id: queued.id,
          success: true,
          message: "Action queued locally following network failure.",
        } as any;
      }

      throw networkErr;
    }

    // Process Cache-Invalidate response headers automatically
    const invalidateHeader =
      response.headers.get("cache-invalidate") ||
      response.headers.get("x-cache-invalidate") ||
      response.headers.get("Cache-Invalidate");
    if (invalidateHeader) {
      const parts = invalidateHeader
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const tags = parts.filter((p) => !p.startsWith("/"));
      const paths = parts.filter((p) => p.startsWith("/"));
      if (tags.length > 0) invalidateApiCacheByTag(tags);
      if (paths.length > 0) invalidateApiCacheByPath(paths);
    }

    let data: any;
    try {
      data = await response.json();
    } catch {
      const parseErr = new ApiError("Failed to parse API response", "PARSE_ERROR", undefined, undefined, response.status);
      const duration = Date.now() - fetchStartTime;
      if (featureFlags.isEnabled("enable-api-telemetry", true)) {
        telemetry.recordRequestEnd(cleanEndpoint, method, duration, response.status, false);
        telemetry.recordApiError(cleanEndpoint, "PARSE_ERROR", response.status, parseErr.message);
      }
      if (featureFlags.isEnabled("enable-client-error-logging", true)) {
        reportClientError(parseErr, {
          endpoint: cleanEndpoint,
          method,
          status: response.status,
          code: "PARSE_ERROR",
        });
      }
      throw parseErr;
    }

    if (!response.ok || (data && typeof data.success === "boolean" && !data.success)) {
      const isAuthProbeEndpoint =
        endpoint.includes("/auth/login") ||
        endpoint.includes("/auth/refresh") ||
        endpoint.includes("/auth/logout") ||
        endpoint.includes("/auth/session") ||
        endpoint.includes("/auth/me") ||
        endpoint.includes("/auth/verify-email") ||
        endpoint.includes("/auth/change-pending-email") ||
        endpoint.includes("/invitations/");

      if (response.status === 401 && !isRetry && !isAuthProbeEndpoint) {
        // If token version was explicitly invalidated (e.g. password reset), bypass refresh loop and notify with context
        if (data?.error?.code === "TOKEN_VERSION_MISMATCH") {
          setMemoryAuthToken(null);
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("auth:reauthenticate-required", {
                detail: {
                  reason: data.error.reason || "PASSWORD_OR_SECURITY_RESET",
                  message: data.error.message,
                  returnUrl: window.location.href,
                },
              })
            );
            window.dispatchEvent(new Event("auth:unauthorized"));
          }
        } else {
          const newToken = await refreshAccessToken();
          if (newToken) {
            return fetcher<T>(endpoint, options, true);
          } else {
            setMemoryAuthToken(null);
            if (typeof window !== "undefined") {
              window.dispatchEvent(new Event("auth:unauthorized"));
            }
          }
        }
      } else if (response.status === 401 && !isAuthProbeEndpoint) {
        setMemoryAuthToken(null);
        if (typeof window !== "undefined") {
          if (data?.error?.code === "TOKEN_VERSION_MISMATCH") {
            window.dispatchEvent(
              new CustomEvent("auth:reauthenticate-required", {
                detail: {
                  reason: data.error.reason || "PASSWORD_OR_SECURITY_RESET",
                  message: data.error.message,
                  returnUrl: window.location.href,
                },
              })
            );
          }
          window.dispatchEvent(new Event("auth:unauthorized"));
        }
      }

      const duration = Date.now() - fetchStartTime;
      const errorMessage = data?.error?.message || data?.message || "An unexpected error occurred.";
      const errorCode = data?.error?.code || data?.code || (response.status >= 500 ? "INTERNAL_SERVER_ERROR" : `HTTP_${response.status}`);

      if (featureFlags.isEnabled("enable-circuit-breaker", true)) {
        circuitBreaker.recordFailure(cleanEndpoint, response.status);
      }
      if (featureFlags.isEnabled("enable-api-telemetry", true)) {
        telemetry.recordRequestEnd(cleanEndpoint, method, duration, response.status, false);
        telemetry.recordApiError(cleanEndpoint, errorCode, response.status, errorMessage);
      }
      if (featureFlags.isEnabled("enable-client-error-logging", true)) {
        reportClientError(new Error(errorMessage), {
          endpoint: cleanEndpoint,
          method,
          status: response.status,
          code: errorCode,
          payload: options.body,
        });
      }

      const apiError = new ApiError(
        errorMessage,
        errorCode,
        data?.error?.fields || data?.fields,
        data?.error?.details || data?.details,
        response.status,
        data?.error?.attemptsRemaining ?? data?.attemptsRemaining,
        data
      );

      if (errorInterceptors.length > 0) {
        for (const interceptor of errorInterceptors) {
          const handled = await interceptor(apiError, { endpoint: cleanEndpoint, options });
          if (handled !== undefined) return handled as T;
        }
      }

      throw apiError;
    }

    const duration = Date.now() - fetchStartTime;
    if (featureFlags.isEnabled("enable-circuit-breaker", true)) {
      circuitBreaker.recordSuccess(cleanEndpoint);
    }
    if (featureFlags.isEnabled("enable-api-telemetry", true)) {
      telemetry.recordRequestEnd(cleanEndpoint, method, duration, response.status, false);
    }

    let result = (data && "data" in data ? data.data : data) as T;

    // Apply response interceptors / transformers before normalization and cache
    if (responseInterceptors.length > 0) {
      for (const interceptor of responseInterceptors) {
        result = await interceptor(result, response, { endpoint: cleanEndpoint, options });
      }
    }

    // Automatically normalize known entities into normalized entity cache
    if (options.normalizeEntities !== false) {
      normalizedCache.normalize(result);
    }

    if (isGet && !options.bypassCache) {
      const ttl = typeof options.cacheTtlMs === "number" ? options.cacheTtlMs : 5000;
      const swrMaxAge = typeof options.swrMaxAgeMs === "number" ? options.swrMaxAgeMs : 300000; // 5 mins stale window
      if (ttl > 0) {
        const explicitTags = options.tags || [];
        const inferredTags = inferTagsFromEndpoint(cleanEndpoint);
        const allTags = Array.from(new Set([...explicitTags, ...inferredTags]));

        getResponseCache.set(cacheKey, {
          data: result,
          expiresAt: Date.now() + ttl,
          staleUntil: Date.now() + ttl + swrMaxAge,
          tags: allTags,
          cleanEndpoint,
        });
      }
    }

    return result;
  }

  if (isGet && !options.bypassCache) {
    const promise = executeFetch().finally(() => {
      inFlightGetRequests.delete(cacheKey);
    });
    inFlightGetRequests.set(cacheKey, promise);
    return promise;
  }

  if (!isGet && options.deduplicate !== false) {
    const rawHeaders = options.headers instanceof Headers ? options.headers : new Headers(options.headers);
    const existingIdempotency =
      options.idempotencyKey ||
      rawHeaders.get("Idempotency-Key") ||
      rawHeaders.get("idempotency-key");
    const mutationKey = `${method}::${cleanEndpoint}::${existingIdempotency || options.body || ""}`;

    const mutationPromise = executeFetch().finally(() => {
      inFlightMutations.delete(mutationKey);
    });
    inFlightMutations.set(mutationKey, mutationPromise);
    return mutationPromise;
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

  batch: async <R = any>(
    requests: BatchSubRequest[],
    options?: ApiRequestOptions
  ): Promise<BatchSubResponse<R>[]> => {
    const formattedRequests = requests.map((req, index) => ({
      id: req.id || `req_${index + 1}`,
      method: (req.method || "GET").toUpperCase(),
      path: req.path,
      headers: req.headers,
      body: req.body,
    }));

    const res = await fetcher<{ success: boolean; responses: BatchSubResponse<R>[] }>("/batch", {
      ...options,
      method: "POST",
      body: JSON.stringify({ requests: formattedRequests }),
      deduplicate: false,
    });

    const responses = (res as any)?.responses || [];
    for (const item of responses) {
      if (item.data && options?.normalizeEntities !== false) {
        normalizedCache.normalize(item.data);
      }
    }

    return responses;
  },

  invalidateCache: invalidateApiCache,
  invalidateByTag: invalidateApiCacheByTag,
  invalidateByPath: invalidateApiCacheByPath,
  interceptors,
  useRequestTransform: interceptors.request.use,
  useResponseTransform: interceptors.response.use,
  useErrorTransform: interceptors.error.use,
  telemetry,
  circuitBreaker,
  featureFlags,
  clientLogger,
  reportError: reportClientError,
  normalizedCache,
  offlineQueue,
};

export { telemetry } from "./telemetry";
export { circuitBreaker, CircuitBreakerError } from "./circuitBreaker";
export { featureFlags } from "./featureFlags";
export { clientLogger, reportClientError } from "./clientLogger";
export { normalizedCache } from "./normalizedCache";
export { offlineQueue } from "./offlineQueue";
export { isOnline, useOnlineStatus } from "./offline";
