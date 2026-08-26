import React, { useState } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, API_BASE_URL } from '@/lib/api';
import { AuthResponse } from '@/lib/types';
import { useAuthStore } from '@/stores/useAuthStore';
import { isValidReturnUrl } from '@/lib/domain';
import { AuthLayout } from './AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import { Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, KeyRound, ArrowLeft } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid work email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const returnTo = searchParams.get('return_to') || searchParams.get('returnTo') || (location.state as any)?.from?.pathname || '/app/inventory';
  const product = searchParams.get('product') || 'inventory';

  const {
    setAuthData,
    deviceId,
  } = useAuthStore();

  const [isLoading, setIsLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google' | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // 2FA Challenge State
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [isBackupMode, setIsBackupMode] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const handlePostLoginRedirect = async () => {
    if (returnTo && isValidReturnUrl(returnTo)) {
      if (returnTo.startsWith('http://') || returnTo.startsWith('https://')) {
        try {
          const ssoRes = await api.get<{ code: string; redirectUrl: string }>(
            `/auth/oauth/authorize?product=${product}&redirect_uri=${encodeURIComponent(returnTo)}&response_type=code`
          );
          if (ssoRes && ssoRes.redirectUrl) {
            window.location.href = ssoRes.redirectUrl;
            return;
          }
        } catch {
          window.location.href = returnTo;
          return;
        }
      }
      navigate(returnTo, { replace: true });
      return;
    }
    navigate('/app', { replace: true });
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
      toast.error(error.message || 'Invalid email or password. Please try again.');
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
      const response = await api.post<AuthResponse>('/auth/2fa/login-verify', {
        tempToken,
        code: twoFactorCode.trim(),
        deviceId,
      });

      setAuthData(response, rememberMe);
      toast.success('Successfully authenticated!');
      await handlePostLoginRedirect();
    } catch (error: any) {
      toast.error(error.message || 'Invalid verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialAuth = (provider: 'google') => {
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
                <Input
                  id="twoFactorCode"
                  type="text"
                  autoFocus
                  placeholder={isBackupMode ? 'ABCD-EFGH' : '123456'}
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                  maxLength={isBackupMode ? 12 : 6}
                  className="h-11 bg-[#0a0609] border-[#2d1b27] text-white font-mono tracking-widest text-center text-lg rounded-xs focus:ring-1 focus:ring-[#714b67]"
                  disabled={isLoading}
                />
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-[#714b67] hover:bg-[#86597a] text-white rounded-xs font-semibold text-xs shadow-lg shadow-[#714b67]/25"
                disabled={isLoading || !twoFactorCode.trim()}
              >
                {isLoading ? <Spinner size="sm" className="mr-2 text-white" /> : 'Verify Code'}
              </Button>
            </form>

            <div className="pt-2 flex flex-col items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setIsBackupMode(!isBackupMode);
                  setTwoFactorCode('');
                }}
                className="text-[#c79dbd] hover:text-white transition-colors"
              >
                {isBackupMode ? 'Use Authenticator Code instead' : 'Use emergency backup code'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setTwoFactorRequired(false);
                  setTempToken(null);
                  setTwoFactorCode('');
                  setIsBackupMode(false);
                }}
                className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to login</span>
              </button>
            </div>
          </div>
        ) : (
          /* Standard Login View */
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-white tracking-tight">
                Sign in to Orivo
              </h2>
              <p className="text-xs text-slate-400">
                Welcome back. Access all your workspaces and apps.
              </p>
            </div>

            {/* Social Google Sign-in */}
            <Button
              variant="outline"
              type="button"
              onClick={() => handleSocialAuth('google')}
              disabled={isLoading || !!socialLoading}
              className="w-full h-11 bg-[#160f14] hover:bg-[#20151c] border border-white/10 hover:border-white/20 text-slate-200 hover:text-white rounded-xs text-xs font-medium flex items-center justify-center gap-2.5 transition-all cursor-pointer"
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
