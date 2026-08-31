import React, { useState } from 'react';
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
import { Mail, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export const ForgotPassword: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: data.email });
      setSubmittedEmail(data.email);
      toast.success('Password reset instructions sent!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to send reset link. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (submittedEmail) {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center justify-center text-center space-y-5 py-4 w-full animate-in fade-in duration-200">
          <div className="w-14 h-14 rounded-xs bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-1">
            <CheckCircle2 className="w-7 h-7" />
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-white tracking-tight">Check your email</h2>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              We've sent a password reset link to <br />
              <span className="font-semibold text-slate-200">{submittedEmail}</span>
            </p>
          </div>

          <div className="w-full pt-3 space-y-3">
            <Button
              variant="outline"
              type="button"
              onClick={() => setSubmittedEmail(null)}
              className="w-full h-11 bg-[#160f14] hover:bg-[#20151c] border-[#2d1b27] text-white rounded-xs text-xs font-semibold"
            >
              Try another email
            </Button>

            <div className="text-center pt-2">
              <Link
                to="/login"
                className="inline-flex items-center text-xs font-semibold text-[#c79dbd] hover:text-white"
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
            {isLoading ? 'Sending Link...' : (
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
