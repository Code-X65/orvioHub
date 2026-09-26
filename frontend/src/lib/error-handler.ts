import { toast } from 'sonner';
import { ApiError } from './api';
import { logError } from './observability';

export interface HandleErrorOptions {
  showError?: boolean;
  silentStatus?: number[];
  customMessage?: string;
  metadata?: Record<string, unknown>;
}

export function isAbortError(error: unknown): boolean {
  if (!error) return false;
  const err = error as any;
  return err.name === 'AbortError' || err.code === 'ABORT_ERR' || err.message?.includes('aborted');
}

export function handleApiError(
  error: unknown,
  context: string,
  options: HandleErrorOptions = {}
): void {
  // Always ignore AbortController cancellations
  if (isAbortError(error)) {
    return;
  }

  const {
    showError = true,
    silentStatus = [401], // 401 is handled by auth flow
    customMessage,
    metadata = {},
  } = options;

  const apiError = error instanceof ApiError ? error : (error as any);
  const status = apiError?.status;
  const message =
    customMessage ||
    apiError?.message ||
    `Failed to ${context.toLowerCase()}`;

  // Log error to console & observability
  console.error(`[API Error] ${context}:`, error);
  logError(error, {
    context,
    status,
    code: apiError?.code,
    ...metadata,
  });

  // Surface toast to user unless status is suppressed
  const shouldSuppressToast = status && silentStatus.includes(status);
  if (showError && !shouldSuppressToast) {
    toast.error(message);
  }
}

export interface SafeFetchOptions<T> extends HandleErrorOptions {
  context: string;
  fallback?: T;
}

export async function safeFetch<T>(
  promise: Promise<T>,
  options: SafeFetchOptions<T>
): Promise<T | undefined> {
  try {
    return await promise;
  } catch (error) {
    if (isAbortError(error)) {
      return options.fallback;
    }

    handleApiError(error, options.context, options);
    return options.fallback;
  }
}
