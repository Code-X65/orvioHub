import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, API_BASE_URL } from '@/lib/api';
import {
  getPendingSignup,
  setPendingSignup,
  clearPendingSignup,
  generateIdempotencyKey,
  fetchServerIdempotencyKey,
} from '@/lib/pendingSignup';
import { AuthLayout } from './AuthLayout';
import { PasswordStrength } from '@/components/auth/PasswordStrength';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Spinner } from '@/components/ui/spinner';
import { CountryPicker } from '@/components/common/CountryPicker';
import { toast } from 'sonner';
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Phone,
  Globe,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

export const COUNTRIES = [
  { code: 'NG', name: 'Nigeria', dialCode: '+234', flag: '🇳🇬' },
  { code: 'US', name: 'United States', dialCode: '+1', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', dialCode: '+44', flag: '🇬🇧' },
  { code: 'CA', name: 'Canada', dialCode: '+1', flag: '🇨🇦' },
  { code: 'GH', name: 'Ghana', dialCode: '+233', flag: '🇬🇭' },
  { code: 'KE', name: 'Kenya', dialCode: '+254', flag: '🇰🇪' },
  { code: 'ZA', name: 'South Africa', dialCode: '+27', flag: '🇿🇦' },
  { code: 'AE', name: 'United Arab Emirates', dialCode: '+971', flag: '🇦🇪' },
  { code: 'IN', name: 'India', dialCode: '+91', flag: '🇮🇳' },
  { code: 'AU', name: 'Australia', dialCode: '+61', flag: '🇦🇺' },
  { code: 'DE', name: 'Germany', dialCode: '+49', flag: '🇩🇪' },
  { code: 'FR', name: 'France', dialCode: '+33', flag: '🇫🇷' },
  { code: 'IE', name: 'Ireland', dialCode: '+353', flag: '🇮🇪' },
  { code: 'RW', name: 'Rwanda', dialCode: '+250', flag: '🇷🇼' },
  { code: 'EG', name: 'Egypt', dialCode: '+20', flag: '🇪🇬' },
] as const;

// Country and phone are made optional so users are not blocked before email verification
const signupSchema = z
  .object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    email: z.string().email('Please enter a valid work email address'),
    country: z.string().optional(),
    phone: z.string().optional(),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Must contain at least one number')
      .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character'),
    passwordConfirmation: z.string().optional(),
    agreeTerms: z.boolean().refine((val) => val === true, {
      message: 'You must accept the Terms of Service to continue.',
    }),
    acknowledgePrivacy: z.boolean().refine((val) => val === true, {
      message: 'You must acknowledge the Privacy Policy to continue.',
    }),
    marketingConsent: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (!data.passwordConfirmation) return true;
      return data.password === data.passwordConfirmation;
    },
    {
      message: 'Passwords do not match',
      path: ['passwordConfirmation'],
    }
  );

type SignupFormData = z.infer<typeof signupSchema>;

interface EmailAvailabilityState {
  status: 'idle' | 'checking' | 'available' | 'registered' | 'pending_verification' | 'invalid';
  message?: string;
}

export const Signup: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedProduct = searchParams.get('product') || 'inventory';
  const returnTo = searchParams.get('return_to') || searchParams.get('returnTo') || '/workspaces';

  // Multi-step progressive disclosure (Step 1: Credentials, Step 2: Region & Consents)
  const [step, setStep] = useState<1 | 2>(1);

  const [isLoading, setIsLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google' | 'facebook' | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [existingPending, setExistingPending] = useState(() => getPendingSignup());
  const [networkRecovery, setNetworkRecovery] = useState<{ email: string } | null>(null);

  // Server-issued idempotency key state
  const [serverIdempotencyKey, setServerIdempotencyKey] = useState<string>('');

  // Rate limiting cooldown state (backend: 10 attempts/min)
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);

  // Inline email availability state
  const [emailCheck, setEmailCheck] = useState<EmailAvailabilityState>({ status: 'idle' });

  // Social authentication error fallback detection
  const socialErrorParam = searchParams.get('error') || searchParams.get('social_error');
  const [socialError, setSocialError] = useState<string | null>(() => {
    if (!socialErrorParam) return null;
    const messages: Record<string, string> = {
      OAUTH_NOT_CONFIGURED: 'Social sign-in is temporarily unavailable. Please register with your work email below.',
      OAUTH_STATE_INVALID: 'Security validation expired or was invalid. Please register with your email below.',
      OAUTH_ACCESS_DENIED: 'Social authorization was cancelled. You can register directly with your email below.',
      OAUTH_EMAIL_UNVERIFIED: 'Your social account email is not verified. Please register with your work email below.',
      OAUTH_ACCOUNT_CONFLICT: 'An account with this email exists. Please sign in or register with another email.',
    };
    return messages[socialErrorParam] || 'Social authentication was not completed. Please register directly with your email below.';
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    trigger,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    mode: 'onChange',
    defaultValues: {
      firstName: '',
      lastName: '',
      email: searchParams.get('email') || '',
      country: 'Nigeria',
      phone: '',
      password: '',
      passwordConfirmation: '',
      agreeTerms: false,
      acknowledgePrivacy: false,
      marketingConsent: false,
    },
  });

  const emailValue = watch('email') || '';
  const selectedCountry = watch('country') || 'Nigeria';
  const currentCountryMeta =
    COUNTRIES.find((c) => c.name === selectedCountry || c.code === selectedCountry) || COUNTRIES[0];
  const passwordValue = watch('password') || '';

  // 1. Fetch server-issued idempotency key on mount
  useEffect(() => {
    let isMounted = true;
    fetchServerIdempotencyKey().then((key) => {
      if (isMounted && key) {
        setServerIdempotencyKey(key);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Cooldown timer countdown
  useEffect(() => {
    if (cooldownRemaining <= 0) return;
    const timer = setInterval(() => {
      setCooldownRemaining((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownRemaining]);

  // 3. Debounced inline email availability checker
  const checkEmailAvailability = useCallback(async (emailToTest: string) => {
    const trimmed = emailToTest.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!trimmed || !emailRegex.test(trimmed)) {
      setEmailCheck({ status: 'idle' });
      return;
    }

    setEmailCheck({ status: 'checking' });
    try {
      const res: any = await api.get(`/auth/check-email?email=${encodeURIComponent(trimmed)}`);
      if (res?.available) {
        setEmailCheck({ status: 'available', message: 'Email is available' });
      } else if (res?.status === 'pending_verification') {
        setEmailCheck({
          status: 'pending_verification',
          message: 'An account is already pending verification for this email.',
        });
      } else {
        setEmailCheck({
          status: 'registered',
          message: 'An account with this email already exists.',
        });
      }
    } catch {
      // In case of network issue or offline, don't hard block user typing
      setEmailCheck({ status: 'idle' });
    }
  }, []);

  useEffect(() => {
    const trimmed = emailValue.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setEmailCheck({ status: 'idle' });
      return;
    }

    const timer = setTimeout(() => {
      checkEmailAvailability(trimmed);
    }, 450);

    return () => clearTimeout(timer);
  }, [emailValue, checkEmailAvailability]);

  // 4. Handle Step 1 -> Step 2 progression
  const handleProceedToStep2 = async () => {
    const step1Valid = await trigger(['firstName', 'lastName', 'email', 'password']);
    if (!step1Valid) return;

    if (emailCheck.status === 'registered') {
      toast.error('This email is already in use. Please sign in instead.');
      return;
    }

    setStep(2);
  };

  // 5. Form submission handler
  const onSubmit = async (data: SignupFormData) => {
    setIsLoading(true);
    setNetworkRecovery(null);
    const normEmail = data.email.trim().toLowerCase();
    const name = `${data.firstName.trim()} ${data.lastName.trim()}`;

    // Prefer existing pending key if recovering, otherwise server-issued key, fallback to local UUID
    const idempotencyKey =
      existingPending?.email === normEmail
        ? existingPending.idempotencyKey
        : (serverIdempotencyKey || generateIdempotencyKey());

    try {
      let formattedPhone: string | undefined = undefined;
      if (data.phone?.trim()) {
        const rawDigits = data.phone.trim().replace(/\D/g, '');
        if (rawDigits.length > 0) {
          const dialDigits = currentCountryMeta.dialCode.replace(/\D/g, '');
          if (rawDigits.startsWith(dialDigits)) {
            formattedPhone = `+${rawDigits}`;
          } else if (rawDigits.startsWith('0')) {
            formattedPhone = `${currentCountryMeta.dialCode}${rawDigits.slice(1)}`;
          } else {
            formattedPhone = `${currentCountryMeta.dialCode}${rawDigits}`;
          }
        }
      }

      const res: any = await api.post(
        '/auth/signup',
        {
          name,
          firstName: data.firstName.trim(),
          lastName: data.lastName.trim(),
          displayName: name,
          email: normEmail,
          country: data.country || undefined,
          phone: formattedPhone,
          password: data.password,
          passwordConfirmation: data.passwordConfirmation || undefined,
          acceptTerms: data.agreeTerms,
          acceptPrivacy: data.acknowledgePrivacy,
          marketingConsent: data.marketingConsent ?? false,
          selectedProduct,
        },
        {
          headers: {
            'Idempotency-Key': idempotencyKey,
          },
        }
      );

      // Store non-sensitive pending info for 7-day extended recovery
      setPendingSignup({
        email: normEmail,
        name,
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        idempotencyKey,
        selectedProduct,
        returnTo,
      });

      if (res?.action === 'CONTINUE_VERIFICATION') {
        toast.info(res.message || 'Account already registered and awaiting verification. A new code has been sent!');
      } else {
        toast.success('Account created! Please verify your email.');
      }

      navigate('/verify-email', {
        state: { email: normEmail, returnTo, product: selectedProduct },
      });
    } catch (error: any) {
      if (error?.status === 429 || error?.statusCode === 429 || error?.code === 'RATE_LIMIT_EXCEEDED') {
        const retrySec = Number(error?.retryAfter) || 60;
        setCooldownRemaining(retrySec);
        toast.error(`Rate limit reached (10 requests/min). Please wait ${retrySec}s.`);
        return;
      }

      // Clear any pending signup so orphaned client state does not persist on failure
      clearPendingSignup();
      setExistingPending(null);

      if (error?.status === 409 || error?.code === 'USER_ALREADY_EXISTS') {
        toast.error('An account with this email already exists and is active. Please sign in instead.');
      } else {
        setNetworkRecovery({ email: normEmail });
        toast.error(error.message || 'Network error occurred. Please check your connection and retry.');
      }
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
      <div className="w-full max-w-[440px] mx-auto space-y-5 animate-in fade-in duration-200">
        {/* Header & Step Indicator */}
        <div className="space-y-2 text-center">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/10 text-[11px] text-slate-300 font-medium mb-1">
            <span className={`w-2 h-2 rounded-full ${step === 1 ? 'bg-[#c79dbd] animate-pulse' : 'bg-emerald-400'}`} />
            <span>Step {step} of 2: {step === 1 ? 'Account Credentials' : 'Region & Consents'}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Create your Orviohub account
          </h1>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            {step === 1
              ? 'Enter your name, work email, and create a secure password to get started.'
              : 'Add optional region details and review required agreements to finalize.'}
          </p>
        </div>

        {/* Social Authentication Fallback Alert (when redirected from failed social login) */}
        {socialError && (
          <div className="p-3.5 rounded-sm bg-amber-950/40 border border-amber-500/30 text-left space-y-1.5 animate-in fade-in">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-1.5 text-amber-200 text-xs font-semibold">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                <span>Social Sign-In Unavailable</span>
              </div>
              <button
                type="button"
                onClick={() => setSocialError(null)}
                className="text-[11px] text-amber-400 hover:text-white cursor-pointer"
              >
                Dismiss
              </button>
            </div>
            <p className="text-[11px] text-amber-300/80 leading-relaxed">
              {socialError}
            </p>
          </div>
        )}

        {/* Existing Pending Signup Recovery Banner (7-Day Extended Expiry) */}
        {existingPending && (
          <div className="p-3.5 rounded-sm bg-[#22151e] border border-[#714b67]/40 text-left space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-white">Pending verification detected</p>
                <p className="text-[11px] text-slate-300">
                  You previously registered <span className="text-[#e2b9d8] font-medium">{existingPending.email}</span>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  clearPendingSignup();
                  setExistingPending(null);
                }}
                className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer"
              >
                Dismiss
              </button>
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                onClick={() =>
                  navigate('/verify-email', {
                    state: { email: existingPending.email, returnTo: existingPending.returnTo, product: existingPending.selectedProduct },
                  })
                }
                className="h-7 bg-[#714b67] hover:bg-[#86597a] text-white text-[11px] rounded-xs font-medium cursor-pointer"
              >
                Continue to Verification
              </Button>
            </div>
          </div>
        )}

        {/* Network Error Recovery Banner */}
        {networkRecovery && (
          <div className="p-3.5 rounded-sm bg-amber-950/40 border border-amber-500/30 text-left space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-amber-200">Network connection interrupted</p>
                <p className="text-[11px] text-amber-300/80">
                  Your signup request for <span className="font-medium text-amber-100">{networkRecovery.email}</span> could not reach the server. Please click Retry below.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNetworkRecovery(null)}
                className="text-[11px] text-amber-400 hover:text-amber-200 underline cursor-pointer"
              >
                Dismiss
              </button>
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setNetworkRecovery(null);
                  handleSubmit(onSubmit)();
                }}
                className="h-7 bg-[#714b67] hover:bg-[#86597a] text-white text-[11px] rounded-xs font-medium cursor-pointer"
              >
                Retry Sign Up
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  navigate('/verify-email', {
                    state: { email: networkRecovery.email, returnTo, product: selectedProduct },
                  })
                }
                className="h-7 bg-transparent border-amber-500/40 hover:bg-amber-900/30 text-amber-200 text-[11px] rounded-xs font-medium cursor-pointer"
              >
                Try Verification (if sent)
              </Button>
            </div>
          </div>
        )}

        {/* STEP 1: Account Credentials */}
        {step === 1 && (
          <div className="space-y-4">
            {/* Social Authentication: Google, Facebook */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <Button
                variant="outline"
                type="button"
                onClick={() => handleSocialAuth('google')}
                disabled={isLoading || !!socialLoading}
                aria-label="Sign up with Google"
                className="w-full min-h-[44px] bg-[#160f14] hover:bg-[#20151c] border border-white/10 hover:border-white/20 text-slate-200 hover:text-white rounded-xs text-xs font-medium flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-sm"
              >
                {socialLoading === 'google' ? (
                  <Spinner size="sm" className="text-white" />
                ) : (
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                )}
                <span>Google</span>
              </Button>

              <Button
                variant="outline"
                type="button"
                onClick={() => handleSocialAuth('facebook')}
                disabled={isLoading || !!socialLoading}
                aria-label="Sign up with Facebook"
                className="w-full min-h-[44px] bg-[#160f14] hover:bg-[#20151c] border border-white/10 hover:border-white/20 text-slate-200 hover:text-white rounded-xs text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
              >
                {socialLoading === 'facebook' ? (
                  <Spinner size="sm" className="text-white" />
                ) : (
                  <svg className="w-3.5 h-3.5 fill-[#1877F2] shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                )}
                <span>Facebook</span>
              </Button>
            </div>

            <div className="relative my-3" aria-hidden="true">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-3 bg-black text-slate-300 font-medium uppercase tracking-wider text-[10px]">
                  or work email
                </span>
              </div>
            </div>

            {/* Direct Account Credentials Form */}
            <div className="space-y-3.5 text-left">
              {/* First & Last Name */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label htmlFor="firstName" className="text-xs font-medium text-slate-200">
                    First name
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                    <Input
                      id="firstName"
                      placeholder="Mary"
                      aria-invalid={Boolean(errors.firstName)}
                      aria-describedby={errors.firstName ? 'firstName-error' : undefined}
                      {...register('firstName')}
                      className={`pl-9 h-11 bg-[#0e0a0d] border-white/10 text-white placeholder:text-slate-500 rounded-xs text-xs focus:ring-1 focus:ring-[#714b67] ${errors.firstName ? 'border-rose-500/80' : ''}`}
                      disabled={isLoading || !!socialLoading}
                    />
                  </div>
                  {errors.firstName && (
                    <p id="firstName-error" role="alert" className="text-[11px] text-rose-400 font-medium">
                      {errors.firstName.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="lastName" className="text-xs font-medium text-slate-200">
                    Last name
                  </Label>
                  <Input
                    id="lastName"
                    placeholder="Johnson"
                    aria-invalid={Boolean(errors.lastName)}
                    aria-describedby={errors.lastName ? 'lastName-error' : undefined}
                    {...register('lastName')}
                    className={`h-11 bg-[#0e0a0d] border-white/10 text-white placeholder:text-slate-500 rounded-xs text-xs focus:ring-1 focus:ring-[#714b67] ${errors.lastName ? 'border-rose-500/80' : ''}`}
                    disabled={isLoading || !!socialLoading}
                  />
                  {errors.lastName && (
                    <p id="lastName-error" role="alert" className="text-[11px] text-rose-400 font-medium">
                      {errors.lastName.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Work Email Address with Inline Real-time Checker */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="email" className="text-xs font-medium text-slate-200">
                    Work email address
                  </Label>
                  {emailCheck.status === 'checking' && (
                    <span className="flex items-center gap-1 text-[10px] text-slate-300">
                      <Spinner size="sm" className="w-3 h-3 text-slate-300" />
                      Checking availability...
                    </span>
                  )}
                  {emailCheck.status === 'available' && (
                    <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                      <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                      Available
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="mary.johnson@example.com"
                    aria-invalid={Boolean(errors.email || emailCheck.status === 'registered')}
                    aria-describedby={errors.email ? 'email-error' : undefined}
                    {...register('email')}
                    className={`pl-9 h-11 bg-[#0e0a0d] border-white/10 text-white placeholder:text-slate-500 rounded-xs text-xs focus:ring-1 focus:ring-[#714b67] ${
                      errors.email || emailCheck.status === 'registered' ? 'border-rose-500/80' : ''
                    }`}
                    disabled={isLoading || !!socialLoading}
                  />
                </div>
                {errors.email && (
                  <p id="email-error" role="alert" className="text-[11px] text-rose-400 font-medium">
                    {errors.email.message}
                  </p>
                )}

                {/* Inline Email Feedback */}
                {emailCheck.status === 'registered' && (
                  <div role="alert" className="flex items-center justify-between p-2 rounded-xs bg-rose-950/40 border border-rose-500/30 text-[11px] text-rose-300">
                    <span>An account with this email already exists.</span>
                    <Link
                      to={`/login?email=${encodeURIComponent(emailValue)}&product=${selectedProduct}`}
                      className="font-semibold text-rose-200 hover:text-white underline ml-2 py-0.5"
                    >
                      Sign in instead
                    </Link>
                  </div>
                )}
                {emailCheck.status === 'pending_verification' && (
                  <div role="alert" className="flex items-center justify-between p-2 rounded-xs bg-amber-950/40 border border-amber-500/30 text-[11px] text-amber-300">
                    <span>Account registered and awaiting verification.</span>
                    <button
                      type="button"
                      onClick={() =>
                        navigate('/verify-email', {
                          state: { email: emailValue.trim().toLowerCase(), returnTo, product: selectedProduct },
                        })
                      }
                      className="font-semibold text-amber-200 hover:text-white underline ml-2 cursor-pointer py-0.5"
                    >
                      Verify code
                    </button>
                  </div>
                )}
              </div>

              {/* Password with Show/Hide toggle and Real-time Requirement Checklist */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-medium text-slate-200">
                    Password
                  </Label>
                  <span className="text-[10px] text-slate-400 font-normal">Min. 8 characters</span>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={errors.password ? 'password-error' : undefined}
                    {...register('password')}
                    className={`pl-9 pr-10 h-11 bg-[#0e0a0d] border-white/10 text-white placeholder:text-slate-500 rounded-xs text-xs focus:ring-1 focus:ring-[#714b67] ${
                      errors.password ? 'border-rose-500/80' : ''
                    }`}
                    disabled={isLoading || !!socialLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-2 min-w-[36px] min-h-[36px] flex items-center justify-center cursor-pointer rounded-xs focus:outline-hidden focus:ring-1 focus:ring-[#714b67]"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
                  </button>
                </div>

                {/* Dynamic Password Strength & Real-time Live Requirements Checklist */}
                <PasswordStrength password={passwordValue} showRequirements={true} />
                {errors.password && (
                  <p id="password-error" role="alert" className="text-[11px] text-rose-400 font-medium">
                    {errors.password.message}
                  </p>
                )}
              </div>

              {/* Step 1 Continue Button */}
              <Button
                type="button"
                onClick={handleProceedToStep2}
                disabled={emailCheck.status === 'registered' || emailCheck.status === 'pending_verification'}
                className="w-full h-11 mt-3 bg-[#714b67] hover:bg-[#86597a] active:bg-[#603f57] text-white rounded-xs font-semibold text-xs shadow-lg shadow-[#714b67]/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: Region, Contact & Consents */}
        {step === 2 && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-left">
            {/* Step Navigation Back Button */}
            <div className="flex items-center justify-between pb-1 border-b border-white/5">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to credentials</span>
              </button>
              <span className="text-[11px] text-slate-500">{emailValue}</span>
            </div>

            {/* Optional Region & Contact Details Card */}
            <div className="p-3.5 rounded-sm bg-[#120c10] border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                  <Globe className="w-3.5 h-3.5 text-[#c79dbd]" />
                  <span>Region & Contact</span>
                </div>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 bg-white/[0.04] px-1.5 py-0.5 rounded-xs border border-white/5">
                  Optional
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                You can configure your country and phone number now, or set them up later in your profile.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Country (Searchable accessible picker with 44px+ touch targets) */}
                <div className="space-y-1">
                  <Label htmlFor="country" className="text-xs font-medium text-slate-200">
                    Country
                  </Label>
                  <CountryPicker
                    id="country"
                    value={selectedCountry}
                    onChange={(countryName) => setValue('country', countryName)}
                    disabled={isLoading}
                  />
                </div>

                {/* Phone */}
                <div className="space-y-1">
                  <Label htmlFor="phone" className="text-xs font-medium text-slate-200 flex items-center justify-between">
                    <span>Phone number</span>
                    <span className="text-[10px] text-slate-400 font-normal">Optional</span>
                  </Label>
                  <div className="relative flex items-center h-11 bg-[#0e0a0d] border border-white/10 rounded-xs text-xs transition-all focus-within:ring-1 focus-within:ring-[#714b67] focus-within:border-[#714b67]">
                    <div className="flex items-center gap-1.5 pl-3 pr-2.5 h-full border-r border-white/10 text-slate-300 select-none shrink-0 bg-white/[0.02]">
                      <Phone className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                      <span className="text-xs font-medium text-slate-200">{currentCountryMeta.dialCode}</span>
                    </div>
                    <input
                      id="phone"
                      type="tel"
                      placeholder="801 234 5678"
                      {...register('phone')}
                      className="w-full h-full bg-transparent px-3 text-white placeholder:text-slate-500 text-xs focus:outline-hidden disabled:opacity-50"
                      disabled={isLoading}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Legal Agreements (Required) */}
            <div className="space-y-2 pt-1">
              <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider text-[10px]">
                Legal & Compliance (Required)
              </span>

              {/* Terms of Service */}
              <div className="flex items-start space-x-2 pt-0.5">
                <Controller
                  name="agreeTerms"
                  control={control}
                  render={({ field }) => (
                    <Checkbox
                      id="agreeTerms"
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                      aria-invalid={Boolean(errors.agreeTerms)}
                      aria-describedby={errors.agreeTerms ? 'agreeTerms-error' : undefined}
                      className="mt-0.5 border-white/20 data-[state=checked]:bg-[#714b67] data-[state=checked]:border-[#714b67] rounded-xs"
                    />
                  )}
                />
                <label htmlFor="agreeTerms" className="text-[11px] text-slate-200 select-none leading-tight cursor-pointer py-0.5">
                  I agree to the{' '}
                  <Link
                    to="/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#c79dbd] hover:underline focus:outline-hidden focus:underline"
                  >
                    Terms of Service
                  </Link>
                  .
                </label>
              </div>
              {errors.agreeTerms && (
                <p id="agreeTerms-error" role="alert" className="text-[11px] text-rose-400 pl-6 font-medium">
                  {errors.agreeTerms.message}
                </p>
              )}

              {/* Privacy Policy */}
              <div className="flex items-start space-x-2">
                <Controller
                  name="acknowledgePrivacy"
                  control={control}
                  render={({ field }) => (
                    <Checkbox
                      id="acknowledgePrivacy"
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                      aria-invalid={Boolean(errors.acknowledgePrivacy)}
                      aria-describedby={errors.acknowledgePrivacy ? 'acknowledgePrivacy-error' : undefined}
                      className="mt-0.5 border-white/20 data-[state=checked]:bg-[#714b67] data-[state=checked]:border-[#714b67] rounded-xs"
                    />
                  )}
                />
                <label htmlFor="acknowledgePrivacy" className="text-[11px] text-slate-200 select-none leading-tight cursor-pointer py-0.5">
                  I acknowledge the{' '}
                  <Link
                    to="/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#c79dbd] hover:underline focus:outline-hidden focus:underline"
                  >
                    Privacy Policy
                  </Link>
                  .
                </label>
              </div>
              {errors.acknowledgePrivacy && (
                <p id="acknowledgePrivacy-error" role="alert" className="text-[11px] text-rose-400 pl-6 font-medium">
                  {errors.acknowledgePrivacy.message}
                </p>
              )}
            </div>

            {/* Marketing Consent (Visually Separated - Distinct Optional Card - GDPR Compliant) */}
            <div className="p-3 rounded-sm bg-[#160f15]/80 border border-white/5 space-y-1.5">
              <div className="flex items-start space-x-2.5">
                <Controller
                  name="marketingConsent"
                  control={control}
                  render={({ field }) => (
                    <Checkbox
                      id="marketingConsent"
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                      className="mt-0.5 border-white/20 data-[state=checked]:bg-[#714b67] data-[state=checked]:border-[#714b67] rounded-xs"
                    />
                  )}
                />
                <div className="space-y-0.5">
                  <label htmlFor="marketingConsent" className="text-xs font-medium text-slate-200 select-none leading-tight cursor-pointer flex items-center gap-1.5 py-0.5">
                    <Sparkles className="w-3 h-3 text-[#c79dbd]" aria-hidden="true" />
                    <span>Product Updates & Insights</span>
                    <span className="text-[10px] font-normal text-slate-300 bg-white/5 px-1 rounded-xs">
                      Optional
                    </span>
                  </label>
                  <p className="text-[11px] text-slate-300 leading-snug">
                    Send me occasional feature announcements, security updates, and operational insights. You can unsubscribe at any time.
                  </p>
                </div>
              </div>
            </div>

            {/* Primary Submit Button with Rate-Limit Cooldown Protection */}
            <div className="space-y-2 pt-2">
              <Button
                type="submit"
                aria-busy={isLoading}
                className="w-full h-11 bg-[#714b67] hover:bg-[#86597a] active:bg-[#603f57] text-white rounded-xs font-semibold text-xs shadow-lg shadow-[#714b67]/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLoading || cooldownRemaining > 0}
              >
                {isLoading ? (
                  <Spinner size="sm" className="text-white" />
                ) : cooldownRemaining > 0 ? (
                  <span>Please wait {cooldownRemaining}s (Rate limit)</span>
                ) : (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Create Orviohub Account</span>
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </>
                )}
              </Button>
              <p className="text-[10px] text-center text-slate-400">
                Rate-limit protected (10 attempts/min) • Server-secured idempotency
              </p>
            </div>
          </form>
        )}

        {/* Global Footer */}
        <div className="text-center text-xs text-slate-300 pt-2 border-t border-white/5">
          Already have an account?{' '}
          <Link
            to={`/login?product=${selectedProduct}&return_to=${encodeURIComponent(returnTo)}`}
            className="text-[#c79dbd] hover:text-white font-semibold transition-colors py-1 inline-block focus:outline-hidden focus:underline"
          >
            Sign in
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
};
