import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/useAuthStore';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import { Building2, Globe, ArrowRight, DollarSign, Users, Briefcase } from 'lucide-react';

const orgSchema = z.object({
  name: z.string().min(2, 'Organization name must be at least 2 characters'),
  industry: z.string().min(1, 'Please select your industry'),
  country: z.string().min(2, 'Country is required'),
  currency: z.string().default('NGN'),
  timezone: z.string().min(2, 'Timezone is required'),
  website: z.string().url('Invalid website URL').optional().or(z.literal('')),
  size: z.string().default('1-10'),
});

type OrgFormData = z.infer<typeof orgSchema>;

const INDUSTRIES = [
  'Retail & Commerce',
  'Wholesale & Distribution',
  'Boutique & Fashion',
  'Pharmacy & Healthcare',
  'Supermarket & Groceries',
  'Software & Technology',
  'Financial Services & Fintech',
  'Manufacturing & Logistics',
  'Hospitality & Food Services',
  'Professional & Legal Services',
  'Other / General',
];

const CURRENCIES = [
  { code: 'NGN', label: 'Nigerian Naira (₦)', symbol: '₦' },
  { code: 'USD', label: 'US Dollar ($)', symbol: '$' },
  { code: 'GBP', label: 'British Pound (£)', symbol: '£' },
  { code: 'EUR', label: 'Euro (€)', symbol: '€' },
  { code: 'GHS', label: 'Ghanaian Cedi (₵)', symbol: '₵' },
  { code: 'KES', label: 'Kenyan Shilling (KSh)', symbol: 'KSh' },
  { code: 'ZAR', label: 'South African Rand (R)', symbol: 'R' },
];

export const OrganizationSetup: React.FC = () => {
  const navigate = useNavigate();
  const { refreshSession, onboardingStatus } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OrgFormData>({
    resolver: zodResolver(orgSchema),
    defaultValues: {
      name: onboardingStatus?.organization?.name || '',
      industry: onboardingStatus?.organization?.industry || 'Retail & Commerce',
      country: onboardingStatus?.organization?.country || 'NG',
      currency: 'NGN',
      timezone: onboardingStatus?.organization?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Lagos',
      website: onboardingStatus?.organization?.website || '',
      size: onboardingStatus?.organization?.size || '1-10',
    },
  });

  const onSubmit = async (data: OrgFormData) => {
    setIsLoading(true);
    try {
      const isConfigured = !!onboardingStatus?.organization?.id;

      if (isConfigured) {
        await api.patch(`/organizations/${onboardingStatus.organization.id}`, data);
      } else {
        await api.post('/organizations', data);
      }

      await refreshSession();
      navigate('/onboarding/modules');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save organization configuration.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <OnboardingLayout
      title="Tell us about your organization"
      subtitle="An organization is your business, store, or team. It is managed in a secure workspace where you can invite members and control your data."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
        {/* Organization Name */}
        <div className="space-y-1">
          <Label htmlFor="name" className="text-xs font-medium text-slate-300">
            Organization or Business Name *
          </Label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              id="name"
              placeholder="e.g. Acme Supermarket Lagos"
              {...register('name')}
              className={`pl-9 h-10 bg-[#0e0a0d] border-white/10 text-white rounded-xs text-xs focus-visible:ring-1 focus-visible:ring-[#714b67] ${errors.name ? 'border-rose-500' : ''}`}
              disabled={isLoading}
            />
          </div>
          {errors.name && <p className="text-[11px] text-rose-400 font-medium pl-1">{errors.name.message}</p>}
        </div>

        {/* Industry & Currency Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="industry" className="text-xs font-medium text-slate-300">
              Industry / Sector *
            </Label>
            <div className="relative">
              <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              <select
                id="industry"
                {...register('industry')}
                className="w-full pl-9 pr-3 h-10 bg-[#0e0a0d] border border-white/10 text-white rounded-xs text-xs focus:ring-1 focus:ring-[#714b67] focus:outline-none cursor-pointer appearance-none"
                disabled={isLoading}
              >
                {INDUSTRIES.map((ind) => (
                  <option key={ind} value={ind} className="bg-[#120b10] text-white">
                    {ind}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="currency" className="text-xs font-medium text-slate-300">
              Operating Currency *
            </Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              <select
                id="currency"
                {...register('currency')}
                className="w-full pl-9 pr-3 h-10 bg-[#0e0a0d] border border-white/10 text-white rounded-xs text-xs focus:ring-1 focus:ring-[#714b67] focus:outline-none cursor-pointer appearance-none"
                disabled={isLoading}
              >
                {CURRENCIES.map((cur) => (
                  <option key={cur.code} value={cur.code} className="bg-[#120b10] text-white">
                    {cur.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Company Size & Website */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="size" className="text-xs font-medium text-slate-300">
              Estimated Team Size
            </Label>
            <div className="relative">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              <select
                id="size"
                {...register('size')}
                className="w-full pl-9 pr-3 h-10 bg-[#0e0a0d] border border-white/10 text-white rounded-xs text-xs focus:ring-1 focus:ring-[#714b67] focus:outline-none cursor-pointer appearance-none"
                disabled={isLoading}
              >
                <option value="1-10" className="bg-[#120b10] text-white">1 - 10 members</option>
                <option value="11-50" className="bg-[#120b10] text-white">11 - 50 members</option>
                <option value="51-200" className="bg-[#120b10] text-white">51 - 200 members</option>
                <option value="201+" className="bg-[#120b10] text-white">201+ members</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="website" className="text-xs font-medium text-slate-300">
              Website (Optional)
            </Label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                id="website"
                placeholder="https://acme.com"
                {...register('website')}
                className="pl-9 h-10 bg-[#0e0a0d] border-white/10 text-white rounded-xs text-xs focus-visible:ring-1 focus-visible:ring-[#714b67]"
                disabled={isLoading}
              />
            </div>
          </div>
        </div>

        <div className="pt-2">
          <Button
            type="submit"
            className="w-full h-11 bg-[#714b67] hover:bg-[#86597a] active:bg-[#603f57] text-white rounded-xs font-semibold text-xs shadow-md cursor-pointer flex items-center justify-center gap-1.5"
            disabled={isLoading}
          >
            {isLoading ? <Spinner size="sm" className="mr-1 text-white" /> : null}
            {isLoading ? 'Saving Organization...' : (
              <>
                <span>Continue to Choose Applications</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </Button>
        </div>
      </form>
    </OnboardingLayout>
  );
};
