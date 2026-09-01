import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { useOnboardingStore } from '@/stores/useOnboardingStore';
import { useLocationStore } from '@/stores/useLocationStore';
import { useHost } from '@/host/useHost';
import { getApplicationUrl, ApplicationKey } from '@orviohub/shared';
import { api } from '@/lib/api';
import { Header } from '@/components/landing/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CustomSelect, type SelectOption } from '@/components/ui/custom-select';
import { LgaSelector } from '@/components/location/LgaSelector';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import {
  Building2,
  Store,
  Phone,
  Layers,
  CreditCard,
  UserPlus,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Check,
  Plus,
  Trash2,
  Boxes,
  ListTodo,
  Dumbbell,
  CalendarCheck,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const DRAFT_KEY = 'orvio_universal_org_draft';

// 1. Organization Types
const ORG_TYPES: SelectOption[] = [
  { value: 'business', label: 'Business / Retail Store', badge: 'Retail' },
  { value: 'company', label: 'Company / Corporate Team', badge: 'Company' },
  { value: 'gym', label: 'Gym / Fitness Club', badge: 'Fitness' },
  { value: 'school', label: 'School / Academic Institution', badge: 'Education' },
  { value: 'personal', label: 'Personal / Sole Proprietor', badge: 'Solo' },
  { value: 'other', label: 'Other Business Type', badge: 'Other' },
];

// 2. Product Catalog definitions for Step 4
interface ProductChoice {
  id: string;
  name: string;
  badge: string;
  desc: string;
  icon: React.ElementType;
  planReq: 'Free' | 'Standard+' | 'Premium';
  defaultSelected?: boolean;
}

const AVAILABLE_PRODUCTS: ProductChoice[] = [
  {
    id: 'inventory',
    name: 'Inventory & Store Operations',
    badge: 'Free',
    desc: 'Stock tracking, barcode POS register, branch stores, and invoice sales.',
    icon: Boxes,
    planReq: 'Free',
    defaultSelected: true,
  },
  {
    id: 'taskmanagement',
    name: 'Task & Project Management',
    badge: 'Free',
    desc: 'Kanban boards, team workflows, project milestones, and assignment tracking.',
    icon: ListTodo,
    planReq: 'Free',
    defaultSelected: true,
  },
  {
    id: 'gym',
    name: 'Gym & Club Management',
    badge: 'Standard+',
    desc: 'Member subscriptions, access control, workout tracking, and trainer schedules.',
    icon: Dumbbell,
    planReq: 'Standard+',
  },
  {
    id: 'bookings',
    name: 'Appointments & Bookings',
    badge: 'Standard+',
    desc: 'Online calendar bookings, automated SMS reminders, and schedule dispatch.',
    icon: CalendarCheck,
    planReq: 'Standard+',
  },
  {
    id: 'crm',
    name: 'CRM & Client Pipeline',
    badge: 'Premium',
    desc: 'Customer relations, lead scoring, deal pipelines, and automated outreach.',
    icon: Users,
    planReq: 'Premium',
  },
];

// 3. Plan Tiers for Step 5
interface PlanTier {
  id: string;
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  badge?: string;
  isPopular?: boolean;
  limits: string[];
}

const PLAN_TIERS: PlanTier[] = [
  {
    id: 'free',
    name: 'Free Starter',
    monthlyPrice: 0,
    annualPrice: 0,
    limits: ['1 Organization', '1 Active App', '2 Team Members', '1 Primary Branch'],
  },
  {
    id: 'standard',
    name: 'Standard Pro',
    monthlyPrice: 7500,
    annualPrice: 6250, // ₦75,000 / yr (save ~17%)
    isPopular: true,
    badge: 'Most Popular',
    limits: ['3 Organizations', '3 Active Apps', '10 Team Members', '3 Branches'],
  },
  {
    id: 'premium',
    name: 'Premium Enterprise',
    monthlyPrice: 20000,
    annualPrice: 16600, // ₦199,200 / yr (save ~17%)
    badge: 'Full Power',
    limits: ['10 Organizations', 'Unlimited Apps', '50 Team Members', '10 Branches'],
  },
];

const ROLE_OPTIONS: SelectOption[] = [
  { value: 'admin', label: 'Admin (Full Management)', badge: 'Admin' },
  { value: 'manager', label: 'Branch Manager', badge: 'Manager' },
  { value: 'sales_attendant', label: 'Sales Attendant / Cashier', badge: 'Cashier' },
  { value: 'stock_manager', label: 'Stock & Inventory Manager', badge: 'Inventory' },
  { value: 'member', label: 'Team Member', badge: 'Member' },
];

interface TeamInviteRow {
  email: string;
  role: string;
  branchAccess: string[];
}

export const OrganizationWizard: React.FC = () => {
  const [searchParams] = useSearchParams();
  const preselectProduct = searchParams.get('product') || searchParams.get('app');
  const host = useHost();
  const { user, refreshSession } = useAuthStore();
  const { states, fetchStates } = useLocationStore();
  const { completeFlow } = useOnboardingStore();

  const [step, setStep] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(false);

  // Step 1: Organization Details
  const [orgName, setOrgName] = useState('');
  const [orgType, setOrgType] = useState('business');
  const country = 'Nigeria';
  const currency = 'NGN';
  const timezone = 'Africa/Lagos';

  // Step 2: Primary Branch Setup
  const [branchName, setBranchName] = useState('Main Store');
  const [branchCode, setBranchCode] = useState('MAIN');
  const [stateCode, setStateCode] = useState('LA');
  const [stateName, setStateName] = useState('Lagos');
  const [lgaName, setLgaName] = useState('');
  const [city, setCity] = useState('Ikeja');
  const [area, setArea] = useState('');
  const [street, setStreet] = useState('');
  const [blockNumber, setBlockNumber] = useState('');
  const [landmark, setLandmark] = useState('');

  // Step 3: Contact Details
  const [phoneMode, setPhoneMode] = useState<'verified' | 'custom'>(user?.phone ? 'verified' : 'custom');
  const [customPhone, setCustomPhone] = useState(user?.phone || '');
  const [addressMode, setAddressMode] = useState<'same_as_branch' | 'custom'>('same_as_branch');
  const [customBizStreet, setCustomBizStreet] = useState('');
  const [customBizCity, setCustomBizCity] = useState('');
  const [customBizState, setCustomBizState] = useState('Lagos');

  // Step 4: Product Selection
  const [selectedProducts, setSelectedProducts] = useState<string[]>(
    preselectProduct ? [preselectProduct] : ['inventory', 'taskmanagement']
  );
  const [activateAllApps, setActivateAllApps] = useState(false);

  // Step 5: Plan Selection
  const [selectedPlan, setSelectedPlan] = useState<'free' | 'standard' | 'premium'>('free');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  // Step 6: Team Invitation
  const [teamInvites, setTeamInvites] = useState<TeamInviteRow[]>([]);

  // Load States on mount
  useEffect(() => {
    fetchStates();
  }, [fetchStates]);

  // Load Draft & Merge URL parameters
  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem(DRAFT_KEY);
      if (savedDraft) {
        const d = JSON.parse(savedDraft);
        if (d.orgName) setOrgName(d.orgName);
        if (d.orgType) setOrgType(d.orgType);
        if (d.branchName) setBranchName(d.branchName);
        if (d.branchCode) setBranchCode(d.branchCode);
        if (d.stateCode) setStateCode(d.stateCode);
        if (d.stateName) setStateName(d.stateName);
        if (d.lgaName) setLgaName(d.lgaName);
        if (d.city) setCity(d.city);
        if (d.street) setStreet(d.street);
        if (d.blockNumber) setBlockNumber(d.blockNumber);
        if (d.selectedPlan) setSelectedPlan(d.selectedPlan);

        if (Array.isArray(d.selectedProducts) && d.selectedProducts.length > 0) {
          if (preselectProduct && !d.selectedProducts.includes(preselectProduct)) {
            setSelectedProducts([preselectProduct, ...d.selectedProducts]);
          } else {
            setSelectedProducts(d.selectedProducts);
          }
        }
      }
    } catch {}
  }, [preselectProduct]);

  // Save Draft
  const saveDraft = () => {
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          orgName,
          orgType,
          branchName,
          branchCode,
          stateCode,
          stateName,
          lgaName,
          city,
          street,
          blockNumber,
          selectedProducts,
          selectedPlan,
        })
      );
    } catch {}
  };

  const handleStateChange = (newCode: string) => {
    setStateCode(newCode);
    const foundState = states.find((s) => s.code === newCode);
    setStateName(foundState?.name || 'Lagos');
    setLgaName('');
  };

  // Toggle Product
  const toggleProduct = (prodId: string) => {
    if (selectedProducts.includes(prodId)) {
      if (selectedProducts.length === 1) {
        toast.error('You must keep at least 1 application selected.');
        return;
      }
      setSelectedProducts(selectedProducts.filter((p) => p !== prodId));
    } else {
      setSelectedProducts([...selectedProducts, prodId]);
    }
  };

  // Activate All
  const handleToggleActivateAll = (checked: boolean) => {
    setActivateAllApps(checked);
    if (checked) {
      setSelectedProducts(AVAILABLE_PRODUCTS.map((p) => p.id));
      setSelectedPlan('premium');
    }
  };

  // Navigation steps validation
  const handleNext = () => {
    saveDraft();
    if (step === 1) {
      if (!orgName.trim() || orgName.trim().length < 2) {
        toast.error('Please enter a valid organization name (at least 2 characters).');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!branchName.trim()) {
        toast.error('Please enter a primary branch name.');
        return;
      }
      if (!street.trim() || !blockNumber.trim()) {
        toast.error('Please specify the street and block number for your primary branch.');
        return;
      }
      setStep(3);
    } else if (step === 3) {
      if (phoneMode === 'custom' && !customPhone.trim()) {
        toast.error('Please enter your business phone number.');
        return;
      }
      setStep(4);
    } else if (step === 4) {
      if (selectedProducts.length === 0) {
        toast.error('Please select at least 1 application.');
        return;
      }
      setStep(5);
    } else if (step === 5) {
      setStep(6);
    } else if (step === 6) {
      handleFinalSubmission();
    }
  };

  const handleFinalSubmission = async () => {
    setIsLoading(true);
    try {
      const finalPhone = phoneMode === 'verified' ? user?.phone || customPhone : customPhone;

      const payload = {
        name: orgName.trim(),
        industry: orgType,
        country,
        timezone,
        currency,
        phone: finalPhone,
        planId: selectedPlan,
        products: selectedProducts,
        primaryBranch: {
          name: branchName.trim() || 'Main Store',
          code: (branchCode.trim() || 'MAIN').toUpperCase().slice(0, 4),
          country,
          state: stateName,
          stateCode,
          lga: lgaName,
          city: city.trim() || 'Ikeja',
          street: street.trim(),
          blockNumber: blockNumber.trim(),
          area: area.trim(),
          landmark: landmark.trim(),
        },
        invitations: teamInvites
          .filter((inv) => inv.email && inv.email.includes('@'))
          .slice(0, 5)
          .map((inv) => ({
            email: inv.email.trim().toLowerCase(),
            role: inv.role,
            branchAccess: [branchCode || 'MAIN'],
          })),
      };

      await api.post<{
        organization: { id: string; name: string; slug: string };
      }>('/organizations', payload);

      localStorage.removeItem(DRAFT_KEY);

      await refreshSession();
      await completeFlow();

      toast.success(`Organization "${orgName}" successfully provisioned!`);
      setStep(7);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create organization. Please check inputs.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 7 Redirect Handlers
  const handleLaunchProduct = (productKey: string) => {
    const targetUrl = getApplicationUrl(productKey as ApplicationKey, host.environment);
    // Direct user to product onboarding or dashboard
    window.location.href = `${targetUrl}/onboarding`;
  };

  const handleGoToDashboard = () => {
    const homeUrl = getApplicationUrl('home', host.environment);
    window.location.href = homeUrl;
  };

  const stateOptions: SelectOption[] = states.map((s) => ({
    value: s.code,
    label: s.name,
  }));

  const stepsList = [
    { num: 1, title: 'Org Details', icon: Building2 },
    { num: 2, title: 'Primary Branch', icon: Store },
    { num: 3, title: 'Contact', icon: Phone },
    { num: 4, title: 'Apps', icon: Layers },
    { num: 5, title: 'Plan', icon: CreditCard },
    { num: 6, title: 'Team', icon: UserPlus },
    { num: 7, title: 'Ready', icon: CheckCircle2 },
  ];

  return (
    <div className="min-h-screen bg-black text-slate-100 flex flex-col justify-between selection:bg-[#714b67]/30 selection:text-white">
      <Header />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Progress Navigation Header */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[#9d6b8f]">
                Workspace Provisioning
              </p>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                {step === 7 ? 'Organization Provisioned' : 'Set Up Your Organization'}
              </h1>
            </div>
            <div className="text-right">
              <span className="text-xs font-medium text-slate-400">Step {step} of 7</span>
            </div>
          </div>

          {/* Stepper bar */}
          <div className="grid grid-cols-7 gap-1.5 pt-2">
            {stepsList.map((s) => {
              const isPast = s.num < step;
              const isCurrent = s.num === step;
              return (
                <div key={s.num} className="space-y-1.5">
                  <div
                    className={cn(
                      'h-1.5 rounded-full transition-all duration-300',
                      isPast && 'bg-emerald-500',
                      isCurrent && 'bg-[#714b67]',
                      !isPast && !isCurrent && 'bg-white/10'
                    )}
                  />
                  <p
                    className={cn(
                      'text-[10px] truncate font-medium hidden sm:block',
                      isCurrent ? 'text-white' : isPast ? 'text-emerald-400' : 'text-slate-500'
                    )}
                  >
                    {s.title}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Wizard Form Container */}
        <div className="bg-[#120b10] border border-white/10 rounded-sm p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden">
          {/* STEP 1: ORGANIZATION DETAILS */}
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-white">1. Organization Details</h2>
                <p className="text-xs text-slate-400">
                  Enter your business or organization name and operating defaults.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300 font-medium">
                    What's your organization name? <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="e.g. Code X Stores Ltd"
                    className="bg-black/60 border-white/15 text-white h-11 focus:border-[#714b67]"
                    autoFocus
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300 font-medium">
                    What type of organization is this? <span className="text-red-400">*</span>
                  </Label>
                  <CustomSelect
                    options={ORG_TYPES}
                    value={orgType}
                    onChange={setOrgType}
                    placeholder="Select organization category"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div className="space-y-1 bg-black/40 border border-white/5 rounded-xs p-3">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Country</span>
                    <p className="text-sm font-medium text-white">Nigeria (Fixed)</p>
                  </div>
                  <div className="space-y-1 bg-black/40 border border-white/5 rounded-xs p-3">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Currency</span>
                    <p className="text-sm font-medium text-white">NGN (₦ Naira)</p>
                  </div>
                  <div className="space-y-1 bg-black/40 border border-white/5 rounded-xs p-3">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Timezone</span>
                    <p className="text-sm font-medium text-white">Africa/Lagos (WAT)</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: PRIMARY BRANCH SETUP */}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-white">2. Primary Branch Setup</h2>
                <p className="text-xs text-slate-400">
                  Every organization starts with at least one primary operating branch or physical location.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs text-slate-300 font-medium">
                    Where will you operate from? (Branch Name) <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    placeholder="e.g. Main Store"
                    className="bg-black/60 border-white/15 text-white h-11 focus:border-[#714b67]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300 font-medium">
                    Branch Code <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    value={branchCode}
                    onChange={(e) => setBranchCode(e.target.value.toUpperCase().slice(0, 4))}
                    placeholder="MAIN"
                    maxLength={4}
                    className="bg-black/60 border-white/15 text-white h-11 uppercase font-mono focus:border-[#714b67]"
                  />
                </div>
              </div>

              <div className="border-t border-white/10 pt-4 space-y-4">
                <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
                  Branch Physical Address (Nigeria)
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300 font-medium">
                      State <span className="text-red-400">*</span>
                    </Label>
                    <CustomSelect
                      options={stateOptions}
                      value={stateCode}
                      onChange={handleStateChange}
                      placeholder="Select Nigerian State"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <LgaSelector
                      stateCode={stateCode}
                      value={lgaName}
                      onChange={setLgaName}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300 font-medium">
                      City <span className="text-red-400">*</span>
                    </Label>
                    <Input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Ikeja"
                      className="bg-black/60 border-white/15 text-white h-10"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300 font-medium">
                      Area / Neighborhood
                    </Label>
                    <Input
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                      placeholder="e.g. Allen Avenue"
                      className="bg-black/60 border-white/15 text-white h-10"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300 font-medium">
                      Nearest Landmark
                    </Label>
                    <Input
                      value={landmark}
                      onChange={(e) => setLandmark(e.target.value)}
                      placeholder="e.g. Opp. City Mall"
                      className="bg-black/60 border-white/15 text-white h-10"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="sm:col-span-1 space-y-1.5">
                    <Label className="text-xs text-slate-300 font-medium">
                      Block / Building No. <span className="text-red-400">*</span>
                    </Label>
                    <Input
                      value={blockNumber}
                      onChange={(e) => setBlockNumber(e.target.value)}
                      placeholder="e.g. 14B"
                      className="bg-black/60 border-white/15 text-white h-10"
                    />
                  </div>
                  <div className="sm:col-span-3 space-y-1.5">
                    <Label className="text-xs text-slate-300 font-medium">
                      Street Name <span className="text-red-400">*</span>
                    </Label>
                    <Input
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      placeholder="e.g. Oba Akran Avenue"
                      className="bg-black/60 border-white/15 text-white h-10"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: CONTACT DETAILS */}
          {step === 3 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-white">3. Contact Details</h2>
                <p className="text-xs text-slate-400">
                  Provide customer contact information and formal business address.
                </p>
              </div>

              {/* Phone section */}
              <div className="space-y-3 bg-black/40 border border-white/10 rounded-xs p-4">
                <Label className="text-xs font-semibold text-slate-200 uppercase tracking-wide">
                  Customer Support Phone <span className="text-red-400">*</span>
                </Label>

                {user?.phone && (
                  <label className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-white/5">
                    <input
                      type="radio"
                      name="phoneMode"
                      checked={phoneMode === 'verified'}
                      onChange={() => setPhoneMode('verified')}
                      className="accent-[#714b67]"
                    />
                    <div>
                      <p className="text-sm font-medium text-white">
                        Use my verified phone ({user.phone})
                      </p>
                      <p className="text-xs text-emerald-400 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Account owner phone verified
                      </p>
                    </div>
                  </label>
                )}

                <label className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-white/5">
                  <input
                    type="radio"
                    name="phoneMode"
                    checked={phoneMode === 'custom'}
                    onChange={() => setPhoneMode('custom')}
                    className="accent-[#714b67]"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">Enter new business phone</p>
                  </div>
                </label>

                {phoneMode === 'custom' && (
                  <div className="pl-6 pt-1 space-y-1.5">
                    <Input
                      value={customPhone}
                      onChange={(e) => setCustomPhone(e.target.value)}
                      placeholder="e.g. +234 801 234 5678"
                      className="bg-black border-white/20 text-white h-10 max-w-md"
                    />
                  </div>
                )}
              </div>

              {/* Business address section */}
              <div className="space-y-3 bg-black/40 border border-white/10 rounded-xs p-4">
                <Label className="text-xs font-semibold text-slate-200 uppercase tracking-wide">
                  Business Legal Address <span className="text-red-400">*</span>
                </Label>

                <label className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-white/5">
                  <input
                    type="radio"
                    name="addressMode"
                    checked={addressMode === 'same_as_branch'}
                    onChange={() => setAddressMode('same_as_branch')}
                    className="accent-[#714b67]"
                  />
                  <div>
                    <p className="text-sm font-medium text-white">Same as Primary Branch Address</p>
                    <p className="text-xs text-slate-400">
                      {blockNumber} {street}, {city}, {stateName}
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-white/5">
                  <input
                    type="radio"
                    name="addressMode"
                    checked={addressMode === 'custom'}
                    onChange={() => setAddressMode('custom')}
                    className="accent-[#714b67]"
                  />
                  <p className="text-sm font-medium text-white">Enter distinct corporate address</p>
                </label>

                {addressMode === 'custom' && (
                  <div className="pl-6 pt-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Input
                      value={customBizStreet}
                      onChange={(e) => setCustomBizStreet(e.target.value)}
                      placeholder="Street name & number"
                      className="bg-black border-white/20 text-white h-10"
                    />
                    <Input
                      value={customBizCity}
                      onChange={(e) => setCustomBizCity(e.target.value)}
                      placeholder="City"
                      className="bg-black border-white/20 text-white h-10"
                    />
                    <Input
                      value={customBizState}
                      onChange={(e) => setCustomBizState(e.target.value)}
                      placeholder="State"
                      className="bg-black border-white/20 text-white h-10"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 4: PRODUCT SELECTION */}
          {step === 4 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold text-white">4. Product Selection</h2>
                  <p className="text-xs text-slate-400">
                    Which applications do you need for this organization? (Select 1 or more)
                  </p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded border border-white/10">
                  <input
                    type="checkbox"
                    checked={activateAllApps}
                    onChange={(e) => handleToggleActivateAll(e.target.checked)}
                    className="accent-[#714b67]"
                  />
                  <span className="text-xs font-semibold text-white">Activate All Apps</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {AVAILABLE_PRODUCTS.map((prod) => {
                  const isSelected = selectedProducts.includes(prod.id);
                  const Icon = prod.icon;
                  return (
                    <div
                      key={prod.id}
                      onClick={() => toggleProduct(prod.id)}
                      className={cn(
                        'cursor-pointer border rounded-sm p-4 transition-all duration-200 space-y-3',
                        isSelected
                          ? 'bg-[#714b67]/20 border-[#714b67] shadow-lg shadow-[#714b67]/10'
                          : 'bg-black/40 border-white/10 hover:border-white/20'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'w-9 h-9 rounded flex items-center justify-center',
                              isSelected ? 'bg-[#714b67] text-white' : 'bg-white/10 text-slate-400'
                            )}
                          >
                            <Icon className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="text-sm font-semibold text-white">{prod.name}</h3>
                            <span className="text-[10px] text-slate-400 font-medium">
                              Tier: {prod.planReq}
                            </span>
                          </div>
                        </div>
                        <div
                          className={cn(
                            'w-5 h-5 rounded flex items-center justify-center border',
                            isSelected
                              ? 'bg-[#714b67] border-[#714b67] text-white'
                              : 'border-white/30 bg-black/40'
                          )}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </div>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{prod.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 5: PLAN SELECTION */}
          {step === 5 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold text-white">5. Plan Selection</h2>
                  <p className="text-xs text-slate-400">
                    Choose a subscription plan that fits your organization scale.
                  </p>
                </div>

                {/* Billing cycle toggle */}
                <div className="flex items-center bg-black border border-white/15 p-1 rounded-sm self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setBillingCycle('monthly')}
                    className={cn(
                      'px-3 py-1 text-xs font-semibold rounded-xs transition-all',
                      billingCycle === 'monthly'
                        ? 'bg-[#714b67] text-white'
                        : 'text-slate-400 hover:text-white'
                    )}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingCycle('annual')}
                    className={cn(
                      'px-3 py-1 text-xs font-semibold rounded-xs transition-all flex items-center gap-1',
                      billingCycle === 'annual'
                        ? 'bg-[#714b67] text-white'
                        : 'text-slate-400 hover:text-white'
                    )}
                  >
                    Annual <span className="text-[10px] text-emerald-400 font-bold">Save 17%</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {PLAN_TIERS.map((tier) => {
                  const isSelected = selectedPlan === tier.id;
                  const price = billingCycle === 'monthly' ? tier.monthlyPrice : tier.annualPrice;
                  return (
                    <div
                      key={tier.id}
                      onClick={() => setSelectedPlan(tier.id as any)}
                      className={cn(
                        'cursor-pointer border rounded-sm p-5 transition-all duration-200 flex flex-col justify-between space-y-4 relative',
                        isSelected
                          ? 'bg-[#714b67]/25 border-[#714b67] shadow-xl shadow-[#714b67]/20 ring-1 ring-[#714b67]'
                          : 'bg-black/40 border-white/10 hover:border-white/20'
                      )}
                    >
                      {tier.badge && (
                        <div className="absolute -top-3 right-4 bg-[#714b67] text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                          {tier.badge}
                        </div>
                      )}

                      <div className="space-y-2">
                        <h3 className="text-base font-bold text-white">{tier.name}</h3>
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-black text-white">
                            {price === 0 ? '₦0' : `₦${price.toLocaleString()}`}
                          </span>
                          <span className="text-xs text-slate-400 font-medium">/ month</span>
                        </div>
                        {billingCycle === 'annual' && price > 0 && (
                          <p className="text-[10px] text-emerald-400 font-semibold">
                            Billed annually (₦{(price * 12).toLocaleString()}/yr)
                          </p>
                        )}
                      </div>

                      <div className="border-t border-white/10 pt-3 space-y-2">
                        {tier.limits.map((lim, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs text-slate-300">
                            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>{lim}</span>
                          </div>
                        ))}
                      </div>

                      <Button
                        type="button"
                        className={cn(
                          'w-full text-xs font-semibold h-9 rounded-xs',
                          isSelected
                            ? 'bg-[#714b67] hover:bg-[#85597a] text-white'
                            : 'bg-white/10 hover:bg-white/15 text-white'
                        )}
                      >
                        {isSelected ? 'Selected Plan' : 'Select Plan'}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 6: TEAM INVITATION (OPTIONAL) */}
          {step === 6 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold text-white">6. Team Invitation (Optional)</h2>
                  <p className="text-xs text-slate-400">
                    Invite colleagues or store attendants to your organization. You can also do this later.
                  </p>
                </div>
                {teamInvites.length < 5 && (
                  <Button
                    type="button"
                    onClick={() =>
                      setTeamInvites([
                        ...teamInvites,
                        { email: '', role: 'sales_attendant', branchAccess: [branchCode || 'MAIN'] },
                      ])
                    }
                    className="bg-white/10 hover:bg-white/15 text-white text-xs h-8 px-3 rounded-xs"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Member
                  </Button>
                )}
              </div>

              {teamInvites.length === 0 ? (
                <div className="text-center py-8 bg-black/40 border border-white/5 rounded-xs space-y-3">
                  <UserPlus className="w-8 h-8 text-slate-500 mx-auto" />
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    No invites added yet. Click "+ Add Member" to invite staff, or skip this step to proceed.
                  </p>
                  <Button
                    type="button"
                    onClick={() =>
                      setTeamInvites([
                        { email: '', role: 'sales_attendant', branchAccess: [branchCode || 'MAIN'] },
                      ])
                    }
                    className="bg-[#714b67] text-white text-xs h-8 px-3"
                  >
                    Invite First Member
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {teamInvites.map((inv, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center bg-black/40 border border-white/10 p-3 rounded-xs"
                    >
                      <div className="sm:col-span-6">
                        <Input
                          value={inv.email}
                          onChange={(e) => {
                            const updated = [...teamInvites];
                            updated[idx].email = e.target.value;
                            setTeamInvites(updated);
                          }}
                          placeholder="colleague@example.com"
                          className="bg-black border-white/15 text-white h-9 text-xs"
                        />
                      </div>
                      <div className="sm:col-span-5">
                        <CustomSelect
                          options={ROLE_OPTIONS}
                          value={inv.role}
                          onChange={(val) => {
                            const updated = [...teamInvites];
                            updated[idx].role = val;
                            setTeamInvites(updated);
                          }}
                          placeholder="Select role"
                        />
                      </div>
                      <div className="sm:col-span-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setTeamInvites(teamInvites.filter((_, i) => i !== idx))}
                          className="text-slate-500 hover:text-red-400 p-1.5"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 7: COMPLETION */}
          {step === 7 && (
            <div className="space-y-6 text-center py-6 animate-in zoom-in-95 duration-300">
              <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-2 max-w-md mx-auto">
                <h2 className="text-2xl font-bold text-white tracking-tight">🎉 You're all set!</h2>
                <p className="text-sm text-slate-300">
                  Your organization <span className="font-semibold text-white">{orgName}</span> and primary branch{' '}
                  <span className="font-semibold text-white">{branchName}</span> are ready.
                </p>
              </div>

              {/* Summary Badges */}
              <div className="bg-black/50 border border-white/10 rounded-sm p-4 max-w-lg mx-auto text-left space-y-3">
                <div className="flex items-center justify-between text-xs border-b border-white/5 pb-2">
                  <span className="text-slate-400">Subscription Plan:</span>
                  <span className="font-semibold uppercase text-emerald-400">{selectedPlan}</span>
                </div>
                <div className="flex items-center justify-between text-xs border-b border-white/5 pb-2">
                  <span className="text-slate-400">Primary Branch:</span>
                  <span className="font-medium text-white">
                    {branchName} ({branchCode}) · {city}, {stateName}
                  </span>
                </div>
                <div className="space-y-1.5 pt-1">
                  <span className="text-xs text-slate-400">Activated Applications:</span>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {selectedProducts.map((p) => {
                      const prod = AVAILABLE_PRODUCTS.find((item) => item.id === p);
                      return (
                        <div
                          key={p}
                          className="bg-white/10 text-white text-xs px-2.5 py-1 rounded flex items-center gap-1.5"
                        >
                          <Boxes className="w-3.5 h-3.5 text-[#9d6b8f]" />
                          <span>{prod?.name || p}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4 max-w-md mx-auto">
                {selectedProducts.includes('inventory') && (
                  <Button
                    type="button"
                    onClick={() => handleLaunchProduct('inventory')}
                    className="w-full sm:w-auto flex-1 bg-[#714b67] hover:bg-[#85597a] text-white text-xs font-semibold h-11 rounded-xs flex items-center justify-center gap-2"
                  >
                    <Boxes className="w-4 h-4" />
                    Complete Inventory Setup
                  </Button>
                )}
                {selectedProducts.includes('taskmanagement') && !selectedProducts.includes('inventory') && (
                  <Button
                    type="button"
                    onClick={() => handleLaunchProduct('taskmanagement')}
                    className="w-full sm:w-auto flex-1 bg-[#714b67] hover:bg-[#85597a] text-white text-xs font-semibold h-11 rounded-xs flex items-center justify-center gap-2"
                  >
                    <ListTodo className="w-4 h-4" />
                    Complete Tasks Setup
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGoToDashboard}
                  className="w-full sm:w-auto bg-black border-white/20 hover:bg-white/10 text-white text-xs font-semibold h-11 rounded-xs"
                >
                  Go to Dashboard
                </Button>
              </div>
            </div>
          )}

          {/* WIZARD BOTTOM CONTROLS (Steps 1 - 6) */}
          {step < 7 && (
            <div className="flex items-center justify-between border-t border-white/10 pt-5 mt-6">
              {step > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep(step - 1)}
                  disabled={isLoading}
                  className="text-slate-400 hover:text-white text-xs h-10 px-3"
                >
                  <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
                </Button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-3">
                {step === 6 && teamInvites.length === 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleFinalSubmission}
                    disabled={isLoading}
                    className="text-slate-400 hover:text-white text-xs h-10 px-3"
                  >
                    Skip & Create Org
                  </Button>
                )}

                <Button
                  type="button"
                  onClick={handleNext}
                  disabled={isLoading}
                  className="bg-[#714b67] hover:bg-[#85597a] text-white text-xs font-semibold h-10 px-5 rounded-xs flex items-center gap-1.5 shadow-lg shadow-[#714b67]/20"
                >
                  {isLoading ? (
                    <>
                      <Spinner size="sm" /> Creating Organization...
                    </>
                  ) : step === 6 ? (
                    <>
                      Create Organization <ArrowRight className="w-4 h-4 ml-1" />
                    </>
                  ) : (
                    <>
                      Continue <ArrowRight className="w-4 h-4 ml-1" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="w-full border-t border-white/5 bg-black py-4 text-center text-xs text-slate-600">
        Orviohub Multi-Tenant Workspace Provisioning &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
};
