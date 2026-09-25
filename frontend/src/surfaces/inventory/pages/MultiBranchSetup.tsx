import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { getCrossSubdomainUrl } from '@/lib/domain';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useBranchStore } from '@/stores/useBranchStore';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import {
  Layers,
  Store,
  Trash2,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  MapPin,
  Phone,
  Star,
} from 'lucide-react';
import { BranchForm, type BranchFormData } from '@/components/branch';
import { useBranchLimit } from '@/hooks/useBranchLimit';

export const MultiBranchSetup: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orgParam = searchParams.get('org');

  const { currentWorkspace, workspaces, selectWorkspace } = useWorkspaceStore();
  const { branches, loadBranches, createBranch, deactivateBranch, setActiveBranch } = useBranchStore();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [planKey, setPlanKey] = useState<string>('free_trial');
  const [formResetKey, setFormResetKey] = useState(0);

  const activeOrgId = orgParam || currentWorkspace?.id || localStorage.getItem('orvio_active_workspace_id') || workspaces[0]?.workspace?.id;
  const activeOrgName = currentWorkspace?.name || workspaces.find((w) => w.workspace.id === activeOrgId)?.workspace.name || 'Your Business';

  useEffect(() => {
    let mounted = true;
    const init = async () => {
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

        await loadBranches(activeOrgId, 'inventory').catch(() => []);
      } catch {
        // Fallback
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    init();
    return () => {
      mounted = false;
    };
  }, [activeOrgId, currentWorkspace?.id, selectWorkspace, loadBranches]);

  const { atLimit, maxBranches, isFreeTrial, limitMessage, planName } = useBranchLimit({
    planKey,
    currentCount: branches.length,
  });

  const handleAddBranch = async (formData: BranchFormData, andFinish: boolean = false) => {
    if (atLimit) {
      toast.error(limitMessage);
      return;
    }

    if (!activeOrgId) {
      toast.error('No active organization found.');
      return;
    }

    setIsSubmitting(true);
    try {
      await createBranch({
        organizationId: activeOrgId,
        applicationKey: 'inventory',
        name: formData.name,
        code: formData.code,
        street: formData.street,
        city: formData.city,
        state: formData.state,
        stateCode: formData.stateCode,
        lga: formData.lga,
        country: formData.country || 'Nigeria',
        blockNumber: formData.blockNumber,
        area: formData.area,
        landmark: formData.landmark,
        postalCode: formData.postalCode,
        address: formData.address,
        formattedAddress: formData.address,
        phone: formData.phone,
        isPrimary: formData.isPrimary || branches.length === 0,
      });

      toast.success(`Branch "${formData.name}" added successfully!`);
      setFormResetKey((k) => k + 1);

      const updated = await loadBranches(activeOrgId, 'inventory', true);

      if (andFinish) {
        if (updated.length === 0) {
          toast.error('At least one branch is required.');
          return;
        }
        const target = updated.find((b) => b.isPrimary) || updated[0];
        if (target) {
          setActiveBranch(target);
        }
        const targetId = target?.id || target?._id;

        // Complete the inventory onboarding lifecycle
        await api
          .post(`/organizations/${activeOrgId}/inventory-onboarding/complete`, {
            branchId: targetId,
          })
          .catch(() => {});

        // Navigate to final completion step
        navigate(`/onboard/inventory/complete?org=${activeOrgId}`);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create branch.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, branchName: string) => {
    if (branches.length <= 1) {
      toast.error('At least one branch is required for inventory operations.');
      return;
    }

    if (window.confirm(`Are you sure you want to remove the branch "${branchName}"?`)) {
      try {
        await deactivateBranch(id);
        toast.success(`Branch "${branchName}" removed.`);
        if (activeOrgId) {
          await loadBranches(activeOrgId, 'inventory', true);
        }
      } catch (err: any) {
        toast.error(err?.message || 'Failed to remove branch.');
      }
    }
  };

  const handleFinish = async () => {
    if (branches.length === 0) {
      toast.error('Please add at least one branch to continue.');
      return;
    }

    const primaryBranch = branches.find((b) => b.isPrimary) || branches[0];
    if (primaryBranch) {
      setActiveBranch(primaryBranch);
    }

    if (activeOrgId) {
      await api
        .post('/onboarding/inventory/start', {
          workspaceId: activeOrgId,
          initialStep: 'product_setup',
        }, {
          headers: { 'x-workspace-id': activeOrgId },
        })
        .catch(() => {});
    }

    toast.success('Branch network initialized! Let’s configure products and practice your first sale.');
    navigate(`/onboard/inventory?org=${activeOrgId}&branchId=${primaryBranch?.id || primaryBranch?._id || ''}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#070506] flex items-center justify-center">
        <Spinner className="w-8 h-8 text-[#714b67]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070506] text-white flex flex-col justify-between selection:bg-[#714b67]/30">
      {/* Top Banner / Navigation */}
      <header className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-sm bg-[#714b67] flex items-center justify-center shadow-lg shadow-[#714b67]/30">
            <Layers className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Inventory App Setup
            </span>
            <h1 className="text-sm font-bold text-white leading-none">Branch Topology Setup</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">
            Organization: <strong className="text-white">{activeOrgName}</strong>
          </span>
          <span className="px-2 py-0.5 rounded-sm bg-white/10 text-[11px] font-mono text-[#d4a8c9] border border-white/10">
            Step 2 of 3
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Step Guide / Header */}
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-sm bg-[#714b67]/20 border border-[#714b67]/40 text-[#d4a8c9] text-[11px] font-bold">
            <Store className="w-3 h-3 text-[#d4a8c9]" />
            Multi-Location & Warehouses
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            Configure Your Business Branches
          </h2>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            Every store, retail outlet, and warehouse maintains its own stock levels, sales receipts,
            and staff assignments. Configure your locations below.
          </p>
        </div>

        {/* Two Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Branch Creation Form */}
          <div className="lg:col-span-7 bg-[#0e0a0d] border border-white/10 p-5 sm:p-6 rounded-sm space-y-5 shadow-2xl">
            <div className="border-b border-white/10 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Plus className="w-4 h-4 text-[#d4a8c9]" />
                  <span>Add Operational Branch</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Enter branch name, code, contact phone, and address details.
                </p>
              </div>

              {atLimit && (
                <span className="px-2 py-0.5 rounded-sm bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                  Limit Reached
                </span>
              )}
            </div>

            <BranchForm
              key={formResetKey}
              organizationId={activeOrgId}
              showCode={true}
              showPrimaryCheckbox={true}
              isPrimaryDefault={branches.length === 0}
              isPrimaryDisabled={branches.length === 0}
              showOrgPrefill={true}
              isLimitReached={atLimit}
              limitTooltip={limitMessage}
              limitBannerMessage={limitMessage}
              isSubmitting={isSubmitting}
              submitLabel="Save & Finish Setup"
              submittingLabel="Saving..."
              secondarySubmitLabel="Save & Add Another"
              onSecondarySubmit={(formData) => handleAddBranch(formData, false)}
              onSubmit={(formData) => handleAddBranch(formData, true)}
              theme="plum"
              variant="plain"
            />
          </div>

          {/* Right Column: Added Branches List */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Configured Branches ({branches.length} / {maxBranches})
                </h3>
                <span className="text-[10px] text-slate-500">
                  {planName} Plan ({maxBranches === 1 ? '1 branch allowed' : `Up to ${maxBranches} branches`})
                </span>
              </div>
              {branches.length >= 1 && (
                <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Ready
                </span>
              )}
            </div>

            {isFreeTrial && branches.length >= 1 && (
              <div className="p-4 rounded-sm bg-amber-500/10 border border-amber-500/30 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                  <Sparkles className="w-4 h-4 text-[#FDB02F]" />
                  <span>Free Trial Limit Reached (1/1 Branch)</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Your organization is currently on the 30-Day Free Trial. To add up to 3 branch locations, upgrade your organization to the Standard Plan.
                </p>
                <a
                  href={getCrossSubdomainUrl('home', '/billing')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-bold transition-colors"
                >
                  <span>Upgrade to Standard (₦7,500/mo)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            )}

            {branches.length === 0 ? (
              <div className="p-6 sm:p-8 rounded-sm border border-dashed border-white/15 bg-white/[0.02] text-center space-y-2">
                <Store className="w-8 h-8 text-slate-500 mx-auto" />
                <p className="text-xs font-bold text-white">No Branches Added Yet</p>
                <p className="text-[11px] text-slate-400">
                  Use the form to add your first branch. At least one location is required.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {branches.map((b) => (
                  <div
                    key={b.id || b._id}
                    className="p-4 rounded-sm bg-[#120b10] border border-white/10 flex items-start justify-between gap-3 shadow-md"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-white truncate">{b.name}</span>
                        {b.code && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-white/10 text-slate-300">
                            {b.code}
                          </span>
                        )}
                        {b.isPrimary && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-sm bg-[#714b67]/30 text-[#f0d8e8] border border-[#714b67]/40 flex items-center gap-1">
                            <Star className="w-2.5 h-2.5 fill-[#f0d8e8]" /> Primary
                          </span>
                        )}
                      </div>

                      {b.address && (
                        <p className="text-[11px] text-slate-400 flex items-center gap-1 truncate">
                          <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                          <span className="truncate">{b.address}</span>
                        </p>
                      )}

                      {b.phone && (
                        <p className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-500 shrink-0" />
                          <span>{b.phone}</span>
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDelete(String(b.id || b._id || ''), b.name)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-sm transition-colors cursor-pointer shrink-0"
                      title="Delete Branch"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                <div className="pt-2">
                  <Button
                    type="button"
                    onClick={handleFinish}
                    className="w-full py-3 rounded-sm bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Finish Setup & Open Inventory</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default MultiBranchSetup;
