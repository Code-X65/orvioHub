import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation, useSearchParams, useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { AuthResponse } from '@/lib/types';
import { useAuthStore } from '@/stores/useAuthStore';
import { isValidReturnUrl } from '@/lib/domain';
import { getPendingSignup, updatePendingSignupEmail, clearPendingSignup } from '@/lib/pendingSignup';
import { maskEmail } from '@/lib/utils';
import { ChangePendingEmailForm, type ChangePendingEmailResponse } from '@/components/auth/ChangePendingEmailForm';
import { AuthLayout } from './AuthLayout';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { AccessibleOtpInput } from '@/components/common/AccessibleOtpInput';
import {
  Mail,
  CheckCircle2,
  XCircle,
  ExternalLink,
  RefreshCw,
  Edit3,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Eye,
  EyeOff,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';

export interface VerifyEmailProps {
  initialChangeOpen?: boolean;
}

export type VerifyEmailMode = 'TOKEN_AUTO_VERIFY' | 'CODE_ENTRY' | 'CHANGE_EMAIL' | 'SUCCESS' | 'ERROR';

export const VerifyEmail: React.FC<VerifyEmailProps> = ({ initialChangeOpen = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { tokenParam } = useParams<{ tokenParam?: string }>();

  // Prefer path-segment token (/verify-email/:token) over query param (?token=)
  const token = tokenParam || searchParams.get('token');
  const user = useAuthStore((state) => state.user);
  const emailFromQuery = searchParams.get('email');
  const pending = getPendingSignup();
  const initialEmail = emailFromQuery || location.state?.email || user?.email || pending?.email || '';

  const [currentRegisteredEmail, setCurrentRegisteredEmail] = useState(initialEmail);
  const [maskedEmail, setMaskedEmail] = useState(() => (initialEmail ? maskEmail(initialEmail) : ''));

  // Clear state machine mode
  const [mode, setMode] = useState<VerifyEmailMode>(() => {
    if (token) return 'TOKEN_AUTO_VERIFY';
    if (initialChangeOpen || location.pathname.endsWith('/change') || searchParams.get('action') === 'change') {
      return 'CHANGE_EMAIL';
    }
    return 'CODE_ENTRY';
  });

  const setAuthData = useAuthStore((state) => state.setAuthData);

  const [errorMessage, setErrorMessage] = useState('');
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [showDigits, setShowDigits] = useState(true);
  const verifyingRef = useRef(false);

  // 6-digit code inputs
  const [codeDigits, setCodeDigits] = useState<string[]>(['', '', '', '', '', '']);
  const digitInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Keep masked email in sync if initialEmail or currentRegisteredEmail changes
  useEffect(() => {
    const effective = currentRegisteredEmail || initialEmail;
    if (effective) {
      setMaskedEmail(maskEmail(effective));
    }
  }, [initialEmail, currentRegisteredEmail]);

  // Redirect if user is already verified
  useEffect(() => {
    if (mode === 'TOKEN_AUTO_VERIFY' || mode === 'SUCCESS') {
      return;
    }

    const returnTo = searchParams.get('redirect') || searchParams.get('return_to') || searchParams.get('returnTo');
    if (user?.emailVerified) {
      if (returnTo && isValidReturnUrl(returnTo)) {
        if (returnTo.startsWith('/')) {
          navigate(returnTo, { replace: true });
        } else {
          window.location.href = returnTo;
        }
        return;
      }
      navigate('/onboard/personal', { replace: true });
    }
  }, [user?.emailVerified, searchParams, navigate, mode]);

  // Cooldown countdown effect
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Auto-focus first digit input on mount if in CODE_ENTRY mode
  useEffect(() => {
    if (mode === 'CODE_ENTRY' && digitInputRefs.current[0]) {
      digitInputRefs.current[0]?.focus();
    }
  }, [mode]);

  // Auto-verify if token is provided in URL
  useEffect(() => {
    if (token && mode === 'TOKEN_AUTO_VERIFY' && !verifyingRef.current) {
      verifyingRef.current = true;
      executeVerification({ token });
    }
  }, [token, mode]);

  const executeVerification = async (payload: { token?: string; code?: string; email?: string }) => {
    try {
      const response = await api.post<AuthResponse>('/auth/verify-email', payload);

      clearPendingSignup();
      setAuthData(response);
      setMode('SUCCESS');
      toast.success('Email verified successfully!');

      const returnTo = searchParams.get('redirect') || searchParams.get('return_to') || searchParams.get('returnTo');
      if (returnTo && isValidReturnUrl(returnTo)) {
        setTimeout(() => {
          if (returnTo.startsWith('/')) {
            navigate(returnTo, { replace: true });
          } else {
            window.location.href = returnTo;
          }
        }, 600);
        return;
      }

      // Direct navigation to personal onboarding
      setTimeout(() => {
        navigate('/onboard/personal', { replace: true });
      }, 600);
    } catch (error: any) {
      const errCode = error?.code || error?.response?.data?.code || error?.data?.code;
      const remaining = error?.attemptsRemaining ?? error?.details?.attemptsRemaining ?? error?.data?.error?.attemptsRemaining ?? error?.response?.data?.error?.attemptsRemaining;
      
      if (errCode === 'CODE_LOCKED' || error?.status === 429 || (error?.message && error.message.toLowerCase().includes('locked'))) {
        setIsLocked(true);
        setAttemptsRemaining(0);
        setErrorMessage('This verification code has been locked due to too many failed attempts. Please request a new code.');
      } else {
        if (typeof remaining === 'number') {
          setAttemptsRemaining(remaining);
        }
        setErrorMessage(error.message || 'Failed to verify email. The code or token may be expired.');
      }
      setMode('ERROR');
    }
  };

  const handleDigitChange = (index: number, value: string) => {
    const clean = value.replace(/\D/g, '');
    if (!clean) {
      const next = [...codeDigits];
      next[index] = '';
      setCodeDigits(next);
      return;
    }
    const char = clean.slice(-1);
    const next = [...codeDigits];
    next[index] = char;
    setCodeDigits(next);

    // Auto advance
    if (index < 5) {
      digitInputRefs.current[index + 1]?.focus();
    }
  };

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !codeDigits[index] && index > 0) {
      digitInputRefs.current[index - 1]?.focus();
    }
  };

  const handleDigitPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const next = [...codeDigits];
    for (let i = 0; i < 6; i++) {
      next[i] = pasted[i] || '';
    }
    setCodeDigits(next);
    const focusIndex = Math.min(pasted.length, 5);
    digitInputRefs.current[focusIndex]?.focus();
  };

  const handleVerifyCode = async (overrideCode?: string) => {
    const fullCode = overrideCode || codeDigits.join('');
    if (fullCode.length !== 6) {
      toast.error('Please enter the complete 6-digit code.');
      return;
    }
    setIsVerifyingCode(true);
    await executeVerification({ code: fullCode, email: currentRegisteredEmail || undefined });
    setIsVerifyingCode(false);
  };

  const handleResend = async () => {
    const toSend = currentRegisteredEmail || user?.email;
    if (!toSend || !toSend.includes('@')) {
      toast.error('No registered email address found. Please enter your email address.');
      setMode('CHANGE_EMAIL');
      return;
    }

    setIsResending(true);
    try {
      await api.post('/auth/resend-verification', { email: toSend.trim() });
      toast.success('A fresh verification code and link has been sent to your inbox!');
      setCooldown(60);
      setCodeDigits(['', '', '', '', '', '']);
      setIsLocked(false);
      setAttemptsRemaining(null);
      setErrorMessage('');
      setMode('CODE_ENTRY');
      setTimeout(() => {
        digitInputRefs.current[0]?.focus();
      }, 50);
    } catch (error: any) {
      toast.error(error.message || 'Failed to resend verification email.');
    } finally {
      setIsResending(false);
    }
  };

  const handleEmailChangeSuccess = (newMasked: string, res: ChangePendingEmailResponse) => {
    setMaskedEmail(newMasked);
    setCodeDigits(['', '', '', '', '', '']);
    setCooldown(60);
    setIsLocked(false);
    setAttemptsRemaining(null);
    setErrorMessage('');
    setMode('CODE_ENTRY');

    if (res.email) {
      setCurrentRegisteredEmail(res.email);
      updatePendingSignupEmail(res.email);
    }

    setTimeout(() => {
      digitInputRefs.current[0]?.focus();
    }, 50);
  };

  const displayedEmail = maskedEmail || (currentRegisteredEmail ? maskEmail(currentRegisteredEmail) : 'your work email');

  // 1. AUTO-VERIFYING VIA TOKEN
  if (mode === 'TOKEN_AUTO_VERIFY') {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center justify-center text-center space-y-4 py-8">
          <Spinner size="lg" className="text-[#714b67]" />
          <h2 className="text-xl font-bold text-white">Verifying your email...</h2>
          <p className="text-xs text-slate-400">Validating your security link. You'll be redirected shortly.</p>
        </div>
      </AuthLayout>
    );
  }

  // 2. SUCCESS STATE
  if (mode === 'SUCCESS') {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center justify-center text-center space-y-4 py-8 animate-in fade-in duration-200">
          <div className="w-14 h-14 rounded-xs bg-emerald-950/80 border border-emerald-500/30 flex items-center justify-center mb-1 shadow-lg shadow-emerald-950/30">
            <CheckCircle2 className="w-7 h-7 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white">Email Verified!</h2>
          <p className="text-xs text-slate-300">Your account has been verified successfully.</p>
          <div className="pt-2 flex items-center gap-2 text-xs text-slate-400">
            <Spinner size="sm" className="text-[#714b67]" />
            <span>Redirecting you now...</span>
          </div>
        </div>
      </AuthLayout>
    );
  }

  // 3. ERROR STATE
  if (mode === 'ERROR') {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center justify-center text-center space-y-4 py-6 animate-in fade-in duration-200">
          <div className="w-14 h-14 rounded-xs bg-rose-950/80 border border-rose-500/30 flex items-center justify-center mb-1">
            <XCircle className="w-7 h-7 text-rose-400" />
          </div>
          <h2 className="text-2xl font-bold text-white">Verification Failed</h2>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">{errorMessage}</p>

          {isLocked ? (
            <div className="w-full mt-2 p-4 rounded-sm bg-rose-950/40 border border-rose-500/30 text-left space-y-3">
              <div className="flex items-center gap-2 text-rose-300 text-xs font-semibold">
                <Lock className="w-4 h-4 text-rose-400" />
                <span>Verification Code Locked</span>
              </div>
              <p className="text-xs text-rose-200/80">
                For security reasons, this code has been permanently invalidated after 5 consecutive failed attempts.
              </p>
              <Button
                className="w-full h-10 bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold rounded-xs cursor-pointer"
                onClick={handleResend}
                disabled={isResending}
              >
                {isResending ? <Spinner size="sm" className="mr-2" /> : <RefreshCw className="w-3.5 h-3.5 mr-2" />}
                Send New Verification Code
              </Button>
            </div>
          ) : (
            <div className="w-full mt-2 p-4 rounded-sm bg-[#140e12] border border-white/5 text-left space-y-3">
              {attemptsRemaining !== null && attemptsRemaining > 0 && (
                <div className="p-2.5 rounded-xs bg-amber-950/40 border border-amber-500/30 flex items-center gap-2 text-xs text-amber-300">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    <strong>{attemptsRemaining} attempt{attemptsRemaining === 1 ? '' : 's'} remaining</strong> before this code is locked.
                  </span>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-xs text-slate-200 font-medium">Re-enter 6-digit code:</p>
                <AccessibleOtpInput
                  digits={codeDigits}
                  onChange={setCodeDigits}
                  onComplete={(code) => handleVerifyCode(code)}
                  disabled={isVerifyingCode}
                  groupAriaLabel="Re-enter 6-digit verification code"
                  ariaDescribedBy={attemptsRemaining !== null ? 'reenter-attempts' : undefined}
                />
              </div>

              <Button
                className="w-full h-11 bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold rounded-xs cursor-pointer disabled:opacity-50"
                onClick={() => handleVerifyCode()}
                disabled={isVerifyingCode || codeDigits.join('').length !== 6}
                aria-busy={isVerifyingCode}
              >
                {isVerifyingCode ? <Spinner size="sm" className="mr-2" /> : null}
                Verify Code
              </Button>

              <div className="flex items-center justify-between pt-1 text-xs text-slate-400">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={isResending || cooldown > 0}
                  className="hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${isResending ? 'animate-spin' : ''}`} />
                  <span>{cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('CHANGE_EMAIL')}
                  className="hover:text-white flex items-center gap-1 transition-colors cursor-pointer text-[#c79dbd]"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Update email address</span>
                </button>
              </div>
            </div>
          )}

          <div className="w-full pt-2 flex items-center justify-between text-xs text-slate-400">
            <Link to="/login" className="hover:text-white transition-colors">
              &larr; Back to sign in
            </Link>
            <button
              type="button"
              onClick={() => {
                setErrorMessage('');
                setMode('CODE_ENTRY');
              }}
              className="hover:text-white transition-colors text-slate-400"
            >
              Back to code entry
            </button>
          </div>
        </div>
      </AuthLayout>
    );
  }

  // 4. INLINE CHANGE EMAIL MODE
  if (mode === 'CHANGE_EMAIL') {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center justify-center text-center space-y-4 py-2 animate-in fade-in duration-200">
          <div className="w-14 h-14 rounded-xs bg-[#714b67]/20 border border-[#714b67]/30 flex items-center justify-center text-[#c79dbd] mb-0.5">
            <Edit3 className="w-7 h-7" />
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight text-white">Update Email Address</h2>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Did you mistype your email during signup? Enter your correct email below and we'll send a fresh code.
            </p>
          </div>

          <ChangePendingEmailForm
            currentMaskedEmail={displayedEmail}
            isOpen={true}
            onClose={() => setMode('CODE_ENTRY')}
            onSuccess={handleEmailChangeSuccess}
            onSessionExpired={() => navigate('/login')}
          />

          <div className="w-full pt-2 text-center">
            <button
              type="button"
              onClick={() => setMode('CODE_ENTRY')}
              className="text-xs text-slate-400 hover:text-white transition-colors"
            >
              &larr; Back to code entry
            </button>
          </div>
        </div>
      </AuthLayout>
    );
  }

  // 5. STANDARD CODE_ENTRY MODE
  return (
    <AuthLayout>
      <div className="flex flex-col items-center justify-center text-center space-y-5 py-2 animate-in fade-in duration-200">
        <div className="w-14 h-14 rounded-xs bg-[#714b67]/20 border border-[#714b67]/30 flex items-center justify-center text-[#c79dbd] mb-0.5">
          <Mail className="w-7 h-7" />
        </div>

        <div className="space-y-1.5">
          <h2 className="text-2xl font-bold tracking-tight text-white">Verify your email address</h2>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            We sent a 6-digit verification code to
          </p>
          <div className="inline-flex items-center justify-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-200 text-xs bg-white/5 px-2.5 py-1 rounded-xs border border-white/10">
              {displayedEmail}
            </span>
            <button
              type="button"
              onClick={() => setMode('CHANGE_EMAIL')}
              className="text-xs text-[#c79dbd] hover:text-white underline underline-offset-2 transition-colors cursor-pointer inline-flex items-center gap-1"
            >
              <Edit3 className="w-3 h-3" />
              <span>Wrong email? Update address</span>
            </button>
          </div>
        </div>

        {/* 6-Digit Code Input Section */}
        <div className="w-full space-y-3 pt-1">
          <AccessibleOtpInput
            digits={codeDigits}
            onChange={setCodeDigits}
            onComplete={(code) => handleVerifyCode(code)}
            disabled={isVerifyingCode}
            groupAriaLabel="6-digit verification code"
            ariaDescribedBy={attemptsRemaining !== null ? 'code-entry-attempts' : undefined}
          />

          {attemptsRemaining !== null && attemptsRemaining > 0 && (
            <p id="code-entry-attempts" role="alert" className="text-xs text-amber-400 font-medium">
              {attemptsRemaining} attempt{attemptsRemaining === 1 ? '' : 's'} remaining before code is locked.
            </p>
          )}

          <Button
            onClick={() => handleVerifyCode()}
            disabled={isVerifyingCode || codeDigits.join('').length !== 6}
            aria-busy={isVerifyingCode}
            className="w-full h-11 bg-[#714b67] hover:bg-[#86597a] text-white rounded-xs text-xs font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isVerifyingCode ? <Spinner size="sm" className="mr-2" /> : <ShieldCheck className="w-4 h-4 mr-1.5" aria-hidden="true" />}
            Verify Code
          </Button>
        </div>

        {/* Quick Email Client Deep-Links */}
        <div className="w-full grid grid-cols-2 gap-2 pt-1">
          <a
            href="https://mail.google.com"
            target="_blank"
            rel="noreferrer"
            className="h-9 rounded-xs bg-[#160f14] hover:bg-[#22151f] border border-white/10 text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
          >
            <span>Open Gmail</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </a>

          <a
            href="https://outlook.live.com"
            target="_blank"
            rel="noreferrer"
            className="h-9 rounded-xs bg-[#160f14] hover:bg-[#22151f] border border-white/10 text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
          >
            <span>Open Outlook</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </a>
        </div>

        {/* Actions: Resend Code & Update Email Address */}
        <div className="w-full space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <button
              type="button"
              onClick={handleResend}
              disabled={isResending || cooldown > 0}
              className="hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-3 h-3 ${isResending ? 'animate-spin' : ''}`} />
              <span>{cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('CHANGE_EMAIL')}
              className="hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer text-[#c79dbd]"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Update email address</span>
            </button>
          </div>

          {/* Didn't receive code? Expandable Help Section */}
          <div className="w-full pt-1">
            <button
              type="button"
              onClick={() => setShowHelp((prev) => !prev)}
              aria-expanded={showHelp}
              className="w-full py-2.5 px-3 rounded-xs bg-[#140e12]/60 hover:bg-[#140e12] border border-white/5 flex items-center justify-between text-xs text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-[#c79dbd]" aria-hidden="true" />
                Didn't receive the verification code?
              </span>
              {showHelp ? <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" /> : <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />}
            </button>

            {showHelp && (
              <div className="mt-2 p-3 rounded-xs bg-[#100b0f] border border-white/5 text-left text-xs text-slate-300 space-y-1.5 animate-in fade-in duration-150">
                <p>• <strong>Check your Spam or Junk folder</strong> — verification emails sometimes get filtered.</p>
                <p>• <strong>Wait a minute or two</strong> — email deliveries can experience brief network delays.</p>
                <p>• <strong>Double-check your email</strong> — if you entered the wrong address, use the <strong>Wrong email? Update address</strong> link above.</p>
                <p>• <strong>Check corporate firewalls</strong> — some corporate filters hold external automated messages.</p>
              </div>
            )}
          </div>

          <div className="pt-2">
            <Link to="/login" className="text-xs text-slate-400 hover:text-white transition-colors py-1 inline-block focus:outline-hidden focus:underline">
              &larr; Return to sign in
            </Link>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
};
