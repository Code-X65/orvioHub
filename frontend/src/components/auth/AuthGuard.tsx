import React, { useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/useAuthStore';
import { Loader2 } from 'lucide-react';
import { getLoginUrl, getAccountsUrl, isAllowedReturnTo } from '@orviohub/shared';
import { useHost } from '../../host/useHost';

interface AuthGuardProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  requireGuest?: boolean;
  requiredApp?: string;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({
  children,
  requireAuth = true,
  requireGuest = false,
}) => {
  const { isInitialized, isAuthenticated, user, onboardingStatus, refreshSession } = useAuthStore();
  const location = useLocation();
  const host = useHost();
  const initializingRef = useRef(false);

  useEffect(() => {
    if (!isInitialized && !initializingRef.current) {
      initializingRef.current = true;
      refreshSession();
    }
  }, [isInitialized, refreshSession]);

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-8 h-8 text-[#714b67] animate-spin" />
        <p className="text-slate-400 text-xs animate-pulse">Loading workspace session...</p>
      </div>
    );
  }

  // 1. Unauthenticated user trying to access a protected route
  if (requireAuth && !requireGuest && !isAuthenticated) {
    // If on a dedicated product subdomain (e.g. inventory, launcher, home), redirect to central accounts login with returnTo
    if (host.application !== 'accounts' && host.application !== 'marketing') {
      const returnUrl = typeof window !== 'undefined' ? window.location.href : '';
      const loginUrl = getLoginUrl(returnUrl, host.environment);
      window.location.href = loginUrl;
      return null;
    }

    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 2. Authenticated user trying to access guest route (like login/signup)
  if (requireGuest && isAuthenticated) {
    const urlParams = new URLSearchParams(location.search);
    const isExplicitLogout = urlParams.has('logged_out') || urlParams.has('logout');
    if (isExplicitLogout) {
      // User explicitly initiated a logout handoff -> purge local tokens on this subdomain
      useAuthStore.getState().logout();
      return <>{children}</>;
    }

    const returnTo = urlParams.get('returnTo');
    const token = localStorage.getItem('orvio_auth_token');
    const refreshToken = localStorage.getItem('orvio_refresh_token');

    if (returnTo && isAllowedReturnTo(returnTo, host.environment)) {
      try {
        const targetUrl = new URL(returnTo, window.location.origin);
        if (token) targetUrl.searchParams.set('auth_token', token);
        if (refreshToken) targetUrl.searchParams.set('refresh_token', refreshToken);
        window.location.href = targetUrl.toString();
        return null;
      } catch {
        window.location.href = returnTo;
        return null;
      }
    }

    if (host.application === 'accounts') {
      return <Navigate to="/profile" replace />;
    }

    return <Navigate to="/" replace />;
  }

  // 3. Authenticated user onboarding & boundary checks
  if (requireAuth && isAuthenticated) {
    // If email verification is strictly pending and user is not yet verified
    if (
      user?.emailVerified === false &&
      (location.pathname.startsWith('/onboarding') ||
        location.pathname.startsWith('/workspaces/new') ||
        location.pathname.startsWith('/organizations/new')) &&
      location.pathname !== '/verify-email'
    ) {
      if (host.application !== 'accounts') {
        window.location.href = `${getAccountsUrl(host.environment)}/verify-email`;
        return null;
      }
      return <Navigate to="/verify-email" replace />;
    }

    const isOnboardingRoute = location.pathname.startsWith('/onboarding');
    // If organization onboarding is already completed, redirect to home workspace
    if (onboardingStatus?.status === 'COMPLETED' && isOnboardingRoute) {
      if (host.application === 'accounts') {
        return <Navigate to="/profile" replace />;
      }
      const homeBase = getAccountsUrl(host.environment).replace('accounts', 'home');
      window.location.href = homeBase;
      return null;
    }

    // Step progression guard: Prevent skipping ahead without an organization
    const isAdvancedStep =
      location.pathname === '/onboarding/modules' ||
      location.pathname === '/onboarding/workspace' ||
      location.pathname === '/onboarding/team' ||
      location.pathname === '/onboarding/complete';

    if (isAdvancedStep && !onboardingStatus?.organization?.id) {
      return <Navigate to="/onboarding/organization" replace />;
    }
  }

  return <>{children}</>;
};
