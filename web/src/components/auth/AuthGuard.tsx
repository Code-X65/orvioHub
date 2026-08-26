import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/useAuthStore';
import { Loader2 } from 'lucide-react';
import { getLoginUrl, resolveHostContext } from '../../lib/domain';

const ONBOARDING_ROUTES: Record<string, string> = {
  ACCOUNT_CREATED: '/onboarding/organization',
  EMAIL_VERIFICATION: '/verify-email',
  ORGANIZATION_CREATION: '/onboarding/organization',
  ORGANIZATION_CONFIGURED: '/onboarding/modules',
  MODULE_SELECTION: '/onboarding/modules',
  WORKSPACE_INITIALIZATION: '/onboarding/workspace',
  WORKSPACE_READY: '/onboarding/team',
  TEAM_INVITATION: '/onboarding/team',
  COMPLETED: '/app',
};

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
  const { isInitialized, isAuthenticated, onboardingStatus, refreshSession } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    if (!isInitialized) {
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
    const currentHostCtx = resolveHostContext();
    // If on a dedicated product subdomain (e.g. inventory.orviohub.localhost:5173), redirect to central accounts login with returnTo
    if (currentHostCtx.application !== 'accounts' && currentHostCtx.application !== 'marketing') {
      const returnUrl = typeof window !== 'undefined' ? window.location.href : '';
      const loginUrl = getLoginUrl(returnUrl);
      window.location.href = loginUrl;
      return null;
    }

    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 2. Authenticated user trying to access guest route (like login/signup)
  if (requireGuest && isAuthenticated) {
    if (onboardingStatus?.status === 'COMPLETED') {
      return <Navigate to="/app" replace />;
    } else if (onboardingStatus) {
      const targetRoute = ONBOARDING_ROUTES[onboardingStatus.currentStep] || '/welcome';
      return <Navigate to={targetRoute} replace />;
    }
    return <Navigate to="/app" replace />;
  }

  // 3. Authenticated user onboarding boundary checks
  if (requireAuth && isAuthenticated && onboardingStatus) {
    const isAppRoute = location.pathname.startsWith('/app') || location.pathname.startsWith('/inventory');
    const isOnboardingRoute =
      location.pathname.startsWith('/onboarding') || location.pathname === '/verify-email';

    if (onboardingStatus.status === 'COMPLETED' && isOnboardingRoute) {
      return <Navigate to="/app" replace />;
    }

    if (onboardingStatus.status !== 'COMPLETED' && isAppRoute) {
      const targetRoute = ONBOARDING_ROUTES[onboardingStatus.currentStep] || '/welcome';
      return <Navigate to={targetRoute} replace />;
    }
  }

  return <>{children}</>;
};
