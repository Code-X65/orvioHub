import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/useAuthStore';

const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const WARNING_MS = 5 * 60 * 1000;

/** Keeps the client UX aligned with the server's idle-session policy. */
export function useAuthSessionLifecycle() {
  const { isAuthenticated, refreshSession } = useAuthStore();
  const lastActivity = useRef(Date.now());
  const warned = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    const recordActivity = () => {
      lastActivity.current = Date.now();
      warned.current = false;
    };
    const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((event) => window.addEventListener(event, recordActivity, { passive: true }));
    const timer = window.setInterval(() => {
      const idleFor = Date.now() - lastActivity.current;
      if (!warned.current && idleFor >= IDLE_TIMEOUT_MS - WARNING_MS) {
        warned.current = true;
        toast.warning('Your session will expire soon due to inactivity.');
      }
    }, 15_000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        recordActivity();
        void refreshSession();
      }
    };
    window.addEventListener('focus', onVisibility);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      events.forEach((event) => window.removeEventListener(event, recordActivity));
      window.clearInterval(timer);
      window.removeEventListener('focus', onVisibility);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [isAuthenticated, refreshSession]);
}
