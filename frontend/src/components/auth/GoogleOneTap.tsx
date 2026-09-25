import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { api } from '@/lib/api';
import { toast } from 'sonner';

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: any) => void;
          prompt: (callback?: (notification: any) => void) => void;
          cancel: () => void;
          renderButton: (parent: HTMLElement, options: any) => void;
        };
      };
    };
  }
}

export const GoogleOneTap: React.FC = () => {
  const { isAuthenticated, setAuthData } = useAuthStore();
  const navigate = useNavigate();
  const isInitializedRef = useRef(false);

  useEffect(() => {
    // Do not show Google One Tap if user is already authenticated
    if (isAuthenticated) {
      if (window.google?.accounts?.id?.cancel) {
        window.google.accounts.id.cancel();
      }
      return;
    }

    let isMounted = true;

    const setupGoogleOneTap = async () => {
      try {
        // 1. Resolve Google Client ID from environment or backend config
        let googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

        if (!googleClientId) {
          try {
            const configRes = await api.get<{ googleClientId?: string }>('/auth/config');
            googleClientId = configRes?.googleClientId || (configRes as any)?.data?.googleClientId;
          } catch {
            // Ignore config endpoint failure
          }
        }

        if (!googleClientId || !isMounted) {
          return;
        }

        // 2. Load Google Identity Services script if not already present
        const loadGsiScript = (): Promise<void> => {
          return new Promise((resolve) => {
            if (window.google?.accounts?.id) {
              resolve();
              return;
            }

            const existingScript = document.getElementById('google-gsi-client');
            if (existingScript) {
              existingScript.addEventListener('load', () => resolve());
              return;
            }

            const script = document.createElement('script');
            script.id = 'google-gsi-client';
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;
            script.onload = () => resolve();
            document.head.appendChild(script);
          });
        };

        await loadGsiScript();

        if (!isMounted || !window.google?.accounts?.id) return;

        // 3. Handle credential response from Google One Tap
        const handleCredentialResponse = async (response: { credential: string }) => {
          if (!response?.credential) return;

          try {
            const res = await api.post<any>('/auth/google/one-tap', {
              credential: response.credential,
            });

            const authPayload = res?.data || res;
            if (authPayload?.user) {
              setAuthData(authPayload);
              toast.success(`Welcome back, ${authPayload.user.name || 'there'}!`);

              // Route according to onboarding status
              if (authPayload.onboarding?.status === 'COMPLETED') {
                navigate('/inventory/dashboard', { replace: true });
              } else if (authPayload.user?.personalOnboardingCompleted === false) {
                navigate('/onboard/personal', { replace: true });
              } else {
                navigate('/onboard/organization', { replace: true });
              }
            }
          } catch (err: any) {
            console.error('[Google One Tap Login Error]:', err);
            toast.error(err.message || 'Google One Tap sign-in failed. Please try logging in with the standard button.');
          }
        };

        // 4. Initialize Google One Tap
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
          context: 'signin',
          itp_support: true,
        });

        isInitializedRef.current = true;

        // 5. Prompt Google One Tap at top right
        window.google.accounts.id.prompt((notification: any) => {
          if (notification?.isNotDisplayed?.()) {
            console.debug('[Google One Tap]: Prompt not displayed:', notification.getNotDisplayedReason?.());
          } else if (notification?.isSkippedMoment?.()) {
            console.debug('[Google One Tap]: Prompt skipped:', notification.getSkippedReason?.());
          } else if (notification?.isDismissedMoment?.()) {
            console.debug('[Google One Tap]: Prompt dismissed:', notification.getDismissedReason?.());
          }
        });
      } catch (err) {
        console.debug('[Google One Tap Setup Note]:', err);
      }
    };

    setupGoogleOneTap();

    return () => {
      isMounted = false;
      if (window.google?.accounts?.id?.cancel) {
        window.google.accounts.id.cancel();
      }
    };
  }, [isAuthenticated, navigate, setAuthData]);

  return null;
};
export default GoogleOneTap;
