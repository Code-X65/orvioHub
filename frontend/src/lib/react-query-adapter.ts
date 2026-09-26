import {
  QueryClient,
  useQuery,
  useMutation,
  type UseQueryOptions,
  type UseMutationOptions,
} from '@tanstack/react-query';
import { api, registerQueryInvalidator, type ApiError } from '@/lib/api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      retry: (failureCount, error: any) => {
        // Do not retry 4xx errors
        if (error?.status >= 400 && error?.status < 500) return false;
        return failureCount < 3;
      },
    },
  },
});

/**
 * Creates a normalized React Query key tuple for API endpoints and params.
 */
export function createQueryKey(endpoint: string, params?: Record<string, any>) {
  if (params && Object.keys(params).length > 0) {
    return [endpoint, params] as const;
  }
  return [endpoint] as const;
}

/**
 * Invalidates React Query caches by key or string endpoint prefix.
 */
export async function invalidateApiQueries(keyOrPrefix?: string | readonly unknown[]) {
  if (!keyOrPrefix) {
    await queryClient.invalidateQueries();
    return;
  }
  if (typeof keyOrPrefix === 'string') {
    await queryClient.invalidateQueries({
      predicate: (query) => {
        const [endpoint] = query.queryKey;
        return typeof endpoint === 'string' && endpoint.startsWith(keyOrPrefix);
      },
    });
    return;
  }
  await queryClient.invalidateQueries({ queryKey: keyOrPrefix });
}

/**
 * React Query wrapper that bridges custom fetcher to React Query.
 */
export function useApiQuery<TData = unknown, TError = ApiError>(
  endpoint: string,
  params?: Record<string, any>,
  options?: Omit<UseQueryOptions<TData, TError, TData, any>, 'queryKey' | 'queryFn'>
) {
  const queryKey = createQueryKey(endpoint, params);
  return useQuery<TData, TError>({
    queryKey,
    queryFn: async ({ signal }) => {
      let queryStr = '';
      if (params) {
        const cleanParams = Object.entries(params).filter(
          ([_, v]) => v !== undefined && v !== null && v !== ''
        );
        if (cleanParams.length > 0) {
          const search = new URLSearchParams();
          cleanParams.forEach(([k, v]) => search.append(k, String(v)));
          queryStr = `?${search.toString()}`;
        }
      }
      return api.get<TData>(`${endpoint}${queryStr}`, { signal });
    },
    ...options,
  });
}

/**
 * React Query mutation wrapper with optional automatic query cache invalidation.
 */
export function useApiMutation<TData = unknown, TVariables = void, TError = ApiError>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: UseMutationOptions<TData, TError, TVariables> & {
    invalidateKeys?: Array<string | readonly unknown[]>;
  }
) {
  const { invalidateKeys, ...mutationOptions } = options || {};
  return useMutation<TData, TError, TVariables>({
    mutationFn,
    ...mutationOptions,
    onSuccess: async (...args) => {
      if (invalidateKeys && invalidateKeys.length > 0) {
        await Promise.all(invalidateKeys.map((key) => invalidateApiQueries(key)));
      }
      (mutationOptions as any)?.onSuccess?.(...args);
    },
  });
}

// Synchronize legacy API cache invalidations with React Query
registerQueryInvalidator((pattern) => {
  if (typeof pattern === 'string') {
    invalidateApiQueries(pattern);
  } else {
    invalidateApiQueries();
  }
});
