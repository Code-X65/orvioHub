import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/useAuthStore';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { CustomSelect, type SelectOption } from '@/components/ui/custom-select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import {
  Building2,
  Globe,
  ArrowRight,
  DollarSign,
  Users,
  Briefcase,
  MapPin,
  Tag,
} from 'lucide-react';

const orgSchema = z.object({
  name: z.string().min(2, 'Organization name must be at least 2 characters'),
  industry: z.string().min(1, 'Please select your industry'),
  country: z.string().min(2, 'Country is required'),
  currency: z.string().default('NGN'),
  timezone: z.string().min(2, 'Timezone is required'),
  website: z.string().url('Invalid website URL').optional().or(z.literal('')),
  size: z.string().default('1-10'),
  branchName: z.string().min(2, 'Primary branch name is required').default('Main Store'),
  branchCode: z.string().min(1, 'Branch code is required').default('MAIN'),
});

type OrgFormData = z.infer<typeof orgSchema>;

const INDUSTRY_OPTIONS: SelectOption[] = [
  { value: 'Retail & Commerce', label: 'Retail & Commerce', description: 'Storefronts, boutiques, POS' },
  { value: 'Wholesale & Distribution', label: 'Wholesale & Distribution', description: 'B2B supply, bulk inventory' },
  { value: 'Boutique & Fashion', label: 'Boutique & Fashion', description: 'Apparel, footwear, accessories' },
  { value: 'Pharmacy & Healthcare', label: 'Pharmacy & Healthcare', description: 'Clinics, drugstores, medical' },
  { value: 'Supermarket & Groceries', label: 'Supermarket & Groceries', description: 'FMCG, multi-aisle markets' },
  { value: 'Software & Technology', label: 'Software & Technology', description: 'SaaS, digital agencies, IT' },
  { value: 'Financial Services & Fintech', label: 'Financial Services & Fintech', description: 'Finance, investment, agency' },
  { value: 'Manufacturing & Logistics', label: 'Manufacturing & Logistics', description: 'Production, warehousing, transport' },
  { value: 'Hospitality & Food Services', label: 'Hospitality & Food Services', description: 'Hotels, restaurants, cafes' },
  { value: 'Professional & Legal Services', label: 'Professional & Legal Services', description: 'Consulting, accounting, legal' },
  { value: 'Other / General', label: 'Other / General', description: 'General enterprise' },
];

const CURRENCY_OPTIONS: SelectOption[] = [
  { value: 'NGN', label: 'Nigerian Naira (₦ NGN)', badge: '₦', badgeColor: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' },
  { value: 'USD', label: 'US Dollar ($ USD)', badge: '$', badgeColor: 'bg-blue-500/20 text-blue-400 border border-blue-500/30' },
  { value: 'GBP', label: 'British Pound (£ GBP)', badge: '£', badgeColor: 'bg-purple-500/20 text-purple-400 border border-purple-500/30' },
  { value: 'EUR', label: 'Euro (€ EUR)', badge: '€', badgeColor: 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' },
  { value: 'GHS', label: 'Ghanaian Cedi (₵ GHS)', badge: '₵', badgeColor: 'bg-amber-500/20 text-amber-400 border border-amber-500/30' },
  { value: 'KES', label: 'Kenyan Shilling (KSh KES)', badge: 'KSh', badgeColor: 'bg-teal-500/20 text-teal-400 border border-teal-500/30' },
  { value: 'ZAR', label: 'South African Rand (R ZAR)', badge: 'R', badgeColor: 'bg-orange-500/20 text-orange-400 border border-orange-500/30' },
];

const SIZE_OPTIONS: SelectOption[] = [
  { value: '1-10', label: '1 - 10 members', badge: 'Small' },
  { value: '11-50', label: '11 - 50 members', badge: 'Medium' },
  { value: '51-200', label: '51 - 200 members', badge: 'Growing' },
  { value: '201+', label: '201+ members', badge: 'Enterprise' },
];

export const OrganizationSetup: React.FC = () => {
  const navigate = useNavigate();
  const { refreshSession, onboardingStatus } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<OrgFormData>({
    resolver: zodResolver(orgSchema),
    defaultValues: {
      name: onboardingStatus?.organization?.name || '',
      industry: onboardingStatus?.organization?.industry || 'Retail & Commerce',
      country: onboardingStatus?.organization?.country || 'Nigeria',
      currency: 'NGN',
      timezone:
        onboardingStatus?.organization?.timezone ||
        Intl.DateTimeFormat().resolvedOptions().timeZone ||
        'Africa/Lagos',
      website: onboardingStatus?.organization?.website || '',
      size: onboardingStatus?.organization?.size || '1-10',
      branchName: 'Main Store',
      branchCode: 'MAIN',
    },
  });

  const selectedIndustry = watch('industry');
  const selectedCurrency = watch('currency');
  const selectedSize = watch('size');

  const generateCode = (name: string) => {
    return name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'MAIN';
  };

  const onSubmit = async (data: OrgFormData) => {
    setIsLoading(true);
    try {
      const isConfigured = !!onboardingStatus?.organization?.id;
      let orgId = onboardingStatus?.organization?.id;

      const orgPayload = {
        name: data.name,
        industry: data.industry,
        country: data.country,
        currency: data.currency,
        timezone: data.timezone,
        website: data.website || undefined,
        size: data.size,
      };

      if (isConfigured) {
        await api.patch(`/organizations/${orgId}`, orgPayload);
      } else {
        const res = await api.post<{ data: { organization: { id: string } } }>(
          '/organizations',
          orgPayload
        );
        orgId = res?.data?.organization?.id;
      }

      localStorage.setItem('orvio_initial_branch_name', data.branchName || 'Main Store');
      localStorage.setItem('orvio_initial_branch_code', data.branchCode || 'MAIN');

      try {
        await api.post('/onboarding/modules', {
          modules: ['inventory'],
          organizationId: orgId,
        });
      } catch {
        // Module might already be configured
      }

      await refreshSession();
      navigate('/onboarding/workspace');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save organization configuration.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <OnboardingLayout
      title="Create your Organization"
      subtitle="Your organization hosts your business data, workspaces, team members, and branches."
      stepName="Organization Profile"
      stepNumber={1}
      totalSteps={4}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
        {/* Organization Name */}
        <div className="space-y-1">
          <Label htmlFor="name" className="text-xs font-medium text-slate-300">
            Organization or Business Name <span className="text-rose-400">*</span>
          </Label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <Input
              id="name"
              placeholder="e.g. Primrose Retail Group"
              {...register('name')}
              className={`pl-9 h-10 bg-[#0e0a0d] border-white/10 text-white placeholder:text-slate-600 rounded-xs text-xs focus:ring-1 focus:ring-[#714b67] ${
                errors.name ? 'border-rose-500/80' : ''
              }`}
              disabled={isLoading}
              autoFocus
            />
          </div>
          {errors.name && (
            <p className="text-[11px] text-rose-400">{errors.name.message}</p>
          )}
        </div>

        {/* Industry & Currency Grid with CustomSelect */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="space-y-1">
            <Label htmlFor="industry" className="text-xs font-medium text-slate-300">
              Industry / Sector <span className="text-rose-400">*</span>
            </Label>
            <CustomSelect
              options={INDUSTRY_OPTIONS}
              value={selectedIndustry}
              onChange={(val) => setValue('industry', val, { shouldValidate: true })}
              placeholder="Select industry"
              searchable={true}
              searchPlaceholder="Search industry..."
              icon={<Briefcase className="w-3.5 h-3.5 text-slate-400" />}
              disabled={isLoading}
              error={errors.industry?.message}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="currency" className="text-xs font-medium text-slate-300">
              Operating Currency <span className="text-rose-400">*</span>
            </Label>
            <CustomSelect
              options={CURRENCY_OPTIONS}
              value={selectedCurrency}
              onChange={(val) => setValue('currency', val, { shouldValidate: true })}
              placeholder="Select currency"
              searchable={true}
              searchPlaceholder="Search currency..."
              icon={<DollarSign className="w-3.5 h-3.5 text-slate-400" />}
              disabled={isLoading}
              error={errors.currency?.message}
            />
          </div>
        </div>

        {/* PRIMARY BRANCH SETUP */}
        <div className="pt-2 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
              <MapPin className="w-3.5 h-3.5 text-[#d4a8c9]" />
              <span>Initial Primary Branch</span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              DEFAULT PRIMARY
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <Label htmlFor="branchName" className="text-xs font-medium text-slate-300">
                Branch Name <span className="text-rose-400">*</span>
              </Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <Input
                  id="branchName"
                  placeholder="e.g. Main Store"
                  {...register('branchName', {
                    onChange: (e) => {
                      setValue('branchCode', generateCode(e.target.value));
                    },
                  })}
                  className="pl-9 h-10 bg-[#0e0a0d] border-white/10 text-white placeholder:text-slate-600 rounded-xs text-xs focus:ring-1 focus:ring-[#714b67]"
                  disabled={isLoading}
                />
              </div>
              {errors.branchName && (
                <p className="text-[11px] text-rose-400">{errors.branchName.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="branchCode" className="text-xs font-medium text-slate-300">
                Branch Code
              </Label>
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <Input
                  id="branchCode"
                  placeholder="e.g. MAIN"
                  maxLength={6}
                  {...register('branchCode')}
                  className="pl-9 h-10 bg-[#0e0a0d] border-white/10 text-white placeholder:text-slate-600 rounded-xs text-xs font-mono uppercase focus:ring-1 focus:ring-[#714b67]"
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Company Size & Website */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="space-y-1">
            <Label htmlFor="size" className="text-xs font-medium text-slate-300">
              Estimated Team Size
            </Label>
            <CustomSelect
              options={SIZE_OPTIONS}
              value={selectedSize}
              onChange={(val) => setValue('size', val)}
              placeholder="Select team size"
              searchable={false}
              icon={<Users className="w-3.5 h-3.5 text-slate-400" />}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="website" className="text-xs font-medium text-slate-300">
              Website (Optional)
            </Label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <Input
                id="website"
                placeholder="https://company.com"
                {...register('website')}
                className="pl-9 h-10 bg-[#0e0a0d] border-white/10 text-white placeholder:text-slate-600 rounded-xs text-xs focus:ring-1 focus:ring-[#714b67]"
                disabled={isLoading}
              />
            </div>
          </div>
        </div>

        <div className="pt-2">
          <Button
            type="submit"
            className="w-full h-10 bg-gradient-to-r from-[#714b67] to-[#8d5b80] hover:from-[#8d5b80] hover:to-[#a06892] text-white rounded-xl font-semibold text-xs shadow-lg shadow-[#714b67]/25 cursor-pointer flex items-center justify-center gap-2 transition-all"
            disabled={isLoading}
          >
            {isLoading ? <Spinner size="sm" className="mr-1 text-white" /> : null}
            {isLoading ? (
              'Configuring Organization...'
            ) : (
              <>
                <span>Continue to Workspace Setup</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </Button>
        </div>
      </form>
    </OnboardingLayout>
  );
};
