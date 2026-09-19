import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useBranchStore } from '@/stores/useBranchStore';
import { BranchSwitcher } from '@/components/workspace/BranchSwitcher';
import { BranchCreationModal } from '@/components/workspace/BranchCreationModal';
import { BranchEditModal } from '@/components/workspace/BranchEditModal';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { InventoryIcon } from '@/components/icons/InventoryIcon';
import { getCrossSubdomainUrl } from '@/lib/domain';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import {
  Store,
  CheckCircle2,
  Settings,
  ExternalLink,
  Plus,
  Edit2,
  Layers,
  Sparkles,
  Package,
  Receipt,
  FileBarChart,
  Warehouse,
  Check,
} from 'lucide-react';

export const InventoryDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const branchParam = searchParams.get('branchId') || searchParams.get('branch');
  const orgParam = searchParams.get('org');

  const { user } = useAuthStore();
  const { currentWorkspace, workspaces, fetchWorkspaces } = useWorkspaceStore();
  const { activeBranch, branches, setActiveBranch, loadBranches } = useBranchStore();

  const [isVerifyingOrg, setIsVerifyingOrg] = useState(true);
  const [demoContext, setDemoContext] = useState<any>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(true);

  // Branch Modals
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);
  const [isEditingBranch, setIsEditingBranch] = useState(false);

  const activeOrgId = orgParam || currentWorkspace?.id || (typeof window !== 'undefined' ? localStorage.getItem('orvio_active_workspace_id') : null);

  // 1. Initial Organization Verification
  useEffect(() => {
    let isMounted = true;
    const verifyOrg = async () => {
      try {
        const wsList = await fetchWorkspaces('inventory');
        if (isMounted) {
          if (!wsList || wsList.length === 0) {
            toast.info('Please create or join an organization to access Inventory Management.');
            navigate('/dashboard', { replace: true });
            return;
          }
        }
      } catch (err) {
        if (isMounted && (!workspaces || workspaces.length === 0)) {
          toast.info('Please create or join an organization to access Inventory.');
          navigate('/dashboard', { replace: true });
          return;
        }
      } finally {
        if (isMounted) {
          setIsVerifyingOrg(false);
        }
      }
    };

    verifyOrg();
    return () => {
      isMounted = false;
    };
  }, [fetchWorkspaces, navigate]);

  // 2. Load Branches for active org
  useEffect(() => {
    if (activeOrgId) {
      loadBranches(activeOrgId, 'inventory').catch(() => []);
    }
  }, [activeOrgId, loadBranches]);

  // 3. Sync branch query param with active branch
  useEffect(() => {
    if (branches.length > 0) {
      if (branchParam) {
        const match = branches.find(
          (b) =>
            (b.id || b._id) === branchParam ||
            (b.code && b.code.toLowerCase() === branchParam.toLowerCase())
        );
        if (match && (!activeBranch || (activeBranch.id || activeBranch._id) !== (match.id || match._id))) {
          setActiveBranch(match);
        }
      } else if (!activeBranch) {
        const primary = branches.find((b) => b.isPrimary) || branches[0];
        if (primary) {
          setActiveBranch(primary);
        }
      }
    }
  }, [branchParam, branches, activeBranch, setActiveBranch]);

  // 4. Fetch Unified Demo Context
  useEffect(() => {
    let isMounted = true;
    const fetchContext = async () => {
      if (!activeOrgId) return;
      try {
        setIsLoadingContext(true);
        const targetBranchId = activeBranch?._id || activeBranch?.id || branchParam || undefined;
        const res = await api.post<any>('/inventory/demo-context', {
          workspaceId: activeOrgId,
          branchId: targetBranchId,
          userId: user?.id || undefined,
        }).catch(() => null);
        if (isMounted && res) {
          setDemoContext(res);
        }
      } catch (err) {
        console.warn('Failed to load demo context, using store fallbacks:', err);
      } finally {
        if (isMounted) {
          setIsLoadingContext(false);
        }
      }
    };

    fetchContext();
    return () => {
      isMounted = false;
    };
  }, [activeOrgId, activeBranch?._id, activeBranch?.id, branchParam, user?.id]);

  // 5. Audit log: Demo Dashboard Opened
  useEffect(() => {
    if (activeOrgId) {
      api.post('/inventory/log-dashboard-opened', {
        workspaceId: activeOrgId,
        branchId: activeBranch?._id || activeBranch?.id || undefined,
        actorUserId: user?.id || undefined,
      }).catch(() => {});
    }
  }, [activeOrgId, activeBranch?._id, activeBranch?.id, user?.id]);

  const isMetricsLoading = isVerifyingOrg || isLoadingContext;

  const orgName = demoContext?.organization?.name || currentWorkspace?.name || 'Your Organization';
  const orgCurrency = demoContext?.organization?.currency || currentWorkspace?.currency || 'NGN';
  const currentBranchName = demoContext?.branch?.name || activeBranch?.name || 'Main Store';
  const currentBranchCode = demoContext?.branch?.code || activeBranch?.code || 'MAIN';
  const currentBranchAddress = demoContext?.branch?.address || activeBranch?.formattedAddress || activeBranch?.address || 'Nigeria';
  const isPrimaryBranch = Boolean(demoContext?.branch?.isPrimary ?? activeBranch?.isPrimary ?? true);
  const totalBranchesCount = demoContext?.branchesSummary?.totalCount ?? (branches.length || 1);

  return (
    <div className="min-h-screen bg-[#0a050a] text-slate-100 flex flex-col selection:bg-[#714b67] selection:text-white">
      {/* 1. TOP NAVIGATION & HIERARCHY BAR */}
      <header className="sticky top-0 z-40 bg-[#120a11]/90 backdrop-blur-md border-b border-white/10 px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Organization & Application Identification */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#714b67] to-[#4a2e43] flex items-center justify-center text-white shadow-lg shadow-[#714b67]/20 border border-[#714b67]/40">
              <InventoryIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white tracking-tight">{orgName}</span>
                <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Inventory Active
                </span>
                <span className="text-[10px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Demo Mode
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <span>Application Hierarchy:</span>
                <span className="text-slate-300 font-medium">Organization</span>
                <span>→</span>
                <span className="text-purple-300 font-medium">Inventory</span>
                <span>→</span>
                <span className="text-slate-300 font-medium">{currentBranchName}</span>
              </p>
            </div>
          </div>

          {/* Branch Switcher & Quick Navigation */}
          <div className="flex items-center gap-2 sm:gap-3">
            <BranchSwitcher />

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCreatingBranch(true)}
              className="hidden md:flex border-white/10 bg-white/5 hover:bg-white/10 text-xs text-slate-200 gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 text-[#FDB02F]" />
              <span>Add Branch</span>
            </Button>

            <Link
              to="/settings"
              className="p-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
              title="Inventory Settings"
            >
              <Settings className="w-4 h-4" />
            </Link>

            <a
              href={getCrossSubdomainUrl('home', '/dashboard')}
              className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-medium text-slate-300 transition-colors"
            >
              <span>Main Hub</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>
          </div>
        </div>
      </header>

      {/* 2. MAIN DASHBOARD CONTENT */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* DEMO NOTICE BANNER */}
        <div className="bg-gradient-to-r from-[#714b67]/20 via-[#4a2e43]/15 to-transparent border border-[#714b67]/30 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-[#714b67]/30 border border-[#714b67]/50 flex items-center justify-center text-[#FDB02F] flex-shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Demo Inventory Setup Foundation</span>
                <span className="text-[10px] font-bold bg-[#714b67]/40 text-purple-200 px-2 py-0.5 rounded border border-[#714b67]/60">
                  Preview State
                </span>
              </h2>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                This dashboard verifies that your <strong className="text-white">Organization</strong>,{' '}
                <strong className="text-white">Inventory Application</strong>, and{' '}
                <strong className="text-white">Branch Hierarchy</strong> are properly wired together. Business features
                (live sales, products, supplier purchases, reports) will be populated in the next phase.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end md:self-auto flex-shrink-0">
            <Link
              to="/settings/branches"
              className="px-3.5 py-1.5 rounded-lg bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold shadow-lg shadow-[#714b67]/20 transition-all flex items-center gap-1.5"
            >
              <Warehouse className="w-3.5 h-3.5" />
              <span>Branch Settings</span>
            </Link>
          </div>
        </div>

        {/* 3. ACTIVE HIERARCHY & SETUP COMPLETION CARDS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active Branch Overview Card */}
          <div className="bg-[#120a11] border border-white/10 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-[#FDB02F]" />
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Active Branch Context</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditingBranch(true)}
                className="h-7 px-2 text-xs text-slate-400 hover:text-white hover:bg-white/5"
              >
                <Edit2 className="w-3 h-3 mr-1" />
                Edit
              </Button>
            </div>

            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Branch Name:</span>
                <span className="text-sm font-bold text-white flex items-center gap-1.5">
                  {currentBranchName}
                  {isPrimaryBranch && (
                    <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.2 rounded font-medium">
                      Primary
                    </span>
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Branch Code:</span>
                <span className="text-xs font-mono text-slate-200 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                  {currentBranchCode}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Address:</span>
                <span className="text-xs text-slate-300 text-right max-w-[180px] truncate" title={currentBranchAddress}>
                  {currentBranchAddress}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Status:</span>
                <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                  <Check className="w-3 h-3" /> Active & Operational
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
              <span>Total Network Branches:</span>
              <span className="font-bold text-white">{totalBranchesCount} configured</span>
            </div>
          </div>

          {/* Setup Progress Checklist Card */}
          <div className="bg-[#120a11] border border-white/10 rounded-2xl p-5 shadow-xl space-y-4 lg:col-span-2 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Setup Completion Status</h3>
                </div>
                <span className="text-[10px] font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  Foundation Ready (100%)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-3 h-3" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-white">1. Organization Initialized</h4>
                    <p className="text-[11px] text-slate-400">{orgName} workspace confirmed</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-3 h-3" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-white">2. Inventory App Activated</h4>
                    <p className="text-[11px] text-slate-400">Module scoped and registered</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-3 h-3" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-white">3. Primary Branch Created</h4>
                    <p className="text-[11px] text-slate-400">{currentBranchName} set as primary store</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-3 h-3" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-white">4. Access Context Validated</h4>
                    <p className="text-[11px] text-slate-400">Branch permissions securely verified</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-white/5 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-slate-400">Want to add more locations?</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreatingBranch(true)}
                  className="h-8 border-white/10 hover:bg-white/5 text-xs text-slate-300"
                >
                  <Plus className="w-3 h-3 mr-1 text-[#FDB02F]" /> Add Another Branch
                </Button>
                <Link
                  to="/setup"
                  className="text-xs text-purple-400 hover:text-purple-300 underline font-medium"
                >
                  Re-run Setup Wizard
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* 4. DEMO METRIC CARDS (CLEARLY TAGGED AS DEMO DATA) */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Simulated Performance Overview
            </h3>
            <span className="text-[10px] text-amber-400/90 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              Demo Data Preview
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {isMetricsLoading ? (
              [1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-[#120a11] border border-white/10 rounded-2xl p-4 shadow-md space-y-3 animate-pulse">
                  <div className="w-24 h-3.5 rounded-xs bg-white/5" />
                  <div className="w-16 h-7 rounded-xs bg-white/10" />
                </div>
              ))
            ) : (
              <>
                {/* Metric 1 */}
                <div className="bg-[#120a11] border border-white/10 rounded-2xl p-4 shadow-md relative overflow-hidden">
                  <div className="absolute top-2.5 right-2.5">
                    <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider bg-white/5 px-1.5 py-0.5 rounded">
                      Demo
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 text-slate-400">
                    <Warehouse className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-medium">Configured Branches</span>
                  </div>
                  <div className="mt-2.5 flex items-baseline justify-between">
                    <span className="text-2xl font-bold text-white">{totalBranchesCount}</span>
                    <span className="text-[11px] text-emerald-400 font-medium">Ready for stock</span>
                  </div>
                </div>

                {/* Metric 2 */}
                <div className="bg-[#120a11] border border-white/10 rounded-2xl p-4 shadow-md relative overflow-hidden">
                  <div className="absolute top-2.5 right-2.5">
                    <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider bg-white/5 px-1.5 py-0.5 rounded">
                      Demo
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 text-slate-400">
                    <Package className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-medium">Catalog Capacity</span>
                  </div>
                  <div className="mt-2.5 flex items-baseline justify-between">
                    <span className="text-2xl font-bold text-white">5,000</span>
                    <span className="text-[11px] text-slate-400 font-medium">Standard Plan</span>
                  </div>
                </div>

                {/* Metric 3 */}
                <div className="bg-[#120a11] border border-white/10 rounded-2xl p-4 shadow-md relative overflow-hidden">
                  <div className="absolute top-2.5 right-2.5">
                    <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider bg-white/5 px-1.5 py-0.5 rounded">
                      Demo
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 text-slate-400">
                    <Layers className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-medium">Product Master Categories</span>
                  </div>
                  <div className="mt-2.5 flex items-baseline justify-between">
                    <span className="text-2xl font-bold text-white">
                      {demoContext?.masterData?.categoriesCount || 5}
                    </span>
                    <span className="text-[11px] text-emerald-400 font-medium">Master loaded</span>
                  </div>
                </div>

                {/* Metric 4 */}
                <div className="bg-[#120a11] border border-white/10 rounded-2xl p-4 shadow-md relative overflow-hidden">
                  <div className="absolute top-2.5 right-2.5">
                    <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider bg-white/5 px-1.5 py-0.5 rounded">
                      Demo
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 text-slate-400">
                    <Receipt className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-medium">Currency & Billing</span>
                  </div>
                  <div className="mt-2.5 flex items-baseline justify-between">
                    <span className="text-2xl font-bold text-white">{orgCurrency}</span>
                    <span className="text-[11px] text-slate-400 font-medium">Inherited</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* 5. FEATURE SHOWCASE PLACEHOLDERS (EXPLICITLY LABELED AS COMING SOON) */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Upcoming Inventory Capabilities
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Placeholder 1: Products & Stock */}
            <div className="bg-[#120a11]/60 border border-dashed border-white/15 rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      <Package className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Products & Multi-Branch Stock</h4>
                      <p className="text-xs text-slate-400">SKU tracking, reorder thresholds, barcode lookup</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                    Coming Soon
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-3 leading-relaxed">
                  Inventory features will appear here. In the next development phase, you will be able to manage
                  individual product records, create stock transfers between branches, and adjust stock quantities.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-slate-500">
                <span>Branch Scope: {currentBranchName}</span>
                <span className="text-slate-400 font-medium">In Phase 2</span>
              </div>
            </div>

            {/* Placeholder 2: POS Register & Sales */}
            <div className="bg-[#120a11]/60 border border-dashed border-white/15 rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <Receipt className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Point of Sale (POS) & Counter Register</h4>
                      <p className="text-xs text-slate-400">Cash, card, bank transfer, split payments & receipts</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    Coming Soon
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-3 leading-relaxed">
                  Inventory features will appear here. The fast retail register for cashier attendants, instant stock
                  deduction, thermal receipt printing, and offline sales sync will be connected in Phase 2.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-slate-500">
                <span>Payment Support: Cash, Card, Transfer</span>
                <span className="text-slate-400 font-medium">In Phase 2</span>
              </div>
            </div>

            {/* Placeholder 3: Supplier Purchasing */}
            <div className="bg-[#120a11]/60 border border-dashed border-white/15 rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      <Warehouse className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Purchase Orders & Goods Inward</h4>
                      <p className="text-xs text-slate-400">Supplier orders, restock receipts, debt ledgers</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                    Coming Soon
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-3 leading-relaxed">
                  Inventory features will appear here. Record goods received from distributors, auto-update branch stock
                  balances, and track supplier payables.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-slate-500">
                <span>Supplier Management</span>
                <span className="text-slate-400 font-medium">In Phase 2</span>
              </div>
            </div>

            {/* Placeholder 4: Reports & Analytics */}
            <div className="bg-[#120a11]/60 border border-dashed border-white/15 rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <FileBarChart className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Branch Financial & Stock Reports</h4>
                      <p className="text-xs text-slate-400">Sales breakdown, gross profit margins, inventory valuation</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    Coming Soon
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-3 leading-relaxed">
                  Inventory features will appear here. Branch-filtered performance metrics, daily sales audits, staff
                  activity logs, and Excel/PDF data exports.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-slate-500">
                <span>Valuation Method: FIFO / Weighted Avg</span>
                <span className="text-slate-400 font-medium">In Phase 2</span>
              </div>
            </div>
          </div>
        </div>

        {/* 6. QUICK SETTINGS & ADMINISTRATION NAVIGATION BAR */}
        <div className="bg-[#120a11] border border-white/10 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-slate-300">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">Inventory Management & Settings Hub</h4>
              <p className="text-[11px] text-slate-400">Configure branch details, staff permissions, and receipt templates.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/settings/branches"
              className="px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-xs text-slate-300 transition-colors"
            >
              Branch Settings
            </Link>
            <Link
              to="/settings"
              className="px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-xs text-slate-300 transition-colors"
            >
              Inventory Preferences
            </Link>
            <Link
              to="/settings/organization"
              className="px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-xs text-slate-300 transition-colors"
            >
              Organization Settings
            </Link>
          </div>
        </div>
      </main>

      {/* 7. MODALS: CREATE & EDIT BRANCH */}
      <BranchCreationModal
        isOpen={isCreatingBranch}
        onClose={() => setIsCreatingBranch(false)}
        onSuccess={(newBranch: any) => {
          if (activeOrgId) {
            loadBranches(activeOrgId, 'inventory');
          }
          if (newBranch) {
            setActiveBranch(newBranch);
            setSearchParams({ branchId: newBranch._id || newBranch.id });
          }
        }}
        workspaceId={activeOrgId || ''}
      />

      {activeBranch && (
        <BranchEditModal
          isOpen={isEditingBranch}
          onClose={() => setIsEditingBranch(false)}
          branch={activeBranch}
          onSuccess={() => {
            if (activeOrgId) {
              loadBranches(activeOrgId, 'inventory');
            }
          }}
        />
      )}
    </div>
  );
};

export default InventoryDashboard;
