import { useEffect, useRef, useCallback } from 'react';
import { api, type ApiRequestOptions } from '@/lib/api';

/**
 * Hook providing an abortable api.get wrapper.
 * Automatically cancels any in-flight request when a new request begins or when the component unmounts.
 */
export function useAbortableFetch() {
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  const fetch = useCallback(
    async <T>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> => {
      // Cancel previous in-flight request if still running
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;

      return api.get<T>(endpoint, {
        ...options,
        signal: options.signal || controller.signal,
      });
    },
    []
  );

  return fetch;
}

/**
 * Hook providing managed AbortSignals for multi-step or custom async procedures.
 * Automatically cleans up and aborts active signals when the component unmounts.
 */
export function useAbortController() {
  const controllerRef = useRef<AbortController | null>(null);

  const getSignal = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = new AbortController();
    return controllerRef.current.signal;
  }, []);

  const abort = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  return { getSignal, abort, controllerRef };
}
