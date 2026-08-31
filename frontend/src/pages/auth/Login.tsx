import React, { useState } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, API_BASE_URL } from '@/lib/api';
import { AuthResponse } from '@/lib/types';
import { useAuthStore } from '@/stores/useAuthStore';
import { isValidReturnUrl } from '@/lib/domain';
import { getHomeUrl } from '@orviohub/shared';
import { useHost } from '@/host/useHost';
import { AuthLayout } from './AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import { Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, KeyRound } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid work email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const host = useHost();

  const returnTo = searchParams.get('return_to') || searchParams.get('returnTo') || (location.state as any)?.from?.pathname;
  const product = searchParams.get('product') || 'inventory';

  const {
    setAuthData,
    deviceId,
  } = useAuthStore();

  const [isLoading, setIsLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google' | 'facebook' | 'apple' | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // 2FA Challenge State
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [isBackupMode, setIsBackupMode] = useState(false);

  // If user arrives via logout handoff, ensure local store is wiped
  React.useEffect(() => {
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
  });

  const handlePostLoginRedirect = async () => {
    const token = localStorage.getItem('orvio_auth_token');
    const refreshToken = localStorage.getItem('orvio_refresh_token');

    if (returnTo && isValidReturnUrl(returnTo)) {
      if (returnTo.startsWith('http://') || returnTo.startsWith('https://')) {
        try {
          const url = new URL(returnTo);
          if (token) url.searchParams.set('auth_token', token);
          if (refreshToken) url.searchParams.set('refresh_token', refreshToken);
          window.location.href = url.toString();
          return;
        } catch {
          window.location.href = returnTo;
          return;
        }
      }
      navigate(returnTo, { replace: true });
      return;
    }

    // Default post-login destination: Workspace Home (home.orviohub.localhost:4000 / home.orviohub.com)
    const homeBase = getHomeUrl(host.environment);
    try {
      const homeUrl = new URL(homeBase);
      if (token) homeUrl.searchParams.set('auth_token', token);
      if (refreshToken) homeUrl.searchParams.set('refresh_token', refreshToken);
      window.location.href = homeUrl.toString();
    } catch {
      window.location.href = homeBase;
    }
  };

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const response = await api.post<any>('/auth/login', {
        email: data.email,
        password: data.password,
        deviceId,
      });

      if (response.twoFactorRequired && response.tempToken) {
        setTempToken(response.tempToken);
        setTwoFactorRequired(true);
        toast.info('Two-factor authentication required. Please enter your code.');
        return;
      }

      setAuthData(response, rememberMe);
      toast.success(`Welcome back, ${response.user?.name || 'there'}!`);
      await handlePostLoginRedirect();
    } catch (error: any) {
      if (error?.code === 'ACCOUNT_LOCKED' || error?.message?.includes('temporarily locked') || error?.message?.includes('locked due to')) {
        toast.error(error.message || 'Account temporarily locked due to too many failed attempts.', {
          duration: 8000,
        });
      } else {
        toast.error(error.message || 'Invalid email or password. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const onTwoFactorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempToken || !twoFactorCode.trim()) {
      toast.error('Please enter your 2FA verification code.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.post<AuthResponse>('/auth/mfa/challenge', {
        tempToken,
        code: twoFactorCode.trim(),
        isBackupCode: isBackupMode,
        deviceId,
      });

      setAuthData(response, rememberMe);
      toast.success('Two-factor authentication verified.');
      await handlePostLoginRedirect();
    } catch (error: any) {
      toast.error(error.message || 'Invalid verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialAuth = (provider: 'google' | 'facebook' | 'apple') => {
    setSocialLoading(provider);
    const endpoint = `${API_BASE_URL}/auth/${provider}?returnTo=${encodeURIComponent(returnTo)}&product=${product}`;
    window.location.href = endpoint;
  };

  return (
    <AuthLayout>
      <div className="space-y-6 w-full">
        {twoFactorRequired ? (
          /* 2FA Challenge View */
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="space-y-1.5 text-center">
              <div className="mx-auto w-12 h-12 rounded-xs bg-[#714b67]/20 border border-[#714b67]/30 flex items-center justify-center mb-3 text-[#c79dbd]">
                {isBackupMode ? <KeyRound className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
              </div>
              <h2 className="text-xl font-bold text-white">
                {isBackupMode ? 'Enter Backup Code' : 'Two-Factor Authentication'}
              </h2>
              <p className="text-xs text-slate-400">
                {isBackupMode
                  ? 'Enter your 8-character backup recovery code.'
                  : 'Enter the 6-digit code from your authenticator app.'}
              </p>
            </div>

            <form onSubmit={onTwoFactorSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">
                  {isBackupMode ? 'Backup Code' : '6-Digit Authenticator Code'}
                </Label>
                <Input
                  type="text"
                  maxLength={isBackupMode ? 12 : 6}
                  placeholder={isBackupMode ? 'e.g. ABCD-1234' : '123456'}
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.toUpperCase())}
                  className="h-11 bg-[#0e0a0d] border-white/10 text-white font-mono text-center tracking-widest text-lg rounded-xs"
                  autoFocus
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 bg-[#714b67] hover:bg-[#86597a] text-white rounded-xs text-xs font-semibold"
              >
                {isLoading ? <Spinner size="sm" className="text-white" /> : 'Verify Code & Sign In'}
              </Button>

              <div className="flex justify-between items-center text-xs pt-1">
                <button
                  type="button"
                  onClick={() => setIsBackupMode(!isBackupMode)}
                  className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  {isBackupMode ? 'Use Authenticator Code' : 'Use a Backup Code'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTwoFactorRequired(false);
                    setTempToken(null);
                  }}
                  className="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* Standard Login View */
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="space-y-1 text-center">
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Sign in to Orivo
              </h2>
              <p className="text-xs text-slate-400">
                Welcome back. Access all your workspaces and apps.
              </p>
            </div>

            {/* Social Logins */}
            <div className="space-y-2">
              {/* Google Button */}
              <Button
                variant="outline"
                type="button"
                onClick={() => handleSocialAuth('google')}
                disabled={isLoading || !!socialLoading}
                className="w-full h-10 bg-[#160f14] hover:bg-[#20151c] border border-white/10 hover:border-white/20 text-slate-200 hover:text-white rounded-xs text-xs font-medium flex items-center justify-center gap-2.5 transition-all cursor-pointer"
              >
                {socialLoading === 'google' ? (
                  <Spinner size="sm" className="text-white" />
                ) : (
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                )}
                <span>Continue with Google</span>
              </Button>

              {/* Apple & Facebook Row */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => handleSocialAuth('apple')}
                  disabled={isLoading || !!socialLoading}
                  className="w-full h-10 bg-[#160f14] hover:bg-[#20151c] border border-white/10 hover:border-white/20 text-slate-200 hover:text-white rounded-xs text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {socialLoading === 'apple' ? (
                    <Spinner size="sm" className="text-white" />
                  ) : (
                    <svg className="w-3.5 h-3.5 fill-current shrink-0" viewBox="0 0 24 24">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.85c.66-.82 1.11-1.96.99-3.1-.96.04-2.12.64-2.8 1.44-.6.69-1.12 1.83-0.98 2.94 1.07.08 2.15-.55 2.79-1.28z" />
                    </svg>
                  )}
                  <span>Apple ID</span>
                </Button>

                <Button
                  variant="outline"
                  type="button"
                  onClick={() => handleSocialAuth('facebook')}
                  disabled={isLoading || !!socialLoading}
                  className="w-full h-10 bg-[#160f14] hover:bg-[#20151c] border border-white/10 hover:border-white/20 text-slate-200 hover:text-white rounded-xs text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {socialLoading === 'facebook' ? (
                    <Spinner size="sm" className="text-white" />
                  ) : (
                    <svg className="w-3.5 h-3.5 fill-[#1877F2] shrink-0" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                  )}
                  <span>Facebook</span>
                </Button>
              </div>
            </div>

            <div className="relative my-3">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/5"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-3 bg-black text-slate-500 font-medium uppercase tracking-wider text-[10px]">
                  or email
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
              <div className="space-y-1">
                <Label htmlFor="email" className="text-xs font-medium text-slate-300">
                  Work Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@company.com"
                    {...register('email')}
                    className={`pl-10 h-10 bg-[#0e0a0d] border-white/10 text-white placeholder:text-slate-600 rounded-xs text-xs focus:ring-1 focus:ring-[#714b67] ${errors.email ? 'border-rose-500/80' : ''}`}
                    disabled={isLoading || !!socialLoading}
                  />
                </div>
                {errors.email && <p className="text-[11px] text-rose-400">{errors.email.message}</p>}
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-medium text-slate-300">
                    Password
                  </Label>
                  <Link
                    to={`/forgot-password?product=${product}`}
                    className="text-[11px] text-[#c79dbd] hover:text-white transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    {...register('password')}
                    className={`pl-10 pr-10 h-10 bg-[#0e0a0d] border-white/10 text-white placeholder:text-slate-600 rounded-xs text-xs focus:ring-1 focus:ring-[#714b67] ${errors.password ? 'border-rose-500/80' : ''}`}
                    disabled={isLoading || !!socialLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {errors.password && <p className="text-[11px] text-rose-400">{errors.password.message}</p>}
              </div>

              <div className="flex items-center space-x-2 pt-0.5">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(!!checked)}
                  className="border-white/10 data-[state=checked]:bg-[#714b67] data-[state=checked]:border-[#714b67] rounded-xs"
                />
                <label htmlFor="remember" className="text-xs text-slate-400 select-none cursor-pointer">
                  Remember this device
                </label>
              </div>

              <Button
                type="submit"
                className="w-full h-11 mt-1 bg-[#714b67] hover:bg-[#86597a] active:bg-[#603f57] text-white rounded-xs font-semibold text-xs shadow-md shadow-[#714b67]/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                disabled={isLoading || !!socialLoading}
              >
                {isLoading ? (
                  <Spinner size="sm" className="text-white" />
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </Button>
            </form>

            <div className="text-center text-xs text-slate-400 pt-2 border-t border-white/5">
              Don't have an account?{' '}
              <Link
                to={`/signup?product=${product}&return_to=${encodeURIComponent(returnTo)}`}
                className="text-[#c79dbd] hover:text-white font-semibold transition-colors"
              >
                Start free trial
              </Link>
            </div>
          </div>
        )}
      </div>
    </AuthLayout>
  );
};
