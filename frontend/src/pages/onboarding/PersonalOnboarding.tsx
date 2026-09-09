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
  User,
  Share2,
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
    title: "Join an existing business",
    description: "I was invited by an employer, partner, or business associate.",
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

export const PersonalOnboarding: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, updateUser } = useAuthStore();

  const [selectedUseCases, setSelectedUseCases] = useState<string[]>(['inventory']);
  const [acquisitionSource, setAcquisitionSource] = useState<string>('friend');
  const [role, setRole] = useState<string>('Owner');
  const [managesBusiness, setManagesBusiness] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const toggleUseCase = (id: string) => {
    setSelectedUseCases((prev) =>
      prev.includes(id) ? (prev.length > 1 ? prev.filter((item) => item !== id) : prev) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await api.post('/onboarding/personal', {
        useCases: selectedUseCases,
        acquisitionSource,
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

      // Smoothly navigate to the personal dashboard
      navigate('/');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save personal preferences. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-slate-100 flex flex-col selection:bg-[#714b67] selection:text-white">
      <Header />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-10 space-y-8 animate-in fade-in duration-300">
        {/* Step Indicator Header */}
        <div className="space-y-3 pb-6 border-b border-white/10 text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#714b67]/20 border border-[#714b67]/40 text-xs font-bold text-[#FDB02F] tracking-wide uppercase">
            <User className="w-3.5 h-3.5" />
            <span>Step 1: Personal Account Setup</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Tell us about yourself{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
            Help us tailor your experience. You can create or join an organization right after, or simply explore Orviohub at your own pace.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Question 1: What do you want to use Orviohub for? */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold text-white">
                What do you want to use Orviohub for?
              </Label>
              <span className="text-[11px] text-slate-400">Select all that apply</span>
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
                        : 'bg-[#120b10] border-white/10 hover:border-[#714b67]/40 hover:bg-[#180e15]'
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

          {/* Question 2: What best describes your role? */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-white">
              What best describes your role?
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {ROLES.map((r) => {
                const isSelected = role === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRole(r.id)}
                    className={cn(
                      'p-3 rounded-xl border text-xs font-medium text-left transition-all duration-150 flex items-center justify-between cursor-pointer',
                      isSelected
                        ? 'bg-[#714b67]/20 border-[#714b67] text-white font-bold ring-1 ring-[#714b67]'
                        : 'bg-[#120b10] border-white/10 text-slate-400 hover:text-white hover:border-white/20'
                    )}
                  >
                    <span>{r.label}</span>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-[#FDB02F]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Question 3: Do you currently manage a business? */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-white">
              Do you currently manage a business?
            </Label>
            <div className="grid grid-cols-2 gap-3 max-w-md">
              <button
                type="button"
                onClick={() => setManagesBusiness(true)}
                className={cn(
                  'p-3.5 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer',
                  managesBusiness
                    ? 'bg-[#714b67] text-white border-[#714b67] shadow-md shadow-[#714b67]/25'
                    : 'bg-[#120b10] border-white/10 text-slate-400 hover:text-white hover:border-white/20'
                )}
              >
                Yes, I do
              </button>
              <button
                type="button"
                onClick={() => setManagesBusiness(false)}
                className={cn(
                  'p-3.5 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer',
                  !managesBusiness
                    ? 'bg-[#714b67] text-white border-[#714b67] shadow-md shadow-[#714b67]/25'
                    : 'bg-[#120b10] border-white/10 text-slate-400 hover:text-white hover:border-white/20'
                )}
              >
                Not currently
              </button>
            </div>
          </div>

          {/* Question 4: How did you hear about Orviohub? */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-white flex items-center gap-1.5">
              <Share2 className="w-4 h-4 text-[#FDB02F]" />
              <span>How did you hear about Orviohub?</span>
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {ACQUISITION_SOURCES.map((source) => {
                const isSelected = acquisitionSource === source.id;
                return (
                  <button
                    key={source.id}
                    type="button"
                    onClick={() => setAcquisitionSource(source.id)}
                    className={cn(
                      'p-3 rounded-xl border text-xs text-left transition-all cursor-pointer truncate',
                      isSelected
                        ? 'bg-[#714b67]/25 border-[#714b67] text-white font-bold ring-1 ring-[#714b67]'
                        : 'bg-[#120b10] border-white/10 text-slate-400 hover:text-white hover:border-white/20'
                    )}
                  >
                    {source.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-[11px] text-slate-500">
              You can modify your personal preferences anytime from Account Settings.
            </p>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-7 py-2.5 rounded-xl bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-bold shadow-lg shadow-[#714b67]/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Spinner size="sm" />
                  <span>Saving preferences...</span>
                </>
              ) : (
                <>
                  <span>Continue to Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
};
export default PersonalOnboarding;
