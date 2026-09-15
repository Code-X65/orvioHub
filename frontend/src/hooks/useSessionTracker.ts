import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { getCurrentSubdomain } from '@/lib/domain';
import { api } from '@/lib/api';

const EXCLUDED_PATHS = new Set([
  '/login',
  '/signup',
  '/verify-email',
  '/forgot-password',
  '/reset-password',
  '/auth/callback',
]);

/**
 * Automatically tracks and saves the active user's last visited URL and subdomain
 * for session continuity across browsers, tabs, and re-logins.
 */
export function useSessionTracker() {
  const location = useLocation();
  const { isAuthenticated } = useAuthStore();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRecordedUrlRef = useRef<string>('');

  useEffect(() => {
    if (!isAuthenticated) return;

    const path = location.pathname;
    if (EXCLUDED_PATHS.has(path)) return;

    const subdomain = getCurrentSubdomain();
    const fullTargetUrl = `${location.pathname}${location.search}`;

    if (lastRecordedUrlRef.current === fullTargetUrl) return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      lastRecordedUrlRef.current = fullTargetUrl;
      api.post('/auth/session/context', {
        lastVisitedUrl: fullTargetUrl,
        lastVisitedSubdomain: subdomain,
      }).catch(() => {
        // Silently ignore context recording failures
      });
    }, 1200);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [location.pathname, location.search, isAuthenticated]);
}
