import { useCallback } from 'react';
import { handleApiError, HandleErrorOptions } from '@/lib/error-handler';

export function useApiError() {
  const handleError = useCallback(
    (error: unknown, context: string, options?: HandleErrorOptions) => {
      handleApiError(error, context, options);
    },
    []
  );

  return handleError;
}
