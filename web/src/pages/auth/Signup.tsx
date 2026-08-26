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
  ArrowLeft,
  Globe,
} from 'lucide-react';

const signupSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Please enter a valid work email address'),
  country: z.string().default('NG'),
  phone: z.string().optional(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character'),
  agreeTerms: z.boolean().refine((val) => val === true, {
    message: 'You must accept the Terms of Service & Privacy Policy',
  }),
});

type SignupFormData = z.infer<typeof signupSchema>;

const COUNTRIES = [
  { code: 'NG', name: 'Nigeria (+234)', flag: '🇳🇬' },
  { code: 'GH', name: 'Ghana (+233)', flag: '🇬🇭' },
  { code: 'KE', name: 'Kenya (+254)', flag: '🇰🇪' },
  { code: 'ZA', name: 'South Africa (+27)', flag: '🇿🇦' },
  { code: 'GB', name: 'United Kingdom (+44)', flag: '🇬🇧' },
  { code: 'US', name: 'United States (+1)', flag: '🇺🇸' },
  { code: 'CA', name: 'Canada (+1)', flag: '🇨🇦' },
];

interface AppChoice {
  id: string;
  name: string;
  description: string;
  isAvailable: boolean;
  icon: React.ReactNode;
}

const APPS_CATALOG: AppChoice[] = [
  {
    id: 'accounting',
    name: 'Accounting',
    description: 'Double-entry bookkeeping, multi-currency tax & instant P&L reporting.',
    isAvailable: false,
    icon: (
      <svg viewBox="0 0 64 64" className="w-full h-full max-w-[50px] max-h-[50px]">
        <circle cx="27" cy="24" r="10" fill="#F59E0B" />
        <circle cx="39" cy="40" r="10" fill="#14B8A6" />
        <rect x="26" y="6" width="12" height="52" rx="6" fill="#935a87" transform="rotate(45 32 32)" />
      </svg>
    ),
  },
  {
    id: 'knowledge',
    name: 'Knowledge',
    description: 'Centralized team wiki, SOPs, documentation & enterprise search.',
    isAvailable: false,
    icon: (
      <svg viewBox="0 0 64 64" className="w-full h-full max-w-[50px] max-h-[50px]">
        <path d="M19 16 H35 V48 L27 42 L19 48 Z" fill="#935a87" />
        <path d="M27 12 H43 V44 L35 38 L27 44 Z" fill="#14B8A6" opacity="0.9" />
      </svg>
    ),
  },
  {
    id: 'sign',
    name: 'Sign',
    description: 'Cryptographic digital signatures & document approval flows.',
    isAvailable: false,
    icon: (
      <svg viewBox="0 0 64 64" className="w-full h-full max-w-[50px] max-h-[50px]">
        <path d="M17 41 C 19 27, 26 19, 33 19 C 37 19, 37 27, 30 35 C 26 41, 22 43, 34 43 C 44 43, 47 37, 47 33" fill="none" stroke="#06B6D4" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="38" y1="35" x2="47" y2="35" stroke="#06B6D4" strokeWidth="4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'crm',
    name: 'CRM',
    description: 'Visual deal pipeline, customer interaction history & lead scoring.',
    isAvailable: false,
    icon: (
      <svg viewBox="0 0 64 64" className="w-full h-full max-w-[50px] max-h-[50px]">
        <path d="M14 26 L28 40 L36 32 L22 18 Z" fill="#14B8A6" />
        <path d="M50 26 L36 40 L28 32 L42 18 Z" fill="#EC4899" />
        <circle cx="32" cy="36" r="4.5" fill="#935a87" />
      </svg>
    ),
  },
  {
    id: 'studio',
    name: 'Studio',
    description: 'No-code custom fields, automated triggers & screen designer.',
    isAvailable: false,
    icon: (
      <svg viewBox="0 0 64 64" className="w-full h-full max-w-[50px] max-h-[50px]">
        <path d="M18 18 L46 46 M46 18 L18 46" stroke="#A855F7" strokeWidth="6" strokeLinecap="round" />
        <circle cx="18" cy="18" r="5" fill="#06B6D4" />
        <circle cx="46" cy="46" r="5" fill="#EC4899" />
        <circle cx="46" cy="18" r="5" fill="#06B6D4" />
        <circle cx="18" cy="46" r="5" fill="#EC4899" />
      </svg>
    ),
  },
  {
    id: 'subscriptions',
    name: 'Subscriptions',
    description: 'Recurring billing cycles, dunning management & MRR telemetry.',
    isAvailable: false,
    icon: (
      <svg viewBox="0 0 64 64" className="w-full h-full max-w-[50px] max-h-[50px]">
        <path d="M20 32 A 12 12 0 0 1 38 22" fill="none" stroke="#F97316" strokeWidth="5" strokeLinecap="round" />
        <circle cx="38" cy="22" r="3.5" fill="#F97316" />
        <path d="M44 32 A 12 12 0 0 1 26 42" fill="none" stroke="#10B981" strokeWidth="5" strokeLinecap="round" />
        <circle cx="26" cy="42" r="3.5" fill="#10B981" />
      </svg>
    ),
  },
  {
    id: 'ai',
    name: 'AI',
    description: 'Autonomous copilot for inventory predictions, sales & reports.',
    isAvailable: false,
    icon: (
      <svg viewBox="0 0 64 64" className="w-full h-full max-w-[50px] max-h-[50px]">
        <defs>
          <linearGradient id="aiGradSignup" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#A855F7" />
            <stop offset="50%" stopColor="#EC4899" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
        </defs>
        <text x="32" y="44" fontSize="26" fontWeight="900" fontFamily="system-ui" textAnchor="middle" fill="url(#aiGradSignup)">
          AI
        </text>
      </svg>
    ),
  },
  {
    id: 'pos',
    name: 'Point of Sale',
    description: 'Fast barcode checkout, cash drawer shifts & offline resilience.',
    isAvailable: true,
    icon: (
      <svg viewBox="0 0 64 64" className="w-full h-full max-w-[50px] max-h-[50px]">
        <path d="M16 26 L22 42 H42 L48 26 Z" fill="#8B5CF6" />
        <path d="M14 26 Q 32 30 50 26 L46 20 H18 Z" fill="#F59E0B" />
        <line x1="26" y1="20" x2="26" y2="42" stroke="#4C1D95" strokeWidth="2" />
        <line x1="38" y1="20" x2="38" y2="42" stroke="#4C1D95" strokeWidth="2" />
      </svg>
    ),
  },
  {
    id: 'discuss',
    name: 'Discuss',
    description: 'Team direct messages, channel threads & audio huddles.',
    isAvailable: false,
    icon: (
      <svg viewBox="0 0 64 64" className="w-full h-full max-w-[50px] max-h-[50px]">
        <path d="M18 20 Q 32 16 46 20 Q 48 34 38 42 L 34 48 L 30 42 Q 16 40 18 20 Z" fill="#F97316" />
      </svg>
    ),
  },
  {
    id: 'documents',
    name: 'Documents',
    description: 'Cloud document management, folders & version control.',
    isAvailable: false,
    icon: (
      <svg viewBox="0 0 64 64" className="w-full h-full max-w-[50px] max-h-[50px]">
        <rect x="25" y="16" width="21" height="29" rx="3" fill="#F59E0B" transform="rotate(10 35 31)" />
        <rect x="18" y="18" width="21" height="29" rx="3" fill="#06B6D4" />
      </svg>
    ),
  },
  {
    id: 'project',
    name: 'Project',
    description: 'Agile Kanban boards, sprint backlogs & task assignments.',
    isAvailable: false,
    icon: (
      <svg viewBox="0 0 64 64" className="w-full h-full max-w-[50px] max-h-[50px]">
        <path d="M18 34 L 28 44 L 46 22" fill="none" stroke="#06B6D4" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M22 38 L 28 44 L 38 30" fill="none" stroke="#A855F7" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'timesheets',
    name: 'Timesheets',
    description: 'Stopwatch timer, employee hours & billable project rates.',
    isAvailable: false,
    icon: (
      <svg viewBox="0 0 64 64" className="w-full h-full max-w-[50px] max-h-[50px]">
        <circle cx="32" cy="34" r="16" stroke="#0284C7" strokeWidth="4" fill="#0C1B2A" />
        <line x1="32" y1="34" x2="42" y2="24" stroke="#F43F5E" strokeWidth="3" strokeLinecap="round" />
        <circle cx="32" cy="34" r="2.5" fill="#FFFFFF" />
      </svg>
    ),
  },
  {
    id: 'invoicing',
    name: 'Invoicing',
    description: 'Instant PDF invoices, automated payment reminders & receipts.',
    isAvailable: false,
    icon: (
      <svg viewBox="0 0 64 64" className="w-full h-full max-w-[50px] max-h-[50px]">
        <path d="M34 14 L 18 34 H 30 L 26 50 L 46 28 H 32 Z" fill="#F59E0B" />
        <path d="M34 14 L 28 26 H 38 Z" fill="#A855F7" />
      </svg>
    ),
  },
  {
    id: 'inventory',
    name: 'Inventory',
    description: 'Multi-branch stock tracking, barcodes & automated reordering.',
    isAvailable: true,
    icon: (
      <svg viewBox="0 0 64 64" className="w-full h-full max-w-[50px] max-h-[50px]">
        <rect x="18" y="24" width="12" height="16" rx="2" fill="#F59E0B" />
        <rect x="34" y="24" width="12" height="16" rx="2" fill="#06B6D4" />
        <polygon points="26,20 22,24 26,28" fill="#F59E0B" />
        <polygon points="38,36 42,40 38,44" fill="#06B6D4" />
      </svg>
    ),
  },
  {
    id: 'healthcare',
    name: 'Healthcare',
    description: 'Patient records, clinical appointments & medical inventory.',
    isAvailable: false,
    icon: (
      <svg viewBox="0 0 64 64" className="w-full h-full max-w-[50px] max-h-[50px]">
        <rect x="28" y="16" width="8" height="32" rx="3" fill="#10B981" />
        <rect x="16" y="28" width="32" height="8" rx="3" fill="#06B6D4" />
      </svg>
    ),
  },
  {
    id: 'purchase',
    name: 'Purchase',
    description: 'Supplier purchase orders, goods receipts & vendor management.',
    isAvailable: false,
    icon: (
      <svg viewBox="0 0 64 64" className="w-full h-full max-w-[50px] max-h-[50px]">
        <path d="M20 26 L24 44 H40 L44 26 Z" fill="#714b67" />
        <path d="M26 26 A 6 6 0 0 1 38 26" fill="none" stroke="#A78BFA" strokeWidth="3" />
      </svg>
    ),
  },
  {
    id: 'manufacturing',
    name: 'Manufacturing',
    description: 'Bills of Materials (BOM), work orders & shopfloor scheduling.',
    isAvailable: false,
    icon: (
      <svg viewBox="0 0 64 64" className="w-full h-full max-w-[50px] max-h-[50px]">
        <path d="M16 26 C 24 18, 40 18, 48 26 C 40 34, 24 34, 16 26 Z" fill="#06B6D4" />
        <path d="M16 38 C 24 30, 40 30, 48 38 C 40 46, 24 46, 16 38 Z" fill="#3B82F6" />
      </svg>
    ),
  },
  {
    id: 'marketing',
    name: 'Marketing',
    description: 'Email campaigns, SMS marketing & automated subscriber lists.',
    isAvailable: false,
    icon: (
      <svg viewBox="0 0 64 64" className="w-full h-full max-w-[50px] max-h-[50px]">
        <polygon points="16,34 48,16 36,48 30,36" fill="#8B5CF6" />
        <polygon points="30,36 48,16 36,48" fill="#3B82F6" opacity="0.8" />
      </svg>
    ),
  },
];

export const Signup: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlProduct = searchParams.get('product');
  const returnTo = searchParams.get('return_to') || searchParams.get('returnTo') || '/app/inventory';

  // Step 1: Select Primary App, Step 2: Account Form
  const [step, setStep] = useState<1 | 2>(urlProduct ? 2 : 1);
  const [selectedAppId, setSelectedAppId] = useState<string>(urlProduct || 'inventory');
  const [hoveredAppId, setHoveredAppId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google' | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      country: 'NG',
      agreeTerms: true,
    },
  });

  const passwordValue = watch('password') || '';
  const activeApp = APPS_CATALOG.find((a) => a.id === selectedAppId) || APPS_CATALOG.find((a) => a.id === 'inventory')!;

  const handleAppClick = (app: AppChoice) => {
    if (!app.isAvailable) {
      toast.info(`${app.name} is coming soon! Please select Inventory & POS to start your free trial today.`);
      return;
    }
    setSelectedAppId(app.id);
    setStep(2);
  };

  const onSubmit = async (data: SignupFormData) => {
    setIsLoading(true);
    try {
      const name = `${data.firstName.trim()} ${data.lastName.trim()}`;
      await api.post('/auth/signup', {
        name,
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        displayName: name,
        email: data.email.trim().toLowerCase(),
        country: data.country,
        phone: data.phone?.trim() || undefined,
        password: data.password,
        acceptTerms: true,
        selectedProduct: selectedAppId,
      });

      toast.success('Account created! Please verify your email.');
      navigate('/verify-email', {
        state: { email: data.email, returnTo: `/app/${selectedAppId}`, product: selectedAppId },
      });
    } catch (error: any) {
      toast.error(error.message || 'Failed to create account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialAuth = (provider: 'google') => {
    setSocialLoading(provider);
    const endpoint = `${API_BASE_URL}/auth/${provider}?returnTo=${encodeURIComponent(`/app/${selectedAppId}`)}&product=${selectedAppId}`;
    window.location.href = endpoint;
  };

  return (
    <AuthLayout fullWidth={step === 1}>
      {/* STEP 1: CHOOSE YOUR FIRST APP (LANDING PAGE STYLE APPS GRID) */}
      {step === 1 && (
        <div className="w-full flex flex-col items-center text-center animate-in fade-in duration-200">
          {/* Header text */}
          <div className="max-w-2xl mx-auto mb-10">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white tracking-tight leading-tight">
              Choose your first app
            </h1>
            <p className="text-sm sm:text-base text-slate-300 mt-2">
              Free 14-day trial for your entire team. No credit card required.
            </p>
          </div>

          {/* 18 App Tiles Grid matching landing page */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-x-6 sm:gap-x-10 md:gap-x-12 gap-y-8 sm:gap-y-10 justify-items-center w-full max-w-[1200px] mx-auto pb-12">
            {APPS_CATALOG.map((app) => {
              const isHovered = hoveredAppId === app.id;
              return (
                <div
                  key={app.id}
                  className="relative flex flex-col items-center group"
                  onMouseEnter={() => setHoveredAppId(app.id)}
                  onMouseLeave={() => setHoveredAppId(null)}
                >
                  {/* Interactive Popover Tooltip with micro-animation */}
                  {isHovered && (
                    <div className="absolute bottom-full mb-3 w-52 p-3 rounded-sm bg-[#181116] border border-white/10 text-left shadow-2xl shadow-black z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-150">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-xs font-bold text-white">{app.name}</span>
                        {app.isAvailable ? (
                          <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/80 px-1.5 py-0.2 rounded-xs border border-emerald-500/30">
                            Available
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-[#c79dbd] bg-[#251521] px-1.5 py-0.2 rounded-xs border border-[#44253b]">
                            Coming Soon
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        {app.description}
                      </p>
                      {app.isAvailable && (
                        <div className="mt-1.5 text-[10px] text-emerald-300 font-semibold flex items-center gap-1">
                          <span>Click to start free trial →</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* App Icon Tile */}
                  <button
                    type="button"
                    onClick={() => handleAppClick(app)}
                    className={`w-[68px] h-[68px] sm:w-[78px] sm:h-[78px] md:w-[84px] md:h-[84px] rounded-[22px] flex items-center justify-center transition-all duration-200 p-3 sm:p-4 shadow-md ${
                      app.isAvailable
                        ? 'bg-[#141417] hover:bg-[#20141d] border border-white/[0.08] hover:border-[#714b67]/60 group-hover:scale-105 group-hover:shadow-xl group-hover:shadow-[#714b67]/25 cursor-pointer ring-2 ring-transparent hover:ring-[#714b67]/50'
                        : 'bg-[#121215]/60 border border-white/[0.04] opacity-70 hover:opacity-90 cursor-not-allowed'
                    }`}
                  >
                    {app.icon}
                  </button>

                  {/* App Label */}
                  <span className="mt-2.5 text-xs sm:text-[13px] font-medium text-slate-200 group-hover:text-white transition-colors text-center truncate max-w-[95px]">
                    {app.name}
                  </span>

                  {!app.isAvailable && (
                    <span className="text-[9px] text-slate-500 font-medium tracking-tight">
                      Coming soon
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer sign in link */}
          <div className="text-center text-xs text-slate-400 pt-4">
            Already have an account?{' '}
            <Link
              to={`/login?product=inventory&return_to=${encodeURIComponent(returnTo)}`}
              className="text-[#c79dbd] hover:text-white font-semibold transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>
      )}

      {/* STEP 2: ACCOUNT CREATION FORM (CLEAN & BORDER-MINIMAL) */}
      {step === 2 && (
        <div className="w-full max-w-[420px] mx-auto space-y-5 animate-in fade-in duration-200">
          {/* Top Bar with Selected App and Change Button */}
          <div className="flex items-center justify-between pb-3 border-b border-white/5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-sm bg-[#160f14] border border-white/10 flex items-center justify-center p-1.5">
                {activeApp.icon}
              </div>
              <div>
                <div className="text-xs font-bold text-white leading-tight">{activeApp.name}</div>
                <div className="text-[10px] text-emerald-400">14-Day Free Trial</div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-xs font-medium text-[#c79dbd] hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Change app</span>
            </button>
          </div>

          <div className="space-y-1 text-center">
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Create your account
            </h2>
            <p className="text-xs text-slate-400">
              Set up your master credentials to access {activeApp.name}.
            </p>
          </div>

          {/* Social Google Sign-in */}
          <Button
            variant="outline"
            type="button"
            onClick={() => handleSocialAuth('google')}
            disabled={isLoading || !!socialLoading}
            className="w-full h-11 bg-[#160f14] hover:bg-[#20151c] border-white/10 hover:border-white/20 text-slate-200 hover:text-white rounded-xs text-xs font-medium flex items-center justify-center gap-2.5 transition-all cursor-pointer"
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
                or work email
              </span>
            </div>
          </div>

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
                    placeholder="Alex"
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
                  placeholder="Taylor"
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
                Work email address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <Input
                  id="email"
                  type="email"
                  placeholder="alex@company.com"
                  {...register('email')}
                  className={`pl-9 h-10 bg-[#0e0a0d] border-white/10 text-white placeholder:text-slate-600 rounded-xs text-xs focus:ring-1 focus:ring-[#714b67] ${errors.email ? 'border-rose-500/80' : ''}`}
                  disabled={isLoading || !!socialLoading}
                />
              </div>
              {errors.email && <p className="text-[11px] text-rose-400">{errors.email.message}</p>}
            </div>

            {/* Country Selection */}
            <div className="space-y-1">
              <Label htmlFor="country" className="text-xs font-medium text-slate-300">
                Country
              </Label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                <select
                  id="country"
                  {...register('country')}
                  className="w-full pl-9 pr-4 h-10 bg-[#0e0a0d] border border-white/10 text-white rounded-xs text-xs focus:ring-1 focus:ring-[#714b67] focus:outline-none cursor-pointer appearance-none"
                  disabled={isLoading || !!socialLoading}
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code} className="bg-[#120b10] text-white">
                      {c.flag} {c.name}
                    </option>
                  ))}
                </select>
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

            {/* Terms Agreement */}
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
                </a>{' '}
                and{' '}
                <a href="#privacy" className="text-[#c79dbd] hover:underline">
                  Privacy Policy
                </a>
                .
              </label>
            </div>
            {errors.agreeTerms && (
              <p className="text-[11px] text-rose-400">{errors.agreeTerms.message}</p>
            )}

            {/* Primary Submit Button */}
            <Button
              type="submit"
              className="w-full h-11 mt-2 bg-[#714b67] hover:bg-[#86597a] active:bg-[#603f57] text-white rounded-xs font-semibold text-xs shadow-lg shadow-[#714b67]/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
              disabled={isLoading || !!socialLoading}
            >
              {isLoading ? (
                <Spinner size="sm" className="text-white" />
              ) : (
                <>
                  <span>Start Free Trial • {activeApp.name}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </Button>
          </form>

          <div className="text-center text-xs text-slate-400 pt-2 border-t border-white/5">
            Already have an account?{' '}
            <Link
              to={`/login?product=${selectedAppId}&return_to=${encodeURIComponent(returnTo)}`}
              className="text-[#c79dbd] hover:text-white font-semibold transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>
      )}
    </AuthLayout>
  );
};
