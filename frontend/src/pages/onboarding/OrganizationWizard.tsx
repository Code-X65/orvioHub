import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { useOnboardingStore } from '@/stores/useOnboardingStore';
import { useLocationStore } from '@/stores/useLocationStore';
import { api } from '@/lib/api';
import { Header } from '@/components/landing/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { CustomSelect, type SelectOption } from '@/components/ui/custom-select';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import {
  MapPin,
  Phone,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Plus,
  Trash2,
  Check,
} from 'lucide-react';

// Options Constants
const ORG_TYPE_OPTIONS: SelectOption[] = [
  { value: 'retail_store', label: 'Business / Retail Store', badge: 'Retail' },
  { value: 'company_team', label: 'Company / Corporate Team', badge: 'Company' },
  { value: 'supermarket', label: 'Supermarket / Grocery Chain', badge: 'Grocery' },
  { value: 'pharmacy', label: 'Pharmacy & Health Store', badge: 'Pharmacy' },
  { value: 'gym_club', label: 'Gym / Fitness Club', badge: 'Fitness' },
  { value: 'school', label: 'School / Academic Institution', badge: 'Education' },
  { value: 'personal', label: 'Personal / Sole Proprietor', badge: 'Solo' },
  { value: 'other', label: 'Other Business Type', badge: 'Other' },
];

const CURRENCY_OPTIONS: SelectOption[] = [
  { value: 'NGN', label: 'Nigerian Naira (₦ NGN)', badge: '₦' },
  { value: 'USD', label: 'US Dollar ($ USD)', badge: '$' },
  { value: 'GBP', label: 'British Pound (£ GBP)', badge: '£' },
  { value: 'EUR', label: 'Euro (€ EUR)', badge: '€' },
];

const TIMEZONE_OPTIONS: SelectOption[] = [
  { value: 'Africa/Lagos', label: 'West Africa Time (WAT) - Lagos', badge: 'WAT' },
  { value: 'Africa/Accra', label: 'Greenwich Mean Time (GMT) - Accra', badge: 'GMT' },
  { value: 'Africa/Nairobi', label: 'East Africa Time (EAT) - Nairobi', badge: 'EAT' },
  { value: 'Africa/Johannesburg', label: 'South Africa Standard Time (SAST)', badge: 'SAST' },
  { value: 'UTC', label: 'Coordinated Universal Time (UTC)', badge: 'UTC' },
];

const ROLE_OPTIONS: SelectOption[] = [
  { value: 'ADMIN', label: 'Admin (Full management access)', badge: 'Admin' },
  { value: 'MANAGER', label: 'Branch Manager', badge: 'Manager' },
  { value: 'SALES_ATTENDANT', label: 'Sales Attendant / Cashier', badge: 'Cashier' },
  { value: 'STOCK_MANAGER', label: 'Stock & Inventory Manager', badge: 'Inventory' },
  { value: 'ACCOUNTANT', label: 'Accountant / Financial Officer', badge: 'Finance' },
];

interface ProductApp {
  key: string;
  name: string;
  category: string;
  description: string;
  planRequired: 'free' | 'standard' | 'premium';
  icon: string;
}

const PRODUCT_APPS: ProductApp[] = [
  {
    key: 'inventory',
    name: 'Inventory Management',
    category: 'Operations',
    description: 'Multi-branch warehouse stock, barcode POS checkout & stock telemetry.',
    planRequired: 'free',
    icon: '📦',
  },
  {
    key: 'taskmanagement',
    name: 'Task Management',
    category: 'Productivity',
    description: 'Agile sprints, collaborative kanban boards & team workloads.',
    planRequired: 'free',
    icon: '📋',
  },
  {
    key: 'gym',
    name: 'Gym & Club Management',
    category: 'Fitness',
    description: 'Membership plans, attendance tracking & automated renewals.',
    planRequired: 'standard',
    icon: '🏋️‍♂️',
  },
  {
    key: 'bookings',
    name: 'Appointments & Bookings',
    category: 'Services',
    description: 'Online client booking portals, scheduling & SMS reminders.',
    planRequired: 'standard',
    icon: '📅',
  },
  {
    key: 'crm',
    name: 'Customer CRM',
    category: 'Sales',
    description: 'Client pipelines, deals tracking & communications history.',
    planRequired: 'premium',
    icon: '💼',
  },
];

interface TeamInviteRow {
  email: string;
  role: string;
  branchAccess: string[];
}

export const OrganizationWizard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { states, fetchStates, fetchLgas, lgasByState } = useLocationStore();
  const { updateProgress, completeFlow, skipPermanently } = useOnboardingStore();

  const [step, setStep] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirmSkipModalOpen, setIsConfirmSkipModalOpen] = useState(false);

  const handleSaveAndExit = async () => {
    await updateProgress(`org_step_${step}`, {
      orgName,
      orgType,
      branchName,
      branchCode,
      stateName,
      lgaName,
      city,
      businessPhone,
      selectedProducts,
      selectedPlan,
      billingInterval,
    });
    toast.success('Progress saved. You can resume anytime from the launcher.');
    navigate('/app');
  };

  const handleSkipPermanently = async () => {
    await skipPermanently();
    setIsConfirmSkipModalOpen(false);
    toast.success('Onboarding skipped. You can create an organization later from settings.');
    navigate('/app');
  };

  // Step 1: Org Details
  const [orgName, setOrgName] = useState('');
  const [orgType, setOrgType] = useState('retail_store');
  const [country] = useState('Nigeria');
  const [currency, setCurrency] = useState('NGN');
  const [timezone, setTimezone] = useState('Africa/Lagos');

  // Step 2: Branch Setup
  const [branchName, setBranchName] = useState('Main Store');
  const [branchCode, setBranchCode] = useState('MAIN');
  const [stateName, setStateName] = useState('Lagos');
  const [lgaName, setLgaName] = useState('');
  const [city, setCity] = useState('Ikeja');
  const [area, setArea] = useState('');
  const [street, setStreet] = useState('');
  const [blockNumber, setBlockNumber] = useState('');
  const [landmark, setLandmark] = useState('');

  // Step 3: Contact Details
  const [useMyPhone, setUseMyPhone] = useState(Boolean(user?.phone));
  const [businessPhone, setBusinessPhone] = useState(user?.phone || '');
  const [isPhoneOtpModalOpen, setIsPhoneOtpModalOpen] = useState(false);
  const [phoneOtp, setPhoneOtp] = useState('');
  const [isSendingPhoneOtp, setIsSendingPhoneOtp] = useState(false);
  const [isVerifyingPhoneOtp, setIsVerifyingPhoneOtp] = useState(false);
  const [businessPhoneVerified, setBusinessPhoneVerified] = useState(Boolean(user?.phoneVerifiedAt));
  const [addressType, setAddressType] = useState<'same-as-branch' | 'custom'>('same-as-branch');

  // Step 4: Product Selection
  const [selectedProducts, setSelectedProducts] = useState<string[]>(['inventory']);
  const [activateAllApps, setActivateAllApps] = useState(false);

  // Step 5: Plan Selection
  const [selectedPlan, setSelectedPlan] = useState<'free' | 'standard' | 'premium'>('free');
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('monthly');

  // Step 6: Team Invitation
  const [teamInvites, setTeamInvites] = useState<TeamInviteRow[]>([
    { email: '', role: 'SALES_ATTENDANT', branchAccess: ['MAIN'] },
  ]);

  useEffect(() => {
    fetchStates();
  }, [fetchStates]);

  useEffect(() => {
    if (orgName && !branchCode) {
      const code = orgName
        .replace(/[^A-Za-z0-9]/g, '')
        .slice(0, 4)
        .toUpperCase();
      if (code) setBranchCode(code);
    }
  }, [orgName, branchCode]);

  const selectedStateObj = states.find(
    (st) =>
      st.name.toLowerCase() === stateName.toLowerCase() ||
      st.code?.toLowerCase() === stateName.toLowerCase()
  );
  const resolvedStateCode = selectedStateObj?.code || selectedStateObj?.stateCode || stateName;

  useEffect(() => {
    if (resolvedStateCode) {
      fetchLgas(resolvedStateCode);
    }
  }, [resolvedStateCode, fetchLgas]);

  const availableLgaList = (lgasByState[resolvedStateCode.toUpperCase()] || []).map((l) => ({
    value: l.name,
    label: l.name,
  }));

  const handleToggleProduct = (key: string) => {
    if (selectedProducts.includes(key)) {
      if (selectedProducts.length === 1) {
        toast.error('Please select at least one application.');
        return;
      }
      setSelectedProducts(selectedProducts.filter((p) => p !== key));
    } else {
      setSelectedProducts([...selectedProducts, key]);
    }
  };

  const handleToggleActivateAll = (checked: boolean) => {
    setActivateAllApps(checked);
    if (checked) {
      setSelectedProducts(PRODUCT_APPS.map((p) => p.key));
      setSelectedPlan('premium');
    } else {
      setSelectedProducts(['inventory']);
      setSelectedPlan('free');
    }
  };

  const handleAddInviteRow = () => {
    if (teamInvites.length >= 5) {
      toast.info('You can invite up to 5 members during onboarding. Additional invites can be sent later.');
      return;
    }
    setTeamInvites([...teamInvites, { email: '', role: 'SALES_ATTENDANT', branchAccess: ['MAIN'] }]);
  };

  const handleRemoveInviteRow = (index: number) => {
    setTeamInvites(teamInvites.filter((_, i) => i !== index));
  };

  const handleUpdateInvite = (index: number, field: keyof TeamInviteRow, value: any) => {
    const updated = [...teamInvites];
    updated[index] = { ...updated[index], [field]: value };
    setTeamInvites(updated);
  };

  const handleSendBusinessPhoneOtp = async () => {
    if (!businessPhone.trim()) {
      toast.error('Please enter a business phone number.');
      return;
    }
    setIsSendingPhoneOtp(true);
    try {
      await api.post('/users/me/phone/verify', {
        action: 'request_otp',
        phone: businessPhone.trim(),
      });
      setIsPhoneOtpModalOpen(true);
      toast.success('Verification code sent via SMS.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send SMS.');
    } finally {
      setIsSendingPhoneOtp(false);
    }
  };

  const handleVerifyBusinessPhoneOtp = async () => {
    if (!phoneOtp.trim()) return;
    setIsVerifyingPhoneOtp(true);
    try {
      await api.post('/users/me/phone/verify', {
        action: 'verify_code',
        phone: businessPhone.trim(),
        code: phoneOtp.trim(),
      });
      setBusinessPhoneVerified(true);
      setIsPhoneOtpModalOpen(false);
      toast.success('Business phone verified.');
    } catch (err: any) {
      toast.error(err.message || 'Invalid verification code.');
    } finally {
      setIsVerifyingPhoneOtp(false);
    }
  };

  // Submit Step 1
  const handleNextStep1 = () => {
    if (!orgName.trim()) {
      toast.error('Organization name is required.');
      return;
    }
    updateProgress('org_step_1', { orgName, orgType, country, currency, timezone });
    setStep(2);
  };

  // Submit Step 2
  const handleNextStep2 = () => {
    if (!branchName.trim()) {
      toast.error('Branch name is required.');
      return;
    }
    if (!stateName || !city.trim() || !street.trim() || !blockNumber.trim()) {
      toast.error('Please complete the required address fields (State, City, Street, Block Number).');
      return;
    }
    updateProgress('org_step_2', {
      branchName,
      branchCode,
      address: { country, state: stateName, lga: lgaName, city, area, street, blockNumber, landmark },
    });
    setStep(3);
  };

  // Submit Step 3
  const handleNextStep3 = () => {
    updateProgress('org_step_3', {
      useMyPhone,
      businessPhone,
      addressType,
    });
    setStep(4);
  };

  // Submit Step 4
  const handleNextStep4 = () => {
    if (selectedProducts.length === 0) {
      toast.error('Please select at least one application.');
      return;
    }
    updateProgress('org_step_4', { selectedProducts, activateAllApps });
    setStep(5);
  };

  // Submit Step 5
  const handleNextStep5 = () => {
    updateProgress('org_step_5', { selectedPlan, billingInterval });
    setStep(6);
  };

  // Submit Step 6 (Creates the Organization in Backend)
  const handleFinishOrgCreation = async () => {
    setIsLoading(true);
    try {
      // 1. Create Organization in backend
      const orgRes = await api.post<{ organization: any; membership: any; workspace: any }>('/organizations', {
        name: orgName.trim(),
        industry: orgType,
        country: 'Nigeria',
        timezone,
        currency,
      });

      const organizationId = orgRes.organization?.id || orgRes.organization?._id;

      // 2. Select Modules
      await api.post('/onboarding/modules', {
        organizationId,
        modules: selectedProducts,
      });

      // 3. Send Team Invites if any provided
      const validInvites = teamInvites.filter((inv) => inv.email && inv.email.includes('@'));
      for (const invite of validInvites) {
        try {
          await api.post('/onboarding/invite', {
            organizationId,
            email: invite.email.trim(),
            role: invite.role,
          });
        } catch {
          // ignore individual invite errors
        }
      }

      await completeFlow({
        organizationId,
        orgName,
        selectedProducts,
        selectedPlan,
      });

      toast.success('Organization created successfully! 🎉');
      setStep(7);
    } catch (err: any) {
      toast.error(err.message || 'Failed to finalize organization setup.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-slate-100 flex flex-col selection:bg-[#714b67]/30 selection:text-[#e2b9d8]">
      <Header />

      <main className="flex-1 max-w-[500px] w-full mx-auto px-4 py-8 sm:py-10 space-y-6">
        {/* Step Progress Tracker */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
            <div className="flex items-center gap-2">
              <span className="text-[#e2b9d8]">Step {step} of 7:</span>
              <span className="text-white">
                {step === 1 && 'Organization Details'}
                {step === 2 && 'Branch Setup'}
                {step === 3 && 'Contact Details'}
                {step === 4 && 'Product Selection'}
                {step === 5 && 'Plan Selection'}
                {step === 6 && 'Team Invitation'}
                {step === 7 && 'Ready to Launch'}
              </span>
            </div>
            {step < 7 && (
              <button
                type="button"
                onClick={handleSaveAndExit}
                className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Save & Exit
              </button>
            )}
          </div>
          <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-[#714b67] to-[#8d5b80] h-full transition-all duration-300 rounded-full"
              style={{ width: `${(step / 7) * 100}%` }}
            />
          </div>
        </div>

        {/* STEP 1: ORGANIZATION DETAILS */}
        {step === 1 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="space-y-1.5 text-center">
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Let's set up your organization</h1>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">This information helps us configure your account correctly.</p>
            </div>

            <div className="space-y-3.5">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-slate-300">
                  What's your organization name? <span className="text-rose-400">*</span>
                </Label>
                <Input
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="e.g. Code X Stores Ltd"
                  className="h-10 bg-[#0e0a0d] border-white/10 text-white placeholder:text-slate-600 rounded-xs text-xs focus:ring-1 focus:ring-[#714b67]"
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium text-slate-300">What type of organization is this?</Label>
                <CustomSelect
                  value={orgType}
                  onChange={setOrgType}
                  options={ORG_TYPE_OPTIONS}
                  searchable
                  placeholder="Select organization type"
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-300">Country</Label>
                  <Input
                    value="Nigeria"
                    disabled
                    className="h-10 bg-[#0e0a0d]/50 border-white/10 text-slate-400 rounded-xs text-xs cursor-not-allowed"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-300">Currency</Label>
                  <CustomSelect
                    value={currency}
                    onChange={setCurrency}
                    options={CURRENCY_OPTIONS}
                    placeholder="Select currency"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-300">Timezone</Label>
                  <CustomSelect
                    value={timezone}
                    onChange={setTimezone}
                    options={TIMEZONE_OPTIONS}
                    placeholder="Select timezone"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                onClick={handleNextStep1}
                className="w-full h-10 bg-gradient-to-r from-[#714b67] to-[#8d5b80] hover:from-[#8d5b80] hover:to-[#a06892] text-white rounded-xl text-xs font-semibold shadow-lg shadow-[#714b67]/25 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: BRANCH SETUP */}
        {step === 2 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="space-y-1.5 text-center">
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Where will you operate from?</h1>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">This is your primary business location. You can add more branches later.</p>
            </div>

            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-300">
                    Branch name <span className="text-rose-400">*</span>
                  </Label>
                  <Input
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    placeholder="e.g. Main Store"
                    className="h-10 bg-[#0e0a0d] border-white/10 text-white placeholder:text-slate-600 rounded-xs text-xs focus:ring-1 focus:ring-[#714b67]"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-300">
                    Branch code <span className="text-rose-400">*</span>
                  </Label>
                  <Input
                    value={branchCode}
                    onChange={(e) => setBranchCode(e.target.value.toUpperCase().slice(0, 4))}
                    placeholder="MAIN"
                    maxLength={4}
                    className="h-10 bg-[#0e0a0d] border-white/10 text-white placeholder:text-slate-600 rounded-xs text-xs font-mono uppercase focus:ring-1 focus:ring-[#714b67]"
                  />
                </div>
              </div>

              {/* Structured Address */}
              <div className="pt-2 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
                  <MapPin className="w-3.5 h-3.5 text-[#e2b9d8]" />
                  <span>Location & Address (Nigeria)</span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-300">State <span className="text-rose-400">*</span></Label>
                    <CustomSelect
                      value={stateName}
                      onChange={(s) => {
                        setStateName(s);
                        setLgaName('');
                      }}
                      options={states.map((st) => ({ value: st.name, label: st.name }))}
                      searchable
                      placeholder="Select State"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-slate-300">LGA (Local Govt)</Label>
                    <CustomSelect
                      value={lgaName}
                      onChange={setLgaName}
                      options={availableLgaList}
                      searchable
                      placeholder="Select LGA"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-300">City / Town <span className="text-rose-400">*</span></Label>
                    <Input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Ikeja, Lekki, Wuse"
                      className="h-10 bg-[#0e0a0d] border-white/10 text-white placeholder:text-slate-600 rounded-xs text-xs focus:ring-1 focus:ring-[#714b67]"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-slate-300">Area / District (optional)</Label>
                    <Input
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                      placeholder="e.g. Allen Avenue, Phase 1"
                      className="h-10 bg-[#0e0a0d] border-white/10 text-white placeholder:text-slate-600 rounded-xs text-xs focus:ring-1 focus:ring-[#714b67]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div className="col-span-1 space-y-1">
                    <Label className="text-xs text-slate-300">Plot / Block No. <span className="text-rose-400">*</span></Label>
                    <Input
                      value={blockNumber}
                      onChange={(e) => setBlockNumber(e.target.value)}
                      placeholder="e.g. 15"
                      className="h-10 bg-[#0e0a0d] border-white/10 text-white placeholder:text-slate-600 rounded-xs text-xs focus:ring-1 focus:ring-[#714b67]"
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs text-slate-300">Street Name <span className="text-rose-400">*</span></Label>
                    <Input
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      placeholder="e.g. Obafemi Awolowo Way"
                      className="h-10 bg-[#0e0a0d] border-white/10 text-white placeholder:text-slate-600 rounded-xs text-xs focus:ring-1 focus:ring-[#714b67]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-slate-300">Landmark (optional)</Label>
                  <Input
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                    placeholder="e.g. Opposite City Mall"
                    className="h-10 bg-[#0e0a0d] border-white/10 text-white placeholder:text-slate-600 rounded-xs text-xs focus:ring-1 focus:ring-[#714b67]"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between gap-3">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="h-10 px-4 bg-white/5 border-white/10 text-xs text-slate-300"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
              </Button>
              <Button
                onClick={handleNextStep2}
                className="flex-1 h-10 bg-gradient-to-r from-[#714b67] to-[#8d5b80] hover:from-[#8d5b80] text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: CONTACT DETAILS */}
        {step === 3 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="space-y-1.5 text-center">
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Business Contact Details</h1>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">Customers will see this contact information on receipts and invoices.</p>
            </div>

            <div className="space-y-3.5">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-slate-300">Business Phone Number</Label>
                {user?.phone && (
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-200">
                    <Checkbox
                      checked={useMyPhone}
                      onCheckedChange={(c) => {
                        setUseMyPhone(!!c);
                        if (c && user?.phone) setBusinessPhone(user.phone);
                      }}
                    />
                    <span>Use my verified personal phone: <strong className="text-white">{user.phone}</strong></span>
                  </label>
                )}

                {!useMyPhone && (
                  <div className="flex gap-2 pt-1">
                    <div className="relative flex-1">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                      <Input
                        value={businessPhone}
                        onChange={(e) => {
                          setBusinessPhone(e.target.value);
                          setBusinessPhoneVerified(false);
                        }}
                        placeholder="+234 801 234 5678"
                        className="pl-9 h-10 bg-[#0e0a0d] border-white/10 text-white placeholder:text-slate-600 rounded-xs text-xs focus:ring-1 focus:ring-[#714b67]"
                      />
                    </div>
                    {businessPhone && !businessPhoneVerified && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleSendBusinessPhoneOtp}
                        disabled={isSendingPhoneOtp}
                        className="h-10 px-3 bg-white/5 border-white/10 text-xs text-slate-200 shrink-0 rounded-xs"
                      >
                        {isSendingPhoneOtp ? <Spinner size="sm" /> : 'Verify'}
                      </Button>
                    )}
                  </div>
                )}

                {businessPhoneVerified && (
                  <p className="text-[11px] text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Phone verified for receipts
                  </p>
                )}
              </div>

              {/* Address Mode */}
              <div className="space-y-2 pt-2">
                <Label className="text-xs font-medium text-slate-300">Business Invoicing Address</Label>
                <div className="space-y-2 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-200">
                    <input
                      type="radio"
                      name="addressType"
                      checked={addressType === 'same-as-branch'}
                      onChange={() => setAddressType('same-as-branch')}
                      className="text-[#714b67]"
                    />
                    <span>Same as branch location ({street || 'Main Store Address'})</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-200">
                    <input
                      type="radio"
                      name="addressType"
                      checked={addressType === 'custom'}
                      onChange={() => setAddressType('custom')}
                      className="text-[#714b67]"
                    />
                    <span>Enter separate headquarters / legal billing address</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between gap-3">
              <Button
                variant="outline"
                onClick={() => setStep(2)}
                className="h-10 px-4 bg-white/5 border-white/10 text-xs text-slate-300"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
              </Button>
              <Button
                onClick={handleNextStep3}
                className="flex-1 h-10 bg-gradient-to-r from-[#714b67] to-[#8d5b80] text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4: PRODUCT SELECTION */}
        {step === 4 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="space-y-1.5 text-center">
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Which applications do you need?</h1>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">Select the apps you want to use. You can activate more later.</p>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-[#714b67]/15 border border-[#714b67]/30">
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-white">Activate all available apps</span>
                <p className="text-[11px] text-slate-300">Unlock the full Orviohub business suite</p>
              </div>
              <Checkbox
                checked={activateAllApps}
                onCheckedChange={(c) => handleToggleActivateAll(!!c)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {PRODUCT_APPS.map((app) => {
                const isSelected = selectedProducts.includes(app.key);
                return (
                  <div
                    key={app.key}
                    onClick={() => handleToggleProduct(app.key)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-[#714b67]/20 border-[#714b67] shadow-md shadow-[#714b67]/10'
                        : 'bg-[#0e0a0d] border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xl">{app.icon}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                          app.planRequired === 'free'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : app.planRequired === 'standard'
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        }`}>
                          {app.planRequired === 'free' ? 'Free' : `${app.planRequired}+`}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-white">{app.name}</h3>
                        <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed line-clamp-2">{app.description}</p>
                      </div>
                    </div>
                    <div className="pt-2 flex items-center justify-between text-xs">
                      <span className="text-[10px] text-slate-500">{app.category}</span>
                      <div className={`w-4 h-4 rounded-md flex items-center justify-center border ${
                        isSelected ? 'bg-[#714b67] border-[#714b67] text-white' : 'border-white/20'
                      }`}>
                        {isSelected && <Check className="w-3 h-3" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 flex items-center justify-between gap-3">
              <Button
                variant="outline"
                onClick={() => setStep(3)}
                className="h-10 px-4 bg-white/5 border-white/10 text-xs text-slate-300"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
              </Button>
              <Button
                onClick={handleNextStep4}
                className="flex-1 h-10 bg-gradient-to-r from-[#714b67] to-[#8d5b80] text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 5: PLAN SELECTION */}
        {step === 5 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="space-y-1.5 text-center">
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Choose your plan</h1>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">You can upgrade or downgrade anytime.</p>
            </div>

            {/* Billing Toggle */}
            <div className="flex justify-center">
              <div className="p-1 rounded-xl bg-[#0e0a0d] border border-white/10 inline-flex items-center gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => setBillingInterval('monthly')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                    billingInterval === 'monthly' ? 'bg-[#714b67] text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setBillingInterval('annual')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                    billingInterval === 'annual' ? 'bg-[#714b67] text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>Annual</span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">Save 17%</span>
                </button>
              </div>
            </div>

            {/* 3 Plans Grid */}
            <div className="grid grid-cols-1 gap-3">
              {/* Free Plan */}
              <div
                onClick={() => setSelectedPlan('free')}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  selectedPlan === 'free'
                    ? 'bg-[#714b67]/20 border-[#714b67] shadow-lg'
                    : 'bg-[#0e0a0d] border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white">Free Plan</h3>
                    <div className="mt-0.5">
                      <span className="text-xl font-extrabold text-white">₦0</span>
                      <span className="text-xs text-slate-400"> /month</span>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                    selectedPlan === 'free' ? 'bg-[#714b67] text-white' : 'bg-white/5 text-slate-300'
                  }`}>
                    {selectedPlan === 'free' ? 'Selected' : 'Select'}
                  </div>
                </div>
                <ul className="grid grid-cols-2 gap-1.5 pt-3 text-xs text-slate-300">
                  <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-emerald-400" /> 1 Org • 1 App</li>
                  <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-emerald-400" /> 2 Team Members</li>
                  <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-emerald-400" /> 500 Products</li>
                  <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-emerald-400" /> Community Support</li>
                </ul>
              </div>

              {/* Standard Plan */}
              <div
                onClick={() => setSelectedPlan('standard')}
                className={`relative p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  selectedPlan === 'standard'
                    ? 'bg-[#714b67]/25 border-[#714b67] shadow-xl'
                    : 'bg-[#0e0a0d] border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white">Standard Plan</h3>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#714b67] text-white uppercase tracking-wider">
                        Most Popular
                      </span>
                    </div>
                    <div className="mt-0.5">
                      <span className="text-xl font-extrabold text-white">
                        {billingInterval === 'annual' ? '₦75,000' : '₦7,500'}
                      </span>
                      <span className="text-xs text-slate-400">{billingInterval === 'annual' ? ' /year' : ' /month'}</span>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                    selectedPlan === 'standard' ? 'bg-[#714b67] text-white' : 'bg-white/5 text-slate-300'
                  }`}>
                    {selectedPlan === 'standard' ? 'Selected' : 'Select'}
                  </div>
                </div>
                <ul className="grid grid-cols-2 gap-1.5 pt-3 text-xs text-slate-300">
                  <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-emerald-400" /> 3 Orgs • 3 Apps</li>
                  <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-emerald-400" /> 10 Team Members</li>
                  <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-emerald-400" /> 5,000 Products</li>
                  <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-emerald-400" /> 3 Branches</li>
                </ul>
              </div>

              {/* Premium Plan */}
              <div
                onClick={() => setSelectedPlan('premium')}
                className={`relative p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  selectedPlan === 'premium'
                    ? 'bg-[#714b67]/25 border-[#714b67] shadow-xl'
                    : 'bg-[#0e0a0d] border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white">Premium Plan</h3>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500 text-black uppercase tracking-wider">
                        Best Value
                      </span>
                    </div>
                    <div className="mt-0.5">
                      <span className="text-xl font-extrabold text-white">
                        {billingInterval === 'annual' ? '₦200,000' : '₦20,000'}
                      </span>
                      <span className="text-xs text-slate-400">{billingInterval === 'annual' ? ' /year' : ' /month'}</span>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                    selectedPlan === 'premium' ? 'bg-[#714b67] text-white' : 'bg-white/5 text-slate-300'
                  }`}>
                    {selectedPlan === 'premium' ? 'Selected' : 'Select'}
                  </div>
                </div>
                <ul className="grid grid-cols-2 gap-1.5 pt-3 text-xs text-slate-300">
                  <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-emerald-400" /> 10 Orgs • Unlimited Apps</li>
                  <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-emerald-400" /> 50 Team Members</li>
                  <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-emerald-400" /> 25,000 Products</li>
                  <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-emerald-400" /> Priority WhatsApp Support</li>
                </ul>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between gap-3">
              <Button
                variant="outline"
                onClick={() => setStep(4)}
                className="h-10 px-4 bg-white/5 border-white/10 text-xs text-slate-300"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
              </Button>
              <Button
                onClick={handleNextStep5}
                className="flex-1 h-10 bg-gradient-to-r from-[#714b67] to-[#8d5b80] text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 6: TEAM INVITATION */}
        {step === 6 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="space-y-1.5 text-center">
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Invite team members</h1>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">Invite your team to collaborate. You can do this later if you prefer.</p>
            </div>

            <div className="space-y-3">
              {teamInvites.map((row, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="flex-1">
                    <Input
                      value={row.email}
                      onChange={(e) => handleUpdateInvite(idx, 'email', e.target.value)}
                      placeholder="colleague@example.com"
                      className="h-10 bg-[#0e0a0d] border-white/10 text-white placeholder:text-slate-600 rounded-xs text-xs focus:ring-1 focus:ring-[#714b67]"
                    />
                  </div>
                  <div className="w-36 sm:w-44">
                    <CustomSelect
                      value={row.role}
                      onChange={(r) => handleUpdateInvite(idx, 'role', r)}
                      options={ROLE_OPTIONS}
                    />
                  </div>
                  {teamInvites.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveInviteRow(idx)}
                      className="p-2 text-slate-400 hover:text-rose-400 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}

              {teamInvites.length < 5 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddInviteRow}
                  className="h-9 px-3 bg-white/5 border-white/10 text-xs text-slate-300 flex items-center gap-1.5 rounded-xl cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add team member</span>
                </Button>
              )}
            </div>

            <div className="pt-2 flex items-center justify-between gap-3">
              <Button
                variant="outline"
                onClick={() => setStep(5)}
                className="h-10 px-4 bg-white/5 border-white/10 text-xs text-slate-300"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  onClick={handleFinishOrgCreation}
                  disabled={isLoading}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Skip
                </Button>

                <Button
                  onClick={handleFinishOrgCreation}
                  disabled={isLoading}
                  className="h-10 px-6 bg-gradient-to-r from-[#714b67] to-[#8d5b80] hover:from-[#8d5b80] text-white rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer"
                >
                  {isLoading ? <Spinner size="sm" className="text-white" /> : <span>Finalize Setup</span>}
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 7: COMPLETION */}
        {step === 7 && (
          <div className="space-y-6 text-center py-6 animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto text-3xl shadow-xl">
              🎉
            </div>

            <div className="space-y-1.5">
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">You're all set!</h1>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                Your organization <strong className="text-white">{orgName}</strong> is ready to go.
              </p>
            </div>

            <div className="space-y-2 text-left text-xs max-w-sm mx-auto">
              <div className="flex items-center justify-between text-slate-400">
                <span>Activated Apps:</span>
                <span className="font-semibold text-white capitalize">{selectedProducts.join(', ')}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Selected Plan:</span>
                <span className="font-semibold text-[#e2b9d8] capitalize">{selectedPlan} Plan</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Main Branch:</span>
                <span className="font-semibold text-white">{branchName} ({city}, {stateName})</span>
              </div>
            </div>

            <div className="pt-4 flex flex-col gap-2.5 max-w-sm mx-auto">
              <Button
                onClick={() => navigate('/app')}
                className="w-full h-10 bg-gradient-to-r from-[#714b67] to-[#8d5b80] hover:from-[#8d5b80] text-white rounded-xl text-xs font-semibold shadow-lg shadow-[#714b67]/25 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Go to Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>

              {selectedProducts.includes('inventory') && (
                <Button
                  variant="outline"
                  onClick={() => navigate('/onboarding/inventory')}
                  className="w-full h-10 bg-white/5 hover:bg-white/10 border-white/10 text-slate-200 rounded-xl text-xs font-medium cursor-pointer"
                >
                  <span>Complete Inventory Setup</span>
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Skip Wizard Permanently */}
        {step < 7 && (
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setIsConfirmSkipModalOpen(true)}
              className="text-xs text-slate-500 hover:text-slate-400 underline underline-offset-4 transition-colors cursor-pointer"
            >
              Skip organization setup permanently
            </button>
          </div>
        )}
      </main>

      {/* Confirm Permanent Skip Modal */}
      {isConfirmSkipModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#0c080b] border border-white/10 p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="text-center space-y-2">
              <h3 className="text-sm font-bold text-white">Skip Organization Setup?</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                You will be taken to the App Launcher. You can start creating an organization or join existing ones whenever you are ready.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsConfirmSkipModalOpen(false)}
                className="flex-1 h-9 bg-white/5 border-white/10 text-xs text-slate-300"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={isLoading}
                onClick={handleSkipPermanently}
                className="flex-1 h-9 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold"
              >
                {isLoading ? 'Skipping...' : 'Yes, Skip'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Phone OTP Verification Modal */}
      {isPhoneOtpModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#0c080b] border border-white/10 p-5 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="text-center space-y-1">
              <div className="w-10 h-10 rounded-full bg-[#714b67]/20 border border-[#714b67]/40 flex items-center justify-center mx-auto text-[#e2b9d8]">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-white">Verify Phone Number</h3>
              <p className="text-[11px] text-slate-400">
                Enter the 6-digit OTP sent to <strong className="text-slate-200">{businessPhone}</strong>
              </p>
            </div>

            <div className="space-y-2">
              <Input
                value={phoneOtp}
                onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                className="h-11 text-center text-lg tracking-widest font-mono bg-[#160f14] border-white/10 text-white rounded-xl"
                autoFocus
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsPhoneOtpModalOpen(false)}
                className="flex-1 h-9 bg-white/5 border-white/10 text-xs text-slate-300"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleVerifyBusinessPhoneOtp}
                disabled={isVerifyingPhoneOtp || phoneOtp.length < 4}
                className="flex-1 h-9 bg-[#714b67] hover:bg-[#8d5b80] text-xs text-white"
              >
                {isVerifyingPhoneOtp ? <Spinner size="sm" /> : 'Confirm OTP'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
