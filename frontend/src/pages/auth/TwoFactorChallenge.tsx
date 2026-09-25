import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { AuthResponse } from '@/lib/types';
import { useAuthStore } from '@/stores/useAuthStore';
import { useHost } from '@/host/useHost';
import { isValidReturnUrl, getHomeUrl, getCrossSubdomainUrl, type ApplicationKey } from '@/lib/domain';
import { AuthLayout } from './AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import {
  ShieldCheck,
  KeyRound,
  ArrowRight,
  ArrowLeft,
  Clock,
  RefreshCw,
  HelpCircle,
  AlertTriangle,
} from 'lucide-react';

const STORAGE_KEY_2FA = 'orvio_2fa_challenge';

interface TwoFactorSessionState {
  tempToken: string;
  email: string;
  returnTo?: string;
  product?: string;
  rememberMe?: boolean;
  timestamp: number;
}

export const TwoFactorChallenge: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const host = useHost();
  const { setAuthData, deviceId } = useAuthStore();

  // Load from location.state or sessionStorage for refresh resilience
  const [challengeData, setChallengeData] = useState<TwoFactorSessionState | null>(() => {
    const locState = location.state as any;
    if (locState?.tempToken) {
      const stateObj: TwoFactorSessionState = {
        tempToken: locState.tempToken,
        email: locState.email || '',
        returnTo: locState.returnTo,
        product: locState.product,
        rememberMe: locState.rememberMe ?? true,
        timestamp: Date.now(),
      };
      sessionStorage.setItem(STORAGE_KEY_2FA, JSON.stringify(stateObj));
      return stateObj;
    }

    try {
      const saved = sessionStorage.getItem(STORAGE_KEY_2FA);
      if (saved) {
        const parsed = JSON.parse(saved) as TwoFactorSessionState;
        // Expire challenge after 30 minutes
        if (Date.now() - parsed.timestamp < 30 * 60 * 1000) {
          return parsed;
        }
        sessionStorage.removeItem(STORAGE_KEY_2FA);
      }
    } catch {}

    return null;
  });

  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [isBackupMode, setIsBackupMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isExtending, setIsExtending] = useState(false);

  // 30-minute countdown timer (1800s)
  const [secondsRemaining, setSecondsRemaining] = useState<number>(() => {
    if (!challengeData) return 1800;
    const elapsed = Math.floor((Date.now() - challengeData.timestamp) / 1000);
    return Math.max(0, 1800 - elapsed);
  });

  useEffect(() => {
    if (secondsRemaining <= 0) return;
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [secondsRemaining]);

  const redirectWithHandoff = async (targetUrlStr: string) => {
    try {
      const url = new URL(targetUrlStr, window.location.origin);
      if (url.origin === window.location.origin) {
        navigate(url.pathname + url.search + url.hash, { replace: true });
        return;
      }
      try {
        const handoffRes = await api.post<{ code: string }>('/auth/handoff/code');
        if (handoffRes?.code) {
          url.searchParams.set('handoff_code', handoffRes.code);
        }
      } catch {}
      window.location.replace(url.toString());
    } catch {
      window.location.replace(targetUrlStr);
    }
  };

  const handlePostLoginRedirect = (userData?: any, sessionData?: any) => {
    sessionStorage.removeItem(STORAGE_KEY_2FA);
    const returnTo = challengeData?.returnTo || searchParams.get('return_to');

    if (userData && userData.personalOnboardingCompleted === false) {
      if (host.application === 'accounts' || host.application === 'home' || host.application === 'launcher') {
        navigate('/onboard/personal', { replace: true });
        return;
      }
      redirectWithHandoff(getCrossSubdomainUrl('home', '/onboard/personal'));
      return;
    }

    if (returnTo && isValidReturnUrl(returnTo)) {
      redirectWithHandoff(returnTo);
      return;
    }

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
      } catch {}
    }

    redirectWithHandoff(getHomeUrl());
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challengeData?.tempToken) {
      toast.error('Session expired. Please sign in again.');
      navigate('/login');
      return;
    }

    const cleanCode = twoFactorCode.trim().replace(/\s+/g, '');
    if (!cleanCode) {
      toast.error(isBackupMode ? 'Please enter your backup code.' : 'Please enter your 6-digit authenticator code.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.post<AuthResponse>('/auth/mfa/challenge', {
        tempToken: challengeData.tempToken,
        code: cleanCode,
        isBackupCode: isBackupMode,
        deviceId,
      });

      setAuthData(response, challengeData.rememberMe ?? true);
      toast.success(isBackupMode ? 'Backup code verified. Device authenticated.' : 'Two-factor authentication verified.');
      handlePostLoginRedirect(response.user, (response as any).session);
    } catch (error: any) {
      setIsLoading(false);
      toast.error(error.message || 'Invalid verification code. Please check and try again.');
    }
  };

  const handleExtendChallenge = async () => {
    if (!challengeData) return;
    setIsExtending(true);
    try {
      const res = await api.post<any>('/auth/2fa/resend-challenge', {
        tempToken: challengeData.tempToken,
        email: challengeData.email,
      });

      const newToken = res?.data?.tempToken || res?.tempToken || challengeData.tempToken;
      const updatedState: TwoFactorSessionState = {
        ...challengeData,
        tempToken: newToken,
        timestamp: Date.now(),
      };
      setChallengeData(updatedState);
      sessionStorage.setItem(STORAGE_KEY_2FA, JSON.stringify(updatedState));
      setSecondsRemaining(1800);
      toast.success('2FA challenge session extended by 30 minutes.');
    } catch (err: any) {
      toast.error(err.message || 'Unable to extend challenge session. Please sign in again.');
    } finally {
      setIsExtending(false);
    }
  };

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const maskEmail = (email: string) => {
    if (!email || !email.includes('@')) return 'your account';
    const [name, domain] = email.split('@');
    if (name.length <= 2) return `${name}***@${domain}`;
    return `${name.slice(0, 2)}***${name.slice(-1)}@${domain}`;
  };

  // If no challenge state exists (direct URL visit without login credentials)
  if (!challengeData) {
    return (
      <AuthLayout>
        <div className="w-full max-w-[420px] mx-auto text-center space-y-4 p-6 rounded-sm bg-[#160f14] border border-white/10">
          <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white">No Active 2FA Session</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Two-factor verification requires an active login session. Please sign in with your email and password first.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => navigate('/login')}
            className="w-full h-10 bg-[#714b67] hover:bg-[#86597a] text-white rounded-xs text-xs font-semibold"
          >
            Return to Sign In
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="w-full max-w-[420px] mx-auto space-y-5 animate-in fade-in duration-200 text-left">
        {/* Header & Icon */}
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-[#714b67]/20 border border-[#714b67]/40 flex items-center justify-center text-[#c79dbd]">
            {isBackupMode ? <KeyRound className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            {isBackupMode ? 'Enter Backup Recovery Code' : 'Two-Factor Authentication'}
          </h1>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            {isBackupMode ? (
              <>Enter one of your 8-character recovery codes for <span className="text-slate-200 font-medium">{maskEmail(challengeData.email)}</span>.</>
            ) : (
              <>Enter the 6-digit code from your authenticator app for <span className="text-slate-200 font-medium">{maskEmail(challengeData.email)}</span>.</>
            )}
          </p>
        </div>

        {/* 30-Minute Expiry Countdown Bar */}
        <div className="p-2.5 rounded-xs bg-[#160f14] border border-white/10 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <Clock className="w-3.5 h-3.5 text-[#c79dbd]" />
            <span className="text-[11px]">
              Session expires in:{' '}
              <span className={`font-mono font-semibold ${secondsRemaining < 180 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {formatTimer(secondsRemaining)}
              </span>
            </span>
          </div>
          <button
            type="button"
            onClick={handleExtendChallenge}
            disabled={isExtending}
            className="flex items-center gap-1 text-[11px] text-[#c79dbd] hover:text-white transition-colors cursor-pointer disabled:opacity-50"
            title="Extend session by 30 minutes"
          >
            <RefreshCw className={`w-3 h-3 ${isExtending ? 'animate-spin' : ''}`} />
            <span>Extend</span>
          </button>
        </div>

        {/* Verification Form */}
        <form onSubmit={handleVerify} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="twoFactorCode" className="text-xs font-medium text-slate-200 flex items-center justify-between">
              <span>{isBackupMode ? '8-Character Backup Code' : '6-Digit Authenticator Code'}</span>
              <span className="text-[10px] text-slate-400 font-normal">
                {isBackupMode ? 'Format: ABCD-1234' : 'From Authenticator App'}
              </span>
            </Label>
            <Input
              id="twoFactorCode"
              type="text"
              inputMode={isBackupMode ? 'text' : 'numeric'}
              autoComplete={isBackupMode ? 'off' : 'one-time-code'}
              maxLength={isBackupMode ? 12 : 6}
              placeholder={isBackupMode ? 'ABCD-1234' : '123456'}
              value={twoFactorCode}
              onChange={(e) => setTwoFactorCode(e.target.value.toUpperCase())}
              aria-label={isBackupMode ? '8-character backup code' : '6-digit authenticator code'}
              className="h-12 bg-[#0e0a0d] border-white/10 text-white font-mono text-center tracking-widest text-xl rounded-xs focus:ring-1 focus:ring-[#714b67]"
              autoFocus
              disabled={isLoading}
            />
          </div>

          <Button
            type="submit"
            aria-busy={isLoading}
            disabled={isLoading || secondsRemaining <= 0}
            className="w-full h-11 bg-[#714b67] hover:bg-[#86597a] active:bg-[#603f57] text-white rounded-xs text-xs font-semibold shadow-md shadow-[#714b67]/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <Spinner size="sm" className="text-white" />
            ) : (
              <>
                <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Verify & Complete Sign In</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </>
            )}
          </Button>
        </form>

        {/* Guided "Lost Device / Backup Code" Flow */}
        <div className="p-3 rounded-xs bg-white/[0.02] border border-white/5 space-y-2">
          <div className="flex items-start justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-medium text-slate-200">
                {isBackupMode ? 'Have access to your phone?' : 'Lost your authenticator device?'}
              </span>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                {isBackupMode
                  ? 'Switch back to the 6-digit rolling code generated by your app.'
                  : 'You can sign in using one of the emergency backup codes provided during 2FA setup.'}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setIsBackupMode(!isBackupMode);
              setTwoFactorCode('');
            }}
            className="w-full min-h-[38px] bg-transparent border-white/10 hover:bg-white/5 text-slate-200 text-[11px] rounded-xs font-medium cursor-pointer"
          >
            {isBackupMode ? 'Use 6-Digit Authenticator Code' : 'I lost my device — Use Backup Code'}
          </Button>
        </div>

        {/* Back Navigation */}
        <div className="text-center pt-2 border-t border-white/5">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-white transition-colors py-1 focus:outline-hidden focus:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Back to email & password sign in</span>
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
};
