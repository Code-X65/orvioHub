import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { AuthGuard } from '../../components/auth/AuthGuard';
import { InventoryLanding } from './pages/Landing';
import { InventoryDashboard } from '../../pages/inventory/InventoryDashboard';
import { InventoryAppOnboarding } from './pages/InventoryAppOnboarding';
import { SingleBranchConfirmation } from './pages/SingleBranchConfirmation';
import { MultiBranchSetup } from './pages/MultiBranchSetup';
import { OpeningStockEntry } from './pages/OpeningStockEntry';
import { InventorySettingsPage } from '../../pages/settings/InventorySettingsPage';
import { BranchSettingsPage } from '../../pages/settings/BranchSettingsPage';
import { WorkspaceSettingsPage } from '../../pages/settings/WorkspaceSettingsPage';
import { BranchTeamManagement } from '../../pages/inventory/BranchTeamManagement';
import { AcceptInvite } from '../../pages/auth/AcceptInvite';
import { useWorkspaceStore } from '../../stores/useWorkspaceStore';
import { getCrossSubdomainUrl } from '@/lib/domain';
import { getCrossSubdomainItem } from '@/lib/cookieStorage';
import { Spinner } from '../../components/ui/spinner';

/**
 * Guard for resolving the workspace and completing Inventory setup. Application
 * activation is not an MVP prerequisite.
 */
let inFlightOnboardingChecks = new Map<string, Promise<any>>();

/**
 * Guard for checking whether the active workspace has completed onboarding.
 */
function InventoryOnboardingGuard({ children }: { children: React.ReactNode }) {
  const [searchParams] = useSearchParams();
  const urlOrg = searchParams.get('org');
  const { currentWorkspace, workspaces, fetchWorkspaces, selectWorkspace, isLoading: isWsLoading } = useWorkspaceStore();

  const [isChecking, setIsChecking] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean | null>(null);

  // 1. Ensure workspaces are loaded on initial subdomain visit
  useEffect(() => {
    if (workspaces.length === 0 && !isWsLoading) {
      fetchWorkspaces('inventory').catch(() => {});
    }
  }, [workspaces.length, isWsLoading, fetchWorkspaces]);

  // 2. Check onboarding once workspace is identified.
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

    let checkPromise = inFlightOnboardingChecks.get(resolvedOrgId);
    if (!checkPromise) {
      checkPromise = fetch(`/api/v1/organizations/${resolvedOrgId}/inventory-onboarding`, {
        credentials: 'include',
      })
        .then(async (response) => (response.ok ? response.json() : null))
        .catch(() => null);
      inFlightOnboardingChecks.set(resolvedOrgId, checkPromise);
      checkPromise.finally(() => {
        setTimeout(() => inFlightOnboardingChecks.delete(resolvedOrgId), 5000);
      });
    }

    checkPromise
      .then((onboardRes) => {
        if (!isMounted) return;
        const isCompleted = onboardRes?.data?.completed ?? (onboardRes as any)?.completed ?? true;
        setHasCompletedOnboarding(Boolean(isCompleted));
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

  if (isChecking) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center space-y-3">
        <Spinner size="lg" className="text-[#714b67]" />
        <p className="text-xs text-slate-400">Loading workspace...</p>
      </div>
    );
  }

  const effectiveOrgId = urlOrg || currentWorkspace?.id || getCrossSubdomainItem('orvio_active_workspace_id');

  if (!effectiveOrgId && !isWsLoading && workspaces.length === 0) {
    window.location.href = getCrossSubdomainUrl('home', '/dashboard');
    return null;
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
            <InventoryOnboardingGuard>
              <InventoryDashboard />
            </InventoryOnboardingGuard>
          </AuthGuard>
        }
      />
      <Route
        path="/dashboard/*"
        element={
          <AuthGuard>
            <InventoryOnboardingGuard>
              <InventoryDashboard />
            </InventoryOnboardingGuard>
          </AuthGuard>
        }
      />
      <Route
        path="/inventory"
        element={
          <AuthGuard>
            <InventoryOnboardingGuard>
              <InventoryDashboard />
            </InventoryOnboardingGuard>
          </AuthGuard>
        }
      />
      <Route
        path="/inventory/dashboard"
        element={
          <AuthGuard>
            <InventoryOnboardingGuard>
              <InventoryDashboard />
            </InventoryOnboardingGuard>
          </AuthGuard>
        }
      />
      <Route
        path="/inventory/dashboard/*"
        element={
          <AuthGuard>
            <InventoryOnboardingGuard>
              <InventoryDashboard />
            </InventoryOnboardingGuard>
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
      <Route
        path="/onboard/opening-stock"
        element={
          <AuthGuard>
            <OpeningStockEntry />
          </AuthGuard>
        }
      />
      <Route
        path="/inventory/opening-stock"
        element={
          <AuthGuard>
            <OpeningStockEntry />
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
            <InventoryOnboardingGuard>
              <div className="min-h-screen bg-slate-950 p-6">
                <BranchTeamManagement />
              </div>
            </InventoryOnboardingGuard>
          </AuthGuard>
        }
      />
      <Route
        path="/inventory/team"
        element={
          <AuthGuard>
            <InventoryOnboardingGuard>
              <div className="min-h-screen bg-slate-950 p-6">
                <BranchTeamManagement />
              </div>
            </InventoryOnboardingGuard>
          </AuthGuard>
        }
      />
      <Route
        path="/settings/team"
        element={
          <AuthGuard>
            <InventoryOnboardingGuard>
              <div className="min-h-screen bg-slate-950 p-6">
                <BranchTeamManagement />
              </div>
            </InventoryOnboardingGuard>
          </AuthGuard>
        }
      />
      <Route
        path="/team"
        element={
          <AuthGuard>
            <InventoryOnboardingGuard>
              <div className="min-h-screen bg-slate-950 p-6">
                <BranchTeamManagement />
              </div>
            </InventoryOnboardingGuard>
          </AuthGuard>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
