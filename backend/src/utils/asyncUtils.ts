/**
 * Utility for executing fire-and-forget background promises with structured error logging.
 * Prevents unhandled promise rejections and silent error swallowing while allowing non-blocking
 * asynchronous execution of auxiliary tasks like audit logging, webhooks, and notifications.
 */
export function fireAndForget<T>(
  promise: Promise<T>,
  context: string
): void {
  promise.catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[Background Task] ${context} failed:`, message);
  });
}
