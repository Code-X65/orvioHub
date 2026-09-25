import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { AuthLayout } from './AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import { Mail, ArrowRight, ArrowLeft, CheckCircle2, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

const maskEmail = (email: string) => {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  const first = local.slice(0, 2);
  const last = local.slice(-1);
  return `${first}••••${last}@${domain}`;
};

export const ForgotPassword: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(60);
  const [isResending, setIsResending] = useState(false);
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);
  const [idempotencyKey] = useState(() => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `idemp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (submittedEmail && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [submittedEmail, countdown]);

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsLoading(true);
    try {
      await api.post(
        '/auth/forgot-password',
        { email: data.email },
        { headers: { 'Idempotency-Key': idempotencyKey } }
      );
      setSubmittedEmail(data.email);
      setCountdown(60);
      toast.success('Password reset instructions sent!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to send reset link. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || isResending || !submittedEmail) return;
    setIsResending(true);
    try {
      const newIdempKey =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `idemp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      await api.post(
        '/auth/forgot-password',
        { email: submittedEmail },
        { headers: { 'Idempotency-Key': newIdempKey } }
      );
      setCountdown(60);
      toast.success('Password reset link resent!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to resend reset link.');
    } finally {
      setIsResending(false);
    }
  };

  if (submittedEmail) {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center justify-center text-center space-y-4 py-2 w-full animate-in fade-in duration-200">
          <div className="w-13 h-13 rounded-xs bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-1">
            <CheckCircle2 className="w-6 h-6" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-2xl font-bold text-white tracking-tight">Check your email</h2>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              If an account matches that email, reset instructions have been sent to:
            </p>
            <div className="pt-1">
              <span className="inline-block font-mono text-xs font-semibold text-slate-200 bg-[#160f14] px-3 py-1 rounded-xs border border-[#2d1b27]">
                {maskEmail(submittedEmail)}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 max-w-xs mx-auto pt-1">
              To protect account privacy, we don't disclose whether an email address is registered.
            </p>
          </div>

          <div className="w-full pt-2 space-y-2.5">
            <Button
              variant="outline"
              type="button"
              onClick={handleResend}
              disabled={countdown > 0 || isResending}
              className="w-full h-10 bg-[#160f14] hover:bg-[#20151c] disabled:opacity-50 border-[#2d1b27] text-white rounded-xs text-xs font-semibold"
            >
              {isResending ? <Spinner size="sm" className="mr-2" /> : null}
              {countdown > 0 ? `Resend link (${countdown}s)` : 'Resend reset link'}
            </Button>

            <Button
              variant="ghost"
              type="button"
              onClick={() => {
                setSubmittedEmail(null);
                setCountdown(60);
              }}
              className="w-full h-9 text-slate-400 hover:text-white rounded-xs text-xs font-medium"
            >
              Try another email
            </Button>

            {/* Troubleshooting guidance */}
            <div className="w-full rounded-xs border border-[#2d1b27] bg-[#120a10]/60 p-3 text-left space-y-2">
              <button
                type="button"
                onClick={() => setShowTroubleshooting(!showTroubleshooting)}
                className="w-full flex items-center justify-between text-xs font-medium text-slate-300 hover:text-white"
              >
                <div className="flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-[#c79dbd]" />
                  <span>Didn't receive the email?</span>
                </div>
                {showTroubleshooting ? (
                  <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                )}
              </button>

              {showTroubleshooting && (
                <ul className="text-[11px] text-slate-400 space-y-1.5 list-disc pl-4 pt-1 animate-in fade-in duration-150">
                  <li>Check your spam, junk, or quarantine folders.</li>
                  <li>Corporate email gateways may delay delivery by 5–10 minutes.</li>
                  <li>Verify you entered your registered work email address.</li>
                  <li>
                    Ensure messages from{' '}
                    <span className="text-slate-300 font-mono">noreply@orviohub.com</span> are permitted.
                  </li>
                </ul>
              )}
            </div>

            <div className="text-center pt-2">
              <Link
                to="/login"
                className="inline-flex items-center text-xs font-semibold text-[#c79dbd] hover:text-white transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                Back to sign in
              </Link>
            </div>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="space-y-5 w-full animate-in fade-in duration-200">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-white tracking-tight">Forgot password?</h2>
          <p className="text-xs text-slate-400">
            Enter your work email and we will send you instructions to reset your password.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="email" className="text-xs font-medium text-slate-300">
              Work email
            </Label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                id="email"
                type="email"
                placeholder="name@company.com"
                {...register('email')}
                className={`pl-10 h-10 bg-[#0a0609] border-[#2d1b27] text-white placeholder:text-slate-600 rounded-xs text-xs focus:ring-1 focus:ring-[#714b67] ${
                  errors.email ? 'border-rose-500/80' : ''
                }`}
                disabled={isLoading}
              />
            </div>
            {errors.email && <p className="text-[11px] text-rose-400">{errors.email.message}</p>}
          </div>

          <Button
            type="submit"
            className="w-full h-11 bg-[#714b67] hover:bg-[#86597a] active:bg-[#603f57] text-white rounded-xs font-semibold text-xs shadow-lg shadow-[#714b67]/25 transition-all flex items-center justify-center gap-2"
            disabled={isLoading}
          >
            {isLoading ? <Spinner size="sm" className="mr-1 text-white" /> : null}
            {isLoading ? (
              'Sending Link...'
            ) : (
              <>
                <span>Send Reset Link</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </Button>
        </form>

        <div className="text-center text-xs text-slate-400 pt-2 border-t border-[#2d1b27]/60">
          Remember your password?{' '}
          <Link to="/login" className="text-[#c79dbd] hover:text-white font-semibold transition-colors">
            Sign in
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
};

