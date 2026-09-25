import { useState, useEffect, useCallback, useRef } from "react";
import { api, ApiError, getApiErrorMessage, type ApiRequestOptions } from "@/lib/api";

export interface UseApiQueryOptions<T> extends ApiRequestOptions {
  enabled?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: ApiError) => void;
}

export function useApiQuery<T>(
  endpoint: string | null,
  options: UseApiQueryOptions<T> = {}
) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(options.enabled !== false && Boolean(endpoint));
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const execute = useCallback(async () => {
    if (!endpoint || optionsRef.current.enabled === false) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setErrorMessage(null);

    try {
      const result = await api.get<T>(endpoint, {
        ...optionsRef.current,
        onRevalidate: (freshData: T) => {
          setData(freshData);
          setIsValidating(false);
          optionsRef.current.onSuccess?.(freshData);
        },
      });
      setData(result);
      optionsRef.current.onSuccess?.(result);
    } catch (err: any) {
      const apiErr = err instanceof ApiError ? err : new ApiError(err?.message || "Query failed");
      setError(apiErr);
      const msg = getApiErrorMessage(apiErr);
      setErrorMessage(msg);
      optionsRef.current.onError?.(apiErr);
    } finally {
      setIsLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    if (options.enabled !== false && endpoint) {
      execute();
    }
  }, [endpoint, options.enabled, execute]);

  return {
    data,
    isLoading,
    isValidating,
    error,
    errorMessage,
    refetch: execute,
  };
}

export interface UseApiMutationOptions<TData, TVariables> {
  onSuccess?: (data: TData, variables: TVariables) => void;
  onError?: (error: ApiError, variables: TVariables) => void;
  onSettled?: (data: TData | null, error: ApiError | null, variables: TVariables) => void;
  invalidateTags?: string[];
  invalidatePaths?: string[];
  optimisticUpdate?: (variables: TVariables) => void;
}

export function useApiMutation<TData, TVariables = void>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: UseApiMutationOptions<TData, TVariables> = {}
) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [data, setData] = useState<TData | null>(null);

  const mutate = useCallback(
    async (variables: TVariables): Promise<TData> => {
      setIsLoading(true);
      setError(null);

      if (options.optimisticUpdate) {
        try {
          options.optimisticUpdate(variables);
        } catch {}
      }

      try {
        const result = await mutationFn(variables);
        setData(result);

        if (options.invalidateTags && options.invalidateTags.length > 0) {
          api.invalidateByTag(options.invalidateTags);
        }
        if (options.invalidatePaths && options.invalidatePaths.length > 0) {
          api.invalidateByPath(options.invalidatePaths);
        }

        options.onSuccess?.(result, variables);
        options.onSettled?.(result, null, variables);
        return result;
      } catch (err: any) {
        const apiErr = err instanceof ApiError ? err : new ApiError(err?.message || "Mutation failed");
        setError(apiErr);
        options.onError?.(apiErr, variables);
        options.onSettled?.(null, apiErr, variables);
        throw apiErr;
      } finally {
        setIsLoading(false);
      }
    },
    [mutationFn, options]
  );

  return {
    mutate,
    isLoading,
    error,
    errorMessage: error ? getApiErrorMessage(error) : null,
    data,
    reset: () => {
      setError(null);
      setData(null);
      setIsLoading(false);
    },
  };
}
