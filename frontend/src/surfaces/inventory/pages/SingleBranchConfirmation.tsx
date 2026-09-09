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
  Store,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  MapPin,
  Phone,
  Edit2,
  Building2,
  Save,
} from 'lucide-react';

export const SingleBranchConfirmation: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orgParam = searchParams.get('org');

  const { currentWorkspace, workspaces, selectWorkspace } = useWorkspaceStore();
  const { loadBranches, updateBranch } = useBranchStore();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Editable Branch Fields
  const [branchId, setBranchId] = useState<string>('');
  const [branchName, setBranchName] = useState<string>('Main Branch');
  const [branchCode, setBranchCode] = useState<string>('MAIN');
  const [branchAddress, setBranchAddress] = useState<string>('');
  const [branchPhone, setBranchPhone] = useState<string>('');

  const activeOrgId = orgParam || currentWorkspace?.id || localStorage.getItem('orvio_active_workspace_id') || workspaces[0]?.workspace?.id;
  const activeOrgName = currentWorkspace?.name || workspaces.find((w) => w.workspace.id === activeOrgId)?.workspace.name || 'Your Business';

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

        // 1. Call auto-main branch endpoint to guarantee Main Branch exists
        const autoRes = await api
          .post<{ branchId?: string; branch?: any }>(`/organizations/${activeOrgId}/branches/auto-main`, {
            name: `${activeOrgName} Main`,
          })
          .catch(() => null);

        // 2. Load branches for this organization
        const branchList = await loadBranches(activeOrgId, 'inventory').catch(() => []);

        if (mounted) {
          const main = branchList.find((b) => b.isPrimary) || branchList[0] || autoRes?.branch;
          if (main) {
            setBranchId(String(main.id || main._id || ''));
            setBranchName(String(main.name || 'Main Branch'));
            setBranchCode(String(main.code || 'MAIN'));
            setBranchAddress(String(main.address || main.formattedAddress || ''));
            setBranchPhone(String(main.phone || ''));
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
  }, [activeOrgId, activeOrgName, currentWorkspace?.id, selectWorkspace, loadBranches]);

  const handleSaveEdit = async () => {
    if (!branchName.trim()) {
      toast.error('Branch name is required.');
      return;
    }

    setIsSaving(true);
    try {
      if (branchId) {
        await updateBranch(branchId, {
          name: branchName.trim(),
          address: branchAddress.trim() || undefined,
          phone: branchPhone.trim() || undefined,
        });
        toast.success('Branch details updated successfully!');
      }
      setIsEditing(false);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update branch details.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleContinue = () => {
    toast.success(`Welcome to ${activeOrgName} Inventory!`);
    navigate(`/dashboard?org=${activeOrgId}`);
  };

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
            <p className="text-[10px] text-slate-400">Single Location Business Setup</p>
          </div>
        </div>
      </header>

      {/* Main Confirmation Content */}
      <main className="flex-1 max-w-xl w-full mx-auto px-4 sm:px-6 py-12 space-y-8 animate-in zoom-in-95 duration-300">
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
              We have automatically configured your primary branch for stock tracking, POS checkout, and inventory records.
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
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300 font-semibold">Branch Name</Label>
                <Input
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  placeholder="e.g. Main Store or Lagos Island Warehouse"
                  className="bg-black/60 border-white/15 text-xs text-white"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300 font-semibold">Location / Address (Optional)</Label>
                <Input
                  value={branchAddress}
                  onChange={(e) => setBranchAddress(e.target.value)}
                  placeholder="e.g. 12 Marina Street, Lagos Island"
                  className="bg-black/60 border-white/15 text-xs text-white"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300 font-semibold">Contact Phone (Optional)</Label>
                <Input
                  value={branchPhone}
                  onChange={(e) => setBranchPhone(e.target.value)}
                  placeholder="e.g. +234 801 234 5678"
                  className="bg-black/60 border-white/15 text-xs text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
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
                  className="bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-bold gap-1.5"
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
                <span>{branchAddress || 'Address will use your main business location'}</span>
              </div>
              <div className="flex items-center gap-2.5 text-slate-300">
                <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                <span>{branchPhone || 'Phone will use your business contact'}</span>
              </div>
              <div className="flex items-center gap-2.5 text-slate-400 text-[11px] pt-1">
                <Building2 className="w-3.5 h-3.5 text-[#FDB02F]" />
                <span>Scoped to: <strong>{activeOrgName}</strong> • Inventory App</span>
              </div>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <Button
            type="button"
            onClick={handleContinue}
            className="w-full py-3.5 rounded-xl bg-[#714b67] hover:bg-[#86597a] text-white text-xs sm:text-sm font-bold shadow-xl shadow-[#714b67]/30 transition-all hover:scale-[1.01] flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Continue to Inventory</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </main>
    </div>
  );
};
