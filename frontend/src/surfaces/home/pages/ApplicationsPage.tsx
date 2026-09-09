import React, { useEffect, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { Header } from '@/components/landing/Header';
import { WorkspaceSwitcher } from '@/components/workspace/WorkspaceSwitcher';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { InventoryIcon } from '@/components/icons/InventoryIcon';
import { api } from '@/lib/api';
import { getCrossSubdomainUrl } from '@/lib/domain';
import { toast } from 'sonner';
import {
  ArrowRight,
  Layers,
  CheckCircle2,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Building2,
  Clock,
} from 'lucide-react';

interface AppStatus {
  active: boolean;
  status?: string;
  planId?: string;
}

export const ApplicationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentWorkspace, workspaces, fetchWorkspaces, isLoading, isSwitching } = useWorkspaceStore();

  const [hasLoaded, setHasLoaded] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const [inventoryStatus, setInventoryStatus] = useState<AppStatus | null>(null);

  // 1. Ensure workspaces are loaded
  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      if (workspaces.length === 0) {
        await fetchWorkspaces().catch(() => {});
      }
      if (isMounted) {
        setHasLoaded(true);
      }
    };
    init();
    return () => {
      isMounted = false;
    };
  }, [workspaces.length, fetchWorkspaces]);

  // 2. Fetch real application activation status for current workspace
  useEffect(() => {
    if (!currentWorkspace?.id) {
      setIsCheckingStatus(false);
      return;
    }

    let isMounted = true;
    setIsCheckingStatus(true);

    api
      .get<{ success: boolean; data?: { active: boolean; status?: string; planId?: string } }>(
        `/organizations/${currentWorkspace.id}/applications/inventory/status`
      )
      .then((res) => {
        if (!isMounted) return;
        if (res?.data) {
          setInventoryStatus(res.data);
        } else {
          setInventoryStatus({ active: false, status: 'inactive' });
        }
      })
      .catch(() => {
        if (isMounted) {
          setInventoryStatus({ active: false, status: 'inactive' });
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsCheckingStatus(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [currentWorkspace?.id]);

  // Handle redirect if no workspace is available after load
  if (hasLoaded && !isLoading && !isSwitching && !currentWorkspace) {
    return <Navigate to="/dashboard" replace />;
  }

  if (!hasLoaded || (workspaces.length === 0 && isLoading) || isSwitching || isCheckingStatus) {
    return (
      <div className="min-h-screen bg-black text-slate-100 flex flex-col">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center space-y-4">
          <Spinner size="lg" className="text-[#714b67]" />
          <p className="text-xs text-slate-400">Loading organization applications...</p>
        </div>
      </div>
    );
  }

  const isInventoryActive = Boolean(inventoryStatus?.active);
  const planName = inventoryStatus?.planId ? inventoryStatus.planId.toUpperCase() : 'FREE TRIAL';
  const orgName = currentWorkspace?.name || 'Organization';

  const handleActivateInventory = () => {
    if (!currentWorkspace?.id) {
      toast.error('No organization selected.');
      return;
    }
    const targetUrl = getCrossSubdomainUrl('inventory', `/onboard/activate?org=${currentWorkspace.id}`);
    window.location.href = targetUrl;
  };

  const handleOpenBranches = () => {
    navigate('/branches?app=inventory');
  };

  const handleDirectDashboard = () => {
    if (!currentWorkspace?.id) return;
    const targetUrl = getCrossSubdomainUrl('inventory', `/dashboard?org=${currentWorkspace.id}`);
    window.location.href = targetUrl;
  };

  return (
    <div className="min-h-screen bg-black text-slate-100 flex flex-col selection:bg-[#714b67] selection:text-white">
      <Header />

      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10 space-y-8 animate-in fade-in duration-300">
        {/* Header with Organization Context & Switcher */}
        <div className="bg-[#120a11] border border-[#714b67]/30 rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#714b67] text-white flex items-center justify-center font-bold text-lg shadow-md shrink-0">
              {orgName.charAt(0).toUpperCase()}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-[#FDB02F] uppercase tracking-wider bg-[#FDB02F]/10 px-2 py-0.5 rounded-full border border-[#FDB02F]/20">
                  Step 2 of 3: Organization Applications
                </span>
                {isInventoryActive ? (
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Active Application</span>
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-slate-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/10 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>No applications activated</span>
                  </span>
                )}
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                {orgName}
              </h1>
              <p className="text-xs text-slate-400">
                {isInventoryActive
                  ? 'Select an activated application to access branches and operations.'
                  : 'This organization has no activated applications. Set up Inventory to begin operations.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate('/dashboard')}
              className="h-8 text-xs border-white/10 hover:bg-white/5 text-slate-300 cursor-pointer flex items-center gap-1.5"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>All Organizations</span>
            </Button>
            <WorkspaceSwitcher />
          </div>
        </div>

        {/* Status Callout if not activated */}
        {!isInventoryActive && (
          <div className="p-5 rounded-xl bg-gradient-to-r from-[#714b67]/15 to-transparent border border-[#714b67]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#714b67]/25 flex items-center justify-center text-[#FDB02F] shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">No Applications Activated Yet</h3>
                <p className="text-xs text-slate-400">
                  Activate Inventory below to configure your store branches, POS registers, and inventory tracking.
                </p>
              </div>
            </div>
            <Button
              type="button"
              onClick={handleActivateInventory}
              className="h-9 px-4 rounded-lg bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-bold shadow-md shadow-[#714b67]/25 cursor-pointer shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#FDB02F] mr-1.5" />
              <span>Set Up Inventory</span>
            </Button>
          </div>
        )}

        {/* Applications Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Inventory Management & POS */}
          <div
            className={`p-6 sm:p-7 rounded-2xl border transition-all flex flex-col justify-between space-y-6 ${
              isInventoryActive
                ? 'bg-[#120b10] border-[#714b67]/50 shadow-xl shadow-[#714b67]/10'
                : 'bg-[#120b10]/80 border-white/10 hover:border-white/20'
            }`}
          >
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="w-12 h-12 rounded-xl bg-[#714b67]/25 border border-[#714b67]/40 flex items-center justify-center text-[#FDB02F] font-bold text-lg shadow-md">
                  <InventoryIcon className="w-7 h-7" />
                </div>
                {isInventoryActive ? (
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    Active • {planName}
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-white/5 text-slate-400 border border-white/10">
                    Not Activated
                  </span>
                )}
              </div>

              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  Operations & Commerce
                </span>
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Inventory Management & POS
                </h2>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  Track real-time stock across branches, manage receipts & purchase orders, run point-of-sale registers, and generate sales telemetry.
                </p>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-white/5">
                {[
                  'Multi-warehouse & store branch support',
                  'Barcode scanner & POS terminal checkout',
                  'Stock transfers & automated re-orders',
                  'Receipt printing & daily sales reports',
                ].map((feat, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-[11px] text-slate-300">
                    <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${isInventoryActive ? 'text-emerald-400' : 'text-slate-500'}`} />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-white/5 flex items-center gap-3">
              {isInventoryActive ? (
                <>
                  <Button
                    type="button"
                    onClick={handleOpenBranches}
                    className="flex-1 h-10 bg-[#714b67] hover:bg-[#86597a] text-white rounded-lg text-xs font-semibold shadow-lg shadow-[#714b67]/20 flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    <span>View Branches</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDirectDashboard}
                    className="h-10 px-3 border-white/10 hover:bg-white/5 text-slate-300 text-xs rounded-lg cursor-pointer"
                    title="Open Inventory Dashboard"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  onClick={handleActivateInventory}
                  className="w-full h-10 bg-gradient-to-r from-[#714b67] to-[#86597a] hover:from-[#86597a] hover:to-[#9c688e] text-white rounded-lg text-xs font-semibold shadow-lg shadow-[#714b67]/25 flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.01]"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#FDB02F]" />
                  <span>Set Up Inventory</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </div>

          {/* Card 2: Coming Soon Application Card */}
          <div className="p-6 sm:p-7 rounded-2xl border border-white/10 bg-[#120b10]/40 flex flex-col justify-between space-y-6 opacity-75">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 font-bold text-lg shadow-md">
                  <Layers className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-white/5 text-slate-400 border border-white/10">
                  Coming Soon
                </span>
              </div>

              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                  Productivity & Engineering
                </span>
                <h2 className="text-lg font-bold text-slate-300 tracking-tight">
                  Task & Sprint Management
                </h2>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  Collaborative task execution, agile kanban boards, backlog refinement, and team workload distribution.
                </p>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-white/5">
                {[
                  'Interactive Kanban Boards & Backlogs',
                  'Sprint & Milestone Planning',
                  'Cross-team Task Assignments & Timelines',
                ].map((feat, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-[11px] text-slate-500">
                    <CheckCircle2 className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-white/5">
              <Button
                type="button"
                disabled
                className="w-full h-10 bg-white/5 text-slate-500 rounded-lg text-xs font-semibold cursor-not-allowed"
              >
                Module In Development
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
