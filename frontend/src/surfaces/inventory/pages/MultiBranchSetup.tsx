import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useBranchStore } from '@/stores/useBranchStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import {
  Layers,
  Store,
  Plus,
  Trash2,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  MapPin,
  Phone,
  Check,
  Star,
} from 'lucide-react';

export const MultiBranchSetup: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orgParam = searchParams.get('org');

  const { currentWorkspace, workspaces, selectWorkspace } = useWorkspaceStore();
  const { branches, loadBranches, createBranch, updateBranch } = useBranchStore();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [planKey, setPlanKey] = useState<'free_trial' | 'standard'>('free_trial');

  // Branch Form Inputs
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);

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
        api.get<{ success: boolean; data?: any }>(`/organizations/${activeOrgId}/subscription`)
          .then((res) => {
            if (mounted && res?.data?.subscription?.planKey) {
              const subPlan = res.data.subscription.planKey.toLowerCase();
              if (subPlan === 'standard') {
                setPlanKey('standard');
              }
            }
          })
          .catch(() => {});

        const list = await loadBranches(activeOrgId, 'inventory').catch(() => []);
        if (mounted) {
          // If no branches exist yet, make first branch primary by default
          if (list.length === 0) {
            setIsPrimary(true);
          }
        }
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

  const handleAddBranch = async (andFinish: boolean = false) => {
    if (!name.trim()) {
      toast.error('Please enter a branch name.');
      return;
    }

    if (!activeOrgId) {
      toast.error('No active organization found.');
      return;
    }

    setIsSubmitting(true);
    try {
      await createBranch({
        workspaceId: activeOrgId,
        name: name.trim(),
        code: code.trim() || undefined,
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
        isPrimary: isPrimary || branches.length === 0,
      });

      toast.success(`Branch "${name.trim()}" added successfully!`);

      // Reset form
      setName('');
      setCode('');
      setAddress('');
      setPhone('');
      setIsPrimary(false);

      const updated = await loadBranches(activeOrgId, 'inventory');

      if (andFinish) {
        if (updated.length === 0) {
          toast.error('At least one branch is required.');
          return;
        }
        navigate(`/dashboard?org=${activeOrgId}`);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to add branch.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (bId: string, bName: string) => {
    if (branches.length <= 1) {
      toast.error('At least one operational branch must remain.');
      return;
    }

    try {
      if (activeOrgId && bId) {
        await api.delete(`/organizations/${activeOrgId}/branches/${bId}`).catch(async () => {
          await updateBranch(bId, { status: 'deleted' });
        });
      } else if (bId) {
        await updateBranch(bId, { status: 'deleted' });
      }
      toast.success(`Branch "${bName}" removed.`);
      if (activeOrgId) await loadBranches(activeOrgId, 'inventory');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete branch.');
    }
  };

  const handleFinish = () => {
    if (branches.length === 0) {
      toast.error('Please add at least one branch before finishing setup.');
      return;
    }
    toast.success(`Setup finished for ${activeOrgName}!`);
    navigate(`/dashboard?org=${activeOrgId}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center space-y-3">
        <Spinner size="lg" className="text-[#714b67]" />
        <p className="text-xs text-slate-400">Loading multi-branch configuration...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-slate-100 flex flex-col justify-between selection:bg-[#714b67] selection:text-white">
      {/* Top Header */}
      <header className="h-16 border-b border-white/10 px-6 flex items-center justify-between bg-[#0d090d]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#714b67] flex items-center justify-center text-white font-bold text-sm shadow-md">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>{activeOrgName}</span>
              <span className="text-slate-500">•</span>
              <span className="text-[#c79dbd]">Multi-Branch Setup</span>
            </div>
            <p className="text-[10px] text-slate-400">Configure your business locations</p>
          </div>
        </div>

        {branches.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleFinish}
            className="border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs gap-1.5 cursor-pointer"
          >
            <span>Finish Setup ({branches.length} added)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        )}
      </header>

      {/* Main Form & Added Branches Grid */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-10 space-y-8 animate-in fade-in duration-300">
        <div className="space-y-2 border-b border-white/5 pb-4">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#714b67]/20 border border-[#714b67]/30 text-[#c79dbd] text-[11px] font-bold">
            <Sparkles className="w-3 h-3 text-[#FDB02F]" />
            <span>Multiple Locations</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Set Up Your Branches
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Set up the branches and locations where you will track stock, purchases, and sales. You can add more later in settings.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Add Branch Form */}
          <div className="lg:col-span-7 p-6 rounded-2xl bg-[#120b10] border border-[#714b67]/30 shadow-xl space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-white/10">
              <Plus className="w-4 h-4 text-[#FDB02F]" />
              <h2 className="text-sm font-bold text-white">
                {branches.length === 0 ? 'Add Your First Branch (Required)' : 'Add Another Branch'}
              </h2>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAddBranch(false);
              }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300 font-semibold">
                  Branch Name <span className="text-rose-400">*</span>
                </Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Marina Main Store, Ikeja Outlet, Abuja Hub"
                  className="bg-black/60 border-white/15 text-xs text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300 font-semibold">Branch Code (Optional)</Label>
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="e.g. MAR, IKJ, ABJ"
                    className="bg-black/60 border-white/15 text-xs text-white uppercase"
                    maxLength={6}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300 font-semibold">Phone (Optional)</Label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. +234 801 234 5678"
                    className="bg-black/60 border-white/15 text-xs text-white"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300 font-semibold">Address / Area (Optional)</Label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Plot 4, Commercial Avenue, Ikeja"
                  className="bg-black/60 border-white/15 text-xs text-white"
                />
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 select-none">
                  <input
                    type="checkbox"
                    checked={isPrimary || branches.length === 0}
                    disabled={branches.length === 0}
                    onChange={(e) => setIsPrimary(e.target.checked)}
                    className="rounded border-white/20 text-[#714b67] focus:ring-0"
                  />
                  <span>Mark as primary branch</span>
                  {branches.length === 0 && (
                    <span className="text-[10px] text-slate-500">(First branch is default primary)</span>
                  )}
                </label>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 pt-3 border-t border-white/10">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleAddBranch(false)}
                  disabled={isSubmitting}
                  className="w-full sm:w-1/2 border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs font-semibold"
                >
                  {isSubmitting ? <Spinner className="w-3.5 h-3.5 mr-2" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
                  <span>Save & Add Another</span>
                </Button>

                <Button
                  type="button"
                  onClick={() => handleAddBranch(true)}
                  disabled={isSubmitting}
                  className="w-full sm:w-1/2 bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-bold shadow-lg shadow-[#714b67]/30"
                >
                  {isSubmitting ? <Spinner className="w-3.5 h-3.5 mr-2" /> : <Check className="w-3.5 h-3.5 mr-1.5" />}
                  <span>Save & Finish Setup</span>
                </Button>
              </div>
            </form>
          </div>

          {/* Right Column: Added Branches List */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Configured Branches ({branches.length} / {planKey === 'standard' ? '3' : '1'})
                </h3>
                <span className="text-[10px] text-slate-500">
                  {planKey === 'standard' ? 'Standard Plan (Up to 3 branches)' : 'Free Trial (1 branch allowed)'}
                </span>
              </div>
              {branches.length >= 1 && (
                <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Ready
                </span>
              )}
            </div>

            {planKey !== 'standard' && branches.length >= 1 && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                  <Sparkles className="w-4 h-4 text-[#FDB02F]" />
                  <span>Free Trial Limit Reached (1/1 Branch)</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Your organization is currently on the 30-Day Free Trial. To add up to 3 branch locations, upgrade your organization to the Standard Plan.
                </p>
                <a
                  href={`/onboard/activate?org=${activeOrgId}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-bold transition-colors"
                >
                  <span>Upgrade to Standard (₦7,500/mo)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            )}

            {branches.length === 0 ? (
              <div className="p-8 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] text-center space-y-2">
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
                    className="p-4 rounded-xl bg-[#120b10] border border-white/10 flex items-start justify-between gap-3 shadow-md"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-white truncate">{b.name}</span>
                        {b.code && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-slate-300">
                            {b.code}
                          </span>
                        )}
                        {b.isPrimary && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#714b67]/30 text-[#f0d8e8] border border-[#714b67]/40 flex items-center gap-1">
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
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
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
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
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
