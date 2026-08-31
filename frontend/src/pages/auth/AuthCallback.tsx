import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { api } from '@/lib/api';
import { AuthResponse } from '@/lib/types';
import { getHomeUrl } from '@orviohub/shared';
import { useHost } from '@/host/useHost';
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
          // Set access & refresh tokens for initial hydration
          localStorage.setItem('orvio_auth_token', tokenParam);
          if (refreshTokenParam) {
            localStorage.setItem('orvio_refresh_token', refreshTokenParam);
          }

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
          await refreshSession();

          toast.success(`Welcome back, ${meResponse.user.name || 'there'}!`);

          // Route according to onboarding status
          if (meResponse.onboarding?.status === 'COMPLETED') {
            const homeBase = getHomeUrl(host.environment);
            try {
              const homeUrl = new URL(homeBase);
              if (tokenParam) homeUrl.searchParams.set('auth_token', tokenParam);
              if (refreshTokenParam) homeUrl.searchParams.set('refresh_token', refreshTokenParam);
              window.location.href = homeUrl.toString();
            } catch {
              window.location.href = homeBase;
            }
            return;
          } else {
            const step = meResponse.onboarding?.currentStep;
            if (step === 'ORGANIZATION_CREATION' || step === 'ACCOUNT_CREATED' || step === 'EMAIL_VERIFIED') {
              navigate('/onboarding', { replace: true });
            } else if (step === 'ORGANIZATION_CONFIGURED' || step === 'MODULE_SELECTION') {
              navigate('/onboarding/modules', { replace: true });
            } else if (step === 'WORKSPACE_INITIALIZATION') {
              navigate('/onboarding/workspace', { replace: true });
            } else if (step === 'WORKSPACE_READY' || step === 'TEAM_INVITATION') {
              navigate('/onboarding/team', { replace: true });
            } else {
              navigate('/onboarding', { replace: true });
            }
          }
        } catch (err: any) {
          const msg = err.message || 'Failed to complete social login session.';
          setErrorMessage(msg);
          toast.error(msg);
          setTimeout(() => navigate('/login', { replace: true }), 2500);
        }
        return;
      }

      // No token and no error
      navigate('/login', { replace: true });
    };

    processCallback();
  }, [searchParams, navigate, setAuthData, refreshSession, host.environment]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4 px-4">
      {errorMessage ? (
        <div className="text-center space-y-2">
          <p className="text-red-400 font-semibold">{errorMessage}</p>
          <p className="text-slate-400 text-sm">Redirecting you to login...</p>
        </div>
      ) : (
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 text-[#6C3BFF] animate-spin mx-auto" />
          <p className="text-slate-200 font-medium text-lg">Authenticating with orvioHub...</p>
          <p className="text-slate-500 text-sm">Securing your session and setting up workspace</p>
        </div>
      )}
    </div>
  );
};
