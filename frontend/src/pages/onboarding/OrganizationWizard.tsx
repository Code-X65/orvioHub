import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
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
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import {
  MapPin,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Plus,
  Trash2,
} from 'lucide-react';

const DRAFT_KEY = 'orvio_org_creation_draft';

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

const ROLE_OPTIONS: SelectOption[] = [
  { value: 'ADMIN', label: 'Admin (Full management access)', badge: 'Admin' },
  { value: 'MANAGER', label: 'Branch Manager', badge: 'Manager' },
  { value: 'SALES_ATTENDANT', label: 'Sales Attendant / Cashier', badge: 'Cashier' },
  { value: 'STOCK_MANAGER', label: 'Stock & Inventory Manager', badge: 'Inventory' },
  { value: 'ACCOUNTANT', label: 'Accountant / Financial Officer', badge: 'Finance' },
];

interface TeamInviteRow {
  email: string;
  role: string;
  branchAccess: string[];
}

export const OrganizationWizard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isOnboardingMode = location.pathname.startsWith('/onboarding');
  const [searchParams] = useSearchParams();
  const productParam = searchParams.get('product') || 'inventory';
  const host = useHost();
  const { user, refreshSession } = useAuthStore();
  const { states, fetchStates, fetchLgas, lgasByState } = useLocationStore();
  const { updateProgress, completeFlow, skipPermanently } = useOnboardingStore();

  const [step, setStep] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirmSkipModalOpen, setIsConfirmSkipModalOpen] = useState(false);

  // Step 1: Org Details (Locked to Nigeria defaults)
  const [orgName, setOrgName] = useState('');
  const [orgType, setOrgType] = useState('retail_store');
  const country = 'Nigeria';
  const currency = 'NGN';
  const timezone = 'Africa/Lagos';

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

  // Step 4: Team Invitation (Optional)
  const [teamInvites, setTeamInvites] = useState<TeamInviteRow[]>([
    { email: '', role: 'SALES_ATTENDANT', branchAccess: ['MAIN'] },
  ]);

  // Load Saved Draft on Mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft.orgName) setOrgName(draft.orgName);
        if (draft.orgType) setOrgType(draft.orgType);
        if (draft.branchName) setBranchName(draft.branchName);
        if (draft.branchCode) setBranchCode(draft.branchCode);
        if (draft.stateName) setStateName(draft.stateName);
        if (draft.lgaName) setLgaName(draft.lgaName);
        if (draft.city) setCity(draft.city);
        if (draft.area) setArea(draft.area);
        if (draft.street) setStreet(draft.street);
        if (draft.blockNumber) setBlockNumber(draft.blockNumber);
        if (draft.landmark) setLandmark(draft.landmark);
        if (draft.businessPhone) setBusinessPhone(draft.businessPhone);
        if (draft.teamInvites && Array.isArray(draft.teamInvites)) setTeamInvites(draft.teamInvites);
        if (draft.step && draft.step >= 1 && draft.step <= 4) {
          setStep(draft.step);
        }
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  const handleSaveAndExit = async () => {
    const draftData = {
      step,
      orgName,
      orgType,
      currency,
      timezone,
      branchName,
      branchCode,
      stateName,
      lgaName,
      city,
      area,
      street,
      blockNumber,
      landmark,
      businessPhone,
      teamInvites,
      product: productParam,
      updatedAt: Date.now(),
    };
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draftData));
      await updateProgress(`org_step_${step}`, draftData);
    } catch {
      // Local fallback
    }
    toast.success('Progress saved! You can resume anytime from the App Launcher.');
    navigate('/app');
  };

  const handleSkipPermanently = async () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
      await skipPermanently();
    } catch {
      // Fallback
    }
    setIsConfirmSkipModalOpen(false);
    toast.success('Setup skipped. You can create an organization later from settings.');
    navigate('/app');
  };

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

  // Step Handlers
  const handleNextStep1 = () => {
    if (!orgName.trim()) {
      toast.error('Please enter an organization or business name.');
      return;
    }
    updateProgress('org_step_1', { orgName, orgType, country, currency, timezone });
    setStep(2);
  };

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

  const handleNextStep3 = () => {
    updateProgress('org_step_3', {
      useMyPhone,
      businessPhone,
    });
    setStep(4);
  };

  const handleAddInviteRow = () => {
    if (teamInvites.length >= 10) return;
    setTeamInvites([...teamInvites, { email: '', role: 'SALES_ATTENDANT', branchAccess: [branchCode || 'MAIN'] }]);
  };

  const handleRemoveInviteRow = (idx: number) => {
    setTeamInvites(teamInvites.filter((_, i) => i !== idx));
  };

  const handleUpdateInvite = (idx: number, field: keyof TeamInviteRow, val: any) => {
    const updated = [...teamInvites];
    updated[idx] = { ...updated[idx], [field]: val };
    setTeamInvites(updated);
  };

  // OTP Verification Handlers
  const handleSendBusinessPhoneOtp = async () => {
    if (!businessPhone.trim()) {
      toast.error('Please enter a valid phone number.');
      return;
    }
    setIsSendingPhoneOtp(true);
    try {
      await api.post('/users/me/phone/verify', { action: 'request_otp', phone: businessPhone });
      toast.success(`Verification code sent to ${businessPhone}!`);
      setIsPhoneOtpModalOpen(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to send verification SMS.');
    } finally {
      setIsSendingPhoneOtp(false);
    }
  };

  const handleVerifyBusinessPhoneOtp = async () => {
    if (!phoneOtp || phoneOtp.length < 4) {
      toast.error('Please enter the verification code.');
      return;
    }
    setIsVerifyingPhoneOtp(true);
    try {
      await api.post('/users/me/phone/verify', { action: 'verify_code', code: phoneOtp });
      setBusinessPhoneVerified(true);
      setIsPhoneOtpModalOpen(false);
      setPhoneOtp('');
      toast.success('Phone number verified successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Invalid or expired OTP code.');
    } finally {
      setIsVerifyingPhoneOtp(false);
    }
  };

  // Submit & Create Organization in Backend
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

      // 2. Select Product (pre-selected from URL or defaults to inventory)
      try {
        await api.post('/onboarding/modules', {
          organizationId,
          modules: [productParam],
        });
      } catch {}

      // 3. Initialize Workspace
      try {
        await api.post('/onboarding/initialize', {
          organizationId,
        });
      } catch {}

      // 4. Send Team Invites if any provided
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
        selectedProducts: [productParam],
        selectedPlan: 'free',
      });

      // Clear cached draft
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {}

      await refreshSession();
      toast.success('Organization created successfully! 🎉');
      setStep(5);
    } catch (err: any) {
      toast.error(err.message || 'Failed to finalize organization setup.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLaunchProduct = () => {
    try {
      const targetUrl = getApplicationUrl(productParam as ApplicationKey, host.environment);
      window.location.href = targetUrl;
    } catch {
      navigate('/app');
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
              <span className="text-[#e2b9d8]">Step {step} of 5:</span>
              <span className="text-white">
                {step === 1 && 'Organization Details'}
                {step === 2 && 'Branch Setup'}
                {step === 3 && 'Contact Details'}
                {step === 4 && 'Team Invitation'}
                {step === 5 && 'Ready to Launch'}
              </span>
            </div>
            {step < 5 && (
              <button
                type="button"
                onClick={handleSaveAndExit}
                className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                {isOnboardingMode ? 'Save & Exit' : 'Cancel & Save Draft'}
              </button>
            )}
          </div>
          <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-[#714b67] to-[#8d5b80] h-full transition-all duration-300 rounded-full"
              style={{ width: `${(step / 5) * 100}%` }}
            />
          </div>
        </div>

        {/* STEP 1: ORGANIZATION DETAILS */}
        {step === 1 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="space-y-1.5 text-center">
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                {isOnboardingMode ? "Let's set up your organization" : "Create a new organization"}
              </h1>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                {isOnboardingMode
                  ? "This information helps us configure your account correctly."
                  : "Set up your business profile, primary branch location, and team."}
              </p>
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

              {/* Locked Nigerian Defaults Indicator */}
              <div className="p-3.5 rounded-xs bg-[#0e0a0d] border border-white/10 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">🇳🇬</span>
                  <div>
                    <p className="text-slate-200 font-medium">Region & Currency</p>
                    <p className="text-[11px] text-slate-400">Nigeria (West Africa) • Nigerian Naira (₦ NGN) • WAT (GMT+1)</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Nigeria
                </span>
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
                      placeholder="e.g. Ikeja"
                      className="h-10 bg-[#0e0a0d] border-white/10 text-white placeholder:text-slate-600 rounded-xs text-xs focus:ring-1 focus:ring-[#714b67]"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-slate-300">Area / District</Label>
                    <Input
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                      placeholder="e.g. Allen Avenue"
                      className="h-10 bg-[#0e0a0d] border-white/10 text-white placeholder:text-slate-600 rounded-xs text-xs focus:ring-1 focus:ring-[#714b67]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs text-slate-300">Street Name <span className="text-rose-400">*</span></Label>
                    <Input
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      placeholder="e.g. Obafemi Awolowo Way"
                      className="h-10 bg-[#0e0a0d] border-white/10 text-white placeholder:text-slate-600 rounded-xs text-xs focus:ring-1 focus:ring-[#714b67]"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-slate-300">Block / No. <span className="text-rose-400">*</span></Label>
                    <Input
                      value={blockNumber}
                      onChange={(e) => setBlockNumber(e.target.value)}
                      placeholder="No. 12"
                      className="h-10 bg-[#0e0a0d] border-white/10 text-white placeholder:text-slate-600 rounded-xs text-xs focus:ring-1 focus:ring-[#714b67]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-slate-300">Nearest Landmark / Description</Label>
                  <Input
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                    placeholder="e.g. Beside Zenith Bank"
                    className="h-10 bg-[#0e0a0d] border-white/10 text-white placeholder:text-slate-600 rounded-xs text-xs focus:ring-1 focus:ring-[#714b67]"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between gap-3">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="h-10 px-4 bg-white/5 border-white/10 text-xs text-slate-300 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
              </Button>
              <Button
                onClick={handleNextStep2}
                className="flex-1 h-10 bg-gradient-to-r from-[#714b67] to-[#8d5b80] hover:from-[#8d5b80] text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
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
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">How can customers contact this branch?</h1>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">This contact number will be printed on receipts and invoices.</p>
            </div>

            <div className="space-y-4">
              {user?.phone && (
                <div className="p-3 bg-white/5 rounded-xl border border-white/10 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-white">Use my registered phone number</p>
                    <p className="text-[11px] text-slate-400 font-mono">{user.phone}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={useMyPhone}
                    onChange={(e) => {
                      setUseMyPhone(e.target.checked);
                      if (e.target.checked && user?.phone) {
                        setBusinessPhone(user.phone);
                        setBusinessPhoneVerified(Boolean(user?.phoneVerifiedAt));
                      }
                    }}
                    className="w-4 h-4 rounded accent-[#714b67]"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-300">Branch Phone Number</Label>
                <div className="flex gap-2">
                  <Input
                    value={businessPhone}
                    onChange={(e) => {
                      setBusinessPhone(e.target.value);
                      setBusinessPhoneVerified(false);
                    }}
                    placeholder="08012345678"
                    className="h-10 bg-[#0e0a0d] border-white/10 text-white placeholder:text-slate-600 rounded-xs text-xs font-mono focus:ring-1 focus:ring-[#714b67]"
                  />
                  {businessPhone && !businessPhoneVerified && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSendBusinessPhoneOtp}
                      disabled={isSendingPhoneOtp}
                      className="h-10 px-3 bg-emerald-500/10 border-emerald-500/20 text-emerald-400 text-xs rounded-xl"
                    >
                      {isSendingPhoneOtp ? <Spinner size="sm" /> : 'Verify'}
                    </Button>
                  )}
                  {businessPhoneVerified && (
                    <div className="flex items-center gap-1 text-xs text-emerald-400 px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                      <ShieldCheck className="w-4 h-4" />
                      <span>Verified</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between gap-3">
              <Button
                variant="outline"
                onClick={() => setStep(2)}
                className="h-10 px-4 bg-white/5 border-white/10 text-xs text-slate-300 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
              </Button>
              <Button
                onClick={handleNextStep3}
                className="flex-1 h-10 bg-gradient-to-r from-[#714b67] to-[#8d5b80] hover:from-[#8d5b80] text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4: TEAM INVITATION (OPTIONAL) */}
        {step === 4 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="space-y-1.5 text-center">
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Invite team members</h1>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">Invite your team to collaborate. You can also do this anytime later.</p>
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
                onClick={() => setStep(3)}
                className="h-10 px-4 bg-white/5 border-white/10 text-xs text-slate-300 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  onClick={handleFinishOrgCreation}
                  disabled={isLoading}
                  className="text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Skip
                </Button>

                <Button
                  onClick={handleFinishOrgCreation}
                  disabled={isLoading}
                  className="h-10 px-6 bg-gradient-to-r from-[#714b67] to-[#8d5b80] hover:from-[#8d5b80] text-white rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-lg shadow-[#714b67]/25"
                >
                  {isLoading ? <Spinner size="sm" className="text-white" /> : <span>Create Organization</span>}
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: READY TO LAUNCH */}
        {step === 5 && (
          <div className="space-y-6 text-center py-6 animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto text-3xl shadow-xl">
              🎉
            </div>

            <div className="space-y-1.5">
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">You're all set!</h1>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                Your organization <strong className="text-white">{orgName}</strong> is ready.
              </p>
            </div>

            <div className="space-y-2 text-left text-xs max-w-sm mx-auto p-4 bg-white/5 border border-white/10 rounded-xl">
              <div className="flex items-center justify-between text-slate-400">
                <span>Application:</span>
                <span className="font-semibold text-white capitalize">{productParam} Management</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Plan:</span>
                <span className="font-semibold text-[#e2b9d8]">Free Plan (Upgrade anytime in billing)</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Main Branch:</span>
                <span className="font-semibold text-white">{branchName} ({city}, {stateName})</span>
              </div>
            </div>

            <div className="pt-4 flex flex-col gap-2.5 max-w-sm mx-auto">
              <Button
                onClick={handleLaunchProduct}
                className="w-full h-11 bg-gradient-to-r from-[#714b67] to-[#8d5b80] hover:from-[#8d5b80] text-white rounded-xl text-xs font-semibold shadow-lg shadow-[#714b67]/25 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Launch {productParam.charAt(0).toUpperCase() + productParam.slice(1)} Workspace</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>

              <Button
                variant="outline"
                onClick={() => navigate('/app')}
                className="w-full h-10 bg-white/5 hover:bg-white/10 border-white/10 text-slate-300 rounded-xl text-xs font-medium cursor-pointer"
              >
                <span>Go to App Launcher</span>
              </Button>
            </div>
          </div>
        )}

        {/* Skip Setup Permanently Modal trigger - ONLY for initial onboarding */}
        {step < 5 && isOnboardingMode && (
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
        {step < 5 && !isOnboardingMode && (
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => navigate('/app')}
              className="text-xs text-slate-500 hover:text-slate-400 underline underline-offset-4 transition-colors cursor-pointer"
            >
              Cancel and return to App Launcher
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
                You will be taken to the App Launcher. You can create an organization or join existing ones whenever you are ready.
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

export default OrganizationWizard;
