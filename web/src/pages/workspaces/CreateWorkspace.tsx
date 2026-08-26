import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/useAuthStore';
import { Header } from '@/components/landing/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import {
  Building2,
  Users2,
  User,
  HeartHandshake,
  GraduationCap,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Info,
} from 'lucide-react';

const ORGANIZATION_TYPES = [
  {
    id: 'business',
    label: 'Business or store',
    description: 'Retail stores, supermarkets, pharmacies, fashion boutiques, and trade outlets.',
    icon: Building2,
    badge: 'Recommended for Inventory',
  },
  {
    id: 'team',
    label: 'Company or team',
    description: 'Corporate teams, agencies, operational squads, and startups.',
    icon: Users2,
  },
  {
    id: 'club',
    label: 'Gym or club',
    description: 'Fitness clubs, sports centers, non-profits, and associations.',
    icon: HeartHandshake,
  },
  {
    id: 'school',
    label: 'School or institution',
    description: 'Schools, academies, training institutes, and faculties.',
    icon: GraduationCap,
  },
  {
    id: 'personal',
    label: 'Personal workspace',
    description: 'Individual operators, solo-entrepreneurs, and personal projects.',
    icon: User,
    note: 'Managed as an organization record internally, tailored for solo use.',
  },
  {
    id: 'other',
    label: 'Other',
    description: 'Specialty merchant, cooperative, or custom organization.',
    icon: Sparkles,
  },
];

// Screen Schema: Organization Setup
const organizationSchema = z.object({
  name: z.string().min(2, 'Organization name must be at least 2 characters'),
  type: z.enum(['business', 'team', 'club', 'school', 'personal', 'other']).default('business'),
  country: z.string().min(2, 'Country is required'),
  state: z.string().optional(),
  city: z.string().optional(),
  timezone: z.string().default('Africa/Lagos'),
  currency: z.string().default('NGN'),
  phone: z.string().optional(),
  logoUrl: z.string().url().optional().or(z.literal('')),
});

type OrganizationFormData = z.infer<typeof organizationSchema>;

export const CreateWorkspace: React.FC = () => {
  const navigate = useNavigate();
  const { user, refreshSession } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<OrganizationFormData>({
    resolver: zodResolver(organizationSchema),
    defaultValues: {
      name: '',
      type: 'business',
      country: user?.country || 'NG',
      state: '',
      city: '',
      timezone: user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Lagos',
      currency: 'NGN',
      phone: '',
      logoUrl: '',
    },
  });

  const selectedType = form.watch('type');

  const handleCreateSubmit = async (data: OrganizationFormData) => {
    setIsLoading(true);
    try {
      await api.post<{ workspace: { id: string; slug: string; name: string } }>(
        '/workspaces',
        {
          name: data.name,
          type:
            data.type === 'business'
              ? 'RETAIL'
              : data.type === 'team'
              ? 'SERVICES'
              : data.type === 'personal'
              ? 'SERVICES'
              : 'OTHER',
          country: data.country,
          state: data.state || undefined,
          city: data.city || undefined,
          timezone: data.timezone,
          currency: data.currency,
          phone: data.phone || undefined,
          logoUrl: data.logoUrl || undefined,
          initialProduct: 'inventory',
        }
      );

      await refreshSession();
      toast.success(`Organization "${data.name}" created successfully!`);

      navigate('/inventory/onboarding', { replace: true });
    } catch (error: any) {
      toast.error(error.message || 'Failed to create organization.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-slate-100 selection:bg-[#714b67] selection:text-white flex flex-col justify-between">
      <Header />

      <main className="flex-1 max-w-[560px] w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col justify-center">
        <div className="mb-6 text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-xs bg-[#714b67]/20 border border-[#714b67]/30 text-[#c79dbd] text-[11px] font-semibold">
            <Building2 className="w-3 h-3" />
            <span>Organization Setup</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Create an Organization
          </h1>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            An organization is your business, store, team, or group on Orviohub. It is managed in a secure workspace where you can invite members, use Orviohub applications, manage branches, and control your business data.
          </p>
        </div>

        <form onSubmit={form.handleSubmit(handleCreateSubmit)} className="space-y-4 animate-in fade-in duration-150">
          {/* Organization Name */}
          <div className="space-y-1">
            <Label className="text-xs font-medium text-slate-300">Organization Name *</Label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                {...form.register('name')}
                placeholder="e.g. Code X Stores, Alpha Retail"
                className="pl-9 h-10 bg-[#0e0a0d] border-white/10 text-white rounded-xs text-xs focus-visible:ring-1 focus-visible:ring-[#714b67]"
              />
            </div>
            {form.formState.errors.name && (
              <p className="text-[11px] text-rose-400">{form.formState.errors.name.message}</p>
            )}
          </div>

          {/* Organization Type Selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-300">Organization Type *</Label>
            <div className="grid grid-cols-2 gap-2">
              {ORGANIZATION_TYPES.map((t) => {
                const Icon = t.icon;
                const isSelected = selectedType === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => form.setValue('type', t.id as any)}
                    className={`text-left p-2.5 rounded-xs border transition-all flex flex-col justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-[#714b67]/20 border-[#714b67] text-white shadow-sm ring-1 ring-[#714b67]'
                        : 'bg-[#0e0a0d] border-white/10 text-slate-400 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-[#c79dbd]' : 'text-slate-500'}`} />
                      <span className="text-xs font-bold text-white">{t.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
            {selectedType === 'personal' && (
              <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-xs bg-[#714b67]/10 border border-[#714b67]/20 text-[11px] text-[#c79dbd]">
                <Info className="w-3.5 h-3.5 shrink-0 text-[#c79dbd]" />
                <span>Personal workspaces are managed as an organization record internally, tailored for solo use.</span>
              </div>
            )}
          </div>

          {/* Country & Currency Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-300">Country *</Label>
              <select
                {...form.register('country')}
                className="w-full h-10 px-3 bg-[#0e0a0d] border border-white/10 text-white rounded-xs text-xs focus:ring-1 focus:ring-[#714b67] focus:outline-none cursor-pointer"
              >
                <option value="NG" className="bg-[#120b10]">Nigeria (NG)</option>
                <option value="GH" className="bg-[#120b10]">Ghana (GH)</option>
                <option value="KE" className="bg-[#120b10]">Kenya (KE)</option>
                <option value="US" className="bg-[#120b10]">United States (US)</option>
                <option value="GB" className="bg-[#120b10]">United Kingdom (GB)</option>
                <option value="CA" className="bg-[#120b10]">Canada (CA)</option>
                <option value="ZA" className="bg-[#120b10]">South Africa (ZA)</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-300">Default Currency *</Label>
              <select
                {...form.register('currency')}
                className="w-full h-10 px-3 bg-[#0e0a0d] border border-white/10 text-white rounded-xs text-xs focus:ring-1 focus:ring-[#714b67] focus:outline-none cursor-pointer"
              >
                <option value="NGN" className="bg-[#120b10]">NGN (₦)</option>
                <option value="USD" className="bg-[#120b10]">USD ($)</option>
                <option value="GBP" className="bg-[#120b10]">GBP (£)</option>
                <option value="EUR" className="bg-[#120b10]">EUR (€)</option>
                <option value="GHS" className="bg-[#120b10]">GHS (₵)</option>
                <option value="KES" className="bg-[#120b10]">KES (KSh)</option>
                <option value="ZAR" className="bg-[#120b10]">ZAR (R)</option>
              </select>
            </div>
          </div>

          <div className="pt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate('/app')}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to App
            </button>

            <Button
              type="submit"
              disabled={isLoading}
              className="h-10 px-6 bg-[#714b67] hover:bg-[#86597a] active:bg-[#603f57] text-white rounded-xs font-semibold text-xs shadow-md cursor-pointer flex items-center gap-1.5"
            >
              {isLoading ? <Spinner size="sm" className="mr-1" /> : null}
              <span>Create Organization</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </form>
      </main>

      <footer className="w-full border-t border-white/5 bg-black py-4 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} Orivo Inc. • Single Unified Business Platform
      </footer>
    </div>
  );
};
