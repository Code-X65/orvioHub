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
  '/onboard/personal',
  '/onboard/organization',
]);

/**
 * Automatically tracks and saves the active user's last visited URL and subdomain
 * for session continuity across browsers, tabs, and re-logins.
 */
export function useSessionTracker() {
  const location = useLocation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRecordedUrlRef = useRef<string>('');

  const syncContext = (targetUrl: string, targetSubdomain: string) => {
    if (lastRecordedUrlRef.current === targetUrl) return;
    lastRecordedUrlRef.current = targetUrl;

    api.post('/auth/session/context', {
      lastVisitedUrl: targetUrl,
      lastVisitedSubdomain: targetSubdomain,
    }).catch(() => {
      // Silently ignore context recording failures
    });
  };

  useEffect(() => {
    if (!isAuthenticated) return;

    const path = location.pathname;
    if (
      EXCLUDED_PATHS.has(path) ||
      path.startsWith('/verify-email') ||
      path.startsWith('/auth/') ||
      path.startsWith('/onboard') ||
      path.startsWith('/onboarding')
    ) {
      return;
    }

    const subdomain = getCurrentSubdomain();
    const fullTargetUrl = `${location.pathname}${location.search}`;

    if (lastRecordedUrlRef.current === fullTargetUrl) return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Debounce for 5 seconds to ensure route navigation settles before making the API call
    timerRef.current = setTimeout(() => {
      syncContext(fullTargetUrl, subdomain);
    }, 5000);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [location.pathname, location.search, isAuthenticated]);

  // Sync context when the browser tab becomes visible again if URL changed
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;

      const path = location.pathname;
      if (
        EXCLUDED_PATHS.has(path) ||
        path.startsWith('/verify-email') ||
        path.startsWith('/auth/') ||
        path.startsWith('/onboard') ||
        path.startsWith('/onboarding')
      ) {
        return;
      }

      const fullTargetUrl = `${location.pathname}${location.search}`;
      if (lastRecordedUrlRef.current !== fullTargetUrl) {
        const subdomain = getCurrentSubdomain();
        syncContext(fullTargetUrl, subdomain);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [location.pathname, location.search, isAuthenticated]);
}
