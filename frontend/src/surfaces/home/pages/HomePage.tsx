import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useBranchStore, type Branch } from '@/stores/useBranchStore';
import { getCrossSubdomainUrl } from '@/lib/domain';
import { Header } from '@/components/landing/Header';
import { BranchCreationModal } from '@/components/workspace/BranchCreationModal';
import { BranchEditModal } from '@/components/workspace/BranchEditModal';
import { ConfirmationModal } from '@/components/settings/ConfirmationModal';
import { UpgradeModal } from '@/components/billing/UpgradeModal';
import { PendingInvitesBanner } from '@/components/notifications/PendingInvitesBanner';
import { AppActivationPrompt } from '@/components/workspace/AppActivationPrompt';
import { useOrganizationEligibility } from '@/hooks/useOrganizationEligibility';
import { OrganizationQuotaIndicator } from '@/components/organization/OrganizationQuotaIndicator';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import {
  Building2,
  Layers,
  ArrowRight,
  Plus,
  Edit2,
  Trash2,
  Star,
  ChevronRight,
  Settings,
  Store,
  Boxes,
  Calendar,
  Dumbbell,
  CheckSquare,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getVisibleAppKeys,
  getAppMeta,
  assertRegistryConsistency,
} from '@/lib/appRegistry';
import {
  applications,
  type ApplicationKey,
} from '@orviohub/shared';

interface PlatformAppItem {
  _id?: string;
  id?: string;
  key: string;
  name: string;
  status: 'active' | 'coming_soon' | 'maintenance' | 'deprecated';
  isCore: boolean;
  planRequirements: string[];
  subdomain: string;
  description?: string;
  badge?: string;
  icon?: string;
  displayOrder?: number;
  isActivated?: boolean;
  activationStatus?: string;
}

/**
 * Bootstrap fallback for the platform app catalog.
 *
 * Derived from the canonical shared registry (`@orviohub/shared`) so that
 * the launcher, the activation page, and the recommendation engine always
 * agree on which applications exist, what plans they require, and whether
 * they are visible to customers.
 */
const DEFAULT_PLATFORM_APPS: PlatformAppItem[] = (() => {
  const visibleKeys = getVisibleAppKeys();
  return visibleKeys
    .map((key) => {
      const meta = getAppMeta(key);
      const canonical = applications[key as ApplicationKey];
      if (!canonical) return null;
      return {
        key,
        name: canonical.name,
        status: (canonical.status === 'coming_soon' ? 'coming_soon' : 'active') as 'active' | 'coming_soon',
        isCore: canonical.isActivatable,
        planRequirements: meta.planRequirements,
        subdomain: canonical.subdomain,
        description: meta.description,
        badge: meta.badge,
        icon: canonical.iconName,
        displayOrder: canonical.displayOrder,
      };
    })
    .filter((item): item is PlatformAppItem => item !== null)
    .sort((a, b) => (a.displayOrder ?? 99) - (b.displayOrder ?? 99));
})();

// Run consistency guard at module load in development
if (typeof window !== 'undefined' && (window as any).__ORVIO_DEV__) {
  assertRegistryConsistency();
}

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();

  const branchParam = searchParams.get('branch');

  const {
    currentWorkspace,
    currentRole,
    workspaces,
    fetchWorkspaces,
    selectWorkspace,
    isLoading: isWsLoading,
    isSwitching,
    hasFetchedWorkspaces,
    error: workspaceError,
  } = useWorkspaceStore();

  const {
    branchesByOrgAndApp,
    loadingByOrgAndApp,
    errorsByOrgAndApp,
    setActiveBranch,
    loadBranches,
  } = useBranchStore();

  const normalizedRole = (currentRole || (currentWorkspace as any)?.role || '').toLowerCase();
  const isOwner = normalizedRole === 'owner';
  const isOwnerOrAdmin = isOwner || normalizedRole === 'admin';

  const [isLoadingApps, setIsLoadingApps] = useState(true);
  const [appsError, setAppsError] = useState<string | null>(null);
  const [platformApps, setPlatformApps] = useState<PlatformAppItem[]>(DEFAULT_PLATFORM_APPS);
  const [selectedAppKey, setSelectedAppKey] = useState<string>('inventory');
  const [planKey, setPlanKey] = useState<string>(
    () => (currentWorkspace?.planKey || currentWorkspace?.planId || 'free_trial').toLowerCase()
  );

  const { eligibility, isLimitReached, isLoading: isEligibilityLoading } = useOrganizationEligibility();

  // Modals & Action States
  const [isCreatingBranchForApp, setIsCreatingBranchForApp] = useState<string | null>(null);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [deactivatePendingBranch, setDeactivatePendingBranch] = useState<Branch | null>(null);
  const [isActivatingAppKey, setIsActivatingAppKey] = useState<string | null>(null);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const appRequestSequence = useRef(0);

  // 1. On initial mount, sync workspace from URL parameter only if explicitly provided in URL
  useEffect(() => {
    const targetOrg = searchParams.get('org');
    if (targetOrg && targetOrg !== currentWorkspace?.id) {
      selectWorkspace(targetOrg).catch(() => {});
    }
    const targetApp = searchParams.get('app');
    if (targetApp) {
      setSelectedAppKey(targetApp.toLowerCase());
    }
  }, []); // Run only once on mount

  // 4. Auto-select branch from query param if provided
  useEffect(() => {
    if (!branchParam || !currentWorkspace?.id) return;
    const cacheKey = `${currentWorkspace.id}::${selectedAppKey.toLowerCase()}`;
    const appBranches = branchesByOrgAndApp[cacheKey] || [];
    if (appBranches.length > 0) {
      const found = appBranches.find((b) => (b.id || b._id) === branchParam);
      if (found) {
        setActiveBranch(found);
      }
    }
  }, [branchParam, currentWorkspace?.id, selectedAppKey, branchesByOrgAndApp, setActiveBranch]);

  // 5. Initial fetch workspaces
  useEffect(() => {
    if (!hasFetchedWorkspaces) {
      fetchWorkspaces().catch(() => {});
    }
  }, [hasFetchedWorkspaces, fetchWorkspaces]);

  // 6. Load Platform Catalog and Workspace Activated Apps
  const loadWorkspaceAppData = useCallback(async () => {
    const requestSequence = ++appRequestSequence.current;
    if (!currentWorkspace?.id) {
      setIsLoadingApps(false);
      return;
    }

    setIsLoadingApps(true);
    setAppsError(null);
    try {
      const [platformAppsRes, appsRes, subRes] = await Promise.all([
        api.get<any>('/platform/applications'),
        api.get<any>(`/organizations/${currentWorkspace.id}/applications`),
        api.get<any>(`/organizations/${currentWorkspace.id}/subscription`),
      ]);

      if (requestSequence !== appRequestSequence.current) return;

      const rawPlatformApps: PlatformAppItem[] =
        platformAppsRes?.data?.applications ||
        platformAppsRes?.applications ||
        platformAppsRes?.data ||
        DEFAULT_PLATFORM_APPS;

      const rawApps: any[] = Array.isArray(appsRes)
        ? appsRes
        : Array.isArray(appsRes?.data)
        ? appsRes.data
        : appsRes?.applications || [];

      const currentWsEntry = workspaces.find(
        (w) => (w.workspace?.id || w.workspaceId || (w as any).id) === currentWorkspace.id
      );
      const enabledProducts = currentWsEntry?.enabledProducts || [];
      const enabledModules = currentWorkspace?.enabledModules || [];

      const mergedApps: PlatformAppItem[] = rawPlatformApps.map((pApp) => {
        const normKey = pApp.key.toLowerCase();
        const foundInWs = rawApps.find((a: any) => (a.key || a.productKey || '').toLowerCase() === normKey);
        const foundInEnabled = enabledProducts.find((p: any) => (p.productKey || p.key || '').toLowerCase() === normKey);
        const isModuleEnabled = enabledModules.some((m: string) => m.toLowerCase() === normKey);

        const isActivated = Boolean(
          (foundInWs && foundInWs.status !== 'inactive') ||
          (foundInEnabled && foundInEnabled.status !== 'inactive') ||
          isModuleEnabled ||
          pApp.isCore
        );

        const activationStatus =
          foundInWs?.status ||
          foundInEnabled?.status ||
          (isActivated ? 'active' : 'inactive');

        return {
          ...pApp,
          isActivated,
          activationStatus,
        };
      });

      setPlatformApps(mergedApps);

      // Load Subscription Plan
      const sub = subRes?.subscription || subRes?.data?.subscription || subRes;
      const resolvedPlan = (
        sub?.activePlan ||
        (sub?.status === 'active' ? (sub?.selectedPlan || sub?.planKey) : null) ||
        sub?.planKey ||
        currentWorkspace.planKey ||
        currentWorkspace.planId ||
        'free_trial'
      );
      setPlanKey(String(resolvedPlan).toLowerCase());

    } catch (err: any) {
      if (requestSequence !== appRequestSequence.current) return;
      setAppsError(err?.message || 'Failed to load applications for this organization.');
    } finally {
      if (requestSequence === appRequestSequence.current) {
        setIsLoadingApps(false);
      }
    }
  }, [currentWorkspace?.id, currentWorkspace?.planKey, currentWorkspace?.planId, workspaces]);

  useEffect(() => {
    loadWorkspaceAppData();
  }, [loadWorkspaceAppData]);

  // Branches have their own request lifecycle. Load only the selected app so
  // slow secondary modules cannot overwrite or delay the visible branch list.
  useEffect(() => {
    if (!currentWorkspace?.id || !selectedAppKey) return;
    const selected = platformApps.find((app) => app.key.toLowerCase() === selectedAppKey.toLowerCase());
    if (!selected?.isActivated) return;
    loadBranches(currentWorkspace.id, selected.key).catch(() => {});
  }, [currentWorkspace?.id, selectedAppKey, platformApps, loadBranches]);

  // Direct select workspace
  const handleSelectWorkspace = async (workspaceId: string) => {
    try {
      await selectWorkspace(workspaceId);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to switch organization.');
    }
  };

  // Navigate to application branch dashboard
  const handleEnterAppBranch = (app: PlatformAppItem, branch: Branch) => {
    if (!currentWorkspace?.id) return;
    setActiveBranch(branch);
    const branchId = branch.id || branch._id || '';

    const targetUrl = getCrossSubdomainUrl(
      app.subdomain as any,
      `/?branchId=${encodeURIComponent(branchId)}&org=${encodeURIComponent(currentWorkspace.id)}`
    );

    if (targetUrl.startsWith('http')) {
      window.location.href = targetUrl;
    } else {
      navigate(targetUrl);
    }
  };

  // Activate Application Handler
  const handleActivateApp = async (app: PlatformAppItem) => {
    if (!currentWorkspace?.id) return;

    if (app.planRequirements?.length > 0) {
      const isAllowed = app.planRequirements.includes(planKey);
      if (!isAllowed) {
        toast.error(`The "${app.name}" application requires a higher tier plan (${app.planRequirements.join(', ')}).`);
        setUpgradeModalOpen(true);
        return;
      }
    }

    setIsActivatingAppKey(app.key);
    try {
      await api.post(`/organizations/${currentWorkspace.id}/applications/${app.key}/activate`, {
        // The activation API accepts planKey; using planId silently fell back
        // to Free Trial and created an incorrect post-activation journey.
        planKey,
      });
      toast.success(`"${app.name}" activated successfully!`);
      await loadWorkspaceAppData();
      setSelectedAppKey(app.key);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || 'Failed to activate application.';
      if (msg.includes('Plan') || msg.includes('limit') || msg.includes('subscription')) {
        setUpgradeModalOpen(true);
      } else {
        toast.error(msg);
      }
    } finally {
      setIsActivatingAppKey(null);
    }
  };

  // Deactivate Branch Handler
  const handleConfirmDeactivateBranch = async () => {
    if (!deactivatePendingBranch || !currentWorkspace?.id) return;
    const branchId = deactivatePendingBranch.id || deactivatePendingBranch._id || '';
    try {
      await api.delete(`/organizations/${currentWorkspace.id}/branches/${branchId}`);
      toast.success(`Location "${deactivatePendingBranch.name}" deactivated.`);
      setDeactivatePendingBranch(null);
      if (currentWorkspace?.id) {
        await loadBranches(currentWorkspace.id, selectedAppKey);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to deactivate location.');
    }
  };

  const selectedApp = useMemo(() => {
    return platformApps.find((a) => a.key.toLowerCase() === selectedAppKey.toLowerCase()) || platformApps[0];
  }, [platformApps, selectedAppKey]);

  const activeAppCacheKey = currentWorkspace?.id ? `${currentWorkspace.id}::${selectedApp?.key.toLowerCase()}` : '';
  const currentAppBranches = currentWorkspace?.id
    ? (branchesByOrgAndApp[activeAppCacheKey] || [])
    : [];
  const isLoadingCurrentBranches = Boolean(loadingByOrgAndApp[activeAppCacheKey]);
  const currentBranchesError = errorsByOrgAndApp[activeAppCacheKey] || null;

  const launcherNewOrgUrl = '/onboard/organization';

  const getAppIcon = (key: string) => {
    switch (key) {
      case 'inventory':
        return <Boxes className="w-4 h-4 text-[#e6a8d6]" />;
      case 'booking':
        return <Calendar className="w-4 h-4 text-amber-300" />;
      case 'gym':
        return <Dumbbell className="w-4 h-4 text-sky-400" />;
      case 'taskmanagement':
        return <CheckSquare className="w-4 h-4 text-emerald-400" />;
      default:
        return <Store className="w-4 h-4 text-purple-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-black text-slate-100 flex flex-col selection:bg-[#714b67] selection:text-white">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <PendingInvitesBanner />

        {/* Zero State if User Has No Organizations */}
        {(!hasFetchedWorkspaces || isWsLoading) ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" aria-label="Loading organizations">
            {[0, 1, 2].map((column) => (
              <div key={column} className="space-y-3">
                <div className="h-4 w-28 rounded bg-white/5 animate-pulse" />
                <div className="h-16 rounded-sm bg-white/5 animate-pulse" />
                <div className="h-16 rounded-sm bg-white/5 animate-pulse" />
              </div>
            ))}
          </div>
        ) : workspaceError && workspaces.length === 0 ? (
          <div className="max-w-lg mx-auto py-14 text-center space-y-4">
            <p className="text-sm font-semibold text-white">We couldn't load your organizations.</p>
            <p className="text-xs text-slate-400">{workspaceError}</p>
            <button
              type="button"
              onClick={() => fetchWorkspaces(undefined, undefined, true)}
              className="px-4 py-2 rounded-sm bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold"
            >
              Try again
            </button>
          </div>
        ) : workspaces.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto pt-8">
            <div className="p-6 rounded-sm bg-transparent flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-sm bg-white/5 flex items-center justify-center text-[#FDB02F]">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-base font-bold text-white tracking-tight">Create your first business</h2>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Set up your business name, currency, branches, and start managing inventory and sales.
                  </p>
                </div>
              </div>
              <a
                href={launcherNewOrgUrl}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-sm bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-bold transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Business</span>
              </a>
            </div>

            <div className="p-6 rounded-sm bg-transparent flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-sm bg-white/5 flex items-center justify-center text-slate-300">
                  <Users className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-base font-bold text-white tracking-tight">Joining an existing business?</h2>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Accept an email invitation to access your organization workspace.
                  </p>
                </div>
              </div>
              <div className="text-[11px] text-slate-400">
                Any invitation sent to <span className="text-white font-medium">{user?.email}</span> can be accepted directly.
              </div>
            </div>
          </div>
        ) : (
          /* Three Column Cascading Layout: Organization -> Application -> Branches */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

            {/* Persistent App Activation Prompt — shown when the selected org has no activated apps */}
            {currentWorkspace?.id && !platformApps.some((a) => a.isActivated) && (
              <div className="lg:col-span-12">
                <AppActivationPrompt
                  organizationId={currentWorkspace.id}
                  organizationName={currentWorkspace.name}
                  planKey={planKey}
                  onActivated={loadWorkspaceAppData}
                  storageKey={`orvio_app_activation_prompt_${currentWorkspace.id}`}
                />
              </div>
            )}

            {/* Column 1: Organization List (Column of organizations) */}
            <div className="lg:col-span-4 space-y-3">
              <div className="flex items-center justify-between pb-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-[#e6a8d6]" />
                  Organizations
                </span>
                {isEligibilityLoading ? (
                  <span className="h-4 w-12 rounded bg-white/5 animate-pulse" />
                ) : !isLimitReached ? (
                  <a
                    href={launcherNewOrgUrl}
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                    title="Create New Organization"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New</span>
                  </a>
                ) : (
                  <span className="text-[10px] text-red-400 font-semibold">Limit Reached</span>
                )}
              </div>

              {/* Proactive Organization Ownership Quota Indicator */}
              {isEligibilityLoading ? (
                <div className="h-8 rounded-sm bg-white/5 animate-pulse" />
              ) : (
                <OrganizationQuotaIndicator eligibility={eligibility} variant="compact" />
              )}

              <div className="space-y-1">
                {workspaces.map(({ workspace }) => {
                  const isSelected = currentWorkspace?.id === workspace.id;
                  const rawStatus = workspace.status || 'Active';

                  return (
                    <button
                      key={workspace.id}
                      type="button"
                      onClick={() => handleSelectWorkspace(workspace.id)}
                      disabled={isSwitching}
                      className={cn(
                        'w-full p-3 rounded-sm text-left transition-colors flex items-center justify-between gap-3 cursor-pointer group disabled:cursor-wait disabled:opacity-60',
                        isSelected
                          ? 'bg-white/10 text-white font-semibold'
                          : 'bg-transparent hover:bg-white/[0.04] text-slate-300'
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {workspace.logoUrl ? (
                          <img
                            src={workspace.logoUrl}
                            alt={workspace.name}
                            className="w-7 h-7 rounded-sm object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-sm bg-[#714b67] text-white flex items-center justify-center font-bold text-xs shrink-0">
                            {workspace.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-xs font-bold truncate group-hover:text-white">
                            {workspace.name}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {workspace.planName || workspace.planKey || 'Free Trial'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={cn(
                            'text-[10px] capitalize',
                            rawStatus.toLowerCase() === 'active' ? 'text-emerald-400' : 'text-slate-400'
                          )}
                        >
                          {rawStatus}
                        </span>
                        {isSelected && <ChevronRight className="w-3.5 h-3.5 text-[#e6a8d6]" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {isOwnerOrAdmin && currentWorkspace?.id && (
                <div className="pt-2">
                  <Link
                    to="/settings"
                    className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Organization Settings</span>
                  </Link>
                </div>
              )}
            </div>

            {/* Column 2: Application List / Dropdown for Selected Organization */}
            <div className="lg:col-span-4 space-y-3">
              <div className="flex items-center justify-between pb-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#e6a8d6]" />
                  Applications
                </span>
                <span className="text-[10px] text-slate-400">
                  {platformApps.filter((a) => a.isActivated).length} Active
                </span>
              </div>

              {isLoadingApps || isSwitching ? (
                <div className="space-y-2 py-4">
                  <div className="h-9 rounded-sm bg-white/5 animate-pulse" />
                  <div className="h-9 rounded-sm bg-white/5 animate-pulse" />
                </div>
              ) : appsError ? (
                <div className="py-8 text-center space-y-3">
                  <p className="text-xs text-rose-300">{appsError}</p>
                  <button
                    type="button"
                    onClick={loadWorkspaceAppData}
                    className="px-3 py-1.5 rounded-sm bg-white/10 hover:bg-white/15 text-white text-xs font-semibold"
                  >
                    Retry applications
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  {platformApps.map((app) => {
                    const isSelected = app.key.toLowerCase() === selectedAppKey.toLowerCase();
                    const isComingSoon = app.status === 'coming_soon';

                    return (
                      <button
                        key={app.key}
                        type="button"
                        onClick={() => setSelectedAppKey(app.key)}
                        className={cn(
                          'w-full p-3 rounded-sm text-left transition-colors flex items-center justify-between gap-3 cursor-pointer group',
                          isSelected
                            ? 'bg-white/10 text-white font-semibold'
                            : 'bg-transparent hover:bg-white/[0.04] text-slate-300'
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="p-1 rounded-sm bg-white/5 shrink-0">
                            {getAppIcon(app.key)}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold truncate group-hover:text-white">
                              {app.name}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {app.badge || (app.isCore ? 'Core System' : 'Add-on')}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={cn(
                              'text-[10px] font-medium',
                              app.isActivated
                                ? 'text-emerald-400'
                                : isComingSoon
                                ? 'text-amber-400'
                                : 'text-slate-400'
                            )}
                          >
                            {app.isActivated ? 'Active' : isComingSoon ? 'Coming Soon' : 'Inactive'}
                          </span>
                          {isSelected && <ChevronRight className="w-3.5 h-3.5 text-[#e6a8d6]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Inactive App CTA if not activated */}
              {selectedApp && !selectedApp.isActivated && (
                <div className="pt-3 space-y-2">
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {selectedApp.description}
                  </p>
                  {selectedApp.status === 'coming_soon' ? (
                    <div className="text-xs text-amber-400">This module is currently in development.</div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleActivateApp(selectedApp)}
                      disabled={isActivatingAppKey === selectedApp.key}
                      className="px-3 py-1.5 rounded-sm bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer"
                    >
                      {isActivatingAppKey === selectedApp.key ? 'Activating...' : 'Activate Module'}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Column 3: Branches for Selected Application & Direct Dashboard Launch */}
            <div className="lg:col-span-4 space-y-3">
              <div className="flex items-center justify-between pb-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-[#e6a8d6]" />
                  Branches & Entry
                </span>
                {isOwnerOrAdmin && selectedApp?.isActivated && (
                  <button
                    type="button"
                    onClick={() => setIsCreatingBranchForApp(selectedApp.key)}
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                    title="Add Location"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Branch</span>
                  </button>
                )}
              </div>

              {isLoadingApps || isSwitching || isLoadingCurrentBranches ? (
                <div className="space-y-2 py-4">
                  <div className="h-12 rounded-sm bg-white/5 animate-pulse" />
                  <div className="h-12 rounded-sm bg-white/5 animate-pulse" />
                </div>
              ) : currentBranchesError ? (
                <div className="py-8 text-center space-y-3">
                  <p className="text-xs text-rose-300">{currentBranchesError}</p>
                  <button
                    type="button"
                    onClick={() => currentWorkspace?.id && selectedApp?.key && loadBranches(currentWorkspace.id, selectedApp.key, true)}
                    className="px-3 py-1.5 rounded-sm bg-white/10 hover:bg-white/15 text-white text-xs font-semibold"
                  >
                    Retry branches
                  </button>
                </div>
              ) : currentAppBranches.length === 0 ? (
                <div className="py-8 text-center space-y-3">
                  <div className="text-xs text-slate-400">
                    {selectedApp?.isActivated
                      ? 'No branches configured for this module.'
                      : 'Activate this module to configure branches.'}
                  </div>
                  {isOwnerOrAdmin && selectedApp?.isActivated && (
                    <button
                      type="button"
                      onClick={() => setIsCreatingBranchForApp(selectedApp.key)}
                      className="px-3 py-1.5 rounded-sm bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-bold transition-colors cursor-pointer"
                    >
                      Create First Branch
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {currentAppBranches.map((branch) => {
                    const isPrimary = Boolean(branch.isPrimary);
                    const isSuspended = branch.status === 'suspended';

                    return (
                      <div
                        key={branch.id || branch._id}
                        className="p-3 rounded-sm bg-transparent hover:bg-white/[0.04] transition-colors flex items-center justify-between gap-3 group"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-white truncate">
                              {branch.name}
                            </span>
                            {isPrimary && (
                              <span title="Primary Store">
                                <Star className="w-3 h-3 text-amber-300 fill-amber-300 shrink-0" />
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono text-amber-200/80 font-medium">{branch.code || 'MAIN'}</span>
                            {branch.city && <span>• {branch.city}</span>}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {isOwnerOrAdmin && (
                            <>
                              <button
                                type="button"
                                onClick={() => setEditingBranch(branch)}
                                className="p-1 rounded-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                                title="Edit Branch"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>

                              <Link
                                to={`/settings/branches/${branch.id || branch._id}`}
                                className="p-1 rounded-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                                title="Branch Settings"
                              >
                                <Settings className="w-3 h-3" />
                              </Link>

                              {!isPrimary && (
                                <button
                                  type="button"
                                  onClick={() => setDeactivatePendingBranch(branch)}
                                  className="p-1 rounded-sm text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                  title="Deactivate Branch"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </>
                          )}

                          <button
                            type="button"
                            disabled={isSuspended}
                            onClick={() => handleEnterAppBranch(selectedApp, branch)}
                            className="px-2.5 py-1 rounded-sm bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <span>Enter</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        )}
      </main>

      {/* Branch Creation Modal */}
      {isCreatingBranchForApp && currentWorkspace?.id && (
        <BranchCreationModal
          isOpen={Boolean(isCreatingBranchForApp)}
          workspaceId={currentWorkspace.id}
          applicationKey={isCreatingBranchForApp}
          onClose={() => setIsCreatingBranchForApp(null)}
          onSuccess={async () => {
            setIsCreatingBranchForApp(null);
            if (currentWorkspace?.id) {
              await loadBranches(currentWorkspace.id, isCreatingBranchForApp);
              await loadWorkspaceAppData();
            }
          }}
        />
      )}

      {/* Branch Edit Modal */}
      {editingBranch && (
        <BranchEditModal
          isOpen={Boolean(editingBranch)}
          branch={editingBranch}
          onClose={() => setEditingBranch(null)}
          onSuccess={async () => {
            setEditingBranch(null);
            if (currentWorkspace?.id) {
              await loadBranches(currentWorkspace.id, selectedAppKey);
            }
          }}
        />
      )}

      {/* Confirmation Modal: Deactivate Branch */}
      {deactivatePendingBranch && (
        <ConfirmationModal
          isOpen={Boolean(deactivatePendingBranch)}
          title="Deactivate Location"
          description={`Are you sure you want to deactivate "${deactivatePendingBranch.name}"? Registers and staff assigned to this branch will no longer be able to process sales.`}
          confirmButtonText="Deactivate Branch"
          isDangerous
          onClose={() => setDeactivatePendingBranch(null)}
          onConfirm={handleConfirmDeactivateBranch}
        />
      )}

      {/* Upgrade Subscription Modal */}
      {upgradeModalOpen && (
        <UpgradeModal
          isOpen={upgradeModalOpen}
          onClose={() => setUpgradeModalOpen(false)}
        />
      )}
    </div>
  );
};
