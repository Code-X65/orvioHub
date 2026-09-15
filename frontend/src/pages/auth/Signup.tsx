import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, API_BASE_URL } from '@/lib/api';
import { AuthLayout } from './AuthLayout';
import { PasswordStrength } from '@/components/auth/PasswordStrength';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Phone,
  Globe,
} from 'lucide-react';

const signupSchema = z
  .object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    email: z.string().email('Please enter a valid work email address'),
    country: z.string().min(1, 'Country is required'),
    phone: z.string().optional(),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Must contain at least one number')
      .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character'),
    passwordConfirmation: z.string().min(1, 'Please confirm your password'),
    agreeTerms: z.boolean().refine((val) => val === true, {
      message: 'You must accept the Terms of Service',
    }),
    acknowledgePrivacy: z.boolean().refine((val) => val === true, {
      message: 'You must acknowledge the Privacy Policy',
    }),
    marketingConsent: z.boolean().optional(),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: 'Passwords do not match',
    path: ['passwordConfirmation'],
  });

type SignupFormData = z.infer<typeof signupSchema>;

export const Signup: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedProduct = searchParams.get('product') || 'inventory';
  const returnTo = searchParams.get('return_to') || searchParams.get('returnTo') || '/workspaces';

  const [isLoading, setIsLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google' | 'facebook' | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isValid },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    mode: 'onChange',
    defaultValues: {
      country: 'Nigeria',
      phone: '',
      agreeTerms: true,
      acknowledgePrivacy: true,
      marketingConsent: false,
    },
  });

  const passwordValue = watch('password') || '';

  const onSubmit = async (data: SignupFormData) => {
    setIsLoading(true);
    try {
      const name = `${data.firstName.trim()} ${data.lastName.trim()}`;

      let formattedPhone: string | undefined = undefined;
      if (data.phone?.trim()) {
        const rawDigits = data.phone.trim().replace(/\D/g, '');
        if (rawDigits.length > 0) {
          if (rawDigits.startsWith('234')) {
            formattedPhone = `+${rawDigits}`;
          } else if (rawDigits.startsWith('0')) {
            formattedPhone = `+234${rawDigits.slice(1)}`;
          } else {
            formattedPhone = `+234${rawDigits}`;
          }
        }
      }

      await api.post('/auth/signup', {
        name,
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        displayName: name,
        email: data.email.trim().toLowerCase(),
        country: data.country || 'Nigeria',
        phone: formattedPhone,
        password: data.password,
        passwordConfirmation: data.passwordConfirmation,
        acceptTerms: data.agreeTerms,
        acceptPrivacy: data.acknowledgePrivacy,
        marketingConsent: data.marketingConsent ?? false,
        selectedProduct,
      });

      toast.success('Account created! Please verify your email.');
      navigate('/verify-email', {
        state: { email: data.email, returnTo, product: selectedProduct },
      });
    } catch (error: any) {
      toast.error(error.message || 'Failed to create account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialAuth = (provider: 'google' | 'facebook') => {
    setSocialLoading(provider);
    const endpoint = `${API_BASE_URL}/auth/${provider}?returnTo=${encodeURIComponent(returnTo)}&product=${selectedProduct}`;
    window.location.href = endpoint;
  };

  return (
    <AuthLayout>
      <div className="w-full max-w-[420px] mx-auto space-y-5 animate-in fade-in duration-200">
        {/* Header and Welcome Copy */}
        <div className="space-y-2 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Create your Orviohub account
          </h1>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            Your account lets you securely sign in, manage your profile, and access Orviohub applications. You can create an organization, join one by invitation, or continue without an organization and decide later.
          </p>
        </div>

        {/* Social Authentication: Google, Facebook */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Google */}
          <Button
            variant="outline"
            type="button"
            onClick={() => handleSocialAuth('google')}
            disabled={isLoading || !!socialLoading}
            className="w-full h-10 bg-[#160f14] hover:bg-[#20151c] border border-white/10 hover:border-white/20 text-slate-200 hover:text-white rounded-xs text-xs font-medium flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-sm"
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
            <span>Google</span>
          </Button>

          {/* Facebook */}
          <Button
            variant="outline"
            type="button"
            onClick={() => handleSocialAuth('facebook')}
            disabled={isLoading || !!socialLoading}
            className="w-full h-10 bg-[#160f14] hover:bg-[#20151c] border border-white/10 hover:border-white/20 text-slate-200 hover:text-white rounded-xs text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
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

        <div className="relative my-3">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/5"></div>
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-3 bg-black text-slate-500 font-medium uppercase tracking-wider text-[10px]">
              or work email
            </span>
          </div>
        </div>

        {/* Direct Account Registration Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
          {/* First & Last Name */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <Label htmlFor="firstName" className="text-xs font-medium text-slate-300">
                First name
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <Input
                  id="firstName"
                  placeholder="Mary"
                  {...register('firstName')}
                  className={`pl-9 h-10 bg-[#0e0a0d] border-white/10 text-white placeholder:text-slate-600 rounded-xs text-xs focus:ring-1 focus:ring-[#714b67] ${errors.firstName ? 'border-rose-500/80' : ''}`}
                  disabled={isLoading || !!socialLoading}
                />
              </div>
              {errors.firstName && <p className="text-[11px] text-rose-400">{errors.firstName.message}</p>}
            </div>

            <div className="space-y-1">
              <Label htmlFor="lastName" className="text-xs font-medium text-slate-300">
                Last name
              </Label>
              <Input
                id="lastName"
                placeholder="Johnson"
                {...register('lastName')}
                className={`h-10 bg-[#0e0a0d] border-white/10 text-white placeholder:text-slate-600 rounded-xs text-xs focus:ring-1 focus:ring-[#714b67] ${errors.lastName ? 'border-rose-500/80' : ''}`}
                disabled={isLoading || !!socialLoading}
              />
              {errors.lastName && <p className="text-[11px] text-rose-400">{errors.lastName.message}</p>}
            </div>
          </div>

          {/* Email Address */}
          <div className="space-y-1">
            <Label htmlFor="email" className="text-xs font-medium text-slate-300">
              Email address
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <Input
                id="email"
                type="email"
                placeholder="mary.johnson@example.com"
                {...register('email')}
                className={`pl-9 h-10 bg-[#0e0a0d] border-white/10 text-white placeholder:text-slate-600 rounded-xs text-xs focus:ring-1 focus:ring-[#714b67] ${errors.email ? 'border-rose-500/80' : ''}`}
                disabled={isLoading || !!socialLoading}
              />
            </div>
            {errors.email && <p className="text-[11px] text-rose-400">{errors.email.message}</p>}
          </div>

          {/* Country & Phone Number */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <Label htmlFor="country" className="text-xs font-medium text-slate-300 flex items-center justify-between">
                <span>Country</span>
                <span className="text-[10px] text-[#c79dbd] font-normal">Nigeria only</span>
              </Label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <select
                  id="country"
                  defaultValue="Nigeria"
                  disabled
                  className="w-full pl-9 pr-3 h-10 bg-[#0e0a0d]/70 border border-white/10 text-slate-200 rounded-xs text-xs cursor-not-allowed select-none appearance-none opacity-90 focus:outline-none"
                >
                  <option value="Nigeria">Nigeria 🇳🇬</option>
                </select>
                <input type="hidden" {...register('country')} value="Nigeria" />
              </div>
              {errors.country && <p className="text-[11px] text-rose-400">{errors.country.message}</p>}
            </div>

            <div className="space-y-1">
              <Label htmlFor="phone" className="text-xs font-medium text-slate-300 flex items-center justify-between">
                <span>Phone number</span>
                <span className="text-[10px] text-slate-500 font-normal">Optional</span>
              </Label>
              <div
                className={`relative flex items-center h-10 bg-[#0e0a0d] border border-white/10 rounded-xs text-xs transition-all focus-within:ring-1 focus-within:ring-[#714b67] focus-within:border-[#714b67] ${
                  errors.phone ? 'border-rose-500/80' : ''
                }`}
              >
                <div className="flex items-center gap-1.5 pl-3 pr-2.5 h-full border-r border-white/10 text-slate-300 select-none shrink-0 bg-white/[0.02]">
                  <Phone className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-xs font-medium text-slate-200">+234</span>
                </div>
                <input
                  id="phone"
                  type="tel"
                  placeholder="801 234 5678"
                  {...register('phone')}
                  className="w-full h-full bg-transparent px-3 text-white placeholder:text-slate-600 text-xs focus:outline-none disabled:opacity-50"
                  disabled={isLoading || !!socialLoading}
                />
              </div>
              {errors.phone && <p className="text-[11px] text-rose-400">{errors.phone.message}</p>}
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1">
            <Label htmlFor="password" className="text-xs font-medium text-slate-300">
              Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••••••"
                {...register('password')}
                className={`pl-9 pr-9 h-10 bg-[#0e0a0d] border-white/10 text-white placeholder:text-slate-600 rounded-xs text-xs focus:ring-1 focus:ring-[#714b67] ${errors.password ? 'border-rose-500/80' : ''}`}
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
            <PasswordStrength password={passwordValue} showRequirements={false} />
            {errors.password && <p className="text-[11px] text-rose-400">{errors.password.message}</p>}
          </div>

          {/* Password Confirmation */}
          <div className="space-y-1">
            <Label htmlFor="passwordConfirmation" className="text-xs font-medium text-slate-300">
              Confirm password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <Input
                id="passwordConfirmation"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="••••••••••••"
                {...register('passwordConfirmation')}
                className={`pl-9 pr-9 h-10 bg-[#0e0a0d] border-white/10 text-white placeholder:text-slate-600 rounded-xs text-xs focus:ring-1 focus:ring-[#714b67] ${errors.passwordConfirmation ? 'border-rose-500/80' : ''}`}
                disabled={isLoading || !!socialLoading}
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
            {errors.passwordConfirmation && (
              <p className="text-[11px] text-rose-400">{errors.passwordConfirmation.message}</p>
            )}
          </div>

          {/* Terms of Service (Required) */}
          <div className="flex items-start space-x-2 pt-1">
            <Checkbox
              id="agreeTerms"
              defaultChecked={true}
              {...register('agreeTerms')}
              className="mt-0.5 border-white/10 data-[state=checked]:bg-[#714b67] data-[state=checked]:border-[#714b67] rounded-xs"
            />
            <label htmlFor="agreeTerms" className="text-[11px] text-slate-400 select-none leading-tight">
              I agree to the{' '}
              <a href="#terms" className="text-[#c79dbd] hover:underline">
                Terms of Service
              </a>
              .
            </label>
          </div>
          {errors.agreeTerms && (
            <p className="text-[11px] text-rose-400">{errors.agreeTerms.message}</p>
          )}

          {/* Privacy Policy Acknowledgement (Required) */}
          <div className="flex items-start space-x-2">
            <Checkbox
              id="acknowledgePrivacy"
              defaultChecked={true}
              {...register('acknowledgePrivacy')}
              className="mt-0.5 border-white/10 data-[state=checked]:bg-[#714b67] data-[state=checked]:border-[#714b67] rounded-xs"
            />
            <label htmlFor="acknowledgePrivacy" className="text-[11px] text-slate-400 select-none leading-tight">
              I acknowledge the{' '}
              <a href="#privacy" className="text-[#c79dbd] hover:underline">
                Privacy Policy
              </a>
              .
            </label>
          </div>
          {errors.acknowledgePrivacy && (
            <p className="text-[11px] text-rose-400">{errors.acknowledgePrivacy.message}</p>
          )}

          {/* Marketing Consent (Optional - Separate from Terms & Privacy) */}
          <div className="flex items-start space-x-2">
            <Checkbox
              id="marketingConsent"
              defaultChecked={false}
              {...register('marketingConsent')}
              className="mt-0.5 border-white/10 data-[state=checked]:bg-[#714b67] data-[state=checked]:border-[#714b67] rounded-xs"
            />
            <label htmlFor="marketingConsent" className="text-[11px] text-slate-400 select-none leading-tight">
              Send me occasional product updates, operational insights, and announcements (optional).
            </label>
          </div>

          {/* Primary Submit Button */}
          <Button
            type="submit"
            className="w-full h-11 mt-2 bg-[#714b67] hover:bg-[#86597a] active:bg-[#603f57] text-white rounded-xs font-semibold text-xs shadow-lg shadow-[#714b67]/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading || !!socialLoading || !isValid}
          >
            {isLoading ? (
              <Spinner size="sm" className="text-white" />
            ) : (
              <>
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Create Orviohub Account</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </Button>
        </form>

        <div className="text-center text-xs text-slate-400 pt-2 border-t border-white/5">
          Already have an account?{' '}
          <Link
            to={`/login?product=${selectedProduct}&return_to=${encodeURIComponent(returnTo)}`}
            className="text-[#c79dbd] hover:text-white font-semibold transition-colors"
          >
            Sign in
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
};
