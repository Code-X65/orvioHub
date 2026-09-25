import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useBranchStore } from '@/stores/useBranchStore';
import { Button } from '@/components/ui/button';
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
} from 'lucide-react';
import { BranchForm, type BranchFormData, cleanPhone } from '@/components/branch';
import { useBranchLimit } from '@/hooks/useBranchLimit';

export const SingleBranchConfirmation: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orgParam = searchParams.get('org');

  const { currentWorkspace, workspaces, selectWorkspace } = useWorkspaceStore();
  const { loadBranches, updateBranch, setActiveBranch } = useBranchStore();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [planKey, setPlanKey] = useState<string>('free_trial');

  // Editable Branch Fields
  const [branchId, setBranchId] = useState<string>('');
  const [branchName, setBranchName] = useState<string>('Main Branch');
  const [branchCode, setBranchCode] = useState<string>('MAIN');

  // Address Fields
  const [street, setStreet] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [stateName, setStateName] = useState<string>('Lagos');
  const [country] = useState<string>('Nigeria');
  const [phoneDigits, setPhoneDigits] = useState<string>('');

  const activeOrgId = orgParam || currentWorkspace?.id || localStorage.getItem('orvio_active_workspace_id') || workspaces[0]?.workspace?.id;
  const activeOrgName = currentWorkspace?.name || workspaces.find((w) => w.workspace.id === activeOrgId)?.workspace.name || 'Your Business';

  const { isFreeTrial, planName } = useBranchLimit({
    planKey,
    currentCount: 1,
  });

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
              setPlanKey(String(rawPk).toLowerCase());
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
      } catch {
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

  const handleSaveFormEdit = async (formData: BranchFormData) => {
    setBranchName(formData.name);
    if (formData.code) setBranchCode(formData.code);
    if (formData.phoneDigits) setPhoneDigits(formData.phoneDigits);
    if (formData.street) setStreet(formData.street);
    if (formData.city) setCity(formData.city);
    if (formData.state) setStateName(formData.state);

    setIsSaving(true);
    try {
      if (branchId) {
        const updated = await updateBranch(
          branchId,
          {
            name: formData.name,
            code: formData.code || undefined,
            street: formData.street || undefined,
            city: formData.city || undefined,
            state: formData.state || undefined,
            stateCode: formData.stateCode || undefined,
            lga: formData.lga || undefined,
            country: formData.country || 'Nigeria',
            blockNumber: formData.blockNumber || undefined,
            area: formData.area || undefined,
            landmark: formData.landmark || undefined,
            postalCode: formData.postalCode || undefined,
            address: formData.address,
            formattedAddress: formData.address,
            phone: formData.phone,
          },
          activeOrgId
        );
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
        }, activeOrgId).catch(() => null);
      }

      let targetBranchId = branchId;
      if (activeOrgId) {
        const reloaded = await loadBranches(activeOrgId, 'inventory', true).catch(() => []);
        const target = finalBranch || (branchId ? reloaded.find((b) => (b.id || b._id) === branchId) : null) || reloaded[0];
        if (target) {
          setActiveBranch(target);
          targetBranchId = target.id || target._id || targetBranchId;
        }

        // Initialize the inventory onboarding flow for this branch
        await api
          .post('/onboarding/inventory/start', {
            workspaceId: activeOrgId,
            initialStep: 'product_setup',
          }, {
            headers: { 'x-workspace-id': activeOrgId },
          })
          .catch(() => null);
      } else if (finalBranch) {
        setActiveBranch(finalBranch);
        targetBranchId = finalBranch.id || finalBranch._id || targetBranchId;
      }

      toast.success(`Primary branch confirmed! Let's configure products and make your first sale.`);
      navigate(`/onboard/inventory?org=${activeOrgId}${targetBranchId ? `&branchId=${targetBranchId}` : ''}`);
    } catch {
      navigate(`/onboard/inventory?org=${activeOrgId}${branchId ? `&branchId=${branchId}` : ''}`);
    } finally {
      setIsSaving(false);
    }
  };

  const fullDisplayAddress = [street, city, stateName, country].filter(Boolean).join(', ');
  const fullDisplayPhone = phoneDigits ? `+234 ${cleanPhone(phoneDigits)}` : '';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-slate-100 flex flex-col justify-between animate-pulse">
        <div className="h-20 border-b border-white/5 bg-black/90 px-4 sm:px-12 flex items-center justify-between">
          <div className="w-28 h-8 rounded-sm bg-white/10" />
          <div className="w-20 h-8 rounded-sm bg-white/5" />
        </div>
        <div className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-12 space-y-6">
          <div className="w-48 h-7 rounded-sm bg-white/10" />
          <div className="w-80 h-4 rounded-sm bg-white/5" />
          <div className="h-64 rounded-sm bg-white/[0.02] border border-white/5" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-slate-100 flex flex-col justify-between selection:bg-[#714b67] selection:text-white">
      {/* Top Header */}
      <header className="h-16 border-b border-white/10 px-4 sm:px-6 flex items-center justify-between bg-[#0d090d]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-sm bg-[#714b67] flex items-center justify-center text-white font-bold text-sm shadow-md shrink-0">
            <Store className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
              <span>{activeOrgName}</span>
              <span className="text-slate-500">•</span>
              <span className="text-[#c79dbd]">Branch Setup</span>
            </div>
            <p className="text-[10px] text-slate-400 truncate">Primary Operational Location</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-2">
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-sm bg-[#714b67]/20 border border-[#714b67]/30 text-[#c79dbd] flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#FDB02F]" />
            <span className="hidden sm:inline">
              {isFreeTrial ? '30-Day Free Trial (1 Branch)' : `${planName} Plan`}
            </span>
            <span className="sm:hidden">Trial</span>
          </span>
        </div>
      </header>

      {/* Main Confirmation Content */}
      <main className="flex-1 max-w-xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6 sm:space-y-8 animate-in zoom-in-95 duration-300">
        {/* Success Icon & Headings */}
        <div className="text-center space-y-3">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-sm bg-[#714b67]/25 border border-[#714b67]/50 flex items-center justify-center text-[#FDB02F] mx-auto shadow-xl shadow-[#714b67]/20">
            <CheckCircle2 className="w-7 h-7 sm:w-8 sm:h-8" />
          </div>
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-sm bg-[#714b67]/20 border border-[#714b67]/30 text-[#c79dbd] text-[11px] font-bold">
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
        <div className="p-4 sm:p-6 rounded-sm bg-[#120b10] border border-[#714b67]/30 shadow-xl space-y-4 sm:space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-sm bg-[#714b67]/25 flex items-center justify-center text-white shrink-0">
                <Store className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white truncate">{branchName}</h3>
                  {branchCode && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-white/10 text-slate-300">
                      {branchCode}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider block truncate">
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
                className="h-8 rounded-sm border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 text-xs gap-1.5 cursor-pointer"
              >
                <Edit2 className="w-3 h-3 text-[#c79dbd]" />
                <span>Edit</span>
              </Button>
            )}
          </div>

          {isEditing ? (
            <div className="pt-2 animate-in fade-in duration-200">
              <BranchForm
                mode="edit"
                initialValues={{
                  name: branchName,
                  code: branchCode,
                  phoneDigits,
                  street,
                  city,
                  state: stateName,
                  country,
                }}
                organizationId={activeOrgId}
                showCode={true}
                showOrgPrefill={true}
                variant="plain"
                theme="plum"
                isSubmitting={isSaving}
                submitLabel="Save Changes"
                submittingLabel="Saving..."
                onCancel={() => setIsEditing(false)}
                onSubmit={handleSaveFormEdit}
              />
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
        <div className="pt-2">
          <Button
            type="button"
            onClick={handleContinue}
            disabled={isSaving}
            className="w-full py-4 rounded-sm bg-[#714b67] hover:bg-[#86597a] text-white text-sm font-bold shadow-xl shadow-[#714b67]/30 transition-all hover:scale-[1.01] flex items-center justify-center gap-2 cursor-pointer"
          >
            {isSaving ? (
              <>
                <Spinner className="w-4 h-4" />
                <span>Preparing Your Dashboard...</span>
              </>
            ) : (
              <>
                <span>Go to Inventory Dashboard</span>
                <ArrowRight className="w-4 h-4 text-[#FDB02F]" />
              </>
            )}
          </Button>
        </div>
      </main>
    </div>
  );
};

export default SingleBranchConfirmation;
