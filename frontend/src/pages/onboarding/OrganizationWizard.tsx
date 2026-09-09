import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useLocationStore } from '@/stores/useLocationStore';
import { api } from '@/lib/api';
import { getHomeUrl, getCrossSubdomainUrl } from '@/lib/domain';
import { Header } from '@/components/landing/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CustomSelect, type SelectOption } from '@/components/ui/custom-select';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import {
  Building2,
  Phone,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  MapPin,
  Coins,
  Briefcase,
  Package,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Business Categories
const CATEGORY_OPTIONS: SelectOption[] = [
  { value: 'Provision Store', label: 'Provision Store / Supermarket', badge: 'Retail' },
  { value: 'Boutique', label: 'Boutique / Fashion & Apparel', badge: 'Fashion' },
  { value: 'Electronics', label: 'Electronics & Gadgets', badge: 'Tech' },
  { value: 'Cosmetics', label: 'Cosmetics & Beauty', badge: 'Beauty' },
  { value: 'Pharmacy', label: 'Pharmacy & Health', badge: 'Healthcare' },
  { value: 'Restaurant', label: 'Restaurant / Food & Beverage', badge: 'Food' },
  { value: 'Automobile', label: 'Automobile & Spare Parts', badge: 'Auto' },
  { value: 'Wholesale', label: 'Wholesale & Distribution', badge: 'Wholesale' },
  { value: 'Service', label: 'Service Business', badge: 'Service' },
  { value: 'Other', label: 'Other Business Type', badge: 'Other' },
];

// Business Description / Type (Optional context)
const BUSINESS_TYPE_OPTIONS = [
  { value: 'retail', label: 'Retail', desc: 'Direct sales to final customers' },
  { value: 'wholesale', label: 'Wholesale', desc: 'Bulk supply to other businesses' },
  { value: 'service', label: 'Service', desc: 'Providing skills, repairs, or labor' },
  { value: 'manufacturing', label: 'Manufacturing', desc: 'Producing or assembling goods' },
  { value: 'pharmacy/health', label: 'Pharmacy / Health', desc: 'Medicines, clinical items, wellness' },
  { value: 'food & beverage', label: 'Food & Beverage', desc: 'Meals, drinks, groceries' },
  { value: 'other', label: 'Other', desc: 'Specialized or mixed business model' },
];

// Branch Count Options
const BRANCH_COUNT_OPTIONS = [
  { value: '1', label: '1 Location', desc: 'Single store or primary warehouse' },
  { value: '2-5', label: '2–5 Locations', desc: 'A few branches or retail outlets' },
  { value: '6-20', label: '6–20 Locations', desc: 'Growing chain of stores' },
  { value: '20+', label: '20+ Locations', desc: 'Large enterprise footprint' },
];

// SKU Count Options
const SKU_COUNT_OPTIONS = [
  { value: '1-50', label: '1–50 Products', desc: 'Compact product catalog' },
  { value: '51-200', label: '51–200 Products', desc: 'Medium variety of stock' },
  { value: '201-1,000', label: '201–1,000 Products', desc: 'Broad inventory selection' },
  { value: '1,000+', label: '1,000+ Products', desc: 'High-volume diverse catalog' },
];

// Primary Users Options
const PRIMARY_USER_OPTIONS = [
  { id: 'owner', label: 'Owner / Founder' },
  { id: 'manager', label: 'Branch / General Manager' },
  { id: 'sales attendants', label: 'Sales Attendants / Cashiers' },
  { id: 'stock/store keepers', label: 'Stock & Store Keepers' },
  { id: 'accountant/bookkeeper', label: 'Accountant / Bookkeeper' },
  { id: 'other', label: 'Other Staff' },
];

export const OrganizationWizard: React.FC = () => {
  const { user, refreshSession } = useAuthStore();
  const { states, fetchStates } = useLocationStore();

  const [step, setStep] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [createdOrgData, setCreatedOrgData] = useState<{
    organizationId: string;
    name: string;
    hasDefaultBranch: boolean;
  } | null>(null);

  // Step 1: Core Fields (Required)
  const [name, setName] = useState('');
  const [phone, setPhone] = useState(user?.phone || '');
  const [category, setCategory] = useState('Provision Store');
  const [currency, setCurrency] = useState('NGN');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('Lagos');
  const [country] = useState('Nigeria');

  // Step 2: Context Questions (Optional)
  const [businessType, setBusinessType] = useState<string>('');
  const [branchCountRange, setBranchCountRange] = useState<string>('1');
  const [productCountRange, setProductCountRange] = useState<string>('');
  const [primaryUsers, setPrimaryUsers] = useState<string[]>(['owner']);

  useEffect(() => {
    fetchStates();
  }, [fetchStates]);

  const stateOptions: SelectOption[] = states.length > 0
    ? states.map((s) => ({ value: s.name, label: s.name }))
    : [
        { value: 'Lagos', label: 'Lagos' },
        { value: 'Abuja (FCT)', label: 'Abuja (FCT)' },
        { value: 'Rivers', label: 'Rivers' },
        { value: 'Oyo', label: 'Oyo' },
        { value: 'Kano', label: 'Kano' },
        { value: 'Delta', label: 'Delta' },
        { value: 'Ogun', label: 'Ogun' },
        { value: 'Anambra', label: 'Anambra' },
        { value: 'Kaduna', label: 'Kaduna' },
        { value: 'Enugu', label: 'Enugu' },
      ];

  const handleTogglePrimaryUser = (userId: string) => {
    if (primaryUsers.includes(userId)) {
      setPrimaryUsers(primaryUsers.filter((u) => u !== userId));
    } else {
      setPrimaryUsers([...primaryUsers, userId]);
    }
  };

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || name.trim().length < 2) {
      toast.error('Please enter a valid business name (at least 2 characters).');
      return;
    }
    if (!phone.trim()) {
      toast.error('Please enter a business phone number.');
      return;
    }
    if (!street.trim()) {
      toast.error('Please enter the street address or area.');
      return;
    }
    if (!city.trim()) {
      toast.error('Please enter the city.');
      return;
    }

    setStep(2);
  };

  const handleFinalSubmit = async (skipOptional: boolean = false) => {
    setIsLoading(true);
    try {
      const fullAddress = [street.trim(), city.trim(), stateName, country]
        .filter(Boolean)
        .join(', ');

      const payload = {
        name: name.trim(),
        phone: phone.trim(),
        category,
        currency,
        street: street.trim(),
        city: city.trim(),
        state: stateName,
        country,
        address: fullAddress,
        businessType: skipOptional ? undefined : businessType || undefined,
        branchCountRange: skipOptional ? '1' : branchCountRange || '1',
        productCountRange: skipOptional ? undefined : productCountRange || undefined,
        primaryUsers: skipOptional ? undefined : primaryUsers.length > 0 ? primaryUsers : undefined,
      };

      const res = await api.post<{
        organizationId: string;
        name: string;
        hasDefaultBranch: boolean;
      }>('/organizations/with-onboarding', payload);

      await refreshSession();

      setCreatedOrgData({
        organizationId: res.organizationId,
        name: res.name || name.trim(),
        hasDefaultBranch: res.hasDefaultBranch !== false,
      });

      toast.success(`Business "${name}" created successfully! Redirecting to dashboard...`);
      try {
        localStorage.setItem('orvio_active_workspace_id', res.organizationId);
      } catch {}
      const targetUrl = getHomeUrl();
      setTimeout(() => {
        window.location.href = targetUrl;
      }, 700);
      setStep(3);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create business. Please check your inputs.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-slate-100 flex flex-col justify-between selection:bg-[#714b67] selection:text-white">
      <Header />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Progress Tracker */}
        {step < 3 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#714b67]/20 border border-[#714b67]/30 text-[#c79dbd] text-[11px] font-bold mb-1.5">
                  <Sparkles className="w-3 h-3 text-[#FDB02F]" />
                  <span>Business Onboarding</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  {step === 1 ? 'Create Your Business' : 'Tailor Your Experience'}
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  {step === 1
                    ? 'Enter your business details to set up your organization on Orviohub.'
                    : 'Optional context questions to help us tailor Inventory and operations for your team.'}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold text-slate-400">Step {step} of 2</span>
              </div>
            </div>

            {/* Steps Progress Bar */}
            <div className="grid grid-cols-2 gap-2">
              <div
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  step >= 1 ? 'bg-[#714b67]' : 'bg-white/10'
                )}
              />
              <div
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  step >= 2 ? 'bg-[#714b67]' : 'bg-white/10'
                )}
              />
            </div>
          </div>
        )}

        {/* STEP 1: Core Organization Details */}
        {step === 1 && (
          <form onSubmit={handleStep1Submit} className="space-y-6">
            <div className="p-6 sm:p-8 rounded-2xl bg-[#120b10] border border-white/10 shadow-xl space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-white/5">
                <div className="w-10 h-10 rounded-xl bg-[#714b67]/20 border border-[#714b67]/40 flex items-center justify-center text-[#FDB02F]">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Business Information</h2>
                  <p className="text-xs text-slate-400">Required details for invoicing, stock tracking, and legal compliance</p>
                </div>
              </div>

              {/* Business Name */}
              <div className="space-y-2">
                <Label htmlFor="orgName" className="text-xs font-semibold text-slate-200">
                  Business Name <span className="text-rose-400">*</span>
                </Label>
                <Input
                  id="orgName"
                  placeholder="e.g., Prime Global Store or Adeola Supermarket"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-black/40 border-white/10 text-white placeholder:text-slate-600 focus:border-[#714b67]"
                  required
                />
              </div>

              {/* Business Phone & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="orgPhone" className="text-xs font-semibold text-slate-200">
                    Business Phone <span className="text-rose-400">*</span>
                  </Label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <Input
                      id="orgPhone"
                      placeholder="e.g. 08012345678 or +234..."
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="pl-9 bg-black/40 border-white/10 text-white placeholder:text-slate-600 focus:border-[#714b67]"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-200">
                    Business Category <span className="text-rose-400">*</span>
                  </Label>
                  <CustomSelect
                    value={category}
                    onChange={setCategory}
                    options={CATEGORY_OPTIONS}
                    placeholder="Select category"
                  />
                </div>
              </div>

              {/* Address Fields */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                  <MapPin className="w-4 h-4 text-[#FDB02F]" />
                  <span>Physical Location & Address</span>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="street" className="text-xs font-medium text-slate-300">
                    Street / Area Address <span className="text-rose-400">*</span>
                  </Label>
                  <Input
                    id="street"
                    placeholder="e.g. 14 Marina Road, Victoria Island"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    className="bg-black/40 border-white/10 text-white placeholder:text-slate-600 focus:border-[#714b67]"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city" className="text-xs font-medium text-slate-300">
                      City / Town <span className="text-rose-400">*</span>
                    </Label>
                    <Input
                      id="city"
                      placeholder="e.g. Ikeja"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="bg-black/40 border-white/10 text-white placeholder:text-slate-600 focus:border-[#714b67]"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-slate-300">
                      State <span className="text-rose-400">*</span>
                    </Label>
                    <CustomSelect
                      value={stateName}
                      onChange={setStateName}
                      options={stateOptions}
                      placeholder="Select State"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-slate-300">Country</Label>
                    <Input
                      value={country}
                      disabled
                      className="bg-white/5 border-white/10 text-slate-400 cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              {/* Currency & Billing Note */}
              <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-200">
                    Operating Currency
                  </Label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setCurrency('NGN')}
                      className={cn(
                        'flex-1 py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all',
                        currency === 'NGN'
                          ? 'bg-[#714b67] border-[#714b67] text-white shadow-md'
                          : 'bg-black/40 border-white/10 text-slate-400 hover:border-white/20'
                      )}
                    >
                      <Coins className="w-3.5 h-3.5" />
                      <span>NGN (₦) - Default</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrency('USD')}
                      className={cn(
                        'flex-1 py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all',
                        currency === 'USD'
                          ? 'bg-[#714b67] border-[#714b67] text-white shadow-md'
                          : 'bg-black/40 border-white/10 text-slate-400 hover:border-white/20'
                      )}
                    >
                      <span>USD ($)</span>
                    </button>
                  </div>
                </div>

                  <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-emerald-300">30-Day Free Trial Included</p>
                      <p className="text-[11px] text-slate-300 leading-relaxed mt-0.5">
                        Your new business starts with a <strong className="text-white">30-Day Free Trial</strong> (1 Activated App, 1 Branch, and up to 2 team members). No credit card required.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between pt-2">
              <a
                href={getHomeUrl()}
                className="text-xs text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </a>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleFinalSubmit(true)}
                  disabled={isLoading}
                  className="border-white/10 text-slate-300 hover:bg-white/5 text-xs"
                >
                  Skip Context & Create
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="bg-[#714b67] hover:bg-[#86597a] text-white font-bold text-xs px-6 py-2.5 shadow-lg shadow-[#714b67]/30"
                >
                  <span>Next: Tailor Experience</span>
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              </div>
            </div>
          </form>
        )}

        {/* STEP 2: Optional Context Questions */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="p-6 sm:p-8 rounded-2xl bg-[#120b10] border border-white/10 shadow-xl space-y-8">
              <div className="flex items-center justify-between pb-4 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#714b67]/20 border border-[#714b67]/40 flex items-center justify-center text-[#FDB02F]">
                    <Briefcase className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Business Context (Optional)</h2>
                    <p className="text-xs text-slate-400">Help us configure defaults and recommendations for your setup</p>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-[#c79dbd] bg-[#714b67]/20 px-2.5 py-1 rounded-full border border-[#714b67]/30">
                  Optional Questions
                </span>
              </div>

              {/* 1. How would you describe this business? */}
              <div className="space-y-3">
                <Label className="text-xs font-semibold text-slate-200">
                  1. How would you describe this business?
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {BUSINESS_TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setBusinessType(opt.value)}
                      className={cn(
                        'p-3 rounded-xl border text-left transition-all',
                        businessType === opt.value
                          ? 'bg-[#714b67]/20 border-[#714b67] text-white ring-1 ring-[#714b67]'
                          : 'bg-black/30 border-white/5 text-slate-300 hover:border-white/20'
                      )}
                    >
                      <div className="font-semibold text-xs text-white">{opt.label}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. How many physical locations (branches)? */}
              <div className="space-y-3">
                <Label className="text-xs font-semibold text-slate-200">
                  2. How many physical locations (branches) does this business have?
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {BRANCH_COUNT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setBranchCountRange(opt.value)}
                      className={cn(
                        'p-3 rounded-xl border text-left transition-all',
                        branchCountRange === opt.value
                          ? 'bg-[#714b67]/20 border-[#714b67] text-white ring-1 ring-[#714b67]'
                          : 'bg-black/30 border-white/5 text-slate-300 hover:border-white/20'
                      )}
                    >
                      <div className="font-bold text-xs text-white">{opt.label}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{opt.desc}</div>
                    </button>
                  ))}
                </div>
                {branchCountRange === '1' && (
                  <p className="text-[11px] text-[#FDB02F] flex items-center gap-1.5 mt-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>A default &ldquo;Main Branch&rdquo; will be automatically provisioned for you.</span>
                  </p>
                )}
              </div>

              {/* 3. Approximately how many products/SKUs do you manage? */}
              <div className="space-y-3">
                <Label className="text-xs font-semibold text-slate-200">
                  3. Approximately how many products/SKUs do you manage?
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {SKU_COUNT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setProductCountRange(opt.value)}
                      className={cn(
                        'p-3 rounded-xl border text-left transition-all',
                        productCountRange === opt.value
                          ? 'bg-[#714b67]/20 border-[#714b67] text-white ring-1 ring-[#714b67]'
                          : 'bg-black/30 border-white/5 text-slate-300 hover:border-white/20'
                      )}
                    >
                      <div className="font-bold text-xs text-white">{opt.label}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Who will primarily use Orviohub in this business? */}
              <div className="space-y-3">
                <Label className="text-xs font-semibold text-slate-200">
                  4. Who will primarily use Orviohub in this business? (Select all that apply)
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {PRIMARY_USER_OPTIONS.map((opt) => {
                    const isSelected = primaryUsers.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleTogglePrimaryUser(opt.id)}
                        className={cn(
                          'p-3 rounded-xl border text-left flex items-center justify-between transition-all',
                          isSelected
                            ? 'bg-[#714b67]/25 border-[#714b67] text-white ring-1 ring-[#714b67]'
                            : 'bg-black/30 border-white/5 text-slate-300 hover:border-white/20'
                        )}
                      >
                        <span className="text-xs font-medium">{opt.label}</span>
                        <div
                          className={cn(
                            'w-4 h-4 rounded flex items-center justify-center text-[10px] transition-all',
                            isSelected
                              ? 'bg-[#714b67] text-white'
                              : 'border border-white/20'
                          )}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
                disabled={isLoading}
                className="border-white/10 text-slate-300 hover:bg-white/5 text-xs"
              >
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                <span>Back to Details</span>
              </Button>

              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleFinalSubmit(true)}
                  disabled={isLoading}
                  className="text-slate-400 hover:text-white text-xs"
                >
                  Skip Context
                </Button>
                <Button
                  type="button"
                  onClick={() => handleFinalSubmit(false)}
                  disabled={isLoading}
                  className="bg-[#714b67] hover:bg-[#86597a] text-white font-bold text-xs px-6 py-2.5 shadow-lg shadow-[#714b67]/30"
                >
                  {isLoading ? (
                    <>
                      <Spinner className="w-4 h-4 mr-2" />
                      <span>Creating Business...</span>
                    </>
                  ) : (
                    <>
                      <span>Complete & Create Business</span>
                      <CheckCircle2 className="w-4 h-4 ml-1.5" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Success Confirmation Screen */}
        {step === 3 && (
          <div className="p-8 sm:p-10 rounded-2xl bg-[#120b10] border border-[#714b67]/40 shadow-2xl space-y-8 text-center max-w-xl mx-auto animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 rounded-3xl bg-[#714b67]/20 border border-[#714b67]/50 flex items-center justify-center text-[#FDB02F] mx-auto shadow-lg shadow-[#714b67]/20">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-extrabold text-white tracking-tight">
                {createdOrgData?.name} is Registered!
              </h2>
              <p className="text-xs text-slate-300 max-w-md mx-auto">
                Your business has been registered on Orviohub with Owner privileges. You can now manage your organization and activate applications when you're ready.
              </p>
            </div>

            {/* Feature Highlights Card */}
            <div className="p-4 rounded-xl bg-black/40 border border-white/10 text-left space-y-3">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-white/5">
                <span className="text-slate-400">Applications</span>
                <span className="text-slate-300 font-medium flex items-center gap-1">
                  Ready to activate
                </span>
              </div>
              <div className="flex items-center justify-between text-xs pb-2 border-b border-white/5">
                <span className="text-slate-400">Owner Access</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Full Administrative Rights
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Operating Currency</span>
                <span className="text-white font-medium">{currency}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <a
                href={getHomeUrl()}
                className="w-full sm:w-1/2 py-3 px-4 rounded-xl bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-bold shadow-lg shadow-[#714b67]/30 transition-all flex items-center justify-center gap-2 hover:scale-[1.02]"
              >
                <Building2 className="w-4 h-4" />
                <span>Go to Dashboard</span>
              </a>
              <a
                href={getCrossSubdomainUrl('inventory', `/onboard/activate?org=${createdOrgData?.organizationId || ''}`)}
                className="w-full sm:w-1/2 py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-semibold transition-all flex items-center justify-center gap-2"
              >
                <Package className="w-4 h-4 text-[#FDB02F]" />
                <span>Activate Inventory</span>
              </a>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
