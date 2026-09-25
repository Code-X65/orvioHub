import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, API_BASE_URL } from '@/lib/api';
import { useAuthStore } from '@/stores/useAuthStore';
import { useHost } from '@/host/useHost';
import { isValidReturnUrl, getHomeUrl, getCrossSubdomainUrl, type ApplicationKey } from '@/lib/domain';
import { areCookiesEnabled } from '@/lib/cookieStorage';
import { AuthLayout } from './AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Fingerprint,
  Info,
  AlertTriangle,
  HelpCircle,
} from 'lucide-react';
import { isWebAuthnAvailable, startPasskeyLogin } from '@/lib/webauthn';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid work email address'),
  password: z.string().min(1, 'Password is required'),
  botTrap: z.string().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const host = useHost();

  const returnTo =
    searchParams.get('redirect') ||
    searchParams.get('return_to') ||
    searchParams.get('returnTo') ||
    (location.state as any)?.from?.pathname;
  const product = searchParams.get('product') || 'inventory';

  const { setAuthData, deviceId } = useAuthStore();

  const [isLoading, setIsLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google' | 'facebook' | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [showRememberMeTip, setShowRememberMeTip] = useState(false);

  // Passkey state & enrollment guidance
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [passkeyPrompt, setPasskeyPrompt] = useState<string | null>(null);

  // Cookie/Privacy mode warning
  const [cookiesBlocked, setCookiesBlocked] = useState(false);

  useEffect(() => {
    isWebAuthnAvailable()
      .then(setPasskeySupported)
      .catch(() => setPasskeySupported(false));

    if (!areCookiesEnabled()) {
      setCookiesBlocked(true);
    }
  }, []);

  // If user arrives via logout handoff, ensure local store is wiped
  useEffect(() => {
    if (searchParams.get('logged_out') === 'true' || searchParams.get('logout') === 'true') {
      useAuthStore.getState().logout();
    }
  }, [searchParams]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: searchParams.get('email') || '',
      password: '',
      botTrap: '',
    },
  });

  const redirectWithHandoff = async (targetUrlStr: string) => {
    try {
      const url = new URL(targetUrlStr, window.location.origin);
      if (url.origin === window.location.origin) {
        navigate(url.pathname + url.search + url.hash, { replace: true });
        return;
      }

      // Attempt to generate a single-use server-mediated handoff code for seamless cross-subdomain handoff
      try {
        const handoffRes = await api.post<{ code: string }>('/auth/handoff/code');
        if (handoffRes?.code) {
          url.searchParams.set('handoff_code', handoffRes.code);
        }
      } catch {
        // Fallback to wildcard HttpOnly cookies (orvio_session, orvio_refresh)
      }

      window.location.replace(url.toString());
    } catch {
      window.location.replace(targetUrlStr);
    }
  };

  const handlePostLoginRedirect = (userData?: any, sessionData?: any) => {
    // 1. Onboarding check: If personal onboarding is incomplete, redirect to /onboard/personal
    if (userData && userData.personalOnboardingCompleted === false) {
      if (host.application === 'accounts' || host.application === 'home' || host.application === 'launcher') {
        navigate('/onboard/personal', { replace: true });
        return;
      }
      redirectWithHandoff(getCrossSubdomainUrl('home', '/onboard/personal'));
      return;
    }

    // 2. Explicit returnTo / redirect param (must be valid safe subdomain URL)
    if (returnTo && isValidReturnUrl(returnTo)) {
      redirectWithHandoff(returnTo);
      return;
    }

    // 3. Session continuity: Redirect to last visited page & subdomain if recorded
    if (sessionData?.lastVisitedUrl && sessionData?.lastVisitedSubdomain) {
      try {
        const targetUrl = getCrossSubdomainUrl(
          sessionData.lastVisitedSubdomain as ApplicationKey,
          sessionData.lastVisitedUrl
        );
        if (isValidReturnUrl(targetUrl)) {
          redirectWithHandoff(targetUrl);
          return;
        }
      } catch {
        // Fall back to home
      }
    }

    // 4. Fallback: Default to Home launcher / dashboard
    redirectWithHandoff(getHomeUrl());
  };

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setPasskeyPrompt(null);
    try {
      const response = await api.post<any>('/auth/login', {
        email: data.email,
        password: data.password,
        deviceId,
        botTrap: data.botTrap,
      });

      // 2FA Challenge: Redirect to separate, deep-linkable, refresh-resilient route
      if (response.twoFactorRequired && response.tempToken) {
        // Cache in sessionStorage for refresh and back button resilience
        sessionStorage.setItem(
          'orvio_2fa_challenge',
          JSON.stringify({
            tempToken: response.tempToken,
            email: data.email,
            returnTo,
            product,
            rememberMe,
            timestamp: Date.now(),
          })
        );

        toast.info('Two-factor authentication required.');
        navigate('/login/2fa', {
          state: {
            tempToken: response.tempToken,
            email: data.email,
            returnTo,
            product,
            rememberMe,
          },
        });
        setIsLoading(false);
        return;
      }

      if (response?.status === 'already_authenticated' || response?.data?.status === 'already_authenticated') {
        const authPayload = response.data || response;
        setAuthData(authPayload, rememberMe);
        toast.info('You are already signed in.');
        handlePostLoginRedirect(authPayload.user, authPayload.session);
        return;
      }

      if (
        response.status === 'pending_email_verification' ||
        response.data?.status === 'pending_email_verification' ||
        response.user?.status === 'pending_email_verification' ||
        response.user?.emailVerified === false
      ) {
        setAuthData(response, rememberMe);
        toast.info('Email verification is required before full access is granted.');
        navigate('/verify-email', {
          state: { email: data.email, returnTo },
        });
        setIsLoading(false);
        return;
      }

      setAuthData(response, rememberMe);
      toast.success(`Welcome back, ${response.user?.name || 'there'}!`);
      handlePostLoginRedirect(response.user, response.session);
    } catch (error: any) {
      setIsLoading(false);
      if (error?.code === 'ACCOUNT_LOCKED' || error?.message?.includes('temporarily locked') || error?.message?.includes('locked due to')) {
        toast.error(error.message || 'Account temporarily locked due to too many failed attempts.', {
          duration: 8000,
        });
      } else {
        toast.error(error.message || 'Invalid email or password. Please try again.');
      }
    }
  };

  const handleSocialAuth = (provider: 'google' | 'facebook') => {
    setSocialLoading(provider);
    const endpoint = `${API_BASE_URL}/auth/${provider}?returnTo=${encodeURIComponent(returnTo)}&product=${product}`;
    window.location.href = endpoint;
  };

  const handlePasskeyLogin = async () => {
    setPasskeyLoading(true);
    setPasskeyPrompt(null);
    try {
      const response = await startPasskeyLogin();
      if (response?.success && response.data) {
        setAuthData(response.data, rememberMe);
        toast.success('Signed in with Passkey successfully.');
        handlePostLoginRedirect(response.data.user, response.data.session);
      }
    } catch (error: any) {
      if (error?.name === 'NotAllowedError') {
        // User cancelled the OS biometric prompt
        return;
      }
      // If user hasn't enrolled passkeys on this account or device yet, show helpful prompt
      setPasskeyPrompt(
        'No passkey registered for this device yet. Sign in with your password, then register Touch ID, Face ID, or a security key in your Security Settings.'
      );
    } finally {
      setPasskeyLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="space-y-5 w-full max-w-[420px] mx-auto animate-in fade-in duration-200 text-left">
        {/* Header */}
        <div className="space-y-1 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Sign in to Orviohub
          </h1>
          <p className="text-xs text-slate-300">
            Welcome back. Access all your workspaces and connected applications.
          </p>
        </div>

        {/* Incognito / Cookies Restricted Warning */}
        {cookiesBlocked && (
          <div className="p-3 rounded-xs bg-amber-950/40 border border-amber-500/30 text-xs text-amber-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" aria-hidden="true" />
            <p className="leading-relaxed text-[11px] text-amber-200/90">
              Browser cookies appear disabled or restricted. Cross-subdomain session handoffs may require allowing cookies for this site.
            </p>
          </div>
        )}

        {/* Passkey Enrollment Guidance Alert */}
        {passkeyPrompt && (
          <div className="p-3 rounded-xs bg-[#22151e] border border-[#714b67]/50 text-xs text-slate-300 flex items-start justify-between gap-2 animate-in fade-in">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 text-[#c79dbd] mt-0.5" aria-hidden="true" />
              <p className="leading-relaxed text-[11px]">{passkeyPrompt}</p>
            </div>
            <button
              type="button"
              onClick={() => setPasskeyPrompt(null)}
              className="text-[11px] text-slate-300 hover:text-white cursor-pointer shrink-0"
              aria-label="Dismiss passkey guidance"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Social Authentication: Google & Facebook (Decoupled from standard form loading) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Google Button */}
          <Button
            variant="outline"
            type="button"
            onClick={() => handleSocialAuth('google')}
            disabled={!!socialLoading}
            aria-label="Sign in with Google"
            className="w-full min-h-[44px] bg-[#160f14] hover:bg-[#20151c] border border-white/10 hover:border-white/20 text-slate-200 hover:text-white rounded-xs text-xs font-medium flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-sm"
          >
            {socialLoading === 'google' ? (
              <Spinner size="sm" className="text-white" />
            ) : (
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            <span>Google</span>
          </Button>

          {/* Facebook Button */}
          <Button
            variant="outline"
            type="button"
            onClick={() => handleSocialAuth('facebook')}
            disabled={!!socialLoading}
            aria-label="Sign in with Facebook"
            className="w-full min-h-[44px] bg-[#160f14] hover:bg-[#20151c] border border-white/10 hover:border-white/20 text-slate-200 hover:text-white rounded-xs text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
          >
            {socialLoading === 'facebook' ? (
              <Spinner size="sm" className="text-white" />
            ) : (
              <svg className="w-3.5 h-3.5 fill-[#1877F2] shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
            )}
            <span>Facebook</span>
          </Button>
        </div>

        {/* Passkey / Biometrics Button */}
        {passkeySupported && (
          <Button
            variant="outline"
            type="button"
            onClick={handlePasskeyLogin}
            disabled={passkeyLoading || !!socialLoading}
            aria-label="Sign in with Passkey or Biometrics"
            className="w-full min-h-[44px] bg-[#160f14] hover:bg-[#20151c] border border-white/10 hover:border-[#714b67]/50 text-slate-200 hover:text-white rounded-xs text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            {passkeyLoading ? (
              <Spinner size="sm" className="text-white" />
            ) : (
              <Fingerprint className="w-4 h-4 text-[#c79dbd]" aria-hidden="true" />
            )}
            <span>Sign in with Passkey / Biometrics</span>
          </Button>
        )}

        <div className="relative my-3" aria-hidden="true">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10"></div>
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-3 bg-black text-slate-300 font-medium uppercase tracking-wider text-[10px]">
              or email
            </span>
          </div>
        </div>

        {/* Standard Email & Password Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5" noValidate>
          {/* Invisible honeypot field for automated bot & credential-stuffing rejection */}
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            className="hidden"
            aria-hidden="true"
            style={{ display: 'none', position: 'absolute', left: '-9999px' }}
            {...register('botTrap')}
          />

          {/* Email */}
          <div className="space-y-1">
            <Label htmlFor="email" className="text-xs font-medium text-slate-200">
              Work Email
            </Label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
              <Input
                id="email"
                type="email"
                autoComplete="username"
                placeholder="name@company.com"
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'email-error' : undefined}
                {...register('email')}
                className={`pl-10 h-11 bg-[#0e0a0d] border-white/10 text-white placeholder:text-slate-500 rounded-xs text-xs focus:ring-1 focus:ring-[#714b67] ${errors.email ? 'border-rose-500/80' : ''}`}
                disabled={isLoading}
              />
            </div>
            {errors.email && (
              <p id="email-error" role="alert" className="text-[11px] text-rose-400 font-medium">
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-xs font-medium text-slate-200">
                Password
              </Label>
              <Link
                to={`/forgot-password?product=${product}`}
                className="text-[11px] text-[#c79dbd] hover:text-white transition-colors py-1 focus:outline-hidden focus:underline"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••••••"
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? 'password-error' : undefined}
                {...register('password')}
                className={`pl-10 pr-10 h-11 bg-[#0e0a0d] border-white/10 text-white placeholder:text-slate-500 rounded-xs text-xs focus:ring-1 focus:ring-[#714b67] ${errors.password ? 'border-rose-500/80' : ''}`}
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-2 min-w-[36px] min-h-[36px] flex items-center justify-center cursor-pointer rounded-xs focus:outline-hidden focus:ring-1 focus:ring-[#714b67]"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
              </button>
            </div>
            {errors.password && (
              <p id="password-error" role="alert" className="text-[11px] text-rose-400 font-medium">
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Remember this device with Security Explanation */}
          <div className="space-y-1 pt-0.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(!!checked)}
                  className="border-white/20 data-[state=checked]:bg-[#714b67] data-[state=checked]:border-[#714b67] rounded-xs"
                />
                <label htmlFor="remember" className="text-xs text-slate-200 select-none cursor-pointer flex items-center gap-1.5 py-1">
                  <span>Remember this device</span>
                </label>
              </div>
              <button
                type="button"
                onClick={() => setShowRememberMeTip(!showRememberMeTip)}
                className="text-slate-400 hover:text-white transition-colors p-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center cursor-pointer rounded-xs"
                aria-label="Security details regarding remember me"
                aria-expanded={showRememberMeTip}
              >
                <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>

            {/* Helper explanation text for security awareness */}
            {showRememberMeTip ? (
              <p className="text-[11px] text-slate-300 pl-6 leading-relaxed animate-in fade-in">
                Maintains your session on this browser for 30 days across OrvioHub apps. Do not select on public or shared computers.
              </p>
            ) : (
              <p className="text-[10px] text-slate-400 pl-6">
                Keeps you signed in for 30 days. Untick on shared or public computers.
              </p>
            )}
          </div>

          {/* Primary Submit Button */}
          <Button
            type="submit"
            aria-busy={isLoading}
            className="w-full h-11 mt-1 bg-[#714b67] hover:bg-[#86597a] active:bg-[#603f57] text-white rounded-xs font-semibold text-xs shadow-md shadow-[#714b67]/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            disabled={isLoading}
          >
            {isLoading ? (
              <Spinner size="sm" className="text-white" />
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </>
            )}
          </Button>
        </form>

        {/* Global Footer */}
        <div className="text-center text-xs text-slate-300 pt-2 border-t border-white/5">
          Don't have an account?{' '}
          <Link
            to={`/signup?product=${product}&return_to=${encodeURIComponent(returnTo)}`}
            className="text-[#c79dbd] hover:text-white font-semibold transition-colors py-1 inline-block focus:outline-hidden focus:underline"
          >
            Start free trial
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
};
