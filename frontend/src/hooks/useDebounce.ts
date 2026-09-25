import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook to debounce any value.
 * @param value The value to debounce.
 * @param delayMs Delay in milliseconds (default 300ms).
 */
export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delayMs]);

  return debouncedValue;
}

/**
 * Custom hook to produce a debounced version of a callback function.
 * Automatically handles cleanup on component unmount and provides .cancel() and .flush().
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delayMs = 300
): ((...args: Parameters<T>) => void) & { cancel: () => void; flush: () => void } {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const argsRef = useRef<Parameters<T> | null>(null);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    argsRef.current = null;
  }, []);

  const flush = useCallback(() => {
    if (timeoutRef.current && argsRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      callbackRef.current(...argsRef.current);
      argsRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const debounced = useCallback(
    (...args: Parameters<T>) => {
      argsRef.current = args;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        if (argsRef.current) {
          callbackRef.current(...argsRef.current);
          argsRef.current = null;
        }
      }, delayMs);
    },
    [delayMs]
  );

  return Object.assign(debounced, { cancel, flush });
}
