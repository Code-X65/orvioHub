import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { AuthResponse } from '@/lib/types';
import { useAuthStore } from '@/stores/useAuthStore';
import { AuthLayout } from './AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Mail, CheckCircle2, XCircle, ArrowRight, ExternalLink, RefreshCw, Edit3 } from 'lucide-react';
import { toast } from 'sonner';

export const VerifyEmail: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const user = useAuthStore((state) => state.user);
  const initialEmail = location.state?.email || user?.email || '';
  const [emailInput, setEmailInput] = useState(initialEmail);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const email = emailInput || 'your work email';
  const setAuthData = useAuthStore((state) => state.setAuthData);

  const [verificationState, setVerificationState] = useState<'IDLE' | 'LOADING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [errorMessage, setErrorMessage] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (token && verificationState === 'IDLE') {
      verifyToken(token);
    }
  }, [token, verificationState]);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const verifyToken = async (t: string) => {
    setVerificationState('LOADING');
    try {
      const response = await api.post<AuthResponse>('/auth/verify-email', { token: t });
      setAuthData(response);
      setVerificationState('SUCCESS');
      toast.success('Email verified successfully!');

      setTimeout(() => navigate('/welcome', { replace: true }), 1500);
    } catch (error: any) {
      setVerificationState('ERROR');
      setErrorMessage(error.message || 'Failed to verify email. The token may be expired.');
    }
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
      toast.success('A fresh verification link has been sent to your inbox!');
      setCooldown(60);
      setIsEditingEmail(false);
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
          <p className="text-xs text-slate-400">Confirming your verification token.</p>
        </div>
      </AuthLayout>
    );
  }

  if (verificationState === 'SUCCESS') {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center justify-center text-center space-y-4 py-6 animate-in fade-in duration-200">
          <div className="w-14 h-14 rounded-xs bg-emerald-950/80 border border-emerald-500/30 flex items-center justify-center mb-1">
            <CheckCircle2 className="w-7 h-7 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white">Email Verified!</h2>
          <p className="text-xs text-slate-300">Your account is active. Taking you to setup...</p>
          <Button
            onClick={() => navigate('/welcome', { replace: true })}
            className="w-full h-11 bg-[#714b67] hover:bg-[#86597a] text-white rounded-xs text-xs font-semibold"
          >
            <span>Continue to Setup</span>
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
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

          {/* Resend Card */}
          <div className="w-full mt-2 p-4 rounded-sm bg-[#140e12] border border-white/5 text-left space-y-3">
            <p className="text-xs text-slate-300 font-medium">Send a fresh verification link:</p>
            <Input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="name@company.com"
              className="h-10 bg-[#0a0609] border-white/10 text-white rounded-xs text-xs"
            />
            <Button
              className="w-full h-10 bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold rounded-xs"
              onClick={() => handleResend(emailInput)}
              disabled={isResending || cooldown > 0 || !emailInput.trim()}
            >
              {isResending ? <Spinner size="sm" className="mr-2" /> : null}
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Verification Email'}
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

  // IDLE state (Waiting for user to click email link)
  return (
    <AuthLayout>
      <div className="flex flex-col items-center justify-center text-center space-y-5 py-4 animate-in fade-in duration-200">
        <div className="w-16 h-16 rounded-xs bg-[#714b67]/20 border border-[#714b67]/30 flex items-center justify-center text-[#c79dbd] mb-1">
          <Mail className="w-8 h-8" />
        </div>

        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight text-white">Check your email</h2>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            We sent a verification link to <br />
            <span className="font-semibold text-slate-200">{email}</span>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="w-full space-y-3 pt-2">
          {/* Quick Email Client Deep-Links */}
          <div className="grid grid-cols-2 gap-2">
            <a
              href="https://mail.google.com"
              target="_blank"
              rel="noreferrer"
              className="h-10 rounded-xs bg-[#160f14] hover:bg-[#22151f] border border-white/10 text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
            >
              <span>Open Gmail</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>

            <a
              href="https://outlook.live.com"
              target="_blank"
              rel="noreferrer"
              className="h-10 rounded-xs bg-[#160f14] hover:bg-[#22151f] border border-white/10 text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
            >
              <span>Open Outlook</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>
          </div>

          {/* Change email input if needed */}
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
                  className="bg-[#714b67] text-white text-xs rounded-xs h-8"
                >
                  Send Link to New Email
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
            <Button
              variant="outline"
              className="w-full h-11 bg-[#140e12] hover:bg-[#1f151b] border-white/10 text-slate-200 hover:text-white rounded-xs text-xs font-semibold"
              onClick={() => handleResend()}
              disabled={isResending || cooldown > 0}
            >
              {isResending ? <Spinner size="sm" className="mr-2" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
              {cooldown > 0 ? `Resend available in ${cooldown}s` : 'Resend verification email'}
            </Button>
          )}

          <div className="pt-2 flex items-center justify-between text-xs text-slate-400">
            <button
              type="button"
              onClick={() => setIsEditingEmail(true)}
              className="hover:text-white flex items-center gap-1 transition-colors"
            >
              <Edit3 className="w-3 h-3" />
              <span>Wrong email address?</span>
            </button>

            <Link to="/welcome" className="text-[#c79dbd] hover:text-white font-semibold transition-colors">
              Continue to setup →
            </Link>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
};
