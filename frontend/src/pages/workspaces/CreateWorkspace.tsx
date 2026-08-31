import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/useAuthStore';
import { getHomeUrl } from '@orviohub/shared';
import { useHost } from '@/host/useHost';
import { AuthLayout } from '@/pages/auth/AuthLayout';
import { PhoneInput } from '@/components/phone/PhoneInput';
import { AddressForm, type NigerianAddress } from '@/components/location/AddressForm';
import { CustomSelect, type SelectOption } from '@/components/ui/custom-select';
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
  Store,
  Mail,
  MapPin,
  DollarSign,
} from 'lucide-react';

const ORGANIZATION_TYPES = [
  {
    id: 'business',
    label: 'Business or Store',
    description: 'Retail stores, supermarkets, pharmacies, fashion boutiques, and trade outlets.',
    icon: Store,
    badge: 'Recommended',
  },
  {
    id: 'team',
    label: 'Company or Agency',
    description: 'Corporate teams, digital agencies, startups, and operational squads.',
    icon: Users2,
  },
  {
    id: 'club',
    label: 'Gym or Club',
    description: 'Fitness centers, sports clubs, non-profits, and member associations.',
    icon: HeartHandshake,
  },
  {
    id: 'school',
    label: 'School or Institution',
    description: 'Academies, learning faculties, training institutes, and colleges.',
    icon: GraduationCap,
  },
  {
    id: 'personal',
    label: 'Personal Operator',
    description: 'Solo-entrepreneurs, consultants, and personal merchant projects.',
    icon: User,
  },
  {
    id: 'other',
    label: 'Other Venture',
    description: 'Custom enterprise, cooperative, or specialty commercial setup.',
    icon: Sparkles,
  },
];

const organizationSchema = z.object({
  name: z.string().min(2, 'Organization or business name must be at least 2 characters'),
  type: z.enum(['business', 'team', 'club', 'school', 'personal', 'other']).default('business'),
  currency: z.string().default('NGN'),
  email: z.string().email('Invalid business email').optional().or(z.literal('')),
  description: z.string().optional(),
});

type OrganizationFormData = z.infer<typeof organizationSchema>;

const CURRENCY_OPTIONS: SelectOption[] = [
  { value: 'NGN', label: 'Nigerian Naira (₦ NGN)', badge: '₦', badgeColor: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' },
  { value: 'USD', label: 'US Dollar ($ USD)', badge: '$', badgeColor: 'bg-blue-500/20 text-blue-400 border border-blue-500/30' },
  { value: 'GBP', label: 'British Pound (£ GBP)', badge: '£', badgeColor: 'bg-purple-500/20 text-purple-400 border border-purple-500/30' },
  { value: 'EUR', label: 'Euro (€ EUR)', badge: '€', badgeColor: 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' },
  { value: 'GHS', label: 'Ghanaian Cedi (₵ GHS)', badge: '₵', badgeColor: 'bg-amber-500/20 text-amber-400 border border-amber-500/30' },
  { value: 'KES', label: 'Kenyan Shilling (KSh KES)', badge: 'KSh', badgeColor: 'bg-teal-500/20 text-teal-400 border border-teal-500/30' },
  { value: 'ZAR', label: 'South African Rand (R ZAR)', badge: 'R', badgeColor: 'bg-orange-500/20 text-orange-400 border border-orange-500/30' },
];

export const CreateWorkspace: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedProduct = searchParams.get('product') || 'inventory';
  const host = useHost();
  const { user, refreshSession } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);

  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState<NigerianAddress>({
    country: 'Nigeria',
    state: '',
    stateCode: '',
    lga: '',
    city: '',
    street: '',
    blockNumber: '',
    area: '',
    landmark: '',
    postalCode: '',
  });

  const form = useForm<OrganizationFormData>({
    resolver: zodResolver(organizationSchema),
    defaultValues: {
      name: '',
      type: 'business',
      currency: 'NGN',
      email: user?.email || '',
      description: '',
    },
  });

  const selectedType = form.watch('type');
  const selectedCurrency = form.watch('currency');

  const handleCreateSubmit = async (data: OrganizationFormData) => {
    setIsLoading(true);
    try {
      const payload: any = {
        name: data.name.trim(),
        type: data.type,
        currency: data.currency,
        country: address.country || 'Nigeria',
        phone: phone || undefined,
        email: data.email || undefined,
        description: data.description || undefined,
      };

      if (address.state || address.city || address.street) {
        payload.state = address.state || undefined;
        payload.city = address.city || undefined;
        payload.lga = address.lga || undefined;
        payload.street = address.street || undefined;
        payload.blockNumber = address.blockNumber || undefined;
        payload.area = address.area || undefined;
        payload.landmark = address.landmark || undefined;
        payload.postalCode = address.postalCode || undefined;
      }

      const res = await api.post<{
        data?: { organization?: { id: string; name: string }; workspace?: { id: string; name: string } };
        organization?: { id: string; name: string };
        workspace?: { id: string; name: string };
      }>('/workspaces', payload);

      const createdId =
        res?.data?.workspace?.id ||
        res?.data?.organization?.id ||
        res?.workspace?.id ||
        res?.organization?.id;

      if (createdId) {
        try {
          await api.post(`/workspaces/${createdId}/products/${selectedProduct}/activate`);
        } catch {
          // Continue if product already auto-activated
        }
      }

      toast.success('Organization created successfully!');
      await refreshSession();

      const homeUrl = getHomeUrl(host.environment);
      window.location.href = `${homeUrl}?workspace_created=1&app=${selectedProduct}`;
    } catch (err: any) {
      toast.error(err.message || 'Failed to create organization.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout fullWidth={false}>
      <div className="w-full max-w-[460px] mx-auto space-y-5 animate-in fade-in duration-200">
        {/* Navigation & Header */}
        <div className="space-y-1.5 text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#714b67]/20 border border-[#714b67]/30 text-slate-300 text-[11px] font-medium mb-1">
            <span>New Organization</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Create an Organization
          </h1>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            Set up your organization to manage branches, team members, and inventory applications.
          </p>
        </div>

        {/* Direct Form without outer card container */}
        <form onSubmit={form.handleSubmit(handleCreateSubmit)} className="space-y-3.5">
          {/* Organization Name */}
          <div className="space-y-1">
            <Label htmlFor="name" className="text-xs font-medium text-slate-300">
              Organization / Business name <span className="text-rose-400">*</span>
            </Label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <Input
                id="name"
                {...form.register('name')}
                placeholder="e.g. Acme Stores Ltd"
                className={`pl-9 h-10 bg-[#0e0a0d] border-white/10 text-white placeholder:text-slate-600 rounded-xs text-xs focus:ring-1 focus:ring-[#714b67] ${
                  form.formState.errors.name ? 'border-rose-500/80' : ''
                }`}
                autoFocus
              />
            </div>
            {form.formState.errors.name && (
              <p className="text-[11px] text-rose-400">{form.formState.errors.name.message}</p>
            )}
          </div>

          {/* Classification Type */}
          <div className="space-y-1">
            <Label className="text-xs font-medium text-slate-300">
              Organization classification <span className="text-rose-400">*</span>
            </Label>
            <CustomSelect
              options={ORGANIZATION_TYPES.map((t) => ({
                value: t.id,
                label: t.label,
                badge: t.badge,
                description: t.description,
              }))}
              value={selectedType}
              onChange={(val) => form.setValue('type', val as any)}
              placeholder="Select organization type"
            />
          </div>

          {/* Currency Preference & Business Email */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-300">
                Base currency <span className="text-rose-400">*</span>
              </Label>
              <CustomSelect
                options={CURRENCY_OPTIONS}
                value={selectedCurrency}
                onChange={(val) => form.setValue('currency', val)}
                placeholder="Select currency"
                searchable={true}
                icon={<DollarSign className="w-3.5 h-3.5 text-slate-400" />}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="email" className="text-xs font-medium text-slate-300">
                Business email (optional)
              </Label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  id="email"
                  {...form.register('email')}
                  type="email"
                  placeholder="contact@company.com"
                  className="pl-9 h-10 bg-[#0e0a0d] border-white/10 text-white placeholder:text-slate-600 rounded-xs text-xs focus:ring-1 focus:ring-[#714b67]"
                />
              </div>
            </div>
          </div>

          {/* Phone Input */}
          <PhoneInput
            value={phone}
            onChange={(val) => setPhone(val)}
            label="Business contact phone"
            placeholder="0801 234 5678"
            showVerificationButton={false}
          />

          {/* Structured Address */}
          <div className="pt-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-2">
              <MapPin className="w-3.5 h-3.5 text-[#d4a8c9]" />
              <span>Primary branch address (optional)</span>
            </div>
            <AddressForm
              value={address}
              onChange={(updated) => setAddress(updated)}
            />
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-10 bg-gradient-to-r from-[#714b67] to-[#8d5b80] hover:from-[#8d5b80] hover:to-[#a06892] text-white rounded-xl font-semibold text-xs shadow-lg shadow-[#714b67]/25 cursor-pointer flex items-center justify-center gap-2 transition-all"
            >
              {isLoading ? (
                <>
                  <Spinner size="sm" className="text-white" />
                  <span>Creating organization...</span>
                </>
              ) : (
                <>
                  <span>Create & Launch Organization</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </AuthLayout>
  );
};
