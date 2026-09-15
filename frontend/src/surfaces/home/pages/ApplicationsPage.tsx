import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { Header } from '@/components/landing/Header';
import { WorkspaceSwitcher } from '@/components/workspace/WorkspaceSwitcher';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { InventoryIcon } from '@/components/icons/InventoryIcon';
import { api } from '@/lib/api';
import { getCrossSubdomainUrl } from '@/lib/domain';
import { UpgradeModal } from '@/components/billing/UpgradeModal';
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
  PowerOff,
  AlertTriangle,
} from 'lucide-react';

interface AppItem {
  applicationId?: string;
  key: string;
  name: string;
  isActivated: boolean;
  status: string;
  planId?: string;
  trialEndsAt?: number;
}

const CATALOG_APPS = [
  { key: 'inventory', name: 'Inventory' },
];

function deriveInitialApps(
  currentWorkspace: any,
  workspaces: any[],
  products: any[]
): AppItem[] {
  const currentWsEntry = workspaces.find(
    (w) => (w.workspace?.id || w.workspaceId || w.id) === currentWorkspace?.id
  );

  const enabledProducts = currentWsEntry?.enabledProducts || [];
  const enabledModules = currentWorkspace?.enabledModules || [];

  return CATALOG_APPS.map((cat) => {
    const foundInEntry = enabledProducts.find(
      (p: any) => (p.productKey || p.key || '').toLowerCase() === cat.key.toLowerCase()
    );
    const foundInProducts = products.find(
      (p: any) => (p.key || p.productKey || '').toLowerCase() === cat.key.toLowerCase()
    );
    const isModuleEnabled = enabledModules.some(
      (m: string) => m.toLowerCase() === cat.key.toLowerCase()
    );

    const isActivated = Boolean(
      (foundInEntry && foundInEntry.status !== 'inactive') ||
      (foundInProducts && foundInProducts.status !== 'inactive') ||
      isModuleEnabled
    );

    const status =
      foundInEntry?.status ||
      foundInProducts?.status ||
      (isActivated ? 'active' : 'inactive');

    return {
      key: cat.key,
      name: cat.name,
      isActivated,
      status,
      planId: foundInEntry?.planId || foundInProducts?.planId,
    };
  });
}

export const ApplicationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentWorkspace, currentRole, workspaces, products, fetchWorkspaces, isLoading, isSwitching } = useWorkspaceStore();

  const normalizedRole = (currentRole || (currentWorkspace as any)?.role || '').toLowerCase();
  const isOwner = normalizedRole === 'owner';
  const isOwnerOrAdmin = isOwner || normalizedRole === 'admin';

  const [hasLoaded, setHasLoaded] = useState(workspaces.length > 0);
  const [isCheckingStatus, setIsCheckingStatus] = useState(!currentWorkspace);
  const [apps, setApps] = useState<AppItem[]>(() =>
    deriveInitialApps(currentWorkspace, workspaces, products)
  );
  const [planKey, setPlanKey] = useState<string>(
    () => (currentWorkspace?.planKey || currentWorkspace?.planId || 'free_trial').toLowerCase()
  );
  const [activatingKey, setActivatingKey] = useState<string | null>(null);
  const [deactivatingKey, setDeactivatingKey] = useState<string | null>(null);
  const [confirmDeactivateApp, setConfirmDeactivateApp] = useState<AppItem | null>(null);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  // Sync initial apps if currentWorkspace changes before API responds
  useEffect(() => {
    if (currentWorkspace) {
      const wsPlan = (currentWorkspace.planKey || currentWorkspace.planId || '').toLowerCase();
      if (wsPlan) {
        setPlanKey(wsPlan);
      }
      setApps((prev) => {
        const derived = deriveInitialApps(currentWorkspace, workspaces, products);
        // Only update if previously unactivated to avoid clobbering API details
        return prev.map((p) => {
          const match = derived.find((d) => d.key === p.key);
          return match?.isActivated && !p.isActivated ? { ...p, ...match } : p;
        });
      });
    }
  }, [currentWorkspace, workspaces, products]);

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
  const loadAppData = useCallback(async () => {
    if (!currentWorkspace?.id) {
      setIsCheckingStatus(false);
      return;
    }

    setIsCheckingStatus(true);
    try {
      const [appsRes, subRes] = await Promise.all([
        api.get<any>(`/organizations/${currentWorkspace.id}/applications`).catch(() => ({ data: [] })),
        api.get<any>(`/organizations/${currentWorkspace.id}/subscription`).catch(() => null),
      ]);

      const rawApps: any[] = Array.isArray(appsRes)
        ? appsRes
        : Array.isArray(appsRes?.data)
        ? appsRes.data
        : [];

      // Build key-based map from API response, unwrapping both flat and nested app objects
      const appsMap = new Map<string, any>();
      rawApps.forEach((item: any) => {
        const itemKey = (item.key || item.applicationKey || item.app?.key || '').toLowerCase();
        if (itemKey) {
          appsMap.set(itemKey, item);
        }
      });

      // Merge catalog with response to guarantee complete, correctly-named cards
      const resolvedApps: AppItem[] = CATALOG_APPS.map((cat) => {
        const found = appsMap.get(cat.key);
        if (found) {
          const isActivated = Boolean(
            found.isActivated ||
            found.enabled ||
            found.status === 'active' ||
            found.status === 'trial' ||
            found.status === 'trialing'
          );
          const resolvedName = found.name || found.app?.name || cat.name;
          return {
            applicationId: found.applicationId || found._id,
            key: cat.key,
            name: resolvedName,
            isActivated,
            status: found.status || (isActivated ? 'active' : 'inactive'),
            planId: found.planId,
            trialEndsAt: found.trialEndsAt,
          };
        }
        return {
          key: cat.key,
          name: cat.name,
          isActivated: false,
          status: 'inactive',
        };
      });

      setApps(resolvedApps);
      const sub = subRes?.subscription || subRes?.data?.subscription || currentWorkspace?.subscription;
      const subPlan = (
        sub?.activePlan ||
        (sub?.status === 'active' ? (sub?.selectedPlan || sub?.planKey) : null) ||
        subRes?.activePlan ||
        sub?.planKey ||
        subRes?.planKey ||
        currentWorkspace?.planKey ||
        currentWorkspace?.planId ||
        'free_trial'
      ).toLowerCase();
      setPlanKey(subPlan);
    } catch {
      // Fallback
    } finally {
      setIsCheckingStatus(false);
    }
  }, [currentWorkspace?.id, currentWorkspace?.planKey, currentWorkspace?.planId]);

  useEffect(() => {
    loadAppData();
  }, [loadAppData]);

  // Handle redirect if no workspace is available after load
  if (hasLoaded && !isLoading && !isSwitching && !currentWorkspace && workspaces.length === 0) {
    return <Navigate to="/dashboard" replace />;
  }

  if (!hasLoaded && workspaces.length === 0 && isLoading) {
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

  const isFreeTrial = planKey === 'free_trial' || planKey === 'free' || planKey === 'trial';
  const activeAppsCount = apps.filter((a) => a.isActivated && a.status !== 'inactive' && a.status !== 'suspended').length;
  const atLimit = isFreeTrial && activeAppsCount >= 1;
  const orgName = currentWorkspace?.name || 'Organization';

  const handleActivateApp = async (app: AppItem) => {
    if (!currentWorkspace?.id) {
      toast.error('No organization selected.');
      return;
    }

    if (isFreeTrial && app.key !== 'inventory') {
      setUpgradeModalOpen(true);
      return;
    }

    if (atLimit && !app.isActivated) {
      setUpgradeModalOpen(true);
      return;
    }

    setActivatingKey(app.key);
    try {
      await api.post(`/organizations/${currentWorkspace.id}/applications/${app.key}/activate`, {
        planKey: isFreeTrial ? 'free_trial' : 'standard',
      });

      toast.success(`${app.name} activated successfully!`);
      await loadAppData();

      if (app.key === 'inventory') {
        const targetUrl = getCrossSubdomainUrl('inventory', `/onboard/app?org=${currentWorkspace.id}`);
        window.location.href = targetUrl;
      } else {
        navigate(`/branches?app=${app.key}`);
      }
    } catch (err: any) {
      const msg = err?.message || err?.error?.message || 'Failed to activate application.';
      if (
        msg.includes('Free Trial organizations can only activate 1 application') ||
        err?.code === 'APP_LIMIT_REACHED'
      ) {
        toast.error(
          'Free Trial organizations can only activate 1 application. Upgrade to Standard to activate more.'
        );
      } else if (
        msg.includes('not available on Free Trial') ||
        err?.code === 'APP_NOT_ALLOWED_ON_PLAN'
      ) {
        toast.error('This application is not available on Free Trial. Upgrade to Standard.');
      } else {
        toast.error(msg);
      }
    } finally {
      setActivatingKey(null);
    }
  };

  const handleDeactivateApp = async (app: AppItem) => {
    if (!currentWorkspace?.id) return;
    setDeactivatingKey(app.key);
    try {
      await api.post(`/organizations/${currentWorkspace.id}/applications/${app.key}/deactivate`, {});
      toast.success(`${app.name} deactivated.`);
      setConfirmDeactivateApp(null);
      await loadAppData();
    } catch (err: any) {
      toast.error(err?.message || `Failed to deactivate ${app.name}.`);
    } finally {
      setDeactivatingKey(null);
    }
  };

  const handleOpenBranches = (appKey: string) => {
    navigate(`/branches?app=${appKey}`);
  };

  const handleDirectDashboard = (appKey: string) => {
    if (!currentWorkspace?.id) return;
    if (appKey === 'booking' || appKey === 'gym') {
      toast.info(`${appKey.charAt(0).toUpperCase() + appKey.slice(1)} preview mode active.`);
      return;
    }
    const targetUrl = getCrossSubdomainUrl(appKey as any, `/dashboard?org=${currentWorkspace.id}`);
    window.location.href = targetUrl;
  };

  const inventoryApp = apps.find((a) => a.key === 'inventory');
  const formattedPlanName =
    planKey === 'standard'
      ? 'Standard Plan'
      : planKey === 'premium'
      ? 'Premium Plan'
      : 'Free Trial Plan';

  const appDescriptions: Record<string, { desc: string; category: string; features: string[] }> = {
    inventory: {
      category: 'Operations & Commerce',
      desc: 'Track real-time stock across branches, manage receipts & purchase orders, run point-of-sale registers, and generate sales telemetry.',
      features: [
        'Multi-warehouse & store branch support',
        'Barcode scanner & POS terminal checkout',
        'Stock transfers & automated re-orders',
        'Receipt printing & daily sales reports',
      ],
    },
    pos: {
      category: 'Retail & Checkout',
      desc: 'High-speed checkout registers, shift management, multiple payment methods, and automated receipt generation.',
      features: [
        'Rapid item lookup & quick checkout',
        'Cashier shift balance tracking',
        'Offline sales recording resiliency',
        'Customizable receipt headers',
      ],
    },
    booking: {
      category: 'Services & Appointments',
      desc: 'Complete scheduling and appointment workflow for salons, consultants, clinics, and service venues.',
      features: [
        'Online self-service reservation link',
        'Staff availability management',
        'Automated SMS & WhatsApp reminders',
        'Deposit collection & cancellation rules',
      ],
    },
    gym: {
      category: 'Health & Fitness',
      desc: 'Gym membership billing, member check-in validation, class schedules, and trainer assignments.',
      features: [
        'Member QR card barcode scan check-in',
        'Subscription renewal tracking',
        'Trainer and class bookings',
        'Locker & facility access control',
      ],
    },
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
                <span className="text-[10px] font-bold text-[#FDB02F] uppercase tracking-wider bg-[#FDB02F]/10 px-2.5 py-0.5 rounded-full border border-[#FDB02F]/20">
                  {formattedPlanName}
                </span>
                {activeAppsCount > 0 ? (
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    <span>{activeAppsCount} Active App{activeAppsCount > 1 ? 's' : ''}</span>
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
                {activeAppsCount > 0
                  ? 'Select an activated application to manage branches and operations.'
                  : 'This organization has no activated applications. Activate Inventory below to start operations.'}
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
        {activeAppsCount === 0 && !isCheckingStatus && (
          <div className="p-5 rounded-xl bg-gradient-to-r from-[#714b67]/15 to-transparent border border-[#714b67]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#714b67]/25 flex items-center justify-center text-[#FDB02F] shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">No Applications Activated Yet</h3>
                <p className="text-xs text-slate-400">
                  {isOwnerOrAdmin
                    ? 'Activate Inventory below to configure your store branches, POS registers, and inventory tracking.'
                    : 'Inventory has not been activated for this workspace. Ask the workspace owner to activate Inventory.'}
                </p>
              </div>
            </div>
            {inventoryApp && isOwnerOrAdmin && (
              <Button
                type="button"
                onClick={() => handleActivateApp(inventoryApp)}
                disabled={activatingKey === 'inventory'}
                className="h-9 px-4 rounded-lg bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-bold shadow-md shadow-[#714b67]/25 cursor-pointer shrink-0"
              >
                {activatingKey === 'inventory' ? (
                  <>
                    <Spinner size="sm" className="mr-1.5" /> Activating…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-[#FDB02F] mr-1.5" />
                    <span>Set Up Inventory</span>
                  </>
                )}
              </Button>
            )}
          </div>
        )}

        {/* Applications Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {apps.map((app) => {
            const isActive = app.isActivated && app.status !== 'inactive';
            const appDisplayName = app.name || (app.key ? app.key.charAt(0).toUpperCase() + app.key.slice(1) : 'Application');
            const meta = appDescriptions[app.key] || {
              category: 'Business Application',
              desc: `${appDisplayName} module for your business operations.`,
              features: ['Secure data isolation', 'Multi-user role access', 'Automated reports'],
            };
            const isActivating = activatingKey === app.key;
            const isLocked = isFreeTrial && app.key !== 'inventory';

            return (
              <div
                key={app.key}
                className={`p-6 sm:p-7 rounded-2xl border transition-all flex flex-col justify-between space-y-6 ${
                  isActive
                    ? 'bg-[#120b10] border-[#714b67]/50 shadow-xl shadow-[#714b67]/10'
                    : isLocked
                    ? 'bg-[#120b10]/40 border-white/5 opacity-70'
                    : 'bg-[#120b10]/80 border-white/10 hover:border-white/20'
                }`}
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="w-12 h-12 rounded-xl bg-[#714b67]/25 border border-[#714b67]/40 flex items-center justify-center text-[#FDB02F] font-bold text-lg shadow-md">
                      {app.key === 'inventory' ? <InventoryIcon className="w-7 h-7" /> : <Layers className="w-6 h-6 text-[#c79dbd]" />}
                    </div>
                    {isActive ? (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        Active • {app.status}
                      </span>
                    ) : isCheckingStatus ? (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-white/5 text-slate-400 border border-white/10 animate-pulse flex items-center gap-1.5">
                        <Spinner size="sm" className="w-2.5 h-2.5" />
                        <span>Checking…</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-white/5 text-slate-400 border border-white/10">
                        Not Activated
                      </span>
                    )}
                  </div>

                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                      {meta.category}
                    </span>
                    <h2 className="text-lg font-bold text-white tracking-tight">
                      {appDisplayName}
                    </h2>
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                      {meta.desc}
                    </p>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-white/5">
                    {meta.features.map((feat, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-[11px] text-slate-300">
                        <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-emerald-400' : 'text-slate-500'}`} />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-4 border-t border-white/5 flex items-center gap-3">
                  {isActive ? (
                    <>
                      <Button
                        type="button"
                        onClick={() => handleOpenBranches(app.key)}
                        className="flex-1 h-10 bg-[#714b67] hover:bg-[#86597a] text-white rounded-lg text-xs font-semibold shadow-lg shadow-[#714b67]/20 flex items-center justify-center gap-2 cursor-pointer transition-all"
                      >
                        <span>View Branches</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleDirectDashboard(app.key)}
                        className="h-10 px-3 border-white/10 hover:bg-white/5 text-slate-300 text-xs rounded-lg cursor-pointer"
                        title={`Open ${app.name} Dashboard`}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                      {isOwnerOrAdmin && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setConfirmDeactivateApp(app)}
                          className="h-10 px-3 border-white/10 hover:border-rose-500/40 hover:bg-rose-500/10 text-slate-400 hover:text-rose-300 text-xs rounded-lg cursor-pointer transition-colors"
                          title={`Deactivate ${app.name}`}
                        >
                          <PowerOff className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </>
                  ) : isCheckingStatus ? (
                    <Button
                      type="button"
                      disabled
                      className="w-full h-10 bg-white/5 text-slate-400 rounded-lg text-xs font-semibold border border-white/10 flex items-center justify-center gap-2 cursor-wait opacity-60"
                    >
                      <Spinner size="sm" />
                      <span>Checking status…</span>
                    </Button>
                  ) : isOwnerOrAdmin ? (
                    <Button
                      type="button"
                      onClick={() => handleActivateApp(app)}
                      disabled={isActivating || (atLimit && !isActive)}
                      className="w-full h-10 bg-gradient-to-r from-[#714b67] to-[#86597a] hover:from-[#86597a] hover:to-[#9c688e] text-white rounded-lg text-xs font-semibold shadow-lg shadow-[#714b67]/25 flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.01]"
                    >
                      {isActivating ? (
                        <>
                          <Spinner size="sm" /> Activating…
                        </>
                      ) : atLimit ? (
                        isOwner ? (
                          <span>Upgrade to Activate</span>
                        ) : (
                          <span>Plan Limit Reached</span>
                        )
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-[#FDB02F]" />
                          <span>Activate {app.name}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </Button>
                  ) : (
                    <div className="w-full h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-xs text-slate-400 italic">
                      Contact workspace owner to activate
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Deactivate Application Modal */}
      {confirmDeactivateApp && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
          onClick={() => !deactivatingKey && setConfirmDeactivateApp(null)}
        >
          <div
            className="w-full max-w-md bg-[#0c080b]/95 border border-white/10 rounded-2xl shadow-2xl p-6 space-y-5 backdrop-blur-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">
                  Deactivate {confirmDeactivateApp.name}?
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Deactivating this application will disable operations and suspend active branch operations for{' '}
                  <span className="text-slate-200 font-semibold">{orgName}</span>.
                  You can reactivate it at any time.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmDeactivateApp(null)}
                disabled={Boolean(deactivatingKey)}
                className="h-9 px-4 border-white/10 hover:bg-white/5 text-slate-300 text-xs cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => handleDeactivateApp(confirmDeactivateApp)}
                disabled={Boolean(deactivatingKey)}
                className="h-9 px-4 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-lg shadow-rose-600/20 cursor-pointer flex items-center gap-1.5"
              >
                {deactivatingKey ? (
                  <>
                    <Spinner size="sm" /> Deactivating…
                  </>
                ) : (
                  <>
                    <PowerOff className="w-3.5 h-3.5" />
                    <span>Deactivate Application</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Modal for App Limit */}
      <UpgradeModal
        isOpen={upgradeModalOpen}
        workspaceId={currentWorkspace?.id}
        workspaceSlug={currentWorkspace?.slug}
        triggerReason="app_limit"
        onClose={() => setUpgradeModalOpen(false)}
        onSuccess={() => {
          setUpgradeModalOpen(false);
          loadAppData();
        }}
      />
    </div>
  );
};

