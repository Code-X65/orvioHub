import { APIResponse } from './types';

// Assuming Fastify runs on 3000 locally, adjust as needed or use env var
export const API_BASE_URL = 'http://localhost:3000/api/v1';

class APIError extends Error {
  public code: string;
  public fields?: Record<string, string>;
  public details?: any;

  constructor(message: string, code: string, fields?: Record<string, string>, details?: any) {
    super(message);
    this.name = 'APIError';
    this.code = code;
    this.fields = fields;
    this.details = details;
  }
}

let refreshPromise: Promise<string | null> | null = null;

async function executeTokenRefresh(): Promise<string | null> {
  const refreshToken = localStorage.getItem('orvio_refresh_token');
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    const data: APIResponse<{ token: string; refreshToken: string }> = await res.json();
    if (!res.ok || !data.success || !data.data) {
      return null;
    }

    localStorage.setItem('orvio_auth_token', data.data.token);
    localStorage.setItem('orvio_refresh_token', data.data.refreshToken);
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
  let token = localStorage.getItem('orvio_auth_token');
  
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  let data: APIResponse<T>;
  try {
    data = await response.json();
  } catch {
    throw new APIError('Failed to parse API response', 'PARSE_ERROR');
  }

  if (!response.ok || !data.success) {
    if (response.status === 401 && !isRetry && !endpoint.startsWith('/auth/login') && !endpoint.startsWith('/auth/refresh') && !endpoint.startsWith('/auth/logout')) {
      if (!refreshPromise) {
        refreshPromise = executeTokenRefresh();
      }

      const newToken = await refreshPromise;
      if (newToken) {
        // Retry original request with newly issued access token
        return fetcher<T>(endpoint, options, true);
      } else {
        localStorage.removeItem('orvio_auth_token');
        localStorage.removeItem('orvio_refresh_token');
        window.dispatchEvent(new Event('auth:unauthorized'));
      }
    } else if (response.status === 401) {
      localStorage.removeItem('orvio_auth_token');
      localStorage.removeItem('orvio_refresh_token');
      window.dispatchEvent(new Event('auth:unauthorized'));
    }

    const errorMessage = data.error?.message || data.message || 'An unexpected error occurred.';
    throw new APIError(
      errorMessage,
      data.error?.code || 'UNKNOWN_ERROR',
      data.error?.fields,
      data.error?.details
    );
  }

  return data.data as T;
}

export const api = {
  get: <T>(endpoint: string, options?: RequestInit) => 
    fetcher<T>(endpoint, { ...options, method: 'GET' }),
    
  post: <T>(endpoint: string, body?: any, options?: RequestInit) => 
    fetcher<T>(endpoint, { 
      ...options, 
      method: 'POST', 
      body: body ? JSON.stringify(body) : undefined 
    }),
    
  patch: <T>(endpoint: string, body?: any, options?: RequestInit) => 
    fetcher<T>(endpoint, { 
      ...options, 
      method: 'PATCH', 
      body: body ? JSON.stringify(body) : undefined 
    }),
    
  put: <T>(endpoint: string, body?: any, options?: RequestInit) => 
    fetcher<T>(endpoint, { 
      ...options, 
      method: 'PUT', 
      body: body ? JSON.stringify(body) : undefined 
    }),
    
  delete: <T>(endpoint: string, body?: any, options?: RequestInit) => 
    fetcher<T>(endpoint, { 
      ...options, 
      method: 'DELETE', 
      body: body ? JSON.stringify(body) : undefined 
    }),
};
