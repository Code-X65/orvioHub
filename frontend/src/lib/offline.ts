import { useEffect, useState, useSyncExternalStore } from 'react';

/**
 * Orviohub Offline Network State & Detection Engine
 */

let onlineState = typeof navigator !== 'undefined' ? navigator.onLine : true;
const listeners = new Set<(online: boolean) => void>();

function notify() {
  for (const listener of listeners) {
    try {
      listener(onlineState);
    } catch {}
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    onlineState = true;
    notify();
  });

  window.addEventListener('offline', () => {
    onlineState = false;
    notify();
  });
}

export function isOnline(): boolean {
  return typeof window !== 'undefined' && typeof navigator !== 'undefined' ? navigator.onLine : true;
}

export function subscribeOnlineStatus(callback: (online: boolean) => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribeOnlineStatus,
    () => isOnline(),
    () => true
  );
}
