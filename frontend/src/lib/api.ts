import { getApiUrl, getLoginUrl, type Environment } from "@orviohub/shared";
import type { APIResponse } from "./types";

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

/**
 * Creates an environment-aware API client.
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
      // Redirect to central auth, preserving the current location.
      window.location.assign(getLoginUrl(window.location.href, environment));
      throw new Error("Unauthenticated");
    }

    if (!res.ok) throw await toApiError(res);
    return res.json() as Promise<T>;
  };
}

let refreshPromise: Promise<string | null> | null = null;

async function executeTokenRefresh(): Promise<string | null> {
  const refreshToken = localStorage.getItem("orvio_refresh_token");
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_ORIGIN}/api/v1/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    const data: APIResponse<{ token: string; refreshToken: string }> = await res.json();
    if (!res.ok || !data.success || !data.data) {
      return null;
    }

    localStorage.setItem("orvio_auth_token", data.data.token);
    localStorage.setItem("orvio_refresh_token", data.data.refreshToken);
    return data.data.token;
  } catch {
    return null;
  } finally {
    refreshPromise = null;
  }
}

async function fetcher<T>(
  endpoint: string,
  options: RequestInit = {},
  isRetry = false
): Promise<T> {
  const token = localStorage.getItem("orvio_auth_token");
  const headers = new Headers(options.headers);

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const activeWorkspaceId = localStorage.getItem("orvio_active_workspace_id");
  const activeBranchId = localStorage.getItem("orvio_active_branch_id");
  if (activeWorkspaceId && !headers.has("x-workspace-id")) {
    headers.set("x-workspace-id", activeWorkspaceId);
  }
  if (activeBranchId && !headers.has("x-branch-id")) {
    headers.set("x-branch-id", activeBranchId);
  }

  // Format endpoint
  const cleanEndpoint = endpoint.startsWith("/v1")
    ? `/api${endpoint}`
    : endpoint.startsWith("/api")
    ? endpoint
    : `/api/v1${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  const fullUrl = `${API_ORIGIN}${cleanEndpoint}`;

  const response = await fetch(fullUrl, {
    ...options,
    credentials: "include",
    headers,
  });

  let data: any;
  try {
    data = await response.json();
  } catch {
    throw new ApiError("Failed to parse API response", "PARSE_ERROR");
  }

  if (!response.ok || (data && typeof data.success === "boolean" && !data.success)) {
    const isAuthProbeEndpoint =
      endpoint.includes("/auth/login") ||
      endpoint.includes("/auth/refresh") ||
      endpoint.includes("/auth/logout") ||
      endpoint.includes("/auth/me") ||
      endpoint.includes("/auth/verify-email") ||
      endpoint.includes("/invitations/");

    if (response.status === 401 && !isRetry && !isAuthProbeEndpoint) {
      if (!refreshPromise) {
        refreshPromise = executeTokenRefresh();
      }

      const newToken = await refreshPromise;
      if (newToken) {
        return fetcher<T>(endpoint, options, true);
      } else {
        localStorage.removeItem("orvio_auth_token");
        localStorage.removeItem("orvio_refresh_token");
        window.dispatchEvent(new Event("auth:unauthorized"));
      }
    } else if (response.status === 401 && !isAuthProbeEndpoint) {
      localStorage.removeItem("orvio_auth_token");
      localStorage.removeItem("orvio_refresh_token");
      window.dispatchEvent(new Event("auth:unauthorized"));
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

  return (data && "data" in data ? data.data : data) as T;
}

export const api = {
  get: <T>(endpoint: string, options?: RequestInit) =>
    fetcher<T>(endpoint, { ...options, method: "GET" }),

  post: <T>(endpoint: string, body?: any, options?: RequestInit) =>
    fetcher<T>(endpoint, {
      ...options,
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(endpoint: string, body?: any, options?: RequestInit) =>
    fetcher<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T>(endpoint: string, body?: any, options?: RequestInit) =>
    fetcher<T>(endpoint, {
      ...options,
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(endpoint: string, body?: any, options?: RequestInit) =>
    fetcher<T>(endpoint, {
      ...options,
      method: "DELETE",
      body: body ? JSON.stringify(body) : undefined,
    }),
};
