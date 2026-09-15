import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { AuthGuard } from '../../components/auth/AuthGuard';
import { InventoryLanding } from './pages/Landing';
import { InventoryDashboard } from '../../pages/inventory/InventoryDashboard';
import { InventoryAppOnboarding } from './pages/InventoryAppOnboarding';
import { SingleBranchConfirmation } from './pages/SingleBranchConfirmation';
import { MultiBranchSetup } from './pages/MultiBranchSetup';
import { InventorySettingsPage } from '../../pages/settings/InventorySettingsPage';
import { BranchSettingsPage } from '../../pages/settings/BranchSettingsPage';
import { WorkspaceSettingsPage } from '../../pages/settings/WorkspaceSettingsPage';
import { BranchTeamManagement } from '../../pages/inventory/BranchTeamManagement';
import { AcceptInvite } from '../../pages/auth/AcceptInvite';
import { useWorkspaceStore } from '../../stores/useWorkspaceStore';
import { api } from '../../lib/api';
import { getCrossSubdomainUrl } from '@/lib/domain';
import { getCrossSubdomainItem } from '@/lib/cookieStorage';
import { Spinner } from '../../components/ui/spinner';

/**
 * Guard for checking whether the active workspace has the Inventory module activated.
 */
let inFlightActivationChecks = new Map<string, Promise<[any, any, any]>>();

/**
 * Guard for checking whether the active workspace has the Inventory module activated.
 */
function InventoryActivationGuard({ children }: { children: React.ReactNode }) {
  const [searchParams] = useSearchParams();
  const urlOrg = searchParams.get('org');
  const { currentWorkspace, workspaces, fetchWorkspaces, selectWorkspace, isLoading: isWsLoading } = useWorkspaceStore();

  const isAlreadyActive =
    currentWorkspace?.enabledModules?.includes('inventory') ||
    currentWorkspace?.enabledModules?.includes('pos') ||
    false;

  const [isChecking, setIsChecking] = useState(!isAlreadyActive);
  const [isAppInactive, setIsAppInactive] = useState(false);
  const [isAppForbidden, setIsAppForbidden] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean | null>(null);

  // 1. Ensure workspaces are loaded on initial subdomain visit
  useEffect(() => {
    if (workspaces.length === 0 && !isWsLoading) {
      fetchWorkspaces('inventory').catch(() => {});
    }
  }, [workspaces.length, isWsLoading, fetchWorkspaces]);

  // 2. Check activation status & onboarding once workspace is identified
  useEffect(() => {
    let isMounted = true;
    const resolvedOrgId = urlOrg || currentWorkspace?.id || getCrossSubdomainItem('orvio_active_workspace_id');

    if (!resolvedOrgId) {
      if (!isWsLoading && workspaces.length === 0) {
        setIsChecking(false);
      }
      return;
    }

    if (urlOrg && currentWorkspace?.id !== urlOrg) {
      selectWorkspace(urlOrg).catch(() => {});
    }

    // Safety timeout so user never hangs indefinitely
    const timeout = setTimeout(() => {
      if (isMounted) {
        setIsChecking(false);
      }
    }, 2000);

    let checkPromise = inFlightActivationChecks.get(resolvedOrgId);
    if (!checkPromise) {
      checkPromise = Promise.all([
        api
          .get<{ success: boolean; data?: { active: boolean; status?: string } }>(
            `/organizations/${resolvedOrgId}/applications/inventory/status`
          )
          .catch(() => null),
        api
          .get<{ completed: boolean }>(`/organizations/${resolvedOrgId}/inventory-onboarding`)
          .catch(() => null),
        api
          .get<{ success: boolean; data?: { allowed: boolean; reason?: string } }>(
            `/organizations/${resolvedOrgId}/applications/inventory/access`
          )
          .catch(() => null),
      ]);
      inFlightActivationChecks.set(resolvedOrgId, checkPromise);
      checkPromise.finally(() => {
        setTimeout(() => inFlightActivationChecks.delete(resolvedOrgId), 5000);
      });
    }

    checkPromise
      .then(async ([activeRes, onboardRes, accessRes]) => {
        if (!isMounted) return;

        // Check RBAC permission first
        if (accessRes?.data && accessRes.data.allowed === false) {
          setIsAppForbidden(true);
        } else {
          setIsAppForbidden(false);
        }

        // Check app activation status
        if (activeRes?.data && !activeRes.data.active) {
          setIsAppInactive(true);
        } else {
          setIsAppInactive(false);
        }

        setHasCompletedOnboarding(Boolean(onboardRes?.completed ?? true));
      })
      .catch(() => {
        if (!isMounted) return;
        setHasCompletedOnboarding(true);
      })
      .finally(() => {
        clearTimeout(timeout);
        if (isMounted) {
          setIsChecking(false);
        }
      });

    return () => {
      isMounted = false;
      clearTimeout(timeout);
    };
  }, [urlOrg, currentWorkspace?.id, isWsLoading, workspaces.length, selectWorkspace]);

  if (isChecking && !isAlreadyActive) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center space-y-3">
        <Spinner size="lg" className="text-[#714b67]" />
        <p className="text-xs text-slate-400">Verifying application access...</p>
      </div>
    );
  }

  const effectiveOrgId = urlOrg || currentWorkspace?.id || getCrossSubdomainItem('orvio_active_workspace_id');

  if (!effectiveOrgId && !isWsLoading && workspaces.length === 0) {
    window.location.href = getCrossSubdomainUrl('home', '/dashboard');
    return null;
  }

  if (isAppForbidden) {
    return (
      <div className="min-h-screen bg-black text-slate-100 flex flex-col items-center justify-center p-6 selection:bg-[#714b67] selection:text-white">
        <div className="max-w-md w-full bg-[#120a11] border border-rose-500/30 rounded-2xl p-8 shadow-2xl text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400 shadow-lg">
            <span className="text-2xl font-bold">🔒</span>
          </div>
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2.5 py-0.5 rounded-full border border-rose-500/20 uppercase tracking-wider">
              Access Restricted
            </span>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Permission Required
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              You do not have permission to access the Inventory module in{' '}
              <span className="text-slate-200 font-semibold">{currentWorkspace?.name || 'this organization'}</span>.
              Please ask your organization owner or administrator to grant you access.
            </p>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
            <a
              href={getCrossSubdomainUrl('home', '/dashboard')}
              className="w-full sm:flex-1 h-10 rounded-lg bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold flex items-center justify-center shadow-lg shadow-[#714b67]/25 transition-all"
            >
              All Organizations
            </a>
            <a
              href={getCrossSubdomainUrl('home', '/applications')}
              className="w-full sm:flex-1 h-10 rounded-lg border border-white/10 hover:bg-white/5 text-slate-300 text-xs font-medium flex items-center justify-center transition-all"
            >
              My Applications
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (isAppInactive) {
    return (
      <div className="min-h-screen bg-black text-slate-100 flex flex-col items-center justify-center p-6 selection:bg-[#714b67] selection:text-white">
        <div className="max-w-md w-full bg-[#120a11] border border-[#714b67]/30 rounded-2xl p-8 shadow-2xl text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-14 h-14 rounded-2xl bg-[#714b67]/20 border border-[#714b67]/40 flex items-center justify-center mx-auto text-[#FDB02F] shadow-lg">
            <span className="text-2xl font-bold">📦</span>
          </div>
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20 uppercase tracking-wider">
              Application Inactive
            </span>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Inventory Is Deactivated
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              The Inventory application is currently deactivated for{' '}
              <span className="text-slate-200 font-semibold">{currentWorkspace?.name || 'this organization'}</span>.
              An administrator can reactivate it in Organization Applications.
            </p>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
            <a
              href={getCrossSubdomainUrl('home', '/applications')}
              className="w-full sm:flex-1 h-10 rounded-lg bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold flex items-center justify-center shadow-lg shadow-[#714b67]/25 transition-all"
            >
              Manage Applications
            </a>
            <a
              href={getCrossSubdomainUrl('home', '/dashboard')}
              className="w-full sm:flex-1 h-10 rounded-lg border border-white/10 hover:bg-white/5 text-slate-300 text-xs font-medium flex items-center justify-center transition-all"
            >
              All Organizations
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (hasCompletedOnboarding === false) {
    return <Navigate to={`/onboard/app?org=${effectiveOrgId}`} replace />;
  }

  return <>{children}</>;
}

export default function InventoryApp() {
  return (
    <Routes>
      <Route path="/invite" element={<AcceptInvite />} />
      <Route path="/invite/:token" element={<AcceptInvite />} />
      <Route path="/invitations" element={<AcceptInvite />} />
      <Route path="/invitations/:token" element={<AcceptInvite />} />

      {/* 1. Public Inventory Landing & Feature Showcase */}
      <Route path="/" element={<InventoryLanding />} />
      <Route path="/features" element={<InventoryLanding />} />
      <Route path="/pricing" element={<InventoryLanding />} />
      <Route path="/preview" element={<InventoryLanding />} />
      <Route path="/overview" element={<InventoryLanding />} />

      {/* 2. Authenticated Application Dashboard & Operations (Guarded with Activation Check) */}
      <Route
        path="/dashboard"
        element={
          <AuthGuard>
            <InventoryActivationGuard>
              <InventoryDashboard />
            </InventoryActivationGuard>
          </AuthGuard>
        }
      />
      <Route
        path="/dashboard/*"
        element={
          <AuthGuard>
            <InventoryActivationGuard>
              <InventoryDashboard />
            </InventoryActivationGuard>
          </AuthGuard>
        }
      />
      <Route
        path="/inventory"
        element={
          <AuthGuard>
            <InventoryActivationGuard>
              <InventoryDashboard />
            </InventoryActivationGuard>
          </AuthGuard>
        }
      />
      <Route
        path="/inventory/dashboard"
        element={
          <AuthGuard>
            <InventoryActivationGuard>
              <InventoryDashboard />
            </InventoryActivationGuard>
          </AuthGuard>
        }
      />
      <Route
        path="/inventory/dashboard/*"
        element={
          <AuthGuard>
            <InventoryActivationGuard>
              <InventoryDashboard />
            </InventoryActivationGuard>
          </AuthGuard>
        }
      />
      {/* 3. Application Activation & Onboarding Wizard Flows (US-A2, US-3, US-4A, US-4B) */}
      <Route
        path="/onboard/activate"
        element={<Navigate to="/onboard/app" replace />}
      />
      <Route
        path="/onboard/app"
        element={
          <AuthGuard>
            <InventoryAppOnboarding />
          </AuthGuard>
        }
      />
      <Route
        path="/onboard/branch-single"
        element={
          <AuthGuard>
            <SingleBranchConfirmation />
          </AuthGuard>
        }
      />
      <Route
        path="/onboard/branch-multi"
        element={
          <AuthGuard>
            <MultiBranchSetup />
          </AuthGuard>
        }
      />
      <Route path="/onboard" element={<Navigate to="/onboard/app" replace />} />
      <Route path="/onboard/*" element={<Navigate to="/onboard/app" replace />} />
      <Route path="/onboarding" element={<Navigate to="/onboard/app" replace />} />
      <Route path="/onboarding/*" element={<Navigate to="/onboard/app" replace />} />
      <Route path="/onboarding/inventory" element={<Navigate to="/onboard/app" replace />} />
      <Route
        path="/settings"
        element={
          <AuthGuard>
            <InventorySettingsPage />
          </AuthGuard>
        }
      />
      <Route
        path="/settings/products"
        element={
          <AuthGuard>
            <InventorySettingsPage />
          </AuthGuard>
        }
      />
      <Route
        path="/settings/stock"
        element={
          <AuthGuard>
            <InventorySettingsPage />
          </AuthGuard>
        }
      />
      <Route
        path="/settings/sales"
        element={
          <AuthGuard>
            <InventorySettingsPage />
          </AuthGuard>
        }
      />
      <Route
        path="/settings/receipts"
        element={
          <AuthGuard>
            <InventorySettingsPage />
          </AuthGuard>
        }
      />
      <Route
        path="/settings/branches"
        element={
          <AuthGuard>
            <BranchSettingsPage />
          </AuthGuard>
        }
      />
      <Route
        path="/settings/branches/:branchId"
        element={
          <AuthGuard>
            <BranchSettingsPage />
          </AuthGuard>
        }
      />
      <Route
        path="/settings/organization"
        element={
          <AuthGuard>
            <WorkspaceSettingsPage />
          </AuthGuard>
        }
      />
      <Route
        path="/organization/settings"
        element={
          <AuthGuard>
            <WorkspaceSettingsPage />
          </AuthGuard>
        }
      />
      <Route
        path="/inventory/settings/team"
        element={
          <AuthGuard>
            <InventoryActivationGuard>
              <div className="min-h-screen bg-slate-950 p-6">
                <BranchTeamManagement />
              </div>
            </InventoryActivationGuard>
          </AuthGuard>
        }
      />
      <Route
        path="/inventory/team"
        element={
          <AuthGuard>
            <InventoryActivationGuard>
              <div className="min-h-screen bg-slate-950 p-6">
                <BranchTeamManagement />
              </div>
            </InventoryActivationGuard>
          </AuthGuard>
        }
      />
      <Route
        path="/settings/team"
        element={
          <AuthGuard>
            <InventoryActivationGuard>
              <div className="min-h-screen bg-slate-950 p-6">
                <BranchTeamManagement />
              </div>
            </InventoryActivationGuard>
          </AuthGuard>
        }
      />
      <Route
        path="/team"
        element={
          <AuthGuard>
            <InventoryActivationGuard>
              <div className="min-h-screen bg-slate-950 p-6">
                <BranchTeamManagement />
              </div>
            </InventoryActivationGuard>
          </AuthGuard>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
