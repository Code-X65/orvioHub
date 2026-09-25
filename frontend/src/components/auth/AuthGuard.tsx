import React, { useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore, bootstrapAuth } from '../../stores/useAuthStore';
import { getLoginUrl, getHomeUrl, isAllowedReturnTo } from '@orviohub/shared';
import { useHost } from '../../host/useHost';
import { crossSubdomainNavigate } from '@/lib/crossSubdomainNavigate';

interface AuthGuardProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  requireGuest?: boolean;
  requiredApp?: string;
}

const RedirectTransition: React.FC<{ targetUrl: string; label?: string }> = ({ targetUrl, label }) => {
  const [showTimeoutFallback, setShowTimeoutFallback] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setShowTimeoutFallback(true);
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-black text-slate-100 flex flex-col items-center justify-center p-6 space-y-4">
      <div className="w-7 h-7 border-2 border-[#714b67] border-t-transparent rounded-full animate-spin" />
      <p className="text-xs text-slate-400 animate-pulse">{label || 'Redirecting...'}</p>
      {showTimeoutFallback && (
        <div className="flex flex-col items-center space-y-2 pt-2 animate-in fade-in duration-300">
          <p className="text-xs text-slate-500">Taking longer than expected?</p>
          <a
            href={targetUrl}
            className="px-3 py-1.5 bg-[#714b67] hover:bg-[#835677] text-white text-xs rounded transition-colors"
          >
            Click here to proceed
          </a>
        </div>
      )}
    </div>
  );
};

export const AuthGuard: React.FC<AuthGuardProps> = ({
  children,
  requireAuth = true,
  requireGuest = false,
}) => {
  const { isInitialized, isAuthenticated, user, onboardingStatus } = useAuthStore();
  const location = useLocation();
  const host = useHost();
  const initializingRef = useRef(false);

  useEffect(() => {
    if (!isInitialized && !initializingRef.current) {
      initializingRef.current = true;
      bootstrapAuth();
    }
  }, [isInitialized]);

  // If route is guest-only and there are no stored user credentials, render immediately to avoid layout flash
  const hasPossibleCredentials = typeof window !== 'undefined' && Boolean(
    localStorage.getItem('orvio_user')
  );

  if (!isInitialized) {
    if (requireGuest && !hasPossibleCredentials) {
      return <>{children}</>;
    }

    return (
      <div className="min-h-screen bg-black text-slate-100 flex flex-col items-center justify-center">
        <div className="w-7 h-7 border-2 border-[#714b67] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // 1. Unauthenticated user trying to access a protected route
  if (requireAuth && !requireGuest && !isAuthenticated) {
    // If on a dedicated product subdomain (e.g. inventory, launcher, home), redirect to central accounts login with redirect
    if (host.application !== 'accounts' && host.application !== 'marketing') {
      const returnUrl = typeof window !== 'undefined' ? window.location.href : '';
      const loginUrl = getLoginUrl(returnUrl, host.environment);
      crossSubdomainNavigate(loginUrl);
      return null;
    }

    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 2. Authenticated user trying to access guest route (like login/signup)
  if (requireGuest && isAuthenticated) {
    const isPendingVerification =
      user?.emailVerified === false ||
      user?.status === 'pending_email_verification';

    if (isPendingVerification) {
      return <Navigate to="/verify-email" replace />;
    }

    const urlParams = new URLSearchParams(location.search);
    const isExplicitLogout = urlParams.has('logged_out') || urlParams.has('logout');
    if (isExplicitLogout) {
      // User explicitly initiated a logout handoff -> purge local tokens on this subdomain
      useAuthStore.getState().logout();
      return <>{children}</>;
    }

    const returnTo = urlParams.get('redirect') || urlParams.get('returnTo') || urlParams.get('return_to');

    if (returnTo && isAllowedReturnTo(returnTo, host.environment)) {
      window.location.replace(returnTo);
      return <RedirectTransition targetUrl={returnTo} label="Taking you to your destination..." />;
    }

    if (host.application === 'accounts') {
      if (user?.personalOnboardingCompleted === false) {
        return <Navigate to="/onboard/personal" replace />;
      }
      const homeUrl = getHomeUrl(host.environment);
      window.location.replace(homeUrl);
      return <RedirectTransition targetUrl={homeUrl} label="Opening your workspace..." />;
    }

    return <Navigate to="/" replace />;
  }

  // 3. Authenticated user onboarding & boundary checks
  if (requireAuth && isAuthenticated) {
    const isPendingVerification =
      user?.emailVerified === false ||
      user?.status === 'pending_email_verification';

    // Strictly guard all application routes if email verification is pending
    if (isPendingVerification) {
      const isAllowedPending =
        location.pathname === '/verify-email' ||
        location.pathname.startsWith('/verify-email') ||
        location.pathname === '/logout';

      if (!isAllowedPending) {
        if (host.application !== 'accounts') {
          const returnUrl = typeof window !== 'undefined' ? window.location.href : '';
          const verifyUrl = `${getLoginUrl(returnUrl, host.environment).replace(/\/login(\?|$)/, '/verify-email$1')}`;
          crossSubdomainNavigate(verifyUrl);
          return null;
        }
        return <Navigate to="/verify-email" replace />;
      }
    }

    // Personal Onboarding Guard:
    // If user has verified their email but has not completed personal onboarding,
    // ensure they complete /onboard/personal before accessing dashboard or org wizard.
    const isPersonalOnboardingRoute =
      location.pathname === '/onboard/personal' ||
      location.pathname === '/onboarding/personal';
    const isInviteRoute =
      location.pathname.startsWith('/invite') ||
      location.pathname.startsWith('/invitations');
    const isAuthUtilityRoute =
      location.pathname === '/verify-email' ||
      location.pathname === '/logout';

    if (
      user?.emailVerified &&
      user?.personalOnboardingCompleted === false &&
      !isPersonalOnboardingRoute &&
      !isInviteRoute &&
      !isAuthUtilityRoute
    ) {
      if (host.application === 'home' || host.application === 'launcher' || host.application === 'accounts') {
        return <Navigate to="/onboard/personal" replace />;
      }
      crossSubdomainNavigate(`${getHomeUrl(host.environment)}/onboard/personal`);
      return null;
    }

    // If user has already completed personal onboarding, prevent access to /onboard/personal
    if (
      user?.personalOnboardingCompleted === true &&
      isPersonalOnboardingRoute
    ) {
      return <Navigate to="/" replace />;
    }

    const isPlatformOnboardingSurface = host.application === 'launcher' || host.application === 'accounts';
    const isOnboardingRoute = isPlatformOnboardingSurface && location.pathname.startsWith('/onboarding');

    // If platform onboarding is already completed, prevent getting stuck in onboarding on platform surfaces
    if (onboardingStatus?.status === 'COMPLETED' && isOnboardingRoute) {
      return <Navigate to="/inventory/dashboard" replace />;
    }

    // Step progression guard: Prevent skipping ahead without an organization on platform surfaces
    const isAdvancedStep =
      isPlatformOnboardingSurface &&
      (location.pathname === '/onboarding/modules' ||
        location.pathname === '/onboarding/workspace' ||
        location.pathname === '/onboarding/team' ||
        location.pathname === '/onboarding/complete');

    if (isAdvancedStep && !onboardingStatus?.organization?.id) {
      return <Navigate to="/onboarding/organization" replace />;
    }
  }

  return <>{children}</>;
};
