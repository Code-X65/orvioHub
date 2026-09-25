import { useSyncExternalStore } from 'react';

/**
 * Orviohub Offline Mutation Queue & Replay Engine
 * Captures user mutations while disconnected and synchronizes them seamlessly
 * in FIFO order upon network recovery.
 */

export interface QueuedMutation {
  id: string;
  endpoint: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
  idempotencyKey: string;
  timestamp: number;
  retries: number;
  description?: string;
}

const STORAGE_KEY = 'orvio_offline_mutation_queue';
const listeners = new Set<() => void>();
let inMemoryQueueFallback: QueuedMutation[] = [];

function notify() {
  for (const listener of listeners) {
    try {
      listener();
    } catch {}
  }
}

function getStoredQueue(): QueuedMutation[] {
  if (typeof localStorage === 'undefined') return inMemoryQueueFallback;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : inMemoryQueueFallback;
  } catch {
    return inMemoryQueueFallback;
  }
}

function saveStoredQueue(queue: QueuedMutation[]): void {
  inMemoryQueueFallback = queue.slice(-100);
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(inMemoryQueueFallback));
    } catch {}
  }
  notify();
}

class OfflineMutationQueue {
  private isFlushing = false;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.flush();
      });
    }
  }

  public getQueue(): QueuedMutation[] {
    return getStoredQueue();
  }

  public getCount(): number {
    return getStoredQueue().length;
  }

  public enqueue(
    endpoint: string,
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    body?: any,
    headers?: Record<string, string>,
    idempotencyKey?: string,
    description?: string
  ): QueuedMutation {
    const key =
      idempotencyKey ||
      (typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `offline_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`);

    const mutation: QueuedMutation = {
      id: `mut_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      endpoint,
      method,
      body,
      headers,
      idempotencyKey: key,
      timestamp: Date.now(),
      retries: 0,
      description,
    };

    const queue = getStoredQueue();
    queue.push(mutation);
    saveStoredQueue(queue);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('offline:mutation-queued', {
          detail: { mutation, pendingCount: queue.length },
        })
      );
    }

    return mutation;
  }

  public remove(id: string): void {
    const queue = getStoredQueue().filter((item) => item.id !== id);
    saveStoredQueue(queue);
  }

  public clear(): void {
    inMemoryQueueFallback = [];
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
    notify();
  }

  public async flush(
    customExecutor?: (item: QueuedMutation) => Promise<{ success: boolean; status?: number }>
  ): Promise<{ processed: number; succeeded: number; failed: number }> {
    const isBrowserOffline = typeof window !== 'undefined' && typeof navigator !== 'undefined' && navigator.onLine === false;
    if (this.isFlushing || isBrowserOffline) {
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    const queue = getStoredQueue();
    if (queue.length === 0) return { processed: 0, succeeded: 0, failed: 0 };

    this.isFlushing = true;
    let succeeded = 0;
    let failed = 0;

    const remaining: QueuedMutation[] = [];

    try {
      for (const item of queue) {
        try {
          if (customExecutor) {
            const res = await customExecutor(item);
            if (res.success || (res.status && res.status >= 400 && res.status < 500)) {
              succeeded++;
            } else {
              item.retries++;
              remaining.push(item);
              failed++;
            }
          } else {
            // Default HTTP dispatch via fetch
            const apiOrigin = (import.meta.env?.VITE_API_URL as string) || '';
            const cleanPath = item.endpoint.startsWith('/api')
              ? item.endpoint
              : `/api/v1${item.endpoint.startsWith('/') ? item.endpoint : `/${item.endpoint}`}`;

            const res = await fetch(`${apiOrigin}${cleanPath}`, {
              method: item.method,
              headers: {
                'Content-Type': 'application/json',
                'Idempotency-Key': item.idempotencyKey,
                ...item.headers,
              },
              body: item.body ? (typeof item.body === 'string' ? item.body : JSON.stringify(item.body)) : undefined,
              credentials: 'include',
            });

            // If success (2xx) or permanent client rejection (4xx), resolve and remove
            if (res.ok || (res.status >= 400 && res.status < 500)) {
              succeeded++;
            } else {
              item.retries++;
              remaining.push(item);
              failed++;
            }
          }
        } catch {
          item.retries++;
          remaining.push(item);
          failed++;
        }
      }

      saveStoredQueue(remaining);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('offline:flushed', {
            detail: { succeeded, failed, remaining: remaining.length },
          })
        );
      }
    } finally {
      this.isFlushing = false;
    }

    return { processed: queue.length, succeeded, failed };
  }
}

export const offlineQueue = new OfflineMutationQueue();

export function subscribeOfflineQueue(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function useOfflineQueueCount(): number {
  return useSyncExternalStore(
    subscribeOfflineQueue,
    () => offlineQueue.getCount(),
    () => 0
  );
}
