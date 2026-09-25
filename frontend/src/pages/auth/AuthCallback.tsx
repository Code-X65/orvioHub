import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { api, setMemoryAuthToken } from '@/lib/api';
import { AuthResponse } from '@/lib/types';
import { useHost } from '@/host/useHost';
import { isAllowedReturnTo } from '@orviohub/shared';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const ERROR_MESSAGES: Record<string, string> = {
  OAUTH_NOT_CONFIGURED: 'Social sign-in is temporarily unavailable. Please try another sign-in method.',
  OAUTH_STATE_INVALID: 'Security validation failed. Please try logging in again.',
  OAUTH_STATE_EXPIRED: 'Your login session expired. Please try again.',
  OAUTH_ACCESS_DENIED: 'Sign-in was cancelled or access was denied.',
  OAUTH_CODE_INVALID: 'Invalid authentication code received from provider.',
  OAUTH_PROVIDER_ERROR: 'Unable to communicate with the social provider. Please try again.',
  OAUTH_IDENTITY_INVALID: 'Could not retrieve verified profile from social provider.',
  OAUTH_EMAIL_UNVERIFIED: 'Your social account email is not verified. Please sign up with email and password.',
  OAUTH_ACCOUNT_CONFLICT: 'An account with this email exists but could not be safely linked.',
};

export const AuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const host = useHost();
  const { setAuthData, refreshSession } = useAuthStore();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const returnToParam = searchParams.get('returnTo') || searchParams.get('return_to') || searchParams.get('redirect');
  const validReturnTo = returnToParam && isAllowedReturnTo(returnToParam, host.environment) ? returnToParam : null;

  useEffect(() => {
    const processCallback = async () => {
      const errorParam = searchParams.get('error');
      const tokenParam = searchParams.get('token');
      const refreshTokenParam = searchParams.get('refreshToken');

      if (errorParam) {
        const friendlyMessage = ERROR_MESSAGES[errorParam] || 'Social authentication failed. Please try again.';
        setErrorMessage(friendlyMessage);
        toast.error(friendlyMessage);
        setTimeout(() => navigate('/login', { replace: true }), 2500);
        return;
      }

      if (tokenParam) {
        try {
          // Set access token in memory for immediate API hydration
          setMemoryAuthToken(tokenParam);

          // Hydrate user session from /me
          const meResponse = await api.get<{
            user: any;
            onboarding: any;
            memberships?: any[];
          }>('/auth/me');

          const authResponse: AuthResponse = {
            user: meResponse.user,
            token: tokenParam,
            refreshToken: refreshTokenParam || undefined,
            onboarding: meResponse.onboarding,
            memberships: meResponse.memberships,
          };

          setAuthData(authResponse);

          toast.success(`Welcome back, ${meResponse.user.name || 'there'}!`);

          // Route to returnTo if present and onboarding is completed
          if (validReturnTo) {
            window.location.replace(validReturnTo);
            return;
          }

          // Route directly and smoothly based on user state
          if (meResponse.onboarding?.status === 'COMPLETED') {
            navigate('/inventory/dashboard', { replace: true });
            return;
          } else if (meResponse.user?.personalOnboardingCompleted === false) {
            navigate('/onboard/personal', { replace: true });
            return;
          } else {
            navigate('/onboard/organization', { replace: true });
            return;
          }
        } catch (err: any) {
          const msg = err.message || 'Failed to complete social login session.';
          setErrorMessage(msg);
          toast.error(msg);
          setTimeout(() => navigate('/login', { replace: true }), 2500);
          return;
        }
      }

      // Cookie-first flow: No token in URL, hydrate via session check
      try {
        await refreshSession();
        const currentAuth = useAuthStore.getState();
        if (currentAuth.isAuthenticated && currentAuth.user) {
          toast.success(`Welcome back, ${currentAuth.user.name || 'there'}!`);
          if (currentAuth.isEmailVerified === false || currentAuth.accessLevel === 'verification_required') {
            navigate('/verify-email', { replace: true });
            return;
          }
          if (validReturnTo) {
            window.location.replace(validReturnTo);
            return;
          }
          if (currentAuth.onboardingStatus?.status === 'COMPLETED') {
            navigate('/inventory/dashboard', { replace: true });
            return;
          }
          if (currentAuth.user?.personalOnboardingCompleted === false) {
            navigate('/onboard/personal', { replace: true });
            return;
          }
          navigate('/onboard/organization', { replace: true });
          return;
        }
      } catch {
        // Fall through to login
      }

      // If still not authenticated, redirect to login
      navigate('/login', { replace: true });
    };

    processCallback();
  }, [searchParams, navigate, setAuthData, refreshSession, host.environment, validReturnTo]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4 px-4">
      {errorMessage ? (
        <div className="text-center space-y-2">
          <p className="text-red-400 font-semibold">{errorMessage}</p>
          <p className="text-slate-400 text-sm">Redirecting you to login...</p>
        </div>
      ) : (
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 text-[#714b67] animate-spin mx-auto" />
          <p className="text-slate-200 font-medium text-lg">Authenticating with orvioHub...</p>
          <p className="text-slate-500 text-sm">Securing your session and setting up workspace</p>
        </div>
      )}

      <div className="pt-2">
        <a
          href={validReturnTo || '/login'}
          className="text-xs text-[#c79dbd] hover:underline"
        >
          {validReturnTo ? '← Back to where you were' : '← Back to Sign in'}
        </a>
      </div>
    </div>
  );
};
