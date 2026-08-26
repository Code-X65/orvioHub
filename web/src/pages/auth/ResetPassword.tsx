import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
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
import { Lock, EyeOff, Eye, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';

const resetPasswordSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!token) {
      toast.error('Missing reset token. Please request a new password reset link.');
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/auth/reset-password', {
        token,
        password: data.password,
      });
      setIsSuccess(true);
      toast.success('Password reset successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to reset password. The link may have expired.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center justify-center text-center space-y-5 py-4 w-full animate-in fade-in duration-200">
          <div className="w-14 h-14 rounded-xs bg-rose-950/60 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-1">
            <AlertCircle className="w-7 h-7" />
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-white tracking-tight">Invalid Reset Link</h2>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              This password reset link is invalid or has expired. Please request a new one.
            </p>
          </div>

          <div className="w-full pt-3 space-y-3">
            <Button
              type="button"
              onClick={() => navigate('/forgot-password')}
              className="w-full h-11 bg-[#714b67] hover:bg-[#86597a] text-white rounded-xs font-semibold text-xs shadow-md shadow-[#714b67]/25"
            >
              Request new link
            </Button>
            <div className="text-center pt-2">
              <Link to="/login" className="text-xs font-semibold text-[#c79dbd] hover:text-white">
                Back to sign in
              </Link>
            </div>
          </div>
        </div>
      </AuthLayout>
    );
  }

  if (isSuccess) {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center justify-center text-center space-y-5 py-4 w-full animate-in fade-in duration-200">
          <div className="w-14 h-14 rounded-xs bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-1">
            <CheckCircle2 className="w-7 h-7" />
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-white tracking-tight">Password Reset!</h2>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Your password has been successfully updated. You can now sign in with your new password.
            </p>
          </div>

          <div className="w-full pt-3">
            <Button
              type="button"
              onClick={() => navigate('/login')}
              className="w-full h-11 bg-[#714b67] hover:bg-[#86597a] text-white rounded-xs font-semibold text-xs shadow-md shadow-[#714b67]/25 flex items-center justify-center gap-2"
            >
              <span>Sign In to Your Account</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="space-y-5 w-full animate-in fade-in duration-200">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-white tracking-tight">Create new password</h2>
          <p className="text-xs text-slate-400">
            Please enter your new password below (minimum 8 characters).
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
          <div className="space-y-1">
            <Label htmlFor="password" className="text-xs font-medium text-slate-300">
              New Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••••••"
                {...register('password')}
                className={`pl-10 pr-10 h-10 bg-[#0a0609] border-[#2d1b27] text-white placeholder:text-slate-600 rounded-xs text-xs focus:ring-1 focus:ring-[#714b67] ${
                  errors.password ? 'border-rose-500/80' : ''
                }`}
                disabled={isLoading}
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

          <div className="space-y-1">
            <Label htmlFor="confirmPassword" className="text-xs font-medium text-slate-300">
              Confirm New Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="••••••••••••"
                {...register('confirmPassword')}
                className={`pl-10 pr-10 h-10 bg-[#0a0609] border-[#2d1b27] text-white placeholder:text-slate-600 rounded-xs text-xs focus:ring-1 focus:ring-[#714b67] ${
                  errors.confirmPassword ? 'border-rose-500/80' : ''
                }`}
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1"
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-[11px] text-rose-400">{errors.confirmPassword.message}</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full h-11 mt-2 bg-[#714b67] hover:bg-[#86597a] active:bg-[#603f57] text-white rounded-xs font-semibold text-xs shadow-lg shadow-[#714b67]/25 transition-all flex items-center justify-center gap-2"
            disabled={isLoading}
          >
            {isLoading ? <Spinner size="sm" className="mr-1 text-white" /> : null}
            {isLoading ? 'Updating password...' : (
              <>
                <span>Update Password</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </Button>
        </form>

        <div className="text-center text-xs text-slate-400 pt-2 border-t border-[#2d1b27]/60">
          Back to{' '}
          <Link to="/login" className="text-[#c79dbd] hover:text-white font-semibold transition-colors">
            Sign in
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
};
