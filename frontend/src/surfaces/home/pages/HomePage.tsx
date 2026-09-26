import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { useWorkspaceStore, UserWorkspaceEntry } from '@/stores/useWorkspaceStore';
import { useBranchStore, Branch } from '@/stores/useBranchStore';
import { Header } from '@/components/landing/Header';
import { Spinner } from '@/components/ui/spinner';
import { UpgradeModal } from '@/components/billing/UpgradeModal';
import { PendingInvitesBanner } from '@/components/notifications/PendingInvitesBanner';
import {
  Building2,
  Boxes,
  Warehouse,
  ArrowRight,
  Plus,
  Sparkles,
  ChevronDown,
  Check,
  ExternalLink,
  ShieldAlert,
  Layers,
  Store,
  Kanban,
  CreditCard,
  Calendar,
  Dumbbell,
} from 'lucide-react';
import { getCrossSubdomainUrl, ApplicationKey } from '@/lib/domain';
import { cn } from '@/lib/utils';
import { handleApiError } from '@/lib/error-handler';

interface ApplicationOption {
  key: ApplicationKey;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  isReady: boolean;
}

const AVAILABLE_APPLICATIONS: ApplicationOption[] = [
  {
    key: 'inventory',
    name: 'Inventory',
    description: 'Multi-branch inventory, stock tracking & point of sale',
    icon: Boxes,
    isReady: true,
  },
  {
    key: 'pos',
    name: 'Point of Sale',
    description: 'Fast counter sales, cash registers & instant receipts',
    icon: Store,
    isReady: true,
  },
  {
    key: 'taskmanagement',
    name: 'Task Management',
    description: 'Team tasks, milestones, assignments & workflows',
    icon: Kanban,
    isReady: true,
  },
  {
    key: 'billing',
    name: 'Billing & Subscriptions',
    description: 'Invoicing, recurring payments & plan management',
    icon: CreditCard,
    isReady: true,
  },
  {
    key: 'booking',
    name: 'Booking & Appointments',
    description: 'Customer reservations, schedules & calendar bookings',
    icon: Calendar,
    isReady: false,
  },
  {
    key: 'gym',
    name: 'Gym Management',
    description: 'Member check-ins, class schedules & fitness plans',
    icon: Dumbbell,
    isReady: false,
  },
];

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthStore();
  const {
    workspaces,
    currentWorkspace,
    fetchWorkspaces,
    selectWorkspace,
    isLoading: isLoadingWorkspaces,
    isSwitching,
  } = useWorkspaceStore();
  const { branches, loadBranches, isLoading: isLoadingBranches, setActiveBranch } = useBranchStore();

  const [isInitialized, setIsInitialized] = useState(workspaces.length > 0);
  const [selectedAppKey, setSelectedAppKey] = useState<ApplicationKey>('inventory');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [appDropdownOpen, setAppDropdownOpen] = useState(false);
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const [upgradeModalWs, setUpgradeModalWs] = useState<{
    id: string;
    name: string;
    planKey: string;
    slug?: string;
  } | null>(null);

  // 1. Initial Landing State: Fetch accessible organizations on mount
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetchWorkspaces(undefined, undefined, true, { signal: controller.signal })
        .catch((err) => {
          if (err?.name !== 'AbortError') {
            handleApiError(err, 'fetch organizations', { showError: false });
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsInitialized(true);
          }
        });
    }, 0);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [fetchWorkspaces]);

  // Sync selected organization from query or store
  const activeOrg = useMemo(() => {
    const queryOrgId = searchParams.get('org');
    if (queryOrgId) {
      const match = workspaces.find(
        (entry) =>
          entry.workspace?.id === queryOrgId ||
          entry.workspaceId === queryOrgId ||
          entry.workspace?.slug === queryOrgId
      );
      if (match) return match.workspace;
    }
    return currentWorkspace || (workspaces.length > 0 ? workspaces[0].workspace : null);
  }, [searchParams, workspaces, currentWorkspace]);

  // Step 2 (Branch Loading): Load branches whenever organization or selected app changes
  useEffect(() => {
    if (!activeOrg?.id) return;

    let isMounted = true;
    loadBranches(activeOrg.id, selectedAppKey)
      .then((loadedList) => {
        if (!isMounted) return;
        if (loadedList && loadedList.length > 0) {
          // Auto-select primary branch or first branch if none currently selected or not found
          const currentValid = loadedList.find(
            (b) => (b.id || b._id) === selectedBranchId
          );
          if (!currentValid) {
            const primary = loadedList.find((b) => b.isPrimary) || loadedList[0];
            const primaryId = String(primary?.id || primary?._id || '');
            setSelectedBranchId(primaryId);
            setActiveBranch(primary);
          }
        } else {
          setSelectedBranchId('');
        }
      })
      .catch(() => {
        if (isMounted) setSelectedBranchId('');
      });

    return () => {
      isMounted = false;
    };
  }, [activeOrg?.id, selectedAppKey, loadBranches, setActiveBranch]);

  // Handle Organization Selection
  const handleSelectOrganization = async (orgId: string) => {
    try {
      setOrgDropdownOpen(false);
      localStorage.setItem('orvio_active_workspace_id', orgId);
      setSearchParams({ org: orgId });
      await selectWorkspace(orgId);
    } catch {
      // Retain visual state even if background persistence fails
    }
  };

  // Step 3 (Final Navigation): Navigate directly to the selected application dashboard
  const handleNavigateToApp = (overrideBranchId?: string) => {
    if (!activeOrg?.id) return;
    const targetBranchId = overrideBranchId || selectedBranchId;
    const params = new URLSearchParams({ org: activeOrg.id });
    if (targetBranchId) {
      params.set('branch', targetBranchId);
    }

    if (selectedAppKey === 'inventory' || selectedAppKey === 'pos') {
      const path = selectedAppKey === 'pos' ? '/pos' : '/dashboard';
      window.location.href = `${getCrossSubdomainUrl('inventory', path)}?${params.toString()}`;
    } else if (selectedAppKey === 'taskmanagement') {
      window.location.href = `${getCrossSubdomainUrl('taskmanagement', '/dashboard')}?${params.toString()}`;
    } else if (selectedAppKey === 'billing') {
      window.location.href = `${getCrossSubdomainUrl('billing', '/dashboard')}?${params.toString()}`;
    } else {
      window.location.href = `${getCrossSubdomainUrl(selectedAppKey, '/dashboard')}?${params.toString()}`;
    }
  };

  const selectedApp = useMemo(
    () => AVAILABLE_APPLICATIONS.find((app) => app.key === selectedAppKey) || AVAILABLE_APPLICATIONS[0],
    [selectedAppKey]
  );

  const selectedBranch = useMemo(
    () => branches.find((b) => (b.id || b._id) === selectedBranchId) || null,
    [branches, selectedBranchId]
  );

  const launcherNewOrgUrl = '/onboard/organization';

  // Loading Screen
  if (!isInitialized && workspaces.length === 0 && (isLoadingWorkspaces || isSwitching)) {
    return (
      <div className="min-h-screen bg-black text-slate-100 flex flex-col">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center space-y-4">
          <Spinner size="lg" className="text-[#714b67]" />
          <p className="text-xs text-slate-400">Loading your organizations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-slate-100 flex flex-col selection:bg-[#714b67] selection:text-white">
      <Header />

      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-12 space-y-12 animate-in fade-in duration-300">
        {/* Real-time In-Dashboard Pending Invitations */}
        <PendingInvitesBanner />

        {/* Header Title & Minimalist Context */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#FDB02F] uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Workspace Dashboard</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Welcome{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
            </h1>
            {workspaces.length > 0 && (
              <a
                href={launcherNewOrgUrl}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xs text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-[#FDB02F]" />
                <span>New Organization</span>
              </a>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
            {workspaces.length === 0
              ? 'Your account is active. Connect with or create an organization to start managing applications and branches.'
              : 'Select your organization, choose an application, and pick a branch to launch your workspace.'}
          </p>
        </div>

        {/* 1. Empty State (Zero Organizations) */}
        {workspaces.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center space-y-6">
            <div className="w-16 h-16 rounded-xs flex items-center justify-center text-[#FDB02F]">
              <ShieldAlert className="w-10 h-10 stroke-[1.5]" />
            </div>

            <div className="space-y-2 max-w-md">
              <h2 className="text-xl font-bold text-white tracking-tight">
                No Organization Access Found
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                You do not have access to an organization yet. You can create a new organization for your business or ask an administrator to send an invitation to your email.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <a
                href={launcherNewOrgUrl}
                className="h-10 px-6 rounded-xs bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-lg shadow-[#714b67]/20"
              >
                <Plus className="w-4 h-4" />
                <span>Create Organization</span>
              </a>
            </div>
          </div>
        ) : (
          /* 2. Hierarchical Drill-down Navigation Flow */
          <div className="space-y-12">
            {/* Step 0: Organization Selector */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400">
                  1. Organization
                </span>
                {activeOrg && (
                  <span className="text-xs text-[#FDB02F] font-medium">
                    {activeOrg.planName || activeOrg.planKey || 'Active Plan'}
                  </span>
                )}
              </div>

              {/* Organization Dropdown / Switcher */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setOrgDropdownOpen(!orgDropdownOpen);
                    setAppDropdownOpen(false);
                    setBranchDropdownOpen(false);
                  }}
                  className="w-full h-12 px-4 rounded-xs text-left flex items-center justify-between text-slate-100 hover:text-white transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Building2 className="w-5 h-5 text-[#FDB02F] shrink-0" />
                    <div className="min-w-0">
                      <span className="block text-sm font-semibold text-white truncate">
                        {activeOrg?.name || 'Select an organization'}
                      </span>
                      <span className="block text-[11px] text-slate-400 truncate">
                        {[activeOrg?.city, activeOrg?.state, activeOrg?.country].filter(Boolean).join(', ') ||
                          'Organization Workspace'}
                      </span>
                    </div>
                  </div>
                  <ChevronDown
                    className={cn(
                      'w-4 h-4 text-slate-400 transition-transform duration-200',
                      orgDropdownOpen && 'rotate-180 text-white'
                    )}
                  />
                </button>

                {orgDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1 w-full z-20 py-2 rounded-xs shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-1 duration-150 max-h-64 overflow-y-auto">
                    {workspaces.map(({ workspace }: UserWorkspaceEntry) => {
                      const isSelected = activeOrg?.id === workspace.id;
                      return (
                        <button
                          key={workspace.id}
                          type="button"
                          onClick={() => handleSelectOrganization(workspace.id)}
                          className={cn(
                            'w-full px-4 py-3 text-left flex items-center justify-between text-slate-200 hover:text-white hover:bg-white/5 transition-colors cursor-pointer rounded-xs',
                            isSelected && 'text-white'
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-xs flex items-center justify-center font-bold text-xs shrink-0 text-[#FDB02F]">
                              {workspace.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-white truncate">
                                {workspace.name}
                              </p>
                              <p className="text-[10px] text-slate-400 truncate">
                                {workspace.status || 'Active'} • {workspace.planName || workspace.planKey || 'Standard'}
                              </p>
                            </div>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-[#FDB02F] shrink-0" />}
                        </button>
                      );
                    })}

                    <a
                      href={launcherNewOrgUrl}
                      className="w-full px-4 py-3 text-left flex items-center gap-3 text-slate-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer rounded-xs text-xs font-medium"
                    >
                      <Plus className="w-4 h-4 text-[#FDB02F]" />
                      <span>Create Another Organization</span>
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Hierarchical Grid: Step 1 (Application) & Step 2 (Branch) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Step 1: Application Selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400">
                    2. Application
                  </span>
                  <span className="text-xs text-slate-500">Default: Inventory</span>
                </div>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setAppDropdownOpen(!appDropdownOpen);
                      setOrgDropdownOpen(false);
                      setBranchDropdownOpen(false);
                    }}
                    className="w-full h-12 px-4 rounded-xs text-left flex items-center justify-between text-slate-100 hover:text-white transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {React.createElement(selectedApp.icon, {
                        className: 'w-5 h-5 text-[#FDB02F] shrink-0',
                      })}
                      <div className="min-w-0">
                        <span className="block text-sm font-semibold text-white truncate">
                          {selectedApp.name}
                        </span>
                        <span className="block text-[11px] text-slate-400 truncate">
                          {selectedApp.description}
                        </span>
                      </div>
                    </div>
                    <ChevronDown
                      className={cn(
                        'w-4 h-4 text-slate-400 transition-transform duration-200',
                        appDropdownOpen && 'rotate-180 text-white'
                      )}
                    />
                  </button>

                  {appDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1 w-full z-20 py-2 rounded-xs shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-1 duration-150 max-h-72 overflow-y-auto">
                      {AVAILABLE_APPLICATIONS.map((app) => {
                        const isSelected = selectedAppKey === app.key;
                        const IconComponent = app.icon;
                        return (
                          <button
                            key={app.key}
                            type="button"
                            onClick={() => {
                              setSelectedAppKey(app.key);
                              setAppDropdownOpen(false);
                            }}
                            className={cn(
                              'w-full px-4 py-3 text-left flex items-center justify-between text-slate-200 hover:text-white hover:bg-white/5 transition-colors cursor-pointer rounded-xs',
                              isSelected && 'text-white'
                            )}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <IconComponent className="w-4 h-4 text-[#FDB02F] shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-white truncate">
                                  {app.name}
                                </p>
                                <p className="text-[10px] text-slate-400 truncate">
                                  {app.description}
                                </p>
                              </div>
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-[#FDB02F] shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Step 2: Branch Selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400">
                    3. Operational Branch
                  </span>
                  <span className="text-xs text-slate-500">
                    {isLoadingBranches
                      ? 'Loading branches...'
                      : `${branches.length} branch${branches.length === 1 ? '' : 'es'}`}
                  </span>
                </div>

                <div className="relative">
                  <button
                    type="button"
                    disabled={isLoadingBranches || branches.length === 0}
                    onClick={() => {
                      setBranchDropdownOpen(!branchDropdownOpen);
                      setOrgDropdownOpen(false);
                      setAppDropdownOpen(false);
                    }}
                    className={cn(
                      'w-full h-12 px-4 rounded-xs text-left flex items-center justify-between text-slate-100 hover:text-white transition-colors cursor-pointer',
                      (isLoadingBranches || branches.length === 0) && 'opacity-60 cursor-not-allowed'
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Warehouse className="w-5 h-5 text-[#FDB02F] shrink-0" />
                      <div className="min-w-0">
                        {isLoadingBranches ? (
                          <span className="block text-sm text-slate-400">Loading branch list...</span>
                        ) : selectedBranch ? (
                          <>
                            <span className="block text-sm font-semibold text-white truncate">
                              {selectedBranch.name} {selectedBranch.isPrimary && '(Main)'}
                            </span>
                            <span className="block text-[11px] text-slate-400 truncate">
                              {[selectedBranch.city, selectedBranch.state].filter(Boolean).join(', ') ||
                                selectedBranch.code ||
                                'Branch Location'}
                            </span>
                          </>
                        ) : branches.length === 0 ? (
                          <span className="block text-sm text-slate-400">No branches configured</span>
                        ) : (
                          <span className="block text-sm text-slate-400">Select a branch</span>
                        )}
                      </div>
                    </div>
                    <ChevronDown
                      className={cn(
                        'w-4 h-4 text-slate-400 transition-transform duration-200',
                        branchDropdownOpen && 'rotate-180 text-white'
                      )}
                    />
                  </button>

                  {branchDropdownOpen && branches.length > 0 && (
                    <div className="absolute top-full left-0 mt-1 w-full z-20 py-2 rounded-xs shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-1 duration-150 max-h-64 overflow-y-auto">
                      {branches.map((branch: Branch) => {
                        const bId = String(branch.id || branch._id || '');
                        const isSelected = selectedBranchId === bId;
                        return (
                          <button
                            key={bId}
                            type="button"
                            onClick={() => {
                              setSelectedBranchId(bId);
                              setActiveBranch(branch);
                              setBranchDropdownOpen(false);
                            }}
                            className={cn(
                              'w-full px-4 py-3 text-left flex items-center justify-between text-slate-200 hover:text-white hover:bg-white/5 transition-colors cursor-pointer rounded-xs',
                              isSelected && 'text-white'
                            )}
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-white truncate flex items-center gap-1.5">
                                {branch.name}
                                {branch.isPrimary && (
                                  <span className="text-[10px] text-[#FDB02F] font-bold uppercase">
                                    Main
                                  </span>
                                )}
                              </p>
                              <p className="text-[10px] text-slate-400 truncate">
                                {[branch.city, branch.state, branch.country].filter(Boolean).join(', ') ||
                                  branch.code ||
                                  'Active branch'}
                              </p>
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-[#FDB02F] shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Step 3: Final Navigation & Action Trigger */}
            <div className="pt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-300">
                  Ready to launch <span className="text-white font-semibold">{selectedApp.name}</span> for{' '}
                  <span className="text-white font-semibold">{activeOrg?.name}</span>
                </p>
                <p className="text-[11px] text-slate-500">
                  {selectedBranch
                    ? `Branch: ${selectedBranch.name}`
                    : 'Default organizational routing active'}
                </p>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => handleNavigateToApp()}
                  className="w-full sm:w-auto h-11 px-6 rounded-xs bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-lg shadow-[#714b67]/20"
                >
                  <span>Open {selectedApp.name} Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Branch Direct Access List */}
            {branches.length > 0 && (
              <div className="space-y-4 pt-6">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400">
                    Direct Branch Launch
                  </span>
                  <button
                    type="button"
                    onClick={() => navigate('/settings/branches')}
                    className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Manage Branches
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {branches.map((branch: Branch) => {
                    const bId = String(branch.id || branch._id || '');
                    return (
                      <button
                        key={bId}
                        type="button"
                        onClick={() => {
                          setSelectedBranchId(bId);
                          setActiveBranch(branch);
                          handleNavigateToApp(bId);
                        }}
                        className="p-3 text-left flex items-center justify-between gap-3 text-slate-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer rounded-xs group"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white group-hover:text-[#f3e1ed] truncate flex items-center gap-1.5">
                            {branch.name}
                            {branch.isPrimary && (
                              <span className="text-[9px] text-[#FDB02F] font-bold uppercase">
                                Primary
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {[branch.city, branch.state].filter(Boolean).join(', ') || 'Branch'}
                          </p>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white shrink-0 transition-transform group-hover:translate-x-0.5" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Upgrade Modal */}
      {upgradeModalWs && (
        <UpgradeModal
          isOpen={!!upgradeModalWs}
          workspaceId={upgradeModalWs.id}
          workspaceSlug={upgradeModalWs.slug}
          currentPlanKey={upgradeModalWs.planKey}
          onClose={() => setUpgradeModalWs(null)}
          onSuccess={() => {
            setUpgradeModalWs(null);
            fetchWorkspaces();
          }}
        />
      )}
    </div>
  );
};
