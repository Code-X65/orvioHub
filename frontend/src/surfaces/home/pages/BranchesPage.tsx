import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Navigate } from 'react-router-dom';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useBranchStore, type Branch } from '@/stores/useBranchStore';
import { useHost } from '@/host/useHost';
import { getCrossSubdomainUrl, type ApplicationKey } from '@/lib/domain';
import { Header } from '@/components/landing/Header';
import { WorkspaceSwitcher } from '@/components/workspace/WorkspaceSwitcher';
import { Spinner } from '@/components/ui/spinner';
import { BranchCreationModal } from '@/components/workspace/BranchCreationModal';
import { BranchEditModal } from '@/components/workspace/BranchEditModal';
import { UsageLimitBanner } from '@/components/billing/UsageLimitBanner';
import { UpgradeModal } from '@/components/billing/UpgradeModal';
import { useOrganizationEntitlements } from '@/hooks/useOrganizationEntitlements';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import {
  Warehouse,
  Plus,
  CheckCircle2,
  ChevronDown,
  Layers,
  Edit2,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const APP_NAMES: Record<string, string> = {
  inventory: 'Inventory & POS',
  taskmanagement: 'Task & Workflow Management',
  crm: 'CRM & Client Pipeline',
  gym: 'Gym & Membership',
  booking: 'Appointments & Scheduling',
};

export const BranchesPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const host = useHost();
  const env = host.environment;

  const appKey = (searchParams.get('app') || 'inventory').toLowerCase();
  const appDisplayName = APP_NAMES[appKey] || (appKey.charAt(0).toUpperCase() + appKey.slice(1));

  const { currentWorkspace, currentRole, workspaces, fetchWorkspaces, isLoading: isWsLoading } = useWorkspaceStore();
  const { branches, activeBranch, branchesByOrgAndApp, setActiveBranch, loadBranches } = useBranchStore();

  const { summary: entSummary } = useOrganizationEntitlements(currentWorkspace?.id);
  const [userPermissions, setUserPermissions] = useState<any>(null);

  const normalizedRole = (currentRole || (currentWorkspace as any)?.role || '').toLowerCase();
  const isOwner = normalizedRole === 'owner';
  const isOwnerOrAdmin = isOwner || normalizedRole === 'admin';
  const canUpgrade = isOwner;
  const canManageBranches = isOwnerOrAdmin;

  // Synchronous cache derivation from useBranchStore memory cache
  const cacheKey = currentWorkspace?.id ? `${currentWorkspace.id}::${appKey}` : '';
  const cachedBranches = currentWorkspace?.id ? (branchesByOrgAndApp[cacheKey] || []) : [];

  const [hasCheckedAutoSelect, setHasCheckedAutoSelect] = useState(
    cachedBranches.length > 0 || branches.length > 0
  );
  const [isCheckingBranches, setIsCheckingBranches] = useState(
    !cachedBranches.length && !!currentWorkspace?.id
  );
  const [isAppDropdownOpen, setIsAppDropdownOpen] = useState(false);
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [deactivatePending, setDeactivatePending] = useState<Branch | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  // Synchronously derive initial plan from store
  const initialPlan = (currentWorkspace?.planKey || currentWorkspace?.planId || 'free_trial').toLowerCase();
  const [planKey, setPlanKey] = useState<string>(initialPlan);

  // Keep planKey in sync if workspace changes
  useEffect(() => {
    if (currentWorkspace) {
      const pk = (currentWorkspace.planKey || currentWorkspace.planId || 'free_trial').toLowerCase();
      setPlanKey(pk);
    }
  }, [currentWorkspace?.id, currentWorkspace?.planKey, currentWorkspace?.planId]);

  useEffect(() => {
    const init = async () => {
      if (workspaces.length === 0) {
        await fetchWorkspaces().catch(() => {});
      }
    };
    init();
  }, [workspaces.length, fetchWorkspaces]);

  useEffect(() => {
    let isMounted = true;
    if (currentWorkspace?.id) {
      const isCached = (branchesByOrgAndApp[`${currentWorkspace.id}::${appKey}`] || []).length > 0;
      if (!isCached) {
        setIsCheckingBranches(true);
      }

      loadBranches(currentWorkspace.id, appKey)
        .then(() => {
          if (isMounted) {
            setHasCheckedAutoSelect(true);
            setIsCheckingBranches(false);
          }
        })
        .catch(() => {
          if (isMounted) {
            setHasCheckedAutoSelect(true);
            setIsCheckingBranches(false);
          }
        });

      // Load subscription plan
      api.get<any>(`/organizations/${currentWorkspace.id}/subscription`)
        .then((res) => {
          if (isMounted) {
            const sub = res?.subscription || res?.data?.subscription || res;
            const pk = (
              sub?.activePlan ||
              (sub?.status === 'active' ? (sub?.selectedPlan || sub?.planKey) : null) ||
              sub?.planKey ||
              res?.planKey ||
              initialPlan
            );
            setPlanKey(String(pk).toLowerCase());
          }
        })
        .catch(() => {});

      // Load caller RBAC permissions
      api.get<any>(`/organizations/${currentWorkspace.id}/my-permissions`)
        .then((res) => {
          if (isMounted && res?.data) {
            setUserPermissions(res.data);
          }
        })
        .catch(() => {});
    } else if (!isWsLoading && workspaces.length === 0) {
      if (isMounted) {
        setHasCheckedAutoSelect(true);
        setIsCheckingBranches(false);
      }
    }
    return () => { isMounted = false; };
  }, [currentWorkspace?.id, isWsLoading, workspaces.length, appKey, loadBranches]);

  const isFreeTrial = planKey === 'free_trial' || planKey === 'free';
  const effectiveBranches = cachedBranches.length > 0 ? cachedBranches : branches;
  const atBranchLimit =
    !isCheckingBranches &&
    ((isFreeTrial && effectiveBranches.length >= 1) ||
      Boolean(entSummary?.metrics?.branches?.isReached));

  const isFullAdmin = isOwnerOrAdmin && (userPermissions?.isFullAdmin ?? true);
  const visibleBranches = effectiveBranches.filter((b) => {
    if (isFullAdmin) return true;
    if (!userPermissions?.allowedBranches || userPermissions.allowedBranches.length === 0) return true;
    const bId = b.id || b._id;
    return userPermissions.allowedBranches.includes(bId);
  });

  const handleDeactivateBranch = async () => {
    if (!deactivatePending || !currentWorkspace?.id) return;
    const branchId = deactivatePending.id || deactivatePending._id || '';
    setIsDeactivating(true);
    try {
      await api.delete(`/organizations/${currentWorkspace.id}/branches/${branchId}`);
      toast.success(`Branch "${deactivatePending.name}" deactivated.`);
      setDeactivatePending(null);
      await loadBranches(currentWorkspace.id, appKey);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to deactivate branch.');
    } finally {
      setIsDeactivating(false);
    }
  };

  const handleSelectBranch = (branch: Branch) => {
    setActiveBranch(branch);
    const branchId = branch.id || branch._id || '';
    const orgId = currentWorkspace?.id || '';

    if (appKey === 'booking' || appKey === 'gym') {
      toast.info(`${appDisplayName} branch operations is in private preview.`);
      return;
    }

    const targetUrl = getCrossSubdomainUrl(
      appKey as ApplicationKey,
      `/dashboard?branch=${encodeURIComponent(branchId)}${orgId ? `&org=${encodeURIComponent(orgId)}` : ''}`,
      true,
      env
    );
    window.location.href = targetUrl;
  };

  // Redirect to org picker if no workspace is currently selected
  if (hasCheckedAutoSelect && !isWsLoading && !currentWorkspace && workspaces.length === 0) {
    return <Navigate to="/dashboard" replace />;
  }

  const enabledApps = currentWorkspace?.enabledModules || ['inventory'];

  return (
    <div className="min-h-screen bg-black text-slate-100 flex flex-col selection:bg-[#714b67] selection:text-white">
      <Header />

      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10 space-y-6 animate-in fade-in duration-300">
        {/* Header with Breadcrumb & Dual Switchers */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span
                onClick={() => navigate('/dashboard')}
                className="font-semibold text-slate-200 hover:text-white cursor-pointer transition-colors"
              >
                {currentWorkspace?.name}
              </span>
              <span>→</span>
              <span
                onClick={() => navigate('/applications')}
                className="font-bold text-[#FDB02F] hover:text-[#fed476] cursor-pointer transition-colors"
              >
                {appDisplayName}
              </span>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Branches
            </h1>
            <p className="text-xs text-slate-400">
              Select a branch location to open {appDisplayName}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Application Switcher Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsAppDropdownOpen(!isAppDropdownOpen)}
                className="h-8 px-3 rounded-sm bg-transparent hover:bg-white/5 border border-white/10 text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Layers className="w-3.5 h-3.5 text-[#FDB02F]" />
                <span>{appDisplayName}</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {isAppDropdownOpen && (
                <div className="absolute right-0 top-10 w-52 bg-[#120b10] border border-white/15 rounded-sm shadow-2xl p-1 z-30 space-y-0.5">
                  <div className="px-2.5 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Switch Application
                  </div>
                  {enabledApps.map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        setIsAppDropdownOpen(false);
                        navigate(`/branches?app=${k}`);
                      }}
                      className={cn(
                        'w-full text-left px-2.5 py-1.5 rounded-sm text-xs font-medium flex items-center justify-between cursor-pointer transition-colors',
                        k.toLowerCase() === appKey
                          ? 'bg-[#714b67] text-white font-semibold'
                          : 'text-slate-300 hover:bg-white/10 hover:text-white'
                      )}
                    >
                      <span>{APP_NAMES[k.toLowerCase()] || k}</span>
                      {k.toLowerCase() === appKey && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Organization Switcher Dropdown */}
            <WorkspaceSwitcher />

            {/* Add Branch Button if admin and under limit */}
            {canManageBranches && !atBranchLimit && (
              <button
                type="button"
                onClick={() => setIsCreatingBranch(true)}
                className="h-8 px-3 rounded-sm bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Branch</span>
              </button>
            )}

            {/* Upgrade Button ONLY if store owner and at limit */}
            {canUpgrade && atBranchLimit && (
              <button
                type="button"
                onClick={() => setUpgradeModalOpen(true)}
                className="h-8 px-3 rounded-sm bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                <span>Upgrade for More Branches</span>
              </button>
            )}
          </div>
        </div>

        {/* Entitlement Quota Banner - Only for store owner */}
        {canUpgrade && entSummary?.warningMessage && (
          <UsageLimitBanner
            warningMessage={entSummary.warningMessage}
            isReached={Boolean(entSummary.hasExceededLimits)}
            onUpgradeClick={() => {
              setUpgradeModalOpen(true);
            }}
            planKey={entSummary.planKey}
          />
        )}

        {/* Branches Grid & Guarded Loading States */}
        {isCheckingBranches && visibleBranches.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3].map((idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-sm bg-transparent border border-white/5 flex items-center justify-between gap-3 animate-pulse"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-sm bg-white/5 flex-shrink-0" />
                  <div className="space-y-1.5 min-w-0">
                    <div className="w-24 h-3.5 rounded-xs bg-white/10" />
                    <div className="w-32 h-2.5 rounded-xs bg-white/5" />
                  </div>
                </div>
                <div className="flex items-center gap-2.5 flex-shrink-0">
                  <div className="w-10 h-3 rounded-xs bg-white/5" />
                  <div className="w-12 h-6 rounded-sm bg-white/10" />
                </div>
              </div>
            ))}
          </div>
        ) : visibleBranches.length === 0 ? (
          <div className="p-8 text-center rounded-sm bg-transparent border border-dashed border-white/10 space-y-4 max-w-md mx-auto">
            <div className="w-10 h-10 rounded-sm bg-[#714b67] text-white flex items-center justify-center mx-auto">
              <Warehouse className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white">
                {branches.length > 0 ? 'No Branch Assigned' : 'No Branches Configured'}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {branches.length > 0
                  ? 'You have Inventory access, but no branch has been assigned to you yet. Contact your workspace owner or Inventory manager.'
                  : 'Add your first branch or store location to begin operations.'}
              </p>
            </div>
            {isFullAdmin && branches.length === 0 && (
              <button
                type="button"
                onClick={() => setIsCreatingBranch(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-medium transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Primary Branch</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {visibleBranches.map((branch) => {
              const branchId = branch.id || branch._id || '';
              const isSelected = (activeBranch?.id || activeBranch?._id) === branchId;
              const locationStr =
                [branch.street, branch.city, branch.state].filter(Boolean).join(', ') ||
                branch.address ||
                '';

              return (
                <div
                  key={branchId}
                  onClick={() => handleSelectBranch(branch)}
                  className={cn(
                    'group p-3.5 rounded-sm bg-transparent hover:bg-white/[0.04] transition-colors cursor-pointer flex items-center justify-between gap-3',
                    isSelected && 'bg-white/[0.05]'
                  )}
                >
                  {/* i. Logo or First Alphabet & Branch Name + Location */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-sm bg-[#714b67] text-white flex items-center justify-center font-bold text-sm shrink-0">
                      {branch.name ? branch.name.charAt(0).toUpperCase() : <Warehouse className="w-4 h-4" />}
                    </div>

                    <div className="min-w-0">
                      {/* i. Branch Name */}
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-sm font-semibold text-white group-hover:text-[#f3e1ed] transition-colors truncate">
                          {branch.name}
                        </h3>
                        {branch.code && (
                          <span className="text-[10px] font-mono text-slate-400 shrink-0">
                            ({branch.code})
                          </span>
                        )}
                      </div>
                      {/* Location or Phone */}
                      <p className="text-xs text-slate-400 mt-0.5 truncate">
                        {locationStr || branch.phone || 'Primary Location'}
                      </p>
                    </div>
                  </div>

                  {/* iii. Branch Status, Open Button & Action Icons */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span
                      className={cn(
                        'text-xs font-medium',
                        branch.isPrimary ? 'text-emerald-400' : 'text-slate-400'
                      )}
                    >
                      {branch.isPrimary ? 'Primary' : 'Active'}
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectBranch(branch);
                      }}
                      className="px-3 py-1 rounded-sm bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-medium transition-colors cursor-pointer"
                    >
                      Enter
                    </button>

                    {canManageBranches && (
                      <>
                        <button
                          type="button"
                          title="Edit Branch"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingBranch(branch);
                          }}
                          className="p-1 rounded-sm text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {!branch.isPrimary && (
                          <button
                            type="button"
                            title="Deactivate Branch"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeactivatePending(branch);
                            }}
                            className="p-1 rounded-sm text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Add New Branch Card or Quota Indicator (Managers/Owners only) */}
            {canManageBranches && (
              atBranchLimit ? (
                canUpgrade ? (
                  <div className="p-3.5 rounded-sm bg-transparent border border-dashed border-amber-500/20 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 text-amber-300">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="truncate">Limit reached (1 branch on trial)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setUpgradeModalOpen(true)}
                      className="px-2.5 py-1 rounded-sm bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-medium transition-colors shrink-0 cursor-pointer"
                    >
                      Upgrade
                    </button>
                  </div>
                ) : null
              ) : (
                <div
                  onClick={() => setIsCreatingBranch(true)}
                  className="p-3.5 rounded-sm bg-transparent hover:bg-white/[0.04] border border-dashed border-white/10 flex items-center justify-center gap-2 text-xs font-medium text-slate-300 hover:text-white cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 text-[#FDB02F]" />
                  <span>Add Branch</span>
                </div>
              )
            )}
          </div>
        )}
      </main>

      {/* Branch Creation Modal */}
      {isCreatingBranch && currentWorkspace?.id && (
        <BranchCreationModal
          isOpen={isCreatingBranch}
          workspaceId={currentWorkspace.id}
          applicationKey={appKey}
          onClose={() => setIsCreatingBranch(false)}
          onSuccess={() => {
            setIsCreatingBranch(false);
            if (currentWorkspace?.id) {
              loadBranches(currentWorkspace.id, appKey);
            }
          }}
        />
      )}

      {/* Branch Edit Modal */}
      <BranchEditModal
        isOpen={!!editingBranch}
        branch={editingBranch}
        onClose={() => setEditingBranch(null)}
        onSuccess={() => {
          setEditingBranch(null);
          if (currentWorkspace?.id) loadBranches(currentWorkspace.id, appKey);
        }}
      />

      {/* Deactivate Confirmation Dialog */}
      {deactivatePending && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
          onClick={() => !isDeactivating && setDeactivatePending(null)}
        >
          <div
            className="w-full max-w-sm bg-[#0c080b]/95 border border-white/10 rounded-2xl shadow-2xl p-6 space-y-4 backdrop-blur-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center">
                <Trash2 className="w-4 h-4 text-rose-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Deactivate Branch</h3>
                <p className="text-xs text-slate-400">This action cannot be easily undone.</p>
              </div>
            </div>
            <p className="text-xs text-slate-300">
              Are you sure you want to deactivate{' '}
              <span className="font-bold text-white">{deactivatePending.name}</span>? Staff assigned to this branch will lose access.
            </p>
            {branches.length <= 1 && (
              <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5">
                Warning: This is your only branch. You must have at least one active branch.
              </p>
            )}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setDeactivatePending(null)}
                disabled={isDeactivating}
                className="flex-1 h-9 rounded-lg border border-white/10 text-slate-300 hover:text-white hover:bg-white/5 text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeactivateBranch}
                disabled={isDeactivating || branches.length <= 1}
                className="flex-1 h-9 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                {isDeactivating ? <Spinner size="sm" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>{isDeactivating ? 'Deactivating…' : 'Deactivate'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Modal for Branch Limit */}
      <UpgradeModal
        isOpen={upgradeModalOpen}
        workspaceId={currentWorkspace?.id}
        workspaceSlug={currentWorkspace?.slug}
        triggerReason="branch_limit"
        onClose={() => setUpgradeModalOpen(false)}
        onSuccess={() => {
          setUpgradeModalOpen(false);
          loadBranches(currentWorkspace?.id || '', appKey);
        }}
      />
    </div>
  );
};
