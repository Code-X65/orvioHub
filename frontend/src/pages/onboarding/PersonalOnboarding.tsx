import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { api } from '@/lib/api';
import { Header } from '@/components/landing/Header';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import {
  Boxes,
  CreditCard,
  Truck,
  Building2,
  Users,
  Sparkles,
  Check,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  User,
  Share2,
  Briefcase,
  Store,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface UseCaseOption {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
}

const USE_CASES: UseCaseOption[] = [
  {
    id: 'inventory',
    title: "Manage my shop's inventory",
    description: 'Track stock in real-time, low stock alerts, and multi-location counts.',
    icon: Boxes,
  },
  {
    id: 'pos',
    title: 'Run a POS / sales system',
    description: 'Fast cashier checkout, barcode scanning, and custom receipt prints.',
    icon: CreditCard,
  },
  {
    id: 'purchases',
    title: 'Track purchases & suppliers',
    description: 'Purchase orders, supplier debt, goods received, and cost margins.',
    icon: Truck,
  },
  {
    id: 'multi_business',
    title: 'Manage multiple businesses',
    description: 'Multi-tenant organization control with branch-level scoping.',
    icon: Building2,
  },
  {
    id: 'join_other',
    title: 'Join an existing business',
    description: 'I was invited by an employer, partner, or business associate.',
    icon: Users,
  },
  {
    id: 'exploring',
    title: 'Just exploring / other',
    description: 'Discovering modern retail and cloud ERP tools.',
    icon: Sparkles,
  },
];

const ACQUISITION_SOURCES = [
  { id: 'friend', label: 'Friend or colleague' },
  { id: 'social', label: 'Social media (Instagram, TikTok, Twitter)' },
  { id: 'google', label: 'Google Search' },
  { id: 'whatsapp', label: 'WhatsApp group or community' },
  { id: 'event', label: 'Offline event / workshop' },
  { id: 'other', label: 'Other' },
];

const ROLES = [
  { id: 'Owner', label: 'Business Owner / Founder' },
  { id: 'Manager', label: 'Store / General Manager' },
  { id: 'Sales Attendant', label: 'Sales Attendant / Cashier' },
  { id: 'Stock Manager', label: 'Stock / Inventory Officer' },
  { id: 'Accountant', label: 'Accountant / Financial Officer' },
  { id: 'Other', label: 'Other' },
];

const STEPS = [
  { step: 1, title: 'Purpose', description: 'What you want to do' },
  { step: 2, title: 'Role', description: 'Your current position' },
  { step: 3, title: 'Business', description: 'Operational status' },
  { step: 4, title: 'Discovery', description: 'How you found us' },
];

export const PersonalOnboarding: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, updateUser } = useAuthStore();

  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [selectedUseCases, setSelectedUseCases] = useState<string[]>(['inventory']);
  const [role, setRole] = useState<string>('Owner');
  const [managesBusiness, setManagesBusiness] = useState<boolean>(true);
  const [acquisitionSource, setAcquisitionSource] = useState<string>('friend');
  const [acquisitionSourceOther, setAcquisitionSourceOther] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // 1. Initial Mount: Check if already completed and restore draft progress
  React.useEffect(() => {
    if (user?.personalOnboardingCompleted) {
      const inviteToken = searchParams.get('invite_token') || searchParams.get('token');
      if (inviteToken) {
        navigate(`/invite/${inviteToken}`, { replace: true });
      } else {
        navigate('/', { replace: true });
      }
      return;
    }

    let isMounted = true;
    const fetchPersonalDraft = async () => {
      try {
        const res = await api.get<{
          success: boolean;
          data: {
            personalOnboardingCompleted: boolean;
            currentStep?: number;
            profile?: any;
          };
        }>('/onboarding/personal');

        if (!isMounted) return;

        if (res?.data?.personalOnboardingCompleted) {
          updateUser({ personalOnboardingCompleted: true });
          const inviteToken = searchParams.get('invite_token') || searchParams.get('token');
          if (inviteToken) {
            navigate(`/invite/${inviteToken}`, { replace: true });
          } else {
            navigate('/', { replace: true });
          }
          return;
        }

        const draft = res?.data;
        if (draft) {
          if (draft.currentStep && draft.currentStep >= 1 && draft.currentStep <= 4) {
            setCurrentStep(draft.currentStep);
          }
          if (draft.profile) {
            const p = draft.profile;
            if (Array.isArray(p.useCases) && p.useCases.length > 0) {
              setSelectedUseCases(p.useCases);
            }
            if (p.role) {
              setRole(p.role);
            }
            if (p.managesBusiness !== undefined) {
              setManagesBusiness(Boolean(p.managesBusiness));
            }
            if (p.acquisitionSource) {
              setAcquisitionSource(p.acquisitionSource);
            }
            if (p.acquisitionSourceOther) {
              setAcquisitionSourceOther(p.acquisitionSourceOther);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load personal onboarding draft:', err);
      } finally {
        if (isMounted) {
          setLoadingInitial(false);
        }
      }
    };

    fetchPersonalDraft();
    return () => {
      isMounted = false;
    };
  }, [navigate, searchParams, updateUser, user?.personalOnboardingCompleted]);

  const toggleUseCase = (id: string) => {
    setSelectedUseCases((prev) =>
      prev.includes(id) ? (prev.length > 1 ? prev.filter((item) => item !== id) : prev) : [...prev, id]
    );
  };

  const handleNext = () => {
    if (currentStep === 1 && selectedUseCases.length === 0) {
      toast.error('Please select at least one purpose to continue.');
      return;
    }

    if (currentStep < 4) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);

      // Persist real-time draft progress so user can resume seamlessly if interrupted
      api.post('/onboarding/personal/progress', {
        currentStep: nextStep,
        useCases: selectedUseCases,
        role,
        managesBusiness,
        acquisitionSource,
        acquisitionSourceOther: acquisitionSource === 'other' ? acquisitionSourceOther.trim() : undefined,
      }).catch((err) => {
        console.warn('Silent draft sync error:', err);
      });
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);

      // Persist current step backwards
      api.post('/onboarding/personal/progress', {
        currentStep: prevStep,
        useCases: selectedUseCases,
        role,
        managesBusiness,
        acquisitionSource,
        acquisitionSourceOther: acquisitionSource === 'other' ? acquisitionSourceOther.trim() : undefined,
      }).catch(() => {});
    }
  };

  const handleSubmit = async (createOrg = false) => {
    setIsSubmitting(true);

    try {
      await api.post('/onboarding/personal', {
        useCases: selectedUseCases,
        acquisitionSource,
        acquisitionSourceOther: acquisitionSource === 'other' ? acquisitionSourceOther.trim() : undefined,
        role,
        managesBusiness,
      });

      // Update local state in Zustand auth store
      updateUser({ personalOnboardingCompleted: true });
      toast.success('Profile setup complete!');

      // Check for pending invite redirect
      const inviteToken = searchParams.get('invite_token') || searchParams.get('token');
      if (inviteToken) {
        navigate(`/invite/${inviteToken}`);
        return;
      }

      // If user selected to create organization
      if (createOrg) {
        navigate('/onboard/organization');
        return;
      }

      // Smoothly navigate to personal dashboard
      navigate('/');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save personal preferences. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingInitial) {
    return (
      <div className="min-h-screen bg-black text-slate-100 flex flex-col items-center justify-center">
        <Spinner size="lg" className="text-[#714b67]" />
        <p className="text-xs text-slate-400 mt-4 animate-pulse">Loading your onboarding session...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-slate-100 flex flex-col selection:bg-[#714b67] selection:text-white">
      <Header />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col justify-center">
        {/* Step Progress Header */}
        <div className="mb-8 space-y-4">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#714b67]/20 border border-[#714b67]/40 text-xs font-bold text-[#FDB02F] tracking-wide uppercase">
              <User className="w-3.5 h-3.5" />
              <span>Step {currentStep} of 4: Personal Setup</span>
            </div>
            <span className="text-xs font-medium text-slate-400">
              {Math.round((currentStep / 4) * 100)}% Completed
            </span>
          </div>

          {/* Progress Bar & Indicators */}
          <div className="grid grid-cols-4 gap-2">
            {STEPS.map((s) => {
              const isDone = s.step < currentStep;
              const isCurrent = s.step === currentStep;
              return (
                <div key={s.step} className="space-y-1.5">
                  <div
                    className={cn(
                      'h-1.5 w-full rounded-full transition-all duration-300',
                      isDone
                        ? 'bg-[#FDB02F]'
                        : isCurrent
                        ? 'bg-[#714b67] shadow-sm shadow-[#714b67]/50'
                        : 'bg-white/10'
                    )}
                  />
                  <div className="hidden sm:flex items-center justify-between text-[11px]">
                    <span
                      className={cn(
                        'font-semibold transition-colors',
                        isCurrent
                          ? 'text-white'
                          : isDone
                          ? 'text-[#FDB02F]'
                          : 'text-slate-500'
                      )}
                    >
                      {s.title}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Wizard Card Body */}
        <div className="bg-[#120b10] border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden backdrop-blur-sm">
          {/* Step 1: Use Cases */}
          {currentStep === 1 && (
            <div key="step-1" className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                  What do you want to use Orviohub for?
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  Select all that apply to help us personalize your workspace tools.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {USE_CASES.map((item) => {
                  const Icon = item.icon;
                  const isSelected = selectedUseCases.includes(item.id);

                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleUseCase(item.id)}
                      className={cn(
                        'group relative p-4 rounded-xl border transition-all duration-200 cursor-pointer flex items-start gap-3.5 select-none',
                        isSelected
                          ? 'bg-gradient-to-br from-[#241321] to-[#140b12] border-[#714b67] shadow-lg shadow-[#714b67]/20 ring-1 ring-[#714b67]'
                          : 'bg-[#160f14] border-white/10 hover:border-[#714b67]/40 hover:bg-[#1d121b]'
                      )}
                    >
                      <div
                        className={cn(
                          'w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                          isSelected
                            ? 'bg-[#714b67] text-white'
                            : 'bg-white/5 text-slate-400 group-hover:text-white'
                        )}
                      >
                        <Icon className="w-5 h-5" />
                      </div>

                      <div className="flex-1 min-w-0 pr-6">
                        <h4 className="text-xs font-bold text-white tracking-tight">{item.title}</h4>
                        <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                          {item.description}
                        </p>
                      </div>

                      <div
                        className={cn(
                          'absolute top-4 right-4 w-5 h-5 rounded-full flex items-center justify-center transition-colors',
                          isSelected ? 'bg-[#FDB02F] text-black' : 'border border-white/20'
                        )}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Role */}
          {currentStep === 2 && (
            <div key="step-2" className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs text-[#FDB02F] font-semibold mb-1">
                  <Briefcase className="w-3.5 h-3.5" />
                  <span>Your Role</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                  What best describes your role?
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  Choose the title that matches what you do on a day-to-day basis.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ROLES.map((r) => {
                  const isSelected = role === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setRole(r.id)}
                      className={cn(
                        'p-4 rounded-xl border text-left transition-all duration-150 flex items-center justify-between cursor-pointer select-none',
                        isSelected
                          ? 'bg-[#714b67]/25 border-[#714b67] text-white font-bold ring-1 ring-[#714b67] shadow-md shadow-[#714b67]/20'
                          : 'bg-[#160f14] border-white/10 text-slate-300 hover:text-white hover:border-white/20 hover:bg-[#1d121b]'
                      )}
                    >
                      <span className="text-xs font-semibold">{r.label}</span>
                      {isSelected ? (
                        <CheckCircle2 className="w-5 h-5 text-[#FDB02F]" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-white/20" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 3: Manage Business */}
          {currentStep === 3 && (
            <div key="step-3" className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs text-[#FDB02F] font-semibold mb-1">
                  <Store className="w-3.5 h-3.5" />
                  <span>Business Operations</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                  Do you currently manage a business?
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  Whether you're running a shop right now or preparing to start one, we'll set up the right shortcuts.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setManagesBusiness(true)}
                  className={cn(
                    'p-5 rounded-2xl border text-left transition-all cursor-pointer select-none space-y-2',
                    managesBusiness
                      ? 'bg-gradient-to-br from-[#241321] to-[#140b12] border-[#714b67] ring-1 ring-[#714b67] shadow-lg shadow-[#714b67]/25'
                      : 'bg-[#160f14] border-white/10 hover:border-white/20 hover:bg-[#1d121b]'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">Yes, I currently manage a business</span>
                    {managesBusiness ? (
                      <CheckCircle2 className="w-5 h-5 text-[#FDB02F]" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-white/20" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    I own or manage an active shop, wholesale store, warehouse, or retail outfit.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setManagesBusiness(false)}
                  className={cn(
                    'p-5 rounded-2xl border text-left transition-all cursor-pointer select-none space-y-2',
                    !managesBusiness
                      ? 'bg-gradient-to-br from-[#241321] to-[#140b12] border-[#714b67] ring-1 ring-[#714b67] shadow-lg shadow-[#714b67]/25'
                      : 'bg-[#160f14] border-white/10 hover:border-white/20 hover:bg-[#1d121b]'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">Not currently</span>
                    {!managesBusiness ? (
                      <CheckCircle2 className="w-5 h-5 text-[#FDB02F]" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-white/20" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    I am exploring for future ventures, learning the platform, or awaiting an invitation.
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Acquisition Source */}
          {currentStep === 4 && (
            <div key="step-4" className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs text-[#FDB02F] font-semibold mb-1">
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Discovery</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                  How did you hear about Orviohub?
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  Help our community and product team understand how people find us.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {ACQUISITION_SOURCES.map((source) => {
                  const isSelected = acquisitionSource === source.id;
                  return (
                    <button
                      key={source.id}
                      type="button"
                      onClick={() => setAcquisitionSource(source.id)}
                      className={cn(
                        'p-3.5 rounded-xl border text-xs font-semibold text-left transition-all cursor-pointer flex items-center justify-between select-none',
                        isSelected
                          ? 'bg-[#714b67]/25 border-[#714b67] text-white ring-1 ring-[#714b67] shadow-md shadow-[#714b67]/20'
                          : 'bg-[#160f14] border-white/10 text-slate-300 hover:text-white hover:border-white/20 hover:bg-[#1d121b]'
                      )}
                    >
                      <span className="truncate">{source.label}</span>
                      {isSelected ? (
                        <CheckCircle2 className="w-4 h-4 text-[#FDB02F] shrink-0 ml-2" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-white/20 shrink-0 ml-2" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Conditional Other Input */}
              {acquisitionSource === 'other' && (
                <div className="pt-2 animate-in fade-in slide-in-from-top-2 duration-200 space-y-2">
                  <Label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <span>Please specify how you heard about us:</span>
                    <span className="text-[#FDB02F]">*</span>
                  </Label>
                  <input
                    type="text"
                    value={acquisitionSourceOther}
                    onChange={(e) => setAcquisitionSourceOther(e.target.value)}
                    placeholder="e.g. YouTube review, Tech podcast, Billboard, Blog post, etc."
                    className="w-full px-4 py-3 rounded-xl bg-[#160f14] border border-white/15 focus:border-[#714b67] focus:ring-1 focus:ring-[#714b67] text-white text-xs placeholder:text-slate-500 outline-none transition-all shadow-inner"
                    autoFocus
                  />
                </div>
              )}

              {/* Conditional Business Manager Organization Creation Prompt */}
              {managesBusiness && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-[#241321] to-[#170e16] border border-[#714b67]/60 shadow-lg space-y-2 animate-in fade-in duration-300">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#FDB02F]" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Business Organization Setup
                    </h4>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Since you actively manage a business, you can create your organization workspace now to configure stores and inventory, or go straight to your personal dashboard.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Navigation Controls Footer */}
          <div className="mt-8 pt-6 border-t border-white/10 flex items-center justify-between gap-4">
            <div>
              {currentStep > 1 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-transparent border-white/10 hover:border-white/20 hover:bg-white/5 text-slate-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </Button>
              ) : (
                <span className="text-[11px] text-slate-500 hidden sm:inline">
                  Step 1 of 4: Setup is personalized & completely free.
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {currentStep < 4 ? (
                <Button
                  type="button"
                  onClick={handleNext}
                  className="px-6 py-2.5 rounded-xl bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-bold shadow-lg shadow-[#714b67]/25 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              ) : managesBusiness ? (
                <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2.5">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleSubmit(false)}
                    disabled={isSubmitting}
                    className="px-4 py-2.5 rounded-xl bg-transparent border-white/10 hover:border-white/20 hover:bg-white/5 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Go to Dashboard</span>
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleSubmit(true)}
                    disabled={isSubmitting}
                    className="px-6 py-2.5 rounded-xl bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-bold shadow-lg shadow-[#714b67]/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <Spinner size="sm" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Building2 className="w-3.5 h-3.5 text-[#FDB02F]" />
                        <span>Create Organization & Continue</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  onClick={() => handleSubmit(false)}
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-bold shadow-lg shadow-[#714b67]/25 transition-all flex items-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Spinner size="sm" />
                      <span>Saving preferences...</span>
                    </>
                  ) : (
                    <>
                      <span>Complete Setup & Go to Dashboard</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PersonalOnboarding;
