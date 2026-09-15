import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useBranchStore } from '@/stores/useBranchStore';
import { useLocationStore } from '@/stores/useLocationStore';
import { CatalogOnboardingModal } from '../components/CatalogOnboardingModal';
import { CustomSelect, type SelectOption } from '@/components/ui/custom-select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import {
  Store,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  MapPin,
  Phone,
  Edit2,
  Building2,
  Save,
  Boxes,
  Copy,
} from 'lucide-react';

export const SingleBranchConfirmation: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orgParam = searchParams.get('org');

  const { currentWorkspace, workspaces, selectWorkspace } = useWorkspaceStore();
  const { loadBranches, updateBranch, setActiveBranch } = useBranchStore();
  const { states, fetchStates } = useLocationStore();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [planKey, setPlanKey] = useState<'free_trial' | 'standard'>('free_trial');

  // Editable Branch Fields
  const [branchId, setBranchId] = useState<string>('');
  const [branchName, setBranchName] = useState<string>('Main Branch');
  const [branchCode, setBranchCode] = useState<string>('MAIN');

  // Split Address Fields (Matching Organization Wizard)
  const [street, setStreet] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [stateName, setStateName] = useState<string>('Lagos');
  const [country] = useState<string>('Nigeria');

  // Phone input (digits without +234)
  const [phoneDigits, setPhoneDigits] = useState<string>('');

  const activeOrgId = orgParam || currentWorkspace?.id || localStorage.getItem('orvio_active_workspace_id') || workspaces[0]?.workspace?.id;
  const activeOrgName = currentWorkspace?.name || workspaces.find((w) => w.workspace.id === activeOrgId)?.workspace.name || 'Your Business';

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

  const cleanPhone = (val: string) => {
    let raw = val.replace(/\s+/g, '');
    if (raw.startsWith('+234')) {
      raw = raw.slice(4);
    } else if (raw.startsWith('234')) {
      raw = raw.slice(3);
    } else if (raw.startsWith('0')) {
      raw = raw.slice(1);
    }
    return raw;
  };

  useEffect(() => {
    let mounted = true;
    const ensureMainBranch = async () => {
      try {
        if (!activeOrgId) {
          if (mounted) setIsLoading(false);
          return;
        }

        localStorage.setItem('orvio_active_workspace_id', activeOrgId);
        if (currentWorkspace?.id !== activeOrgId) {
          await selectWorkspace(activeOrgId).catch(() => {});
        }

        // Fetch organization subscription status
        api.get<any>(`/organizations/${activeOrgId}/subscription`)
          .then((res) => {
            const sub = res?.subscription || res?.data?.subscription || currentWorkspace?.subscription;
            const rawPk = (
              sub?.activePlan ||
              (sub?.status === 'active' ? (sub?.selectedPlan || sub?.planKey) : null) ||
              res?.activePlan ||
              sub?.planKey ||
              res?.planKey ||
              currentWorkspace?.planKey
            );
            if (mounted && rawPk) {
              const subPlan = String(rawPk).toLowerCase();
              if (subPlan === 'standard' || subPlan === 'premium') {
                setPlanKey('standard');
              } else {
                setPlanKey('free_trial');
              }
            }
          })
          .catch(() => {});

        // 1. Call auto-main branch endpoint to guarantee Main Branch exists
        const autoRes = await api
          .post<{ branchId?: string; branch?: any }>(`/organizations/${activeOrgId}/branches/auto-main`, {
            name: `${activeOrgName} Main`,
          })
          .catch(() => null);

        // 2. Load branches for this organization
        const branchList = await loadBranches(activeOrgId, 'inventory', true).catch(() => []);

        if (mounted) {
          const main = branchList.find((b) => b.isPrimary) || branchList[0] || autoRes?.branch;
          if (main) {
            setActiveBranch(main);
            setBranchId(String(main.id || main._id || ''));
            setBranchName(String(main.name || `${activeOrgName} Main`));
            setBranchCode(String(main.code || 'MAIN'));
            
            if (main.street) setStreet(main.street);
            if (main.city) setCity(main.city);
            if (main.state) setStateName(main.state);
            
            // If branch had raw address string and no structured street
            if (!main.street && main.address) {
              const parts = String(main.address).split(',').map((p) => p.trim());
              if (parts.length >= 1) setStreet(parts[0]);
              if (parts.length >= 2) setCity(parts[1]);
              if (parts.length >= 3) setStateName(parts[2]);
            }

            if (main.phone) {
              setPhoneDigits(cleanPhone(main.phone));
            } else if ((currentWorkspace as any)?.phone) {
              setPhoneDigits(cleanPhone((currentWorkspace as any).phone));
            }
          }
        }
      } catch (err: any) {
        toast.error('Failed to initialize main branch.');
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    ensureMainBranch();
    return () => {
      mounted = false;
    };
  }, [activeOrgId, activeOrgName, currentWorkspace, selectWorkspace, loadBranches, setActiveBranch]);

  const handlePrefillFromOrg = async () => {
    try {
      // 1. Check currentWorkspace
      const ws = currentWorkspace as any;
      const meta = ws?.metadata || {};
      let orgStreet = ws?.street || meta.street || '';
      let orgCity = ws?.city || meta.city || '';
      let orgState = ws?.state || meta.state || '';
      let orgPhone = ws?.phone || meta.phone || '';

      // 2. Fallback to API get organization details
      if (!orgStreet && !orgPhone && activeOrgId) {
        const res = await api.get<any>(`/organizations/${activeOrgId}`).catch(() => null);
        const orgData = res?.organization || res?.data?.organization || res;
        if (orgData) {
          orgStreet = orgData.street || orgData.address || '';
          orgCity = orgData.city || '';
          orgState = orgData.state || '';
          orgPhone = orgData.phone || '';
        }
      }

      if (orgStreet) setStreet(orgStreet);
      if (orgCity) setCity(orgCity);
      if (orgState) setStateName(orgState);
      if (orgPhone) setPhoneDigits(cleanPhone(orgPhone));

      toast.success('Pre-filled address and contact details from organization!');
    } catch {
      toast.info('Could not retrieve organization address details.');
    }
  };

  const handleSaveEdit = async () => {
    if (!branchName.trim()) {
      toast.error('Branch name is required.');
      return;
    }

    setIsSaving(true);
    try {
      const formattedPhone = phoneDigits.trim() ? `+234${cleanPhone(phoneDigits)}` : undefined;
      const addressParts = [street.trim(), city.trim(), stateName.trim(), country].filter(Boolean);
      const formattedAddress = addressParts.length > 0 ? addressParts.join(', ') : undefined;

      if (branchId) {
        const updated = await updateBranch(branchId, {
          name: branchName.trim(),
          code: branchCode.trim() || undefined,
          street: street.trim() || undefined,
          city: city.trim() || undefined,
          state: stateName.trim() || undefined,
          country: 'Nigeria',
          address: formattedAddress,
          formattedAddress,
          phone: formattedPhone,
        });
        if (updated) {
          setActiveBranch(updated);
        }
        toast.success('Branch details updated successfully!');
      }
      setIsEditing(false);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update branch details.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleContinue = async () => {
    setIsSaving(true);
    try {
      let finalBranch: any = null;
      if (branchId && branchName.trim()) {
        const formattedPhone = phoneDigits.trim() ? `+234${cleanPhone(phoneDigits)}` : undefined;
        const addressParts = [street.trim(), city.trim(), stateName.trim(), country].filter(Boolean);
        const formattedAddress = addressParts.length > 0 ? addressParts.join(', ') : undefined;

        finalBranch = await updateBranch(branchId, {
          name: branchName.trim(),
          code: branchCode.trim() || undefined,
          street: street.trim() || undefined,
          city: city.trim() || undefined,
          state: stateName.trim() || undefined,
          country: 'Nigeria',
          address: formattedAddress,
          formattedAddress,
          phone: formattedPhone,
        }).catch(() => null);
      }

      let targetBranchId = branchId;
      if (activeOrgId) {
        const reloaded = await loadBranches(activeOrgId, 'inventory', true).catch(() => []);
        const target = finalBranch || (branchId ? reloaded.find((b) => (b.id || b._id) === branchId) : null) || reloaded[0];
        if (target) {
          setActiveBranch(target);
          targetBranchId = target.id || target._id || targetBranchId;
        }
      } else if (finalBranch) {
        setActiveBranch(finalBranch);
        targetBranchId = finalBranch.id || finalBranch._id || targetBranchId;
      }

      toast.success(`Welcome to ${activeOrgName} Inventory!`);
      navigate(`/dashboard?org=${activeOrgId}${targetBranchId ? `&branchId=${targetBranchId}` : ''}`);
    } catch {
      navigate(`/dashboard?org=${activeOrgId}${branchId ? `&branchId=${branchId}` : ''}`);
    } finally {
      setIsSaving(false);
    }
  };

  const fullDisplayAddress = [street, city, stateName, country].filter(Boolean).join(', ');
  const fullDisplayPhone = phoneDigits ? `+234 ${cleanPhone(phoneDigits)}` : '';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center space-y-3">
        <Spinner size="lg" className="text-[#714b67]" />
        <p className="text-xs text-slate-400">Preparing your main branch...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-slate-100 flex flex-col justify-between selection:bg-[#714b67] selection:text-white">
      {/* Top Header */}
      <header className="h-16 border-b border-white/10 px-6 flex items-center justify-between bg-[#0d090d]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#714b67] flex items-center justify-center text-white font-bold text-sm shadow-md">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>{activeOrgName}</span>
              <span className="text-slate-500">•</span>
              <span className="text-[#c79dbd]">Branch Setup</span>
            </div>
            <p className="text-[10px] text-slate-400">Primary Operational Location</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#714b67]/20 border border-[#714b67]/30 text-[#c79dbd] flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#FDB02F]" />
            <span>{planKey === 'standard' ? 'Standard Plan' : '30-Day Free Trial (1 Branch)'}</span>
          </span>
        </div>
      </header>

      {/* Main Confirmation Content */}
      <main className="flex-1 max-w-xl w-full mx-auto px-4 sm:px-6 py-10 space-y-8 animate-in zoom-in-95 duration-300">
        {/* Success Icon & Headings */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-3xl bg-[#714b67]/25 border border-[#714b67]/50 flex items-center justify-center text-[#FDB02F] mx-auto shadow-xl shadow-[#714b67]/20">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#714b67]/20 border border-[#714b67]/30 text-[#c79dbd] text-[11px] font-bold">
              <Sparkles className="w-3 h-3 text-[#FDB02F]" />
              <span>Ready for Operations</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Your Main Branch is Ready
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
              We have configured your primary branch for stock tracking, POS checkout, and inventory records.
            </p>
          </div>
        </div>

        {/* Branch Details Card */}
        <div className="p-6 rounded-2xl bg-[#120b10] border border-[#714b67]/30 shadow-xl space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#714b67]/25 flex items-center justify-center text-white">
                <Store className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white">{branchName}</h3>
                  {branchCode && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-slate-300">
                      {branchCode}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
                  Primary Operational Location
                </span>
              </div>
            </div>

            {!isEditing && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="h-8 border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 text-xs gap-1.5 cursor-pointer"
              >
                <Edit2 className="w-3 h-3 text-[#c79dbd]" />
                <span>Edit Details</span>
              </Button>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Quick-fill Button */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs">
                <span className="text-slate-300 font-medium">Use parent organization details?</span>
                <button
                  type="button"
                  onClick={handlePrefillFromOrg}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#714b67]/30 hover:bg-[#714b67]/50 border border-[#714b67]/40 text-[#d4a8c9] text-xs font-semibold transition cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>Use Organization Address & Phone</span>
                </button>
              </div>

              {/* Branch Name & Code */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs text-slate-300 font-semibold">
                    Branch Name <span className="text-rose-400">*</span>
                  </Label>
                  <Input
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    placeholder="e.g. Main Store or Lagos Island Warehouse"
                    className="bg-black/60 border-white/15 text-xs text-white"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300 font-semibold">Branch Code</Label>
                  <Input
                    value={branchCode}
                    onChange={(e) => setBranchCode(e.target.value.toUpperCase())}
                    placeholder="MAIN"
                    maxLength={6}
                    className="bg-black/60 border-white/15 text-xs text-white font-mono uppercase"
                  />
                </div>
              </div>

              {/* Contact Phone (Standardized +234) */}
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300 font-semibold">Branch Contact Phone</Label>
                <div className="relative flex items-center h-10 bg-[#0e0a0d] border border-white/15 rounded-md text-xs transition-all focus-within:ring-1 focus-within:ring-[#714b67] focus-within:border-[#714b67]">
                  <div className="flex items-center gap-1.5 pl-3 pr-2.5 h-full border-r border-white/10 text-slate-300 select-none shrink-0 bg-white/[0.02]">
                    <Phone className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-xs font-medium text-slate-200">+234</span>
                  </div>
                  <input
                    type="tel"
                    placeholder="801 234 5678"
                    value={phoneDigits}
                    onChange={(e) => setPhoneDigits(e.target.value)}
                    className="w-full h-full bg-transparent px-3 text-white placeholder:text-slate-600 text-xs focus:outline-none"
                  />
                </div>
              </div>

              {/* Structured Address (Split like Organization Wizard) */}
              <div className="space-y-3 pt-2 border-t border-white/10">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                  <MapPin className="w-3.5 h-3.5 text-[#FDB02F]" />
                  <span>Physical Address Details</span>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300 font-medium">Street / Area Address</Label>
                  <Input
                    placeholder="e.g. 14 Marina Road, Victoria Island"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    className="bg-black/60 border-white/15 text-xs text-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300 font-medium">City / Town</Label>
                    <Input
                      placeholder="e.g. Ikeja"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="bg-black/60 border-white/15 text-xs text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300 font-medium">State</Label>
                    <CustomSelect
                      value={stateName}
                      onChange={setStateName}
                      options={stateOptions}
                      placeholder="Select State"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300 font-medium">Country</Label>
                    <Input
                      value={country}
                      disabled
                      className="bg-white/5 border-white/10 text-slate-400 cursor-not-allowed text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(false)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  className="bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-bold gap-1.5 cursor-pointer"
                >
                  {isSaving ? <Spinner className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Save Changes</span>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-2.5 text-slate-300">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <span>{fullDisplayAddress || 'Address will use your main business location'}</span>
              </div>
              <div className="flex items-center gap-2.5 text-slate-300">
                <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                <span>{fullDisplayPhone || 'Phone will use your organization contact phone'}</span>
              </div>
              <div className="flex items-center gap-2.5 text-slate-400 text-[11px] pt-1">
                <Building2 className="w-3.5 h-3.5 text-[#FDB02F]" />
                <span>Scoped to: <strong>{activeOrgName}</strong> • Inventory App</span>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="pt-2 space-y-2">
          <Button
            type="button"
            onClick={() => setIsCatalogModalOpen(true)}
            className="w-full py-3.5 rounded-xl bg-[#714b67] hover:bg-[#86597a] text-white text-xs sm:text-sm font-bold shadow-xl shadow-[#714b67]/30 transition-all hover:scale-[1.01] flex items-center justify-center gap-2 cursor-pointer"
          >
            <Boxes className="w-4 h-4 text-[#FDB02F]" />
            <span>Set Up Product Catalog</span>
            <ArrowRight className="w-4 h-4" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={handleContinue}
            className="w-full py-2.5 text-xs text-slate-400 hover:text-white cursor-pointer"
          >
            <span>Skip to Inventory Dashboard</span>
          </Button>
        </div>
      </main>

      {/* Catalog Onboarding Modal (1-Click Sample vs CSV Upload) */}
      <CatalogOnboardingModal
        isOpen={isCatalogModalOpen}
        orgId={activeOrgId}
        orgName={activeOrgName}
        onComplete={() => {
          setIsCatalogModalOpen(false);
          handleContinue();
        }}
        onSkip={() => {
          setIsCatalogModalOpen(false);
          handleContinue();
        }}
      />
    </div>
  );
};

export default SingleBranchConfirmation;
