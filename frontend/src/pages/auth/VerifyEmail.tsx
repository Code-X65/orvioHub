import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation, useSearchParams, useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { AuthResponse } from '@/lib/types';
import { useAuthStore } from '@/stores/useAuthStore';
import { isValidReturnUrl } from '@/lib/domain';
import { AuthLayout } from './AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
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
} from 'lucide-react';
import { toast } from 'sonner';

export const VerifyEmail: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { tokenParam } = useParams<{ tokenParam?: string }>();
  // Prefer path-segment token (/verify-email/:token) over query param (?token=)
  const token = tokenParam || searchParams.get('token');
  const user = useAuthStore((state) => state.user);
  const emailFromQuery = searchParams.get('email');
  const initialEmail = emailFromQuery || location.state?.email || user?.email || '';
  const [emailInput, setEmailInput] = useState(initialEmail);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const email = emailInput || 'your work email';
  const setAuthData = useAuthStore((state) => state.setAuthData);

  const [verificationState, setVerificationState] = useState<'IDLE' | 'LOADING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [errorMessage, setErrorMessage] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const verifyingRef = useRef(false);

  // 6-digit code inputs
  const [codeDigits, setCodeDigits] = useState<string[]>(['', '', '', '', '', '']);
  const digitInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (verificationState === 'LOADING' || verificationState === 'SUCCESS') {
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
  }, [user?.emailVerified, searchParams, navigate, verificationState]);

  // Cooldown countdown effect
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Auto-focus first digit input on mount if not auto-verifying via URL token
  useEffect(() => {
    if (!token && digitInputRefs.current[0]) {
      digitInputRefs.current[0]?.focus();
    }
  }, [token]);

  // Auto-verify if token is provided in URL
  useEffect(() => {
    if (token && verificationState === 'IDLE' && !verifyingRef.current) {
      verifyingRef.current = true;
      executeVerification({ token });
    }
  }, [token]);

  const executeVerification = async (payload: { token?: string; code?: string; email?: string }) => {
    setVerificationState('LOADING');
    try {
      const response = await api.post<AuthResponse>('/auth/verify-email', payload);

      setAuthData(response);
      setVerificationState('SUCCESS');
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

      // Smooth direct navigation to personal onboarding
      setTimeout(() => {
        navigate('/onboard/personal', { replace: true });
      }, 600);
    } catch (error: any) {
      setVerificationState('ERROR');
      setErrorMessage(error.message || 'Failed to verify email. The code or token may be expired.');
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

  const handleVerifyCode = async () => {
    const fullCode = codeDigits.join('');
    if (fullCode.length !== 6) {
      toast.error('Please enter the complete 6-digit code.');
      return;
    }
    setIsVerifyingCode(true);
    await executeVerification({ code: fullCode, email: emailInput.trim() });
    setIsVerifyingCode(false);
  };

  const handleResend = async (targetEmail?: string) => {
    const toSend = targetEmail || emailInput;
    if (!toSend || !toSend.includes('@')) {
      toast.error('Please enter a valid email address.');
      return;
    }

    setIsResending(true);
    try {
      await api.post('/auth/resend-verification', { email: toSend.trim() });
      toast.success('A fresh verification code and link has been sent to your inbox!');
      setCooldown(60);
      setIsEditingEmail(false);
      setCodeDigits(['', '', '', '', '', '']);
      if (digitInputRefs.current[0]) {
        digitInputRefs.current[0]?.focus();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to resend verification email.');
    } finally {
      setIsResending(false);
    }
  };

  if (verificationState === 'LOADING') {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center justify-center text-center space-y-4 py-8">
          <Spinner size="lg" className="text-[#714b67]" />
          <h2 className="text-xl font-bold text-white">Verifying your email...</h2>
          <p className="text-xs text-slate-400">Confirming your verification code.</p>
        </div>
      </AuthLayout>
    );
  }

  if (verificationState === 'SUCCESS') {
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

  if (verificationState === 'ERROR') {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center justify-center text-center space-y-4 py-6 animate-in fade-in duration-200">
          <div className="w-14 h-14 rounded-xs bg-rose-950/80 border border-rose-500/30 flex items-center justify-center mb-1">
            <XCircle className="w-7 h-7 text-rose-400" />
          </div>
          <h2 className="text-2xl font-bold text-white">Verification Failed</h2>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">{errorMessage}</p>

          {/* Try again with code input */}
          <div className="w-full mt-2 p-4 rounded-sm bg-[#140e12] border border-white/5 text-left space-y-3">
            <p className="text-xs text-slate-300 font-medium">Try entering the 6-digit code again:</p>
            <div className="flex items-center justify-between gap-1.5" onPaste={handleDigitPaste}>
              {codeDigits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => {
                    digitInputRefs.current[idx] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                  className="w-10 h-11 text-center text-lg font-bold bg-[#0a0609] border border-white/10 rounded-xs text-white focus:outline-none focus:border-[#c79dbd] focus:ring-1 focus:ring-[#c79dbd]"
                />
              ))}
            </div>
            <Button
              className="w-full h-10 bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold rounded-xs"
              onClick={handleVerifyCode}
              disabled={isVerifyingCode || codeDigits.join('').length !== 6}
            >
              {isVerifyingCode ? <Spinner size="sm" className="mr-2" /> : null}
              Verify Code
            </Button>
          </div>

          {/* Resend Card */}
          <div className="w-full p-4 rounded-sm bg-[#140e12] border border-white/5 text-left space-y-3">
            <p className="text-xs text-slate-300 font-medium">Or request a fresh code to your email:</p>
            <Input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="name@company.com"
              className="h-10 bg-[#0a0609] border-white/10 text-white rounded-xs text-xs"
            />
            <Button
              variant="outline"
              className="w-full h-10 bg-transparent hover:bg-white/5 border-white/10 text-white text-xs font-semibold rounded-xs"
              onClick={() => handleResend(emailInput)}
              disabled={isResending || cooldown > 0 || !emailInput.trim()}
            >
              {isResending ? <Spinner size="sm" className="mr-2" /> : null}
              {cooldown > 0 ? `Resend available in ${cooldown}s` : 'Resend Verification Email'}
            </Button>
          </div>

          <div className="w-full pt-2">
            <Link to="/login" className="text-xs text-slate-400 hover:text-white transition-colors">
              &larr; Back to sign in
            </Link>
          </div>
        </div>
      </AuthLayout>
    );
  }

  // IDLE state (Standard verification screen)
  return (
    <AuthLayout>
      <div className="flex flex-col items-center justify-center text-center space-y-5 py-2 animate-in fade-in duration-200">
        <div className="w-14 h-14 rounded-xs bg-[#714b67]/20 border border-[#714b67]/30 flex items-center justify-center text-[#c79dbd] mb-0.5">
          <Mail className="w-7 h-7" />
        </div>

        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight text-white">Verify your email address</h2>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            We sent a 6-digit verification code to <br />
            <span className="font-semibold text-slate-200">{email}</span>
          </p>
        </div>

        {/* 6-Digit Code Input Section */}
        <div className="w-full space-y-3 pt-1">
          <div className="flex items-center justify-center gap-2" onPaste={handleDigitPaste}>
            {codeDigits.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => {
                  digitInputRefs.current[idx] = el;
                }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleDigitChange(idx, e.target.value)}
                onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                className="w-11 h-12 text-center text-xl font-bold bg-[#140e12] border border-white/10 rounded-xs text-white focus:outline-none focus:border-[#c79dbd] focus:ring-1 focus:ring-[#c79dbd] transition-all"
              />
            ))}
          </div>

          <Button
            onClick={handleVerifyCode}
            disabled={isVerifyingCode || codeDigits.join('').length !== 6}
            className="w-full h-11 bg-[#714b67] hover:bg-[#86597a] text-white rounded-xs text-xs font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isVerifyingCode ? <Spinner size="sm" className="mr-2" /> : <ShieldCheck className="w-4 h-4 mr-1.5" />}
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

        {/* Change Email or Resend */}
        <div className="w-full space-y-3">
          {isEditingEmail ? (
            <div className="p-3 rounded-sm bg-[#140e12] border border-white/5 space-y-2 text-left">
              <Label className="text-xs text-slate-300 font-medium">Update Email Address</Label>
              <Input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="new@company.com"
                className="h-9 bg-[#0a0609] border-white/10 text-white rounded-xs text-xs"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => handleResend(emailInput)}
                  disabled={isResending}
                  className="bg-[#714b67] text-white text-xs rounded-xs h-8"
                >
                  {isResending ? <Spinner size="sm" className="mr-1.5" /> : null}
                  Send Code to New Email
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsEditingEmail(false)}
                  className="text-xs text-slate-400 h-8"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <button
                type="button"
                onClick={() => handleResend()}
                disabled={isResending || cooldown > 0}
                className="hover:text-white flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-3 h-3 ${isResending ? 'animate-spin' : ''}`} />
                <span>{cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsEditingEmail(true)}
                className="hover:text-white flex items-center gap-1 transition-colors"
              >
                <Edit3 className="w-3 h-3" />
                <span>Change email</span>
              </button>
            </div>
          )}

          {/* Didn't receive code? Expandable Help Section */}
          <div className="w-full pt-1">
            <button
              type="button"
              onClick={() => setShowHelp((prev) => !prev)}
              className="w-full py-2 px-3 rounded-xs bg-[#140e12]/60 hover:bg-[#140e12] border border-white/5 flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-[#c79dbd]" />
                Didn't receive the verification code?
              </span>
              {showHelp ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showHelp && (
              <div className="mt-2 p-3 rounded-xs bg-[#100b0f] border border-white/5 text-left text-xs text-slate-400 space-y-1.5 animate-in fade-in duration-150">
                <p>• <strong>Check your Spam or Junk folder</strong> — verification emails sometimes get filtered.</p>
                <p>• <strong>Wait a minute or two</strong> — email deliveries can experience brief network delays.</p>
                <p>• <strong>Double-check your email</strong> — make sure there are no typographical errors above.</p>
                <p>• <strong>Check corporate firewalls</strong> — some company firewalls temporarily hold external automated messages.</p>
              </div>
            )}
          </div>

          <div className="pt-2">
            <Link to="/login" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
              &larr; Return to sign in
            </Link>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
};
