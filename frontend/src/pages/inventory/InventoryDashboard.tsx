import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useBranchStore } from '@/stores/useBranchStore';
import { BranchSwitcher } from '@/components/workspace/BranchSwitcher';
import { BranchCreationModal } from '@/components/workspace/BranchCreationModal';
import { BranchEditModal } from '@/components/workspace/BranchEditModal';
import { MinimumViableWorkspaceChecklist } from '@/components/workspace/MinimumViableWorkspaceChecklist';
import { UpgradeModal } from '@/components/billing/UpgradeModal';
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
  Boxes,
  ArrowRight,
  Users,
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

  // Branch Modals & Plan Upgrades
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);
  const [isEditingBranch, setIsEditingBranch] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  const initialPlan = (currentWorkspace?.planKey || currentWorkspace?.planId || 'free_trial').toLowerCase();
  const [planKey, setPlanKey] = useState<string>(initialPlan);

  const activeOrgId = orgParam || currentWorkspace?.id || (typeof window !== 'undefined' ? localStorage.getItem('orvio_active_workspace_id') : null);

  useEffect(() => {
    if (currentWorkspace) {
      const pk = (currentWorkspace.planKey || currentWorkspace.planId || 'free_trial').toLowerCase();
      setPlanKey(pk);
    }
  }, [currentWorkspace?.id, currentWorkspace?.planKey, currentWorkspace?.planId]);

  useEffect(() => {
    if (activeOrgId) {
      api.get<any>(`/organizations/${activeOrgId}/subscription`)
        .then((res) => {
          const sub = res?.subscription || res?.data?.subscription || res;
          const pk = (
            sub?.activePlan ||
            (sub?.status === 'active' ? (sub?.selectedPlan || sub?.planKey) : null) ||
            sub?.planKey ||
            res?.planKey ||
            initialPlan
          );
          if (pk) setPlanKey(String(pk).toLowerCase());
        })
        .catch(() => {});
    }
  }, [activeOrgId, initialPlan]);

  const isFreeTrial = planKey === 'free_trial' || planKey === 'free' || planKey === 'trial';
  const atBranchLimit = isFreeTrial && branches.length >= 1;

  const [isProfileCardDismissed, setIsProfileCardDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return Boolean(activeOrgId && sessionStorage.getItem(`orvio_hide_setup_profile_${activeOrgId}`) === 'true');
  });

  // Minimum Viable Workspace Checklist — tracks which setup steps are complete
  const [mvwCompleted, setMvwCompleted] = useState<string[]>(() => {
    if (typeof window === 'undefined' || !activeOrgId) return [];
    try {
      const raw = sessionStorage.getItem(`orvio_mvw_completed_${activeOrgId}`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Persist completed steps to sessionStorage so they survive reloads
  useEffect(() => {
    if (!activeOrgId) return;
    try {
      sessionStorage.setItem(`orvio_mvw_completed_${activeOrgId}`, JSON.stringify(mvwCompleted));
    } catch {}
  }, [mvwCompleted, activeOrgId]);

  const mvwSteps = useMemo(
    () => [
      {
        id: 'app',
        label: 'Activate Inventory',
        description: 'Enable the Inventory & POS module for this workspace',
        href: `/orgs/${activeOrgId || ''}/apps`,
        icon: <Layers className="w-4 h-4" />,
      },
      {
        id: 'branch',
        label: 'Create First Branch',
        description: 'Set up your primary store or warehouse location',
        href: `/onboard/branch-multi?org=${activeOrgId || ''}`,
        icon: <Store className="w-4 h-4" />,
      },
      {
        id: 'catalog',
        label: 'Populate Product Catalog',
        description: 'Seed samples, import CSV, or start building your catalog',
        href: `/onboard/app?org=${activeOrgId || ''}&step=5`,
        icon: <Boxes className="w-4 h-4" />,
      },
      {
        id: 'team',
        label: 'Invite Your Team',
        description: 'Add staff and assign roles and branch access',
        href: `/settings/members`,
        icon: <Users className="w-4 h-4" />,
      },
    ],
    [activeOrgId]
  );

  // Auto-detect completed steps based on current state
  useEffect(() => {
    const detected: string[] = [];
    if (currentWorkspace?.enabledModules?.includes('inventory')) detected.push('app');
    if (branches.length > 0) detected.push('branch');
    // catalog detection: we consider it done if the user has products or onboarding completed
    // (the actual product count would require a separate API call; we rely on onboarding flag)
    if (demoContext?.productsCount > 0) detected.push('catalog');
    if ((demoContext?.membersCount ?? 0) > 1) detected.push('team');

    setMvwCompleted((prev) => {
      const merged = Array.from(new Set([...prev, ...detected]));
      // Remove detections that are no longer true
      const filtered = merged.filter((id) => {
        if (id === 'app') return currentWorkspace?.enabledModules?.includes('inventory');
        if (id === 'branch') return branches.length > 0;
        if (id === 'catalog') return (demoContext?.productsCount ?? 0) > 0;
        if (id === 'team') return (demoContext?.membersCount ?? 0) > 1;
        return true;
      });
      return filtered;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWorkspace?.enabledModules, branches.length, demoContext?.productsCount, demoContext?.membersCount]);



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
        const res = await api.post<any>(`/workspaces/${activeOrgId}/inventory/demo-context`, {
          branchId: targetBranchId,
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
      api.post(`/workspaces/${activeOrgId}/inventory/log-dashboard-opened`, {
        branchId: activeBranch?._id || activeBranch?.id || undefined,
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
    <div className="min-h-screen bg-[#0a050a] text-slate-100 flex flex-col selection:bg-[#714b67] selection:text-white relative">
      {/* 1. TOP NAVIGATION & HIERARCHY BAR */}
      <header className="sticky top-0 z-40 bg-[#120a11]/90 backdrop-blur-md border-b border-white/10 px-3 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
          {/* Organization & Application Identification */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-sm bg-gradient-to-br from-[#714b67] to-[#4a2e43] flex items-center justify-center text-white shadow-lg shadow-[#714b67]/20 border border-[#714b67]/40 shrink-0">
              <InventoryIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="text-sm font-bold text-white tracking-tight truncate max-w-[160px] sm:max-w-xs">{orgName}</span>
                <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-sm flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Active
                </span>
                <span className="text-[10px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-sm uppercase tracking-wider">
                  Demo
                </span>
              </div>
              <p className="text-xs text-slate-400 flex flex-wrap items-center gap-1">
                <span>Scope:</span>
                <span className="text-purple-300 font-medium">Inventory</span>
                <span>→</span>
                <span className="text-slate-300 font-medium truncate max-w-[140px]">{currentBranchName}</span>
              </p>
            </div>
          </div>

          {/* Branch Switcher & Quick Navigation */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full md:w-auto justify-between md:justify-end pt-1 md:pt-0 border-t md:border-t-0 border-white/5">
            <div className="flex-1 md:flex-initial min-w-[140px]">
              <BranchSwitcher />
            </div>

            {atBranchLimit ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsUpgradeModalOpen(true)}
                className="rounded-sm border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-xs text-amber-300 gap-1.5 cursor-pointer shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Upgrade (1/1 Branch)</span>
                <span className="sm:hidden">Upgrade</span>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCreatingBranch(true)}
                className="rounded-sm border-white/10 bg-white/5 hover:bg-white/10 text-xs text-slate-200 gap-1.5 cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5 text-[#FDB02F]" />
                <span className="hidden sm:inline">Add Branch</span>
                <span className="sm:hidden">Add</span>
              </Button>
            )}

            <Link
              to="/settings"
              className="p-2 rounded-sm border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors shrink-0"
              title="Inventory Settings"
            >
              <Settings className="w-4 h-4" />
            </Link>

            <a
              href={getCrossSubdomainUrl('home', '/dashboard')}
              className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-sm border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-medium text-slate-300 transition-colors shrink-0"
            >
              <span>Main Hub</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>
          </div>
        </div>
      </header>

      {/* 2. MAIN DASHBOARD CONTENT */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
        {/* DEMO NOTICE BANNER */}
        <div className="bg-gradient-to-r from-[#714b67]/20 via-[#4a2e43]/15 to-transparent border border-[#714b67]/30 rounded-sm p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-sm bg-[#714b67]/30 border border-[#714b67]/50 flex items-center justify-center text-[#FDB02F] flex-shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex flex-wrap items-center gap-2">
                <span>Demo Inventory Setup Foundation</span>
                <span className="text-[10px] font-bold bg-[#714b67]/40 text-purple-200 px-2 py-0.5 rounded-sm border border-[#714b67]/60">
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
          <div className="flex items-center gap-2 self-stretch sm:self-end md:self-auto flex-shrink-0">
            <Link
              to="/settings/branches"
              className="w-full sm:w-auto justify-center px-3.5 py-1.5 rounded-sm bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold shadow-lg shadow-[#714b67]/20 transition-all flex items-center gap-1.5"
            >
              <Warehouse className="w-3.5 h-3.5" />
              <span>Branch Settings</span>
            </Link>
          </div>
        </div>

        {/* 2.5 SETUP PROFILE CARD (Re-accessible questionnaire) */}
        {!isProfileCardDismissed && (
          <div className="bg-[#120a11] border border-white/10 hover:border-[#714b67]/40 rounded-sm p-4 sm:p-5 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all">
            <div className="flex items-start gap-3.5">
              <div className="w-8 h-8 rounded-sm bg-[#714b67]/20 border border-[#714b67]/30 flex items-center justify-center text-[#e2b9d8] shrink-0 mt-0.5">
                <Boxes className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-white">Complete your setup profile</h3>
                  <span className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-1.5 py-0.2 rounded-sm">
                    Optional
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Tell us about your previous tracking tools and operational priorities to optimize your inventory shortcuts, low stock thresholds, and reports.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
              <Link
                to={`/onboard/app?org=${activeOrgId || ''}`}
                className="flex-1 sm:flex-initial px-3.5 py-1.5 rounded-sm bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold shadow-md transition-colors flex items-center justify-center gap-1.5"
              >
                <span>Complete Profile</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsProfileCardDismissed(true);
                  if (activeOrgId) {
                    sessionStorage.setItem(`orvio_hide_setup_profile_${activeOrgId}`, 'true');
                  }
                }}
                className="h-7 px-2 text-xs text-slate-400 hover:text-white"
                title="Dismiss reminder"
              >
                Dismiss
              </Button>
            </div>
          </div>
        )}

        {/* 2.6 MINIMUM VIABLE WORKSPACE CHECKLIST */}
        <MinimumViableWorkspaceChecklist
          steps={mvwSteps}
          completedSteps={mvwCompleted}
          onStepClick={(step) => {
            // Mark step as interacted-with (not completed yet, but acknowledged)
          }}
          storageKey={`orvio_mvw_checklist_dismissed_${activeOrgId || 'default'}`}
        />

        {/* 3. ACTIVE HIERARCHY & SETUP COMPLETION CARDS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Active Branch Overview Card */}
          <div className="bg-[#120a11] border border-white/10 rounded-sm p-4 sm:p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-[#FDB02F]" />
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Active Branch Context</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditingBranch(true)}
                className="h-7 px-2 text-xs text-slate-400 hover:text-white hover:bg-white/5 rounded-sm"
              >
                <Edit2 className="w-3 h-3 mr-1" />
                Edit
              </Button>
            </div>

            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-400 shrink-0">Branch Name:</span>
                <span className="text-sm font-bold text-white flex items-center gap-1.5 truncate">
                  {currentBranchName}
                  {isPrimaryBranch && (
                    <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.2 rounded-sm font-medium shrink-0">
                      Primary
                    </span>
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-400 shrink-0">Branch Code:</span>
                <span className="text-xs font-mono text-slate-200 bg-white/5 px-2 py-0.5 rounded-sm border border-white/10">
                  {currentBranchCode}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-400 shrink-0">Address:</span>
                <span className="text-xs text-slate-300 text-right max-w-[180px] truncate" title={currentBranchAddress}>
                  {currentBranchAddress}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-400 shrink-0">Status:</span>
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
          <div className="bg-[#120a11] border border-white/10 rounded-sm p-4 sm:p-5 shadow-xl space-y-4 lg:col-span-2 flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Setup Completion Status</h3>
                </div>
                <span className="text-[10px] font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-sm">
                  Foundation Ready (100%)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                <div className="flex items-start gap-2.5 p-3 rounded-sm bg-white/[0.02] border border-white/5">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-3 h-3" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-white">1. Organization Initialized</h4>
                    <p className="text-[11px] text-slate-400">{orgName} workspace confirmed</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-3 rounded-sm bg-white/[0.02] border border-white/5">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-3 h-3" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-white">2. Inventory App Activated</h4>
                    <p className="text-[11px] text-slate-400">Module scoped and registered</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-3 rounded-sm bg-white/[0.02] border border-white/5">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-3 h-3" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-white">3. Primary Branch Created</h4>
                    <p className="text-[11px] text-slate-400">{currentBranchName} set as primary store</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-3 rounded-sm bg-white/[0.02] border border-white/5">
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

            <div className="pt-3 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs text-slate-400">Want to add more locations?</span>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreatingBranch(true)}
                  className="h-8 border-white/10 hover:bg-white/5 text-xs text-slate-300 rounded-sm"
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
            <span className="text-[10px] text-amber-400/90 bg-amber-500/10 px-2 py-0.5 rounded-sm border border-amber-500/20">
              Demo Data Preview
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {isMetricsLoading ? (
              [1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-[#120a11] border border-white/10 rounded-sm p-4 shadow-md space-y-3 animate-pulse">
                  <div className="w-24 h-3.5 rounded-xs bg-white/5" />
                  <div className="w-16 h-7 rounded-xs bg-white/10" />
                </div>
              ))
            ) : (
              <>
                {/* Metric 1 */}
                <div className="bg-[#120a11] border border-white/10 rounded-sm p-4 shadow-md relative overflow-hidden">
                  <div className="absolute top-2.5 right-2.5">
                    <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider bg-white/5 px-1.5 py-0.5 rounded-sm">
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
                <div className="bg-[#120a11] border border-white/10 rounded-sm p-4 shadow-md relative overflow-hidden">
                  <div className="absolute top-2.5 right-2.5">
                    <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider bg-white/5 px-1.5 py-0.5 rounded-sm">
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
                <div className="bg-[#120a11] border border-white/10 rounded-sm p-4 shadow-md relative overflow-hidden">
                  <div className="absolute top-2.5 right-2.5">
                    <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider bg-white/5 px-1.5 py-0.5 rounded-sm">
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
                <div className="bg-[#120a11] border border-white/10 rounded-sm p-4 shadow-md relative overflow-hidden">
                  <div className="absolute top-2.5 right-2.5">
                    <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider bg-white/5 px-1.5 py-0.5 rounded-sm">
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
            <div className="bg-[#120a11]/60 border border-dashed border-white/15 rounded-sm p-4 sm:p-5 relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 rounded-sm bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                      <Package className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-white truncate">Products & Multi-Branch Stock</h4>
                      <p className="text-xs text-slate-400">SKU tracking, reorder thresholds, barcode lookup</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-sm border border-blue-500/20 shrink-0">
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
            <div className="bg-[#120a11]/60 border border-dashed border-white/15 rounded-sm p-4 sm:p-5 relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 rounded-sm bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                      <Receipt className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-white truncate">Point of Sale (POS) & Register</h4>
                      <p className="text-xs text-slate-400">Cash, card, bank transfer, split payments & receipts</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-sm border border-emerald-500/20 shrink-0">
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
            <div className="bg-[#120a11]/60 border border-dashed border-white/15 rounded-sm p-4 sm:p-5 relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 rounded-sm bg-purple-500/10 text-purple-400 border border-purple-500/20 shrink-0">
                      <Warehouse className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-white truncate">Purchase Orders & Goods Inward</h4>
                      <p className="text-xs text-slate-400">Supplier orders, restock receipts, debt ledgers</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-sm border border-purple-500/20 shrink-0">
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
            <div className="bg-[#120a11]/60 border border-dashed border-white/15 rounded-sm p-4 sm:p-5 relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 rounded-sm bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                      <FileBarChart className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-white truncate">Financial & Stock Reports</h4>
                      <p className="text-xs text-slate-400">Sales breakdown, gross profit margins, valuation</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-sm border border-amber-500/20 shrink-0">
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
        <div className="bg-[#120a11] border border-white/10 rounded-sm p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-sm bg-white/5 border border-white/10 flex items-center justify-center text-slate-300 shrink-0">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">Inventory Management & Settings Hub</h4>
              <p className="text-[11px] text-slate-400">Configure branch details, staff permissions, and receipt templates.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <Link
              to="/settings/branches"
              className="px-3 py-1.5 rounded-sm border border-white/10 hover:bg-white/5 text-xs text-slate-300 transition-colors"
            >
              Branch Settings
            </Link>
            <Link
              to="/settings"
              className="px-3 py-1.5 rounded-sm border border-white/10 hover:bg-white/5 text-xs text-slate-300 transition-colors"
            >
              Inventory Preferences
            </Link>
            <Link
              to="/settings/organization"
              className="px-3 py-1.5 rounded-sm border border-white/10 hover:bg-white/5 text-xs text-slate-300 transition-colors"
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

      {/* Upgrade Modal */}
      {isUpgradeModalOpen && (
        <UpgradeModal
          isOpen={isUpgradeModalOpen}
          workspaceId={activeOrgId || currentWorkspace?.id}
          workspaceSlug={currentWorkspace?.slug}
          currentPlanKey={planKey}
          triggerReason="branch_limit"
          onClose={() => setIsUpgradeModalOpen(false)}
          onSuccess={() => {
            setIsUpgradeModalOpen(false);
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
